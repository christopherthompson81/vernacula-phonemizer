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
    prepass_with(e, &|lower| tagger.tag(lower), text)
}

/// `frenchPrepassWith(tagger, text)`: the pre-pass and render with a given tag function, so a test can see
/// which words are offered.
pub fn prepass_with(
    e: &FrenchPhonemizer,
    tag: &dyn Fn(&JsString) -> Result<JsString, String>,
    text: &JsString,
) -> Result<JsString, String> {
    // The NORMALIZED text, not the caller's (#1463): normalized once and handed on. The vocab test has no
    // hyphen: the word pattern never matches one.
    let normalized = e.normalized_for(text);
    word_level_neural_prepass(
        &normalized,
        js_re!("[a-zà-ÿœæ]+(?:['’][a-zà-ÿœæ]+)?", "giu"),
        &|w| w.to_lower_case(),
        &|lower| e.has_word(lower) || !js_re!("^[a-zà-ÿœæ]+$", "u").test(lower),
        tag,
        &|t, oov| with_host(&js("fr"), || e.text_normalized(t, Some(oov))),
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::languages::french::french::create_french;
    use std::cell::RefCell;

    /// Runs the pre-pass with a recording tag function that answers a marker: (offered, best, sync).
    fn run(text: &str) -> (Vec<JsString>, JsString, JsString) {
        let e = create_french().unwrap();
        let asked = RefCell::new(Vec::new());
        let best = prepass_with(
            &e,
            &|w| {
                asked.borrow_mut().push(w.clone());
                Ok(js("Q"))
            },
            &js(text),
        )
        .unwrap();
        let sync = with_host(&js("fr"), || e.text(&js(text), None));
        (asked.into_inner(), best, sync)
    }

    /// #1463: a word the normalizer creates (`5 Mo` → mégaoctets) is offered to the tagger.
    #[test]
    fn a_normalizer_created_word_is_offered() {
        assert!(run("un fichier de 5 Mo").0.contains(&js("mégaoctets")));
    }

    /// #1463: the letter names and kilooctet are supplement rows, so they never reach the tagger.
    #[test]
    fn a_supplement_word_is_not_offered() {
        for t in ["la FM", "le J. Martin", "la RTJ", "un fichier de 5 ko"] {
            let (asked, best, sync) = run(t);
            for w in ["effe", "emme", "ji", "kilooctet", "kilooctets"] {
                assert!(!asked.contains(&js(w)), "{t}: {w} offered");
            }
            assert_eq!(best, sync, "{t}");
        }
    }
}
