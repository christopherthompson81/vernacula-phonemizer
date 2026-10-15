//! Danish's hand-authored tables, from `danish.jsonc`. Ported from src/languages/danish/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys the TS does not
//! read (`provenance`, `convention`) are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::units_first_numbers::{OnePlural, OneWord};
use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/danish";

#[derive(Debug, Deserialize)]
pub struct Numbers {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub connector: String,
    pub hundred: OneWord,
    pub thousand: OneWord,
    pub million: OnePlural,
    pub billion: OnePlural,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DanishManifest {
    pub language: String,
    pub name: String,
    pub script: Vec<String>,
    pub vowels: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
    pub ordinals: IndexMap<String, String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static DanishManifest, String> {
    static M: OnceLock<DanishManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "danish.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path (a `DanishPhonemizer`, whose constructor loads it).
/// ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static DanishManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(all(test, feature = "da"))]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = try_manifest().unwrap();
        assert_eq!(m.numbers.ones.len(), 20);
        assert_eq!(m.numbers.tens.len(), 10);
        assert_eq!(m.numbers.connector, "og");
        assert_eq!(m.consonants["r"], "ʁ");
        assert_eq!(m.ordinals["31"], "enogtredivte");
    }
}
