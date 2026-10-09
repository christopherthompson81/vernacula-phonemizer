//! Italian's hand-authored data tables, from `italian.jsonc`, loaded once.
//! Ported from src/languages/italian/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); keys the TS does not read
//! (`language`, `name`, `script`, `provenance`) are documentation and are ignored. Maps are `IndexMap`
//! because the TS iterates `dottedAbbrev`'s keys to build a pattern.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/italian";

pub use crate::core::normalize_symbols::CountForms;

#[derive(Debug, Deserialize)]
pub struct ItalianNumbers {
    pub units: Vec<String>,
    pub teens: Vec<String>,
    pub tens: Vec<String>,
    pub hundred: String,
    pub thousand: String,
    pub thousands: String,
    pub million: String,
    pub millions: String,
    pub and: String,
}

#[derive(Debug, Deserialize)]
pub struct Phonotactics {
    pub vowels: String,
    pub onsets: Vec<String>,
    pub codas: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct Fractions {
    pub denominators: IndexMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EraMarkers {
    pub before_christ: String,
    pub after_christ: String,
}

#[derive(Debug, Deserialize)]
pub struct Degree {
    pub singular: String,
    pub plural: String,
    pub celsius: String,
    pub fahrenheit: String,
}

/// `SignWords` (core/normalizeSymbols.ts).
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
pub struct ExponentWords {
    pub squared: CountForms,
    pub cubed: CountForms,
}

#[derive(Debug, Deserialize)]
pub struct BareExponent {
    pub squared: String,
    pub cubed: String,
    pub power: String,
    pub negative: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub currency_stems: Vec<String>,
    pub magnitudes: Vec<String>,
    pub magnitude_connective: String,
    pub units: IndexMap<String, CountForms>,
    pub exponent_words: ExponentWords,
    pub bare_exponent: BareExponent,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ItalianManifest {
    pub consonants: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub accented: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: ItalianNumbers,
    pub acronym_letters: Vec<String>,
    pub letter_names: IndexMap<String, String>,
    pub phonotactics: Phonotactics,
    pub dotted_abbrev: IndexMap<String, String>,
    pub ordinals: IndexMap<String, String>,
    pub fractions: Fractions,
    pub apocopated_one: String,
    pub era_markers: EraMarkers,
    pub number_sign: String,
    pub degree: Degree,
    pub compass: IndexMap<String, String>,
    pub decimal_word: String,
    pub sign_words: SignWords,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Loaded once; a failure is cached, not retried.
pub fn try_manifest() -> Result<&'static ItalianManifest, String> {
    static M: OnceLock<Result<ItalianManifest, String>> = OnceLock::new();
    M.get_or_init(|| load_manifest(DIR, "italian.jsonc").map_err(|e| e.to_string()))
        .as_ref()
        .map_err(Clone::clone)
}

/// The manifest for code that runs only after `create_italian` has succeeded (which checks it first).
pub static MANIFEST: LazyLock<&'static ItalianManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.numbers.units.len(), 10);
        assert_eq!(m.ordinals.get("10").map(String::as_str), Some("decimo"));
        assert_eq!(m.consonants.get("h").map(String::as_str), Some(""));
        assert!(m.dotted_abbrev.contains_key("pagg"));
        assert_eq!(m.symbol_tier.percent, vec!["per cento".to_string()]);
    }
}
