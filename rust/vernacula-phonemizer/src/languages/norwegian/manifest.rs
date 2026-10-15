//! Norwegian Bokmål's hand-authored tables, from `norwegian.jsonc`. Ported from src/languages/norwegian/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys the TS does not
//! read (`language`, `script`, `name`, `provenance`, `convention`) are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::numbers::NumbersDef;

pub const DIR: &str = "languages/norwegian";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vowels {
    pub long: IndexMap<String, String>,
    pub short: IndexMap<String, String>,
    pub long_before_r: IndexMap<String, String>,
    pub short_before_r: IndexMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NorwegianManifest {
    pub front_vowels: String,
    pub vowels: Vowels,
    pub digraphs: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub retroflex: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: NumbersDef,
    pub ordinals: IndexMap<String, String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static NorwegianManifest, String> {
    static M: OnceLock<NorwegianManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "norwegian.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path (a `NorwegianPhonemizer`, whose constructor loads
/// it). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static NorwegianManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = try_manifest().unwrap();
        assert_eq!(m.vowels.long.len(), 17);
        assert_eq!(m.vowels.short.len(), 17);
        assert_eq!(m.vowels.long_before_r["e"], "æː");
        assert_eq!(m.digraphs["skj"], "ʃ");
        assert_eq!(m.retroflex["rs"], "ʂ");
        assert_eq!(m.numbers.units.len(), 10);
        assert_eq!(m.ordinals["31"], "trettiførste");
    }
}
