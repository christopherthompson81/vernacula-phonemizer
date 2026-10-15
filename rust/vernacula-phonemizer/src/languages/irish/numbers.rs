//! Irish cardinal numbers: the counting series with the particle `a`, the attributive series before a magnitude,
//! lenition after 2–6 and eclipsis after 7–10, `déag` lenited after `dó` only.
//! Ported from src/languages/irish/numbers.ts — see that file for the sources and the known limitations.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};
use crate::js_re;

/// `lenite(w)`: `h` after an initial ⟨b c d f g m p t⟩ (one code unit).
fn lenite(w: &JsString) -> JsString {
    if js_re!("^[bcdfgmpt]", "i").test(w) {
        w.char_at(0).concat(&js("h")).concat(&w.slice(1, None))
    } else {
        w.clone()
    }
}

/// `eclipse(w)`: the voiced/nasal counterpart prefixed (`m` has none).
fn eclipse(w: &JsString) -> JsString {
    let first = w.char_at(0).to_lower_case();
    match [
        ("c", "g"),
        ("p", "b"),
        ("t", "d"),
        ("b", "m"),
        ("d", "n"),
        ("g", "n"),
        ("f", "bhf"),
    ]
    .iter()
    .find(|(k, _)| first == *k)
    {
        None => w.clone(),
        Some((_, e)) => js(e).concat(w),
    }
}

fn after_numeral(k: u64, word: &JsString) -> JsString {
    if (2..=6).contains(&k) {
        lenite(word)
    } else if (7..=10).contains(&k) {
        eclipse(word)
    } else {
        word.clone()
    }
}

fn counting(u: u64) -> JsString {
    let w = js(&MANIFEST.numbers.ones[u as usize]);
    let w = if js_re!("^[aeiouáéíóú]", "i").test(&w) {
        js("h").concat(&w)
    } else {
        w
    };
    js("a ").concat(&w)
}

fn under_hundred(n: u64) -> JsString {
    let nm = &MANIFEST.numbers;
    if n <= 10 {
        return counting(n);
    }
    if n < 20 {
        let u = n - 10;
        let teen = js(&nm.teen_word);
        let teen = if u == 2 { lenite(&teen) } else { teen };
        return counting(u).concat(&js(" ")).concat(&teen);
    }
    let (t, u) = (n / 10 * 10, n % 10);
    let tens = js(&nm.tens[&t.to_string()]);
    if u != 0 {
        tens.concat(&js(" ")).concat(&counting(u))
    } else {
        tens
    }
}

fn magnitude(count: u64, word: &str) -> JsString {
    let word = js(word);
    if count == 1 {
        return word;
    }
    if count <= 10 {
        return js(&MANIFEST.numbers.attributive[count as usize])
            .concat(&js(" "))
            .concat(&after_numeral(count, &word));
    }
    compose(count).concat(&js(" ")).concat(&word)
}

fn with_rest(head: JsString, r: u64) -> JsString {
    if r != 0 {
        head.concat(&js(" ")).concat(&compose(r))
    } else {
        head
    }
}

fn compose(n: u64) -> JsString {
    let m = &MANIFEST.numbers.magnitudes;
    if n < 100 {
        return under_hundred(n);
    }
    if n < 1000 {
        return with_rest(magnitude(n / 100, &m.hundred), n % 100);
    }
    if n < 1_000_000 {
        return with_rest(magnitude(n / 1000, &m.thousand), n % 1000);
    }
    if n < 1_000_000_000 {
        return with_rest(magnitude(n / 1_000_000, &m.million), n % 1_000_000);
    }
    with_rest(magnitude(n / 1_000_000_000, &m.billion), n % 1_000_000_000)
}

/// `numberToWords(n, raw?)`. Out of range: the ASCII digits of each CODE POINT of `raw` (else `String(n)`, sign
/// and all) by their counting words, everything else dropped.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    let ones = &MANIFEST.numbers.ones;
    if !is_safe_integer(n) || n < 0.0 {
        let digits = raw.cloned().unwrap_or_else(|| js(&js_number_to_string(n)));
        let words: Vec<JsString> = digits
            .code_point_strings()
            .into_iter()
            .filter(|c| c.len() == 1 && (u16::from(b'0')..=u16::from(b'9')).contains(&c.0[0]))
            .map(|d| js(&ones[(d.0[0] - u16::from(b'0')) as usize]))
            .collect();
        return JsString::join(&words, &js(" "));
    }
    if n == 0.0 {
        return js(&ones[0]);
    }
    js_re!(r"\s+", "g")
        .replace(&compose(n as u64), &js(" "))
        .trim()
}
