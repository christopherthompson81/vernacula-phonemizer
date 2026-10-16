//! Cebuano's hand-authored tables, from `cebuano.jsonc`. Ported from src/languages/cebuano/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`) except as noted; documentation keys
//! (and `numbers`, which numbers.ts loads under its own type) are ignored here.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{CountForms, PositionDecl};

pub const DIR: &str = "languages/cebuano";

#[derive(Debug, FromJson)]
pub struct Multiply {
    pub times: String,
    pub by: Option<String>,
}

/// `cubed` is optional, as in the TS interface (#1534): cebuano.jsonc declares `squared` only.
#[derive(Debug, FromJson)]
pub struct ExponentWords {
    pub squared: CountForms,
    pub cubed: Option<CountForms>,
    pub position: Option<PositionDecl>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub rate_denominators: IndexMap<String, String>,
    pub unit_per: String,
    pub magnitudes: Vec<String>,
    pub ampersand: String,
    pub multiply: Multiply,
    pub exponent_words: ExponentWords,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct CebuanoManifest {
    pub digraphs: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub special_words: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static CebuanoManifest, String> {
    static M: OnceLock<CebuanoManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "cebuano.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path (a `CebuanoPhonemizer`, whose constructor loads
/// it). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static CebuanoManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
