//! Kazakh Roman-numeral policy: a numeral beside ғасыр / мыңжылдық / жылдық / съезд / конгресс / сынып reads as
//! the ordinal (1 … 100), from tables because the tens are irregular. Ported from
//! src/languages/kazakh/romanOrdinals.ts — see that file for the sources.

use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::roman::RomanPolicy;

const ORD_UNITS: [&str; 10] = [
    "",
    "бірінші",
    "екінші",
    "үшінші",
    "төртінші",
    "бесінші",
    "алтыншы",
    "жетінші",
    "сегізінші",
    "тоғызыншы",
];

const ORD_TENS: [&str; 10] = [
    "",
    "оныншы",
    "жиырмасыншы",
    "отызыншы",
    "қырқыншы",
    "елуінші",
    "алпысыншы",
    "жетпісінші",
    "сексенінші",
    "тоқсаныншы",
];

const TENS_CARDINAL: [&str; 10] = [
    "",
    "он",
    "жиырма",
    "отыз",
    "қырық",
    "елу",
    "алпыс",
    "жетпіс",
    "сексен",
    "тоқсан",
];

/// `ordinal(n)`: 1 … 100 (`Number.isInteger` included), else `None`.
pub(crate) fn kk_roman_ordinal(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || !(1.0..=100.0).contains(&n) {
        return None;
    }
    if n == 100.0 {
        return Some(js("жүзінші"));
    }
    let n = n as usize;
    if n < 10 {
        return Some(js(ORD_UNITS[n]));
    }
    let (t, u) = (n / 10, n % 10);
    Some(if u == 0 {
        js(ORD_TENS[t])
    } else {
        js(&format!("{} {}", TENS_CARDINAL[t], ORD_UNITS[u]))
    })
}

/// `CONTEXT`, verbatim.
const CONTEXT: &str = r"^(ғасыр|мыңжылдық|жылдық|съезд|конгресс|сынып)";

/// `ROMAN_POLICY` (registry.ts's `romanKk`): the same context on both sides; no `exclude`.
pub fn roman_policy() -> RomanPolicy {
    let context = || JsRegex::new(CONTEXT, "iu").unwrap();
    RomanPolicy {
        exclude: Vec::new(),
        ordinal: Some(Box::new(|n| kk_roman_ordinal(n as f64))),
        ordinal_before: Some(context()),
        ordinal_after: Some(context()),
    }
}
