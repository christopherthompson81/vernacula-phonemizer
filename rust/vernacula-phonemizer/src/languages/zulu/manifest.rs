//! Zulu's hand-authored tables, from `zulu.jsonc`: the longest-match rule table, the tone-code→Chao map, clause
//! punctuation, the number words and the `ye-` ordinals. Xhosa reads the same shape from its own file.
//! Ported from src/languages/zulu/manifest.ts — see that file for the corpus evidence.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/zulu";

#[derive(Debug, Deserialize)]
pub struct NounClassMagnitude {
    pub one: String,
    pub many: String,
}

#[derive(Debug, Deserialize)]
pub struct Numbers {
    pub ku: Vec<String>,
    pub na: Vec<String>,
    pub ama: Vec<String>,
    pub zero: String,
    pub ten: NounClassMagnitude,
    pub hundred: NounClassMagnitude,
    pub thousand: NounClassMagnitude,
    pub million: NounClassMagnitude,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ZuluManifest {
    pub rules: Vec<(String, String, bool)>,
    pub tone_chao: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
    pub ordinal_ye: IndexMap<String, String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static ZuluManifest, String> {
    static M: OnceLock<ZuluManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "zulu.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path. ⚠ Crate-private: touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static ZuluManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
