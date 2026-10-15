//! Swahili's hand-authored tables, from `swahili.jsonc`. Ported from src/languages/swahili/manifest.ts.
//!
//! Every field the TS `SwahiliDef` names is REQUIRED (no `#[serde(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{CountForms, Multiply, UnitPer};

pub const DIR: &str = "languages/swahili";

#[derive(Debug, Deserialize)]
pub struct NumbersDef {
    pub units: Vec<String>,
    pub ten: String,
    pub tens: IndexMap<String, String>,
    pub hundred: String,
    pub thousand: String,
    pub million: String,
    pub and: String,
}

/// `Required<Pick<SymbolData, …>>`: every key present.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub percent_prefix: bool,
    pub currency_prefix: bool,
    pub unit_prefix: bool,
    pub unit_per: UnitPer,
    pub rate_denominators: IndexMap<String, String>,
    pub multiply: Multiply,
    pub ampersand: String,
}

#[derive(Debug, Deserialize)]
pub struct EraWords {
    pub bce: String,
    pub ad: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwahiliManifest {
    pub velar_nasal: String,
    pub prenasal: IndexMap<String, String>,
    pub digraphs: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: NumbersDef,
    pub symbol_tier: SymbolTier,
    pub era_words: EraWords,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static SwahiliManifest, String> {
    static M: OnceLock<SwahiliManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "swahili.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path (a `SwahiliPhonemizer`, whose constructor loads
/// it). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static SwahiliManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
