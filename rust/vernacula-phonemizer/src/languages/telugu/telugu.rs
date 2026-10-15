//! Native Telugu phonemizer: the generic abugida G2P with no inherent-vowel deletion, the word-final anusvara as
//! [m], geminate length, ళ్ల → [ɭː] and first-syllable stress; Dravidian cardinals, clause marks and embedded Latin
//! runs, driven by `telugu.jsonc`.
//! Ported from src/languages/telugu/telugu.ts — see that file for the corpus evidence.

use std::sync::{Arc, OnceLock};

use super::manifest::{TeluguManifest, try_manifest};
use super::normalize::{TeluguNormalizer, make_telugu_normalizer};
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

const TELUGU_WORD: &str = "ఀ-౯ౠ-ౣ";
// Generated from the TS object literal (key order preserved).
const TELUGU_DIGITS: [(&str, &str); 10] = [
    ("౦", "0"),
    ("౧", "1"),
    ("౨", "2"),
    ("౩", "3"),
    ("౪", "4"),
    ("౫", "5"),
    ("౬", "6"),
    ("౭", "7"),
    ("౮", "8"),
    ("౯", "9"),
];
const VOWEL: &str = "aeiouɾ";

/// Foreign-run phonemizer (embedded Latin → e.g. en), injected by the registry.
pub type ForeignPhonemizer = Arc<dyn Fn(&JsString) -> JsString + Send + Sync>;

pub struct TeluguPhonemizer {
    def: &'static TeluguManifest,
    g2p: AbugidaG2p,
    normalizer: TeluguNormalizer,
    token_re: JsRegex,
    foreign: Option<ForeignPhonemizer>,
}

fn to_ascii(d: &JsString) -> JsString {
    let mut out = JsString::new();
    for c in d.code_point_strings() {
        match TELUGU_DIGITS.iter().find(|(k, _)| js(k) == c) {
            Some((_, a)) => out.push_str(&js(a)),
            None => out.push_str(&c),
        }
    }
    out
}

impl TeluguPhonemizer {
    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        let norm = js_re!(r"ం$", "u").replace(&normalize(word, Form::Nfc), &js("మ్"));
        let mut x = self.g2p.g2p(&norm);
        x = js_re!(
            r"(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t͡s|d͡z|t̪ʰ|d̪ʱ|ʈʰ|ɖʱ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlʃʂsʈɖɳɭɲŋjɦʋɾr])\1(?!͡)",
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

    /// `normalizeTelugu(input)` alone (the per-module differential calls it).
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

/// `createTelugu(foreign)`.
pub fn create_telugu(foreign: Option<ForeignPhonemizer>) -> Result<TeluguPhonemizer, String> {
    let def = try_manifest()?;
    let digit_class: String = std::iter::once("0-9")
        .chain(TELUGU_DIGITS.iter().map(|(k, _)| *k))
        .collect();
    let latin = &*LATIN_RUN;
    let token_re = JsRegex::new(
        &format!(r"([{TELUGU_WORD}]+)|({latin})|([{digit_class}]+)|([।॥.?!,;:])"),
        "gu",
    )
    .map_err(|e| format!("telugu token pattern: {e}"))?;
    Ok(TeluguPhonemizer {
        def,
        g2p: make_abugida_g2p(&def.abugida, load_shared_phonology()?),
        normalizer: make_telugu_normalizer()?,
        token_re,
        foreign,
    })
}

impl Engine for TeluguPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(TeluguPhonemizer::text(self, input))
    }
}

/// The registry's `te` arm: `createTelugu(readAsEnglish)`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    let foreign: ForeignPhonemizer = Arc::new(read_as_english);
    Ok(Arc::new(
        create_telugu(Some(foreign)).map_err(PhonemizeError::Data)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::languages::telugu::numbers::{ordinal_to_words, year_to_words};

    // Every call test/telugu.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["తెలుగు"], Some("t̪ˈeluɡu")),
    ("phonemizeWord", &["చెట్టు"], Some("t͡ʃˈeʈːu")),
    ("phonemizeWord", &["మనిషి"], Some("mˈaniʂi")),
    ("phonemizeWord", &["నీళ్ళు"], Some("nˈiːɭːu")),
    ("phonemizeWord", &["పుస్తకం"], Some("pˈust̪akam")),
    ("phonemizeWord", &["ఒకటి"], Some("ˈokaʈi")),
    ("phonemizeWord", &["ఊరు"], Some("ˈuːɾu")),
    ("phonemizeWord", &["చేయి"], Some("t͡ʃˈeːji")),
    ("phonemize", &["తెలుగు భాష.", "te"], Some("t̪ˈeluɡu bʱˈaːʂa .")),
    ("numberToWords", &["21"], Some("ఇరవై ఒకటి")),
    ("numberToWords", &["93"], Some("తొంభై మూడు")),
    ("numberToWords", &["30"], Some("ముప్పై")),
    ("numberToWords", &["100"], Some("వంద")),
    ("numberToWords", &["1000"], Some("వెయ్యి")),
    ("numberToWords", &["100000"], Some("లక్ష")),
    ("numberToWords", &["10000000"], Some("కోటి")),
    ("numberToWords", &["200"], Some("రెండు వందలు")),
    ("numberToWords", &["250"], Some("రెండు వందల యాభై")),
    ("numberToWords", &["150"], Some("నూట యాభై")),
    ("numberToWords", &["2000"], Some("రెండు వేలు")),
    ("numberToWords", &["2011"], Some("రెండు వేల పదకొండు")),
    ("numberToWords", &["30000"], Some("ముప్పై వేలు")),
    ("numberToWords", &["400000"], Some("నాలుగు లక్షలు")),
    ("yearToWords", &["1976"], Some("పంతొమ్మిది వందల డెబ్బై ఆరు")),
    ("yearToWords", &["1966"], Some("పంతొమ్మిది వందల అరవై ఆరు")),
    ("yearToWords", &["1900"], Some("పంతొమ్మిది వందలు")),
    ("numberToWords", &["2013"], Some("రెండు వేల పదమూడు")),
    ("ordinalToWords", &["18"], Some("పద్దెనిమిదవ")),
    ("ordinalToWords", &["20"], Some("ఇరవయ్యవ")),
    ("ordinalToWords", &["10"], Some("పదవ")),
    ("ordinalToWords", &["190"], Some("నూట తొంభయ్యవ")),
    ("ordinalToWords", &["1970"], Some("పంతొమ్మిది వందల డెబ్బయ్యవ")),
    ("normalizeTelugu", &["స౦వత్సర౦లో"], Some("సంవత్సరంలో")),
    ("phonemize", &["స౦వత్సర౦లో", "te"], Some("sˈãʋat̪saɾãloː")),
    ("phonemize", &["సంవత్సరంలో", "te"], Some("sˈãʋat̪saɾãloː")),
    ("normalizeTelugu", &["౧౦"], Some("10")),
    ("phonemize", &["౧౦", "te"], Some("pˈad̪i")),
    ("phonemize", &["10", "te"], Some("pˈad̪i")),
    ("phonemize", &["వైట్\u{200c}హాల్", "te"], Some("ʋˈaiʈhaːl")),
    ("normalizeTelugu", &["17,000"], Some("17000")),
    ("phonemize", &["17,000", "te"], Some("pˈad̪iheːɖu ʋˈeːlu")),
    ("normalizeTelugu", &["2.4"], Some("2 పాయింట్ 4")),
    ("normalizeTelugu", &["802.11"], Some("802 పాయింట్ 1 1")),
    ("normalizeTelugu", &["5.0"], Some("5 పాయింట్ 0")),
    ("normalizeTelugu", &["93%"], Some("93 శాతం")),
    ("normalizeTelugu", &["US$30"], Some("30 డాలర్లు")),
    ("normalizeTelugu", &["US$ 14.7 బిలియన్"], Some("14 పాయింట్ 7 బిలియన్ డాలర్లు")),
    ("normalizeTelugu", &["5mm"], Some("5 మిల్లీమీటర్లు")),
    ("normalizeTelugu", &["19,500 km²"], Some("19500 చదరపు కిలోమీటర్లు")),
    ("normalizeTelugu", &["3136 mm2"], Some("3136 చదరపు మిల్లీమీటర్లు")),
    ("normalizeTelugu", &["160km/h"], Some("గంటకు 160 కిలోమీటర్లు")),
    ("normalizeTelugu", &["గంటకు 83కి.మీ/గం."], Some("గంటకు 83 కిలోమీటర్లు")),
    ("normalizeTelugu", &["(165 కి.మీ./గం)"], Some("(గంటకు 165 కిలోమీటర్లు)")),
    ("normalizeTelugu", &["2-3 కి.మీ"], Some("2-3 కిలోమీటర్లు")),
    ("normalizeTelugu", &["క్రీ.శ 1000"], Some("క్రీస్తు శకం 1000")),
    ("normalizeTelugu", &["క్రీ.పూ 5000"], Some("క్రీస్తు పూర్వం 5000")),
    ("normalizeTelugu", &["సుమారు 1100 ఏ.డి. వరకు"], Some("సుమారు పదకొండు వందలు ఏ డి వరకు")),
    ("normalizeTelugu", &["(ఉదా. వీసా)"], Some("(ఉదాహరణకు వీసా)")),
    ("normalizeTelugu", &["1 యు.ఎస్."], Some("1 యు ఎస్.")),
    ("normalizeTelugu", &["11:00 తరువాత"], Some("11 తరువాత")),
    ("normalizeTelugu", &["8:30 గంటలకు"], Some("8 30 గంటలకు")),
    ("phonemize", &["11:00", "te"], Some("pˈad̪akõɳɖu")),
    ("normalizeTelugu", &["24½ inches"], Some("24 పాయింట్ 5 అంగుళాలు")),
    ("normalizeTelugu", &["18వ శతాబ్దం"], Some("పద్దెనిమిదవ శతాబ్దం")),
    ("normalizeTelugu", &["1970వ"], Some("పంతొమ్మిది వందల డెబ్బయ్యవ")),
    ("normalizeTelugu", &["60వది"], Some("అరవయ్యవది")),
    ("phonemize", &["120 m³", "te"], Some("nˈuːʈa ˈiɾaʋai kjˈuːbik mˈiːʈaɾlu")),
    ("phonemize", &["1995", "te"], Some("pˈãn̪t̪omːid̪i ʋˈãn̪d̪ala t̪ˈõmbʱai ˈajid̪u")),
    ("phonemize", &["1995.", "te"], Some("pˈãn̪t̪omːid̪i ʋˈãn̪d̪ala t̪ˈõmbʱai ˈajid̪u .")),
    ("phonemize", &["1749,", "te"], Some("pˈad̪iheːɖu ʋˈãn̪d̪ala nˈalabʱai t̪ˈomːid̪i ,")),
    ("phonemize", &["1995.5", "te"], Some("ʋˈejːi t̪ˈomːid̪i ʋˈãn̪d̪ala t̪ˈõmbʱai ˈajid̪u pˈaːjĩɳʈ ˈajid̪u")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_telugu(None).unwrap();
        let d = &try_manifest().unwrap().numbers;
        let n = |s: &str| s.parse::<u64>().unwrap();
        let mut count = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => e.phonemize_word(&js(args[0])).to_string_lossy(),
                "normalizeTelugu" => e.normalize(&js(args[0])).to_string_lossy(),
                "numberToWords" => number_to_words(n(args[0]), d).to_string_lossy(),
                "yearToWords" => year_to_words(n(args[0]), d).to_string_lossy(),
                "ordinalToWords" => {
                    let suffix = args.get(1).copied().unwrap_or("వ");
                    ordinal_to_words(n(args[0]), &js(suffix), d).to_string_lossy()
                }
                "phonemize" => crate::phonemize(args[0], args[1]).unwrap(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            count += 1;
        }
        assert_eq!(count, 71);
    }
}
