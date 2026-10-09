//! Mandarin text normalization ahead of the engine's own numbers and the shared symbol tier: fraction order,
//! negatives, math signs, the ampersand, bare exponents; and initialisms spelled as Han letter names.
//! Ported from src/languages/mandarin/normalize.ts — see that file for the corpus evidence.

use std::sync::OnceLock;

use super::manifest::MANIFEST;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const SIGN: &str = "[-−–]";
const NEG_LEFT_STRICT: &str = "(?<![\\p{L}\\p{Nd}-])";
const NEG_LEFT_LOOSE: &str = "(?<![\\p{Nd}\\p{sc=Latn}-])";

fn below_zero() -> &'static JsRegex {
    static RE: OnceLock<JsRegex> = OnceLock::new();
    RE.get_or_init(|| {
        JsRegex::new(
            &format!("{NEG_LEFT_LOOSE}{SIGN}(\\d+(?:[.,]\\d+)?)(?=\\s*(?:°|℃|℉|度))"),
            "gu",
        )
        .unwrap()
    })
}

fn negative() -> &'static JsRegex {
    static RE: OnceLock<JsRegex> = OnceLock::new();
    RE.get_or_init(|| JsRegex::new(&format!("{NEG_LEFT_STRICT}{SIGN}(?=\\d)"), "gu").unwrap())
}

/// Sign → word, applied in order.
fn signs() -> [(&'static JsRegex, &'static str); 7] {
    [
        (js_re!(r"±\s?", "gu"), "正负"),
        (js_re!(r"\s?×\s?", "gu"), "乘以"),
        (js_re!(r"\s?÷\s?", "gu"), "除以"),
        (js_re!(r"\s?=\s?", "gu"), "等于"),
        (js_re!(r"\s?<\s?", "gu"), "小于"),
        (js_re!(r"\s?>\s?", "gu"), "大于"),
        (js_re!(r"\s?\+\s?", "gu"), "加"),
    ]
}

fn letter_name(c: &JsString) -> Option<&'static str> {
    MANIFEST.letter_names.get(&c.to_string_lossy()).map(String::as_str)
}

/// ` ${[...run].map((c) => letterNames[c] ?? c).join(" ")} `.
fn spell_letters(run: &JsString) -> JsString {
    let mut parts: Vec<JsString> = Vec::new();
    for c in run.code_point_strings() {
        parts.push(letter_name(&c).map_or(c, js));
    }
    js(" ").concat(&JsString::join(&parts, &js(" "))).concat(&js(" "))
}

/// `normalizeMandarin(input)`.
pub fn normalize_mandarin(input: &JsString) -> JsString {
    let mut s = rewrite_with(
        input,
        js_re!(r"(?<![\d.,/])(\d{1,4})\/(\d{1,4})(?![\d/])", "gu"),
        |m, s| {
            let (num, den) = (m.group(1, s).unwrap(), m.group(2, s).unwrap());
            den.concat(&js("分之")).concat(&num)
        },
    );
    s = rewrite(&s, below_zero(), &js("零下$1"));
    s = rewrite(&s, negative(), &js("负"));
    for (re, word) in signs() {
        s = rewrite(&s, re, &js(word));
    }
    s = rewrite(&s, js_re!(r"(?<=[A-Za-z])\s?[&＆]\s?(?=[A-Za-z])", "gu"), &js(" and "));
    s = rewrite(&s, js_re!(r"\s?[&＆]\s?", "gu"), &js("和"));
    rewrite_with(&s, js_re!(r"(?<=\d)([²³])", "gu"), |m, s| {
        let e = m.group(1, s).unwrap();
        let power = if e == "²" { "平方" } else { "立方" };
        js("的").concat(&js(power))
    })
}

/// `spellInitialisms(input)`: a 2–3 capital run (not a Roman numeral) and a lone capital touching Han.
pub fn spell_initialisms(input: &JsString) -> JsString {
    let s = rewrite_with(
        input,
        js_re!(r"(?<![\p{sc=Latn}\d])[A-Z]{2,3}(?![\p{sc=Latn}\d])", "gu"),
        |m, s| {
            let run = m.value(s);
            if js_re!(r"^[IVX]{2,3}$", "u").test(&run) {
                run
            } else {
                spell_letters(&run)
            }
        },
    );
    rewrite_with(
        &s,
        js_re!(
            r"(?<=\p{Script=Han})([A-Z])(?![\p{sc=Latn}\d])|(?<![\p{sc=Latn}\d])([A-Z])(?=\p{Script=Han})",
            "gu"
        ),
        |m, s| {
            let l = m.group(1, s).or_else(|| m.group(2, s)).unwrap();
            match letter_name(&l) {
                None => m.value(s),
                Some(name) => js(" ").concat(&js(name)).concat(&js(" ")),
            }
        },
    )
}
