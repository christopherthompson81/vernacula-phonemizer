//! Odia (or) text normalization: the shared symbol tier first, then unit abbreviations, Latin initialisms, the rate
//! slash, digit de-grouping, dotted abbreviations, decimals, the clock, ordinal suffixes, abbreviations, the Latin `I`
//! used as a danda, degrees, signs and the relational and division signs. Pure text to text.
//! Ported from src/languages/odia/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::try_manifest;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::numbers::{NumbersDef, indic_number_words_js};
use crate::core::postposed_sign::postposed_sign;
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

// Generated from the TS object literals (key order preserved).
const UNIT_WORD: [(&str, &str); 8] = [
    ("କି.ମି.", "କିଲୋମିଟର"),
    ("କି.ମି", "କିଲୋମିଟର"),
    ("କିମି", "କିଲୋମିଟର"),
    ("ମି.ମି.", "ମିଲିମିଟର"),
    ("ମି.ମି", "ମିଲିମିଟର"),
    ("ମିମି", "ମିଲିମିଟର"),
    ("କି.ଗ୍ରା.", "କିଗ୍ରା"),
    ("କି.ଗ୍ରା", "କିଗ୍ରା"),
];
const RATE_NUM: [&str; 5] = ["କିଲୋମିଟର", "ମିଲିମିଟର", "ମିଟର", "ମାଇଲ୍", "ମାଇଲ"];
const RATE_DEN: [&str; 4] = ["ଘଣ୍ଟା", "ସେକେଣ୍ଡ", "ମିନିଟ୍", "ମିନିଟ"];

pub type OdiaNormalizer = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;

/// `UNIT_ALT`: the keys longest first (UTF-16 length, stable), each dot escaped.
fn unit_alt() -> String {
    let mut k: Vec<&str> = UNIT_WORD.iter().map(|(k, _)| *k).collect();
    k.sort_by_key(|a| std::cmp::Reverse(js(a).len()));
    k.iter()
        .map(|k| k.replace('.', "\\."))
        .collect::<Vec<_>>()
        .join("|")
}

fn re(pattern: String) -> JsRegex {
    JsRegex::new(&pattern, "gu").unwrap_or_else(|e| panic!("odia normalize pattern: {e}"))
}

static UNIT_RE: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"(\d)\s?({})(?![\p{{L}}\p{{M}}])", unit_alt())));
static RATE_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(format!(
        r"(?<![\p{{L}}\p{{M}}])({})\s?/\s?({})(?![\p{{L}}\p{{M}}])",
        RATE_NUM.join("|"),
        RATE_DEN.join("|")
    ))
});

/// `SYMBOLS`: the shared tier over Odia's `symbolTier`, these nine fields only.
fn symbols() -> Result<SymbolNormalizer, String> {
    let t = &try_manifest()?.symbol_tier;
    make_symbol_normalizer(&SymbolData {
        percent: t.percent.clone(),
        currency: t.currency.clone(),
        units: t.units.clone(),
        rate_denominators: t.rate_denominators.clone(),
        unit_per: t.unit_per.clone(),
        exponent_words: t.exponent_words.clone(),
        magnitudes: t.magnitudes.clone(),
        ampersand: t.ampersand.clone(),
        multiply: t.multiply.clone(),
        ..Default::default()
    })
}

/// `makeOdiaNormalizer(numbers)`.
pub fn make_odia_normalizer(numbers: &NumbersDef) -> Result<OdiaNormalizer, String> {
    let symbols = symbols()?;
    let ordinal_re = re(format!(
        r"(?<![\d.,])(\d+)\s?({})(?![\p{{L}}\p{{M}}])",
        try_manifest()?.ordinal_suffixes.join("|")
    ));
    let numbers = numbers.clone();
    Ok(Box::new(move |input: &JsString| -> JsString {
        let ordinal = |n: f64, suffix: &JsString| -> Option<JsString> {
            let words = indic_number_words_js(n, &numbers);
            if words.is_empty() || words.iter().any(|w| w.as_deref().is_none_or(str::is_empty)) {
                return None;
            }
            let mut out: Vec<String> = words.into_iter().map(Option::unwrap_or_default).collect();
            let last = out.len() - 1;
            out[last] = format!("{}{}", out[last], suffix.to_string_lossy());
            Some(js(&out.join(" ")))
        };

        // 1) The shared symbol tier first.
        let mut s = symbols.apply(input);

        // 2) Odia unit abbreviations, only after a number.
        s = rewrite_with(&s, &UNIT_RE, |m, full| {
            let u = m.group(2, full).unwrap_or_default().to_string_lossy();
            let word = UNIT_WORD
                .iter()
                .find(|(k, _)| *k == u)
                .map(|(_, v)| *v)
                .unwrap_or_default();
            m.group(1, full)
                .unwrap_or_default()
                .concat(&js(&format!(" {word}")))
        });

        // 3) Latin dotted initialisms.
        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\p{L}\p{M}\d])([A-Za-z](?:\.[A-Za-z])+)\.?(?![\p{L}\p{M}])",
                "gu"
            ),
            |m, full| {
                js_re!(r"\.", "gu").replace(&m.group(1, full).unwrap_or_default(), &JsString::new())
            },
        );

        // 4) The rate slash between two Odia measure nouns.
        s = rewrite_with(&s, &RATE_RE, |m, full| {
            m.group(1, full)
                .unwrap_or_default()
                .concat(&js(" ପ୍ରତି "))
                .concat(&m.group(2, full).unwrap_or_default())
        });

        // 5) Digit de-grouping, Indian then Western.
        let ungroup = |m: &crate::core::js_regex::JsMatch, full: &JsString| {
            js_re!(r",", "gu").replace(&m.value(full), &JsString::new())
        };
        s = rewrite_with(
            &s,
            js_re!(r"(?<![\d,])(\d{1,2}(?:,\d{2})+,\d{3})(?![\d,])", "gu"),
            ungroup,
        );
        s = rewrite_with(
            &s,
            js_re!(r"(?<![\d,])([1-9]\d{0,2}(?:,\d{3})+)(?![\d,])", "gu"),
            ungroup,
        );

        // 6) Dot-abbreviation leftovers.
        s = rewrite(&s, js_re!(r"(?<![\p{L}\p{M}])କି\.ଗ୍ରା\.?", "gu"), &js("କିଗ୍ରା"));

        // 7) Decimals: the dot neutralised.
        s = rewrite(&s, js_re!(r"(\d)\.(?=\d)", "gu"), &js("$1 "));

        // 8) Times.
        s = rewrite_with(
            &s,
            js_re!(r"(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])", "gu"),
            |m, full| {
                let h = m.group(1, full).unwrap_or_default();
                let min = m.group(2, full).unwrap_or_default();
                if js_number(&min) == 0.0 {
                    h
                } else {
                    h.concat(&js(" ")).concat(&min)
                }
            },
        );

        // 9) Ordinal suffixes, joined to the cardinal's last word.
        s = rewrite_with(&s, &ordinal_re, |m, full| {
            let digits = m.group(1, full).unwrap_or_default();
            let suffix = m.group(2, full).unwrap_or_default();
            ordinal(js_number(&digits), &suffix).unwrap_or_else(|| m.value(full))
        });

        // 10) Abbreviations: the dot and the visarga both required.
        let spaced = |sp: Option<JsString>| sp.filter(|x| !x.is_empty()).unwrap_or_else(|| js(" "));
        s = rewrite_with(
            &s,
            js_re!(r"(?<![\p{L}\p{M}])(?:ଡଃ|ଡାଃ)\.(\s*)(?=[\p{L}])", "gu"),
            |m, full| js("ଡାକ୍ତର").concat(&spaced(m.group(1, full))),
        );
        s = rewrite_with(
            &s,
            js_re!(r"(?<![\p{L}\p{M}])ନଂ\.(\s*)(?=[\d\p{L}])", "gu"),
            |m, full| js("ନମ୍ବର").concat(&spaced(m.group(1, full))),
        );

        // 11) A Latin `I` used as a danda.
        s = rewrite(
            &s,
            js_re!(r"(?<![A-Za-z\d])I(?![A-Za-z\d])", "gu"),
            &js("।"),
        );

        // 12) Degrees.
        s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 ଡିଗ୍ରୀ"));

        // 13) ±, the minus (declined after a digit anywhere to its left), the plus.
        s = rewrite(&s, js_re!(r"±", "gu"), &js(" ପ୍ଲସ୍ ଋଣାତ୍ମକ "));
        s = rewrite_with(
            &s,
            js_re!(r"(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)", "gu"),
            |m, full| {
                if js_re!(r"\d\s*$", "u").test(&full.slice(0, Some(m.index() as isize))) {
                    m.value(full)
                } else {
                    js("ଋଣାତ୍ମକ ")
                }
            },
        );
        s = rewrite(&s, js_re!(r"\+(?=\d)", "gu"), &js(" ପ୍ଲସ୍ "));

        s = postposed_sign(&s, "<", &js("ଠାରୁ କମ"));
        s = postposed_sign(&s, ">", &js("ଠାରୁ ଅଧିକ"));
        s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" ସମାନ "));
        s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" ଭାଗ "));

        s
    }))
}
