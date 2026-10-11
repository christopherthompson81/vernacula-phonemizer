//! Korean's hand-authored tables, from `korean.jsonc`: jamo inventories, the letter→IPA and sandhi class maps,
//! clause punctuation, the Sino-Korean and native number words and the shared symbol tier's data.
//! Ported from src/languages/korean/manifest.ts — see that file for the corpus evidence.

use std::collections::HashMap;
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::js_string::JsString;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{CountForms, Multiply};

pub const DIR: &str = "languages/korean";

#[derive(Debug, Deserialize)]
pub struct Jamo {
    pub onset: String,
    pub vowel: String,
    pub coda: String,
}

/// `coda[jamo]`: the consonant kept before a consonant or pause, and the (left, onset) split under liaison.
#[derive(Debug, Deserialize)]
pub struct CodaInfo {
    pub cons: String,
    pub lc: String,
    pub lo: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Aspiration {
    pub h_coda_lenis_onset: IndexMap<String, String>,
    pub stop_coda_h_onset: IndexMap<String, String>,
}

#[derive(Debug, Deserialize)]
pub struct Native {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub twenty: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Numbers {
    pub ones: Vec<String>,
    pub ten: String,
    pub hundred: String,
    pub thousand: String,
    pub myriad_units: Vec<String>,
    pub native: Native,
}

/// `symbolTier: { percent; currency; multiply: { times; by? } }`.
#[derive(Debug, Deserialize)]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub multiply: Multiply,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KoreanManifest {
    pub jamo: Jamo,
    pub onset: IndexMap<String, String>,
    pub vowel: IndexMap<String, String>,
    pub coda: IndexMap<String, CodaInfo>,
    pub coda_phoneme: IndexMap<String, String>,
    pub nasal_codas: String,
    pub neutralize: IndexMap<String, String>,
    pub obstruent_to_nasal: IndexMap<String, String>,
    pub voice: IndexMap<String, String>,
    pub tense: IndexMap<String, String>,
    pub tense_jamo: IndexMap<String, String>,
    pub aspiration: Aspiration,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static KoreanManifest, String> {
    static M: OnceLock<KoreanManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "korean.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code that runs after `try_manifest` has succeeded (the registry's build checks it).
pub static MANIFEST: LazyLock<&'static KoreanManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

/// A string table as a `JsString` lookup.
pub fn table(m: &IndexMap<String, String>) -> HashMap<JsString, JsString> {
    m.iter()
        .map(|(k, v)| (JsString::from(k.as_str()), JsString::from(v.as_str())))
        .collect()
}

/// A string list as `JsString`s.
pub fn list(v: &[String]) -> Vec<JsString> {
    v.iter().map(|s| JsString::from(s.as_str())).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.numbers.ones.len(), 10);
        assert_eq!(m.numbers.native.tens.len(), 10);
        assert_eq!(m.coda.len(), 27);
        assert_eq!(m.jamo.coda.chars().count(), 27);
        assert!(m.symbol_tier.currency.contains_key("$"));
    }
}
