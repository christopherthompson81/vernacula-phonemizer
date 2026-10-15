//! Uzbek Roman-numeral policy: a numeral beside asr / yuzyillik / mingyillik / yubiley / kongress / sinf reads as
//! the ordinal (1 … 100), one suffix shape (-nchi / -inchi) on the last word. Ported from
//! src/languages/uzbek/romanOrdinals.ts — see that file for the sources.

use super::numbers::{NUM, suffixed, try_num};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::roman::RomanPolicy;

/// `ordinal(n)`: 1 … 100 (`Number.isInteger` included), else `None`.
pub(crate) fn uz_roman_ordinal(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || !(1.0..=100.0).contains(&n) {
        return None;
    }
    let num = &*NUM;
    if n == 100.0 {
        return Some(js(&suffixed(num.magnitudes.hundred.as_deref()?)));
    }
    let n = n as usize;
    if n < 10 {
        return Some(js(&suffixed(&num.units[n])));
    }
    let (t, u) = (n / 10, n % 10);
    let tens = num.tens.get(&(t * 10).to_string())?;
    Some(js(&if u == 0 {
        suffixed(tens)
    } else {
        format!("{tens} {}", suffixed(&num.units[u]))
    }))
}

/// `CONTEXT`, verbatim.
const CONTEXT: &str = r"^(asr|yuzyillik|mingyillik|yubiley|kongress|sinf)";

/// `ROMAN_POLICY` (registry.ts's `romanUz`): the same context on both sides; no `exclude`.
pub fn roman_policy() -> RomanPolicy {
    let context = || JsRegex::new(CONTEXT, "iu").unwrap();
    RomanPolicy {
        exclude: Vec::new(),
        // With no manifest the ordinal is declined, so the cardinal stands instead of the NUM panic.
        ordinal: Some(Box::new(|n| {
            try_num().ok().and_then(|_| uz_roman_ordinal(n as f64))
        })),
        ordinal_before: Some(context()),
        ordinal_after: Some(context()),
    }
}
