//! Sinhala's hand-authored data (`sinhala.jsonc`), loaded once and typed: the abugida definition, the homorganic
//! anusvara classes, clause punctuation and the cardinal words.
//! Ported from src/languages/sinhala/manifest.ts.

use std::collections::HashMap;
use std::sync::OnceLock;

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::abugida::AbugidaDef;
use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

#[derive(Deserialize, Clone)]
pub struct AnusvaraClass {
    pub triggers: String,
    pub nasal: String,
    pub note: Option<String>,
}

#[derive(Deserialize, Clone)]
pub struct Anusvara {
    pub default: String,
    pub classes: Vec<AnusvaraClass>,
}

#[derive(Deserialize, Clone)]
pub struct SinhalaMagnitudes {
    pub hundred: String,
    pub thousand: String,
    pub lakh: String,
    pub million: String,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SinhalaNumbers {
    pub units: Vec<String>,
    pub teens: Vec<String>,
    pub tens_word: HashMap<String, String>,
    pub tens_stem: HashMap<String, String>,
    pub magnitudes: SinhalaMagnitudes,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SinhalaManifest {
    #[serde(flatten)]
    pub abugida: AbugidaDef,
    pub anusvara: Anusvara,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: SinhalaNumbers,
}

/// The manifest, or why it could not be loaded. Cached only on success.
pub fn try_manifest() -> Result<&'static SinhalaManifest, String> {
    static M: OnceLock<SinhalaManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest("languages/sinhala", "sinhala.jsonc").map_err(|e| e.to_string())
    })
}
