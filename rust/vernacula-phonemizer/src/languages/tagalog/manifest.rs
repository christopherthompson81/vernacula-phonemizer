//! Tagalog's hand-authored tables, from `tagalog.jsonc`. Ported from src/languages/tagalog/manifest.ts (the
//! `TagalogDef` shape is declared in tagalog.ts).
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/tagalog";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NumbersDef {
    pub units: Vec<String>,
    pub teens: Vec<String>,
    pub tens: Vec<String>,
    pub hundred: String,
    pub hundred_after_na: String,
    pub hundred1: String,
    pub thousand: String,
    pub thousand1: String,
    pub million: String,
    pub billion: String,
    pub trillion: String,
    pub and: String,
    pub stress_penult: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TagalogDef {
    pub digraphs: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub special_words: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: NumbersDef,
    pub contracted_ordinals: IndexMap<String, String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static TagalogDef, String> {
    static M: OnceLock<TagalogDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "tagalog.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path (a `TagalogPhonemizer`, whose constructor loads
/// it). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static TagalogDef> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
