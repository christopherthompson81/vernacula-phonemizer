//! Xhosa's hand-authored tables, from `xhosa.jsonc`, read through the Zulu manifest's shape (the same rule table,
//! tone map, clause punctuation and number-word layout, with Xhosa's data).
//! Ported from src/languages/xhosa/manifest.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::languages::zulu::manifest::ZuluManifest;

pub const DIR: &str = "languages/xhosa";

pub type XhosaManifest = ZuluManifest;

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static XhosaManifest, String> {
    static M: OnceLock<XhosaManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "xhosa.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path. ⚠ Crate-private: touching it unchecked panics.
pub(crate) static MANIFEST: LazyLock<&'static XhosaManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));
