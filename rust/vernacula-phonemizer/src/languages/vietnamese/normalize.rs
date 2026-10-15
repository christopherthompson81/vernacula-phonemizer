//! Vietnamese text normalization: the ordered pre-tokenizer pass that rewrites markup, clocks, unit rates,
//! degrees, grouped and decimal numbers, ranges, fractions, signs, era abbreviations and initialisms into
//! Vietnamese syllables. Ported from src/languages/vietnamese/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::boundaries::{NOT_LETTER_AFTER, NOT_LETTER_BEFORE};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `VI_ABBREV`, longest key first. Generated from normalize.ts's array literal.
const VI_ABBREV: [(&str, &str); 3] = [
    ("CNTT", "công nghệ thông tin"),
    ("TCN", "trước Công nguyên"),
    ("SCN", "sau Công nguyên"),
];

fn g(m: &JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `String(Number(s))`.
fn num_str(s: &JsString) -> String {
    js_number_to_string(js_number(s))
}

/// `numVal(s)`: the value of a possibly grouped / comma-decimal numeral.
fn num_val(s: &JsString) -> f64 {
    let t = js_re!(r"\.", "gu").replace(s, &JsString::new());
    js_number(&js_re!(r",", "u").replace(&t, &js(".")))
}

/// `clock(hh, mm)`.
fn clock(hh: &JsString, mm: &JsString) -> JsString {
    let tail = if js_number(mm) == 0.0 {
        String::new()
    } else {
        format!(" {}", num_str(mm))
    };
    js(&format!("{} giờ{tail}", num_str(hh)))
}

struct Built {
    sports: JsRegex,
    clock: JsRegex,
    kmh: JsRegex,
    kph: JsRegex,
    mph: JsRegex,
    abbrev: Vec<(JsRegex, JsString)>,
}

/// The patterns normalize.ts builds with `new RegExp`, built once.
static BUILT: LazyLock<Built> = LazyLock::new(|| {
    let re = |p: String, f: &str| JsRegex::new(&p, f).unwrap_or_else(|e| panic!("{p}: {e}"));
    let a = NOT_LETTER_AFTER;
    Built {
        sports: re(
            format!(r"(?<!\d)(\d{{1,2}}):([0-5]\d),(\d{{1,2}})(?!\d)(\s+phút{a})?"),
            "gu",
        ),
        clock: re(
            format!(r"(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?!,\d)(\s+giờ{a})?"),
            "gu",
        ),
        kmh: re(format!(r"(?<=\d\s?)km/h{a}"), "giu"),
        kph: re(format!(r"(?<=\d\s?)kph{a}"), "giu"),
        mph: re(format!(r"(?<=\d\s?)mph{a}"), "giu"),
        abbrev: VI_ABBREV
            .iter()
            .map(|&(from, to)| (re(format!("{NOT_LETTER_BEFORE}{from}{a}"), "gu"), js(to)))
            .collect(),
    }
});

/// `normalizeVietnamese(input)`. The steps are order-dependent, as in the TS.
pub fn normalize_vietnamese(input: &JsString) -> JsString {
    let bt = &*BUILT;
    let mut s = input.clone();

    // 1. HTML superscript markup.
    s = rewrite(&s, js_re!(r"<sup>\s*2\s*<\/sup>", "giu"), &js("²"));
    s = rewrite(&s, js_re!(r"<[^>]*>", "gu"), &JsString::new());

    // 3. Clock ranges, then sports times, then clocks.
    s = rewrite(
        &s,
        js_re!(
            r"((?<!\d)\d{1,2}:[0-5]\d)\s*[-–—]\s*(\d{1,2}:[0-5]\d(?!\d))",
            "gu"
        ),
        &js("$1 đến $2"),
    );
    s = rewrite_with(&s, &bt.sports, |m, t| {
        js(&format!(
            "{} phút {} giây {}",
            num_str(&g(m, t, 1)),
            num_str(&g(m, t, 2)),
            num_str(&g(m, t, 3))
        ))
    });
    s = rewrite_with(&s, &bt.clock, |m, t| clock(&g(m, t, 1), &g(m, t, 2)));

    // 4. Unit-per-hour abbreviations.
    s = rewrite(&s, &bt.kmh, &js("km/giờ"));
    s = rewrite(&s, &bt.kph, &js("km/giờ"));
    s = rewrite(&s, &bt.mph, &js("dặm/giờ"));

    // 5. Degree sign.
    s = rewrite(
        &s,
        js_re!(r"\s*°\s*C(?![\p{L}\p{M}])", "gui"),
        &js(" độ xê"),
    );
    s = rewrite(
        &s,
        js_re!(r"\s*°\s*F(?![\p{L}\p{M}])", "gui"),
        &js(" độ ép"),
    );
    s = rewrite(&s, js_re!(r"\s*°", "gu"), &js(" độ"));

    // 6. De-group thousands (dot, then comma).
    s = rewrite_with(
        &s,
        js_re!(r"(?<!\d)(?<!\d[.,])[1-9]\d{0,2}(?:\.\d{3})+(?!\d)", "gu"),
        |m, t| js_re!(r"\.", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<!\d)(?<!\d[.,])[1-9]\d{0,2}(?:,\d{3})+(?!\d)", "gu"),
        |m, t| js_re!(r",", "gu").replace(&m.value(t), &JsString::new()),
    );

    // 7. Dash ranges → "đến", only when ascending.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d[\d.,]*)\s*[-–—]\s*(\d[\d.,]*)(?![\d.,])",
            "gu"
        ),
        |m, t| {
            let (a, b) = (g(m, t, 1), g(m, t, 2));
            if num_val(&b) > num_val(&a) {
                a.concat(&js(" đến ")).concat(&b)
            } else {
                m.value(t)
            }
        },
    );

    // 8. Decimal comma, 9. decimal / dotted numerals, 10. fractions, 11. multiplication.
    s = rewrite(&s, js_re!(r"(?<=\d),(?=\d)", "gu"), &js(" phẩy "));
    s = rewrite(&s, js_re!(r"(?<=\d)\.(?=\d)", "gu"), &js(" chấm "));
    s = rewrite(
        &s,
        js_re!(r"(?<![\d/])(\d{1,2})\/(\d{1,2})(?![\d/])", "gu"),
        &js("$1 phần $2"),
    );
    s = rewrite(&s, js_re!(r"(?<=\d)\s*[x×]\s*(?=\d)", "giu"), &js(" nhân "));

    // 11b. The plus sign.
    s = rewrite(&s, js_re!(r"(\S)\+\s?(?=\d)", "gu"), &js("$1 cộng "));
    s = rewrite(&s, js_re!(r"(^|\s)\+\s?(?=\d)", "gu"), &js("$1cộng "));

    // 11b2. ± and the minus, refused after a digit (a range).
    s = rewrite(&s, js_re!(r"±", "gu"), &js(" cộng trừ "));
    s = rewrite_with(&s, js_re!(r"(^|[\s(])[-−–](?=\d)", "gu"), |m, t| {
        let before = t.slice(0, Some(m.index() as isize));
        if js_re!(r"\d\s*$", "u").test(&before) {
            m.value(t)
        } else {
            g(m, t, 1).concat(&js("âm "))
        }
    });

    // 11c. Relational and division signs, and the ampersand.
    s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" bằng "));
    s = rewrite(&s, js_re!(r"\s?<\s?", "gu"), &js(" nhỏ hơn "));
    s = rewrite(&s, js_re!(r"\s?>\s?", "gu"), &js(" lớn hơn "));
    s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" chia cho "));
    s = rewrite(&s, js_re!(r"\s?&\s?", "gu"), &js(" và "));

    // 12. Vietnamese abbreviations BEFORE the initialisms (TCN/SCN are all-caps runs).
    for (re, to) in &bt.abbrev {
        s = rewrite(&s, re, to);
    }
    // 12b. All-caps runs → letter names, unless the whole text is caps.
    if js_re!(r"\p{Ll}", "u").test(&s) || !js_re!(r"\s", "u").test(&s.trim()) {
        s = rewrite_with(
            &s,
            js_re!(r"(?<![\p{L}\p{M}\d])[A-Z]{2,6}(?![\p{L}\p{M}\d])", "gu"),
            |m, t| {
                let names: Vec<JsString> = m
                    .value(t)
                    .code_point_strings()
                    .iter()
                    .map(|c| {
                        MANIFEST
                            .letter_names
                            .get(&c.to_string_lossy())
                            .map(|n| js(n))
                            .unwrap_or_else(|| c.clone())
                    })
                    .collect();
                JsString::join(&names, &js(" "))
            },
        );
    }

    s
}
