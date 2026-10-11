//! Turkish cardinals by thousands: on/yüz/bin/milyon/…, with "bir" dropped before yüz and bin.
//! Ported from src/languages/turkish/numbers.ts — see that file for the corpus evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js, js_number};
use crate::js_re;

/// `below1000(n)`: 1 ≤ n < 1000 (integral) → words.
fn below1000(n: f64, parts: &mut Vec<JsString>) {
    let nm = &MANIFEST.numbers;
    let h = (n / 100.0).floor() as usize;
    let t = ((n % 100.0) / 10.0).floor() as usize;
    let o = (n % 10.0) as usize;
    if h > 0 {
        if h > 1 {
            parts.push(js(&nm.ones[h]));
        }
        parts.push(js(&nm.hundred));
    }
    if t > 0 {
        parts.push(js(&nm.tens[t]));
    }
    if o > 0 {
        parts.push(js(&nm.ones[o]));
    }
}

/// `composeGroups(groups)`: little-endian thousands groups → words; "" when there are more groups than scale
/// words.
fn compose_groups(groups: &[f64]) -> JsString {
    let nm = &MANIFEST.numbers;
    if groups.len() > nm.scales.len() {
        return JsString::new();
    }
    let mut parts: Vec<JsString> = Vec::new();
    for g in (0..groups.len()).rev() {
        let v = groups[g];
        if v == 0.0 {
            continue;
        }
        if g == 1 && v == 1.0 {
            parts.push(js(&nm.scales[1]));
            continue;
        }
        below1000(v, &mut parts);
        if g > 0 {
            parts.push(js(&nm.scales[g]));
        }
    }
    JsString::join(&parts, &js(" "))
}

/// `numberToWords(n)`: a non-negative number → Turkish words; "" for a negative or non-finite one, and past the
/// largest scale word (10³⁶ and up).
pub(crate) fn number_to_words(n: f64) -> JsString {
    let nm = &MANIFEST.numbers;
    if !n.is_finite() || n < 0.0 {
        return JsString::new();
    }
    if n == 0.0 {
        return js(&nm.zero);
    }
    let mut groups: Vec<f64> = Vec::new();
    let mut x = n.floor();
    while x > 0.0 {
        groups.push(x % 1000.0);
        x = (x / 1000.0).floor();
    }
    compose_groups(&groups)
}

/// `digitsToWords(digits)`: a written digit string → words, grouped from the STRING (past 2⁵³ `Number()` has
/// already rounded it); more groups than scale words → digit by digit (#1523).
pub(crate) fn digits_to_words(digits: &JsString) -> JsString {
    let nm = &MANIFEST.numbers;
    let d = js_re!(r"^0+(?=\d)", "u").replace(digits, &JsString::new());
    if d == js("0") {
        return js(&nm.zero);
    }
    let mut groups: Vec<f64> = Vec::new();
    let len = d.len() as isize;
    let mut end = len;
    while end > 0 {
        groups.push(js_number(&d.slice((end - 3).max(0), Some(end))));
        end -= 3;
    }
    if groups.len() > nm.scales.len() {
        let words: Vec<JsString> = d
            .code_point_strings()
            .iter()
            .map(|c| {
                if *c == js("0") {
                    js(&nm.zero)
                } else {
                    js(&nm.ones[js_number(c) as usize])
                }
            })
            .collect();
        return JsString::join(&words, &js(" "));
    }
    compose_groups(&groups)
}
