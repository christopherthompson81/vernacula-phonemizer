//! Tamil's hand-authored data (`tamil.jsonc`), loaded once and typed: the abugida definition, the Dravidian voicing
//! classes, clause punctuation, the sandhi-fused cardinal tables, initialism letter forms, the symbol tier and the
//! ordinal suffixes.
//! Ported from src/languages/tamil/manifest.ts.

use std::sync::OnceLock;

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::abugida::AbugidaDef;
use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::SymbolData;

#[derive(FromJson, Clone)]
#[json(rename_all = "camelCase")]
pub struct TamilMagnitudes {
    pub hundred: String,
    pub thousand: String,
    pub thousand_combining: String,
    pub lakh: String,
    pub lakh_combining: String,
    pub crore: String,
    pub crore_combining: String,
    pub one: String,
}

#[derive(FromJson, Clone)]
#[json(rename_all = "camelCase")]
pub struct TamilNumbers {
    pub units: Vec<String>,
    pub tens: Vec<String>,
    pub teens: Vec<String>,
    pub tens_combining: Vec<String>,
    pub hundreds: Vec<String>,
    pub hundreds_combining: Vec<String>,
    pub thousands: Vec<String>,
    pub thousands_combining: Vec<String>,
    pub magnitudes: TamilMagnitudes,
}

#[derive(FromJson, Clone)]
#[json(rename_all = "camelCase")]
pub struct TamilVoicing {
    /// Iterated by nothing; looked up by unit.
    pub voice: IndexMap<String, String>,
    pub nasals: Vec<String>,
    pub voiceless_block: Vec<String>,
}

#[derive(FromJson, Clone)]
#[json(rename_all = "camelCase")]
pub struct TamilManifest {
    #[json(flatten)]
    pub abugida: AbugidaDef,
    pub voicing: TamilVoicing,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: TamilNumbers,
    /// WRITTEN forms for recognition, never emitted as a reading.
    pub initialism_letter_forms: Vec<String>,
    /// The shared symbol tier's data. The core `SymbolData` (every field optional) is a superset of its type.
    pub symbol_tier: SymbolData,
    /// Longest first: the order is load-bearing.
    pub ordinal_suffixes: Vec<String>,
}

/// The manifest, or why it could not be loaded. Cached only on success.
pub fn try_manifest() -> Result<&'static TamilManifest, String> {
    static M: OnceLock<TamilManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest("languages/tamil", "tamil.jsonc").map_err(|e| e.to_string())
    })
}
