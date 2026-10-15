//! Kinyarwanda's hand-authored tables, from `kinyarwanda.jsonc`, and the Rwanda-Rundi number table type that
//! Kirundi shares. Ported from src/languages/kinyarwanda/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`) except `billion`, optional there too.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::js_string::JsString;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/kinyarwanda";

/// `RwandaRundiNumbers`: one instance per language (rw / rn), for the shared compositor in numbers.rs.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RwandaRundiNumbers {
    pub units: Vec<String>,
    pub ten: String,
    pub tens: Vec<String>,
    pub hundred: String,
    pub hundreds: String,
    pub hundreds_mul: Vec<String>,
    pub thousand: String,
    pub thousands: String,
    pub thousands_mul: Vec<String>,
    pub million: String,
    pub billion: Option<String>,
    pub and: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KinyarwandaManifest {
    pub language: String,
    pub name: String,
    pub script: Vec<String>,
    pub graphemes: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: RwandaRundiNumbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static KinyarwandaManifest, String> {
    static M: OnceLock<KinyarwandaManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "kinyarwanda.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path (a `KinyarwandaPhonemizer`, whose constructor
/// loads it). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static KinyarwandaManifest> =
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
