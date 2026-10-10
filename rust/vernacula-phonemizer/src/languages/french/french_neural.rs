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
        // ⚠ A READING THAT STARTS WITH A COMBINING MARK IS DECLINED ("" → the rule g2p): the tagger can give a
        // word-initial m/n the bare nasal tilde (`Mr` read `̃ʁ`), and no IPA reading can begin with a mark.
        &|lower| {
            let out = tag(lower)?;
            Ok(if js_re!(r"^\p{M}", "u").test(&out) {
                JsString::new()
            } else {
                out
            })
        },
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
        let e = create_french().unwrap();
        for t in ["la FM", "le J. Martin", "la RTJ", "un fichier de 5 ko"] {
            // The premise first: the normalizer emits one of these words, or "not offered" holds vacuously.
            let words = js_re!(r"\b(?:effe|emme|ji|kilooctets?)\b", "u");
            assert!(words.test(&e.normalized_for(&js(t))), "{t}: premise");
            let (asked, best, sync) = run(t);
            for w in ["effe", "emme", "ji", "kilooctet", "kilooctets"] {
                assert!(!asked.contains(&js(w)), "{t}: {w} offered");
            }
            assert_eq!(best, sync, "{t}");
        }
    }

    /// #1463: supplement.tsv's letter-name rows are a hand-kept copy of `letterNames`. A letter name neither
    /// Lexique nor the supplement answers reaches the tagger, which misread three (18 FLEURS texts).
    #[test]
    fn every_letter_name_is_answered_by_lexicon_or_supplement() {
        let e = create_french().unwrap();
        let mut words: Vec<&str> = crate::languages::french::manifest::MANIFEST
            .letter_names
            .values()
            .flat_map(|n| n.split(' '))
            .collect();
        words.sort_unstable();
        words.dedup();
        assert!(words.len() >= 26, "the walk is not vacuous");
        let missing: Vec<&str> = words
            .into_iter()
            .filter(|w| !e.has_word(&js(w).to_lower_case()))
            .collect();
        assert!(missing.is_empty(), "unanswered letter names: {missing:?}");
    }

    /// A tagger reading that starts with a combining mark (`Mr` read `̃ʁ`) is declined, so the rule g2p reads
    /// the word: the sync reading. An ordinary reading is still used.
    #[test]
    fn a_reading_starting_with_a_combining_mark_is_declined() {
        let e = create_french().unwrap();
        let t = "Il vit à Ngorongoro avec McCord.";
        let best = prepass_with(&e, &|_| Ok(js("\u{303}x")), &js(t)).unwrap();
        let sync = with_host(&js("fr"), || e.text(&js(t), None));
        assert_eq!(best, sync);
        let used = prepass_with(&e, &|_| Ok(js("QQ")), &js("Ngorongoro")).unwrap();
        assert!(used.to_string_lossy().contains("QQ"));
    }
}
