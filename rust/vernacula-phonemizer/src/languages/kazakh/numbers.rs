//! Kazakh cardinal compositor over the manifest's pre-phonemized IPA atoms: tens+units and the hundred multiplier
//! glued, magnitude groups spaced. Ported from src/languages/kazakh/numbers.ts — see that file for the evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};

/// `sub100(n)`: 0–99.
fn sub100(n: f64) -> String {
    let nm = &MANIFEST.numbers;
    if n < 10.0 {
        return nm.units[n as usize].clone();
    }
    let (t, u) = ((n / 10.0).floor() as usize, (n % 10.0) as usize);
    let unit = if u != 0 { nm.units[u].as_str() } else { "" };
    format!("{}{unit}", nm.tens[t])
}

/// `sub1000(n)`: 0–999; the hundred multiplier glued, the remainder spaced.
fn sub1000(n: f64) -> String {
    let nm = &MANIFEST.numbers;
    let (h, r) = ((n / 100.0).floor(), n % 100.0);
    if h == 0.0 {
        return sub100(r);
    }
    let hp = if h == 1.0 {
        nm.hundred.clone()
    } else {
        format!("{}{}", nm.units[h as usize], nm.hundred)
    };
    if r != 0.0 {
        format!("{hp} {}", sub100(r))
    } else {
        hp
    }
}

fn number_to_ipa_str(n: f64) -> String {
    let nm = &MANIFEST.numbers;
    if n < 0.0 || !n.is_finite() {
        return String::new();
    }
    let mut n = n.floor();
    if n < 1000.0 {
        return sub1000(n);
    }
    let mut groups: Vec<String> = Vec::new();
    let mil = (n / 1_000_000.0).floor();
    n %= 1_000_000.0;
    if mil != 0.0 {
        groups.push(if mil == 1.0 {
            nm.million.clone()
        } else {
            format!("{} {}", number_to_ipa_str(mil), nm.million)
        });
    }
    let th = (n / 1000.0).floor();
    n %= 1000.0;
    if th != 0.0 {
        let head = if th == 1.0 {
            nm.units[1].clone()
        } else {
            sub1000(th)
        };
        groups.push(format!("{head} {}", nm.thousand));
    }
    if n != 0.0 {
        groups.push(sub1000(n));
    }
    groups.join(" ")
}

/// `numberToIpa(n)`: a non-negative number → space-separated IPA; "" for a negative or non-finite one.
pub(crate) fn number_to_ipa(n: f64) -> JsString {
    js(&number_to_ipa_str(n))
}
