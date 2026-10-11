//! Russian (ru) phonemizer: standard Moscow Russian, canonical IPA. Lexical stress from stress.tsv (ё restored
//! from е, an inflected adjective's stress from its lemma, else the first vowel) into the rule g2p, and text()
//! over Cyrillic words, numbers and clause punctuation.
//! Ported from src/languages/russian/russian.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::g2p::to_ipa;
use super::manifest::{DIR, EndingType, MANIFEST, try_manifest};
use super::normalize::{normalize_russian, normalize_russian_initialisms};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_map};
use crate::core::normalize_symbols::{
    SymbolData, SymbolNormalizer, UnitPer, make_symbol_normalizer, slavic_count_form,
};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// stress.tsv (word → the JS number of its stressed vowel's ordinal) and hard-e.tsv (word → vowel ordinals
/// whose preceding consonant is hard). The TS loads each on first use; here `create_russian` loads both.
pub struct Dicts {
    stress: IndexMap<JsString, f64>,
    hard: IndexMap<JsString, Vec<f64>>,
}

pub fn try_dicts() -> Result<&'static Dicts, String> {
    static D: OnceLock<Dicts> = OnceLock::new();
    load_once(&D, || {
        let stress = load_tsv_map(
            DIR,
            "stress.tsv",
            |v, _| Some(js_number(v)),
            TsvOptions::default(),
        )
        .map_err(|e| e.to_string())?;
        let hard = load_tsv_map(
            DIR,
            "hard-e.tsv",
            |v, _| Some(v.split(&js(",")).iter().map(js_number).collect()),
            TsvOptions {
                optional: true,
                ..Default::default()
            },
        )
        .map_err(|e| e.to_string())?;
        Ok(Dicts { stress, hard })
    })
}

/// ⚠ Crate-private and panicking: reached only after `create_russian` (or a test) has loaded them.
static DICTS: LazyLock<&'static Dicts> =
    LazyLock::new(|| try_dicts().unwrap_or_else(|e| panic!("{e}")));

/// `VOWEL_RE = new RegExp(`[${vowelLetters}]`, "gi")`.
static VOWEL_RE: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("[{}]", MANIFEST.vowel_letters), "gi").unwrap());

/// `phonemizeWord(word)`: one Russian word to canonical IPA.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let d = &*DICTS;
    let w = word.to_lower_case();
    // `IRREGULARS[w]`: `w` is a lowercased Cyrillic word (or a number word), never an `Object.prototype` name.
    if let Some(irr) = MANIFEST.irregulars.get(&w.to_string_lossy()) {
        return js(irr);
    }
    let mut ord = d.stress.get(&w).copied();
    let e = js("е");
    if ord.is_none() && w.includes(&e) {
        // `w[i]` is one UTF-16 unit, and `е` is one.
        for i in 0..w.len() {
            if w.0[i] != e.0[0] {
                continue;
            }
            let cand = w
                .slice(0, Some(i as isize))
                .concat(&js("ё"))
                .concat(&w.slice(i as isize + 1, None));
            if d.stress.contains_key(&cand) {
                return phonemize_word(&cand);
            }
        }
    }
    if ord.is_none() {
        ord = adjective_stress(&w);
    }
    let ord = ord.unwrap_or_else(|| {
        let yo = js("ё");
        VOWEL_RE
            .match_all(&w)
            .iter()
            .position(|m| m.value(&w) == yo)
            .map_or(0.0, |i| i as f64)
    });
    to_ipa(&w, ord, d.hard.get(&w).map(|v| v.as_slice()))
}

/// `countVowels(w)`: the code points of `w` that are vowel letters.
fn count_vowels(w: &JsString) -> usize {
    let v = js(&MANIFEST.vowel_letters);
    w.code_point_strings()
        .iter()
        .filter(|c| v.includes(c))
        .count()
}

/// `adjectiveStress(w)`: an OOV inflected adjective's stress, from its masculine lemma in the dictionary.
fn adjective_stress(w: &JsString) -> Option<f64> {
    let a = &MANIFEST.adjective_stress;
    for e in &a.endings {
        let end = js(&e.end);
        if !w.ends_with(&end) || (w.len() as isize - end.len() as isize) < 2 {
            continue;
        }
        let stem = w.slice(0, Some((w.len() - end.len()) as isize));
        let lemmas = match e.kind {
            EndingType::Hard => &a.hard_lemmas,
            EndingType::Soft => &a.soft_lemmas,
        };
        for lem in lemmas {
            if let Some(&ord) = DICTS.stress.get(&stem.concat(&js(lem)))
                && ord < count_vowels(w) as f64
            {
                return Some(ord);
            }
        }
    }
    None
}

fn token() -> &'static JsRegex {
    js_re!(r"([а-яёА-ЯЁ]+)|(\d+(?:[.,]\d+)?)|([.!?…,;:])", "gu")
}

/// The Russian engine (`createRussian`).
pub struct RussianPhonemizer {
    symbols: SymbolNormalizer,
}

impl RussianPhonemizer {
    /// `normalizeRussian(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_russian(text)
    }

    /// `normalizeRussianInitialisms(text)`.
    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_russian_initialisms(text)
    }

    /// `isUnreadableRussian(word)` (normalize.ts).
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        super::normalize::is_unreadable_russian(word)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `toIpa(word, stressOrd, hard)` (g2p.ts).
    pub fn to_ipa(&self, word: &JsString, stress_ord: f64, hard: Option<&[f64]>) -> JsString {
        to_ipa(word, stress_ord, hard)
    }

    /// `numberToWords(n, raw)` (numbers.ts).
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    /// `russianOrdinal(n)` (romanOrdinals.ts).
    pub fn ordinal(&self, n: f64) -> Option<JsString> {
        super::roman_ordinals::russian_ordinal(n)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self
            .symbols
            .apply(&normalize_russian_initialisms(&normalize_russian(input)));
        let m = &*MANIFEST;
        assemble_clauses(&normalized, token(), |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(num) = mm.group(2, s).filter(|n| !n.is_empty()) {
                // `m[2].split(/[.,]/)`: the token holds at most one separator.
                let sep = num
                    .0
                    .iter()
                    .position(|&u| u == b'.' as u16 || u == b',' as u16);
                let int_part = &sep.map_or(num.clone(), |i| num.slice(0, Some(i as isize)));
                let frac = sep.map(|i| num.slice(i as isize + 1, None));
                for wd in number_to_words(js_number(int_part), Some(int_part)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
                if let Some(frac) = frac {
                    sink.emit(&phonemize_word(&js(&m.numbers.decimal_connector)));
                    for d in frac.code_point_strings() {
                        for wd in number_to_words(js_number(&d), None).split(&js(" ")) {
                            sink.emit(&phonemize_word(&wd));
                        }
                    }
                }
            } else if let Some(p) = mm.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) = m
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for RussianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(RussianPhonemizer::text(self, input))
    }
}

/// `createRussian()`. Errors when the manifest or a dictionary cannot be loaded, or the symbol tier refuses
/// the manifest's data.
pub fn create_russian() -> Result<RussianPhonemizer, String> {
    let m = try_manifest()?;
    try_dicts()?;
    let st = &m.symbol_tier;
    let symbols = make_symbol_normalizer(&SymbolData {
        count_form: Some(std::sync::Arc::new(slavic_count_form)),
        percent: Some(st.percent.clone()),
        currency: Some(st.currency.clone()),
        units: Some(st.units.clone()),
        unit_per: Some(UnitPer::All(st.unit_per.clone())),
        exponent_words: Some(st.exponent_words.clone()),
        bare_exponent: Some(st.bare_exponent.clone()),
        magnitudes: Some(st.magnitudes.clone()),
        ampersand: Some(st.ampersand.clone()),
        multiply: Some(st.multiply.clone()),
        ..Default::default()
    })?;
    Ok(RussianPhonemizer { symbols })
}

/// Expectations derived from the TS engine (`.probe/ru/testvals.mts`), never hand-typed.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordinal_notation_inflects_to_the_written_case() {
        let e = create_russian().unwrap();
        let n = |s: &str| e.normalize(&js(s)).to_string_lossy();
        assert_eq!(n("Он занял 5-е место."), "Он занял пятое место.");
        assert_eq!(
            n("С 3-го до 1970-х."),
            "С третьего до одна тысяча девятьсот семидесятых."
        );
        assert_eq!(n("В 300 г. н. э. Затем"), "В 300 году нашей эры. Затем");
        assert_eq!(n("Это 1/2 и 1/5."), "Это одна вторая и одна пятая.");
        assert_eq!(n("В 11:00."), "В одиннадцать часов.");
    }

    #[test]
    fn stress_from_the_dictionary_yo_restoration_and_the_lemma() {
        let e = create_russian().unwrap();
        let w = |s: &str| e.phonemize_word(&js(s)).to_string_lossy();
        assert_eq!(w("еще"), "jɪɕːˈɵ");
        assert_eq!(w("большое"), "bɐlʲʂˈoje");
        assert_eq!(w("тест"), "tɛst");
        assert_eq!(w("молоко"), "məɫɐkˈo");
    }

    #[test]
    fn grouped_numbers_and_century_ordinals_end_to_end() {
        let p = |s: &str| crate::phonemize(s, "ru").unwrap();
        assert_eq!(p("Прошло 5 000 лет."), "prɐʂɫˈo pʲætʲ tˈɨsʲət͡ɕ lʲet .");
        assert_eq!(p("Это XIX век."), "ˈɛtə dʲɪvʲɪtnˈat͡sətɨj vʲek .");
    }
}
