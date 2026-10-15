//! Hungarian's hand-authored data tables, from `hungarian.jsonc`, loaded once: the longest-match rule table, the
//! voicing triggers, the number words, letter names, phonotactics, the symbol tier's data and the ordinal /
//! multiplicative morphs. Ported from src/languages/hungarian/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys the TS does not
//! read (`language`, `name`, `script`, `provenance`, `convention`) are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{CountForms, ExponentWords};

pub const DIR: &str = "languages/hungarian";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Numbers {
    pub units: Vec<String>,
    pub teens: Vec<String>,
    pub tens: Vec<String>,
    pub tens_prefix: IndexMap<String, String>,
    pub hundred: String,
    pub thousand: String,
    pub million: String,
    pub milliard: String,
}

#[derive(Debug, Deserialize)]
pub struct Phonotactics {
    pub vowels: String,
    pub onsets: Vec<String>,
    pub codas: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub rate_denominators: IndexMap<String, String>,
    pub unit_per: String,
    pub ampersand: String,
    pub exponent_words: ExponentWords,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HungarianManifest {
    pub rules: Vec<(String, String, bool)>,
    pub voiceless_triggers: Vec<String>,
    pub voiced_triggers: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
    pub letter_names: IndexMap<String, String>,
    pub phonotactics: Phonotactics,
    pub symbol_tier: SymbolTier,
    pub ordinal_morphs: IndexMap<String, String>,
    pub multiplicative_morphs: IndexMap<String, String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static HungarianManifest, String> {
    static M: OnceLock<HungarianManifest> = OnceLock::new();
    load_once(&M, || {
        let m: HungarianManifest =
            load_manifest(DIR, "hungarian.jsonc").map_err(|e| e.to_string())?;
        let n = &m.numbers;
        if n.units.len() < 10 || n.teens.len() < 10 || n.tens.len() < 10 {
            return Err(
                "hungarian.jsonc numbers: units, teens and tens need 10 entries".to_string(),
            );
        }
        if !n.tens_prefix.contains_key("20") {
            return Err("hungarian.jsonc numbers.tensPrefix: no \"20\"".to_string());
        }
        Ok(m)
    })
}

/// The manifest for code reached only through a checked path (a `HungarianPhonemizer`, whose constructor loads
/// it, or `try_manifest` first). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static HungarianManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
