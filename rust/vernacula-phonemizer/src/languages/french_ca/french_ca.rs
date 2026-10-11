//! Québécois French (fr-CA): the France-French engine plus a context-free delta on its output (affrication of
//! /t d/ before /i y j ɥ/, high-vowel laxing in a closed syllable, word-final /a/ → [ɑ]).
//! Ported from src/languages/french-ca/french-ca.ts — see that file for the phonology.

use std::sync::LazyLock;

use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::trace::note_rewrite;
use crate::js_re;
use crate::languages::french::french::{FrenchPhonemizer, create_french};
use crate::registry::{Engine, PhonemizeError};

/// Non-lengthening coda consonants (the lengthening /ʁ v z ʒ/ are deliberately absent).
const CODA: &str = "ptkbdɡfsʃmnɲŋlç";
/// After a coda consonant, one of these makes it an onset (open syllable), so no laxing.
const OPEN: &str = "aeɛiouyœøəɑɔˈ\u{0361}";

static LAXING: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("([iyu])(?=[{CODA}](?![{OPEN}]))"), "gu").unwrap());

/// `LAX[v]`.
fn lax(v: &JsString) -> JsString {
    js(match v.to_string_lossy().as_str() {
        "i" => "ɪ",
        "y" => "ʏ",
        _ => "ʊ",
    })
}

/// `toQuebecois(fr)`: France-French IPA → Québécois.
pub fn to_quebecois(fr: &JsString) -> JsString {
    let s = js_re!(r"t(?=[ˈˌ]?[iyɥj])", "gu").replace(fr, &js("t͡s"));
    let s = js_re!(r"d(?=[ˈˌ]?[iyɥj])", "gu").replace(&s, &js("d͡z"));
    let s = LAXING.replace_with(&s, |m, s| lax(&m.group(1, s).unwrap()));
    js_re!(r"a(?=[ .,;!?…»)]|$)", "gu").replace(&s, &js("ɑ"))
}

/// The fr-CA engine (`createFrenchCA`).
pub struct FrenchCaPhonemizer(FrenchPhonemizer);

impl FrenchCaPhonemizer {
    pub fn text(&self, input: &JsString) -> JsString {
        let pre = self.0.text(input, None);
        let out = to_quebecois(&pre);
        // NOT positional: the delta changes lengths.
        note_rewrite("accent:fr-CA", &pre, &out, false);
        out
    }

    /// `phonemizeWord(word)` (= `phonemizeWordRules`): the France engine's `text(word)` plus the delta.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        to_quebecois(&self.0.text(word, None))
    }
}

impl Engine for FrenchCaPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(FrenchCaPhonemizer::text(self, input))
    }
}

/// `createFrenchCA()`.
pub fn create_french_ca() -> Result<FrenchCaPhonemizer, String> {
    create_french().map(FrenchCaPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // test/french-ca.test.ts's `phonemizeWord` pins, extracted from that file mechanically (each is a reading the
    // TS suite asserts), so the two engines are held to one list.
    const WORD_PINS: &[(&str, &str)] = &[
        ("tu", "t͡sˈy"),
        ("dire", "d͡zˈiʁ"),
        ("tuile", "t͡sɥˈɪl"),
        ("dimanche", "d͡zimˈɑ̃ʃ"),
        ("tout", "tˈu"),
        ("table", "tˈabl"),
        ("dos", "dˈo"),
        ("petite", "pət͡sˈɪt"),
        ("six", "sˈɪs"),
        ("jupe", "ʒˈʏp"),
        ("route", "ʁˈʊt"),
        ("petit", "pət͡sˈi"),
        ("musique", "myzˈɪk"),
        ("difficile", "d͡zifisˈɪl"),
        ("Canada", "kanadˈɑ"),
        ("habitude", "abit͡sˈʏd"),
        ("stupide", "st͡sypˈɪd"),
        ("politique", "pɔlit͡sˈɪk"),
    ];

    #[test]
    fn ts_word_pins() {
        let e = create_french_ca().unwrap();
        for (w, want) in WORD_PINS {
            assert_eq!(e.phonemize_word(&js(w)).to_string_lossy(), *want, "{w}");
        }
    }
}
