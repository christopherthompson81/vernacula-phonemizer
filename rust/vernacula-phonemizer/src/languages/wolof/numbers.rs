//! Wolof cardinal numbers: quinary-decimal units (juróom + n), the multiplier before `fukk` / `téeméer` / `junni` /
//! `milyoŋ` / `milyaar`, `ak` between slots; digit by digit from 10^12.
//! Ported from src/languages/wolof/numbers.ts — see that file for the sources.

use crate::core::js_string::{JsString, is_safe_integer, js, js_number, js_number_to_string};

const ONES: [&str; 10] = [
    "tus",
    "benn",
    "ñaar",
    "ñett",
    "ñeent",
    "juróom",
    "juróom benn",
    "juróom ñaar",
    "juróom ñett",
    "juróom ñeent",
];
const TEN: &str = "fukk";
const AK: &str = "ak";
const HUNDRED: &str = "téeméer";
const THOUSAND: &str = "junni";
const MILLION: &str = "milyoŋ";
const BILLION: &str = "milyaar";

fn below100(n: f64) -> String {
    if n < 10.0 {
        return ONES[n as usize].to_string();
    }
    let t = (n / 10.0).floor();
    let u = n % 10.0;
    let tens = if t == 1.0 {
        TEN.to_string()
    } else {
        format!("{} {TEN}", ONES[t as usize])
    };
    if u == 0.0 {
        tens
    } else {
        format!("{tens} {AK} {}", ONES[u as usize])
    }
}

fn below1000(n: f64) -> String {
    if n < 100.0 {
        return below100(n);
    }
    let h = (n / 100.0).floor();
    let r = n % 100.0;
    let head = if h == 1.0 {
        HUNDRED.to_string()
    } else {
        format!("{} {HUNDRED}", below100(h))
    };
    if r == 0.0 {
        head
    } else {
        format!("{head} {AK} {}", below100(r))
    }
}

fn scaled(n: f64, unit: f64, word: &str) -> (String, f64) {
    let q = (n / unit).floor();
    let head = if q == 1.0 {
        word.to_string()
    } else {
        format!("{} {word}", below1000(q))
    };
    (head, n % unit)
}

fn words(n: f64, raw: Option<&JsString>) -> String {
    if !is_safe_integer(n) || n < 0.0 || n >= 1e12 {
        let digits = match raw {
            Some(r) => r.clone(),
            None => js(&js_number_to_string(n.abs())),
        };
        // `c >= "0" && c <= "9"` on a code point: an ASCII digit.
        return digits
            .code_point_strings()
            .iter()
            .filter(|c| c.len() == 1 && (u16::from(b'0')..=u16::from(b'9')).contains(&c.0[0]))
            .map(|d| ONES[js_number(d) as usize])
            .collect::<Vec<_>>()
            .join(" ");
    }
    if n < 1000.0 {
        return below1000(n);
    }
    if n < 1e6 {
        let (head, r) = scaled(n, 1000.0, THOUSAND);
        return if r == 0.0 {
            head
        } else {
            format!("{head} {AK} {}", below1000(r))
        };
    }
    let (head, r) = if n < 1e9 {
        scaled(n, 1e6, MILLION)
    } else {
        scaled(n, 1e9, BILLION)
    };
    if r == 0.0 {
        head
    } else {
        format!("{head} {AK} {}", words(r, None))
    }
}

/// `numberToWords(n, raw)`: a non-negative integer → Wolof words; from 10^12 (or not a safe integer) digit by digit.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    js(&words(n, raw))
}
