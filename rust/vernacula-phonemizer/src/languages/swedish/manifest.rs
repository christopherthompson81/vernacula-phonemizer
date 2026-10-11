//! Swedish's hand-authored facts, from `swedish.jsonc`. Ported from src/languages/swedish/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[serde(default)]`); documentation keys the TS does not
//! read (`convention`, `provenance`, `vowelChars`, …) are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/swedish";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vowels {
    pub long: IndexMap<String, String>,
    pub short: IndexMap<String, String>,
    pub long_before_r: IndexMap<String, String>,
    pub short_before_r: IndexMap<String, String>,
}

#[derive(Debug, Deserialize)]
pub struct Million {
    pub sg: String,
    pub pl: String,
}

#[derive(Debug, Deserialize)]
pub struct Numbers {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub hundred: String,
    pub thousand: String,
    pub million: Million,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwedishManifest {
    pub front_vowels: String,
    pub vowels: Vowels,
    pub digraphs: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub retroflex: IndexMap<String, String>,
    pub exceptions: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static SwedishManifest, String> {
    static M: OnceLock<SwedishManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "swedish.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path: a `SwedishPhonemizer` (whose constructor loads
/// it) or a `try_manifest` test first. ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static SwedishManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = try_manifest().unwrap();
        assert_eq!(m.numbers.ones.len(), 20);
        assert_eq!(m.numbers.tens.len(), 10);
        assert_eq!(m.numbers.million.sg, "en miljon");
        assert_eq!(m.vowels.long_before_r["ä"], "æː");
        assert_eq!(m.digraphs["gn"], "ŋn");
        assert_eq!(m.exceptions["och"], "ɔ");
    }
}
