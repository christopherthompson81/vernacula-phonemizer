//! The Afrikaans OOV structural tagger: a per-grapheme BiLSTM emitting IPA chunks, lowercase + NFC in and no
//! postprocess. Ported from src/languages/afrikaans/afrikaansTagger.ts.

use std::sync::OnceLock;

use super::manifest::DIR;
use crate::core::data_source::load_once;
use crate::core::js_string::JsString;
use crate::core::provenance::{Form, normalize};
use crate::core::structural_tagger::{
    WordStructuralTagger, WordTaggerOptions, create_word_structural_tagger,
};

pub type AfrikaansTagger = WordStructuralTagger;

fn preprocess(w: &JsString) -> JsString {
    normalize(&w.to_lower_case(), Form::Nfc)
}

/// `createAfrikaansTagger(basename)`, or why it is unavailable.
pub fn create_afrikaans_tagger(basename: &str) -> Result<AfrikaansTagger, String> {
    create_word_structural_tagger(WordTaggerOptions {
        dir: DIR,
        basename: basename.to_string(),
        model_file: format!("{basename}.int8.onnx"),
        preprocess,
        postprocess: None,
    })
}

fn shipped() -> Result<&'static AfrikaansTagger, String> {
    static TAGGER: OnceLock<AfrikaansTagger> = OnceLock::new();
    load_once(&TAGGER, || create_afrikaans_tagger("af-g2p-tagger"))
}

/// The shipped tagger, cached once built; `None` when its files are unreadable or its graph unsupported (the
/// best path then degrades to the sync engine, as the TS does without onnxruntime). A failure is retried.
pub fn afrikaans_tagger() -> Option<&'static AfrikaansTagger> {
    shipped().ok()
}

/// Why `afrikaans_tagger()` is `None`, if it is.
pub fn afrikaans_tagger_unavailable_reason() -> Option<String> {
    shipped().err()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::js_string::js;

    /// The shipped graph loads in the pure-Rust runtime: without it the best path silently serves the sync reading.
    #[test]
    fn shipped_tagger_loads() {
        assert_eq!(afrikaans_tagger_unavailable_reason(), None);
        assert_eq!(
            afrikaans_tagger().unwrap().tag(&js("мир")).unwrap(),
            JsString::new()
        );
    }
}
