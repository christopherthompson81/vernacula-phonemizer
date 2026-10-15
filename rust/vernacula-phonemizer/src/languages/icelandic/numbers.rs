//! Icelandic cardinal compositor: tens-first with the "og" conjunction and gender concord on 1–4 (each
//! magnitude noun imposes its own gender on its multiplier), below 10¹²; digit by digit otherwise.
//! Ported from src/languages/icelandic/numbers.ts — see that file for the citation-form judgement.

use std::sync::{LazyLock, OnceLock};

use serde::Deserialize;

use super::manifest::DIR;
use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::load_manifest::load_manifest;
use crate::core::numbers::digit_index;

#[derive(Debug, Deserialize)]
pub struct OnePlural {
    pub one: String,
    pub plural: String,
}

#[derive(Debug, Deserialize)]
pub struct OneWord {
    pub one: String,
    pub word: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NumbersBlock {
    pub ones: Vec<String>,
    pub ones_feminine: Vec<String>,
    pub ones_neuter: Vec<String>,
    pub tens: Vec<String>,
    pub connector: String,
    pub hundred: OnePlural,
    pub thousand: OneWord,
    pub million: OnePlural,
    pub billion: OnePlural,
}

/// `IcelandicNumbersDef`: this module's own slice of the jsonc, as the TS declares it.
#[derive(Debug, Deserialize)]
pub struct IcelandicNumbersDef {
    pub numbers: NumbersBlock,
}

/// The numbers block, or why it could not be loaded.
pub fn try_numbers() -> Result<&'static NumbersBlock, String> {
    static M: OnceLock<IcelandicNumbersDef> = OnceLock::new();
    load_once(&M, || {
        let d: IcelandicNumbersDef =
            load_manifest(DIR, "icelandic.jsonc").map_err(|e| e.to_string())?;
        if d.numbers.ones.len() < 20 || d.numbers.tens.len() < 10 {
            return Err("icelandic.jsonc numbers: ones needs 20 entries, tens 10".to_string());
        }
        Ok(d)
    })
    .map(|d| &d.numbers)
}

/// ⚠ Reached only through a checked path (an `IcelandicPhonemizer`, whose constructor loads it).
static N: LazyLock<&'static NumbersBlock> =
    LazyLock::new(|| try_numbers().unwrap_or_else(|e| panic!("{e}")));

#[derive(Clone, Copy, PartialEq, Eq)]
enum Gender {
    M,
    F,
    N,
}

const BARE: Gender = Gender::M;

/// `one(k, g)`: the gendered form of 1–4, falling back to the masculine `ones`.
fn one(k: usize, g: Gender) -> &'static str {
    let n = &**N;
    let gendered = match g {
        Gender::F => n.ones_feminine.get(k),
        Gender::N => n.ones_neuter.get(k),
        Gender::M => None,
    };
    gendered.unwrap_or(&n.ones[k])
}

/// `singleWord(n)`: below 20 or a round ten.
fn single_word(n: i64) -> bool {
    n < 20 || n % 10 == 0
}

/// `below100(n, g)`, 1 ≤ n < 100.
fn below100(n: i64, g: Gender) -> String {
    if n < 20 {
        return one(n as usize, g).to_string();
    }
    let (t, u) = ((n / 10) as usize, (n % 10) as usize);
    if u == 0 {
        N.tens[t].clone()
    } else {
        format!("{} {} {}", N.tens[t], N.connector, one(u, g))
    }
}

/// `below1000(n, g)`, 1 ≤ n < 1000; the hundreds multiplier is neuter.
fn below1000(n: i64, g: Gender) -> String {
    if n < 100 {
        return below100(n, g);
    }
    let (h, r) = (n / 100, n % 100);
    let hundred = if h == 1 {
        N.hundred.one.clone()
    } else {
        format!("{} {}", one(h as usize, Gender::N), N.hundred.plural)
    };
    if r == 0 {
        return hundred;
    }
    let og = if single_word(r) {
        format!("{} ", N.connector)
    } else {
        String::new()
    };
    format!("{hundred} {og}{}", below100(r, g))
}

/// `numberToWords(n, raw)`: a safe integer in [0, 10¹²) as words; otherwise each code point of
/// `raw ?? String(Math.abs(n))` as its `ones` word (a non-digit kept as itself).
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    if !is_safe_integer(n) || n < 0.0 || n >= 1e12 {
        let src = raw
            .cloned()
            .unwrap_or_else(|| js(&js_number_to_string(n.abs())));
        let words: Vec<JsString> = src
            .code_point_strings()
            .into_iter()
            .map(|c| {
                // `digitIndex(c)` compares the code-point STRING with "0"…"9": only a one-unit ASCII digit passes.
                let i = if c.len() == 1 {
                    digit_index(c.0[0])
                } else {
                    -1
                };
                if i >= 0 { js(&N.ones[i as usize]) } else { c }
            })
            .collect();
        return JsString::join(&words, &js(" "));
    }
    let n = n as i64;
    if n == 0 {
        return js(&N.ones[0]);
    }
    let mut parts: Vec<String> = Vec::new();
    let (bil, mil, th, r) = (
        n / 1_000_000_000,
        (n % 1_000_000_000) / 1_000_000,
        (n % 1_000_000) / 1000,
        n % 1000,
    );
    if bil != 0 {
        parts.push(if bil == 1 {
            N.billion.one.clone()
        } else {
            format!("{} {}", below1000(bil, Gender::M), N.billion.plural)
        });
    }
    if mil != 0 {
        parts.push(if mil == 1 {
            N.million.one.clone()
        } else {
            format!("{} {}", below1000(mil, Gender::F), N.million.plural)
        });
    }
    if th != 0 {
        parts.push(if th == 1 {
            N.thousand.one.clone()
        } else {
            format!("{} {}", below1000(th, Gender::N), N.thousand.word)
        });
    }
    if r != 0 {
        let tail = below1000(r, BARE);
        parts.push(if !parts.is_empty() && single_word(r) {
            format!("{} {tail}", N.connector)
        } else {
            tail
        });
    }
    js(&parts.join(" "))
}
