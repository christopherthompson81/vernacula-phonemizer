//! Units-first Germanic number composition (the einundzwanzig shape: unit + connector + tens fused into one
//! word), shared by Danish, Faroese, Luxembourgish and Bavarian; each language supplies its words and joins.
//! Ported from src/languages/danish/unitsFirstNumbers.ts — see that file for the four languages' parameters.

use crate::core::from_json::FromJson;

use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::numbers::digit_index;

#[derive(Debug, Clone, FromJson)]
pub struct OneWord {
    pub one: String,
    pub word: String,
}

#[derive(Debug, Clone, FromJson)]
pub struct OnePlural {
    pub one: String,
    pub plural: String,
}

/// The unit→tens linker, as a function of the two words it sits between.
pub type Connector = fn(&str, &str) -> String;

/// `UnitsFirstDef`. `connector` is a function in the TS, so it is not part of a language's data literal and is
/// supplied beside it.
#[derive(Debug, Clone, FromJson)]
#[json(rename_all = "camelCase")]
pub struct UnitsFirstDef {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub compound_ones: Option<Vec<String>>,
    #[json(skip, default = "no_connector")]
    pub connector: Connector,
    pub hundred: OneWord,
    pub thousand: OneWord,
    pub million: OnePlural,
    pub billion: OnePlural,
    pub mul_join: String,
    pub hundred_rem_join: String,
    pub group_join: String,
}

fn no_connector() -> Connector {
    |_, _| String::new()
}

/// `compoundOne(d, u)`: `d.compoundOnes?.[u] ?? d.ones[u]`.
fn compound_one(d: &UnitsFirstDef, u: usize) -> &str {
    d.compound_ones
        .as_ref()
        .and_then(|c| c.get(u))
        .unwrap_or(&d.ones[u])
}

/// `below100(n, d)`, 1 ≤ n < 100.
fn below100(n: i64, d: &UnitsFirstDef) -> String {
    if n < 20 {
        return d.ones[n as usize].clone();
    }
    let (t, u) = ((n / 10) as usize, (n % 10) as usize);
    let tens_word = &d.tens[t];
    if u == 0 {
        return tens_word.clone();
    }
    let unit = compound_one(d, u);
    format!("{unit}{}{tens_word}", (d.connector)(unit, tens_word))
}

/// `below1000(n, d)`, 1 ≤ n < 1000.
fn below1000(n: i64, d: &UnitsFirstDef) -> String {
    if n < 100 {
        return below100(n, d);
    }
    let (h, r) = (n / 100, n % 100);
    let hundred = if h == 1 {
        d.hundred.one.clone()
    } else {
        format!("{}{}{}", d.ones[h as usize], d.mul_join, d.hundred.word)
    };
    if r != 0 {
        format!("{hundred}{}{}", d.hundred_rem_join, below100(r, d))
    } else {
        hundred
    }
}

/// `unitsFirstNumberToWords(n, d, raw)`: a safe integer in [0, 10¹²) as words, largest magnitude first;
/// otherwise each code point of `raw ?? String(Math.abs(n))` as its `ones` word (a non-digit kept as itself).
pub fn units_first_number_to_words(n: f64, d: &UnitsFirstDef, raw: Option<&JsString>) -> JsString {
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
                if i >= 0 { js(&d.ones[i as usize]) } else { c }
            })
            .collect();
        return JsString::join(&words, &js(" "));
    }
    let n = n as i64;
    if n == 0 {
        return js(&d.ones[0]);
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
            d.billion.one.clone()
        } else {
            format!("{} {}", below1000(bil, d), d.billion.plural)
        });
    }
    if mil != 0 {
        parts.push(if mil == 1 {
            d.million.one.clone()
        } else {
            format!("{} {}", below1000(mil, d), d.million.plural)
        });
    }
    if th != 0 {
        parts.push(if th == 1 {
            d.thousand.one.clone()
        } else {
            format!("{}{}{}", below1000(th, d), d.mul_join, d.thousand.word)
        });
    }
    if r != 0 {
        parts.push(below1000(r, d));
    }
    js(&parts.join(&d.group_join))
}
