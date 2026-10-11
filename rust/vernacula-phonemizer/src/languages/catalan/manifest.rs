//! Catalan's hand-authored facts, from `catalan.jsonc`. Ported from src/languages/catalan/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys the TS does not
//! read (`convention`, `provenance`, …) are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/catalan";

#[derive(Debug, Deserialize)]
pub struct VowelReal {
    pub stressed: String,
    pub reduced: String,
}

#[derive(Debug, Deserialize)]
pub struct Million {
    pub sg: String,
    pub pl: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Numbers {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub hundreds: Vec<String>,
    pub thousand: String,
    pub million: Million,
    pub and: String,
    pub decimal_connector: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalanManifest {
    /// Insertion order is the JSONC's: `Object.keys(V).join("")` builds the vowel class.
    pub vowels: IndexMap<String, VowelReal>,
    pub accented_vowels: String,
    pub front_vowels: String,
    pub nasals: Vec<String>,
    pub spirantize: IndexMap<String, String>,
    pub final_devoice: IndexMap<String, String>,
    pub palatals: Vec<String>,
    pub function_words: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static CatalanManifest, String> {
    static M: OnceLock<CatalanManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "catalan.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path (a `CatalanPhonemizer`, or `try_manifest` first).
/// ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static CatalanManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
