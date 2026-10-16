//! Russian's hand-authored data tables, from `russian.jsonc`, loaded once.
//! Ported from src/languages/russian/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`); documentation keys the TS does not
//! read (`language`, `name`, `script`, `provenance`, `convention`) are ignored.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
pub use crate::core::normalize_symbols::CountForms;
use crate::core::normalize_symbols::{BareExponent, ExponentWords, Multiply};

pub const DIR: &str = "languages/russian";

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct AdjectiveEnding {
    pub end: String,
    /// `"hard" | "soft"`.
    #[json(rename = "type")]
    pub kind: EndingType,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, FromJson)]
#[json(rename_all = "lowercase")]
pub enum EndingType {
    Hard,
    Soft,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct AdjectiveStress {
    pub hard_lemmas: Vec<String>,
    pub soft_lemmas: Vec<String>,
    pub endings: Vec<AdjectiveEnding>,
}

#[derive(Debug, FromJson)]
pub struct ThousandFeminine {
    pub one: String,
    pub two: String,
}

/// One oblique case of the cardinal: the same ones/tens/hundreds slots as the nominative tables.
#[derive(Debug, FromJson)]
pub struct CardinalCaseForms {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub hundreds: Vec<String>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Numbers {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub hundreds: Vec<String>,
    pub million: Vec<String>,
    pub thousand: Vec<String>,
    pub thousand_feminine: ThousandFeminine,
    pub decimal_connector: String,
    pub genitive: CardinalCaseForms,
    pub instrumental: CardinalCaseForms,
}

#[derive(Debug, FromJson)]
pub struct Phonotactics {
    pub vowels: String,
    pub onsets: Vec<String>,
    pub codas: Vec<String>,
}

/// `symbolTier`: the shapes are core's own `SymbolData` field types.
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub unit_per: String,
    pub magnitudes: Vec<String>,
    pub ampersand: String,
    pub multiply: Multiply,
    pub exponent_words: ExponentWords,
    pub bare_exponent: BareExponent,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct RussianManifest {
    pub acronym_letters: Vec<String>,
    pub vowel_letters: String,
    /// Consonant letter → [hard, soft] IPA.
    pub consonants: IndexMap<String, (String, String)>,
    pub always_hard: Vec<String>,
    pub always_soft: Vec<String>,
    pub soft_vowels: Vec<String>,
    pub iotated_vowels: Vec<String>,
    pub devoice: IndexMap<String, String>,
    pub voice: IndexMap<String, String>,
    pub voiceless_obstruents: Vec<String>,
    pub voiced_obstruents: Vec<String>,
    pub soften_targets: String,
    /// The с/з tier of regressive softening (g2p.rs).
    pub soften_triggers: String,
    /// The т/д/н tier of regressive softening (g2p.rs).
    pub soften_triggers_tdn: String,
    pub genitive_keep_g: Vec<String>,
    pub irregulars: IndexMap<String, String>,
    pub adjective_stress: AdjectiveStress,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
    pub letter_names: IndexMap<String, String>,
    /// Cyrillic letters outside а–я/ё → their Russian spelling (see the jsonc for the two sources).
    pub letter_folds: IndexMap<String, String>,
    pub phonotactics: Phonotactics,
    pub symbol_tier: SymbolTier,
    pub roman_ordinals: Vec<String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static RussianManifest, String> {
    static M: OnceLock<RussianManifest> = OnceLock::new();
    load_once(&M, || {
        let m: RussianManifest = load_manifest(DIR, "russian.jsonc").map_err(|e| e.to_string())?;
        validate(&m)?;
        Ok(m)
    })
}

/// The table lengths the TS indexes with a `!` (a short table would read `undefined` there and stringify it).
fn validate(m: &RussianManifest) -> Result<(), String> {
    let n = &m.numbers;
    let need = [
        ("numbers.ones", n.ones.len(), 20),
        ("numbers.tens", n.tens.len(), 10),
        ("numbers.hundreds", n.hundreds.len(), 10),
        ("numbers.million", n.million.len(), 3),
        ("numbers.thousand", n.thousand.len(), 3),
        ("romanOrdinals", m.roman_ordinals.len(), 20),
        ("numbers.genitive.ones", n.genitive.ones.len(), 20),
        ("numbers.genitive.tens", n.genitive.tens.len(), 10),
        ("numbers.genitive.hundreds", n.genitive.hundreds.len(), 10),
        ("numbers.instrumental.ones", n.instrumental.ones.len(), 20),
        ("numbers.instrumental.tens", n.instrumental.tens.len(), 10),
        (
            "numbers.instrumental.hundreds",
            n.instrumental.hundreds.len(),
            10,
        ),
    ];
    for (name, have, want) in need {
        if have < want {
            return Err(format!(
                "russian.jsonc {name}: {have} entries, {want} needed"
            ));
        }
    }
    Ok(())
}

/// The manifest for code reached only through a checked path: a `RussianPhonemizer` (whose constructor loads
/// it) or a `try_manifest` first. ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static RussianManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(all(test, feature = "ru"))]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.vowel_letters, "аеёиоуыэюя");
        assert_eq!(m.consonants["л"], ("ɫ".to_string(), "lʲ".to_string()));
        assert_eq!(m.adjective_stress.endings[0].kind, EndingType::Hard);
        assert_eq!(m.numbers.ones.len(), 20);
        assert_eq!(m.roman_ordinals.len(), 20);
        assert!(m.symbol_tier.units.contains_key("км") && m.symbol_tier.units.contains_key("m"));
    }
}
