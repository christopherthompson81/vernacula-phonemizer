//! Number words from a language's `NumbersDef`: the Indic (lakh/crore) and Western (thousand/million)
//! composers, rendering, and digit spelling. Ported from src/core/numbers.ts — see that file for each system.
//!
//! ⚠ PARTIAL: `dravidianNumberWords` is ported with its first consumer.
//! Callers pass integers (the TS `n: number` is always one at the call sites), so `n` is a `u64` here.

use std::collections::HashMap;
use std::sync::Arc;

use serde::Deserialize;

/// ⚠ EVERY FIELD IS OPTIONAL, THOUGH THE TS INTERFACE REQUIRES SOME, because the data does not satisfy it:
/// Armenian, Polish, Czech and others declare no `hundred` (the Western composer reads `hundreds`), and Lao,
/// Shan, Tibetan and Slovenian declare no `thousand` either. A required field would refuse those manifests.
/// A missing magnitude a composer reaches renders "?", as a `null` slot does.
#[derive(Debug, Deserialize, Clone, Default)]
pub struct Magnitudes {
    pub hundred: Option<String>,
    pub thousand: Option<String>,
    pub lakh: Option<String>,
    pub crore: Option<String>,
    pub million: Option<String>,
    pub billion: Option<String>,
}

#[derive(Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct NumbersDef {
    pub units: Vec<String>,
    pub teens: Option<Vec<String>>,
    pub tens: HashMap<String, String>,
    pub hundreds: Option<Vec<String>>,
    #[serde(default)]
    pub magnitudes: Magnitudes,
    pub compound: Option<HashMap<String, String>>,
    pub compound_order: Option<String>,
    pub bare_magnitude: Option<bool>,
    pub magnitude_paradigm: Option<HashMap<String, Vec<String>>>,
    /// Code, not data: set by the language after loading.
    #[serde(skip)]
    pub magnitude_count_form: Option<Arc<dyn Fn(u64) -> i64 + Send + Sync>>,
    pub decimal_word: Option<String>,
}

impl std::fmt::Debug for NumbersDef {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("NumbersDef")
            .field("units", &self.units)
            .finish_non_exhaustive()
    }
}

/// A word slot; `None` is the TS `null` a composer may return (rendered as "?").
pub type Word = Option<String>;

fn unit(d: &NumbersDef, n: u64) -> Word {
    d.units.get(n as usize).cloned()
}

fn tens(d: &NumbersDef, t: u64) -> Word {
    d.tens.get(&t.to_string()).cloned()
}

fn magnitudes(d: &NumbersDef) -> &Magnitudes {
    &d.magnitudes
}

/// `indicNumberWords(n, d)` for the JS `Number` a caller parsed out of a digit run: an unsafe integer (above
/// 2^53, `Infinity`, `NaN`, a fraction) is a gap, `[null]`, never a composition. The TS composer used to
/// compose the rounded float and recurse on `Infinity` until the stack overflowed (#1463). Below 2^53 this is
/// `indic_number_words`; callers pass a non-negative digit run.
pub fn indic_number_words_js(n: f64, d: &NumbersDef) -> Vec<Word> {
    if !crate::core::js_string::is_safe_integer(n) {
        return vec![None];
    }
    indic_number_words(n as u64, d)
}

pub fn indic_number_words(n: u64, d: &NumbersDef) -> Vec<Word> {
    let bare = d.bare_magnitude == Some(true);
    let rest = |r: u64| {
        if r != 0 {
            indic_number_words(r, d)
        } else {
            Vec::new()
        }
    };
    if n < 10 {
        return vec![unit(d, n)];
    }
    if n < 20 {
        return vec![
            d.teens
                .as_ref()
                .and_then(|t| t.get((n - 10) as usize).cloned()),
        ];
    }
    if n < 100 {
        let (t, u) = (n / 10 * 10, n % 10);
        if u == 0 {
            return vec![tens(d, t)];
        }
        if let Some(c) = d
            .compound
            .as_ref()
            .and_then(|c| c.get(&n.to_string()))
            .filter(|c| !c.is_empty())
        {
            return vec![Some(c.clone())];
        }
        return if d.compound_order.as_deref() == Some("tens-unit") {
            vec![tens(d, t), unit(d, u)]
        } else {
            vec![unit(d, u), tens(d, t)]
        };
    }
    let group = |count: u64, r: u64, word: Word| {
        let mut out = if count == 1 && bare {
            Vec::new()
        } else {
            indic_number_words(count, d)
        };
        out.push(word);
        out.extend(rest(r));
        out
    };
    if n < 1000 {
        let (h, r) = (n / 100, n % 100);
        if let Some(sup) = d
            .hundreds
            .as_ref()
            .and_then(|x| x.get(h as usize))
            .filter(|s| !s.is_empty())
        {
            let mut out = vec![Some(sup.clone())];
            out.extend(rest(r));
            return out;
        }
        let mut out = if h == 1 && bare {
            Vec::new()
        } else {
            vec![unit(d, h)]
        };
        out.push(magnitudes(d).hundred.clone());
        out.extend(rest(r));
        return out;
    }
    if n < 100_000 {
        return group(n / 1000, n % 1000, magnitudes(d).thousand.clone());
    }
    if n < 10_000_000 {
        return group(n / 100_000, n % 100_000, magnitudes(d).lakh.clone());
    }
    group(n / 10_000_000, n % 10_000_000, magnitudes(d).crore.clone())
}

pub fn western_number_words(n: u64, d: &NumbersDef) -> Vec<Word> {
    let mag = |key: &str, count: u64| -> Word {
        let m = magnitudes(d);
        let base = match key {
            "thousand" => m.thousand.clone(),
            "million" => m.million.clone(),
            _ => m.billion.clone(),
        };
        let Some(forms) = d
            .magnitude_paradigm
            .as_ref()
            .and_then(|p| p.get(key))
            .filter(|f| !f.is_empty())
        else {
            return base;
        };
        let i = d
            .magnitude_count_form
            .as_ref()
            .map_or(if count == 1 { 0 } else { 1 }, |f| f(count));
        forms
            .get(i.clamp(0, forms.len() as i64 - 1) as usize)
            .cloned()
    };
    let rest = |r: u64| {
        if r != 0 {
            western_number_words(r, d)
        } else {
            Vec::new()
        }
    };
    if n < 10 {
        return vec![unit(d, n)];
    }
    if n < 20 {
        return vec![
            d.teens
                .as_ref()
                .and_then(|t| t.get((n - 10) as usize).cloned()),
        ];
    }
    if n < 100 {
        let (t, u) = (n / 10 * 10, n % 10);
        let mut out = vec![tens(d, t)];
        if u != 0 {
            out.push(unit(d, u));
        }
        return out;
    }
    if n < 1000 {
        let (h, r) = (n / 100, n % 100);
        let mut out = vec![
            d.hundreds
                .as_ref()
                .expect("NumbersDef.hundreds")
                .get(h as usize)
                .cloned(),
        ];
        out.extend(rest(r));
        return out;
    }
    if n < 1_000_000 {
        let (th, r) = (n / 1000, n % 1000);
        let mut out = if th == 1 {
            Vec::new()
        } else {
            western_number_words(th, d)
        };
        out.push(mag("thousand", th));
        out.extend(rest(r));
        return out;
    }
    if n < 1_000_000_000 {
        let (m, r) = (n / 1_000_000, n % 1_000_000);
        let mut out = western_number_words(m, d);
        out.push(mag("million", m));
        out.extend(rest(r));
        return out;
    }
    let (b, r) = (n / 1_000_000_000, n % 1_000_000_000);
    let mut out = western_number_words(b, d);
    out.push(mag("billion", b));
    out.extend(rest(r));
    out
}

pub type NumberComposer = fn(u64, &NumbersDef) -> Vec<Word>;

/// `renderNumber`: each word through `word`, a `null` slot as "?". ⚠ A MISSING table entry (the TS's
/// `undefined` from a `!` lookup, which it would pass to `word`) also renders as "?": both are gaps in the
/// language's table, and the per-language fn-diff over its number range is what catches one.
pub fn render_number(
    n: u64,
    d: &NumbersDef,
    word: &dyn Fn(&str) -> String,
    compose: NumberComposer,
) -> String {
    compose(n, d)
        .into_iter()
        .map(|w| match w {
            None => "?".to_string(),
            Some(w) => word(&w),
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// `digitIndex(c)`: 0-9 for an ASCII digit, else -1.
pub fn digit_index(c: u16) -> i32 {
    if (b'0' as u16..=b'9' as u16).contains(&c) {
        (c - b'0' as u16) as i32
    } else {
        -1
    }
}

/// Each ASCII digit of `digits` by its unit word; others dropped.
pub fn spell_digits(digits: &str, d: &NumbersDef, word: &dyn Fn(&str) -> String) -> String {
    digits
        .chars()
        .filter_map(|c| c.to_digit(10).and_then(|n| d.units.get(n as usize)))
        .filter(|w| !w.is_empty())
        .map(|w| word(w))
        .collect::<Vec<_>>()
        .join(" ")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn hi() -> NumbersDef {
        crate::languages::hindi::manifest::try_manifest()
            .unwrap()
            .numbers
            .clone()
    }

    /// The JS-number entry refuses an unsafe integer, as `indicNumberWords` does (#1463).
    #[test]
    fn an_unsafe_integer_is_a_gap() {
        let d = hi();
        for n in [
            9_007_199_254_740_992.0,
            9_007_199_254_740_994.0,
            1e21,
            f64::INFINITY,
            f64::NEG_INFINITY,
            f64::NAN,
            1.5,
        ] {
            assert_eq!(indic_number_words_js(n, &d), vec![None], "{n}");
        }
        let safe = indic_number_words_js(9_007_199_254_740_991.0, &d);
        assert!(safe.len() > 1 && safe.iter().all(Option::is_some));
        assert_eq!(safe, indic_number_words(9_007_199_254_740_991, &d));
    }
}
