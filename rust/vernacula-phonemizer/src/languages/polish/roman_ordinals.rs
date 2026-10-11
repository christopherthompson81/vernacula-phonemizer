//! Polish Roman-numeral policy: a numeral beside wiek / stulecie / rocznica / zjazd reads as the masculine
//! nominative ORDINAL (1 … 100), both elements of a compound inflecting. Ported from
//! src/languages/polish/romanOrdinals.ts — see that file for the sources and the documented case/gender limits.

use super::manifest::{MANIFEST, try_manifest};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::roman::RomanPolicy;

/// `ORD_TENS` (generated from romanOrdinals.ts).
const ORD_TENS: [&str; 10] = [
    "",
    "dziesiąty",
    "dwudziesty",
    "trzydziesty",
    "czterdziesty",
    "pięćdziesiąty",
    "sześćdziesiąty",
    "siedemdziesiąty",
    "osiemdziesiąty",
    "dziewięćdziesiąty",
];

/// `ordinal(n)`: the masculine nominative ordinal, 1 … 100; `None` otherwise (`Number.isInteger` included).
pub(crate) fn ordinal(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || !(1.0..=100.0).contains(&n) {
        return None;
    }
    if n == 100.0 {
        return Some(js("setny"));
    }
    let ord = &MANIFEST.roman_ordinals;
    if n < 20.0 {
        return Some(js(&ord[n as usize]));
    }
    let (t, u) = ((n / 10.0).floor() as usize, (n % 10.0) as usize);
    Some(if u == 0 {
        js(ORD_TENS[t])
    } else {
        js(&format!("{} {}", ORD_TENS[t], ord[u]))
    })
}

/// `CONTEXT`: wiek, stulecie, rocznica and zjazd in the cases that occur.
const CONTEXT: &str = r"^(wiek(u|i|ów|iem|om|ach|ami)?|stuleci(e|a|u|em|ach|om|ami)?|rocznic(a|y|ę|ą|e|om|ach|ami)|zjazd(u|zie|em|y|ów|om|ach|ami)?)$";

/// `ROMAN_POLICY` (registry.ts's `romanPl`): the same context on both sides; no `exclude`.
pub fn roman_policy() -> RomanPolicy {
    RomanPolicy {
        exclude: Vec::new(),
        // ⚠ CHECKED HERE: `registry::pre_pass` can reach this without building the engine. With no manifest
        // the ordinal is declined and the cardinal stands, instead of the MANIFEST panic.
        ordinal: Some(Box::new(|n| {
            try_manifest().ok().and_then(|_| ordinal(n as f64))
        })),
        ordinal_before: Some(JsRegex::new(CONTEXT, "iu").unwrap()),
        ordinal_after: Some(JsRegex::new(CONTEXT, "iu").unwrap()),
    }
}
