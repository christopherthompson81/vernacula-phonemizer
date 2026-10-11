//! German morphological decomposition: German's config (affixes, Fugen-s, the content-stem lexicon and its
//! quirks) over the shared West-Germanic engine in core/germanic_morphology.rs.
//! Ported from src/languages/german/morphology.ts — see that file for the corpus evidence.

use std::collections::HashMap;
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::manifest::{DIR, MANIFEST};
use crate::core::data_source::load_once;
use crate::core::germanic_morphology::{Decomp, Decomposer, MorphologyConfig, js_set};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};

/// lexicon.tsv: word → flags (k = compound constituent, N = noun, s = takes Fugen-s).
pub(crate) fn try_lexicon() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static L: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&L, || {
        load_tsv_strings(
            DIR,
            "lexicon.tsv",
            TsvOptions {
                optional: true,
                ..Default::default()
            },
        )
        .map_err(|e| e.to_string())
    })
}

fn lexicon() -> &'static IndexMap<JsString, JsString> {
    try_lexicon().unwrap_or_else(|e| panic!("{e}"))
}

fn flags_include(w: &JsString, flag: &str) -> bool {
    lexicon().get(w).is_some_and(|f| f.includes(&js(flag)))
}

fn list(l: &[String]) -> Vec<JsString> {
    l.iter().map(|s| js(s)).collect()
}

/// `PREFIX_IPA` / `SUFFIX_IPA`.
pub(crate) static PREFIX_IPA: LazyLock<HashMap<JsString, JsString>> = LazyLock::new(|| {
    MANIFEST
        .morphology
        .prefix_ipa
        .iter()
        .map(|(k, v)| (js(k), js(v)))
        .collect()
});
pub(crate) static SUFFIX_IPA: LazyLock<HashMap<JsString, JsString>> = LazyLock::new(|| {
    MANIFEST
        .morphology
        .suffix_ipa
        .iter()
        .map(|(k, v)| (js(k), js(v)))
        .collect()
});

static DECOMPOSER: LazyLock<Decomposer> = LazyLock::new(|| {
    let mm = &MANIFEST.morphology;
    let links_default = list(&mm.linking_elements);
    Decomposer::new(MorphologyConfig {
        vowels: js("aeiouäöüy"),
        prefix_unstressed: list(&mm.prefix_unstressed),
        prefix_stressed: list(&mm.prefix_stressed),
        ambiguous_prefixes: js_set(&mm.ambiguous_prefixes),
        suffixes: list(&mm.suffixes),
        vowel_initial_suffixes: js_set(&mm.vowel_initial_suffixes),
        reliable_cons_suffixes: js_set(&["nis".to_string()]),
        links_for: Box::new(move |head| {
            if flags_include(head, "s") {
                std::iter::once(js("s"))
                    .chain(links_default.iter().cloned())
                    .collect()
            } else {
                links_default.clone()
            }
        }),
        valid_onsets: js_set(&mm.valid_onsets),
        st_keep: js_set(&mm.st_keep_words),
        is_word: Box::new(|w| lexicon().contains_key(w)),
        is_constituent: Box::new(|w| w.len() >= 3 && flags_include(w, "k")),
        negation_prefix: Some(js("un")),
        negation_follows: Some(JsRegex::new("^(ge|be|ver|zer|ent)", "").unwrap()),
        real_word_stressed_prefixes: Some(js_set(&["mit".to_string()])),
        suffix_digraph_guard: Some(Box::new(|s, stem| {
            s.starts_with(&js("ch")) && stem.ends_with(&js("s"))
        })),
        seam_element_initial: Some(JsRegex::new("^(st|sp|sch)", "").unwrap()),
        whole_verb_suffix: Some(js("en")),
        min_trailing_constituent: None,
        dont_split_known_words: false,
    })
});

/// `decompose(word)`: ordered morphemes with a stress hint.
pub(crate) fn decompose(word: &JsString) -> Decomp {
    DECOMPOSER.decompose(word)
}
