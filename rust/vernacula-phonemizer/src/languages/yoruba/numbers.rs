//! Yoruba cardinal numbers: vigesimal, additive on 1-4 past a ten and subtractive on 5-9 toward the next, with
//! irregular hundreds, magnitude-first scales, and a digit-by-digit floor above 10^12.
//! Ported from src/languages/yoruba/numbers.ts — see that file for the corpus evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number, js_number_to_string};

fn unit(n: f64) -> String {
    MANIFEST.numbers.units[n as usize].clone()
}

fn tens(n: f64) -> &'static super::manifest::TenForms {
    &MANIFEST.numbers.tens[&js_number_to_string(n)]
}

fn below_two_hundred(n: f64) -> String {
    let nb = &MANIFEST.numbers;
    if n == 15.0 {
        return nb.fifteen.clone();
    }
    if n == 25.0 {
        return nb.twenty_five.clone();
    }
    if n < 11.0 {
        return unit(n);
    }
    let u = n % 10.0;
    if u == 0.0 {
        return tens(n).free.clone();
    }
    if n < 15.0 {
        return format!("{}{}", nb.front[u as usize], nb.teen);
    }
    let lower = n - u;
    if u <= 4.0 {
        return format!("{}{}{}", nb.front[u as usize], nb.add, tens(lower).fused);
    }
    format!(
        "{}{}{}",
        nb.front[(10.0 - u) as usize],
        nb.subtract,
        tens(lower + 10.0).fused
    )
}

fn below1000(n: f64) -> String {
    if n < 200.0 {
        return below_two_hundred(n);
    }
    let h = (n / 100.0).floor();
    let rest = n % 100.0;
    let hundred = &MANIFEST.numbers.hundreds[h as usize];
    if rest == 0.0 {
        hundred.clone()
    } else {
        format!("{hundred} {} {}", MANIFEST.numbers.join, below1000(rest))
    }
}

fn scaled(magnitude: &str, multiplier: f64) -> String {
    let nb = &MANIFEST.numbers;
    if multiplier == 1.0 {
        return format!("{magnitude} {}", nb.multiplier_one);
    }
    if multiplier <= 10.0 {
        return format!("{magnitude} {}", unit(multiplier));
    }
    format!("{magnitude} {} {}", nb.times, below1000(multiplier))
}

/// `digitByDigit(digits)`: each code point through `Number(ch)`; NaN is dropped, 0 is the zero word.
fn digit_by_digit(digits: &JsString) -> String {
    digits
        .code_point_strings()
        .iter()
        .filter_map(|ch| {
            let d = js_number(ch);
            if d.is_nan() {
                None
            } else if d == 0.0 {
                Some(MANIFEST.numbers.zero.clone())
            } else {
                Some(unit(d))
            }
        })
        .filter(|x| !x.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
}

/// `yorubaNumber(digits)`: a digit run → its cardinal, or the given digits one by one when not a safe integer.
pub fn yoruba_number(digits: &JsString) -> JsString {
    let n = js_number(digits);
    if is_safe_integer(n) {
        yoruba_cardinal(n)
    } else {
        js(&digit_by_digit(digits))
    }
}

/// `yorubaCardinal(n)`: a non-negative integer → its Yoruba cardinal reading.
pub fn yoruba_cardinal(n: f64) -> JsString {
    js(&cardinal(n))
}

fn cardinal(n: f64) -> String {
    if !n.is_finite() || n < 0.0 || n.fract() != 0.0 || !is_safe_integer(n) {
        let s = if n.is_finite() {
            js_number_to_string(n.trunc().abs())
        } else {
            String::new()
        };
        return digit_by_digit(&js(&s));
    }
    let nb = &MANIFEST.numbers;
    if n == 0.0 {
        return nb.zero.clone();
    }
    if n < 1000.0 {
        return below1000(n);
    }
    for (limit, word) in [(1e6, &nb.thousand), (1e9, &nb.million), (1e12, &nb.billion)] {
        let base = limit / 1000.0;
        if n < limit {
            let mult = (n / base).floor();
            let rest = n % base;
            let head = scaled(word, mult);
            return if rest == 0.0 {
                head
            } else {
                format!("{head} {} {}", nb.join, cardinal(rest))
            };
        }
    }
    digit_by_digit(&js(&js_number_to_string(n)))
}

/// `readYorubaNumbers(text)`: every `\p{Nd}` run → its Yoruba cardinal reading.
pub fn read_yoruba_numbers(text: &JsString) -> JsString {
    crate::js_re!(r"\p{Nd}+", "gu").replace_with(text, |m, s| yoruba_number(&m.value(s)))
}
