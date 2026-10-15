//! Afrikaans's best-output path: the BiLSTM tags each distinct word both lexicons miss (rule-reserved words
//! excluded), then the sync engine renders with those readings between the lexicons and the rules. Ported from
//! src/languages/afrikaans/afrikaansNeural.ts.
//!
//! Synchronous here: the TS awaits only because ONNX Runtime's Node binding is async.

use std::sync::LazyLock;

use super::afrikaans::{
    AF_WORD, AfrikaansPhonemizer, afrikaans_lexicon_has, afrikaans_rule_reserved,
};
use super::afrikaans_tagger::AfrikaansTagger;
use crate::core::foreign::with_host;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::provenance::{Form, normalize};
use crate::core::structural_tagger::word_level_neural_prepass;

static WORD: LazyLock<JsRegex> = LazyLock::new(|| JsRegex::new(AF_WORD, "gu").unwrap());

/// `phonemizeAfNeural(text)`, given the pre-passed text. Without a tagger it is exactly the sync path.
pub fn phonemize_af_neural(
    e: &AfrikaansPhonemizer,
    tagger: Option<&AfrikaansTagger>,
    text: &JsString,
) -> Result<JsString, String> {
    let Some(tagger) = tagger else {
        return Ok(with_host(&js("af"), || e.text(text, None)));
    };
    word_level_neural_prepass(
        text,
        &WORD,
        &|w| normalize(w, Form::Nfc).to_lower_case(),
        &|w| afrikaans_lexicon_has(w) || afrikaans_rule_reserved(w),
        &|w| tagger.tag(w),
        &|t, oov| with_host(&js("af"), || e.text(t, Some(oov))),
    )
}
