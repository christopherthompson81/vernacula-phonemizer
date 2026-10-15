//! Kannada cardinals through the shared Dravidian composer, and the fused ordinal (ನೇ / ನೆಯ on the last word).
//! Ported from src/languages/kannada/numbers.ts — see that file for the corpus evidence.

use super::manifest::KannadaNumbers;
use crate::core::js_string::{JsString, js};
use crate::core::numbers::dravidian_number_words;

/// `numberToWords(n)`: space-separated Kannada words.
pub fn number_to_words(n: u64, d: &KannadaNumbers) -> JsString {
    js(&dravidian_number_words(n, &d.dravidian).join(" "))
}

/// `ordinalStem(word)`: the cardinal's final -ು dropped.
pub fn ordinal_stem(word: &JsString) -> JsString {
    if word.ends_with(&js("ು")) {
        word.slice(0, Some(-1))
    } else {
        word.clone()
    }
}

/// `ordinalToWords(n, suffix)`: the suffix fused onto the last cardinal word; "" when there is none.
pub fn ordinal_to_words(n: u64, suffix: &JsString, d: &KannadaNumbers) -> JsString {
    let mut words = number_to_words(n, d).split(&js(" "));
    let Some(last) = words.last().cloned() else {
        return JsString::new();
    };
    if last.is_empty() {
        return JsString::new();
    }
    let i = words.len() - 1;
    words[i] = ordinal_stem(&last).concat(suffix);
    JsString::join(&words, &js(" "))
}
