//! French's best-output path: the BiLSTM tags each distinct OOV word once, then the sync engine renders with
//! those readings injected between the lexicon and the rule g2p. Ported from
//! src/languages/french/frenchNeural.ts.
//!
//! Synchronous here: the TS awaits only because ONNX Runtime's Node binding is async.

use super::french::FrenchPhonemizer;
use super::french_tagger::FrenchTagger;
use crate::core::foreign::with_host;
use crate::core::js_string::{JsString, js};
use crate::core::structural_tagger::word_level_neural_prepass;
use crate::js_re;

/// `phonemizeFrNeural(text)`, given the pre-passed text. Without a tagger it is exactly the sync path.
pub fn phonemize_fr_neural(
    e: &FrenchPhonemizer,
    tagger: Option<&FrenchTagger>,
    text: &JsString,
) -> Result<JsString, String> {
    let Some(tagger) = tagger else {
        return Ok(with_host(&js("fr"), || e.text(text, None)));
    };
    word_level_neural_prepass(
        text,
        js_re!("[a-zà-ÿœæ]+(?:['’][a-zà-ÿœæ]+)?", "giu"),
        &|w| w.to_lower_case(),
        &|lower| e.lexicon_has(lower) || !js_re!("^[a-zà-ÿœæ-]+$", "u").test(lower),
        &|lower| tagger.tag(lower),
        &|t, oov| with_host(&js("fr"), || e.text(t, Some(oov))),
    )
}
