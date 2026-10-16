//! Kyrgyz's hand-authored facts, from `kyrgyz.jsonc`. Ported from src/languages/kyrgyz/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::numbers::NumbersDef;

pub const DIR: &str = "languages/kyrgyz";

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct KyrgyzManifest {
    pub vowels: IndexMap<String, String>,
    pub back_vowels: String,
    pub iotated: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub numbers: NumbersDef,
    pub clause_punctuation: IndexMap<String, String>,
    pub letter_names: IndexMap<String, String>,
    pub acronym_letters: Vec<String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static KyrgyzManifest, String> {
    static M: OnceLock<KyrgyzManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "kyrgyz.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path (a `KyrgyzPhonemizer`, whose constructor loads
/// it, or a `try_manifest` test first). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static KyrgyzManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = try_manifest().unwrap();
        assert_eq!(m.numbers.units.len(), 10);
        assert_eq!(m.numbers.tens.len(), 9);
        assert!(m.numbers.magnitudes.billion.is_some());
        assert_eq!(m.vowels.len(), 9);
        assert_eq!(m.letter_names.len(), 34);
        assert!(m.acronym_letters.is_empty());
    }
}
