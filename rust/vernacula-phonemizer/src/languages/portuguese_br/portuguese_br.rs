//! Brazilian Portuguese (pt-BR): the pt engine in `Dialect::Bp`, plus the BP open/close override lexicon on
//! each word's stressed vowel. Ported from src/languages/portuguese-br/portuguese-br.ts — see that file for
//! the evidence.

use std::sync::{Arc, OnceLock};

use indexmap::IndexMap;

use crate::core::js_string::{JsString, js};
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};
use crate::js_re;
use crate::languages::portuguese::g2p::Dialect;
use crate::languages::portuguese::portuguese::{
    PortuguesePhonemizer, create_portuguese, phonemize_word as phonemize_word_pt,
};
use crate::registry::PhonemizeError;

pub const DIR: &str = "languages/portuguese-br";

fn try_lex() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static L: OnceLock<Result<IndexMap<JsString, JsString>, String>> = OnceLock::new();
    L.get_or_init(|| {
        load_tsv_strings(DIR, "pt-br-openclose.tsv", TsvOptions { optional: true, ..Default::default() })
            .map_err(|e| e.to_string())
    })
    .as_ref()
    .map_err(Clone::clone)
}

/// `openClose(ipa, word)`: replace the stressed vowel (the code point after ˈ) with the lexicon's target.
pub fn open_close(ipa: &JsString, word: &JsString) -> JsString {
    let lex = try_lex().unwrap_or_else(|e| panic!("{e}"));
    match lex.get(word).filter(|t| !t.is_empty()) {
        Some(t) => js_re!("ˈ.", "u").replace(ipa, &js("ˈ").concat(t)),
        None => ipa.clone(),
    }
}

/// `phonemizeWord(word)`: the shipped path (rules in BP mode + the open/close lexicon).
pub fn phonemize_word(word: &JsString) -> JsString {
    open_close(&phonemize_word_pt(word, Dialect::Bp), &word.to_lower_case())
}

/// `phonemizeWordRules(word)`: rule-only, the referee eval's non-circular path.
pub fn phonemize_word_rules(word: &JsString) -> JsString {
    phonemize_word_pt(word, Dialect::Bp)
}

/// `createPortugueseBR()`.
pub fn create_portuguese_br() -> Result<Arc<PortuguesePhonemizer>, PhonemizeError> {
    try_lex().map_err(PhonemizeError::Data)?;
    create_portuguese(Dialect::Bp, Some(open_close))
}
