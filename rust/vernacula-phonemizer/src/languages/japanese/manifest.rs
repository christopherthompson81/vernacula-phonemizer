//! Japanese's hand-authored tables, from `japanese.jsonc`. Ported from src/languages/japanese/manifest.ts.
//!
//! Every field the TS interface (`JapaneseManifest`) names is REQUIRED here (no `#[serde(default)]`), down to
//! the symbol tier's `exponentWords.squared/cubed` and the four `bareExponent` words: those blocks have
//! ja-local structs with required fields, converted to the shared tier's all-optional types. Only the
//! fields the TS interface itself marks optional (`exponentWords.position`, `multiply.by`) are `Option`.
//! Maps keep the file's key order.

use std::collections::HashMap;
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::js_string::JsString;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{BareExponent, CountForms, ExponentWords, Multiply, PositionDecl};

pub const DIR: &str = "languages/japanese";

#[derive(Debug, Deserialize)]
pub struct NasalClass {
    pub onsets: String,
    pub nasal: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Numbers {
    pub ones: Vec<String>,
    pub hundreds: Vec<String>,
    pub thousands: Vec<String>,
    pub myriad_units: Vec<String>,
    pub ten: String,
    pub zero: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PitchStrip {
    pub particles: String,
    pub copula: Vec<String>,
    pub copula_final_particles: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JapaneseManifest {
    pub vowels: IndexMap<String, String>,
    pub mora: IndexMap<String, String>,
    pub youon_onset: IndexMap<String, String>,
    pub small_y: IndexMap<String, String>,
    pub foreign: IndexMap<String, String>,
    pub vowel_kana: IndexMap<String, String>,
    pub nasal_assimilation: Vec<NasalClass>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
    pub pitch_strip: PitchStrip,
    pub symbol_tier: SymbolTier,
}

/// The shared symbol tier's data (`symbolTier`), every field the TS interface requires.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub unspaced_script: bool,
    pub ampersand: String,
    pub multiply: Multiply,
    pub exponent_words: JaExponentWords,
    pub bare_exponent: JaBareExponent,
}

/// `exponentWords: { squared: CountForms; cubed: CountForms; position?: … }`.
#[derive(Debug, Deserialize)]
pub struct JaExponentWords {
    pub squared: CountForms,
    pub cubed: CountForms,
    pub position: Option<PositionDecl>,
}

/// `bareExponent: { squared: string; cubed: string; power: string; negative: string }`.
#[derive(Debug, Deserialize)]
pub struct JaBareExponent {
    pub squared: String,
    pub cubed: String,
    pub power: String,
    pub negative: String,
}

impl JaExponentWords {
    pub fn to_shared(&self) -> ExponentWords {
        ExponentWords {
            squared: Some(self.squared.clone()),
            cubed: Some(self.cubed.clone()),
            position: self.position.clone(),
        }
    }
}

impl JaBareExponent {
    pub fn to_shared(&self) -> BareExponent {
        BareExponent {
            squared: Some(self.squared.clone()),
            cubed: Some(self.cubed.clone()),
            power: Some(self.power.clone()),
            negative: Some(self.negative.clone()),
        }
    }
}

/// The manifest's string tables as `JsString` lookups, built once.
pub struct Tables {
    pub a: JsString,
    pub i: JsString,
    pub u: JsString,
    pub e: JsString,
    pub o: JsString,
    /// `Object.values(MANIFEST.vowels)`, in key order.
    pub vowel_values: Vec<JsString>,
    pub mora: HashMap<JsString, JsString>,
    pub youon_onset: HashMap<JsString, JsString>,
    pub small_y: HashMap<JsString, JsString>,
    pub foreign: HashMap<JsString, JsString>,
    pub vowel_kana: HashMap<JsString, JsString>,
    /// `nasalAssimilation`, in order: (onsets, nasal).
    pub nasal: Vec<(JsString, JsString)>,
    pub clause: HashMap<JsString, JsString>,
    pub ones: Vec<JsString>,
    pub hundreds: Vec<JsString>,
    pub thousands: Vec<JsString>,
    pub myriad_units: Vec<JsString>,
    pub ten: JsString,
    pub zero: JsString,
}

fn table(m: &IndexMap<String, String>) -> HashMap<JsString, JsString> {
    m.iter()
        .map(|(k, v)| (JsString::from(k.as_str()), JsString::from(v.as_str())))
        .collect()
}

fn list(v: &[String]) -> Vec<JsString> {
    v.iter().map(|s| JsString::from(s.as_str())).collect()
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static JapaneseManifest, String> {
    static M: OnceLock<JapaneseManifest> = OnceLock::new();
    super::load_once(&M, || {
        let m: JapaneseManifest =
            load_manifest(DIR, "japanese.jsonc").map_err(|e| e.to_string())?;
        for v in ["a", "i", "u", "e", "o"] {
            if !m.vowels.contains_key(v) {
                return Err(format!("japanese.jsonc: vowels.{v} missing"));
            }
        }
        Ok(m)
    })
}

/// The manifest for code that runs after `try_manifest` has succeeded (the registry's build checks it).
pub static MANIFEST: LazyLock<&'static JapaneseManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

pub static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*MANIFEST;
    let v = |k: &str| JsString::from(m.vowels[k].as_str());
    Tables {
        a: v("a"),
        i: v("i"),
        u: v("u"),
        e: v("e"),
        o: v("o"),
        vowel_values: m.vowels.values().map(|s| JsString::from(s.as_str())).collect(),
        mora: table(&m.mora),
        youon_onset: table(&m.youon_onset),
        small_y: table(&m.small_y),
        foreign: table(&m.foreign),
        vowel_kana: table(&m.vowel_kana),
        nasal: m
            .nasal_assimilation
            .iter()
            .map(|c| (JsString::from(c.onsets.as_str()), JsString::from(c.nasal.as_str())))
            .collect(),
        clause: table(&m.clause_punctuation),
        ones: list(&m.numbers.ones),
        hundreds: list(&m.numbers.hundreds),
        thousands: list(&m.numbers.thousands),
        myriad_units: list(&m.numbers.myriad_units),
        ten: JsString::from(m.numbers.ten.as_str()),
        zero: JsString::from(m.numbers.zero.as_str()),
    }
});

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.numbers.ones.len(), 10);
        assert_eq!(m.nasal_assimilation.len(), 3);
        assert_eq!(m.pitch_strip.copula.len(), 6);
        assert!(m.symbol_tier.units.contains_key("L"));
        assert_eq!(T.vowel_values.len(), 5);
    }
}
