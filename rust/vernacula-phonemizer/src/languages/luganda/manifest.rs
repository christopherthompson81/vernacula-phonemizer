//! Luganda's hand-authored tables, from `luganda.jsonc`. Ported from src/languages/luganda/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::js_string::JsString;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/luganda";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LugandaNumbers {
    pub zero: String,
    pub units: Vec<String>,
    pub ten: String,
    pub tens: Vec<String>,
    pub hundred_one: String,
    pub hundreds: String,
    pub hundreds_mult: Vec<String>,
    pub thousand_one: String,
    pub thousands: String,
    pub million_one: String,
    pub millions: String,
    pub billion_one: String,
    pub billions: String,
    pub bu_mult: Vec<String>,
    pub and_teen: String,
    pub and_teen_elided: String,
    pub mu: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LugandaManifest {
    pub language: String,
    pub name: String,
    pub script: Vec<String>,
    pub graphemes: IndexMap<String, String>,
    pub vowel_letters: Vec<String>,
    pub prenasalisable: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: LugandaNumbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static LugandaManifest, String> {
    static M: OnceLock<LugandaManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "luganda.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path (a `LugandaPhonemizer`, whose constructor loads
/// it). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static LugandaManifest> =
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
