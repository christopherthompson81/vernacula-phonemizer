//! Ukrainian (uk) phonemizer, canonical IPA: a left-to-right letter scan (palatalisation before ь/і/iotated
//! vowels, the iotated vowels' glide, в-vocalisation, й onset/coda), regressive palatalisation and geminates;
//! text() over Cyrillic words, numbers with a decimal comma, and clause punctuation.
//! Ported from src/languages/ukrainian/ukrainian.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use indexmap::IndexMap;

use super::manifest::{MANIFEST, try_manifest};
use super::normalize::{normalize_ukrainian, normalize_ukrainian_initialisms};
use super::numbers::east_slavic_number_words;
use crate::core::clauses::assemble_clauses;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::normalize_symbols::{
    Multiply, SymbolData, SymbolNormalizer, UnitPer, make_symbol_normalizer, slavic_count_form,
};
use crate::core::numbers::{NumbersDef, Word, render_number, spell_digits};
use crate::core::provenance::{Form, normalize};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

const SOFT: &str = "\u{44c}";

/// The manifest's letter tables as `JsString`s (an own-key lookup: every key is one code point).
struct Letters {
    consonants: IndexMap<JsString, JsString>,
    iotated: IndexMap<JsString, JsString>,
    vowels: IndexMap<JsString, JsString>,
    palatalizers: HashSet<JsString>,
    vowel_letters: HashSet<JsString>,
    plain_vowels: HashSet<JsString>,
}

static LETTERS: LazyLock<Letters> = LazyLock::new(|| {
    let m = &*MANIFEST;
    let map = |t: &IndexMap<String, String>| t.iter().map(|(k, v)| (js(k), js(v))).collect();
    let set = |t: &[String]| t.iter().map(|k| js(k)).collect();
    Letters {
        consonants: map(&m.consonants),
        iotated: map(&m.iotated),
        vowels: map(&m.vowels),
        palatalizers: set(&m.palatalizers),
        vowel_letters: set(&m.vowel_letters),
        plain_vowels: set(&m.plain_vowels),
    }
});

/// `palatalise(ipa)`: dark ɫ → lʲ, everything else appends ʲ.
fn palatalise(ipa: &JsString) -> JsString {
    if *ipa == js("\u{26b}") {
        js("l\u{2b2}")
    } else {
        ipa.concat(&js("\u{2b2}"))
    }
}

/// `PALC`: a palatalised consonant.
const PALC: &str = "(?:t\u{361}s|t\u{361}\u{283}|d\u{361}z|d\u{361}\u{292}|[bpk\u{261}tdsz\u{283}\u{292}\u{28b}fxmnrlj])\u{2b2}";

static DARK_L_BEFORE_PALC: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("\u{26b}(?={PALC})"), "gu").unwrap());
static CORONAL_BEFORE_PALC: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("(t\u{361}s|[tdszn])(?={PALC})"), "gu").unwrap());

/// `phonemizeWord(word)`: one Ukrainian word to canonical IPA.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let l = &*LETTERS;
    let s = word.to_lower_case();
    let chars = s.code_point_strings();
    let empty = JsString::new();
    let soft = js(SOFT);
    let at = |i: usize| chars.get(i).unwrap_or(&empty);
    let is_cons = |c: &JsString| l.consonants.contains_key(c);
    let mut out: Vec<JsString> = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let c = &chars[i];
        let nxt = at(i + 1);
        if let Some(hard) = l.consonants.get(c) {
            let mut ipa = hard.clone();
            if *c == js("\u{432}") {
                ipa = if *nxt == js("\u{43e}") || *nxt == js("\u{443}") {
                    js("w")
                } else if *nxt == js("\u{430}") || *nxt == js("\u{435}") || *nxt == js("\u{438}") {
                    js("\u{28b}")
                } else if *nxt == js("\u{456}") || *nxt == soft || l.iotated.contains_key(nxt) {
                    js("\u{28b}\u{2b2}")
                } else if i > 0 && l.vowel_letters.contains(at(i - 1)) {
                    js("u\u{32f}")
                } else {
                    js("w")
                };
            } else if *c == js("\u{439}") {
                ipa = if l.plain_vowels.contains(nxt) {
                    js("j")
                } else {
                    js("i\u{32f}")
                };
            } else if l.palatalizers.contains(nxt) {
                ipa = palatalise(&ipa);
            }
            out.push(ipa);
            i += 1;
            if *nxt == soft {
                i += 1;
            }
            continue;
        }
        if let Some(v) = l.iotated.get(c) {
            let prev = if i > 0 { at(i - 1) } else { &empty };
            if *c == js("\u{457}") || !is_cons(prev) || *prev == js("\u{439}") {
                out.push(js("j"));
            }
            out.push(v.clone());
            i += 1;
            continue;
        }
        if let Some(v) = l.vowels.get(c) {
            out.push(v.clone());
            i += 1;
            continue;
        }
        if *c == soft {
            if let Some(last) = out.last_mut()
                && !last.is_empty()
                && !last.ends_with(&js("\u{2b2}"))
            {
                *last = palatalise(last);
            }
            i += 1;
            continue;
        }
        i += 1;
    }
    let mut x = JsString::join(&out, &JsString::new());
    x = DARK_L_BEFORE_PALC.replace(&x, &js("l\u{2b2}"));
    x = CORONAL_BEFORE_PALC.replace(&x, &js("$1\u{2b2}"));
    x = js_re!(
        "([b\u{28b}\u{266}\u{261}d\u{292}zn\u{26b}lmnprstfx\u{283}])\u{2b2}\\1\u{2b2}",
        "gu"
    )
    .replace(&x, &js("$1\u{2b2}\u{2d0}"));
    x = js_re!(
        "([b\u{28b}\u{266}\u{261}d\u{292}zn\u{26b}lmnprstfx\u{283}])\\1\u{2b2}",
        "gu"
    )
    .replace(&x, &js("$1\u{2b2}\u{2d0}"));
    x = js_re!(
        "([b\u{28b}\u{266}\u{261}d\u{292}zn\u{26b}lmprstfx\u{283}])\\1(?!\u{2b2})",
        "gu"
    )
    .replace(&x, &js("$1\u{2d0}"));
    normalize(&x, Form::Nfc)
}

/// `eastSlavicNumberWords` as the `NumberComposer` `renderNumber` takes. ⚠ It reads the uk table, which is
/// the only `NumbersDef` this engine ever passes (`DEF.numbers`), so the argument is that table's base.
fn compose(n: u64, _base: &NumbersDef) -> Vec<Word> {
    east_slavic_number_words(n, &MANIFEST.numbers.east)
}

/// `number(digits)`: an unsafe integer is read digit at a time.
fn number(digits: &JsString) -> JsString {
    let n = js_number(digits);
    let base = &MANIFEST.numbers.east.base;
    let word = |w: &str| phonemize_word(&js(w)).to_string_lossy();
    if !is_safe_integer(n) {
        return js(&spell_digits(&digits.to_string_lossy(), base, &word));
    }
    js(&render_number(n as u64, base, &word, compose))
}

fn token() -> &'static JsRegex {
    js_re!(
        "([\\u0400-\\u04FF'\u{2019}\u{2bc}]+)|(\\d+(?:,\\d+)?)|([.?!,;:\u{2026}\u{2014}])",
        "gu"
    )
}

/// The Ukrainian engine (`createUkrainian`).
pub struct UkrainianPhonemizer {
    symbols: SymbolNormalizer,
}

impl UkrainianPhonemizer {
    /// `normalizeUkrainian(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_ukrainian(text)
    }

    /// `normalizeUkrainianInitialisms(text)`.
    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_ukrainian_initialisms(text)
    }

    /// `isUnreadableUkrainian(word)` (normalize.ts).
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        super::normalize::is_unreadable_ukrainian(word)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `renderNumber(n, DEF.numbers, (w) => w, eastSlavicNumberWords)` (numbers.ts, unphonemized).
    pub fn number_words(&self, n: u64) -> JsString {
        js(&render_number(
            n,
            &MANIFEST.numbers.east.base,
            &|w| w.to_string(),
            compose,
        ))
    }

    /// `number(digits)`: the engine's digit-run reading.
    pub fn number(&self, digits: &JsString) -> JsString {
        number(digits)
    }

    /// `ROMAN_POLICY.ordinal(n)` (romanOrdinals.ts).
    pub fn roman_ordinal(&self, n: f64) -> Option<JsString> {
        super::roman_ordinals::ukrainian_roman_ordinal(n)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized =
            self.symbols
                .apply(&normalize_ukrainian_initialisms(&normalize_ukrainian(
                    input,
                )));
        let m = &*MANIFEST;
        assemble_clauses(&normalized, token(), |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(num) = mm.group(2, s).filter(|n| !n.is_empty()) {
                // `m[2].split(",")`: the token holds at most one comma.
                let parts = num.split(&js(","));
                sink.emit(&number(&parts[0]));
                if let Some(frac) = parts.get(1) {
                    sink.emit(&phonemize_word(&js(&m.numbers.decimal_connector)));
                    for dg in frac.code_point_strings() {
                        sink.emit(&number(&dg));
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

impl Engine for UkrainianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(UkrainianPhonemizer::text(self, input))
    }
}

/// `createUkrainian()`. Errors when the manifest cannot be loaded, or the symbol tier refuses its data.
pub fn create_ukrainian() -> Result<UkrainianPhonemizer, String> {
    let m = try_manifest()?;
    let st = &m.symbol_tier;
    let sw = &m.sign_words;
    let symbols = make_symbol_normalizer(&SymbolData {
        multiply: Some(Multiply {
            times: sw.times.clone(),
            by: None,
        }),
        ampersand: Some(sw.ampersand.clone()),
        percent: Some(st.percent.clone()),
        currency: Some(st.currency.clone()),
        units: Some(st.units.clone()),
        unit_per: Some(UnitPer::All(st.unit_per.clone())),
        rate_denominators: Some(st.rate_denominators.clone()),
        exponent_words: Some(st.exponent_words.clone()),
        magnitudes: Some(st.magnitudes.clone()),
        // A decimal governs the genitive singular, a fourth form.
        count_form: Some(Arc::new(|n: f64| {
            if n.is_finite() && n.fract() == 0.0 {
                slavic_count_form(n)
            } else {
                3.0
            }
        })),
        ..Default::default()
    })?;
    Ok(UkrainianPhonemizer { symbols })
}

/// Expectations derived from the TS engine (`.probe/uk/check.mts`), never hand-typed.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn suffix_notation_reads_as_ordinal_or_oblique_cardinal() {
        let e = create_ukrainian().unwrap();
        let n = |s: &str| e.normalize(&js(s)).to_string_lossy();
        assert_eq!(
            n("У 1970-х роках, 3-х дітей і 5-го."),
            "У тисяча дев'ятсот сімдесятих роках, трьох дітей і п'ятого."
        );
        // A time before `.` is read too, with feminine minutes (#1525).
        assert_eq!(
            n("О 20:30 і з 6:30."),
            "О двадцятій тридцять і з шостої тридцять."
        );
        assert_eq!(
            n("Це сталося у 300 році до н. е."),
            "Це сталося у 300 році до нашої ери."
        );
        assert_eq!(n("Це 1/5 і 2/3."), "Це одна п'ята і дві третіх.");
    }

    /// #1525: each finding, one assertion per fix (synthetic text; values from `.probe/uk/check.mts`).
    #[test]
    fn port_findings_1525() {
        let e = create_ukrainian().unwrap();
        let n = |s: &str| e.normalize(&js(s)).to_string_lossy();
        assert_eq!(n("о 6:30, потім"), "о шостій тридцять, потім");
        assert_eq!(n("о 6:30,5"), "о 6:30,5");
        assert_eq!(n("1990 р. Потім"), "1990 року. Потім");
        assert_eq!(n("1990 р. потім"), "1990 року потім");
        assert_eq!(n("див. Петренко"), "дивись Петренко");
        assert_eq!(n("5/8"), "п'ять восьмих");
        assert_eq!(n("11/5"), "одинадцять п'ятих");
        assert_eq!(n("21/100"), "двадцять одна сота");
        assert_eq!(n("\u{1C81}ив., далі"), "\u{1C81}ив., далі");
        assert_eq!(n("Constructor 10:30"), "Constructor десята тридцять");
        assert_eq!(n("о 20:21"), "о двадцятій двадцять одна");
        assert_eq!(n("3:02"), "третя дві");
    }

    #[test]
    fn letter_scan_palatalises_vocalises_and_geminates() {
        let e = create_ukrainian().unwrap();
        let w = |s: &str| e.phonemize_word(&js(s)).to_string_lossy();
        assert_eq!(w("вовк"), "wɔu̯k");
        assert_eq!(w("Львів"), "lʲʋʲiu̯");
        assert_eq!(w("ллється"), "lʲːɛtʲsʲa");
        assert_eq!(w("Майя"), "mai̯ja");
        assert_eq!(w("з'їзд"), "zjizd");
    }

    #[test]
    fn grouped_numbers_and_century_ordinals_end_to_end() {
        let p = |s: &str| crate::phonemize(s, "uk").unwrap();
        assert_eq!(
            p("Населення 5 000 000 осіб."),
            "nasɛɫɛnʲːa pjatʲ mʲilʲjɔnʲiu̯ ɔsʲib ."
        );
        assert_eq!(p("У XIX столітті."), "u dɛu̯jatnadʲt͡sʲatɛ stɔlʲitʲːi .");
    }
}
