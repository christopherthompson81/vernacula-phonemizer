//! Welsh's hand-authored tables, from `welsh.jsonc`. Ported from src/languages/welsh/manifest.ts — see that file
//! for the corpus evidence.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/welsh";

#[derive(Debug, FromJson)]
pub struct Numbers {
    pub ones: Vec<String>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct WelshManifest {
    pub digraphs: IndexMap<String, String>,
    pub nasal_mutation: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub long_vowel: IndexMap<String, String>,
    pub lengthen_before: String,
    pub obscure_y: Vec<String>,
    pub exceptions: IndexMap<String, String>,
    pub enclitics: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static WelshManifest, String> {
    static M: OnceLock<WelshManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "welsh.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path. ⚠ Crate-private: touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static WelshManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
