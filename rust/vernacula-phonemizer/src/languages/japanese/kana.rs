//! Japanese kana → canonical IPA, mora by mora (gojūon, youon, sokuon, long vowels, moraic ん).
//! Ported from src/languages/japanese/kana.ts — see that file for the corpus evidence.

use super::manifest::T;
use super::{first_unit, to_hiragana};
use crate::core::js_string::{JsString, js};

/// Whether a mora starts with a vowel phoneme, compared whole: ɯᵝ, e̞ and o̞ are two code units each.
fn starts_with_vowel(mora: &JsString) -> bool {
    let t = &*T;
    [&t.a, &t.i, &t.u, &t.e, &t.o]
        .into_iter()
        .any(|v| mora.starts_with(v))
}

fn vowel_of(ms: &JsString) -> JsString {
    let t = &*T;
    for v in [&t.u, &t.o, &t.e, &t.a, &t.i] {
        if ms.ends_with(v) {
            return v.clone();
        }
    }
    JsString::new()
}

/// A run of kana → its morae (one element per mora), or `None` if a character is not kana.
pub fn kana_to_morae(word: &JsString) -> Option<Vec<JsString>> {
    let t = &*T;
    let chars = to_hiragana(word).code_point_strings();
    let empty = JsString::new();
    let at = |k: usize| chars.get(k).unwrap_or(&empty);
    let mut morae: Vec<JsString> = Vec::new();
    let mut i = 0;
    let mut last_vowel = JsString::new();
    let long = js("ː");
    while i < chars.len() {
        let c = &chars[i];
        let nx = at(i + 1);
        if let Some(ms) = t.foreign.get(&c.concat(nx)) {
            morae.push(ms.clone());
            last_vowel = vowel_of(ms);
            i += 2;
            continue;
        }
        if let (Some(on), Some(y)) = (t.youon_onset.get(c), t.small_y.get(nx)) {
            let ms = on.concat(y);
            last_vowel = vowel_of(&ms);
            morae.push(ms);
            i += 2;
            continue;
        }
        if *c == "っ" || *c == "ッ" {
            let next = match (t.small_y.get(at(i + 2)), t.youon_onset.get(nx)) {
                (Some(y), Some(on)) => Some(on.concat(y)),
                _ => t.mora.get(nx).cloned(),
            };
            // The geminate is `next[0]`, the first CODE UNIT, as the TS pushes it.
            let pushed = match next.as_ref() {
                Some(n) if !starts_with_vowel(n) => first_unit(n).unwrap_or_else(|| js("ʔ")),
                _ => js("ʔ"),
            };
            morae.push(pushed);
            last_vowel = JsString::new();
            i += 1;
            continue;
        }
        if *c == "ー" || *c == "ｰ" {
            if !morae.is_empty() {
                morae.push(long.clone());
            }
            i += 1;
            continue;
        }
        let m = t.mora.get(c)?;
        if !last_vowel.is_empty()
            && ((*c == "う" && last_vowel == t.o)
                || (*c == "い" && last_vowel == t.e)
                || t.vowel_kana.get(c) == Some(&last_vowel))
        {
            morae.push(long.clone());
            i += 1;
            continue;
        }
        morae.push(m.clone());
        last_vowel = vowel_of(m);
        i += 1;
    }
    Some(assimilate_moraic_n(morae))
}

/// Sokuon: a `ʔ` before a consonant-initial mora becomes that consonant (its first code unit).
pub fn geminate_sokuon(mut morae: Vec<JsString>) -> Vec<JsString> {
    for k in 0..morae.len() {
        if morae[k] != "ʔ" {
            continue;
        }
        if let Some(next) = morae.get(k + 1) {
            if let Some(onset) = first_unit(next).filter(|_| !starts_with_vowel(next)) {
                morae[k] = onset;
            }
        }
    }
    morae
}

/// Moraic ん (`ɴ`) takes the place of the following onset's first code unit, per `nasalAssimilation`.
pub fn assimilate_moraic_n(mut morae: Vec<JsString>) -> Vec<JsString> {
    let t = &*T;
    for k in 0..morae.len() {
        if morae[k] != "ɴ" {
            continue;
        }
        let Some(o) = morae.get(k + 1).and_then(first_unit) else {
            continue;
        };
        for (onsets, nasal) in &t.nasal {
            if onsets.includes(&o) {
                morae[k] = nasal.clone();
                break;
            }
        }
    }
    morae
}

/// A run of kana → IPA, or `None` if it is not kana.
pub fn kana_to_ipa(word: &JsString) -> Option<JsString> {
    kana_to_morae(word).map(|m| JsString::join(&m, &JsString::new()))
}

/// Morae for a word given as reading segments; coalescence stays inside a segment.
pub fn segments_to_morae(segments: &[JsString]) -> Option<Vec<JsString>> {
    let mut out = Vec::new();
    for seg in segments {
        if seg.is_empty() {
            continue;
        }
        out.extend(kana_to_morae(seg)?);
    }
    Some(assimilate_moraic_n(geminate_sokuon(out)))
}
