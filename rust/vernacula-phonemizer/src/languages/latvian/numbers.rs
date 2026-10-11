//! Latvian cardinal → words: tens + units spaced, -padsmit teens, the counted hundred/thousand/million nouns
//! (singular after …1 but not …11); digit by digit at 10⁹ and above.
//! Ported from src/languages/latvian/numbers.ts.

use super::manifest::{MANIFEST, OneMany};
use crate::core::js_string::{JsString, js, js_number_to_string};
use crate::core::numbers::digit_index;

fn sub100(n: u64) -> String {
    let t = &MANIFEST.numbers;
    if n < 10 {
        return t.units[n as usize].clone();
    }
    if n < 20 {
        return t.teens[(n - 10) as usize].clone();
    }
    let (tn, u) = ((n / 10) as usize, (n % 10) as usize);
    if u == 0 {
        t.tens[tn].clone()
    } else {
        format!("{} {}", t.tens[tn], t.units[u])
    }
}

fn sub1000(n: u64) -> String {
    let (h, r) = (n / 100, n % 100);
    if h == 0 {
        return sub100(r);
    }
    let hundred = &MANIFEST.numbers.hundred;
    let hw = if h == 1 {
        hundred.one.clone()
    } else {
        format!("{} {}", sub100(h), hundred.many)
    };
    if r != 0 {
        format!("{hw} {}", sub100(r))
    } else {
        hw
    }
}

fn agree(count: u64, f: &OneMany) -> &str {
    if count % 10 == 1 && count % 100 != 11 {
        &f.one
    } else {
        &f.many
    }
}

fn magnitude(count: u64, f: &OneMany, keep_one: bool) -> String {
    if count == 1 {
        return if keep_one {
            format!("{} {}", MANIFEST.numbers.units[1], f.one)
        } else {
            f.one.clone()
        };
    }
    format!("{} {}", sub1000(count), agree(count, f))
}

/// `readDigits(digits)`: each UTF-16 unit by its digit word, anything else passed through.
pub fn read_digits(digits: &JsString) -> JsString {
    let units = &MANIFEST.numbers.units;
    let words: Vec<JsString> = digits
        .0
        .iter()
        .map(|&u| {
            let i = digit_index(u);
            if i >= 0 {
                js(&units[i as usize])
            } else {
                JsString::from_units(&[u])
            }
        })
        .collect();
    JsString::join(&words, &js(" "))
}

/// `numberToWords(n, raw)`: "" for a negative or non-finite number.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    if n < 0.0 || !n.is_finite() {
        return JsString::new();
    }
    let n = n.floor();
    let t = &MANIFEST.numbers;
    if n == 0.0 {
        return js(&t.units[0]);
    }
    if n >= 1e9 {
        let src = raw.cloned().unwrap_or_else(|| js(&js_number_to_string(n)));
        return read_digits(&src);
    }
    let mut n = n as u64;
    let mut parts: Vec<String> = Vec::new();
    let mil = n / 1_000_000;
    n %= 1_000_000;
    if mil != 0 {
        parts.push(magnitude(mil, &t.million, true));
    }
    let th = n / 1000;
    n %= 1000;
    if th != 0 {
        parts.push(magnitude(th, &t.thousand, false));
    }
    if n != 0 {
        parts.push(sub1000(n));
    }
    js(&parts.join(" "))
}
