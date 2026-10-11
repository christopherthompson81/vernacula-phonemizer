//! Lithuanian (lt) phonemizer, canonical IPA: the rule g2p's segments joined (stress unmarked), text() over the
//! normalizer and the initialism pass, Latin words (nativised), numbers and clause punctuation.
//! Ported from src/languages/lithuanian/lithuanian.ts — see that file for the evidence.

use std::sync::LazyLock;

use super::g2p::{Seg, to_segments};
use super::manifest::{MANIFEST, try_manifest};
use super::normalize::{normalize_lithuanian, normalize_lithuanian_initialisms};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::registry::{Engine, PhonemizeError};

/// `phonemizeWord(word)`.
pub fn phonemize_word(word: &JsString) -> JsString {
    let mut out = JsString::new();
    for s in to_segments(word) {
        out.push_str(&s.ph);
    }
    out
}

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[A-Za-ząčęėįšųūžĄČĘĖĮŠŲŪŽ]", "u")));

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.!?…,;:])", *LATIN_RUN), "gu").unwrap());

/// The Lithuanian engine (`createLithuanian`).
pub struct LithuanianPhonemizer;

impl LithuanianPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_lithuanian(text)
    }

    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_lithuanian_initialisms(text)
    }

    pub fn is_unreadable(&self, word: &JsString) -> bool {
        super::normalize::is_unreadable_lithuanian(word)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn segments(&self, word: &JsString) -> Vec<Seg> {
        to_segments(word)
    }

    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    pub fn read_digits(&self, digits: &JsString) -> JsString {
        super::numbers::read_digits(digits)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let m = &*MANIFEST;
        let normalized = normalize_lithuanian_initialisms(&normalize_lithuanian(input));
        assemble_clauses(&normalized, &TOKEN, |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(d) = mm.group(2, s).filter(|d| !d.is_empty()) {
                for wd in number_to_words(js_number(&d), Some(&d)).split(&js(" ")) {
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

impl Engine for LithuanianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(LithuanianPhonemizer::text(self, input))
    }
}

/// `createLithuanian()`. Errors when the manifest cannot be loaded.
pub fn create_lithuanian() -> Result<LithuanianPhonemizer, String> {
    try_manifest()?;
    Ok(LithuanianPhonemizer)
}

/// test/lithuanian.test.ts's literal-input pins, extracted mechanically (`.probe/sh/pins.mts`) with every value
/// evaluated from the TS engine; never hand-typed.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lithuanian_test_ts_pins() {
        let e = create_lithuanian().unwrap();
        assert_eq!(
            crate::languages::lithuanian::lithuanian::phonemize_word(&js("katinas"))
                .to_string_lossy(),
            "kɐtʲɪnɐs"
        );
        assert_eq!(
            crate::languages::lithuanian::lithuanian::phonemize_word(&js("penki"))
                .to_string_lossy(),
            "pʲɛŋʲkʲɪ"
        );
        assert_eq!(
            crate::languages::lithuanian::lithuanian::phonemize_word(&js("šeši")).to_string_lossy(),
            "ʃʲɛʃʲɪ"
        );
        assert_eq!(
            crate::languages::lithuanian::lithuanian::phonemize_word(&js("medis"))
                .to_string_lossy(),
            "mʲɛdʲɪs"
        );
        assert_eq!(
            crate::languages::lithuanian::lithuanian::phonemize_word(&js("knyga"))
                .to_string_lossy(),
            "knʲiːɡɐ"
        );
        assert_eq!(
            crate::languages::lithuanian::lithuanian::phonemize_word(&js("naktis"))
                .to_string_lossy(),
            "nɐktʲɪs"
        );
        assert_eq!(
            crate::languages::lithuanian::lithuanian::phonemize_word(&js("čia")).to_string_lossy(),
            "t͡ʃʲɛ"
        );
        assert_eq!(
            crate::languages::lithuanian::lithuanian::phonemize_word(&js("ačiū")).to_string_lossy(),
            "ɐt͡ʃʲuː"
        );
        assert_eq!(
            crate::languages::lithuanian::lithuanian::phonemize_word(&js("Dievas"))
                .to_string_lossy(),
            "dʲiɛʋɐs"
        );
        assert_eq!(
            crate::languages::lithuanian::lithuanian::phonemize_word(&js("lietuva"))
                .to_string_lossy(),
            "lʲiɛtʊʋɐ"
        );
        assert_eq!(
            crate::languages::lithuanian::lithuanian::phonemize_word(&js("aštuoni"))
                .to_string_lossy(),
            "ɐʃtuɔnʲɪ"
        );
        assert_eq!(
            crate::languages::lithuanian::lithuanian::phonemize_word(&js("dirbti"))
                .to_string_lossy(),
            "dʲɪrʲpʲtʲɪ"
        );
        assert_eq!(
            crate::languages::lithuanian::lithuanian::phonemize_word(&js("žmogus"))
                .to_string_lossy(),
            "ʒmoːɡʊs"
        );
        assert_eq!(
            crate::languages::lithuanian::lithuanian::phonemize_word(&js("kalba"))
                .to_string_lossy(),
            "kɐlbɐ"
        );
        assert_eq!(
            e.text(&js("7")).to_string_lossy().trim().to_string(),
            "sʲɛpʲtʲiːnʲɪ"
        );
        assert_eq!(
            e.text(&js("15")).to_string_lossy().trim().to_string(),
            "pʲɛŋʲkʲoːlʲɪkɐ"
        );
        assert_eq!(
            e.text(&js("21")).to_string_lossy().trim().to_string(),
            "dʲʋʲɪdʲɛʃʲɪmt ʋʲiɛnɐs"
        );
        assert_eq!(
            e.text(&js("101")).to_string_lossy().trim().to_string(),
            "ʃʲɪmtɐs ʋʲiɛnɐs"
        );
        assert_eq!(
            e.text(&js("555")).to_string_lossy().trim().to_string(),
            "pʲɛŋʲkʲɪ ʃʲɪmtɐɪ pʲɛŋʲkʲɛzʲdʲɛʃʲɪmt pʲɛŋʲkʲɪ"
        );
        assert_eq!(
            e.text(&js("1000")).to_string_lossy().trim().to_string(),
            "tuːkstɐnʲtʲɪs"
        );
        assert_eq!(
            e.text(&js("2000")).to_string_lossy().trim().to_string(),
            "dʊ tuːkstɐnʲt͡ʃʲɛɪ"
        );
        assert_eq!(
            e.text(&js("10000")).to_string_lossy().trim().to_string(),
            "dʲɛʃʲɪmt tuːkstɐnʲt͡ʃʲuː"
        );
        assert_eq!(
            e.text(&js("21000")).to_string_lossy().trim().to_string(),
            "dʲʋʲɪdʲɛʃʲɪmt ʋʲiɛnɐs tuːkstɐnʲtʲɪs"
        );
        assert_eq!(
            e.text(&js("100000")).to_string_lossy().trim().to_string(),
            "ʃʲɪmtɐs tuːkstɐnʲt͡ʃʲuː"
        );
        assert_eq!(
            e.text(&js("1000000")).to_string_lossy().trim().to_string(),
            "ʋʲiɛnɐs mʲɪlʲɪjoːnɐs"
        );
        assert_eq!(
            e.text(&js("1000000000"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "ʋʲiɛnɐs mʲɪlʲɪjɛrdɐs"
        );
        assert_eq!(
            e.normalize(&js("1 %")).to_string_lossy(),
            "vienas procentas"
        );
        assert_eq!(e.normalize(&js("2 %")).to_string_lossy(), "du procentai");
        assert_eq!(
            e.normalize(&js("10 %")).to_string_lossy(),
            "dešimt procentų"
        );
        assert_eq!(
            e.normalize(&js("11 %")).to_string_lossy(),
            "vienuolika procentų"
        );
        assert_eq!(
            e.normalize(&js("21 %")).to_string_lossy(),
            "dvidešimt vienas procentas"
        );
        assert_eq!(
            e.normalize(&js("101 %")).to_string_lossy(),
            "šimtas vienas procentas"
        );
        assert_eq!(
            e.normalize(&js("1 km")).to_string_lossy(),
            "vienas kilometras"
        );
        assert_eq!(e.normalize(&js("2 km")).to_string_lossy(), "du kilometrai");
        assert_eq!(
            e.normalize(&js("100 km")).to_string_lossy(),
            "šimtas kilometrų"
        );
        assert_eq!(
            e.normalize(&js("1 °C")).to_string_lossy(),
            "vienas laipsnis Celsijaus"
        );
        assert_eq!(
            e.normalize(&js("17 °C")).to_string_lossy(),
            "septyniolika laipsnių Celsijaus"
        );
        assert_eq!(
            e.normalize(&js("1 km²")).to_string_lossy(),
            "vienas kvadratinis kilometras"
        );
        assert_eq!(
            e.normalize(&js("2 km²")).to_string_lossy(),
            "du kvadratiniai kilometrai"
        );
        assert_eq!(
            e.normalize(&js("100 km²")).to_string_lossy(),
            "šimtas kvadratinių kilometrų"
        );
        assert_eq!(
            e.normalize(&js("4 val.")).to_string_lossy(),
            "keturios valandos"
        );
        assert_eq!(
            e.normalize(&js("21 val.")).to_string_lossy(),
            "dvidešimt viena valanda"
        );
        assert_eq!(
            e.normalize(&js("15 val.")).to_string_lossy(),
            "penkiolika valandų"
        );
        assert_eq!(e.normalize(&js("2000 M.")).to_string_lossy(), "2000 M.");
        assert_eq!(
            e.normalize(&js("nuo maždaug m. e. pradžios"))
                .to_string_lossy(),
            "nuo maždaug mūsų eros pradžios"
        );
        assert_eq!(
            e.normalize(&js("1890–1906")).to_string_lossy(),
            "nuo 1890 iki 1906"
        );
        assert_eq!(
            e.normalize(&js("nuo 467 000 iki 114 000"))
                .to_string_lossy(),
            "nuo 467000 iki 114000"
        );
        assert_eq!(
            e.normalize(&js("NUO 5-10 km")).to_string_lossy(),
            "NUO 5 iki dešimt kilometrų"
        );
        assert_eq!(
            e.normalize(&js("1997–1998 metais")).to_string_lossy(),
            "1997 iki 1998 metais"
        );
        assert_eq!(
            e.normalize(&js("-5 °C")).to_string_lossy(),
            "minus penki laipsniai Celsijaus"
        );
        assert_eq!(
            e.normalize(&js("(-1,1 %)")).to_string_lossy(),
            "(minus vienas kablelis vienas procentų)"
        );
        assert_eq!(
            e.normalize(&js("iki +40 °C")).to_string_lossy(),
            "iki plius keturiasdešimt laipsnių Celsijaus"
        );
        assert_eq!(
            e.normalize(&js("15-16 °C")).to_string_lossy(),
            "nuo 15 iki šešiolika laipsnių Celsijaus"
        );
        assert_eq!(
            e.normalize(&js("Kaunas-Vilnius")).to_string_lossy(),
            "Kaunas-Vilnius"
        );
        assert_eq!(e.normalize(&js("MiG-29")).to_string_lossy(), "MiG-29");
        assert_eq!(
            e.normalize(&js("$24 milijonus kasmet")).to_string_lossy(),
            "dvidešimt keturi milijonus dolerių kasmet"
        );
        assert_eq!(
            e.normalize(&js("$4000, nugalėtojui")).to_string_lossy(),
            "keturi tūkstančiai dolerių , nugalėtojui"
        );
        assert_eq!(
            e.normalize(&js("$90 milijonų dolerių")).to_string_lossy(),
            "devyniasdešimt milijonų dolerių"
        );
        assert_eq!(
            e.normalize(&js("3 mln. km²")).to_string_lossy(),
            "trys milijonai kvadratinių kilometrų"
        );
        assert_eq!(
            e.normalize(&js("19 tūkst. hektarų")).to_string_lossy(),
            "devyniolika tūkstančių hektarų"
        );
        assert_eq!(e.normalize(&js("802.11m")).to_string_lossy(), "802.11m");
        assert_eq!(e.normalize(&js("802.11g")).to_string_lossy(), "802.11g");
        assert_eq!(e.normalize(&js("12.5km")).to_string_lossy(), "12.5km");
        assert_eq!(
            e.normalize(&js("44.111.333.12")).to_string_lossy(),
            "44.111.333.12"
        );
        assert_eq!(e.normalize(&js("500 m/s")).to_string_lossy(), "500 m/s");
        assert_eq!(
            e.normalize(&js("140–160 kcal/cm²")).to_string_lossy(),
            "nuo 140 iki 160 kcal/cm²"
        );
        assert_eq!(
            e.normalize(&js("neviršija 600 km.")).to_string_lossy(),
            "neviršija šeši šimtai kilometrų."
        );
        assert_eq!(e.normalize(&js("2:15:16")).to_string_lossy(), "2:15:16");
        assert_eq!(e.normalize(&js("2/3 visų")).to_string_lossy(), "2/3 visų");
        assert_eq!(
            e.normalize(&js("γράφω = graphō")).to_string_lossy(),
            "γράφω = graphō"
        );
        assert_eq!(
            e.normalize(&js("54° 54′ šiaurės platumos"))
                .to_string_lossy(),
            "54° 54′ šiaurės platumos"
        );
        assert_eq!(
            e.normalize_initialisms(&js("TSRS")).to_string_lossy(),
            "tė es er es"
        );
        assert_eq!(
            e.normalize_initialisms(&js("BVP")).to_string_lossy(),
            "bė vė pė"
        );
        assert_eq!(
            e.normalize_initialisms(&js("IBM")).to_string_lossy(),
            "i bė em"
        );
        assert_eq!(
            e.normalize_initialisms(&js("JAV")).to_string_lossy(),
            "jot a vė"
        );
        assert_eq!(e.normalize_initialisms(&js("DOS")).to_string_lossy(), "DOS");
        assert_eq!(
            e.normalize_initialisms(&js("G. R. Treviranas"))
                .to_string_lossy(),
            "gė er Treviranas"
        );
        assert_eq!(
            e.normalize_initialisms(&js("VILNIUS YRA DIDELIS"))
                .to_string_lossy(),
            "VILNIUS YRA DIDELIS"
        );
        assert_eq!(
            e.normalize(&js("Stafecka, A. & Mikuleniene, D."))
                .to_string_lossy(),
            "Stafecka, A. ir Mikuleniene, D."
        );
        assert_eq!(e.normalize(&js("2:15:16")).to_string_lossy(), "2:15:16");
        assert_eq!(
            e.normalize(&js("515,3 km/val.")).to_string_lossy(),
            "515 kablelis 3 km/val."
        );
        assert_eq!(e.normalize(&js("802.11m")).to_string_lossy(), "802.11m");
        assert_eq!(
            e.normalize(&js("12,367.7 km²")).to_string_lossy(),
            "12,367.7 km²"
        );
        assert_eq!(
            e.normalize(&js("ISBN 978-83-01-14342-8")).to_string_lossy(),
            "ISBN 978-83-01-14342-8"
        );
        assert_eq!(
            e.normalize(&js("ISBN 84-87863-63-9")).to_string_lossy(),
            "ISBN 84-87863-63-9"
        );
        assert_eq!(
            e.normalize(&js("x86-64, PowerPC")).to_string_lossy(),
            "x86-64, PowerPC"
        );
        assert_eq!(
            e.normalize(&js("Airbus A300-600ST")).to_string_lossy(),
            "Airbus A300-600ST"
        );
        assert_eq!(
            e.normalize(&js("Vilnius 1996-2005.")).to_string_lossy(),
            "Vilnius nuo 1996 iki 2005."
        );
        assert_eq!(
            e.normalize(&js("Rezultatas buvo lygus (1-1)"))
                .to_string_lossy(),
            "Rezultatas buvo lygus (1-1)"
        );
        assert_eq!(
            e.normalize(&js("pergalę rezultatu 2-1.")).to_string_lossy(),
            "pergalę rezultatu 2-1."
        );
        assert_eq!(
            e.normalize(&js("pralaimėjo komandai 155–157."))
                .to_string_lossy(),
            "pralaimėjo komandai 155–157."
        );
        assert_eq!(
            e.normalize(&js("veikė 1918–1926 metais")).to_string_lossy(),
            "veikė 1918 iki 1926 metais"
        );
        assert_eq!(
            e.normalize(&js("20 procentų")).to_string_lossy(),
            "20 procentų"
        );
        assert_eq!(
            e.normalize(&js("2 procesoriai")).to_string_lossy(),
            "2 procesoriai"
        );
        assert_eq!(e.normalize(&js("2000 M.")).to_string_lossy(), "2000 M.");
        assert_eq!(
            e.normalize(&js("Iki 7–8, o vietomis")).to_string_lossy(),
            "Iki 7–8, o vietomis"
        );
        assert_eq!(
            e.normalize(&js("nuo 1952-1967")).to_string_lossy(),
            "nuo 1952 iki 1967"
        );
        assert_eq!(
            e.normalize(&js("1997–1998 metais")).to_string_lossy(),
            "1997 iki 1998 metais"
        );
        assert_eq!(
            e.normalize(&js("19 tūkst. hektarų")).to_string_lossy(),
            "devyniolika tūkstančių hektarų"
        );
        assert_eq!(
            e.normalize(&js("apie 3 tūkstančius upių"))
                .to_string_lossy(),
            "apie 3 tūkstančius upių"
        );
        assert_eq!(
            e.normalize(&js("37 tūkstančių hektarų")).to_string_lossy(),
            "37 tūkstančių hektarų"
        );
        assert_eq!(
            e.normalize(&js("2:11.60 min. lėčiau")).to_string_lossy(),
            "2:11.60 minučių lėčiau"
        );
        assert_eq!(
            e.normalize(&js("$90 milijonų dolerių")).to_string_lossy(),
            "devyniasdešimt milijonų dolerių"
        );
        assert_eq!(
            e.normalize(&js("515,3 km/val.")).to_string_lossy(),
            "515 kablelis 3 km/val."
        );
        assert_eq!(
            e.normalize(&js("515,3 km/min.")).to_string_lossy(),
            "515 kablelis 3 km/min."
        );
        assert_eq!(
            e.normalize(&js("12,5 mg/kg")).to_string_lossy(),
            "12 kablelis 5 mg/kg"
        );
        assert_eq!(e.normalize(&js("802.11g")).to_string_lossy(), "802.11g");
        assert_eq!(
            e.normalize(&js("x1, x2 ir x3")).to_string_lossy(),
            "x1, x2 ir x3"
        );
        assert_eq!(
            e.normalize(&js("x86, PowerPC")).to_string_lossy(),
            "x86, PowerPC"
        );
        assert_eq!(
            e.normalize(&js("$90 milijonų dolerių")).to_string_lossy(),
            "devyniasdešimt milijonų dolerių"
        );
        assert_eq!(
            e.normalize(&js("1 385 000 000 gyventojų"))
                .to_string_lossy(),
            "1385000000 gyventojų"
        );
        assert_eq!(
            e.normalize(&js("1 234 567 890 123 x")).to_string_lossy(),
            "1234567890123 x"
        );
        assert_eq!(
            e.normalize(&js("19:14:07 GMT")).to_string_lossy(),
            "19:14:07 GMT"
        );
        assert_eq!(
            e.normalize(&js("802.11n sparta")).to_string_lossy(),
            "802.11n sparta"
        );
        assert!(
            e.normalize(&js("laikas 4:41.30"))
                .to_string_lossy()
                .contains("4:41.30"),
            "normalizeLithuanian(\"laikas 4:41.30\")"
        );
        assert_eq!(
            e.normalize(&js("tarp 06:30 ir 07:30.")).to_string_lossy(),
            "tarp 06:30 ir 07:30."
        );
        assert_eq!(
            e.normalize(&js("07:19 a.m. vietos laiku"))
                .to_string_lossy(),
            "07:19 a.m. vietos laiku"
        );
    }
}
