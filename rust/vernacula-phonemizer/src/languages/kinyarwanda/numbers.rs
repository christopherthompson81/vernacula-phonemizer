//! The shared Rwanda-Rundi cardinal compositor (Kirundi imports it with its own table) and Kinyarwanda's
//! `numberToWords`: concord multiplier series per magnitude, a per-language ceiling, digit by digit above it.
//! Ported from src/languages/kinyarwanda/numbers.ts — see that file for the corpus evidence.

use super::manifest::{MANIFEST, RwandaRundiNumbers};
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::numbers::digit_index;

/// `composeRwandaRundi(n, N, raw)`.
pub fn compose_rwanda_rundi(n: f64, t: &RwandaRundiNumbers, raw: Option<&JsString>) -> JsString {
    let billion = t.billion.as_deref().filter(|b| !b.is_empty());
    let ceiling = if billion.is_some() { 1e12 } else { 1e9 };
    if !is_safe_integer(n) || n < 0.0 || n >= ceiling {
        let digits = raw
            .cloned()
            .unwrap_or_else(|| js(&js_number_to_string(n.abs())));
        let words: Vec<JsString> = digits
            .code_point_strings()
            .into_iter()
            .map(|d| {
                let i = if d.len() == 1 {
                    digit_index(d.units()[0])
                } else {
                    -1
                };
                if i >= 0 { js(&t.units[i as usize]) } else { d }
            })
            .collect();
        return JsString::join(&words, &js(" "));
    }
    let n = n as u64;
    if n == 0 {
        return js(&t.units[0]);
    }
    if n < 1_000_000_000 {
        return js(&below1e9(t, n));
    }
    let b = billion.unwrap();
    let (bn, r) = (n / 1_000_000_000, n % 1_000_000_000);
    let head = if bn == 1 {
        b.to_string()
    } else {
        format!("{b} {}", below1000(t, bn))
    };
    js(&if r != 0 {
        format!("{head} {} {}", t.and, below1e9(t, r))
    } else {
        head
    })
}

/// 1 ≤ v < 100.
fn below100(t: &RwandaRundiNumbers, v: u64) -> String {
    if v < 10 {
        return t.units[v as usize].clone();
    }
    if v == 10 {
        return t.ten.clone();
    }
    let (tn, u) = (v / 10, v % 10);
    let tens = if tn == 1 {
        t.ten.clone()
    } else {
        t.tens[tn as usize].clone()
    };
    if u != 0 {
        format!("{tens} {} {}", t.and, t.units[u as usize])
    } else {
        tens
    }
}

/// 1 ≤ v < 1000.
fn below1000(t: &RwandaRundiNumbers, v: u64) -> String {
    if v < 100 {
        return below100(t, v);
    }
    let (h, r) = (v / 100, v % 100);
    let hundred = if h == 1 {
        t.hundred.clone()
    } else {
        format!("{} {}", t.hundreds, t.hundreds_mul[h as usize])
    };
    if r != 0 {
        format!("{hundred} {} {}", t.and, below100(t, r))
    } else {
        hundred
    }
}

/// 1 ≤ v < 10⁶.
fn below1e6(t: &RwandaRundiNumbers, v: u64) -> String {
    if v < 1000 {
        return below1000(t, v);
    }
    let (th, r) = (v / 1000, v % 1000);
    let thousand = if th == 1 {
        t.thousand.clone()
    } else if th < 10 {
        format!("{} {}", t.thousands, t.thousands_mul[th as usize])
    } else {
        format!("{} {}", t.thousands, below1000(t, th))
    };
    if r != 0 {
        format!("{thousand} {} {}", t.and, below1e6(t, r))
    } else {
        thousand
    }
}

/// 1 ≤ v < 10⁹.
fn below1e9(t: &RwandaRundiNumbers, v: u64) -> String {
    if v < 1_000_000 {
        return below1e6(t, v);
    }
    let (m, r) = (v / 1_000_000, v % 1_000_000);
    let million = if m == 1 {
        t.million.clone()
    } else {
        format!("{} {}", t.million, below1000(t, m))
    };
    if r != 0 {
        format!("{million} {} {}", t.and, below1e6(t, r))
    } else {
        million
    }
}

/// `numberToWords(n, raw)`: Kinyarwanda's table through the shared compositor.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    compose_rwanda_rundi(n, &MANIFEST.numbers, raw)
}
