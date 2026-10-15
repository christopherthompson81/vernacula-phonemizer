//! The Norwegian Bokmål OOV structural tagger: a per-grapheme BiLSTM emitting IPA chunks (stress included),
//! lowercase + NFC in, `oneStress` out. Ported from src/languages/norwegian/norwegianTagger.ts.

use std::sync::OnceLock;

use super::manifest::DIR;
use crate::core::data_source::load_once;
use crate::core::js_string::JsString;
use crate::core::provenance::{Form, normalize};
use crate::core::structural_tagger::{
    WordStructuralTagger, WordTaggerOptions, create_word_structural_tagger, one_stress,
};
use crate::js_re;

pub type NorwegianTagger = WordStructuralTagger;

fn preprocess(w: &JsString) -> JsString {
    normalize(&w.to_lower_case(), Form::Nfc)
}

fn postprocess(ipa: &JsString) -> JsString {
    one_stress(ipa, js_re!(r"[ɑaeɛiɪoɔuʉʊyʏøœæ]", "u"))
}

/// `createNorwegianTagger(basename)`, or why it is unavailable.
pub fn create_norwegian_tagger(basename: &str) -> Result<NorwegianTagger, String> {
    create_word_structural_tagger(WordTaggerOptions {
        dir: DIR,
        basename: basename.to_string(),
        model_file: format!("{basename}.int8.onnx"),
        preprocess,
        postprocess: Some(postprocess),
    })
}

fn shipped() -> Result<&'static NorwegianTagger, String> {
    static TAGGER: OnceLock<NorwegianTagger> = OnceLock::new();
    load_once(&TAGGER, || create_norwegian_tagger("nb-g2p-tagger"))
}

/// The shipped tagger, cached once built; `None` when its files are unreadable or its graph unsupported (the
/// best path then degrades to the sync engine, as the TS does without onnxruntime). A failure is retried.
pub fn norwegian_tagger() -> Option<&'static NorwegianTagger> {
    shipped().ok()
}

/// Why `norwegian_tagger()` is `None`, if it is.
pub fn norwegian_tagger_unavailable_reason() -> Option<String> {
    shipped().err()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::js_string::js;

    /// The shipped graph loads in the pure-Rust runtime: without it the best path silently serves the sync reading.
    #[test]
    fn shipped_tagger_loads() {
        assert_eq!(norwegian_tagger_unavailable_reason(), None);
        assert_eq!(
            norwegian_tagger().unwrap().tag(&js("мир")).unwrap(),
            JsString::new()
        );
    }
}
