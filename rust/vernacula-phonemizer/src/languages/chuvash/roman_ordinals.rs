//! Chuvash Roman-numeral policy: a numeral beside ӗмӗр (either encoding of its ӗ, and its case forms) reads as the
//! ordinal (1 … 100). Ported from src/languages/chuvash/romanOrdinals.ts — see that file for the sources.

use super::normalize::ordinal_of;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::JsString;
use crate::core::roman::RomanPolicy;

/// `ordinal(n)`: `ordinalOf(n)` for 1 … 100 (`Number.isInteger` included), else `None`.
pub(crate) fn chv_roman_ordinal(n: f64) -> Option<JsString> {
    if n.is_finite() && n.fract() == 0.0 && (1.0..=100.0).contains(&n) {
        ordinal_of(n)
    } else {
        None
    }
}

/// `CONTEXT`, verbatim (⚠ both ӗ U+04D7 and the Latin ĕ U+0115).
const CONTEXT: &str = r"^([ӗĕ]м[ӗĕ]р(те|тен|ти|ччен|че|сем|сене|сенче|[ӗĕ]|[ӗĕ]нче|[ӗĕ]н)?)$";

/// `ROMAN_POLICY` (registry.ts's `romanChv`): the same context on both sides; no `exclude`.
pub fn roman_policy() -> RomanPolicy {
    let context = || JsRegex::new(CONTEXT, "iu").unwrap();
    RomanPolicy {
        exclude: Vec::new(),
        ordinal: Some(Box::new(|n| chv_roman_ordinal(n as f64))),
        ordinal_before: Some(context()),
        ordinal_after: Some(context()),
    }
}
