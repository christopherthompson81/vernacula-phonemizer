//! Yoruba's hand-authored tables, from `yoruba.jsonc`: the orthography tables, the three tones, clause punctuation,
//! the symbol readings, the vigesimal cardinal numbers and the shared symbol tier's data.
//! Ported from src/languages/yoruba/manifest.ts — see that file for the corpus evidence.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{CountForms, UnitPer};

pub const DIR: &str = "languages/yoruba";

#[derive(Debug, FromJson)]
pub struct Tones {
    pub high: String,
    pub mid: String,
    pub low: String,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Symbols {
    pub range: String,
    pub percent_before: String,
    pub percent_after: String,
    pub decimal_word: String,
    pub and: String,
    pub negative: String,
    pub metre: String,
    pub squared: String,
    pub degree: String,
    pub scales: IndexMap<String, String>,
    pub times: String,
}

#[derive(Debug, FromJson)]
pub struct TenForms {
    pub free: String,
    pub fused: String,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Numbers {
    pub zero: String,
    pub units: Vec<String>,
    pub front: Vec<String>,
    pub tens: IndexMap<String, TenForms>,
    pub teen: String,
    pub fifteen: String,
    pub twenty_five: String,
    pub add: String,
    pub subtract: String,
    pub hundreds: Vec<String>,
    pub thousand: String,
    pub million: String,
    pub billion: String,
    pub multiplier_one: String,
    pub times: String,
    pub join: String,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct SymbolTier {
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub unit_per: UnitPer,
    pub rate_denominators: IndexMap<String, String>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct YorubaManifest {
    pub consonants: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub tones: Tones,
    pub clause_punctuation: IndexMap<String, String>,
    pub symbols: Symbols,
    pub numbers: Numbers,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static YorubaManifest, String> {
    static M: OnceLock<YorubaManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "yoruba.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path. ⚠ Crate-private: touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static YorubaManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
