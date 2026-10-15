//! Bengali's best-output path: the BiLSTM tags each distinct OOV word once, then the sync engine renders with
//! those readings between the lexicon and the rule g2p. Ported from src/languages/bengali/bengaliNeural.ts.
//!
//! Synchronous here: the TS awaits only because ONNX Runtime's Node binding is async.

use std::sync::{Arc, OnceLock};

use super::bengali::{NativeBengali, bengali_lexicon, create_bengali};
use super::bengali_tagger::BengaliTagger;
use crate::core::foreign::with_host;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::provenance::{Form, renormalize};
use crate::core::structural_tagger::word_level_neural_prepass;
use crate::core::unicode::BENGALI_WORD;
use crate::registry::{PhonemizeError, phonemize_in};

/// `bnEngine()`: built once, with `getPhonemizer("en").text` as its foreign reader. ⚠ NOT the registry's
/// `readAsEnglish` (which consults the prewarmed foreign-OOV memo): the TS's own drift, reproduced on purpose.
fn bn_engine() -> Result<&'static NativeBengali, PhonemizeError> {
    static ENGINE: OnceLock<NativeBengali> = OnceLock::new();
    if let Some(e) = ENGINE.get() {
        return Ok(e);
    }
    let foreign = Arc::new(|latin: &JsString| phonemize_in("en", latin).unwrap_or_default());
    let built = create_bengali(Some(foreign)).map_err(PhonemizeError::Data)?;
    Ok(ENGINE.get_or_init(|| built))
}

/// `phonemizeBnNeural(text)`, given the pre-passed text. Without a tagger it is exactly the sync path.
pub fn phonemize_bn_neural(
    tagger: Option<&BengaliTagger>,
    text: &JsString,
) -> Result<JsString, PhonemizeError> {
    let e = bn_engine()?;
    let Some(tagger) = tagger else {
        return with_host(&js("bn"), || e.text(text, None));
    };
    static WORD: OnceLock<JsRegex> = OnceLock::new();
    let word = WORD.get_or_init(|| JsRegex::new(&format!("[{BENGALI_WORD}]+"), "gu").unwrap());
    let lex = bengali_lexicon();
    let failed: std::cell::RefCell<Option<PhonemizeError>> = Default::default();
    let out = word_level_neural_prepass(
        text,
        word,
        &|w| w.clone(),
        &|w| lex.contains_key(&renormalize(w, Form::Nfc)),
        &|w| tagger.tag(w),
        &|t, oov| {
            with_host(&js("bn"), || e.text(t, Some(oov))).unwrap_or_else(|err| {
                *failed.borrow_mut() = Some(err);
                JsString::new()
            })
        },
    )
    .map_err(PhonemizeError::Neural)?;
    match failed.into_inner() {
        Some(err) => Err(err),
        None => Ok(out),
    }
}
