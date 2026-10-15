//! Danish cardinal numbers: the shared units-first compositor over the vigesimal tens from danish.jsonc, written
//! open and chained with a spaced "og". Ported from src/languages/danish/numbers.ts — see that file for the sources.

use std::sync::LazyLock;

use super::manifest::MANIFEST;
use super::units_first_numbers::{UnitsFirstDef, units_first_number_to_words};
use crate::core::js_string::JsString;

/// `DEF`: the words from the manifest, the joins from numbers.ts.
static DEF: LazyLock<UnitsFirstDef> = LazyLock::new(|| {
    let n = &MANIFEST.numbers;
    let og = format!(" {} ", n.connector);
    UnitsFirstDef {
        ones: n.ones.clone(),
        tens: n.tens.clone(),
        compound_ones: None,
        connector: |_, _| MANIFEST.numbers.connector.clone(),
        hundred: n.hundred.clone(),
        thousand: n.thousand.clone(),
        million: n.million.clone(),
        billion: n.billion.clone(),
        mul_join: " ".to_string(),
        hundred_rem_join: og.clone(),
        group_join: og,
    }
});

/// `numberToWords(n, raw)`.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    units_first_number_to_words(n, &DEF, raw)
}
