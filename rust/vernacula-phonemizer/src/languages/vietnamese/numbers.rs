//! Vietnamese cardinal numbers → space-separated syllables (lăm / mốt / linh, thousands scales).
//! Ported from src/languages/vietnamese/numbers.ts — see that file for the corpus evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};

/// `below1000(n, lead)`.
fn below_1000(n: f64, lead: bool, parts: &mut Vec<String>) {
    let nm = &MANIFEST.numbers;
    let ones = &nm.ones;
    let h = (n / 100.0).floor();
    let t = ((n % 100.0) / 10.0).floor();
    let u = n % 10.0;
    if h > 0.0 || lead {
        parts.push(ones[h as usize].clone());
        parts.push(nm.hundred.clone());
    }
    if t == 0.0 {
        if u > 0.0 && (h > 0.0 || lead) {
            parts.push(nm.zero_tens.clone());
        }
        if u > 0.0 {
            parts.push(ones[u as usize].clone());
        }
    } else {
        parts.push(if t == 1.0 {
            nm.ten.clone()
        } else {
            ones[t as usize].clone()
        });
        if t >= 2.0 {
            parts.push(nm.tens_multiplier.clone());
        }
        if u == 1.0 && t >= 2.0 {
            parts.push(nm.unit_one_after_ten.clone());
        } else if u == 5.0 && t >= 1.0 {
            parts.push(nm.unit_five_after_ten.clone());
        } else if u > 0.0 {
            parts.push(ones[u as usize].clone());
        }
    }
}

/// `numberToWords(n)`. A scale past `tỷ` is `SCALES[g]` = undefined in the TS, which `join` renders as "".
pub fn number_to_words(n: f64) -> JsString {
    if !n.is_finite() || n < 0.0 {
        return JsString::new();
    }
    let nm = &MANIFEST.numbers;
    if n == 0.0 {
        return js(&nm.ones[0]);
    }
    let mut groups: Vec<f64> = Vec::new();
    let mut x = n.floor();
    while x > 0.0 {
        groups.push(x % 1000.0);
        x = (x / 1000.0).floor();
    }
    let mut parts: Vec<String> = Vec::new();
    for g in (0..groups.len()).rev() {
        if groups[g] == 0.0 {
            continue;
        }
        below_1000(groups[g], g < groups.len() - 1, &mut parts);
        if g > 0 {
            parts.push(nm.scales.get(g).cloned().unwrap_or_default());
        }
    }
    js(&parts.join(" "))
}
