//! Symbol and unit normalization shared across languages. Ported from src/core/normalizeSymbols.ts — see
//! that file for the evidence.
//!
//! ⚠ PARTIAL. Only what the ported languages call is here: English needs just `resolve_unit_symbol`.
//! `makeSymbolNormalizer`, `makeBareUnitNormalizer` and `spacedBareExponent` are ported with their first
//! consumer.

use indexmap::IndexMap;

use super::js_string::JsString;

/// `foldedIndex`: the lowercase key → value index; the FIRST key to fold onto a slot keeps it.
pub fn folded_index<V: Clone>(map: &IndexMap<JsString, V>) -> IndexMap<JsString, V> {
    let mut out = IndexMap::new();
    for (k, v) in map {
        out.entry(k.to_lower_case()).or_insert_with(|| v.clone());
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
    if written.len() > 1 || fold_single { folded.get(&written.to_lower_case()) } else { None }
}
