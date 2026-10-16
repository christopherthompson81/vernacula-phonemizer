//! Bavarian's hand-authored tables, from `bavarian.jsonc` (`BarDef`): digraphs, graphemes, clause punctuation and
//! the sourced ordinal stems. Ported from src/languages/bavarian/manifest.ts.
//!
//! Every field the TS interface names is REQUIRED (no `#[json(default)]`); the `numbers` block is numbers.rs's
//! own slice, as in the TS.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/bavarian";

/// `BarDef` (bavarian.ts).
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct BarDef {
    pub digraphs: IndexMap<String, String>,
    pub graphemes: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub ordinal_stems: IndexMap<String, String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static BarDef, String> {
    static M: OnceLock<BarDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "bavarian.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path (a `BavarianPhonemizer`, whose constructor loads
/// it). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static BarDef> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn manifest_loads_with_every_block() {
        let m = try_manifest().unwrap();
        assert_eq!(m.digraphs["ia"], "iɐ̯");
        assert_eq!(m.graphemes["ß"], "s");
        assert_eq!(m.ordinal_stems["20"], "zwanzigst");
    }
}
