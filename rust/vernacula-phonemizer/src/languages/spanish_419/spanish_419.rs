//! Latin-American Spanish (es-419): the Castilian engine plus seseo (θ→s) and yeísmo (ʎ→ʝ) on its output.
//! Ported from src/languages/spanish-419/spanish-419.ts — see that file for the phonology.

use crate::core::js_string::JsString;
use crate::js_re;
use crate::languages::spanish::spanish::{
    SpanishPhonemizer, create_spanish, phonemize_word as phonemize_word_es,
};
use crate::registry::{Engine, PhonemizeError};

/// `toLatinAmerican(castilian)`: seseo + yeísmo, context-free.
pub fn to_latin_american(castilian: &JsString) -> JsString {
    let s = js_re!("θ", "gu").replace(castilian, &JsString::from("s"));
    js_re!("ʎ", "gu").replace(&s, &JsString::from("ʝ"))
}

/// `phonemizeWord(word)`: one es-419 word.
pub fn phonemize_word(word: &JsString) -> JsString {
    to_latin_american(&phonemize_word_es(word))
}

/// The es-419 engine (`createSpanish419`): `createSpanish(true, toLatinAmerican)`, the mergers applied per Spanish
/// word so an embedded foreign run is never rewritten (#1533).
pub struct Spanish419Phonemizer(SpanishPhonemizer);

impl Spanish419Phonemizer {
    pub fn text(&self, input: &JsString) -> JsString {
        self.0.text(input)
    }
}

impl Engine for Spanish419Phonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(Spanish419Phonemizer::text(self, input))
    }
}

/// `createSpanish419()`.
pub fn create_spanish_419() -> Result<Spanish419Phonemizer, String> {
    create_spanish(true).map(|e| Spanish419Phonemizer(e.with_accent(to_latin_american)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::js_string::js;

    // test/spanish-419.test.ts's pins, extracted from that file mechanically (each is a reading the TS suite
    // asserts), so the two engines are held to one list.
    const WORD_PINS: &[(&str, &str)] = &[
        ("cielo", "sjˈelo"),
        ("cena", "sˈena"),
        ("cinco", "sˈinko"),
        ("zapato", "sapˈato"),
        ("zorro", "sˈoro"),
        ("azúcar", "asˈukaɾ"),
        ("cabeza", "kaβˈesa"),
        ("cerveza", "seɾβˈesa"),
        ("corazón", "koɾasˈon"),
        ("gracias", "ɡɾˈasjas"),
        ("ciudad", "sjuðˈað"),
        ("plaza", "plˈasa"),
        ("luz", "lˈus"),
        ("calle", "kˈaʝe"),
        ("llave", "ʝˈaβe"),
        ("llamar", "ʝamˈaɾ"),
        ("pollo", "pˈoʝo"),
        ("caballo", "kaβˈaʝo"),
        ("ella", "ˈeʝa"),
        ("yo", "ʝˈo"),
        ("yema", "ʝˈema"),
        ("mayo", "mˈaʝo"),
        ("ayer", "aʝˈeɾ"),
        ("playa", "plˈaʝa"),
        ("casa", "kˈasa"),
        ("perro", "pˈero"),
        ("gato", "ɡˈato"),
        ("agua", "ˈaɣwa"),
        ("españa", "espˈaɲa"),
        ("niño", "nˈiɲo"),
        ("español", "espaɲˈol"),
        ("mujer", "muxˈeɾ"),
        ("gente", "xˈente"),
        ("jamón", "xamˈon"),
    ];
    const TEXT_PINS: &[(&str, &str)] = &[
        ("siglo xix", "sˈiɣlo ðjesinwˈeβe"),
        ("xix", "djesinwˈeβe"),
        ("quincuagésimo aniversario", "kinkwaxˈesimo aniβeɾsˈaɾjo"),
        ("EE.UU.", "estˈaðos unˈiðos"),
        ("los EE. UU.", "los estˈaðos unˈiðos"),
        ("el Dr. García", "el doktˈoɾ ɣaɾsˈia"),
        ("etc.", "etsˈeteɾa ."),
        (
            "356 a. C.",
            "tɾessjˈentos sinkwˈenta i sˈeᶦs ˈantes ðe kɾˈisto",
        ),
        (
            "el año 33 d.C.",
            "el ˈaɲo tɾˈeᶦnta i tɾˈes ðespwˈes ðe kɾˈisto",
        ),
        ("a las 10:08 p. m.", "a las ðjˈes ˈot͡ʃo pˈe ˈeme"),
        ("el cosmonauta n.º 11", "el kosmonˈaᶷta nˈumeɾo ˈonse"),
        ("a las 11:00", "a las ˈonse"),
        ("a la 1:15", "a la ˈuna kˈinse"),
        ("el 1º de mayo", "el pɾimˈeɾo ðe mˈaʝo"),
        ("la 1ª vez", "la pɾimˈeɾa βˈes"),
        ("el 3er piso", "el teɾsˈeɾ pˈiso"),
        ("20 °C", "bˈeᶦnte ɣɾˈaðos sˈelsjus"),
        ("35°", "tɾˈeᶦnta i sˈinko ɣɾˈaðos"),
        ("un CD", "un sˈe ðe"),
        ("el ADN", "el a ðe ˈene"),
        ("la AOL", "la a o ˈele"),
        ("la ONU", "la ˈonu"),
        ("la UNESCO", "la unˈesko"),
        ("el siglo XV", "el sˈiɣlo kˈinse"),
        ("5 000 años", "sˈinko mˈil ˈaɲos"),
        ("120 km/h", "sjˈento βˈeᶦnte kilˈometɾos poɾ ˈoɾa"),
        ("83 m", "ot͡ʃˈenta i tɾˈes mˈetɾos"),
        ("90 °F", "noβˈenta ɣɾˈaðos faɾenˈeᶦt"),
        ("1/5", "un kˈinto"),
        ("2/5", "dˈos kˈintos"),
        ("+3 grados", "mˈas tɾˈes ɣɾˈaðos"),
        ("-5 grados", "mˈenos sˈinko ɣɾˈaðos"),
        ("el 1 de enero", "el pɾimˈeɾo ðe enˈeɾo"),
        ("el 17 de septiembre", "el djesisjˈete ðe septjˈembɾe"),
        ("el 1 de enero", "el ˈuno ðe enˈeɾo"),
    ];
    const ORDINAL_PINS: &[(u32, &str)] = &[
        (40, "cuadragésimo"),
        (50, "quincuagésimo"),
        (60, "sexagésimo"),
    ];

    #[test]
    fn ts_word_pins() {
        create_spanish_419().unwrap();
        for (w, want) in WORD_PINS {
            assert_eq!(phonemize_word(&js(w)).to_string_lossy(), *want, "{w}");
        }
    }

    #[test]
    fn ts_text_pins() {
        for (i, (t, want)) in TEXT_PINS.iter().enumerate() {
            // The last pin is the TS file's one `es` assertion (the first of the month is a cardinal in Spain).
            let lang = if i + 1 == TEXT_PINS.len() {
                "es"
            } else {
                "es-419"
            };
            assert_eq!(crate::phonemize(t, lang).unwrap(), *want, "{t}");
        }
    }

    /// #1533: the mergers spare an embedded foreign run (they ran on the assembled string).
    #[test]
    fn ts_foreign_run_pins() {
        assert_eq!(
            crate::phonemize("Dijo θεός en griego.", "es-419").unwrap(),
            crate::phonemize("Dijo θεός en griego.", "es").unwrap()
        );
        assert_eq!(
            crate::phonemize("Leyó Αθήνα y Θεσσαλονίκη.", "es-419").unwrap(),
            "leʝˈo aθina i θesalonici ."
        );
        assert_eq!(
            crate::phonemize("La calle y la cerveza.", "es-419").unwrap(),
            "la kˈaʝe i la seɾβˈesa ."
        );
    }

    #[test]
    fn ts_roman_policy_pins() {
        let p = super::super::roman_ordinals::roman_policy();
        assert!(p.ordinal_before.is_none());
        let after = p.ordinal_after.as_ref().unwrap();
        assert!(!after.test(&js("siglo")));
        assert!(after.test(&js("aniversario")));
        assert!(!after.test(&js("edición")));
        for (n, want) in ORDINAL_PINS {
            let got = (p.ordinal.as_ref().unwrap())(*n);
            assert_eq!(
                got.map(|g| g.to_string_lossy()).as_deref(),
                Some(*want),
                "{n}"
            );
        }
    }
}
