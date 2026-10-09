//! Japanese number → kana (Sino-Japanese counting, 万/億/兆 groups).
//! Ported from src/languages/japanese/numbers.ts — see that file for the corpus evidence.

use super::manifest::T;
use crate::core::js_string::{JsString, js_number};

const MAX_SAFE: f64 = 9007199254740991.0;

/// `Number.isSafeInteger(n)`.
pub(crate) fn is_safe_integer(n: f64) -> bool {
    n.is_finite() && n.fract() == 0.0 && n.abs() <= MAX_SAFE
}

fn below_10000(n: u64) -> JsString {
    let t = &*T;
    let (th, h, te, u) = (n / 1000, (n % 1000) / 100, (n % 100) / 10, n % 10);
    let mut s = JsString::new();
    s.push_str(&t.thousands[th as usize]);
    s.push_str(&t.hundreds[h as usize]);
    if te == 1 {
        s.push_str(&t.ten);
    } else if te >= 2 {
        s.push_str(&t.ones[te as usize]);
        s.push_str(&t.ten);
    }
    s.push_str(&t.ones[u as usize]);
    s
}

/// Non-negative integer → kana; 0 → れい; unsafe or negative → digit by digit from `raw`.
pub fn number_to_kana(n: f64, raw: Option<&JsString>) -> JsString {
    let t = &*T;
    if !is_safe_integer(n) || n < 0.0 {
        // Without `raw` the TS reads `String(Math.abs(n))`. Every caller without one passes a safe integer
        // (readCounter checks first), so only the `raw` arm is reachable.
        let fallback;
        let digits = match raw {
            Some(r) => r,
            None => {
                fallback = JsString::from(format!("{}", n.abs()));
                &fallback
            }
        };
        let mut out = JsString::new();
        for d in digits.code_point_strings() {
            // `ONES[Number(d)] || zero`: NaN, 0 and out-of-range all read as zero.
            let v = js_number(&d);
            let word = if v.fract() == 0.0 && (0.0..t.ones.len() as f64).contains(&v) {
                &t.ones[v as usize]
            } else {
                &t.zero
            };
            out.push_str(if word.is_empty() { &t.zero } else { word });
        }
        return out;
    }
    if n == 0.0 {
        return t.zero.clone();
    }
    let mut groups = Vec::new();
    let mut x = n as u64;
    while x > 0 {
        groups.push(x % 10000);
        x /= 10000;
    }
    let mut out = JsString::new();
    for g in (0..groups.len()).rev() {
        if groups[g] == 0 {
            continue;
        }
        out.push_str(&below_10000(groups[g]));
        if let Some(u) = t.myriad_units.get(g) {
            out.push_str(u);
        }
    }
    out
}
