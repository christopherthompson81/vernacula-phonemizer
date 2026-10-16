//! Sesotho cardinal numbers as space-separated words: the citation stems for a bare 1–9, the motso/metso units slot,
//! cl.6 tens and hundreds, cl.8 magnitudes, joined with `le`; digit by digit outside the safe-integer range.
//! Ported from src/languages/sesotho/numbers.ts — see that file for the sources.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;

use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::load_manifest::load_manifest;
use crate::core::numbers::digit_index;

pub const DIR: &str = "languages/sesotho";

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct SesothoNumbers {
    pub zero: String,
    pub units: Vec<String>,
    pub unit_one: String,
    pub unit_noun: String,
    pub class4: Vec<String>,
    pub class6: Vec<String>,
    pub class8: Vec<String>,
    pub ten: String,
    pub tens: String,
    pub hundred_one: String,
    pub hundreds: String,
    pub thousand_one: String,
    pub thousands: String,
    pub million_one: String,
    pub millions: String,
    pub billion_one: String,
    pub billions: String,
    pub class8_concord: String,
    pub and: String,
}

/// This module's own slice of sesotho.jsonc, as in the TS.
#[derive(Debug, FromJson)]
pub struct SesothoNumbersDef {
    pub numbers: SesothoNumbers,
}

/// The `numbers` block, or why it could not be loaded.
pub fn try_numbers() -> Result<&'static SesothoNumbers, String> {
    static M: OnceLock<SesothoNumbersDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "sesotho.jsonc").map_err(|e| e.to_string())
    })
    .map(|d| &d.numbers)
}

/// ⚠ Reached only through a checked path (a `SesothoPhonemizer`, whose constructor loads it).
pub(crate) static N: LazyLock<&'static SesothoNumbers> =
    LazyLock::new(|| try_numbers().unwrap_or_else(|e| panic!("{e}")));

fn unit_part(u: u64) -> String {
    if u == 1 {
        N.unit_one.clone()
    } else {
        format!("{} {}", N.unit_noun, N.class4[u as usize])
    }
}

fn class8_multiple(head: &str, k: u64) -> String {
    if (2..=9).contains(&k) {
        format!("{head} {} {}", N.class8_concord, N.class8[k as usize])
    } else {
        format!("{head} {}", compose(k))
    }
}

/// `numberToWords(n, raw?)`: a non-negative integer → space-separated Sesotho cardinal words.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    if !is_safe_integer(n) || n < 0.0 {
        let digits = match raw {
            Some(r) => r.clone(),
            None => js(&js_number_to_string(n.abs())),
        };
        let parts: Vec<JsString> = digits
            .code_point_strings()
            .into_iter()
            .map(|d| {
                if d == "0" {
                    return js(&N.zero);
                }
                let i = if d.len() == 1 {
                    digit_index(d.0[0])
                } else {
                    -1
                };
                usize::try_from(i)
                    .ok()
                    .and_then(|i| N.units.get(i))
                    .map_or(d, |w| js(w))
            })
            .collect();
        return JsString::join(&parts, &js(" "));
    }
    js(&compose(n as u64))
}

/// The compositor over a non-negative safe integer.
fn compose(n: u64) -> String {
    if n == 0 {
        return N.zero.clone();
    }
    if n < 10 {
        return N.units[n as usize].clone();
    }
    let mut parts: Vec<String> = Vec::new();
    let b = n / 1_000_000_000;
    if b > 0 {
        parts.push(if b == 1 {
            N.billion_one.clone()
        } else {
            class8_multiple(&N.billions, b)
        });
    }
    let m = (n % 1_000_000_000) / 1_000_000;
    if m > 0 {
        parts.push(if m == 1 {
            N.million_one.clone()
        } else {
            class8_multiple(&N.millions, m)
        });
    }
    let th = (n % 1_000_000) / 1000;
    if th > 0 {
        parts.push(if th == 1 {
            N.thousand_one.clone()
        } else {
            class8_multiple(&N.thousands, th)
        });
    }
    let h = (n % 1000) / 100;
    if h == 1 {
        parts.push(N.hundred_one.clone());
    } else if h > 1 {
        parts.push(format!("{} {}", N.hundreds, N.class6[h as usize]));
    }
    let t = (n % 100) / 10;
    if t == 1 {
        parts.push(N.ten.clone());
    } else if t > 1 {
        parts.push(format!("{} {}", N.tens, N.class6[t as usize]));
    }
    let u = n % 10;
    if u > 0 {
        parts.push(unit_part(u));
    }
    parts.join(&format!(" {} ", N.and))
}
