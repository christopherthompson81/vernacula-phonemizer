//! Hiligaynon / Ilonggo (hil) phonemizer: the rule transliterator (trigraphs gui/gue/qui/que, digraphs, glottal
//! stops at onset, in hiatus and at an interior hyphen), penultimate stress, native cardinal numbers, and text()
//! over words, numbers and punctuation. Ported from src/languages/hiligaynon/hiligaynon.ts — see that file for
//! the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::{normalize_hiligaynon, try_symbols};
use super::numbers::{number_to_words, try_numbers};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/hiligaynon";

/// `HiligaynonDef`: hiligaynon.jsonc (declared in hiligaynon.ts). `numbers` is numbers.ts's own load.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HiligaynonDef {
    pub digraphs: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub special_words: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
}

pub fn try_manifest() -> Result<&'static HiligaynonDef, String> {
    static M: OnceLock<HiligaynonDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "hiligaynon.jsonc").map_err(|e| e.to_string())
    })
}

/// ⚠ Crate-private, reached only through a `HiligaynonPhonemizer` (whose constructor loads it).
static DEF: LazyLock<&'static HiligaynonDef> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

fn is_vowel_unit(u: u16) -> bool {
    "aeiou".encode_utf16().any(|x| x == u)
}

/// `u !== "" && VOWEL_PH.includes(u[0])`: the first code UNIT.
fn is_nucleus(u: &JsString) -> bool {
    u.units().first().is_some_and(|&x| is_vowel_unit(x))
}

/// `splitNucleus(ipa)` (#1534): a trigraph's IPA as separate consonant and vowel units when it ends in a vowel, so
/// stress and the hiatus test see the vowel.
fn split_nucleus(ipa: &str) -> Vec<JsString> {
    let u = js(ipa);
    let n = u.len();
    if n > 1 && is_vowel_unit(u.units()[n - 1]) {
        vec![u.substring(0, Some(n - 1)), u.substring(n - 1, None)]
    } else {
        vec![u]
    }
}

fn table(t: &'static IndexMap<String, String>, k: &JsString) -> Option<&'static String> {
    t.get(&k.to_string_lossy()).filter(|v| !v.is_empty())
}

/// `scan(w)`: a lowercased word → IPA units. ⚠ The three-letter lookup runs on whatever is left, so near the end
/// it is a two-letter key and still advances by THREE, as in the TS (the loop then ends either way).
fn scan(w: &JsString) -> Vec<JsString> {
    let s = w.code_point_strings();
    let empty = JsString::new();
    let at = |j: usize| s.get(j).unwrap_or(&empty);
    let mut out: Vec<JsString> = Vec::new();
    let mut i = 0;
    while i < s.len() {
        let c = &s[i];
        if *c == js("-") || *c == js("‑") {
            if !out.is_empty() && i + 1 < s.len() {
                out.push(js("ʔ"));
            }
            i += 1;
            continue;
        }
        if let Some(t) = table(&DEF.digraphs, &c.concat(at(i + 1)).concat(at(i + 2))) {
            out.extend(split_nucleus(t));
            i += 3;
            continue;
        }
        if let Some(d) = table(&DEF.digraphs, &c.concat(at(i + 1))) {
            out.push(js(d));
            i += 2;
            continue;
        }
        if c.len() == 1 && is_vowel_unit(c.units()[0]) {
            if out.last().is_none_or(is_nucleus) {
                out.push(js("ʔ"));
            }
            out.push(js(DEF
                .vowels
                .get(&c.to_string_lossy())
                .expect("every vowel letter has a reading")));
        } else if let Some(p) = table(&DEF.consonants, c) {
            out.push(js(p));
        }
        i += 1;
    }
    out
}

/// `stressed(units)`: the penultimate nucleus.
fn stressed(units: &[JsString]) -> JsString {
    let nuclei: Vec<usize> = (0..units.len())
        .filter(|&i| is_nucleus(&units[i]))
        .collect();
    if nuclei.is_empty() {
        return JsString::join(units, &JsString::new());
    }
    let idx = nuclei[nuclei.len().saturating_sub(2)];
    let mut out = JsString::new();
    for (i, u) in units.iter().enumerate() {
        if i == idx {
            out.push_str(&js("ˈ"));
        }
        out.push_str(u);
    }
    out
}

/// `phonemizeWord(word)`.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let lw = word.to_lower_case();
    let units = match DEF.special_words.get(&lw.to_string_lossy()) {
        Some(special) => scan(&js(special)),
        None => scan(&lw),
    };
    if units.is_empty() {
        return JsString::new();
    }
    normalize(&stressed(&units), Form::Nfc)
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"({})|(\d+)|([.?!,;:])",
            host_word_run(&["Latin"], "'ʼ-", "").unwrap()
        ),
        "giu",
    )
    .unwrap()
});

const NATIVE_CLASS: &str = "[a-zñ'ʼ-]";
type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "iu")));

/// The Hiligaynon engine (`createHiligaynon`).
pub struct HiligaynonPhonemizer;

impl HiligaynonPhonemizer {
    /// `normalizeHiligaynon(text)` (normalize.ts).
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_hiligaynon(text)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `numberToWords(n, raw)` (numbers.ts).
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        assemble_clauses(&normalize_hiligaynon(input), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                for wd in number_to_words(js_number(&d), Some(&d)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) = table(&DEF.clause_punctuation, &p)
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for HiligaynonPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(HiligaynonPhonemizer::text(self, input))
    }
}

/// `createHiligaynon()`. Errors when the manifest cannot be loaded or the symbol tier refuses its data.
pub fn create_hiligaynon() -> Result<HiligaynonPhonemizer, String> {
    try_manifest()?;
    try_numbers()?;
    try_symbols()?;
    Ok(HiligaynonPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // test/hiligaynon.test.ts's literal pins, extracted from that file mechanically (.probe/pins.mjs evaluates
    // each string literal; no reading was typed by hand), so the two engines are held to one list.
    const PHONEMIZEWORD_1_PINS: &[(&str, &str)] = &[
        ("anak", "ʔˈanak"),
        ("daan", "dˈaʔan"),
        ("mango", "mˈaŋo"),
        ("balay", "bˈalaj"),
        ("Bermejo", "beɾmˈeho"),
        ("Demafeliz", "demapˈelis"),
        ("kalibutan", "kalibˈutan"),
        ("ginhawa", "ɡinhˈawa"),
    ];
    const SAY_N_PINS: &[(f64, &str)] = &[
        (0.0, "sˈeɾo"),
        (5.0, "lˈima"),
        (20.0, "kaluhˈaʔan"),
        (40.0, "kapʔˈatan"),
        (11.0, "napˈulo kˈaɡ ʔˈisa"),
        (25.0, "kaluhˈaʔan kˈaɡ lˈima"),
        (99.0, "kasijˈaman kˈaɡ sˈijam"),
        (100.0, "ʔˈisa kˈa ɡˈatos"),
        (555.0, "lˈima kˈa ɡˈatos kˈaɡ kalˈimʔan kˈaɡ lˈima"),
        (1000.0, "ʔˈisa kˈa lˈibo"),
        (1000000.0, "ʔˈisa kˈa mˈiljon"),
    ];
    const SAY_PINS: &[(&str, &str)] = &[
        (
            "populasyon nga 14,473",
            "populˈasjon ŋˈa napˈulo kˈaɡ ʔˈapat kˈa lˈibo kˈaɡ ʔˈapat kˈa ɡˈatos kˈaɡ kapitˈuʔan kˈaɡ tˈatlo",
        ),
        (
            "May 302.18 kilometro",
            "mˈaj tˈatlo kˈa ɡˈatos kˈaɡ dˈuha pˈunto ʔˈisa wˈalo kilomˈetɾo",
        ),
        (
            "1,821.42",
            "ʔˈisa kˈa lˈibo kˈaɡ wˈalo kˈa ɡˈatos kˈaɡ kaluhˈaʔan kˈaɡ ʔˈisa pˈunto ʔˈapat dˈuha",
        ),
        (
            "1910-1912",
            "ʔˈisa kˈa lˈibo kˈaɡ sˈijam kˈa ɡˈatos kˈaɡ napˈulo hˈasta ʔˈisa kˈa lˈibo kˈaɡ sˈijam kˈa ɡˈatos kˈaɡ napˈulo kˈaɡ dˈuha",
        ),
        (
            "3.5–3.8 bilyon",
            "tˈatlo pˈunto lˈima hˈasta tˈatlo pˈunto wˈalo bˈiljon",
        ),
        ("59%", "kalˈimʔan kˈaɡ sˈijam poɾsijˈento"),
        ("₱5", "lˈima pˈiso"),
        (
            "12,706 km²",
            "napˈulo kˈaɡ dˈuha kˈa lˈibo kˈaɡ pˈito kˈa ɡˈatos kˈaɡ ʔˈanum kilomˈetɾo kwadɾˈado",
        ),
        (
            "949 km2",
            "sˈijam kˈa ɡˈatos kˈaɡ kapʔˈatan kˈaɡ sˈijam kilomˈetɾo kwadɾˈado",
        ),
        (
            "120 km/h",
            "ʔˈisa kˈa ɡˈatos kˈaɡ kaluhˈaʔan kilomˈetɾo kˈada ʔˈoɾas",
        ),
        ("sa alas-5:00 sang aga", "sˈa ʔˈalas lˈima sˈaŋ ʔˈaɡa"),
        ("alas 9:30", "ʔˈalas sˈijam kˈaɡ katlˈoʔan"),
        ("Dr. Jose", "dˈoktoɾ hˈose"),
        ("Fr. Tomas", "pˈadɾe tˈomas"),
        ("Panay.", "pˈanaj ."),
        ("ika-19 nga siglo", "ʔˈika napˈulo kˈaɡ sˈijam ŋˈa sˈiɡlo"),
        ("ika-5ng Gobernador", "ʔˈika lˈima ŋˈa ɡobeɾnˈadoɾ"),
        (
            "Ang kada barangay may mga purok kag ang iban",
            "ʔˈaŋ kˈada baɾˈaŋaj mˈaj mˈaŋa pˈuɾok kˈaɡ ʔˈaŋ ʔˈiban",
        ),
        ("sa tunga sang mga atomo", "sˈa tˈuŋa sˈaŋ mˈaŋa ʔatˈomo"),
        (
            "Pila ka mga paktorya sg panit",
            "pˈila kˈa mˈaŋa paktˈoɾja sˈaŋ pˈanit",
        ),
    ];
    const CONTAINS_PINS: &[(&str, &str)] =
        &[("ISO 20715:2023", ","), ("sa edad sg 25 años", "sˈaŋ")];
    const NOTCONTAINS_PINS: &[(&str, &str)] = &[
        ("17.865 ka pumuluyo", "pˈunto"),
        ("2016 hasta 2022", "hˈasta hˈasta"),
        ("802.11m", "mˈetɾo"),
        ("zh-sg:814", "sˈaŋ"),
        ("http://a.sg/x", "sˈaŋ"),
    ];
    const REL_PINS: &[(&str, &str)] = &[("Republika sg Pilipinas", "Republika sang Pilipinas")];

    #[test]
    fn the_ts_suite_pins_hold() {
        let hil = create_hiligaynon().unwrap();
        // The suite's `say`: `createHiligaynon().text(s).trim()` (a number goes through `String(n)`).
        let say = |t: &str| hil.text(&js(t)).trim().to_string_lossy();
        for (w, want) in PHONEMIZEWORD_1_PINS {
            assert_eq!(phonemize_word(&js(w)).to_string_lossy(), *want, "{w}");
        }
        for (n, want) in SAY_N_PINS {
            assert_eq!(
                say(&crate::core::js_string::js_number_to_string(*n)),
                *want,
                "{n}"
            );
        }
        for (t, want) in SAY_PINS {
            assert_eq!(say(t), *want, "{t}");
        }
        for (t, part) in CONTAINS_PINS {
            assert!(say(t).contains(part), "{t}");
        }
        for (t, part) in NOTCONTAINS_PINS {
            assert!(!say(t).contains(part), "{t}");
        }
        for (t, t2) in REL_PINS {
            assert_eq!(say(t), say(t2), "{t}");
        }
        // `expect(say(1000000000).split(" ")).toHaveLength(10)`: the digit-by-digit fallback.
        assert_eq!(say("1000000000").split(' ').count(), 10);
    }

    /// test/malayic-philippine-1534.test.ts, the hil rows: relational, never typed IPA.
    #[test]
    fn the_1534_findings_are_fixed() {
        let say = |t: &str| crate::phonemize(t, "hil").unwrap();
        for (a, b) in [
            ("0.625", "0 punto 6 2 5"),
            ("3.1416", "3 punto 1 4 1 6"),
            ("1234.567", "1234 punto 5 6 7"),
        ] {
            assert_eq!(say(a), say(b), "{a}");
        }
        assert!(!say("17.865 ka pumuluyo").contains("pˈunto"));
        for (a, b) in [("queso", "keso"), ("quinse", "kinse"), ("Quezon", "Keson")] {
            assert_eq!(phonemize_word(&js(a)), phonemize_word(&js(b)), "{a}");
        }
    }
}
