//! Latvian (lv) phonemizer, canonical IPA: the rule g2p's segments with fixed first-syllable stress (ˈ before
//! the first nucleus), text() over Latin words (nativised), numbers and clause punctuation.
//! Ported from src/languages/latvian/latvian.ts — see that file for the evidence.

use std::sync::LazyLock;

use super::g2p::{Seg, to_segments};
use super::manifest::{MANIFEST, try_manifest};
use super::normalize::{latvian_symbols, normalize_latvian};
use super::numbers::{number_to_words, read_digits};
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::registry::{Engine, PhonemizeError};

/// `phonemizeWord(word)`: ˈ before the first nucleus.
pub fn phonemize_word(word: &JsString) -> JsString {
    let segs = to_segments(word);
    let first = segs.iter().position(|s| s.nucleus);
    let mut out = JsString::new();
    for (i, s) in segs.iter().enumerate() {
        if Some(i) == first {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&s.ph);
    }
    out
}

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[A-Za-zĀāČčĒēĢģĪīĶķĻļŅņŌōŠšŪūŽž]", "u")));

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.!?…,;:])", *LATIN_RUN), "gu").unwrap());

/// The Latvian engine (`createLatvian`).
pub struct LatvianPhonemizer;

impl LatvianPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_latvian(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        latvian_symbols(text)
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
        read_digits(digits)
    }

    /// `ordinalWords(n, c)` (ordinals.ts), the case given by name; a name `ENDING` lacks reads `undefined`.
    pub fn ordinal_words(&self, n: f64, case: &str) -> Option<JsString> {
        use super::ordinals::HeadCase;
        const CASES: [&str; 9] = [
            "nomSg", "genSg", "datSg", "accSg", "locSg", "nomPl", "datPl", "accPl", "locPl",
        ];
        let c = CASES
            .iter()
            .find(|c| **c == case)
            .map_or(HeadCase::Proto, |c| HeadCase::Own(c));
        super::ordinals::ordinal_words(n, c)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let m = &*MANIFEST;
        assemble_clauses(&normalize_latvian(input), &TOKEN, |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(d) = mm.group(2, s).filter(|d| !d.is_empty()) {
                let words = if d.len() <= 9 {
                    number_to_words(js_number(&d), Some(&d))
                } else {
                    read_digits(&d)
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

impl Engine for LatvianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(LatvianPhonemizer::text(self, input))
    }
}

/// `createLatvian()`. Errors when the manifest cannot be loaded.
pub fn create_latvian() -> Result<LatvianPhonemizer, String> {
    try_manifest()?;
    Ok(LatvianPhonemizer)
}

/// test/latvian.test.ts's literal-input pins, extracted mechanically (`.probe/sh/pins.mts`) with every value
/// evaluated from the TS engine; never hand-typed.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn latvian_test_ts_pins() {
        let e = create_latvian().unwrap();
        assert_eq!(
            crate::languages::latvian::latvian::phonemize_word(&js("ģimene")).to_string_lossy(),
            "ɟˈimɛnɛ"
        );
        assert_eq!(
            crate::languages::latvian::latvian::phonemize_word(&js("kaķis")).to_string_lossy(),
            "kˈacis"
        );
        assert_eq!(
            crate::languages::latvian::latvian::phonemize_word(&js("ļauns")).to_string_lossy(),
            "ʎˈauns"
        );
        assert_eq!(
            crate::languages::latvian::latvian::phonemize_word(&js("ceļš")).to_string_lossy(),
            "t͡sˈɛʎʃ"
        );
        assert_eq!(
            crate::languages::latvian::latvian::phonemize_word(&js("loks")).to_string_lossy(),
            "lˈuɔ̯ks"
        );
        assert_eq!(
            crate::languages::latvian::latvian::phonemize_word(&js("roka")).to_string_lossy(),
            "rˈuɔ̯ka"
        );
        assert_eq!(
            crate::languages::latvian::latvian::phonemize_word(&js("dievs")).to_string_lossy(),
            "dˈiɛws"
        );
        assert_eq!(
            crate::languages::latvian::latvian::phonemize_word(&js("Valmiera")).to_string_lossy(),
            "vˈalmiɛra"
        );
        assert_eq!(
            crate::languages::latvian::latvian::phonemize_word(&js("maize")).to_string_lossy(),
            "mˈaizɛ"
        );
        assert_eq!(
            crate::languages::latvian::latvian::phonemize_word(&js("neuzmanība")).to_string_lossy(),
            "nˈɛuzmaniːba"
        );
        assert_eq!(
            crate::languages::latvian::latvian::phonemize_word(&js("Jūrmala")).to_string_lossy(),
            "jˈuːrmala"
        );
        assert_eq!(
            crate::languages::latvian::latvian::phonemize_word(&js("Latvija")).to_string_lossy(),
            "lˈatvija"
        );
        assert_eq!(
            crate::languages::latvian::latvian::phonemize_word(&js("akustiķe")).to_string_lossy(),
            "ˈakusticɛ"
        );
        assert_eq!(
            crate::languages::latvian::latvian::phonemize_word(&js("draugs")).to_string_lossy(),
            "drˈauks"
        );
        assert_eq!(
            crate::languages::latvian::latvian::phonemize_word(&js("zvaigzne")).to_string_lossy(),
            "zvˈaiɡznɛ"
        );
        assert_eq!(
            e.text(&js("15")).to_string_lossy().trim().to_string(),
            "pˈiɛt͡spatsmit"
        );
        assert_eq!(
            e.text(&js("21")).to_string_lossy().trim().to_string(),
            "dˈiwdɛsmit vˈiɛns"
        );
        assert_eq!(
            e.text(&js("234")).to_string_lossy().trim().to_string(),
            "dˈivi sˈimti trˈiːsdɛsmit t͡ʃˈɛtri"
        );
        assert_eq!(
            e.text(&js("21000")).to_string_lossy().trim().to_string(),
            "dˈiwdɛsmit vˈiɛns tˈuːkstuɔ̯tis"
        );
        assert_eq!(
            e.text(&js("100000")).to_string_lossy().trim().to_string(),
            "sˈimts tˈuːkstuɔ̯ʃi"
        );
        assert_eq!(
            e.text(&js("1000000")).to_string_lossy().trim().to_string(),
            "vˈiɛns mˈiljuɔ̯ns"
        );
        assert_eq!(
            e.text(&js("Labdien, Latvija!"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "lˈabdiɛn , lˈatvija !"
        );
        assert_eq!(
            e.text(&js("1885. gada"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "tˈuːkstuɔ̯ʃ ˈastuɔ̯ɲi sˈimti ˈastuɔ̯ɲdɛsmit pˈiɛktaː ɡˈada"
        );
        assert_eq!(
            e.text(&js("2024. gadā"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dˈivi tˈuːkstuɔ̯ʃi dˈiwdɛsmit t͡sˈɛturtajaː ɡˈadaː"
        );
        assert_eq!(
            e.text(&js("15. jūlijs"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "pˈiɛt͡spatsmitais jˈuːlijs"
        );
        assert_eq!(
            e.text(&js("20. gados"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dˈiwdɛsmitajuɔ̯s ɡˈaduɔ̯s"
        );
        assert_eq!(
            e.text(&js("12—18 °C")).to_string_lossy().trim().to_string(),
            "dˈiwpatsmit lˈiːd͡z ˈastuɔ̯ɲpatsmit t͡sˈɛlsija ɡrˈaːdi"
        );
        assert_eq!(
            e.text(&js("56,4°")).to_string_lossy().trim().to_string(),
            "pˈiɛt͡sdɛsmit sˈɛʃi kˈuɔ̯mats t͡ʃˈɛtri ɡrˈaːdi"
        );
        assert!(
            e.text(&js("21,5 °C"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("ɡrˈaːdi"),
            "lv.text(\"21,5 °C\").trim()"
        );
        assert!(
            e.text(&js("21 °C"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("ɡrˈaːts"),
            "lv.text(\"21 °C\").trim()"
        );
        assert_eq!(
            e.text(&js("29 660 km²"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dˈiwdɛsmit dˈɛviɲi tˈuːkstuɔ̯ʃi sˈɛʃi sˈimti sˈɛʃdɛsmit kvˈadraːtkiluɔ̯mɛtri"
        );
        assert_eq!(
            e.text(&js("$230 000")).to_string_lossy().trim().to_string(),
            "dˈivi sˈimti trˈiːsdɛsmit tˈuːkstuɔ̯ʃi dˈuɔ̯laːri"
        );
        assert_eq!(
            e.text(&js("5,09")).to_string_lossy().trim().to_string(),
            "pˈiɛt͡si kˈuɔ̯mats nˈullɛ dˈɛviɲi"
        );
        assert_eq!(
            e.text(&js("5,9")).to_string_lossy().trim().to_string(),
            "pˈiɛt͡si kˈuɔ̯mats dˈɛviɲi"
        );
        assert_eq!(
            e.text(&js("1 km")).to_string_lossy().trim().to_string(),
            "vˈiɛns kˈiluɔ̯mɛtrs"
        );
        assert_eq!(
            e.text(&js("11 km")).to_string_lossy().trim().to_string(),
            "vˈiɛnpatsmit kˈiluɔ̯mɛtri"
        );
        assert_eq!(
            e.text(&js("21 %")).to_string_lossy().trim().to_string(),
            "dˈiwdɛsmit vˈiɛns prˈuɔ̯t͡sɛnts"
        );
        assert_eq!(
            e.text(&js("120 km/h")).to_string_lossy().trim().to_string(),
            "sˈimts dˈiwdɛsmit kˈiluɔ̯mɛtri stˈundaː"
        );
        assert_eq!(
            e.text(&js("54—57%")).to_string_lossy().trim().to_string(),
            "pˈiɛt͡sdɛsmit t͡ʃˈɛtri lˈiːd͡z pˈiɛt͡sdɛsmit sˈɛptiɲi prˈuɔ̯t͡sɛnti"
        );
        assert_eq!(
            e.text(&js("+5")).to_string_lossy().trim().to_string(),
            "plˈus pˈiɛt͡si"
        );
        assert_eq!(
            e.text(&js("-5")).to_string_lossy().trim().to_string(),
            "mˈiːnuss pˈiɛt͡si"
        );
        assert!(
            e.text(&js("1841-1846"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("lˈiːd͡z"),
            "lv.text(\"1841-1846\").trim()"
        );
        assert!(
            e.text(&js("x = y"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("vˈiɛnaːts"),
            "lv.text(\"x = y\").trim()"
        );
        assert!(
            !e.text(&js("a==b"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("vˈiɛnaːts"),
            "lv.text(\"a==b\").trim()"
        );
        assert!(
            !e.text(&js("5 <= 6"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("mˈazaːks"),
            "lv.text(\"5 <= 6\").trim()"
        );
        assert!(
            e.text(&js("5 < 6"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("mˈazaːks"),
            "lv.text(\"5 < 6\").trim()"
        );
        assert_eq!(
            e.text(&js("10. gadsimtā"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dˈɛsmitajaː ɡˈatsimtaː"
        );
        assert_eq!(
            e.text(&js("2010. gada"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dˈivi tˈuːkstuɔ̯ʃi dˈɛsmitaː ɡˈada"
        );
        assert_eq!(
            e.text(&js("6° virs nulles"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "sˈɛʃi ɡrˈaːdi vˈirs nˈullɛs"
        );
        assert_eq!(
            e.text(&js("20° Celsija skalā"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dˈiwdɛsmit ɡrˈaːdi t͡sˈɛlsija skˈalaː"
        );
        assert_eq!(
            e.text(&js("500. gads p.m.ē."))
                .to_string_lossy()
                .trim()
                .to_string(),
            "pˈiɛt͡si sˈimti ɡˈats pˈirms mˈuːsu ˈɛːras ."
        );
        assert_eq!(
            e.text(&js("u.c.")).to_string_lossy().trim().to_string(),
            "ˈun t͡sˈiti ."
        );
        assert_eq!(
            e.text(&js("t.i., netiek"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "tˈas ˈir , nˈɛtiɛk"
        );
        assert_eq!(
            e.text(&js("160 lpp")).to_string_lossy().trim().to_string(),
            "sˈimts sˈɛʃdɛsmit lˈappusɛs"
        );
        assert_eq!(
            e.text(&js("nr. 859")).to_string_lossy().trim().to_string(),
            "nˈumurs ˈastuɔ̯ɲi sˈimti pˈiɛt͡sdɛsmit dˈɛviɲi"
        );
        assert_eq!(
            e.normalize(&js("2MV-4 №3")).to_string_lossy(),
            "2MV-4 numurs 3"
        );
        assert_eq!(e.normalize(&js("№3")).to_string_lossy(), "numurs 3");
        assert_eq!(e.normalize(&js("№ 3")).to_string_lossy(), "numurs 3");
        assert_eq!(e.normalize(&js("№")).to_string_lossy(), "№");
        assert_eq!(
            e.text(&js("18.—20. gadsimtā"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "ˈastuɔ̯ɲpatsmitajaː lˈiːd͡z dˈiwdɛsmitajaː ɡˈatsimtaː"
        );
        assert_eq!(
            e.text(&js("60.—70. gados"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "sˈɛʃdɛsmitajuɔ̯s lˈiːd͡z sˈɛptiɲdɛsmitajuɔ̯s ɡˈaduɔ̯s"
        );
        assert!(
            e.text(&js("500. gads p.m.ē. Tas bija sen."))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("ˈɛːras ."),
            "lv.text(\"500. gads p.m.ē. Tas bija sen.\").trim()"
        );
        assert!(
            !e.text(&js("T.I. Ivanovs bija"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("tˈas ˈir"),
            "lv.text(\"T.I. Ivanovs bija\").trim()"
        );
        assert_eq!(
            e.normalize(&js("sāļumu mēra promilēs (‰)"))
                .to_string_lossy(),
            "sāļumu mēra promilēs (‰)"
        );
        assert_eq!(e.normalize(&js("5 ‰")).to_string_lossy(), "5 ‰");
        assert_eq!(e.normalize(&js("§ 5")).to_string_lossy(), "§ 5");
        assert_eq!(e.normalize(&js("5 §")).to_string_lossy(), "5 §");
    }

    /// The #1532 findings, pinned from test/sh-baltic-port-findings.test.ts (synthetic, TS-evaluated).
    #[test]
    fn latvian_port_findings_1532() {
        let e = create_latvian().unwrap();
        let n = |s: &str| e.normalize(&js(s)).to_string_lossy();
        assert_eq!(n("Viņš bija 3. constructor."), "Viņš bija 3 constructor.");
        assert_eq!(n("Pulksten 10:30 sākās."), "Pulksten 10 30 sākās.");
        assert_eq!(n("Sākās plkst. 7:05."), "Sākās pulksten 7 0 5.");
        assert_eq!(n("plkst. 12:00 pēc"), "pulksten 12 pēc");
        assert_eq!(n("no 06:30 - 07:30"), "no 6 30 līdz 7 30");
        assert!(
            !crate::phonemize("Pulksten 10:30 sākās.", "lv")
                .unwrap()
                .contains(',')
        );
        assert_eq!(n("rezultāts 25:00 komandai"), "rezultāts 25:00 komandai");
        assert_eq!(n("ar laiku 3:12.45"), "ar laiku 3:12.45");
        assert_eq!(n("Rezultāts 5 - 3."), "Rezultāts 5 3.");
        assert_eq!(n("Rezultāts 7–2."), "Rezultāts 7 2.");
        assert_eq!(n("No 10 - 20 metriem."), "No 10 līdz 20 metriem.");
        assert_eq!(
            n("Pirms 5,1–4,6 miljoniem."),
            "Pirms pieci komats viens līdz četri komats seši miljoniem."
        );
    }
}
