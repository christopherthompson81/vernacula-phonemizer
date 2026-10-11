//! Catalan number → words (masculine cardinals, space-separated), 0 … <10⁹; anything else digit by digit.
//! Ported from src/languages/catalan/numbers.ts — see that file for the conventions.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::numbers::digit_index;

/// 1 ≤ n < 100: the 20s take the `i` connector (vint i un), 30–90 juxtapose (trenta un).
fn below100(n: f64) -> String {
    let nm = &MANIFEST.numbers;
    if n < 20.0 {
        return nm.ones[n as usize].clone();
    }
    let (t, u) = ((n / 10.0).floor(), n % 10.0);
    if u == 0.0 {
        return nm.tens[t as usize].clone();
    }
    let conn = if t == 2.0 {
        format!(" {} ", nm.and)
    } else {
        " ".to_string()
    };
    format!("{}{conn}{}", nm.tens[t as usize], nm.ones[u as usize])
}

/// 1 ≤ n < 1000.
fn below1000(n: f64) -> String {
    if n < 100.0 {
        return below100(n);
    }
    let (h, r) = ((n / 100.0).floor(), n % 100.0);
    let hundred = &MANIFEST.numbers.hundreds[h as usize];
    if r != 0.0 {
        format!("{hundred} {}", below100(r))
    } else {
        hundred.clone()
    }
}

/// `numberToWords(n, raw?)`. Out of range or unsafe: each CODE POINT of `raw` (else `String(Math.abs(n))`)
/// by its digit word, a non-digit passed through as itself (`ONES[digitIndex(d)] ?? d`, on the first unit).
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    let nm = &MANIFEST.numbers;
    if !is_safe_integer(n) || n < 0.0 || n >= 1e9 {
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
    if n < 1000.0 {
        return js(&below1000(n));
    }
    let mut parts: Vec<String> = Vec::new();
    let (mil, th, r) = ((n / 1e6).floor(), ((n % 1e6) / 1000.0).floor(), n % 1000.0);
    if mil != 0.0 {
        parts.push(if mil == 1.0 {
            nm.million.sg.clone()
        } else {
            format!("{} {}", below1000(mil), nm.million.pl)
        });
    }
    if th != 0.0 {
        parts.push(if th == 1.0 {
            nm.thousand.clone()
        } else {
            format!("{} {}", below1000(th), nm.thousand)
        });
    }
    if r != 0.0 {
        parts.push(below1000(r));
    }
    js(&parts.join(" "))
}
