//! Sinhala cardinal → words: fused 21-99 from a tens stem, and the analytic multiplier form for every magnitude.
//! Ported from src/languages/sinhala/numbers.ts — see that file for the corpus evidence.

use super::manifest::SinhalaNumbers;
use crate::core::js_string::js_number_to_string;

// A missing table entry is the TS's `undefined`; every table here is complete for the indices reached.
fn at(v: &[String], i: f64) -> String {
    v.get(i as usize).cloned().unwrap_or_default()
}

fn key(m: &std::collections::HashMap<String, String>, t: f64) -> String {
    m.get(&js_number_to_string(t)).cloned().unwrap_or_default()
}

/// `numberToWords(n)`. ⚠ JS `Number` arithmetic, kept in `f64`: the composer has no safe-integer guard, so a long
/// digit run is composed from the float (each magnitude recursion floors and takes `%` exactly as JS does).
pub fn number_to_words(n: f64, d: &SinhalaNumbers) -> String {
    if n < 0.0 || !n.is_finite() {
        return String::new();
    }
    let n = n.floor();
    if n < 10.0 {
        return at(&d.units, n);
    }
    if n < 20.0 {
        return at(&d.teens, n - 10.0);
    }
    if n < 100.0 {
        let (t, u) = ((n / 10.0).floor(), n % 10.0);
        return if u == 0.0 {
            key(&d.tens_word, t)
        } else {
            key(&d.tens_stem, t) + &at(&d.units, u)
        };
    }
    let m = &d.magnitudes;
    let compose = |count: f64, magnitude: &str, unit: f64| -> String {
        let head = if count == 1.0 {
            magnitude.to_string()
        } else {
            format!("{} {magnitude}", number_to_words(count, d))
        };
        let rest = n % unit;
        if rest == 0.0 {
            head
        } else {
            format!("{head} {}", number_to_words(rest, d))
        }
    };
    if n < 1000.0 {
        return compose((n / 100.0).floor(), &m.hundred, 100.0);
    }
    if n < 100_000.0 {
        return compose((n / 1000.0).floor(), &m.thousand, 1000.0);
    }
    if n < 10_000_000.0 {
        return compose((n / 100_000.0).floor(), &m.lakh, 100_000.0);
    }
    compose((n / 1_000_000.0).floor(), &m.million, 1_000_000.0)
}
