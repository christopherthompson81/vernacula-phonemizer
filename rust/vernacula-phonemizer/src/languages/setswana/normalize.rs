//! Setswana (tn) text normalization in two passes around the shared symbol tier: before it, entities, the
//! currency-glued magnitude letter, the rand guard and degrees; after it, clocks, digit grouping, ordinal suffixes,
//! ranges (including a noun phrase the tier put between the operands) and decimals.
//! Ported from src/languages/setswana/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const DEGREE: &str = "dikirii";
const BELOW_ZERO: &str = "kwa tlase ga lefela";
const POINT_WORD: &str = "ntlha";
const MAGNITUDE_WORD: &str = "billion|million|bilione|milione|dibilione|dimilione";
const AM: &str = "mo mosong";
const PM: &str = "thapama";
const DAYPART: &str = "mo mosong|thapama|maitseboa|mosong|bosigo";
const TZ: &str = "UTC|GMT|CAT|SAST|BST|CET|EST";
const HOURS: &str = "diura di le";
const MINUTES: &str = "metsotso e le";
const RANGE: &str = "go ya go";

fn scale(sc: &JsString) -> &'static str {
    match sc.to_string_lossy().as_str() {
        "C" => "Celcius",
        "F" => "Fahrenheit",
        _ => "undefined",
    }
}

fn magnitude_suffix(suf: &JsString) -> &'static str {
    match suf.to_string_lossy().as_str() {
        "bn" => "dibilione",
        "m" | "M" => "dimilione",
        _ => "undefined",
    }
}

/// `spell(int, frac)`: the integer, the point word, then each fractional digit.
fn spell(int: &JsString, frac: &JsString) -> JsString {
    let digits = JsString::join(&frac.code_point_strings(), &js(" "));
    int.concat(&js(&format!(" {POINT_WORD} "))).concat(&digits)
}

static RAND: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            "(?<![\\p{{L}}\\p{{M}}\\d])R[ \u{a0}]?(\\d[\\d \u{a0}.,]*\\d|\\d)(?![\\p{{L}}\\p{{M}}])([ \u{a0}]*(?:{MAGNITUDE_WORD})(?![\\p{{L}}\\p{{M}}]))?"
        ),
        "gu",
    )
    .unwrap()
});

/// `normalizeSetswanaPre(input)`: the pass before the symbol tier.
pub fn normalize_setswana_pre(input: &JsString) -> JsString {
    let mut s = input.clone();

    s = rewrite(&s, js_re!(r"&nbsp;", "giu"), &js(" "));
    s = rewrite(&s, js_re!(r"&#x20;", "giu"), &js(" "));
    s = rewrite(&s, js_re!(r"&#x5B;", "giu"), &js("["));
    s = rewrite(&s, js_re!(r"&#x5D;", "giu"), &js("]"));
    s = rewrite(&s, js_re!(r"&amp;", "giu"), &js("&"));

    s = rewrite_with(
        &s,
        js_re!(
            r"((?:US[ \u00a0]?\$|\$|£|P|R)[ \u00a0]?\d[\d \u00a0.,]*)(bn|M|m)(?![\p{L}\p{M}\d])",
            "gu"
        ),
        |m, s| {
            let suf = magnitude_suffix(&m.group(2, s).unwrap());
            m.group(1, s).unwrap().concat(&js(&format!(" {suf}")))
        },
    );

    s = rewrite_with(&s, &RAND, |m, s| {
        let n = m.group(1, s).unwrap();
        let mag = m.group(2, s);
        let scaled = mag.as_ref().is_some_and(|g| !g.is_empty());
        if !scaled && !js_re!(r"[., \u00a0]", "u").test(&n) {
            return m.value(s);
        }
        js("diranta di le ")
            .concat(&n)
            .concat(&mag.unwrap_or_default())
    });

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d])([-−–]?)(\d+(?:[.,]\d+)?)[ \u00a0]?°[ \u00a0]?([CF])(?![\p{L}\p{M}])",
            "gui"
        ),
        |m, s| {
            let sign = m.group(1, s).unwrap();
            let n = m.group(2, s).unwrap();
            let sc = scale(&m.group(3, s).unwrap().to_upper_case());
            let head = if sign.is_empty() {
                format!("{DEGREE} tsa {sc} di le ")
            } else {
                format!("{DEGREE} tsa {sc} tse di {BELOW_ZERO} di le ")
            };
            js(&head).concat(&n)
        },
    );
    rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?[°º](?![\p{L}\p{M}])",
            "gu"
        ),
        &js(&format!("{DEGREE} di le $1")),
    )
}

static CLOCK: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            "(?<![\\d:.,])([01]?\\d|2[0-3]):[ \u{a0}]?([0-5]\\d)(?![:.\\d])(?:[ \u{a0}]*(?:([AaPp])\\.?[Mm]\\.?|({TZ})(?![\\p{{L}}\\p{{M}}])|({DAYPART})(?![\\p{{L}}\\p{{M}}])))"
        ),
        "gu",
    )
    .unwrap()
});

/// `normalizeSetswanaPost(input)`: the pass after the symbol tier.
pub fn normalize_setswana_post(input: &JsString) -> JsString {
    let mut s = input.clone();

    s = rewrite_with(&s, &CLOCK, |m, s| {
        let hv = js_number(&m.group(1, s).unwrap());
        let mv = js_number(&m.group(2, s).unwrap());
        if hv > 23.0 || mv > 59.0 {
            return m.value(s);
        }
        let (h, mi) = (js_number_to_string(hv), js_number_to_string(mv));
        let body = if mv == 0.0 {
            format!("{HOURS} {h}")
        } else {
            format!("{HOURS} {h} {} {MINUTES} {mi}", MANIFEST.numbers.and)
        };
        if let Some(ap) = m.group(3, s) {
            let part = if ap.to_lower_case() == "p" { PM } else { AM };
            return js(&format!("{body} {part}"));
        }
        let tail = m.group(4, s).or_else(|| m.group(5, s)).unwrap();
        js(&format!("{body} ")).concat(&tail)
    });

    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2})(?:,\d{3})+(?![\d]|[.,]\d)", "gu"),
        |m, s| js_re!(",", "gu").replace(&m.value(s), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})(?:\.\d{3})+(?![\d]|[.,]\d)",
            "gu"
        ),
        |m, s| js_re!(r"\.", "gu").replace(&m.value(s), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})(?:[ \u00a0\u202f\u2009]\d{3})+(?![\d])",
            "gu"
        ),
        |m, s| js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&m.value(s), &JsString::new()),
    );

    s = rewrite(
        &s,
        js_re!(r"(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])", "giu"),
        &js("$1"),
    );

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![-\d.,\p{L}\p{M}])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-\d\p{L}\p{M}]|[.,]\d)",
            "gu"
        ),
        |m, s| {
            let (a, b) = (m.group(1, s).unwrap(), m.group(2, s).unwrap());
            if js_number(&a) < js_number(&b) {
                a.concat(&js(&format!(" {RANGE} "))).concat(&b)
            } else {
                m.value(s)
            }
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![-\d.,\p{L}\p{M}])(\d+)[ \u00a0]?[-–—][ \u00a0]?((?:\p{L}+[ \u00a0])?\p{L}+[ \u00a0]di[ \u00a0]le[ \u00a0])(\d+)(?![-\d\p{L}\p{M}]|[.,]\d)",
            "gu"
        ),
        |m, s| {
            let (a, noun, b) = (
                m.group(1, s).unwrap(),
                m.group(2, s).unwrap(),
                m.group(3, s).unwrap(),
            );
            if js_number(&a) < js_number(&b) {
                noun.concat(&a)
                    .concat(&js(&format!(" {RANGE} ")))
                    .concat(&b)
            } else {
                m.value(s)
            }
        },
    );

    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d{1,2})(?![\d])", "gu"),
        |m, s| spell(&m.group(1, s).unwrap(), &m.group(2, s).unwrap()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+),(\d{1,2})(?![\d,])", "gu"),
        |m, s| spell(&m.group(1, s).unwrap(), &m.group(2, s).unwrap()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(0)[.,](\d{3,})(?![\d])", "gu"),
        |m, s| spell(&m.group(1, s).unwrap(), &m.group(2, s).unwrap()),
    );

    rewrite(
        &rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" ")),
        js_re!(r"^[^\S\n]+|[^\S\n]+$", "gu"),
        &JsString::new(),
    )
}
