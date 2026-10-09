//! A sign whose reading FOLLOWS both operands (`A < B` → "A B से कम"), for postpositional and verb-final
//! languages, with trailing punctuation kept off the operand and a catch-all pass for chained signs.
//! Ported from src/core/postposedSign.ts — see that file for the corpus evidence.

use super::js_regex::JsRegex;
use super::js_string::{JsString, js};
use super::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `postposedSign(s, sign, words)`; `sign` is a regex SOURCE string, escaped by the caller.
pub fn postposed_sign(s: &JsString, sign: &str, words: &JsString) -> JsString {
    let trailing = js_re!(r#"^(.*?)([,;।॥!?)\]"'’、。]*)$"#, "su");
    let pair = JsRegex::new(&format!(r"(\S+)\s*{sign}\s*(\S+)"), "gu").expect("postposedSign pattern");
    let out = rewrite_with(s, &pair, |m, full| {
        let a = m.group(1, full).unwrap_or_default();
        let b = m.group(2, full).unwrap_or_default();
        let split = trailing.exec(&b);
        let operand = split.as_ref().and_then(|x| x.group(1, &b)).unwrap_or_else(|| b.clone());
        let marks = split.as_ref().and_then(|x| x.group(2, &b)).unwrap_or_default();
        let mut r = a;
        r.push_str(&js(" "));
        r.push_str(&operand);
        r.push_str(&js(" "));
        r.push_str(words);
        r.push_str(&marks);
        r
    });
    let lone = JsRegex::new(&format!(r"\s?{sign}\s?"), "gu").expect("postposedSign pattern");
    let mut rep = js(" ");
    rep.push_str(words);
    rep.push_str(&js(" "));
    // ⚠ A `$` in `words` would be a substitution pattern in the TS replace string too; kept as such.
    rewrite(&out, &lone, &rep)
}
