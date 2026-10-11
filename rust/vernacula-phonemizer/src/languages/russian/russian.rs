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

/// `foldLetters(w)`: each code point in `letterFolds` replaced by its Russian spelling.
fn fold_letters(w: &JsString) -> JsString {
    let parts: Vec<JsString> = w
        .code_point_strings()
        .into_iter()
        .map(|c| match MANIFEST.letter_folds.get(&c.to_string_lossy()) {
            Some(f) => js(f),
            None => c,
        })
        .collect();
    JsString::join(&parts, &JsString::new())
}

/// `phonemizeWord(word)`: one Russian word to canonical IPA.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let d = &*DICTS;
    let w = fold_letters(&word.to_lower_case());
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

/// `TOKEN`: the folded letters are word letters too, in both cases (`c + c.toUpperCase()`), so `хлѣбъ` and
/// `Київ` stay one word.
fn token() -> &'static JsRegex {
    static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
        let folded: String = MANIFEST
            .letter_folds
            .keys()
            .map(|c| js(c).concat(&js(c).to_upper_case()).to_string_lossy())
            .collect();
        JsRegex::new(
            &format!(r"([а-яёА-ЯЁ{folded}]+)|(\d+(?:[.,]\d+)?)|([.!?…,;:])"),
            "gu",
        )
        .unwrap()
    });
    &TOKEN
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

    /// `cardinalInCase(n, genitive ? "genitive" : "instrumental")` (numbers.ts).
    pub fn cardinal_in_case(&self, n: f64, genitive: bool) -> Option<JsString> {
        use super::numbers::{CardinalCase, cardinal_in_case};
        cardinal_in_case(
            n,
            if genitive {
                CardinalCase::Genitive
            } else {
                CardinalCase::Instrumental
            },
        )
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
            "С третьего до тысяча девятьсот семидесятых."
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

    /// The #1513 findings, mirrored from test/russian-port-findings.test.ts.
    #[test]
    fn port_findings_1513_normalization() {
        let e = create_russian().unwrap();
        let n = |s: &str| e.normalize(&js(s)).to_string_lossy();
        // (1) the dot that also ends the sentence stays; a lowercase word or a mark still consumes it.
        assert_eq!(n("К 1990 г. Затем пришли."), "К 1990 года. Затем пришли.");
        assert_eq!(n("в 2007 г. Затем"), "в 2007 году. Затем");
        assert_eq!(n("5 тыс. Затем"), "5 тысяч. Затем");
        assert_eq!(n("в XV в. Затем"), "в XV века. Затем");
        assert_eq!(n("в 2007 г. мы"), "в 2007 году мы");
        assert_eq!(n("в 2007 г., мы"), "в 2007 году, мы");
        assert_eq!(n("в 1990 г. в 2000 г. мы"), "в 1990 году в 2000 году мы");
        assert_eq!(n("ул. Ленина"), "улица Ленина");
        assert_eq!(n("проф. Иванов"), "профессор Иванов");
        // (2) initials.
        let v = &MANIFEST.letter_names["в"];
        let g = &MANIFEST.letter_names["г"];
        assert_eq!(
            n("В. Петров и Г. Иванов"),
            format!("{v} Петров и {g} Иванов")
        );
        assert_eq!(n("В. В. Набоков"), format!("{v} {v} Набоков"));
        // (3) fractions.
        assert_eq!(n("2/3"), "две третьих");
        assert_eq!(n("5/8"), "пять восьмых");
        assert_eq!(n("3/2"), "три вторых");
        assert_eq!(n("11/5"), "одиннадцать пятых");
        assert_eq!(n("1/5"), "одна пятая");
        assert_eq!(n("21/100"), "двадцать одна сотая");
        // (4) clock minutes.
        assert_eq!(n("9:21"), "девять часов двадцать одна минута");
        assert_eq!(n("1:01"), "один час одна минута");
        assert_eq!(n("3:02"), "три часа две минуты");
        assert_eq!(n("12:11"), "двенадцать часов одиннадцать минут");
        // (5) oblique cardinals, and the ordinal where no cardinal form ends in the suffix.
        assert_eq!(n("в 4-х томах"), "в четырёх томах");
        assert_eq!(n("30-ти лет"), "тридцати лет");
        assert_eq!(n("35-ти"), "тридцати пяти");
        assert_eq!(n("34-мя годами"), "тридцатью четырьмя годами");
        assert_eq!(n("5-х классов"), "пятых классов");
        assert_eq!(n("12-х"), "двенадцатых");
        assert_eq!(n("1970-х"), "тысяча девятьсот семидесятых");
    }

    #[test]
    fn port_findings_1513_words() {
        let e = create_russian().unwrap();
        let w = |s: &str| e.phonemize_word(&js(s)).to_string_lossy();
        let p = |s: &str| crate::phonemize(s, "ru").unwrap();
        // (6) вся is not a reflexive.
        let (hard, soft) = &MANIFEST.consonants["с"];
        assert!(w("вся").contains(soft.as_str()));
        assert!(w("вернулся").ends_with(&format!("{hard}ə")));
        // (7) letters outside а–я/ё fold to their Russian spelling.
        assert_eq!(p("хлѣбъ"), p("хлебъ"));
        assert_eq!(p("Київ"), p("Кийив"));
        assert_eq!(p("ґанок"), p("ганок"));
        assert_eq!(p("Ѳеатръ"), p("Феатръ"));
        assert!(!p("хлѣбъ").contains(' '));
        // (8) both softening tiers are loaded (the TS proves them live with a mocked manifest).
        assert_eq!(MANIFEST.soften_triggers, "тд");
        assert_eq!(MANIFEST.soften_triggers_tdn, "тднч");
        // (9) a lone thousand.
        let num = |n: f64| super::number_to_words(n, None).to_string_lossy();
        assert_eq!(num(1900.0), "тысяча девятьсот");
        assert_eq!(num(1000.0), "тысяча");
        assert_eq!(num(21000.0), "двадцать одна тысяча");
        assert_eq!(num(2000.0), "две тысячи");
    }

    #[test]
    fn grouped_numbers_and_century_ordinals_end_to_end() {
        let p = |s: &str| crate::phonemize(s, "ru").unwrap();
        assert_eq!(p("Прошло 5 000 лет."), "prɐʂɫˈo pʲætʲ tˈɨsʲət͡ɕ lʲet .");
        assert_eq!(p("Это XIX век."), "ˈɛtə dʲɪvʲɪtnˈat͡sətɨj vʲek .");
    }
}
