//! Malayalam cardinals through the shared Dravidian composer, and the stems a clitic welds onto: the ordinal, the
//! oblique (case) and the plural.
//! Ported from src/languages/malayalam/numbers.ts — see that file for the corpus evidence.

use super::manifest::MalayalamNumbers;
use crate::core::js_string::{JsString, js};
use crate::core::numbers::dravidian_number_words;
use crate::js_re;

const VIRAMA: &str = "്";
const ANUSVARA: &str = "ം";

/// `numberToWords(n)`: space-separated Malayalam words.
pub fn number_to_words(n: u64, d: &MalayalamNumbers) -> JsString {
    js(&dravidian_number_words(n, &d.dravidian).join(" "))
}

fn ends_in_vowel_sign(word: &JsString) -> bool {
    js_re!(r"[ാിീുൂെേൈൊോൗ]$", "u").test(word)
}

/// `ordinalStem(word)`.
pub fn ordinal_stem(word: &JsString) -> JsString {
    if word.ends_with(&js(VIRAMA)) || word.ends_with(&js(ANUSVARA)) {
        word.slice(0, Some(-1))
    } else if ends_in_vowel_sign(word) {
        word.concat(&js("യ"))
    } else {
        word.clone()
    }
}

/// The last word of `numberToWords(n)` replaced by `last(word)`; "" when there is no last word or `last` declines.
fn on_last_word(
    n: u64,
    d: &MalayalamNumbers,
    last: impl Fn(&JsString) -> Option<JsString>,
) -> JsString {
    let mut words = number_to_words(n, d).split(&js(" "));
    let Some(w) = words.last().cloned() else {
        return JsString::new();
    };
    if w.is_empty() {
        return JsString::new();
    }
    let Some(new) = last(&w) else {
        return JsString::new();
    };
    let i = words.len() - 1;
    words[i] = new;
    JsString::join(&words, &js(" "))
}

/// `ordinalToWords(n, ending)`.
pub fn ordinal_to_words(n: u64, ending: &JsString, d: &MalayalamNumbers) -> JsString {
    on_last_word(n, d, |w| Some(ordinal_stem(w).concat(ending)))
}

/// `obliqueStem(word)`.
pub fn oblique_stem(word: &JsString) -> Option<JsString> {
    Some(if word.ends_with(&js(VIRAMA)) {
        word.slice(0, Some(-1)).concat(&js("ി"))
    } else if word.ends_with(&js(ANUSVARA)) {
        word.slice(0, Some(-1)).concat(&js("ത്തി"))
    } else if ends_in_vowel_sign(word) {
        word.concat(&js("യി"))
    } else {
        word.clone()
    })
}

/// `pluralStem(word)`: only a virama-final word takes the plural clitic.
pub fn plural_stem(word: &JsString) -> Option<JsString> {
    word.ends_with(&js(VIRAMA))
        .then(|| word.slice(0, Some(-1)).concat(&js("ു")))
}

/// `cliticToWords(n, clitic, stem)`.
pub fn clitic_to_words(
    n: u64,
    clitic: &JsString,
    stem: fn(&JsString) -> Option<JsString>,
    d: &MalayalamNumbers,
) -> JsString {
    on_last_word(n, d, |w| stem(w).map(|s| s.concat(clitic)))
}
