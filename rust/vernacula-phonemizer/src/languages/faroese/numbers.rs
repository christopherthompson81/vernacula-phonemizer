//! Faroese cardinal numbers: the shared units-first compositor (../danish/unitsFirstNumbers.ts) over the Faroese
//! words (neuter citation series, decimal tens, `ein-` in a compound, "og" fused and between groups).
//! Ported from src/languages/faroese/numbers.ts — see that file for the sources and the judgement calls.

use std::sync::LazyLock;

use crate::core::js_string::JsString;
use crate::languages::danish::units_first_numbers::{UnitsFirstDef, units_first_number_to_words};

/// `DEF`, generated from the object literal in numbers.ts (key order preserved) by evaluating it and printing
/// `JSON.stringify` (which drops the `connector` function, supplied below).
const DEF_JSON: &str = r#"{"ones":["null","eitt","tvey","trý","fýra","fimm","seks","sjey","átta","níggju","tíggju","ellivu","tólv","trettan","fjúrtan","fimtan","sekstan","seytjan","átjan","nítjan"],"tens":["","","tjúgu","tríati","fýrati","fimmti","seksti","sjeyti","áttati","níti"],"compoundOnes":["","ein"],"hundred":{"one":"eitt hundrað","word":"hundrað"},"thousand":{"one":"eitt túsund","word":"túsund"},"million":{"one":"ein millión","plural":"milliónir"},"billion":{"one":"ein milliard","plural":"milliardir"},"mulJoin":" ","hundredRemJoin":" og ","groupJoin":" og "}"#;

static DEF: LazyLock<UnitsFirstDef> = LazyLock::new(|| {
    let mut d: UnitsFirstDef = serde_json::from_str(DEF_JSON).expect("numbers.ts DEF literal");
    d.connector = |_, _| "og".to_string();
    d
});

/// `numberToWords(n, raw)`.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    units_first_number_to_words(n, &DEF, raw)
}
