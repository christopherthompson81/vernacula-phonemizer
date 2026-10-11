//! Québécois French (fr-CA): the France-French engine plus a context-free delta on its output (affrication of
//! /t d/ before /i y j ɥ/, high-vowel laxing in a closed syllable, word-final /a/ → [ɑ]).
//! Ported from src/languages/french-ca/french-ca.ts — see that file for the phonology.

use std::sync::LazyLock;

use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::js_re;
use crate::languages::french::french::{FrenchPhonemizer, create_french};
use crate::registry::{Engine, PhonemizeError};

/// Non-lengthening coda consonants (the lengthening /ʁ v z ʒ/ are deliberately absent).
const CODA: &str = "ptkbdɡfsʃmnɲŋlç";
/// After a coda consonant, one of these makes it an onset (open syllable), so no laxing.
const OPEN: &str = "aeɛiouyœøəɑɔˈ\u{0361}";

/// An obstruent + liquid before a vowel is a two-consonant ONSET, not a coda (pu.blique), so no laxing (#1533).
static ONSET_CLUSTER: LazyLock<String> = LazyLock::new(|| format!("[ptkbdɡf][lʁ][{OPEN}]"));

static LAXING: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!("([iyu])(?=(?!{})[{CODA}](?![{OPEN}]))", *ONSET_CLUSTER),
        "gu",
    )
    .unwrap()
});

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

/// The fr-CA engine (`createFrenchCA`): the France engine with the delta applied per French word, so an
/// embedded foreign run is never rewritten (#1533).
pub struct FrenchCaPhonemizer(FrenchPhonemizer);

impl FrenchCaPhonemizer {
    pub fn text(&self, input: &JsString) -> JsString {
        self.0.text(input, None)
    }

    /// `phonemizeWord(word)` (= `phonemizeWordRules`): `createFrench(undefined, toQuebecois).text(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        self.0.text(word, None)
    }
}

impl Engine for FrenchCaPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(FrenchCaPhonemizer::text(self, input))
    }
}

/// `createFrenchCA()`.
pub fn create_french_ca() -> Result<FrenchCaPhonemizer, String> {
    create_french().map(|f| FrenchCaPhonemizer(f.with_accent(to_quebecois)))
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
        // #1533: an obstruent + liquid onset leaves the syllable before it open.
        ("publique", "pyblˈɪk"),
        ("cyclone", "siklˈɔn"),
        ("citron", "sitʁˈɔ̃"),
        ("supplier", "syplijˈe"),
        ("microscope", "mikʁɔskˈɔp"),
        ("chiffre", "ʃˈɪfʁ"),
        ("équilibre", "ekilˈɪbʁ"),
    ];

    /// #1533: the delta spares an embedded foreign run (it ran on the assembled string).
    #[test]
    fn ts_foreign_run_pins() {
        assert_eq!(
            crate::phonemize("Il a dit τι.", "fr-CA").unwrap(),
            "ɪl ɑ d͡zi tˈi ."
        );
        assert_eq!(
            crate::phonemize("Il a dit τι.", "fr").unwrap(),
            "il a di tˈi ."
        );
    }

    #[test]
    fn ts_word_pins() {
        let e = create_french_ca().unwrap();
        for (w, want) in WORD_PINS {
            assert_eq!(e.phonemize_word(&js(w)).to_string_lossy(), *want, "{w}");
        }
    }
}
