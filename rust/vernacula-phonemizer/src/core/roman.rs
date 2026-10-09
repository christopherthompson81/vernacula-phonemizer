//! Roman numerals to digits, under a per-language policy for the homographs.
//! Ported from src/core/roman.ts — see that file for the collision measurements.

use super::js_regex::JsRegex;
use super::js_string::{JsString, js};
use super::provenance::rewrite_with;
use crate::js_re;

const VALUES: [(&str, u32); 13] = [
    ("m", 1000), ("cm", 900), ("d", 500), ("cd", 400), ("c", 100), ("xc", 90),
    ("l", 50), ("xl", 40), ("x", 10), ("ix", 9), ("v", 5), ("iv", 4), ("i", 1),
];

pub fn roman_to_int(token: &JsString) -> Option<u32> {
    let s = token.to_lower_case();
    if s.is_empty() || !js_re!("^m{0,4}(cm|cd|d?c{0,3})(xc|xl|l?x{0,3})(ix|iv|v?i{0,3})$").test(&s) {
        return None;
    }
    let mut n = 0;
    let mut i = 0;
    while i < s.len() {
        let two = s.slice(i as isize, Some(i as isize + 2));
        if let Some((_, v)) = VALUES.iter().find(|(sym, _)| sym.len() == 2 && two == *sym) {
            n += v;
            i += 2;
            continue;
        }
        let one = s.char_at(i);
        let (_, v) = VALUES.iter().find(|(sym, _)| sym.len() == 1 && one == *sym)?;
        n += v;
        i += 1;
    }
    (n > 0).then_some(n)
}

pub const COLLISIONS: [&str; 29] = [
    "mm", "cm", "ml", "dl", "cl", "cc",
    "xl", "xxl",
    "cd", "dc", "dv", "dx", "lv", "mv", "mc", "md", "cv", "ccc",
    "mi", "di", "ci", "li", "vi", "xi",
    "mix", "div", "civ", "liv", "dix",
];

const LOWERCASE_SAFE: [&str; 25] = [
    "ii", "iii", "iv", "vii", "viii", "ix",
    "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx",
    "xxi", "xxii", "xxiii", "xxiv", "xxv", "xxvi", "xxvii", "xxviii", "xxix", "xxx",
];

#[derive(Default)]
pub struct RomanPolicy {
    /// This language's own homographs, lowercase: never a numeral.
    pub exclude: Vec<JsString>,
    pub ordinal: Option<Box<dyn Fn(u32) -> Option<JsString> + Send + Sync>>,
    pub ordinal_before: Option<JsRegex>,
    pub ordinal_after: Option<JsRegex>,
}

/// Per-language exclusions beyond `COLLISIONS`.
pub fn roman_exclusions(lang: &str) -> Vec<JsString> {
    match lang {
        "ro" | "rup" => vec![js("vii")],
        _ => Vec::new(),
    }
}

fn is_upper(w: &JsString) -> bool {
    *w == w.to_upper_case() && js_re!(r"\p{Lu}", "u").test(w)
}

fn digit_at(text: &JsString, i: Option<usize>) -> bool {
    let ch = i.map_or_else(JsString::new, |i| text.char_at(i));
    js_re!(r"\d", "u").test(&ch)
}

pub fn normalize_romans(text: &JsString, policy: &RomanPolicy) -> JsString {
    if !js_re!("[ivxlcdmIVXLCDM]", "u").test(text) {
        return text.clone();
    }
    let has_lower = js_re!(r"\p{Ll}", "u").test(text);
    rewrite_with(text, js_re!(r"\p{L}+", "gu"), |m, text| {
        let tok = m.value(text);
        let offset = m.index();
        let lower = tok.to_lower_case();
        if policy.exclude.contains(&lower) {
            return tok;
        }
        if digit_at(text, offset.checked_sub(1)) || digit_at(text, Some(offset + tok.len())) {
            return tok;
        }
        let Some(n) = roman_to_int(&tok) else { return tok };
        let all_caps = is_upper(&tok);
        let before = text.slice(0, Some(offset as isize));
        let after = text.slice((offset + tok.len()) as isize, None);
        let prev_w = js_re!(r"(\p{L}+)[^\p{L}]*$", "u").exec(&before).and_then(|m| m.group(1, &before));
        let next_w = js_re!(r"^[^\p{L}]*(\p{L}+)", "u").exec(&after).and_then(|m| m.group(1, &after));
        let in_context = prev_w.as_ref().is_some_and(|w| policy.ordinal_before.as_ref().is_some_and(|re| re.test(w)))
            || next_w.as_ref().is_some_and(|w| policy.ordinal_after.as_ref().is_some_and(|re| re.test(w)));
        let single_cap = |w: Option<&JsString>| w.is_some_and(|w| w.len() == 1 && is_upper(w));
        if single_cap(Some(&tok)) && (single_cap(prev_w.as_ref()) || single_cap(next_w.as_ref())) {
            return tok;
        }
        let licensed = in_context && all_caps && has_lower;
        if !licensed {
            if tok.len() < 2 {
                return tok;
            }
            if COLLISIONS.iter().any(|c| lower == *c) {
                return tok;
            }
            if !(all_caps && has_lower) && !LOWERCASE_SAFE.iter().any(|c| lower == *c) {
                return tok;
            }
        }
        if in_context {
            if let Some(ord) = policy.ordinal.as_ref().and_then(|f| f(n)) {
                if !ord.is_empty() {
                    return ord;
                }
            }
        }
        js(&n.to_string())
    })
}
