//! The consolidated Icelandic data tables (`icelandic.jsonc`) as `IcelandicDef`, loaded once.
//! Ported from src/languages/icelandic/manifest.ts.

use std::sync::{LazyLock, OnceLock};

use super::icelandic::IcelandicDef;
use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;

pub const DIR: &str = "languages/icelandic";

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static IcelandicDef, String> {
    static M: OnceLock<IcelandicDef> = OnceLock::new();
    load_once(&M, || {
        let d: IcelandicDef = load_manifest(DIR, "icelandic.jsonc").map_err(|e| e.to_string())?;
        // The scan indexes `G[c]!` for every geminate stop and collapsing double; a missing one would make the
        // TS build an `undefined` phone. Refused here rather than reproduced.
        for c in ["p", "t", "k", "b", "d", "g"]
            .iter()
            .copied()
            .chain(d.collapsing_doubles.iter().map(|s| s.as_str()))
        {
            if !d.graphemes.contains_key(c) {
                return Err(format!("icelandic.jsonc graphemes: no \"{c}\""));
            }
        }
        Ok(d)
    })
}

/// The manifest for code reached only through a checked path (an `IcelandicPhonemizer`, whose constructor
/// loads it). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static IcelandicDef> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
