//! Vietnamese syllable g2p (Northern / Hanoi): the tone from the NFD diacritic, the longest-match onset, the
//! closed rhyme table, then onset + glide + ˈ + nucleus + tone + coda.
//! Ported from src/languages/vietnamese/g2p.ts — see that file for the corpus evidence.

use std::sync::OnceLock;

use indexmap::IndexMap;

use super::manifest::{DIR, MANIFEST};
use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, js};
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};
use crate::core::provenance::{Form, normalize};
use crate::js_re;

/// `rhymes()`: rhymes.tsv, loaded once.
pub fn try_rhymes() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static R: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&R, || {
        load_tsv_strings(DIR, "rhymes.tsv", TsvOptions::default()).map_err(|e| e.to_string())
    })
}

/// `VOWEL_LETTER.has(c)` / `VOWEL_IPA.has(c)` on one code unit (every member is a BMP code point).
fn in_set(set: &str, c: Option<u16>) -> bool {
    c.is_some_and(|c| set.encode_utf16().any(|v| v == c))
}

/// `splitTone(syl)`: the toneless base (NFC, lowercased) and the Chao contour.
fn split_tone(syl: &JsString) -> (JsString, JsString) {
    let tones = &MANIFEST.tones;
    let mut tone = js(&tones.ngang);
    let mut out = JsString::new();
    for ch in normalize(syl, Form::Nfd).code_point_strings() {
        // A lone surrogate reads as U+FFFD here, which is no key.
        match tones.diacritics.get(&ch.to_string_lossy()) {
            Some(t) => tone = js(t),
            None => out.push_str(&ch),
        }
    }
    (normalize(&out, Form::Nfc).to_lower_case(), tone)
}

/// `parseOnset(base)`: the onset's IPA and the rhyme orthography after it.
fn parse_onset(base: &JsString) -> (JsString, JsString) {
    let vowels = &MANIFEST.vowel_letters;
    for (o, ipa) in &MANIFEST.onsets {
        let o = js(o);
        if base.starts_with(&o) {
            let mut rest = base.slice(o.len() as isize, None);
            if o == js("gi") {
                if rest.is_empty()
                    || !in_set(vowels, rest.char_code_at(0))
                    || rest.char_code_at(0) == Some('ê' as u16)
                {
                    rest = js("i").concat(&rest);
                }
            } else if o == js("qu") {
                let b2 = base.char_code_at(2);
                if b2 == Some('ô' as u16) || b2 == Some('ơ' as u16) {
                    return (js("k"), js("u").concat(&base.slice(2, None)));
                }
                rest = base.slice(2, None);
            }
            return (js(ipa), rest);
        }
    }
    if !base.is_empty() && in_set(vowels, base.char_code_at(0)) {
        return (js("ʔ"), base.clone());
    }
    (JsString::new(), base.clone())
}

/// `phonemizeSyllable(syl)`: canonical IPA with tone and stress mark, or "" if not a parseable syllable.
pub fn phonemize_syllable(syl: &JsString) -> JsString {
    let (base, tone) = split_tone(syl);
    if base.is_empty() {
        return JsString::new();
    }
    let (onset, rest) = parse_onset(&base);
    let Some(rhyme) = try_rhymes()
        .expect("checked by create_vietnamese")
        .get(&rest)
    else {
        return JsString::new();
    };
    let mut r = rhyme.clone();
    let mut glide = JsString::new();
    if r.starts_with(&js("w")) && r.len() > 1 && in_set(&MANIFEST.vowel_ipa, r.char_code_at(1)) {
        glide = js("w");
        r = r.slice(1, None);
    }
    let coda = js_re!(r"(t̪|[ptkmnŋɲwj])$", "u")
        .exec(&r)
        .map(|m| m.value(&r))
        .unwrap_or_default();
    let nucleus = if coda.is_empty() {
        r.clone()
    } else {
        r.slice(0, Some((r.len() - coda.len()) as isize))
    };
    onset
        .concat(&glide)
        .concat(&js("ˈ"))
        .concat(&nucleus)
        .concat(&tone)
        .concat(&coda)
}
