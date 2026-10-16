//! Turkish's hand-authored facts, from `turkish.jsonc`. Ported from src/languages/turkish/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`) except the ones it marks optional;
//! documentation keys the TS does not read (`convention`, `provenance`, …) are ignored.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{CountForms, PositionDecl};

pub const DIR: &str = "languages/turkish";

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Vowels {
    pub ipa: IndexMap<String, String>,
    pub front: Vec<String>,
    pub front_unround: Vec<String>,
    pub back: Vec<String>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Numbers {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub scales: Vec<String>,
    pub hundred: String,
    pub zero: String,
    pub decimal_connector: String,
}

#[derive(Debug, FromJson)]
pub struct Phonotactics {
    pub vowels: String,
    pub onsets: Vec<String>,
    pub codas: Vec<String>,
}

#[derive(Debug, FromJson)]
pub struct Multiply {
    pub times: String,
    pub by: Option<String>,
}

/// ⚠ The TS interface types `position` as `"before" | "after"`, but the file says `"suffix"`, which the shared
/// tier accepts; the value is passed through, so the Rust type is the tier's own.
#[derive(Debug, FromJson)]
pub struct ExponentWords {
    pub squared: CountForms,
    pub cubed: CountForms,
    pub position: Option<PositionDecl>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct SymbolTier {
    pub multiply: Multiply,
    pub percent_prefix: bool,
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub exponent_words: ExponentWords,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct TurkishManifest {
    pub vowels: Vowels,
    pub circumflex_fold: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub geminate: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
    pub letter_names: IndexMap<String, String>,
    pub phonotactics: Phonotactics,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static TurkishManifest, String> {
    static M: OnceLock<TurkishManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "turkish.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path: a `TurkishPhonemizer` (whose constructor loads
/// it) or a `try_manifest` test first. ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static TurkishManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = try_manifest().unwrap();
        assert_eq!(m.numbers.ones.len(), 10);
        assert_eq!(m.numbers.scales.len(), 12); // "" … desilyon (10³³), #1523
        assert_eq!(m.vowels.ipa.len(), 8);
        assert_eq!(m.circumflex_fold.len(), 3);
        assert!(m.symbol_tier.percent_prefix);
        assert!(m.symbol_tier.exponent_words.position.is_some());
        assert_eq!(m.letter_names.len(), 29);
    }
}
