//! Ewe cardinal numbers: decimal, with the wui- teens and bla- tens prefixed to the unit stem, `vɔ` linking tens to
//! units, alafa / akpe / miliɔn taking a following multiplier, `kple` between slots; digit by digit from 10^9.
//! Ported from src/languages/ewe/numbers.ts — see that file for the sources.

use crate::core::js_string::{JsString, is_safe_integer, js, js_number, js_number_to_string};

const ONES: [&str; 10] = [
    "naneke o", "ɖeka", "eve", "etɔ̃", "ene", "atɔ̃", "ade", "adre", "enyi", "asieke",
];
const TEN: &str = "ewo";
const STEM: [&str; 10] = [
    "", "ɖeke", "eve", "etɔ̃", "ene", "atɔ̃", "ade", "adre", "enyi", "asieke",
];
const PLUS: &str = "vɔ";
const AND: &str = "kple";
const HUNDRED: &str = "alafa";
const THOUSAND: &str = "akpe";
const MILLION: &str = "miliɔn";

fn below100(n: f64) -> String {
    if n < 10.0 {
        return ONES[n as usize].to_string();
    }
    if n == 10.0 {
        return TEN.to_string();
    }
    if n < 20.0 {
        return format!("wui{}", STEM[(n - 10.0) as usize]);
    }
    let t = (n / 10.0).floor();
    let u = n % 10.0;
    let tens = format!("bla{}", STEM[t as usize]);
    if u == 0.0 {
        tens
    } else {
        format!("{tens} {PLUS} {}", ONES[u as usize])
    }
}

fn below1000(n: f64) -> String {
    if n < 100.0 {
        return below100(n);
    }
    let h = (n / 100.0).floor();
    let r = n % 100.0;
    let head = format!("{HUNDRED} {}", ONES[h as usize]);
    if r == 0.0 {
        head
    } else {
        format!("{head} {AND} {}", below100(r))
    }
}

fn words(n: f64, raw: Option<&JsString>) -> String {
    if !is_safe_integer(n) || n < 0.0 || n >= 1e9 {
        let digits = match raw {
            Some(r) => r.clone(),
            None => js(&js_number_to_string(n.abs())),
        };
        // `c >= "0" && c <= "9"` on a code point: an ASCII digit.
        return digits
            .code_point_strings()
            .iter()
            .filter(|c| c.len() == 1 && (u16::from(b'0')..=u16::from(b'9')).contains(&c.0[0]))
            .map(|d| ONES[js_number(d) as usize])
            .collect::<Vec<_>>()
            .join(" ");
    }
    if n < 1000.0 {
        return below1000(n);
    }
    if n < 1e6 {
        let th = (n / 1000.0).floor();
        let r = n % 1000.0;
        let head = format!("{THOUSAND} {}", below1000(th));
        return if r == 0.0 {
            head
        } else {
            format!("{head} {AND} {}", below1000(r))
        };
    }
    let m = (n / 1e6).floor();
    let r = n % 1e6;
    let head = format!("{MILLION} {}", below1000(m));
    if r == 0.0 {
        head
    } else {
        format!("{head} {AND} {}", words(r, None))
    }
}

/// `numberToWords(n, raw)`: a non-negative integer → Ewe words; from 10^9 (or not a safe integer) digit by digit.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    js(&words(n, raw))
}
