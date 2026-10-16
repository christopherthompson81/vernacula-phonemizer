//! Odia's hand-authored data (`odia.jsonc`), loaded once and typed.
//! Ported from src/languages/odia/manifest.ts.

use std::sync::OnceLock;

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::abugida::AbugidaDef;
use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::SymbolData;
use crate::core::numbers::NumbersDef;

#[derive(FromJson, Clone)]
#[json(rename_all = "camelCase")]
pub struct OdiaManifest {
    #[json(flatten)]
    pub abugida: AbugidaDef,
    pub numbers: NumbersDef,
    pub clause_punctuation: IndexMap<String, String>,
    /// The shared symbol tier's data. The core `SymbolData` (every field optional) is a superset of its type.
    pub symbol_tier: SymbolData,
    /// Ordinal suffixes, LONGEST FIRST: the order is load-bearing.
    pub ordinal_suffixes: Vec<String>,
}

/// The manifest, or why it could not be loaded. Cached only on success.
pub fn try_manifest() -> Result<&'static OdiaManifest, String> {
    static M: OnceLock<OdiaManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest("languages/odia", "odia.jsonc").map_err(|e| e.to_string())
    })
}
