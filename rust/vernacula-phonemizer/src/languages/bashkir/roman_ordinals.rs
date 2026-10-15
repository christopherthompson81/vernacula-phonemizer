//! Bashkir Roman-numeral policy: a numeral beside быуат (and its case forms) reads as the ordinal (1 … 100).
//! Ported from src/languages/bashkir/romanOrdinals.ts — see that file for the sources.

use super::normalize::ordinal_of;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::JsString;
use crate::core::roman::RomanPolicy;

/// `ordinal(n)`: `ordinalOf(n)` for 1 … 100 (`Number.isInteger` included), else `None`.
pub(crate) fn ba_roman_ordinal(n: f64) -> Option<JsString> {
    if n.is_finite() && n.fract() == 0.0 && (1.0..=100.0).contains(&n) {
        ordinal_of(n)
    } else {
        None
    }
}

/// `CONTEXT`, verbatim.
const CONTEXT: &str = r"^(быуат(та|тан|тың|ҡа|ты|тар|тарҙа|тарҙан|тарҙың)?)$";

/// `ROMAN_POLICY` (registry.ts's `romanBa`): the same context on both sides; no `exclude`.
pub fn roman_policy() -> RomanPolicy {
    let context = || JsRegex::new(CONTEXT, "iu").unwrap();
    RomanPolicy {
        exclude: Vec::new(),
        ordinal: Some(Box::new(|n| ba_roman_ordinal(n as f64))),
        ordinal_before: Some(context()),
        ordinal_after: Some(context()),
    }
}
