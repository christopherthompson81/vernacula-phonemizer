//! Symbol and unit normalization shared across languages. Ported from src/core/normalizeSymbols.ts — see
//! that file for the evidence.
//!
//! ⚠ PARTIAL. Only what the ported languages call is here: English needs just `resolve_unit_symbol`.
//! `makeSymbolNormalizer`, `makeBareUnitNormalizer` and `spacedBareExponent` are ported with their first
//! consumer.

use indexmap::IndexMap;

use super::js_string::JsString;

/// `foldedIndex`: the lowercase key → value index; the FIRST key to fold onto a slot keeps it, and a slot whose
/// declared keys DISAGREE is left out (µm/µM, µs/µS, mΩ/MΩ): only an undeclared case variant reaches the fold,
/// and it has no case to decide by.
pub fn folded_index<V: Clone + PartialEq>(map: &IndexMap<JsString, V>) -> IndexMap<JsString, V> {
    let mut out: IndexMap<JsString, V> = IndexMap::new();
    let mut ambiguous = Vec::new();
    for (k, v) in map {
        let lk = k.to_lower_case();
        match out.get(&lk) {
            None => {
                out.insert(lk, v.clone());
            }
            Some(have) if have != v => ambiguous.push(lk),
            Some(_) => {}
        }
    }
    for lk in ambiguous {
        out.shift_remove(&lk);
    }
    out
}

/// The declared table with the EXACT written form first. Then the case-folded index, but only for a
/// multi-character symbol unless `fold_single`: one letter's case is the whole difference (m against M).
pub fn resolve_unit_symbol<'a, V>(
    declared: Option<&'a IndexMap<JsString, V>>,
    folded: &'a IndexMap<JsString, V>,
    written: &JsString,
    fold_single: bool,
) -> Option<&'a V> {
    if let Some(v) = declared.and_then(|d| d.get(written)) {
        return Some(v);
    }
    if written.len() > 1 || fold_single {
        folded.get(&written.to_lower_case())
    } else {
        None
    }
}
