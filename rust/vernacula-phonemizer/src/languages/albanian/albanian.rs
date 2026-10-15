//! Albanian (sq) phonemizer: a longest-first digraph + grapheme scan, penultimate stress placed before its maximal
//! onset, and text() over words, numbers and clause punctuation.
//! Ported from src/languages/albanian/albanian.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::{normalize_albanian, try_symbols};
use super::numbers::{AlbanianNumbers, NumberToWords, make_number_to_words};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::ipa::is_ipa_vowel;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::load_manifest::load_manifest;
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/albanian";

/// `AlbanianDef`: declared in albanian.ts itself, as here. Every field is REQUIRED.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlbanianDef {
    pub digraphs: IndexMap<String, String>,
    pub graphemes: IndexMap<String, String>,
    pub nasals: Vec<String>,
    pub sibilants: Vec<String>,
    pub numbers: AlbanianNumbers,
    pub clause_punctuation: IndexMap<String, String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_def() -> Result<&'static AlbanianDef, String> {
    static M: OnceLock<AlbanianDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "albanian.jsonc").map_err(|e| e.to_string())
    })
}

/// ⚠ Reached only through a checked path (an `AlbanianPhonemizer`, whose constructor loads it).
static DEF: LazyLock<&'static AlbanianDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

/// `ORDER`: the digraph keys longest first (a stable sort).
static ORDER: LazyLock<Vec<(JsString, JsString)>> = LazyLock::new(|| {
    let mut keys: Vec<(JsString, JsString)> =
        DEF.digraphs.iter().map(|(k, v)| (js(k), js(v))).collect();
    keys.sort_by_key(|(k, _)| std::cmp::Reverse(k.len()));
    keys
});
static SIBILANT: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| DEF.sibilants.iter().map(|x| js(x)).collect());
static NASAL: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| DEF.nasals.iter().map(|x| js(x)).collect());

/// `VOWEL.has(seg)`: the shared IPA vowel set, whose members are single characters.
fn is_vowel(seg: &JsString) -> bool {
    seg.len() == 1 && is_ipa_vowel(seg.0[0])
}

fn sonority(seg: &JsString) -> u8 {
    let s = seg.to_string_lossy();
    if is_vowel(seg) {
        return 6;
    }
    if s == "j" || s == "w" {
        return 5;
    }
    if ["l", "ɫ", "r", "ɾ"].contains(&s.as_str()) {
        return 4;
    }
    if NASAL.contains(seg) {
        return 3;
    }
    if seg.includes(&js("͡")) {
        return 1;
    }
    if ["f", "v", "s", "z", "ʃ", "ʒ", "θ", "ð", "h"].contains(&s.as_str()) {
        return 2;
    }
    0
}

/// `phonemizeWord(word)`: NFC, lowercase, scanned by CODE UNIT; stress before the penult's maximal onset.
pub fn phonemize_word(word: &JsString) -> JsString {
    let w = normalize(word, Form::Nfc).to_lower_case();
    let mut segs: Vec<JsString> = Vec::new();
    let mut i = 0;
    'outer: while i < w.len() {
        let rest = w.slice(i as isize, None);
        for (key, ph) in ORDER.iter() {
            if rest.starts_with(key) {
                segs.push(ph.clone());
                i += key.len();
                continue 'outer;
            }
        }
        let c = w.char_at(i);
        let ph = DEF
            .graphemes
            .get(&c.to_string_lossy())
            .map(|p| js(p))
            .or_else(|| {
                latin_phone(
                    &c,
                    PhoneOpts {
                        initial: i == 0,
                        include_h: false,
                    },
                )
            });
        if let Some(ph) = ph {
            segs.push(ph);
        }
        i += 1;
    }
    let vidx: Vec<usize> = (0..segs.len()).filter(|&k| is_vowel(&segs[k])).collect();
    if !vidx.is_empty() {
        let nucleus = if vidx.len() >= 2 {
            vidx[vidx.len() - 2]
        } else {
            vidx[0]
        };
        let mut at = nucleus;
        while at > 0 && !is_vowel(&segs[at - 1]) {
            let (p, l) = (&segs[at - 1], &segs[at]);
            let td_l = (*p == "t" || *p == "d") && (*l == "l" || *l == "ɫ");
            let rising = sonority(p) < sonority(l) && !td_l;
            let sibilant = SIBILANT.contains(p) && sonority(l) <= 2;
            let nasal = NASAL.contains(p) && sonority(l) <= 1;
            if !(rising || sibilant || nasal) {
                break;
            }
            at -= 1;
        }
        segs.insert(at, js("ˈ"));
    }
    normalize(&JsString::join(&segs, &JsString::new()), Form::Nfc)
}

/// `numberToWords`: the renderer over this manifest's numeral table.
static NUMBER_TO_WORDS: LazyLock<NumberToWords> =
    LazyLock::new(|| make_number_to_words(&DEF.numbers));

/// `numberToWords(n, raw?)`.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    NUMBER_TO_WORDS.call(n, raw)
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.!?…,;:])", *LATIN_RUN), "giu").unwrap());

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: Albanian's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser("[a-zçëA-ZÇË]", "iu")));

/// The Albanian engine (`createAlbanian`).
pub struct AlbanianPhonemizer;

/// The module functions, exposed through the engine: holding one proves the manifest and the symbol tier loaded.
impl AlbanianPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_albanian(text)
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
        let normalized = normalize_albanian(input);
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
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
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for AlbanianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(AlbanianPhonemizer::text(self, input))
    }
}

/// `createAlbanian()`: loads the manifest and the symbol tier, or says which failed.
pub fn create_albanian() -> Result<AlbanianPhonemizer, String> {
    try_def()?;
    try_symbols()?;
    Ok(AlbanianPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/albanian.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["dhe"], Some("ˈðɛ")),
        ("phonemizeWord", &["thikë"], Some("ˈθikə")),
        ("phonemizeWord", &["xhaxha"], Some("ˈd͡ʒad͡ʒa")),
        ("phonemizeWord", &["gjuha"], Some("ˈɟuha")),
        ("phonemizeWord", &["shqip"], Some("ˈʃcip")),
        ("phonemizeWord", &["rrugë"], Some("ˈruɡə")),
        ("phonemizeWord", &["llullë"], Some("ˈɫuɫə")),
        ("phonemizeWord", &["çaj"], Some("ˈt͡ʃaj")),
        ("phonemizeWord", &["xixë"], Some("ˈd͡zid͡zə")),
        ("phonemizeWord", &["gjysh"], Some("ˈɟyʃ")),
        ("phonemizeWord", &["ëmbël"], Some("ˈəmbəl")),
        ("phonemizeWord", &["Shqipëri"], Some("ʃciˈpəɾi")),
        ("phonemizeWord", &["qumësht"], Some("ˈcuməʃt")),
        ("phonemizeWord", &["flamur"], Some("ˈflamuɾ")),
        ("phonemizeWord", &["vendlindja"], Some("vɛndˈlindja")),
        ("numberToWords", &["0"], Some("zero")),
        ("numberToWords", &["1"], Some("një")),
        ("numberToWords", &["3"], Some("tre")),
        ("numberToWords", &["4"], Some("katër")),
        ("numberToWords", &["10"], Some("dhjetë")),
        ("numberToWords", &["11"], Some("njëmbëdhjetë")),
        ("numberToWords", &["13"], Some("trembëdhjetë")),
        ("numberToWords", &["20"], Some("njëzet")),
        ("numberToWords", &["21"], Some("njëzet e një")),
        ("numberToWords", &["30"], Some("tridhjetë")),
        ("numberToWords", &["40"], Some("dyzet")),
        ("numberToWords", &["42"], Some("dyzet e dy")),
        ("numberToWords", &["99"], Some("nëntëdhjetë e nëntë")),
        ("numberToWords", &["100"], Some("njëqind")),
        ("numberToWords", &["101"], Some("njëqind e një")),
        ("numberToWords", &["300"], Some("treqind")),
        (
            "numberToWords",
            &["555"],
            Some("pesëqind e pesëdhjetë e pesë"),
        ),
        ("numberToWords", &["1000"], Some("një mijë")),
        ("numberToWords", &["1001"], Some("një mijë e një")),
        ("numberToWords", &["2000"], Some("dy mijë")),
        (
            "numberToWords",
            &["12345"],
            Some("dymbëdhjetë mijë e treqind e dyzet e pesë"),
        ),
        ("numberToWords", &["1000000"], Some("një milion")),
        ("numberToWords", &["2000000"], Some("dy milionë")),
        ("numberToWords", &["1000000000"], Some("një miliard")),
        ("phonemize", &["21", "sq"], Some("ˈɲəzɛt ˈɛ ˈɲə")),
        ("phonemize", &["1000000", "sq"], Some("ˈɲə miˈlion")),
        (
            "phonemize",
            &["110,994 kilometra", "sq"],
            Some("ˈɲəcind ˈɛ ˈðjɛtə ˈmijə ˈɛ nəˈntəcind ˈɛ nəntəˈðjɛtə ˈɛ ˈkatəɾ kiloˈmɛtɾa"),
        ),
        (
            "phonemize",
            &["300.000 vjet", "sq"],
            Some("ˈtɾɛcind ˈmijə ˈvjɛt"),
        ),
        ("phonemize", &["20 000", "sq"], Some("ˈɲəzɛt ˈmijə")),
        (
            "phonemize",
            &["41.33", "sq"],
            Some("ˈdyzɛt ˈɛ ˈɲə ˈpɾɛsja tɾiˈðjɛtə ˈɛ ˈtɾɛ"),
        ),
        (
            "phonemize",
            &["38,3", "sq"],
            Some("tɾiˈðjɛtə ˈɛ ˈtɛtə ˈpɾɛsja ˈtɾɛ"),
        ),
        ("phonemize", &["50 000.", "sq"], Some("pɛsəˈðjɛtə ˈmijə .")),
        (
            "phonemize",
            &["1,110.03 km²", "sq"],
            Some("ˈɲə ˈmijə ˈɛ ˈɲəcind ˈɛ ˈðjɛtə ˈpɾɛsja ˈzɛɾo ˈtɾɛ kiloˈmɛtɾa kaˈtɾoɾə"),
        ),
        (
            "phonemize",
            &["30.04.1993", "sq"],
            Some("tɾiˈðjɛtə . ˈkatəɾ . ˈɲə ˈmijə ˈɛ nəˈntəcind ˈɛ nəntəˈðjɛtə ˈɛ ˈtɾɛ"),
        ),
        (
            "phonemize",
            &["-38,3 °C", "sq"],
            Some("ˈminus tɾiˈðjɛtə ˈɛ ˈtɛtə ˈpɾɛsja ˈtɾɛ ˈɡɾadə t͡sɛlˈsius"),
        ),
        (
            "phonemize",
            &["+7° Celsius", "sq"],
            Some("ˈplus ˈʃtatə ˈɡɾadə t͡sɛlˈsius"),
        ),
        (
            "phonemize",
            &["75 %", "sq"],
            Some("ʃtatəˈðjɛtə ˈɛ ˈpɛsə ˈpəɾ ˈcind"),
        ),
        (
            "phonemize",
            &["25 cm", "sq"],
            Some("ˈɲəzɛt ˈɛ ˈpɛsə t͡sɛntiˈmɛtɾa"),
        ),
        ("phonemize", &["€2", "sq"], Some("ˈdy ɛˈuɾo")),
        (
            "phonemize",
            &["45-55°", "sq"],
            Some("ˈdyzɛt ˈɛ ˈpɛsə ˈdɛɾi pɛsəˈðjɛtə ˈɛ ˈpɛsə ˈɡɾadə"),
        ),
        (
            "phonemize",
            &["349,223 km2", "sq"],
            Some(
                "ˈtɾɛcind ˈɛ ˈdyzɛt ˈɛ ˈnəntə ˈmijə ˈɛ ˈdycind ˈɛ ˈɲəzɛt ˈɛ ˈtɾɛ kiloˈmɛtɾa kaˈtɾoɾə",
            ),
        ),
        (
            "phonemize",
            &["999 ‰ ar", "sq"],
            Some("nəˈntəcind ˈɛ nəntəˈðjɛtə ˈɛ ˈnəntə ˈpəɾ ˈmijə ˈaɾ"),
        ),
        (
            "phonemize",
            &["5.09", "sq"],
            Some("ˈpɛsə ˈpɾɛsja ˈzɛɾo ˈnəntə"),
        ),
        ("phonemize", &["5.9", "sq"], Some("ˈpɛsə ˈpɾɛsja ˈnəntə")),
        (
            "phonemize",
            &["0,375", "sq"],
            Some("ˈzɛɾo ˈpɾɛsja ˈtɾɛcind ˈɛ ʃtatəˈðjɛtə ˈɛ ˈpɛsə"),
        ),
        (
            "phonemize",
            &["p = 0,001", "sq"],
            Some("p baˈɾabaɾt ˈzɛɾo ˈpɾɛsja ˈzɛɾo ˈzɛɾo ˈɲə"),
        ),
        (
            "phonemize",
            &["0.500 g", "sq"],
            Some("ˈzɛɾo ˈpɾɛsja pɛˈsəcind ɡ"),
        ),
        (
            "phonemize",
            &["3.14159", "sq"],
            Some("ˈtɾɛ ˈpɾɛsja katəɾmbəˈðjɛtə ˈmijə ˈɛ ˈɲəcind ˈɛ pɛsəˈðjɛtə ˈɛ ˈnəntə"),
        ),
        (
            "phonemize",
            &["32MB", "sq"],
            Some("tɾiˈðjɛtə ˈɛ ˈdy mɛˈɡabajt"),
        ),
        (
            "phonemize",
            &["714 MHz", "sq"],
            Some("ʃtaˈtəcind ˈɛ katəɾmbəˈðjɛtə mɛˈɡahɛɾt͡s"),
        ),
        (
            "phonemize",
            &["+ 24° Celsius", "sq"],
            Some("ˈplus ˈɲəzɛt ˈɛ ˈkatəɾ ˈɡɾadə t͡sɛlˈsius"),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_albanian().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "numberToWords" => Some(e.number_to_words(js_number(&a(0)), None)),
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
