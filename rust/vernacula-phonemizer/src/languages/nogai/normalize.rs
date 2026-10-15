//! Nogai (nog) text normalization: the corpus-independent separator hygiene and nothing else (no word is emitted).
//! Ported from src/languages/nogai/normalize.ts — see that file for why.

use crate::core::js_string::JsString;
use crate::core::separator_hygiene::separator_hygiene;

/// `normalizeNogai(input)`.
pub(crate) fn normalize_nogai(input: &JsString) -> JsString {
    separator_hygiene(input)
}
