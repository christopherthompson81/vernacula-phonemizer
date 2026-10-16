//! Slovenian's hand-authored data tables, from `slovenian.jsonc`: the vowel and consonant tables, the voicing
//! pairs, clause punctuation, the acronym list and the number words. Ported from
//! src/languages/slovenian/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED; documentation keys it does not read are ignored.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/slovenian";

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Voicing {
    pub to_voiceless: IndexMap<String, String>,
    pub to_voiced: IndexMap<String, String>,
}

/// A magnitude noun's gender and its four count forms.
#[derive(Debug, FromJson)]
pub struct Magnitude {
    pub gender: String,
    pub sg: String,
    pub dual: String,
    pub paucal: String,
    pub plural: String,
}

#[derive(Debug, FromJson)]
pub struct Magnitudes {
    pub million: Magnitude,
    pub milliard: Magnitude,
}

#[derive(Debug, FromJson)]
pub struct CountFormsByGender {
    pub m: IndexMap<String, String>,
    pub f: IndexMap<String, String>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Numbers {
    pub units: Vec<String>,
    pub teens: Vec<String>,
    pub tens: Vec<String>,
    pub hundreds: Vec<String>,
    pub and: String,
    pub thousand: String,
    pub decimal_word: String,
    pub count_forms: CountFormsByGender,
    pub magnitudes: Magnitudes,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct SlovenianManifest {
    pub vowels: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub voicing: Voicing,
    pub clause_punctuation: IndexMap<String, String>,
    pub acronym_letters: Vec<String>,
    pub numbers: Numbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static SlovenianManifest, String> {
    static M: OnceLock<SlovenianManifest> = OnceLock::new();
    load_once(&M, || {
        let m: SlovenianManifest =
            load_manifest(DIR, "slovenian.jsonc").map_err(|e| e.to_string())?;
        let n = &m.numbers;
        for (name, have) in [
            ("units", n.units.len()),
            ("teens", n.teens.len()),
            ("tens", n.tens.len()),
            ("hundreds", n.hundreds.len()),
        ] {
            if have < 10 {
                return Err(format!(
                    "slovenian.jsonc numbers.{name}: {have} entries, 10 needed"
                ));
            }
        }
        Ok(m)
    })
}

/// ⚠ Crate-private: touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static SlovenianManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.vowels["y"], "i");
        assert_eq!(m.voicing.to_voiceless["d͡ʒ"], "t͡ʃ");
        assert_eq!(m.numbers.count_forms.f["2"], "dve");
        assert_eq!(m.numbers.magnitudes.milliard.gender, "f");
        assert_eq!(m.numbers.decimal_word, "vejica");
    }
}
