//! Slovak cardinal compositor: space-separated Slovak words (tens and units concatenated, below 10⁹; digit by
//! digit otherwise), with the three-way magnitude agreement (1 / 2–4 / 5+) and the masculine-inanimate dva.
//! Ported from src/languages/slovak/numbers.ts — see that file for the sources.

use super::manifest::{Agreement, MANIFEST};
use crate::core::js_string::{JsString, js, js_number_to_string};
use crate::core::numbers::digit_index;

/// `sub100(n)`, 0 ≤ n < 100: tens and units concatenated.
fn sub100(n: f64) -> String {
    let m = &MANIFEST.numbers;
    if n < 10.0 {
        return m.units[n as usize].clone();
    }
    if n < 20.0 {
        return m.teens[(n - 10.0) as usize].clone();
    }
    let u = n % 10.0;
    let mut s = m.tens[(n / 10.0).floor() as usize].clone();
    if u != 0.0 {
        s.push_str(&m.units[u as usize]);
    }
    s
}

/// `sub1000(n)`, 0 ≤ n < 1000.
fn sub1000(n: f64) -> String {
    let m = &MANIFEST.numbers;
    let (h, r) = ((n / 100.0).floor() as usize, n % 100.0);
    if h == 0 {
        return sub100(r);
    }
    if r != 0.0 {
        format!("{} {}", m.hundreds[h], sub100(r))
    } else {
        m.hundreds[h].clone()
    }
}

/// `agree(count, forms)`: 1 → sg, 2–4 → paucal, else plural.
fn agree(count: f64, forms: &Agreement) -> &str {
    if count == 1.0 {
        &forms.sg
    } else if (2.0..=4.0).contains(&count) {
        &forms.paucal
    } else {
        &forms.plural
    }
}

/// `readDigits(digits)`: each UTF-16 unit (`split("")`) as its unit word, a non-digit kept as itself.
pub fn read_digits(digits: &JsString) -> JsString {
    let words: Vec<JsString> = digits
        .0
        .iter()
        .map(|&u| {
            let i = digit_index(u);
            if i >= 0 {
                js(&MANIFEST.numbers.units[i as usize])
            } else {
                JsString::from_units(&[u])
            }
        })
        .collect();
    JsString::join(&words, &js(" "))
}

/// `numberToWords(n, raw)`: a non-negative number (floored) below 10⁹ as words; `""` for a negative or
/// non-finite one; digit by digit over `raw ?? String(n)` from 10⁹.
pub(crate) fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    if n < 0.0 || !n.is_finite() {
        return JsString::new();
    }
    let mut n = n.floor();
    let m = &MANIFEST.numbers;
    if n == 0.0 {
        return js(&m.units[0]);
    }
    if n >= 1e9 {
        return read_digits(&raw.cloned().unwrap_or_else(|| js(&js_number_to_string(n))));
    }
    let mag = &m.magnitudes;
    let mut parts: Vec<String> = Vec::new();
    let mil = (n / 1e6).floor();
    n %= 1e6;
    if mil != 0.0 {
        let head = if mil == 1.0 {
            String::new()
        } else {
            format!("{} ", sub1000(mil))
        };
        parts.push(head + agree(mil, &mag.million));
    }
    let th = (n / 1000.0).floor();
    n %= 1000.0;
    if th != 0.0 {
        parts.push(if th == 1.0 {
            mag.thousand.sg.clone()
        } else {
            format!("{} {}", sub1000(th), agree(th, &mag.thousand))
        });
    }
    if n != 0.0 {
        parts.push(sub1000(n));
    }
    js(&parts.join(" "))
}
