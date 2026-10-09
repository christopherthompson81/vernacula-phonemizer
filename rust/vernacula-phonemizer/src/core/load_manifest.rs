//! A language's JSONC manifest, deserialized. Ported from src/core/loadManifest.ts.
//!
//! ⚠ A manifest key the struct does not name is silently dropped by serde, and a misspelt field silently
//! takes its default (C#'s ARPABET `AH`/`ER` lesson). Manifest structs use `#[serde(rename = "…")]` for any
//! key that is not the field name, and a test diffs the file's key set against the struct's.

use super::data_path::data_file;
use super::data_source::read_data_text;
use super::jsonc::parse_jsonc;

#[derive(Debug)]
pub struct ManifestError(pub String);

impl std::fmt::Display for ManifestError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str(&self.0)
    }
}

impl std::error::Error for ManifestError {}

pub fn load_manifest<T: serde::de::DeserializeOwned>(
    dir: &str,
    filename: &str,
) -> Result<T, ManifestError> {
    let key = data_file(dir, filename);
    let text = read_data_text(&key).map_err(|e| ManifestError(e.to_string()))?;
    parse_jsonc(&text).map_err(|e| ManifestError(format!("{key}: {e}")))
}

pub fn load_json<T: serde::de::DeserializeOwned>(
    dir: &str,
    filename: &str,
) -> Result<T, ManifestError> {
    let key = data_file(dir, filename);
    let text = read_data_text(&key).map_err(|e| ManifestError(e.to_string()))?;
    serde_json::from_str(&text).map_err(|e| ManifestError(format!("{key}: {e}")))
}
