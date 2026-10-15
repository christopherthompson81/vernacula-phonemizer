//! Luganda (lg) text normalization: marked clocks, ordinal suffixes, ascending ranges, de-grouping, percent,
//! pre-posed currency and unit nouns (each declined where the writer already said the word), decimals.
//! Pure text to text. Ported from src/languages/luganda/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const PERCENT: &str = "ku kikumi";
const YEAR_TO: &str = "okutuuka mu";
const NUM_TO: &str = "okutuuka ku";
const DOLLAR: &str = "ddoola";
const EURO: &str = "euro";
const POUND: &str = "pawundi";
const KILOMETRE: &str = "kiromita";
const METRE: &str = "mmita";
const CENTIMETRE: &str = "sentimita";
const MILLIMETRE: &str = "milimita";
const KILOGRAM: &str = "kilo";
const SQUARED: &str = "eza kyebiriga";

/// `saidNear(full, offset, end, ...words)`: one of the words, whole, within 45 units of the match.
fn said_near(full: &JsString, offset: usize, end: usize, words: &[&str]) -> bool {
    let alt: Vec<JsString> = words
        .iter()
        .map(|w| {
            let e = js_re!(r"[.*+?^${}()|[\]\\]", "gu").replace(&js(w), &js(r"\$&"));
            js_re!(r" ", "gu").replace(&e, &js(r"\s+"))
        })
        .collect();
    let alt = JsString::join(&alt, &js("|")).to_string_lossy();
    JsRegex::new(
        &format!(r"(?<![\p{{L}}\p{{M}}])(?:{alt})(?![\p{{L}}\p{{M}}])"),
        "iu",
    )
    .unwrap()
    .test(&window(full, offset, end))
}

/// `full.slice(Math.max(0, offset - 45), end + 45)`.
fn window(full: &JsString, offset: usize, end: usize) -> JsString {
    full.slice(
        offset.saturating_sub(45) as isize,
        Some((end + 45) as isize),
    )
}

/// `spellings(noun)`: the noun and its `ALSO_WRITTEN` variants (generated from the TS object, order kept).
fn spellings(noun: &'static str) -> Vec<&'static str> {
    let also: &[&str] = match noun {
        KILOMETRE => &["kiromiita", "kilomita", "kilomiita"],
        METRE => &["mita", "miita"],
        CENTIMETRE => &["sentimiita", "ssentimita"],
        MILLIMETRE => &["milimiita"],
        KILOGRAM => &["kiro"],
        _ => &[],
    };
    std::iter::once(noun).chain(also.iter().copied()).collect()
}

const GROUPED: &str = r"[1-9]\d{0,2}(?:,\d{3})+|\d+";

static RANGE_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &(format!(
            r"(?<![-+−–—/\d.,\p{{L}}\p{{M}}])({GROUPED})[ \u00a0]?[-–—][ \u00a0]?({GROUPED})"
        ) + r"(?![-+−/\d,\p{L}\p{M}])"),
        "gu",
    )
    .unwrap()
});

/// The cm / mm / kg rules, in the TS order.
static UNIT_RES: LazyLock<Vec<(JsRegex, &'static str)>> = LazyLock::new(|| {
    [("cm", CENTIMETRE), ("mm", MILLIMETRE), ("kg", KILOGRAM)]
        .iter()
        .map(|(key, noun)| {
            (
                JsRegex::new(
                    &format!(
                        r"(?<![\d.,\p{{L}}\p{{M}}])(\d+(?:\.\d+)?)[ \u00a0]?{key}(?![\p{{L}}\p{{M}}\d²³/])"
                    ),
                    "gu",
                )
                .unwrap(),
                *noun,
            )
        })
        .collect()
});

/// `NAMED_DOLLAR.test(all.slice(Math.max(0, off - 45), off + w.length + 45))`.
fn named_dollar(m: &JsMatch, all: &JsString) -> bool {
    js_re!(r"d+oola|dolla|doola", "iu").test(&window(all, m.index(), m.end()))
}

/// A unit rule's callback: the bare number where the noun is already written nearby, else `noun n`.
fn unit_noun(m: &JsMatch, all: &JsString, noun: &'static str, lead: &str) -> JsString {
    let n = m.group(1, all).unwrap();
    if said_near(all, m.index(), m.end(), &spellings(noun)) {
        n
    } else {
        js(&format!("{lead} ")).concat(&n)
    }
}

/// `normalizeLuganda(input)`. The steps are order-dependent.
pub(crate) fn normalize_luganda(input: &JsString) -> JsString {
    let mut s = rewrite_with(
        input,
        js_re!(
            r"(?:(?<=s{1,2}aawa\s)([01]?\d|2[0-3])[.:]([0-5]\d)(?![\d]|[.,:]\d)|(?<![\d.,:])([01]?\d|2[0-3])[.:]([0-5]\d)(?![\d]|[.,:]\d)(?=\s*(?:am\b|p\.?\s?m\.?|GMT|UTC|ez[\p{L}’'])))",
            "giu"
        ),
        |m, t| match m.group(1, t) {
            Some(h1) => h1.concat(&js(" ")).concat(&m.group(2, t).unwrap()),
            None => m
                .group(3, t)
                .unwrap()
                .concat(&js(" "))
                .concat(&m.group(4, t).unwrap()),
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])", "giu"),
        &js("$1"),
    );
    s = rewrite_with(&s, &RANGE_RE, |m, t| {
        let (a, b) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
        let strip = |x: &JsString| js_re!(r",", "gu").replace(x, &JsString::new());
        let (na, nb) = (js_number(&strip(&a)), js_number(&strip(&b)));
        if na >= nb {
            return m.value(t);
        }
        let comma = js(",");
        let year = !a.includes(&comma)
            && !b.includes(&comma)
            && a.len() == 4
            && b.len() == 4
            && na >= 1000.0;
        a.concat(&js(&format!(" {} ", if year { YEAR_TO } else { NUM_TO })))
            .concat(&b)
    });
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2})(?:,\d{3})+(?!\d)", "gu"),
        |m, t| js_re!(r",", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})(?:[ \u00a0\u202f\u2009]\d{3})+(?!\d)",
            "gu"
        ),
        |m, t| js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2})(?:\.\d{3})+(?!\d)", "gu"),
        |m, t| js_re!(r"\.", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(\d+(?:\.\d+)?)[ \u00a0]?%", "gu"),
        |m, all| {
            let n = m.group(1, all).unwrap();
            if said_near(all, m.index(), m.end(), &[PERCENT, "ku buli kikumi"]) {
                n
            } else {
                n.concat(&js(&format!(" {PERCENT}")))
            }
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])US[ \u00a0]?\$[ \u00a0]?(?=\d)", "giu"),
        |m, all| {
            if named_dollar(m, all) {
                JsString::new()
            } else {
                js(&format!("{DOLLAR} "))
            }
        },
    );
    s = rewrite_with(&s, js_re!(r"\$[ \u00a0]?(?=\d)", "gu"), |m, all| {
        if named_dollar(m, all) {
            JsString::new()
        } else {
            js(&format!("{DOLLAR} "))
        }
    });
    s = rewrite_with(&s, js_re!(r"€[ \u00a0]?(?=\d)", "gu"), |m, all| {
        if said_near(all, m.index(), m.end(), &[EURO]) {
            JsString::new()
        } else {
            js(&format!("{EURO} "))
        }
    });
    s = rewrite_with(&s, js_re!(r"£[ \u00a0]?(?=\d)", "gu"), |m, all| {
        if said_near(all, m.index(), m.end(), &[POUND]) {
            JsString::new()
        } else {
            js(&format!("{POUND} "))
        }
    });
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,\p{L}\p{M}])(\d+(?:\.\d+)?)[ \u00a0\u202f\u2009]?km[²2](?![\p{L}\p{M}\d])",
            "gu"
        ),
        |m, all| unit_noun(m, all, KILOMETRE, &format!("{KILOMETRE} {SQUARED}")),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,\p{L}\p{M}])(\d+(?:\.\d+)?)[ \u00a0\u202f\u2009]?km(?![\p{L}\p{M}\d²³/])",
            "gu"
        ),
        |m, all| unit_noun(m, all, KILOMETRE, KILOMETRE),
    );
    for (re, noun) in UNIT_RES.iter() {
        s = rewrite_with(&s, re, |m, all| unit_noun(m, all, noun, noun));
    }
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,\p{L}\p{M}])(\d+)[ \u00a0]m(?![\p{L}\p{M}\d²³/])",
            "gu"
        ),
        |m, all| unit_noun(m, all, METRE, METRE),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?![\d,\p{L}\p{M}]|\.\d)", "gu"),
        |m, t| {
            let frac = JsString::join(&m.group(2, t).unwrap().code_point_strings(), &js(" "));
            m.group(1, t).unwrap().concat(&js(" ")).concat(&frac)
        },
    );

    tidy(&s)
}

/// `tidy(s)`: collapse runs of horizontal space and trim the ends.
fn tidy(s: &JsString) -> JsString {
    let s = rewrite(s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" "));
    rewrite(&s, js_re!(r"^[^\S\n]+|[^\S\n]+$", "gu"), &JsString::new())
}
