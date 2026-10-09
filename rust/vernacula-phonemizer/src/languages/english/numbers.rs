//! Cardinal and ordinal number words, up to the nonillions. Ported from src/languages/english/numbers.ts.
//!
//! The TS takes a `bigint`; here a non-negative integer is its canonical decimal digits (`BigNat`), because a
//! digit run longer than `u128` holds must still reach the "too large: say the digits" branch.

use super::manifest::MANIFEST;

/// A non-negative integer as canonical decimal digits: no leading zeros, `"0"` for zero.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct BigNat(String);

impl BigNat {
    /// JS `BigInt(s)` for an ASCII digit string; `None` where `BigInt` would throw. An empty or
    /// whitespace-only string is 0n, as in JS.
    pub fn parse(s: &str) -> Option<BigNat> {
        let t = s.trim_matches(|c: char| c.is_ascii_whitespace());
        if t.is_empty() {
            return Some(BigNat("0".into()));
        }
        if !t.bytes().all(|b| b.is_ascii_digit()) {
            return None;
        }
        let stripped = t.trim_start_matches('0');
        Some(BigNat(if stripped.is_empty() { "0".into() } else { stripped.into() }))
    }

    pub fn from_u128(n: u128) -> BigNat {
        BigNat(n.to_string())
    }

    pub fn digits(&self) -> &str {
        &self.0
    }

    fn as_u128(&self) -> Option<u128> {
        self.0.parse().ok()
    }
}

fn below1000(mut n: u128) -> Vec<String> {
    let m = &MANIFEST.numbers;
    let mut out = Vec::new();
    if n >= 100 {
        out.push(m.ones[(n / 100) as usize].clone());
        out.push(m.hundred.clone());
        n %= 100;
    }
    if n >= 20 {
        out.push(m.tens[(n / 10) as usize].clone());
        if n % 10 != 0 {
            out.push(m.ones[(n % 10) as usize].clone());
        }
    } else if n > 0 {
        out.push(m.ones[n as usize].clone());
    }
    out
}

pub fn number_to_words(n: &BigNat) -> Vec<String> {
    let scale = &MANIFEST.numbers.scale;
    // MAX = 10^(3·(scale.len()+1)) − 1: anything with more digits than that is said as its digits.
    let max_digits = 3 * (scale.len() + 1);
    if n.0.len() > max_digits {
        return vec![n.0.clone()];
    }
    let mut v = n.as_u128().expect("≤ 33 digits fits u128");
    if v == 0 {
        return vec!["zero".into()];
    }
    let mut out = Vec::new();
    for (i, name) in scale.iter().enumerate().rev() {
        let g = 10u128.pow(3 * (i as u32 + 1));
        if v >= g {
            out.extend(below1000(v / g));
            out.push(name.clone());
            v %= g;
        }
    }
    if v > 0 {
        out.extend(below1000(v));
    }
    out
}

pub fn ordinal_to_words(n: &BigNat) -> Vec<String> {
    let mut words = number_to_words(n);
    if let Some(last) = words.last_mut() {
        if let Some(ord) = MANIFEST.numbers.ordinals.get(last.as_str()) {
            *last = ord.clone();
        }
    }
    words
}
