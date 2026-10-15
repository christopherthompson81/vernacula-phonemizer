//! Afrikaans (af) text normalization: `&amp;`, the indefinite article's spellings, era markers and dotted
//! abbreviations, dotted capitals, letter-suffix ordinals, clocks, comma grouping and the comma decimal, version
//! dots, rates, regnal ordinals, degrees, signs, fractions, and the initialism pass.
//! Ported from src/languages/afrikaans/normalize.ts — see that file for the corpus evidence and the ordering.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::manifest::MANIFEST;
use super::numbers::number_to_words;
use crate::core::initialisms::{
    InitialismData, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::provenance::{escape, rewrite, rewrite_with};
use crate::js_re;

/// `ordinalWord(n)`.
pub fn ordinal_word(n: f64) -> Option<JsString> {
    if !is_safe_integer(n) || n < 1.0 {
        return None;
    }
    let below = &MANIFEST.ordinals_below20;
    if n < 20.0 {
        return Some(js(&below[n as usize]));
    }
    let card = number_to_words(n, None);
    if card.is_empty() || js_re!(r"\d", "u").test(&card) {
        return None;
    }
    let r = (n as u64 % 100) as usize;
    if (1..20).contains(&r) {
        let m = &MANIFEST.numbers;
        let tail = js(if r < 10 {
            &m.units[r]
        } else {
            &m.teens[r - 10]
        });
        if !tail.is_empty() && card.ends_with(&tail) {
            return Some(
                card.slice(0, Some(-(tail.len() as isize)))
                    .concat(&js(&below[r])),
            );
        }
    }
    Some(card.concat(&js("ste")))
}

/// `ABBREV_ALT` / `BARE_ALT`: the table's keys (all of them / only the dotted ones), longest first, escaped.
fn alternation(dotted_only: bool) -> String {
    let mut keys: Vec<&String> = MANIFEST
        .dotted_abbreviations
        .keys()
        .filter(|k| !dotted_only || k.contains('.'))
        .collect();
    keys.sort_by_key(|k| std::cmp::Reverse(js(k).len()));
    keys.iter().map(|k| escape(k)).collect::<Vec<_>>().join("|")
}

static ABBREV_RES: LazyLock<[JsRegex; 3]> = LazyLock::new(|| {
    let all = alternation(false);
    let bare = alternation(true);
    let re = |p: String| JsRegex::new(&p, "giu").unwrap();
    [
        re(format!(
            r"(?<![\p{{L}}\p{{M}}])({all})\.(\s+)(?=[\p{{L}}\d])"
        )),
        re(format!(
            r"(?<![\p{{L}}\p{{M}}])({all})\.(?=\s*(?:[.,;:!?»)]|$))"
        )),
        re(format!(
            r"(?<![\p{{L}}\p{{M}}])({bare})(?=\s*(?:[\p{{L}}\d(]|[,.;:!?»)]|$))"
        )),
    ]
});

static MULTI_DOT: LazyLock<Vec<(JsRegex, JsRegex, JsString)>> = LazyLock::new(|| {
    MANIFEST
        .multi_dot_abbreviations
        .iter()
        .map(|(body, word)| {
            (
                JsRegex::new(&format!(r"(?<![\p{{L}}\p{{M}}]){body}\.(?=\s*$)"), "giu").unwrap(),
                JsRegex::new(&format!(r"(?<![\p{{L}}\p{{M}}]){body}"), "giu").unwrap(),
                js(word),
            )
        })
        .collect()
});

type Pred = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

/// `isUnreadableAfrikaans(word)`.
pub static IS_UNREADABLE: LazyLock<Pred> = LazyLock::new(|| {
    let set = |l: &[String]| l.iter().map(|s| js(s)).collect::<Vec<_>>();
    let p = &MANIFEST.phonotactics;
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new("[aeiouy]", "u").unwrap(),
        legal_onsets: set(&p.legal_onsets),
        legal_codas: set(&p.legal_codas),
        liquids: None,
        digraphs: None,
    }))
});

static WORD_ACRONYMS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.word_acronyms.iter().map(|s| js(s)).collect());
static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.acronym_letters.iter().map(|s| js(s)).collect());

fn letter_name(l: &JsString) -> Option<JsString> {
    MANIFEST
        .letter_names
        .get(&l.to_lower_case().to_string_lossy())
        .map(|s| js(s))
}

/// `normalizeAfrikaansInitialisms(text)`.
pub fn normalize_afrikaans_initialisms(text: &JsString) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: Arc::new(letter_name),
            lower: None,
            acronym_letters: Arc::new(|w: &JsString| ACRONYM_LETTERS.contains(w)),
            is_recorded: |w: &JsString| WORD_ACRONYMS.contains(w),
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(text)
}

/// The clock reading: hour, then the minutes unless zero, then the period.
fn clock(h: &JsString, min: &JsString, period: &JsString) -> JsString {
    let mut out = number_to_words(js_number(h), None);
    if js_number(min) != 0.0 {
        out = out
            .concat(&js(" "))
            .concat(&number_to_words(js_number(min), None));
    }
    out.concat(period)
}

/// `period(p)`: an unknown abbreviation keeps its text.
fn period(p: Option<JsString>) -> JsString {
    let Some(p) = p else {
        return JsString::new();
    };
    let t = p.trim();
    let word = MANIFEST
        .clock_periods
        .get(&t.to_lower_case().to_string_lossy())
        .map_or(t, |w| js(w));
    js(" ").concat(&word)
}

/// `normalizeAfrikaans(input)`.
pub fn normalize_afrikaans(input: &JsString) -> JsString {
    let g = |m: &JsMatch, s: &JsString, i: usize| m.group(i, s).unwrap_or_default();
    let sign = &MANIFEST.sign_words;
    let mut s = input.clone();

    s = rewrite(&s, js_re!(r"&amp;", "giu"), &js(" & "));

    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])[‘’ʼ`´]n(?![\p{L}\p{M}])", "gu"),
        &js("'n"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])ń(?![\p{L}\p{M}])", "gu"),
        &js("'n"),
    );

    for (final_re, re, word) in MULTI_DOT.iter() {
        s = rewrite(&s, final_re, &word.concat(&js(".")));
        s = rewrite(&s, re, word);
    }

    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])\p{Lu}\.(?:[ \u00a0]?\p{Lu}\.)+", "gu"),
        |m, w| js_re!(r"[.\s]", "gu").replace(&m.value(w), &JsString::new()),
    );

    let abbrev = |ab: &JsString| {
        MANIFEST
            .dotted_abbreviations
            .get(&ab.to_lower_case().to_string_lossy())
            .map(|w| js(w))
    };
    s = rewrite_with(&s, &ABBREV_RES[0], |m, w| match abbrev(&g(m, w, 1)) {
        Some(word) => word.concat(&g(m, w, 2)),
        None => m.value(w),
    });
    s = rewrite_with(&s, &ABBREV_RES[1], |m, w| match abbrev(&g(m, w, 1)) {
        Some(word) => word.concat(&js(".")),
        None => m.value(w),
    });
    s = rewrite_with(&s, &ABBREV_RES[2], |m, w| {
        abbrev(&g(m, w, 1)).unwrap_or_else(|| m.value(w))
    });

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d,.])(\d{1,4})(?:ste[n]?|de[n]?|e)(?![\p{L}\p{M}])",
            "giu"
        ),
        |m, w| ordinal_word(js_number(&g(m, w, 1))).unwrap_or_else(|| m.value(w)),
    );

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![:.]?\d)(\s*(?:vm|nm))?",
            "giu"
        ),
        |m, w| clock(&g(m, w, 1), &g(m, w, 2), &period(m.group(3, w))),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,:])([01]?\d|2[0-3])\.([0-5]\d)(?![\d.,:-])(?=\s*(?:GUT|UTC|SAST|GMT|vm|nm))(\s*(?:vm|nm))?",
            "giu"
        ),
        |m, w| clock(&g(m, w, 1), &g(m, w, 2), &period(m.group(3, w))),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:])([01]?\d|2[0-3])([0-5]\d)(?=\s*(?:UTC|GUT))",
            "gu"
        ),
        |m, w| clock(&g(m, w, 1), &g(m, w, 2), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d:])([01]?\d|2[0-3])(vm)(?![\p{L}\p{M}])", "giu"),
        |m, w| {
            number_to_words(js_number(&g(m, w, 1)), None)
                .concat(&js(" "))
                .concat(&js(&MANIFEST.clock_periods["vm"]))
        },
    );

    for _ in 0..2 {
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
    }

    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+),(\d{1,2})(?![\d,.])", "gu"),
        &js("$1.$2"),
    );

    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d{3,})\.(\d+)(?=[a-z](?![a-z]))", "giu"),
        &js("$1 punt $2"),
    );
    s = rewrite(
        &s,
        js_re!(r"Figuur (\d+)\.(\d+)", "giu"),
        &js("Figuur $1 punt $2"),
    );

    s = rewrite(
        &s,
        js_re!(r"(\d+)\s*Mbit\/s(?![\p{L}\p{M}])", "giu"),
        &js("$1 megabit per sekonde"),
    );

    s = rewrite_with(
        &s,
        js_re!(
            r"W[êe]reld ?[Oo]orlog (\d+|I{1,3}V?|IV)(?![\p{L}\p{M}])",
            "gu"
        ),
        |m, w| {
            let d = g(m, w, 1);
            let n = if js_re!(r"^\d+$", "u").test(&d) {
                Some(js_number(&d))
            } else {
                match d.to_string_lossy().as_str() {
                    "I" => Some(1.0),
                    "II" => Some(2.0),
                    "III" => Some(3.0),
                    "IV" => Some(4.0),
                    _ => None,
                }
            };
            match n.and_then(ordinal_word) {
                Some(ord) => ord.concat(&js(" Wêreldoorlog")),
                None => m.value(w),
            }
        },
    );

    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?C(?![\p{L}\p{M}])", "gui"),
        &js("$1 grade Celsius"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?F(?![\p{L}\p{M}])", "gui"),
        &js("$1 grade Fahrenheit"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°(?![\p{L}\p{M}])", "gu"),
        &js("$1 grade"),
    );

    s = rewrite(
        &s,
        js_re!(r"±", "gu"),
        &js(&format!(" {} ", sign.plus_minus)),
    );
    s = rewrite(
        &s,
        js_re!(r"\+\s?(?=\d)", "gu"),
        &js(&format!(" {} ", sign.plus)),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{Nd}])[-−](\d+)(?!\s*[-\d])", "gu"),
        &js(&format!("{} $1", sign.minus)),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(?![\p{L}\p{M}])", "gu"),
        |m, w| {
            let (a, b) = (g(m, w, 1), g(m, w, 2));
            let name = |l: &JsString| letter_name(l).unwrap_or_else(|| l.clone());
            name(&a)
                .concat(&js(&format!(" {} ", sign.ampersand)))
                .concat(&name(&b))
        },
    );
    s = rewrite(
        &s,
        js_re!(r"\s&\s", "gu"),
        &js(&format!(" {} ", sign.ampersand)),
    );
    s = rewrite(
        &s,
        js_re!(r"(\S)\s*=\s*(\S)", "gu"),
        &js(&format!("$1 {} $2", sign.equals)),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*<\s*(\d)", "gu"),
        &js(&format!("$1 {} $2", sign.less_than)),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*>\s*(\d)", "gu"),
        &js(&format!("$1 {} $2", sign.greater_than)),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*×\s*(\d)", "gu"),
        &js(&format!("$1 {} $2", sign.times)),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*÷\s*(\d)", "gu"),
        &js(&format!("$1 {} $2", sign.divided_by)),
    );

    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])", "gu"),
        |m, w| {
            let (num, den) = (js_number(&g(m, w, 1)), js_number(&g(m, w, 2)));
            let frac = &MANIFEST.fraction_words;
            if den == 2.0 {
                return if num == 1.0 {
                    js(&frac.one_half)
                } else {
                    number_to_words(num, None).concat(&js(&format!(" {}", frac.halves)))
                };
            }
            match ordinal_word(den) {
                Some(ord) => number_to_words(num, None).concat(&js(" ")).concat(&ord),
                None => m.value(w),
            }
        },
    );

    normalize_afrikaans_initialisms(&s)
}
