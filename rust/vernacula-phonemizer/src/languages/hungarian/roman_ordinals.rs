//! Hungarian Roman-numeral policy: a numeral before a century-type noun, or before such a noun or any capital
//! after it (the regnal pattern), reads as the ORDINAL (`ordinalWords`, no range cap).
//! Ported from src/languages/hungarian/romanOrdinals.ts — see that file for the sources and the residual.

use super::manifest::try_manifest;
use super::numbers::ordinal_words;
use crate::core::js_regex::JsRegex;
use crate::core::roman::RomanPolicy;

const NOUNS: [&str; 9] = [
    "század",
    "évszázad",
    "évezred",
    "évfordul",
    "kerület",
    "kongresszus",
    "fejezet",
    "olimpi",
    "világháború",
];

/// `bothCases(w)`: `[${w[0].toUpperCase()}${w[0]}]${w.slice(1)}` (one code unit; every noun starts in the BMP).
fn both_cases(w: &str) -> String {
    let mut cs = w.chars();
    let first = cs.next().unwrap();
    format!("[{}{first}]{}", first.to_uppercase(), cs.as_str())
}

fn noun_alt() -> String {
    NOUNS
        .iter()
        .map(|w| both_cases(w))
        .collect::<Vec<_>>()
        .join("|")
}

/// `ROMAN_POLICY` (registry.ts's `romanHu`); no `exclude`.
pub fn roman_policy() -> RomanPolicy {
    let alt = noun_alt();
    RomanPolicy {
        exclude: Vec::new(),
        // With no manifest the ordinal is declined, so the cardinal stands instead of the MANIFEST panic.
        ordinal: Some(Box::new(|n| {
            try_manifest().ok().and_then(|_| {
                if n >= 1 {
                    ordinal_words(n as f64)
                } else {
                    None
                }
            })
        })),
        ordinal_before: Some(JsRegex::new(&format!("^(?:{alt})"), "u").unwrap()),
        ordinal_after: Some(JsRegex::new(&format!(r"^(?:{alt}|\p{{Lu}})"), "u").unwrap()),
    }
}
