//! Karakalpak (kaa) phonemizer: a greedy Latin (2016) scan (Turkish dotless-I casing, the sh / ch digraphs, an
//! unlisted letter through the shared Latin phones) with final stress, and text() over the nativised Latin runs,
//! numbers and punctuation. Ported from src/languages/karakalpak/karakalpak.ts — see that file for the sources.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::{normalize_karakalpak, symbols, try_symbols};
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

pub const DIR: &str = "languages/karakalpak";

/// `KarakalpakDef` (karakalpak.ts). Every field the TS interface names is required.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KarakalpakDef {
    pub digraphs: Vec<(String, String)>,
    pub letters: IndexMap<String, String>,
}

pub fn try_def() -> Result<&'static KarakalpakDef, String> {
    static D: OnceLock<KarakalpakDef> = OnceLock::new();
    load_once(&D, || {
        load_manifest(DIR, "karakalpak.jsonc").map_err(|e| e.to_string())
    })
}

/// `DEF`, for code reached only through a checked path (`createKarakalpak` loads it first).
static DEF: LazyLock<&'static KarakalpakDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

/// `IPA_VOWEL.has(s)`: the WHOLE segment is one vowel character (not "contains a vowel").
fn is_vowel_seg(seg: &JsString) -> bool {
    seg.len() == 1 && is_ipa_vowel(seg.units()[0])
}

/// `phonemizeWord(word)`: one Karakalpak word to canonical IPA.
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
        // `chars[i] === k[0] && chars[i + 1] === k[1]`: `k[n]` is one UTF-16 unit of the key.
        let unit = |s: &str, n: usize| s.encode_utf16().nth(n).map(|u| JsString(vec![u]));
        let dg = DEF.digraphs.iter().find(|(k, _)| {
            unit(k, 0).is_some_and(|k0| units[i] == k0)
                && unit(k, 1).is_some_and(|k1| units.get(i + 1) == Some(&k1))
        });
        if let Some((_, ph)) = dg {
            segs.push(js(ph));
            i += 2;
            continue;
        }
        let ph = match DEF.letters.get(chars[i].as_str()) {
            Some(p) => Some(js(p)),
            None => latin_phone(
                &units[i],
                PhoneOpts {
                    initial: i == 0,
                    include_h: true,
                },
            ),
        };
        if let Some(ph) = ph {
            segs.push(ph);
        }
        i += 1;
    }
    if let Some(nucleus) = (0..segs.len()).rev().find(|&i| is_vowel_seg(&segs[i])) {
        let at = if nucleus > 0 && !is_vowel_seg(&segs[nucleus - 1]) {
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

const NATIVE_CLASS: &str = "[a-záóúíńǵıA-ZÁÓÚÍŃǴIİ]";

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "u")));

/// The Karakalpak engine (`createKarakalpak`).
pub struct KarakalpakPhonemizer {
    _loaded: (),
}

/// The module functions, exposed through the engine: holding one proves the manifest and the tier loaded.
/// (The per-module differentials call them.)
impl KarakalpakPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_karakalpak(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        symbols(text)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `nat(word)` (the nativiser built with karakalpak.ts's class).
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    pub fn number_words(&self, n: f64) -> JsString {
        js(&number_to_words(n).join("|"))
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let prepared = normalize_karakalpak(&renormalize(input, Form::Nfc));
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

impl Engine for KarakalpakPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(KarakalpakPhonemizer::text(self, input))
    }
}

/// `createKarakalpak()`. Errors when the manifest cannot be loaded, or the symbol tier refuses its table.
pub fn create_karakalpak() -> Result<KarakalpakPhonemizer, String> {
    try_def()?;
    try_symbols()?;
    Ok(KarakalpakPhonemizer { _loaded: () })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/karakalpak.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["qaraqalpaq"], Some("qɑrɑqɑlˈpɑq")),
        ("phonemizeWord", &["xalıq"], Some("χɑˈlɯq")),
        ("phonemizeWord", &["ǵárezsizlik"], Some("ʁærezsizˈlik")),
        ("phonemizeWord", &["basqa"], Some("bɑsˈqɑ")),
        ("phonemizeWord", &["ásir"], Some("æˈsir")),
        ("phonemizeWord", &["sózlik"], Some("søzˈlik")),
        ("phonemizeWord", &["úsh"], Some("ˈyʃ")),
        ("phonemizeWord", &["juldız"], Some("ʒulˈdɯz")),
        ("phonemizeWord", &["máńgi"], Some("mæŋˈɡi")),
        ("phonemizeWord", &["suw"], Some("ˈsuw")),
        ("phonemizeWord", &["Ishan"], Some("ɯˈʃɑn")),
        ("phonemizeWord", &["ISHAN"], Some("ɯˈʃɑn")),
        ("createKarakalpak().text", &["7"], Some("ʒeˈti")),
        ("createKarakalpak().text", &["11"], Some("ˈon ˈbir")),
        ("createKarakalpak().text", &["25"], Some("ʒiɡirˈmɑ ˈbes")),
        ("createKarakalpak().text", &["100"], Some("ˈʒyz")),
        (
            "createKarakalpak().text",
            &["555"],
            Some("ˈbes ˈʒyz eˈliw ˈbes"),
        ),
        (
            "createKarakalpak().text",
            &["1984"],
            Some("ˈmɯŋ toˈʁɯz ˈʒyz sekˈsen ˈtørt"),
        ),
        (
            "createKarakalpak().text",
            &["12345"],
            Some("ˈon eˈki ˈmɯŋ ˈyʃ ˈʒyz ˈqɯrq ˈbes"),
        ),
        (
            "createKarakalpak().text",
            &["1000000"],
            Some("ˈbir milliˈon"),
        ),
        ("createKarakalpak().text", &["İshan"], Some("iˈʃɑn")),
        ("createKarakalpak().text", &["Ishan"], Some("ɯˈʃɑn")),
        (
            "normalizeKarakalpak",
            &["Ortasha jas — 31,3"],
            Some("Ortasha jas — 31 3"),
        ),
        (
            "normalizeKarakalpak",
            &["Temirjollardıń uzınlıǵı — 3,9 mıń km"],
            Some("Temirjollardıń uzınlıǵı — 3 9 mıń kilometr"),
        ),
        (
            "normalizeKarakalpak",
            &["temperaturası — 2 °C den -3 °C ge shekem"],
            Some("temperaturası — 2 gradus den minus 3 gradus ge shekem"),
        ),
        ("normalizeKarakalpak", &["19,605,052"], Some("19605052")),
        ("normalizeKarakalpak", &["1,500 km"], Some("1500 kilometr")),
        ("normalizeKarakalpak", &["18,7"], Some("18 7")),
        ("normalizeKarakalpak", &["1.65"], Some("1 65")),
        (
            "normalizeKarakalpak",
            &["198.51.100.0"],
            Some("198.51.100.0"),
        ),
        (
            "normalizeKarakalpak",
            &["26.02.1994-j."],
            Some("26.02.1994 jıl"),
        ),
        ("normalizeKarakalpak", &["96%in"], Some("96 procentin")),
        (
            "normalizeKarakalpak",
            &["50% ten 80% ke"],
            Some("50 procentten 80 procentke"),
        ),
        (
            "normalizeKarakalpak",
            &["14% i jasaydı"],
            Some("14 procenti jasaydı"),
        ),
        ("normalizeKarakalpak", &["C++ tilin"], Some("C++ tilin")),
        (
            "normalizeKarakalpak",
            &["C++11 (14882:2011)"],
            Some("C++11 (14882:2011)"),
        ),
        (
            "normalizeKarakalpak",
            &["(+40+45 °C)"],
            Some("(plyus 40 plyus 45 gradus)"),
        ),
        (
            "normalizeKarakalpak",
            &["diametri 6+90 mm"],
            Some("diametri 6+90 millimetr"),
        ),
        (
            "normalizeKarakalpak",
            &["+15+20С gradus"],
            Some("plyus 15+20С gradus"),
        ),
        (
            "normalizeKarakalpak",
            &["+15+20°С gradus"],
            Some("plyus 15 plyus 20 gradus"),
        ),
        ("normalizeKarakalpak", &["4,4°C"], Some("4 4 gradus")),
        (
            "normalizeKarakalpak",
            &["(-32-38 °C)"],
            Some("(minus 32 minus 38 gradus)"),
        ),
        (
            "normalizeKarakalpak",
            &["b.e.sh. 776-jılı"],
            Some("biziń eramızǵa shekem 776-jılı"),
        ),
        (
            "normalizeKarakalpak",
            &["21 mln. jılı"],
            Some("21 million jılı"),
        ),
        (
            "normalizeKarakalpak",
            &["23,3 mlrd. kvt/saat"],
            Some("23 3 milliard kilovatt saat"),
        ),
        (
            "normalizeKarakalpak",
            &["8 m.kv. maydan"],
            Some("8 kvadrat metr maydan"),
        ),
        (
            "normalizeKarakalpak",
            &["23,2 adam/1 km kv"],
            Some("23 2 adam/1 kvadrat kilometr"),
        ),
        (
            "normalizeKarakalpak",
            &["Suyıqlanıw t-rası 323°"],
            Some("Suyıqlanıw temperaturası 323 gradus "),
        ),
        (
            "normalizeKarakalpak",
            &["saat 8:00 de"],
            Some("saat 8 00 de"),
        ),
        (
            "normalizeKarakalpak",
            &["saat 12:13:05 de"],
            Some("saat 12 13 05 de"),
        ),
        (
            "normalizeKarakalpak",
            &["ISO/IEC 14882:2024"],
            Some("ISO/IEC 14882:2024"),
        ),
        (
            "phonemize",
            &["$100,000 investiciyası", "kaa"],
            Some("ˈʒyz ˈmɯŋ dolˈlɑr investikijɑˈsɯ"),
        ),
        (
            "phonemize",
            &["150 mm ge shekem", "kaa"],
            Some("ˈʒyz eˈliw milliˈmetr ˈɡe ʃeˈkem"),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_karakalpak().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeKarakalpak" => Some(e.normalize(&a(0))),
                "createKarakalpak().text" => Some(e.text(&a(0))),
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
