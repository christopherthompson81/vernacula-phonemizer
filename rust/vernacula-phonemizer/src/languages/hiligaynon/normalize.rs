//! Hiligaynon (hil) text normalization: thousands de-grouping, the `alas` clock, the shared symbol tier, ranges
//! as `hasta`, decimals as `punto`, dotted abbreviations, the `ika-Nng` ligature and the `sg` abbreviation.
//! Ported from src/languages/hiligaynon/normalize.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// normalize.ts's `makeSymbolNormalizer({…})` literal, evaluated from the source and `JSON.stringify`'d.
const SYMBOL_DATA: &str = r#"{"percent":["porsiyento"],"currency":{"₱":["piso"]},"magnitudes":["libo","milyon","bilyon","trilyon"],"units":{"km":["kilometro"],"m":["metro"],"cm":["sentimetro"],"mm":["milimetro"],"kg":["kilo"]},"exponentWords":{"squared":["kwadrado"],"position":"after"},"unitPer":"kada","rateDenominators":{"h":"oras"},"ampersand":"kag"}"#;

/// `SYMBOLS`, or why the tier refused its data. Built once; the engine's constructor checks it.
pub(crate) fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<Result<SymbolNormalizer, String>> = OnceLock::new();
    S.get_or_init(|| {
        let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
        make_symbol_normalizer(&data)
    })
    .as_ref()
    .map_err(|e| e.clone())
}

/// `DOTTED_ABBREV`. Generated from normalize.ts's object literal (key order preserved).
const DOTTED_ABBREV: [(&str, &str); 8] = [
    ("dr", "Doktor"),
    ("jr", "Junior"),
    ("sr", "Senior"),
    ("st", "Santo"),
    ("mr", "Ginoo"),
    ("mrs", "Ginang"),
    ("prof", "Propesor"),
    ("fr", "Padre"),
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

/// `normalizeHiligaynon(input)`. The steps are order-dependent, as in the TS.
pub(crate) fn normalize_hiligaynon(input: &JsString) -> JsString {
    let mut s = input.clone();

    // de-group thousands.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2}(?:,\d{3})+)(?!\d)", "gu"),
        |m, t| js_re!(r",", "g").replace(&m.value(t), &JsString::new()),
    );

    // the clock, only after `alas`/`las`.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<=(?:a?las)[- ])(?<![\d.:])([01]?\d|2[0-3]):([0-5]\d)(?!\d)",
            "giu"
        ),
        |m, t| {
            let (h, min) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
            if js_number(&min) == 0.0 {
                num_str(&h)
            } else {
                num_str(&h).concat(&js(" kag ")).concat(&num_str(&min))
            }
        },
    );

    // the shared tier.
    s = try_symbols().unwrap_or_else(|e| panic!("{e}")).apply(&s);

    // ranges → `hasta`.
    s = rewrite(
        &s,
        js_re!(
            r"(?<!\b(?:hasta|asta|tubtob|tubtub|halin sa|halin)\s)(?<![\d.,\p{L}-])(\d[\d,]*(?:\.\d+)?)\s?[-–]\s?(\d[\d,]*(?:\.\d+)?)(?![\d,-]|\.\d)",
            "gu"
        ),
        &js("$1 hasta $2"),
    );

    // decimals → `punto`, the fraction digit by digit.
    s = rewrite_with(&s, js_re!(r"(\d)\.(\d{1,2})(?![\d.,])", "gu"), |m, t| {
        let digits = JsString::join(&m.group(2, t).unwrap().code_point_strings(), &js(" "));
        m.group(1, t)
            .unwrap()
            .concat(&js(" punto "))
            .concat(&digits)
    });

    // dotted abbreviations (the dot is consumed). ⚠ The miss branch is reachable (#1122).
    s = rewrite_with(&s, &ABBREV, |m, t| {
        let ab = m.group(1, t).unwrap().to_lower_case();
        match DOTTED_ABBREV.iter().find(|(k, _)| js(k) == ab) {
            None => m.value(t),
            Some((_, w)) => js(w),
        }
    });

    // `ika-Nng` → `ika-N nga`, and `sg` → `sang`.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(ika-\d+)ng(?![\p{L}\p{M}])", "giu"),
        &js("$1 nga"),
    );
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\p{Nd}.:/-])sg(?![\p{L}\p{M}\p{Nd}.:/-])",
            "gu"
        ),
        &js("sang"),
    );

    s
}
