//! English's hand-authored facts, from `english.jsonc`. Ported from src/languages/english/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED here (no `#[serde(default)]`), so a missing or misspelt key
//! fails the load instead of reading as empty. Keys the TS does not read (`convention`, `models`, …) are
//! documentation and are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::english_arpabet::ArpabetDef;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/english";

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BeforeAlternative {
    pub tags: Option<Vec<String>>,
    pub next_tags: Option<Vec<String>>,
    pub after_words: Option<Vec<String>>,
}

/// The reading a `before` condition selects. An unknown slot fails the manifest load (`PhonemizeError::Data`),
/// where the TS would set a property nothing reads.
#[derive(Debug, Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Slot {
    Verb,
    Noun,
    Past,
    Adj,
}

#[derive(Debug, Deserialize, Clone)]
pub struct BeforeCondition {
    pub word: String,
    pub when: Vec<BeforeAlternative>,
    pub slot: Slot,
}

#[derive(Debug, Deserialize, Clone)]
pub struct HeteronymEntry {
    pub default: String,
    pub verb: Option<String>,
    pub noun: Option<String>,
    pub past: Option<String>,
    pub adj: Option<String>,
    pub before: Option<BeforeCondition>,
}

#[derive(Debug, Deserialize)]
pub struct Numbers {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub hundred: String,
    pub scale: Vec<String>,
    pub ordinals: IndexMap<String, String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct G2pClasses {
    pub vowel_letters: Vec<String>,
    pub voiceless: Vec<String>,
    pub sibilants: Vec<String>,
    pub stop_pieces: Vec<String>,
    pub stem_stress_prefixes: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct Phonotactics {
    pub vowels: String,
    pub onsets: Vec<String>,
    pub codas: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnglishManifest {
    pub heteronyms: IndexMap<String, HeteronymEntry>,
    pub acronym_letters: Vec<String>,
    pub unstressed_words: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub non_tonic_final: Vec<String>,
    pub wh_secondary: Vec<String>,
    pub clause_initial_stressed: IndexMap<String, String>,
    pub arpabet: ArpabetDef,
    pub numbers: Numbers,
    pub g2p_classes: G2pClasses,
    pub letter_name_exceptions: IndexMap<String, String>,
    pub phonotactics: Phonotactics,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static EnglishManifest, String> {
    static M: OnceLock<EnglishManifest> = OnceLock::new();
    crate::core::data_source::load_once(&M, || {
        load_manifest(DIR, "english.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code that runs only after `create_english` has succeeded (which checks it first).
pub static MANIFEST: LazyLock<&'static EnglishManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert!(m.heteronyms.contains_key("absent"));
        // The ARPABET block is keyed in capitals; C#'s naming policy once dropped these silently.
        assert!(!m.arpabet.conditional_vowels.ah.unstressed.is_empty());
        assert!(!m.arpabet.conditional_vowels.uw.default.is_empty());
        assert_eq!(m.numbers.ones.len(), 20);
    }
}
