//! Finnish cardinal compositor: below 1000 one concatenated word, ⟨tuhat⟩ joined and ⟨miljoona⟩ separate, below
//! 10⁹; digit by digit otherwise.
//! Ported from src/languages/finnish/numbers.ts — see that file for the orthography.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number, js_number_to_string};
use crate::core::numbers::digit_index;

/// `below100(n)`, 1 ≤ n < 100.
fn below100(n: f64) -> String {
    let m = &MANIFEST.numbers;
    if n < 10.0 {
        return m.units[n as usize].clone();
    }
    if n == 10.0 {
        return m.ten.clone();
    }
    if n < 20.0 {
        return format!("{}{}", m.units[(n - 10.0) as usize], m.teen_suffix);
    }
    let (t, o) = ((n / 10.0).floor() as usize, n % 10.0);
    let ones = if o != 0.0 {
        m.units[o as usize].as_str()
    } else {
        ""
    };
    format!("{}{}{}", m.units[t], m.tens_stem, ones)
}

/// `below1000(n)`, 1 ≤ n < 1000.
fn below1000(n: f64) -> String {
    let m = &MANIFEST.numbers;
    if n < 100.0 {
        return below100(n);
    }
    let (h, r) = ((n / 100.0).floor() as usize, n % 100.0);
    let hundred = if h == 1 {
        m.hundred.clone()
    } else {
        format!("{}{}", m.units[h], m.hundred_stem)
    };
    if r != 0.0 {
        hundred + &below100(r)
    } else {
        hundred
    }
}

/// `readDigits(digits)`: each UTF-16 unit (`split("")`); `Number(d) === 0` (a `0`, and also any one-unit JS
/// whitespace) reads as zero, a digit by `digitIndex`, anything else as itself.
pub fn read_digits(digits: &JsString) -> JsString {
    let m = &MANIFEST.numbers;
    let words: Vec<JsString> = digits
        .0
        .iter()
        .map(|&u| {
            let d = JsString::from_units(&[u]);
            if js_number(&d) == 0.0 {
                return js(&m.zero);
            }
            let i = digit_index(u);
            if i >= 0 { js(&m.units[i as usize]) } else { d }
        })
        .collect();
    JsString::join(&words, &js(" "))
}

/// `numberToWords(n, raw)`: a safe integer in [0, 10⁹) as words; otherwise digit by digit over `raw ?? String(n)`.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    if !is_safe_integer(n) || n < 0.0 || n >= 1e9 {
        return read_digits(&raw.cloned().unwrap_or_else(|| js(&js_number_to_string(n))));
    }
    let m = &MANIFEST.numbers;
    if n == 0.0 {
        return js(&m.zero);
    }
    let mut parts: Vec<String> = Vec::new();
    let mil = (n / 1e6).floor();
    let after = n % 1e6;
    if mil > 0.0 {
        if mil == 1.0 {
            parts.push(m.million.clone());
        } else {
            parts.push(below1000(mil));
            parts.push(m.million_stem.clone());
        }
    }
    let th = (after / 1000.0).floor();
    let rem = after % 1000.0;
    if th > 0.0 {
        parts.push(if th == 1.0 {
            m.thousand.clone()
        } else {
            below1000(th) + &m.thousand_stem
        });
    }
    if rem > 0.0 {
        parts.push(below1000(rem));
    }
    js(&parts.join(" "))
}
