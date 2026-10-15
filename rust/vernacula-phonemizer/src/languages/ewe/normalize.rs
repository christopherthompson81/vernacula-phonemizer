//! Ewe text normalization: the homoglyph fold, entities and invisible characters, digit grouping, units (squared
//! and bare, noun first), percent ranges and percents, currencies, dotted abbreviations, number ranges, decimals,
//! ordinal tails and the ampersand.
//! Ported from src/languages/ewe/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::make_bare_unit_normalizer;
use crate::core::provenance::{Form, renormalize, rewrite, rewrite_with};
use crate::js_re;

const PERCENT: &str = "le alafa me";
const TO: &str = "va ɖo";

/// `UNITS`, in the TS order (the loops below run in it).
const UNITS: [(&str, &str); 4] = [
    ("km", "kilometa"),
    ("cm", "sentimeta"),
    ("mm", "milimeta"),
    ("m", "meta"),
];

/// `CURRENCY`: each key a regex SOURCE, as the TS writes it (`US\$`, `\$`).
const CURRENCY: [(&str, &str); 10] = [
    ("GH¢", "cedi"),
    ("GH₵", "cedi"),
    ("GHS", "cedi"),
    ("GHC", "cedi"),
    ("¢", "cedi"),
    ("₵", "cedi"),
    (r"US\$", "dɔlar"),
    (r"\$", "dɔlar"),
    ("€", "euro"),
    ("£", "pound"),
];

const NUM: &str = r"\d+(?:[.,]\d+)*";
const NLB: &str = r"(?<![\p{L}\p{M}])";
const NOT_MAGNITUDE: &str = r"(?<![$€£¢₵][^\d]{0,3}[\d.,]{0,12})";

type BareUnits = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static BARE_UNITS: LazyLock<BareUnits> = LazyLock::new(|| {
    Box::new(make_bare_unit_normalizer(
        UNITS.iter().map(|(k, v)| (js(k), js(v))).collect(),
    ))
});

fn rules(pattern: impl Fn(&str) -> String) -> Vec<(JsRegex, JsString)> {
    UNITS
        .iter()
        .map(|(sym, word)| {
            (
                JsRegex::new(&pattern(sym), "gu").unwrap(),
                js(&format!("{word} $1")),
            )
        })
        .collect()
}

static SQUARED_UNITS: LazyLock<Vec<(JsRegex, JsString)>> = LazyLock::new(|| {
    rules(|sym| {
        format!(
            r"{NOT_MAGNITUDE}(?<![\d.,\p{{L}}\p{{M}}])({NUM})\s?{sym}(?:²|2)(?![\p{{L}}\p{{M}}\d²³/])"
        )
    })
});

static PLAIN_UNITS: LazyLock<Vec<(JsRegex, JsString)>> = LazyLock::new(|| {
    rules(|sym| {
        format!(r"{NOT_MAGNITUDE}(?<![\d.,\p{{L}}\p{{M}}])({NUM})\s?{sym}(?![\p{{L}}\p{{M}}\d²³/])")
    })
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

static NUMBER_RANGE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        r"(?<![\d.,:\p{L}\p{M}\-–—])(\d+)\s?[-–—]\s?(\d+)(?![\d\p{L}\p{M}\-–—])",
        "gu",
    )
    .unwrap()
});

fn g(m: &crate::core::js_regex::JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `Number(x.replace(/,/gu, ""))`.
fn no_commas(x: &JsString) -> f64 {
    js_number(&js_re!(",", "gu").replace(x, &JsString::new()))
}

/// `normalizeEwe(input)`.
pub fn normalize_ewe(input: &JsString) -> JsString {
    let mut s = renormalize(input, Form::Nfc);
    s = rewrite(&s, js_re!("[ÐĐ]", "gu"), &js("Ɖ"));
    s = rewrite(&s, js_re!("Ƞ", "gu"), &js("Ŋ"));
    s = rewrite(&s, js_re!("͂", "gu"), &js("̃"));
    s = renormalize(&s, Form::Nfc);
    s = rewrite(&s, js_re!(r"&nbsp;?", "giu"), &js(" "));
    s = rewrite(&s, js_re!(r"&ndash;", "giu"), &js("–"));
    s = rewrite(&s, js_re!(r"&#(?:x[0-9a-f]+|\d+);", "giu"), &js(" "));
    s = rewrite(
        &s,
        js_re!("[\u{200b}\u{200c}\u{200d}\u{feff}]", "gu"),
        &JsString::new(),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2})((?:,\d{3})+)(?![\d]|,\d)", "gu"),
        |m, t| js_re!(",", "gu").replace(&m.value(t), &JsString::new()),
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
        if no_commas(&a) < no_commas(&b) {
            js(&format!(
                "{} {TO} {} {PERCENT}",
                a.to_string_lossy(),
                b.to_string_lossy()
            ))
        } else {
            m.value(t)
        }
    });
    s = rewrite(&s, &PERCENT_SIGN, &js(&format!("$1 {PERCENT}")));
    for (re, rep) in CURRENCIES.iter() {
        s = rewrite(&s, re, rep);
    }
    s = rewrite(
        &s,
        js_re!(r"(?<=\p{L})\.(?=\p{L}\.)", "gu"),
        &JsString::new(),
    );
    s = rewrite_with(&s, &NUMBER_RANGE, |m, t| {
        let (a, b) = (g(m, t, 1), g(m, t, 2));
        if js_number(&a) < js_number(&b) && (a.len() > 1 || b.len() > 1) {
            js(&format!(
                "{} {TO} {}",
                a.to_string_lossy(),
                b.to_string_lossy()
            ))
        } else {
            m.value(t)
        }
    });
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?![\d.\p{L}\p{M}])", "gu"),
        |m, t| {
            let frac = JsString::join(&g(m, t, 2).code_point_strings(), &js(" "));
            g(m, t, 1).concat(&js(" ")).concat(&frac)
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d)(?:st|nd|rd|th)(?![\p{L}\p{M}])", "gu"),
        &JsString::new(),
    );
    rewrite(&s, js_re!(r"\s?&\s?", "gu"), &js(" kple "))
}
