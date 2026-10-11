//! Dutch morphological decomposition: Dutch's affix lists and its stem wordlist (nl-stems.txt) over the shared
//! West-Germanic engine in core/germanic_morphology.rs, with a static linking-element order.
//! Ported from src/languages/dutch/morphology.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{LazyLock, OnceLock};

use super::manifest::{DIR, MANIFEST};
use crate::core::data_path::data_file;
use crate::core::data_source::read_data_text;
use crate::core::germanic_morphology::{Decomp, Decomposer, MorphologyConfig, js_set};
use crate::core::js_string::{JsString, js};

/// `stems()`: one word per line, trimmed and lowercased. ⚠ As in the TS, a read failure leaves the set EMPTY
/// and that empty set is kept (the splitter is then a no-op); it is not retried.
fn stems() -> &'static HashSet<JsString> {
    static S: OnceLock<HashSet<JsString>> = OnceLock::new();
    S.get_or_init(|| {
        let mut set = HashSet::new();
        if let Ok(text) = read_data_text(&data_file(DIR, "nl-stems.txt")) {
            for line in text.split('\n') {
                let w = js(line).trim().to_lower_case();
                if !w.is_empty() {
                    set.insert(w);
                }
            }
        }
        set
    })
}

fn list(l: &[String]) -> Vec<JsString> {
    l.iter().map(|s| js(s)).collect()
}

static DECOMPOSER: LazyLock<Decomposer> = LazyLock::new(|| {
    let mm = &MANIFEST.morphology;
    let links = list(&mm.linking_elements);
    Decomposer::new(MorphologyConfig {
        vowels: js(&MANIFEST.vowel_letters),
        prefix_unstressed: list(&mm.prefix_unstressed),
        prefix_stressed: list(&mm.prefix_stressed),
        ambiguous_prefixes: js_set(&mm.ambiguous_prefixes),
        suffixes: list(&mm.suffixes),
        vowel_initial_suffixes: js_set(&mm.vowel_initial_suffixes),
        reliable_cons_suffixes: HashSet::new(),
        links_for: Box::new(move |_| links.clone()),
        valid_onsets: js_set(&mm.valid_onsets),
        st_keep: js_set(&mm.st_keep),
        is_word: Box::new(|w| stems().contains(w)),
        is_constituent: Box::new(|w| w.len() >= 3 && stems().contains(w)),
        negation_prefix: None,
        negation_follows: None,
        real_word_stressed_prefixes: Some(js_set(&mm.prefix_stressed)),
        suffix_digraph_guard: None,
        seam_element_initial: None,
        whole_verb_suffix: None,
        min_trailing_constituent: Some(4),
        dont_split_known_words: true,
    })
});

/// `isLexicalWord(w)`: is `w` a single known dictionary word?
pub(crate) fn is_lexical_word(w: &JsString) -> bool {
    stems().contains(w)
}

/// `decompose(word)`: ordered morphemes with a stress hint.
pub(crate) fn decompose(word: &JsString) -> Decomp {
    DECOMPOSER.decompose(word)
}
