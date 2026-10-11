//! Belarusian Roman-numeral policy: a numeral beside стагоддзе / ст. / гадавіна / з'езд reads as the NEUTER
//! nominative ordinal (1 … 100). Ported from src/languages/belarusian/romanOrdinals.ts — see that file for the
//! sources and the documented case/gender limitations (век is excluded on purpose).

use super::belarusian::{DEF, try_manifest};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::roman::RomanPolicy;

const ORD_1_19: [&str; 20] = [
    "",
    "першае",
    "другое",
    "трэцяе",
    "чацвёртае",
    "пятае",
    "шостае",
    "сёмае",
    "восьмае",
    "дзявятае",
    "дзясятае",
    "адзінаццатае",
    "дванаццатае",
    "трынаццатае",
    "чатырнаццатае",
    "пятнаццатае",
    "шаснаццатае",
    "сямнаццатае",
    "васямнаццатае",
    "дзевятнаццатае",
];

const ORD_TENS: [&str; 10] = [
    "",
    "дзясятае",
    "дваццатае",
    "трыццатае",
    "саракавое",
    "пяцідзясятае",
    "шасцідзясятае",
    "сямідзясятае",
    "васьмідзясятае",
    "дзевяностае",
];

/// `ordinal(n)`: the neuter nominative ordinal, 1 … 100; `None` otherwise (`Number.isInteger` included).
pub(crate) fn belarusian_roman_ordinal(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || !(1.0..=100.0).contains(&n) {
        return None;
    }
    if n == 100.0 {
        return Some(js("сотае"));
    }
    let n = n as usize;
    if n < 20 {
        return Some(js(ORD_1_19[n]));
    }
    let (t, u) = (n / 10, n % 10);
    if u == 0 {
        return Some(js(ORD_TENS[t]));
    }
    let tens = DEF.numbers.east.base.tens.get(&(t * 10).to_string())?;
    Some(js(&format!("{tens} {}", ORD_1_19[u])))
}

/// `CONTEXT`, verbatim.
const CONTEXT: &str = r"^(ст|стст|стагодд(зе|зя|зю|зі|зем|зяў|зях|зямі)|гадавін(а|ы|е|у|ай)|з[’'`]езд(а|у|ам|ы|аў)?)$";

/// `ROMAN_POLICY` (registry.ts's `romanBe`): the same context on both sides; no `exclude`.
pub fn roman_policy() -> RomanPolicy {
    let context = || JsRegex::new(CONTEXT, "iu").unwrap();
    RomanPolicy {
        exclude: Vec::new(),
        // With no manifest the ordinal is declined, so the cardinal stands instead of the DEF panic.
        ordinal: Some(Box::new(|n| {
            try_manifest()
                .ok()
                .and_then(|_| belarusian_roman_ordinal(n as f64))
        })),
        ordinal_before: Some(context()),
        ordinal_after: Some(context()),
    }
}
