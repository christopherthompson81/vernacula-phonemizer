//! Malayalam's hand-authored data (`malayalam.jsonc`), loaded once and typed.
//! Ported from src/languages/malayalam/manifest.ts.

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
pub struct MalayalamNumbers {
    #[json(flatten)]
    pub dravidian: DravidianNumbersDef,
    pub decimal_word: String,
}

#[derive(FromJson, Clone)]
#[json(rename_all = "camelCase")]
pub struct MalayalamManifest {
    #[json(flatten)]
    pub abugida: AbugidaDef,
    pub numbers: MalayalamNumbers,
    pub clause_punctuation: IndexMap<String, String>,
    /// The shared symbol tier's data. The core `SymbolData` (every field optional) is a superset of its type.
    pub symbol_tier: SymbolData,
    /// The clitics welded onto a numeral, longest first: the order is load-bearing.
    pub ordinal_endings: Vec<String>,
}

/// The manifest, or why it could not be loaded. Cached only on success.
pub fn try_manifest() -> Result<&'static MalayalamManifest, String> {
    static M: OnceLock<MalayalamManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest("languages/malayalam", "malayalam.jsonc").map_err(|e| e.to_string())
    })
}
