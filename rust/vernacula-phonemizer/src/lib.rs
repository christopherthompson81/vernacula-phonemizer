//! vernacula-phonemizer: text in a language to canonical IPA.
//!
//! A port of the TypeScript engine in `src/`, following `rust/PORTING.md`. The TypeScript is the
//! specification; the goldens shared with `csharp/` are the definition of done.
pub mod core;
pub mod languages;
