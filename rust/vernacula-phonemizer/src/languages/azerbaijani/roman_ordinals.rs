//! Azerbaijani Roman-numeral policy: a numeral beside əsr / yüzil / minillik / ildönüm / konqres / sinif reads as
//! the ordinal (1 … 100), -IncI by four-way harmony on the last word. Ported from
//! src/languages/azerbaijani/romanOrdinals.ts — see that file for the sources.

use super::manifest::{MANIFEST, try_manifest};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::roman::RomanPolicy;

const VOWELS: &str = "aıeəiouöü";

/// `HARMONY`. Generated from romanOrdinals.ts's object literal (key order preserved).
const HARMONY: [(char, &str); 9] = [
    ('a', "ı"),
    ('ı', "ı"),
    ('e', "i"),
    ('ə', "i"),
    ('i', "i"),
    ('o', "u"),
    ('u', "u"),
    ('ö', "ü"),
    ('ü', "ü"),
];

/// `SUFFIX`. Generated from romanOrdinals.ts's object literal.
fn suffix(cls: &str) -> &'static str {
    match cls {
        "ı" => "ncı",
        "i" => "nci",
        "u" => "ncu",
        _ => "ncü",
    }
}

/// `suffixed(stem)`: the last vowel's class picks the suffix; a vowel-final stem takes no linking vowel.
fn suffixed(stem: &str) -> Option<JsString> {
    let cls = stem
        .chars()
        .rev()
        .find_map(|ch| HARMONY.iter().find(|(k, _)| *k == ch).map(|(_, h)| *h))?;
    // `VOWELS.includes(stem[stem.length - 1])`: the last code unit; every vowel here is one unit.
    let last = js(stem).units().last().copied();
    let linking = if last.is_some_and(|u| VOWELS.encode_utf16().any(|v| v == u)) {
        ""
    } else {
        cls
    };
    Some(js(&format!("{stem}{linking}{}", suffix(cls))))
}

/// `ordinal(n)`: 1 … 100 (`Number.isInteger` included), else `None`.
pub(crate) fn az_roman_ordinal(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || !(1.0..=100.0).contains(&n) {
        return None;
    }
    let nm = &MANIFEST.numbers;
    if n == 100.0 {
        return suffixed(&nm.hundred);
    }
    let n = n as usize;
    if n < 10 {
        return suffixed(&nm.ones[n]);
    }
    let (t, u) = (n / 10, n % 10);
    let tens = nm.tens.get(t)?;
    if u == 0 {
        suffixed(tens)
    } else {
        Some(js(tens).concat(&js(" ")).concat(&suffixed(&nm.ones[u])?))
    }
}

/// `CONTEXT`, verbatim.
/// Open at the end only to a suffix, which harmony bounds: every stem is front-voweled, so a back vowel after it is
/// another word (`əsrarəngiz`, #1576). Lower case on purpose: under `i` a capital `I` would fold to `i`.
const CONTEXT: &str = r"^(əsr|yüzil|minillik|ildönüm|konqres|sinif)(?![\p{L}\p{M}]*[aıou])";

/// `ROMAN_POLICY` (registry.ts's `romanAz`): the same context on both sides; no `exclude`.
pub fn roman_policy() -> RomanPolicy {
    let context = || JsRegex::new(CONTEXT, "iu").unwrap();
    RomanPolicy {
        exclude: Vec::new(),
        // With no manifest the ordinal is declined, so the cardinal stands instead of the MANIFEST panic.
        ordinal: Some(Box::new(|n| {
            try_manifest().ok().and_then(|_| az_roman_ordinal(n as f64))
        })),
        ordinal_before: Some(context()),
        ordinal_after: Some(context()),
    }
}
