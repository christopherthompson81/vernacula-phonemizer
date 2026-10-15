//! Shona's hand-authored tables, from `shona.jsonc`: the grapheme table (and its keys, longest first), clause
//! punctuation and the number words.
//! Ported from src/languages/shona/manifest.ts — see that file for the corpus evidence.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, js};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::sorted_by_length_desc;

pub const DIR: &str = "languages/shona";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Numbers {
    pub units: Vec<String>,
    pub units_ma: Vec<String>,
    pub units_zvi: Vec<String>,
    pub ten: String,
    pub tens: String,
    pub hundred: String,
    pub hundreds: String,
    pub thousand: String,
    pub thousands: String,
    pub million: String,
    pub millions: String,
    pub billion: String,
    pub billions: String,
    pub and: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShonaManifest {
    pub language: String,
    pub name: String,
    pub script: Vec<String>,
    pub graphemes: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static ShonaManifest, String> {
    static M: OnceLock<ShonaManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "shona.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path. ⚠ Crate-private: touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static ShonaManifest> =
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
