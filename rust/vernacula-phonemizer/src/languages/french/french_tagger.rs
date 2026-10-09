//! The French OOV structural tagger: a per-grapheme BiLSTM emitting IPA chunks, lowercase + NFC in and no
//! postprocess. Ported from src/languages/french/frenchTagger.ts.

use std::sync::OnceLock;

use super::manifest::DIR;
use crate::core::data_source::load_once;
use crate::core::js_string::JsString;
use crate::core::provenance::{Form, normalize};
use crate::core::structural_tagger::{
    WordStructuralTagger, WordTaggerOptions, create_word_structural_tagger,
};

pub type FrenchTagger = WordStructuralTagger;

fn preprocess(w: &JsString) -> JsString {
    normalize(&w.to_lower_case(), Form::Nfc)
}

/// `createFrenchTagger(basename)`, or why it is unavailable.
pub fn create_french_tagger(basename: &str) -> Result<FrenchTagger, String> {
    create_word_structural_tagger(WordTaggerOptions {
        dir: DIR,
        basename: basename.to_string(),
        model_file: format!("{basename}.int8.onnx"),
        preprocess,
        postprocess: None,
    })
}

fn shipped() -> Result<&'static FrenchTagger, String> {
    static TAGGER: OnceLock<FrenchTagger> = OnceLock::new();
    load_once(&TAGGER, || create_french_tagger("fr-g2p-tagger"))
}

/// The shipped tagger, cached once built; `None` when its files are unreadable or its graph unsupported (the
/// best path then degrades to the sync engine, as the TS does without onnxruntime). A failure is retried.
pub fn french_tagger() -> Option<&'static FrenchTagger> {
    shipped().ok()
}

/// Why `french_tagger()` is `None`, if it is.
pub fn french_tagger_unavailable_reason() -> Option<String> {
    shipped().err()
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The shipped graph loads in the pure-Rust runtime: without it the best path silently serves the sync
    /// reading (the golden then fails on 43 of 200 rows).
    #[test]
    fn shipped_tagger_loads() {
        assert_eq!(french_tagger_unavailable_reason(), None);
        // An out-of-vocabulary code point declines the word rather than guessing.
        assert_eq!(french_tagger().unwrap().tag(&JsString::from("a☃b")).unwrap(), JsString::new());
    }
}
