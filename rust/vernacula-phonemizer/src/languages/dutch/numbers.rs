//! Dutch cardinals: compound words, units before tens joined by -en- (-ën after a vowel-final unit), split at
//! the thousand/million/milliard boundaries; 0 … <10¹², digit by digit otherwise.
//! Ported from src/languages/dutch/numbers.ts — see that file for the corpus evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::numbers::digit_index;
use crate::js_re;

/// `connect(unit)`: the trema connector after a vowel-final unit.
fn connect(unit: &str) -> &'static str {
    let nm = &MANIFEST.numbers;
    if js_re!("[aeiou]$").test(&js(unit)) {
        &nm.connector_trema
    } else {
        &nm.connector
    }
}

fn below100(n: u64) -> String {
    let nm = &MANIFEST.numbers;
    if n < 20 {
        return nm.ones[n as usize].clone();
    }
    let (t, u) = (n / 10, n % 10);
    if u == 0 {
        return nm.tens[t as usize].clone();
    }
    let unit = &nm.ones[u as usize];
    format!("{unit}{}{}", connect(unit), nm.tens[t as usize])
}

fn below1000(n: u64) -> String {
    let nm = &MANIFEST.numbers;
    if n < 100 {
        return below100(n);
    }
    let (h, r) = (n / 100, n % 100);
    let head = if h == 1 {
        ""
    } else {
        nm.ones[h as usize].as_str()
    };
    let hundred = format!("{head}{}", nm.hundred);
    if r != 0 {
        format!("{hundred}{}", below100(r))
    } else {
        hundred
    }
}

/// `numberToWords(n, raw)`: a non-negative safe integer below 10¹² in words; anything else digit by digit
/// (`raw`, else `String(Math.abs(n))`, a non-digit kept as itself).
pub(crate) fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    let nm = &MANIFEST.numbers;
    if !is_safe_integer(n) || n < 0.0 || n >= 1e12 {
        let src = raw
            .cloned()
            .unwrap_or_else(|| js(&js_number_to_string(n.abs())));
        let words: Vec<JsString> = src
            .code_point_strings()
            .into_iter()
            .map(|d| {
                let i = digit_index(d.units()[0]);
                if d.len() == 1 && i >= 0 {
                    js(&nm.ones[i as usize])
                } else {
                    d
                }
            })
            .collect();
        return JsString::join(&words, &js(" "));
    }
    let n = n as u64;
    if n == 0 {
        return js(&nm.ones[0]);
    }
    if n < 1000 {
        return js(&below1000(n));
    }
    let mut parts: Vec<String> = Vec::new();
    let (mrd, mil, th, r) = (
        n / 1_000_000_000,
        (n % 1_000_000_000) / 1_000_000,
        (n % 1_000_000) / 1000,
        n % 1000,
    );
    if mrd != 0 {
        parts.push(if mrd == 1 {
            nm.milliard.sg.clone()
        } else {
            format!("{} {}", below1000(mrd), nm.milliard.pl)
        });
    }
    if mil != 0 {
        parts.push(if mil == 1 {
            nm.million.sg.clone()
        } else {
            format!("{} {}", below1000(mil), nm.million.pl)
        });
    }
    if th != 0 {
        let head = if th == 1 {
            String::new()
        } else {
            below1000(th)
        };
        parts.push(format!("{head}{}", nm.thousand));
    }
    if r != 0 {
        parts.push(below1000(r));
    }
    js(&parts.join(" "))
}
