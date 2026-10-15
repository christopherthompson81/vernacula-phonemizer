//! Native Malayalam phonemizer: the generic abugida G2P with no inherent-vowel deletion, plus the chillu letters as
//! bare codas, the samvritokaram [ɨ], the anusvara as [m] finally and before a non-stop, geminate length,
//! ള്ള → [ɭː], intervocalic and retroflex post-nasal voicing and first-syllable stress; Dravidian cardinals, clause
//! marks and embedded Latin runs, driven by `malayalam.jsonc`.
//! Ported from src/languages/malayalam/malayalam.ts — see that file for the corpus evidence.

use std::sync::{Arc, OnceLock};

use super::manifest::{MalayalamManifest, try_manifest};
use super::normalize::{MalayalamNormalizer, make_malayalam_normalizer};
use super::numbers::number_to_words;
use crate::core::abugida::{AbugidaG2p, make_abugida_g2p};
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::LATIN_RUN;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::phonology::load_shared_phonology;
use crate::core::provenance::{Form, normalize};
use crate::core::unicode::fold_native_digits;
use crate::js_re;
use crate::registry::{Engine, PhonemizeError, read_as_english};

/// The Malayalam block (digits handled separately).
const MALAYALAM_WORD: &str = "ഀ-ൿ";
// Generated from the TS object literals (key order preserved).
const MALAYALAM_DIGITS: [(&str, &str); 10] = [
    ("൦", "0"),
    ("൧", "1"),
    ("൨", "2"),
    ("൩", "3"),
    ("൪", "4"),
    ("൫", "5"),
    ("൬", "6"),
    ("൭", "7"),
    ("൮", "8"),
    ("൯", "9"),
];
const VOWEL: &str = "aeiouɨ";
const VIRAMA: &str = "്";
/// Each chillu → its base consonant (the virama is appended).
const CHILLU: [(&str, &str); 9] = [
    ("ൺ", "ണ"),
    ("ൻ", "ന"),
    ("ർ", "ര"),
    ("ൽ", "ല"),
    ("ൾ", "ള"),
    ("ൿ", "ക"),
    ("ൔ", "ന"),
    ("ൕ", "ല"),
    ("ൖ", "ന"),
];
const VOICE: [(&str, &str); 5] = [("k", "ɡ"), ("t̪", "d̪"), ("ʈ", "ɖ"), ("t͡ʃ", "d͡ʒ"), ("p", "b")];

/// Foreign-run phonemizer (embedded Latin → e.g. en), injected by the registry.
pub type ForeignPhonemizer = Arc<dyn Fn(&JsString) -> JsString + Send + Sync>;

pub struct MalayalamPhonemizer {
    def: &'static MalayalamManifest,
    g2p: AbugidaG2p,
    normalizer: MalayalamNormalizer,
    chillu_re: JsRegex,
    token_re: JsRegex,
    foreign: Option<ForeignPhonemizer>,
}

fn to_ascii(d: &JsString) -> JsString {
    let mut out = JsString::new();
    for c in d.code_point_strings() {
        match MALAYALAM_DIGITS.iter().find(|(k, _)| js(k) == c) {
            Some((_, a)) => out.push_str(&js(a)),
            None => out.push_str(&c),
        }
    }
    out
}

impl MalayalamPhonemizer {
    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        let mut norm = normalize(word, Form::Nfc);
        let samvrit = norm.ends_with(&js(VIRAMA));
        norm = self.chillu_re.replace_with(&norm, |m, s| {
            let c = m.value(s).to_string_lossy();
            let base = CHILLU
                .iter()
                .find(|(k, _)| *k == c)
                .map(|(_, b)| *b)
                .unwrap_or_default();
            js(&format!("{base}{VIRAMA}"))
        });
        norm = js_re!(r"ം(?=[ശഷസഹയരറലവഴള]|$)", "gu").replace(&norm, &js(&format!("മ{VIRAMA}")));
        let mut x = self.g2p.g2p(&norm);
        x = js_re!(
            r"(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ʈʰ|ɖʱ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlʃʂsʈɖɳɭɲŋjɦhʋɾr])\1(?!͡)",
            "gu"
        )
        .replace(&x, &js("$1ː"));
        x = js_re!(r"ː([ʰʱ])", "gu").replace(&x, &js("$1ː"));
        x = js_re!(r"ɭl", "gu").replace(&x, &js("ɭː"));
        x = js_re!(r"(?<=[aeiouɨɐ̃ː])(k|t̪|ʈ|t͡ʃ|p)(?=[aeiouɨɐ])", "gu").replace_with(&x, |m, s| {
            let c = m.value(s).to_string_lossy();
            js(VOICE
                .iter()
                .find(|(k, _)| *k == c)
                .map(|(_, v)| *v)
                .unwrap_or_default())
        });
        x = js_re!(r"ɳʈ(?![ʰː])", "gu").replace(&x, &js("ɳɖ"));
        if samvrit {
            x.push_str(&js("ɨ"));
        }
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

    /// `normalizeMalayalam(input)` alone (the per-module differential calls it).
    pub fn normalize(&self, input: &JsString) -> JsString {
        self.normalizer.normalize(input)
    }

    /// `text(input)`: the normalizer first, then this script's digits folded.
    pub fn text(&self, input: &JsString) -> JsString {
        let prepared = fold_native_digits(&self.normalizer.normalize(input));
        assemble_clauses(&prepared, &self.token_re, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                sink.emit(&self.phonemize_word(&w));
            } else if let Some(latin) = m.group(2, s) {
                if let Some(f) = &self.foreign {
                    sink.emit(&f(&latin));
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

/// `createMalayalam(foreign)`.
pub fn create_malayalam(foreign: Option<ForeignPhonemizer>) -> Result<MalayalamPhonemizer, String> {
    let def = try_manifest()?;
    let digit_class: String = std::iter::once("0-9")
        .chain(MALAYALAM_DIGITS.iter().map(|(k, _)| *k))
        .collect();
    let chillu_class: String = CHILLU.iter().map(|(k, _)| *k).collect();
    let latin = &*LATIN_RUN;
    let token_re = JsRegex::new(
        &format!(r"([{MALAYALAM_WORD}]+)|({latin})|([{digit_class}]+)|([।॥.?!,;:])"),
        "gu",
    )
    .map_err(|e| format!("malayalam token pattern: {e}"))?;
    Ok(MalayalamPhonemizer {
        def,
        g2p: make_abugida_g2p(&def.abugida, load_shared_phonology()?),
        normalizer: make_malayalam_normalizer()?,
        chillu_re: JsRegex::new(&format!("[{chillu_class}]"), "gu")
            .map_err(|e| format!("malayalam chillu pattern: {e}"))?,
        token_re,
        foreign,
    })
}

impl Engine for MalayalamPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(MalayalamPhonemizer::text(self, input))
    }
}

/// The registry's `ml` arm: `createMalayalam(readAsEnglish)`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    let foreign: ForeignPhonemizer = Arc::new(read_as_english);
    Ok(Arc::new(
        create_malayalam(Some(foreign)).map_err(PhonemizeError::Data)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/malayalam.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`. (One more
    // call returns the engine object itself and is not pinned.)
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["മലയാളം"], Some("mˈalajaːɭam")),
    ("phonemizeWord", &["അമ്മ"], Some("ˈamːa")),
    ("phonemizeWord", &["വെള്ളം"], Some("ʋˈeɭːam")),
    ("phonemizeWord", &["കുട്ടി"], Some("kˈuʈːi")),
    ("phonemizeWord", &["അടി"], Some("ˈaɖi")),
    ("phonemizeWord", &["കറുക"], Some("kˈaruɡa")),
    ("phonemizeWord", &["പണ്ട്"], Some("pˈaɳɖɨ")),
    ("phonemizeWord", &["നാല്"], Some("nˈaːlɨ")),
    ("phonemizeWord", &["വീട്"], Some("ʋˈiːʈɨ")),
    ("phonemizeWord", &["അച്ഛൻ"], Some("ˈat͡ʃʰːan")),
    ("phonemizeWord", &["അംശം"], Some("ˈamʃam")),
    ("phonemizeWord", &["അംഗം"], Some("ˈãŋɡam")),
    ("getPhonemizer(\"ml\").text", &["100"], Some("nˈuːrɨ")),
    ("getPhonemizer(\"ml\").text", &["5"], Some("ˈaɲt͡ʃɨ")),
    ("getPhonemizer(\"ml\").text", &["100000"], Some("lˈakʂam")),
    ("getPhonemizer(\"ml\").text", &["10000000"], Some("kˈoːɖi")),
    ("getPhonemizer(\"ml\").text", &["21"], Some("ˈiɾubat̪ːijonːɨ")),
    ("getPhonemizer(\"ml\").text", &["45"], Some("nˈaːlpat̪ːijaɲt͡ʃɨ")),
    ("getPhonemizer(\"ml\").text", &["22"], Some("ˈiɾubat̪ːiɾaɳɖɨ")),
    ("getPhonemizer(\"ml\").text", &["200"], Some("ˈiɾunːuːrɨ")),
    ("getPhonemizer(\"ml\").text", &["500"], Some("ˈaɲːuːrɨ")),
    ("getPhonemizer(\"ml\").text", &["900"], Some("t̪ˈoɭːaːjiɾam")),
    ("getPhonemizer(\"ml\").text", &["150"], Some("nˈuːrːi ˈampat̪ɨ")),
    ("getPhonemizer(\"ml\").text", &["1976"], Some("ˈaːjiɾat̪ːi t̪ˈoɭːaːjiɾat̪ːi ˈeɻubat̪ːijaːrɨ")),
    ("getPhonemizer(\"ml\").text", &["2011"], Some("ɾˈaɳɖaːjiɾat̪ːi pˈad̪inonːɨ")),
    ("getPhonemizer(\"ml\").text", &["3000"], Some("mˈuːʋaːjiɾam")),
    ("getPhonemizer(\"ml\").text", &["ഓസ്\u{200c}ട്രേലിയ"], Some("ˈoːsʈɾeːlija")),
    ("getPhonemizer(\"ml\").text", &["സ്\u{200c}പീക്കർ"], Some("spˈiːkːaɾ")),
    ("getPhonemizer(\"ml\").text", &["വിസ്താരത്തില്\u{200d}"], Some("ʋˈist̪aːɾat̪ːil")),
    ("getPhonemizer(\"ml\").text", &["വിസ്താരത്തിൽ"], Some("ʋˈist̪aːɾat̪ːil")),
    ("getPhonemizer(\"ml\").text", &["1,234"], Some("ˈaːjiɾat̪ːi ˈiɾunːuːrːi mˈupːat̪ːinaːlɨ")),
    ("getPhonemizer(\"ml\").text", &["1789-ൽ"], Some("ˈaːjiɾat̪ːi ˈeɻunuːrːi ˈeɳpat̪ːijompad̪il")),
    ("getPhonemizer(\"ml\").text", &["18-ആം"], Some("pˈad̪ineʈːaːm")),
    ("getPhonemizer(\"ml\").text", &["7-മത്തെ"], Some("ˈeːɻaːmat̪ːe")),
    ("getPhonemizer(\"ml\").text", &["1970-കളിൽ"], Some("ˈaːjiɾat̪ːi t̪ˈoɭːaːjiɾat̪ːi ˈeɻubad̪uɡaɭil")),
    ("getPhonemizer(\"ml\").text", &["2000-ത്തിലെ"], Some("ɾˈaɳɖaːjiɾat̪ːile")),
    ("getPhonemizer(\"ml\").text", &["50%"], Some("ˈampat̪ɨ ʃˈad̪amaːnam")),
    ("getPhonemizer(\"ml\").text", &["$5"], Some("ˈaɲt͡ʃɨ ɖˈoːɭaɾ")),
    ("getPhonemizer(\"ml\").text", &["100m"], Some("nˈuːrɨ mˈiːrːaɾ")),
    ("getPhonemizer(\"ml\").text", &["93% ശതമാനം"], Some("t̪ˈoɳːuːrːimuːnːɨ ʃˈad̪amaːnam")),
    ("getPhonemizer(\"ml\").text", &["6.5"], Some("ˈaːrɨ d̪ˈaʃaːmʃam ˈaɲt͡ʃɨ")),
    ("getPhonemizer(\"ml\").text", &["06:30"], Some("ˈaːrɨ mˈupːat̪ɨ")),
    ("getPhonemizer(\"ml\").text", &["120 m³"], Some("nˈuːrːi ˈiɾubat̪ɨ kjˈuːbikɨ mˈiːrːaɾ")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_malayalam(None).unwrap();
        let mut n = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => e.phonemize_word(&js(args[0])).to_string_lossy(),
                "getPhonemizer(\"ml\").text" => crate::registry::phonemize_in("ml", &js(args[0]))
                    .unwrap()
                    .to_string_lossy(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            n += 1;
        }
        assert_eq!(n, 43);
    }
}
