//! Mandarin's hand-authored tables, from `cmn.jsonc`: tones, sandhi, clause punctuation, measure words, the
//! number-reading tables, letter names and the shared symbol tier's data.
//! Ported from src/languages/mandarin/manifest.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/mandarin";

#[derive(Debug, Deserialize)]
pub struct ThirdThird {
    pub from: String,
    pub before: String,
    pub to: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sandhi {
    pub third_third: ThirdThird,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Numbers {
    pub digits: Vec<String>,
    pub positions: Vec<String>,
    pub big_units: Vec<String>,
    pub two: String,
    pub decimal_point: String,
    pub zero_digit: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CmnManifest {
    /// Keyed "1".."5".
    pub tones: IndexMap<String, String>,
    pub sandhi: Sandhi,
    pub clause_punctuation: IndexMap<String, String>,
    pub measure_words: String,
    pub numbers: Numbers,
    /// ⚠ Keyed by UPPERCASE Latin, exactly as written in the jsonc.
    pub letter_names: IndexMap<String, String>,
    /// The shared symbol tier's data, handed to the symbol normalizer as the TS hands it.
    pub symbol_tier: serde_json::Value,
}

/// The manifest, or why it could not be loaded. Loaded once; a failure is cached, not retried.
pub fn try_manifest() -> Result<&'static CmnManifest, String> {
    static M: OnceLock<Result<CmnManifest, String>> = OnceLock::new();
    M.get_or_init(|| load_manifest(DIR, "cmn.jsonc").map_err(|e| e.to_string()))
        .as_ref()
        .map_err(Clone::clone)
}

/// The manifest for code that runs only after `create_mandarin` has succeeded (which checks it first).
pub static MANIFEST: LazyLock<&'static CmnManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.tones.get("3").map(String::as_str), Some("˨˩˦"));
        assert_eq!(m.numbers.digits.len(), 10);
        assert_eq!(m.numbers.big_units.len(), 4);
        assert_eq!(m.letter_names.get("W").map(String::as_str), Some("大布留"));
        assert_eq!(m.clause_punctuation.get("。").map(String::as_str), Some("."));
        assert!(m.symbol_tier.get("units").is_some());
    }
}
