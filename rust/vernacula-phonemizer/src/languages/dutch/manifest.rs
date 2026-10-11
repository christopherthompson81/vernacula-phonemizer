//! Dutch's hand-authored facts, from `dutch.jsonc`. Ported from src/languages/dutch/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`). The file's documentation keys
//! (`convention`, `provenance`, …) are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{CountForms, PositionDecl};

pub const DIR: &str = "languages/dutch";

#[derive(Debug, Deserialize)]
pub struct Vowels {
    pub long: IndexMap<String, String>,
    pub short: IndexMap<String, String>,
}

#[derive(Debug, Deserialize)]
pub struct SgPl {
    pub sg: String,
    pub pl: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Numbers {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub connector: String,
    pub connector_trema: String,
    pub decimal_word: String,
    pub hundred: String,
    pub thousand: String,
    pub million: SgPl,
    pub milliard: SgPl,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Morphology {
    pub prefix_unstressed: Vec<String>,
    pub prefix_stressed: Vec<String>,
    pub ambiguous_prefixes: Vec<String>,
    pub prefix_schwa: Vec<String>,
    pub suffixes: Vec<String>,
    pub vowel_initial_suffixes: Vec<String>,
    pub linking_elements: Vec<String>,
    pub valid_onsets: Vec<String>,
    pub st_keep: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct Phonotactics {
    pub vowels: String,
    pub onsets: Vec<String>,
    pub codas: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct Multiply {
    pub times: String,
    pub by: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ExponentWords {
    pub squared: CountForms,
    pub cubed: CountForms,
    pub position: Option<PositionDecl>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolTier {
    pub multiply: Multiply,
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub rate_denominators: IndexMap<String, String>,
    pub unit_per: String,
    pub magnitudes: Vec<String>,
    pub exponent_words: ExponentWords,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DutchManifest {
    pub vowel_chars: String,
    pub consonant_phones: Vec<String>,
    pub vowels: Vowels,
    pub consonants: IndexMap<String, String>,
    pub voiced_final: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub acronym_letters: Vec<String>,
    pub numbers: Numbers,
    pub vowel_letters: String,
    pub function_words: IndexMap<String, String>,
    pub morphology: Morphology,
    pub letter_names: IndexMap<String, String>,
    pub phonotactics: Phonotactics,
    pub symbol_tier: SymbolTier,
    #[serde(rename = "ordinalsBelow20")]
    pub ordinals_below20: Vec<String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static DutchManifest, String> {
    static M: OnceLock<DutchManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "dutch.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path: a `DutchPhonemizer` (whose constructor loads it)
/// or a `try_manifest` test first. ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static DutchManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.numbers.ones.len(), 20);
        assert_eq!(m.numbers.tens.len(), 10);
        assert_eq!(m.ordinals_below20.len(), 20);
        assert_eq!(m.morphology.linking_elements[0], "");
        assert!(m.symbol_tier.exponent_words.position.is_some());
        assert_eq!(m.symbol_tier.rate_denominators.len(), 3);
    }
}
