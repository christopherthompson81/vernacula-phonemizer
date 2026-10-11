//! Hiligaynon cardinals: tens-first with the `kag` connector, the `ka` ligature before gatos/libo/milyon, and digit
//! by digit from 10⁹ up. Ported from src/languages/hiligaynon/numbers.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use serde::Deserialize;

use super::hiligaynon::DIR;
use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::load_manifest::load_manifest;
use crate::core::numbers::digit_index;

#[derive(Debug, Deserialize)]
pub struct HilNumbers {
    pub units: Vec<String>,
    pub tens: Vec<String>,
    pub connector: String,
    pub ligature: String,
    pub hundred: String,
    pub thousand: String,
    pub million: String,
}

#[derive(Debug, Deserialize)]
struct NumbersFile {
    numbers: HilNumbers,
}

pub fn try_numbers() -> Result<&'static HilNumbers, String> {
    static N: OnceLock<NumbersFile> = OnceLock::new();
    load_once(&N, || {
        load_manifest(DIR, "hiligaynon.jsonc").map_err(|e| e.to_string())
    })
    .map(|f| &f.numbers)
}

static N: LazyLock<&'static HilNumbers> =
    LazyLock::new(|| try_numbers().unwrap_or_else(|e| panic!("{e}")));

/// `below100(n)`: 1 ≤ n < 100.
fn below100(n: u64) -> String {
    if n < 10 {
        return N.units[n as usize].clone();
    }
    let (t, u) = ((n / 10) as usize, (n % 10) as usize);
    if u == 0 {
        N.tens[t].clone()
    } else {
        format!("{} {} {}", N.tens[t], N.connector, N.units[u])
    }
}

/// `kaGroup(count, scale)`.
fn ka_group(count: u64, scale: &str) -> String {
    let c = if count == 1 {
        N.units[1].clone()
    } else {
        below1000(count)
    };
    format!("{c} {} {scale}", N.ligature)
}

/// `below1000(n)`: 1 ≤ n < 1000.
fn below1000(n: u64) -> String {
    if n < 100 {
        return below100(n);
    }
    let hundred = ka_group(n / 100, &N.hundred);
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
        let thousand = ka_group(n / 1000, &N.thousand);
        return match n % 1000 {
            0 => thousand,
            r => format!("{thousand} {} {}", N.connector, below1000(r)),
        };
    }
    let million = ka_group(n / 1_000_000, &N.million);
    match n % 1_000_000 {
        0 => million,
        r => format!("{million} {} {}", N.connector, compose(r)),
    }
}
