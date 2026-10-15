//! Luxembourgish cardinal numbers: the shared units-first compositor over the words in luxembourgish.jsonc, closed
//! German-style compounds, and the Eifeler Regel (final-n deletion) on the connector — exported for normalize.ts.
//! Ported from src/languages/luxembourgish/numbers.ts — see that file for the sources.

use std::sync::{LazyLock, OnceLock};

use serde::Deserialize;

use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, js};
use crate::core::load_manifest::load_manifest;
use crate::languages::danish::units_first_numbers::{
    OnePlural, OneWord, UnitsFirstDef, units_first_number_to_words,
};

pub const DIR: &str = "languages/luxembourgish";

/// `LuxNumbersDef.numbers`: this module's own slice of luxembourgish.jsonc, as in the TS.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Numbers {
    pub ones: Vec<String>,
    pub tens: Vec<String>,
    pub compound_ones: Vec<String>,
    pub connector: String,
    pub hundred: OneWord,
    pub thousand: OneWord,
    pub million: OnePlural,
    pub billion: OnePlural,
}

#[derive(Debug, Deserialize)]
pub struct LuxNumbersDef {
    pub numbers: Numbers,
}

/// The `numbers` block, or why it could not be loaded.
pub fn try_numbers() -> Result<&'static Numbers, String> {
    static M: OnceLock<LuxNumbersDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "luxembourgish.jsonc").map_err(|e| e.to_string())
    })
    .map(|d| &d.numbers)
}

/// ⚠ Reached only through a checked path (a `LuxembourgishPhonemizer`, whose constructor loads it).
static N: LazyLock<&'static Numbers> =
    LazyLock::new(|| try_numbers().unwrap_or_else(|e| panic!("{e}")));

/// `applyEifelerRegel(word, following)`: a final ⟨n⟩ survives before ⟨n d t z h⟩ or a vowel (and before a
/// pause, i.e. nothing), and is deleted before any other consonant. `following[0]` is one CODE UNIT.
pub fn apply_eifeler_regel(word: &JsString, following: &JsString) -> JsString {
    if !word.ends_with(&js("n")) {
        return word.clone();
    }
    let Some(&u) = following.units().first() else {
        return word.clone();
    };
    // `N_KEEPERS.has(c)`: a set of one-letter strings, so a lowercase that grows (`İ` → `i̇`) is not in it.
    let c = JsString::from_units(&[u]).to_lower_case();
    let keep = c.len() == 1
        && "ndtzhaeiouäëéèáâôûüy"
            .encode_utf16()
            .any(|k| k == c.units()[0]);
    if keep {
        word.clone()
    } else {
        word.slice(0, Some(-1))
    }
}

static DEF: LazyLock<UnitsFirstDef> = LazyLock::new(|| UnitsFirstDef {
    ones: N.ones.clone(),
    tens: N.tens.clone(),
    compound_ones: Some(N.compound_ones.clone()),
    connector: |_, tens_word| {
        apply_eifeler_regel(&js(&N.connector), &js(tens_word)).to_string_lossy()
    },
    hundred: N.hundred.clone(),
    thousand: N.thousand.clone(),
    million: N.million.clone(),
    billion: N.billion.clone(),
    mul_join: String::new(),
    hundred_rem_join: String::new(),
    group_join: " ".to_string(),
});

/// `numberToWords(n, raw)`.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    units_first_number_to_words(n, &DEF, raw)
}
