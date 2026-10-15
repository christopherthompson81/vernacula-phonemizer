//! Igbo cardinal numbers: the modern decimal system, magnitude first and multiplier second, parts joined by `na`,
//! with a digit-by-digit floor above 10^12 and for non-finite or non-integer input.
//! Ported from src/languages/igbo/numbers.ts — see that file for the corpus evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js, js_number_to_string};
use crate::core::numbers::digit_index;

fn unit(n: f64) -> &'static str {
    &MANIFEST.numbers.units[n as usize]
}

fn scaled(magnitude: &str, multiplier: f64) -> String {
    let nb = &MANIFEST.numbers;
    if multiplier == 1.0 {
        format!("{} {magnitude}", nb.one)
    } else {
        format!("{magnitude} {}", unit(multiplier))
    }
}

fn below100(n: f64) -> String {
    let nb = &MANIFEST.numbers;
    if n < 10.0 {
        return if n == 1.0 {
            nb.one.clone()
        } else {
            unit(n).to_string()
        };
    }
    let t = (n / 10.0).floor();
    let u = n % 10.0;
    let tens = if t == 1.0 {
        nb.ten.clone()
    } else {
        format!("{} {}", nb.ten, unit(t))
    };
    if u == 0.0 {
        tens
    } else {
        let w = if u == 1.0 { nb.one.as_str() } else { unit(u) };
        format!("{tens} {} {w}", nb.and)
    }
}

fn below1000(n: f64) -> String {
    if n < 100.0 {
        return below100(n);
    }
    let h = (n / 100.0).floor();
    let r = n % 100.0;
    let hundreds = scaled(&MANIFEST.numbers.hundred, h);
    if r == 0.0 {
        hundreds
    } else {
        format!("{hundreds} {} {}", MANIFEST.numbers.and, below100(r))
    }
}

fn group(n: f64, size: f64, magnitude: &str) -> String {
    let nb = &MANIFEST.numbers;
    let count = (n / size).floor();
    let rest = n % size;
    let head = if count == 1.0 {
        format!("{} {magnitude}", nb.one)
    } else {
        format!("{magnitude} {}", below1000(count))
    };
    if rest == 0.0 {
        head
    } else {
        format!("{head} {} {}", nb.and, to_words(rest))
    }
}

/// `digits(s)`: each code point by its unit word; a non-digit passes through as itself (`units[-1] ?? d`).
fn digits(s: &JsString) -> String {
    let nb = &MANIFEST.numbers;
    s.code_point_strings()
        .iter()
        .map(|d| {
            if *d == "0" {
                nb.zero.clone()
            } else if *d == "1" {
                nb.one.clone()
            } else {
                let k = if d.len() == 1 {
                    digit_index(d.0[0])
                } else {
                    -1
                };
                match usize::try_from(k).ok().and_then(|k| nb.units.get(k)) {
                    Some(w) => w.clone(),
                    None => d.to_string_lossy(),
                }
            }
        })
        .filter(|w| !w.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

fn to_words(n: f64) -> String {
    let nb = &MANIFEST.numbers;
    if n == 0.0 {
        return nb.zero.clone();
    }
    if n < 1000.0 {
        return below1000(n);
    }
    if n < 1_000_000.0 {
        return group(n, 1000.0, &nb.thousand);
    }
    if n < 1_000_000_000.0 {
        return group(n, 1_000_000.0, &nb.million);
    }
    if n < 1_000_000_000_000.0 {
        return group(n, 1_000_000_000.0, &nb.billion);
    }
    String::new()
}

/// `numberToWords(n, raw)`: an Igbo cardinal, or a digit-by-digit reading out of range or for a non-integer.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    let fallback = || match raw {
        Some(r) => js(&digits(r)),
        None => js(&digits(&js(&js_number_to_string(n)))),
    };
    if !n.is_finite() || n.fract() != 0.0 || n < 0.0 {
        return fallback();
    }
    let words = to_words(n);
    if words.is_empty() {
        fallback()
    } else {
        js(&words)
    }
}
