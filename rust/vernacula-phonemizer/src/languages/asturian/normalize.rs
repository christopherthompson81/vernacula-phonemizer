//! Asturian (ast) text normalization: digit grouping, the dot decimal as a comma, era markers, numeric and Roman
//! month dates, clocks, degrees, a leading minus and ranges rewritten for the tokenizer.
//! Ported from src/languages/asturian/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::LazyLock;

use crate::core::boundaries::{NOT_LETTER_AFTER, NOT_LETTER_BEFORE};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const MONTHS: [&str; 13] = [
    "",
    "xineru",
    "febreru",
    "marzu",
    "abril",
    "mayu",
    "xunu",
    "xunetu",
    "agostu",
    "setiembre",
    "ochobre",
    "payares",
    "avientu",
];

/// `ROMAN_MONTH`, in the TS object's order.
const ROMAN_MONTH: [(&str, usize); 12] = [
    ("I", 1),
    ("II", 2),
    ("III", 3),
    ("IV", 4),
    ("V", 5),
    ("VI", 6),
    ("VII", 7),
    ("VIII", 8),
    ("IX", 9),
    ("X", 10),
    ("XI", 11),
    ("XII", 12),
];

const DEGREE_TAIL: &str =
    r"(?:\s?[CF]|\s?[NSEW]|\s?\d+\s?[′']|\s*(?:de|y|col|na)(?![\p{L}\p{M}])|\s*[.,;:)»]|\s*$)";

static ERAS: LazyLock<[(JsRegex, &'static str); 2]> = LazyLock::new(|| {
    [
        (
            JsRegex::new(&format!(r"{NOT_LETTER_BEFORE}e\s?\.\s?C\s?\."), "gu").unwrap(),
            "enantes de Cristu",
        ),
        (
            JsRegex::new(&format!(r"{NOT_LETTER_BEFORE}d\s?\.\s?C\s?\."), "gu").unwrap(),
            "dempués de Cristu",
        ),
    ]
});
static ROMAN_DATE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"{NOT_LETTER_BEFORE}(\d{{1,2}})\s?-\s?(I{{1,3}}|IV|V|VI{{1,3}}|IX|XI{{0,2}})\s?-\s?(\d{{3,4}}){NOT_LETTER_AFTER}"
        ),
        "gu",
    )
    .unwrap()
});
static NUMERIC_DATE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"{NOT_LETTER_BEFORE}(\d{{1,2}})\s?-\s?(\d{{1,2}})\s?-\s?(\d{{3,4}}){NOT_LETTER_AFTER}"
        ),
        "gu",
    )
    .unwrap()
});
static DEGREE_BEFORE_TAIL: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"(\d)\s?[°º](?={DEGREE_TAIL})"), "gu").unwrap());

fn g(m: &JsMatch, i: usize, s: &JsString) -> JsString {
    m.group(i, s).unwrap_or_default()
}

fn date(day: &JsString, month: usize, year: &JsString) -> JsString {
    day.concat(&js(&format!(" de {} de ", MONTHS[month])))
        .concat(year)
}

/// `normalizeAsturian(input)`. Steps are ORDER-DEPENDENT; see the TS for each one's coupling.
pub fn normalize_asturian(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1) digit grouping: the spaces, then the dot
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

    // 2) a dot decimal becomes the comma the tokenizer reads
    s = rewrite(&s, js_re!(r"(?<!\d)(\d+)\.(\d+)(?!\d)", "gu"), &js("$1,$2"));

    // 3) era markers, the full stop kept at the end of the text
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

    // 4) dates with a Roman or a numeric month
    s = rewrite_with(&s, &ROMAN_DATE, |m, t| {
        let roman = g(m, 2, t);
        match ROMAN_MONTH.iter().find(|(k, _)| roman == *k) {
            None => m.value(t),
            Some((_, mon)) => date(&g(m, 1, t), *mon, &g(m, 3, t)),
        }
    });
    s = rewrite_with(&s, &NUMERIC_DATE, |m, t| {
        let mon = js_number(&g(m, 2, t));
        if (1.0..=12.0).contains(&mon) {
            date(&g(m, 1, t), mon as usize, &g(m, 3, t))
        } else {
            m.value(t)
        }
    });

    // 5) clocks
    s = rewrite(
        &s,
        js_re!(r"(?<![\d:.,])([01]?\d|2[0-4]):([0-5]\d)(?![\d:.,])", "gu"),
        &js("$1 $2"),
    );

    // 6) degrees: a scale, minutes, or a licensed tail
    s = rewrite_with(
        &s,
        js_re!(r"(\d)\s?[°º]\s?([CF])(?![\p{L}\p{M}])", "gui"),
        |m, t| {
            let scale = if g(m, 2, t).to_upper_case() == "C" {
                "Celsius"
            } else {
                "Fahrenheit"
            };
            g(m, 1, t).concat(&js(&format!(" graos {scale}")))
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[°º]\s?(\d+)\s?[′']", "gu"),
        &js("$1 graos $2 minutos "),
    );
    s = rewrite(&s, &DEGREE_BEFORE_TAIL, &js("$1 graos "));

    // 7) a leading minus
    s = rewrite(
        &s,
        js_re!(r"(^|(?<!\d)[\s(])[-−–]\s?(\d)", "gu"),
        &js("$1menos $2"),
    );

    // 8) ranges: a dash, then a hyphen between two numbers
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
