//! Japanese kana → canonical IPA, mora by mora (gojūon, youon, sokuon, long vowels, moraic ん).
//! Ported from src/languages/japanese/kana.ts — see that file for the corpus evidence.

use super::manifest::T;
use super::{first_unit, to_hiragana};
use crate::core::js_string::{JsString, js};
use std::collections::HashSet;
use std::sync::LazyLock;

/// The five vowels, in the order `vowel_of` must test them (ɯᵝ/o̞/e̞ before their bases).
fn vowels() -> [&'static JsString; 5] {
    let t: &'static super::manifest::Tables = &T;
    [&t.u, &t.o, &t.e, &t.a, &t.i]
}

fn vowel_of(ms: &JsString) -> JsString {
    for v in vowels() {
        if ms.ends_with(v) {
            return v.clone();
        }
    }
    JsString::new()
}

/// The glottal stop a っ reads as when nothing follows it that can geminate.
pub const GLOTTAL: &str = "ʔ";

/// The consonant phones: the first code unit of every onset the manifest declares (each consonant+vowel
/// mora of `mora` and `foreign`, plus every `youonOnset`). Derived, never listed by hand.
static CONSONANTS: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    let t = &*T;
    let mut out = HashSet::new();
    for ms in t.mora.values().chain(t.foreign.values()) {
        let v = vowel_of(ms);
        if !v.is_empty() && ms.len() > v.len() {
            out.extend(first_unit(ms));
        }
    }
    for on in t.youon_onset.values() {
        out.extend(first_unit(on));
    }
    out
});

/// Whether a っ before this mora geminates it: a consonant onset plus a vowel. Before a vowel, ー, ん or
/// another っ's geminate it is the glottal stop.
fn geminates_before(mora: &JsString) -> bool {
    first_unit(mora).is_some_and(|c| CONSONANTS.contains(&c)) && !vowel_of(mora).is_empty()
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
            // The next mora exactly as the loop reads it: foreign, then youon, then a single kana.
            let nx2 = at(i + 2);
            let next = match t.foreign.get(&nx.concat(nx2)) {
                Some(f) => Some(f.clone()),
                None => match (t.small_y.get(nx2), t.youon_onset.get(nx)) {
                    (Some(y), Some(on)) => Some(on.concat(y)),
                    _ => t.mora.get(nx).cloned(),
                },
            };
            // The geminate is `next[0]`, the first CODE UNIT, as the TS pushes it.
            let pushed = match next.as_ref().filter(|n| geminates_before(n)) {
                Some(n) => first_unit(n).unwrap_or_else(|| js(GLOTTAL)),
                None => js(GLOTTAL),
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

/// Sokuon: a `ʔ` before a consonant+vowel mora becomes that consonant (its first code unit). The same rule
/// as `kana_to_morae`, so it leaves that function's output unchanged.
pub fn geminate_sokuon(mut morae: Vec<JsString>) -> Vec<JsString> {
    for k in 0..morae.len() {
        if morae[k] != GLOTTAL {
            continue;
        }
        if let Some(onset) = morae
            .get(k + 1)
            .filter(|n| geminates_before(n))
            .and_then(first_unit)
        {
            morae[k] = onset;
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

#[cfg(test)]
mod tests {
    use super::*;

    fn morae(w: &str) -> Vec<JsString> {
        kana_to_morae(&js(w)).unwrap()
    }

    fn cat(parts: &[&[JsString]]) -> Vec<JsString> {
        parts.concat()
    }

    /// っ geminates only a consonant+vowel mora; before a vowel, ー, ん or another っ it is the glottal stop,
    /// on the one-word path and the per-segment path alike. Expectations come from the engine's own phones.
    #[test]
    fn sokuon_is_a_glottal_stop_before_an_onsetless_mora() {
        let g = [js(GLOTTAL)];
        for v in ["あ", "い", "う", "え", "お"] {
            assert_eq!(
                morae(&format!("あっ{v}")),
                cat(&[&morae("あ"), &g, &morae(v)]),
                "{v}"
            );
        }
        let tails = [
            ("ー", morae("あー")[1..].to_vec()),
            ("ん", morae("ん")),
            ("っか", morae("っか")),
        ];
        for (rest, tail) in tails {
            let want = cat(&[&morae("あ"), &g, &tail]);
            let w = format!("あっ{rest}");
            assert_eq!(morae(&w), want, "{rest}");
            assert_eq!(segments_to_morae(&[js(&w)]).unwrap(), want, "{rest}");
        }
        assert_eq!(
            segments_to_morae(&[js("あっ"), js("っか")]).unwrap(),
            morae("あっっか")
        );
        for (w, head, next) in [
            ("かった", "か", "た"),
            ("あっきゃ", "あ", "きゃ"),
            ("あっうぃ", "あ", "うぃ"),
        ] {
            let m = morae(w);
            assert_eq!(
                Some(m[m.len() - 2].clone()),
                first_unit(&morae(next)[0]),
                "{w}"
            );
            let segs = [js(&format!("{head}っ")), js(next)];
            assert_eq!(segments_to_morae(&segs).unwrap(), m, "{w}");
        }
    }

    /// geminate_sokuon leaves kana_to_morae's output unchanged over the ja-kana singles and pairs plus っ + pair.
    #[test]
    fn geminate_sokuon_is_idempotent_on_kana_to_morae() {
        let mut singles: Vec<String> = ["ー", "ｰ", "ッ", "ゝ"]
            .iter()
            .map(|s| s.to_string())
            .collect();
        singles.extend(
            (0x3041..=0x3096)
                .chain(0x30a1..=0x30fa)
                .filter_map(char::from_u32)
                .map(String::from),
        );
        let mut checked = 0;
        for a in &singles {
            for b in std::iter::once("").chain(singles.iter().map(String::as_str)) {
                for w in [format!("{a}{b}"), format!("っ{a}{b}")] {
                    let Some(m) = kana_to_morae(&js(&w)) else {
                        continue;
                    };
                    checked += 1;
                    assert_eq!(geminate_sokuon(m.clone()), m, "{w}");
                }
            }
        }
        assert!(checked > 30_000, "{checked}");
    }
}
