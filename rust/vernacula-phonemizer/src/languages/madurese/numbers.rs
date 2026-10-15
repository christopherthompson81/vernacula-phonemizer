//! Madurese cardinal numbers → space-separated words (multiplier then magnitude, descending, to 10¹²); digit at a
//! time from 10¹⁵ or for an unsafe number. Ported from src/languages/madurese/numbers.ts — see that file for the
//! corpus evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};

fn below_100(n: f64) -> String {
    let nm = &MANIFEST.numbers;
    if n < 10.0 {
        return nm.units[n as usize].clone();
    }
    if n == 10.0 {
        return nm.ten.clone();
    }
    let t = (n / 10.0).floor();
    let u = n % 10.0;
    let tens = if t == 1.0 {
        nm.ten.clone()
    } else {
        format!("{} {}", nm.units[t as usize], nm.tens)
    };
    if u != 0.0 {
        format!("{tens} {} {}", nm.and, nm.units[u as usize])
    } else {
        tens
    }
}

fn below_1000(n: f64) -> String {
    let nm = &MANIFEST.numbers;
    if n < 100.0 {
        return below_100(n);
    }
    let h = (n / 100.0).floor();
    let r = n % 100.0;
    let hundred = if h == 1.0 {
        nm.hundred.clone()
    } else {
        format!("{} {}", nm.units[h as usize], nm.hundred)
    };
    if r != 0.0 {
        format!("{hundred} {} {}", nm.and, below_100(r))
    } else {
        hundred
    }
}

const CAP: f64 = 1e15;

/// `numberToWords(n, raw)`.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    let nm = &MANIFEST.numbers;
    if !is_safe_integer(n) || n < 0.0 || n >= CAP {
        let digits = raw
            .cloned()
            .unwrap_or_else(|| js(&js_number_to_string(n.abs())));
        // `N.units[digitIndex(d)] ?? d`: an ASCII digit by its word, anything else as written.
        let parts: Vec<JsString> = digits
            .code_point_strings()
            .into_iter()
            .map(|d| match d.units() {
                [u] if (b'0' as u16..=b'9' as u16).contains(u) => {
                    js(&nm.units[(*u - b'0' as u16) as usize])
                }
                _ => d,
            })
            .collect();
        return JsString::join(&parts, &js(" "));
    }
    if n == 0.0 {
        return js(&nm.units[0]);
    }
    let scales = [
        (1e12, &nm.trillion),
        (1e9, &nm.billion),
        (1e6, &nm.million),
        (1e3, &nm.thousand),
    ];
    for (value, word) in scales {
        if n < value {
            continue;
        }
        let count = (n / value).floor();
        let r = n % value;
        let head = if count == 1.0 {
            word.clone()
        } else {
            format!("{} {word}", number_to_words(count, None).to_string_lossy())
        };
        return js(&if r != 0.0 {
            format!(
                "{head} {} {}",
                nm.and,
                number_to_words(r, None).to_string_lossy()
            )
        } else {
            head
        });
    }
    js(&below_1000(n))
}
