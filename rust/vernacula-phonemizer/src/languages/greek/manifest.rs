//! Modern Greek's hand-authored data tables, from `greek.jsonc`, loaded once.
//! Ported from src/languages/greek/manifest.ts — see that file for the corpus evidence.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`). Maps are `IndexMap`, because
//! normalize.ts iterates `abbreviations`, `ordinals.endings` and `mixedCaseInitialisms` in key order.

use std::sync::OnceLock;

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
pub use crate::core::normalize_symbols::CountForms;
use crate::core::normalize_symbols::{ExponentPosition, Multiply};

pub const DIR: &str = "languages/greek";

#[derive(Debug, FromJson)]
pub struct Ordinals {
    pub units: Vec<String>,
    pub tens: Vec<String>,
    /// written ending → [barytone, oxytone].
    pub endings: IndexMap<String, [String; 2]>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Clock {
    pub hours_feminine: Vec<String>,
    pub minute_units: Vec<String>,
    pub minute_teens: Vec<String>,
    pub minute_tens: Vec<String>,
}

#[derive(Debug, FromJson)]
pub struct GreekNumbers {
    pub units: Vec<String>,
    /// 10–19, indexed by the unit.
    pub teens: Vec<String>,
    pub tens: Vec<String>,
    /// εκατόν: 100 before a remainder (100 alone is `hundreds[1]`).
    pub hundred: String,
    pub hundreds: Vec<String>,
    pub thousand: String,
}

#[derive(Debug, FromJson)]
pub struct ExponentWords {
    pub squared: CountForms,
    pub cubed: CountForms,
    pub position: Option<ExponentPosition>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub magnitudes: Vec<String>,
    pub ampersand: String,
    pub multiply: Multiply,
    pub exponent_words: ExponentWords,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct GreekManifest {
    pub tonos: IndexMap<String, String>,
    pub synizesis_palatal: IndexMap<String, String>,
    pub homoglyphs: IndexMap<String, String>,
    pub letter_names: IndexMap<String, String>,
    pub word_acronyms: IndexMap<String, String>,
    pub mixed_case_initialisms: IndexMap<String, String>,
    pub ordinals: Ordinals,
    pub alphabetic_numerals: IndexMap<String, f64>,
    pub clock: Clock,
    pub abbreviations: IndexMap<String, String>,
    pub language: String,
    pub name: String,
    pub script: Vec<String>,
    pub vowels: IndexMap<String, String>,
    pub voiceless: Vec<String>,
    pub au_voiced: Vec<String>,
    pub sigma_voiced: Vec<String>,
    pub vowel_digraphs: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub consonant_digraphs: IndexMap<String, String>,
    pub palatal: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: GreekNumbers,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded or is unusable. Cached once loaded; a failure is retried.
///
/// Validated here so nothing downstream indexes a short table or misses a key the TS asserts with `!`:
/// the cardinal, ordinal and clock tables are indexed by number, `palatal` must hold κ γ χ (greek.ts builds
/// `SYN_PAL` from them, and its front-vowel rule reads them), `consonantDigraphs` every digraph the scan
/// matches and `consonants` μ ν (the medial μπ ντ), `homoglyphs` must hold H and O (normalize.ts step 1's sentence-initial article) and `ordinals.endings`
/// must hold ο (step 2's fixed ending).
pub fn try_manifest() -> Result<&'static GreekManifest, String> {
    static M: OnceLock<GreekManifest> = OnceLock::new();
    load_once(&M, || {
        let m: GreekManifest = load_manifest(DIR, "greek.jsonc").map_err(|e| e.to_string())?;
        let n = &m.numbers;
        let c = &m.clock;
        for (name, v, need) in [
            ("numbers.units", &n.units, 10),
            ("numbers.teens", &n.teens, 10),
            ("numbers.tens", &n.tens, 10),
            ("numbers.hundreds", &n.hundreds, 10),
            ("ordinals.units", &m.ordinals.units, 13),
            ("ordinals.tens", &m.ordinals.tens, 10),
            ("clock.hoursFeminine", &c.hours_feminine, 24),
            ("clock.minuteUnits", &c.minute_units, 10),
            ("clock.minuteTeens", &c.minute_teens, 10),
            ("clock.minuteTens", &c.minute_tens, 6),
        ] {
            if v.len() < need {
                return Err(format!(
                    "greek.jsonc: {name} has {} entries, needs {need}",
                    v.len()
                ));
            }
        }
        for k in ["κ", "γ", "χ"] {
            if !m.palatal.contains_key(k) {
                return Err(format!("greek.jsonc: palatal.{k} missing"));
            }
        }
        for k in ["γγ", "γκ", "γχ", "γξ", "μπ", "ντ", "τσ", "τζ"] {
            if !m.consonant_digraphs.contains_key(k) {
                return Err(format!("greek.jsonc: consonantDigraphs.{k} missing"));
            }
        }
        for k in ["μ", "ν"] {
            if !m.consonants.contains_key(k) {
                return Err(format!("greek.jsonc: consonants.{k} missing"));
            }
        }
        if !m.ordinals.endings.contains_key("ο") {
            return Err("greek.jsonc: ordinals.endings.ο missing".to_string());
        }
        for k in ["H", "O"] {
            if !m.homoglyphs.contains_key(k) {
                return Err(format!("greek.jsonc: homoglyphs.{k} missing"));
            }
        }
        Ok(m)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = try_manifest().unwrap();
        assert_eq!(m.language, "el");
        assert_eq!(m.numbers.units.len(), 10);
        assert_eq!(m.ordinals.endings.len(), 10);
        assert_eq!(m.alphabetic_numerals.get("ΣΤ"), Some(&6.0));
        assert_eq!(m.symbol_tier.multiply.times, "επί");
        assert_eq!(
            m.symbol_tier.exponent_words.position,
            Some(ExponentPosition::Before)
        );
    }
}
