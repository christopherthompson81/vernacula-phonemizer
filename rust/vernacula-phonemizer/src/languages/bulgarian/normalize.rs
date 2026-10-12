//! Bulgarian (bg) text normalization: the `N г.` year, era markers, rates, digit grouping, the decimal comma
//! (`цяло и`), the colon clock, №, percent, degrees, squared/cubed and plain units (both scripts), ranges,
//! currency, signed numbers, arithmetic and relational signs, and the ampersand.
//! Ported from src/languages/bulgarian/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::LazyLock;

use super::bulgarian::{DEF, number_to_text};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{escape, rewrite, rewrite_with};
use crate::js_re;

/// `ordinalForms(n)`: every form of the ordinal of `n` the suffix notation can write, masculine first; empty when
/// the cardinal's last word has no ordinal (#1535).
fn ordinal_forms(n: f64) -> Vec<JsString> {
    let text = number_to_text(n);
    let words: Vec<&str> = text.split(' ').collect();
    let Some(masc) = DEF.ordinals.words.get(*words.last().unwrap()) else {
        return Vec::new();
    };
    let head: String = words[..words.len() - 1]
        .iter()
        .map(|w| format!("{w} "))
        .collect();
    let masc = js(masc);
    let stem = if masc.ends_with(&js("ен")) {
        masc.slice(0, Some(-2)).concat(&js("н"))
    } else {
        masc.slice(0, Some(-1))
    };
    let mut forms = vec![masc];
    forms.extend(DEF.ordinals.endings.iter().map(|e| stem.concat(&js(e))));
    forms.into_iter().map(|f| js(&head).concat(&f)).collect()
}

/// `atEnd(rest)`: the consumed abbreviation dot was also the end of the utterance.
fn at_end(rest: &JsString) -> bool {
    js_re!(r#"^[\s»)”"']*$"#, "u").test(rest)
}

static MAGNITUDE_RES: LazyLock<Vec<(JsRegex, u32, JsString)>> = LazyLock::new(|| {
    DEF.magnitude_abbrev
        .iter()
        .map(|(abbr, m)| {
            (
                JsRegex::new(
                    &format!(r"(\d+(?:,\d+)?)\s*{abbr}(\.?)(?![\p{{L}}\p{{M}}])"),
                    "gu",
                )
                .unwrap(),
                m.exponent,
                js(&m.decimal),
            )
        })
        .collect()
});

/// `UNITS`, longest first.
const UNITS: [(&str, &str); 10] = [
    ("км", "километра"),
    ("кг", "килограма"),
    ("см", "сантиметра"),
    ("мм", "милиметра"),
    ("km", "километра"),
    ("kg", "килограма"),
    ("cm", "сантиметра"),
    ("mm", "милиметра"),
    ("м", "метра"),
    ("г", "грама"),
];

static UNIT_RES: LazyLock<Vec<(JsRegex, JsString)>> = LazyLock::new(|| {
    UNITS
        .iter()
        .map(|(abbr, word)| {
            (
                JsRegex::new(&format!(r"(\d)\s*{abbr}(?!\p{{L}})"), "gu").unwrap(),
                js(&format!("$1 {word}")),
            )
        })
        .collect()
});

static SQUARED: LazyLock<[(JsRegex, &str); 4]> = LazyLock::new(|| {
    [
        (
            JsRegex::new(r"(?<!\p{L})(?:км|km)\s*[²2](?!\d)", "giu").unwrap(),
            "квадратни километра",
        ),
        (
            JsRegex::new(r"(?<!\p{L})м\s*[²2](?!\d)", "giu").unwrap(),
            "квадратни метра",
        ),
        (
            JsRegex::new(r"(?<!\p{L})(?:км|km)\s*[³3](?!\d)", "giu").unwrap(),
            "кубични километра",
        ),
        (
            JsRegex::new(r"(?<!\p{L})м\s*[³3](?!\d)", "giu").unwrap(),
            "кубични метра",
        ),
    ]
});

/// `CURRENCY`, in `Object.entries` order (no key is integer-like).
const CURRENCY: [(&str, &str); 4] = [
    ("$", "долара"),
    ("€", "евро"),
    ("£", "паунда"),
    ("¥", "йени"),
];

static CURRENCY_RES: LazyLock<Vec<(JsRegex, JsRegex, JsString)>> = LazyLock::new(|| {
    CURRENCY
        .iter()
        .map(|(sign, word)| {
            let esc = escape(sign);
            (
                JsRegex::new(&format!(r"{esc}\s*(\d+)"), "gu").unwrap(),
                JsRegex::new(&format!(r"(\d+)\s*{esc}"), "gu").unwrap(),
                js(&format!("$1 {word}")),
            )
        })
        .collect()
});

static RELATIONAL: LazyLock<[(JsRegex, &str); 9]> = LazyLock::new(|| {
    let re = |p: &str| JsRegex::new(p, "gu").unwrap();
    [
        (re("±"), " плюс минус "),
        (re("≈"), " приблизително равно на "),
        (re("≤"), " по-малко или равно на "),
        (re("≥"), " по-голямо или равно на "),
        (re("="), " равно на "),
        (re("<"), " по-малко от "),
        (re(">"), " по-голямо от "),
        (re(r"×|(?<=\p{Nd})[ \t]?x[ \t]?(?=\p{Nd})"), " по "),
        (re("÷"), " делено на "),
    ]
});

/// `normalizeBulgarian(input)`.
pub(crate) fn normalize_bulgarian(input: &JsString) -> JsString {
    let mut t = input.clone();

    // 1) the year abbreviation `N г.`, first.
    t = rewrite(&t, js_re!(r"(\d)\s*г\.", "gu"), &js("$1 година"));

    // 2) era markers.
    t = rewrite(
        &t,
        js_re!(r"пр\.\s*н\.\s*е\.", "giu"),
        &js("преди новата ера"),
    );
    t = rewrite(
        &t,
        js_re!(r"сл\.\s*н\.\s*е\.", "giu"),
        &js("след новата ера"),
    );

    // 3) rates, before the unit rule.
    t = rewrite(
        &t,
        js_re!(r"(?<!\p{L})км\s*\/\s*ч(?!\p{L})", "giu"),
        &js("километра в час"),
    );
    t = rewrite(
        &t,
        js_re!(r"(\p{L}+)\s*\/\s*час(?!\p{L})", "giu"),
        &js("$1 в час"),
    );
    t = rewrite(
        &t,
        js_re!(r"(?<!\p{L})м\s*\/\s*(?:сек|с)(?!\p{L})", "giu"),
        &js("метра в секунда"),
    );
    t = rewrite(
        &t,
        js_re!(r"(?<!\p{L})km\s*\/\s*h(?!\p{L})", "giu"),
        &js("километра в час"),
    );
    t = rewrite(
        &t,
        js_re!(r"(?<!\p{L})m\s*\/\s*s(?!\p{L})", "giu"),
        &js("метра в секунда"),
    );

    // 4) space-grouped thousands, to a fixed point.
    loop {
        let prev = t.clone();
        t = rewrite(
            &t,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)[    ](?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
        if t == prev {
            break;
        }
    }

    // 4b) magnitude abbreviations (#1535): an integer multiplied out, a decimal with the plural; the dot put back
    //     only at the utterance end.
    for (re, exponent, decimal) in MAGNITUDE_RES.iter() {
        t = rewrite_with(&t, re, |m, s| {
            let n = m.group(1, s).unwrap();
            let read = if n.includes(&js(",")) {
                n.concat(&js(" ")).concat(decimal)
            } else {
                n.concat(&js(&"0".repeat(*exponent as usize)))
            };
            let dot = m.group(2, s).unwrap_or_default();
            if !dot.is_empty() && at_end(&s.slice(m.end() as isize, None)) {
                read.concat(&js("."))
            } else {
                read
            }
        });
    }

    // 5) the decimal comma: `цяло и`, then the fraction digit by digit (code points).
    t = rewrite_with(&t, js_re!(r"(\d+),(\d+)", "gu"), |m, s| {
        let frac: Vec<JsString> = m.group(2, s).unwrap().code_point_strings();
        m.group(1, s)
            .unwrap()
            .concat(&js(" цяло и "))
            .concat(&JsString::join(&frac, &js(" ")))
    });

    // 6) the colon clock, read as two numbers; `ч.` after it is the word *часа* (#1535).
    t = rewrite_with(
        &t,
        js_re!(r"(\d{1,2}:\d{2})(?!\d)\s*ч(?:(\.)|(?![\p{L}\p{M}]))", "gu"),
        |m, s| {
            let rest = s.slice(m.end() as isize, None);
            let read = m
                .group(1, s)
                .unwrap()
                .concat(&js(" "))
                .concat(&js(&DEF.hour_abbrev));
            if m.group(2, s).is_some() && at_end(&rest) {
                read.concat(&js("."))
            } else if js_re!(r"^[\p{L}\p{M}]", "u").test(&rest) {
                read.concat(&js(" "))
            } else {
                read
            }
        },
    );
    t = rewrite(&t, js_re!(r"(\d{1,2}):(\d{2})(?!\d)", "gu"), &js("$1 $2"));

    // 6c) the ordinal suffix: the form that ends with the written letters, else as written (#1535).
    t = rewrite_with(
        &t,
        js_re!(r"(?<![\d.,])(\d+)\s?-\s?([а-я]{1,3})(?![\p{L}\p{M}])", "gu"),
        |m, s| {
            let suffix = m.group(2, s).unwrap();
            ordinal_forms(js_number(&m.group(1, s).unwrap()))
                .into_iter()
                .find(|f| f.ends_with(&suffix))
                .unwrap_or_else(|| m.value(s))
        },
    );

    // 6b) №.
    t = rewrite(&t, js_re!(r"№\s?(?=\d)", "gu"), &js("номер "));

    // 7) percent.
    t = rewrite(&t, js_re!(r"(\d+)\s*%", "gu"), &js("$1 процента"));

    // 8) degrees, before the units.
    t = rewrite(&t, js_re!("℃", "gu"), &js("°C"));
    t = rewrite(&t, js_re!("℉", "gu"), &js("°F"));
    t = rewrite(
        &t,
        js_re!(r"(\d)\s*°\s*C(?!\p{L})", "giu"),
        &js("$1 градуса по Целзий"),
    );
    t = rewrite(
        &t,
        js_re!(r"(\d)\s*°\s*F(?!\p{L})", "giu"),
        &js("$1 градуса по Фаренхайт"),
    );
    t = rewrite(&t, js_re!(r"(\d)\s*°", "gu"), &js("$1 градуса"));

    // 9) squared / cubed units, before the plain units.
    for (re, word) in SQUARED.iter() {
        t = rewrite(&t, re, &js(word));
    }

    // 10) unit abbreviations after a number.
    for (re, rep) in UNIT_RES.iter() {
        t = rewrite(&t, re, rep);
    }

    // 11) ranges.
    t = rewrite(
        &t,
        js_re!(
            r"(?<![-–—])(\d+)\s*[-–—]\s*(\d+)(?!\d)(?!\s*[-–—]\s*\d)",
            "gu"
        ),
        &js("$1 до $2"),
    );

    // 12) currency, both placements.
    for (before, after, rep) in CURRENCY_RES.iter() {
        t = rewrite(&t, before, rep);
        t = rewrite(&t, after, rep);
    }

    // 13) signed numbers.
    t = rewrite_with(&t, js_re!(r"(?<![\p{L}\d])([-−+])(\d+)", "gu"), |m, s| {
        let sign = if m.group(1, s).unwrap() == js("+") {
            "плюс "
        } else {
            "минус "
        };
        js(sign).concat(&m.group(2, s).unwrap())
    });

    // 14) arithmetic and relational signs.
    t = rewrite(&t, js_re!(r"(\d)\s*\+\s*(\d)", "gu"), &js("$1 плюс $2"));
    for (re, word) in RELATIONAL.iter() {
        t = rewrite(&t, re, &js(word));
    }

    // 15) ampersand.
    t = rewrite(&t, js_re!(r"\s*[&＆]\s*", "gu"), &js(" и "));

    rewrite(&t, js_re!(r"[ \t]{2,}", "gu"), &js(" "))
}
