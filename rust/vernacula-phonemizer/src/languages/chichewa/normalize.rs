//! Chichewa (nya) text normalization: entities and the ampersand, dotted initialisms, clocks with a meridiem, zone
//! or day-part, de-grouping, degrees, metres, ordinal suffixes, ranges as `mpaka`, decimals. Pure text to text.
//! Ported from src/languages/chichewa/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const NB: &str = "\u{a0}";
const METRE: &str = "mamita";
const DEGREE: &str = "madigiri";
const HOUR_WORD: &str = "koloko";
const MINUTE_WORD: &str = "mphindi";
const AM: &str = "m'mawa";
const PM: &str = "masana";
const DAYPART: &str = "m['’]?mawa|masana|madzulo|usiku";
const TZ: &str = "UTC|GMT|BST|CET|EST|EDT|CST|CDT|PST|PDT";

/// `COMPASS`.
fn compass(c: &JsString) -> &'static str {
    match c.to_string_lossy().as_str() {
        "N" => "kumpoto",
        "S" => "kumwera",
        "E" => "kum'mawa",
        _ => "kumadzulo",
    }
}

/// `spell(int, frac)`: the fraction digit by digit.
fn spell(int: &JsString, frac: &JsString) -> JsString {
    int.concat(&js(" "))
        .concat(&JsString::join(&frac.code_point_strings(), &js(" ")))
}

/// `saidNear(full, offset, end, word)`.
fn said_near(full: &JsString, offset: usize, end: usize, word: &str) -> bool {
    full.slice(
        offset.saturating_sub(45) as isize,
        Some((end + 45) as isize),
    )
    .includes(&js(word))
}

/// `degreeBody(n, off, end, full)`.
fn degree_body(n: &JsString, off: usize, end: usize, full: &JsString) -> JsString {
    if said_near(full, off, end, DEGREE) {
        n.clone()
    } else {
        js(&format!("{DEGREE} ")).concat(n)
    }
}

static CLOCK_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &(format!(r"(?<![\d:.,])([01]?\d|2[0-3]):[ {NB}]?([0-5]\d)(?![:.\d])")
            + &format!(
                r"(?:[ {NB}]*(?:([AaPp])\.?[Mm]\.?|({TZ})(?![\p{{L}}\p{{M}}])|({DAYPART})(?![\p{{L}}\p{{M}}])))"
            )),
        "gu",
    )
    .unwrap()
});

/// `` `${Number(x)}` ``.
fn num_str(x: f64) -> JsString {
    js(&js_number_to_string(x))
}

/// `normalizeChichewa(input)`. The steps are order-dependent.
pub(crate) fn normalize_chichewa(input: &JsString) -> JsString {
    let and = &MANIFEST.numbers.and;
    let mut s = rewrite(input, js_re!(r"&nbsp;", "giu"), &js(" "));
    s = rewrite(&s, js_re!(r"&amp;", "giu"), &js("&"));
    s = rewrite(&s, js_re!(r"&", "gu"), &js(&format!(" {and} ")));
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(?:\p{Lu}\.[ \u00a0]?){2,}(?:\p{Lu}(?![\p{L}\p{M}]))?",
            "gu"
        ),
        |m, full| {
            let run = m.value(full);
            let letters = js_re!(r"[. \u00a0]", "gu").replace(&run, &JsString::new());
            let rest = full.slice((m.index() + run.len()) as isize, None);
            if js_re!(r"^[\p{L}\p{M}]", "u").test(&rest) {
                return letters.concat(&js(" "));
            }
            if rest.is_empty() || js_re!(r"^[ \u00a0]+\p{Lu}", "u").test(&rest) {
                letters.concat(&js("."))
            } else {
                letters
            }
        },
    );
    s = rewrite_with(&s, &CLOCK_RE, |m, t| {
        let (hv, mv) = (
            js_number(&m.group(1, t).unwrap()),
            js_number(&m.group(2, t).unwrap()),
        );
        if hv > 23.0 || mv > 59.0 {
            return m.value(t);
        }
        let body = if mv == 0.0 {
            num_str(hv).concat(&js(&format!(" {HOUR_WORD}")))
        } else {
            num_str(hv)
                .concat(&js(&format!(" {HOUR_WORD} {and} {MINUTE_WORD} ")))
                .concat(&num_str(mv))
        };
        if let Some(ap) = m.group(3, t) {
            let word = if ap.to_lower_case() == js("p") {
                PM
            } else {
                AM
            };
            return body.concat(&js(&format!(" {word}")));
        }
        body.concat(&js(" "))
            .concat(&m.group(4, t).or_else(|| m.group(5, t)).unwrap())
    });
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2})(?:,\d{3})+(?![\d]|[.,]\d)", "gu"),
        |m, t| js_re!(r",", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})(?:\.\d{3})+(?![\d]|[.,]\d)",
            "gu"
        ),
        |m, t| js_re!(r"\.", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})(?:[ \u00a0\u202f\u2009]\d{3})+(?![\d])",
            "gu"
        ),
        |m, t| js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?°[ \u00a0]?[CF](?![\p{L}\p{M}])",
            "gui"
        ),
        |m, full| degree_body(&m.group(1, full).unwrap(), m.index(), m.end(), full),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?°[ \u00a0]?([NSEW])(?![\p{L}\p{M}])",
            "gu"
        ),
        |m, full| {
            degree_body(&m.group(1, full).unwrap(), m.index(), m.end(), full)
                .concat(&js(" "))
                .concat(&js(compass(&m.group(2, full).unwrap())))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?[°º](?![\p{L}\p{M}])",
            "gu"
        ),
        |m, full| degree_body(&m.group(1, full).unwrap(), m.index(), m.end(), full),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+)[ \u00a0]?m(?![\p{L}\p{M}'’ʼ0-9])", "gu"),
        &js(&format!("{METRE} $1")),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])", "giu"),
        &js("$1"),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![-\d.,\p{L}\p{M}])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-\d\p{L}\p{M}])",
            "gu"
        ),
        |m, t| {
            let (a, b) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
            if js_number(&a) < js_number(&b) {
                a.concat(&js(" mpaka ")).concat(&b)
            } else {
                m.value(t)
            }
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?![\d])", "gu"), // any tail (#1595)
        |m, t| spell(&m.group(1, t).unwrap(), &m.group(2, t).unwrap()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+),(\d{1,2})(?![\d,])", "gu"),
        |m, t| spell(&m.group(1, t).unwrap(), &m.group(2, t).unwrap()),
    );
    let s = rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" "));
    rewrite(&s, js_re!(r"^[^\S\n]+|[^\S\n]+$", "gu"), &JsString::new())
}
