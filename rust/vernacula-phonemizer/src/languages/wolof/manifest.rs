//! Wolof's hand-authored tables, from `wolof.jsonc`: the grapheme table (and its keys, longest first), the vowel
//! letters and clause punctuation.
//! Ported from src/languages/wolof/manifest.ts — see that file for the corpus evidence.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, js};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::sorted_by_length_desc;

pub const DIR: &str = "languages/wolof";

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct WolofManifest {
    pub language: String,
    pub name: String,
    pub script: Vec<String>,
    pub graphemes: IndexMap<String, String>,
    pub vowel_letters: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static WolofManifest, String> {
    static M: OnceLock<WolofManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "wolof.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path. ⚠ Crate-private: touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static WolofManifest> =
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
