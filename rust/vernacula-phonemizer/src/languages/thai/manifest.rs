//! Thai's hand-authored tables, from `thai.jsonc`: onset/coda/vowel-quality maps, the length sets, the
//! syllabifier's grapheme classes, the tone system, clause punctuation, the TCC patterns, letter names and the
//! shared symbol tier's data. Ported from src/languages/thai/manifest.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::js_regex::JsRegex;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{
    CountForms, ExponentPosition, ExponentWords, Multiply, PositionDecl,
};

pub const DIR: &str = "languages/thai";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThaiConsonantClass {
    Mid,
    High,
    Low,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ThaiTone {
    Mid,
    Low,
    Falling,
    High,
    Rising,
}

/// `Record<ThaiConsonantClass, ThaiTone>`.
#[derive(Debug, Deserialize)]
pub struct ByClass {
    pub mid: ThaiTone,
    pub high: ThaiTone,
    pub low: ThaiTone,
}

impl ByClass {
    pub fn get(&self, c: ThaiConsonantClass) -> ThaiTone {
        match c {
            ThaiConsonantClass::Mid => self.mid,
            ThaiConsonantClass::High => self.high,
            ThaiConsonantClass::Low => self.low,
        }
    }
}

/// `Record<ThaiTone, string>`.
#[derive(Debug, Deserialize)]
pub struct ToneIpa {
    pub mid: String,
    pub low: String,
    pub falling: String,
    pub high: String,
    pub rising: String,
}

impl ToneIpa {
    pub fn get(&self, t: ThaiTone) -> &str {
        match t {
            ThaiTone::Mid => &self.mid,
            ThaiTone::Low => &self.low,
            ThaiTone::Falling => &self.falling,
            ThaiTone::High => &self.high,
            ThaiTone::Rising => &self.rising,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tone {
    pub class: IndexMap<String, ThaiConsonantClass>,
    /// Keyed by the five tone marks (four Thai marks plus the respelling macron).
    pub from_mark: IndexMap<String, ByClass>,
    /// Keyed `live`, `dead-short`, `dead-long`.
    pub no_mark: IndexMap<String, ByClass>,
    pub ipa: ToneIpa,
}

/// `exponentWords: { squared; cubed; position? }`.
#[derive(Debug, Deserialize)]
pub struct ThExponentWords {
    pub squared: CountForms,
    pub cubed: CountForms,
    pub position: Option<ExponentPosition>,
}

impl ThExponentWords {
    pub fn to_shared(&self) -> ExponentWords {
        ExponentWords {
            squared: Some(self.squared.clone()),
            cubed: Some(self.cubed.clone()),
            position: self.position.map(PositionDecl::All),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub unspaced_script: bool,
    pub ampersand: String,
    pub multiply: Multiply,
    pub exponent_words: ThExponentWords,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ThaiManifest {
    pub onset: IndexMap<String, String>,
    pub coda: IndexMap<String, String>,
    pub vowel_quality: IndexMap<String, String>,
    pub no_length: Vec<String>,
    pub force_long: Vec<String>,
    pub raisable: String,
    pub vowel_signs: Vec<String>,
    pub o_glottal_next: Vec<String>,
    pub short_vowel_signs: Vec<String>,
    pub live_codas: Vec<String>,
    pub tone: Tone,
    pub clause_punctuation: IndexMap<String, String>,
    pub tcc: Vec<String>,
    /// ⚠ Keyed by UPPERCASE Latin, exactly as written in the jsonc.
    pub letter_names: IndexMap<String, String>,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static ThaiManifest, String> {
    static M: OnceLock<ThaiManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "thai.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code that runs after `try_manifest` has succeeded (`create_thai` checks it first).
pub static MANIFEST: LazyLock<&'static ThaiManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

/// `THAI_TCC_RE`: one Thai Character Cluster at the START of a string.
pub static THAI_TCC_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!("^(?:{})", MANIFEST.tcc.join("|")), "u")
        .unwrap_or_else(|e| panic!("thai.jsonc tcc: {e}"))
});
