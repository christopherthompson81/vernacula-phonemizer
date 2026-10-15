//! Shona cardinal numbers as space-separated words (magnitude nouns with their concorded counts, joined with `ne`;
//! digit by digit outside the safe range or from 10^12), and the class-6 concord on a trailing unit numeral.
//! Ported from src/languages/shona/numbers.ts — see that file for the sources.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::numbers::digit_index;

fn magnitude(one: &str, many: &str, n: u64, count: &[String]) -> String {
    if n == 1 {
        return one.to_string();
    }
    let c = count
        .get(n as usize)
        .cloned()
        .unwrap_or_else(|| below1000(n));
    format!("{many} {c}")
}

fn below100(n: u64) -> String {
    let num = &MANIFEST.numbers;
    if n < 10 {
        return num.units[n as usize].clone();
    }
    if n == 10 {
        return num.ten.clone();
    }
    let (t, u) = (n / 10, n % 10);
    let tens = magnitude(&num.ten, &num.tens, t, &num.units_ma);
    if u != 0 {
        format!("{tens} {} {}", num.and, num.units[u as usize])
    } else {
        tens
    }
}

fn below1000(n: u64) -> String {
    let num = &MANIFEST.numbers;
    if n < 100 {
        return below100(n);
    }
    let (h, r) = (n / 100, n % 100);
    let hundred = magnitude(&num.hundred, &num.hundreds, h, &num.units_ma);
    if r != 0 {
        format!("{hundred} {} {}", num.and, below100(r))
    } else {
        hundred
    }
}

fn below1e6(n: u64) -> String {
    let num = &MANIFEST.numbers;
    if n < 1000 {
        return below1000(n);
    }
    let (th, r) = (n / 1000, n % 1000);
    let thousand = magnitude(&num.thousand, &num.thousands, th, &num.units_zvi);
    if r != 0 {
        format!("{thousand} {} {}", num.and, below1000(r))
    } else {
        thousand
    }
}

/// `numberToWords(n, raw?)`: a non-negative integer below 10^12 → Shona words; otherwise each code point by
/// `units[digitIndex(d)] ?? d` (whose index 0 is the zero word).
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    let num = &MANIFEST.numbers;
    if !is_safe_integer(n) || n < 0.0 || n >= 1e12 {
        let digits = match raw {
            Some(r) => r.clone(),
            None => js(&js_number_to_string(n.abs())),
        };
        let parts: Vec<JsString> = digits
            .code_point_strings()
            .into_iter()
            .map(|d| {
                let i = if d.len() == 1 {
                    digit_index(d.0[0])
                } else {
                    -1
                };
                usize::try_from(i)
                    .ok()
                    .and_then(|i| num.units.get(i))
                    .map_or(d, |w| js(w))
            })
            .collect();
        return JsString::join(&parts, &js(" "));
    }
    js(&compose(n as u64))
}

fn compose(n: u64) -> String {
    let num = &MANIFEST.numbers;
    if n == 0 {
        return num.units[0].clone();
    }
    if n < 1_000_000 {
        return below1e6(n);
    }
    let billions = n >= 1_000_000_000;
    let scale = if billions { 1_000_000_000 } else { 1_000_000 };
    let (one, many) = if billions {
        (&num.billion, &num.billions)
    } else {
        (&num.million, &num.millions)
    };
    let (head, r) = (n / scale, n % scale);
    let big = if head < 10 {
        magnitude(one, many, head, &num.units_ma)
    } else {
        format!("{many} {}", below1000(head))
    };
    if r != 0 {
        format!("{big} {} {}", num.and, compose(r))
    } else {
        big
    }
}

/// `withClass6Concord(words)`: the last word, if it is a unit stem 2–9 with a class-6 form, takes that form.
pub fn with_class6_concord(words: &JsString) -> JsString {
    let num = &MANIFEST.numbers;
    let mut parts = words.split(&js(" "));
    let last = parts.len() - 1;
    let k = num.units.iter().position(|u| parts[last] == u.as_str());
    if let Some(k) = k
        && k >= 2
        && num.units_ma.get(k).is_some_and(|m| !m.is_empty())
    {
        parts[last] = js(&num.units_ma[k]);
    }
    JsString::join(&parts, &js(" "))
}
