//! Azerbaijani (az) phonemizer: the rule g2p with final-syllable stress, and text() over words, numbers
//! (space/period thousands, comma decimal) and punctuation. Ported from src/languages/azerbaijani/azerbaijani.ts
//! — see that file for the corpus evidence.

use std::sync::LazyLock;

use indexmap::IndexMap;

use super::g2p::{Seg, az_lower, to_segments};
use super::manifest::{MANIFEST, try_manifest};
use super::normalize::{
    is_unreadable_azerbaijani, normalize_azerbaijani, normalize_azerbaijani_initialisms,
    ordinal_words,
};
use super::numbers::{digits_to_words, number_to_words};
use super::roman_ordinals::az_roman_ordinal;
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::normalize_symbols::{
    ExponentWords, Multiply, PositionDecl, SymbolData, SymbolNormalizer, make_symbol_normalizer,
};
use crate::core::provenance::rewrite;
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// `phonemizeWord(word)`: segments with the stress mark before the final nucleus.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let segs = to_segments(word);
    let stress_idx = (0..segs.len()).rev().find(|&i| segs[i].nucleus);
    let mut out = JsString::new();
    for (i, s) in segs.iter().enumerate() {
        if Some(i) == stress_idx {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&s.ph);
    }
    out
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"({})|(\d+(?<!(?<!\d)0)\.\d{{3}}(?:\.\d{{3}})*(?:,\d+)?|\d+,\d+|\d+)|([.!?…,;:])",
            *LATIN_RUN
        ),
        "giu",
    )
    .unwrap()
});

const NATIVE_CLASS: &str = "[a-zçğəıiöşüx]";
type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "iu")));

/// `numberTokenToWords(tok)`: group separators dropped, a decimal comma read digit by digit.
fn number_token_to_words(tok: &JsString) -> JsString {
    let parts = tok.split(&js(","));
    let int_raw = js_re!(r"[ .]", "gu").replace(&parts[0], &JsString::new());
    let mut words = digits_to_words(&int_raw); // exact past 2⁵³ (#1576)
    if let Some(frac) = parts.get(1) {
        let digits: Vec<JsString> = frac
            .code_point_strings()
            .iter()
            .map(digits_to_words)
            .collect();
        words = words
            .concat(&js(&format!(" {} ", MANIFEST.numbers.decimal_connector)))
            .concat(&JsString::join(&digits, &js(" ")));
    }
    words
}

/// The Azerbaijani engine (`createAzerbaijani`).
pub struct AzerbaijaniPhonemizer {
    symbols: SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding one proves the manifest loaded. (The per-module
/// differentials call them.)
impl AzerbaijaniPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_azerbaijani(text)
    }

    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_azerbaijani_initialisms(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_azerbaijani(word)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn segments(&self, word: &JsString) -> Vec<Seg> {
        to_segments(word)
    }

    pub fn az_lower(&self, word: &JsString) -> JsString {
        az_lower(word)
    }

    pub fn number_to_words(&self, n: f64) -> JsString {
        number_to_words(n)
    }

    pub fn ordinal_words(&self, n: f64) -> Option<JsString> {
        ordinal_words(n)
    }

    pub fn roman_ordinal(&self, n: f64) -> Option<JsString> {
        az_roman_ordinal(n)
    }

    pub fn number_token_to_words(&self, tok: &JsString) -> JsString {
        number_token_to_words(tok)
    }

    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let s = self.symbols.apply(&normalize_azerbaijani(input));
        let s = rewrite(&s, js_re!("İ", "gu"), &js("i"));
        let normalized = rewrite(&s, js_re!("I", "gu"), &js("ı"));
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(n) = m.group(2, s).filter(|n| !n.is_empty()) {
                for wd in number_token_to_words(&n).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) = MANIFEST
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for AzerbaijaniPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(AzerbaijaniPhonemizer::text(self, input))
    }
}

fn forms(words: &[&str]) -> Vec<String> {
    words.iter().map(|w| w.to_string()).collect()
}

fn table(rows: &[(&str, &[&str])]) -> IndexMap<String, Vec<String>> {
    rows.iter()
        .map(|(k, v)| (k.to_string(), forms(v)))
        .collect()
}

/// `createAzerbaijani()`. Errors when the manifest cannot be loaded, or the symbol tier refuses its table.
pub fn create_azerbaijani() -> Result<AzerbaijaniPhonemizer, String> {
    try_manifest()?;
    let symbols = make_symbol_normalizer(&SymbolData {
        multiply: Some(Multiply {
            times: "vur".into(),
            by: None,
        }),
        percent: Some(forms(&["faiz"])),
        currency: Some(table(&[
            ("€", &["avro"]),
            ("$", &["dollar"]),
            ("£", &["funt sterlinq"]),
            ("¥", &["yen"]),
        ])),
        units: Some(table(&[
            ("km", &["kilometr"]),
            ("sm", &["santimetr"]),
            ("mm", &["millimetr"]),
            ("kg", &["kilogram"]),
            ("m", &["metr"]),
            ("mil", &["mil"]),
            ("mi", &["mil"]),
            ("yard", &["yard"]),
        ])),
        exponent_words: Some(ExponentWords {
            squared: Some(forms(&["kvadrat"])),
            cubed: Some(forms(&["kub"])),
            position: Some(PositionDecl::All(
                crate::core::normalize_symbols::ExponentPosition::Before,
            )),
        }),
        magnitudes: Some(forms(&["milyon", "milyard", "trilyon"])),
        ..Default::default()
    })?;
    Ok(AzerbaijaniPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One pin's actual value: `kind` names the TS call the pin was extracted from.
    fn actual(az: &AzerbaijaniPhonemizer, kind: &str, input: &str) -> Option<JsString> {
        let s = js(input);
        let n = || input.parse::<f64>().unwrap();
        match kind {
            "word" => Some(phonemize_word(&s)),
            "engine" => Some(az.text(&s)),
            "registry" => Some(crate::registry::phonemize_in("az", &s).unwrap()),
            "normalize" => Some(normalize_azerbaijani(&s)),
            "ordinal" => ordinal_words(n()),
            "roman" => az_roman_ordinal(n()),
            k => panic!("no pin kind {k}"),
        }
    }

    /// test/azerbaijani.test.ts's `toBe` / `toBeUndefined` pins, extracted by `.probe/az/pins.mjs` (no reading
    /// typed by hand). The two `ordinalAfter.test` pins are the az-roman differential's.
    #[test]
    fn the_ts_suite_pins_hold() {
        let az = create_azerbaijani().unwrap();
        let mut bad = Vec::new();
        for (kind, trim, op, input, want) in PINS {
            let got = actual(&az, kind, input).map(|g| if trim { g.trim() } else { g });
            let ok = match (op, &got) {
                ("none", None) => true,
                ("eq", Some(g)) => *g == js(want),
                ("contains", Some(g)) => g.includes(&js(want)),
                ("not_contains", Some(g)) => !g.includes(&js(want)),
                _ => false,
            };
            if !ok {
                bad.push(format!("{kind}({input}) {op} {want:?}: got {got:?}"));
            }
        }
        assert!(bad.is_empty(), "{}", bad.join("\n"));
    }

    /// 95 pins extracted mechanically from test/azerbaijani.test.ts (kind, trim, op, input, expected).
    const PINS: [(&str, bool, &str, &str, &str); 95] = [
        ("word", false, "eq", "salam", "sɑɫˈɑm"),
        ("word", false, "eq", "əl", "ˈæl"),
        ("word", false, "eq", "dörd", "dˈœɾd"),
        ("word", false, "eq", "gözəl", "ɟœzˈæl"),
        ("word", false, "eq", "kitab", "citˈɑb"),
        ("word", false, "eq", "kənd", "cˈænd"),
        ("word", false, "eq", "gəlmək", "ɟælmˈæc"),
        ("word", false, "eq", "qapı", "ɡɑpˈɯ"),
        ("word", false, "eq", "oxumaq", "oxumˈɑx"),
        ("word", false, "eq", "balıq", "bɑɫˈɯx"),
        ("word", false, "eq", "yaxşı", "jɑxʃˈɯ"),
        ("word", false, "eq", "dağ", "dˈɑɣ"),
        ("word", false, "eq", "oğul", "oɣˈuɫ"),
        ("word", false, "eq", "səkkiz", "sæcːˈiz"),
        ("word", false, "eq", "çörək", "t͡ʃœɾˈæc"),
        ("engine", true, "eq", "21", "ijiɾmˈi bˈiɾ"),
        ("engine", true, "eq", "100", "jˈyz"),
        (
            "engine",
            true,
            "eq",
            "1985",
            "mˈin doɡːˈuz jˈyz sæcsˈæn bˈeʃ",
        ),
        ("engine", true, "eq", "İki", "icˈi"),
        ("engine", true, "eq", "salam İki", "sɑɫˈɑm icˈi"),
        ("engine", true, "eq", "Irəli", "ɯɾælˈi"),
        ("roman", false, "eq", "1", "birinci"),
        ("roman", false, "eq", "2", "ikinci"),
        ("roman", false, "eq", "4", "dördüncü"),
        ("roman", false, "eq", "9", "doqquzuncu"),
        ("roman", false, "eq", "19", "on doqquzuncu"),
        ("roman", false, "eq", "40", "qırxıncı"),
        ("roman", false, "eq", "50", "əllinci"),
        ("roman", false, "eq", "63", "altmış üçüncü"),
        ("roman", false, "eq", "80", "səksəninci"),
        ("roman", false, "eq", "90", "doxsanıncı"),
        ("roman", false, "eq", "100", "yüzüncü"),
        ("roman", false, "none", "101", ""),
        (
            "registry",
            true,
            "eq",
            "on doqquzuncu əsr",
            "ˈon doɡːuzund͡ʒˈu ˈæsɾ",
        ),
        (
            "registry",
            true,
            "eq",
            "əllinci ildönüm",
            "ællind͡ʒˈi ildœnˈym",
        ),
        ("registry", true, "eq", "xix", "ˈon doɡːˈuz"),
        ("ordinal", false, "eq", "7", "yeddinci"),
        ("ordinal", false, "eq", "24", "iyirmi dördüncü"),
        ("ordinal", false, "eq", "190", "yüz doxsanıncı"),
        ("ordinal", false, "eq", "1000", "mininci"),
        (
            "ordinal",
            false,
            "eq",
            "1767",
            "min yeddi yüz altmış yeddinci",
        ),
        (
            "normalize",
            false,
            "eq",
            "1767-ci ildə",
            "min yeddi yüz altmış yeddinci ildə",
        ),
        (
            "normalize",
            false,
            "eq",
            "190-cı yerdə",
            "yüz doxsanıncı yerdə",
        ),
        (
            "normalize",
            false,
            "eq",
            "24-cü pillədə",
            "iyirmi dördüncü pillədə",
        ),
        (
            "normalize",
            false,
            "eq",
            "7-ci ən böyük",
            "yeddinci ən böyük",
        ),
        (
            "registry",
            true,
            "eq",
            "400 000 bilinən hal",
            "dˈœɾd jˈyz mˈin bilinˈæn hˈɑɫ",
        ),
        ("registry", true, "eq", "6,5 bal", "ɑɫtˈɯ tˈɑm bˈeʃ bˈɑɫ"),
        ("registry", true, "eq", "12:00 GMT", "ˈon icˈi ɟˈe ˈem tˈe"),
        (
            "registry",
            true,
            "eq",
            "21:20 hesabı",
            "ijiɾmˈi bˈiɾ ijiɾmˈi hesɑbˈɯ",
        ),
        (
            "registry",
            true,
            "eq",
            "e.ə. 323-cü ildə",
            "eɾɑmɯzdˈɑn ævvˈæl ˈyt͡ʃ jˈyz ijiɾmˈi yt͡ʃynd͡ʒˈy ildˈæ",
        ),
        ("registry", true, "eq", "Dr. Moll", "doktˈoɾ mˈoɫɫ"),
        ("registry", true, "eq", "Corc V. Buş", "d͡ʒˈoɾd͡ʒ v bˈuʃ"),
        (
            "normalize",
            false,
            "eq",
            "Məbəd e.ə.",
            "Məbəd eramızdan əvvəl.",
        ),
        (
            "normalize",
            false,
            "eq",
            "Məbəd b.e.ə.",
            "Məbəd eramızdan əvvəl.",
        ),
        (
            "normalize",
            false,
            "eq",
            "e.ə. 323-cü ildə",
            "eramızdan əvvəl üç yüz iyirmi üçüncü ildə",
        ),
        (
            "normalize",
            false,
            "eq",
            "b.e. 1200-cü ildə",
            "bizim eramız min iki yüzüncü ildə",
        ),
        ("normalize", false, "eq", "BE 1000", "bizim eramız 1000"),
        (
            "normalize",
            false,
            "eq",
            "b.e.ə. 500-cü ildə",
            "eramızdan əvvəl beş yüzüncü ildə",
        ),
        (
            "normalize",
            false,
            "eq",
            "e.ə. 500-cü ildə",
            "eramızdan əvvəl beş yüzüncü ildə",
        ),
        (
            "registry",
            true,
            "eq",
            "QHT nümayəndəsi",
            "ɡˈe hˈe tˈe nymɑjændæsˈi",
        ),
        ("registry", true, "eq", "QVC kanalı", "ɡˈe vˈe d͡ʒˈe kɑnɑɫˈɯ"),
        ("registry", true, "eq", "Q&A bölməsi", "ɡˈe vˈæ ˈɑ bœlmæsˈi"),
        ("registry", true, "eq", "30%-i", "otˈuz fɑizˈi"),
        ("registry", true, "eq", "88%-ni", "sæcsˈæn sæcːˈiz fɑizinˈi"),
        ("registry", true, "eq", "46%-dən", "ɡˈɯɾx ɑɫtˈɯ fɑizdˈæn"),
        ("registry", true, "eq", "1%-nin", "bˈiɾ fɑizinˈin"),
        ("registry", true, "eq", "100%", "jˈyz fɑˈiz"),
        ("registry", true, "eq", "10:00-da başladı", "ondˈɑ bɑʃɫɑdˈɯ"),
        ("registry", true, "eq", "01:15-də", "bˈiɾ ˈon beʃdˈæ"),
        (
            "registry",
            true,
            "eq",
            "23:35-ə",
            "ijiɾmˈi ˈyt͡ʃ otˈuz beʃˈæ",
        ),
        ("registry", true, "eq", "8:46-da", "sæcːˈiz ɡˈɯɾx ɑɫtɯdˈɑ"),
        ("normalize", false, "eq", "11:00-dan", "on birdən"),
        (
            "registry",
            true,
            "eq",
            "29¾ düym",
            "ijiɾmˈi doɡːˈuz dœɾdːˈæ ˈyt͡ʃ dˈyjm",
        ),
        ("normalize", false, "eq", "1/10", "onda bir"),
        ("normalize", false, "eq", "1/6", "altıda bir"),
        ("normalize", false, "eq", "1/5", "beşdə bir"),
        (
            "registry",
            true,
            "eq",
            "1.234 nəfər",
            "mˈin icˈi jˈyz otˈuz dˈœɾd næfˈæɾ",
        ),
        ("normalize", false, "eq", "4:41.30", "4:41.30"),
        (
            "normalize",
            false,
            "eq",
            "saat 11:20.",
            "saat on bir iyirmi.",
        ),
        (
            "registry",
            true,
            "eq",
            "165 km/s",
            "sɑɑtdˈɑ jˈyz ɑɫtmˈɯʃ bˈeʃ ciɫomˈetɾ",
        ),
        (
            "registry",
            true,
            "eq",
            "133 m/s",
            "sɑnijædˈæ jˈyz otˈuz ˈyt͡ʃ mˈetɾ",
        ),
        (
            "registry",
            true,
            "eq",
            "2.4Ghz",
            "icˈi nœɡtˈæ dˈœɾd ɟiɡɑhˈeɾs",
        ),
        (
            "registry",
            true,
            "eq",
            "802.11n standartı",
            "sæcːˈiz jˈyz icˈi nœɡtˈæ ˈon bˈiɾ n stɑndɑɾtˈɯ",
        ),
        (
            "registry",
            true,
            "eq",
            "19500 km²-dir",
            "ˈon doɡːˈuz mˈin bˈeʃ jˈyz kvɑdɾˈɑt ciɫomˈetɾ dˈiɾ",
        ),
        (
            "registry",
            true,
            "eq",
            "80 km (50 mil)",
            "sæcsˈæn ciɫomˈetɾ ællˈi mˈil",
        ),
        (
            "registry",
            true,
            "eq",
            "+30°C",
            "ystæɟˈæl otˈuz dæɾæd͡ʒˈæ selsˈi",
        ),
        (
            "registry",
            true,
            "eq",
            "1000$ məbləğində",
            "mˈin doɫɫˈɑɾ mæblæɣindˈæ",
        ),
        (
            "registry",
            true,
            "eq",
            "24½ düym",
            "ijiɾmˈi dˈœɾd jɑɾˈɯm dˈyjm",
        ),
        ("registry", true, "eq", "1/5 düym", "beʃdˈæ bˈiɾ dˈyjm"),
        (
            "registry",
            true,
            "eq",
            "II Dünya Müharibəsində",
            "icind͡ʒˈi dynjˈɑ myhɑɾibæsindˈæ",
        ),
        ("registry", true, "eq", "BMT həm də", "bˈe ˈem tˈe hˈæm dˈæ"),
        (
            "registry",
            true,
            "eq",
            "ABŞ imperializminin",
            "ˈɑbʃ impeɾiɑlizminˈin",
        ),
        ("normalize", false, "eq", "I&O şirkəti", "ı və o şirkəti"),
        ("normalize", false, "eq", "A&B şirkəti", "a və be şirkəti"),
        ("registry", true, "eq", "I&O şirkəti", "ˈɯ vˈæ ˈo ʃiɾcætˈi"),
    ];
}
