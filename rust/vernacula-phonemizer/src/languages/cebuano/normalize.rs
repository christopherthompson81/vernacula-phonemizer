//! Cebuano (ceb) text normalization: thousands de-grouping, clocks (colon, licensed dot, military), the shared
//! symbol tier, decimals as `punto`, ranges as `ngadto sa`, dotted abbreviations, fractions and `+`.
//! Ported from src/languages/cebuano/normalize.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use super::manifest::MANIFEST;
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::normalize_symbols::{
    ExponentWords, Multiply, SymbolData, SymbolNormalizer, UnitPer, make_symbol_normalizer,
};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `SYMBOLS`, or why the tier refused its data. Built once; the engine's constructor checks it.
pub(crate) fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<Result<SymbolNormalizer, String>> = OnceLock::new();
    S.get_or_init(build_symbols).as_ref().map_err(|e| e.clone())
}

/// The shared tier, built from the manifest exactly as normalize.ts passes it.
fn build_symbols() -> Result<SymbolNormalizer, String> {
    let st = &MANIFEST.symbol_tier;
    make_symbol_normalizer(&SymbolData {
        percent: Some(st.percent.clone()),
        currency: Some(st.currency.clone()),
        units: Some(st.units.clone()),
        rate_denominators: Some(st.rate_denominators.clone()),
        unit_per: Some(UnitPer::All(st.unit_per.clone())),
        exponent_words: Some(ExponentWords {
            squared: Some(st.exponent_words.squared.clone()),
            cubed: st.exponent_words.cubed.clone(),
            position: st.exponent_words.position.clone(),
        }),
        magnitudes: Some(st.magnitudes.clone()),
        ampersand: Some(st.ampersand.clone()),
        multiply: Some(Multiply {
            times: st.multiply.times.clone(),
            by: st.multiply.by.clone(),
        }),
        ..Default::default()
    })
}

/// `DOTTED_ABBREV`. Generated from normalize.ts's object literal (key order preserved).
const DOTTED_ABBREV: [(&str, &str); 7] = [
    ("dr", "Doktor"),
    ("jr", "Junior"),
    ("sr", "Senior"),
    ("st", "Santo"),
    ("mr", "Ginoo"),
    ("mrs", "Ginang"),
    ("prof", "Propesor"),
];

static ABBREV: LazyLock<JsRegex> = LazyLock::new(|| {
    let mut keys: Vec<&str> = DOTTED_ABBREV.iter().map(|(k, _)| *k).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.encode_utf16().count()));
    JsRegex::new(
        &format!(r"(?<![\p{{L}}\p{{M}}\d_])({})\.", keys.join("|")),
        "giu",
    )
    .unwrap()
});

/// `` `${Number(x)}` ``.
fn num_str(x: &JsString) -> JsString {
    js(&js_number_to_string(js_number(x)))
}

/// `clock(_m, h, min)`: the hour, then `ug` and the minutes unless they are zero.
fn clock(m: &JsMatch, t: &JsString) -> JsString {
    let (h, min) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
    if js_number(&min) == 0.0 {
        num_str(&h)
    } else {
        num_str(&h).concat(&js(" ug ")).concat(&num_str(&min))
    }
}

/// `normalizeCebuano(input)`. The numbered steps are order-dependent.
pub(crate) fn normalize_cebuano(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1. de-group thousands.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2}(?:,\d{3})+)(?!\d)", "gu"),
        |m, t| js_re!(r",", "g").replace(&m.value(t), &JsString::new()),
    );

    // 2. clocks: colon, a dot licensed by a following marker, and the military form before a timezone.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.:])([01]?\d|2[0-3]):([0-5]\d)\b(?!\.?\d)", "gu"),
        clock,
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.:])([01]?\d|2[0-3])\.([0-5]\d)(?!\d)(?=\s*(?:GMT|UTC|[ap]\.?m\b|sa (?:buntag|hapon|gabii)))",
            "giu"
        ),
        clock,
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.:])([01]\d|2[0-3])([0-5]\d)(?!\d)(?=\s*(?:GMT|UTC))",
            "gu"
        ),
        clock,
    );

    // 3. the shared tier, before decimals and after de-grouping.
    s = try_symbols().unwrap_or_else(|e| panic!("{e}")).apply(&s);

    // 4. decimals → `punto`, the fraction digit by digit.
    s = rewrite_with(&s, js_re!(r"(\d)\.(\d{1,2})(?![\d.,])", "gu"), |m, t| {
        let digits = JsString::join(&m.group(2, t).unwrap().code_point_strings(), &js(" "));
        m.group(1, t)
            .unwrap()
            .concat(&js(" punto "))
            .concat(&digits)
    });

    // 5. ranges → `ngadto sa`.
    s = rewrite(
        &s,
        js_re!(
            r"(?<!\b(?:ngadto sa|hangtod|hangtud|gikan sa)\s)(?<![\d.,\p{L}-])(\d+)\s?[-–]\s?(\d+)(?![\d.,-])",
            "gu"
        ),
        &js("$1 ngadto sa $2"),
    );

    // 6. dotted abbreviations (the dot is consumed). ⚠ The miss branch is reachable (#1122).
    s = rewrite_with(&s, &ABBREV, |m, t| {
        let ab = m.group(1, t).unwrap().to_lower_case();
        match DOTTED_ABBREV.iter().find(|(k, _)| js(k) == ab) {
            None => m.value(t),
            Some((_, w)) => js(w),
        }
    });

    // 7. fractions; ½ is `tunga`.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])", "gu"),
        |m, t| {
            let (a, b) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
            if js_number(&a) == 1.0 && js_number(&b) == 2.0 {
                js("tunga")
            } else {
                a.concat(&js(" kabahin sa ")).concat(&b)
            }
        },
    );

    // 8. `+` → `dugang`.
    s = rewrite(
        &s,
        js_re!(r"(\S)\+\s?(\(?\s?[-−]?\d)", "gu"),
        &js("$1 dugang $2"),
    );
    s = rewrite(
        &s,
        js_re!(r"(^|\s)\+\s?(\(?\s?[-−]?\d)", "gu"),
        &js("$1dugang $2"),
    );

    s
}
