//! Setswana cardinal numbers as space-separated words: the bo- counting series, ma- tens and hundreds, di- thousands,
//! joined with `le`; digit by digit at and above a million and outside the safe-integer range.
//! Ported from src/languages/setswana/numbers.ts — see that file for the sources.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number, js_number_to_string};

fn below100(n: u64) -> String {
    let num = &MANIFEST.numbers;
    if n < 10 {
        return num.units[n as usize].clone();
    }
    if n == 10 {
        return num.ten.clone();
    }
    let (t, u) = (n / 10, n % 10);
    let tens = if t == 1 {
        num.ten.clone()
    } else {
        format!("{} {} {}", num.tens_word, num.of, num.mult[t as usize])
    };
    if u != 0 {
        format!("{tens} {} {}", num.and, num.units[u as usize])
    } else {
        tens
    }
}

fn below1000(n: u64) -> String {
    let num = &MANIFEST.numbers;
    if n < 100 {
        return below100(n);
    }
    let (h, r) = (n / 100, n % 100);
    let hundred = if h == 1 {
        num.hundred.clone()
    } else {
        format!("{} {} {}", num.hundreds_word, num.of, num.mult[h as usize])
    };
    if r != 0 {
        format!("{hundred} {} {}", num.and, below100(r))
    } else {
        hundred
    }
}

/// `numberToWords(n, raw?)`: a non-negative integer below a million → Setswana words; otherwise each code point by
/// `units[Number(d)]` (`0` by the zero word), a miss joined as the empty string, as `Array.join` does.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    let num = &MANIFEST.numbers;
    if !is_safe_integer(n) || n < 0.0 || n >= 1e6 {
        let digits = match raw {
            Some(r) => r.clone(),
            None => js(&js_number_to_string(n.abs())),
        };
        let parts: Vec<JsString> = digits
            .code_point_strings()
            .into_iter()
            .map(|d| {
                if d == "0" {
                    return js(&num.zero);
                }
                let v = js_number(&d);
                if v >= 0.0 && v.fract() == 0.0 && (v as usize) < num.units.len() {
                    js(&num.units[v as usize])
                } else {
                    JsString::new()
                }
            })
            .collect();
        return JsString::join(&parts, &js(" "));
    }
    let n = n as u64;
    if n == 0 {
        return js(&num.zero);
    }
    if n < 1000 {
        return js(&below1000(n));
    }
    let (th, r) = (n / 1000, n % 1000);
    let thousand = if th == 1 {
        num.thousand.clone()
    } else {
        let mult = if th < 10 {
            num.di_mult[th as usize].clone()
        } else {
            below1000(th)
        };
        format!("{} {} {mult}", num.thousands_word, num.these)
    };
    if r != 0 {
        js(&format!("{thousand} {} {}", num.and, below1000(r)))
    } else {
        js(&thousand)
    }
}
