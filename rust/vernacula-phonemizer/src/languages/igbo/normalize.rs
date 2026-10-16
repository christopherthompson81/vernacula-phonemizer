//! Igbo text normalization: grouping, the English ordinal tail, the range dash, the fused-quantity space, the shared
//! symbol tier (percent and units noun-first), and the decimal point.
//! Ported from src/languages/igbo/normalize.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use super::manifest::MANIFEST;
use crate::core::data_source::load_once;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `UNIT`, in the object's key order: the tier's `units` and FUSED_QUANTITY are both derived from it.
const UNIT: [(&str, &str); 4] = [
    ("km", "kilomita"),
    ("mm", "milimita"),
    ("cm", "sentimita"),
    ("kg", "kilogram"),
];

/// `SYMBOLS`'s argument, generated from the object literal in normalize.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it. No `countForm`: the default selector.
const SYMBOL_DATA: &str = r#"{"percent":["pasent"],"percentPrefix":true,"currency":{"₦":["naira"],"US$":["dollar"],"$":["dollar"]},"units":{"km":["kilomita"],"mm":["milimita"],"cm":["sentimita"],"kg":["kilogram"]},"unitPrefix":true,"exponentWords":{"squared":["skwea"],"cubed":["kubik"],"position":{"squared":"after","cubed":"before"}},"ampersand":"na"}"#;

/// `SYMBOLS`: the shared tier.
pub fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
        make_symbol_normalizer(&data)
    })
}

/// `FUSED_QUANTITY`, built from `UNIT`'s keys as the TS builds it.
static FUSED_QUANTITY: LazyLock<JsRegex> = LazyLock::new(|| {
    let keys: Vec<&str> = UNIT.iter().map(|(k, _)| *k).collect();
    JsRegex::new(
        &format!(
            r"(\p{{L}})(?=\d[\d.,]*\s*(?:{})(?:[²³23])?(?![\p{{L}}\p{{M}}\d]))",
            keys.join("|")
        ),
        "giu",
    )
    .unwrap()
});

/// `normalizeIgbo(text)`.
pub fn normalize_igbo(text: &JsString) -> JsString {
    let mut s = text.clone();
    // A digit-flanked ASCII `x` is the `×` it stands for (#1597): a relay dimension, and `×` is unread.
    s = rewrite(
        &s,
        js_re!(r"(\d[ \u00a0]?)[xX](?=[ \u00a0]?\d)", "gu"),
        &js("$1×"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?!\d))", "gu"),
        &JsString::new(),
    );
    s = rewrite(
        &s,
        js_re!(r"\b(\d+)(?:st|nd|rd|th)\b", "giu"),
        &js("nke $1"),
    );
    s = rewrite(&s, js_re!(r"(\d)\s*[-–—]\s*(?=\d)", "gu"), &js("$1 ruo "));
    s = rewrite(&s, &FUSED_QUANTITY, &js("$1 "));
    s = try_symbols().expect("checked by create_igbo").apply(&s);
    rewrite_with(&s, js_re!(r"(\d)\.(\d+)", "gu"), |m, whole| {
        let int = m.group(1, whole).unwrap();
        let frac = m.group(2, whole).unwrap();
        let digits = JsString::join(&frac.code_point_strings(), &js(" "));
        int.concat(&js(&format!(" {} ", MANIFEST.numbers.decimal_word)))
            .concat(&digits)
    })
}
