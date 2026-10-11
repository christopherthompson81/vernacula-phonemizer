//! Ukrainian Roman-numeral policy: a numeral beside a century or count noun reads as the NEUTER nominative
//! ordinal (1 … 100), since століття is neuter. Ported from src/languages/ukrainian/romanOrdinals.ts — see that
//! file for the sources and the documented case/gender limitations (вік is excluded on purpose).

use super::manifest::{MANIFEST, try_manifest};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::roman::RomanPolicy;

/// `ordinal(n)`: the neuter nominative ordinal, 1 … 100; `None` otherwise (`Number.isInteger` included).
pub(crate) fn ukrainian_roman_ordinal(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || !(1.0..=100.0).contains(&n) {
        return None;
    }
    let ord = &MANIFEST.roman_ordinals;
    if n == 100.0 {
        return Some(js(&ord.hundredth));
    }
    if n < 20.0 {
        return Some(js(&ord.one_to_nineteen[n as usize]));
    }
    let (t, u) = ((n / 10.0).floor() as usize, (n % 10.0) as usize);
    if u == 0 {
        return Some(js(&ord.tens[t]));
    }
    let tens = MANIFEST.numbers.east.base.tens.get(&(t * 10).to_string())?;
    Some(js(&format!("{tens} {}", ord.one_to_nineteen[u])))
}

/// `ROMAN_POLICY` (registry.ts's `romanUk`): the same context on both sides; no `exclude`.
pub fn roman_policy() -> RomanPolicy {
    // `new RegExp(`^(?:${context.join("|")})$`, "iu")`. With no manifest the context is one that matches
    // nothing, and the ordinal is declined, so the cardinal stands instead of the MANIFEST panic.
    let context = || {
        let alt = try_manifest().map_or_else(
            |_| "(?!)".to_string(),
            |m| m.roman_ordinals.context.join("|"),
        );
        JsRegex::new(&format!("^(?:{alt})$"), "iu").unwrap()
    };
    RomanPolicy {
        exclude: Vec::new(),
        ordinal: Some(Box::new(|n| {
            try_manifest()
                .ok()
                .and_then(|_| ukrainian_roman_ordinal(n as f64))
        })),
        ordinal_before: Some(context()),
        ordinal_after: Some(context()),
    }
}
