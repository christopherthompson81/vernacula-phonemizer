//! Portuguese's hand-authored tables, from `portuguese.jsonc`. Ported from src/languages/portuguese/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`). Keys the TS does not read
//! (`language`, `convention`, …) are documentation and are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/portuguese";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Accents {
    pub to_base: IndexMap<String, String>,
    pub acute_grave: String,
    pub circumflex: String,
    pub tilde: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Numbers {
    pub small: Vec<String>,
    pub tens: Vec<String>,
    pub hundreds: Vec<String>,
    pub hundred_exact: String,
    pub thousand: String,
    pub million: String,
    pub million_plural: String,
    pub connector: String,
    pub decimal_connector: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Phonotactics {
    pub vowels: String,
    pub onsets: Vec<String>,
    pub codas: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Ordinals {
    pub units: Vec<String>,
    pub tens: Vec<String>,
    pub hundreds: Vec<String>,
    pub thousandth: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Fractions {
    /// Integer-like keys: JS would order them first, but the table is only ever looked up.
    pub denominators: IndexMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Clock {
    pub hour: String,
    pub hours: String,
    pub connector: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EraMarkers {
    pub before_christ: String,
    pub after_christ: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Degree {
    pub singular: String,
    pub plural: String,
    pub celsius: String,
    pub fahrenheit: String,
}

/// `SignWords` (core/normalizeSymbols.ts).
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
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

/// `CountForms` is `string[]`.
pub type CountForms = Vec<String>;

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ExponentWords {
    pub squared: CountForms,
    pub cubed: CountForms,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct BareExponent {
    pub squared: String,
    pub cubed: String,
    pub power: String,
    pub negative: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub exponent_words: ExponentWords,
    pub bare_exponent: BareExponent,
    pub magnitudes: Vec<String>,
    pub magnitude_connective: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PortugueseManifest {
    pub acronym_letters: Vec<String>,
    pub accents: Accents,
    pub vowel_letters: String,
    pub front_letters: String,
    pub vowel_ipa: IndexMap<String, String>,
    pub reduce: IndexMap<String, String>,
    pub nasal: IndexMap<String, String>,
    pub voiced_consonants: Vec<String>,
    pub liquids: Vec<String>,
    pub function_words: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
    pub months: Vec<String>,
    pub dotted_abbrev: IndexMap<String, String>,
    pub letter_names: IndexMap<String, String>,
    pub phonotactics: Phonotactics,
    pub ordinals: Ordinals,
    pub fractions: Fractions,
    pub feminine_one: String,
    pub clock: Clock,
    pub era_markers: EraMarkers,
    pub number_sign: String,
    pub degree: Degree,
    pub real_word: String,
    pub dollar_codes: Vec<String>,
    pub sign_words: SignWords,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Loaded once; a failure is cached, not retried.
pub fn try_manifest() -> Result<&'static PortugueseManifest, String> {
    static M: OnceLock<Result<PortugueseManifest, String>> = OnceLock::new();
    M.get_or_init(|| load_manifest(DIR, "portuguese.jsonc").map_err(|e| e.to_string()))
        .as_ref()
        .map_err(Clone::clone)
}

/// The manifest for code that runs only after the engine's build has checked `try_manifest`.
pub static MANIFEST: LazyLock<&'static PortugueseManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.numbers.small.len(), 20);
        assert_eq!(m.ordinals.units.len(), 10);
        assert_eq!(m.accents.to_base.get("ã").map(String::as_str), Some("a"));
        assert_eq!(m.fractions.denominators.get("3").map(String::as_str), Some("terço"));
        assert!(m.symbol_tier.units.contains_key("km/h"));
    }
}
