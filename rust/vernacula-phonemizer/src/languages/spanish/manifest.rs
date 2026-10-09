//! Spanish's hand-authored facts, from `spanish.jsonc`. Ported from src/languages/spanish/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys the TS does not
//! read (`convention`, `provenance`, …) are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::CountForms;

pub const DIR: &str = "languages/spanish";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vowels {
    pub strong: String,
    pub weak_unaccented: String,
    pub weak_accented: String,
    pub front: String,
}

#[derive(Debug, Deserialize)]
pub struct Scale {
    pub value: f64,
    pub one: String,
    pub many: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Numbers {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub hundreds: Vec<String>,
    pub hundred_exact: String,
    pub thousand: String,
    pub connector: String,
    pub decimal_connector: String,
    pub scales: Vec<Scale>,
}

#[derive(Debug, Deserialize)]
pub struct Phonotactics {
    pub vowels: String,
    pub onsets: Vec<String>,
    pub codas: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct Ordinals {
    pub units: Vec<String>,
    pub teens: Vec<String>,
    pub tens: Vec<String>,
    pub hundreds: Vec<String>,
    pub thousandth: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Fractions {
    pub denominators: IndexMap<String, String>,
    pub numerator_one: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EraMarkers {
    pub before_christ: String,
    pub after_christ: String,
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
    pub units: IndexMap<String, CountForms>,
    pub exponent_words: ExponentWords,
    pub bare_exponent: BareExponent,
    pub magnitudes: Vec<String>,
    pub magnitude_connective: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpanishManifest {
    pub vowels: Vowels,
    pub acronym_letters: Vec<String>,
    pub accents: IndexMap<String, String>,
    pub nasals: Vec<String>,
    pub spirantize: IndexMap<String, String>,
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
    pub era_markers: EraMarkers,
    pub united_states: String,
    pub number_sign: String,
    pub sign_words: SignWords,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static SpanishManifest, String> {
    static M: OnceLock<SpanishManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "spanish.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path: a `SpanishPhonemizer` (whose constructor loads
/// it) or a `try_manifest` test first. ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static SpanishManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.numbers.ones.len(), 30);
        assert_eq!(m.numbers.scales.len(), 2);
        assert_eq!(m.ordinals.thousandth, "milésimo");
        assert!(m.symbol_tier.units.contains_key("L") && m.symbol_tier.units.contains_key("l"));
        assert_eq!(m.letter_names["w"], "doble uve");
    }
}
