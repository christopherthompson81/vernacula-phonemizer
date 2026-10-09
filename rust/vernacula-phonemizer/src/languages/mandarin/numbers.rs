//! Arabic number → Chinese numeral characters: the quantity reading (myriad groups, internal 零, colloquial
//! 两) and the digit-by-digit reading. Ported from src/languages/mandarin/numbers.ts — see that file for the
//! corpus evidence.

use std::sync::OnceLock;

use super::manifest::MANIFEST;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::numbers::digit_index;

/// 0 ≤ n ≤ 9999 → characters. ⚠ `f64` arithmetic, as the TS (`Math.floor(n / 1000) % 10`).
fn group4(n: f64, top: bool) -> JsString {
    let num = &MANIFEST.numbers;
    let mut s = String::new();
    let mut zero_pending = false;
    let digits = [
        (n / 1000.0).floor() % 10.0,
        (n / 100.0).floor() % 10.0,
        (n / 10.0).floor() % 10.0,
        n % 10.0,
    ];
    for (i, &d) in digits.iter().enumerate() {
        if d == 0.0 {
            if !s.is_empty() {
                zero_pending = true;
            }
            continue;
        }
        if zero_pending {
            s += &num.digits[0];
            zero_pending = false;
        }
        let mut dig = &num.digits[d as usize];
        if d == 2.0 && i == 0 {
            dig = &num.two;
        } else if d == 2.0 && i == 1 && s.is_empty() && top {
            dig = &num.two;
        }
        s += dig;
        s += &num.positions[i];
    }
    js(&s)
}

/// `integerToChinese(n)`: a non-negative safe integer → Chinese numeral characters (quantity reading).
pub fn integer_to_chinese(n: f64) -> JsString {
    let num = &MANIFEST.numbers;
    if n == 0.0 {
        return js(&num.digits[0]);
    }
    let mut groups: Vec<f64> = Vec::new();
    let mut x = n;
    while x > 0.0 {
        groups.push(x % 10000.0);
        x = (x / 10000.0).floor();
    }
    let mut s = JsString::new();
    for i in (0..groups.len()).rev() {
        let g = groups[i];
        if g == 0.0 {
            continue;
        }
        if !s.is_empty() && g < 1000.0 {
            s.push_str(&js(&num.digits[0]));
        }
        // `BIG[i]` is truthy only for a non-empty multiplier: BIG[0] is "".
        let big = num.big_units.get(i).map(String::as_str).unwrap_or("");
        let gs = if g == 2.0 && !big.is_empty() {
            js(&num.two)
        } else {
            group4(g, s.is_empty())
        };
        s.push_str(&gs);
        s.push_str(&js(big));
    }
    static LEADING_TEN: OnceLock<JsRegex> = OnceLock::new();
    let re = LEADING_TEN.get_or_init(|| {
        JsRegex::new(&format!("^{}{}", num.digits[1], num.positions[2]), "")
            .expect("leading-ten pattern compiles")
    });
    re.replace(&s, &js(&num.positions[2]))
}

/// `digitsToChinese(digits)`: each code point by its numeral (0 → 〇); a non-digit passes through.
pub fn digits_to_chinese(digits: &JsString) -> JsString {
    let num = &MANIFEST.numbers;
    let mut out = JsString::new();
    for d in digits.code_point_strings() {
        if d.0 == [b'0' as u16] {
            out.push_str(&js(&num.zero_digit));
            continue;
        }
        // `digitIndex(d)` compares a STRING: only a one-unit string can be a digit.
        let idx = if d.len() == 1 { digit_index(d.0[0]) } else { -1 };
        match usize::try_from(idx).ok().and_then(|i| num.digits.get(i)) {
            Some(w) => out.push_str(&js(w)),
            None => out.push_str(&d),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn quantity_readings() {
        assert_eq!(integer_to_chinese(0.0), "零");
        assert_eq!(integer_to_chinese(12.0), "十二");
        assert_eq!(integer_to_chinese(250.0), "两百五十");
        assert_eq!(integer_to_chinese(2200.0), "两千二百");
        assert_eq!(integer_to_chinese(20000.0), "两万");
        assert_eq!(integer_to_chinese(783562.0), "七十八万三千五百六十二");
        assert_eq!(digits_to_chinese(&js("2009")), "二〇〇九");
    }
}
