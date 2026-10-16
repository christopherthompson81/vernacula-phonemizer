//! Setswana's hand-authored tables, from `setswana.jsonc`: the grapheme table (and its keys, longest first), clause
//! punctuation and the number words.
//! Ported from src/languages/setswana/manifest.ts — see that file for the corpus evidence.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, js};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::sorted_by_length_desc;

pub const DIR: &str = "languages/setswana";

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Numbers {
    pub zero: String,
    pub units: Vec<String>,
    pub ten: String,
    pub tens_word: String,
    pub mult: Vec<String>,
    pub hundred: String,
    pub hundreds_word: String,
    pub thousand: String,
    pub thousands_word: String,
    pub di_mult: Vec<String>,
    pub and: String,
    pub of: String,
    pub these: String,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct SetswanaManifest {
    pub language: String,
    pub name: String,
    pub script: Vec<String>,
    pub graphemes: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static SetswanaManifest, String> {
    static M: OnceLock<SetswanaManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "setswana.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path. ⚠ Crate-private: touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static SetswanaManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

/// `GRAPHEME_KEYS`: the grapheme keys, longest first (a stable sort), each with its IPA.
pub static GRAPHEME_KEYS: LazyLock<Vec<(JsString, JsString)>> = LazyLock::new(|| {
    sorted_by_length_desc(MANIFEST.graphemes.keys().map(|k| js(k)))
        .into_iter()
        .map(|k| {
            let v = js(&MANIFEST.graphemes[&k.to_string_lossy()]);
            (k, v)
        })
        .collect()
});
