//! Nogai number words (Cyrillic spellings): two-word teens, a bare 100 / 1000 without "бир", million and milliard
//! keeping it. Ported from src/languages/nogai/numbers.ts — see that file for the sources.

const UNITS: [&str; 10] = [
    "ноль",
    "бир",
    "эки",
    "уьш",
    "доьрт",
    "бес",
    "алты",
    "ети",
    "сегиз",
    "тогыз",
];
/// `TENS`, keyed 10 … 90. Generated from numbers.ts's object literal.
const TENS: [&str; 10] = [
    "",
    "он",
    "йырма",
    "отыз",
    "кырк",
    "элли",
    "алпыс",
    "етпис",
    "сексен",
    "токсан",
];
const HUNDRED: &str = "юз";
const THOUSAND: &str = "мынъ";
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
    if n < 100.0 {
        let t = (n / 10.0).floor();
        let u = n % 10.0;
        let mut out = vec![TENS[t as usize]];
        if u != 0.0 {
            out.push(UNITS[u as usize]);
        }
        return out;
    }
    if n < 1000.0 {
        let h = (n / 100.0).floor();
        let mut out = if h > 1.0 {
            vec![UNITS[h as usize]]
        } else {
            Vec::new()
        };
        out.push(HUNDRED);
        out.extend(more(n % 100.0));
        return out;
    }
    if n < 1_000_000.0 {
        let th = (n / 1000.0).floor();
        let mut out = if th > 1.0 {
            number_to_words(th)
        } else {
            Vec::new()
        };
        out.push(THOUSAND);
        out.extend(more(n % 1000.0));
        return out;
    }
    if n < 1_000_000_000.0 {
        let mut out = number_to_words((n / 1_000_000.0).floor());
        out.push(MILLION);
        out.extend(more(n % 1_000_000.0));
        return out;
    }
    let mut out = number_to_words((n / 1_000_000_000.0).floor());
    out.push(BILLION);
    out.extend(more(n % 1_000_000_000.0));
    out
}
