//! Portuguese number → words, European by default with the Brazilian dez-e- teens for `Dialect::Bp`.
//! Ported from src/languages/portuguese/numbers.ts — see that file for the evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::js_re;

/// `"ep" | "bp"`: the one dialect type for the whole engine.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Dialect {
    Ep,
    Bp,
}

/// The number token (TS `NUMBER_TOKEN`): one source for the tokenizer and the degree count.
pub const NUMBER_TOKEN: &str = r"\d+(?:(?<!(?<!\d)0)\.\d+)*(?:,\d+)?";

/// `splitNumberToken`: the integer digits (thousands dots removed) and the decimal digits, if any.
pub fn split_number_token(tok: &JsString) -> (JsString, Option<JsString>) {
    let parts = tok.split(&js(","));
    let int_digits = js_re!(r"\.", "g").replace(&parts[0], &JsString::new());
    (int_digits, parts.get(1).cloned())
}

fn small(i: f64, dialect: Dialect) -> Option<String> {
    let n = &MANIFEST.numbers;
    if dialect == Dialect::Bp {
        let bp = match i {
            16.0 => Some("dezesseis"),
            17.0 => Some("dezessete"),
            19.0 => Some("dezenove"),
            _ => None,
        };
        if let Some(w) = bp {
            return Some(w.to_string());
        }
    }
    // `N.small[i]`: an array index, so only a non-negative integer in range hits.
    if i >= 0.0 && i.fract() == 0.0 && (i as usize) < n.small.len() {
        Some(n.small[i as usize].clone())
    } else {
        None
    }
}

fn below100(n: u64, d: Dialect) -> String {
    if n < 20 {
        return small(n as f64, d).unwrap();
    }
    let (t, u) = ((n / 10) as usize, n % 10);
    let tens = &MANIFEST.numbers.tens[t];
    if u == 0 {
        tens.clone()
    } else {
        format!(
            "{tens} {} {}",
            MANIFEST.numbers.connector,
            small(u as f64, d).unwrap()
        )
    }
}

fn below1000(n: u64, d: Dialect) -> String {
    if n < 100 {
        return below100(n, d);
    }
    let num = &MANIFEST.numbers;
    if n == 100 {
        return num.hundred_exact.clone();
    }
    let (h, r) = ((n / 100) as usize, n % 100);
    if r != 0 {
        format!("{} {} {}", num.hundreds[h], num.connector, below100(r, d))
    } else {
        num.hundreds[h].clone()
    }
}

/// `numberToWords(n, dialect, raw?)`: a non-negative safe integer below 10⁹ in words; anything else digit by
/// digit over `raw` (or `String(Math.abs(n))`), a non-digit kept as itself.
pub fn number_to_words(n: f64, dialect: Dialect, raw: Option<&JsString>) -> JsString {
    js(&number_to_words_str(n, dialect, raw))
}

fn number_to_words_str(n: f64, d: Dialect, raw: Option<&JsString>) -> String {
    let safe = n.is_finite() && n.fract() == 0.0 && n.abs() <= 9_007_199_254_740_991.0;
    if !safe || n < 0.0 || n >= 1e9 {
        let digits = raw
            .cloned()
            .unwrap_or_else(|| js(&js_number_to_string(n.abs())));
        let parts: Vec<String> = digits
            .code_point_strings()
            .into_iter()
            .map(|ch| small(js_number(&ch), d).unwrap_or_else(|| ch.to_string_lossy()))
            .collect();
        return parts.join(" ");
    }
    let n = n as u64;
    let num = &MANIFEST.numbers;
    if n < 1000 {
        return below1000(n, d);
    }
    if n < 1_000_000 {
        let (th, r) = (n / 1000, n % 1000);
        let thousand = if th == 1 {
            num.thousand.clone()
        } else {
            format!("{} {}", below1000(th, d), num.thousand)
        };
        if r == 0 {
            return thousand;
        }
        return if r < 100 || r % 100 == 0 {
            format!("{thousand} {} {}", num.connector, below1000(r, d))
        } else {
            format!("{thousand} {}", below1000(r, d))
        };
    }
    let (m, r) = (n / 1_000_000, n % 1_000_000);
    let million = if m == 1 {
        format!("{} {}", small(1.0, d).unwrap(), num.million)
    } else {
        format!("{} {}", below1000(m, d), num.million_plural)
    };
    if r == 0 {
        return million;
    }
    if r < 100 || r % 100 == 0 {
        format!(
            "{million} {} {}",
            num.connector,
            number_to_words_str(r as f64, d, None)
        )
    } else {
        format!("{million} {}", number_to_words_str(r as f64, d, None))
    }
}
