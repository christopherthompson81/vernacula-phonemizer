//! Xhosa cardinal numbers as space-separated words: the Nguni compositor over Xhosa's number words, reading the
//! token's digits one at a time above the safe-integer range.
//! Ported from src/languages/xhosa/numbers.ts — see that file for the corpus evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::numbers::digit_index;

fn at(v: &[String], i: f64) -> Option<&String> {
    if i >= 0.0 && i.fract() == 0.0 && (i as usize) < v.len() {
        v.get(i as usize)
    } else {
        None
    }
}

/// `readDigits(digits)`: each code point by its standalone stem, `0` by the zero word, a non-digit as itself.
fn read_digits(digits: &JsString) -> JsString {
    let num = &MANIFEST.numbers;
    let parts: Vec<JsString> = digits
        .code_point_strings()
        .into_iter()
        .map(|d| {
            if d == "0" {
                return js(&num.zero);
            }
            let i = if d.len() == 1 {
                digit_index(d.0[0])
            } else {
                -1
            };
            usize::try_from(i)
                .ok()
                .and_then(|i| num.ku.get(i))
                .map_or(d, |w| js(w))
        })
        .collect();
    JsString::join(&parts, &js(" "))
}

/// `numberToWords(n, raw?)`: a non-negative integer → space-separated Xhosa cardinal words.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    if n < 0.0 || !n.is_finite() {
        return JsString::new();
    }
    let n = n.floor();
    if n != 0.0 && !is_safe_integer(n) {
        return match raw {
            Some(r) => read_digits(r),
            None => read_digits(&js(&js_number_to_string(n))),
        };
    }
    js(&words(n))
}

/// The compositor over a non-negative safe integer.
fn words(n: f64) -> String {
    let num = &MANIFEST.numbers;
    if n == 0.0 {
        return num.zero.clone();
    }
    if n >= 1_000_000.0 {
        let m = (n / 1_000_000.0).floor();
        let rem = n % 1_000_000.0;
        let mil = if m == 1.0 {
            num.million.one.clone()
        } else {
            let mult = at(&num.ama, m).cloned().unwrap_or_else(|| words(m));
            format!("{} {}", num.million.many, mult)
        };
        return if rem != 0.0 {
            format!("{mil} {}", words(rem))
        } else {
            mil
        };
    }
    let mut parts: Vec<String> = Vec::new();
    let th = (n / 1000.0).floor();
    let h = ((n % 1000.0) / 100.0).floor();
    let t = ((n % 100.0) / 10.0).floor();
    let u = n % 10.0;
    if th == 1.0 {
        parts.push(num.thousand.one.clone());
    } else if th >= 2.0 {
        parts.push(num.thousand.many.clone());
        parts.push(at(&num.ama, th).cloned().unwrap_or_else(|| words(th)));
    }
    if h == 1.0 {
        parts.push(num.hundred.one.clone());
    } else if h >= 2.0 {
        parts.push(num.hundred.many.clone());
        parts.push(num.ama[h as usize].clone());
    }
    if t == 1.0 {
        parts.push(num.ten.one.clone());
    } else if t >= 2.0 {
        parts.push(num.ten.many.clone());
        parts.push(num.ama[t as usize].clone());
    }
    if u > 0.0 {
        let stems = if parts.is_empty() { &num.ku } else { &num.na };
        parts.push(stems[u as usize].clone());
    }
    parts.join(" ")
}
