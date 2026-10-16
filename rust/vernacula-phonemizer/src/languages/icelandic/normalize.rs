//! Icelandic (is) text normalization: dotted abbreviations, period-grouped thousands, the decimal comma, the
//! colon clock, percent and degrees, squared/cubed and plain units, the ordinal whose form the following word
//! selects, ranges, currency, signs, relational signs and the ampersand.
//! Ported from src/languages/icelandic/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{escape, rewrite, rewrite_with};
use crate::js_re;

/// `UNITS`: each pattern's SOURCE (the loop rebuilds it with `gu`, so the literal's `i` is dropped) and word.
const UNITS: [(&str, &str); 5] = [
    ("mph", "mílur á klukkustund"),
    ("km", "kílómetrar"),
    ("kg", "kílógrömm"),
    ("cm", "sentímetrar"),
    ("mm", "millímetrar"),
];

static UNIT_RES: LazyLock<Vec<(JsRegex, JsString)>> = LazyLock::new(|| {
    UNITS
        .iter()
        .map(|&(src, word)| {
            (
                JsRegex::new(&format!(r"(\d)\s*(?:{src})(?!\p{{L}})"), "gu").unwrap(),
                js(&format!("$1 {word}")),
            )
        })
        .collect()
});

/// `CURRENCY`, in the TS object's key order.
const CURRENCY: [(&str, &str); 4] = [("$", "dalir"), ("€", "evrur"), ("£", "pund"), ("¥", "jen")];

static CURRENCY_RES: LazyLock<Vec<(JsRegex, JsRegex, JsString)>> = LazyLock::new(|| {
    CURRENCY
        .iter()
        .map(|&(sign, word)| {
            let esc = escape(sign);
            (
                JsRegex::new(&format!(r"{esc}\s*(\d+)"), "gu").unwrap(),
                JsRegex::new(&format!(r"(\d+)\s*{esc}"), "gu").unwrap(),
                js(&format!("$1 {word}")),
            )
        })
        .collect()
});

/// `normalizeIcelandic(input)`.
pub fn normalize_icelandic(input: &JsString) -> JsString {
    let g = |m: &JsMatch, s: &JsString, i: usize| m.group(i, s).unwrap_or_default();
    let mut t = input.clone();

    t = rewrite(
        &t,
        js_re!(r"(?<![\p{L}\p{M}])o\.\s?s\.\s?frv\.?(?![\p{L}])", "giu"),
        &js("og svo framvegis"),
    );
    t = rewrite(
        &t,
        js_re!(r"(?<![\p{L}\p{M}])o\.\s?fl\.?(?![\p{L}])", "giu"),
        &js("og fleira"),
    );

    loop {
        let prev = t.clone();
        t = rewrite(
            &t,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)\.(?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
        if t == prev {
            break;
        }
    }

    // An English-grouped thousand, the whole number at once (#1574).
    t = rewrite_with(
        &t,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2})((?:,\d{3})+)(?![\d]|,\d)", "gu"),
        |m, s| g(m, s, 1).concat(&js_re!(",", "gu").replace(&g(m, s, 2), &JsString::new())),
    );

    t = rewrite_with(&t, js_re!(r"(\d+),(\d+)", "gu"), |m, s| {
        let frac = JsString::join(&g(m, s, 2).code_point_strings(), &js(" "));
        g(m, s, 1).concat(&js(" komma ")).concat(&frac)
    });

    // Anchored on the left, and the minutes keep their zero (#1574).
    t = rewrite_with(
        &t,
        js_re!(r"(?<!\d)(\d{1,2}):(\d{2})(?!\d)", "gu"),
        |m, s| {
            let (h, mm) = (g(m, s, 1).to_string_lossy(), g(m, s, 2).to_string_lossy());
            js(&if mm == "00" {
                format!("{h} núll núll")
            } else if let Some(rest) = mm.strip_prefix('0') {
                format!("{h} núll {rest}")
            } else {
                format!("{h} {mm}")
            })
        },
    );

    t = rewrite(&t, js_re!(r"(\d+)\s*%", "gu"), &js("$1 prósent"));
    t = rewrite(
        &rewrite(&t, js_re!("℃", "gu"), &js("°C")),
        js_re!("℉", "gu"),
        &js("°F"),
    );
    t = rewrite(
        &t,
        js_re!(r"(\d)\s*°\s*C(?!\p{L})", "giu"),
        &js("$1 gráður á Celsíus"),
    );
    t = rewrite(
        &t,
        js_re!(r"(\d)\s*°\s*F(?!\p{L})", "giu"),
        &js("$1 gráður á Fahrenheit"),
    );
    t = rewrite(&t, js_re!(r"(\d)\s*°", "gu"), &js("$1 gráður"));

    t = rewrite(
        &t,
        js_re!(r"(?<!\p{L})km\s*[²2](?!\d)", "giu"),
        &js("ferkílómetrar"),
    );
    t = rewrite(
        &t,
        js_re!(r"(?<!\p{L})m\s*[²2](?!\d)", "giu"),
        &js("fermetrar"),
    );
    t = rewrite(
        &t,
        js_re!(r"(?<!\p{L})km\s*[³3](?!\d)", "giu"),
        &js("rúmkílómetrar"),
    );
    t = rewrite(
        &t,
        js_re!(r"(?<!\p{L})m\s*[³3](?!\d)", "giu"),
        &js("rúmmetrar"),
    );

    t = rewrite(
        &t,
        js_re!(r"(?<!\p{L})km\s*\/\s*(?:klst\.?|h)(?![\p{L}])", "giu"),
        &js("kílómetrar á klukkustund"),
    );
    for (re, rep) in UNIT_RES.iter() {
        t = rewrite(&t, re, rep);
    }

    t = rewrite_with(
        &t,
        js_re!(r"(?<!\d)(\d{1,2})\.(?=\s+\p{Ll})\s+(\p{Ll}+)", "gu"),
        |m, s| {
            let (n, next) = (g(m, s, 1), g(m, s, 2));
            let Some(forms) = MANIFEST.ordinals.get(&n.to_string_lossy()) else {
                return m.value(s);
            };
            let word = if js_re!(
                "^(janúar|febrúar|mars|apríl|maí|júní|júlí|ágúst|september|október|nóvember|desember)",
                "u"
            )
            .test(&next)
            {
                &forms.masc
            } else if js_re!("^(aldar|öldinni|aldarinnar|aldir)", "u").test(&next) {
                &forms.fem_oblique
            } else {
                &forms.common
            };
            js(&format!("{word} ")).concat(&next)
        },
    );

    t = rewrite_with(
        &t,
        js_re!(
            r"(?<![-–—])(\d+)\s*[-–—]\s*(\d+)(?!\d)(?!\s*[-–—]\s*\d)",
            "gu"
        ),
        // Ascending only (#1574): a descending pair is a score.
        |m, s| {
            let (a, b) = (g(m, s, 1), g(m, s, 2));
            if js_number(&a) < js_number(&b) {
                a.concat(&js(" til ")).concat(&b)
            } else {
                m.value(s)
            }
        },
    );

    for (before, after, rep) in CURRENCY_RES.iter() {
        t = rewrite(&t, before, rep);
        t = rewrite(&t, after, rep);
    }

    t = rewrite_with(&t, js_re!(r"(?<![\p{L}\d])([-−+])(\d+)", "gu"), |m, s| {
        let sign = if g(m, s, 1) == js("+") {
            "plús"
        } else {
            "mínus"
        };
        js(&format!("{sign} ")).concat(&g(m, s, 2))
    });

    t = rewrite(&t, js_re!(r"(\d)\s*\+\s*(\d)", "gu"), &js("$1 plús $2"));
    t = rewrite(&t, js_re!("±", "gu"), &js(" plús mínus "));
    t = rewrite(&t, js_re!("[=≈]", "gu"), &js(" jafnt og "));
    t = rewrite(&t, js_re!("<", "gu"), &js(" minna en "));
    t = rewrite(&t, js_re!(">", "gu"), &js(" meira en "));
    t = rewrite(
        &t,
        js_re!(r"×|(?<=\p{Nd})[ \t]?x[ \t]?(?=\p{Nd})", "gu"),
        &js(" sinnum "),
    );
    t = rewrite(&t, js_re!("÷", "gu"), &js(" deilt með "));

    t = rewrite(&t, js_re!(r"\s*[&＆]\s*", "gu"), &js(" og "));

    rewrite(&t, js_re!(r"[ \t]{2,}", "gu"), &js(" "))
}
