//! Faroese (fo) text normalization: the five jobs of the full stop (the leap-second time, the thousands group,
//! the decimal dot, the abbreviations, the ordinal period), degrees, signs and ranges.
//! Ported from src/languages/faroese/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::LazyLock;

use crate::core::boundaries::NOT_LETTER_BEFORE;
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// The abbreviation table: `NOT_LETTER_BEFORE` + the TS pattern body, and the expansion.
static ABBREV: LazyLock<Vec<(JsRegex, &'static str)>> = LazyLock::new(|| {
    [
        (r"n\s?\.\s?br\s?\.", "norðurbreidd"),
        (r"v\s?\.\s?l\s?\.", "vesturlongd"),
        (r"f\s?\.\s?Kr\s?\.", "fyri Kristus"),
        (r"e\s?\.\s?Kr\s?\.", "eftir Kristus"),
        (r"e\s?\.\s?m\s?\.", "eftir middag"),
        (r"f\s?\.\s?m\s?\.", "fyri middag"),
        (r"kl\s?\.", "klokkan"),
        (r"mió\s?\.", "milliónir"),
        (r"uml\s?\.", "umleið"),
    ]
    .iter()
    .map(|&(body, word)| {
        (
            JsRegex::new(&format!("{NOT_LETTER_BEFORE}{body}"), "gu").unwrap(),
            word,
        )
    })
    .collect()
});

/// The month names, in the spelling of `tools/corpus/mined/fo.jsonc` (each attested there).
const MONTHS: [&str; 12] = [
    "januar",
    "februar",
    "mars",
    "apríl",
    "mai",
    "juni",
    "juli",
    "august",
    "september",
    "oktober",
    "november",
    "desember",
];

/// The clock after `kl.`/`klokkan`: `NOT_LETTER_BEFORE` inside the lookbehind, as the TS builds it.
static CLOCK_MARKED: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<={NOT_LETTER_BEFORE}(?:kl\.|klokkan)\s?)([01]?\d|2[0-3])[.:]([0-5]\d)(?![\d]|[.,:]\d)"),
        "giu",
    )
    .unwrap()
});

/// `normalizeFaroese(input)`.
pub fn normalize_faroese(input: &JsString) -> JsString {
    let g = |m: &JsMatch, s: &JsString, i: usize| m.group(i, s).unwrap_or_default();
    let mut s = input.clone();

    // The dotted date (#1574), before the time rule and the decimal dot.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?![\d]|[.,]\d)",
            "gu"
        ),
        |m, w| {
            let (day, month) = (js_number(&g(m, w, 1)), js_number(&g(m, w, 2)));
            if (1.0..=31.0).contains(&day) && (1.0..=12.0).contains(&month) {
                js(&format!(
                    "{} {} {}",
                    js_number_to_string(day),
                    MONTHS[month as usize - 1],
                    g(m, w, 3).to_string_lossy()
                ))
            } else {
                m.value(w)
            }
        },
    );

    // The clock after `kl.`/`klokkan` (#1574), before the decimal dot folds it onto the comma.
    s = rewrite_with(&s, &CLOCK_MARKED, |m, w| {
        let (h, mm) = (g(m, w, 1).to_string_lossy(), g(m, w, 2).to_string_lossy());
        let mins = if mm == "00" {
            "null null".to_string()
        } else if let Some(rest) = mm.strip_prefix('0') {
            format!("null {rest}")
        } else {
            mm
        };
        js(&format!("{h} {mins}"))
    });

    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d.,])([01]?\d|2[0-4])\.([0-5]\d)\.([0-5]\d|60)(?![\d.,])",
            "gu"
        ),
        &js("$1 $2 $3"),
    );

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)",
            "gu"
        ),
        |m, w| {
            g(m, w, 1).concat(
                &js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&g(m, w, 2), &JsString::new()),
            )
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:\.\d{3})+)(?!\d)",
            "gu"
        ),
        |m, w| g(m, w, 1).concat(&js_re!(r"\.", "gu").replace(&g(m, w, 2), &JsString::new())),
    );

    s = rewrite(
        &s,
        js_re!(r"(?<!\d)(\d+)\.(\d{1,2})(?!\d)", "gu"),
        &js("$1,$2"),
    );

    for (re, word) in ABBREV.iter() {
        s = rewrite_with(&s, re, |m, full| {
            let rest = full.slice((m.index() + m.value(full).len()) as isize, None);
            if js_re!(r#"^\s*["»)']?\s*$"#, "u").test(&rest) {
                js(&format!("{word}."))
            } else {
                js(word)
            }
        });
    }

    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d{1,4})\.(\s+)(?=\p{Ll})", "gu"),
        &js("$1$2"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d{1,4})\.(\u00a0)(?=\p{L})", "gu"),
        &js("$1$2"),
    );

    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?C(?![\p{L}\p{M}])", "gui"),
        &js("$1 stig Celsius"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?F(?![\p{L}\p{M}])", "gui"),
        &js("$1 stig Fahrenheit"),
    );
    s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 stig "));

    s = rewrite(
        &s,
        js_re!(r"(^|(?<!\d)[\s(])[-−–]\s?(\d)", "gu"),
        &js("$1minus $2"),
    );

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
