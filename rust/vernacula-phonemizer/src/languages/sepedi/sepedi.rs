//! Sepedi (nso) phonemizer: a greedy longest-match scan over the grapheme table (a missed letter read through the
//! shared Latin phones), and text() over words, numbers and clause punctuation (the normalizer owns the symbol tier).
//! Ported from src/languages/sepedi/sepedi.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use super::normalize::{normalize_sepedi, try_symbols};
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

/// `SepediDef`: this module's own slice of sepedi.jsonc, as in the TS.
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct SepediDef {
    pub graphemes: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
}

pub fn try_def() -> Result<&'static SepediDef, String> {
    static M: OnceLock<SepediDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "sepedi.jsonc").map_err(|e| e.to_string())
    })
}

static DEF: LazyLock<&'static SepediDef> =
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
/// `nat`: Sepedi's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser("[a-zšêô]", "iu")));

/// The Sepedi engine (`createSepedi`).
pub struct SepediPhonemizer;

/// The module functions, exposed through the engine: holding a `SepediPhonemizer` proves the manifest slices and
/// the symbol tier loaded. (The per-module differentials call them.)
impl SepediPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_sepedi(text)
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
        assemble_clauses(&normalize_sepedi(input), &TOKEN, |m, s, sink| {
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

impl Engine for SepediPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(SepediPhonemizer::text(self, input))
    }
}

/// `createSepedi()`: loads the manifest slices and the symbol tier, or says which failed.
pub fn create_sepedi() -> Result<SepediPhonemizer, String> {
    try_def()?;
    try_numbers()?;
    try_symbols()?;
    Ok(SepediPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/sepedi.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["kgoši"], Some("kxoʃi")),
    ("phonemizeWord", &["mošomo"], Some("moʃomo")),
    ("phonemizeWord", &["hlogo"], Some("ɬoxo")),
    ("phonemizeWord", &["batho"], Some("batʰo")),
    ("phonemizeWord", &["sepedi"], Some("sepʼedi")),
    ("numberToWords", &["0"], Some("lefeela")),
    ("numberToWords", &["1"], Some("tee")),
    ("numberToWords", &["7"], Some("šupa")),
    ("numberToWords", &["8"], Some("seswai")),
    ("numberToWords", &["9"], Some("senyane")),
    ("numberToWords", &["10"], Some("lesome")),
    ("numberToWords", &["11"], Some("lesometee")),
    ("numberToWords", &["20"], Some("masomepedi")),
    ("numberToWords", &["21"], Some("masomepedi tee")),
    ("numberToWords", &["90"], Some("masomesenyane")),
    ("numberToWords", &["100"], Some("lekgolo")),
    ("numberToWords", &["200"], Some("makgolopedi")),
    ("numberToWords", &["555"], Some("makgolohlano le masomehlano hlano")),
    ("numberToWords", &["1000"], Some("sekete")),
    ("numberToWords", &["2000"], Some("dikete tše pedi")),
    ("numberToWords", &["12345"], Some("dikete lesomepedi le makgolotharo le masomenne hlano")),
    ("numberToWords", &["1000000"], Some("milione")),
    ("numberToWords", &["1000000000"], Some("bilione")),
    ("phonemize", &["21", "nso"], Some("masomepʼedi tʼee")),
    ("phonemize", &["200", "nso"], Some("makxolopʼedi")),
    ("normalizeSepedi", &["3%"], Some("diperesente tše 3")),
    ("normalizeSepedi", &["40% ya badudi"], Some("diperesente tše 40 ya badudi")),
    ("normalizeSepedi", &["1%"], Some("peresente ye 1")),
    ("normalizeSepedi", &["61.9%"], Some("diperesente tše 61 9")),
    ("normalizeSepedi", &["$450 milione"], Some("ditolara tše milione 450")),
    ("normalizeSepedi", &["R6.4 bilione"], Some("diranta tše bilione 6 4")),
    ("normalizeSepedi", &["R50,000"], Some("diranta tše 50000")),
    ("normalizeSepedi", &["ditsela tše pedi, e lego R37 le R555"], Some("ditsela tše pedi, e lego R37 le R555")),
    ("normalizeSepedi", &["£10 million"], Some("£10 million")),
    ("normalizeSepedi", &["200 km borwa"], Some("dikhilomithara tše 200 borwa")),
    ("normalizeSepedi", &["1200 kg"], Some("dikhilograma tše 1200")),
    ("normalizeSepedi", &["50 cm"], Some("senthimetara 50")),
    ("normalizeSepedi", &["60 mm"], Some("dimilimithara tše 60")),
    ("normalizeSepedi", &["5.2 m"], Some("dimithara tše 5 2")),
    ("normalizeSepedi", &["1 kg"], Some("dikhilograma 1")),
    ("normalizeSepedi", &["km"], Some("dikhilomithara")),
    ("normalizeSepedi", &["108 km/h"], Some("dikhilomithara tše 108 ka iri")),
    ("normalizeSepedi", &["30 m/s"], Some("dimithara tše 30 ka motsotswana")),
    ("normalizeSepedi", &["221,6 km²"], Some("disekwere-khilomithara tše 221 6")),
    ("normalizeSepedi", &["361 km2"], Some("disekwere-khilomithara tše 361")),
    ("normalizeSepedi", &["5 m³"], Some("5 m³")),
    ("normalizeSepedi", &["5 cm²"], Some("5 cm²")),
    ("normalizeSepedi", &["802.11m"], Some("802 1 1m")),
    ("normalizeSepedi", &["802.11n"], Some("802 1 1n")),
    ("normalizeSepedi", &["1.2 °C"], Some("1 2 Celsius")),
    ("normalizeSepedi", &["1.02º Celsius"], Some("1 0 2 Celsius")),
    ("normalizeSepedi", &["85°F"], Some("85")),
    ("normalizeSepedi", &["55°S"], Some("55 borwa")),
    ("normalizeSepedi", &["90°"], Some("90")),
    ("normalizeSepedi", &["1901–2012"], Some("1901 go ya go 2012")),
    ("normalizeSepedi", &["5–8 senthimetara"], Some("5 go ya go 8 senthimetara")),
    ("normalizeSepedi", &["33,500–32,500 BP"], Some("33500 go ya go 32500 BP")),
    ("normalizeSepedi", &["1876-77"], Some("1876-77")),
    ("normalizeSepedi", &["ISO 3166-1"], Some("ISO 3166-1")),
    ("normalizeSepedi", &["1970 - 1969 - 1968"], Some("1970 - 1969 - 1968")),
    ("normalizeSepedi", &["nakong ya 1901–2012."], Some("nakong ya 1901 go ya go 2012.")),
    ("normalizeSepedi", &["magareng ga 1950–2020,"], Some("magareng ga 1950 go ya go 2020,")),
    ("normalizeSepedi", &["mengwaga ye 25–34."], Some("mengwaga ye 25 go ya go 34.")),
    ("normalizeSepedi", &["9.84-9.90"], Some("9 8 4-9 9 0")),
    ("normalizeSepedi", &["ISO 3166-1."], Some("ISO 3166-1.")),
    ("normalizeSepedi", &["1970 - 1969 - 1968."], Some("1970 - 1969 - 1968.")),
    ("normalizeSepedi", &["1,600,000"], Some("1600000")),
    ("normalizeSepedi", &["216.061 badudi"], Some("216061 badudi")),
    ("normalizeSepedi", &["30 560 860"], Some("30560860")),
    ("normalizeSepedi", &["9.84"], Some("9 8 4")),
    ("normalizeSepedi", &["221,6"], Some("221 6")),
    ("normalizeSepedi", &["(1,2,3,4,5,6)"], Some("(1,2,3,4,5,6)")),
    ("normalizeSepedi", &["Verster T.L."], Some("Verster T-L.")),
    ("normalizeSepedi", &["P.H. Nortjé"], Some("P-H Nortjé")),
    ("normalizeSepedi", &["3,500 B.C.E. kua Korea"], Some("3500 B-C-E kua Korea")),
    ("normalizeSepedi", &["Mail & Guardian"], Some("Mail le Guardian")),
    ("normalizeSepedi", &["R&B"], Some("R le B")),
    ("normalizeSepedi", &["Ngwagakgolo wa lesome senyane (19th)"], Some("Ngwagakgolo wa lesome senyane (19)")),
    ("phonemize", &["1200 kg", "nso"], Some("dikʰiloxrama t͡ʃʼe sekʼetʼe le makxolopʼedi")),
    ("phonemize", &["50 cm", "nso"], Some("sentʰimetʼara masomeɬano")),
    ("phonemize", &["108 km/h", "nso"], Some("dikʰilomitʰara t͡ʃʼe lekxolo le seswai kʼa iri")),
    ("phonemize", &["40%", "nso"], Some("dipʼeresentʼe t͡ʃʼe masomenne")),
    ("phonemize", &["Ka 8:46 mesong thwii setu", "nso"], Some("kʼa seswai masomenne t͡sʰela mesoŋ tʰwii setʼu")),
    ("phonemize", &["mollo ka 11:35 pm.", "nso"], Some("mollo kʼa lesometʼee masometʰaro ɬano pʼm .")),
    ("normalizeSepedi", &["Ka 11:20, maphodisa"], Some("Ka 11 20, maphodisa")),
    ("phonemize", &["Ka 8:46 mesong", "nso"], Some("kʼa seswai masomenne t͡sʰela mesoŋ")),
    ("phonemize", &["0-14: 40.8%", "nso"], Some("lefeela xo ja xo lesomenne , dipʼeresentʼe t͡ʃʼe masomenne seswai")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_sepedi().unwrap();
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
                "normalizeSepedi" => e.normalize(&js(args[0])).to_string_lossy(),
                "phonemize" => crate::phonemize(args[0], args[1]).unwrap(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            count += 1;
        }
        assert_eq!(count, 87);
    }
}
