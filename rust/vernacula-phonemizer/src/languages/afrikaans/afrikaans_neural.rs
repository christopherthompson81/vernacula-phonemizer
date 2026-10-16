//! Afrikaans's best-output path: the BiLSTM tags each distinct word the sync engine asks its OOV override for
//! (it asks only after both lexicons miss, and never for a rule-reserved word), then the sync engine renders with
//! those readings between the lexicons and the rules. Ported from src/languages/afrikaans/afrikaansNeural.ts —
//! see it for why the words are recorded rather than re-derived (#1578).
//!
//! Synchronous here: the TS awaits only because ONNX Runtime's Node binding is async.

use super::afrikaans::AfrikaansPhonemizer;
use super::afrikaans_tagger::AfrikaansTagger;
use crate::core::foreign::with_host;
use crate::core::js_string::{JsString, js};
use crate::core::structural_tagger::asked_words_neural_prepass;

/// `phonemizeAfNeural(text)`, given the pre-passed text. Without a tagger it is exactly the sync path.
pub fn phonemize_af_neural(
    e: &AfrikaansPhonemizer,
    tagger: Option<&AfrikaansTagger>,
    text: &JsString,
) -> Result<JsString, String> {
    let Some(tagger) = tagger else {
        return Ok(with_host(&js("af"), || e.text(text, None)));
    };
    asked_words_neural_prepass(text, &|w| tagger.tag(w), &|t, oov| {
        with_host(&js("af"), || e.text(t, Some(oov)))
    })
}
