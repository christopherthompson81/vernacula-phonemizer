//! Polish cardinal compositor: space-separated Polish words (below 10¹²; digit by digit otherwise), with the
//! Polish three-way magnitude agreement (an exact 1 alone takes the singular).
//! Ported from src/languages/polish/numbers.ts — see that file for the sources.

use super::manifest::{Agreement, MANIFEST};
use crate::core::js_string::{JsString, js, js_number_to_string};
use crate::core::numbers::digit_index;

/// `sub100(n)`, 0 ≤ n < 100.
fn sub100(n: f64) -> String {
    let m = &MANIFEST.numbers;
    if n < 10.0 {
        return m.units[n as usize].clone();
    }
    if n < 20.0 {
        return m.teens[(n - 10.0) as usize].clone();
    }
    let (t, u) = ((n / 10.0).floor() as usize, (n % 10.0) as usize);
    if u == 0 {
        m.tens[t].clone()
    } else {
        format!("{} {}", m.tens[t], m.units[u])
    }
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

/// `agree(count, forms)`: EXACTLY 1 → sg; …2–4 (not …12–14) → paucal; else gen-pl.
fn agree(count: f64, forms: &Agreement) -> &str {
    if count == 1.0 {
        return &forms.sg;
    }
    let (m100, m10) = (count % 100.0, count % 10.0);
    if (12.0..=14.0).contains(&m100) {
        return &forms.plural;
    }
    if (2.0..=4.0).contains(&m10) {
        &forms.paucal
    } else {
        &forms.plural
    }
}

/// `magnitude(count, forms)`: a bare count of 1 drops the numeral.
fn magnitude(count: f64, forms: &Agreement) -> String {
    if count == 1.0 {
        forms.sg.clone()
    } else {
        format!("{} {}", sub1000(count), agree(count, forms))
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

/// `numberToWords(n, raw)`: a non-negative number (floored) below 10¹² as words; `""` for a negative or
/// non-finite one; digit by digit over `raw ?? String(n)` from 10¹².
pub(crate) fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    if n < 0.0 || !n.is_finite() {
        return JsString::new();
    }
    let mut n = n.floor();
    let m = &MANIFEST.numbers;
    if n == 0.0 {
        return js(&m.units[0]);
    }
    if n >= 1e12 {
        return read_digits(&raw.cloned().unwrap_or_else(|| js(&js_number_to_string(n))));
    }
    let mag = &m.magnitudes;
    let mut parts: Vec<String> = Vec::new();
    let bil = (n / 1e9).floor();
    n %= 1e9;
    if bil != 0.0 {
        parts.push(magnitude(bil, &mag.billion));
    }
    let mil = (n / 1e6).floor();
    n %= 1e6;
    if mil != 0.0 {
        parts.push(magnitude(mil, &mag.million));
    }
    let th = (n / 1000.0).floor();
    n %= 1000.0;
    if th != 0.0 {
        parts.push(magnitude(th, &mag.thousand));
    }
    if n != 0.0 {
        parts.push(sub1000(n));
    }
    js(&parts.join(" "))
}
