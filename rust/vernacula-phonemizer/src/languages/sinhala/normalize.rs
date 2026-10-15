//! Sinhala (si) text normalization: joiners stripped, dotted era / currency / unit abbreviations, letter initials,
//! de-grouping, temperatures and degrees, minus signs, rates, the million suffix, the shared symbol tier (its words
//! in prefix position) and decimals, then the joiners stripped again. Pure text to text.
//! Ported from src/languages/sinhala/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use indexmap::IndexMap;

use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_js_space, js};
use crate::core::normalize_symbols::{
    ExponentPosition, ExponentWords, PositionDecl, SymbolData, SymbolNormalizer,
    make_symbol_normalizer,
};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

fn forms(w: &str) -> Vec<String> {
    vec![w.to_string()]
}

fn table(rows: &[(&str, &str)]) -> IndexMap<String, Vec<String>> {
    rows.iter()
        .map(|(k, v)| (k.to_string(), forms(v)))
        .collect()
}

/// `SYMBOLS`: the shared tier over this file's own table (generated from the TS literal, key order preserved).
static SYMBOLS: LazyLock<SymbolNormalizer> = LazyLock::new(|| {
    make_symbol_normalizer(&SymbolData {
        percent: Some(forms("සියයට")),
        percent_prefix: Some(true),
        currency: Some(table(&[
            ("US$", "ඇමෙරිකානු ඩොලර්"),
            ("$", "ඩොලර්"),
            ("€", "යූරෝ"),
            ("£", "පවුම්"),
            ("Rs", "රුපියල්"),
            ("₨", "රුපියල්"),
        ])),
        currency_prefix: Some(true),
        magnitudes: Some(
            ["දහස", "ලක්ෂ", "කෝටි", "මිලියන", "බිලියන"]
                .iter()
                .map(|s| s.to_string())
                .collect(),
        ),
        units: Some(table(&[
            ("km", "කිලෝමීටර්"),
            ("m", "මීටර්"),
            ("cm", "සෙන්ටිමීටර්"),
            ("mm", "මිලිමීටර්"),
            ("kg", "කිලෝග්‍රෑම්"),
            ("ml", "මිලිලීටර්"),
            ("ha", "හෙක්ටයාර්"),
        ])),
        unit_prefix: Some(true),
        exponent_words: Some(ExponentWords {
            squared: Some(forms("වර්ග")),
            cubed: Some(forms("ඝන")),
            position: Some(PositionDecl::All(ExponentPosition::Before)),
        }),
        ampersand: Some("සහ".to_string()),
        ..Default::default()
    })
    .expect("sinhala symbol tier")
});

/// `stripJoiners(s)`: `&nbsp;` to a space (a plain replace, off the seam, as in the TS), then the joiners deleted.
fn strip_joiners(s: &JsString) -> JsString {
    let s = js_re!(r"&nbsp;", "gu").replace(s, &js(" "));
    rewrite(&s, js_re!(r"[​-‍⁠﻿­]", "gu"), &JsString::new())
}

fn abbrev(body: &str, word: &str) -> (JsRegex, JsString) {
    let re = JsRegex::new(&format!(r"(?<![඀-෿]){body}(?![඀-෿])"), "gu")
        .unwrap_or_else(|e| panic!("sinhala abbreviation pattern: {e}"));
    (re, js(&format!("{word} ")))
}

static DOTTED_ABBREV: LazyLock<Vec<(JsRegex, JsString)>> = LazyLock::new(|| {
    vec![
        abbrev(r"ක්රි\.\s?පූ\.?", "ක්‍රිස්තු පූර්ව"),
        abbrev(r"ක්රි\.\s?පු\.?", "ක්‍රිස්තු පූර්ව"),
        abbrev(r"ක්රි\.\s?ව\.?", "ක්‍රිස්තු වර්ෂ"),
        abbrev(r"ඇ\.\s?ඩො\.\s?මි\.?", "ඇමෙරිකානු ඩොලර් මිලියන"),
        abbrev(r"ඇ\.\s?ඩො\.?", "ඇමෙරිකානු ඩොලර්"),
        abbrev(r"කි\.\s?මී\.?", "කිලෝමීටර්"),
        abbrev(r"සෙ\.\s?මී\.?", "සෙන්ටිමීටර්"),
        abbrev(r"මි\.\s?මී\.?", "මිලිමීටර්"),
        (
            JsRegex::new(r"(?<![඀-෿])රු\.\s*(?=\p{Nd})", "gu").expect("rupee pattern"),
            js("රුපියල් "),
        ),
    ]
});

const SIGN: &str = r"(\u2212?)";
const NUM: &str = r"(\p{Nd}+(?:\.\p{Nd}+)?)";
const DEG: &str = r"\s*[°º\u2070]\s*";
const RATE_OPERAND: &str =
    r"(?:((?<![\p{Nd}.,\-–—])\p{Nd}[\p{Nd}.,]*(?:\s?[-–—]\s?\p{Nd}[\p{Nd}.,]*)?)\s*)?";
// Generated from the TS literals (order preserved).
const COMPASS: [(&str, &str); 4] = [("N", "උතුරු"), ("S", "දකුණු"), ("E", "නැගෙනහිර"), ("W", "බටහිර")];
const RATES: [(&str, &str); 2] = [
    (r"km\s?\/\s?h", "පැයට කිලෝමීටර්"),
    (r"m\s?\/\s?s", "තත්පරයට මීටර්"),
];

fn re(pattern: String, flags: &str) -> JsRegex {
    JsRegex::new(&pattern, flags).unwrap_or_else(|e| panic!("sinhala normalize pattern: {e}"))
}

static CELSIUS_RE: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"{SIGN}{NUM}{DEG}C(?![\p{{L}}\p{{M}}])"), "giu"));
static FAHRENHEIT_RE: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"{SIGN}{NUM}{DEG}F(?![\p{{L}}\p{{M}}])"), "giu"));
static COMPASS_RE: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"{NUM}{DEG}([NSEW])(?![\p{{L}}\p{{M}}])"), "gu"));
static DEGREE_RE: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"{SIGN}{NUM}\s*[°º\u2070]"), "gu"));
static KELVIN_RE: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"{NUM} K(?![\p{{L}}\p{{M}}.])"), "gu"));
static RATE_RES: LazyLock<Vec<(JsRegex, &'static str)>> = LazyLock::new(|| {
    RATES
        .iter()
        .map(|(unit, word)| {
            (
                re(
                    format!(
                        r"{RATE_OPERAND}(?<![\p{{L}}\p{{M}}\p{{Nd}}]){unit}(?![\p{{L}}\p{{M}}])"
                    ),
                    "gu",
                ),
                *word,
            )
        })
        .collect()
});

/// `s.trimEnd()`.
fn trim_end(s: &JsString) -> JsString {
    let v = s.units();
    let end = v
        .iter()
        .rposition(|&u| !is_js_space(u))
        .map_or(0, |e| e + 1);
    JsString::from_units(&v[..end])
}

/// `s.replaceAll(from, to)` for a one-character literal.
fn replace_all(s: &JsString, from: &str, to: &str) -> JsString {
    JsString::join(&s.split(&js(from)), &js(to))
}

/// `neg(sg)`: the minus word when the sign was written.
fn neg(sg: Option<JsString>) -> &'static str {
    if sg.is_some_and(|s| !s.is_empty()) {
        "ඍණ "
    } else {
        ""
    }
}

/// `normalizeSinhala(input)`.
pub fn normalize_sinhala(input: &JsString) -> JsString {
    let mut s = strip_joiners(input);

    for (rx, word) in DOTTED_ABBREV.iter() {
        s = rewrite(&s, rx, word);
    }

    // Sinhala-letter initials: every dot a space.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![඀-෿.])(?:[඀-෿]{1,7}\.){2,}", "gu"),
        |m, full| trim_end(&replace_all(&m.value(full), ".", " ")).concat(&js(" ")),
    );
    s = rewrite(&s, js_re!(r"  +", "gu"), &js(" "));

    // De-grouping.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{Nd}.,])(\p{Nd}{1,3}(?:(?<!(?<!\p{Nd})0),\p{Nd}{3})+)(?![\p{Nd}])",
            "gu"
        ),
        |m, full| replace_all(&m.value(full), ",", ""),
    );

    // A bare leading decimal point.
    s = rewrite(&s, js_re!(r"(?<=[\s(\[])\.(?=\p{Nd})", "gu"), &js("0."));

    // Temperatures and degrees.
    s = rewrite_with(&s, &CELSIUS_RE, |m, full| {
        js(&format!("සෙල්සියස් අංශක {}", neg(m.group(1, full))))
            .concat(&m.group(2, full).unwrap_or_default())
    });
    s = rewrite_with(&s, &FAHRENHEIT_RE, |m, full| {
        js(&format!("ෆැරන්හයිට් අංශක {}", neg(m.group(1, full))))
            .concat(&m.group(2, full).unwrap_or_default())
    });
    s = rewrite_with(&s, &COMPASS_RE, |m, full| {
        let d = m.group(2, full).unwrap_or_default().to_string_lossy();
        let dir = COMPASS
            .iter()
            .find(|(k, _)| *k == d)
            .map(|(_, v)| *v)
            .unwrap_or_default();
        js("අංශක ")
            .concat(&m.group(1, full).unwrap_or_default())
            .concat(&js(&format!(" {dir}")))
    });
    s = rewrite_with(&s, &DEGREE_RE, |m, full| {
        js(&format!("අංශක {}", neg(m.group(1, full)))).concat(&m.group(2, full).unwrap_or_default())
    });
    s = rewrite(&s, &KELVIN_RE, &js("කෙල්වින් $1"));

    // Minus signs.
    s = rewrite(&s, js_re!(r"(^|[(\[])[-–−](?=\p{Nd})", "gu"), &js("$1ඍණ "));
    s = rewrite(&s, js_re!(r"(?<=[\s(\[])−(?=\p{Nd})", "gu"), &js("ඍණ "));

    // Rates: the per-word first, then the operand.
    for (rx, word) in RATE_RES.iter() {
        s = rewrite_with(&s, rx, |m, full| match m.group(1, full) {
            Some(n) if !n.is_empty() => js(&format!("{word} ")).concat(&n),
            _ => js(word),
        });
    }

    // The million suffix on a currency amount, and a decimal followed by m.
    s = rewrite(
        &s,
        js_re!(
            r"((?:US\$|[$€£₨])\s?\p{Nd}[\p{Nd}.,]*)m(?![\p{L}\p{M}])",
            "gu"
        ),
        &js("$1 මිලියන"),
    );
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{Nd}.,])(\p{Nd}+\.\p{Nd}+)m(?![\p{L}\p{M}])",
            "gu"
        ),
        &js("මීටර් $1"),
    );
    s = SYMBOLS.apply(&s);

    // Decimals.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{Nd}.])(\p{Nd}+)\.(\p{Nd}+)(?![\p{Nd}.])", "gu"),
        |m, full| {
            let frac = m.group(2, full).unwrap_or_default();
            m.group(1, full)
                .unwrap_or_default()
                .concat(&js(" දශම "))
                .concat(&JsString::join(&frac.code_point_strings(), &js(" ")))
        },
    );

    // The emitted words carry their joiners: strip again.
    strip_joiners(&s)
}
