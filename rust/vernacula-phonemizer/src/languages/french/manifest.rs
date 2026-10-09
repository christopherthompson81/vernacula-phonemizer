//! French's hand-authored tables, from `french.jsonc`. Ported from src/languages/french/manifest.ts.
//!
//! Every field the TS interface names is required (no `#[serde(default)]`); the documentation keys
//! (`convention`, `provenance`, …) are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/french";

/// `CountForms` (core/normalizeSymbols.ts): the forms a count selects between.
pub type CountForms = Vec<String>;

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HeteronymCase {
    pub ipa: String,
    pub prev: Option<Vec<String>>,
    pub next: Option<Vec<String>>,
    pub next_is_number: Option<bool>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct Heteronym {
    pub default: String,
    pub cases: Vec<HeteronymCase>,
}

#[derive(Debug, Deserialize)]
pub struct NumberMagnitudes {
    pub sixty: String,
    pub eighty: String,
    pub hundred: String,
    pub thousand: String,
    pub million: String,
    pub millions: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Numbers {
    pub small: Vec<String>,
    pub tens: Vec<String>,
    pub magnitudes: NumberMagnitudes,
    pub decimal_separator: String,
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
    pub position: Option<String>,
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
    pub units: IndexMap<String, CountForms>,
    pub magnitudes: Vec<String>,
    pub magnitude_connective: String,
    pub ampersand: String,
    pub multiply: Multiply,
    pub exponent_words: ExponentWords,
    pub bare_exponent: BareExponent,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrenchManifest {
    pub vowel_letters: String,
    pub vowel_phonemes: String,
    pub vowel_groups: Vec<(String, String)>,
    pub nasal_groups: Vec<(String, String)>,
    pub final_sounded: Vec<String>,
    pub yod_double: Vec<(String, String)>,
    pub yod_final: Vec<(String, String)>,
    pub clause_punctuation: IndexMap<String, String>,
    pub liaison: IndexMap<String, String>,
    pub heteronyms: IndexMap<String, Heteronym>,
    pub acronym_letters: Vec<String>,
    pub h_aspire: Vec<String>,
    pub numbers: Numbers,
    pub letter_names: IndexMap<String, String>,
    pub phonotactics: Phonotactics,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Loaded once; a failure is cached.
pub fn try_manifest() -> Result<&'static FrenchManifest, String> {
    static M: OnceLock<Result<FrenchManifest, String>> = OnceLock::new();
    M.get_or_init(|| load_manifest(DIR, "french.jsonc").map_err(|e| e.to_string()))
        .as_ref()
        .map_err(Clone::clone)
}

/// The manifest for code that runs only after `create_french` has succeeded (which checks it first).
pub static MANIFEST: LazyLock<&'static FrenchManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.numbers.small.len(), 20);
        assert_eq!(m.liaison.get("les").map(String::as_str), Some("z"));
        assert!(m.heteronyms["plus"].cases[0].next_is_number == Some(true));
        // ⟨L⟩ and ⟨l⟩ are distinct unit keys; insertion order is kept.
        assert!(m.symbol_tier.units.contains_key("L") && m.symbol_tier.units.contains_key("l"));
    }
}
