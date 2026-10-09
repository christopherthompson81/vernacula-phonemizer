//! Brazilian Portuguese (pt-BR): the pt engine in `Dialect::Bp`, plus the BP open/close override lexicon on
//! each word's stressed vowel. Ported from src/languages/portuguese-br/portuguese-br.ts — see that file for
//! the evidence.

use std::sync::{Arc, OnceLock};

use indexmap::IndexMap;

use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, js};
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};
use crate::js_re;
use crate::languages::portuguese::g2p::Dialect;
use crate::languages::portuguese::portuguese::{
    PortuguesePhonemizer, create_portuguese, phonemize_word as phonemize_word_pt,
};
use crate::registry::PhonemizeError;

pub const DIR: &str = "languages/portuguese-br";

type OpenCloseLexicon = IndexMap<JsString, JsString>;

fn try_lex() -> Result<&'static OpenCloseLexicon, PhonemizeError> {
    static L: OnceLock<OpenCloseLexicon> = OnceLock::new();
    load_once(&L, || {
        load_tsv_strings(
            DIR,
            "pt-br-openclose.tsv",
            TsvOptions {
                optional: true,
                ..Default::default()
            },
        )
        .map_err(|e| e.to_string())
    })
    .map_err(PhonemizeError::Data)
}

/// `openClose` with the lexicon loaded: replace the stressed vowel (the code point after ˈ) with its target.
fn open_close_with(lex: &OpenCloseLexicon, ipa: &JsString, word: &JsString) -> JsString {
    match lex.get(word).filter(|t| !t.is_empty()) {
        Some(t) => js_re!("ˈ.", "u").replace(ipa, &js("ˈ").concat(t)),
        None => ipa.clone(),
    }
}

/// `openClose(ipa, word)`.
pub fn open_close(ipa: &JsString, word: &JsString) -> Result<JsString, PhonemizeError> {
    Ok(open_close_with(try_lex()?, ipa, word))
}

/// `phonemizeWord(word)`: the shipped path (rules in BP mode + the open/close lexicon).
pub fn phonemize_word(word: &JsString) -> Result<JsString, PhonemizeError> {
    open_close(
        &phonemize_word_pt(word, Dialect::Bp)?,
        &word.to_lower_case(),
    )
}

/// `phonemizeWordRules(word)`: rule-only, the referee eval's non-circular path.
pub fn phonemize_word_rules(word: &JsString) -> Result<JsString, PhonemizeError> {
    phonemize_word_pt(word, Dialect::Bp)
}

/// `createPortugueseBR()`.
pub fn create_portuguese_br() -> Result<Arc<PortuguesePhonemizer>, PhonemizeError> {
    let lex = try_lex()?;
    create_portuguese(
        Dialect::Bp,
        Some(Arc::new(move |ipa: &JsString, word: &JsString| {
            open_close_with(lex, ipa, word)
        })),
    )
}
