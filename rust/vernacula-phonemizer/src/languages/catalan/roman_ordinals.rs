//! Catalan (ca) Roman-numeral policy: the masculine ordinal (any n) for a numeral BEFORE an event or edition
//! noun; centuries and regnal names keep the shared pass's cardinal.
//! Ported from src/languages/catalan/romanOrdinals.ts — see that file for the Optimot / ésAdir sources.

use super::manifest::try_manifest;
use super::normalize::ordinal_words;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::JsString;
use crate::core::roman::RomanPolicy;

/// `catalanOrdinal(n)`: the masculine ordinal, n ≥ 1 — the digit ordinal's own compositor (#1533).
pub fn catalan_ordinal(n: f64) -> Option<JsString> {
    ordinal_words(n, false)
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
