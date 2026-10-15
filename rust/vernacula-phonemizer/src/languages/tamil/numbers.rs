//! Tamil cardinal → words: Indian grouping with the sandhi-fused free/combining forms at every level, the fused
//! thousands for counts up to 99, the attributive ஒரு before லட்சம்/கோடி, and digit-at-a-time above 10^10; plus the
//! ordinal stem.
//! Ported from src/languages/tamil/numbers.ts — see that file for the corpus evidence.

use super::manifest::TamilNumbers;
use crate::core::js_string::{JsString, js, js_number_to_string};

// A missing table entry is the TS's `undefined`, which `join(" ")` renders as "".
fn at(v: &[String], i: u64) -> String {
    v.get(i as usize).cloned().unwrap_or_default()
}

fn below_100(n: u64, d: &TamilNumbers) -> Vec<String> {
    if n == 0 {
        return Vec::new();
    }
    if n < 10 {
        return vec![at(&d.units, n)];
    }
    if n < 20 {
        return vec![if n == 10 {
            at(&d.tens, 1)
        } else {
            at(&d.teens, n - 11)
        }];
    }
    let (t, u) = (n / 10, n % 10);
    if u == 0 {
        vec![at(&d.tens, t)]
    } else {
        vec![at(&d.tens_combining, t), at(&d.units, u)]
    }
}

fn below_1000(n: u64, d: &TamilNumbers) -> Vec<String> {
    let (h, r) = (n / 100, n % 100);
    if h == 0 {
        return below_100(r, d);
    }
    if r == 0 {
        return vec![at(&d.hundreds, h)];
    }
    let mut out = vec![at(&d.hundreds_combining, h)];
    out.extend(below_100(r, d));
    out
}

fn thousands(count: u64, has_remainder: bool, d: &TamilNumbers) -> Vec<String> {
    let m = &d.magnitudes;
    let fused = if has_remainder {
        &d.thousands_combining
    } else {
        &d.thousands
    };
    let bare = if has_remainder {
        &m.thousand_combining
    } else {
        &m.thousand
    };
    if count <= 10 {
        return vec![at(fused, count)];
    }
    if count < 20 {
        return vec![at(&d.teens, count - 11), bare.clone()];
    }
    if count < 100 {
        let (t, u) = (count / 10, count % 10);
        return if u == 0 {
            vec![at(&d.tens, t), bare.clone()]
        } else {
            vec![at(&d.tens_combining, t), at(fused, u)]
        };
    }
    let mut out = below_1000(count, d);
    out.push(bare.clone());
    out
}

/// `numberToWords(n, raw?)`. `n` is the JS `Number` of a digit run; at 10^10 and above it is read digit at a time
/// from `raw`, or from `String(n)` when there is none (so a float's exponent form loses its `e+`).
pub fn number_to_words(n: f64, raw: Option<&JsString>, d: &TamilNumbers) -> JsString {
    if !n.is_finite() || n < 0.0 {
        return JsString::new();
    }
    if n == 0.0 {
        return js(&at(&d.units, 0));
    }
    if n >= 1e10 {
        let s = raw
            .map(|r| r.to_string_lossy())
            .unwrap_or_else(|| js_number_to_string(n));
        let words: Vec<String> = s
            .chars()
            .filter_map(|c| c.to_digit(10))
            .map(|x| at(&d.units, x as u64))
            .collect();
        return js(&words.join(" "));
    }
    let m = &d.magnitudes;
    let n = n as u64;
    let crore = n / 10_000_000;
    let n = n % 10_000_000;
    let lakh = n / 100_000;
    let n = n % 100_000;
    let thou = n / 1000;
    let n = n % 1000;
    let with_one = |c: u64| {
        if c == 1 {
            vec![m.one.clone()]
        } else {
            below_1000(c, d)
        }
    };
    let mut parts: Vec<String> = Vec::new();
    if crore > 0 {
        parts.extend(with_one(crore));
        parts.push(if lakh + thou + n > 0 {
            m.crore_combining.clone()
        } else {
            m.crore.clone()
        });
    }
    if lakh > 0 {
        parts.extend(with_one(lakh));
        parts.push(if thou + n > 0 {
            m.lakh_combining.clone()
        } else {
            m.lakh.clone()
        });
    }
    if thou > 0 {
        parts.extend(thousands(thou, n > 0, d));
    }
    parts.extend(below_1000(n, d));
    js(&parts.join(" "))
}

/// `ordinalStem(word)`: the stem an ordinal suffix attaches to, or `None` for a word it cannot take.
pub fn ordinal_stem(word: &JsString) -> Option<JsString> {
    if word.ends_with(&js("ு")) || word.ends_with(&js("ம்")) {
        return Some(word.slice(0, Some(-1)));
    }
    if word.ends_with(&js("ி")) {
        return Some(word.concat(&js("ய")));
    }
    None
}
