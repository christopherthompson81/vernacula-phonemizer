//! Turkmen Roman-numeral policy: a numeral beside asyr (and its case forms) reads as the ordinal (1 … 100), the
//! harmony class from the cardinal's last vowel. Ported from src/languages/turkmen/romanOrdinals.ts — see that
//! file for the sources.

use super::normalize::ordinal_of;
use super::numbers::{number_to_words, try_num};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::JsString;
use crate::core::roman::RomanPolicy;

const FRONT: &str = "äeiöü";
const VOWELS: &str = "aäeioöuüy";

/// `ordinal(n)`: 1 … 100 (`Number.isInteger` included), else `None`.
pub(crate) fn tk_roman_ordinal(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || !(1.0..=100.0).contains(&n) {
        return None;
    }
    let words = number_to_words(n);
    let last = words.last()?;
    let v = last.chars().rev().find(|c| VOWELS.contains(*c))?;
    ordinal_of(n, FRONT.contains(v))
}

/// `CONTEXT`, verbatim.
const CONTEXT: &str = r"^(asyr(yň|da|dan|a|y|lar|laryň|larda|lardan)?)$";

/// `ROMAN_POLICY` (registry.ts's `romanTk`): the same context on both sides; no `exclude`.
pub fn roman_policy() -> RomanPolicy {
    let context = || JsRegex::new(CONTEXT, "iu").unwrap();
    RomanPolicy {
        exclude: Vec::new(),
        // With no manifest the ordinal is declined, so the cardinal stands instead of the NUM panic.
        ordinal: Some(Box::new(|n| {
            try_num().ok().and_then(|_| tk_roman_ordinal(n as f64))
        })),
        ordinal_before: Some(context()),
        ordinal_after: Some(context()),
    }
}
