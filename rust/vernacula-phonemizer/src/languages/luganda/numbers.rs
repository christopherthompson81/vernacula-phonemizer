//! Luganda cardinals: the teens with `na` / elided `n'`, the `mu` connector, the class multipliers of the
//! hundreds and of the bu- millions and billions, digit by digit for an unsafe integer.
//! Ported from src/languages/luganda/numbers.ts — see that file for the corpus evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::numbers::digit_index;
use crate::js_re;

/// 1 ≤ n < 100.
fn below100(n: u64) -> String {
    let t = &MANIFEST.numbers;
    if n < 10 {
        return t.units[n as usize].clone();
    }
    let (tn, u) = (n / 10, n % 10);
    if tn == 1 {
        if u == 0 {
            return t.ten.clone();
        }
        let unit = &t.units[u as usize];
        return if js_re!(r"^[aeiou]", "u").test(&js(unit)) {
            format!("{} {}{unit}", t.ten, t.and_teen_elided)
        } else {
            format!("{} {} {unit}", t.ten, t.and_teen)
        };
    }
    if u == 0 {
        t.tens[tn as usize].clone()
    } else {
        format!("{} {} {}", t.tens[tn as usize], t.mu, t.units[u as usize])
    }
}

/// 1 ≤ n < 1000.
fn below1000(n: u64) -> String {
    let t = &MANIFEST.numbers;
    if n < 100 {
        return below100(n);
    }
    let (h, r) = (n / 100, n % 100);
    let hundred = if h == 1 {
        t.hundred_one.clone()
    } else {
        format!("{} {}", t.hundreds, t.hundreds_mult[h as usize])
    };
    if r != 0 {
        format!("{hundred} {} {}", t.mu, below1000(r))
    } else {
        hundred
    }
}

/// `buMultiplier(k)`.
fn bu_multiplier(k: u64) -> String {
    if (2..=9).contains(&k) {
        MANIFEST.numbers.bu_mult[k as usize].clone()
    } else {
        compose(k)
    }
}

/// `numberToWords(n, raw)`: a non-negative safe integer → words; anything else digit by digit.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    let t = &MANIFEST.numbers;
    if !is_safe_integer(n) || n < 0.0 {
        let digits = raw
            .cloned()
            .unwrap_or_else(|| js(&js_number_to_string(n.abs())));
        let words: Vec<JsString> = digits
            .code_point_strings()
            .into_iter()
            .map(|d| {
                if d == js("0") {
                    return js(&t.zero);
                }
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
    js(&compose(n as u64))
}

/// The composing branch of `numberToWords` (a non-negative safe integer).
fn compose(n: u64) -> String {
    let t = &MANIFEST.numbers;
    if n == 0 {
        return t.zero.clone();
    }
    let mut parts: Vec<String> = Vec::new();
    let b = n / 1_000_000_000;
    if b > 0 {
        parts.push(if b == 1 {
            t.billion_one.clone()
        } else {
            format!("{} {}", t.billions, bu_multiplier(b))
        });
    }
    let m = (n % 1_000_000_000) / 1_000_000;
    if m > 0 {
        parts.push(if m == 1 {
            t.million_one.clone()
        } else {
            format!("{} {}", t.millions, bu_multiplier(m))
        });
    }
    let th = (n % 1_000_000) / 1000;
    if th > 0 {
        parts.push(if th == 1 {
            t.thousand_one.clone()
        } else {
            format!("{} {}", t.thousands, compose(th))
        });
    }
    let r = n % 1000;
    if r > 0 {
        parts.push(below1000(r));
    }
    parts.join(&format!(" {} ", t.mu))
}
