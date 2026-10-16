//! Aksara Jawa (Hanacaraka) scanner for Javanese: the abugida into the same segments the Latin g2p produces
//! (inherent /a/, sandhangan, pangkon, medials, keret, codas, taling + tarung), plus the digit and pada tables.
//! Ported from src/languages/javanese/aksara.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use super::javanese::Seg;
use super::manifest::DIR;
use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, js};
use crate::core::load_manifest::load_manifest;
use crate::core::provenance::{Form, normalize};

/// `AksaraDef` (aksara.ts).
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct AksaraDef {
    pub consonants: IndexMap<String, String>,
    pub syllabic: IndexMap<String, String>,
    pub independent_vowels: IndexMap<String, String>,
    pub vowel_signs: IndexMap<String, String>,
    pub tarung: String,
    pub medials: IndexMap<String, String>,
    pub keret: String,
    pub codas: IndexMap<String, String>,
    pub virama: String,
    pub digits: IndexMap<String, String>,
    pub pada: IndexMap<String, String>,
}

pub fn try_aksara() -> Result<&'static AksaraDef, String> {
    static D: OnceLock<AksaraDef> = OnceLock::new();
    load_once(&D, || {
        load_manifest(DIR, "aksara.jsonc").map_err(|e| e.to_string())
    })
}

static DEF: LazyLock<&'static AksaraDef> =
    LazyLock::new(|| try_aksara().unwrap_or_else(|e| panic!("{e}")));

/// A table keyed by one code point (a lone surrogate reads as U+FFFD, which is no key).
fn get<'a>(m: &'a IndexMap<String, String>, c: Option<&JsString>) -> Option<&'a String> {
    m.get(&c?.to_string_lossy())
}

fn is(c: Option<&JsString>, lit: &str) -> bool {
    c.is_some_and(|c| c.to_string_lossy() == lit)
}

/// `letterOf(ph)`: the vowel letter the phonology rules key on. `"aiou".includes(ph)` is a SUBSTRING test, so
/// `ai` keys as itself.
fn letter_of(ph: &str) -> &str {
    if "aiou".contains(ph) { ph } else { "e" }
}

/// `aksaraDigit(ch)`.
pub fn aksara_digit(ch: &JsString) -> JsString {
    js(get(&DEF.digits, Some(ch)).map_or("", |d| d.as_str()))
}

/// `aksaraPada(ch)`.
pub fn aksara_pada(ch: &JsString) -> Option<JsString> {
    get(&DEF.pada, Some(ch)).map(|p| js(p))
}

/// `scanAksara(word)`.
pub fn scan_aksara(word: &JsString) -> Vec<Seg> {
    let s = normalize(word, Form::Nfc).code_point_strings();
    let n = s.len();
    let at = |i: usize| s.get(i);
    let mut segs: Vec<Seg> = Vec::new();
    let push_c = |segs: &mut Vec<Seg>, ipa: &str| {
        segs.push(Seg {
            ph: js(ipa),
            v: JsString::new(),
        })
    };
    let push_v = |segs: &mut Vec<Seg>, ph: &str| {
        segs.push(Seg {
            ph: js(ph),
            v: js(letter_of(ph)),
        })
    };
    let codas = |segs: &mut Vec<Seg>, mut i: usize| {
        while i < n
            && let Some(c) = get(&DEF.codas, at(i))
        {
            push_c(segs, c);
            i += 1;
        }
        i
    };
    let mut i = 0;
    while i < n {
        let ch = at(i);
        if let Some(c) = get(&DEF.consonants, ch) {
            if !is(ch, "ꦲ") {
                push_c(&mut segs, c);
            }
            i += 1;
            let mut keret_vowel = false;
            while i < n && (get(&DEF.medials, at(i)).is_some() || is(at(i), &DEF.keret)) {
                if is(at(i), &DEF.keret) {
                    push_c(&mut segs, "r");
                    keret_vowel = true;
                } else {
                    push_c(&mut segs, get(&DEF.medials, at(i)).unwrap());
                }
                i += 1;
            }
            if keret_vowel {
                push_v(&mut segs, "ə");
            } else if is(at(i), &DEF.virama) {
                i += 1;
            } else if let Some(sign) = get(&DEF.vowel_signs, at(i)) {
                let mut ph = sign.as_str();
                i += 1;
                if ph == "e" && is(at(i), &DEF.tarung) {
                    ph = "o";
                    i += 1;
                } else if is(at(i), &DEF.tarung) {
                    i += 1;
                }
                push_v(&mut segs, ph);
            } else if is(at(i), &DEF.tarung) {
                push_v(&mut segs, "o");
                i += 1;
            } else {
                push_v(&mut segs, "a");
            }
            i = codas(&mut segs, i);
        } else if let Some(c) = get(&DEF.syllabic, ch) {
            push_c(&mut segs, c);
            push_v(&mut segs, "ə");
            i += 1;
            i = codas(&mut segs, i);
        } else if let Some(v) = get(&DEF.independent_vowels, ch) {
            push_v(&mut segs, v);
            i += 1;
            i = codas(&mut segs, i);
        } else {
            i += 1;
        }
    }
    segs
}
