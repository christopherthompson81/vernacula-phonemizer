//! Nogai (nog) phonemizer: a digraph-aware Cyrillic scan (coda в → w, е iotated after a vowel segment, a stray ъ
//! as a glottal stop) with final stress placed before the onset a sonority test allows, and text() over words,
//! numbers and punctuation. Ported from src/languages/nogai/nogai.ts — see that file for the sources.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::normalize_nogai;
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::ipa::is_ipa_vowel;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/nogai";

/// `NogaiDef` (nogai.ts). Every field the TS interface names is required.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NogaiDef {
    pub consonants: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub iotated: IndexMap<String, String>,
    pub digraphs: IndexMap<String, String>,
    pub vowel_letters: Vec<String>,
}

pub fn try_def() -> Result<&'static NogaiDef, String> {
    static D: OnceLock<NogaiDef> = OnceLock::new();
    load_once(&D, || {
        load_manifest(DIR, "nogai.jsonc").map_err(|e| e.to_string())
    })
}

/// `DEF`, for code reached only through a checked path (`createNogai` loads it first).
static DEF: LazyLock<&'static NogaiDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

/// `isVowelSeg(s)`: `[...s].some((c) => IPA_VOWEL.has(c))`, false for no segment.
fn is_vowel_seg(seg: Option<&JsString>) -> bool {
    seg.is_some_and(|s| {
        s.code_point_strings()
            .iter()
            .any(|c| c.len() == 1 && is_ipa_vowel(c.units()[0]))
    })
}

/// `sonority(seg)`: vowel 6, glide 5, liquid 4, nasal 3, fricative 2, affricate 1, stop 0.
fn sonority(seg: &JsString) -> u8 {
    let s = seg.to_string_lossy();
    if is_vowel_seg(Some(seg)) {
        6
    } else if s == "j" || s == "w" {
        5
    } else if s == "l" || s == "r" {
        4
    } else if ["m", "n", "ŋ"].contains(&s.as_str()) {
        3
    } else if s.contains('\u{361}') {
        1
    } else if ["f", "v", "s", "z", "ʃ", "ʒ", "x", "χ", "h", "ʁ", "ɣ"].contains(&s.as_str()) {
        2
    } else {
        0
    }
}

/// `phonemizeWord(word)`: the digraph-aware scan, then the stress mark before the last nucleus and its onset.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let d = &*DEF;
    // `[...w]`: code points, a lone surrogate as its own item (it matches no table).
    let chars: Vec<String> = normalize(word, Form::Nfc)
        .to_lower_case()
        .code_point_strings()
        .iter()
        .map(|c| c.to_string_lossy())
        .collect();
    let is_vowel_letter = |c: &str| d.vowel_letters.iter().any(|v| v == c);
    let mut segs: Vec<JsString> = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let ch = chars[i].as_str();
        let pair = format!("{ch}{}", chars.get(i + 1).map_or("", |s| s.as_str()));
        if let Some(dg) = d.digraphs.get(&pair) {
            segs.push(js(dg));
            i += 2;
            continue;
        }
        if ch == "в" {
            let coda = chars.get(i + 1).is_none_or(|nx| !is_vowel_letter(nx));
            segs.push(js(if is_vowel_seg(segs.last()) && coda {
                "w"
            } else {
                "v"
            }));
            i += 1;
            continue;
        }
        if ch == "е" {
            segs.push(js(if segs.is_empty() || is_vowel_seg(segs.last()) {
                "je"
            } else {
                "e"
            }));
            i += 1;
            continue;
        }
        if let Some(c) = d.consonants.get(ch) {
            segs.push(js(c));
        } else if let Some(c) = d.iotated.get(ch) {
            segs.push(js(c));
        } else if let Some(c) = d.vowels.get(ch) {
            segs.push(js(c));
        } else if ch == "ъ" {
            segs.push(js("ʔ"));
        }
        i += 1;
    }
    if let Some(last) = (0..segs.len())
        .rev()
        .find(|&i| is_vowel_seg(Some(&segs[i])))
    {
        let mut at = last;
        if at > 0 && !is_vowel_seg(Some(&segs[at - 1])) {
            at -= 1;
        }
        while at > 0 && !is_vowel_seg(Some(&segs[at - 1])) {
            let (p, l) = (&segs[at - 1], &segs[at]);
            let obstruent_liquid = sonority(p) <= 2 && sonority(l) >= 4;
            let sibilant_stop =
                ["s", "ʃ"].contains(&p.to_string_lossy().as_str()) && sonority(l) <= 1;
            if !(obstruent_liquid || sibilant_stop) {
                break;
            }
            at -= 1;
        }
        segs.insert(at, js("ˈ"));
    }
    normalize(&JsString::join(&segs, &JsString::new()), Form::Nfc)
}

/// `number(digits)`: an unsafe integer is read digit at a time, each digit's words phonemized.
fn number(digits: &JsString) -> JsString {
    let n = js_number(digits);
    let words: Vec<&str> = if is_safe_integer(n) {
        number_to_words(n)
    } else {
        digits
            .code_point_strings()
            .iter()
            .flat_map(|d| number_to_words(js_number(d)))
            .collect()
    };
    let ipa: Vec<JsString> = words.iter().map(|w| phonemize_word(&js(w))).collect();
    JsString::join(&ipa, &js(" "))
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"([Ѐ-ӿ]+)|(\d+)|([.!?…,;:])", "gu").unwrap());

/// The Nogai engine (`createNogai`).
pub struct NogaiPhonemizer {
    _loaded: (),
}

/// The module functions, exposed through the engine: holding one proves the manifest loaded.
/// (The per-module differentials call them.)
impl NogaiPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_nogai(text)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn number_words(&self, n: f64) -> JsString {
        js(&number_to_words(n).join("|"))
    }

    pub fn text(&self, input: &JsString) -> JsString {
        assemble_clauses(&normalize_nogai(input), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(n) = m.group(2, s).filter(|n| !n.is_empty()) {
                sink.emit(&number(&n));
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty()) {
                let mark = if p == "." || p == "!" || p == "?" {
                    p
                } else {
                    js(",")
                };
                sink.pause(&mark);
            }
        })
    }
}

impl Engine for NogaiPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(NogaiPhonemizer::text(self, input))
    }
}

/// `createNogai()`. Errors when the manifest cannot be loaded.
pub fn create_nogai() -> Result<NogaiPhonemizer, String> {
    try_def()?;
    Ok(NogaiPhonemizer { _loaded: () })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/nogai.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["туькен"], Some("tyˈken")),
        ("phonemizeWord", &["коьз"], Some("ˈkøz")),
        ("phonemizeWord", &["муьйиз"], Some("myˈjiz")),
        ("phonemizeWord", &["къыз"], Some("ˈqɯz")),
        ("phonemizeWord", &["гъарув"], Some("ʁaˈruw")),
        ("phonemizeWord", &["янъы"], Some("jaˈŋɯ")),
        ("phonemizeWord", &["кан"], Some("ˈkan")),
        ("phonemizeWord", &["сув"], Some("ˈsuw")),
        ("phonemizeWord", &["вагон"], Some("vaˈɡon")),
        ("phonemizeWord", &["в"], Some("v")),
        ("phonemizeWord", &["эмшек"], Some("emˈʃek")),
        ("phonemizeWord", &["юлдыз"], Some("julˈdɯz")),
        ("phonemizeWord", &["эки"], Some("eˈki")),
        ("phonemizeWord", &["суьв"], Some("ˈsyw")),
        ("phonemizeWord", &["аье"], Some("æˈje")),
        ("getPhonemizer(\"nog\").text", &["7"], Some("jeˈti")),
        ("getPhonemizer(\"nog\").text", &["11"], Some("ˈon ˈbir")),
        ("getPhonemizer(\"nog\").text", &["25"], Some("jɯrˈma ˈbes")),
        ("getPhonemizer(\"nog\").text", &["100"], Some("ˈjuz")),
        (
            "getPhonemizer(\"nog\").text",
            &["555"],
            Some("ˈbes ˈjuz elˈli ˈbes"),
        ),
        (
            "getPhonemizer(\"nog\").text",
            &["1984"],
            Some("ˈmɯŋ toˈɡɯz ˈjuz sekˈsen ˈdørt"),
        ),
        (
            "getPhonemizer(\"nog\").text",
            &["12345"],
            Some("ˈon eˈki ˈmɯŋ ˈyʃ ˈjuz ˈkɯrk ˈbes"),
        ),
        (
            "getPhonemizer(\"nog\").text",
            &["1000000"],
            Some("ˈbir milliˈon"),
        ),
        ("getPhonemizer(\"nog\").text", &["кан"], Some("ˈkan")),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_nogai().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "getPhonemizer(\"nog\").text" => {
                    Some(crate::registry::phonemize_in("nog", &a(0)).unwrap())
                }
                _ => panic!("no replay for {f}"),
            }
        };
        for (f, args, want) in TS_SUITE_CALLS {
            let a = |i: usize| js(args[i]);
            let got: Option<String> = call(f, &a).map(|s| s.to_string_lossy());
            assert_eq!(got.as_deref(), *want, "{f}{args:?}");
        }
    }
}
