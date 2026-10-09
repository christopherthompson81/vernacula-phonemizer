//! French cardinals (standard/France, vigesimal 70/80/90), 0 … <10⁹, the sub-100 group hyphenated as one
//! word. Ported from src/languages/french/numbers.ts — see that file for why the hyphens are load-bearing.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};
use crate::core::numbers::digit_index;

/// `Number.isSafeInteger(n)`.
pub fn is_safe_integer(n: f64) -> bool {
    n.is_finite() && n.fract() == 0.0 && n.abs() <= 9_007_199_254_740_991.0
}

fn small(i: u64) -> &'static str {
    &MANIFEST.numbers.small[i as usize]
}

fn below100(n: u64) -> String {
    let mag = &MANIFEST.numbers.magnitudes;
    let tens = &MANIFEST.numbers.tens;
    if n < 20 {
        return small(n).to_string();
    }
    if n < 60 {
        let (t, u) = (n / 10, n % 10);
        if u == 0 {
            return tens[t as usize].clone();
        }
        if u == 1 {
            return format!("{}-et-un", tens[t as usize]);
        }
        return format!("{}-{}", tens[t as usize], small(u));
    }
    if n < 80 {
        let r = n - 60;
        if r == 0 {
            return mag.sixty.clone();
        }
        if r == 1 {
            return format!("{}-et-un", mag.sixty);
        }
        if r == 11 {
            return format!("{}-et-onze", mag.sixty);
        }
        return format!("{}-{}", mag.sixty, small(r));
    }
    let r = n - 80;
    if r == 0 {
        format!("{}s", mag.eighty)
    } else {
        format!("{}-{}", mag.eighty, small(r))
    }
}

fn below1000(n: u64) -> String {
    let mag = &MANIFEST.numbers.magnitudes;
    if n < 100 {
        return below100(n);
    }
    let (h, r) = (n / 100, n % 100);
    let hundred = if h == 1 {
        mag.hundred.clone()
    } else {
        format!("{} {}{}", small(h), mag.hundred, if r == 0 { "s" } else { "" })
    };
    if r != 0 {
        format!("{hundred} {}", below100(r))
    } else {
        hundred
    }
}

/// `numberToWords(n, raw?)`: a non-negative integer below 10⁹ → words; anything else digit by digit (from
/// `raw` when given, else `String(Math.abs(n))`).
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    if !is_safe_integer(n) || n < 0.0 || n >= 1e9 {
        let digits = match raw {
            Some(r) => r.clone(),
            None => js(&js_integer_string(n.abs())),
        };
        let words: Vec<JsString> = digits
            .code_point_strings()
            .into_iter()
            .map(|ch| {
                let d = if ch.len() == 1 { digit_index(ch.0[0]) } else { -1 };
                if d >= 0 { js(small(d as u64)) } else { ch }
            })
            .collect();
        return JsString::join(&words, &js(" "));
    }
    js(&words_safe(n as u64))
}

fn words_safe(n: u64) -> String {
    let mag = &MANIFEST.numbers.magnitudes;
    if n == 0 {
        return small(0).to_string();
    }
    if n < 1000 {
        return below1000(n);
    }
    if n < 1_000_000 {
        let (th, r) = (n / 1000, n % 1000);
        let thousand = if th == 1 {
            mag.thousand.clone()
        } else {
            format!("{} {}", below1000(th), mag.thousand)
        };
        return if r != 0 {
            format!("{thousand} {}", below1000(r))
        } else {
            thousand
        };
    }
    let (m, r) = (n / 1_000_000, n % 1_000_000);
    let million = if m == 1 {
        format!("un {}", mag.million)
    } else {
        format!("{} {}", below1000(m), mag.millions)
    };
    if r != 0 {
        format!("{million} {}", words_safe(r))
    } else {
        million
    }
}

/// `String(x)` (Number::toString) for a non-negative `x`: the shortest round-trip digits, laid out by the
/// ECMAScript rules (plain up to 21 digits, exponent form beyond). Only safe integers ≥ 10⁹ reach it from
/// the engine (an ordinal); the rest is exercised by the differential.
fn js_integer_string(x: f64) -> String {
    if x == 0.0 {
        return "0".into();
    }
    if !x.is_finite() {
        return if x.is_nan() { "NaN".into() } else { "Infinity".into() };
    }
    let sci = format!("{x:e}");
    let (mant, exp) = sci.split_once('e').unwrap();
    let digits: String = mant.chars().filter(|c| c.is_ascii_digit()).collect();
    let k = digits.len() as i32;
    let n = exp.parse::<i32>().unwrap() + 1;
    if k <= n && n <= 21 {
        format!("{digits}{}", "0".repeat((n - k) as usize))
    } else if 0 < n && n <= 21 {
        format!("{}.{}", &digits[..n as usize], &digits[n as usize..])
    } else if -6 < n && n <= 0 {
        format!("0.{}{digits}", "0".repeat((-n) as usize))
    } else {
        let e = n - 1;
        let sign = if e < 0 { "-" } else { "+" };
        let rest = if k > 1 { format!(".{}", &digits[1..]) } else { String::new() };
        format!("{}{rest}e{sign}{}", &digits[..1], e.abs())
    }
}

