//! Tatar number words (spellings): fused teens, a bare 100 / 1000 without "бер", million and milliard keeping it.
//! Ported from src/languages/tatar/numbers.ts — see that file for the sources.

const UNITS: [&str; 10] = [
    "нуль",
    "бер",
    "ике",
    "өч",
    "дүрт",
    "биш",
    "алты",
    "җиде",
    "сигез",
    "тугыз",
];
const TEENS: [&str; 10] = [
    "ун",
    "унбер",
    "унике",
    "унөч",
    "ундүрт",
    "унбиш",
    "уналты",
    "унҗиде",
    "унсигез",
    "унтугыз",
];
/// `TENS`, keyed 20 … 90. Generated from numbers.ts's object literal.
const TENS: [&str; 10] = [
    "",
    "",
    "егерме",
    "утыз",
    "кырык",
    "илле",
    "алтмыш",
    "җитмеш",
    "сиксән",
    "туксан",
];
const HUNDRED: &str = "йөз";
const THOUSAND: &str = "мең";
const MILLION: &str = "миллион";
const BILLION: &str = "миллиард";

/// `numberToWords(n)` over the JS number (callers pass non-negative integers; the arithmetic is the TS's `f64`).
pub(crate) fn number_to_words(n: f64) -> Vec<&'static str> {
    let more = |r: f64| {
        if r != 0.0 {
            number_to_words(r)
        } else {
            Vec::new()
        }
    };
    if n < 10.0 {
        return vec![UNITS[n as usize]];
    }
    if n < 20.0 {
        return vec![TEENS[n as usize - 10]];
    }
    if n < 100.0 {
        let (t, u) = ((n / 10.0).floor() as usize, n % 10.0);
        let mut v = vec![TENS[t]];
        if u != 0.0 {
            v.push(UNITS[u as usize]);
        }
        return v;
    }
    if n < 1000.0 {
        let (h, r) = ((n / 100.0).floor(), n % 100.0);
        let mut v = Vec::new();
        if h > 1.0 {
            v.push(UNITS[h as usize]);
        }
        v.push(HUNDRED);
        v.extend(more(r));
        return v;
    }
    if n < 1_000_000.0 {
        let (th, r) = ((n / 1000.0).floor(), n % 1000.0);
        let mut v = if th > 1.0 {
            number_to_words(th)
        } else {
            Vec::new()
        };
        v.push(THOUSAND);
        v.extend(more(r));
        return v;
    }
    let (div, word) = if n < 1_000_000_000.0 {
        (1_000_000.0, MILLION)
    } else {
        (1_000_000_000.0, BILLION)
    };
    let mut v = number_to_words((n / div).floor());
    v.push(word);
    v.extend(more(n % div));
    v
}
