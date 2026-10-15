//! Afrikaans's hand-authored tables, from `afrikaans.jsonc`, and `FIXED_KEYS` (the grapheme keys longest first).
//! Ported from src/languages/afrikaans/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys the TS does not
//! read (`provenance`, `convention`) are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, js};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{CountForms, ExponentWords};

pub const DIR: &str = "languages/afrikaans";

/// `SignWords` (normalizeSymbols.ts).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignWords {
    pub plus_minus: String,
    pub plus: String,
    pub minus: String,
    pub ampersand: String,
    pub equals: String,
    pub less_than: String,
    pub greater_than: String,
    pub times: String,
    pub divided_by: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FractionWords {
    pub one_half: String,
    pub halves: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Phonotactics {
    pub legal_onsets: Vec<String>,
    pub legal_codas: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct Numbers {
    pub units: Vec<String>,
    pub teens: Vec<String>,
    pub tens: Vec<String>,
    pub en: String,
    pub hundred: String,
    pub thousand: String,
    pub million: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Morphology {
    pub prefix_unstressed: Vec<String>,
    pub prefix_stressed: Vec<String>,
    pub ambiguous_prefixes: Vec<String>,
    pub suffixes: Vec<String>,
    pub vowel_initial_suffixes: Vec<String>,
    pub linking_elements: Vec<String>,
    pub valid_onsets: Vec<String>,
    pub st_keep: Vec<String>,
    pub resyllabifying_suffixes: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub rate_denominators: IndexMap<String, String>,
    pub unit_per: String,
    pub exponent_words: ExponentWords,
    pub magnitudes: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AfrikaansManifest {
    pub language: String,
    pub name: String,
    pub script: Vec<String>,
    pub fixed: IndexMap<String, String>,
    pub vowels_long: IndexMap<String, String>,
    pub vowels_short: IndexMap<String, String>,
    pub diacritic_vowels: IndexMap<String, String>,
    pub bare_vowels: Vec<String>,
    pub vowel_letters: Vec<String>,
    pub voiced_final: IndexMap<String, String>,
    pub voiceless_phones: Vec<String>,
    pub unstressed_reduction: IndexMap<String, String>,
    pub unstressed_open: IndexMap<String, Option<String>>,
    pub c_soft_before: Vec<String>,
    pub w_glide_after: Vec<String>,
    pub stress_from_end: IndexMap<String, f64>,
    pub stress_final_suffixes: Vec<String>,
    pub stress_penult_suffixes: Vec<String>,
    pub prefix_ipa: IndexMap<String, String>,
    pub sign_words: SignWords,
    pub clock_periods: IndexMap<String, String>,
    pub fraction_words: FractionWords,
    pub ordinals_below20: Vec<String>,
    pub multi_dot_abbreviations: Vec<(String, String)>,
    pub dotted_abbreviations: IndexMap<String, String>,
    pub letter_names: IndexMap<String, String>,
    pub word_acronyms: Vec<String>,
    pub acronym_letters: Vec<String>,
    pub phonotactics: Phonotactics,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
    pub morphology: Morphology,
    pub decimal_word: String,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static AfrikaansManifest, String> {
    static M: OnceLock<AfrikaansManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "afrikaans.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path (an `AfrikaansPhonemizer`, whose constructor loads
/// it). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static AfrikaansManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

/// `FIXED_KEYS`: the grapheme keys stably sorted by UTF-16 length, longest first.
pub(crate) static FIXED_KEYS: LazyLock<Vec<JsString>> = LazyLock::new(|| {
    let mut keys: Vec<JsString> = MANIFEST.fixed.keys().map(|k| js(k)).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.len()));
    keys
});

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = try_manifest().unwrap();
        assert_eq!(m.bare_vowels.len(), 5);
        assert_eq!(m.ordinals_below20.len(), 20);
        assert_eq!(m.numbers.tens.len(), 10);
        assert_eq!(m.sign_words.times, "keer");
        assert_eq!(m.multi_dot_abbreviations.len(), 4);
        assert_eq!(m.morphology.prefix_unstressed.len(), m.prefix_ipa.len());
        assert_eq!(m.symbol_tier.unit_per, "per");
        assert_eq!(FIXED_KEYS.len(), m.fixed.len());
    }
}
