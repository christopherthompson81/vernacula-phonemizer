//! Hungarian cardinal compositor (one concatenated word below a million; *két* before a scale word), the stem
//! shortening before a vowel-initial suffix, and the ordinal and multiplicative words (last-morph replacement).
//! Ported from src/languages/hungarian/numbers.ts — see that file for the orthography.

use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::numbers::digit_index;
use crate::js_re;

/// `below100(n)`, 1 ≤ n < 100.
fn below100(n: i64) -> String {
    let m = &MANIFEST.numbers;
    if n < 10 {
        return m.units[n as usize].clone();
    }
    if n < 20 {
        return m.teens[(n - 10) as usize].clone();
    }
    let (t, u) = ((n / 10) as usize, (n % 10) as usize);
    if t == 2 {
        return if u == 0 {
            m.tens[2].clone()
        } else {
            format!("{}{}", m.tens_prefix["20"], m.units[u])
        };
    }
    if u == 0 {
        m.tens[t].clone()
    } else {
        format!("{}{}", m.tens[t], m.units[u])
    }
}

/// `attributive(w)`: a final *kettő* → *két*.
fn attributive(w: String) -> String {
    match w.strip_suffix("kettő") {
        Some(head) => format!("{head}két"),
        None => w,
    }
}

const VOWEL_SUFFIX_STEM: [(&str, &str); 4] = [
    ("kettő", "kett"),
    ("három", "hárm"),
    ("hét", "het"),
    ("ezer", "ezr"),
];

/// `stemForSuffix(word, suffix)`: the stem shortening before a vowel-initial suffix.
pub fn stem_for_suffix(word: &JsString, suffix: &JsString) -> JsString {
    if !js_re!(r"^[aáeéiíoóöőuúüű]", "u").test(suffix) {
        return word.clone();
    }
    for (morph, stem) in VOWEL_SUFFIX_STEM {
        let morph = js(morph);
        if word.ends_with(&morph) {
            return word
                .slice(0, Some((word.len() - morph.len()) as isize))
                .concat(&js(stem));
        }
    }
    word.clone()
}

/// `below1000(n)`, 1 ≤ n < 1000.
fn below1000(n: i64) -> String {
    let m = &MANIFEST.numbers;
    if n < 100 {
        return below100(n);
    }
    let (h, r) = (n / 100, n % 100);
    let hundred = if h == 1 {
        m.hundred.clone()
    } else {
        let mult = if h == 2 {
            "két"
        } else {
            m.units[h as usize].as_str()
        };
        format!("{mult}{}", m.hundred)
    };
    if r != 0 {
        hundred + &below100(r)
    } else {
        hundred
    }
}

/// `numberToWords(n, raw)`: a safe integer in [0, 10¹²) as words; otherwise each code point of
/// `raw ?? String(Math.abs(n))` as its unit word (a non-digit kept as itself).
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    let m = &MANIFEST.numbers;
    if !is_safe_integer(n) || n < 0.0 || n >= 1e12 {
        let src = raw
            .cloned()
            .unwrap_or_else(|| js(&js_number_to_string(n.abs())));
        let words: Vec<JsString> = src
            .code_point_strings()
            .into_iter()
            .map(|d| {
                // `digitIndex(d)` compares the code-point STRING with "0"…"9": only a one-unit ASCII digit passes.
                let i = if d.len() == 1 {
                    digit_index(d.0[0])
                } else {
                    -1
                };
                if i >= 0 { js(&m.units[i as usize]) } else { d }
            })
            .collect();
        return JsString::join(&words, &js(" "));
    }
    let n = n as i64;
    if n == 0 {
        return js(&m.units[0]);
    }
    let mut parts: Vec<String> = Vec::new();
    let (mrd, mil, thg, r) = (
        n / 1_000_000_000,
        (n % 1_000_000_000) / 1_000_000,
        (n % 1_000_000) / 1000,
        n % 1000,
    );
    let mult = |c: i64| {
        if c == 1 {
            "egy".to_string()
        } else {
            attributive(below1000(c))
        }
    };
    if mrd != 0 {
        parts.push(format!("{} {}", mult(mrd), m.milliard));
    }
    if mil != 0 {
        parts.push(format!("{} {}", mult(mil), m.million));
    }
    let mut word = String::new();
    if thg != 0 {
        if thg == 1 {
            word.push_str(&m.thousand);
        } else {
            word.push_str(&attributive(below1000(thg)));
            word.push_str(&m.thousand);
        }
    }
    if r != 0 {
        word.push_str(&below1000(r));
    }
    if !word.is_empty() {
        parts.push(word);
    }
    js(&parts.join(" "))
}

/// A morph table's keys in insertion order, stably sorted longest first.
fn longest_first(map: &indexmap::IndexMap<String, String>) -> Vec<(JsString, JsString)> {
    let mut keys: Vec<(JsString, JsString)> = map.iter().map(|(k, v)| (js(k), js(v))).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.0.len()));
    keys
}

static ORDINAL_KEYS: LazyLock<Vec<(JsString, JsString)>> =
    LazyLock::new(|| longest_first(&MANIFEST.ordinal_morphs));
static MULTIPLICATIVE_KEYS: LazyLock<Vec<(JsString, JsString)>> =
    LazyLock::new(|| longest_first(&MANIFEST.multiplicative_morphs));

/// The cardinal of `n` with its last word's final morph replaced from `keys`, or `None`.
fn replace_last_morph(n: f64, keys: &[(JsString, JsString)]) -> Option<JsString> {
    let card = number_to_words(n, None);
    if card.is_empty() || js_re!(r"\d", "u").test(&card) {
        return None;
    }
    let mut parts = card.split(&js(" "));
    let last = parts.last().unwrap().clone();
    let (k, v) = keys.iter().find(|(k, _)| last.ends_with(k))?;
    *parts.last_mut().unwrap() = last
        .slice(0, Some((last.len() - k.len()) as isize))
        .concat(v);
    Some(JsString::join(&parts, &js(" ")))
}

/// `multiplicativeWords(n)`: *hatszor*, *ötvenhatszor*; `None` where the cardinal cannot be composed.
pub fn multiplicative_words(n: f64) -> Option<JsString> {
    if !is_safe_integer(n) || n < 0.0 {
        return None;
    }
    replace_last_morph(n, &MULTIPLICATIVE_KEYS)
}

/// `ordinalWords(n)`: *első*, *második*, else the cardinal with its final morph made ordinal.
pub fn ordinal_words(n: f64) -> Option<JsString> {
    if !is_safe_integer(n) || n < 0.0 {
        return None;
    }
    if n == 1.0 {
        return Some(js("első"));
    }
    if n == 2.0 {
        return Some(js("második"));
    }
    replace_last_morph(n, &ORDINAL_KEYS)
}
