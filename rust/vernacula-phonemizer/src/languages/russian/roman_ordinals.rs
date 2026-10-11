//! Russian Roman-numeral policy: a numeral beside a century or count noun reads as the masculine nominative
//! ORDINAL (1 … 100). Ported from src/languages/russian/romanOrdinals.ts — see that file for the sources and
//! the documented case/gender limitations.

use super::manifest::{MANIFEST, try_manifest};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::roman::RomanPolicy;

/// `ORD_TENS` (generated from romanOrdinals.ts).
const ORD_TENS: [&str; 10] = [
    "",
    "десятый",
    "двадцатый",
    "тридцатый",
    "сороковой",
    "пятидесятый",
    "шестидесятый",
    "семидесятый",
    "восьмидесятый",
    "девяностый",
];

/// `russianOrdinal(n)`: the masculine nominative ordinal, 1 … 100; `None` otherwise (`Number.isInteger`
/// included). Only the last element inflects: 21 → двадцать первый.
pub(crate) fn russian_ordinal(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || !(1.0..=100.0).contains(&n) {
        return None;
    }
    if n == 100.0 {
        return Some(js("сотый"));
    }
    let ord = &MANIFEST.roman_ordinals;
    if n < 20.0 {
        return Some(js(&ord[n as usize]));
    }
    let (t, u) = ((n / 10.0).floor() as usize, (n % 10.0) as usize);
    Some(if u == 0 {
        js(ORD_TENS[t])
    } else {
        js(&format!("{} {}", MANIFEST.numbers.tens[t], ord[u]))
    })
}

/// `CONTEXT`: the century noun and the two ordinal-taking count nouns, in the cases that occur.
const CONTEXT: &str = r"^(век(а|е|у|ом|ов|ам|ах|ами)?|столети(е|я|и|ю|ем|й|ям|ях|ями)|годовщин(а|ы|е|у|ой|ам|ах)?|съезд(а|е|у|ом|ы|ов|ам|ах)?)$";

/// `ROMAN_POLICY` (registry.ts's `romanRu`): the same context on both sides; no `exclude`.
pub fn roman_policy() -> RomanPolicy {
    RomanPolicy {
        exclude: Vec::new(),
        // ⚠ CHECKED HERE: `registry::pre_pass` can reach this without building the engine. With no manifest
        // the ordinal is declined and the cardinal stands, instead of the MANIFEST panic.
        ordinal: Some(Box::new(|n| {
            try_manifest().ok().and_then(|_| russian_ordinal(n as f64))
        })),
        ordinal_before: Some(JsRegex::new(CONTEXT, "iu").unwrap()),
        ordinal_after: Some(JsRegex::new(CONTEXT, "iu").unwrap()),
    }
}
