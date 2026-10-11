//! Serbian's hand-authored data tables, from `serbian.jsonc`: the Latin digraphs, the letter table (both
//! scripts), clause punctuation and the number words. Ported from src/languages/serbian/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED except the ones it marks optional; documentation keys the TS
//! does not read (`language`, `name`, `script`, `provenance`, `convention`) are ignored.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/serbian";

/// `SlavicMagnitude`: a magnitude noun's count forms, and (on a feminine noun) the multiplier's 1/2.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlavicMagnitude {
    pub standalone: Option<String>,
    pub one: String,
    pub few: Option<String>,
    pub many: String,
    pub one_feminine: Option<String>,
    pub two_feminine: Option<String>,
}

/// The number-word table: the same shape in all three standards (Croatian and Bosnian carry their own words).
#[derive(Debug, Clone, Deserialize)]
pub struct SlavicNumbers {
    pub units: Vec<String>,
    pub teens: Vec<String>,
    pub tens: Vec<String>,
    pub hundreds: Vec<String>,
    pub thousand: SlavicMagnitude,
    pub million: SlavicMagnitude,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SerbianManifest {
    pub acronym_letters: Vec<String>,
    pub digraphs: IndexMap<String, String>,
    pub letters: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: SlavicNumbers,
}

/// The table lengths the compositor indexes with a `!`, checked for any of the three standards' tables, and
/// the thousand's `standalone!`.
pub(crate) fn validate_numbers(file: &str, n: &SlavicNumbers) -> Result<(), String> {
    for (name, have, want) in [
        ("units", n.units.len(), 10),
        ("teens", n.teens.len(), 10),
        ("tens", n.tens.len(), 10),
        ("hundreds", n.hundreds.len(), 10),
    ] {
        if have < want {
            return Err(format!(
                "{file} numbers.{name}: {have} entries, {want} needed"
            ));
        }
    }
    if n.thousand.standalone.is_none() {
        return Err(format!("{file} numbers.thousand.standalone: missing"));
    }
    Ok(())
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static SerbianManifest, String> {
    static M: OnceLock<SerbianManifest> = OnceLock::new();
    load_once(&M, || {
        let m: SerbianManifest = load_manifest(DIR, "serbian.jsonc").map_err(|e| e.to_string())?;
        validate_numbers("serbian.jsonc", &m.numbers)?;
        Ok(m)
    })
}

/// The manifest for code reached only through a checked path. ⚠ Crate-private: touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static SerbianManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.digraphs["lj"], "ʎ");
        assert_eq!(m.letters["ђ"], "d͡ʑ");
        assert_eq!(m.letters["đ"], "d͡ʑ");
        assert_eq!(m.numbers.thousand.standalone.as_deref(), Some("hiljadu"));
        assert!(m.numbers.million.one_feminine.is_none());
        assert!(m.acronym_letters.iter().any(|a| a == "sssr"));
    }
}
