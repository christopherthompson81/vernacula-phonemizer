//! Slovenian cardinal → words: the unit-in-ten compound (enaindvajset), the dual/paucal agreement of the
//! magnitude nouns, gendered 2–4 counts, and digit-by-digit reading at 10¹² and above.
//! Ported from src/languages/slovenian/numbers.ts.

use super::manifest::{MANIFEST, Magnitude};
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
    let u = (n % 10) as usize;
    let tens = &t.tens[(n / 10) as usize];
    if u == 0 {
        tens.clone()
    } else {
        format!("{}{}{}", t.units[u], t.and, tens)
    }
}

fn sub1000(n: u64) -> String {
    let (h, r) = ((n / 100) as usize, n % 100);
    if h == 0 {
        return sub100(r);
    }
    let head = &MANIFEST.numbers.hundreds[h];
    if r != 0 {
        format!("{head} {}", sub100(r))
    } else {
        head.clone()
    }
}

fn agree(count: u64, f: &Magnitude) -> &str {
    match count {
        1 => &f.sg,
        2 => &f.dual,
        c if c <= 4 => &f.paucal,
        _ => &f.plural,
    }
}

/// `countWord(n, gender)`: `N.countForms[gender][n] ?? sub1000(n)`.
fn count_word(n: u64, gender: &str) -> String {
    let cf = &MANIFEST.numbers.count_forms;
    let table = if gender == "f" { &cf.f } else { &cf.m };
    table
        .get(&n.to_string())
        .cloned()
        .unwrap_or_else(|| sub1000(n))
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
    if n >= 1e12 {
        let src = raw.cloned().unwrap_or_else(|| js(&js_number_to_string(n)));
        return read_digits(&src);
    }
    let mut n = n as u64;
    let mut parts: Vec<String> = Vec::new();
    let mrd = n / 1_000_000_000;
    n %= 1_000_000_000;
    let mags = &t.magnitudes;
    if mrd != 0 {
        parts.push(if mrd == 1 {
            mags.milliard.sg.clone()
        } else {
            format!("{} {}", count_word(mrd, "f"), agree(mrd, &mags.milliard))
        });
    }
    let mil = n / 1_000_000;
    n %= 1_000_000;
    if mil != 0 {
        parts.push(if mil == 1 {
            mags.million.sg.clone()
        } else {
            format!("{} {}", count_word(mil, "m"), agree(mil, &mags.million))
        });
    }
    let th = n / 1000;
    n %= 1000;
    if th != 0 {
        parts.push(if th == 1 {
            t.thousand.clone()
        } else {
            format!("{} {}", sub1000(th), t.thousand)
        });
    }
    if n != 0 {
        parts.push(sub1000(n));
    }
    js(&parts.join(" "))
}
