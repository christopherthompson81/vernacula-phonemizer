//! Data KEYS: a module's data file is `<module dir under src/>/<filename>`, the same string every engine
//! resolves. Ported from src/core/dataPath.ts — see that file for why keys are not paths.
//!
//! Rust has no `import.meta.url`, so a module names its own directory key: `data_file("languages/thai", …)`.

/// The key for `filename` in the data directory `dir`. An empty `dir` (a module directly in `src/`)
/// yields the bare filename, never a leading slash.
pub fn data_file(dir: &str, filename: &str) -> String {
    if dir.is_empty() {
        filename.to_string()
    } else {
        format!("{dir}/{filename}")
    }
}
