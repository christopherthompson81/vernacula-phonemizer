//! French ordinals: formation from any integer, and the two written forms that reach the engine (digit
//! notation `1er`/`37e`, the Roman century `XVIIe`). Ported from src/languages/french/ordinals.ts — see that
//! file for the rules and the homograph veto.

use std::sync::LazyLock;

use super::numbers::{is_safe_integer, number_to_words_loaded};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::rewrite_with;
use crate::core::roman::roman_to_int;
use crate::js_re;

const PLURAL_MAGNITUDES: [&str; 5] = ["vingts", "cents", "milliers", "millions", "milliards"];

fn to_ieme(word: &JsString) -> JsString {
    let w = if PLURAL_MAGNITUDES.iter().any(|p| word == *p) {
        word.slice(0, Some(-1))
    } else {
        word.clone()
    };
    if w == "un" {
        return js("unième");
    }
    if w == "cinq" {
        return js("cinquième");
    }
    if w == "neuf" {
        return js("neuvième");
    }
    let stem = if w.ends_with(&js("e")) { w.slice(0, Some(-1)) } else { w };
    stem.concat(&js("ième"))
}

/// `ordinal_loaded(n, { feminine, plural })`: `None` for 0 and for non-integers.
pub(crate) fn ordinal_loaded(n: f64, feminine: bool, plural: bool) -> Option<JsString> {
    if !is_safe_integer(n) || n < 1.0 {
        return None;
    }
    let s = if plural { "s" } else { "" };
    if n == 1.0 {
        return Some(js(&format!("{}{s}", if feminine { "première" } else { "premier" })));
    }
    let mut words = number_to_words_loaded(n, None).split(&js(" "));
    let mut parts = words.pop().unwrap().split(&js("-"));
    let k = parts.len() - 1;
    parts[k] = to_ieme(&parts[k]);
    let last = JsString::join(&parts, &js("-"));
    if words.len() == 1 && words[0] == "un" && js_re!("^(million|milliard)ième$").test(&last) {
        words.pop();
    }
    words.push(last);
    Some(JsString::join(&words, &js(" ")).concat(&js(s)))
}

fn feminine_suffix() -> &'static JsRegex {
    js_re!("^(res?|ères?|eres?)$")
}

const SUFFIXES: &str = "ers|er|res|re|ères|ère|eres|ere|èmes|ème|emes|eme|es|e|des|de|ds|d";
const L: &str = "a-zà-ÿœæ";

static DIGIT_NOTATION: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!("(?<![{L}\\d])(\\d+)({SUFFIXES})(?![{L}\\d])"), "gi").unwrap()
});

pub(crate) fn normalize_french_ordinal_digits_loaded(text: &JsString) -> JsString {
    if !js_re!(r"\d").test(text) {
        return text.clone();
    }
    rewrite_with(text, &DIGIT_NOTATION, |m, s| {
        let whole = m.value(s);
        let n = js_number(&m.group(1, s).unwrap());
        let suf = m.group(2, s).unwrap().to_lower_case();
        let plural = suf.ends_with(&js("s"));
        if js_re!("^(d|ds|de|des)$").test(&suf) {
            if n != 2.0 {
                return whole;
            }
            let base = if suf.starts_with(&js("de")) { "seconde" } else { "second" };
            return js(&format!("{base}{}", if plural { "s" } else { "" }));
        }
        ordinal_loaded(n, feminine_suffix().test(&suf), plural).unwrap_or(whole)
    })
}

const ROMAN_WORD_STOPLIST: [&str; 6] = ["cie", "cies", "cive", "cives", "clive", "clives"];

static ROMAN_NOTATION: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!("(?<![{L}\\d])([ivxlcdm]+)({SUFFIXES})(?![{L}\\d])"), "gi").unwrap()
});

pub(crate) fn normalize_french_ordinal_romans_loaded(text: &JsString, is_word: &dyn Fn(&JsString) -> bool) -> JsString {
    if !js_re!("[ivxlcdm]", "i").test(text) {
        return text.clone();
    }
    rewrite_with(text, &ROMAN_NOTATION, |m, s| {
        let whole = m.value(s);
        let lower = whole.to_lower_case();
        if is_word(&lower) || ROMAN_WORD_STOPLIST.iter().any(|w| lower == *w) {
            return whole;
        }
        let Some(n) = roman_to_int(&m.group(1, s).unwrap()) else {
            return whole;
        };
        let suf = m.group(2, s).unwrap().to_lower_case();
        ordinal_loaded(n as f64, feminine_suffix().test(&suf), suf.ends_with(&js("s"))).unwrap_or(whole)
    })
}

/// `ordinal(n, { feminine, plural })` (`None` for 0 and non-integers), or why the manifest is unavailable.
pub fn ordinal(n: f64, feminine: bool, plural: bool) -> Result<Option<JsString>, String> {
    super::manifest::try_manifest()?;
    Ok(ordinal_loaded(n, feminine, plural))
}

/// `normalizeFrenchOrdinalDigits(text)`, or why the manifest is unavailable.
pub fn normalize_french_ordinal_digits(text: &JsString) -> Result<JsString, String> {
    super::manifest::try_manifest()?;
    Ok(normalize_french_ordinal_digits_loaded(text))
}

/// `normalizeFrenchOrdinalRomans(text, isWord)`, or why the manifest is unavailable.
pub fn normalize_french_ordinal_romans(
    text: &JsString,
    is_word: &dyn Fn(&JsString) -> bool,
) -> Result<JsString, String> {
    super::manifest::try_manifest()?;
    Ok(normalize_french_ordinal_romans_loaded(text, is_word))
}
