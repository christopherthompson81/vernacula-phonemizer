//! Turkish cardinals by thousands: on/yüz/bin/milyon/…, with "bir" dropped before yüz and bin.
//! Ported from src/languages/turkish/numbers.ts — see that file for the corpus evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};

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

/// `numberToWords(n)`: a non-negative number → Turkish words; "" for a negative or non-finite one.
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
    // ⚠ `SCALES[g]` past the table (≥ 10¹⁸) is `undefined`, which `join` writes as "" — a doubled space.
    let scale = |g: usize| nm.scales.get(g).map_or_else(JsString::new, |s| js(s));
    let mut parts: Vec<JsString> = Vec::new();
    for g in (0..groups.len()).rev() {
        let v = groups[g];
        if v == 0.0 {
            continue;
        }
        if g == 1 && v == 1.0 {
            parts.push(scale(1));
            continue;
        }
        below1000(v, &mut parts);
        if g > 0 {
            parts.push(scale(g));
        }
    }
    JsString::join(&parts, &js(" "))
}
