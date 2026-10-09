//! The shared native-abugida phonology tables (place of articulation, homorganic nasal), loaded once from
//! `core/phonology.jsonc`. Ported from src/core/phonology.ts — see that file for the corpus evidence.

use std::sync::OnceLock;

use indexmap::IndexMap;
use serde::Deserialize;

use super::data_path::data_file;
use super::data_source::{load_once, read_data_text};
use super::jsonc::parse_jsonc;

/// Both tables keep the file's key order: `placeOfArticulation` is sorted by key length with a STABLE
/// sort, so ties fall back to declaration order.
#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Phonology {
    pub place_of_articulation: IndexMap<String, String>,
    pub homorganic_nasal: IndexMap<String, String>,
}

/// `loadSharedPhonology()`: memoized on success only (a failed load is retried on the next call).
pub fn load_shared_phonology() -> Result<&'static Phonology, String> {
    static CACHED: OnceLock<Phonology> = OnceLock::new();
    load_once(&CACHED, || {
        let key = data_file("core", "phonology.jsonc");
        let text = read_data_text(&key).map_err(|e| e.to_string())?;
        parse_jsonc(&text).map_err(|e| format!("{key}: {e}"))
    })
}
