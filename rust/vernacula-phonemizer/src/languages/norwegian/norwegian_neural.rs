//! Norwegian Bokmål's best-output path: the BiLSTM tags each distinct word the sync engine asks its OOV
//! override for, then the sync engine renders with those readings between the lexicon and the rule g2p. Ported
//! from src/languages/norwegian/norwegianNeural.ts — see it for why the words are recorded rather than
//! re-derived (#1578).
//!
//! Synchronous here: the TS awaits only because ONNX Runtime's Node binding is async.

use super::norwegian::NorwegianPhonemizer;
use super::norwegian_tagger::NorwegianTagger;
use crate::core::foreign::with_host;
use crate::core::js_string::{JsString, js};
use crate::core::structural_tagger::asked_words_neural_prepass;

/// `phonemizeNbNeural(text)`, given the pre-passed text. Without a tagger it is exactly the sync path.
pub fn phonemize_nb_neural(
    e: &NorwegianPhonemizer,
    tagger: Option<&NorwegianTagger>,
    text: &JsString,
) -> Result<JsString, String> {
    let Some(tagger) = tagger else {
        return Ok(with_host(&js("nb"), || e.text(text, None)));
    };
    asked_words_neural_prepass(text, &|w| tagger.tag(w), &|t, oov| {
        with_host(&js("nb"), || e.text(t, Some(oov)))
    })
}
