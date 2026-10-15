//! Uzbek number words: the Turkic decimal composer (a bare 100 / 1000 drops "bir", a million keeps it) and the
//! ordinal on the last word (-nchi / -inchi). Ported from src/languages/uzbek/numbers.ts — see that file for
//! the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, is_safe_integer, js};
use crate::core::load_manifest::load_manifest;
use crate::core::numbers::{NumbersDef, Word};
use crate::js_re;

pub const DIR: &str = "languages/uzbek";

/// `loadManifest<{ numbers: NumbersDef }>(…, "uzbek.jsonc")`: the file's `numbers` block alone.
#[derive(Deserialize)]
struct NumbersOnly {
    numbers: NumbersDef,
}

pub fn try_num() -> Result<&'static NumbersDef, String> {
    static N: OnceLock<NumbersOnly> = OnceLock::new();
    load_once(&N, || {
        load_manifest::<NumbersOnly>(DIR, "uzbek.jsonc").map_err(|e| e.to_string())
    })
    .map(|n| &n.numbers)
}

/// `NUM`, for code reached only through a checked path (`createUzbek` loads it first).
pub(crate) static NUM: LazyLock<&'static NumbersDef> =
    LazyLock::new(|| try_num().unwrap_or_else(|e| panic!("{e}")));

/// `turkicNumberWords(n, d)` over the JS number `n` (already floored by its callers). ⚠ A `f64`, not a `u64`:
/// `numberToWords` floors and composes ANY finite non-negative number, past 2^53 included.
fn words_f64(n: f64, d: &NumbersDef) -> Vec<Word> {
    let unit = |k: f64| d.units.get(k as usize).cloned();
    let mag = &d.magnitudes;
    let more = |r: f64| {
        if r != 0.0 {
            words_f64(r, d)
        } else {
            Vec::new()
        }
    };
    if n < 10.0 {
        return vec![unit(n)];
    }
    if n < 100.0 {
        let (t, u) = ((n / 10.0).floor() * 10.0, n % 10.0);
        let mut v = vec![d.tens.get(&(t as u64).to_string()).cloned()];
        if u != 0.0 {
            v.push(unit(u));
        }
        return v;
    }
    if n < 1000.0 {
        let (h, r) = ((n / 100.0).floor(), n % 100.0);
        let mut v = Vec::new();
        if h > 1.0 {
            v.push(unit(h));
        }
        v.push(mag.hundred.clone());
        v.extend(more(r));
        return v;
    }
    if n < 1_000_000.0 {
        let (th, r) = ((n / 1000.0).floor(), n % 1000.0);
        let mut v = if th > 1.0 {
            words_f64(th, d)
        } else {
            Vec::new()
        };
        v.push(mag.thousand.clone());
        v.extend(more(r));
        return v;
    }
    let (div, word) = if n < 1_000_000_000.0 {
        (1_000_000.0, &mag.million)
    } else {
        (1_000_000_000.0, &mag.billion)
    };
    let mut v = words_f64((n / div).floor(), d);
    v.push(word.clone());
    v.extend(more(n % div));
    v
}

/// `turkicNumberWords` as the `NumberComposer` `renderNumber` takes (a safe integer).
pub(crate) fn turkic_number_words(n: u64, d: &NumbersDef) -> Vec<Word> {
    words_f64(n as f64, d)
}

/// `numberToWords(n)`: "" for a negative or non-finite number; a gap renders as "?".
pub(crate) fn number_to_words(n: f64) -> JsString {
    if !n.is_finite() || n < 0.0 {
        return JsString::new();
    }
    let words: Vec<String> = words_f64(n.floor(), &NUM)
        .into_iter()
        .map(|w| w.unwrap_or_else(|| "?".into()))
        .collect();
    js(&words.join(" "))
}

/// `suffixed(stem)`: -nchi after a vowel, -inchi after a consonant.
pub(crate) fn suffixed(stem: &str) -> String {
    let link = if js_re!(r"[aeiou]$", "u").test(&js(stem)) {
        ""
    } else {
        "i"
    };
    format!("{stem}{link}nchi")
}

/// `ordinalWords(n)`: the ordinal on the last word; `None` for an unsafe integer below 1 or a gap.
pub(crate) fn ordinal_words(n: f64) -> Option<JsString> {
    if !is_safe_integer(n) || n < 1.0 {
        return None;
    }
    let mut words: Vec<String> = words_f64(n, &NUM)
        .into_iter()
        .map(|w| w.unwrap_or_default())
        .collect();
    if words.is_empty() || words.iter().any(|w| w.is_empty()) {
        return None;
    }
    let last = words.pop().unwrap();
    words.push(suffixed(&last));
    Some(js(&words.join(" ")))
}
