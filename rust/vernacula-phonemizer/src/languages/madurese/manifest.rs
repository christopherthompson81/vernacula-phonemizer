//! Madurese's hand-authored tables, from `madurese.jsonc`: the consonant register classes, the vowel low/high pairs,
//! final devoicing, clause punctuation and the number words; plus the one orthography table built from them.
//! Ported from src/languages/madurese/manifest.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, js};
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/madurese";

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Numbers {
    pub units: Vec<String>,
    pub ten: String,
    pub tens: String,
    pub hundred: String,
    pub thousand: String,
    pub million: String,
    pub billion: String,
    pub trillion: String,
    pub and: String,
    pub decimal_word: String,
}

/// `MadureseManifest`.
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct MadureseManifest {
    pub language: String,
    pub name: String,
    pub script: Vec<String>,
    pub raise_cons: IndexMap<String, String>,
    pub low_cons: IndexMap<String, String>,
    pub transp_cons: IndexMap<String, String>,
    pub vowel_spec: IndexMap<String, (String, String)>,
    pub final_devoice: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
}

pub fn try_manifest() -> Result<&'static MadureseManifest, String> {
    static M: OnceLock<MadureseManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "madurese.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code that runs after `try_manifest` has succeeded (`create_madurese` checks it first).
pub static MANIFEST: LazyLock<&'static MadureseManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Reg {
    Raise,
    Low,
    Transp,
}

#[derive(Debug, Clone)]
pub struct Cons {
    pub ipa: JsString,
    pub reg: Reg,
}

/// `CONS`: raise, then low, then transparent, as a JS `Map` (a later duplicate key keeps the first position).
pub static CONS: LazyLock<IndexMap<JsString, Cons>> = LazyLock::new(|| {
    let mut m = IndexMap::new();
    for (table, reg) in [
        (&MANIFEST.raise_cons, Reg::Raise),
        (&MANIFEST.low_cons, Reg::Low),
        (&MANIFEST.transp_cons, Reg::Transp),
    ] {
        for (k, v) in table {
            m.insert(js(k), Cons { ipa: js(v), reg });
        }
    }
    m
});

/// `CONS_KEYS`: longest first, by UTF-16 length; the sort is stable, as JS's is.
pub static CONS_KEYS: LazyLock<Vec<JsString>> = LazyLock::new(|| {
    let mut keys: Vec<JsString> = CONS.keys().cloned().collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.len()));
    keys
});

/// `VOWEL_KEYS`: the vowel table's keys, longest first.
pub static VOWEL_KEYS: LazyLock<Vec<JsString>> = LazyLock::new(|| {
    let mut keys: Vec<JsString> = MANIFEST.vowel_spec.keys().map(|k| js(k)).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.len()));
    keys
});
