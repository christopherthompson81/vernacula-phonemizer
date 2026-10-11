//! Cebuano / Sinugboanon (ceb) phonemizer: the rule transliterator (digraphs, glottal stops at onset, in
//! hiatus and at an interior hyphen), penultimate stress, and text() over words, numbers and punctuation.
//! Ported from src/languages/cebuano/cebuano.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use indexmap::IndexMap;

use super::manifest::{MANIFEST, try_manifest};
use super::normalize::{normalize_cebuano, try_symbols};
use super::numbers::{number_to_words, try_numbers};
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

fn is_vowel_unit(u: u16) -> bool {
    "aeiou".encode_utf16().any(|x| x == u)
}

/// `u !== "" && VOWEL_PH.includes(u[0])`: the first code UNIT.
fn is_nucleus(u: &JsString) -> bool {
    u.units().first().is_some_and(|&x| is_vowel_unit(x))
}

fn table(t: &'static IndexMap<String, String>, k: &JsString) -> Option<&'static String> {
    t.get(&k.to_string_lossy())
}

/// `scan(w)`: a lowercased word → IPA units. A hyphen is a glottal stop only between two parts.
fn scan(w: &JsString) -> Vec<JsString> {
    let s = w.code_point_strings();
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
        let dg = c.concat(s.get(i + 1).unwrap_or(&JsString::new()));
        if let Some(d) = table(&MANIFEST.digraphs, &dg).filter(|d| !d.is_empty()) {
            out.push(js(d));
            i += 2;
            continue;
        }
        if c.len() == 1 && is_vowel_unit(c.units()[0]) {
            if out.last().is_none_or(is_nucleus) {
                out.push(js("ʔ"));
            }
            out.push(js(
                table(&MANIFEST.vowels, c).expect("every vowel letter has a reading")
            ));
        } else if let Some(p) = table(&MANIFEST.consonants, c).filter(|p| !p.is_empty()) {
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
    let units = match table(&MANIFEST.special_words, &lw) {
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

/// The Cebuano engine (`createCebuano`).
pub struct CebuanoPhonemizer;

impl CebuanoPhonemizer {
    /// `normalizeCebuano(text)` (normalize.ts).
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_cebuano(text)
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
        assemble_clauses(&normalize_cebuano(input), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                for wd in number_to_words(js_number(&d), Some(&d)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) =
                    table(&MANIFEST.clause_punctuation, &p).filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for CebuanoPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(CebuanoPhonemizer::text(self, input))
    }
}

/// `createCebuano()`. Errors when the manifest cannot be loaded or the symbol tier refuses its data.
pub fn create_cebuano() -> Result<CebuanoPhonemizer, String> {
    try_manifest()?;
    try_numbers()?;
    try_symbols()?;
    Ok(CebuanoPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // test/cebuano.test.ts's literal pins, extracted from that file mechanically (.probe/pins.mjs evaluates
    // each string literal; no reading was typed by hand), so the two engines are held to one list.
    const PHONEMIZEWORD_1_PINS: &[(&str, &str)] = &[
        ("adlaw", "ʔˈadlaw"),
        ("inom", "ʔˈinom"),
        ("kaon", "kˈaʔon"),
        ("maayo", "maʔˈajo"),
        ("langit", "lˈaŋit"),
        ("gugma", "ɡˈuɡma"),
        ("balay", "bˈalaj"),
        ("salamat", "salˈamat"),
        ("pag-asa", "paɡʔˈasa"),
    ];
    const D_TEXT_1_PINS: &[(&str, &str)] = &[
        ("11", "napˈulo ʔˈuɡ ʔˈusa"),
        ("21", "kaluhˈaʔan ʔˈuɡ ʔˈusa"),
        ("100", "ʔˈusa kˈa ɡˈatos"),
        ("mga", "mˈaŋa"),
    ];
    const PHONEMIZE_2_PINS: &[(&str, &str, &str)] =
        &[("ika-20 nga siglo", "ceb", "ʔˈika kaluhˈaʔan ŋˈa sˈiɡlo")];
    const CONTAINS_PINS: &[(&str, &str, &str)] = &[
        ("1,100 km", "ceb", "lˈibo"),
        ("2.5 metros", "ceb", "pˈunto"),
        ("US$14.7 bilyones", "ceb", "pˈunto"),
        ("alas 07:19 sa buntag", "ceb", "pˈito ʔˈuɡ napˈulo"),
        ("6.34 pulgada", "ceb", "pˈunto"),
        ("0230 UTC", "ceb", "dˈuha ʔˈuɡ katlˈoʔan"),
        ("tuig 1990", "ceb", "lˈibo"),
        ("25%", "ceb", "poɾsjˈento"),
        ("$50", "ceb", "dˈoljaɾ"),
        ("£27 milyon", "ceb", "pˈoʔund"),
        ("10 km", "ceb", "kilomˈetɾo"),
        ("3,850 km²", "ceb", "kwadɾˈado"),
        ("1990-1995", "ceb", "ŋˈadto sˈa"),
        ("A & B", "ceb", "ʔˈuɡ"),
        ("Dr. Santos", "ceb", "dˈoktoɾ"),
    ];
    const NOTCONTAINS_PINS: &[(&str, &str, &str)] = &[
        ("sa 12.00 GMT", "ceb", "pˈunto"),
        ("25 °C", "ceb", "ɡɾˈado"),
        ("¥2,500", "ceb", "jen"),
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        let d = create_cebuano().unwrap();
        let say = |t: &str, l: &str| crate::phonemize(t, l).unwrap();
        for (w, want) in PHONEMIZEWORD_1_PINS {
            assert_eq!(phonemize_word(&js(w)).to_string_lossy(), *want, "{w}");
        }
        for (t, want) in D_TEXT_1_PINS {
            assert_eq!(d.text(&js(t)).trim().to_string_lossy(), *want, "{t}");
        }
        for (t, l, want) in PHONEMIZE_2_PINS {
            assert_eq!(say(t, l), *want, "{t}");
        }
        for (t, l, part) in CONTAINS_PINS {
            assert!(say(t, l).contains(part), "{t}");
        }
        for (t, l, part) in NOTCONTAINS_PINS {
            assert!(!say(t, l).contains(part), "{t}");
        }
    }
}
