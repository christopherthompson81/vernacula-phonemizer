//! Kirundi cardinals: Kinyarwanda's shared Rwanda-Rundi compositor over Kirundi's own table (no 10⁹ word, so the
//! ceiling is 10⁹). Ported from src/languages/kirundi/numbers.ts — see that file for the corpus evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::JsString;
use crate::languages::kinyarwanda::numbers::compose_rwanda_rundi;

/// `numberToWords(n, raw)`.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    compose_rwanda_rundi(n, &MANIFEST.numbers, raw)
}
