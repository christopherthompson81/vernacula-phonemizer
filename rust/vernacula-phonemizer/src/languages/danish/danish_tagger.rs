//! The Danish OOV structural tagger: a per-grapheme BiLSTM emitting IPA chunks, lowercase + NFC in, `oneStress`
//! out. Ported from src/languages/danish/danishTagger.ts.

use std::sync::OnceLock;

use super::manifest::DIR;
use crate::core::data_source::load_once;
use crate::core::js_string::JsString;
use crate::core::provenance::{Form, normalize};
use crate::core::structural_tagger::{
    WordStructuralTagger, WordTaggerOptions, create_word_structural_tagger, one_stress,
};
use crate::js_re;

pub type DanishTagger = WordStructuralTagger;

fn preprocess(w: &JsString) -> JsString {
    normalize(&w.to_lower_case(), Form::Nfc)
}

fn postprocess(ipa: &JsString) -> JsString {
    one_stress(ipa, js_re!(r"[ɑaeɛiɪoɔuʉʊyʏøœæəɐɒ]", "u"))
}

/// `createDanishTagger(basename)`, or why it is unavailable.
pub fn create_danish_tagger(basename: &str) -> Result<DanishTagger, String> {
    create_word_structural_tagger(WordTaggerOptions {
        dir: DIR,
        basename: basename.to_string(),
        model_file: format!("{basename}.int8.onnx"),
        preprocess,
        postprocess: Some(postprocess),
    })
}

fn shipped() -> Result<&'static DanishTagger, String> {
    static TAGGER: OnceLock<DanishTagger> = OnceLock::new();
    load_once(&TAGGER, || create_danish_tagger("da-g2p-tagger"))
}

/// The shipped tagger, cached once built; `None` when its files are unreadable or its graph unsupported (the
/// best path then degrades to the sync engine, as the TS does without onnxruntime). A failure is retried.
pub fn danish_tagger() -> Option<&'static DanishTagger> {
    shipped().ok()
}

/// Why `danish_tagger()` is `None`, if it is.
pub fn danish_tagger_unavailable_reason() -> Option<String> {
    shipped().err()
}

#[cfg(all(test, feature = "da"))]
mod tests {
    use super::*;
    use crate::core::js_string::js;

    /// The shipped graph loads in the pure-Rust runtime: without it the best path silently serves the sync reading.
    #[test]
    fn shipped_tagger_loads() {
        assert_eq!(danish_tagger_unavailable_reason(), None);
        // test/daNeural.test.ts: a Cyrillic word has no letter in the training vocab, so the tagger declines.
        assert_eq!(
            danish_tagger().unwrap().tag(&js("мир")).unwrap(),
            JsString::new()
        );
    }
}
