//! English's best-output path: the BiLSTM tags each distinct OOV word once, then the ordinary engine renders
//! with those readings injected as its OOV override. Ported from src/languages/english/englishNeural.ts.
//!
//! Synchronous here: the TS awaits only because ONNX Runtime's Node binding is async.

use std::collections::HashMap;

use super::english::{EnglishPhonemizer, WordTransform};
use super::english_tagger::EnglishTagger;
use crate::core::foreign::{add_foreign_oov, lookup_foreign_oov, with_host};
use crate::core::js_string::{JsString, js};
use crate::js_re;

fn g2p_key_of(word: &JsString) -> JsString {
    let lower = word.to_lower_case();
    let mut lookup = lower.clone();
    if lower.ends_with(&js("'s")) && lower.len() > 2 {
        lookup = lower.slice(0, Some(-2));
    } else if lower.ends_with(&js("'")) && lower.len() > 2 && lower.char_at(lower.len() - 2) == "s"
    {
        lookup = lower.slice(0, Some(-1));
    }
    js_re!("'", "gu").replace(&lookup, &JsString::new())
}

fn word_re() -> &'static crate::core::js_regex::JsRegex {
    js_re!("[A-Za-z][A-Za-z']*", "gu")
}

/// Tag the OOV words of a foreign Latin run into the process-wide memo the delegated reader consults.
pub fn prewarm_foreign_english(
    e: &EnglishPhonemizer,
    tagger: Option<&EnglishTagger>,
    text: &JsString,
) -> Result<(), String> {
    let Some(tagger) = tagger else { return Ok(()) };
    let mut done = std::collections::HashSet::new();
    for m in word_re().match_all(text) {
        let w = m.value(text);
        if e.known_word(&w).is_some() {
            continue;
        }
        let key = g2p_key_of(&w);
        if done.contains(&key) || !js_re!("^[a-z]+$", "u").test(&key) {
            continue;
        }
        done.insert(key.clone());
        if lookup_foreign_oov(&key).is_some() {
            continue;
        }
        let ipa = tagger.tag(&key)?;
        if !ipa.is_empty() {
            add_foreign_oov(&key, &ipa);
        }
    }
    Ok(())
}

/// `phonemizeEnNeural(text, variant)`. `host` is the scope the render runs in ("en", "en-GB", …).
pub fn phonemize_en_neural(
    e: &EnglishPhonemizer,
    tagger: Option<&EnglishTagger>,
    text: &JsString,
    host: &str,
    word_transform: Option<WordTransform>,
) -> Result<JsString, String> {
    let Some(tagger) = tagger else {
        return Ok(with_host(&js(host), || {
            e.text_full(text, word_transform, None, false)
        }));
    };
    let mut tagged: HashMap<JsString, JsString> = HashMap::new();
    let normalized = e.normalized_for(text);
    for m in word_re().match_all(&normalized) {
        let w = m.value(&normalized);
        if m.index() > 0 {
            let around = normalized.slice(
                (m.index() - 1) as isize,
                Some((m.index() + w.len()) as isize),
            );
            if js_re!("^[0-9](?:st|nd|rd|th)$", "iu").test(&around) {
                continue;
            }
        }
        if e.has_word(&w) {
            continue;
        }
        let key = g2p_key_of(&w);
        if tagged.contains_key(&key) || !js_re!("^[a-z]+$", "u").test(&key) {
            continue;
        }
        let ipa = tagger.tag(&key)?;
        if !ipa.is_empty() {
            tagged.insert(key, ipa);
        }
    }
    Ok(with_host(&js(host), || {
        e.text_full(
            &normalized,
            word_transform,
            Some(&|k| tagged.get(k).cloned()),
            true,
        )
    }))
}
