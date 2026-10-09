//! Italian Roman-numeral policy: ORDINAL readings, derived from the cardinal compositor, in the masculine
//! century / enumeration / regnal-name contexts. Ported from src/languages/italian/romanOrdinals.ts — see
//! that file for the Treccani evidence and the agreement limitation.

use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number_to_string};
use crate::core::roman::RomanPolicy;
use crate::js_re;

use super::italian::number_words_with;
use super::manifest::{ItalianManifest, try_manifest};

/// `italianOrdinal(n)`: the masculine ordinal, or `None` where the TS declines to guess. `n` is a JS number
/// (normalize.ts passes `Number(digits)`, unbounded). Errs only if the manifest cannot be loaded.
pub fn italian_ordinal(n: f64) -> Result<Option<JsString>, String> {
    Ok(ordinal_with(try_manifest()?, n))
}

pub(crate) fn ordinal_with(m: &ItalianManifest, n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || n < 1.0 {
        return None;
    }
    if let Some(irr) = m.ordinals.get(&js_number_to_string(n)) {
        return Some(js(irr));
    }
    let card = number_words_with(&m.numbers, n);
    if card.includes(&js(" ")) {
        return None;
    }
    if card.ends_with(&js("tré")) {
        return Some(card.slice(0, Some(-1)).concat(&js("eesimo")));
    }
    if card.ends_with(&js("sei")) {
        return Some(card.concat(&js("esimo")));
    }
    if card.ends_with(&js("mila")) {
        return Some(card.slice(0, Some(-4)).concat(&js("millesimo")));
    }
    if js_re!("[aeiou]$", "u").test(&card) {
        return Some(card.slice(0, Some(-1)).concat(&js("esimo")));
    }
    Some(card.concat(&js("esimo")))
}

const ORDINAL_BEFORE: &str = r"^(secolo|secoli|capitolo|capitoli|libro|volume|tomo|canto|atto|articolo|paragrafo|allegato|papa|re|imperatore|zar|sultano|antipapa|beato|san|santo|giovanni|paolo|pio|benedetto|francesco|leone|gregorio|clemente|innocenzo|urbano|alessandro|sisto|celestino|adriano|callisto|bonifacio|onorio|eugenio|martino|niccolò|nicola|stefano|giulio|silvestro|pasquale|lucio|luigi|carlo|alberto|enrico|filippo|ferdinando|emanuele|umberto|napoleone|federico|guglielmo|giorgio|edoardo|giacomo|riccardo|alfonso|pietro|giuseppe|leopoldo|massimiliano|ottone|corrado|ludovico|amedeo|gustavo|cristiano|solimano|ramses|tolomeo)$";

const ORDINAL_AFTER: &str = r"^(secolo|secoli|anniversario|congresso|convegno|simposio|campionato|festival|premio|concorso|raduno|torneo|centenario|capitolo|volume|libro|tomo|canto|atto|articolo|emendamento|reggimento|governo)$";

/// `ROMAN_POLICY` (registry.ts's `romanIt`); it declares no `exclude`. The registry runs the Roman pass only
/// after `create_italian` has loaded the manifest, so the ordinal's manifest miss (`None`: the numeral keeps
/// its cardinal digits) is unreachable from `phonemize`.
pub fn roman_policy() -> RomanPolicy {
    RomanPolicy {
        exclude: Vec::new(),
        ordinal: Some(Box::new(|n| {
            try_manifest().ok().and_then(|m| ordinal_with(m, n as f64))
        })),
        ordinal_before: Some(JsRegex::new(ORDINAL_BEFORE, "iu").unwrap()),
        ordinal_after: Some(JsRegex::new(ORDINAL_AFTER, "iu").unwrap()),
    }
}
