//! Modern Greek cardinal number → space-separated words (0 … <10¹²; beyond, or non-integer, digit by digit),
//! with the feminine agreement of χιλιάδες' multiplier.
//! Ported from src/languages/greek/numbers.ts — see that file for the corpus evidence.

use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::numbers::digit_index;
use crate::js_re;

use super::manifest::{GreekNumbers, try_manifest};

// Generated from the TS object literal by .probe/el/gen_tables.mts (key order preserved).
const FEMININE: [(&str, &str); 3] = [("ένα", "μία"), ("τρία", "τρεις"), ("τέσσερα", "τέσσερις")];

fn below100(nn: &GreekNumbers, n: usize) -> String {
    if n < 10 {
        return nn.units[n].clone();
    }
    if n == 10 {
        return nn.ten.clone();
    }
    let tens = &nn.tens[n / 10];
    let u = n % 10;
    if u != 0 {
        format!("{tens} {}", nn.units[u])
    } else {
        tens.clone()
    }
}

fn below1000(nn: &GreekNumbers, n: usize) -> String {
    if n < 100 {
        return below100(nn, n);
    }
    let hundred = &nn.hundreds[n / 100];
    let r = n % 100;
    if r != 0 {
        format!("{hundred} {}", below100(nn, r))
    } else {
        hundred.clone()
    }
}

fn feminine(s: &str) -> String {
    s.split(' ')
        .map(|w| match FEMININE.iter().find(|(k, _)| *k == w) {
            Some((_, f)) => f.to_string(),
            None => js_re!("όσια$", "u")
                .replace(&js(w), &js("όσιες"))
                .to_string_lossy(),
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn below1e6(nn: &GreekNumbers, n: usize) -> String {
    if n < 1000 {
        return below1000(nn, n);
    }
    let th = n / 1000;
    let r = n % 1000;
    let thousand = if th == 1 {
        nn.thousand.clone()
    } else {
        format!("{} χιλιάδες", feminine(&below1000(nn, th)))
    };
    if r != 0 {
        format!("{thousand} {}", below1000(nn, r))
    } else {
        thousand
    }
}

/// `numberToWords(n, raw?)`. Errs only if the manifest cannot be loaded.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> Result<JsString, String> {
    Ok(number_to_words_with(&try_manifest()?.numbers, n, raw))
}

pub(crate) fn number_to_words_with(nn: &GreekNumbers, n: f64, raw: Option<&JsString>) -> JsString {
    if !is_safe_integer(n) || n < 0.0 || n >= 1e12 {
        let digits = match raw {
            Some(r) => r.clone(),
            None => js(&js_number_to_string(n.abs())),
        };
        let words: Vec<JsString> = digits
            .code_point_strings()
            .into_iter()
            .map(|d| {
                let i = digit_index(d.char_code_at(0).unwrap_or(0));
                if d.len() == 1 && i >= 0 {
                    js(&nn.units[i as usize])
                } else {
                    d
                }
            })
            .collect();
        return JsString::join(&words, &js(" "));
    }
    js(&words(nn, n))
}

fn words(nn: &GreekNumbers, n: f64) -> String {
    if n == 0.0 {
        return nn.units[0].clone();
    }
    for (value, one, many) in [
        (1e9, "ένα δισεκατομμύριο", "δισεκατομμύρια"),
        (1e6, "ένα εκατομμύριο", "εκατομμύρια"),
    ] {
        if n >= value {
            let q = (n / value).floor();
            let r = n % value;
            let head = if q == 1.0 {
                one.to_string()
            } else {
                format!("{} {many}", below1e6(nn, q as usize))
            };
            return if r != 0.0 {
                format!("{head} {}", words(nn, r))
            } else {
                head
            };
        }
    }
    below1e6(nn, n as usize)
}
