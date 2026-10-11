//! Serbo-Croatian cardinal → words (space-separated), shared by the three standards through
//! `compose_slavic_number` (each passes its own word table); covers 0 … <10⁹, else digit by digit.
//! Ported from src/languages/serbian/numbers.ts — see that file for the agreement evidence.

use super::manifest::{MANIFEST, SlavicMagnitude, SlavicNumbers};
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::core::numbers::digit_index;
use crate::js_re;

/// `composeSlavicNumber(n, N, raw)`.
pub fn compose_slavic_number(n: f64, t: &SlavicNumbers, raw: Option<&JsString>) -> JsString {
    if !is_safe_integer(n) || n < 0.0 || n >= 1e9 {
        let src = raw
            .cloned()
            .unwrap_or_else(|| js(&js_number_to_string(n.abs())));
        // `N.units[digitIndex(d)] ?? d` over code points: only a one-unit ASCII digit indexes the table.
        let words: Vec<JsString> = src
            .code_point_strings()
            .into_iter()
            .map(|d| {
                let i = if d.len() == 1 {
                    digit_index(d.0[0])
                } else {
                    -1
                };
                if i >= 0 { js(&t.units[i as usize]) } else { d }
            })
            .collect();
        return JsString::join(&words, &js(" "));
    }
    let n = n as u64;
    if n == 0 {
        return js(&t.units[0]);
    }
    if n < 1000 {
        return js(&below1000(n, t));
    }
    let mut parts: Vec<String> = Vec::new();
    let (mil, th, r) = (n / 1_000_000, (n % 1_000_000) / 1000, n % 1000);
    if mil != 0 {
        parts.push(format!("{} {}", below1000(mil, t), agree(mil, &t.million)));
    }
    if th != 0 {
        parts.push(if th == 1 {
            t.thousand.standalone.clone().expect("validated")
        } else {
            format!(
                "{} {}",
                feminise(&below1000(th, t), &t.thousand),
                agree(th, &t.thousand)
            )
        });
    }
    if r != 0 {
        parts.push(below1000(r, t));
    }
    js(&parts.join(" "))
}

/// `below100(n)`, 1 ≤ n < 100.
fn below100(n: u64, t: &SlavicNumbers) -> String {
    if n < 10 {
        return t.units[n as usize].clone();
    }
    if n < 20 {
        return t.teens[(n - 10) as usize].clone();
    }
    let (tn, u) = ((n / 10) as usize, (n % 10) as usize);
    if u == 0 {
        t.tens[tn].clone()
    } else {
        format!("{} {}", t.tens[tn], t.units[u])
    }
}

/// `below1000(n)`, 1 ≤ n < 1000.
fn below1000(n: u64, t: &SlavicNumbers) -> String {
    if n < 100 {
        return below100(n, t);
    }
    let (h, r) = ((n / 100) as usize, n % 100);
    if r != 0 {
        format!("{} {}", t.hundreds[h], below100(r, t))
    } else {
        t.hundreds[h].clone()
    }
}

/// `agree(count, m)`: 1 (not 11) → one; 2–4 (not 12–14) → few when declared (and non-empty); else many.
fn agree(count: u64, m: &SlavicMagnitude) -> String {
    let (d, dd) = (count % 10, count % 100);
    if d == 1 && dd != 11 {
        return m.one.clone();
    }
    if let Some(few) = m.few.as_ref().filter(|f| !f.is_empty())
        && (2..=4).contains(&d)
        && !(12..=14).contains(&dd)
    {
        return few.clone();
    }
    m.many.clone()
}

/// `feminise(words, m)`: the final `jedan`/`dva` → the feminine forms, when both are declared (non-empty).
fn feminise(words: &str, m: &SlavicMagnitude) -> String {
    match (&m.one_feminine, &m.two_feminine) {
        (Some(one), Some(two)) if !one.is_empty() && !two.is_empty() => {
            let w = js_re!("jedan$", "u").replace(&js(words), &js(one));
            js_re!("dva$", "u").replace(&w, &js(two)).to_string_lossy()
        }
        _ => words.to_string(),
    }
}

/// `numberToWords(n, raw)`: Serbian's own table.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    compose_slavic_number(n, &MANIFEST.numbers, raw)
}
