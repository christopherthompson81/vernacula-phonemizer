//! Tajik's hand-authored data tables, from `tajik.jsonc`, loaded once. Ported from src/languages/tajik/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`); documentation keys are ignored.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::CountForms;

pub const DIR: &str = "languages/tajik";

/// `numbers`: the cardinal spellings and the scale ladder.
#[derive(Debug, FromJson)]
pub struct Numbers {
    pub units: Vec<String>,
    pub teens: Vec<String>,
    pub tens: IndexMap<String, String>,
    pub hundred: String,
    pub thousand: String,
    pub million: String,
    pub milliard: String,
    pub trillion: String,
    pub and: String,
}

#[derive(Debug, FromJson)]
pub struct Phonotactics {
    pub vowels: String,
    pub onsets: Vec<String>,
    pub codas: Vec<String>,
}

/// `symbolTier`: the shapes are core's own `SymbolData` field types.
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub magnitudes: Vec<String>,
    pub unit_per: String,
    pub rate_denominators: IndexMap<String, String>,
    pub ampersand: String,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct TajikManifest {
    pub vowels: IndexMap<String, String>,
    pub glides: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub numbers: Numbers,
    pub months: Vec<String>,
    pub letter_names: IndexMap<String, String>,
    pub acronym_letters: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub phonotactics: Phonotactics,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static TajikManifest, String> {
    static M: OnceLock<TajikManifest> = OnceLock::new();
    load_once(&M, || {
        let m: TajikManifest = load_manifest(DIR, "tajik.jsonc").map_err(|e| e.to_string())?;
        validate(&m)?;
        Ok(m)
    })
}

/// The table lengths the TS indexes with a `!` (a short table would read `undefined` there and stringify it).
fn validate(m: &TajikManifest) -> Result<(), String> {
    let n = &m.numbers;
    for (name, have, want) in [
        ("numbers.units", n.units.len(), 10),
        ("numbers.teens", n.teens.len(), 10),
        ("months", m.months.len(), 12),
    ] {
        if have < want {
            return Err(format!("tajik.jsonc {name}: {have} entries, {want} needed"));
        }
    }
    Ok(())
}

/// The manifest for code reached only through a checked path (a `TajikPhonemizer`, whose constructor loads it, or
/// a `try_manifest` first). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static TajikManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
