//! Korean (ko) phonemizer, Seoul standard: the symbol tier, then normalize.ts, then Hangul words through the
//! g2p, digit runs as Sino-Korean words and clause punctuation as pauses.
//! Ported from src/languages/korean/korean.ts — see that file for the corpus evidence.

use std::collections::HashMap;
use std::sync::OnceLock;

use super::g2p::{phonemize_word, try_tens_lexicon};
use super::manifest::{table, try_manifest};
use super::normalize::normalize_korean;
use super::numbers::{number_to_words, spell_digits};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, js_number};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// The shared symbol tier over `percent`, `currency` and `multiply`, exactly the fields korean.ts passes.
fn symbol_tier() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let t = &try_manifest()?.symbol_tier;
        make_symbol_normalizer(&SymbolData {
            percent: Some(t.percent.clone()),
            currency: Some(t.currency.clone()),
            multiply: Some(t.multiply.clone()),
            ..Default::default()
        })
    })
}

pub struct KoreanPhonemizer {
    symbols: &'static SymbolNormalizer,
    clause: HashMap<JsString, JsString>,
}

impl KoreanPhonemizer {
    pub fn text(&self, input: &JsString) -> JsString {
        let token = js_re!(r"([가-힣]+)|(\d+)|([.!?…,;:])", "gu");
        assemble_clauses(
            &normalize_korean(&self.symbols.apply(input)),
            token,
            |m, s, sink| {
                if let Some(word) = m.group(1, s).filter(|g| !g.is_empty()) {
                    sink.emit(&phonemize_word(&word));
                } else if let Some(digits) = m.group(2, s).filter(|g| !g.is_empty()) {
                    let words = number_to_words(js_number(&digits));
                    let words = if words.is_empty() {
                        spell_digits(&digits)
                    } else {
                        words
                    };
                    sink.emit(&phonemize_word(&words));
                } else if let Some(mark) = m.group(3, s).filter(|g| !g.is_empty())
                    && let Some(mk) = self.clause.get(&mark).filter(|k| !k.is_empty())
                {
                    sink.pause(mk);
                }
            },
        )
    }
}

impl Engine for KoreanPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(KoreanPhonemizer::text(self, input))
    }
}

/// Build the Korean phonemizer. Loads every table `text` reads, so `text` cannot fail later.
pub fn create_korean() -> Result<KoreanPhonemizer, String> {
    let m = try_manifest()?;
    try_tens_lexicon()?;
    Ok(KoreanPhonemizer {
        symbols: symbol_tier()?,
        clause: table(&m.clause_punctuation),
    })
}

#[cfg(test)]
mod tests {
    use crate::phonemize;

    /// Relational, as korean.ts states it: a digit run past 2^53 is read digit at a time, not deleted, a safe
    /// one is the Sino-Korean number word, and a grouping comma is not a clause break.
    #[test]
    fn digit_runs_read_as_sino_korean() {
        let say = |s: &str| phonemize(s, "ko").unwrap();
        assert_eq!(
            say("12345678901234567890"),
            say("일이삼사오육칠팔구영일이삼사오육칠팔구영")
        );
        assert_eq!(say("2024"), say("이천이십사"));
        assert_eq!(say("1,000명"), say("천명"));
    }
}
