//! Bashkir (ba) phonemizer: the Cyrillic scan (dark/clear л by harmony, у ү as glides after a vowel, е iotated
//! initially and after a vowel) with final stress, a harmony-violating word routed to the Russian g2p, and text()
//! over words, numbers (comma decimal) and punctuation.
//! Ported from src/languages/bashkir/bashkir.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::{
    is_unreadable_bashkir, normalize_bashkir, normalize_bashkir_initialisms, ordinal_of,
};
use super::numbers::number_to_words;
use super::roman_ordinals::ba_roman_ordinal;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::ipa::is_ipa_vowel;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{Form, normalize};
use crate::languages::russian::russian::phonemize_word as russian_word;
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/bashkir";

/// `BashkirDef` (bashkir.ts). Every field the TS interface names is required.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BashkirDef {
    pub consonants: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub iotated: IndexMap<String, String>,
    pub vowel_letters: Vec<String>,
    pub back_vowels: Vec<String>,
    pub bashkir_letters: Vec<String>,
    pub loan_front_vowels: Vec<String>,
}

pub fn try_def() -> Result<&'static BashkirDef, String> {
    static D: OnceLock<BashkirDef> = OnceLock::new();
    load_once(&D, || {
        load_manifest(DIR, "bashkir.jsonc").map_err(|e| e.to_string())
    })
}

/// `DEF`, for code reached only through a checked path (`createBashkir` loads it first).
static DEF: LazyLock<&'static BashkirDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

/// `LEGACY_CODEPAGE`, in the TS key order.
const LEGACY_CODEPAGE: [(&str, &str); 4] = [("ѳ", "ө"), ("Ѳ", "Ө"), ("ӊ", "ң"), ("Ӊ", "Ң")];

/// `LEGACY_RE = new RegExp(`[${keys}]`, "gu")`.
static LEGACY_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let keys: String = LEGACY_CODEPAGE.iter().map(|(k, _)| *k).collect();
    JsRegex::new(&format!("[{keys}]"), "gu").unwrap()
});

/// `foldLegacyCodepage(w)`.
pub(crate) fn fold_legacy_codepage(w: &JsString) -> JsString {
    LEGACY_RE.replace_with(w, |m, s| {
        let c = m.value(s);
        js(LEGACY_CODEPAGE.iter().find(|(k, _)| c == **k).unwrap().1)
    })
}

fn contains(list: &[String], c: &str) -> bool {
    list.iter().any(|x| x == c)
}

/// `[...w]`: code points, a lone surrogate as its own item (it matches no table).
fn code_points(w: &JsString) -> Vec<String> {
    w.code_point_strings()
        .iter()
        .map(|c| c.to_string_lossy())
        .collect()
}

/// `isRussianLoan(word)`: no Bashkir-only letter, and both a back vowel and a loan front vowel.
pub(crate) fn is_russian_loan(word: &JsString) -> bool {
    let d = &*DEF;
    let chars = code_points(&normalize(word, Form::Nfc).to_lower_case());
    if chars.iter().any(|c| contains(&d.bashkir_letters, c)) {
        return false;
    }
    chars.iter().any(|c| contains(&d.back_vowels, c))
        && chars.iter().any(|c| contains(&d.loan_front_vowels, c))
}

/// `phonemizeWord(word)`: a detected Russian loan through the Russian g2p, else the native scan.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let w = fold_legacy_codepage(word);
    if is_russian_loan(&w) {
        russian_word(&w)
    } else {
        phonemize_word_native(&w)
    }
}

/// `[...seg].some((c) => IPA_VOWEL.has(c))`.
fn has_ipa_vowel(seg: &JsString) -> bool {
    seg.code_point_strings()
        .iter()
        .any(|c| c.len() == 1 && is_ipa_vowel(c.units()[0]))
}

/// `phonemizeWordNative(word)`: the Cyrillic scan, then the stress mark before the last nucleus's onset.
pub(crate) fn phonemize_word_native(word: &JsString) -> JsString {
    let d = &*DEF;
    let w = fold_legacy_codepage(&normalize(word, Form::Nfc).to_lower_case());
    let chars = code_points(&w);
    let back_word = chars.iter().any(|c| contains(&d.back_vowels, c));
    let mut segs: Vec<JsString> = Vec::new();
    for (i, ch) in chars.iter().enumerate() {
        let ch = ch.as_str();
        let prev_vowel = i > 0 && contains(&d.vowel_letters, &chars[i - 1]);
        let ph = if ch == "л" {
            Some(if back_word { "ɫ" } else { "l" })
        } else if ch == "у" {
            Some(if prev_vowel { "w" } else { "u" })
        } else if ch == "ү" {
            Some(if prev_vowel { "w" } else { "y" })
        } else if ch == "е" {
            Some(if i == 0 || prev_vowel { "jɪ" } else { "ɪ" })
        } else if let Some(c) = d.consonants.get(ch) {
            Some(c.as_str())
        } else if let Some(c) = d.iotated.get(ch) {
            Some(c.as_str())
        } else {
            d.vowels.get(ch).map(|c| c.as_str())
        };
        if let Some(ph) = ph {
            segs.push(js(ph));
        }
    }
    if let Some(nucleus) = (0..segs.len()).rev().find(|&i| has_ipa_vowel(&segs[i])) {
        let mut at = if nucleus > 0 && !has_ipa_vowel(&segs[nucleus - 1]) {
            nucleus - 1
        } else {
            nucleus
        };
        // A word-initial cluster is the whole onset (спорт → ˈspʊɾt), #1581.
        if !segs[..at].iter().any(has_ipa_vowel) {
            at = 0;
        }
        segs.insert(at, js("ˈ"));
    }
    normalize(&JsString::join(&segs, &JsString::new()), Form::Nfc)
}

/// `number(digits)`: an unsafe integer is read digit at a time, each digit's words phonemized.
fn number(digits: &JsString) -> JsString {
    let n = js_number(digits);
    let words: Vec<&str> = if is_safe_integer(n) {
        number_to_words(n)
    } else {
        digits
            .code_point_strings()
            .iter()
            .flat_map(|d| number_to_words(js_number(d)))
            .collect()
    };
    let ipa: Vec<JsString> = words.iter().map(|w| phonemize_word(&js(w))).collect();
    JsString::join(&ipa, &js(" "))
}

/// bashkir.ts's `makeSymbolNormalizer({…})` literal, evaluated from the source and `JSON.stringify`'d.
const SYMBOL_DATA: &str = r#"{"percent":["процент"],"currency":{"$":["доллар"],"€":["евро"],"₽":["һум"],"£":["фунт"]},"units":{"км":["километр"],"см":["сантиметр"],"мм":["миллиметр"],"кг":["килограмм"],"мг":["миллиграмм"],"га":["гектар"],"м":["метр"],"km":["километр"],"cm":["сантиметр"],"mm":["миллиметр"],"kg":["килограмм"],"m":["метр"]},"unitPer":"бер","rateDenominators":{"с":"секунд","сәғ":"сәғәт","s":"секунд","h":"сәғәт"},"exponentWords":{"squared":["квадрат"],"cubed":["куб"],"position":"before"},"multiply":{"times":"тапҡыр"},"ampersand":"һәм","magnitudes":["мең","миллион","миллиард","триллион"]}"#;

fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
        make_symbol_normalizer(&data)
    })
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"([Ѐ-ӿ]+)|(\d+(?:,\d+)?)|([.!?…,;:])", "gu").unwrap());

/// The Bashkir engine (`createBashkir`).
pub struct BashkirPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding one proves the manifests and the tier loaded.
/// (The per-module differentials call them.)
impl BashkirPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_bashkir(text)
    }

    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_bashkir_initialisms(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_bashkir(word)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn phonemize_word_native(&self, word: &JsString) -> JsString {
        phonemize_word_native(word)
    }

    pub fn is_russian_loan(&self, word: &JsString) -> bool {
        is_russian_loan(word)
    }

    pub fn fold_legacy_codepage(&self, word: &JsString) -> JsString {
        fold_legacy_codepage(word)
    }

    pub fn number_words(&self, n: f64) -> JsString {
        js(&number_to_words(n).join("|"))
    }

    pub fn ordinal_of(&self, n: f64) -> Option<JsString> {
        ordinal_of(n)
    }

    pub fn roman_ordinal(&self, n: f64) -> Option<JsString> {
        ba_roman_ordinal(n)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let prepared = self
            .symbols
            .apply(&normalize_bashkir_initialisms(&normalize_bashkir(input)));
        assemble_clauses(&prepared, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(n) = m.group(2, s).filter(|n| !n.is_empty()) {
                let parts = n.split(&js(","));
                sink.emit(&number(&parts[0]));
                if let Some(frac) = parts.get(1) {
                    sink.emit(&phonemize_word(&js("өтөр")));
                    for dg in frac.code_point_strings() {
                        sink.emit(&number(&dg));
                    }
                }
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty()) {
                let mark = if p == "." || p == "!" || p == "?" {
                    p
                } else {
                    js(",")
                };
                sink.pause(&mark);
            }
        })
    }
}

impl Engine for BashkirPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(BashkirPhonemizer::text(self, input))
    }
}

/// `createBashkir()`. Errors when the Bashkir manifest, the Russian manifest or dictionaries (the loan route)
/// cannot be loaded, or the symbol tier refuses its table.
pub fn create_bashkir() -> Result<BashkirPhonemizer, String> {
    try_def()?;
    crate::languages::russian::manifest::try_manifest()?;
    crate::languages::russian::russian::try_dicts()?;
    Ok(BashkirPhonemizer {
        symbols: try_symbols()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/bashkir.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWordNative", &["аҫыл"], Some("ɑˈθɯɫ")),
        ("phonemizeWordNative", &["ҙур"], Some("ˈðuɾ")),
        ("phonemizeWordNative", &["башҡорт"], Some("bɑʃˈqʊɾt")),
        ("phonemizeWordNative", &["ҡыҙыл"], Some("qɯˈðɯɫ")),
        ("phonemizeWordNative", &["көн"], Some("ˈkøn")),
        ("phonemizeWordNative", &["балыҡ"], Some("bɑˈɫɯq")),
        ("phonemizeWordNative", &["һыу"], Some("ˈhɯw")),
        ("phonemizeWordNative", &["йәшел"], Some("jæˈʃɪl")),
        ("phonemizeWordNative", &["биш"], Some("ˈbiʃ")),
        ("phonemizeWordNative", &["үҙ"], Some("ˈyð")),
        ("getPhonemizer(\"ba\").text", &["7"], Some("jɪˈtɪ")),
        ("getPhonemizer(\"ba\").text", &["11"], Some("ˈun ˈbɪɾ")),
        ("getPhonemizer(\"ba\").text", &["25"], Some("jɪɡɪɾˈmɪ ˈbiʃ")),
        ("getPhonemizer(\"ba\").text", &["100"], Some("ˈjøð")),
        (
            "getPhonemizer(\"ba\").text",
            &["555"],
            Some("ˈbiʃ ˈjøð ilˈlɪ ˈbiʃ"),
        ),
        (
            "getPhonemizer(\"ba\").text",
            &["1984"],
            Some("ˈmɪŋ tuˈʁɯð ˈjøð hikˈhæn ˈdyɾt"),
        ),
        (
            "getPhonemizer(\"ba\").text",
            &["12345"],
            Some("ˈun iˈkɪ ˈmɪŋ ˈøs ˈjøð ˈqɯɾq ˈbiʃ"),
        ),
        (
            "getPhonemizer(\"ba\").text",
            &["1000000"],
            Some("ˈbɪɾ miɫɫiˈʊn"),
        ),
        ("isRussianLoan", &["республика"], Some("true")),
        ("isRussianLoan", &["Европа"], Some("true")),
        ("isRussianLoan", &["тарих"], Some("false")),
        ("isRussianLoan", &["башҡорт"], Some("false")),
        ("isRussianLoan", &["балыҡ"], Some("false")),
        ("phonemizeWord", &["республика"], Some("rʲɪspˈublʲɪkə")),
        ("phonemizeWord", &["кѳньяғында"], Some("kønjɑʁɯnˈdɑ")),
        ("phonemizeWord", &["көньяғында"], Some("kønjɑʁɯnˈdɑ")),
        ("phonemizeWord", &["һѳрѳлгән"], Some("høɾølˈɡæn")),
        ("phonemizeWord", &["һөрөлгән"], Some("høɾølˈɡæn")),
        ("phonemizeWord", &["уныӊ"], Some("uˈnɯŋ")),
        ("phonemizeWord", &["уның"], Some("uˈnɯŋ")),
        ("phonemizeWord", &["меӊдән"], Some("mɪŋˈdæn")),
        ("normalizeBashkir", &["1-се"], Some("беренсе")),
        ("normalizeBashkir", &["2-се"], Some("икенсе")),
        ("normalizeBashkir", &["3-сө"], Some("өсөнсө")),
        ("normalizeBashkir", &["6-сы"], Some("алтынсы")),
        (
            "normalizeBashkir",
            &["23-сө урында"],
            Some("егерме өсөнсө урында"),
        ),
        (
            "normalizeBashkir",
            &["50-се йылдар"],
            Some("илленсе йылдар"),
        ),
        (
            "normalizeBashkir",
            &["159-сы урын"],
            Some("йөҙ илле туғыҙынсы урын"),
        ),
        ("normalizeBashkir", &["10-сы"], Some("унынсы")),
        ("normalizeBashkir", &["4-се"], Some("дүртенсе")),
        ("normalizeBashkir", &["100-сө"], Some("йөҙөнсө")),
        ("normalizeBashkir", &["1000-се"], Some("меңенсе")),
        ("normalizeBashkir", &["100-ҙән"], Some("йөҙҙән")),
        ("normalizeBashkir", &["0-дән"], Some("нульдән")),
        ("normalizeBashkir", &["613-ө"], Some("алты йөҙ ун өсө")),
        ("normalizeBashkir", &["1923233-н"], Some("1923233-н")),
        ("normalizeBashkir", &["2-е изд."], Some("2-е изд.")),
        ("normalizeBashkir", &["1990-е"], Some("1990-е")),
        (
            "normalizeBashkir",
            &["+0,3 °C-тан"],
            Some("плюс 0,3 градустан"),
        ),
        (
            "normalizeBashkir",
            &["+2,8 °C-ҡа тиклем"],
            Some("плюс 2,8 градусҡа тиклем"),
        ),
        (
            "normalizeBashkir",
            &["5°-ҡа тиклем"],
            Some("5 градусҡа тиклем"),
        ),
        (
            "normalizeBashkir",
            &["+0,3 °c-тан"],
            Some("плюс 0,3 градустан"),
        ),
        ("normalizeBashkir", &["35 С°-тан"], Some("35 градустан")),
        (
            "normalizeBashkir",
            &["35 С°-ТАН"],
            Some("35 Цельсий градусы-ТАН"),
        ),
        (
            "normalizeBashkir",
            &["+28 °C"],
            Some("плюс 28 Цельсий градусы"),
        ),
        ("normalizeBashkir", &["10° С-тан"], Some("10 градустан")),
        (
            "normalizeBashkir",
            &["+35С°"],
            Some("плюс 35 Цельсий градусы"),
        ),
        ("normalizeBashkir", &["10:30"], Some("ун утыҙ")),
        ("normalizeBashkir", &["8:30-ҙа"], Some("һигеҙ утыҙҙа")),
        ("normalizeBashkir", &["3 000 000"], Some("3000000")),
        ("normalizeBashkir", &["1991 й."], Some("1991 йыл")),
        (
            "normalizeBashkir",
            &["б. э. т. 145"],
            Some("беҙҙең эраға тиклем 145"),
        ),
        ("normalizeBashkir", &["һ. б."], Some("һәм башҡалар.")),
        ("normalizeBashkir", &["№ 5"], Some("номер 5")),
        ("normalizeBashkir", &["3,300 г"], Some("3,300 грамм")),
        ("normalizeBashkir", &["1988 г."], Some("1988 г.")),
        (
            "getPhonemizer(\"ba\").text",
            &["70 %"],
            Some("jɪtˈmɪʃ prɐt͡sˈɛnt"),
        ),
        (
            "getPhonemizer(\"ba\").text",
            &["12,5 км"],
            Some("ˈun iˈkɪ øˈtøɾ ˈbiʃ kʲɪɫɐmʲˈetr"),
        ),
        (
            "getPhonemizer(\"ba\").text",
            &["100 кг"],
            Some("ˈjøð kiɫʊɡˈɾɑmm"),
        ),
        (
            "getPhonemizer(\"ba\").text",
            &["10 км²"],
            Some("ˈun kwɑdˈɾɑt kʲɪɫɐmʲˈetr"),
        ),
        (
            "getPhonemizer(\"ba\").text",
            &["5,3 %"],
            Some("ˈbiʃ øˈtøɾ ˈøs prɐt͡sˈɛnt"),
        ),
        ("normalizeBashkir", &["f/0.7"], Some("f/0.7")),
        ("normalizeBashkir", &["6.5-66"], Some("6.5-66")),
        ("normalizeBashkir", &["−41 градус"], Some("минус 41 градус")),
        ("normalizeBashkir", &["5 = 5"], Some("5 тигеҙ 5")),
        ("normalizeBashkir", &["6 × 6"], Some("6 тапҡыр 6")),
        ("normalizeBashkir", &["a^{-1}=e"], Some("a^{-1}=e")),
        ("normalizeBashkir", &["6,4÷6,7"], Some("6,4÷6,7")),
        ("normalizeBashkir", &["300—600 мм"], Some("300, 600 мм")),
        ("normalizeBashkir", &["1-3 көн"], Some("1, 3 көн")),
        ("normalizeBashkir", &["120—135 көн."], Some("120, 135 көн.")),
        ("ROMAN_POLICY.ordinal", &["19"], Some("ун туғыҙынсы")),
        ("ROMAN_POLICY.ordinal", &["20"], Some("егерменсе")),
        ("ROMAN_POLICY.ordinal", &["101"], None),
        (
            "phonemize",
            &["XIX быуат", "ba"],
            Some("ˈun tuʁɯðɯnˈsɯ bɯˈwɑt"),
        ),
        (
            "phonemize",
            &["XX быуатта", "ba"],
            Some("jɪɡɪɾmɪnˈsɪ bɯwɑtˈtɑ"),
        ),
        (
            "phonemize",
            &["Әхмәт III-сөнөң", "ba"],
            Some("æχˈmæt øsønsøˈnøŋ"),
        ),
        (
            "getPhonemizer(\"ba\").text",
            &["СССР"],
            Some("ˈɪs ˈɪs ˈɪs ˈɪɾ"),
        ),
        ("getPhonemizer(\"ba\").text", &["АҠШ"], Some("ˈɑ ˈqɯ ˈʃɑ")),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_bashkir().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "phonemizeWordNative" => Some(e.phonemize_word_native(&a(0))),
                "isRussianLoan" => Some(js(&e.is_russian_loan(&a(0)).to_string())),
                "normalizeBashkir" => Some(e.normalize(&a(0))),
                "ROMAN_POLICY.ordinal" => ba_roman_ordinal(js_number(&a(0))),
                "getPhonemizer(\"ba\").text" => {
                    Some(crate::registry::phonemize_in("ba", &a(0)).unwrap())
                }
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

/// #1581, as test/turkic2-defects-1581.test.ts: relational, so no IPA is typed.
#[cfg(all(test, feature = "ba"))]
mod defects_1581_tests {
    use super::*;
    use crate::core::js_string::js;

    fn say(s: &str) -> String {
        crate::phonemize(s, "ba").unwrap()
    }

    #[test]
    fn trillion_range_gram_and_initial_cluster() {
        assert_eq!(say("1000000000000"), say("бер триллион"));
        assert_eq!(say("1990 -1995"), say("1990-1995"));
        assert_eq!(say("-5"), say("минус 5"));
        assert_eq!(say("5 г-ға"), say("5 граммға"));
        assert!(
            phonemize_word_native(&js("спорт"))
                .to_string_lossy()
                .starts_with('ˈ')
        );
        let k: Vec<char> = phonemize_word_native(&js("китаплар"))
            .to_string_lossy()
            .chars()
            .collect();
        let stress = k.iter().position(|&c| c == 'ˈ').unwrap();
        let last_a = k.iter().rposition(|&c| c == 'ɑ').unwrap();
        assert_eq!(stress, last_a - 2);
    }
}
