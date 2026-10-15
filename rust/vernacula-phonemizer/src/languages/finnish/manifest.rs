//! Finnish's hand-authored data tables, from `finnish.jsonc`, loaded once, and the grapheme keys longest first.
//! Ported from src/languages/finnish/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys the TS does not
//! read (`language`, `name`, `script`, `provenance`, `convention`) are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, js};
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/finnish";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Numbers {
    pub zero: String,
    pub units: Vec<String>,
    pub ten: String,
    pub tens_stem: String,
    pub teen_suffix: String,
    pub hundred: String,
    pub hundred_stem: String,
    pub thousand: String,
    pub thousand_stem: String,
    pub million: String,
    pub million_stem: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FinnishManifest {
    pub graphemes: IndexMap<String, String>,
    pub vowel_letters: Vec<String>,
    pub numbers: Numbers,
    pub clause_punctuation: IndexMap<String, String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static FinnishManifest, String> {
    static M: OnceLock<FinnishManifest> = OnceLock::new();
    load_once(&M, || {
        let m: FinnishManifest = load_manifest(DIR, "finnish.jsonc").map_err(|e| e.to_string())?;
        if m.numbers.units.len() < 10 {
            return Err(format!(
                "finnish.jsonc numbers.units: {} entries, 10 needed",
                m.numbers.units.len()
            ));
        }
        Ok(m)
    })
}

/// The manifest for code reached only through a checked path (a `FinnishPhonemizer`, whose constructor loads
/// it). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static FinnishManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

/// `GRAPHEME_KEYS`: the grapheme table's keys in insertion order, stably sorted by length, longest first.
pub(crate) static GRAPHEME_KEYS: LazyLock<Vec<(JsString, JsString)>> = LazyLock::new(|| {
    let mut keys: Vec<(JsString, JsString)> = MANIFEST
        .graphemes
        .iter()
        .map(|(k, v)| (js(k), js(v)))
        .collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.0.len()));
    keys
});
