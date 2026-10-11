//! Tagalog (tl) text normalization: HTML entities to their character (or dropped), then digit ranges read
//! with `hanggang`. Ported from src/languages/tagalog/normalize.ts — see that file for the corpus evidence.

use crate::core::js_string::{JsString, js};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `ENTITY_CHAR`. Generated from normalize.ts's object literal (key order preserved).
const ENTITY_CHAR: [(&str, &str); 4] =
    [("nbsp", " "), ("ndash", "–"), ("mdash", "—"), ("amp", "&")];

/// `normalizeTagalog(input)`.
pub(crate) fn normalize_tagalog(input: &JsString) -> JsString {
    let s = rewrite_with(
        input,
        js_re!(r"&(nbsp|ndash|mdash|amp|quot|lt|gt|#\d+);", "gu"),
        |m, t| {
            let name = m.group(1, t).unwrap();
            js(ENTITY_CHAR
                .iter()
                .find(|(k, _)| js(k) == name)
                .map_or(" ", |(_, c)| *c))
        },
    );
    rewrite(
        &s,
        js_re!(r"(\d)\s*[–—]\s*(?=\d)|(\d)-(?=\d)", "gu"),
        &js("$1$2 hanggang "),
    )
}
