//! Kannada's hand-authored data (`kannada.jsonc`), loaded once and typed.
//! Ported from src/languages/kannada/manifest.ts.

use std::sync::OnceLock;

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::abugida::AbugidaDef;
use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::SymbolData;
use crate::core::numbers::DravidianNumbersDef;

#[derive(FromJson, Clone)]
#[json(rename_all = "camelCase")]
pub struct KannadaNumbers {
    #[json(flatten)]
    pub dravidian: DravidianNumbersDef,
    pub decimal_word: String,
}

#[derive(FromJson, Clone)]
#[json(rename_all = "camelCase")]
pub struct KannadaManifest {
    #[json(flatten)]
    pub abugida: AbugidaDef,
    pub numbers: KannadaNumbers,
    pub clause_punctuation: IndexMap<String, String>,
    /// WRITTEN forms for recognition, never emitted as a reading.
    pub initialism_letter_forms: Vec<String>,
    /// The shared symbol tier's data. The core `SymbolData` (every field optional) is a superset of its type.
    pub symbol_tier: SymbolData,
}

/// The manifest, or why it could not be loaded. Cached only on success.
pub fn try_manifest() -> Result<&'static KannadaManifest, String> {
    static M: OnceLock<KannadaManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest("languages/kannada", "kannada.jsonc").map_err(|e| e.to_string())
    })
}
