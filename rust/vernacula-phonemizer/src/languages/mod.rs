pub mod afrikaans;
pub mod akan;
pub mod albanian;
pub mod aragonese;
pub mod assamese;
pub mod asturian;
pub mod awadhi;
pub mod azerbaijani;
pub mod bashkir;
pub mod basque;
pub mod bavarian;
pub mod belarusian;
pub mod bengali;
pub mod bhojpuri;
pub mod bishnupriya;
pub mod bosnian;
pub mod bulgarian;
pub mod burmese;
pub mod catalan;
pub mod cebuano;
pub mod chhattisgarhi;
pub mod chichewa;
pub mod chuvash;
pub mod crimeantatar;
pub mod croatian;
pub mod czech;
pub mod danish;
pub mod dutch;
pub mod english;
pub mod english_gb;
pub mod english_in;
pub mod estonian;
pub mod ewe;
pub mod faroese;
pub mod finnish;
pub mod french;
pub mod french_ca;
pub mod galician;
pub mod german;
pub mod greek;
pub mod hausa;
pub mod hiligaynon;
pub mod hindi;
pub mod hungarian;
pub mod icelandic;
pub mod igbo;
pub mod ilocano;
pub mod indonesian;
pub mod irish;
pub mod italian;
pub mod japanese;
pub mod javanese;
pub mod kannada;
pub mod karakalpak;
pub mod kazakh;
pub mod kinyarwanda;
pub mod kirundi;
pub mod korean;
pub mod kyrgyz;
pub mod lao;
pub mod latvian;
pub mod lingala;
pub mod lithuanian;
pub mod luganda;
pub mod luxembourgish;
pub mod macedonian;
pub mod madurese;
pub mod magahi;
pub mod maithili;
pub mod malay;
pub mod malayalam;
pub mod mandarin;
pub mod marathi;
pub mod nepali;
pub mod nogai;
pub mod norwegian;
pub mod occitan;
pub mod odia;
pub mod polish;
pub mod portuguese;
pub mod portuguese_br;
pub mod rangpuri;
pub mod romanian;
pub mod russian;
pub mod scottishgaelic;
pub mod sepedi;
pub mod serbian;
pub mod sesotho;
pub mod setswana;
pub mod shona;
pub mod sinhala;
pub mod slovak;
pub mod slovenian;
pub mod spanish;
pub mod spanish_419;
pub mod sundanese;
pub mod swahili;
pub mod swedish;
pub mod sylheti;
pub mod tagalog;
pub mod tajik;
pub mod tamil;
pub mod tatar;
pub mod telugu;
pub mod thai;
pub mod turkish;
pub mod turkmen;
pub mod ukrainian;
pub mod uzbek;
pub mod vietnamese;
pub mod welsh;
pub mod wolof;
pub mod xhosa;
pub mod yoruba;
pub mod zulu;

/// The fraction guards are mirrors in the ported `\b…\b` family and Italian (#1495). Relational, as
/// test/fraction-guards-1495.test.ts: a declined fraction reads as its numbers spaced.
#[cfg(test)]
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
