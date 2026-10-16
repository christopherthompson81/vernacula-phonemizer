//! Finnish (fi) phonemizer: a greedy longest-match grapheme scan with consonant gemination and the ⟨ng⟩/⟨nk⟩
//! velar-nasal rules (no stress emitted), the symbol tier, and text() over Latin words (a foreign name
//! nativised), numbers and clause punctuation.
//! Ported from src/languages/finnish/finnish.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{GRAPHEME_KEYS, MANIFEST, try_manifest};
use super::normalize::{
    is_unreadable_finnish, normalize_finnish, normalize_finnish_initialisms, ordinal,
};
use super::numbers::{number_to_words, read_digits};
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::registry::{Engine, PhonemizeError};

/// `G[c]` for one code unit.
fn grapheme(c: u16) -> Option<&'static JsString> {
    GRAPHEME_KEYS
        .iter()
        .find(|(k, _)| k.0.len() == 1 && k.0[0] == c)
        .map(|(_, v)| v)
}

/// `phonemizeWord(word)`.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let w = word.to_lower_case();
    let u = &w.0;
    let vowel = |c: u16| MANIFEST.vowel_letters.iter().any(|v| js(v).0 == [c]);
    let (n, g) = (u16::from(b'n'), u16::from(b'g'));
    let mut out = JsString::new();
    let mut i = 0;
    while i < u.len() {
        let c = u[i];
        let next = u.get(i + 1).copied();
        if c == n && next == Some(g) {
            out.push_str(&js("ŋː"));
            i += 2;
            continue;
        }
        if c == n && next == Some(u16::from(b'k')) {
            out.push_str(&js("ŋ"));
            i += 1;
            continue;
        }
        if !vowel(c)
            && next == Some(c)
            && let Some(ph) = grapheme(c).filter(|p| !p.is_empty())
        {
            out.push_str(ph);
            out.push_str(&js("ː"));
            i += 2;
            continue;
        }
        if let Some((k, v)) = GRAPHEME_KEYS.iter().find(|(k, _)| u[i..].starts_with(&k.0)) {
            out.push_str(v);
            i += k.len();
            continue;
        }
        let ph = latin_phone(
            &JsString::from_units(&[c]),
            PhoneOpts {
                initial: i == 0,
                include_h: true,
            },
        );
        if let Some(ph) = ph {
            out.push_str(&ph);
        }
        i += 1;
    }
    out
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.!?…,;:])", *LATIN_RUN), "giu").unwrap());

const NATIVE_CLASS: &str = "[a-zäöåšž]";

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "iu")));

/// `SYMBOLS`'s argument, generated from the object literal in finnish.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it. No `countForm`: the default selector.
const SYMBOL_DATA: &str = r#"{"percent":["prosentti","prosenttia"],"currency":{"$":["dollari","dollaria"],"€":["euro","euroa"]},"units":{"km/h":["kilometri tunnissa","kilometriä tunnissa"],"m/s":["metri sekunnissa","metriä sekunnissa"],"km":["kilometri","kilometriä"],"cm":["senttimetri","senttimetriä"],"mm":["millimetri","millimetriä"],"kg":["kilogramma","kilogrammaa"],"m":["metri","metriä"]},"exponentWords":{"squared":["neliö"],"cubed":["kuutio"],"position":"compound"},"magnitudes":["miljoona","miljoonaa","miljardi","miljardia","biljoona","biljoonaa"],"ampersand":"ja","multiply":{"times":"kertaa"}}"#;

static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
    make_symbol_normalizer(&data)
});

/// The Finnish engine (`createFinnish`).
pub struct FinnishPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `FinnishPhonemizer` proves the manifest and the
/// symbol tier loaded. (The per-module differentials call them.)
impl FinnishPhonemizer {
    /// `normalizeFinnish(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_finnish(text)
    }

    /// `normalizeFinnishInitialisms(text)`.
    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_finnish_initialisms(text)
    }

    /// `SYMBOLS(text)`.
    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    /// `isUnreadableFinnish(word)`.
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_finnish(word)
    }

    /// `ordinal(n)` (normalize.ts).
    pub fn ordinal(&self, n: f64) -> Option<JsString> {
        ordinal(n).map(|o| js(&o))
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    /// `numberToWords(n, raw)` (numbers.ts).
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    /// `readDigits(digits)` (numbers.ts).
    pub fn read_digits(&self, digits: &JsString) -> JsString {
        read_digits(digits)
    }

    pub fn text(&self, raw: &JsString) -> JsString {
        let m = &*MANIFEST;
        let input = self
            .symbols
            .apply(&normalize_finnish_initialisms(&normalize_finnish(raw)));
        assemble_clauses(&input, &TOKEN, |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(num) = mm.group(2, s).filter(|n| !n.is_empty()) {
                let words = if num.len() <= 9 {
                    number_to_words(js_number(&num), Some(&num))
                } else {
                    read_digits(&num)
                };
                for wd in words.split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
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

impl Engine for FinnishPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(FinnishPhonemizer::text(self, input))
    }
}

/// `createFinnish()`. Errors when the manifest cannot be loaded or the symbol tier refuses its data.
pub fn create_finnish() -> Result<FinnishPhonemizer, String> {
    try_manifest()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(FinnishPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/finnish.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["talo"], Some("tɑlo")),
        ("phonemizeWord", &["maa"], Some("mɑː")),
        ("phonemizeWord", &["pää"], Some("pæː")),
        ("phonemizeWord", &["vesi"], Some("ʋesi")),
        ("phonemizeWord", &["kukka"], Some("kukːɑ")),
        ("phonemizeWord", &["tullut"], Some("tulːut")),
        ("phonemizeWord", &["mummo"], Some("mumːo")),
        ("phonemizeWord", &["kengät"], Some("keŋːæt")),
        ("phonemizeWord", &["rengas"], Some("reŋːɑs")),
        ("phonemizeWord", &["sänky"], Some("sæŋky")),
        ("phonemizeWord", &["kaupunki"], Some("kɑu̯puŋki")),
        ("phonemizeWord", &["pöytä"], Some("pøy̯tæ")),
        ("phonemizeWord", &["auto"], Some("ɑu̯to")),
        ("phonemizeWord", &["tie"], Some("tie̯")),
        ("phonemizeWord", &["työ"], Some("tyø̯")),
        ("phonemizeWord", &["vuosi"], Some("ʋuo̯si")),
        ("phonemizeWord", &["Suomi"], Some("suo̯mi")),
        ("createFinnish().text", &["0"], Some("nolːɑ")),
        ("createFinnish().text", &["7"], Some("sei̯tsemæn")),
        ("createFinnish().text", &["11"], Some("yksitoi̯stɑ")),
        (
            "createFinnish().text",
            &["234"],
            Some("kɑksisɑtɑːkolmekymːentæneljæ"),
        ),
        (
            "createFinnish().text",
            &["1234"],
            Some("tuhɑt kɑksisɑtɑːkolmekymːentæneljæ"),
        ),
        (
            "createFinnish().text",
            &["2000000"],
            Some("kɑksi miljoːnɑː"),
        ),
        (
            "createFinnish().text",
            &["10000000000"],
            Some("yksi nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ nolːɑ"),
        ),
        (
            "createFinnish().text",
            &["Talo on iso."],
            Some("tɑlo on iso ."),
        ),
        ("ordinal", &["1"], Some("ensimmäinen")),
        ("ordinal", &["3"], Some("kolmas")),
        ("ordinal", &["10"], Some("kymmenes")),
        ("ordinal", &["11"], Some("yhdestoista")),
        ("ordinal", &["12"], Some("kahdestoista")),
        ("ordinal", &["20"], Some("kahdeskymmenes")),
        ("ordinal", &["21"], Some("kahdeskymmenesensimmäinen")),
        ("ordinal", &["22"], Some("kahdeskymmenestoinen")),
        ("ordinal", &["100"], Some("sadas")),
        ("ordinal", &["126"], Some("sadaskahdeskymmeneskuudes")),
        ("ordinal", &["200"], Some("kahdessadas")),
        ("ordinal", &["0"], None),
        ("ordinal", &["1000"], None),
        (
            "createFinnish().text",
            &["13. toukokuuta 1931"],
            Some("kolmɑstoi̯stɑ tou̯kokuːtɑ tuhɑt yhdeksænsɑtɑːkolmekymːentæy̯ksi"),
        ),
        (
            "createFinnish().text",
            &["18. herttuatar"],
            Some("kɑhdeksɑstoi̯stɑ hertːuɑtɑr"),
        ),
        (
            "createFinnish().text",
            &["20.–24. toukokuuta"],
            Some("kɑhdeskymːenes kɑhdeskymːenesneljæs tou̯kokuːtɑ"),
        ),
        (
            "createFinnish().text",
            &["33:s"],
            Some("kolmɑskymːeneskolmɑs"),
        ),
        (
            "createFinnish().text",
            &["vuonna 1978. Jakokoski on kylä"],
            Some("ʋuo̯nːɑ tuhɑt yhdeksænsɑtɑːsei̯tsemæŋkymːentækɑhdeksɑn . jɑkokoski on kylæ"),
        ),
        (
            "createFinnish().text",
            &["Sega Model 3."],
            Some("seɡɑ model kolme ."),
        ),
        (
            "createFinnish().text",
            &["noin 2100 eaa. Urissa asui"],
            Some("noi̯n kɑksituhɑtːɑ sɑtɑ enːen ɑjɑnlɑskun ɑlkuɑ . urisːɑ ɑsui̯"),
        ),
        (
            "createFinnish().text",
            &["1 786"],
            Some("tuhɑt sei̯tsemænsɑtɑːkɑhdeksɑŋkymːentækuːsi"),
        ),
        (
            "createFinnish().text",
            &["50,7 %"],
            Some("ʋiːsikymːentæ pilkːu sei̯tsemæn prosentːiɑ"),
        ),
        (
            "createFinnish().text",
            &["13,6 cm"],
            Some("kolmetoi̯stɑ pilkːu kuːsi sentːimetriæ"),
        ),
        (
            "createFinnish().text",
            &["5 cm"],
            Some("ʋiːsi sentːimetriæ"),
        ),
        ("createFinnish().text", &["5 km"], Some("ʋiːsi kilometriæ")),
        (
            "createFinnish().text",
            &["120 km/h"],
            Some("sɑtɑkɑksikymːentæ kilometriæ tunːisːɑ"),
        ),
        (
            "createFinnish().text",
            &["3 m/s"],
            Some("kolme metriæ sekunːisːɑ"),
        ),
        (
            "createFinnish().text",
            &["76 km²"],
            Some("sei̯tsemæŋkymːentækuːsi neliøkilometriæ"),
        ),
        (
            "createFinnish().text",
            &["259 km2"],
            Some("kɑksisɑtɑːʋiːsikymːentæy̯hdeksæn neliøkilometriæ"),
        ),
        (
            "createFinnish().text",
            &["802.11m"],
            Some("kɑhdeksɑnsɑtɑːkɑksi . yksitoi̯stɑ m"),
        ),
        (
            "createFinnish().text",
            &["14–30 °C"],
            Some("neljætoi̯stɑ kolmekymːentæ ɑstetːɑ"),
        ),
        (
            "createFinnish().text",
            &["−2 °C"],
            Some("miːnus kɑksi ɑstetːɑ"),
        ),
        (
            "createFinnish().text",
            &["+33,2 °C"],
            Some("plus kolmekymːentækolme pilkːu kɑksi ɑstetːɑ"),
        ),
        (
            "createFinnish().text",
            &["1994–1997"],
            Some(
                "tuhɑt yhdeksænsɑtɑːyhdeksæŋkymːentæneljæ tuhɑt yhdeksænsɑtɑːyhdeksæŋkymːentæsei̯tsemæn",
            ),
        ),
        (
            "createFinnish().text",
            &["100 $ barrelilta"],
            Some("sɑtɑ dolːɑriɑ bɑrːeliltɑ"),
        ),
        (
            "createFinnish().text",
            &["Robinson & Cook"],
            Some("robinson jɑ koːk"),
        ),
        (
            "createFinnish().text",
            &["kello 21.01"],
            Some("kelːo kɑksikymːentæy̯ksi nolːɑ yksi"),
        ),
        (
            "createFinnish().text",
            &["kello 10.00"],
            Some("kelːo kymːenen nolːɑ nolːɑ"),
        ),
        (
            "createFinnish().text",
            &["ajalla 9.29,43"],
            Some("ɑjɑlːɑ yhdeksæn . kɑksikymːentæy̯hdeksæn pilkːu neljæ kolme"),
        ),
        ("createFinnish().text", &["CIA:n"], Some("seː iː ɑːn")),
        ("createFinnish().text", &["BKT:sta"], Some("beː koː teːstɑ")),
        ("createFinnish().text", &["YK:n"], Some("yː koːn")),
        (
            "createFinnish().text",
            &["MM-kilpailuissa"],
            Some("æm æm kilpɑi̯lui̯sːɑ"),
        ),
        ("createFinnish().text", &["USA"], Some("usɑ")),
        ("createFinnish().text", &["EU:n"], Some("eː uːn")),
        ("phonemize", &["XV", "fi"], Some("ʋiːsitoi̯stɑ")),
        ("phonemize", &["Filipp II:n", "fi"], Some("filipː kɑksi n")),
        (
            "createFinnish().text",
            &["s. 21. helmikuuta 1966"],
            Some(
                "syntynyt kɑhdeskymːenesensimːæi̯nen helmikuːtɑ tuhɑt yhdeksænsɑtɑːkuːsikymːentækuːsi",
            ),
        ),
        (
            "createFinnish().text",
            &["944 mm. Sateet"],
            Some("yhdeksænsɑtɑːneljækymːentæneljæ milːimetriæ . sɑteːt"),
        ),
        (
            "createFinnish().text",
            &["Siellä on mm. eräs"],
            Some("sie̯lːæ on muːn muɑsːɑ eræs"),
        ),
        (
            "createFinnish().text",
            &["korvasi Volvo 850:n. Rinnakkaismallina"],
            Some("korʋɑsi ʋolʋo kɑhdeksɑnsɑtɑːʋiːsikymːentæ n . rinːɑkːɑi̯smɑlːinɑ"),
        ),
        (
            "createFinnish().text",
            &["(engl. Algic languages)"],
            Some("eŋːlɑnːiksi ɑlɡik lɑŋːuɑɡes"),
        ),
        ("createFinnish().text", &["Perrault’n"], Some("perːɑu̯ltn")),
        ("createFinnish().text", &["raa'asti"], Some("rɑː ɑsti")),
        (
            "normalizeFinnish",
            &["kello 6.30 ja 7.30 välisenä"],
            Some("kello 6 30 ja 7 30 välisenä"),
        ),
        (
            "normalizeFinnish",
            &["klo 6.30 ja 7.30"],
            Some("klo 6 30 ja 7 30"),
        ),
        (
            "normalizeFinnish",
            &["kello 9.30 paikallista aikaa (2.30 UTC)"],
            Some("kello 9 30 paikallista aikaa (2 30 UTC)"),
        ),
        (
            "normalizeFinnish",
            &["(15.00 koordinoitua yleisaikaa)"],
            Some("(15 nolla nolla koordinoitua yleisaikaa)"),
        ),
        (
            "normalizeFinnish",
            &["(2.30 jotain)"],
            Some("(2.30 jotain)"),
        ),
        (
            "normalizeFinnish",
            &["yhteistuloksella 4.41,30 joka"],
            Some("yhteistuloksella 4.41 pilkku 3 0 joka"),
        ),
        ("normalizeFinnish", &["9.29,43"], Some("9.29 pilkku 4 3")),
        (
            "normalizeFinnish",
            &["Noin 11.29 protesti"],
            Some("Noin 11.29 protesti"),
        ),
        // #1574 (synthetic probes; values from the TS engine)
        (
            "normalizeFinnish",
            &["klo 6.30–7.30 välillä"],
            Some("klo 6 30–7 30 välillä"),
        ),
        (
            "normalizeFinnish",
            &["klo 6.30 - 7.30"],
            Some("klo 6 30 - 7 30"),
        ),
        (
            "normalizeFinnish",
            &["klo 6.30 ja 7.30 välillä"],
            Some("klo 6 30 ja 7 30 välillä"),
        ),
        (
            "normalizeFinnish",
            &["klo 6.30–25.30"],
            Some("klo 6 30–25.30"),
        ),
        (
            "normalizeFinnish",
            &["Arvot 1,2,3 ja 4."],
            Some("Arvot 1,2,3 ja 4."),
        ),
        ("normalizeFinnish", &["Arvot 1,25,3"], Some("Arvot 1,25,3")),
        (
            "normalizeFinnish",
            &["luku 3,14 ja 2,5"],
            Some("luku 3 pilkku 1 4 ja 2 pilkku 5"),
        ),
        (
            "phonemize",
            &["klo 6.30–7.30 välillä", "fi"],
            Some("klo kuːsi kolmekymːentæ sei̯tsemæn kolmekymːentæ ʋælilːæ"),
        ),
        (
            "phonemize",
            &["Arvot 1,2,3 ja 4.", "fi"],
            Some("ɑrʋot yksi , kɑksi , kolme jɑ neljæ ."),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_finnish().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeFinnish" => Some(e.normalize(&a(0))),
                "ordinal" => e.ordinal(js_number(&a(0))),
                "createFinnish().text" => Some(e.text(&a(0))),
                "phonemize" => Some(js(&crate::phonemize(
                    &a(0).to_string_lossy(),
                    &a(1).to_string_lossy(),
                )
                .unwrap())),
                _ => panic!("no replay for {f}"),
            }
        };
        for (f, args, want) in TS_SUITE_CALLS {
            let a = |i: usize| js(args[i]);
            let got: Option<String> = call(f, &a).map(|s| s.to_string_lossy());
            assert_eq!(got.as_deref(), *want, "{f}{args:?}");
        }
    }
}
