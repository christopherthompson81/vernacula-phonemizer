//! Korean grapheme→phoneme (Seoul standard): Hangul blocks decomposed into jamo, then the cross-syllable
//! sandhi (liaison, aspiration, lateralization, nasalization, tensification, palatalization, lenis voicing),
//! the lexical-tensification list and 7-way coda neutralisation.
//! Ported from src/languages/korean/g2p.ts — see that file for the corpus evidence.

use std::collections::{HashMap, HashSet};
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::manifest::{DIR, MANIFEST, table};
use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_map};

const SBASE: u32 = 0xac00;
const TCOUNT: u32 = 28;
const NCOUNT: u32 = 21 * TCOUNT;

struct Coda {
    cons: JsString,
    lc: JsString,
    lo: JsString,
}

struct Tables {
    l_jamo: Vec<JsString>,
    v_jamo: Vec<JsString>,
    /// With the leading null coda re-added, so the index is the Unicode T value.
    t_jamo: Vec<JsString>,
    onset: HashMap<JsString, JsString>,
    vowel: HashMap<JsString, JsString>,
    coda: HashMap<JsString, Coda>,
    coda_ph: HashMap<JsString, JsString>,
    nasal_coda: HashSet<JsString>,
    neut: HashMap<JsString, JsString>,
    obstr_coda_to_nasal: HashMap<JsString, JsString>,
    voice: HashMap<JsString, JsString>,
    tense: HashMap<JsString, JsString>,
    tense_jamo: HashMap<JsString, JsString>,
    asp_h_coda: HashMap<JsString, JsString>,
    asp_stop_h: HashMap<JsString, JsString>,
}

fn jamo(s: &str) -> Vec<JsString> {
    JsString::from(s).code_point_strings()
}

static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*MANIFEST;
    let mut t_jamo = vec![JsString::new()];
    t_jamo.extend(jamo(&m.jamo.coda));
    Tables {
        l_jamo: jamo(&m.jamo.onset),
        v_jamo: jamo(&m.jamo.vowel),
        t_jamo,
        onset: table(&m.onset),
        vowel: table(&m.vowel),
        coda: m
            .coda
            .iter()
            .map(|(k, c)| {
                (
                    JsString::from(k.as_str()),
                    Coda {
                        cons: js(&c.cons),
                        lc: js(&c.lc),
                        lo: js(&c.lo),
                    },
                )
            })
            .collect(),
        coda_ph: table(&m.coda_phoneme),
        nasal_coda: jamo(&m.nasal_codas).into_iter().collect(),
        neut: table(&m.neutralize),
        obstr_coda_to_nasal: table(&m.obstruent_to_nasal),
        voice: table(&m.voice),
        tense: table(&m.tense),
        tense_jamo: table(&m.tense_jamo),
        asp_h_coda: table(&m.aspiration.h_coda_lenis_onset),
        asp_stop_h: table(&m.aspiration.stop_coda_h_onset),
    }
});

/// `tensification.tsv`: word → the syllable indices whose onset tenses, each as JS `Number`. Optional.
fn tens_lexicon() -> Result<&'static IndexMap<JsString, Vec<f64>>, String> {
    static TENS: OnceLock<IndexMap<JsString, Vec<f64>>> = OnceLock::new();
    load_once(&TENS, || {
        load_tsv_map(
            DIR,
            "tensification.tsv",
            |v, _| Some(v.split(&js(",")).iter().map(js_number).collect()),
            TsvOptions {
                optional: true,
                ..Default::default()
            },
        )
        .map_err(|e| e.to_string())
    })
}

/// Load the lexical-tensification list (the engine build checks it, so `phonemize_word` cannot fail later).
pub fn try_tens_lexicon() -> Result<(), String> {
    tens_lexicon().map(|_| ())
}

struct Syl {
    l: JsString,
    v: JsString,
    t: JsString,
}

/// Decompose a run into syllables (non-Hangul code points are dropped).
fn decompose(word: &JsString) -> Vec<Syl> {
    let t = &*T;
    let mut out = Vec::new();
    for c in word.code_points() {
        if !(SBASE..=0xd7a3).contains(&c) {
            continue;
        }
        let s = c - SBASE;
        out.push(Syl {
            l: t.l_jamo[(s / NCOUNT) as usize].clone(),
            v: t.v_jamo[((s % NCOUNT) / TCOUNT) as usize].clone(),
            t: t.t_jamo[(s % TCOUNT) as usize].clone(),
        });
    }
    out
}

/// `arr[j]` for a JS `Number` index: only a non-negative integer in range names an element.
fn js_index(j: f64, len: usize) -> Option<usize> {
    (j.is_finite() && j.fract() == 0.0 && j >= 0.0 && (j as usize) < len).then_some(j as usize)
}

/// One Korean word → canonical IPA (Hangul decomposition + sandhi + coda neutralisation).
pub fn phonemize_word(word: &JsString) -> JsString {
    let t = &*T;
    let syls = decompose(word);
    if syls.is_empty() {
        return JsString::new();
    }
    let s = |x: &str| js(x);
    let mut coda: Vec<JsString> = syls
        .iter()
        .map(|y| {
            if y.t.is_empty() {
                JsString::new()
            } else {
                t.coda[&y.t].cons.clone()
            }
        })
        .collect();
    let mut onset: Vec<JsString> = syls.iter().map(|y| y.l.clone()).collect();
    let mut liaised = vec![false; syls.len()];
    let is_obstr = |c: &JsString| t.obstr_coda_to_nasal.contains_key(c);

    for i in 0..syls.len() - 1 {
        let cd = coda[i].clone();
        if cd.is_empty() {
            continue;
        }
        let on = onset[i + 1].clone();
        if on == s("ㅇ") {
            let info = &t.coda[&syls[i].t];
            if info.lo == s("ㅎ") {
                coda[i] = info.lc.clone();
                onset[i + 1] = s("ㅇ");
            } else {
                onset[i + 1] = info.lo.clone();
                coda[i] = info.lc.clone();
                liaised[i + 1] = true;
            }
            continue;
        }
        if cd == s("ㅎ") && ["ㄱ", "ㄷ", "ㅈ", "ㅅ"].iter().any(|x| on == s(x)) {
            onset[i + 1] = t.asp_h_coda[&on].clone();
            coda[i] = if syls[i].t == s("ㄶ") {
                s("ㄴ")
            } else if syls[i].t == s("ㅀ") {
                s("ㄹ")
            } else {
                JsString::new()
            };
            continue;
        }
        let ncd = t.neut.get(&cd).cloned().unwrap_or(cd);
        let stop = ["ㄱ", "ㄷ", "ㅂ"].iter().any(|x| ncd == s(x));
        if on == s("ㅎ") && stop {
            onset[i + 1] = t.asp_stop_h[&ncd].clone();
            coda[i] = JsString::new();
            continue;
        }
        if (ncd == s("ㄴ") && on == s("ㄹ")) || (ncd == s("ㄹ") && on == s("ㄴ")) {
            coda[i] = s("ㄹ");
            onset[i + 1] = s("ㄹ");
            continue;
        }
        if (on == s("ㄴ") || on == s("ㅁ")) && is_obstr(&ncd) {
            coda[i] = t.obstr_coda_to_nasal[&ncd].clone();
            continue;
        }
        if on == s("ㄹ") && (is_obstr(&ncd) || t.nasal_coda.contains(&ncd)) {
            onset[i + 1] = s("ㄴ");
            if is_obstr(&ncd) {
                coda[i] = t.obstr_coda_to_nasal[&ncd].clone();
            }
            continue;
        }
        // `ONSET[on]! in TENSE`: an onset with no ONSET row is the key "undefined", which TENSE lacks.
        if stop && t.onset.get(&on).is_some_and(|p| t.tense.contains_key(p)) {
            onset[i + 1] = t.tense_jamo.get(&on).cloned().unwrap_or(on);
        }
    }

    if let Some(tens) = tens_lexicon()
        .expect("tensification.tsv is loaded at build")
        .get(word)
    {
        for &j in tens {
            if let Some(j) = js_index(j, onset.len())
                && let Some(tj) = t.tense_jamo.get(&onset[j])
            {
                onset[j] = tj.clone();
            }
        }
    }

    let stress_idx = syls.iter().position(|y| !y.t.is_empty()).unwrap_or(0);

    let mut out = JsString::new();
    let is_sonorant = |cd: &JsString| t.nasal_coda.contains(cd) || *cd == s("ㄹ");
    for i in 0..syls.len() {
        let mut on_ph = t.onset.get(&onset[i]).cloned().unwrap_or_default();
        let prev_coda = if i > 0 { Some(&coda[i - 1]) } else { None };
        if liaised[i] && (onset[i] == s("ㄷ") || onset[i] == s("ㅌ")) && syls[i].v == s("ㅣ") {
            on_ph = if onset[i] == s("ㄷ") {
                s("t͡ɕ")
            } else {
                s("t͡ɕʰ")
            };
        } else if onset[i] == s("ㄹ") && prev_coda.is_some_and(|p| *p == s("ㄹ")) {
            on_ph = s("ɭ");
        }
        let after_sonorant = i > 0 && prev_coda.is_some_and(|p| p.is_empty() || is_sonorant(p));
        if after_sonorant && let Some(v) = t.voice.get(&on_ph) {
            on_ph = v.clone();
        }
        out.push_str(&on_ph);
        if i == stress_idx {
            out.push_str(&s("ˈ"));
        }
        if let Some(v) = t.vowel.get(&syls[i].v) {
            out.push_str(v);
        }
        if !coda[i].is_empty()
            && let Some(c) = t.coda_ph.get(&coda[i])
        {
            out.push_str(c);
        }
    }
    out
}
