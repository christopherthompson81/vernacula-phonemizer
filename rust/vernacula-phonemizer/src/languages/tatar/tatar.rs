//! Tatar (tt) phonemizer: the Cyrillic scan with к/г backing by the nearest vowel, а fronted in a front word,
//! е iotated initially, after a vowel and after the separating ъ; final stress placed before the last nucleus's
//! onset (one consonant word-internally); text()
//! over words, numbers (comma decimal) and punctuation. Ported from src/languages/tatar/tatar.ts — see that file
//! for the sources.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use super::normalize::{
    is_unreadable_tatar, normalize_tatar, normalize_tatar_initialisms, ordinal_of,
};
use super::numbers::number_to_words;
use super::roman_ordinals::tt_roman_ordinal;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::ipa::is_ipa_vowel;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{Form, normalize};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/tatar";

/// `TatarDef` (tatar.ts). Every field the TS interface names is required.
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct TatarDef {
    pub consonants: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub iotated: IndexMap<String, String>,
    pub vowel_letters: Vec<String>,
    pub back_vowels: Vec<String>,
    pub front_vowels: Vec<String>,
}

pub fn try_def() -> Result<&'static TatarDef, String> {
    static D: OnceLock<TatarDef> = OnceLock::new();
    load_once(&D, || {
        load_manifest(DIR, "tatar.jsonc").map_err(|e| e.to_string())
    })
}

/// `DEF`, for code reached only through a checked path (`createTatar` loads it first).
static DEF: LazyLock<&'static TatarDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

/// `[...seg].some((c) => IPA_VOWEL.has(c))`.
fn has_ipa_vowel(seg: &JsString) -> bool {
    seg.code_point_strings()
        .iter()
        .any(|c| c.len() == 1 && is_ipa_vowel(c.units()[0]))
}

fn contains(list: &[String], c: &str) -> bool {
    list.iter().any(|x| x == c)
}

/// `nearBack(chars, i)`: the nearest vowel outward from `i` (а skipped), back by default.
fn near_back(chars: &[String], i: usize) -> bool {
    let d_ = &*DEF;
    let i = i as isize;
    for d in 1..chars.len() as isize {
        for j in [i - d, i + d] {
            let Some(c) = (j >= 0).then(|| chars.get(j as usize)).flatten() else {
                continue;
            };
            if c == "а" {
                continue;
            }
            if contains(&d_.back_vowels, c) {
                return true;
            }
            if contains(&d_.front_vowels, c) {
                return false;
            }
        }
    }
    true
}

/// `phonemizeWord(word)`: the harmony-aware scan, then the stress mark before the last nucleus's onset — one
/// consonant word-internally (китап.лар), the whole cluster only word-initially (#1576).
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let d = &*DEF;
    let w = normalize(word, Form::Nfc).to_lower_case();
    // `[...w]`: code points, a lone surrogate as its own item (it matches no table).
    let chars: Vec<String> = w
        .code_point_strings()
        .iter()
        .map(|c| c.to_string_lossy())
        .collect();
    let front_word = js_re!(r"[әөүеиэ]", "u").test(&w);
    let mut segs: Vec<JsString> = Vec::new();
    for (i, ch) in chars.iter().enumerate() {
        let ch = ch.as_str();
        let ph = if ch == "к" {
            Some(if near_back(&chars, i) { "q" } else { "k" })
        } else if ch == "г" {
            Some(if near_back(&chars, i) { "ʁ" } else { "ɡ" })
        } else if ch == "а" {
            Some(if front_word { "a" } else { "ɑ" })
        } else if ch == "е" {
            // initial, post-vocalic, and after the separating ъ (съезд, йөзъеллык)
            Some(
                if i == 0 || contains(&d.vowel_letters, &chars[i - 1]) || chars[i - 1] == "ъ" {
                    "je"
                } else {
                    "e"
                },
            )
        } else if let Some(c) = d.consonants.get(ch) {
            Some(c.as_str())
        } else if let Some(c) = d.iotated.get(ch) {
            Some(c.as_str())
        } else if let Some(c) = d.vowels.get(ch) {
            Some(c.as_str())
        } else if ch == "ъ" {
            // The glottal stop natively (мәсъәлә); the UVULAR marker after к г (мәкъалә, мәгънә); the /j/
            // separator before an iotated vowel (съезд, йөзъеллык). See tatar.ts (#1576).
            let prev = if i > 0 { chars[i - 1].as_str() } else { "" };
            if (prev == "к" || prev == "г")
                && let Some(last) = segs.last_mut()
            {
                *last = js(if prev == "к" { "q" } else { "ʁ" });
                None
            } else if chars
                .get(i + 1)
                .is_some_and(|n| ["е", "ё", "ю", "я"].contains(&n.as_str()))
            {
                None
            } else {
                Some("ʔ")
            }
        } else {
            None
        };
        if let Some(ph) = ph {
            segs.push(js(ph));
        }
    }
    if let Some(nucleus) = (0..segs.len()).rev().find(|&i| has_ipa_vowel(&segs[i])) {
        let mut at = nucleus;
        if at > 0 && !has_ipa_vowel(&segs[at - 1]) {
            at -= 1;
        }
        if !segs[..at].iter().any(has_ipa_vowel) {
            at = 0; // a word-initial cluster is the whole onset (спорт)
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

/// tatar.ts's `makeSymbolNormalizer({…})` literal, evaluated from the source and `JSON.stringify`'d.
const SYMBOL_DATA: &str = r#"{"percent":["процент"],"currency":{"$":["доллар"],"€":["евро"],"£":["фунт"],"₽":["сум"]},"units":{"км":["километр"],"см":["сантиметр"],"мм":["миллиметр"],"кг":["килограмм"],"мг":["миллиграмм"],"га":["гектар"],"м":["метр"],"km":["километр"],"cm":["сантиметр"],"mm":["миллиметр"],"kg":["килограмм"],"m":["метр"]},"unitPer":"","rateDenominators":{"с":"секундына","сәг":"сәгатенә","л":"литрына","s":"секундына","h":"сәгатенә","c":"секундына"},"exponentWords":{"squared":["квадрат"],"cubed":["куб"],"position":"before"},"multiply":{"times":"тапкыр"},"ampersand":"һәм","magnitudes":["мең","миллион","миллиард","триллион"]}"#;

fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let data: SymbolData =
            crate::core::from_json::parse_json(SYMBOL_DATA).map_err(|e| e.to_string())?;
        make_symbol_normalizer(&data)
    })
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"([Ѐ-ӿ]+)|(\d+(?:,\d+)?)|([.!?…,;:])", "gu").unwrap());

/// The Tatar engine (`createTatar`).
pub struct TatarPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding one proves the manifest and the tier loaded.
/// (The per-module differentials call them.)
impl TatarPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_tatar(text)
    }

    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_tatar_initialisms(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_tatar(word)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn number_words(&self, n: f64) -> JsString {
        js(&number_to_words(n).join("|"))
    }

    pub fn ordinal_of(&self, n: f64) -> Option<JsString> {
        ordinal_of(n)
    }

    pub fn roman_ordinal(&self, n: f64) -> Option<JsString> {
        tt_roman_ordinal(n)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let prepared = self
            .symbols
            .apply(&normalize_tatar_initialisms(&normalize_tatar(input)));
        assemble_clauses(&prepared, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(n) = m.group(2, s).filter(|n| !n.is_empty()) {
                let parts = n.split(&js(","));
                sink.emit(&number(&parts[0]));
                if let Some(frac) = parts.get(1) {
                    sink.emit(&phonemize_word(&js("өтер")));
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

impl Engine for TatarPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(TatarPhonemizer::text(self, input))
    }
}

/// `createTatar()`. Errors when the manifest cannot be loaded, or the symbol tier refuses its table.
pub fn create_tatar() -> Result<TatarPhonemizer, String> {
    try_def()?;
    Ok(TatarPhonemizer {
        symbols: try_symbols()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One pin's actual value: `kind` names the TS call the pin was extracted from.
    fn actual(kind: &str, input: &str) -> Option<JsString> {
        let s = js(input);
        match kind {
            "word" => Some(phonemize_word(&s)),
            "registry" => Some(crate::registry::phonemize_in("tt", &s).unwrap()),
            "phonemize" => Some(js(&crate::phonemize(input, "tt").unwrap())),
            "normalize" => Some(normalize_tatar(&s)),
            "ordinal" => ordinal_of(input.parse::<f64>().unwrap()),
            k => panic!("no pin kind {k}"),
        }
    }

    /// test/tatar.test.ts's pins, extracted by `.probe/turkic/pins.mjs` (no reading typed by hand). A `same` pin
    /// is relational: both inputs must read alike.
    #[test]
    fn the_ts_suite_pins_hold() {
        create_tatar().unwrap();
        let mut bad = Vec::new();
        for (kind, trim, op, input, want) in PINS {
            let get = |i: &str| actual(kind, i).map(|g| if trim { g.trim() } else { g });
            let got = get(input);
            let ok = match (op, &got) {
                ("none", None) => true,
                ("eq", Some(g)) => *g == js(want),
                ("ne", Some(g)) => *g != js(want),
                ("contains", Some(g)) => g.includes(&js(want)),
                ("not_contains", Some(g)) => !g.includes(&js(want)),
                ("same", Some(g)) => Some(g.clone()) == get(want),
                ("not_same", Some(g)) => Some(g.clone()) != get(want),
                _ => false,
            };
            if !ok {
                bad.push(format!("{kind}({input}) {op} {want:?}: got {got:?}"));
            }
        }
        assert!(bad.is_empty(), "{}", bad.join("\n"));
    }

    /// An Arabic run inside Tatar is read by the `ar` engine in the TS. Until `ar` is ported the run is dropped
    /// and recorded as port-pending (the golden's one differing row); this flips when `ar` lands.
    #[test]
    fn an_arabic_run_is_pending_on_ar_until_it_is_ported() {
        crate::phonemize("мәсри: مصر", "tt").unwrap();
        let pending = crate::registry::port_pending();
        assert_eq!(
            pending.iter().any(|p| p == "ar"),
            !crate::LANGUAGES.contains(&"ar"),
            "{pending:?}"
        );
    }

    /// 70 pins extracted mechanically from test/tatar.test.ts (kind, trim, op, input,
    /// expected): 70 expect() sites, 0 skipped.
    const PINS: [(&str, bool, &str, &str, &str); 70] = [
        ("word", false, "eq", "ак", "ˈɑq"),
        ("word", false, "eq", "мәктәп", "mækˈtæp"),
        ("word", false, "eq", "балык", "bɑˈlɨq"),
        ("word", false, "eq", "көз", "ˈkøz"),
        ("word", false, "eq", "дүшәмбе", "dyʃæmˈbe"),
        ("word", false, "eq", "вөҗдан", "vøʑˈdan"),
        ("word", false, "eq", "якшәмбе", "jɑqʃæmˈbe"),
        ("word", false, "eq", "шимбә", "ʃimˈbæ"),
        ("word", false, "eq", "татар", "tɑˈtɑr"),
        ("word", false, "eq", "ана", "ɑˈnɑ"),
        ("word", false, "eq", "китап", "kiˈtap"),
        ("registry", true, "eq", "7", "ʑiˈde"),
        ("registry", true, "eq", "11", "unˈber"),
        ("registry", true, "eq", "25", "jeɡerˈme ˈbiʃ"),
        ("registry", true, "eq", "100", "ˈjøz"),
        ("registry", true, "eq", "555", "ˈbiʃ ˈjøz ilˈle ˈbiʃ"),
        (
            "registry",
            true,
            "eq",
            "1984",
            "ˈmeŋ tuˈʁɨz ˈjøz sikˈsæn ˈdyrt",
        ),
        (
            "registry",
            true,
            "eq",
            "12345",
            "uniˈke ˈmeŋ ˈøɕ ˈjøz qɨˈrɨq ˈbiʃ",
        ),
        ("registry", true, "eq", "1000000", "ˈber milliˈon"),
        ("word", false, "eq", "чәч", "ˈɕæɕ"),
        ("word", false, "eq", "гаилә", "ɡaiˈlæ"),
        ("word", false, "eq", "елга", "jelˈɡa"),
        ("word", false, "eq", "спорт", "ˈsport"),
        ("phonemize", false, "eq", "3-нче", "øɕenˈɕe"),
        (
            "phonemize",
            false,
            "eq",
            "2009-нчы елдан",
            "iˈke ˈmeŋ tuʁɨzɨnˈɕɨ jelˈdan",
        ),
        (
            "phonemize",
            false,
            "eq",
            "19-ынчы гасырда",
            "untuʁɨzɨnˈɕɨ ʁɑsɨrˈdɑ",
        ),
        (
            "phonemize",
            false,
            "eq",
            "1917 нче елда",
            "ˈmeŋ tuˈʁɨz ˈjøz unʑidenˈɕe jelˈda",
        ),
        (
            "phonemize",
            false,
            "eq",
            "1 нче президенты",
            "berenˈɕe prezidenˈtɨ",
        ),
        (
            "phonemize",
            false,
            "eq",
            "2005нченең мартында",
            "iˈke ˈmeŋ biʃenɕeˈneŋ mɑrtɨnˈdɑ",
        ),
        (
            "phonemize",
            false,
            "eq",
            "2000-гә якын",
            "iˈke meŋˈɡæ jɑˈqɨn",
        ),
        ("normalize", false, "eq", "рәс. 12.1а", "рәс. 12.1а"),
        (
            "normalize",
            false,
            "eq",
            "(рәс. 12.2в, г)",
            "(рәс. 12.2в, г)",
        ),
        ("normalize", false, "eq", "4-е изд.", "4-е изд."),
        ("ordinal", false, "eq", "3", "өченче"),
        ("ordinal", false, "eq", "100", "йөзенче"),
        ("ordinal", false, "eq", "6", "алтынчы"),
        ("ordinal", false, "eq", "9", "тугызынчы"),
        ("ordinal", false, "eq", "40", "кырыгынчы"),
        ("ordinal", false, "eq", "41", "кырык беренче"),
        ("phonemize", false, "eq", "XX гасыр", "jeɡermenˈɕe ʁɑˈsɨr"),
        ("phonemize", false, "eq", "XL гасыр", "qɨrɨʁɨnˈɕɨ ʁɑˈsɨr"),
        (
            "phonemize",
            false,
            "eq",
            "IV гасырдан",
            "dyrtenˈɕe ʁɑsɨrˈdɑn",
        ),
        ("phonemize", false, "eq", "Александр III", "alekˈsandr ˈøɕ"),
        (
            "phonemize",
            false,
            "eq",
            "22:30-га",
            "jeɡerˈme iˈke utɨzˈʁɑ",
        ),
        (
            "phonemize",
            false,
            "eq",
            "13:23:58дә",
            "uˈnøɕ jeɡerˈme ˈøɕ ilˈle siɡezˈdæ",
        ),
        (
            "phonemize",
            false,
            "eq",
            "21: 00 сәгатьтә",
            "jeɡerˈme ˈber sæɡatˈtæ",
        ),
        (
            "phonemize",
            false,
            "eq",
            "90° әйләндерелгән",
            "tuqˈsɑn ʁrɑˈdus æjlænderelˈɡæn",
        ),
        (
            "phonemize",
            false,
            "eq",
            "66°30'",
            "ɑltˈmɨʃ ɑlˈtɨ ʁrɑˈdus uˈtɨz miˈnut",
        ),
        (
            "phonemize",
            false,
            "eq",
            "41°11'ында",
            "qɨˈrɨq ˈber ʁrɑˈdus unˈber minutɨnˈda",
        ),
        (
            "phonemize",
            false,
            "eq",
            "Б.э.к. 334 елда",
            "bezˈneŋ eraˈɡa kaˈdær ˈøɕ ˈjøz uˈtɨz ˈdyrt jelˈda",
        ),
        ("normalize", false, "eq", "я. э. к.", "яңа эрага кадәр."),
        ("normalize", false, "eq", "һ.б.", "һәм башкалар."),
        ("normalize", false, "eq", "8 млн. т", "8 миллион т"),
        (
            "phonemize",
            false,
            "eq",
            "142 914 мең кеше",
            "ˈjøz qɨˈrɨq iˈke ˈmeŋ tuˈʁɨz ˈjøz unˈdyrt ˈmeŋ keˈʃe",
        ),
        (
            "phonemize",
            false,
            "eq",
            "0,6 км",
            "ˈnul øˈter ɑlˈtɨ kiloˈmetr",
        ),
        (
            "phonemize",
            false,
            "eq",
            "1236—1237 елларда",
            "ˈmeŋ iˈke ˈjøz uˈtɨz ɑlˈtɨ , ˈmeŋ iˈke ˈjøz uˈtɨz ʑiˈde jellarˈda",
        ),
        (
            "phonemize",
            false,
            "eq",
            "С. 34-37.",
            "s . uˈtɨz ˈdyrt , uˈtɨz ʑiˈde .",
        ),
        (
            "phonemize",
            false,
            "eq",
            "11,5%",
            "unˈber øˈter ˈbiʃ proˈt͡sent",
        ),
        (
            "phonemize",
            false,
            "eq",
            "$100 миллион",
            "ˈjøz milliˈon dolˈlɑr",
        ),
        (
            "phonemize",
            false,
            "eq",
            "11 500 км²",
            "unˈber ˈmeŋ ˈbiʃ ˈjøz qvɑdˈrɑt kiloˈmetr",
        ),
        (
            "phonemize",
            false,
            "eq",
            "9,44 м³/с",
            "tuˈʁɨz øˈter ˈdyrt ˈdyrt ˈqub ˈmetr sekundɨˈna",
        ),
        ("phonemize", false, "eq", "№ 5", "noˈmer ˈbiʃ"),
        (
            "normalize",
            false,
            "eq",
            "aba=«ölkän ir tuğan»",
            "aba=«ölkän ir tuğan»",
        ),
        ("normalize", false, "eq", "5 = 5", "5 тигез 5"),
        ("normalize", false, "eq", "ПБУ 19/02", "ПБУ 19/02"),
        (
            "normalize",
            false,
            "eq",
            "2010/11 уку елында",
            "2010/11 уку елында",
        ),
        ("normalize", false, "eq", "08.10.07", "08.10.07"),
        ("phonemize", false, "eq", "ТР", "ˈte ˈer"),
        ("phonemize", false, "eq", "АКШ", "ˈɑ ˈqɑ ˈʃɑ"),
        ("phonemize", false, "eq", "СССР", "ˈes ˈes ˈes ˈer"),
    ];
}
