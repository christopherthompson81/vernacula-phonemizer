//! Aragonese (an) text normalization: digit grouping, the dot decimal as a comma, era markers, numero/lumero, the
//! habitant and million-years abbreviations, clocks, a leading minus, degrees and ranges rewritten for the tokenizer.
//! Ported from src/languages/aragonese/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::LazyLock;

use crate::core::boundaries::NOT_LETTER_BEFORE;
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const DEGREE_TAIL: &str = concat!(
    r"(?:\s?[CF]|\s?[NSEU](?![\p{L}\p{M}])|\s?\d+\s?[′']",
    r"|\s*(?:de|y|en)(?![\p{L}\p{M}])|\s*[.,;:)(»]|\s*$)"
);

static ERAS: LazyLock<[(JsRegex, &'static str); 2]> = LazyLock::new(|| {
    [
        (
            JsRegex::new(&format!(r"{NOT_LETTER_BEFORE}a\s?\.\s?C\s?\."), "gu").unwrap(),
            "antes de Cristo",
        ),
        (
            JsRegex::new(&format!(r"{NOT_LETTER_BEFORE}d\s?\.\s?C\s?\."), "gu").unwrap(),
            "dimpués de Cristo",
        ),
    ]
});
static NUMERO: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"{NOT_LETTER_BEFORE}n\s?[º°]\s?\.?(?=\s*\d)"),
        "gu",
    )
    .unwrap()
});
static LUMERO: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!(r"{NOT_LETTER_BEFORE}lum\s?\.(?=\s*\d)"), "gu").unwrap()
});
static MILLION_YEARS: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"(\d)\s?m\s?\.\s?a\s?\.", "gu").unwrap());
static DEGREE_BEFORE_TAIL: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"(\d)\s?[°º](?={DEGREE_TAIL})"), "gu").unwrap());

fn g(m: &JsMatch, i: usize, s: &JsString) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `normalizeAragonese(input)`. Steps are ORDER-DEPENDENT; see the TS for each one's coupling.
pub fn normalize_aragonese(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1) digit grouping (the spaces, then the dot), then a dot decimal becomes the comma the tokenizer reads
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
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:\.\d{3})+)(?!\d)",
            "gu"
        ),
        |m, t| g(m, 1, t).concat(&js_re!(r"\.", "gu").replace(&g(m, 2, t), &JsString::new())),
    );
    s = rewrite(&s, js_re!(r"(?<!\d)(\d+)\.(\d+)(?!\d)", "gu"), &js("$1,$2"));

    // 2) era markers, the full stop kept at the end of the text
    for (re, word) in ERAS.iter() {
        s = rewrite_with(&s, re, |m, full| {
            let rest = full.slice(m.end() as isize, None);
            if js_re!(r#"^\s*["»)']?\s*$"#, "u").test(&rest) {
                js(word).concat(&js("."))
            } else {
                js(word)
            }
        });
    }

    // 3) abbreviations: numero, lumero, hab., m.a.
    s = rewrite(&s, &NUMERO, &js("numero "));
    s = rewrite(&s, &LUMERO, &js("lumero"));
    s = rewrite(&s, js_re!(r"(\d)\s?hab\s?\.\s?(?=\/)", "gu"), &js("$1 hab"));
    s = rewrite(&s, &MILLION_YEARS, &js("$1 millons d'anyadas"));

    // 4) clocks
    s = rewrite(
        &s,
        js_re!(r"(?<![\d:.,])([01]?\d|2[0-4]):([0-5]\d)(?![\d:.,])", "gu"),
        &js("$1 $2"),
    );

    // 5) a leading minus
    s = rewrite(
        &s,
        js_re!(r"(^|(?<!\d)[\s(])[-−–]\s?(\d(?!\d*:))", "gu"),
        &js("$1menos $2"),
    );

    // 6) degrees: a scale, minutes, a compass point, or a licensed tail
    s = rewrite_with(
        &s,
        js_re!(r"(\d)\s?[°º]\s?([CF])(?![\p{L}\p{M}])", "gui"),
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
        js_re!(r"(\d)\s?[°º]\s?(\d+)\s?[′']", "gu"),
        &js("$1 graus $2 menutos "),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d)\s?[°º]\s?([NSEU])(?![\p{L}\p{M}])", "gu"),
        |m, t| {
            let dir = match g(m, 2, t).to_string_lossy().as_str() {
                "N" => "norte",
                "S" => "sud",
                "E" => "este",
                _ => "ueste",
            };
            g(m, 1, t).concat(&js(&format!(" graus {dir}")))
        },
    );
    s = rewrite(&s, &DEGREE_BEFORE_TAIL, &js("$1 graus "));

    // 7) ranges: a dash, then a hyphen between two numbers
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
