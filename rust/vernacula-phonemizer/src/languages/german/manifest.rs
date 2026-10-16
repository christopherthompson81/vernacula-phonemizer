//! German's hand-authored facts, from `german.jsonc`. Ported from src/languages/german/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`); documentation keys the TS does not
//! read (`convention`, `provenance`, …) are ignored.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{CountForms, PositionDecl};

pub const DIR: &str = "languages/german";

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Ordinals {
    pub irregular_stems: IndexMap<String, String>,
    pub suffix_below20: String,
    pub suffix_from20: String,
}

#[derive(Debug, FromJson)]
pub struct Phonotactics {
    pub vowels: String,
    pub onsets: Vec<String>,
    pub codas: Vec<String>,
    pub digraphs: Vec<String>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Vowels {
    pub long: IndexMap<String, String>,
    pub short: IndexMap<String, String>,
    pub long_of: IndexMap<String, String>,
    pub short_of: IndexMap<String, String>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Morphology {
    pub prefix_unstressed: Vec<String>,
    pub prefix_stressed: Vec<String>,
    pub suffixes: Vec<String>,
    pub vowel_initial_suffixes: Vec<String>,
    pub ambiguous_prefixes: Vec<String>,
    pub linking_elements: Vec<String>,
    pub valid_onsets: Vec<String>,
    pub prefix_ipa: IndexMap<String, String>,
    pub suffix_ipa: IndexMap<String, String>,
    pub st_keep_words: Vec<String>,
}

#[derive(Debug, FromJson)]
pub struct Million {
    pub sg: String,
    pub pl: String,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Numbers {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub compound_one: String,
    pub connector: String,
    pub hundred: String,
    pub thousand: String,
    pub million: Million,
}

#[derive(Debug, FromJson)]
pub struct Multiply {
    pub times: String,
    pub by: Option<String>,
}

/// ⚠ The TS interface types `position` as `"before" | "after"`, but the file says `"compound"`, which the
/// shared tier accepts; the value is passed through, so the Rust type is the tier's own.
#[derive(Debug, FromJson)]
pub struct ExponentWords {
    pub squared: CountForms,
    pub cubed: CountForms,
    pub position: Option<PositionDecl>,
}

#[derive(Debug, FromJson)]
pub struct BareExponent {
    pub squared: String,
    pub cubed: String,
    pub power: String,
    pub negative: String,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub magnitudes: Vec<String>,
    pub ampersand: String,
    pub multiply: Multiply,
    pub exponent_words: ExponentWords,
    pub bare_exponent: BareExponent,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct GermanManifest {
    pub months: Vec<String>,
    pub ordinal_nouns: Vec<String>,
    pub weak_en: Vec<String>,
    pub ordinal_licensers_extra: Vec<String>,
    pub ordinals: Ordinals,
    pub dotted_abbrev: IndexMap<String, String>,
    pub dotted_abbrev_one: IndexMap<String, String>,
    pub letter_names: IndexMap<String, String>,
    pub phonotactics: Phonotactics,
    pub measure_stems: Vec<String>,
    pub acronym_letters: Vec<String>,
    pub vowel_chars: String,
    pub vowels: Vowels,
    pub consonants: IndexMap<String, String>,
    pub voiced_final: IndexMap<String, String>,
    pub short_monosyllables: Vec<String>,
    pub long_ch: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub morphology: Morphology,
    pub numbers: Numbers,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static GermanManifest, String> {
    static M: OnceLock<GermanManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "german.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path: a `GermanPhonemizer` (whose constructor loads
/// it) or a `try_manifest` test first. ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static GermanManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.numbers.ones.len(), 20);
        assert_eq!(m.numbers.million.sg, "eine Million");
        assert_eq!(m.ordinals.irregular_stems["1"], "erst");
        assert_eq!(m.morphology.prefix_ipa["ver"], "fɛɐ̯");
        assert!(m.symbol_tier.exponent_words.position.is_some());
        assert_eq!(m.letter_names["y"], "üpsilon");
    }
}
