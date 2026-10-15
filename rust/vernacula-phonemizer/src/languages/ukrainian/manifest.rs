//! Ukrainian's hand-authored data tables, from `ukrainian.jsonc`, loaded once.
//! Ported from src/languages/ukrainian/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys the TS does not
//! read (`language`, `name`, `script`, `provenance`) are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
pub use crate::core::normalize_symbols::CountForms;
use crate::core::normalize_symbols::ExponentWords;
use crate::core::numbers::NumbersDef;

pub const DIR: &str = "languages/ukrainian";

/// `MagnitudeForms` (numbers.ts): nom.pl (2–4) and gen.pl.
#[derive(Debug, Clone, Deserialize)]
pub struct MagnitudeForms {
    pub few: String,
    pub many: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct MagnitudeCounts {
    pub thousand: MagnitudeForms,
    pub million: MagnitudeForms,
    pub billion: MagnitudeForms,
}

#[derive(Debug, Clone, Deserialize)]
pub struct Feminine {
    pub one: String,
    pub two: String,
}

/// `EastSlavicNumbers & { decimalConnector }`: the core `NumbersDef` plus the magnitude count forms and the
/// feminine 1/2.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EastSlavicNumbers {
    #[serde(flatten)]
    pub base: NumbersDef,
    pub magnitude_counts: MagnitudeCounts,
    pub feminine: Feminine,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UkNumbers {
    #[serde(flatten)]
    pub east: EastSlavicNumbers,
    pub decimal_connector: String,
}

#[derive(Debug, Deserialize)]
pub struct OrdinalEnding {
    pub case: String,
    pub hard: String,
    pub soft: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Ordinals {
    pub one_to_nineteen: Vec<String>,
    pub tens: Vec<String>,
    pub hundreds: Vec<String>,
    pub thousands: Vec<String>,
    pub endings: Vec<OrdinalEnding>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenitiveCardinals {
    pub one_to_nineteen: Vec<String>,
    pub tens: Vec<String>,
    pub hundreds: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RomanOrdinals {
    pub one_to_nineteen: Vec<String>,
    pub tens: Vec<String>,
    pub hundredth: String,
    pub context: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct Phonotactics {
    pub vowels: String,
    pub onsets: Vec<String>,
    pub codas: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Clock {
    pub preposition_case: IndexMap<String, String>,
    pub default_case: String,
}

#[derive(Debug, Deserialize)]
pub struct MultiDot {
    pub written: String,
    pub reading: String,
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

/// `symbolTier`: the shapes are core's own `SymbolData` field types.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub unit_per: String,
    pub rate_denominators: IndexMap<String, String>,
    pub exponent_words: ExponentWords,
    pub magnitudes: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UkrainianManifest {
    pub vowels: IndexMap<String, String>,
    pub iotated: IndexMap<String, String>,
    pub palatalizers: Vec<String>,
    pub vowel_letters: Vec<String>,
    pub plain_vowels: Vec<String>,
    pub consonants: IndexMap<String, String>,
    pub numbers: UkNumbers,
    pub clause_punctuation: IndexMap<String, String>,
    pub acronym_letters: Vec<String>,
    pub ordinals: Ordinals,
    pub genitive_cardinals: GenitiveCardinals,
    pub roman_ordinals: RomanOrdinals,
    pub letter_names: IndexMap<String, String>,
    pub phonotactics: Phonotactics,
    pub clock: Clock,
    pub degree: CountForms,
    pub temperature_scales: IndexMap<String, String>,
    pub dotted_abbrev: IndexMap<String, String>,
    /// The `dotted_abbrev` keys that precede their object, so a capital after the dot is no sentence end.
    pub preposed_abbrev: Vec<String>,
    pub multi_dot_abbrev: Vec<MultiDot>,
    pub number_sign: String,
    pub range_word: String,
    pub sign_words: SignWords,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static UkrainianManifest, String> {
    static M: OnceLock<UkrainianManifest> = OnceLock::new();
    load_once(&M, || {
        let m: UkrainianManifest =
            load_manifest(DIR, "ukrainian.jsonc").map_err(|e| e.to_string())?;
        validate(&m)?;
        Ok(m)
    })
}

/// The table entries the TS reads with a `!` (a short table would read `undefined` there and stringify it), and
/// the clock's case names, which `caseIndex` resolves at module load and throws on.
fn validate(m: &UkrainianManifest) -> Result<(), String> {
    let o = &m.ordinals;
    let g = &m.genitive_cardinals;
    let r = &m.roman_ordinals;
    let st = &m.symbol_tier;
    let metre = st.units.get("м").map_or(0, |f| f.len());
    let squared = st.exponent_words.squared.as_ref().map_or(0, |f| f.len());
    let need = [
        ("numbers.units", m.numbers.east.base.units.len(), 10),
        ("ordinals.oneToNineteen", o.one_to_nineteen.len(), 20),
        ("ordinals.tens", o.tens.len(), 10),
        ("ordinals.hundreds", o.hundreds.len(), 10),
        ("ordinals.thousands", o.thousands.len(), 10),
        (
            "genitiveCardinals.oneToNineteen",
            g.one_to_nineteen.len(),
            20,
        ),
        ("genitiveCardinals.tens", g.tens.len(), 10),
        ("genitiveCardinals.hundreds", g.hundreds.len(), 10),
        ("romanOrdinals.oneToNineteen", r.one_to_nineteen.len(), 20),
        ("romanOrdinals.tens", r.tens.len(), 10),
        ("degree", m.degree.len(), 4),
        ("symbolTier.units.м", metre, 4),
        ("symbolTier.exponentWords.squared", squared, 3),
    ];
    for (name, have, want) in need {
        if have < want {
            return Err(format!(
                "ukrainian.jsonc {name}: {have} entries, {want} needed"
            ));
        }
    }
    let mags = &m.numbers.east.base.magnitudes;
    if mags.thousand.is_none() || mags.million.is_none() || mags.billion.is_none() {
        return Err("ukrainian.jsonc numbers.magnitudes: thousand/million/billion needed".into());
    }
    for k in ["с", "год"] {
        if !st.rate_denominators.contains_key(k) {
            return Err(format!(
                "ukrainian.jsonc symbolTier.rateDenominators: no \"{k}\""
            ));
        }
    }
    for k in ["C", "F"] {
        if !m.temperature_scales.contains_key(k) {
            return Err(format!("ukrainian.jsonc temperatureScales: no \"{k}\""));
        }
    }
    for name in m
        .clock
        .preposition_case
        .values()
        .chain(std::iter::once(&m.clock.default_case))
    {
        if !o.endings.iter().any(|e| &e.case == name) {
            return Err(format!(
                "ukrainian.jsonc: ordinals.endings has no case \"{name}\""
            ));
        }
    }
    Ok(())
}

/// The manifest for code reached only through a checked path: a `UkrainianPhonemizer` (whose constructor
/// loads it) or a `try_manifest` first. ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static UkrainianManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(all(test, feature = "uk"))]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.consonants["г"], "ɦ");
        assert_eq!(m.numbers.east.base.units.len(), 10);
        assert_eq!(m.numbers.east.feminine.two, "дві");
        assert_eq!(m.ordinals.endings[0].case, "mascNom");
        assert_eq!(m.multi_dot_abbrev[0].written, "до н. е.");
        assert!(m.symbol_tier.units.contains_key("км") && m.symbol_tier.units.contains_key("m"));
    }
}
