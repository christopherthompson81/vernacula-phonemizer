//! Norwegian Bokmål (nb) text normalization: space- and comma-grouped thousands, the decimal comma, the colon
//! clock, abbreviations, percent, degrees, squared units, numeric dates, ordinals, ranges, currency, signs and
//! relational signs; then the shared symbol tier.
//! Ported from src/languages/norwegian/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{escape, rewrite, rewrite_with};
use crate::js_re;

/// `SYMBOLS`'s argument, generated from the object literal in normalize.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it. No `countForm`: the default selector.
const SYMBOL_DATA: &str = r#"{"multiply":{"times":"ganger"},"ampersand":"og","percent":["prosent"],"units":{"km":["kilometer"],"m":["meter"],"mm":["millimeter"]},"unitPer":"i","rateDenominators":{"t":"timen","h":"timen","s":"sekundet"}}"#;

pub(crate) static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let data: SymbolData =
        crate::core::from_json::parse_json(SYMBOL_DATA).map_err(|e| e.to_string())?;
    make_symbol_normalizer(&data)
});

/// `MONTHS`, 1-indexed.
const MONTHS: [Option<&str>; 13] = [
    None,
    Some("januar"),
    Some("februar"),
    Some("mars"),
    Some("april"),
    Some("mai"),
    Some("juni"),
    Some("juli"),
    Some("august"),
    Some("september"),
    Some("oktober"),
    Some("november"),
    Some("desember"),
];

static ABBREV: LazyLock<Vec<(&'static JsRegex, &'static str)>> = LazyLock::new(|| {
    vec![
        (js_re!(r"\bf\.kr\.?(?![\p{L}\p{M}])", "giu"), "før Kristus"),
        (
            js_re!(r"\be\.kr\.?(?![\p{L}\p{M}])", "giu"),
            "etter Kristus",
        ),
        (js_re!(r"\bca\.", "giu"), "cirka"),
        (js_re!(r"\bkl\.", "giu"), "klokka"),
        (js_re!(r"\bdvs\.", "giu"), "det vil si"),
        (js_re!(r"\bbl\.a\.", "giu"), "blant annet"),
        (js_re!(r"\bf\.eks\.", "giu"), "for eksempel"),
        (js_re!(r"\bosv\.", "giu"), "og så videre"),
        (js_re!(r"\bnr\.", "giu"), "nummer"),
        (js_re!(r"\bdr\.", "giu"), "doktor"),
        (js_re!(r"\bjr\.", "giu"), "junior"),
    ]
});

/// `CURRENCY`, in its insertion order, each sign with its pattern.
static CURRENCY: LazyLock<Vec<(JsString, JsRegex)>> = LazyLock::new(|| {
    [("$", "dollar"), ("€", "euro"), ("£", "pund"), ("¥", "yen")]
        .iter()
        .map(|&(sign, word)| {
            let p = format!(r"{}\s*(\d(?:[\d ]*\d)?)", escape(sign));
            (js(word), JsRegex::new(&p, "gu").unwrap())
        })
        .collect()
});

static SQUARED: LazyLock<Vec<(&'static JsRegex, &'static str)>> = LazyLock::new(|| {
    vec![
        (js_re!(r"\bkm\s*²", "giu"), "kvadratkilometer"),
        (js_re!(r"\bm\s*²", "giu"), "kvadratmeter"),
        (js_re!(r"\bcm\s*²", "giu"), "kvadratcentimeter"),
        (js_re!(r"\bm\s*³", "giu"), "kubikkmeter"),
    ]
});

static RELATIONAL: LazyLock<Vec<(&'static JsRegex, &'static str)>> = LazyLock::new(|| {
    vec![
        (js_re!(r"±", "gu"), " pluss minus "),
        (js_re!(r"≈", "gu"), " omtrent lik "),
        (js_re!(r"≤", "gu"), " mindre enn eller lik "),
        (js_re!(r"≥", "gu"), " større enn eller lik "),
        (js_re!(r"=", "gu"), " er lik "),
        (js_re!(r"<", "gu"), " mindre enn "),
        (js_re!(r">", "gu"), " større enn "),
        (js_re!(r"×", "gu"), " ganger "),
        (js_re!(r"÷", "gu"), " delt på "),
    ]
});

/// `ORDINALS[key]` (an own-key lookup: a key is digits only, so no `Object.prototype` member is reachable).
fn ordinal(key: &JsString) -> Option<JsString> {
    MANIFEST.ordinals.get(&key.to_string_lossy()).map(|s| js(s))
}

/// `String(Number(digits))`.
fn canon(digits: &JsString) -> JsString {
    js(&js_number_to_string(js_number(digits)))
}

/// `normalizeNorwegian(input)`, without the symbol tier (`SYMBOLS`), which the caller applies.
pub fn normalize_norwegian_local(input: &JsString) -> JsString {
    let g = |m: &JsMatch, s: &JsString, i: usize| m.group(i, s).unwrap_or_default();
    let mut t = input.clone();

    loop {
        let prev = t.clone();
        t = rewrite(
            &t,
            js_re!(
                r"(?<=\d)(?<!(?<![\d\.,])0)[ \u00a0\u202f\u2009](?=\d{3}(?!\d))",
                "gu"
            ),
            &JsString::new(),
        );
        if t == prev {
            break;
        }
    }
    loop {
        let prev = t.clone();
        t = rewrite(
            &t,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)[,](?=\d{3}(?!\d))", "gu"),
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

    t = rewrite(&t, js_re!(r"(\d+)\s*%", "gu"), &js("$1 prosent"));

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
    t = rewrite(&t, js_re!(r"(\d)\s*°", "gu"), &js("$1 grader"));

    for (re, word) in SQUARED.iter() {
        t = rewrite(&t, re, &js(word));
    }

    t = rewrite_with(
        &t,
        js_re!(r"(?<!\d)(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)", "gu"),
        |m, s| {
            // `MONTHS[Number(mo)]` (`mo` is one or two digits): an index outside 1–12 is `undefined`.
            let month = MONTHS
                .get(js_number(&g(m, s, 2)) as usize)
                .copied()
                .flatten();
            match (ordinal(&canon(&g(m, s, 1))), month) {
                (Some(day), Some(month)) => {
                    day.concat(&js(&format!(" {month} "))).concat(&g(m, s, 3))
                }
                _ => m.value(s),
            }
        },
    );

    // `ORDINALS[String(Number(a))]`, as in the single-ordinal arm below (#1578).
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
        js_re!(r"(?<!\d)(\d{1,2})\.(?=\s+\p{Ll})", "gu"),
        // Keyed by `String(Number(n))`: a zero-padded `07. mai` is claimed too (#1578).
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

    for (word, re) in CURRENCY.iter() {
        t = rewrite(&t, re, &js("$1 ").concat(word));
    }

    t = rewrite_with(&t, js_re!(r"(?<![\p{L}\d])([-−+])(\d+)", "gu"), |m, s| {
        let sign = if g(m, s, 1) == "+" { "pluss" } else { "minus" };
        js(&format!("{sign} ")).concat(&g(m, s, 2))
    });

    t = rewrite(&t, js_re!(r"(\d)\s*\+\s*(\d)", "gu"), &js("$1 pluss $2"));
    for (re, word) in RELATIONAL.iter() {
        t = rewrite(&t, re, &js(word));
    }
    rewrite(&t, js_re!(r"[ \t]{2,}", "gu"), &js(" "))
}

/// `normalizeNorwegian(input)`.
pub fn normalize_norwegian(symbols: &SymbolNormalizer, input: &JsString) -> JsString {
    symbols.apply(&normalize_norwegian_local(input))
}
