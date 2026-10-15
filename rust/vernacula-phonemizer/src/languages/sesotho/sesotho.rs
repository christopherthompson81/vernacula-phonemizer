//! Sesotho (st) phonemizer: a greedy longest-match scan over the grapheme table (a missed letter read through the
//! shared Latin phones), and text() over words, numbers and clause punctuation (the normalizer owns the symbol tier).
//! Ported from src/languages/sesotho/sesotho.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::{normalize_sesotho, try_symbols};
use super::numbers::{DIR, number_to_words, try_numbers};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::sorted_by_length_desc;
use crate::registry::{Engine, PhonemizeError};

/// `SesothoDef`: this module's own slice of sesotho.jsonc, as in the TS.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SesothoDef {
    pub graphemes: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
}

pub fn try_def() -> Result<&'static SesothoDef, String> {
    static M: OnceLock<SesothoDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "sesotho.jsonc").map_err(|e| e.to_string())
    })
}

static DEF: LazyLock<&'static SesothoDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

/// `KEYS`: the grapheme keys, longest first (a stable sort, as `Array.prototype.sort`), with their IPA.
static KEYS: LazyLock<Vec<(JsString, JsString)>> = LazyLock::new(|| {
    sorted_by_length_desc(DEF.graphemes.keys().map(|k| js(k)))
        .into_iter()
        .map(|k| {
            let v = js(&DEF.graphemes[&k.to_string_lossy()]);
            (k, v)
        })
        .collect()
});

/// `phonemizeWord(word)`: segmental IPA; a letter with no grapheme rule goes through `latinPhone`.
pub fn phonemize_word(word: &JsString) -> JsString {
    let w = word.to_lower_case();
    let mut out = JsString::new();
    let mut i = 0;
    while i < w.len() {
        if let Some((key, ipa)) = KEYS.iter().find(|(k, _)| w.0[i..].starts_with(&k.0)) {
            out.push_str(ipa);
            i += key.len();
        } else {
            let opts = PhoneOpts {
                initial: i == 0,
                include_h: true,
            };
            if let Some(p) = latin_phone(&w.char_at(i), opts) {
                out.push_str(&p);
            }
            i += 1;
        }
    }
    out
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.!?…,;:])", *LATIN_RUN), "giu").unwrap());

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: Sesotho's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser("[a-zšêô]", "iu")));

/// The Sesotho engine (`createSesotho`).
pub struct SesothoPhonemizer;

/// The module functions, exposed through the engine: holding a `SesothoPhonemizer` proves the manifest slices and
/// the symbol tier loaded. (The per-module differentials call them.)
impl SesothoPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_sesotho(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        try_symbols().unwrap_or_else(|e| panic!("{e}")).apply(text)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        assemble_clauses(&normalize_sesotho(input), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(n) = m.group(2, s) {
                for wd in number_to_words(js_number(&n), Some(&n)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = m.group(3, s)
                && let Some(mk) = DEF
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|v| !v.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for SesothoPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(SesothoPhonemizer::text(self, input))
    }
}

/// `createSesotho()`: loads the manifest slices and the symbol tier, or says which failed.
pub fn create_sesotho() -> Result<SesothoPhonemizer, String> {
    try_def()?;
    try_numbers()?;
    try_symbols()?;
    Ok(SesothoPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/sesotho.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["phuputso"], Some("pʰupʼut͡sʼɔ")),
    ("phonemizeWord", &["lehlohonolo"], Some("lɛɬɔɦɔnɔlɔ")),
    ("phonemizeWord", &["kgotso"], Some("kχɔt͡sʼɔ")),
    ("phonemizeWord", &["ntate"], Some("ntʼɑtʼɛ")),
    ("numberToWords", &["0"], Some("lefeela")),
    ("numberToWords", &["7"], Some("supa")),
    ("numberToWords", &["9"], Some("robong")),
    ("numberToWords", &["11"], Some("leshome le motso o le mong")),
    ("numberToWords", &["12"], Some("leshome le metso e mmedi")),
    ("numberToWords", &["21"], Some("mashome a mabedi le motso o le mong")),
    ("numberToWords", &["42"], Some("mashome a mane le metso e mmedi")),
    ("numberToWords", &["100"], Some("lekgolo")),
    ("numberToWords", &["300"], Some("makgolo a mararo")),
    ("numberToWords", &["555"], Some("makgolo a mahlano le mashome a mahlano le metso e mehlano")),
    ("numberToWords", &["1000"], Some("sekete")),
    ("numberToWords", &["2000"], Some("dikete tse pedi")),
    ("numberToWords", &["1000000"], Some("milione")),
    ("numberToWords", &["1000000000"], Some("bilione")),
    ("phonemize", &["21", "st"], Some("mɑʃɔmɛ ɑ mɑbɛdi lɛ mɔt͡sʼɔ ɔ lɛ mɔŋ")),
    ("phonemize", &["1000", "st"], Some("sɛkʼɛtʼɛ")),
    ("normalizeSesotho", &["50%"], Some("diperesente tse 50")),
    ("normalizeSesotho", &["$675"], Some("didolara tse 675")),
    ("normalizeSesotho", &["R470 bilione"], Some("diranta tse bilione tse 470")),
    ("normalizeSesotho", &["£15,500"], Some("diponto tse 15500")),
    ("normalizeSesotho", &["US$100 milione"], Some("didolara tsa Amerika tse milione tse 100")),
    ("normalizeSesotho", &["diperesente tse 1.5%"], Some("diperesente tse 1 5")),
    ("normalizeSesotho", &["liporesente tse 25%"], Some("liporesente tse 25")),
    ("normalizeSesotho", &["diphesente tse 35"], Some("diphesente tse 35")),
    ("normalizeSesotho", &["12 km"], Some("dikhilomithara tse 12")),
    ("normalizeSesotho", &["1,395 m"], Some("dimithara tse 1395")),
    ("normalizeSesotho", &["50 kg"], Some("dikhilograma tse 50")),
    ("phonemize", &["50 kg", "st"], Some("dikʰilɔxrɑmɑ t͡sʼɛ mɑʃɔmɛ ɑ mɑɬɑnɔ")),
    ("normalizeSesotho", &["603 628 km²"], Some("disekwere dikhilomithara tse 603628")),
    ("normalizeSesotho", &["632,702 km2"], Some("disekwere dikhilomithara tse 632702")),
    ("normalizeSesotho", &["37,99 km²"], Some("disekwere dikhilomithara tse 37 9 9")),
    ("normalizeSesotho", &["0-100 km/h"], Some("0 ho isa ho dikhilomithara tse 100 ka hora")),
    ("normalizeSesotho", &["10-20"], Some("10 ho isa ho 20")),
    ("normalizeSesotho", &["2016-17"], Some("2016-17")),
    ("normalizeSesotho", &["COVID-19"], Some("COVID-19")),
    ("normalizeSesotho", &["7-10."], Some("7 ho isa ho 10.")),
    ("normalizeSesotho", &["1933 - 1945."], Some("1933 ho isa ho 1945.")),
    ("normalizeSesotho", &["73–94."], Some("73 ho isa ho 94.")),
    ("normalizeSesotho", &["etsa:10.1111/1469-8219.00039"], Some("etsa:10.1111/1469-8219.00039")),
    ("normalizeSesotho", &["5-13.7"], Some("5-13 7")),
    ("normalizeSesotho", &["5-13,7"], Some("5-13 7")),
    ("normalizeSesotho", &["R2.3m"], Some("diranta tse dimilione tse 2 3")),
    ("normalizeSesotho", &["$2.5bn"], Some("didolara tse dibilione tse 2 5")),
    ("normalizeSesotho", &["1,500"], Some("1500")),
    ("normalizeSesotho", &["603 628"], Some("603628")),
    ("normalizeSesotho", &["30.01.1912"], Some("30 01 1912")),
    ("normalizeSesotho", &["32.9"], Some("32 9")),
    ("normalizeSesotho", &["*28.11.1820"], Some("*28 11 1820")),
    ("normalizeSesotho", &["Arts & Sciences"], Some("Arts le Sciences")),
    ("normalizeSesotho", &["African Union&nbsp;(AU)"], Some("African Union (AU)")),
    ("normalizeSesotho", &["Ntat&#39;a Rōna"], Some("Ntat’a Rōna")),
    ("normalizeSesotho", &["ka 4000 B.C. Li ne li entsoe"], Some("ka 4000 BC Li ne li entsoe")),
    ("normalizeSesotho", &["thomo ea May 2011 U.S. ea ho bolaea"], Some("thomo ea May 2011 US ea ho bolaea")),
    ("normalizeSesotho", &["60th"], Some("60")),
    ("normalizeSesotho", &["1st"], Some("1")),
    ("normalizeSesotho", &["64 ha ba na mosebetsi"], Some("64 ha ba na mosebetsi")),
    ("normalizeSesotho", &["1:10 Le Molimo"], Some("1:10 Le Molimo")),
    ("normalizeSesotho", &["ka nako ya 1:56.72"], Some("ka nako ya 1:56.72")),
    ("normalizeSesotho", &["ScaleMajor = unit:year increment:11000"], Some("ScaleMajor = unit:year increment:11000")),
    ("normalizeSesotho", &["32.9°C"], Some("32 9°C")),
    ("normalizeSesotho", &["12 cm"], Some("12 cm")),
    ("normalizeSesotho", &["€ 959"], Some("€ 959")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_sesotho().unwrap();
        let mut count = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => e.phonemize_word(&js(args[0])).to_string_lossy(),
                "numberToWords" => e
                    .number_to_words(
                        crate::core::js_string::js_number(&js(args[0])),
                        args.get(1).map(|r| js(r)).as_ref(),
                    )
                    .to_string_lossy(),
                "normalizeSesotho" => e.normalize(&js(args[0])).to_string_lossy(),
                "phonemize" => crate::phonemize(args[0], args[1]).unwrap(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            count += 1;
        }
        assert_eq!(count, 66);
    }
}
