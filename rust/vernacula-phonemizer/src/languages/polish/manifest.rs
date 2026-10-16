//! Polish's hand-authored data tables, from `polish.jsonc`, loaded once.
//! Ported from src/languages/polish/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`); documentation keys the TS does not
//! read (`language`, `name`, `script`, `provenance`) are ignored.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
pub use crate::core::normalize_symbols::CountForms;
use crate::core::normalize_symbols::{ExponentWords, Multiply};

pub const DIR: &str = "languages/polish";

/// A Slavic magnitude noun's three count forms: sg (1), paucal (2–4), gen-pl (5+ / 11–14).
#[derive(Debug, FromJson)]
pub struct Agreement {
    pub sg: String,
    pub paucal: String,
    pub plural: String,
}

#[derive(Debug, FromJson)]
pub struct Magnitudes {
    pub thousand: Agreement,
    pub million: Agreement,
    pub billion: Agreement,
}

#[derive(Debug, FromJson)]
pub struct Numbers {
    pub units: Vec<String>,
    pub teens: Vec<String>,
    pub tens: Vec<String>,
    pub hundreds: Vec<String>,
    pub magnitudes: Magnitudes,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Voicing {
    pub to_voiceless: IndexMap<String, String>,
    pub to_voiced: IndexMap<String, String>,
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
    pub units: IndexMap<String, CountForms>,
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub magnitudes: Vec<String>,
    pub ampersand: String,
    pub multiply: Multiply,
    pub exponent_words: ExponentWords,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct PolishManifest {
    pub vowels: IndexMap<String, String>,
    pub nasal_vowels: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub digraphs: IndexMap<String, String>,
    pub soft_i: IndexMap<String, String>,
    pub voicing: Voicing,
    pub clause_punctuation: IndexMap<String, String>,
    pub acronym_letters: Vec<String>,
    pub numbers: Numbers,
    pub letter_names: IndexMap<String, String>,
    pub phonotactics: Phonotactics,
    pub decimal_word: String,
    pub symbol_tier: SymbolTier,
    pub roman_ordinals: Vec<String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static PolishManifest, String> {
    static M: OnceLock<PolishManifest> = OnceLock::new();
    load_once(&M, || {
        let m: PolishManifest = load_manifest(DIR, "polish.jsonc").map_err(|e| e.to_string())?;
        validate(&m)?;
        Ok(m)
    })
}

/// The table lengths the TS indexes with a `!` (a short table would read `undefined` there and stringify it).
fn validate(m: &PolishManifest) -> Result<(), String> {
    let n = &m.numbers;
    let need = [
        ("numbers.units", n.units.len(), 10),
        ("numbers.teens", n.teens.len(), 10),
        ("numbers.tens", n.tens.len(), 10),
        ("numbers.hundreds", n.hundreds.len(), 10),
        ("romanOrdinals", m.roman_ordinals.len(), 20),
    ];
    for (name, have, want) in need {
        if have < want {
            return Err(format!(
                "polish.jsonc {name}: {have} entries, {want} needed"
            ));
        }
    }
    Ok(())
}

/// The manifest for code reached only through a checked path: a `PolishPhonemizer` (whose constructor loads
/// it) or a `try_manifest` first. ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static PolishManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.vowels["y"], "ɨ");
        assert_eq!(m.digraphs["rz"], "ʐ");
        assert_eq!(m.voicing.to_voiced["x"], "ɣ");
        assert_eq!(m.numbers.magnitudes.thousand.paucal, "tysiące");
        assert_eq!(m.roman_ordinals.len(), 20);
        assert_eq!(m.decimal_word, "przecinek");
        assert!(
            m.symbol_tier.currency.contains_key("PLN") && m.symbol_tier.units.contains_key("km")
        );
    }
}
