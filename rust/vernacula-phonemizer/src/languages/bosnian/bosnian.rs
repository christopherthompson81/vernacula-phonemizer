//! Bosnian (bs) phonemizer: the shared Serbo-Croatian g2p (Serbian's `phonemize_word`, the foreign-letter
//! fold) with Bosnian's own cardinal words, over both scripts. The tokenizer and the native inventory are
//! Serbian's, character for character, so they are reused.
//! Ported from src/languages/bosnian/bosnian.ts — see that file for the evidence.

use super::manifest::{MANIFEST, try_manifest};
use super::normalize::{bosnian_symbols, normalize_bosnian};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::js_string::{JsString, js, js_number};
use crate::languages::serbian::serbian::{TOKEN, load_shared, nat, phonemize_word, read_word};
use crate::registry::{Engine, PhonemizeError};

/// The Bosnian engine (`createBosnian`).
pub struct BosnianPhonemizer;

impl BosnianPhonemizer {
    /// `normalizeBosnian(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_bosnian(text)
    }

    /// The symbol tier normalize.ts applies at its step 12.
    pub fn symbols(&self, text: &JsString) -> JsString {
        bosnian_symbols(text)
    }

    /// `numberToWords(n, raw)`.
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let m = &*MANIFEST;
        assemble_clauses(&normalize_bosnian(input), &TOKEN, |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&read_word(&nat, &w));
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

impl Engine for BosnianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(BosnianPhonemizer::text(self, input))
    }
}

/// `createBosnian()`. Errors when a manifest or an accent table cannot be loaded.
pub fn create_bosnian() -> Result<BosnianPhonemizer, String> {
    load_shared()?;
    try_manifest()?;
    Ok(BosnianPhonemizer)
}

/// test/bosnian.test.ts's literal-input pins, extracted mechanically (`.probe/sh/pins.mts`) with every value
/// evaluated from the TS engine; never hand-typed.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn bosnian_test_ts_pins() {
        let e = create_bosnian().unwrap();
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("lahko")).to_string_lossy(),
            "lˈaxko"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("mehko")).to_string_lossy(),
            "mˈexko"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("kahva")).to_string_lossy(),
            "kˈaxʋa"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("sahat")).to_string_lossy(),
            "sˈaxat"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("čovjek")).to_string_lossy(),
            "t͡ʃˈoʋjek"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("kuća")).to_string_lossy(),
            "kˈut͡ɕa"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("đak")).to_string_lossy(),
            "d͡ʑaː˥˩k"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("džamija")).to_string_lossy(),
            "d͡ʒˈaː˩˥mija"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("ljeto")).to_string_lossy(),
            "ʎˈe˥˩to"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("njiva")).to_string_lossy(),
            "ɲˈiʋa"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("mlijeko")).to_string_lossy(),
            "mlijˈeː˩˥ko"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("Босна")).to_string_lossy(),
            "bˈo˥˩sna"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("Bosna")).to_string_lossy(),
            "bˈo˥˩sna"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("здраво")).to_string_lossy(),
            "zdrˈa˥˩ʋo"
        );
        assert_eq!(
            e.text(&js("275")).to_string_lossy().trim().to_string(),
            "dʋjˈesta sedamdˈe˩˥set peː˥˩t"
        );
        assert_eq!(
            e.text(&js("1200")).to_string_lossy().trim().to_string(),
            "xˈiʎadu dʋjˈesta"
        );
        assert_eq!(
            e.text(&js("3000000")).to_string_lossy().trim().to_string(),
            "triː˥˩ miliˈona"
        );
        assert_eq!(
            e.text(&js("1000")).to_string_lossy().trim().to_string(),
            "xˈiʎadu"
        );
        assert_eq!(
            e.text(&js("2000")).to_string_lossy().trim().to_string(),
            "dʋˈi˥˩je xˈiʎade"
        );
        assert_eq!(
            e.text(&js("5000")).to_string_lossy().trim().to_string(),
            "peː˥˩t xˈiʎada"
        );
        assert_eq!(
            e.text(&js("21000")).to_string_lossy().trim().to_string(),
            "dʋˈaː˩˥deset jednˈa xˈiʎada"
        );
        assert_eq!(
            e.text(&js("1000000")).to_string_lossy().trim().to_string(),
            "jˈe˩˥dan milˈi˩˥on"
        );
        assert_eq!(
            e.text(&js("2000000")).to_string_lossy().trim().to_string(),
            "dʋaː˥˩ miliˈona"
        );
        assert_eq!(
            e.text(&js("Dobar dan, Sarajevo!"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dˈo˥˩bar daː˥˩n , sˈa˩˥rajeʋo !"
        );
        assert_eq!(
            e.text(&js("2017. godine"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dʋˈi˥˩je xˈiʎade sedˈamnaeste ɡˈodine"
        );
        assert_eq!(
            e.text(&js("21. jula")).to_string_lossy().trim().to_string(),
            "dʋˈaː˩˥deset pˈr˩˥ʋoɡ jˈula"
        );
        assert_eq!(
            e.text(&js("oluja 4. kategorije"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "olˈuː˩˥ja t͡ʃˈetʋrte kˈateɡorije"
        );
        assert_eq!(
            e.text(&js("190. mjesto"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "stoː˥˩ deʋedˈe˩˥seto mjˈe˥˩sto"
        );
        assert_eq!(
            e.text(&js("11. stoljeća"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "jedanˈaestoɡ stˈoʎet͡ɕa"
        );
        assert_eq!(
            e.text(&js("15. stoljeću"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "petnˈaestom stˈoʎet͡ɕu"
        );
        assert_eq!(
            e.text(&js("17. vijeka"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "sedamnˈaestoɡ ʋijˈeka"
        );
        assert_eq!(
            e.text(&js("24. septembra"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dʋˈaː˩˥deset t͡ʃˈetʋrtoɡ sˈeptembra"
        );
        assert_eq!(
            e.text(&js("10. avgusta"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dˈesetoɡ aʋɡˈusta"
        );
        assert_eq!(
            e.text(&js("200. godine"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dʋjestˈote ɡˈodine"
        );
        assert_eq!(
            e.text(&js("1000. godine"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "xˈiʎadite ɡˈodine"
        );
        assert_eq!(
            e.text(&js("Godine 1990. dodan je na spisak"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "ɡˈodine xˈiʎadu dˈe˥˩ʋetsto deʋedˈesete dˈodan je na spˈi˥˩sak"
        );
        assert_eq!(
            e.text(&js("od grada 1770. S vremena"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "od ɡrˈada xˈiʎadu sˈe˥˩damsto sedamdˈesete . s ʋremˈena"
        );
        assert_eq!(
            e.text(&js("Samoe od 1959."))
                .to_string_lossy()
                .trim()
                .to_string(),
            "sˈamoe od xˈiʎadu dˈe˥˩ʋetsto pedˈe˩˥set dˈeʋete ."
        );
        assert_eq!(
            e.text(&js("vezane za COVID-19."))
                .to_string_lossy()
                .trim()
                .to_string(),
            "ʋˈezane za t͡sˈoʋid deʋˈe˩˥tnaest ."
        );
        assert_eq!(
            e.text(&js("prizemljila Il-76."))
                .to_string_lossy()
                .trim()
                .to_string(),
            "prˈizemʎila il sedamdˈe˩˥set ʃeː˥˩st ."
        );
        assert_eq!(
            e.text(&js("rezultat bio 6:6."))
                .to_string_lossy()
                .trim()
                .to_string(),
            "rezˈu˩˥ltat bˈi˥˩o ʃeː˥˩st , ʃeː˥˩st ."
        );
        assert_eq!(
            e.text(&js("dijabetesa tipa 1."))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dijabetˈesa tˈipa jˈe˩˥dan ."
        );
        assert_eq!(
            e.text(&js("u 22:08 sati."))
                .to_string_lossy()
                .trim()
                .to_string(),
            "u dʋˈaː˩˥deset dʋaː˥˩ sˈaː˥˩ta i ˈo˥˩sam minˈuː˩˥ta ."
        );
        assert_eq!(
            e.text(&js("posle 11:00 časova blokirali"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "pˈo˥˩sle jedˈa˩˥naest sˈati blˈokirali"
        );
        assert_eq!(
            e.text(&js("pobjedu od 26:00 protiv"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "pˈobjedu od dʋˈaː˩˥deset ʃeː˥˩st , nˈu˥˩la prˈo˥˩tiʋ"
        );
        assert_eq!(
            e.text(&js("dugačka 6.387 km"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dˈuɡat͡ʃka ʃeː˥˩st xˈiʎada trˈi˥˩sta osamdˈe˩˥set sˈe˥˩dam kˈilometara"
        );
        assert!(
            e.text(&js("Standardni 802.11n"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("o˥˩samsto dʋaː˥˩"),
            "say(\"Standardni 802.11n\")"
        );
        assert_eq!(
            e.text(&js("dubokim 2-3 km"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dˈu˩˥bokim dʋaː˥˩ do triː˥˩ kˈilometra"
        );
        assert_eq!(
            e.text(&js("krajem 1970-ih"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "krˈa˥˩jem xˈiʎadu dˈe˥˩ʋetsto sedamdˈe˩˥setix"
        );
        assert_eq!(
            e.text(&js("krajem 1970-ih; iranska"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "krˈa˥˩jem xˈiʎadu dˈe˥˩ʋetsto sedamdˈe˩˥setix , ˈiranska"
        );
        assert_eq!(
            e.text(&js("3,50 m")).to_string_lossy().trim().to_string(),
            "triː˥˩ zˈarez pedˈe˩˥set mˈetra"
        );
        assert_eq!(
            e.text(&js("6x6 cm")).to_string_lossy().trim().to_string(),
            "ʃeː˥˩st sa ʃeː˥˩st t͡sentˈimetara"
        );
        assert_eq!(
            e.text(&js("teži 200 funti (90kg)"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "tˈe˥˩ʒi dʋjˈesta fˈuː˥˩nti deʋedˈe˩˥set kˈiloɡrama"
        );
        assert_eq!(
            e.text(&js("na 19.500 km²"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "na deʋˈe˩˥tnaest xˈiʎada pˈeː˥˩tsto kʋˈa˩˥dratnix kˈilometara"
        );
        assert_eq!(
            e.text(&js("negativ od 56x56 mm"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "neɡatˈiʋ od pedˈe˩˥set ʃeː˥˩st sa pedˈe˩˥set ʃeː˥˩st milˈimetara"
        );
        assert_eq!(
            e.text(&js("6 × 6")).to_string_lossy().trim().to_string(),
            "ʃeː˥˩st pˈuta ʃeː˥˩st"
        );
        assert_eq!(
            e.text(&js("do 480 km/h"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "do t͡ʃˈe˥˩tiristo osamdˈe˩˥set kˈilometara na saː˥˩t"
        );
        assert_eq!(
            e.text(&js("od 600Mbit/s"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "od ʃˈeː˥˩ststo mˈeɡabita u sekˈuː˩˥ndi"
        );
        assert_eq!(
            e.text(&js("istočno od 35°Z"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "ˈi˩˥stot͡ʃno od trˈiː˩˥deset peː˥˩t stˈe˥˩peni zˈaː˥˩padno"
        );
        assert_eq!(
            e.text(&js("iznad + 30 °C su"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "ˈi˥˩znad plus trˈiː˩˥deset stˈe˥˩peni t͡sˈelzijusa su"
        );
        assert_eq!(
            e.text(&js("ostvaruje 80% svojih"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "ˈostʋaruje osamdˈe˩˥set pˈo˥˩sto sʋˈo˩˥jix"
        );
        assert_eq!(
            e.text(&js("naknadu od 30 $"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "nˈaknadu od trˈiː˩˥deset dˈolara"
        );
        assert_eq!(
            e.text(&js("Uopšteno, B&amp;B se"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "ˈuopʃteno , b i b se"
        );
        assert_eq!(
            e.text(&js("29¾ inča sa 24½ inča"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dʋˈaː˩˥deset dˈe˥˩ʋet i triː˥˩ t͡ʃˈetʋrtine ˈiː˥˩nt͡ʃa sa dʋˈaː˩˥deset t͡ʃˈe˩˥tiri i po ˈiː˥˩nt͡ʃa"
        );
        assert_eq!(
            e.text(&js("Dr. Moll misli"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dˈo˥˩ktor mol mˈisli"
        );
        assert!(
            e.text(&js("35°W"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("zˈaː˥˩padno"),
            "say(\"35°W\")"
        );
        assert!(
            e.text(&js("35°Z"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("zˈaː˥˩padno"),
            "say(\"35°Z\")"
        );
        assert!(
            e.text(&js("35°N"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("sjˈe˥˩ʋerno"),
            "say(\"35°N\")"
        );
        assert!(
            e.text(&js("35°E"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("ˈi˩˥stot͡ʃno"),
            "say(\"35°E\")"
        );
        assert!(
            e.text(&js("35° Z"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("zˈaː˥˩padno"),
            "say(\"35° Z\")"
        );
        assert!(
            e.text(&js("35° S"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("sjˈe˥˩ʋerno"),
            "say(\"35° S\")"
        );
        assert!(
            e.text(&js("35° I"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("ˈi˩˥stot͡ʃno"),
            "say(\"35° I\")"
        );
        assert!(
            e.text(&js("300°K je"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("stˈe˥˩peni k"),
            "say(\"300°K je\")"
        );
        assert!(
            e.text(&js("temperatura 35° i padavine"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains(" i "),
            "say(\"temperatura 35° i padavine\")"
        );
        assert!(
            e.text(&js("35° s vjetrom"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains(" s "),
            "say(\"35° s vjetrom\")"
        );
        assert!(
            e.text(&js("35° od ekvatora"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("stˈe˥˩peni od"),
            "say(\"35° od ekvatora\")"
        );
        assert_eq!(
            e.text(&js("MMF")).to_string_lossy().trim().to_string(),
            "em em ef"
        );
        assert_eq!(
            e.text(&js("James i dr. 1995"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "jˈames i dr . xˈiʎadu dˈe˥˩ʋetsto deʋedˈe˩˥set peː˥˩t"
        );
        assert_eq!(
            e.text(&js("npr. u Nizozemskoj"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "nˈaprimjer u nˈizozemskoj"
        );
        assert_eq!(
            e.text(&js("tj. 0 ili 1"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "toː˥˩ jest nˈu˥˩la ˈi˥˩li jˈe˩˥dan"
        );
        assert_eq!(
            e.text(&js("1989. godine, str. 109"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "xˈiʎadu dˈe˥˩ʋetsto osamdˈe˩˥set dˈeʋete ɡˈodine , strˈaː˩˥na stoː˥˩ dˈe˥˩ʋet"
        );
        assert_eq!(
            e.text(&js("kopnom, itd. Za sva mjesta"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "kˈopnom , i tˈa˩˥ko dˈa˥˩ʎe . za sʋa˥˩ mjˈesta"
        );
        assert_eq!(
            e.text(&js("priča itd.)"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "prˈiː˥˩t͡ʃa i tˈa˩˥ko dˈa˥˩ʎe ."
        );
        assert_eq!(
            e.text(&js("356. godine p.n.e. u požaru"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "trˈi˥˩sta pedˈe˩˥set ʃˈeste ɡˈodine prˈi˥˩je nˈoʋe ˈere u pˈoʒaru"
        );
        assert_eq!(
            e.text(&js("trupe SAD-a napustiti"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "trˈupe sjˈediɲenix amˈe˩˥rit͡ʃkix dˈr˩˥ʒaʋa napˈu˩˥stiti"
        );
        assert_eq!(
            e.text(&js("u SAD živi"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "u sad ʒˈiː˥˩ʋi"
        );
        assert_eq!(
            e.text(&js("10. i 11. stoljeća i 14. stoljeća"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dˈesetoɡ i jedanˈaestoɡ stˈoʎet͡ɕa i t͡ʃetrnˈaestoɡ stˈoʎet͡ɕa"
        );
        assert_eq!(
            e.text(&js("1. i 3. pukovniju"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "pˈrʋu i trˈet͡ɕu pˈukoʋniju"
        );
        assert_eq!(
            e.text(&js("u 2015. ili 2016. godini"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "u dʋˈi˥˩je xˈiʎade pˈetnaestoj ˈi˥˩li dʋˈi˥˩je xˈiʎade ʃˈesnaestoj ɡˈodini"
        );
        assert_eq!(
            e.text(&js("od 1995. do 1996. godine"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "od xˈiʎadu dˈe˥˩ʋetsto deʋedˈe˩˥set pˈete do xˈiʎadu dˈe˥˩ʋetsto deʋedˈe˩˥set ʃˈeste ɡˈodine"
        );
        assert_eq!(
            e.text(&js("5. i 6. nepoznata"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "peː˥˩t . i ʃeː˥˩st . nˈepoznata"
        );
        assert_eq!(
            e.text(&js("2000. i 3000. godine"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dʋˈi˥˩je xˈiʎade . i triː˥˩ xˈiʎade . ɡˈodine"
        );
        assert_eq!(
            e.text(&js("10. и 11. стољећа"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dˈesetoɡ i jedanˈaestoɡ stˈoʎet͡ɕa"
        );
        assert_eq!(
            e.text(&js("п.н.е. у пожару"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "prˈi˥˩je nˈoʋe ˈere u pˈoʒaru"
        );
        assert_eq!(
            e.text(&js("356. godine p.n.e."))
                .to_string_lossy()
                .trim()
                .to_string(),
            "trˈi˥˩sta pedˈe˩˥set ʃˈeste ɡˈodine prˈi˥˩je nˈoʋe ˈere ."
        );
        assert_eq!(
            e.text(&js("Dobar dan, Sarajevo!"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dˈo˥˩bar daː˥˩n , sˈa˩˥rajeʋo !"
        );
        assert_eq!(
            crate::phonemize("12", "bs").unwrap().trim().to_string(),
            "dʋˈaː˩˥naest"
        );
        assert_eq!(
            crate::phonemize("0,001 grama", "bs")
                .unwrap()
                .trim()
                .to_string(),
            "nˈu˥˩la zˈarez nˈu˥˩la nˈu˥˩la jˈe˩˥dan ɡrˈama"
        );
        assert_eq!(
            crate::phonemize("0,001", "bs").unwrap().trim().to_string(),
            "nˈu˥˩la zˈarez nˈu˥˩la nˈu˥˩la jˈe˩˥dan"
        );
        assert_eq!(
            crate::phonemize("0,5 grama", "bs")
                .unwrap()
                .trim()
                .to_string(),
            "nˈu˥˩la zˈarez peː˥˩t ɡrˈama"
        );
        assert_eq!(
            crate::phonemize("1,5 km", "bs").unwrap().trim().to_string(),
            "jˈe˩˥dan zˈarez peː˥˩t kˈilometara"
        );
        assert_eq!(
            crate::phonemize("5,0", "bs").unwrap().trim().to_string(),
            "peː˥˩t zˈarez nˈu˥˩la"
        );
    }

    /// The #1532 findings, pinned from test/sh-baltic-port-findings.test.ts (synthetic, TS-evaluated).
    #[test]
    fn bosnian_port_findings_1532() {
        let e = create_bosnian().unwrap();
        let n = |s: &str| e.normalize(&js(s)).to_string_lossy();
        assert_eq!(n("U 3. i 4. constructor."), "U 3. i 4. constructor.");
        assert_eq!(
            n("Bilo je 5. constructor i dalje."),
            "Bilo je 5. constructor i dalje."
        );
        assert_eq!(n("Sastanak u 11:00."), "Sastanak u jedanaest sati.");
        assert_eq!(n("u 22:08 sati."), "u dvadeset dva sata i osam minuta.");
    }
}
