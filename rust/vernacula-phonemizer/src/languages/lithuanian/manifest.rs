//! Lithuanian's hand-authored data tables, from `lithuanian.jsonc`: the letter and digraph maps, the front/back
//! vowel sets, the voicing pairs, clause punctuation, the number words and the normalization data.
//! Ported from src/languages/lithuanian/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED except `fem`; documentation keys are ignored. The records
//! the TS types with a closed key set (`countedNouns`, `words`) are checked for every key at load.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/lithuanian";

/// `LithuanianAgreement`: nom sg (…1), nom pl (…2–9), gen pl (…0 / 11–19), and whether the noun is feminine.
#[derive(Debug, Clone, Deserialize)]
pub struct Agreement {
    pub sg: String,
    pub pl: String,
    #[serde(rename = "gen")]
    pub gen_pl: String,
    pub fem: Option<bool>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Voicing {
    pub to_voiceless: IndexMap<String, String>,
    pub to_voiced: IndexMap<String, String>,
}

#[derive(Debug, Deserialize)]
pub struct Magnitudes {
    pub hundred: Agreement,
    pub thousand: Agreement,
    pub million: Agreement,
    pub billion: Agreement,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Numbers {
    pub units: Vec<String>,
    pub units_fem: Vec<String>,
    pub teens: Vec<String>,
    pub tens: Vec<String>,
    pub magnitudes: Magnitudes,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Normalization {
    pub counted_nouns: IndexMap<String, Agreement>,
    pub words: IndexMap<String, String>,
    pub months_gen: Vec<String>,
    pub letter_names: IndexMap<String, String>,
    pub acronym_letters: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LithuanianManifest {
    pub language: String,
    pub name: String,
    pub script: Vec<String>,
    pub vowels: IndexMap<String, String>,
    pub vowel_digraphs: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub consonant_digraphs: IndexMap<String, String>,
    pub front_vowels: String,
    pub back_vowels: String,
    pub voicing: Voicing,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
    pub normalization: Normalization,
}

const COUNTED_KEYS: [&str; 18] = [
    "percent",
    "degree",
    "hour",
    "minute",
    "kilometre",
    "metre",
    "millimetre",
    "centimetre",
    "kilogram",
    "hectare",
    "tonne",
    "gram",
    "milligram",
    "dollar",
    "euro",
    "pound",
    "litas",
    "squared",
];
const WORD_KEYS: [&str; 21] = [
    "decimalPoint",
    "minus",
    "plus",
    "celsius",
    "fahrenheit",
    "rangeFrom",
    "rangeTo",
    "and",
    "yearInstr",
    "yearGen",
    "day",
    "centuryGen",
    "month",
    "eraBefore",
    "eraOur",
    "thatIs",
    "forExample",
    "etCetera",
    "number",
    "page",
    "inhabitants",
];

fn validate(m: &LithuanianManifest) -> Result<(), String> {
    let n = &m.numbers;
    for (name, have) in [
        ("units", n.units.len()),
        ("unitsFem", n.units_fem.len()),
        ("teens", n.teens.len()),
        ("tens", n.tens.len()),
    ] {
        if have < 10 {
            return Err(format!(
                "lithuanian.jsonc numbers.{name}: {have} entries, 10 needed"
            ));
        }
    }
    let nr = &m.normalization;
    for k in COUNTED_KEYS {
        if !nr.counted_nouns.contains_key(k) {
            return Err(format!(
                "lithuanian.jsonc normalization.countedNouns: no \"{k}\""
            ));
        }
    }
    for k in WORD_KEYS {
        if !nr.words.contains_key(k) {
            return Err(format!("lithuanian.jsonc normalization.words: no \"{k}\""));
        }
    }
    Ok(())
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static LithuanianManifest, String> {
    static M: OnceLock<LithuanianManifest> = OnceLock::new();
    load_once(&M, || {
        let m: LithuanianManifest =
            load_manifest(DIR, "lithuanian.jsonc").map_err(|e| e.to_string())?;
        validate(&m)?;
        Ok(m)
    })
}

/// ⚠ Crate-private: touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static LithuanianManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.front_vowels, "eęėiįy");
        assert_eq!(m.numbers.units_fem[4], "keturios");
        assert_eq!(m.normalization.words["decimalPoint"], "kablelis");
        assert!(m.normalization.counted_nouns.contains_key("squared"));
    }
}
