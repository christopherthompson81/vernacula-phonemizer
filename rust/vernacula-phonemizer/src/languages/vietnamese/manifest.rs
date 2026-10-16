//! Vietnamese's hand-authored tables, from `vietnamese.jsonc`: the tone diacritic map, the ordered onset table,
//! the vowel sets, clause punctuation, number words, letter names and the shared symbol tier's data.
//! Ported from src/languages/vietnamese/manifest.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{CountForms, ExponentPosition, Multiply};

pub const DIR: &str = "languages/vietnamese";

#[derive(Debug, FromJson)]
pub struct Tones {
    pub diacritics: IndexMap<String, String>,
    pub ngang: String,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Numbers {
    pub ones: Vec<String>,
    pub scales: Vec<String>,
    pub hundred: String,
    pub ten: String,
    pub tens_multiplier: String,
    pub unit_one_after_ten: String,
    pub unit_five_after_ten: String,
    pub zero_tens: String,
}

/// `exponentWords: { squared; cubed; position? }`.
#[derive(Debug, FromJson)]
pub struct ViExponentWords {
    pub squared: CountForms,
    pub cubed: CountForms,
    pub position: Option<ExponentPosition>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub multiply: Multiply,
    pub exponent_words: ViExponentWords,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct VietnameseManifest {
    pub tones: Tones,
    pub onsets: Vec<(String, String)>,
    pub vowel_letters: String,
    pub vowel_ipa: String,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
    /// ⚠ Keyed by UPPERCASE Latin, exactly as written in the jsonc.
    pub letter_names: IndexMap<String, String>,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static VietnameseManifest, String> {
    static M: OnceLock<VietnameseManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "vietnamese.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code that runs after `try_manifest` has succeeded (`create_vietnamese` checks it first).
pub static MANIFEST: LazyLock<&'static VietnameseManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
