//! Telugu's hand-authored data (`telugu.jsonc`), loaded once and typed.
//! Ported from src/languages/telugu/manifest.ts.

use std::sync::OnceLock;

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::abugida::AbugidaDef;
use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::SymbolData;
use crate::core::numbers::{DravidianNumbersDef, Magnitudes};

/// `TeluguNumbers`: the Dravidian composer's fields (the four-form `magnitudeForms`, no `compound`) plus the
/// inherited `NumbersDef.magnitudes`, which no composer reads for Telugu.
#[derive(FromJson, Clone)]
pub struct TeluguNumbers {
    #[json(flatten)]
    pub dravidian: DravidianNumbersDef,
    pub magnitudes: Magnitudes,
}

#[derive(FromJson, Clone)]
#[json(rename_all = "camelCase")]
pub struct TeluguManifest {
    #[json(flatten)]
    pub abugida: AbugidaDef,
    pub numbers: TeluguNumbers,
    pub clause_punctuation: IndexMap<String, String>,
    /// WRITTEN forms for recognition, never emitted as a reading.
    pub initialism_letter_forms: Vec<String>,
    /// The shared symbol tier's data. The core `SymbolData` (every field optional) is a superset of its type.
    pub symbol_tier: SymbolData,
}

/// The manifest, or why it could not be loaded. Cached only on success.
pub fn try_manifest() -> Result<&'static TeluguManifest, String> {
    static M: OnceLock<TeluguManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest("languages/telugu", "telugu.jsonc").map_err(|e| e.to_string())
    })
}
