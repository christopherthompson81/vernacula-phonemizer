//! Japanese (ja) phonemizer, Standard/Tokyo: normalize → number+counter fusion → bunsetsu segmentation →
//! per run kanji→kana, kana→morae, pitch downstep. Ported from src/languages/japanese/japanese.ts — see
//! that file for the corpus evidence.

use std::sync::OnceLock;

use super::counters::read_counter;
use super::{from_code_point, load_once, strip_non_kana, to_katakana};
use super::kana::{kana_to_ipa, segments_to_morae};
use super::kanji::{apply_reading_segments, apply_readings, heads_compound, segment_text, try_readings};
use super::manifest::{T, try_manifest};
use super::normalize::normalize_japanese;
use super::numbers::number_to_kana;
use super::pitch::{accent_nucleus, place_downstep, try_lex};

use crate::core::clauses::assemble_clauses;
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::js_string::{JsString, js_number};
use crate::core::provenance::rewrite_with;
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

fn token() -> &'static crate::core::js_regex::JsRegex {
    js_re!(r"([㐀-鿿\u{20000}-\u{2a6df}々〻ぁ-ゖァ-ヺー゛゜]+)|(\d+)|([。．.！!？?、，,])", "gu")
}

/// The shared symbol tier over `symbolTier`'s eight fields, exactly the ones japanese.ts passes.
fn symbol_tier() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let t = &try_manifest()?.symbol_tier;
        make_symbol_normalizer(&SymbolData {
            percent: Some(t.percent.clone()),
            currency: Some(t.currency.clone()),
            units: Some(t.units.clone()),
            exponent_words: Some(t.exponent_words.to_shared()),
            bare_exponent: Some(t.bare_exponent.to_shared()),
            unspaced_script: Some(t.unspaced_script),
            ampersand: Some(t.ampersand.clone()),
            multiply: Some(t.multiply.clone()),
            ..Default::default()
        })
    })
}

/// The lexica every `text` path reads, loaded (lazily, once) or the reason they cannot be. The TS loads them on
/// first use and throws when they are missing; here that is a `Data` error, and a later call retries.
fn ensure_lexica() -> Result<(), PhonemizeError> {
    try_readings().map_err(PhonemizeError::Data)?;
    try_lex().map_err(PhonemizeError::Data)?;
    Ok(())
}

pub struct JapanesePhonemizer {
    symbols: &'static SymbolNormalizer,
}

impl JapanesePhonemizer {
    /// The engine proper. Private: every entry goes through `ensure_lexica` first, so the panicking
    /// accessors below it are never reached without their data.
    fn render(&self, input: &JsString) -> JsString {
        let input = normalize_japanese(&self.symbols.apply(input));
        let input = rewrite_with(&input, js_re!(r"[０-９]", "gu"), |m, s| {
            from_code_point(m.value(s).code_point_at(0).unwrap() - 0xfee0)
        });
        let input = rewrite_with(&input, js_re!(r"(\d+)(\p{Script=Han}|つ)", "gu"), |m, s| {
            let m0 = m.value(s);
            let num = m.group(1, s).unwrap();
            let ctr = m.group(2, s).unwrap();
            if heads_compound(&JsString::from_units(&s.0[m.index() + num.len()..])) {
                return m0;
            }
            match read_counter(js_number(&num), &ctr) {
                None => m0,
                Some(r) => to_katakana(&r),
            }
        });
        assemble_clauses(&segment_text(&input), token(), |m, s, sink| {
            if let Some(run) = m.group(1, s).filter(|g| !g.is_empty()) {
                let segments = reading_segments(&run);
                let reading = JsString::join(&segments, &JsString::new());
                if let Some(morae) = segments_to_morae(&segments) {
                    sink.emit(&place_downstep(&morae, accent_nucleus(&run, &reading)));
                }
            } else if let Some(digits) = m.group(2, s).filter(|g| !g.is_empty()) {
                if let Some(ipa) = kana_to_ipa(&number_to_kana(js_number(&digits), Some(&digits))) {
                    if !ipa.is_empty() {
                        sink.emit(&ipa);
                    }
                }
            } else if let Some(p) = m.group(3, s).filter(|g| !g.is_empty()) {
                if let Some(mk) = T.clause.get(&p) {
                    if !mk.is_empty() {
                        sink.pause(mk);
                    }
                }
            }
        })
    }
}

impl Engine for JapanesePhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        ensure_lexica()?;
        Ok(self.render(input))
    }
}

/// Reading segments for a word, with each segment's unresolved remainder stripped and empties dropped.
fn reading_segments(word: &JsString) -> Vec<JsString> {
    apply_reading_segments(word)
        .iter()
        .map(strip_non_kana)
        .filter(|s| !s.is_empty())
        .collect()
}

/// One Japanese word → canonical IPA (kanji readings + pitch downstep).
pub fn phonemize_word(word: &JsString) -> Result<JsString, PhonemizeError> {
    ensure_lexica()?;
    let segments = reading_segments(word);
    let reading = JsString::join(&segments, &JsString::new());
    Ok(match segments_to_morae(&segments) {
        None => JsString::new(),
        Some(morae) => place_downstep(&morae, accent_nucleus(word, &reading)),
    })
}

/// One Japanese word → canonical IPA, segmental only (no downstep).
pub fn phonemize_word_segmental(word: &JsString) -> Result<JsString, PhonemizeError> {
    ensure_lexica()?;
    Ok(kana_to_ipa(&strip_non_kana(&apply_readings(word))).unwrap_or_default())
}

/// Build the Japanese phonemizer; its manifest must load (the TS reads it at import).
pub fn create_japanese() -> Result<JapanesePhonemizer, String> {
    try_manifest()?;
    Ok(JapanesePhonemizer { symbols: symbol_tier()? })
}

#[cfg(test)]
mod tests {
    /// Expectations are the TS engine's output (`phonemize(t, "ja")`), not hand-typed IPA.
    #[test]
    fn matches_the_typescript_on_the_counter_ruby_and_initialism_arms() {
        for (text, want) in [
            ("1本のペン", "ippo̞nno̞pe̞ɴ"),
            ("3分の1", "säɴ bɯᵝnno̞ it͡ɕi"),
            ("FBIとCEO", "e̞ɸɯᵝbiːäꜜi to̞ ɕiꜜː iːo̞ː"),
            ("私は東京へ行く", "wätäɕiwä to̞ːkʲo̞ːe̞ ikɯᵝ"),
        ] {
            assert_eq!(crate::phonemize(text, "ja").unwrap(), want, "{text}");
        }
    }
}
