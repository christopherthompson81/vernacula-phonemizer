//! Bosnian cardinal → words: the shared Serbo-Croatian compositor over Bosnian's own word table.
//! Ported from src/languages/bosnian/numbers.ts.

use super::manifest::MANIFEST;
use crate::core::js_string::JsString;
use crate::languages::serbian::numbers::compose_slavic_number;

/// `numberToWords(n, raw)`.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    compose_slavic_number(n, &MANIFEST.numbers, raw)
}
