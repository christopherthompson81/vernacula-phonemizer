//! Slovak's hand-authored data tables, from `slovak.jsonc`, loaded once.
//! Ported from src/languages/slovak/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`); documentation keys the TS does not
//! read (`language`, `name`, `script`, `convention`) are ignored.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/slovak";

/// A magnitude noun's three count forms: sg (1), paucal (2–4), plural (5+).
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
pub struct Palatalisation {
    pub map: IndexMap<String, String>,
    pub triggers: Vec<String>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Voicing {
    pub to_voiceless: IndexMap<String, String>,
    pub to_voiced: IndexMap<String, String>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct SlovakManifest {
    pub vowels: IndexMap<String, String>,
    pub palatalisation: Palatalisation,
    pub consonants: IndexMap<String, String>,
    pub voicing: Voicing,
    pub clause_punctuation: IndexMap<String, String>,
    pub acronym_letters: Vec<String>,
    pub numbers: Numbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static SlovakManifest, String> {
    static M: OnceLock<SlovakManifest> = OnceLock::new();
    load_once(&M, || {
        let m: SlovakManifest = load_manifest(DIR, "slovak.jsonc").map_err(|e| e.to_string())?;
        validate(&m)?;
        Ok(m)
    })
}

/// The table lengths the TS indexes with a `!` (a short table would read `undefined` there and stringify it).
fn validate(m: &SlovakManifest) -> Result<(), String> {
    let n = &m.numbers;
    let need = [
        ("numbers.units", n.units.len(), 10),
        ("numbers.teens", n.teens.len(), 10),
        ("numbers.tens", n.tens.len(), 10),
        ("numbers.hundreds", n.hundreds.len(), 10),
    ];
    for (name, have, want) in need {
        if have < want {
            return Err(format!(
                "slovak.jsonc {name}: {have} entries, {want} needed"
            ));
        }
    }
    Ok(())
}

/// The manifest for code reached only through a checked path: a `SlovakPhonemizer` (whose constructor loads
/// it) or a `try_manifest` first. ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static SlovakManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.vowels["ä"], "æ");
        assert_eq!(m.palatalisation.map["l"], "ʎ");
        assert_eq!(m.palatalisation.triggers, ["i", "í", "e"]);
        assert_eq!(m.consonants["ľ"], "ʎ");
        assert_eq!(m.voicing.to_voiced["f"], "v");
        assert_eq!(m.numbers.magnitudes.million.plural, "miliónov");
        assert!(m.acronym_letters.iter().any(|a| a == "ai"));
    }
}
