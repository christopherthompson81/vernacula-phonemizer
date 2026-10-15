//! Hausa cardinal numbers: lexical units and tens, `ɗari` / `dubu` / `miliyan` / `biliyan` magnitude first with the
//! multiplier after, `da` between parts; "" for anything that is not a non-negative integer below 10^12.
//! Ported from src/languages/hausa/numbers.ts — see that file for the corpus evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};

fn below100(n: f64) -> Vec<String> {
    let nb = &MANIFEST.numbers;
    let (ones, tens) = (&nb.ones, &nb.tens);
    if n < 10.0 {
        return if n == 0.0 {
            vec![]
        } else {
            vec![ones[n as usize].clone()]
        };
    }
    if n < 20.0 {
        return if n == 10.0 {
            vec![tens[1].clone()]
        } else {
            vec![
                tens[1].clone(),
                nb.teens_connector.clone(),
                ones[(n - 10.0) as usize].clone(),
            ]
        };
    }
    let t = (n / 10.0).floor();
    let u = n % 10.0;
    if u == 0.0 {
        vec![tens[t as usize].clone()]
    } else {
        vec![
            tens[t as usize].clone(),
            nb.connector.clone(),
            ones[u as usize].clone(),
        ]
    }
}

fn below1000(n: f64) -> Vec<String> {
    let nb = &MANIFEST.numbers;
    let h = (n / 100.0).floor();
    let r = n % 100.0;
    let mut parts = Vec::new();
    if h > 0.0 {
        parts.push(nb.hundred.clone());
        if h > 1.0 {
            parts.push(nb.ones[h as usize].clone());
        }
    }
    if r > 0.0 {
        if h > 0.0 {
            parts.push(nb.connector.clone());
        }
        parts.extend(below100(r));
    }
    parts
}

fn words(n: f64) -> String {
    let nb = &MANIFEST.numbers;
    if !n.is_finite() || n.fract() != 0.0 || n < 0.0 || n >= 1e12 {
        return String::new();
    }
    if n == 0.0 {
        return nb.ones[0].clone();
    }
    for (value, scale) in [
        (1_000_000_000.0, &nb.billion),
        (1_000_000.0, &nb.million),
        (1000.0, &nb.thousand),
    ] {
        if n >= value {
            let q = (n / value).floor();
            let rest = n % value;
            let mut parts = vec![scale.clone()];
            if q > 1.0 {
                parts.extend(words(q).split(' ').map(str::to_string));
            }
            if rest > 0.0 {
                parts.push(nb.connector.clone());
                parts.extend(words(rest).split(' ').map(str::to_string));
            }
            return parts.join(" ");
        }
    }
    below1000(n).join(" ")
}

/// `numberToWords(n)`: a non-negative integer below 10^12 → Hausa words; "" otherwise.
pub fn number_to_words(n: f64) -> JsString {
    js(&words(n))
}
