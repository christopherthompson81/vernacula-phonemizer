//! Latvian's hand-authored data tables, from `latvian.jsonc`: the vowel, long-vowel and consonant tables, the
//! voicing pairs, clause punctuation and the number words. Ported from src/languages/latvian/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED; documentation keys it does not read are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/latvian";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Voicing {
    pub to_voiceless: IndexMap<String, String>,
    pub to_voiced: IndexMap<String, String>,
}

/// A counted magnitude noun: singular after …1 (not …11), else the plural.
#[derive(Debug, Deserialize)]
pub struct OneMany {
    pub one: String,
    pub many: String,
}

#[derive(Debug, Deserialize)]
pub struct Numbers {
    pub units: Vec<String>,
    pub teens: Vec<String>,
    pub tens: Vec<String>,
    pub hundred: OneMany,
    pub thousand: OneMany,
    pub million: OneMany,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LatvianManifest {
    pub vowels: IndexMap<String, String>,
    pub long_vowels: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub consonant_digraphs: IndexMap<String, String>,
    pub voicing: Voicing,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static LatvianManifest, String> {
    static M: OnceLock<LatvianManifest> = OnceLock::new();
    load_once(&M, || {
        let m: LatvianManifest = load_manifest(DIR, "latvian.jsonc").map_err(|e| e.to_string())?;
        let n = &m.numbers;
        for (name, have) in [
            ("units", n.units.len()),
            ("teens", n.teens.len()),
            ("tens", n.tens.len()),
        ] {
            if have < 10 {
                return Err(format!(
                    "latvian.jsonc numbers.{name}: {have} entries, 10 needed"
                ));
            }
        }
        for k in ["i", "u"] {
            if !m.vowels.contains_key(k) {
                return Err(format!("latvian.jsonc vowels: no \"{k}\" (the offglides)"));
            }
        }
        Ok(m)
    })
}

/// ⚠ Crate-private: touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static LatvianManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.long_vowels["ō"], "oː");
        assert_eq!(m.consonant_digraphs["dž"], "d͡ʒ");
        assert_eq!(m.voicing.to_voiceless["ɟ"], "c");
        assert_eq!(m.numbers.thousand.one, "tūkstotis");
    }
}
