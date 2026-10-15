//! Native Kannada phonemizer: the generic abugida G2P with no inherent-vowel deletion, the word-final anusvara as
//! [m], geminate length, ಳ್ಳ → [ɭː] and first-syllable stress; Dravidian cardinals, clause marks and embedded
//! Latin runs, driven by `kannada.jsonc`.
//! Ported from src/languages/kannada/kannada.ts — see that file for the corpus evidence.

use std::sync::{Arc, OnceLock};

use super::manifest::{KannadaManifest, try_manifest};
use super::normalize::{KannadaNormalizer, make_kannada_normalizer};
use super::numbers::number_to_words;
use crate::core::abugida::{AbugidaG2p, make_abugida_g2p};
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::LATIN_RUN;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::phonology::load_shared_phonology;
use crate::core::provenance::{Form, normalize};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError, read_as_english};

/// Kannada block minus the digit range.
const KANNADA_WORD: &str = "ಀ-೥೰-೿";
// Generated from the TS object literal (key order preserved).
const KANNADA_DIGITS: [(&str, &str); 10] = [
    ("೦", "0"),
    ("೧", "1"),
    ("೨", "2"),
    ("೩", "3"),
    ("೪", "4"),
    ("೫", "5"),
    ("೬", "6"),
    ("೭", "7"),
    ("೮", "8"),
    ("೯", "9"),
];
const VOWEL: &str = "aeiouɾ";

/// Foreign-run phonemizer (embedded Latin → e.g. en), injected by the registry.
pub type ForeignPhonemizer = Arc<dyn Fn(&JsString) -> JsString + Send + Sync>;

pub struct KannadaPhonemizer {
    def: &'static KannadaManifest,
    g2p: AbugidaG2p,
    normalizer: KannadaNormalizer,
    token_re: JsRegex,
    foreign: Option<ForeignPhonemizer>,
}

fn to_ascii(d: &JsString) -> JsString {
    let mut out = JsString::new();
    for c in d.code_point_strings() {
        match KANNADA_DIGITS.iter().find(|(k, _)| js(k) == c) {
            Some((_, a)) => out.push_str(&js(a)),
            None => out.push_str(&c),
        }
    }
    out
}

impl KannadaPhonemizer {
    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        let norm = js_re!(r"ಂ$", "u").replace(&normalize(word, Form::Nfc), &js("ಮ್"));
        let mut x = self.g2p.g2p(&norm);
        x = js_re!(
            r"(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ʈʰ|ɖʱ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlʃʂsʈɖɳɭɲŋjɦhʋɾr])\1(?!͡)",
            "gu"
        )
        .replace(&x, &js("$1ː"));
        x = js_re!(r"ː([ʰʱ])", "gu").replace(&x, &js("$1ː"));
        x = js_re!(r"ɭl", "gu").replace(&x, &js("ɭː"));
        static FIRST_VOWEL: OnceLock<JsRegex> = OnceLock::new();
        let first = FIRST_VOWEL.get_or_init(|| JsRegex::new(&format!("[{VOWEL}]"), "u").unwrap());
        if let Some(m) = first.exec(&x) {
            let at = m.index() as isize;
            x = x
                .slice(0, Some(at))
                .concat(&js("ˈ"))
                .concat(&x.slice(at, None));
        }
        normalize(&x, Form::Nfc)
    }

    fn words(&self, n: u64) -> Vec<JsString> {
        number_to_words(n, &self.def.numbers)
            .split(&js(" "))
            .iter()
            .map(|w| self.phonemize_word(w))
            .collect()
    }

    /// `number(digits)`: an unsafe integer is read digit at a time through the same composer.
    pub fn number(&self, digits: &JsString) -> JsString {
        let ascii = to_ascii(digits);
        let n = js_number(&ascii);
        let words: Vec<JsString> = if is_safe_integer(n) {
            self.words(n as u64)
        } else {
            ascii
                .code_point_strings()
                .iter()
                .flat_map(|d| self.words(js_number(d) as u64))
                .collect()
        };
        JsString::join(&words, &js(" "))
    }

    /// `normalizeKannada(input)` alone (the per-module differential calls it).
    pub fn normalize(&self, input: &JsString) -> JsString {
        self.normalizer.normalize(input)
    }

    /// `text(input)`.
    pub fn text(&self, input: &JsString) -> JsString {
        let prepared = self.normalizer.normalize(input);
        assemble_clauses(&prepared, &self.token_re, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                sink.emit(&self.phonemize_word(&w));
            } else if let Some(latin) = m.group(2, s) {
                if let Some(f) = &self.foreign {
                    sink.emit(&f(&latin));
                } else {
                    sink.emit(&JsString::new());
                }
            } else if let Some(d) = m.group(3, s) {
                sink.emit(&self.number(&d));
            } else if let Some(p) = m.group(4, s)
                && let Some(mk) = self.def.clause_punctuation.get(&p.to_string_lossy())
                && !mk.is_empty()
            {
                sink.pause(&js(mk));
            }
        })
    }
}

/// `createKannada(foreign)`.
pub fn create_kannada(foreign: Option<ForeignPhonemizer>) -> Result<KannadaPhonemizer, String> {
    let def = try_manifest()?;
    let digit_class: String = std::iter::once("0-9")
        .chain(KANNADA_DIGITS.iter().map(|(k, _)| *k))
        .collect();
    let latin = &*LATIN_RUN;
    let token_re = JsRegex::new(
        &format!(r"([{KANNADA_WORD}]+)|({latin})|([{digit_class}]+)|([।॥.?!,;:])"),
        "gu",
    )
    .map_err(|e| format!("kannada token pattern: {e}"))?;
    Ok(KannadaPhonemizer {
        def,
        g2p: make_abugida_g2p(&def.abugida, load_shared_phonology()?),
        normalizer: make_kannada_normalizer()?,
        token_re,
        foreign,
    })
}

impl Engine for KannadaPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(KannadaPhonemizer::text(self, input))
    }
}

/// The registry's `kn` arm: `createKannada(readAsEnglish)`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    let foreign: ForeignPhonemizer = Arc::new(read_as_english);
    Ok(Arc::new(
        create_kannada(Some(foreign)).map_err(PhonemizeError::Data)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/kannada.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["ಕನ್ನಡ"], Some("kˈanːaɖa")),
    ("phonemizeWord", &["ನಮಸ್ಕಾರ"], Some("nˈamaskaːɾa")),
    ("phonemizeWord", &["ಬೆಂಗಳೂರು"], Some("bˈẽŋɡaɭuːɾu")),
    ("phonemizeWord", &["ಮನೆ"], Some("mˈane")),
    ("phonemizeWord", &["ನೀರು"], Some("nˈiːɾu")),
    ("phonemizeWord", &["ಹಳ್ಳಿ"], Some("hˈaɭːi")),
    ("phonemizeWord", &["ಅಕ್ಕ"], Some("ˈakːa")),
    ("phonemizeWord", &["ಪುಸ್ತಕ"], Some("pˈust̪aka")),
    ("phonemizeWord", &["ಊಟ"], Some("ˈuːʈa")),
    ("numberToWords", &["5"], Some("ಐದು")),
    ("numberToWords", &["15"], Some("ಹದಿನೈದು")),
    ("numberToWords", &["20"], Some("ಇಪ್ಪತ್ತು")),
    ("numberToWords", &["21"], Some("ಇಪ್ಪತ್ತೊಂದು")),
    ("numberToWords", &["24"], Some("ಇಪ್ಪತ್ತನಾಲ್ಕು")),
    ("numberToWords", &["93"], Some("ತೊಂಬತ್ತಮೂರು")),
    ("numberToWords", &["99"], Some("ತೊಂಬತ್ತೊಂಬತ್ತು")),
    ("numberToWords", &["100"], Some("ನೂರು")),
    ("numberToWords", &["150"], Some("ನೂರಾ ಐವತ್ತು")),
    ("numberToWords", &["200"], Some("ಇನ್ನೂರು")),
    ("numberToWords", &["300"], Some("ಮುನ್ನೂರು")),
    ("numberToWords", &["400"], Some("ನಾಲ್ಕು ನೂರು")),
    ("numberToWords", &["500"], Some("ಐನೂರು")),
    ("numberToWords", &["900"], Some("ಒಂಬೈನೂರು")),
    ("numberToWords", &["1000"], Some("ಸಾವಿರ")),
    ("numberToWords", &["1976"], Some("ಸಾವಿರದ ಒಂಬೈನೂರಾ ಎಪ್ಪತ್ತಾರು")),
    ("numberToWords", &["2010"], Some("ಎರಡು ಸಾವಿರದ ಹತ್ತು")),
    ("numberToWords", &["783562"], Some("ಏಳು ಲಕ್ಷದ ಎಂಬತ್ತಮೂರು ಸಾವಿರದ ಐನೂರಾ ಅರವತ್ತೆರಡು")),
    ("phonemize", &["21", "kn"], Some("ˈipːat̪ːõn̪d̪u")),
    ("phonemize", &["100", "kn"], Some("nˈuːɾu")),
    ("phonemize", &["೧೦೦", "kn"], Some("nˈuːɾu")),
    ("phonemize", &["೪", "kn"], Some("nˈaːlku")),
    ("phonemize", &["4", "kn"], Some("nˈaːlku")),
    ("phonemize", &["ಪಾಯಿಂಟ್\u{200c}ಗಳಿಂದ", "kn"], Some("pˈaːjĩɳʈɡaɭĩn̪d̪a")),
    ("normalizeKannada", &["ಡಾಲರ್\u{200d}\u{200c}ಗಳ"], Some("ಡಾಲರ್ಗಳ")),
    ("normalizeKannada", &["1,000"], Some("1000")),
    ("phonemize", &["1,000", "kn"], Some("sˈaːʋiɾa")),
    ("phonemize", &["100,000", "kn"], Some("lˈakʂa")),
    ("ordinalToWords", &["15"], Some("ಹದಿನೈದನೇ")),
    ("ordinalToWords", &["20"], Some("ಇಪ್ಪತ್ತನೇ")),
    ("ordinalToWords", &["247"], Some("ಇನ್ನೂರಾ ನಲವತ್ತೇಳನೇ")),
    ("normalizeKannada", &["15 ನೇ ಶತಮಾನ"], Some("ಹದಿನೈದನೇ ಶತಮಾನ")),
    ("normalizeKannada", &["60ನೆಯದು"], Some("ಅರವತ್ತನೆಯದು")),
    ("normalizeKannada", &["1,000 ನೇ"], Some("ಸಾವಿರನೇ")),
    ("normalizeKannada", &["ಕ್ರಿ.ಪೂ. 356"], Some("ಕ್ರಿಸ್ತ ಪೂರ್ವ 356")),
    ("normalizeKannada", &["ಕ್ರಿ.ಪೂದಲ್ಲಿ"], Some("ಕ್ರಿಸ್ತ ಪೂರ್ವದಲ್ಲಿ")),
    ("normalizeKannada", &["ಕ್ರಿ.ಶ. 1000"], Some("ಕ್ರಿಸ್ತ ಶಕ 1000")),
    ("normalizeKannada", &["20 ಕಿ.ಮೀ"], Some("20 ಕಿಲೋಮೀಟರ್")),
    ("normalizeKannada", &["120 ಕಿ.ಮೀಯಲ್ಲಿ"], Some("120 ಕಿಮೀಯಲ್ಲಿ")),
    ("normalizeKannada", &["ಯು.ಎಸ್ ಅಧ್ಯಕ್ಷ"], Some("ಯು ಎಸ್ ಅಧ್ಯಕ್ಷ")),
    ("normalizeKannada", &["5 ಮಿ.ಮೀ"], Some("5 ಮಿಮೀ")),
    ("normalizeKannada", &["80% ರಷ್ಟು"], Some("80 ಪ್ರತಿಶತ ರಷ್ಟು")),
    ("normalizeKannada", &["$5"], Some("5 ಡಾಲರ್")),
    ("normalizeKannada", &["US$ 14.7 ಬಿಲಿಯನ್"], Some("14 ದಶಾಂಶ 7 ಬಿಲಿಯನ್ ಡಾಲರ್")),
    ("normalizeKannada", &["3,850 km²"], Some("3850 ಚದರ ಕಿಲೋಮೀಟರ್")),
    ("normalizeKannada", &["70ಕಿ.ಮಿ/ಗಂ"], Some("ಗಂಟೆಗೆ 70 ಕಿಲೋಮೀಟರ್")),
    ("normalizeKannada", &["40 ಮೈ/ಗಂ"], Some("ಗಂಟೆಗೆ 40 ಮೈಲಿ")),
    ("normalizeKannada", &["ಗಂಟೆಗೆ 165 ಕಿಮಿ/ಗಂ"], Some("ಗಂಟೆಗೆ 165 ಕಿಲೋಮೀಟರ್")),
    ("normalizeKannada", &["11:00"], Some("11")),
    ("normalizeKannada", &["9:30"], Some("9 30")),
    ("normalizeKannada", &["802.11"], Some("802 ದಶಾಂಶ 1 1")),
    ("normalizeKannada", &["29¾ ಇಂಚು"], Some("29 ಮುಕ್ಕಾಲು ಇಂಚು")),
    ("normalizeKannada", &["35°W"], Some("35 ಡಿಗ್ರಿ W")),
    ("phonemize", &["5 m", "kn"], Some("ˈaid̪u mˈiːʈaɾ")),
    ("phonemize", &["120 m³", "kn"], Some("nˈuːɾaː ˈipːat̪ːu ɡʱˈana mˈiːʈaɾ")),
    ("phonemize", &["802.11m", "kn"], Some("ˈẽɳʈu nˈuːɾaː ˈeɾaɖu d̪ˈaʃãʃa ˈõn̪d̪u ˈõn̪d̪u ˈɛm")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_kannada(None).unwrap();
        let d = &try_manifest().unwrap().numbers;
        let n = |s: &str| s.parse::<u64>().unwrap();
        let mut count = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => e.phonemize_word(&js(args[0])).to_string_lossy(),
                "normalizeKannada" => e.normalize(&js(args[0])).to_string_lossy(),
                "numberToWords" => number_to_words(n(args[0]), d).to_string_lossy(),
                "ordinalToWords" => {
                    let suffix = args.get(1).copied().unwrap_or("ನೇ");
                    super::super::numbers::ordinal_to_words(n(args[0]), &js(suffix), d)
                        .to_string_lossy()
                }
                "phonemize" => crate::phonemize(args[0], args[1]).unwrap(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            count += 1;
        }
        assert_eq!(count, 65);
    }
}
