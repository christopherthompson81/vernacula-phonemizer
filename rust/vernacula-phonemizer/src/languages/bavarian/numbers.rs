//! Bavarian cardinal numbers: the shared units-first compositor over the words in bavarian.jsonc, the reduced
//! linker ⟨-a-⟩, multi-word magnitudes. Ported from src/languages/bavarian/numbers.ts — see that file for the
//! sources and the spelling choices.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;

use super::manifest::DIR;
use crate::core::data_source::load_once;
use crate::core::js_string::JsString;
use crate::core::load_manifest::load_manifest;
use crate::languages::danish::units_first_numbers::{
    OnePlural, OneWord, UnitsFirstDef, units_first_number_to_words,
};

/// `BarNumbersDef.numbers`: this module's own slice of bavarian.jsonc, as in the TS.
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
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

#[derive(Debug, FromJson)]
pub struct BarNumbersDef {
    pub numbers: Numbers,
}

/// The `numbers` block, or why it could not be loaded.
pub fn try_numbers() -> Result<&'static Numbers, String> {
    static M: OnceLock<BarNumbersDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "bavarian.jsonc").map_err(|e| e.to_string())
    })
    .map(|d| &d.numbers)
}

/// ⚠ Reached only through a checked path (a `BavarianPhonemizer`, whose constructor loads it).
static N: LazyLock<&'static Numbers> =
    LazyLock::new(|| try_numbers().unwrap_or_else(|e| panic!("{e}")));

static DEF: LazyLock<UnitsFirstDef> = LazyLock::new(|| UnitsFirstDef {
    ones: N.ones.clone(),
    tens: N.tens.clone(),
    compound_ones: Some(N.compound_ones.clone()),
    connector: |_, _| N.connector.clone(),
    hundred: N.hundred.clone(),
    thousand: N.thousand.clone(),
    million: N.million.clone(),
    billion: N.billion.clone(),
    mul_join: " ".to_string(),
    hundred_rem_join: " ".to_string(),
    group_join: " ".to_string(),
});

/// `numberToWords(n, raw)`.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    units_first_number_to_words(n, &DEF, raw)
}
