//! Lithuanian cardinal → words: the hundred and every magnitude are counted nouns in the Baltic three-way
//! concord (`agree`, shared with normalize.ts); digit by digit at 10¹² and above.
//! Ported from src/languages/lithuanian/numbers.ts — see that file for the sources.

use super::manifest::{Agreement, MANIFEST};
use crate::core::js_string::{JsString, js, js_number_to_string};
use crate::core::numbers::digit_index;

/// `agree(count, forms)`: 11–19 → gen pl, …1 → nom sg, …0 → gen pl, …2–9 → nom pl (JS `%` on a number).
pub fn agree(count: f64, forms: &Agreement) -> &str {
    let (m100, m10) = (count % 100.0, count % 10.0);
    if (11.0..=19.0).contains(&m100) {
        &forms.gen_pl
    } else if m10 == 1.0 {
        &forms.sg
    } else if m10 == 0.0 {
        &forms.gen_pl
    } else {
        &forms.pl
    }
}

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
    let t = &MANIFEST.numbers;
    let (h, r) = (n / 100, n % 100);
    if h == 0 {
        return sub100(r);
    }
    let hundred = &t.magnitudes.hundred;
    let hw = if h == 1 {
        hundred.sg.clone()
    } else {
        format!("{} {}", t.units[h as usize], agree(h as f64, hundred))
    };
    if r != 0 {
        format!("{hw} {}", sub100(r))
    } else {
        hw
    }
}

fn magnitude(count: u64, forms: &Agreement, keep_one: bool) -> String {
    if count == 1 {
        return if keep_one {
            format!("{} {}", MANIFEST.numbers.units[1], forms.sg)
        } else {
            forms.sg.clone()
        };
    }
    format!("{} {}", sub1000(count), agree(count as f64, forms))
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
    let mags = &t.magnitudes;
    let mut parts: Vec<String> = Vec::new();
    let bil = n / 1_000_000_000;
    n %= 1_000_000_000;
    if bil != 0 {
        parts.push(magnitude(bil, &mags.billion, true));
    }
    let mil = n / 1_000_000;
    n %= 1_000_000;
    if mil != 0 {
        parts.push(magnitude(mil, &mags.million, true));
    }
    let th = n / 1000;
    n %= 1000;
    if th != 0 {
        parts.push(magnitude(th, &mags.thousand, false));
    }
    if n != 0 {
        parts.push(sub1000(n));
    }
    js(&parts.join(" "))
}
