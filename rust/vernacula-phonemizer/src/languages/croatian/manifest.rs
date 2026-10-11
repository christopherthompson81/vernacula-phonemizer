//! Croatian's data manifest (`croatian.jsonc`): the cardinal number words (tisuća/milijun/dvjesto, the
//! Serbian table's shape) and clause punctuation. Ported from src/languages/croatian/manifest.ts.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::languages::serbian::manifest::{SlavicNumbers, validate_numbers};

pub const DIR: &str = "languages/croatian";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CroatianManifest {
    pub language: String,
    pub name: String,
    pub script: Vec<String>,
    pub numbers: SlavicNumbers,
    pub clause_punctuation: IndexMap<String, String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static CroatianManifest, String> {
    static M: OnceLock<CroatianManifest> = OnceLock::new();
    load_once(&M, || {
        let m: CroatianManifest =
            load_manifest(DIR, "croatian.jsonc").map_err(|e| e.to_string())?;
        validate_numbers("croatian.jsonc", &m.numbers)?;
        Ok(m)
    })
}

/// ⚠ Crate-private: touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static CroatianManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = &*MANIFEST;
        assert_eq!(m.language, "hr");
        assert_eq!(m.numbers.thousand.standalone.as_deref(), Some("tisuću"));
        assert_eq!(m.numbers.thousand.two_feminine.as_deref(), Some("dvije"));
        assert_eq!(m.numbers.hundreds[2], "dvjesto");
        assert_eq!(m.clause_punctuation[":"], ",");
    }
}
