//! Hindi's hand-authored data (`hindi.jsonc`), loaded once and typed as the `HindiDef` that the Indic family
//! shares (mr, gu and the rest load their own files through the same struct).
//! Ported from src/languages/hindi/manifest.ts and the `HindiDef` interface in hindi.ts.

use std::sync::OnceLock;

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::abugida::AbugidaDef;
use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::SymbolData;
use crate::core::numbers::NumbersDef;

pub const DIR: &str = "languages/hindi";

#[derive(Debug, Deserialize, Clone)]
pub struct Rule {
    pub from: String,
    pub to: String,
}

#[derive(Debug, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SchwaDeletion {
    pub delete_word_final: Option<bool>,
    pub retain_in_monosyllable: Option<bool>,
    pub retain_final_after_cluster: Option<bool>,
    pub retain_on_avagraha: Option<bool>,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct OrdinalSuffixes {
    pub regular: IndexMap<String, usize>,
    pub suppletive_consonants: IndexMap<String, String>,
    pub vowel_forms: IndexMap<String, usize>,
}

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct HindiDef {
    #[serde(flatten)]
    pub abugida: AbugidaDef,
    pub post_rules: Vec<Rule>,
    pub final_rules: Vec<Rule>,
    pub numbers: NumbersDef,
    pub schwa_deletion: SchwaDeletion,
    pub clause_punctuation: IndexMap<String, String>,
    pub symbols: Option<IndexMap<String, String>>,
    pub strip_symbols: Option<String>,
    /// The shared symbol tier's data, not the bare-sign `symbols` map. The core `SymbolData` (every field
    /// optional) is a superset of the TS `symbolTier` type.
    pub symbol_tier: Option<SymbolData>,
    /// ⚠ REQUIRED in the TS interface, but 8 of the 9 sibling manifests omit it (the cast hides that) and
    /// `makeHindiNormalizer` then falls back to Hindi's, so it is optional here.
    pub irregular_ordinals: Option<IndexMap<String, Vec<String>>>,
    pub ordinal_suffixes: Option<OrdinalSuffixes>,
}

/// The manifest, or why it could not be loaded. Cached only on success.
pub fn try_manifest() -> Result<&'static HindiDef, String> {
    static M: OnceLock<HindiDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "hindi.jsonc").map_err(|e| e.to_string())
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::data_source::read_data_text;
    use crate::core::jsonc::parse_jsonc;

    /// `HindiDef` is shared: every family manifest must load through it.
    #[test]
    fn family_manifests_load_as_hindi_def() {
        for dir in [
            "marathi",
            "nepali",
            "awadhi",
            "bhojpuri",
            "maithili",
            "magahi",
            "chhattisgarhi",
            "rangpuri",
            "gujarati",
        ] {
            let r: Result<HindiDef, _> =
                load_manifest(&format!("languages/{dir}"), &format!("{dir}.jsonc"));
            assert!(r.is_ok(), "{dir}: {}", r.err().unwrap());
        }
    }

    /// Every key the file declares is one the struct names, or one the TS never reads.
    #[test]
    fn manifest_claims_every_key() {
        let v: serde_json::Value =
            parse_jsonc(&read_data_text("languages/hindi/hindi.jsonc").unwrap()).unwrap();
        let claimed = [
            "language",
            "inherentVowel",
            "consonants",
            "independentVowels",
            "vowelSigns",
            "signs",
            "nasalVowelsAreShort",
            "postRules",
            "finalRules",
            "numbers",
            "schwaDeletion",
            "clausePunctuation",
            "symbols",
            "stripSymbols",
            "symbolTier",
            "irregularOrdinals",
            "ordinalSuffixes",
        ];
        let doc_only = ["name", "script", "provenance"];
        for k in v.as_object().unwrap().keys() {
            assert!(
                claimed.contains(&k.as_str()) || doc_only.contains(&k.as_str()),
                "unclaimed key {k}"
            );
        }
        let tier = [
            "percent",
            "currency",
            "units",
            "rateDenominators",
            "unitPer",
            "magnitudes",
            "magnitudeConnective",
            "ampersand",
            "multiply",
            "exponentWords",
            "bareExponent",
        ];
        for k in v["symbolTier"].as_object().unwrap().keys() {
            assert!(tier.contains(&k.as_str()), "unclaimed symbolTier key {k}");
        }
        let m = try_manifest().unwrap();
        assert_eq!(m.abugida.consonants.len(), 42);
        assert!(m.schwa_deletion.delete_word_final == Some(true));
        assert_eq!(m.numbers.decimal_word.as_deref(), Some("दशमलव"));
        assert!(m.symbol_tier.as_ref().unwrap().bare_exponent.is_some());
    }
}
