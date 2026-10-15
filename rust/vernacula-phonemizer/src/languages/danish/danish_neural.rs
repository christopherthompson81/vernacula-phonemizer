//! Danish's best-output path: the BiLSTM tags each distinct OOV word once (keyed by the nativised spelling, as
//! the sync engine asks), then the sync engine renders with those readings between the lexicon and the rule g2p.
//! Ported from src/languages/danish/danishNeural.ts.
//!
//! Synchronous here: the TS awaits only because ONNX Runtime's Node binding is async.

use std::sync::LazyLock;

use super::danish::{DanishPhonemizer, da_word, lexicon, nat};
use super::danish_tagger::DanishTagger;
use crate::core::foreign::with_host;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::structural_tagger::word_level_neural_prepass;

static WORD: LazyLock<JsRegex> = LazyLock::new(|| JsRegex::new(&da_word(), "gu").unwrap());

/// `phonemizeDaNeural(text)`, given the pre-passed text. Without a tagger it is exactly the sync path.
pub fn phonemize_da_neural(
    e: &DanishPhonemizer,
    tagger: Option<&DanishTagger>,
    text: &JsString,
) -> Result<JsString, String> {
    let Some(tagger) = tagger else {
        return Ok(with_host(&js("da"), || e.text(text, None)));
    };
    let lex = lexicon();
    word_level_neural_prepass(
        text,
        &WORD,
        &nat,
        &|w| lex.contains_key(&w.to_lower_case()),
        &|w| tagger.tag(w),
        &|t, oov| with_host(&js("da"), || e.text(t, Some(oov))),
    )
}
