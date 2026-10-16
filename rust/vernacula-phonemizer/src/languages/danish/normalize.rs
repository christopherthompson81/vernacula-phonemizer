//! Danish (da) text normalization: period-grouped thousands, the decimal comma, the colon clock, abbreviations,
//! percent, degrees, squared units, ordinals (ranges, coordinated, before a lowercase word), ranges, currency in
//! both positions, signs, relational signs and the ampersand; then the shared symbol tier.
//! Ported from src/languages/danish/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{escape, rewrite, rewrite_with};
use crate::js_re;

/// `SYMBOLS`'s argument, generated from the object literal in normalize.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it. No `countForm`: the default selector.
const SYMBOL_DATA: &str = r#"{"multiply":{"times":"gange"},"percent":["procent"],"units":{"km":["kilometer"],"m":["meter"]},"unitPer":"i","rateDenominators":{"t":"timen","h":"timen","s":"sekundet"}}"#;

pub(crate) static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
    make_symbol_normalizer(&data)
});

static ABBREV: LazyLock<Vec<(&'static JsRegex, &'static str)>> = LazyLock::new(|| {
    vec![
        (js_re!(r"\bkl\.", "giu"), "klokken"),
        (js_re!(r"\bbl\.a\.", "giu"), "blandt andet"),
        (js_re!(r"\bf\.eks\.", "giu"), "for eksempel"),
        (js_re!(r"\bdvs\.", "giu"), "det vil sige"),
        (js_re!(r"\bosv\.", "giu"), "og så videre"),
        (js_re!(r"\bnr\.", "giu"), "nummer"),
        (js_re!(r"\bdr\.", "giu"), "doktor"),
    ]
});

static SQUARED: LazyLock<Vec<(&'static JsRegex, &'static str)>> = LazyLock::new(|| {
    vec![
        (js_re!(r"\bkm\s*²", "giu"), "kvadratkilometer"),
        (js_re!(r"\bm\s*²", "giu"), "kvadratmeter"),
        (js_re!(r"\bcm\s*²", "giu"), "kvadratcentimeter"),
        (js_re!(r"\bm\s*³", "giu"), "kubikmeter"),
    ]
});

/// `CURRENCY`, in its insertion order, each sign with its three patterns (postposed, preposed before a letter,
/// preposed).
static CURRENCY: LazyLock<Vec<(JsString, [JsRegex; 3])>> = LazyLock::new(|| {
    [("$", "dollar"), ("€", "euro"), ("£", "pund"), ("¥", "yen")]
        .iter()
        .map(|&(sign, word)| {
            let esc = escape(sign);
            let re = |p: String| JsRegex::new(&p, "gu").unwrap();
            (
                js(word),
                [
                    re(format!(r"(\d+)\s*{esc}")),
                    re(format!(r"{esc}\s*(\d+)(?=[\p{{L}}\p{{M}}])")),
                    re(format!(r"{esc}\s*(\d+)")),
                ],
            )
        })
        .collect()
});

static RELATIONAL: LazyLock<Vec<(&'static JsRegex, &'static str)>> = LazyLock::new(|| {
    vec![
        (js_re!(r"±", "gu"), " plus minus "),
        (js_re!(r"≈", "gu"), " cirka lig med "),
        (js_re!(r"≤", "gu"), " mindre end eller lig med "),
        (js_re!(r"≥", "gu"), " større end eller lig med "),
        (js_re!(r"=", "gu"), " lig med "),
        (js_re!(r"<", "gu"), " mindre end "),
        (js_re!(r">", "gu"), " større end "),
        (js_re!(r"×", "gu"), " gange "),
        (js_re!(r"÷", "gu"), " divideret med "),
    ]
});

/// `String(Number(digits))`: the ordinal key of a run of digits, zero padding dropped.
fn canon(digits: &JsString) -> JsString {
    js(&js_number_to_string(js_number(digits)))
}

/// `ORDINALS[key]` (an own-key lookup: a key is digits only, so no `Object.prototype` member is reachable).
fn ordinal(key: &JsString) -> Option<JsString> {
    MANIFEST.ordinals.get(&key.to_string_lossy()).map(|s| js(s))
}

/// `normalizeDanish(input)`, without the symbol tier (`SYMBOLS`), which the engine applies.
pub fn normalize_danish_local(input: &JsString) -> JsString {
    let g = |m: &JsMatch, s: &JsString, i: usize| m.group(i, s).unwrap_or_default();
    let mut t = input.clone();

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

    t = rewrite_with(&t, js_re!(r"(\d+),(\d+)", "gu"), |m, s| {
        let frac: Vec<JsString> = g(m, s, 2).code_point_strings();
        js(&format!("{} komma ", g(m, s, 1))).concat(&JsString::join(&frac, &js(" ")))
    });

    t = rewrite(&t, js_re!(r"(\d{1,2}):(\d{2})(?!\d)", "gu"), &js("$1 $2"));

    for (re, word) in ABBREV.iter() {
        t = rewrite(&t, re, &js(word));
    }

    t = rewrite(&t, js_re!(r"(\d+)\s*%", "gu"), &js("$1 procent"));

    t = rewrite(
        &rewrite(&t, js_re!(r"℃", "gu"), &js("°C")),
        js_re!(r"℉", "gu"),
        &js("°F"),
    );
    t = rewrite(
        &t,
        js_re!(r"(\d)\s*°\s*C(?![\p{L}])", "giu"),
        &js("$1 grader celsius"),
    );
    t = rewrite(
        &t,
        js_re!(r"(\d)\s*°\s*F(?![\p{L}])", "giu"),
        &js("$1 grader fahrenheit"),
    );
    t = rewrite(
        &t,
        js_re!(r"(\d)\s*°(?=[\p{L}\p{M}])", "gu"),
        &js("$1 grader "),
    );
    t = rewrite(&t, js_re!(r"(\d)\s*°", "gu"), &js("$1 grader"));

    for (re, word) in SQUARED.iter() {
        t = rewrite(&t, re, &js(word));
    }

    // `ORDINALS[String(Number(a))]` in every ordinal arm, so a zero-padded `07.` is the same ordinal as `7.`
    // (#1578; the coordinated and single arms used the raw digits).
    t = rewrite_with(
        &t,
        js_re!(
            r"(?<!\d)(\d{1,2})\.\s*[-–—]\s*(\d{1,2})\.(?=\s+\p{Ll})",
            "gu"
        ),
        |m, s| match (ordinal(&canon(&g(m, s, 1))), ordinal(&canon(&g(m, s, 2)))) {
            (Some(a), Some(b)) => a.concat(&js(" til ")).concat(&b),
            _ => m.value(s),
        },
    );

    t = rewrite_with(
        &t,
        js_re!(r"(?<!\d)(\d{1,2})\.\s+(og|eller)\s+(\d{1,2})\.", "gu"),
        |m, s| match (ordinal(&canon(&g(m, s, 1))), ordinal(&canon(&g(m, s, 3)))) {
            (Some(a), Some(b)) => a
                .concat(&js(" "))
                .concat(&g(m, s, 2))
                .concat(&js(" "))
                .concat(&b),
            _ => m.value(s),
        },
    );

    t = rewrite_with(
        &t,
        js_re!(r"(?<!\d)(\d{1,2})\.(?=\s+\p{Ll})", "gu"),
        |m, s| ordinal(&canon(&g(m, s, 1))).unwrap_or_else(|| m.value(s)),
    );

    t = rewrite(
        &t,
        js_re!(
            r"(?<![-–—])(\d+)\s*[-–—]\s*(\d+)(?!\d)(?!\s*[-–—]\s*\d)",
            "gu"
        ),
        &js("$1 til $2"),
    );

    t = rewrite(&t, js_re!(r"\b([A-Z]{2,3})\s*\$", "gu"), &js("$1 dollar"));
    for (word, [post, pre_letter, pre]) in CURRENCY.iter() {
        t = rewrite(&t, post, &js("$1 ").concat(word));
        t = rewrite(&t, pre_letter, &js("$1 ").concat(word).concat(&js(" ")));
        t = rewrite(&t, pre, &js("$1 ").concat(word));
    }

    t = rewrite_with(&t, js_re!(r"(?<![\p{L}\d])([-−+])(\d+)", "gu"), |m, s| {
        let sign = if g(m, s, 1) == "+" { "plus" } else { "minus" };
        js(&format!("{sign} ")).concat(&g(m, s, 2))
    });

    t = rewrite(&t, js_re!(r"(\d)\s*\+\s*(\d)", "gu"), &js("$1 plus $2"));
    for (re, word) in RELATIONAL.iter() {
        t = rewrite(&t, re, &js(word));
    }

    t = rewrite(&t, js_re!(r"\s*[&＆]\s*", "gu"), &js(" og "));

    rewrite(&t, js_re!(r"[ \t]{2,}", "gu"), &js(" "))
}

/// `normalizeDanish(input)`.
pub fn normalize_danish(symbols: &SymbolNormalizer, input: &JsString) -> JsString {
    symbols.apply(&normalize_danish_local(input))
}
