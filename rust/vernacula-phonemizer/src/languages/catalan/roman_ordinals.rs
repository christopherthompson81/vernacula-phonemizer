//! Catalan (ca) Roman-numeral policy: the masculine ordinal (any n) for a numeral BEFORE an event or edition
//! noun; centuries and regnal names keep the shared pass's cardinal.
//! Ported from src/languages/catalan/romanOrdinals.ts — see that file for the Optimot / ésAdir sources.

use super::manifest::try_manifest;
use super::numbers::number_to_words;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::roman::RomanPolicy;
use crate::js_re;

/// `IRREGULAR`: 1–10.
const IRREGULAR: [&str; 10] = [
    "primer", "segon", "tercer", "quart", "cinquè", "sisè", "setè", "vuitè", "novè", "desè",
];

/// `ordinalizeWord(w)`: the cardinal's final word → its ordinal (code-unit slices, as the TS).
fn ordinalize_word(w: &JsString) -> JsString {
    let head = || w.slice(0, Some(-1));
    if w.ends_with(&js("cinc")) {
        return head().concat(&js("què"));
    }
    if w.ends_with(&js("nou")) {
        return head().concat(&js("vè"));
    }
    if w.ends_with(&js("deu")) {
        return head().concat(&js("sè"));
    }
    if *w == "cents" {
        return js("centè");
    }
    if js_re!("[aeiou]$", "u").test(w) {
        return head().concat(&js("è"));
    }
    w.concat(&js("è"))
}

/// `catalanOrdinal(n)`: the masculine ordinal, n ≥ 1.
pub fn catalan_ordinal(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.trunc() == n) || n < 1.0 {
        return None;
    }
    if n <= 10.0 {
        return Some(js(IRREGULAR[n as usize - 1]));
    }
    let mut words = number_to_words(n, None).split(&js(" "));
    let last = words.len() - 1;
    words[last] = ordinalize_word(&words[last]);
    Some(JsString::join(&words, &js(" ")))
}

/// `ROMAN_POLICY` (registry.ts's `romanCa`). It declares no `exclude`.
pub fn roman_policy() -> RomanPolicy {
    RomanPolicy {
        exclude: Vec::new(),
        // ⚠ CHECKED HERE, not by the engine: the pre-pass reaches this without building the engine.
        ordinal: Some(Box::new(|n| {
            try_manifest()
                .ok()
                .and_then(|_| catalan_ordinal(n as f64))
        })),
        ordinal_before: None,
        ordinal_after: Some(
            JsRegex::new(
                "^(aniversari|centenari|congrés|congres|encontre|festival|campionat|certamen|concurs|premi|saló|salo|simposi|col·loqui|seminari|torneig|cicle|volum|capítol|capitol|cant|acte|article|batalló|regiment|govern)$",
                "iu",
            )
            .unwrap(),
        ),
    }
}
