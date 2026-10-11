//! Romanian (ro) Roman-numeral policy: the `al …-lea` ordinal after a century, enumeration or regnal noun, and
//! before a short list of event nouns; `vii` is stoplisted.
//! Ported from src/languages/romanian/romanOrdinals.ts — see that file for the sources and the known gap.

use super::romanian::{data_loaded, number_words};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::roman::{RomanPolicy, roman_exclusions};
use crate::js_re;

/// `romanianOrdinal(n)`: `întâi` for 1, else `al` + the stem cardinal with `-lea` / `-ulea` on its last word.
pub fn romanian_ordinal(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.trunc() == n) || n < 1.0 {
        return None;
    }
    if n == 1.0 {
        return Some(js("întâi"));
    }
    let mut words = number_words(n, true).split(&js(" "));
    let at = words.len() - 1;
    let last = words[at].clone();
    let suffix = if js_re!("[aeiouăâîy]$", "u").test(&last) {
        "lea"
    } else {
        "ulea"
    };
    words[at] = last.concat(&js(suffix));
    Some(js("al ").concat(&JsString::join(&words, &js(" "))))
}

/// `ROMAN_POLICY` (registry.ts's `romanRo`), with `exclude: ROMAN_EXCLUSIONS.ro`.
pub fn roman_policy() -> RomanPolicy {
    RomanPolicy {
        exclude: roman_exclusions("ro"),
        // ⚠ CHECKED HERE, not by the engine: the pre-pass reaches this without building the engine.
        ordinal: Some(Box::new(|n| {
            if data_loaded() {
                romanian_ordinal(n as f64)
            } else {
                None
            }
        })),
        ordinal_before: Some(
            JsRegex::new(
                "^(secolul|secolele|secolelor|secole|secol|mileniul|mileniile|capitolul|volumul|tomul|cântul|actul|articolul|paragraful|regele|papa|împăratul|țarul|sultanul|carol|mihai|ferdinand|alexandru|constantin|nicolae|ștefan|mircea|vlad|petru|radu|iancu|ioan|paul|pius|benedict|francisc|leon|grigore|clement|inocențiu|urban|sixt|celestin|adrian|bonifaciu|honoriu|ludovic|filip|henric|frederic|wilhelm|george|eduard|iacob|richard|alfons|iosif|leopold|maximilian|otto|napoleon|petre)$",
                "iu",
            )
            .unwrap(),
        ),
        ordinal_after: Some(
            JsRegex::new(
                "^(secol|secole|aniversar|congres|campionat|volum|capitol|articol)$",
                "iu",
            )
            .unwrap(),
        ),
    }
}
