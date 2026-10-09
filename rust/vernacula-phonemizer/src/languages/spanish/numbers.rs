//! Spanish number → words (long scale: millón = 10⁶), 0 … <10¹⁸; anything else reads digit by digit.
//! Ported from src/languages/spanish/numbers.ts — see that file for the evidence.
//!
//! JS `Number` arithmetic throughout (`f64`, `Math.floor`, `%`), as the TS does it.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number, js_number_to_string};

fn ones(i: f64) -> JsString {
    js(&MANIFEST.numbers.ones[i as usize])
}

/// 0 ≤ n < 100
fn below100(n: f64) -> JsString {
    let nm = &MANIFEST.numbers;
    if n < 30.0 {
        return ones(n);
    }
    let (t, u) = ((n / 10.0).floor(), n % 10.0);
    if u == 0.0 {
        js(&nm.tens[t as usize])
    } else {
        js(&format!(
            "{} {} {}",
            nm.tens[t as usize], nm.connector, nm.ones[u as usize]
        ))
    }
}

/// 1 ≤ n < 1000
fn below1000(n: f64) -> JsString {
    let nm = &MANIFEST.numbers;
    if n == 100.0 {
        return js(&nm.hundred_exact);
    }
    let (h, r) = ((n / 100.0).floor(), n % 100.0);
    let mut parts: Vec<JsString> = Vec::new();
    if h != 0.0 {
        parts.push(js(&nm.hundreds[h as usize]));
    }
    if r != 0.0 {
        parts.push(below100(r));
    }
    JsString::join(&parts, &js(" "))
}

/// 1 ≤ n < 10⁶
fn below1e6(n: f64) -> JsString {
    if n < 1000.0 {
        return below1000(n);
    }
    let (th, r) = ((n / 1000.0).floor(), n % 1000.0);
    let mut thousand = js(&MANIFEST.numbers.thousand);
    if th != 1.0 {
        thousand = below1000(th).concat(&js(" ")).concat(&thousand);
    }
    if r != 0.0 {
        thousand.concat(&js(" ")).concat(&below1000(r))
    } else {
        thousand
    }
}

/// `numberToWords(n, raw?)`: a non-negative integer → words; out of range or unsafe reads digit by digit, from
/// `raw` when given.
pub(crate) fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    if !is_safe_integer(n) || n < 0.0 || n >= 1e18 {
        // ⚠ `String(Math.abs(n))`: reached only without `raw`, which no caller does for an unsafe value
        // (every unsafe one comes from a digit token, which passes its digits). A non-digit indexes `ONES`
        // with NaN, and `Array.join` writes the `undefined` slot as the EMPTY string; reproduced.
        let digits = raw
            .cloned()
            .unwrap_or_else(|| js(&js_number_to_string(n.abs())));
        let words: Vec<JsString> = digits
            .code_point_strings()
            .iter()
            .map(|d| {
                let i = js_number(d);
                MANIFEST
                    .numbers
                    .ones
                    .get(i as usize)
                    .filter(|_| i.fract() == 0.0 && i >= 0.0)
                    .map_or_else(|| js(""), |w| js(w))
            })
            .collect();
        return JsString::join(&words, &js(" "));
    }
    if n == 0.0 {
        return ones(0.0);
    }
    if n < 1e6 {
        return below1e6(n);
    }
    for sc in &MANIFEST.numbers.scales {
        if n < sc.value {
            continue;
        }
        let (q, r) = ((n / sc.value).floor(), n % sc.value);
        let head = if q == 1.0 {
            js(&sc.one)
        } else {
            below1e6(q).concat(&js(" ")).concat(&js(&sc.many))
        };
        return if r != 0.0 {
            head.concat(&js(" ")).concat(&number_to_words(r, None))
        } else {
            head
        };
    }
    below1e6(n)
}
