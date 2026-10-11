//! Russian number → words (nominative cardinals below 10⁹; digit by digit otherwise), with the Slavic plural
//! of тысяча / миллион and тысяча's feminine agreement.
//! Ported from src/languages/russian/numbers.ts.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::numbers::digit_index;
use crate::js_re;

/// `plural(n, one, few, many)`: 1 → one, 2–4 → few, else many (11–14 → many).
fn plural<'a>(n: f64, one: &'a str, few: &'a str, many: &'a str) -> &'a str {
    let (mod10, mod100) = (n % 10.0, n % 100.0);
    if mod10 == 1.0 && mod100 != 11.0 {
        return one;
    }
    if (2.0..=4.0).contains(&mod10) && !(10.0..20.0).contains(&mod100) {
        return few;
    }
    many
}

/// `below1000(n)`, 1 ≤ n < 1000.
fn below1000(n: f64) -> String {
    let m = &MANIFEST.numbers;
    let mut parts: Vec<&str> = Vec::new();
    let (h, t, u) = (
        (n / 100.0).floor() as usize,
        ((n % 100.0) / 10.0).floor() as usize,
        (n % 10.0) as usize,
    );
    if h != 0 {
        parts.push(&m.hundreds[h]);
    }
    if t >= 2 {
        parts.push(&m.tens[t]);
        if u != 0 {
            parts.push(&m.ones[u]);
        }
    } else if t == 1 {
        parts.push(&m.ones[10 + u]);
    } else if u != 0 {
        parts.push(&m.ones[u]);
    }
    parts.join(" ")
}

/// `numberToWords(n, raw)`: a non-negative safe integer below 10⁹ as words; anything else digit by digit over
/// `raw ?? String(Math.abs(n))`, a non-digit kept as itself.
pub(crate) fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    let m = &MANIFEST.numbers;
    if !is_safe_integer(n) || n < 0.0 || n >= 1e9 {
        let raw = raw
            .cloned()
            .unwrap_or_else(|| js(&js_number_to_string(n.abs())));
        let words: Vec<JsString> = raw
            .code_point_strings()
            .into_iter()
            .map(|d| {
                // `ONES[digitIndex(d)] ?? d`: a code point of more than one unit is never a digit.
                let i = if d.len() == 1 {
                    digit_index(d.0[0])
                } else {
                    -1
                };
                if i >= 0 { js(&m.ones[i as usize]) } else { d }
            })
            .collect();
        return JsString::join(&words, &js(" "));
    }
    if n < 20.0 {
        return js(&m.ones[n as usize]);
    }
    if n < 1000.0 {
        return js(&below1000(n));
    }
    let mut parts: Vec<JsString> = Vec::new();
    let (mil, th, r) = ((n / 1e6).floor(), ((n % 1e6) / 1000.0).floor(), n % 1000.0);
    if mil != 0.0 {
        parts.push(js(&below1000(mil)));
        parts.push(js(plural(mil, &m.million[0], &m.million[1], &m.million[2])));
    }
    if th == 1.0 {
        // ⚠ A lone thousand is bare `тысяча`, the news reading of a year; `одна тысяча` is the formal register.
        //   Only the group that IS one drops it (21000 keeps двадцать одна тысяча).
        parts.push(js(&m.thousand[0]));
    } else if th != 0.0 {
        let th_words = js_re!("один$").replace(&js(&below1000(th)), &js(&m.thousand_feminine.one));
        let th_words = js_re!("два$").replace(&th_words, &js(&m.thousand_feminine.two));
        parts.push(th_words);
        parts.push(js(plural(
            th,
            &m.thousand[0],
            &m.thousand[1],
            &m.thousand[2],
        )));
    }
    if r != 0.0 {
        parts.push(js(&below1000(r)));
    }
    JsString::join(&parts, &js(" "))
}

/// `CardinalCase`: which oblique-case slots of the manifest a cardinal is read from.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CardinalCase {
    Genitive,
    Instrumental,
}

/// `cardinalInCase(n, kase)`: 1 ≤ n < 1000 as a cardinal in an oblique case, every element declined
/// (тридцать пять → тридцати пяти). `None` outside the range.
pub(crate) fn cardinal_in_case(n: f64, kase: CardinalCase) -> Option<JsString> {
    if !is_safe_integer(n) || !(1.0..1000.0).contains(&n) {
        return None;
    }
    let t = match kase {
        CardinalCase::Genitive => &MANIFEST.numbers.genitive,
        CardinalCase::Instrumental => &MANIFEST.numbers.instrumental,
    };
    let mut parts: Vec<&str> = Vec::new();
    let (h, r) = ((n / 100.0).floor() as usize, (n % 100.0) as usize);
    if h != 0 {
        parts.push(&t.hundreds[h]);
    }
    if r >= 20 {
        parts.push(&t.tens[r / 10]);
        if r % 10 != 0 {
            parts.push(&t.ones[r % 10]);
        }
    } else if r != 0 {
        parts.push(&t.ones[r]);
    }
    Some(js(&parts.join(" ")))
}
