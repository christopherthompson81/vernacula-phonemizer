//! Croatian (hr) phonemizer: the shared Serbo-Croatian g2p (Serbian's `phonemize_word`, the foreign-letter
//! fold) with Croatian's own cardinal words, a Latin-only tokenizer whose number token carries the
//! thousands periods and the decimal comma, and the symbol tier applied around the normalizer.
//! Ported from src/languages/croatian/croatian.ts — see that file for the evidence.

use std::sync::{Arc, LazyLock};

use indexmap::IndexMap;

use super::manifest::{MANIFEST, try_manifest};
use super::normalize::normalize_croatian;
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{
    ExponentPosition, ExponentWords, Multiply, PositionDecl, SymbolData, SymbolNormalizer, UnitPer,
    make_symbol_normalizer, slavic_count_form,
};
use crate::js_re;
use crate::languages::serbian::serbian::{load_shared, phonemize_word, read_word};
use crate::registry::{Engine, PhonemizeError};

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"({})|([1-9]\d{{0,2}}(?:\.\d{{3}})+(?:,\d+)?|\d+,\d+|\d+)|([.!?…,;:])",
            *LATIN_RUN
        ),
        "giu",
    )
    .unwrap()
});

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser("[a-zčćšžđ]", "iu")));

fn forms(f: &[&str]) -> Vec<String> {
    f.iter().map(|s| s.to_string()).collect()
}

/// `SYMBOLS` (exported by croatian.ts; normalize.ts applies it too).
pub(crate) static SYMBOLS: LazyLock<SymbolNormalizer> = LazyLock::new(|| {
    let mut currency = IndexMap::new();
    currency.insert("¥".to_string(), forms(&["jen"]));
    currency.insert("$".to_string(), forms(&["dolar", "dolara"]));
    currency.insert("€".to_string(), forms(&["euro"]));
    currency.insert("£".to_string(), forms(&["funta"]));
    let mut units = IndexMap::new();
    for (k, f) in [
        ("km", ["kilometar", "kilometra", "kilometara"]),
        ("m", ["metar", "metra", "metara"]),
        ("mm", ["milimetar", "milimetra", "milimetara"]),
        ("cm", ["centimetar", "centimetra", "centimetara"]),
        ("mi", ["milja", "milje", "milja"]),
        ("ghz", ["gigaherc", "gigaherca", "gigaherca"]),
    ] {
        units.insert(k.to_string(), forms(&f));
    }
    let pair = |a: &str, b: &str, c: &str, d: &str| {
        let mut m = IndexMap::new();
        m.insert(a.to_string(), b.to_string());
        m.insert(c.to_string(), d.to_string());
        m
    };
    make_symbol_normalizer(&SymbolData {
        multiply: Some(Multiply {
            times: "puta".into(),
            by: None,
        }),
        percent: Some(forms(&["posto"])),
        currency: Some(currency),
        units: Some(units),
        unit_per: Some(UnitPer::ByDenominator(pair("h", "na", "s", "u"))),
        rate_denominators: Some(pair("h", "sat", "s", "sekundi")),
        exponent_words: Some(ExponentWords {
            squared: Some(forms(&["kvadratni", "kvadratna", "kvadratnih"])),
            cubed: Some(forms(&["kubni", "kubna", "kubnih"])),
            position: Some(PositionDecl::All(ExponentPosition::Before)),
        }),
        count_form: Some(Arc::new(slavic_count_form)),
        ..Default::default()
    })
    .expect("croatian SYMBOLS")
});

/// The Croatian engine (`createCroatian`).
pub struct CroatianPhonemizer;

impl CroatianPhonemizer {
    /// `normalizeCroatian(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_croatian(text)
    }

    /// `SYMBOLS(text)`.
    pub fn symbols(&self, text: &JsString) -> JsString {
        SYMBOLS.apply(text)
    }

    /// `numberToWords(n, raw)`.
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let m = &*MANIFEST;
        let normalized = SYMBOLS.apply(&normalize_croatian(input));
        assemble_clauses(&normalized, &TOKEN, |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&read_word(&**NAT, &w));
            } else if let Some(d) = mm.group(2, s).filter(|d| !d.is_empty()) {
                let a = js_re!(r"\.", "gu").replace(&d, &JsString::new());
                let digits = js_re!(",", "gu").replace(&a, &JsString::new());
                for wd in number_to_words(js_number(&digits), Some(&digits)).split(&js(" ")) {
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

impl Engine for CroatianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(CroatianPhonemizer::text(self, input))
    }
}

/// `createCroatian()`. Errors when a manifest or an accent table cannot be loaded.
pub fn create_croatian() -> Result<CroatianPhonemizer, String> {
    load_shared()?;
    try_manifest()?;
    Ok(CroatianPhonemizer)
}

/// test/croatian.test.ts's literal-input pins, extracted mechanically (`.probe/sh/pins.mts`) with every value
/// evaluated from the TS engine; never hand-typed.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn croatian_test_ts_pins() {
        let e = create_croatian().unwrap();
        assert_eq!(crate::phonemize("the", "hr").unwrap(), "te");
        assert_eq!(crate::phonemize("Matthew", "hr").unwrap(), "mˈateʋ");
        assert_eq!(crate::phonemize("Thomson", "hr").unwrap(), "tˈomson");
        assert_eq!(crate::phonemize("Lufthansa", "hr").unwrap(), "lˈuftansa");
        assert!(
            crate::phonemize("prethodni", "hr")
                .unwrap()
                .contains("txodni"),
            "phonemize(\"prethodni\", \"hr\")"
        );
        assert!(
            crate::phonemize("pothranjenost", "hr")
                .unwrap()
                .contains("txraɲenost"),
            "phonemize(\"pothranjenost\", \"hr\")"
        );
        assert!(
            crate::phonemize("pothlađenost", "hr")
                .unwrap()
                .contains("txlad͡ʑenost"),
            "phonemize(\"pothlađenost\", \"hr\")"
        );
        assert_eq!(crate::phonemize("Anna", "hr").unwrap(), "ˈana");
        assert_eq!(crate::phonemize("Holland", "hr").unwrap(), "xˈoland");
        assert_eq!(crate::phonemize("Ellsworth", "hr").unwrap(), "ˈelsʋort");
        assert_eq!(
            crate::phonemize("najjednostavniji", "hr").unwrap(),
            "nˈajednostaʋniji"
        );
        assert_eq!(crate::phonemize("zoo", "hr").unwrap(), "zˈoo");
        assert_eq!(crate::phonemize("BBC", "hr").unwrap(), "be be t͡se");
        assert_eq!(crate::phonemize("www", "hr").unwrap(), "ʋʋʋ");
        assert!(
            crate::phonemize("35° s padavinama", "hr")
                .unwrap()
                .contains("stˈupɲeʋa s "),
            "phonemize(\"35° s padavinama\", \"hr\")"
        );
        assert!(
            crate::phonemize("35° S od ekvatora", "hr")
                .unwrap()
                .contains("jˈu˥˩ʒno"),
            "phonemize(\"35° S od ekvatora\", \"hr\")"
        );
        assert!(
            crate::phonemize("35° w", "hr")
                .unwrap()
                .contains("zˈaː˥˩padno"),
            "phonemize(\"35° w\", \"hr\")"
        );
        assert_eq!(
            crate::phonemize("35°", "hr").unwrap(),
            "trˈiː˩˥deset peː˥˩t stˈupɲeʋa"
        );
        assert!(
            crate::phonemize("1°", "hr").unwrap().contains("stˈuː˥˩paɲ"),
            "phonemize(\"1°\", \"hr\")"
        );
        assert!(
            crate::phonemize("2°", "hr").unwrap().contains("stˈupɲa"),
            "phonemize(\"2°\", \"hr\")"
        );
        assert!(
            crate::phonemize("Temperatura 300°K je", "hr")
                .unwrap()
                .contains("stˈupɲeʋa k"),
            "phonemize(\"Temperatura 300°K je\", \"hr\")"
        );
        assert_eq!(
            crate::phonemize("mlijeko", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "mlijˈeː˩˥ko"
        );
        assert_eq!(
            crate::phonemize("đak", "hr").unwrap().trim().to_string(),
            "d͡ʑaː˥˩k"
        );
        assert_eq!(
            crate::phonemize("ljubav", "hr").unwrap().trim().to_string(),
            "ʎˈuː˩˥baʋ"
        );
        assert_eq!(
            crate::phonemize("čovjek", "hr").unwrap().trim().to_string(),
            "t͡ʃˈoʋjek"
        );
        assert_eq!(
            crate::phonemize("1000", "hr").unwrap().trim().to_string(),
            "tˈisut͡ɕu"
        );
        assert_eq!(
            crate::phonemize("2000", "hr").unwrap().trim().to_string(),
            "dʋˈi˥˩je tˈi˥˩sut͡ɕe"
        );
        assert_eq!(
            crate::phonemize("200", "hr").unwrap().trim().to_string(),
            "dʋjˈe˥˩sto"
        );
        assert_eq!(
            crate::phonemize("1000000", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "jˈe˩˥dan milˈi˩˥jun"
        );
        assert_eq!(
            crate::phonemize("1000", "hr").unwrap().trim().to_string(),
            "tˈisut͡ɕu"
        );
        assert_eq!(
            crate::phonemize("2000", "hr").unwrap().trim().to_string(),
            "dʋˈi˥˩je tˈi˥˩sut͡ɕe"
        );
        assert_eq!(
            crate::phonemize("5000", "hr").unwrap().trim().to_string(),
            "peː˥˩t tˈisut͡ɕa"
        );
        assert_eq!(
            crate::phonemize("21000", "hr").unwrap().trim().to_string(),
            "dʋˈaː˩˥deset jednˈa tˈisut͡ɕa"
        );
        assert_eq!(
            crate::phonemize("1000000", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "jˈe˩˥dan milˈi˩˥jun"
        );
        assert_eq!(
            crate::phonemize("2000000", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "dʋaː˥˩ milijˈuna"
        );
        assert_eq!(
            e.normalize(&js("15. kolovoza 1940.")).to_string_lossy(),
            "petnaestog kolovoza tisuću devetsto četrdesete."
        );
        assert_eq!(
            e.normalize(&js("1683. dinastija Qing")).to_string_lossy(),
            "tisuću šeststo osamdeset treće dinastija Qing"
        );
        assert_eq!(
            e.normalize(&js("(1644. - 1912.) prisilno"))
                .to_string_lossy(),
            "(tisuću šeststo četrdeset četvrte - tisuću devetsto dvanaeste) prisilno"
        );
        assert_eq!(
            e.normalize(&js("rezultata 6:6.")).to_string_lossy(),
            "rezultata 6:6."
        );
        assert_eq!(
            e.normalize(&js("zauzeo 190. mjesto")).to_string_lossy(),
            "zauzeo sto devedeseto mjesto"
        );
        assert_eq!(
            e.normalize(&js("oluja 4. kategorije")).to_string_lossy(),
            "oluja četvrte kategorije"
        );
        assert_eq!(
            crate::phonemize("7. najvećim", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "sˈedmom nˈajʋet͡ɕim"
        );
        assert_eq!(
            crate::phonemize("15. stoljeća", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "petnˈaestoɡ stˈoʎet͡ɕa"
        );
        assert_eq!(
            crate::phonemize("2.500 ¥", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "dʋˈi˥˩je tˈi˥˩sut͡ɕe pˈeː˥˩tsto jen"
        );
        assert_eq!(
            crate::phonemize("40.000", "hr").unwrap().trim().to_string(),
            "t͡ʃetrdˈe˩˥set tˈisut͡ɕa"
        );
        assert_eq!(
            crate::phonemize("2,4 Ghz", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "dʋaː˥˩ zˈarez t͡ʃˈe˩˥tiri ɡˈiɡaxert͡sa"
        );
        assert_eq!(
            crate::phonemize("22:00 i 23:00 h", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "dʋˈaː˩˥deset dʋaː˥˩ sˈaː˥˩ta i dʋˈaː˩˥deset triː˥˩ sˈaː˥˩ta"
        );
        assert_eq!(
            crate::phonemize("23:35 h", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "dʋˈaː˩˥deset triː˥˩ sˈaː˥˩ta i trˈiː˩˥deset peː˥˩t minˈuː˩˥ta"
        );
        assert_eq!(
            crate::phonemize("70 km/h", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "sedamdˈe˩˥set kˈilometara na saː˥˩t"
        );
        assert_eq!(
            crate::phonemize("40 milja/h", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "t͡ʃetrdˈe˩˥set mˈiː˥˩ʎa na saː˥˩t"
        );
        assert_eq!(
            crate::phonemize("n. e.", "hr").unwrap().trim().to_string(),
            "nˈoʋe ˈere ."
        );
        assert_eq!(
            crate::phonemize("p.n.e.", "hr").unwrap().trim().to_string(),
            "prˈi˥˩je nˈoʋe ˈere ."
        );
        assert_eq!(
            crate::phonemize("od 400. g. n. e.", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "od t͡ʃetˈiristote nˈoʋe ˈere ."
        );
        assert_eq!(
            crate::phonemize("1000. g. pr. Kr. Asirci", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "tisˈut͡ɕite prˈi˥˩je krˈista asˈiː˩˥rt͡si"
        );
        assert_eq!(
            crate::phonemize("I. svjetskog rata", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "pˈr˩˥ʋoɡ sʋjˈetskoɡ rˈata"
        );
        assert_eq!(
            crate::phonemize("II. svjetskom ratu", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "drˈuː˥˩ɡom sʋjˈetskom rˈatu"
        );
        assert_eq!(
            crate::phonemize("itd.", "hr").unwrap().trim().to_string(),
            "i tˈa˩˥ko dˈa˥˩ʎe ."
        );
        assert_eq!(
            crate::phonemize("Dr. Moll", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "dˈo˥˩ktor mol"
        );
        assert_eq!(
            crate::phonemize("George W. Bush", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "ɡˈeorɡe ʋ busx"
        );
        assert_eq!(
            crate::phonemize("George V. Bush", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "ɡˈeorɡe ʋ busx"
        );
        assert_eq!(
            crate::phonemize("90 °F", "hr").unwrap().trim().to_string(),
            "deʋedˈe˩˥set stˈupɲeʋa fˈarenxajta"
        );
        assert_eq!(
            crate::phonemize("35° W", "hr").unwrap().trim().to_string(),
            "trˈiː˩˥deset peː˥˩t stˈupɲeʋa zˈaː˥˩padno"
        );
        assert_eq!(
            crate::phonemize("1/5 inča", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "jˈe˩˥dan pˈeti ˈiː˥˩nt͡ʃa"
        );
        assert!(
            crate::phonemize("1990-1995", "hr")
                .unwrap()
                .trim()
                .to_string()
                .contains("do"),
            "ph(\"1990-1995\")"
        );
        assert_eq!(
            crate::phonemize("4×4", "hr").unwrap().trim().to_string(),
            "t͡ʃˈe˩˥tiri pˈuta t͡ʃˈe˩˥tiri"
        );
        assert_eq!(
            crate::phonemize("-5", "hr").unwrap().trim().to_string(),
            "mˈiː˩˥nus peː˥˩t"
        );
        assert_eq!(
            crate::phonemize("UTC+1", "hr").unwrap().trim().to_string(),
            "u te t͡se plus jˈe˩˥dan"
        );
        assert_eq!(
            crate::phonemize("N. E. Kovač je došao", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "ne kˈo˩˥ʋat͡ʃ je dˈoʃao"
        );
        assert_eq!(
            crate::phonemize("P. N. E. Horvat", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "pne xˈo˩˥rʋat"
        );
        assert_eq!(
            crate::phonemize("n.e. i dalje", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "nˈoʋe ˈere i dˈa˥˩ʎe"
        );
        assert_eq!(
            crate::phonemize("p.n.e.", "hr").unwrap().trim().to_string(),
            "prˈi˥˩je nˈoʋe ˈere ."
        );
        assert_eq!(
            crate::phonemize("od 1500. p. n. e.", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "od tˈisut͡ɕu pˈetstote prˈi˥˩je nˈoʋe ˈere ."
        );
        assert_eq!(
            crate::phonemize("400. g. n. e.", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "t͡ʃetˈiristote nˈoʋe ˈere ."
        );
        assert_eq!(
            crate::phonemize("1000. g. pr. Kr.", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "tisˈut͡ɕite prˈi˥˩je krˈista ."
        );
        assert_eq!(
            crate::phonemize("tijekom 1990-ih bilo je", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "tijˈeː˥˩kom tˈisut͡ɕu dˈe˥˩ʋetsto deʋedˈe˩˥setix bˈilo je"
        );
        assert_eq!(
            e.normalize(&js("u 1970-ih godinama")).to_string_lossy(),
            "u tisuću devetsto sedamdesetih godinama"
        );
        assert_eq!(
            e.normalize(&js("15-og svibnja")).to_string_lossy(),
            "petnaestog svibnja"
        );
        assert_eq!(
            e.normalize(&js("1480-ih, kada")).to_string_lossy(),
            "tisuću četiristo osamdesetih, kada"
        );
        assert_eq!(
            e.normalize(&js("1970-ih")).to_string_lossy(),
            "tisuću devetsto sedamdesetih"
        );
        assert_eq!(e.normalize(&js("3-d model")).to_string_lossy(), "3-d model");
        assert_eq!(
            e.normalize(&js("2-3 dana")).to_string_lossy(),
            "2 do 3 dana"
        );
        assert_eq!(
            crate::phonemize("133 m/s", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "stoː˥˩ trˈiː˩˥deset triː˥˩ mˈetra u sekˈuː˩˥ndi"
        );
        assert_eq!(
            crate::phonemize("5 km/s", "hr").unwrap().trim().to_string(),
            "peː˥˩t kˈilometara u sekˈuː˩˥ndi"
        );
        assert_eq!(
            crate::phonemize("70 km/h", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "sedamdˈe˩˥set kˈilometara na saː˥˩t"
        );
        assert_eq!(
            crate::phonemize("40 mi/h", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "t͡ʃetrdˈe˩˥set mˈiː˥˩ʎa na saː˥˩t"
        );
        assert_eq!(
            crate::phonemize("1.000.000", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "jˈe˩˥dan milˈi˩˥jun"
        );
        assert_eq!(
            crate::phonemize("2,5", "hr").unwrap().trim().to_string(),
            "dʋaː˥˩ zˈarez peː˥˩t"
        );
        assert_eq!(
            crate::phonemize("0,001 grama", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "nˈu˥˩la zˈarez nˈu˥˩la nˈu˥˩la jˈe˩˥dan ɡrˈama"
        );
        assert_eq!(
            crate::phonemize("0,001", "hr").unwrap().trim().to_string(),
            "nˈu˥˩la zˈarez nˈu˥˩la nˈu˥˩la jˈe˩˥dan"
        );
        assert_eq!(
            crate::phonemize("0,5 grama", "hr")
                .unwrap()
                .trim()
                .to_string(),
            "nˈu˥˩la zˈarez peː˥˩t ɡrˈama"
        );
        assert_eq!(
            crate::phonemize("1,5 km", "hr").unwrap().trim().to_string(),
            "jˈe˩˥dan zˈarez peː˥˩t kˈilometara"
        );
        assert_eq!(
            crate::phonemize("5,0", "hr").unwrap().trim().to_string(),
            "peː˥˩t zˈarez nˈu˥˩la"
        );
    }
}
