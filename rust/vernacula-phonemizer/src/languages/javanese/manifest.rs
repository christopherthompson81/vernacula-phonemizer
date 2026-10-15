//! Javanese's hand-authored tables, from `javanese.jsonc`: digraphs, consonants, vowels, clause punctuation, the
//! ngoko number words, letter names, phonotactics and the shared symbol tier's data.
//! Ported from src/languages/javanese/manifest.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{CountForms, ExponentWords, Multiply, UnitPer};

pub const DIR: &str = "languages/javanese";

#[derive(Debug, Deserialize)]
pub struct Magnitudes {
    pub thousand: Vec<String>,
    pub million: Vec<String>,
    pub billion: Vec<String>,
    pub trillion: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaneseNumbers {
    pub units: Vec<String>,
    pub teens: Vec<String>,
    pub likur: Vec<String>,
    pub mult: Vec<String>,
    pub tens: IndexMap<String, String>,
    pub magnitudes: Magnitudes,
    pub hundred_one: String,
    pub hundred: String,
}

#[derive(Debug, Deserialize)]
pub struct Phonotactics {
    pub vowels: String,
    pub onsets: Vec<String>,
    pub codas: Vec<String>,
}

/// `Required<Pick<SymbolData, …>>`: every one of the nine fields is required.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub magnitudes: Vec<String>,
    pub unit_per: UnitPer,
    pub rate_denominators: IndexMap<String, String>,
    pub exponent_words: ExponentWords,
    pub multiply: Multiply,
    pub ampersand: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JavaneseManifest {
    pub digraphs: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: JavaneseNumbers,
    pub letter_names: IndexMap<String, String>,
    pub phonotactics: Phonotactics,
    pub symbol_tier: SymbolTier,
}

pub fn try_manifest() -> Result<&'static JavaneseManifest, String> {
    static M: OnceLock<JavaneseManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "javanese.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code that runs after `try_manifest` has succeeded (`create_javanese` checks it first).
pub static MANIFEST: LazyLock<&'static JavaneseManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
