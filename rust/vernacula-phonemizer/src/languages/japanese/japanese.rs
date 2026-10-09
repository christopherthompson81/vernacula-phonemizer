//! Japanese (ja) phonemizer, Standard/Tokyo: normalize → number+counter fusion → bunsetsu segmentation →
//! per run kanji→kana, kana→morae, pitch downstep. Ported from src/languages/japanese/japanese.ts — see
//! that file for the corpus evidence.

use super::counters::read_counter;
use super::from_code_point;
use super::kana::{kana_to_ipa, segments_to_morae};
use super::kanji::{apply_reading_segments, apply_readings, heads_compound, segment_text, try_readings};
use super::manifest::{T, try_manifest};
use super::normalize::normalize_japanese;
use super::numbers::number_to_kana;
use super::pitch::{accent_nucleus, place_downstep, try_lex};
use crate::core::clauses::assemble_clauses;
use crate::core::js_string::{JsString, js_number};
use crate::core::provenance::rewrite_with;
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// Hiragana → katakana, so segmentText's は→わ heuristic cannot touch an injected counter reading.
fn to_katakana(s: &JsString) -> JsString {
    js_re!(r"[ぁ-ゖ]", "gu").replace_with(s, |m, s| {
        from_code_point(m.value(s).code_point_at(0).unwrap() + 0x60)
    })
}

fn token() -> &'static crate::core::js_regex::JsRegex {
    js_re!(r"([㐀-鿿\u{20000}-\u{2a6df}々〻ぁ-ゖァ-ヺー゛゜]+)|(\d+)|([。．.！!？?、，,])", "gu")
}

/// TODO(#1463, makeSymbolNormalizer): the shared symbol tier is ported on `rust-lang-es` and cherry-picked
/// here; until then this is the identity, and rows carrying %, a currency sign, a unit, an exponent, & or
/// a multiplication sign are expected to differ.
fn symbols(input: &JsString) -> JsString {
    input.clone()
}

pub struct JapanesePhonemizer;

impl JapanesePhonemizer {
    pub fn text(&self, input: &JsString) -> JsString {
        let input = normalize_japanese(&symbols(input));
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
        // The TS loads its lexica on first use and throws when they are missing; here that is an error.
        try_readings().map_err(PhonemizeError::Data)?;
        try_lex().map_err(PhonemizeError::Data)?;
        Ok(JapanesePhonemizer::text(self, input))
    }
}

/// Reading segments for a word, with each segment's unresolved remainder stripped and empties dropped.
fn reading_segments(word: &JsString) -> Vec<JsString> {
    apply_reading_segments(word)
        .iter()
        .map(|s| js_re!(r"[^ぁ-ゖァ-ヺー]", "gu").replace(s, &JsString::new()))
        .filter(|s| !s.is_empty())
        .collect()
}

/// One Japanese word → canonical IPA (kanji readings + pitch downstep).
pub fn phonemize_word(word: &JsString) -> JsString {
    let segments = reading_segments(word);
    let reading = JsString::join(&segments, &JsString::new());
    match segments_to_morae(&segments) {
        None => JsString::new(),
        Some(morae) => place_downstep(&morae, accent_nucleus(word, &reading)),
    }
}

/// One Japanese word → canonical IPA, segmental only (no downstep).
pub fn phonemize_word_segmental(word: &JsString) -> JsString {
    let stripped = js_re!(r"[^ぁ-ゖァ-ヺー]", "gu").replace(&apply_readings(word), &JsString::new());
    kana_to_ipa(&stripped).unwrap_or_default()
}

/// Build the Japanese phonemizer; its manifest must load (the TS reads it at import).
pub fn create_japanese() -> Result<JapanesePhonemizer, String> {
    try_manifest()?;
    Ok(JapanesePhonemizer)
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
