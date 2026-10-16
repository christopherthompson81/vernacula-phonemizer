//! Bengali's hand-authored data (`bengali.jsonc`), loaded once and typed as the `BengaliDef` that the reusing
//! languages (as, bpy) load their own files through.
//! Ported from src/languages/bengali/manifest.ts and the `BengaliDef` interface in bengali.ts.

use std::sync::OnceLock;

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::abugida::AbugidaDef;
use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::SymbolData;
use crate::core::numbers::NumbersDef;

pub const DIR: &str = "languages/bengali";

#[derive(Debug, FromJson, Clone)]
pub struct Ordinals {
    pub suppletive: IndexMap<String, String>,
    pub suffixes: Vec<String>,
}

#[derive(FromJson, Clone)]
#[json(rename_all = "camelCase")]
pub struct BengaliDef {
    #[json(flatten)]
    pub abugida: AbugidaDef,
    pub numbers: NumbersDef,
    pub clause_punctuation: IndexMap<String, String>,
    pub symbols: Option<IndexMap<String, String>>,
    pub strip_symbols: Option<String>,
    pub height_harmony: Option<bool>,
    pub medial_schwa_deletion: Option<bool>,
    pub skip_lexicon: Option<bool>,
    pub unit_words: Option<IndexMap<String, Vec<String>>>,
    /// ⚠ REQUIRED in the TS interface, but assamese.jsonc and bishnupriya.jsonc omit it (the cast hides that): the
    /// engine only ever reads BENGALI's, so it is optional here. The core `SymbolData` is a superset of its type.
    pub symbol_tier: Option<SymbolData>,
    /// ⚠ Required in the TS interface and absent from the same two files, for the same reason.
    pub ordinals: Option<Ordinals>,
}

/// The manifest, or why it could not be loaded. Cached only on success.
pub fn try_manifest() -> Result<&'static BengaliDef, String> {
    static M: OnceLock<BengaliDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "bengali.jsonc").map_err(|e| e.to_string())
    })
}

/// `loadManifest<BengaliDef>(import.meta.url, "<dir>.jsonc")` for a reusing language whose data lives in
/// `languages/<dir>/<dir>.jsonc`, loaded once into the caller's cell. Cached only on success.
pub fn load_bengali_def(
    cell: &'static OnceLock<BengaliDef>,
    dir: &str,
) -> Result<&'static BengaliDef, String> {
    load_once(cell, || {
        load_manifest(&format!("languages/{dir}"), &format!("{dir}.jsonc"))
            .map_err(|e| e.to_string())
    })
}
