//! Galician number → words (RAG cardinals, long scale), 0 … <10¹⁸; anything else digit by digit.
//! Ported from src/languages/galician/numbers.ts — see that file for the conventions.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::numbers::digit_index;

/// 0 ≤ n < 100: 20+ join tens and units with the connector (vinte e un).
fn below100(n: f64) -> String {
    let nm = &MANIFEST.numbers;
    if n < 20.0 {
        return nm.ones[n as usize].clone();
    }
    let (t, u) = ((n / 10.0).floor(), n % 10.0);
    if u == 0.0 {
        nm.tens[t as usize].clone()
    } else {
        format!(
            "{} {} {}",
            nm.tens[t as usize], nm.connector, nm.ones[u as usize]
        )
    }
}

/// 1 ≤ n < 1000: exactly 100 is `cen`.
fn below1000(n: f64) -> String {
    let nm = &MANIFEST.numbers;
    if n == 100.0 {
        return nm.hundred_exact.clone();
    }
    let (h, r) = ((n / 100.0).floor(), n % 100.0);
    let mut parts: Vec<String> = Vec::new();
    if h != 0.0 {
        parts.push(nm.hundreds[h as usize].clone());
    }
    if r != 0.0 {
        parts.push(below100(r));
    }
    parts.join(" ")
}

/// 1 ≤ n < 10⁶.
fn below1e6(n: f64) -> String {
    if n < 1000.0 {
        return below1000(n);
    }
    let (th, r) = ((n / 1000.0).floor(), n % 1000.0);
    let thousand = &MANIFEST.numbers.thousand;
    let head = if th == 1.0 {
        thousand.clone()
    } else {
        format!("{} {thousand}", below1000(th))
    };
    if r != 0.0 {
        format!("{head} {}", below1000(r))
    } else {
        head
    }
}

/// `numberToWords(n, raw?)`. Out of range or unsafe: each CODE POINT of `raw` (else `String(Math.abs(n))`)
/// by its digit word, a non-digit passed through as itself.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    let nm = &MANIFEST.numbers;
    if !is_safe_integer(n) || n < 0.0 || n >= 1e18 {
        let digits = raw
            .cloned()
            .unwrap_or_else(|| js(&js_number_to_string(n.abs())));
        let words: Vec<JsString> = digits
            .code_point_strings()
            .into_iter()
            .map(|d| {
                let i = digit_index(d.char_code_at(0).unwrap_or(0));
                if i >= 0 { js(&nm.ones[i as usize]) } else { d }
            })
            .collect();
        return JsString::join(&words, &js(" "));
    }
    if n == 0.0 {
        return js(&nm.ones[0]);
    }
    if n < 1e6 {
        return js(&below1e6(n));
    }
    let (unit, scale) = if n < 1e12 {
        (1e6, &nm.million)
    } else {
        (1e12, &nm.billion)
    };
    let (q, r) = ((n / unit).floor(), n % unit);
    let head = if q == 1.0 {
        js(&scale.one)
    } else {
        js(&format!("{} {}", below1e6(q), scale.many))
    };
    if r != 0.0 {
        head.concat(&js(" ")).concat(&number_to_words(r, None))
    } else {
        head
    }
}
