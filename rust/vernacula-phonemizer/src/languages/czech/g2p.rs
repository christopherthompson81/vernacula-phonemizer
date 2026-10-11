//! Czech grapheme→phoneme segments: the orthographic scan (ch, diphthongs, hiatus j, ě, d/t/n palatalisation,
//! x as two segments), syllabic r̩/l̩, degemination, voicing assimilation and n→ŋ before a velar.
//! Ported from src/languages/czech/g2p.ts — see that file for the rule evidence.

use std::collections::HashSet;
use std::sync::LazyLock;

use indexmap::IndexMap;

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};

#[derive(Debug, Clone)]
pub struct Seg {
    pub ph: JsString,
    pub nucleus: bool,
}

fn seg(ph: &str, nucleus: bool) -> Seg {
    Seg {
        ph: js(ph),
        nucleus,
    }
}

type Table = IndexMap<JsString, JsString>;

fn table(m: &IndexMap<String, String>) -> Table {
    m.iter().map(|(k, v)| (js(k), js(v))).collect()
}

struct Tables {
    vowel: Table,
    palat: Table,
    palat_trigger: HashSet<JsString>,
    cons: Table,
    to_voiceless: Table,
    to_voiced: Table,
}

/// The manifest's tables keyed by `JsString`. Every lookup key is one scanned code point or a phone, never an
/// `Object.prototype` member's name, so an own-key lookup is the TS's `X[k]` / `k in X`.
static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*MANIFEST;
    Tables {
        vowel: table(&m.vowels),
        palat: table(&m.palatalisation.map),
        palat_trigger: m.palatalisation.triggers.iter().map(|t| js(t)).collect(),
        cons: table(&m.consonants),
        to_voiceless: table(&m.voicing.to_voiceless),
        to_voiced: table(&m.voicing.to_voiced),
    }
});

fn is_obstruent(p: &JsString) -> bool {
    T.to_voiceless.contains_key(p) || T.to_voiced.contains_key(p)
}

fn is_voiced(p: &JsString) -> bool {
    T.to_voiceless.contains_key(p)
}

/// `"<letters>".includes(ch)` for a non-empty `ch` of one code point: a substring test, i.e. membership.
fn among(letters: &str, ch: &JsString) -> bool {
    js(letters).includes(ch)
}

/// `scan(word)`: over the code points of `word.toLowerCase()`.
fn scan(word: &JsString) -> Vec<Seg> {
    let c = word.to_lower_case().code_point_strings();
    let t = &*T;
    let empty = JsString::new();
    let mut segs: Vec<Seg> = Vec::new();
    let mut i = 0;
    while i < c.len() {
        let ch = &c[i];
        let next = c.get(i + 1).unwrap_or(&empty);
        let prev = if i > 0 { &c[i - 1] } else { &empty };
        if *ch == js("c") && *next == js("h") {
            segs.push(seg("x", false));
            i += 2;
            continue;
        }
        if *next == js("u") && (*ch == js("o") || *ch == js("a") || *ch == js("e")) {
            let ph = if *ch == js("o") {
                "oᶷ"
            } else if *ch == js("a") {
                "aᶷ"
            } else {
                "ɛᶷ"
            };
            segs.push(seg(ph, true));
            i += 2;
            continue;
        }
        if let Some(v) = t.vowel.get(ch) {
            segs.push(Seg {
                ph: v.clone(),
                nucleus: true,
            });
            if among("iíyý", ch) && (t.vowel.contains_key(next) || *next == js("ě")) {
                segs.push(seg("j", false));
            }
            i += 1;
            continue;
        }
        if *ch == js("ě") {
            if *prev == js("m") {
                segs.push(seg("ɲ", false));
                segs.push(seg("ɛ", true));
            } else if !prev.is_empty() && among("bpvf", prev) {
                segs.push(seg("j", false));
                segs.push(seg("ɛ", true));
            } else {
                segs.push(seg("ɛ", true));
            }
            i += 1;
            continue;
        }
        if let Some(p) = t.palat.get(ch)
            && t.palat_trigger.contains(next)
        {
            segs.push(Seg {
                ph: p.clone(),
                nucleus: false,
            });
            i += 1;
            continue;
        }
        // ⚠ Two segments, claimed before `consonants.x` ("ks", one segment no voicing map knows).
        if *ch == js("x") {
            segs.push(seg("k", false));
            segs.push(seg("s", false));
            i += 1;
            continue;
        }
        if let Some(cons) = t.cons.get(ch) {
            segs.push(Seg {
                ph: cons.clone(),
                nucleus: false,
            });
        }
        i += 1;
    }
    segs
}

/// `markSyllabic`: r/l with no vowel nucleus on either side becomes a syllabic nucleus. Left to right, so a
/// neighbour made syllabic one step earlier counts as a nucleus.
fn mark_syllabic(segs: &mut [Seg]) {
    for i in 0..segs.len() {
        let is_r = segs[i].ph == js("r");
        if !is_r && segs[i].ph != js("l") {
            continue;
        }
        let left_v = i > 0 && segs[i - 1].nucleus;
        let right_v = segs.get(i + 1).is_some_and(|s| s.nucleus);
        if !left_v && !right_v {
            segs[i].ph = js(if is_r { "r̩" } else { "l̩" });
            segs[i].nucleus = true;
        }
    }
}

/// `applyVoicing`: regressive assimilation and final devoicing right to left, then ř's progressive devoicing.
fn apply_voicing(segs: &mut [Seg]) {
    let t = &*T;
    for i in (0..segs.len()).rev() {
        let p = segs[i].ph.clone();
        if !is_obstruent(&p) {
            continue;
        }
        // None = keep the base voicing; Some(true) = voiced; Some(false) = voiceless.
        let target = match segs.get(i + 1) {
            None => Some(false),
            Some(nx) if nx.ph == js("ɦ") => Some(false),
            Some(nx)
                if is_obstruent(&nx.ph)
                    && nx.ph != js("v")
                    && nx.ph != js("r̝")
                    && nx.ph != js("r̝̊") =>
            {
                Some(is_voiced(&nx.ph))
            }
            Some(_) => None,
        };
        match target {
            Some(false) => {
                if let Some(v) = t.to_voiceless.get(&p) {
                    segs[i].ph = v.clone();
                }
            }
            Some(true) => {
                if let Some(v) = t.to_voiced.get(&p) {
                    segs[i].ph = v.clone();
                }
            }
            None => {}
        }
    }
    for i in 1..segs.len() {
        if segs[i].ph == js("r̝") && t.to_voiced.contains_key(&segs[i - 1].ph) {
            segs[i].ph = js("r̝̊");
        }
    }
}

/// `nasalAssim`: n → ŋ before k/ɡ.
fn nasal_assim(segs: &mut [Seg]) {
    for i in 0..segs.len().saturating_sub(1) {
        if segs[i].ph == js("n") && (segs[i + 1].ph == js("k") || segs[i + 1].ph == js("ɡ")) {
            segs[i].ph = js("ŋ");
        }
    }
}

/// `degeminate`: n before n or ɲ is dropped, right to left.
fn degeminate(segs: &mut Vec<Seg>) {
    let mut i = segs.len().saturating_sub(1);
    while i > 0 {
        if segs[i - 1].ph == js("n") && (segs[i].ph == js("n") || segs[i].ph == js("ɲ")) {
            segs.remove(i - 1);
        }
        i -= 1;
    }
}

/// `toSegments(word)`.
pub fn to_segments(word: &JsString) -> Vec<Seg> {
    let mut segs = scan(word);
    mark_syllabic(&mut segs);
    degeminate(&mut segs);
    apply_voicing(&mut segs);
    nasal_assim(&mut segs);
    segs
}
