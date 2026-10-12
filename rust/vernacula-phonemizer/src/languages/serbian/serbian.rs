//! Serbian (sr) phonemizer, canonical IPA, both scripts: a digraph-aware letter scan (degeminating, the
//! syllabic ⟨r⟩ as a nucleus) with the lexical pitch accent from stress.tsv (ˈ before the nucleus, a Chao tone
//! letter after it) or an OOV accent derived from a known stem; the ⟨q w x y th⟩ spelling fold; text() over
//! words, numbers and clause punctuation. Croatian and Bosnian reuse `phonemize_word` and `foreign_letters`.
//! Ported from src/languages/serbian/serbian.ts — see that file for the corpus evidence.

use std::collections::{HashMap, HashSet};
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::manifest::{DIR, MANIFEST, try_manifest};
use super::normalize::normalize_serbian;
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_map};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// `Accent`: the stressed nucleus's ordinal and its contour (`SR LR SF LF --`, kept as written).
#[derive(Clone, Debug)]
pub struct Accent {
    pub at: f64,
    pub tone: JsString,
}

/// One accent-transitions.tsv row. `tone` is NOT validated by the TS (`t as Accent["tone"]`).
#[derive(Clone, Debug)]
struct Transition {
    shift: f64,
    tone: JsString,
    agree: f64,
    support: f64,
}

struct Dicts {
    stress: IndexMap<JsString, Accent>,
    trans: IndexMap<JsString, Transition>,
}

fn is_integer(n: f64) -> bool {
    n.is_finite() && n.fract() == 0.0
}

/// stress.tsv and accent-transitions.tsv (both optional). The TS loads each on first use; here
/// `create_serbian` (or the first word) loads both.
fn try_dicts() -> Result<&'static Dicts, String> {
    static D: OnceLock<Dicts> = OnceLock::new();
    load_once(&D, || {
        let optional = || TsvOptions {
            optional: true,
            ..Default::default()
        };
        let stress = load_tsv_map(
            DIR,
            "stress.tsv",
            |v, _| {
                let parts = v.split(&js("\t"));
                let at = js_number(&parts[0]);
                let t = parts.get(1)?;
                let ok = ["SR", "LR", "SF", "LF", "--"].iter().any(|x| *t == js(x));
                (is_integer(at) && ok).then(|| Accent {
                    at,
                    tone: t.clone(),
                })
            },
            optional(),
        )
        .map_err(|e| e.to_string())?;
        let trans = load_tsv_map(
            DIR,
            "accent-transitions.tsv",
            |v, _| {
                let parts = v.split(&js("\t"));
                let shift = js_number(&parts[0]);
                let t = parts.get(1)?;
                // `Number(undefined)` is NaN for a missing column.
                let num = |i: usize| parts.get(i).map_or(f64::NAN, js_number);
                is_integer(shift).then(|| Transition {
                    shift,
                    tone: t.clone(),
                    agree: num(2),
                    support: num(3),
                })
            },
            optional(),
        )
        .map_err(|e| e.to_string())?;
        Ok(Dicts { stress, trans })
    })
}

static DICTS: LazyLock<&'static Dicts> =
    LazyLock::new(|| try_dicts().unwrap_or_else(|e| panic!("{e}")));

const TONE_AGREEMENT: f64 = 90.0;
const MIN_SUPPORT: f64 = 5.0;
const MAX_CUT: usize = 3;

/// `deriveAccent(w)`: the shortest cut whose stem is in the lexicon, shifted by the ending's transition.
fn derive_accent(w: &JsString) -> Option<Accent> {
    let d = &*DICTS;
    for c in 1..=MAX_CUT {
        if (w.len() as isize) - (c as isize) < 3 {
            break;
        }
        let Some(stem) = d.stress.get(&w.slice(0, Some(-(c as isize)))) else {
            continue;
        };
        let key = w
            .slice((w.len() - c) as isize, None)
            .concat(&js("|"))
            .concat(&stem.tone);
        let tr = d.trans.get(&key)?;
        let withheld =
            stem.tone == js("--") || tr.agree < TONE_AGREEMENT || tr.support < MIN_SUPPORT;
        return Some(Accent {
            at: (stem.at + tr.shift).max(0.0),
            tone: if withheld { js("--") } else { tr.tone.clone() },
        });
    }
    None
}

/// `accentLexiconHas(word)`.
pub fn accent_lexicon_has(word: &JsString) -> bool {
    DICTS.stress.contains_key(&word.to_lower_case())
}

/// `TONE[tone]`; a tone outside the table (only reachable from an unvalidated transition row) reads as
/// `undefined` in the template.
fn tone_letter(tone: &JsString) -> JsString {
    match tone.to_string_lossy().as_str() {
        "SR" | "LR" => js("˩˥"),
        "SF" | "LF" => js("˥˩"),
        "--" => JsString::new(),
        _ => js("undefined"),
    }
}

const CLITIC: &[&str] = &[
    "sam",
    "si",
    "je",
    "smo",
    "ste",
    "su",
    "ću",
    "ćeš",
    "će",
    "ćemo",
    "ćete",
    "bih",
    "bi",
    "bismo",
    "biste",
    "me",
    "te",
    "ga",
    "mu",
    "joj",
    "ih",
    "im",
    "se",
    "li",
    "ne",
    "i",
    "a",
    "ni",
    "da",
    "u",
    "na",
    "o",
    "po",
    "za",
    "od",
    "do",
    "iz",
    "s",
    "sa",
    "k",
    "ka",
    "uz",
    "niz",
    "сам",
    "си",
    "је",
    "смо",
    "сте",
    "су",
    "ћу",
    "ћеш",
    "ће",
    "ћемо",
    "ћете",
    "бих",
    "би",
    "бисмо",
    "бисте",
    "ме",
    "те",
    "га",
    "му",
    "јој",
    "их",
    "им",
    "се",
    "ли",
    "не",
    "и",
    "а",
    "ни",
    "да",
    "у",
    "на",
    "о",
    "по",
    "за",
    "од",
    "до",
    "из",
    "с",
    "са",
    "к",
    "ка",
    "уз",
    "низ",
];

/// The manifest's tables as `JsString`s, and the sets derived from them.
struct Letters {
    digraphs: HashMap<JsString, JsString>,
    letters: HashMap<JsString, JsString>,
    vowel_letter: HashSet<JsString>,
    clitic: HashSet<JsString>,
}

static LETTERS: LazyLock<Letters> = LazyLock::new(|| {
    let m = &*MANIFEST;
    let map = |t: &IndexMap<String, String>| t.iter().map(|(k, v)| (js(k), js(v))).collect();
    // `"aeiou".includes(LETTERS[c])`: a substring test on the IPA value.
    let vowel_letter = m
        .letters
        .iter()
        .filter(|(_, v)| "aeiou".contains(v.as_str()))
        .map(|(k, _)| js(k))
        .collect();
    Letters {
        digraphs: map(&m.digraphs),
        letters: map(&m.letters),
        vowel_letter,
        clitic: CLITIC.iter().map(|c| js(c)).collect(),
    }
});

/// `isNucleus(w, i)`: a vowel letter, or ⟨r⟩ with no vowel letter beside it.
fn is_nucleus(l: &Letters, w: &JsString, i: usize) -> bool {
    let c = w.char_at(i);
    if l.vowel_letter.contains(&c) {
        return true;
    }
    if c != js("r") && c != js("р") {
        return false;
    }
    let prev = if i > 0 {
        w.char_at(i - 1)
    } else {
        JsString::new()
    };
    let next = if i + 1 < w.len() {
        w.char_at(i + 1)
    } else {
        JsString::new()
    };
    !l.vowel_letter.contains(&prev) && !l.vowel_letter.contains(&next)
}

/// `phonemizeWord(word)`: one word (either script) to canonical IPA with its accent.
pub fn phonemize_word(word: &JsString) -> JsString {
    let l = &*LETTERS;
    let w = word.to_lower_case();
    let is_letter_run = word.len() >= 2
        && !word
            .code_point_strings()
            .iter()
            .any(|ch| l.vowel_letter.contains(&ch.to_lower_case()));
    let mut out = JsString::new();
    let mut prev_letter = JsString::new();
    let mut nuclei: Vec<(usize, usize)> = Vec::new();
    let mut i = 0;
    while i < w.len() {
        let two = w.slice(i as isize, Some(i as isize + 2));
        if let Some(d) = l.digraphs.get(&two).filter(|d| !d.is_empty()) {
            out.push_str(d);
            prev_letter = JsString::new();
            i += 2;
            continue;
        }
        let c = w.char_at(i);
        let letter = l.letters.get(&c);
        if !is_letter_run && c == prev_letter && !l.vowel_letter.contains(&c) && letter.is_some() {
            i += 1;
            continue;
        }
        if let Some(ipa) = letter {
            let start = out.len();
            out.push_str(ipa);
            prev_letter = c;
            if is_nucleus(l, &w, i) {
                nuclei.push((start, out.len()));
            }
        } else {
            prev_letter = JsString::new();
        }
        i += 1;
    }
    if nuclei.is_empty() || l.clitic.contains(&w) {
        return out;
    }
    let acc = DICTS.stress.get(&w).cloned().or_else(|| derive_accent(&w));
    let k = acc
        .as_ref()
        .map_or(0.0, |a| a.at)
        .min((nuclei.len() - 1) as f64) as usize;
    let (start, end) = nuclei[k];
    let mark = if nuclei.len() > 1 {
        js("ˈ")
    } else {
        JsString::new()
    };
    let tail = match &acc {
        None => JsString::new(),
        Some(a) => {
            let long = a.tone == js("LR") || a.tone == js("LF");
            js(if long { "ː" } else { "" }).concat(&tone_letter(&a.tone))
        }
    };
    if mark.is_empty() && tail.is_empty() {
        return out;
    }
    let mut r = out.slice(0, Some(start as isize));
    r.push_str(&mark);
    r.push_str(&out.slice(start as isize, Some(end as isize)));
    r.push_str(&tail);
    r.push_str(&out.slice(end as isize, None));
    r
}

/// `foreignLetters(w)`: ⟨qu q w x xx th y⟩ → the orthography's own adaptation (shared by hr, bs and sr).
pub fn foreign_letters(w: &JsString) -> JsString {
    js_re!("qu|xx|th|[qwxy]", "giu").replace_with(w, |mm, s| {
        let m = mm.value(s);
        let at = mm.index();
        let lower = m.to_lower_case().to_string_lossy();
        match lower.as_str() {
            "qu" => js("kv"),
            "q" => js("k"),
            "w" => js("v"),
            "x" | "xx" => js("ks"),
            "th" => {
                if js_re!("^(?:pret|pot|ot|nat)$", "iu").test(&s.slice(0, Some(at as isize + 1))) {
                    m
                } else {
                    js("t")
                }
            }
            _ => {
                let prev = if at > 0 {
                    s.char_at(at - 1)
                } else {
                    JsString::new()
                };
                if js_re!("[aeiouAEIOU]", "u").test(&prev) {
                    js("j")
                } else {
                    js("i")
                }
            }
        }
    })
}

pub(crate) static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let run = host_word_run(&["Latin"], "а-шђјљњћџ", "").unwrap();
    JsRegex::new(&format!(r"({run})|(\d+)|([.!?…,;:])"), "giu").unwrap()
});

/// `NATIVE_CLASS`, shared with Bosnian (the same inventory).
pub(crate) const NATIVE_CLASS: &str = "[а-ик-шђјљњћџa-zčćšžđ]";

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "iu")));

/// `nat(word)`.
pub fn nat(word: &JsString) -> JsString {
    NAT(word)
}

/// A Serbo-Croatian word token through the shared fold, the nativiser `nat` and the g2p.
pub(crate) fn read_word(nat: &dyn Fn(&JsString) -> JsString, w: &JsString) -> JsString {
    phonemize_word(&nat(&foreign_letters(w)))
}

/// The Serbian engine (`createSerbian`).
pub struct SerbianPhonemizer;

impl SerbianPhonemizer {
    /// `normalizeSerbian(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_serbian(text)
    }

    /// `normalizeSerbianInitialisms(text)`.
    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        super::normalize::normalize_serbian_initialisms(text)
    }

    /// The symbol tier normalize.ts applies at its step 9.
    pub fn symbols(&self, text: &JsString) -> JsString {
        super::normalize::serbian_symbols(text)
    }

    /// `isUnreadableSerbian(word)`.
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        super::normalize::is_unreadable_serbian(word)
    }

    /// `readDecimalComma(text)`.
    pub fn read_decimal_comma(&self, text: &JsString) -> JsString {
        super::normalize::read_decimal_comma(text)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn foreign_letters(&self, word: &JsString) -> JsString {
        foreign_letters(word)
    }

    pub fn nativise(&self, word: &JsString) -> JsString {
        nat(word)
    }

    /// `numberToWords(n, raw)`.
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let m = &*MANIFEST;
        assemble_clauses(&normalize_serbian(input), &TOKEN, |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&read_word(&nat, &w));
            } else if let Some(d) = mm.group(2, s).filter(|d| !d.is_empty()) {
                for wd in number_to_words(js_number(&d), Some(&d)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = mm.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) = m
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for SerbianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(SerbianPhonemizer::text(self, input))
    }
}

/// Loads what every Serbo-Croatian engine reads through the shared g2p: the Serbian manifest and the two
/// accent tables.
pub(crate) fn load_shared() -> Result<(), String> {
    try_manifest()?;
    try_dicts()?;
    Ok(())
}

/// `createSerbian()`. Errors when the manifest or an accent table cannot be loaded.
pub fn create_serbian() -> Result<SerbianPhonemizer, String> {
    load_shared()?;
    Ok(SerbianPhonemizer)
}

/// test/serbian.test.ts's literal-input pins, extracted mechanically (`.probe/sh/pins.mts`) with every value
/// evaluated from the TS engine; never hand-typed.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn serbian_test_ts_pins() {
        let e = create_serbian().unwrap();
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("voda")).to_string_lossy(),
            "ʋˈoda"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("ljubav")).to_string_lossy(),
            "ʎˈuː˩˥baʋ"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("čovek")).to_string_lossy(),
            "t͡ʃˈoʋek"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("đak")).to_string_lossy(),
            "d͡ʑaː˥˩k"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("ćao")).to_string_lossy(),
            "t͡ɕˈaː˥˩o"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("džep")).to_string_lossy(),
            "d͡ʒe˥˩p"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("srce")).to_string_lossy(),
            "sˈr˥˩t͡se"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("njega")).to_string_lossy(),
            "ɲˈe˥˩ɡa"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("вода")).to_string_lossy(),
            "ʋˈoda"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("љубав")).to_string_lossy(),
            "ʎˈuː˩˥baʋ"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("ђак")).to_string_lossy(),
            "d͡ʑaː˥˩k"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("срце")).to_string_lossy(),
            "sˈr˥˩t͡se"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("хвала")).to_string_lossy(),
            "xʋˈaː˩˥la"
        );
        assert_eq!(
            e.text(&js("21")).to_string_lossy().trim().to_string(),
            "dʋˈaː˩˥deset jˈe˩˥dan"
        );
        assert_eq!(
            e.text(&js("234")).to_string_lossy().trim().to_string(),
            "dʋˈe˥˩sta trˈiː˩˥deset t͡ʃˈe˩˥tiri"
        );
        assert_eq!(
            e.text(&js("1000")).to_string_lossy().trim().to_string(),
            "xˈiʎadu"
        );
        assert_eq!(
            e.text(&js("5000")).to_string_lossy().trim().to_string(),
            "peː˥˩t xˈiʎada"
        );
        assert_eq!(
            e.text(&js("1000")).to_string_lossy().trim().to_string(),
            "xˈiʎadu"
        );
        assert_eq!(
            e.text(&js("2000")).to_string_lossy().trim().to_string(),
            "dʋeː˥˩ xˈiʎade"
        );
        assert_eq!(
            e.text(&js("5000")).to_string_lossy().trim().to_string(),
            "peː˥˩t xˈiʎada"
        );
        assert_eq!(
            e.text(&js("21000")).to_string_lossy().trim().to_string(),
            "dʋˈaː˩˥deset jednˈa xˈiʎada"
        );
        assert_eq!(
            e.text(&js("1000000")).to_string_lossy().trim().to_string(),
            "jˈe˩˥dan milˈi˩˥on"
        );
        assert_eq!(
            e.text(&js("2000000")).to_string_lossy().trim().to_string(),
            "dʋaː˥˩ miliˈona"
        );
        assert_eq!(
            e.text(&js("1624. године"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "xˈiʎadu ʃˈeː˥˩ststo dʋˈaː˩˥deset t͡ʃˈetʋrte ɡˈodine"
        );
        assert_eq!(
            e.text(&js("у 54. години"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "u pedˈe˩˥set t͡ʃˈetʋrtoj ɡˈodini"
        );
        assert_eq!(
            e.text(&js("за 2020. годину"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "za dʋeː˥˩ xˈiʎade dʋˈaː˩˥desetu ɡˈodinu"
        );
        assert_eq!(
            e.text(&js("16. века")).to_string_lossy().trim().to_string(),
            "ʃesnˈaestoɡ ʋˈeka"
        );
        assert_eq!(
            e.text(&js("у 20. веку"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "u dʋˈaː˩˥desetom ʋˈeku"
        );
        assert_eq!(
            e.text(&js("21. јула")).to_string_lossy().trim().to_string(),
            "dʋˈaː˩˥deset pˈr˩˥ʋoɡ jˈula"
        );
        assert_eq!(
            e.text(&js("3. августа"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "trˈet͡ɕeɡ aʋɡˈusta"
        );
        assert_eq!(
            e.text(&js("400. године"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "t͡ʃetˈiristote ɡˈodine"
        );
        assert_eq!(
            e.text(&js("типа 1.")).to_string_lossy().trim().to_string(),
            "tˈipa jˈe˩˥dan ."
        );
        assert_eq!(
            e.text(&js("1770. Некад"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "xˈiʎadu sˈe˥˩damsto sedamdˈe˩˥set . nˈe˥˩kad"
        );
        assert_eq!(
            e.text(&js("прича, итд.)"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "prˈiː˥˩t͡ʃa , i tˈa˩˥ko dˈa˥˩ʎe ."
        );
        assert_eq!(
            e.text(&js("1.400 људи"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "xˈiʎadu t͡ʃˈe˥˩tiristo ʎˈudi"
        );
        assert_eq!(
            e.text(&js("5.000.000"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "peː˥˩t miliˈona"
        );
        assert_eq!(
            e.text(&js("70 km")).to_string_lossy().trim().to_string(),
            "sedamdˈe˩˥set kˈilometara"
        );
        assert_eq!(
            e.text(&js("83 km")).to_string_lossy().trim().to_string(),
            "osamdˈe˩˥set triː˥˩ kˈilometra"
        );
        assert_eq!(
            e.text(&js("24 mm")).to_string_lossy().trim().to_string(),
            "dʋˈaː˩˥deset t͡ʃˈe˩˥tiri mˈilimetra"
        );
        assert_eq!(
            e.text(&js("88%")).to_string_lossy().trim().to_string(),
            "osamdˈe˩˥set ˈo˥˩sam pˈo˥˩sto"
        );
        assert_eq!(
            e.text(&js("19.500 km²"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "deʋˈe˩˥tnaest xˈiʎada pˈeː˥˩tsto kʋˈa˩˥dratnix kˈilometara"
        );
        assert_eq!(
            e.text(&js("480 km/h")).to_string_lossy().trim().to_string(),
            "t͡ʃˈe˥˩tiristo osamdˈe˩˥set kˈilometara na saː˥˩t"
        );
        assert_eq!(
            e.text(&js("133 m/s")).to_string_lossy().trim().to_string(),
            "stoː˥˩ trˈiː˩˥deset triː˥˩ mˈetra u sekˈuː˩˥ndi"
        );
        assert_eq!(
            e.text(&js("11:00")).to_string_lossy().trim().to_string(),
            "jedˈa˩˥naest sˈati"
        );
        assert_eq!(
            e.text(&js("22:08")).to_string_lossy().trim().to_string(),
            "dʋˈaː˩˥deset dʋaː˥˩ sˈaː˥˩ta i ˈo˥˩sam minˈuː˩˥ta"
        );
        assert_eq!(
            e.text(&js("5:3")).to_string_lossy().trim().to_string(),
            "peː˥˩t , triː˥˩"
        );
        assert_eq!(
            e.text(&js("1,5 сати")).to_string_lossy().trim().to_string(),
            "jˈe˩˥dan zˈarez peː˥˩t sˈati"
        );
        assert_eq!(
            e.text(&js("4x4")).to_string_lossy().trim().to_string(),
            "t͡ʃˈe˩˥tiri pˈuta t͡ʃˈe˩˥tiri"
        );
        assert_eq!(
            e.text(&js("низак – 6000"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "nˈi˥˩zak ʃeː˥˩st xˈiʎada"
        );
        assert_eq!(
            e.text(&js("1970-их")).to_string_lossy().trim().to_string(),
            "xˈiʎadu dˈe˥˩ʋetsto sedamdˈe˩˥setix"
        );
        assert_eq!(
            e.text(&js("15-ог века"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "petnˈaestoɡ ʋˈeka"
        );
        assert_eq!(
            e.text(&js("11-ом веку"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "jedanˈaestom ʋˈeku"
        );
        assert_eq!(
            e.text(&js("11-годишња"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "jedˈa˩˥naest ɡˈodiʃɲa"
        );
        assert_eq!(
            e.text(&js("323. године п. н. е."))
                .to_string_lossy()
                .trim()
                .to_string(),
            "trˈi˥˩sta dʋˈaː˩˥deset trˈet͡ɕe ɡˈodine pre˥˩ nˈoʋe ˈere ."
        );
        assert_eq!(
            e.text(&js("Око 1000. п. н. е. Асирци"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "ˈo˥˩ko xˈiʎadite pre˥˩ nˈoʋe ˈere . asˈiː˩˥rt͡si"
        );
        assert_eq!(
            e.text(&js("Око 1000. н. е. Асирци"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "ˈo˥˩ko xˈiʎadite nˈoʋe ˈere . asˈiː˩˥rt͡si"
        );
        assert_eq!(
            e.text(&js("Око 1000. н.е."))
                .to_string_lossy()
                .trim()
                .to_string(),
            "ˈo˥˩ko xˈiʎadite nˈoʋe ˈere ."
        );
        assert_eq!(
            e.text(&js("1300. n. e."))
                .to_string_lossy()
                .trim()
                .to_string(),
            "xˈiʎadu tristˈote nˈoʋe ˈere ."
        );
        assert_eq!(
            e.text(&js("N. E. Kovač"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "en e kˈo˩˥ʋat͡ʃ"
        );
        assert_eq!(
            e.text(&js("веку п.н.е, једна"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "ʋˈeku pre˥˩ nˈoʋe ˈere , jednˈa"
        );
        assert_eq!(
            e.text(&js("0,001 grama"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "nˈu˥˩la zˈarez nˈu˥˩la nˈu˥˩la jˈe˩˥dan ɡrˈama"
        );
        assert_eq!(
            e.text(&js("0,001")).to_string_lossy().trim().to_string(),
            "nˈu˥˩la zˈarez nˈu˥˩la nˈu˥˩la jˈe˩˥dan"
        );
        assert_eq!(
            e.text(&js("0,5 grama"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "nˈu˥˩la zˈarez peː˥˩t ɡrˈama"
        );
        assert_eq!(
            e.text(&js("0,25 m")).to_string_lossy().trim().to_string(),
            "nˈu˥˩la zˈarez dʋˈaː˩˥deset peː˥˩t mˈetara"
        );
        assert_eq!(
            e.text(&js("1,5 km")).to_string_lossy().trim().to_string(),
            "jˈe˩˥dan zˈarez peː˥˩t kˈilometara"
        );
        assert_eq!(
            e.text(&js("5,0")).to_string_lossy().trim().to_string(),
            "peː˥˩t zˈarez nˈu˥˩la"
        );
        assert_eq!(
            e.text(&js("32 °C степена"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "trˈiː˩˥deset dʋaː˥˩ stˈepena t͡sˈelzijusa"
        );
        assert_eq!(
            e.text(&js("90 °F")).to_string_lossy().trim().to_string(),
            "deʋedˈe˩˥set stˈe˥˩peni fˈarenxajta"
        );
        assert_eq!(
            e.text(&js("35°W")).to_string_lossy().trim().to_string(),
            "trˈiː˩˥deset peː˥˩t stˈe˥˩peni"
        );
        assert!(
            e.text(&js("температура 35°С"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("t͡sˈelzijusa"),
            "say(\"температура 35°С\")"
        );
        assert!(
            e.text(&js("35 °С"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("t͡sˈelzijusa"),
            "say(\"35 °С\")"
        );
        assert!(
            !e.text(&js("Тачка на 35° С је ту."))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains(" s "),
            "say(\"Тачка на 35° С је ту.\")"
        );
        assert!(
            e.text(&js("35°X je tu."))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("stˈe˥˩peni je"),
            "say(\"35°X je tu.\")"
        );
        assert!(
            e.text(&js("300°K je"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("stˈe˥˩peni k"),
            "say(\"300°K je\")"
        );
        assert!(
            e.text(&js("температура 35° и падавине"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains(" i "),
            "say(\"температура 35° и падавине\")"
        );
        assert!(
            e.text(&js("35° с падавинама"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains(" s "),
            "say(\"35° с падавинама\")"
        );
        assert!(
            e.text(&js("око 35° од екватора"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("stˈe˥˩peni od"),
            "say(\"око 35° од екватора\")"
        );
        assert!(
            e.text(&js("35°C"))
                .to_string_lossy()
                .trim()
                .to_string()
                .contains("t͡sˈelzijusa"),
            "say(\"35°C\")"
        );
        assert_eq!(
            e.text(&js("СССР")).to_string_lossy().trim().to_string(),
            "es es es er"
        );
        assert_eq!(
            e.text(&js("SSSR")).to_string_lossy().trim().to_string(),
            "es es es er"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("jezik")).to_string_lossy(),
            "jˈe˩˥zik"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("beograd")).to_string_lossy(),
            "beˈo˩˥ɡrad"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("pedeset")).to_string_lossy(),
            "pedˈe˩˥set"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("dvadeset")).to_string_lossy(),
            "dʋˈaː˩˥deset"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("Србијанка")).to_string_lossy(),
            "srbˈi˩˥janka"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("srce")).to_string_lossy(),
            "sˈr˥˩t͡se"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("država")).to_string_lossy(),
            "dˈr˩˥ʒaʋa"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("trgovati")).to_string_lossy(),
            "trɡˈo˩˥ʋati"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("rijeka")).to_string_lossy(),
            "rijˈeː˩˥ka"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("mlijeko")).to_string_lossy(),
            "mlijˈeː˩˥ko"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("krv")).to_string_lossy(),
            "krː˥˩ʋ"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("je")).to_string_lossy(),
            "je"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("godine")).to_string_lossy(),
            "ɡˈodine"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("jezik")).to_string_lossy(),
            "jˈe˩˥zik"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("beograd")).to_string_lossy(),
            "beˈo˩˥ɡrad"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("rijeka")).to_string_lossy(),
            "rijˈeː˩˥ka"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("srce")).to_string_lossy(),
            "sˈr˥˩t͡se"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("noć")).to_string_lossy(),
            "noː˥˩t͡ɕ"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("grad")).to_string_lossy(),
            "ɡrad"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("je")).to_string_lossy(),
            "je"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("od")).to_string_lossy(),
            "od"
        );
        assert!(
            crate::languages::serbian::serbian::accent_lexicon_has(&js("jezik")),
            "accentLexiconHas(\"jezik\")"
        );
        assert!(
            !crate::languages::serbian::serbian::accent_lexicon_has(&js("godine")),
            "accentLexiconHas(\"godine\")"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("sedamdeset")).to_string_lossy(),
            "sedamdˈe˩˥set"
        );
        assert!(
            !crate::languages::serbian::serbian::accent_lexicon_has(&js("sedamdesetih")),
            "accentLexiconHas(\"sedamdesetih\")"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("sedamdesetih"))
                .to_string_lossy(),
            "sedamdˈe˩˥setix"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("godina")).to_string_lossy(),
            "ɡˈo˥˩dina"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("godine")).to_string_lossy(),
            "ɡˈodine"
        );
        assert_eq!(
            crate::languages::serbian::serbian::phonemize_word(&js("stepeni")).to_string_lossy(),
            "stˈe˥˩peni"
        );
        assert_eq!(crate::phonemize("DVD", "sr").unwrap(), "de ʋe de");
        assert_eq!(crate::phonemize("GPS", "sr").unwrap(), "ɡe pe es");
        assert_eq!(crate::phonemize("TV", "sr").unwrap(), "te ʋe");
        assert_eq!(crate::phonemize("SSSR", "sr").unwrap(), "es es es er");
        assert_eq!(crate::phonemize("GMT", "sr").unwrap(), "ɡe em te");
        assert_eq!(crate::phonemize("AOL", "sr").unwrap(), "a o el");
        assert_eq!(crate::phonemize("krv", "sr").unwrap(), "krː˥˩ʋ");
        assert_eq!(crate::phonemize("smrt", "sr").unwrap(), "smr˥˩t");
        assert_eq!(crate::phonemize("prst", "sr").unwrap(), "pr˥˩st");
        assert_eq!(crate::phonemize("pšenica", "sr").unwrap(), "pʃˈenit͡sa");
        assert_eq!(crate::phonemize("НАТО", "sr").unwrap(), "nˈato");
        assert_eq!(crate::phonemize("САД", "sr").unwrap(), "sad");
        assert_eq!(crate::phonemize("tko", "hr").unwrap(), "tko˥˩");
    }

    /// The #1532 findings, pinned from test/sh-baltic-port-findings.test.ts (synthetic, TS-evaluated).
    #[test]
    fn serbian_port_findings_1532() {
        let e = create_serbian().unwrap();
        let n = |s: &str| e.normalize(&js(s)).to_string_lossy();
        assert_eq!(
            n("Bilo je 5. constructor i dalje."),
            "Bilo je 5. constructor i dalje."
        );
        assert_eq!(n("Voće итᲁ., даље"), "Voće итᲁ., даље");
        assert_eq!(n("Voće itd., dalje"), "Voće i tako dalje, dalje");
        assert_eq!(
            n("Voće, povrće itd. Sutra idemo."),
            "Voće, povrće i tako dalje. Sutra idemo."
        );
        assert_eq!(n("Воће итд. Сутра."), "Воће i tako dalje. Сутра.");
        assert_eq!(
            n("Voće, povrće itd. sutra idemo."),
            "Voće, povrće i tako dalje sutra idemo."
        );
        assert_eq!(n("Sastanak u 11:00."), "Sastanak u jedanaest sati.");
        assert_eq!(
            n("Sastanak u 11:30, zatim ručak."),
            "Sastanak u jedanaest sati i trideset minuta, zatim ručak."
        );
        assert_eq!(n("u 11:30,5"), "u 11:30 zarez 5");
        assert_eq!(n("u 11:30.5"), "u 11:30.5");
        assert!(
            crate::phonemize("Voće itd. Sutra idemo.", "sr")
                .unwrap()
                .contains(" . ")
        );
        assert!(
            !crate::phonemize("Voće itd. sutra idemo.", "sr")
                .unwrap()
                .contains(" . ")
        );
    }
}
