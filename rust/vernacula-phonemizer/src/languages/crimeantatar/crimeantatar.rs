//! Crimean Tatar (crh) phonemizer: a left-to-right Latin letter scan (Turkish dotless-I casing, v → w in a
//! post-vocalic coda, doubled letters as length, an unlisted letter through the shared Latin phones) with final
//! stress, and text() over the nativised Latin runs, numbers and punctuation.
//! Ported from src/languages/crimeantatar/crimeantatar.ts — see that file for the sources.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::{normalize_crimean_tatar, symbols, try_symbols};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::ipa::is_ipa_vowel;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::load_manifest::load_manifest;
use crate::core::provenance::{Form, normalize, renormalize};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/crimeantatar";

/// `CrimeanTatarDef` (crimeantatar.ts). Every field the TS interface names is required.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrimeanTatarDef {
    pub letters: IndexMap<String, String>,
    pub vowel_letters: Vec<String>,
}

pub fn try_def() -> Result<&'static CrimeanTatarDef, String> {
    static D: OnceLock<CrimeanTatarDef> = OnceLock::new();
    load_once(&D, || {
        load_manifest(DIR, "crimeantatar.jsonc").map_err(|e| e.to_string())
    })
}

/// `DEF`, for code reached only through a checked path (`createCrimeanTatar` loads it first).
static DEF: LazyLock<&'static CrimeanTatarDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

fn is_vowel_letter(c: &str) -> bool {
    DEF.vowel_letters.iter().any(|v| v == c)
}

/// `[...s].some((x) => IPA_VOWEL.has(x))`.
fn has_ipa_vowel(seg: &JsString) -> bool {
    seg.code_point_strings()
        .iter()
        .any(|c| c.len() == 1 && is_ipa_vowel(c.units()[0]))
}

/// `phonemizeWord(word)`: one Crimean Tatar word to canonical IPA.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let cased = js_re!(r"I", "gu").replace(
        &js_re!(r"İ", "gu").replace(&normalize(word, Form::Nfc), &js("i")),
        &js("ı"),
    );
    // `[...cased.toLowerCase()]`: code points, a lone surrogate as its own item.
    let units = cased.to_lower_case().code_point_strings();
    let chars: Vec<String> = units.iter().map(|c| c.to_string_lossy()).collect();
    let mut segs: Vec<JsString> = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i].as_str();
        let ph = match DEF.letters.get(c) {
            Some(p) => Some(js(p)),
            None => latin_phone(
                &units[i],
                PhoneOpts {
                    initial: i == 0,
                    include_h: true,
                },
            ),
        };
        let Some(mut ph) = ph else {
            i += 1;
            continue;
        };
        if c == "v"
            && i > 0
            && is_vowel_letter(&chars[i - 1])
            && !(i + 1 < chars.len() && is_vowel_letter(&chars[i + 1]))
        {
            ph = js("w");
        }
        if chars.get(i + 1).is_some_and(|n| n == c) {
            segs.push(ph.concat(&js("ː")));
            i += 1;
        } else {
            segs.push(ph);
        }
        i += 1;
    }
    if let Some(nucleus) = (0..segs.len()).rev().find(|&i| has_ipa_vowel(&segs[i])) {
        let at = if nucleus > 0 && !has_ipa_vowel(&segs[nucleus - 1]) {
            nucleus - 1
        } else {
            nucleus
        };
        segs.insert(at, js("ˈ"));
    }
    JsString::join(&segs, &JsString::new())
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

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.?!,;:…])", *LATIN_RUN), "gu").unwrap());

const NATIVE_CLASS: &str = "[a-zâçğıiñöşüA-ZÂÇĞIİÑÖŞÜ]";

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "u")));

/// The Crimean Tatar engine (`createCrimeanTatar`).
pub struct CrimeanTatarPhonemizer {
    _loaded: (),
}

/// The module functions, exposed through the engine: holding one proves the manifest and the tier loaded.
/// (The per-module differentials call them.)
impl CrimeanTatarPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_crimean_tatar(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        symbols(text)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `nat(word)` (the nativiser built with crimeantatar.ts's class).
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    pub fn number_words(&self, n: f64) -> JsString {
        js(&number_to_words(n).join("|"))
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let prepared = normalize_crimean_tatar(&renormalize(input, Form::Nfc));
        assemble_clauses(&prepared, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(n) = m.group(2, s).filter(|n| !n.is_empty()) {
                sink.emit(&number(&n));
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

impl Engine for CrimeanTatarPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(CrimeanTatarPhonemizer::text(self, input))
    }
}

/// `createCrimeanTatar()`. Errors when the manifest cannot be loaded, or the symbol tier refuses its table.
pub fn create_crimean_tatar() -> Result<CrimeanTatarPhonemizer, String> {
    try_def()?;
    try_symbols()?;
    Ok(CrimeanTatarPhonemizer { _loaded: () })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/crimeantatar.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["Qırım"], Some("qɯˈrɯm")),
        ("phonemizeWord", &["qara"], Some("qɑˈrɑ")),
        ("phonemizeWord", &["ağa"], Some("ɑˈɣɑ")),
        ("phonemizeWord", &["balıq"], Some("bɑˈlɯq")),
        ("phonemizeWord", &["köy"], Some("ˈkøj")),
        ("phonemizeWord", &["süt"], Some("ˈsyt")),
        ("phonemizeWord", &["çay"], Some("ˈt͡ʃɑj")),
        ("phonemizeWord", &["gece"], Some("ɡeˈd͡ʒe")),
        ("phonemizeWord", &["añlamaq"], Some("ɑŋlɑˈmɑq")),
        ("phonemizeWord", &["suv"], Some("ˈsuw")),
        ("phonemizeWord", &["av"], Some("ˈɑw")),
        ("phonemizeWord", &["quvetsiz"], Some("quvetˈsiz")),
        ("phonemizeWord", &["vatan"], Some("vɑˈtɑn")),
        ("createCrimeanTatar().text", &["7"], Some("jeˈdi")),
        ("createCrimeanTatar().text", &["11"], Some("ˈon ˈbir")),
        ("createCrimeanTatar().text", &["42"], Some("ˈqɯrq eˈki")),
        ("createCrimeanTatar().text", &["100"], Some("ˈjyz")),
        (
            "createCrimeanTatar().text",
            &["555"],
            Some("ˈbeʃ ˈjyz eˈlːi ˈbeʃ"),
        ),
        (
            "createCrimeanTatar().text",
            &["1984"],
            Some("ˈbiŋ doˈquz ˈjyz sekˈsen ˈdørt"),
        ),
        (
            "createCrimeanTatar().text",
            &["12345"],
            Some("ˈon eˈki ˈbiŋ ˈyt͡ʃ ˈjyz ˈqɯrq ˈbeʃ"),
        ),
        (
            "createCrimeanTatar().text",
            &["1000000"],
            Some("ˈbir milːiˈon"),
        ),
        ("phonemizeWord", &["yollamaq"], Some("jolːɑˈmɑq")),
        ("phonemizeWord", &["şeer"], Some("ˈʃeːr")),
        ("phonemizeWord", &["QIRIM"], Some("qɯˈrɯm")),
        ("createCrimeanTatar().text", &["İşançlı"], Some("iʃɑnt͡ʃˈlɯ")),
        (
            "normalizeCrimeanTatar",
            &["1891 – 1938"],
            Some("1891, 1938"),
        ),
        (
            "normalizeCrimeanTatar",
            &["600—700 biñge"],
            Some("600, 700 biñge"),
        ),
        (
            "normalizeCrimeanTatar",
            &["520-590 mm"],
            Some("520, 590 millimetr"),
        ),
        (
            "normalizeCrimeanTatar",
            &["arareti –1,8°C"],
            Some("arareti minus 1 8 derece"),
        ),
        (
            "normalizeCrimeanTatar",
            &["arareti -6 °C"],
            Some("arareti minus 6 derece"),
        ),
        (
            "normalizeCrimeanTatar",
            &["+3 – +4°C"],
            Some("+3, +4 derece"),
        ),
        (
            "normalizeCrimeanTatar",
            &["+22 – +28°C"],
            Some("+22, +28 derece"),
        ),
        (
            "normalizeCrimeanTatar",
            &["14 125 adadan"],
            Some("14125 adadan"),
        ),
        ("normalizeCrimeanTatar", &["30 300 000"], Some("30300000")),
        (
            "normalizeCrimeanTatar",
            &["36,000 senesine"],
            Some("36000 senesine"),
        ),
        ("normalizeCrimeanTatar", &["38.765"], Some("38765")),
        (
            "normalizeCrimeanTatar",
            &["1,5 million"],
            Some("1 5 million"),
        ),
        ("normalizeCrimeanTatar", &["5.9"], Some("5 9")),
        ("normalizeCrimeanTatar", &["0,7%-ine"], Some("0 7 faizine")),
        ("normalizeCrimeanTatar", &["69 %"], Some("69 faiz")),
        (
            "normalizeCrimeanTatar",
            &["+23 °C-den +26 °C-ge qadar"],
            Some("+23 dereceden +26 derecege qadar"),
        ),
        ("normalizeCrimeanTatar", &["+24°С"], Some("+24 derece")),
        (
            "normalizeCrimeanTatar",
            &["m.e. 753 senesi"],
            Some("milâttan evel 753 senesi"),
        ),
        (
            "normalizeCrimeanTatar",
            &["46° ş.e."],
            Some("46 derece şimaliy enlik"),
        ),
        (
            "normalizeCrimeanTatar",
            &["46° ş.e. enlikleri"],
            Some("46 derece şimaliy enlikleri"),
        ),
        (
            "normalizeCrimeanTatar",
            &["36° ş.b. boyluqları"],
            Some("36 derece şarqiy boyluqları"),
        ),
        (
            "normalizeCrimeanTatar",
            &["6° ğ.b. ve"],
            Some("6 derece ğarbiy boyluq ve"),
        ),
        (
            "phonemize",
            &["dört biñ metr", "crh"],
            Some("ˈdørt ˈbiŋ ˈmetr"),
        ),
        (
            "phonemize",
            &["10 biñ kvadrat km-ge", "crh"],
            Some("ˈon ˈbiŋ kvɑdˈrɑt kiloˈmetr ˈɡe"),
        ),
        (
            "phonemize",
            &["$ 1 580", "crh"],
            Some("ˈbiŋ ˈbeʃ ˈjyz sekˈsen doˈlːɑr"),
        ),
        (
            "normalizeCrimeanTatar",
            &["PlotArea = left:50"],
            Some("PlotArea = left:50"),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_crimean_tatar().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeCrimeanTatar" => Some(e.normalize(&a(0))),
                "createCrimeanTatar().text" => Some(e.text(&a(0))),
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
#[cfg(all(test, feature = "crh"))]
mod defects_1581_tests {

    fn say(s: &str) -> String {
        crate::phonemize(s, "crh").unwrap()
    }

    #[test]
    fn percent_suffix_and_spaced_dash() {
        assert_eq!(say("50% ve"), say("50 faiz ve"));
        assert_eq!(say("0,7%-ine"), say("0,7 faizine"));
        assert_eq!(say("fiyatı - 5 lira"), say("fiyatı 5 lira"));
        assert_eq!(say("-6 °C"), say("minus 6 °C"));
    }
}
