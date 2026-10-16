//! Kirundi's hand-authored tables, from `kirundi.jsonc`; the number table is Kinyarwanda's `RwandaRundiNumbers`
//! type. Ported from src/languages/kirundi/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::js_string::JsString;
use crate::core::load_manifest::load_manifest;
use crate::languages::kinyarwanda::manifest::RwandaRundiNumbers;

pub const DIR: &str = "languages/kirundi";

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct KirundiManifest {
    pub language: String,
    pub name: String,
    pub script: Vec<String>,
    pub graphemes: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: RwandaRundiNumbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static KirundiManifest, String> {
    static M: OnceLock<KirundiManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "kirundi.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path (a `KirundiPhonemizer`, whose constructor loads
/// it). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static KirundiManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

/// `GRAPHEME_KEYS`: the table's keys, LENGTH DESC by a stable sort (JS `sort` is stable), lengths in code units.
pub(crate) static GRAPHEME_KEYS: LazyLock<Vec<JsString>> = LazyLock::new(|| {
    let mut keys: Vec<JsString> = MANIFEST
        .graphemes
        .keys()
        .map(|k| JsString::from(k.as_str()))
        .collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.len()));
    keys
});
