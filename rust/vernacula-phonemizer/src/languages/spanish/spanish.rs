//! Spanish (es) phonemizer: canonical IPA, broad Castilian. The rule g2p, spirantization (within the word and
//! across word edges), rule stress, and text() over words, numbers and clause punctuation.
//! Ported from src/languages/spanish/spanish.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::LazyLock;

use super::g2p::{Seg, to_segments};
use super::manifest::{MANIFEST, try_manifest};
use super::normalize::{normalize_spanish, normalize_spanish_initialisms};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{
    BareExponent, ExponentWords, Multiply, SymbolData, SymbolNormalizer, make_symbol_normalizer,
};
use crate::core::trace::note_rewrite;
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

static NASALS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.nasals.iter().map(|n| js(n)).collect());

fn stop_to_fric(ph: &JsString) -> Option<JsString> {
    MANIFEST
        .spirantize
        .get(&ph.to_string_lossy())
        .map(|f| js(f))
}

/// `spirantize`: b/d/ɡ → β/ð/ɣ except word-initially, after a nasal, or d after l.
fn spirantize(segs: &mut [Seg]) {
    for i in 0..segs.len() {
        let Some(fric) = stop_to_fric(&segs[i].ph) else {
            continue;
        };
        let prev = if i > 0 {
            segs[i - 1].ph.clone()
        } else {
            JsString::new()
        };
        let stop = i == 0 || NASALS.contains(&prev) || (segs[i].ph == "d" && prev == "l");
        if !stop {
            segs[i].ph = fric;
        }
    }
}

/// `spirantizeAcrossWords`: the same rule across a word edge of the ASSEMBLED string, reported to the trace
/// as a positional rewrite.
fn spirantize_across_words(ipa: &JsString) -> JsString {
    let out = js_re!(r"([^\s])(\s+)([bdɡ])", "gu").replace_with(ipa, |m, s| {
        let whole = m.value(s);
        let (prev, gap, stop) = (
            m.group(1, s).unwrap(),
            m.group(2, s).unwrap(),
            m.group(3, s).unwrap(),
        );
        if NASALS.contains(&prev) {
            return whole;
        }
        if stop == "ɡ" && prev == "n" {
            return whole;
        }
        if stop == "d" && prev == "l" {
            return whole;
        }
        if !js_re!(r"[\p{L}\p{M}ˈˌ]", "u").test(&prev) {
            return whole;
        }
        prev.concat(&gap)
            .concat(&stop_to_fric(&stop).unwrap_or(stop))
    });
    note_rewrite("spirantize-across-words", ipa, &out, true);
    out
}

/// `stressedNucleus`: the written accent, else the penult (word ends in a vowel, n or s) or the final nucleus.
fn stressed_nucleus(word: &JsString, segs: &[Seg]) -> Option<usize> {
    let nuclei: Vec<usize> = segs
        .iter()
        .enumerate()
        .filter(|(_, s)| s.nucleus)
        .map(|(i, _)| i)
        .collect();
    if nuclei.is_empty() {
        return None;
    }
    if let Some(&a) = nuclei.iter().find(|&&i| segs[i].accent) {
        return Some(a);
    }
    if nuclei.len() == 1 {
        return Some(nuclei[0]);
    }
    let w = word.to_lower_case();
    let last = if w.is_empty() {
        JsString::new()
    } else {
        w.char_at(w.len() - 1)
    };
    let penult = js_re!("[aeiouáéíóú]$", "i").test(&w) || last == "n" || last == "s";
    Some(if penult {
        nuclei[nuclei.len() - 2]
    } else {
        nuclei[nuclei.len() - 1]
    })
}

/// `phonemizeWord`: one Spanish word to canonical IPA, with its stress mark.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let mut segs = to_segments(word);
    if segs.is_empty() {
        return JsString::new();
    }
    spirantize(&mut segs);
    let stress = stressed_nucleus(word, &segs);
    let mut out = JsString::new();
    for (i, s) in segs.iter().enumerate() {
        if Some(i) == stress {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&s.ph);
    }
    out
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"({})|(\d+(?:(?<!(?<!\d)0)\.\d+)*(?:,\d+)?)|([.!?…,;:])",
            *LATIN_RUN
        ),
        "giu",
    )
    .unwrap()
});

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser("[a-záéíóúüñ]", "iu")));

/// `numberTokenToWords`: thousands dots dropped, a decimal comma read digit by digit.
fn number_token_to_words(tok: &JsString) -> JsString {
    let parts = tok.split(&js(","));
    let int_raw = js_re!(r"\.", "g").replace(&parts[0], &JsString::new());
    let mut words = number_to_words(js_number(&int_raw), Some(&int_raw));
    if let Some(frac) = parts.get(1) {
        let digits: Vec<JsString> = frac
            .code_point_strings()
            .iter()
            .map(|d| number_to_words(js_number(d), None))
            .collect();
        words = words
            .concat(&js(&format!(" {} ", MANIFEST.numbers.decimal_connector)))
            .concat(&JsString::join(&digits, &js(" ")));
    }
    words
}

static FUNCTION_WORDS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.function_words.iter().map(|w| js(w)).collect());

/// `wordIpa`: a running-text word, its stress mark dropped (the first) if it is an unstressed function word.
fn word_ipa(word: &JsString) -> JsString {
    let ipa = phonemize_word(word);
    if FUNCTION_WORDS.contains(&word.to_lower_case()) {
        js_re!("ˈ").replace(&ipa, &JsString::new())
    } else {
        ipa
    }
}

/// The Spanish engine (`createSpanish`); `americas` is es-419's first-of-the-month ordinal.
pub struct SpanishPhonemizer {
    americas: bool,
    symbols: SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `SpanishPhonemizer` proves the manifest loaded,
/// so none of these can reach the `MANIFEST` panic. (The per-module differentials call them.)
impl SpanishPhonemizer {
    /// `normalizeSpanish(text, { americas })`.
    pub fn normalize(&self, text: &JsString, americas: bool) -> JsString {
        normalize_spanish(text, americas)
    }

    /// `normalizeSpanishInitialisms(text)`.
    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_spanish_initialisms(text)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `toSegments(word)` (g2p.ts).
    pub fn segments(&self, word: &JsString) -> Vec<Seg> {
        to_segments(word)
    }

    /// `numberToWords(n, raw)` (numbers.ts).
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    /// `spanishOrdinal(n)` (romanOrdinals.ts).
    pub fn ordinal(&self, n: f64) -> Option<JsString> {
        super::roman_ordinals::spanish_ordinal(n)
    }
}

impl SpanishPhonemizer {
    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self
            .symbols
            .apply(&normalize_spanish_initialisms(&normalize_spanish(
                input,
                self.americas,
            )));
        let assembled = assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                sink.emit(&word_ipa(&NAT(&w)));
            } else if let Some(n) = m.group(2, s) {
                let words: Vec<JsString> = number_token_to_words(&n)
                    .split(&js(" "))
                    .iter()
                    .map(word_ipa)
                    .collect();
                sink.emit(&JsString::join(&words, &js(" ")));
            } else if let Some(p) = m.group(3, s) {
                if let Some(mk) = MANIFEST
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
                {
                    sink.pause(&js(mk));
                }
            }
        });
        spirantize_across_words(&assembled)
    }
}

impl Engine for SpanishPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(SpanishPhonemizer::text(self, input))
    }
}

/// `createSpanish(americas)`. Errors when the manifest cannot be loaded or the symbol tier refuses it.
pub fn create_spanish(americas: bool) -> Result<SpanishPhonemizer, String> {
    let m = try_manifest()?;
    let st = &m.symbol_tier;
    let symbols = make_symbol_normalizer(&SymbolData {
        multiply: Some(Multiply {
            times: m.sign_words.times.clone(),
            by: None,
        }),
        ampersand: Some(m.sign_words.ampersand.clone()),
        percent: Some(st.percent.clone()),
        currency: Some(st.currency.clone()),
        units: Some(st.units.clone()),
        exponent_words: Some(ExponentWords {
            squared: Some(st.exponent_words.squared.clone()),
            cubed: Some(st.exponent_words.cubed.clone()),
            position: None,
        }),
        bare_exponent: Some(BareExponent {
            squared: Some(st.bare_exponent.squared.clone()),
            cubed: Some(st.bare_exponent.cubed.clone()),
            power: Some(st.bare_exponent.power.clone()),
            negative: Some(st.bare_exponent.negative.clone()),
        }),
        magnitudes: Some(st.magnitudes.clone()),
        magnitude_connective: Some(st.magnitude_connective.clone()),
        ..Default::default()
    })?;
    Ok(SpanishPhonemizer { americas, symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn words_stress_and_spirantization() {
        let p = |w: &str| phonemize_word(&js(w)).to_string_lossy();
        assert_eq!(p("gato"), "ɡˈato");
        assert_eq!(p("nada"), "nˈaða");
        assert_eq!(p("cielo"), "θjˈelo");
        assert_eq!(p("examen"), "eksˈamen");
    }

    #[test]
    fn spirantization_crosses_the_word_edge_but_not_a_pause() {
        let e = create_spanish(false).unwrap();
        assert_eq!(e.text(&js("la duda")).to_string_lossy(), "la ðˈuða");
        assert_eq!(e.text(&js("un dato")).to_string_lossy(), "un dˈato");
    }
}
