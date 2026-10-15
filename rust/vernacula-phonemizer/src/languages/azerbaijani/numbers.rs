//! Azerbaijani cardinals by thousands (on/yüz/min/milyon/…), "bir" dropped before yüz and min.
//! Ported from src/languages/azerbaijani/numbers.ts — see that file for the corpus evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js, js_number_to_string};

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

/// `numberToWords(n)`: a non-negative number → words; "" for a negative or non-finite one; digit by digit past
/// the largest scale word.
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
    if groups.len() > nm.scales.len() {
        // `ONES[Number(d)] || N.zero` over `String(Math.floor(n))`, which is exponent notation from 1e21: a
        // non-digit (`e`, `+`, `.`) indexes ONES with NaN, and ONES[0] is "".
        let digits: Vec<JsString> = js_number_to_string(n.floor())
            .chars()
            .map(|d| {
                let w = d.to_digit(10).map_or("", |i| nm.ones[i as usize].as_str());
                js(if w.is_empty() { &nm.zero } else { w })
            })
            .collect();
        return JsString::join(&digits, &js(" "));
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
