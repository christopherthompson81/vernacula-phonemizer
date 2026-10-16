//! Hausa's hand-authored tables, from `hausa.jsonc`: the longest-match rule table, the tone-code→Chao map, clause
//! punctuation, the number words, letter names, phonotactics and the shared symbol tier's data.
//! Ported from src/languages/hausa/manifest.ts — see that file for the corpus evidence.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{CountForms, ExponentPosition, Multiply};

pub const DIR: &str = "languages/hausa";

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Numbers {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub teens_connector: String,
    pub connector: String,
    pub hundred: String,
    pub thousand: String,
    pub million: String,
    pub billion: String,
}

#[derive(Debug, FromJson)]
pub struct Phonotactics {
    pub vowels: String,
    pub onsets: Vec<String>,
    pub codas: Vec<String>,
}

#[derive(Debug, FromJson)]
pub struct TierExponentWords {
    pub squared: CountForms,
    pub cubed: CountForms,
    pub position: Option<ExponentPosition>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct SymbolTier {
    pub multiply: Multiply,
    pub percent_prefix: bool,
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub exponent_words: TierExponentWords,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct HausaManifest {
    pub rules: Vec<(String, String, bool)>,
    pub tone_chao: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
    pub letter_names: IndexMap<String, String>,
    pub phonotactics: Phonotactics,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static HausaManifest, String> {
    static M: OnceLock<HausaManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "hausa.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path. ⚠ Crate-private: touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static HausaManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
