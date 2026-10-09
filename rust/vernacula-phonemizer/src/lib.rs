//! vernacula-phonemizer: text in a language to canonical IPA.
//!
//! ```no_run
//! let ipa = vernacula_phonemizer::phonemize("I read a book", "en").unwrap();
//! ```
//!
//! A port of the TypeScript engine in `src/`, following `rust/PORTING.md`. The TypeScript is the
//! specification, and the goldens shared with `csharp/` are the definition of done. Data is read at runtime
//! from the repo's `data/` tree: `VERNACULA_DATA_DIR`, or `core::data_source::set_data_root`.
pub mod core;
pub mod languages;
pub mod registry;

pub use registry::{LANGUAGES, UnknownLanguage};

use core::js_string::JsString;

/// Phonemize `text` in `lang` to canonical IPA (synchronous). Errors for a language this build lacks.
pub fn phonemize(text: &str, lang: &str) -> Result<String, UnknownLanguage> {
    registry::phonemize_in(lang, &JsString::from(text)).map(|s| s.to_string_lossy())
}

/// Phonemize real-world text by the best available path: `phonemizeAsync`'s twin (synchronous here). For
/// English that is the BiLSTM OOV tagger; without a usable model it is exactly `phonemize`.
pub fn phonemize_best(text: &str, lang: &str) -> Result<String, UnknownLanguage> {
    registry::phonemize_best_in(lang, &JsString::from(text)).map(|s| s.to_string_lossy())
}

/// The reading plus the per-token trace (#1150): `ipa` is byte-identical to `phonemize`.
pub struct PhonemeTrace {
    pub ipa: String,
    pub trace: core::trace::Trace,
}

pub fn phonemize_trace(text: &str, lang: &str) -> Result<PhonemeTrace, UnknownLanguage> {
    let input = JsString::from(text);
    core::trace::start_trace(&input);
    match registry::phonemize_in(lang, &input) {
        Ok(ipa) => {
            let trace = core::trace::stop_trace(Some(&ipa));
            Ok(PhonemeTrace {
                ipa: ipa.to_string_lossy(),
                trace,
            })
        }
        Err(e) => {
            core::trace::stop_trace(None);
            Err(e)
        }
    }
}
