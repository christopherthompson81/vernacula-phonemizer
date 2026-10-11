//! Galician's hand-authored facts, from `galician.jsonc`. Ported from src/languages/galician/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys the TS does not
//! read are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/galician";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vowels {
    pub strong: String,
    pub weak_unaccented: String,
    pub weak_accented: String,
    pub front: String,
}

#[derive(Debug, Deserialize)]
pub struct Scale {
    pub one: String,
    pub many: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Numbers {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub hundreds: Vec<String>,
    pub hundred_exact: String,
    pub thousand: String,
    pub connector: String,
    pub decimal_connector: String,
    pub million: Scale,
    pub billion: Scale,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GalicianManifest {
    pub vowels: Vowels,
    pub accents: IndexMap<String, String>,
    pub nasals: Vec<String>,
    pub velars: Vec<String>,
    pub spirantize: IndexMap<String, String>,
    pub function_words: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static GalicianManifest, String> {
    static M: OnceLock<GalicianManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "galician.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path. ⚠ Crate-private: touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static GalicianManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
