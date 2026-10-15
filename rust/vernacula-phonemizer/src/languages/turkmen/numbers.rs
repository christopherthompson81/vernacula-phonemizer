//! Turkmen number words: the Turkic decimal composer (a bare 100 drops "bir", a thousand keeps it), as spellings.
//! Ported from src/languages/turkmen/numbers.ts — see that file for the sources.

use std::sync::{LazyLock, OnceLock};

use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::numbers::{NumbersDef, Word};

pub const DIR: &str = "languages/turkmen";

/// `loadManifest<{ numbers: NumbersDef }>(…, "turkmen.jsonc")`: the file's `numbers` block alone.
#[derive(Deserialize)]
struct NumbersOnly {
    numbers: NumbersDef,
}

pub fn try_num() -> Result<&'static NumbersDef, String> {
    static N: OnceLock<NumbersOnly> = OnceLock::new();
    load_once(&N, || {
        load_manifest::<NumbersOnly>(DIR, "turkmen.jsonc").map_err(|e| e.to_string())
    })
    .map(|n| &n.numbers)
}

/// `DEF.numbers`, for code reached only through a checked path (`createTurkmen` loads it first).
pub(crate) static NUM: LazyLock<&'static NumbersDef> =
    LazyLock::new(|| try_num().unwrap_or_else(|e| panic!("{e}")));

/// `turkmenNumberWords(n, d)` over the JS number `n`. ⚠ A `f64`: `ordinalOf` passes any integer, unbounded.
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
    let (div, word) = if n < 1_000_000.0 {
        (1000.0, &mag.thousand)
    } else if n < 1_000_000_000.0 {
        (1_000_000.0, &mag.million)
    } else {
        (1_000_000_000.0, &mag.billion)
    };
    let mut v = words_f64((n / div).floor(), d);
    v.push(word.clone());
    v.extend(more(n % div));
    v
}

/// `turkmenNumberWords` as the `NumberComposer` `renderNumber` takes (a safe integer).
pub(crate) fn turkmen_number_words(n: u64, d: &NumbersDef) -> Vec<Word> {
    words_f64(n as f64, d)
}

/// `numberToWords(n)`: the words, a `null` slot dropped.
pub(crate) fn number_to_words(n: f64) -> Vec<String> {
    words_f64(n, &NUM).into_iter().flatten().collect()
}
