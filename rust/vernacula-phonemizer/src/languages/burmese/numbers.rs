//! Burmese (my) cardinal numbers → one solid orthographic word (place words, creaky before a remainder, repeating
//! at 10⁷), and the digit-at-a-time fallback. Ported from src/languages/burmese/numbers.ts — see that file for the
//! corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;

use super::burmese::DIR;
use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::load_manifest::load_manifest;

#[derive(Debug, FromJson)]
pub struct BurmeseNumbers {
    pub zero: String,
    pub units: Vec<String>,
    pub places: Vec<(String, String)>,
    pub one: String,
}

#[derive(Debug, FromJson)]
struct NumbersBlock {
    numbers: BurmeseNumbers,
}

pub fn try_numbers() -> Result<&'static BurmeseNumbers, String> {
    static N: OnceLock<NumbersBlock> = OnceLock::new();
    load_once(&N, || {
        load_manifest(DIR, "burmese.jsonc").map_err(|e| e.to_string())
    })
    .map(|b| &b.numbers)
}

static N: LazyLock<&'static BurmeseNumbers> =
    LazyLock::new(|| try_numbers().unwrap_or_else(|e| panic!("{e}")));

const CRORE: f64 = 10_000_000.0;

/// `spellDigits(digits)`: each ASCII digit's word, space-joined (a zero reads `N.zero`).
pub fn spell_digits(digits: &JsString) -> JsString {
    let words: Vec<String> = digits
        .code_point_strings()
        .iter()
        .filter_map(|c| match c.units() {
            [u] if (b'0' as u16..=b'9' as u16).contains(u) => Some(if *u == b'0' as u16 {
                N.zero.clone()
            } else {
                N.units[(*u - b'0' as u16) as usize].clone()
            }),
            _ => None,
        })
        .collect();
    js(&words.join(" "))
}

/// `numberToWords(n)`: `String(n)` for an unsafe or negative number.
pub fn number_to_words(n: f64) -> JsString {
    if !is_safe_integer(n) || n < 0.0 {
        return js(&js_number_to_string(n));
    }
    if n == 0.0 {
        return js(&N.zero);
    }
    if n >= CRORE {
        let crores = (n / CRORE).floor();
        let rest = n % CRORE;
        let place = &N.places[6];
        let parts = [
            number_to_words(crores),
            js(if rest == 0.0 { &place.0 } else { &place.1 }),
            if rest == 0.0 {
                JsString::new()
            } else {
                number_to_words(rest)
            },
        ];
        let kept: Vec<JsString> = parts.into_iter().filter(|s| !s.is_empty()).collect();
        return JsString::join(&kept, &JsString::new());
    }
    let mut out: Vec<String> = Vec::new();
    for p in (1..=6).rev() {
        let value = 10f64.powi(p);
        let mult = (n / value).floor() % 10.0;
        if mult == 0.0 {
            continue;
        }
        let place = &N.places[p as usize - 1];
        let rest = n % value;
        if !(mult == 1.0 && p == 1) {
            out.push(if mult == 1.0 {
                N.one.clone()
            } else {
                N.units[mult as usize].clone()
            });
        }
        out.push(if rest == 0.0 {
            place.0.clone()
        } else {
            place.1.clone()
        });
    }
    let unit = n % 10.0;
    if unit != 0.0 {
        out.push(N.units[unit as usize].clone());
    }
    js(&out.concat())
}
