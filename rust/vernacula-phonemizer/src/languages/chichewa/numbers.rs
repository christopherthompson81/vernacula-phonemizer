//! Chichewa cardinals: the class-6 multiplier series for tens and hundreds, the loan magnitudes (miliyoni /
//! biliyoni) with their own concord, digit by digit from 10¹² up.
//! Ported from src/languages/chichewa/numbers.ts — see that file for the corpus evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::numbers::digit_index;

/// 1 ≤ n < 100 in `series`.
fn below100(n: u64, series: &[String]) -> String {
    let t = &MANIFEST.numbers;
    if n < 10 {
        return series[n as usize].clone();
    }
    if n == 10 {
        return t.ten.clone();
    }
    let (tn, u) = (n / 10, n % 10);
    let tens = if tn == 1 {
        t.ten.clone()
    } else {
        format!("{} {}", t.tens, t.class_six[tn as usize])
    };
    if u != 0 {
        format!("{tens} {} {}", t.and, series[u as usize])
    } else {
        tens
    }
}

/// 1 ≤ n < 1000 in `series`.
fn below1000(n: u64, series: &[String]) -> String {
    let t = &MANIFEST.numbers;
    if n < 100 {
        return below100(n, series);
    }
    let (h, r) = (n / 100, n % 100);
    let hundred = if h == 1 {
        t.hundred.clone()
    } else {
        format!("{} {}", t.hundreds, t.class_six[h as usize])
    };
    if r != 0 {
        format!("{hundred} {} {}", t.and, below100(r, series))
    } else {
        hundred
    }
}

/// `loanMagnitude(count, singular, plural)`.
fn loan_magnitude(count: u64, singular: &str, plural: &str) -> String {
    let t = &MANIFEST.numbers;
    if count == 1 {
        format!("{singular} {}", t.class_nine_one)
    } else {
        format!("{plural} {}", below1000(count, &t.class_six))
    }
}

/// `numberToWords(n, raw)`: a non-negative safe integer below 10¹² → words; anything else digit by digit.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    let t = &MANIFEST.numbers;
    if !is_safe_integer(n) || n < 0.0 || n >= 1e12 {
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
    let (b, m, th, r) = (
        n / 1_000_000_000,
        (n / 1_000_000) % 1000,
        (n / 1000) % 1000,
        n % 1000,
    );
    let mut parts: Vec<String> = Vec::new();
    if b != 0 {
        parts.push(loan_magnitude(b, &t.billion, &t.billions));
    }
    if m != 0 {
        parts.push(loan_magnitude(m, &t.million, &t.millions));
    }
    if th != 0 {
        parts.push(if th == 1 {
            t.thousand.clone()
        } else {
            format!("{} {}", t.thousands, below1000(th, &t.units))
        });
    }
    if r != 0 {
        parts.push(below1000(r, &t.units));
    }
    js(&parts.join(&format!(" {} ", t.and)))
}
