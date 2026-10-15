//! The Bengali OOV structural tagger: a per-grapheme BiLSTM emitting IPA chunks, NFC in, no postprocess.
//! Ported from src/languages/bengali/bengaliTagger.ts — see that file for the corpus evidence.

use std::sync::OnceLock;

use super::manifest::DIR;
use crate::core::data_source::load_once;
use crate::core::js_string::JsString;
use crate::core::provenance::{Form, normalize};
use crate::core::structural_tagger::{
    WordStructuralTagger, WordTaggerOptions, create_word_structural_tagger,
};

pub type BengaliTagger = WordStructuralTagger;

fn preprocess(w: &JsString) -> JsString {
    normalize(w, Form::Nfc)
}

/// `createBengaliTagger(basename)`, or why it is unavailable.
pub fn create_bengali_tagger(basename: &str) -> Result<BengaliTagger, String> {
    create_word_structural_tagger(WordTaggerOptions {
        dir: DIR,
        basename: basename.to_string(),
        model_file: format!("{basename}.int8.onnx"),
        preprocess,
        postprocess: None,
    })
}

fn shipped() -> Result<&'static BengaliTagger, String> {
    static TAGGER: OnceLock<BengaliTagger> = OnceLock::new();
    load_once(&TAGGER, || create_bengali_tagger("bn-g2p-tagger"))
}

/// The shipped tagger, cached once built; `None` when its files are unreadable or its graph unsupported (the
/// best path then degrades to the sync engine, as the TS does without onnxruntime). A failure is retried.
pub fn bengali_tagger() -> Option<&'static BengaliTagger> {
    shipped().ok()
}

/// Why `bengali_tagger()` is `None`, if it is.
pub fn bengali_tagger_unavailable_reason() -> Option<String> {
    shipped().err()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::js_string::js;

    /// The shipped graph loads in the pure-Rust runtime: without it the best path silently serves the sync reading.
    #[test]
    fn shipped_tagger_loads() {
        assert_eq!(bengali_tagger_unavailable_reason(), None);
        assert_eq!(
            bengali_tagger().unwrap().tag(&js("мир")).unwrap(),
            JsString::new()
        );
    }
}
