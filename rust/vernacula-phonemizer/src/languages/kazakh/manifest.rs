//! Kazakh's hand-authored facts, from `kazakh.jsonc`. Ported from src/languages/kazakh/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/kazakh";

/// Pre-phonemized cardinal atoms (IPA, not orthography).
#[derive(Debug, Deserialize)]
pub struct Numbers {
    pub units: Vec<String>,
    pub tens: Vec<String>,
    pub hundred: String,
    pub thousand: String,
    pub million: String,
    pub milliard: String,
    pub trillion: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KazakhManifest {
    pub vowels: IndexMap<String, String>,
    pub glides: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub front_vowels: String,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static KazakhManifest, String> {
    static M: OnceLock<KazakhManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "kazakh.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path (a `KazakhPhonemizer`, whose constructor loads
/// it, or a `try_manifest` test first). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static KazakhManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = try_manifest().unwrap();
        assert_eq!(m.numbers.units.len(), 10);
        assert_eq!(m.numbers.tens.len(), 10);
        assert_eq!(m.vowels.len(), 10);
        assert_eq!(m.glides.len(), 5);
        assert_eq!(m.front_vowels, "eɵʏɪæ");
    }
}
