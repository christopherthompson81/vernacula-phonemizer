//! Chuvash number words (spellings): the full (counting) and short (attributive) unit series, вуннӑ / вун, the
//! one-word 80 and 90, a bare 100 / 1000, million and milliard keeping the multiplier.
//! Ported from src/languages/chuvash/numbers.ts — see that file for the sources.

/// `FULL`. Generated from numbers.ts's array literal.
const FULL: [&str; 10] = [
    "ноль",
    "пӗрре",
    "иккӗ",
    "виҫҫӗ",
    "тӑваттӑ",
    "пиллӗк",
    "улттӑ",
    "ҫиччӗ",
    "саккӑр",
    "тӑххӑр",
];
/// `SHORT`. Generated from numbers.ts's array literal.
const SHORT: [&str; 10] = [
    "ноль",
    "пӗр",
    "ик",
    "виҫ",
    "тӑват",
    "пилӗк",
    "улт",
    "ҫич",
    "сакӑр",
    "тӑхӑр",
];
const TEN_FULL: &str = "вуннӑ";
const TEN_SHORT: &str = "вун";
/// `TENS`, keyed 20 … 90 (index `t / 10`). Generated from numbers.ts's object literal.
const TENS: [&str; 10] = [
    "",
    "",
    "ҫирӗм",
    "вӑтӑр",
    "хӗрӗх",
    "аллӑ",
    "утмӑл",
    "ҫитмӗл",
    "сакӑрвуннӑ",
    "тӑхӑрвуннӑ",
];
const HUNDRED: &str = "ҫӗр";
const THOUSAND: &str = "пин";
const MILLION: &str = "миллион";
const BILLION: &str = "миллиард";

/// `unit(u, attr)`: SHORT when the unit modifies a following magnitude word, else FULL.
fn unit(u: f64, attr: bool) -> &'static str {
    if attr {
        SHORT[u as usize]
    } else {
        FULL[u as usize]
    }
}

/// `numberToWords(n, attr)` over the JS number (callers pass non-negative integers; the arithmetic is the TS's
/// `f64`). `attr`: this group multiplies a following magnitude word.
pub(crate) fn number_to_words(n: f64, attr: bool) -> Vec<&'static str> {
    let more = |r: f64| {
        if r != 0.0 {
            number_to_words(r, attr)
        } else {
            Vec::new()
        }
    };
    if n < 10.0 {
        return vec![unit(n, attr)];
    }
    if n == 10.0 {
        return vec![if attr { TEN_SHORT } else { TEN_FULL }];
    }
    if n < 20.0 {
        return vec![TEN_SHORT, unit(n - 10.0, attr)];
    }
    if n < 100.0 {
        let t = (n / 10.0).floor();
        let u = n % 10.0;
        let mut out = vec![TENS[t as usize]];
        if u != 0.0 {
            out.push(unit(u, attr));
        }
        return out;
    }
    if n < 1000.0 {
        let h = (n / 100.0).floor();
        let mut out = if h > 1.0 {
            vec![SHORT[h as usize]]
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
            number_to_words(th, true)
        } else {
            Vec::new()
        };
        out.push(THOUSAND);
        out.extend(more(n % 1000.0));
        return out;
    }
    if n < 1_000_000_000.0 {
        let mut out = number_to_words((n / 1_000_000.0).floor(), true);
        out.push(MILLION);
        out.extend(more(n % 1_000_000.0));
        return out;
    }
    let mut out = number_to_words((n / 1_000_000_000.0).floor(), true);
    out.push(BILLION);
    out.extend(more(n % 1_000_000_000.0));
    out
}
