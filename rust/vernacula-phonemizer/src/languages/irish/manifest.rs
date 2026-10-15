//! Irish's hand-authored tables, from `irish.jsonc`. Ported from src/languages/irish/manifest.ts — see that file
//! for the corpus evidence.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/irish";

#[derive(Debug, Deserialize)]
pub struct Magnitudes {
    pub hundred: String,
    pub thousand: String,
    pub million: String,
    pub billion: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Numbers {
    pub ones: Vec<String>,
    pub attributive: Vec<String>,
    pub tens: IndexMap<String, String>,
    pub teen_word: String,
    pub magnitudes: Magnitudes,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IrishManifest {
    pub slender_vowels: String,
    pub broad_vowels: String,
    pub liquids: Vec<String>,
    pub svarabhakti_next: Vec<String>,
    pub broad: IndexMap<String, String>,
    pub slender: IndexMap<String, String>,
    pub lenition: IndexMap<String, [String; 2]>,
    pub vowels: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static IrishManifest, String> {
    static M: OnceLock<IrishManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "irish.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path. ⚠ Crate-private: touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static IrishManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
