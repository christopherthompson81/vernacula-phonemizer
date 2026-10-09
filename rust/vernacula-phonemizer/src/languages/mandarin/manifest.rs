//! Mandarin's hand-authored tables, from `cmn.jsonc`: tones, sandhi, clause punctuation, measure words, the
//! number-reading tables, letter names and the shared symbol tier's data.
//! Ported from src/languages/mandarin/manifest.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{
    BareExponent, CountForms, ExponentPosition, ExponentWords, Multiply, PositionDecl,
};

pub const DIR: &str = "languages/mandarin";

#[derive(Debug, Deserialize)]
pub struct ThirdThird {
    pub from: String,
    pub before: String,
    pub to: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Sandhi {
    pub third_third: ThirdThird,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Numbers {
    pub digits: Vec<String>,
    pub positions: Vec<String>,
    pub big_units: Vec<String>,
    pub two: String,
    pub decimal_point: String,
    pub zero_digit: String,
}

/// `exponentWords: { squared; cubed; position? }`. ⚠ The TS interface types `position` as `"before" | "after"`,
/// but cmn.jsonc says `"compound"`, which the shared tier reads; the jsonc is untyped at runtime, so the data wins.
#[derive(Debug, Deserialize)]
pub struct CmnExponentWords {
    pub squared: CountForms,
    pub cubed: CountForms,
    pub position: Option<ExponentPosition>,
}

#[derive(Debug, Deserialize)]
pub struct CmnBareExponent {
    pub squared: String,
    pub cubed: String,
    pub power: String,
    pub negative: String,
}

/// The shared symbol tier's data (`symbolTier`): the nine fields the TS interface names, which are exactly the
/// nine mandarin.ts passes to `makeSymbolNormalizer`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub magnitudes: Vec<String>,
    pub unspaced_script: bool,
    pub percent_prefix: bool,
    pub multiply: Multiply,
    pub exponent_words: CmnExponentWords,
    pub bare_exponent: CmnBareExponent,
}

impl CmnExponentWords {
    pub fn to_shared(&self) -> ExponentWords {
        ExponentWords {
            squared: Some(self.squared.clone()),
            cubed: Some(self.cubed.clone()),
            position: self.position.map(PositionDecl::All),
        }
    }
}

impl CmnBareExponent {
    pub fn to_shared(&self) -> BareExponent {
        BareExponent {
            squared: Some(self.squared.clone()),
            cubed: Some(self.cubed.clone()),
            power: Some(self.power.clone()),
            negative: Some(self.negative.clone()),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CmnManifest {
    /// Keyed "1".."5".
    pub tones: IndexMap<String, String>,
    pub sandhi: Sandhi,
    pub clause_punctuation: IndexMap<String, String>,
    pub measure_words: String,
    pub numbers: Numbers,
    /// ⚠ Keyed by UPPERCASE Latin, exactly as written in the jsonc.
    pub letter_names: IndexMap<String, String>,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static CmnManifest, String> {
    static M: OnceLock<CmnManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "cmn.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code that runs after `try_manifest` has succeeded (`create_mandarin` checks it first).
pub static MANIFEST: LazyLock<&'static CmnManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.tones.get("3").map(String::as_str), Some("˨˩˦"));
        assert_eq!(m.numbers.digits.len(), 10);
        assert_eq!(m.numbers.big_units.len(), 4);
        assert_eq!(m.letter_names.get("W").map(String::as_str), Some("大布留"));
        assert_eq!(
            m.clause_punctuation.get("。").map(String::as_str),
            Some(".")
        );
        assert!(m.symbol_tier.units.contains_key("km"));
        assert_eq!(
            m.symbol_tier.exponent_words.position,
            Some(ExponentPosition::Compound)
        );
    }
}
