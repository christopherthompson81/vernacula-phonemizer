//! Akan text normalization: entities and invisible characters, the Greek / Hebrew homoglyph fold, the elided
//! apostrophe, digit grouping (comma, dot, space), units (squared and bare), percent ranges and percents with the
//! already-written test, currencies, dotted abbreviations, number ranges, both decimal marks, ordinal tails and `&`.
//! Ported from src/languages/akan/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::make_bare_unit_normalizer;
use crate::core::provenance::{Form, renormalize, rewrite, rewrite_with};
use crate::js_re;

const POINT: &str = "akyiri pɔ";
const PERCENT: &str = "ɔha mu nkyekyɛmu";
const PERCENT_WRITTEN: &str = r"[ɔoO][hH]a\s?(?:mu\s?)?nkyeky[ɛeɔ][ɛem]?u?";
const TO: &str = "kosi";

/// `UNITS`, in the TS order (the loops below run in it).
const UNITS: [(&str, &str); 5] = [
    ("km", "kilomita"),
    ("cm", "sɛntimita"),
    ("mm", "milimita"),
    ("kg", "kilogram"),
    ("m", "mita"),
];
const SQUARED: &str = "ahinanan";

/// `CURRENCY`: each key a regex SOURCE, as the TS writes it (`US\$`, `\$`).
const CURRENCY: [(&str, &str); 7] = [
    ("GH₵", "sidi"),
    ("GHC", "sidi"),
    ("GHc", "sidi"),
    ("GHS", "sidi"),
    ("₵", "sidi"),
    (r"US\$", "dɔla"),
    (r"\$", "dɔla"),
];

const NUM: &str = r"\d+(?:[.,]\d+)*";
const NLB: &str = r"(?<![\p{L}\p{M}])";

/// `HOMOGLYPH`, in the object's key order (it builds the character class).
const HOMOGLYPH: [(&str, &str); 2] = [("ε", "ɛ"), ("כ", "ɔ")];

static HOMOGLYPH_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let keys: String = HOMOGLYPH.iter().map(|(k, _)| *k).collect();
    JsRegex::new(&format!("[{keys}]"), "gu").unwrap()
});

static ALREADY_PERCENTED: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"{PERCENT_WRITTEN}[^%.!?]{{0,60}}$"), "u").unwrap());

/// `alreadyPercented(before)`.
fn already_percented(before: &JsString) -> bool {
    ALREADY_PERCENTED.test(before)
}

type BareUnits = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static BARE_UNITS: LazyLock<BareUnits> = LazyLock::new(|| {
    Box::new(make_bare_unit_normalizer(
        UNITS.iter().map(|(k, v)| (js(k), js(v))).collect(),
    ))
});

static ELISION: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!("{NLB}([nwmNWM])['’ʼ]([aeɛioɔuAEIƐOƆU])"), "gu").unwrap()
});

static SQUARED_UNITS: LazyLock<Vec<(JsRegex, JsString)>> = LazyLock::new(|| {
    UNITS
        .iter()
        .map(|(sym, word)| {
            (
                JsRegex::new(
                    &format!(
                        r"(?<![$€£₵][^\d]{{0,3}}[\d.,]{{0,12}})(?<![\d.,\p{{L}}\p{{M}}])({NUM})\s?{sym}(?:²|2)(?![\p{{L}}\p{{M}}\d²³/])"
                    ),
                    "gu",
                )
                .unwrap(),
                js(&format!("$1 {word} {SQUARED}")),
            )
        })
        .collect()
});

static PLAIN_UNITS: LazyLock<Vec<(JsRegex, JsString)>> = LazyLock::new(|| {
    UNITS
        .iter()
        .map(|(sym, word)| {
            (
                JsRegex::new(
                    &format!(
                        r"(?<![$€£₵][^\d]{{0,3}}[\d.,]{{0,12}})(?<![\d.,\p{{L}}\p{{M}}])({NUM})\s?{sym}(?![\p{{L}}\p{{M}}\d²³/])"
                    ),
                    "gu",
                )
                .unwrap(),
                js(&format!("$1 {word}")),
            )
        })
        .collect()
});

static PERCENT_RANGE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<![\d.,:\-–—])({NUM})\s?%?\s?[-–—]\s?({NUM})\s?%"),
        "gu",
    )
    .unwrap()
});

static PERCENT_SIGN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"(?<![\d.,])({NUM})\s?%"), "gu").unwrap());

static CURRENCIES: LazyLock<Vec<(JsRegex, JsString)>> = LazyLock::new(|| {
    CURRENCY
        .iter()
        .map(|(sym, word)| {
            (
                JsRegex::new(&format!(r"{NLB}{sym}\s?({NUM})"), "gu").unwrap(),
                js(&format!("{word} $1")),
            )
        })
        .collect()
});

fn g(m: &JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `Number(x.replace(/,/gu, ""))`.
fn no_commas(x: &JsString) -> f64 {
    js_number(&js_re!(",", "gu").replace(x, &JsString::new()))
}

/// `fraction(tail)`: a one- or two-digit tail without a leading zero is read whole, else digit by digit.
fn fraction(tail: &JsString) -> JsString {
    if tail.len() <= 2 && !tail.starts_with(&js("0")) {
        tail.clone()
    } else {
        JsString::join(&tail.code_point_strings(), &js(" "))
    }
}

fn point(m: &JsMatch, t: &JsString) -> JsString {
    g(m, t, 1)
        .concat(&js(&format!(" {POINT} ")))
        .concat(&fraction(&g(m, t, 2)))
}

/// `normalizeAkan(input)`.
pub fn normalize_akan(input: &JsString) -> JsString {
    let mut s = renormalize(input, Form::Nfc);
    // A digit-flanked ASCII `x` is the `×` it stands for (#1597): a relay dimension, and `×` is unread.
    s = rewrite(
        &s,
        js_re!(r"(\d[ \u00a0]?)[xX](?=[ \u00a0]?\d)", "gu"),
        &js("$1×"),
    );
    s = rewrite(&s, js_re!(r"&nbsp;|&#(?:x[0-9a-f]+|\d+);", "giu"), &js(" "));
    s = rewrite(
        &s,
        js_re!("[\u{200b}\u{200c}\u{200d}\u{feff}]", "gu"),
        &JsString::new(),
    );
    s = rewrite(&s, js_re!(r"(?<=\d)\|(?=\p{L})", "gu"), &js(" "));
    s = rewrite_with(&s, &HOMOGLYPH_RE, |m, t| {
        let c = m.value(t);
        let to = HOMOGLYPH
            .iter()
            .find(|(k, _)| c == *k)
            .map(|(_, v)| *v)
            .expect("the class holds only the table's keys");
        js(to)
    });
    s = rewrite(&s, &ELISION, &js("$1$2"));
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2})((?:,\d{3})+)(?![\d]|,\d)", "gu"),
        |m, t| js_re!(",", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})((?:\.\d{3}){2,})(?![\d]|\.\d)",
            "gu"
        ),
        |m, t| js_re!(r"\.", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?![\d]| \d)",
            "gu"
        ),
        |m, t| js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&m.value(t), &JsString::new()),
    );
    for (re, rep) in SQUARED_UNITS.iter() {
        s = rewrite(&s, re, rep);
    }
    for (re, rep) in PLAIN_UNITS.iter() {
        s = rewrite(&s, re, rep);
    }
    s = BARE_UNITS(&s);
    s = rewrite_with(&s, &PERCENT_RANGE, |m, t| {
        let (a, b) = (g(m, t, 1), g(m, t, 2));
        if no_commas(&a) >= no_commas(&b) {
            return m.value(t);
        }
        let before = t.slice(0, Some(m.index() as isize));
        let word = if already_percented(&before) {
            String::new()
        } else {
            format!("{PERCENT} ")
        };
        js(&format!(
            "{word}{} {TO} {}",
            a.to_string_lossy(),
            b.to_string_lossy()
        ))
    });
    s = rewrite_with(&s, &PERCENT_SIGN, |m, t| {
        let a = g(m, t, 1);
        if already_percented(&t.slice(0, Some(m.index() as isize))) {
            a
        } else {
            js(&format!("{PERCENT} {}", a.to_string_lossy()))
        }
    });
    for (re, rep) in CURRENCIES.iter() {
        s = rewrite(&s, re, rep);
    }
    s = rewrite(
        &s,
        js_re!(r"(?<=[\p{L}\p{M}])\.(?=\p{L}\p{M}*\.)", "gu"),
        &JsString::new(),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,:\p{L}\p{M}\-–—])(\d+)\s?[-–—]\s?(\d+)(?![\d\p{L}\p{M}\-–—]|,\d)",
            "gu"
        ),
        |m, t| {
            let (a, b) = (g(m, t, 1), g(m, t, 2));
            if js_number(&a) < js_number(&b) {
                js(&format!(
                    "{} {TO} {}",
                    a.to_string_lossy(),
                    b.to_string_lossy()
                ))
            } else {
                m.value(t)
            }
        },
    );
    s = rewrite_with(&s, js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?![\d.])", "gu"), point);
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+),(\d{1,2})(?![\d.,])", "gu"),
        point,
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d)(?:st|nd|rd|th)(?![\p{L}\p{M}])", "gu"),
        &JsString::new(),
    );
    rewrite(&s, js_re!(r"\s?&\s?", "gu"), &js(" ne "))
}
