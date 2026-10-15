//! Occitan (oc) text normalization: digit grouping, the dot decimal as a comma, era markers, clocks, a leading
//! minus, degrees (not inside an `in-4°` book format) and ranges rewritten for the tokenizer.
//! Ported from src/languages/occitan/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::LazyLock;

use crate::core::boundaries::{NOT_LETTER_AFTER, NOT_LETTER_BEFORE};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

static BEFORE_CHRIST: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"{NOT_LETTER_BEFORE}a[bv]\.?\s?C\.?{NOT_LETTER_AFTER}"),
        "gu",
    )
    .unwrap()
});
static AFTER_CHRIST: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"{NOT_LETTER_BEFORE}ap\.?\s?C\.?{NOT_LETTER_AFTER}"),
        "gu",
    )
    .unwrap()
});

fn g(m: &JsMatch, i: usize, s: &JsString) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `normalizeOccitan(input)`. Steps are ORDER-DEPENDENT; see the TS for each one's coupling.
pub fn normalize_occitan(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1) digit grouping (the spaces), then a dot decimal becomes the comma the tokenizer reads
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)",
            "gu"
        ),
        |m, t| {
            g(m, 1, t).concat(
                &js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&g(m, 2, t), &JsString::new()),
            )
        },
    );
    s = rewrite(&s, js_re!(r"(?<!\d)(\d+)\.(\d+)(?!\d)", "gu"), &js("$1,$2"));

    // 2) era markers
    s = rewrite(&s, &BEFORE_CHRIST, &js("abans Crist"));
    s = rewrite(&s, &AFTER_CHRIST, &js("après Crist"));

    // 3) clocks
    s = rewrite(
        &s,
        js_re!(r"(?<![\d:.,])([01]?\d|2[0-4]):([0-5]\d)(?![\d:.,])", "gu"),
        &js("$1 $2"),
    );

    // 4) a leading minus
    s = rewrite(
        &s,
        js_re!(r"(^|(?<!\d)[\s(])[-−–]\s?(\d)", "gu"),
        &js("$1mens $2"),
    );

    // 5) degrees: a scale, minutes, bare
    s = rewrite_with(
        &s,
        js_re!(r"(?<!in-\d{0,3})(\d)\s?°\s?([CF])(?![\p{L}\p{M}])", "gui"),
        |m, t| {
            let scale = if g(m, 2, t).to_upper_case() == "C" {
                "Celsius"
            } else {
                "Fahrenheit"
            };
            g(m, 1, t).concat(&js(&format!(" graus {scale}")))
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(?<!in-\d{0,3})(\d)\s?°\s?(\d+)\s?[′']", "gu"),
        &js("$1 graus $2 minutas "),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<!in-\d{0,3})(\d)\s?°", "gu"),
        &js("$1 graus "),
    );

    // 6) ranges: a dash, then a hyphen between two numbers
    s = rewrite(&s, js_re!(r"(\d)\s?[–—]\s?(?=\d)", "gu"), &js("$1, "));
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d.,\-\/])(\d+)\s?-\s?(\d+)(?![\d\/])(?!\s?-\s?\d)",
            "gu"
        ),
        &js("$1, $2"),
    );

    rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" "))
}
