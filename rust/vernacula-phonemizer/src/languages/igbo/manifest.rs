//! Igbo's hand-authored tables, from `igbo.jsonc`: clause punctuation and the modern decimal cardinal numbers.
//! Ported from src/languages/igbo/manifest.ts — see that file for the corpus evidence.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/igbo";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Numbers {
    pub zero: String,
    pub one: String,
    pub units: Vec<String>,
    pub ten: String,
    pub hundred: String,
    pub thousand: String,
    pub million: String,
    pub billion: String,
    pub and: String,
    pub decimal_word: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IgboManifest {
    pub language: String,
    pub name: String,
    pub script: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static IgboManifest, String> {
    static M: OnceLock<IgboManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "igbo.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path. ⚠ Crate-private: touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static IgboManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
