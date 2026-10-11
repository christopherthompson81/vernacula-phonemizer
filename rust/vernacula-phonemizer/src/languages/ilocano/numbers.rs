//! Ilocano cardinals: `sanga-` for one of a scale, a vowel-final unit fused onto pulo/gasut/ribo/riwriw, else the
//! `a` ligature, joined with `ket`; digit by digit from 10⁹ up.
//! Ported from src/languages/ilocano/numbers.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use serde::Deserialize;

use super::ilocano::DIR;
use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::load_manifest::load_manifest;
use crate::core::numbers::digit_index;

#[derive(Debug, Deserialize)]
pub struct Magnitudes {
    pub ten: String,
    pub hundred: String,
    pub thousand: String,
    pub million: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IloNumbers {
    pub units: Vec<String>,
    pub one_prefix: String,
    pub ligature: String,
    pub connector: String,
    pub magnitudes: Magnitudes,
}

#[derive(Debug, Deserialize)]
struct NumbersFile {
    numbers: IloNumbers,
}

pub fn try_numbers() -> Result<&'static IloNumbers, String> {
    static N: OnceLock<NumbersFile> = OnceLock::new();
    load_once(&N, || {
        load_manifest(DIR, "ilocano.jsonc").map_err(|e| e.to_string())
    })
    .map(|f| &f.numbers)
}

static N: LazyLock<&'static IloNumbers> =
    LazyLock::new(|| try_numbers().unwrap_or_else(|e| panic!("{e}")));

/// `isVowelFinal(w)`: the last code unit is a vowel letter.
fn is_vowel_final(w: &str) -> bool {
    w.encode_utf16()
        .last()
        .is_some_and(|u| "aeiou".encode_utf16().any(|x| x == u))
}

/// `scaleGroup(count, scale)`.
fn scale_group(count: u64, scale: &str) -> String {
    if count == 1 {
        return format!("{}{scale}", N.one_prefix);
    }
    let c = if count < 10 {
        N.units[count as usize].clone()
    } else {
        below1000(count)
    };
    if count < 10 && is_vowel_final(&c) {
        format!("{c}{scale}")
    } else {
        format!("{c} {} {scale}", N.ligature)
    }
}

/// `below100(n)`.
fn below100(n: u64) -> String {
    if n < 10 {
        return N.units[n as usize].clone();
    }
    let tens = scale_group(n / 10, &N.magnitudes.ten);
    match n % 10 {
        0 => tens,
        u => format!("{tens} {} {}", N.connector, N.units[u as usize]),
    }
}

/// `below1000(n)`.
fn below1000(n: u64) -> String {
    if n < 100 {
        return below100(n);
    }
    let hundred = scale_group(n / 100, &N.magnitudes.hundred);
    match n % 100 {
        0 => hundred,
        r => format!("{hundred} {} {}", N.connector, below100(r)),
    }
}

/// `numberToWords(n, raw)`: a safe integer below 10⁹ → words; anything else digit by digit (an unknown
/// character passes through).
pub(crate) fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    if !is_safe_integer(n) || n < 0.0 || n >= 1e9 {
        let digits = raw
            .cloned()
            .unwrap_or_else(|| js(&js_number_to_string(n.abs())));
        let words: Vec<JsString> = digits
            .code_point_strings()
            .into_iter()
            .map(|d| {
                let i = if d.len() == 1 {
                    digit_index(d.units()[0])
                } else {
                    -1
                };
                if i >= 0 { js(&N.units[i as usize]) } else { d }
            })
            .collect();
        return JsString::join(&words, &js(" "));
    }
    js(&compose(n as u64))
}

fn compose(n: u64) -> String {
    if n == 0 {
        return N.units[0].clone();
    }
    if n < 1000 {
        return below1000(n);
    }
    if n < 1_000_000 {
        let thousand = scale_group(n / 1000, &N.magnitudes.thousand);
        return match n % 1000 {
            0 => thousand,
            r => format!("{thousand} {} {}", N.connector, below1000(r)),
        };
    }
    let million = scale_group(n / 1_000_000, &N.magnitudes.million);
    match n % 1_000_000 {
        0 => million,
        r => format!("{million} {} {}", N.connector, compose(r)),
    }
}
