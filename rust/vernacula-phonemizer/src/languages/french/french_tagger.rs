//! The French OOV structural tagger: a per-grapheme BiLSTM emitting IPA chunks, lowercase + NFC in and no
//! postprocess. Ported from src/languages/french/frenchTagger.ts.

use std::sync::OnceLock;

use super::manifest::DIR;
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

static TAGGER: OnceLock<Result<FrenchTagger, String>> = OnceLock::new();

fn shipped() -> &'static Result<FrenchTagger, String> {
    TAGGER.get_or_init(|| create_french_tagger("fr-g2p-tagger"))
}

/// The shipped tagger, built once; `None` when its files are unreadable or its graph unsupported (the best
/// path then degrades to the sync engine, as the TS does without onnxruntime).
pub fn french_tagger() -> Option<&'static FrenchTagger> {
    shipped().as_ref().ok()
}

/// Why `french_tagger()` is `None`, if it is.
pub fn french_tagger_unavailable_reason() -> Option<String> {
    shipped().as_ref().err().cloned()
}
