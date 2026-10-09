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

pub use registry::{LANGUAGES, PhonemizeError, tagger_unavailable_reason};

use core::js_string::JsString;

/// Phonemize `text` in `lang` to canonical IPA (synchronous). Errors for a language this build lacks, or
/// when that language's data cannot be loaded.
pub fn phonemize(text: &str, lang: &str) -> Result<String, PhonemizeError> {
    registry::phonemize_in(lang, &JsString::from(text)).map(|s| s.to_string_lossy())
}

/// Phonemize real-world text by the best available path: `phonemizeAsync`'s twin (synchronous here). For
/// English that is the BiLSTM OOV tagger; without a usable model it is exactly `phonemize`.
pub fn phonemize_best(text: &str, lang: &str) -> Result<String, PhonemizeError> {
    registry::phonemize_best_in(lang, &JsString::from(text)).map(|s| s.to_string_lossy())
}

/// The reading plus the per-token trace (#1150): `ipa` is byte-identical to `phonemize`.
pub struct PhonemeTrace {
    pub ipa: String,
    pub trace: core::trace::Trace,
}

pub fn phonemize_trace(text: &str, lang: &str) -> Result<PhonemeTrace, PhonemizeError> {
    let (ipa, trace) = phonemize_trace_js(&JsString::from(text), lang)?;
    Ok(PhonemeTrace {
        ipa: ipa.to_string_lossy(),
        trace,
    })
}

/// `phonemize_trace` on a `JsString`, which can carry what a `&str` cannot (a lone surrogate half).
pub fn phonemize_trace_js(
    input: &JsString,
    lang: &str,
) -> Result<(JsString, core::trace::Trace), PhonemizeError> {
    /// Clears the thread's recording if the engine unwinds, as the TS `finally` does; a panic caught by the
    /// caller must not leave a recording that every later `phonemize` on this thread feeds.
    struct Clear(bool);
    impl Drop for Clear {
        fn drop(&mut self) {
            if self.0 {
                core::trace::stop_trace(None);
            }
        }
    }
    core::trace::start_trace(input);
    let mut guard = Clear(true);
    let result = registry::phonemize_in(lang, input);
    guard.0 = false;
    match result {
        Ok(ipa) => {
            let trace = core::trace::stop_trace(Some(&ipa));
            Ok((ipa, trace))
        }
        Err(e) => {
            core::trace::stop_trace(None);
            Err(e)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn unknown_language_is_an_error_not_a_panic() {
        assert_eq!(
            phonemize("x", "xx-unported"),
            Err(PhonemizeError::UnknownLanguage("xx-unported".into()))
        );
        assert_eq!(
            phonemize_best("x", "xx-unported"),
            Err(PhonemizeError::UnknownLanguage("xx-unported".into()))
        );
    }
}
