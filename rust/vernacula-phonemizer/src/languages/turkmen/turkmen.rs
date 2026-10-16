//! Turkmen (tk) phonemizer: the direct grapheme scan (interdental s/z), final stress placed before the last
//! nucleus's onset (one consonant word-internally), and text() over words, digit runs and punctuation. Ported from
//! src/languages/turkmen/turkmen.ts — see that file for the sources.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::{
    fold_turkmen_tildes, is_unreadable_turkmen, normalize_turkmen, normalize_turkmen_initialisms,
    ordinal_of,
};
use super::numbers::{DIR, NUM, number_to_words, try_num, turkmen_number_words};
use super::roman_ordinals::tk_roman_ordinal;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::ipa::is_ipa_vowel;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::numbers::{render_number, spell_digits};
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

/// `TurkmenDef` (turkmen.ts). Every field the TS interface names is required; `numbers` is read through
/// numbers.rs's own loader (the same block).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TurkmenDef {
    pub digraphs: IndexMap<String, String>,
    pub graphemes: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
}

pub fn try_def() -> Result<&'static TurkmenDef, String> {
    static D: OnceLock<TurkmenDef> = OnceLock::new();
    load_once(&D, || {
        load_manifest(DIR, "turkmen.jsonc").map_err(|e| e.to_string())
    })
}

/// `DEF`, for code reached only through a checked path (`createTurkmen` loads it first).
static DEF: LazyLock<&'static TurkmenDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

/// `VOWEL.has(seg)`: a segment is one IPA vowel character.
fn is_vowel(seg: &JsString) -> bool {
    seg.len() == 1 && is_ipa_vowel(seg.units()[0])
}

/// `phonemizeWord(word)`: the grapheme scan, then the stress mark before the last nucleus's onset — one consonant
/// word-internally (kitap.lar, ilkin.ji), the whole cluster only word-initially (plan, sport) (#1576).
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let w = normalize(word, Form::Nfc).to_lower_case();
    let mut segs: Vec<JsString> = Vec::new();
    for (at0, ch) in w.code_point_strings().iter().enumerate() {
        let ph = DEF
            .graphemes
            .get(&ch.to_string_lossy())
            .map(|g| js(g))
            .or_else(|| {
                latin_phone(
                    ch,
                    PhoneOpts {
                        initial: at0 == 0,
                        include_h: true,
                    },
                )
            });
        if let Some(ph) = ph {
            segs.push(ph);
        }
    }
    if let Some(nucleus) = (0..segs.len()).rev().find(|&i| is_vowel(&segs[i])) {
        let mut at = nucleus;
        if at > 0 && !is_vowel(&segs[at - 1]) {
            at -= 1;
        }
        if !segs[..at].iter().any(is_vowel) {
            at = 0; // a word-initial cluster is the whole onset
        }
        segs.insert(at, js("ˈ"));
    }
    normalize(&JsString::join(&segs, &JsString::new()), Form::Nfc)
}

/// `number(digits)`: an unsafe integer is read digit at a time.
fn number(digits: &JsString) -> JsString {
    let n = js_number(digits);
    let word = |w: &str| phonemize_word(&js(w)).to_string_lossy();
    if !is_safe_integer(n) {
        return js(&spell_digits(&digits.to_string_lossy(), &NUM, &word));
    }
    js(&render_number(n as u64, &NUM, &word, turkmen_number_words))
}

/// turkmen.ts's `makeSymbolNormalizer({…})` literal, evaluated from the source and `JSON.stringify`'d.
const SYMBOL_DATA: &str = r#"{"percent":["göterim"],"currency":{"$":["dollar"],"€":["ýewro"],"₼":["manat"]},"units":{"km":["kilometr"],"sm":["santimetr"],"mm":["millimetr"],"kg":["kilogram"],"ga":["gektar"],"m":["metr"],"cm":["santimetr"]},"unitPer":"","rateDenominators":{"sag":"sagatda","h":"sagatda","s":"sekuntda"},"exponentWords":{"squared":["inedördül"],"cubed":["kub"],"position":"before"},"ampersand":"we","magnitudes":["müň","million","milliard"]}"#;

fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
        make_symbol_normalizer(&data)
    })
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.!?…,;:])", *LATIN_RUN), "giu").unwrap());

const NATIVE_CLASS: &str = "[a-zäçžňöşüýA-ZÄÇŽŇÖŞÜÝ]";
type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "iu")));

/// The Turkmen engine (`createTurkmen`).
pub struct TurkmenPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding one proves the manifest and the tier loaded.
/// (The per-module differentials call them.)
impl TurkmenPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_turkmen(text)
    }

    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_turkmen_initialisms(text)
    }

    pub fn fold_tildes(&self, text: &JsString) -> JsString {
        fold_turkmen_tildes(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_turkmen(word)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    pub fn number_words(&self, n: f64) -> JsString {
        js(&number_to_words(n).join("|"))
    }

    pub fn ordinal_of(&self, n: f64, front: bool) -> Option<JsString> {
        ordinal_of(n, front)
    }

    pub fn roman_ordinal(&self, n: f64) -> Option<JsString> {
        tk_roman_ordinal(n)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let prepared = self
            .symbols
            .apply(&normalize_turkmen_initialisms(&normalize_turkmen(input)));
        assemble_clauses(&prepared, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(n) = m.group(2, s).filter(|n| !n.is_empty()) {
                sink.emit(&number(&n));
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty())
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

impl Engine for TurkmenPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(TurkmenPhonemizer::text(self, input))
    }
}

/// `createTurkmen()`. Errors when the manifest cannot be loaded, or the symbol tier refuses its table.
pub fn create_turkmen() -> Result<TurkmenPhonemizer, String> {
    try_def()?;
    try_num()?;
    Ok(TurkmenPhonemizer {
        symbols: try_symbols()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One pin's actual value: `kind` names the TS call the pin was extracted from; arguments are joined by
    /// U+0001.
    fn actual(tk: &TurkmenPhonemizer, kind: &str, input: &str) -> Option<JsString> {
        let s = js(input);
        match kind {
            "word" => Some(phonemize_word(&s)),
            "engine" => Some(tk.text(&s)),
            "phonemize" => Some(js(&crate::phonemize(input, "tk").unwrap())),
            "normalize" => Some(normalize_turkmen(&s)),
            "tildes" => Some(fold_turkmen_tildes(&s)),
            "ordinal" => {
                let (n, front) = input.split_once('\u{1}').unwrap();
                ordinal_of(n.parse::<f64>().unwrap(), front == "true")
            }
            k => panic!("no pin kind {k}"),
        }
    }

    /// test/turkmen.test.ts's pins, extracted by `.probe/turkic/pins.mjs` (no reading typed by hand). A `same`
    /// pin is relational: both inputs must read alike.
    #[test]
    fn the_ts_suite_pins_hold() {
        let tk = create_turkmen().unwrap();
        let mut bad = Vec::new();
        for (kind, trim, op, input, want) in PINS {
            let get = |i: &str| actual(&tk, kind, i).map(|g| if trim { g.trim() } else { g });
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

    /// 61 pins extracted mechanically from test/turkmen.test.ts (kind, trim, op, input,
    /// expected): 58 expect() sites, 0 skipped.
    const PINS: [(&str, bool, &str, &str, &str); 61] = [
        ("word", false, "eq", "söz", "ˈθøð"),
        ("word", false, "eq", "göz", "ˈɡøð"),
        ("word", false, "eq", "suw", "ˈθuw"),
        ("word", false, "eq", "ýazmak", "jɑðˈmɑk"),
        ("word", false, "eq", "gyz", "ˈɡɯð"),
        ("word", false, "eq", "ýyl", "ˈjɯl"),
        ("word", false, "eq", "dünýä", "dynˈjæ"),
        ("word", false, "eq", "köşk", "ˈkøʃk"),
        ("word", false, "eq", "çaga", "t͡ʃɑˈɡɑ"),
        ("word", false, "eq", "jaň", "ˈd͡ʒɑŋ"),
        ("word", false, "eq", "žurnal", "ʒuɾˈnɑl"),
        ("word", false, "eq", "äheň", "æˈxeŋ"),
        ("engine", true, "eq", "7", "jeˈdi"),
        ("engine", true, "eq", "11", "ˈon ˈbiɾ"),
        ("engine", true, "eq", "25", "jiɡɾiˈmi ˈbæʃ"),
        ("engine", true, "eq", "100", "ˈjyð"),
        ("engine", true, "eq", "555", "ˈbæʃ ˈjyð elˈli ˈbæʃ"),
        (
            "engine",
            true,
            "eq",
            "1984",
            "ˈbiɾ ˈmyŋ doˈkuð ˈjyð θeɡˈθen ˈdøɾt",
        ),
        (
            "engine",
            true,
            "eq",
            "12345",
            "ˈon iˈki ˈmyŋ ˈyt͡ʃ ˈjyð ˈkɯɾk ˈbæʃ",
        ),
        ("engine", true, "eq", "1000000", "ˈbiɾ milliˈon"),
        ("word", false, "eq", "türkmen", "tyɾkˈmen"),
        ("word", false, "eq", "plan", "ˈplɑn"),
        ("word", false, "eq", "sport", "ˈθpoɾt"),
        ("phonemize", false, "same", "öñ", "öň"),
        ("phonemize", false, "same", "onuñ", "onuň"),
        ("phonemize", false, "same", "biziñ", "biziň"),
        ("phonemize", false, "same", "Koreÿa", "Koreýa"),
        ("phonemize", false, "eq", "öñ", "ˈøŋ"),
        ("tildes", false, "eq", "München", "München"),
        ("tildes", false, "eq", "Cañón", "Cañón"),
        ("tildes", false, "eq", "señor", "seňor"),
        ("ordinal", false, "eq", "1\u{0001}true", "birinji"),
        ("ordinal", false, "eq", "4\u{0001}true", "dördünji"),
        ("ordinal", false, "eq", "6\u{0001}false", "altynjy"),
        ("ordinal", false, "eq", "10\u{0001}false", "onunjy"),
        ("ordinal", false, "eq", "30\u{0001}false", "otuzynjy"),
        ("ordinal", false, "eq", "100\u{0001}true", "ýüzünji"),
        ("ordinal", false, "eq", "3\u{0001}true", "üçünji"),
        (
            "phonemize",
            false,
            "eq",
            "24-nji gün",
            "jiɡɾiˈmi døɾdynˈd͡ʒi ˈɡyn",
        ),
        (
            "phonemize",
            false,
            "eq",
            "1-nji ýarymy",
            "biɾinˈd͡ʒi jɑɾɯˈmɯ",
        ),
        (
            "phonemize",
            false,
            "eq",
            "+11° gradus",
            "ˈpljuθ ˈon ˈbiɾ ɡɾɑˈduθ",
        ),
        (
            "phonemize",
            false,
            "eq",
            "+10° dan",
            "ˈpljuθ ˈon ɡɾɑduθˈdɑn",
        ),
        (
            "phonemize",
            false,
            "eq",
            "50 ° C-e ýetýär",
            "elˈli ɡɾɑˈduθ θelθiˈe jetˈjæɾ",
        ),
        (
            "phonemize",
            false,
            "eq",
            "39°31′0″N",
            "oˈtuð doˈkuð ɡɾɑˈduθ oˈtuð ˈbiɾ miˈnut ˈnol θeˈkunt n",
        ),
        (
            "phonemize",
            false,
            "eq",
            "3/4 bölegine",
            "døɾtˈden ˈyt͡ʃ bøleɡiˈne",
        ),
        ("phonemize", false, "eq", "1/9", "dokuðˈdɑn ˈbiɾ"),
        ("normalize", false, "eq", "10/1 bölegini", "10, 1 bölegini"),
        ("normalize", false, "eq", "2015/16 ýyly", "2015, 16 ýyly"),
        (
            "normalize",
            false,
            "eq",
            "b.e. öñ 330-njy",
            "biziň eramyzdan öň üç ýüz otuzynjy",
        ),
        (
            "normalize",
            false,
            "eq",
            "B.e.ö. VI asyrda",
            "biziň eramyzdan öň VI asyrda",
        ),
        (
            "normalize",
            false,
            "eq",
            "B.e. öňki III asyryň",
            "biziň eramyzdan öňki III asyryň",
        ),
        ("normalize", false, "eq", "500-494ý.", "500, 494 ýyl"),
        ("phonemize", false, "eq", "XX asyr", "jiɡɾiminˈd͡ʒi ɑˈθɯɾ"),
        ("phonemize", false, "eq", "VI asyrda", "ɑltɯnˈd͡ʒɯ ɑθɯɾˈdɑ"),
        ("phonemize", false, "eq", "60%-ini", "ɑltˈmɯʃ ɡøteɾimiˈni"),
        (
            "phonemize",
            false,
            "eq",
            "30,3 mln km²",
            "oˈtuð , ˈyt͡ʃ milliˈon inedøɾˈdyl kiloˈmetɾ",
        ),
        (
            "phonemize",
            false,
            "eq",
            "163 mm ygal",
            "ˈjyð ɑltˈmɯʃ ˈyt͡ʃ milliˈmetɾ ɯˈɡɑl",
        ),
        ("phonemize", false, "eq", "№ 5", "belˈɡi ˈbæʃ"),
        (
            "phonemize",
            false,
            "eq",
            "1606-1669.",
            "ˈbiɾ ˈmyŋ ɑlˈtɯ ˈjyð ɑlˈtɯ , ˈbiɾ ˈmyŋ ɑlˈtɯ ˈjyð ɑltˈmɯʃ doˈkuð .",
        ),
        ("phonemize", false, "eq", "ABŞ", "ˈɑ ˈbe ˈʃe"),
        ("phonemize", false, "eq", "BMG", "ˈbe ˈem ˈɡe"),
    ];
}
