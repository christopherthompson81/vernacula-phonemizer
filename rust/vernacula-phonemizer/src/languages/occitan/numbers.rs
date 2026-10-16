//! Occitan cardinal numbers: `vint e un` but `trenta un`, the hundreds table, invariable `mila`, miliards and milions.
//! Ported from src/languages/occitan/numbers.ts — see that file for the sources.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;

use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::load_manifest::load_manifest;
use crate::core::numbers::digit_index;

pub const DIR: &str = "languages/occitan";

#[derive(Debug, FromJson)]
pub struct Scale {
    pub value: f64,
    pub one: String,
    pub many: String,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Numbers {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub hundreds: Vec<String>,
    pub thousand: String,
    pub and: String,
    pub scales: Vec<Scale>,
}

/// `OccitanNumbersDef`: this module's own slice of occitan.jsonc, as in the TS.
#[derive(Debug, FromJson)]
pub struct OccitanNumbersDef {
    pub numbers: Numbers,
}

/// The `numbers` block, or why it could not be loaded.
pub fn try_numbers() -> Result<&'static Numbers, String> {
    static M: OnceLock<OccitanNumbersDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "occitan.jsonc").map_err(|e| e.to_string())
    })
    .map(|d| &d.numbers)
}

/// ⚠ Reached only through a checked path (an `OccitanPhonemizer`, whose constructor loads it).
static N: LazyLock<&'static Numbers> =
    LazyLock::new(|| try_numbers().unwrap_or_else(|e| panic!("{e}")));

fn below100(n: u64) -> String {
    if n < 20 {
        return N.ones[n as usize].clone();
    }
    let (t, u) = ((n / 10) as usize, (n % 10) as usize);
    if u == 0 {
        return N.tens[t].clone();
    }
    if t == 2 {
        format!("{} {} {}", N.tens[t], N.and, N.ones[u])
    } else {
        format!("{} {}", N.tens[t], N.ones[u])
    }
}

fn below1000(n: u64) -> String {
    if n < 100 {
        return below100(n);
    }
    let (h, r) = (n / 100, n % 100);
    let head = &N.hundreds[h as usize];
    if r != 0 {
        format!("{head} {}", below100(r))
    } else {
        head.clone()
    }
}

fn below1e6(n: u64) -> String {
    if n < 1000 {
        return below1000(n);
    }
    let (th, r) = (n / 1000, n % 1000);
    let thousand = if th == 1 {
        N.thousand.clone()
    } else {
        format!("{} {}", below1000(th), N.thousand)
    };
    if r != 0 {
        format!("{thousand} {}", below1000(r))
    } else {
        thousand
    }
}

/// `numberToWords(n, raw?)`. Out of range or unsafe: each CODE POINT of `raw` (else `String(Math.abs(n))`) by its
/// digit word, a non-digit passed through as itself.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    if !is_safe_integer(n) || n < 0.0 || n >= 1e12 {
        let digits = raw
            .cloned()
            .unwrap_or_else(|| js(&js_number_to_string(n.abs())));
        let words: Vec<JsString> = digits
            .code_point_strings()
            .into_iter()
            .map(|d| {
                let i = digit_index(d.char_code_at(0).unwrap_or(0));
                if i >= 0 { js(&N.ones[i as usize]) } else { d }
            })
            .collect();
        return JsString::join(&words, &js(" "));
    }
    if n == 0.0 {
        return js(&N.ones[0]);
    }
    if n < 1e6 {
        return js(&below1e6(n as u64));
    }
    for sc in &N.scales {
        if n < sc.value {
            continue;
        }
        let (q, r) = ((n / sc.value).floor(), n % sc.value);
        let head = if q == 1.0 {
            sc.one.clone()
        } else {
            format!("{} {}", below1e6(q as u64), sc.many)
        };
        return if r != 0.0 {
            js(&head).concat(&js(" ")).concat(&number_to_words(r, None))
        } else {
            js(&head)
        };
    }
    js(&below1e6(n as u64))
}
