//! Azerbaijani's hand-authored facts, from `azerbaijani.jsonc`. Ported from src/languages/azerbaijani/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/azerbaijani";

#[derive(Debug, FromJson)]
pub struct Vowels {
    pub ipa: IndexMap<String, String>,
    pub front: Vec<String>,
    pub back: Vec<String>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Numbers {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub scales: Vec<String>,
    pub hundred: String,
    pub zero: String,
    pub decimal_connector: String,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct AzerbaijaniManifest {
    pub vowels: Vowels,
    pub consonants: IndexMap<String, String>,
    pub geminate: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static AzerbaijaniManifest, String> {
    static M: OnceLock<AzerbaijaniManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "azerbaijani.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path (an `AzerbaijaniPhonemizer`, whose constructor
/// loads it, or a `try_manifest` test first). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static AzerbaijaniManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = try_manifest().unwrap();
        assert_eq!(m.numbers.ones.len(), 10);
        assert_eq!(m.numbers.scales.len(), 6);
        assert_eq!(m.vowels.ipa.len(), 9);
        assert_eq!(m.clause_punctuation.len(), 7);
    }
}
