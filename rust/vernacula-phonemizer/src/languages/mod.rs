#[cfg(feature = "af")]
pub mod afrikaans;
#[cfg(feature = "ak")]
pub mod akan;
#[cfg(feature = "sq")]
pub mod albanian;
#[cfg(feature = "an")]
pub mod aragonese;
#[cfg(feature = "as")]
pub mod assamese;
#[cfg(feature = "ast")]
pub mod asturian;
#[cfg(feature = "awa")]
pub mod awadhi;
#[cfg(feature = "az")]
pub mod azerbaijani;
#[cfg(feature = "ba")]
pub mod bashkir;
#[cfg(feature = "eu")]
pub mod basque;
#[cfg(feature = "bar")]
pub mod bavarian;
#[cfg(feature = "be")]
pub mod belarusian;
#[cfg(any(feature = "bn", feature = "as", feature = "bpy"))]
pub mod bengali;
#[cfg(any(feature = "bho", feature = "mag"))]
pub mod bhojpuri;
#[cfg(feature = "bpy")]
pub mod bishnupriya;
#[cfg(feature = "bs")]
pub mod bosnian;
#[cfg(feature = "bg")]
pub mod bulgarian;
#[cfg(feature = "my")]
pub mod burmese;
#[cfg(feature = "ca")]
pub mod catalan;
#[cfg(feature = "ceb")]
pub mod cebuano;
#[cfg(feature = "hne")]
pub mod chhattisgarhi;
#[cfg(feature = "nya")]
pub mod chichewa;
#[cfg(feature = "chv")]
pub mod chuvash;
#[cfg(feature = "crh")]
pub mod crimeantatar;
#[cfg(any(feature = "hr", feature = "bs"))]
pub mod croatian;
#[cfg(feature = "cs")]
pub mod czech;
#[cfg(any(feature = "fo", feature = "da", feature = "lb", feature = "bar"))]
pub mod danish;
#[cfg(feature = "nl")]
pub mod dutch;
pub mod english;
#[cfg(feature = "en-GB")]
pub mod english_gb;
#[cfg(feature = "en-IN")]
pub mod english_in;
#[cfg(feature = "et")]
pub mod estonian;
#[cfg(feature = "ee")]
pub mod ewe;
#[cfg(feature = "fo")]
pub mod faroese;
#[cfg(feature = "fi")]
pub mod finnish;
#[cfg(any(feature = "fr", feature = "fr-CA"))]
pub mod french;
#[cfg(feature = "fr-CA")]
pub mod french_ca;
#[cfg(feature = "gl")]
pub mod galician;
#[cfg(feature = "de")]
pub mod german;
#[cfg(feature = "el")]
pub mod greek;
#[cfg(feature = "ha")]
pub mod hausa;
#[cfg(feature = "hil")]
pub mod hiligaynon;
#[cfg(any(
    feature = "hi",
    feature = "bho",
    feature = "mag",
    feature = "awa",
    feature = "mai",
    feature = "hne",
    feature = "rkt",
    feature = "ne",
    feature = "mr"
))]
pub mod hindi;
#[cfg(feature = "hu")]
pub mod hungarian;
#[cfg(feature = "is")]
pub mod icelandic;
#[cfg(feature = "ig")]
pub mod igbo;
#[cfg(feature = "ilo")]
pub mod ilocano;
#[cfg(any(feature = "id", feature = "ms"))]
pub mod indonesian;
#[cfg(feature = "ga")]
pub mod irish;
#[cfg(feature = "it")]
pub mod italian;
#[cfg(feature = "ja")]
pub mod japanese;
#[cfg(feature = "jv")]
pub mod javanese;
#[cfg(feature = "kn")]
pub mod kannada;
#[cfg(feature = "kaa")]
pub mod karakalpak;
#[cfg(feature = "kk")]
pub mod kazakh;
#[cfg(any(feature = "rw", feature = "rn"))]
pub mod kinyarwanda;
#[cfg(feature = "rn")]
pub mod kirundi;
#[cfg(feature = "ko")]
pub mod korean;
#[cfg(feature = "ky")]
pub mod kyrgyz;
#[cfg(feature = "lo")]
pub mod lao;
#[cfg(feature = "lv")]
pub mod latvian;
#[cfg(feature = "ln")]
pub mod lingala;
#[cfg(feature = "lt")]
pub mod lithuanian;
#[cfg(feature = "lg")]
pub mod luganda;
#[cfg(feature = "lb")]
pub mod luxembourgish;
#[cfg(feature = "mk")]
pub mod macedonian;
#[cfg(feature = "mad")]
pub mod madurese;
#[cfg(feature = "mag")]
pub mod magahi;
#[cfg(feature = "mai")]
pub mod maithili;
#[cfg(any(feature = "id", feature = "ms"))]
pub mod malay;
#[cfg(feature = "ml")]
pub mod malayalam;
#[cfg(feature = "cmn")]
pub mod mandarin;
#[cfg(feature = "mr")]
pub mod marathi;
#[cfg(feature = "ne")]
pub mod nepali;
#[cfg(feature = "nog")]
pub mod nogai;
#[cfg(feature = "nb")]
pub mod norwegian;
#[cfg(feature = "oc")]
pub mod occitan;
#[cfg(feature = "or")]
pub mod odia;
#[cfg(feature = "pl")]
pub mod polish;
#[cfg(any(feature = "pt", feature = "pt-BR"))]
pub mod portuguese;
#[cfg(feature = "pt-BR")]
pub mod portuguese_br;
#[cfg(feature = "rkt")]
pub mod rangpuri;
#[cfg(feature = "ro")]
pub mod romanian;
#[cfg(any(feature = "ru", feature = "ba"))]
pub mod russian;
#[cfg(feature = "gd")]
pub mod scottishgaelic;
#[cfg(feature = "nso")]
pub mod sepedi;
#[cfg(any(feature = "sr", feature = "hr", feature = "bs"))]
pub mod serbian;
#[cfg(feature = "st")]
pub mod sesotho;
#[cfg(feature = "tn")]
pub mod setswana;
#[cfg(feature = "sn")]
pub mod shona;
#[cfg(feature = "si")]
pub mod sinhala;
#[cfg(feature = "sk")]
pub mod slovak;
#[cfg(feature = "sl")]
pub mod slovenian;
#[cfg(any(feature = "es", feature = "es-419"))]
pub mod spanish;
#[cfg(feature = "es-419")]
pub mod spanish_419;
#[cfg(feature = "su")]
pub mod sundanese;
#[cfg(feature = "sw")]
pub mod swahili;
#[cfg(feature = "sv")]
pub mod swedish;
#[cfg(feature = "syl")]
pub mod sylheti;
#[cfg(feature = "tl")]
pub mod tagalog;
#[cfg(feature = "tg")]
pub mod tajik;
#[cfg(feature = "ta")]
pub mod tamil;
#[cfg(feature = "tt")]
pub mod tatar;
#[cfg(feature = "te")]
pub mod telugu;
#[cfg(feature = "th")]
pub mod thai;
#[cfg(feature = "tr")]
pub mod turkish;
#[cfg(feature = "tk")]
pub mod turkmen;
#[cfg(any(feature = "uk", feature = "be"))]
pub mod ukrainian;
#[cfg(feature = "uz")]
pub mod uzbek;
#[cfg(feature = "vi")]
pub mod vietnamese;
#[cfg(feature = "cy")]
pub mod welsh;
#[cfg(feature = "wo")]
pub mod wolof;
#[cfg(feature = "xh")]
pub mod xhosa;
#[cfg(feature = "yo")]
pub mod yoruba;
#[cfg(any(feature = "zu", feature = "xh"))]
pub mod zulu;

/// The fraction guards are mirrors in the ported `\b…\b` family and Italian (#1495). Relational, as
/// test/fraction-guards-1495.test.ts: a declined fraction reads as its numbers spaced.
#[cfg(all(
    test,
    feature = "es",
    feature = "pt",
    feature = "fr",
    feature = "it",
    feature = "de"
))]
mod fraction_guard_tests {
    use crate::phonemize;

    #[test]
    fn fraction_guards_are_mirrors_in_the_word_edge_family() {
        let dot = [
            ("1/2.5", "1 2.5"),
            ("1.5/2", "1.5 2"),
            ("1/1,000", "1 1,000"),
            ("1,000/2", "1,000 2"),
        ];
        let comma = [
            ("1/2,5", "1 2,5"),
            ("1,5/2", "1,5 2"),
            ("1/2.5", "1 2.5"),
            ("1.5/2", "1.5 2"),
        ];
        let shared = [
            ("3/1/2", "3 1 2"),
            ("1/2/3", "1 2 3"),
            ("1/2,3/4", "1/2, 3/4"),
            ("1/2.", "1/2 ."),
        ];
        for lang in ["en", "es", "pt", "fr", "it", "de"] {
            let say = |s: &str| phonemize(s, lang).unwrap();
            let own: &[(&str, &str)] = if lang == "en" { &dot } else { &comma };
            for (input, spaced) in own.iter().chain(shared.iter()) {
                assert_eq!(say(input), say(spaced), "{lang} {input}");
            }
            assert_ne!(say("1/3"), say("1 3"), "{lang}");
        }
    }
}

/// #1578, as test/germanic-defects-1578.test.ts: relational throughout, so no IPA is typed.
#[cfg(all(test, feature = "da", feature = "nb", feature = "af", feature = "bar"))]
mod germanic_defects_1578_tests {
    use std::cell::RefCell;

    use crate::core::js_string::{JsString, js};
    use crate::core::structural_tagger::asked_words_neural_prepass;
    use crate::{phonemize, phonemize_best};

    /// The words the pre-pass offers the tagger, with a tagger that records and declines. Needs no model.
    fn offered(
        text: &str,
        render: &dyn Fn(&JsString, &dyn Fn(&JsString) -> Option<JsString>) -> JsString,
    ) -> Vec<String> {
        let seen = RefCell::new(Vec::new());
        asked_words_neural_prepass(
            &js(text),
            &|w| {
                seen.borrow_mut().push(w.to_string_lossy());
                Ok(JsString::new())
            },
            render,
        )
        .unwrap();
        seen.into_inner()
    }

    #[test]
    fn the_tagger_is_offered_the_words_the_engine_asks_for() {
        let da = super::danish::danish::create_danish().unwrap();
        assert!(offered("47", &|t, o| da.text(t, Some(o))).contains(&"syvogfyrre".to_string()));

        let nb = super::norwegian::norwegian::create_norwegian().unwrap();
        let words = offered("Dvořák og 200", &|t, o| nb.text(t, Some(o)));
        assert!(words.contains(&"Dvorak".to_string()), "{words:?}");
        assert!(words.contains(&"tohundre".to_string()), "{words:?}");

        let af = super::afrikaans::afrikaans::create_afrikaans().unwrap();
        assert!(
            offered("Dit is 90°F.", &|t, o| af.text(t, Some(o)))
                .contains(&"fahrenheit".to_string())
        );
        assert!(
            !offered("Die USSR het geval.", &|t, o| af.text(t, Some(o)))
                .contains(&"er".to_string())
        );
    }

    #[test]
    fn on_the_best_path_a_word_reads_as_its_written_form() {
        let best = |s: &str, l: &str| phonemize_best(s, l).unwrap();
        for (lang, a, b) in [
            ("da", "47", "syvogfyrre"),
            ("da", "Den 21. maj.", "Den enogtyvende maj."),
            ("nb", "Han bor i Dvořák.", "Han bor i Dvorak."),
            ("nb", "São", "Sao"),
            ("nb", "200", "tohundre"),
            ("af", "Dit is 90°F.", "Dit is negentig grade Fahrenheit."),
        ] {
            assert_eq!(best(a, lang), best(b, lang), "{lang} {a}");
        }
        assert_eq!(
            best("Die USSR het geval.", "af"),
            phonemize("Die USSR het geval.", "af").unwrap()
        );
    }

    #[test]
    fn a_zero_padded_ordinal_reads_as_the_unpadded_one() {
        for (lang, padded, plain) in [
            ("da", "Den 07. maj.", "Den 7. maj."),
            ("da", "Den 07. og 08. maj.", "Den 7. og 8. maj."),
            ("nb", "Den 07. mai.", "Den 7. mai."),
        ] {
            assert_eq!(
                phonemize(padded, lang).unwrap(),
                phonemize(plain, lang).unwrap(),
                "{lang} {padded}"
            );
        }
    }

    #[test]
    fn bar_a_final_a_after_a_silent_h_is_not_reduced() {
        for w in ["Aha", "Oha"] {
            assert!(!phonemize(w, "bar").unwrap().trim().ends_with('ɐ'), "{w}");
        }
        assert!(phonemize("Bana", "bar").unwrap().trim().ends_with('ɐ'));
    }
}
