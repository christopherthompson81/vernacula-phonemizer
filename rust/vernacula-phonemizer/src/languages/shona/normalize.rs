//! Shona (sn) text normalization in two passes around the shared symbol tier: before it, entities, the glued
//! dollar sign, dotted capitals, grouping, ordinal suffixes and ranges; after it, decimal metres, hours, degrees,
//! the class-6 concord on a counted noun, and decimals.
//! Ported from src/languages/shona/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::LazyLock;

use super::manifest::MANIFEST;
use super::numbers::{number_to_words, with_class6_concord};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const RANGE: &str = "kusvika";
const DEGREE: &str = "madhigiriyi";
const SQUARED: &str = "maskweya";
const POINT_WORD: &str = "poyindi";
const COMMA_WORD: &str = "koma";
const MA_NOUNS: &str = "makiromita|masendimita|makirogiramu|mamirimita|mamita|matani|maawa|masekondi|madhora|maskweya|madhigiriyi";
/// `DEG`: an ordinary string literal in the TS, so its NBSP is a literal character in the pattern.
const DEG: &str = "(?:[ \u{a0}]?°|[ \u{a0}]o)";

fn scale(c: &JsString) -> &'static str {
    match c.to_string_lossy().as_str() {
        "C" => "Celsius",
        "F" => "Fahrenheit",
        _ => "undefined",
    }
}

/// `spell(int, sep, frac)`: the integer, the separator word, then each fractional digit.
fn spell(int: &JsString, sep: &str, frac: &JsString) -> JsString {
    let digits = JsString::join(&frac.code_point_strings(), &js(" "));
    int.concat(&js(&format!(" {sep} "))).concat(&digits)
}

fn said_near(full: &JsString, offset: usize, end: usize, word: &str) -> bool {
    full.slice(
        offset.saturating_sub(45) as isize,
        Some((end + 45) as isize),
    )
    .includes(&js(word))
}

fn degree_body(n: &JsString, offset: usize, end: usize, full: &JsString) -> JsString {
    if said_near(full, offset, end, DEGREE) {
        n.clone()
    } else {
        js(&format!("{DEGREE} ")).concat(n)
    }
}

fn tidy(s: &JsString) -> JsString {
    rewrite(
        &rewrite(s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" ")),
        js_re!(r"^[^\S\n]+|[^\S\n]+$", "gu"),
        &JsString::new(),
    )
}

/// `normalizeShonaPre(input)`: the pass before the symbol tier.
pub fn normalize_shona_pre(input: &JsString) -> JsString {
    let mut s = input.clone();

    s = rewrite(
        &rewrite(&s, js_re!(r"&amp;", "giu"), &js("&")),
        js_re!(r"&nbsp;", "giu"),
        &js(" "),
    );

    s = rewrite(&s, js_re!(r"(?<=\p{Ll})\$(?=\d)", "gu"), &js(" $"));

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(?:\p{Lu}\.[ \u00a0]?){2,}(?:\p{Lu}(?![\p{L}\p{M}]))?",
            "gu"
        ),
        |m, full| {
            let run = m.value(full);
            let letters = js_re!(r"[. \u00a0]", "gu").replace(&run, &JsString::new());
            let rest = full.slice(m.end() as isize, None);
            if js_re!(r"^[\p{L}\p{M}]", "u").test(&rest) {
                return letters.concat(&js(" "));
            }
            let tail = if js_re!(r"[ \u00a0]$", "u").test(&run) {
                " "
            } else {
                ""
            };
            if rest.is_empty() || js_re!(r"^[ \u00a0]+\p{Lu}", "u").test(&rest) {
                letters.concat(&js(&format!(".{tail}")))
            } else {
                letters.concat(&js(tail))
            }
        },
    );

    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2})(?:,\d{3})+(?!\d|[.,]\d)", "gu"),
        |m, s| js_re!(",", "gu").replace(&m.value(s), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})(?:[ \u00a0\u202f\u2009]\d{3})+(?!\d)",
            "gu"
        ),
        |m, s| js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&m.value(s), &JsString::new()),
    );

    s = rewrite(
        &s,
        js_re!(r"(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])", "giu"),
        &js("$1"),
    );

    // 5b — a `bn` magnitude suffix → the billion word, with or without a currency sign (#1593)
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d.,])(\d[\d.,]*)bn(?![\p{L}\p{M}\d])",
            "gu"
        ),
        |m, s| {
            m.group(1, s)
                .unwrap()
                .concat(&js(&format!(" {}", MANIFEST.numbers.billion)))
        },
    );

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![-\d.,\p{L}\p{M}])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-\d\p{L}\p{M}])",
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

    tidy(&s)
}

static DEGREE_SCALE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!("(?<![\\d.,])(\\d+(?:[.,]\\d+)?){DEG}[ \u{a0}]?([CF])(?![\\p{{L}}\\p{{M}}])"),
        "gui",
    )
    .unwrap()
});
static DEGREE_BARE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!("(?<![\\d.,])(\\d+(?:[.,]\\d+)?){DEG}(?![\\p{{L}}\\p{{M}}])"),
        "gu",
    )
    .unwrap()
});
static CONCORD: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!("((?:{MA_NOUNS})[ \u{a0}])(\\d+)(?![.,]?\\d)"),
        "gu",
    )
    .unwrap()
});

/// `normalizeShonaPost(input)`: the pass after the symbol tier.
pub fn normalize_shona_post(input: &JsString) -> JsString {
    let mut s = input.clone();

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+[.,]\d+)[ \u00a0]?m([²³])?(?![\p{L}\p{M}'’ʼ\d])",
            "gu"
        ),
        |m, s| {
            let n = m.group(1, s).unwrap();
            if m.group(2, s).is_some_and(|e| e == "²") {
                js(&format!("{SQUARED} mamita ")).concat(&n)
            } else {
                js("mamita ").concat(&n)
            }
        },
    );

    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d.,:\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?hrs?(?![\p{L}\p{M}\d])",
            "gu"
        ),
        &js("maawa $1"),
    );

    s = rewrite_with(&s, &DEGREE_SCALE, |m, s| {
        let body = degree_body(&m.group(1, s).unwrap(), m.index(), m.end(), s);
        let sc = scale(&m.group(2, s).unwrap().to_upper_case());
        body.concat(&js(&format!(" {sc}")))
    });
    s = rewrite_with(&s, &DEGREE_BARE, |m, s| {
        degree_body(&m.group(1, s).unwrap(), m.index(), m.end(), s)
    });

    s = rewrite_with(&s, &CONCORD, |m, s| {
        let n = js_number(&m.group(2, s).unwrap());
        if !is_safe_integer(n) || n >= 1e6 {
            return m.value(s);
        }
        m.group(1, s)
            .unwrap()
            .concat(&with_class6_concord(&number_to_words(n, None)))
    });

    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?![\d.,])", "gu"),
        |m, s| spell(&m.group(1, s).unwrap(), POINT_WORD, &m.group(2, s).unwrap()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+),(\d{1,2})(?![\d,])", "gu"),
        |m, s| spell(&m.group(1, s).unwrap(), COMMA_WORD, &m.group(2, s).unwrap()),
    );

    tidy(&s)
}
