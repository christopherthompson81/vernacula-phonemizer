//! Telugu cardinals through the shared Dravidian composer, the century reading of 1100-1999, and the fused
//! ordinal (వ on the last word after the final-vowel adjustment).
//! Ported from src/languages/telugu/numbers.ts — see that file for the corpus and audio evidence.

use super::manifest::TeluguNumbers;
use crate::core::js_string::{JsString, js};
use crate::core::numbers::dravidian_number_words;

/// `numberToWords(n)`: space-separated Telugu words.
pub fn number_to_words(n: u64, d: &TeluguNumbers) -> JsString {
    js(&dravidian_number_words(n, &d.dravidian).join(" "))
}

/// `isCenturyYear(n)`.
pub fn is_century_year(n: u64) -> bool {
    (1100..=1999).contains(&n)
}

/// `yearToWords(n)`: 1100-1999 as centuries, anything else the cardinal.
pub fn year_to_words(n: u64, d: &TeluguNumbers) -> JsString {
    if !is_century_year(n) {
        return number_to_words(n, d);
    }
    let (century, rest) = (n / 100, n % 100);
    let h = &d.dravidian.magnitude_forms.hundred;
    let hundred = if rest > 0 {
        &h.plural_oblique
    } else {
        &h.plural
    };
    let mut parts = vec![
        number_to_words(century, d),
        js(hundred.as_deref().unwrap_or_default()),
    ];
    if rest > 0 {
        parts.push(number_to_words(rest, d));
    }
    JsString::join(&parts, &js(" "))
}

/// `ordinalStem(word)`.
pub fn ordinal_stem(word: &JsString) -> JsString {
    if word.ends_with(&js("ు")) || word.ends_with(&js("ి")) {
        return word.slice(0, Some(-1));
    }
    if word.ends_with(&js("ై")) {
        return word.slice(0, Some(-1)).concat(&js("య్య"));
    }
    word.clone()
}

/// `ordinalToWords(n, suffix)`: the suffix fused onto the last word of the cardinal (or century) reading.
pub fn ordinal_to_words(n: u64, suffix: &JsString, d: &TeluguNumbers) -> JsString {
    let reading = if is_century_year(n) {
        year_to_words(n, d)
    } else {
        number_to_words(n, d)
    };
    let mut words = reading.split(&js(" "));
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
