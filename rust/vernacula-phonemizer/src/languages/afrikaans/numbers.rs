//! Afrikaans cardinal numbers: unit-en-ten below 100, "en" before a sub-100 remainder, a bare "duisend" but
//! "een miljoen"; 0 … 10⁹−1, digit by digit beyond. Ported from src/languages/afrikaans/numbers.ts — see that
//! file for the sources.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::numbers::digit_index;

fn below100(n: u64) -> String {
    let m = &MANIFEST.numbers;
    if n < 10 {
        return m.units[n as usize].clone();
    }
    if n < 20 {
        return m.teens[(n - 10) as usize].clone();
    }
    let (t, u) = ((n / 10) as usize, (n % 10) as usize);
    if u == 0 {
        m.tens[t].clone()
    } else {
        format!("{} {} {}", m.units[u], m.en, m.tens[t])
    }
}

fn below1000(n: u64) -> String {
    if n < 100 {
        return below100(n);
    }
    let m = &MANIFEST.numbers;
    let (h, rest) = (n / 100, n % 100);
    let head = if h == 1 {
        m.hundred.clone()
    } else {
        format!("{} {}", m.units[h as usize], m.hundred)
    };
    if rest != 0 {
        format!("{head} {} {}", m.en, below100(rest))
    } else {
        head
    }
}

fn magnitude(mult: u64, word: &str, bare_at_one: bool) -> String {
    if mult == 1 && bare_at_one {
        word.to_string()
    } else {
        format!("{} {word}", below1000(mult))
    }
}

/// `numberToWords(n, raw)`.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    let m = &MANIFEST.numbers;
    if !is_safe_integer(n) || n < 0.0 || n >= 1e9 {
        // `(raw ?? String(n)).split("")`: one CODE UNIT at a time.
        let src = raw.cloned().unwrap_or_else(|| js(&js_number_to_string(n)));
        let parts: Vec<JsString> = src
            .units()
            .iter()
            .map(|&u| {
                usize::try_from(digit_index(u))
                    .ok()
                    .and_then(|d| m.units.get(d))
                    .map_or_else(|| JsString::from_units(&[u]), |w| js(w))
            })
            .collect();
        return JsString::join(&parts, &js(" "));
    }
    let mut n = n as u64;
    if n < 1000 {
        return js(&below1000(n));
    }
    let mut parts: Vec<String> = Vec::new();
    if n >= 1_000_000 {
        parts.push(magnitude(n / 1_000_000, &m.million, false));
        n %= 1_000_000;
    }
    if n >= 1000 {
        parts.push(magnitude(n / 1000, &m.thousand, true));
        n %= 1000;
    }
    if n > 0 {
        parts.push(below1000(n));
    }
    js(&parts.join(" "))
}
