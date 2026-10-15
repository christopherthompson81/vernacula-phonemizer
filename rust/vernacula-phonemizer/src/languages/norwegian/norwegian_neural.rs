//! Norwegian Bokmål's best-output path: the BiLSTM tags each distinct OOV word once, then the sync engine
//! renders with those readings between the lexicon and the rule g2p. Ported from
//! src/languages/norwegian/norwegianNeural.ts.
//!
//! Synchronous here: the TS awaits only because ONNX Runtime's Node binding is async.

use super::norwegian::{NorwegianPhonemizer, lexicon};
use super::norwegian_tagger::NorwegianTagger;
use crate::core::foreign::with_host;
use crate::core::js_string::{JsString, js};
use crate::core::structural_tagger::word_level_neural_prepass;
use crate::js_re;

/// `phonemizeNbNeural(text)`, given the pre-passed text. Without a tagger it is exactly the sync path.
pub fn phonemize_nb_neural(
    e: &NorwegianPhonemizer,
    tagger: Option<&NorwegianTagger>,
    text: &JsString,
) -> Result<JsString, String> {
    let Some(tagger) = tagger else {
        return Ok(with_host(&js("nb"), || e.text(text, None)));
    };
    let lex = lexicon();
    // ⚠ The RAW match of a hand-listed class, keyed as is, while text() asks the override for the NATIVISED
    // spelling of a whole-Latin token: the TS's own drift (the one da fixed for itself), reproduced on purpose.
    word_level_neural_prepass(
        text,
        js_re!(r"[A-Za-zÆØÅæøåÉéÈèÊêËëÀàÂâÔôÜü]+", "gu"),
        &|w| w.clone(),
        &|w| lex.contains_key(&w.to_lower_case()),
        &|w| tagger.tag(w),
        &|t, oov| with_host(&js("nb"), || e.text(t, Some(oov))),
    )
}
