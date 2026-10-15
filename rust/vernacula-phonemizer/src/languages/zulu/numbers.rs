//! Zulu cardinal numbers as space-separated words: the agglutinative compositor over the manifest's ku-/na-/ama-
//! unit stems and noun-class magnitudes.
//! Ported from src/languages/zulu/numbers.ts — see that file for the corpus evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};

/// `arr[i]` for a JS array index that may be out of range.
fn at(v: &[String], i: f64) -> Option<&String> {
    if i >= 0.0 && i.fract() == 0.0 && (i as usize) < v.len() {
        v.get(i as usize)
    } else {
        None
    }
}

/// `numberToWords(n)`: a non-negative integer → space-separated Zulu cardinal words. JS double arithmetic.
pub fn number_to_words(n: f64) -> JsString {
    js(&words(n))
}

fn words(n: f64) -> String {
    if n < 0.0 || !n.is_finite() {
        return String::new();
    }
    let num = &MANIFEST.numbers;
    let n = n.floor();
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
