//! Korean number → Sino-Korean Hangul words, grouped by 만 (10^4) / 억 (10^8) / 조 (10^12), and the
//! digit-at-a-time fallback. Ported from src/languages/korean/numbers.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{MANIFEST, list};
use crate::core::js_string::{JsString, is_safe_integer};
use crate::core::numbers::digit_index;

struct Words {
    ones: Vec<JsString>,
    units: Vec<JsString>,
    ten: JsString,
    hundred: JsString,
    thousand: JsString,
}

static N: LazyLock<Words> = LazyLock::new(|| {
    let n = &MANIFEST.numbers;
    Words {
        ones: list(&n.ones),
        units: list(&n.myriad_units),
        ten: JsString::from(n.ten.as_str()),
        hundred: JsString::from(n.hundred.as_str()),
        thousand: JsString::from(n.thousand.as_str()),
    }
});

/// `ONES[i] ?? ""` (an index past the table reads as JS `undefined`).
fn one(i: u64) -> JsString {
    N.ones.get(i as usize).cloned().unwrap_or_default()
}

fn below10000(n: u64) -> JsString {
    let mut s = JsString::new();
    let (th, h, t, u) = (n / 1000, (n % 1000) / 100, (n % 100) / 10, n % 10);
    let place = |s: &mut JsString, d: u64, word: &JsString| {
        if d != 0 {
            if d > 1 {
                s.push_str(&one(d));
            }
            s.push_str(word);
        }
    };
    place(&mut s, th, &N.thousand);
    place(&mut s, h, &N.hundred);
    place(&mut s, t, &N.ten);
    if u != 0 {
        s.push_str(&one(u));
    }
    s
}

/// `spellDigits(digits)`: each ASCII digit by its Sino name; anything else reads as nothing.
pub fn spell_digits(digits: &JsString) -> JsString {
    let mut out = JsString::new();
    for c in digits.code_points() {
        let i = if c <= 0xffff {
            digit_index(c as u16)
        } else {
            -1
        };
        if i >= 0 {
            out.push_str(&one(i as u64));
        }
    }
    out
}

/// `numberToWords(n)`: a non-negative safe integer → Sino-Korean Hangul; `""` when out of range.
pub fn number_to_words(n: f64) -> JsString {
    if !is_safe_integer(n) || n < 0.0 {
        return JsString::new();
    }
    let n = n as u64;
    if n == 0 {
        return one(0);
    }
    let mut groups = Vec::new();
    let mut x = n;
    while x > 0 {
        groups.push(x % 10000);
        x /= 10000;
    }
    let mut out = JsString::new();
    for g in (0..groups.len()).rev() {
        if groups[g] == 0 {
            continue;
        }
        out.push_str(&below10000(groups[g]));
        if let Some(u) = N.units.get(g) {
            out.push_str(u);
        }
    }
    out
}
