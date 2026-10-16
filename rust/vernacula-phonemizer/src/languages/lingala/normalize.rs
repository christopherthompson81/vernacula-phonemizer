//! Lingala (ln) text normalization: marked clocks, entities and zero-width characters, dotted abbreviations, ISBNs,
//! de-grouping, units (spans and single), degrees, percent, ranges as `kino`, the dollar, small fractions,
//! decimals, French-style ordinals and the ampersand. Pure text to text.
//! Ported from src/languages/lingala/normalize.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;

use super::lingala::DIR;
use crate::core::data_source::load_once;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::make_bare_unit_normalizer;
use crate::core::provenance::{Form, renormalize, rewrite, rewrite_with};
use crate::js_re;

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
struct FirstCard {
    first_card: String,
}

#[derive(Debug, FromJson)]
struct FirstCardFile {
    numbers: FirstCard,
}

/// `FIRST_ORDINAL`, or why lingala.jsonc could not be loaded.
pub(crate) fn try_first_ordinal() -> Result<&'static str, String> {
    static F: OnceLock<FirstCardFile> = OnceLock::new();
    load_once(&F, || {
        load_manifest(DIR, "lingala.jsonc").map_err(|e| e.to_string())
    })
    .map(|f| f.numbers.first_card.as_str())
}

/// `UNITS`. Generated from normalize.ts's table (order preserved).
const UNITS: [(&str, &str); 8] = [
    ("km²", "kilomɛtrɛ-kare"),
    ("km2", "kilomɛtrɛ-kare"),
    ("m²", "mɛtrɛ-kare"),
    ("m2", "mɛtrɛ-kare"),
    ("km", "kilomɛtrɛ"),
    ("cm", "sɛntimɛtɛlɛ"),
    ("mm", "milimɛtrɛ"),
    ("kg", "kilogálame"),
];

type TextFn = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static BARE_UNITS: LazyLock<TextFn> = LazyLock::new(|| {
    Box::new(make_bare_unit_normalizer(
        UNITS.iter().map(|(k, w)| (js(k), js(w))).collect(),
    ))
});

/// The two rules per unit, in the TS order: a span with the unit, then a single number with it.
static UNIT_RES: LazyLock<Vec<(JsRegex, JsRegex, &'static str)>> = LazyLock::new(|| {
    UNITS
        .iter()
        .map(|(sym, word)| {
            let key = js_re!(r"[.*+?^${}()|[\]\\]", "gu")
                .replace(&js(sym), &js(r"\$&"))
                .to_string_lossy();
            (
                JsRegex::new(
                    &format!(
                        r"(?<![\d.,:\p{{L}}\p{{M}}-])(\d+)\s?[-–—]\s?(\d+)\s?{key}(?![\p{{L}}\p{{M}}\d²³/])"
                    ),
                    "gu",
                )
                .unwrap(),
                JsRegex::new(
                    &format!(
                        r"(?<![\p{{L}}\p{{M}}\d.,])(?<!\d\s?[-–—]\s?)(\d+(?:[.,]\d+)?)\s?{key}(?![\p{{L}}\p{{M}}\d²³/])"
                    ),
                    "gu",
                )
                .unwrap(),
                *word,
            )
        })
        .collect()
});

struct Dotted {
    at_end: JsRegex,
    inline: JsRegex,
    word: &'static str,
}

/// `DOTTED`, in the TS order; the bodies are the TS strings.
static DOTTED: LazyLock<Vec<Dotted>> = LazyLock::new(|| {
    [
        (r"L\.T\.B", "liboso ya tango na biso"),
        (r"T\.B", "tango na biso"),
        (r"n\.\s?Y\.K", "nsima ya Yézu Klísto"),
        (r"Y\.K", "Yézu Klísto"),
        (r"b\.n\.b", "bôngó na bôngó"),
    ]
    .iter()
    .map(|(body, word)| Dotted {
        at_end: JsRegex::new(
            &format!("(?<![\\p{{L}}\\p{{M}}]){body}\\.(?=[ \u{a0}]*(?:$|\\p{{Lu}}))"),
            "gu",
        )
        .unwrap(),
        inline: JsRegex::new(&format!("(?<![\\p{{L}}\\p{{M}}]){body}\\."), "gu").unwrap(),
        word,
    })
    .collect()
});

/// `expandDotted(s, body, word)`.
fn expand_dotted(s: &JsString, d: &Dotted) -> JsString {
    let s = rewrite(s, &d.at_end, &js(&format!("{}.", d.word)));
    rewrite(&s, &d.inline, &js(d.word))
}

/// `x.replace(",", ".")`: the FIRST comma only (a string pattern).
fn first_comma_to_dot(x: &JsString) -> JsString {
    match x.index_of(&js(","), 0) {
        Some(i) => x
            .slice(0, Some(i as isize))
            .concat(&js("."))
            .concat(&x.slice((i + 1) as isize, None)),
        None => x.clone(),
    }
}

/// `normalizeLingala(input)`. The steps are order-dependent.
pub(crate) fn normalize_lingala(input: &JsString) -> JsString {
    let input = rewrite(
        input,
        js_re!(
            r"(?<![\d.,:])([01]?\d|2[0-3])[.:]([0-5]\d)(?![\d]|[.,:]\d)(?=\s*(?:na\s+ntongo|ya\s+butu|UTC|GMT|MDT)\b)",
            "giu"
        ),
        &js("$1 $2"),
    );
    let mut s = renormalize(&input, Form::Nfc);
    s = rewrite(&s, js_re!(r"&nbsp;|&#(?:x[0-9a-f]+|\d+);", "giu"), &js(" "));
    s = rewrite(
        &s,
        js_re!("[\u{200b}\u{200c}\u{200d}\u{feff}]", "gu"),
        &JsString::new(),
    );
    for d in DOTTED.iter() {
        s = expand_dotted(&s, d);
    }
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(ISBN(?:[- ]1[03])?)\s*:?\s*([\d][\d– -]*[\dXx])",
            "gu"
        ),
        |m, t| {
            let body = js_re!(r"[– -]", "gu").replace(&m.group(2, t).unwrap(), &JsString::new());
            m.group(1, t)
                .unwrap()
                .concat(&js(" "))
                .concat(&JsString::join(&body.code_point_strings(), &js(" ")))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2})((?:,\d{3})+)(?![\d]|,\d)", "gu"),
        |m, t| js_re!(r",", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})((?:\.\d{3})+)(?![\d]|\.\d)",
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
    for (span, single, word) in UNIT_RES.iter() {
        s = rewrite_with(&s, span, |m, t| {
            let (a, b) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
            if js_number(&a) < js_number(&b) {
                js(&format!("{word} "))
                    .concat(&a)
                    .concat(&js(" kino "))
                    .concat(&b)
            } else {
                m.value(t)
            }
        });
        s = rewrite(&s, single, &js(&format!("{word} $1")));
    }
    s = BARE_UNITS(&s);
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+(?:[.,]\d+)?)\s?°\s?C(?![\p{L}\p{M}])",
            "gui"
        ),
        &js("Celsius $1"),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+(?:[.,]\d+)?)\s?%\s?[-–—]\s?(\d+(?:[.,]\d+)?)\s?%",
            "gu"
        ),
        |m, t| {
            let (a, b) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
            if js_number(&first_comma_to_dot(&a)) < js_number(&first_comma_to_dot(&b)) {
                a.concat(&js("% kino ")).concat(&b).concat(&js("%"))
            } else {
                m.value(t)
            }
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,:\p{L}\p{M}-])(\d+)(\s?)[-–—]\s?(\d+)(?![\d\p{L}\p{M}-]|[.,]\d)",
            "gu"
        ),
        |m, t| {
            let (a, gap, b) = (
                m.group(1, t).unwrap(),
                m.group(2, t).unwrap(),
                m.group(3, t).unwrap(),
            );
            if js_number(&a) >= js_number(&b) {
                return m.value(t);
            }
            if !gap.is_empty() && a.len() < 2 && b.len() < 2 {
                return m.value(t);
            }
            a.concat(&js(" kino ")).concat(&b)
        },
    );
    s = rewrite(&s, js_re!(r"(\d+)\s?%", "gu"), &js("$1 likolo ya mokama"));
    let named = |all: &JsString, off: usize| {
        js_re!(
            r"(?:dolare|dolar|badollar|dollars?|falánga|falanga)\s*$",
            "iu"
        )
        .test(&all.slice(0, Some(off as isize)))
    };
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])US\s?\$\s?(\d)", "giu"),
        &js("dolare $1"),
    );
    s = rewrite_with(&s, js_re!(r"\$\s?(\d[\d ,.]*)", "gu"), |m, all| {
        let n = m.group(1, all).unwrap();
        if named(all, m.index()) {
            n
        } else {
            js("dolare ").concat(&n)
        }
    });
    s = rewrite_with(&s, js_re!(r"(\d[\d ,.]*?)\s?\$", "gu"), |m, all| {
        let n = m.group(1, all).unwrap();
        if named(all, m.index()) {
            n
        } else {
            js("dolare ").concat(&n)
        }
    });
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d\p{L}\p{M}/]|\d\.|(?<![\d/])\d+,)(\d{1,3})\/(\d{1,3})(?![\d/\p{L}\p{M}]|\.\d|,\d+(?![\d/]))",
            "gu"
        ),
        |m, t| {
            let (a, b) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
            let (na, nb) = (js_number(&a), js_number(&b));
            if na < nb && nb <= 10.0 {
                a.concat(&js(" ya ")).concat(&b)
            } else {
                m.value(t)
            }
        },
    );
    s = rewrite(&s, js_re!(r"¼", "gu"), &js(" mǒkó ya mínei "));
    s = rewrite(&s, js_re!(r"½", "gu"), &js(" mǒkó ya míbalé "));
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)[.,](\d+)(?![\d\p{L}\p{M}])", "gu"),
        |m, t| {
            let frac = JsString::join(&m.group(2, t).unwrap().code_point_strings(), &js(" "));
            m.group(1, t).unwrap().concat(&js(" ")).concat(&frac)
        },
    );
    let first = try_first_ordinal().unwrap_or_else(|e| panic!("{e}"));
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d\p{L}\p{M}])1\s?(?:er|ère|re)(?![\p{L}\p{M}])",
            "gu"
        ),
        &js(&format!("ya {first}")),
    );
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d\p{L}\p{M}])(\d+)\s?(?:ème|nd)(?![\p{L}\p{M}])",
            "gu"
        ),
        &js("ya $1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\d\p{L}\p{M}])(\d+)e(?![\p{L}\p{M}\d])", "gu"), // not before a digit (#1595)
        &js("ya $1"),
    );
    s = rewrite(&s, js_re!(r"\s?&\s?", "gu"), &js(" mpé "));

    s
}
