//! Slovenian grapheme→phoneme segments: the consonant scan (⟨dž⟩, ⟨lj nj⟩ with the coda j-drop, ⟨x⟩), the
//! syllabic-r schwa, and regressive voicing with word-final devoicing.
//! Ported from src/languages/slovenian/g2p.ts — see that file for the measured choices.

use std::collections::HashMap;
use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};

/// One segment: its IPA and whether it is a syllable nucleus.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Seg {
    pub ph: JsString,
    pub nucleus: bool,
}

struct Tables {
    vowel: HashMap<JsString, JsString>,
    cons: HashMap<JsString, JsString>,
    to_voiceless: HashMap<JsString, JsString>,
    to_voiced: HashMap<JsString, JsString>,
}

static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*MANIFEST;
    let map =
        |t: &indexmap::IndexMap<String, String>| t.iter().map(|(k, v)| (js(k), js(v))).collect();
    Tables {
        vowel: map(&m.vowels),
        cons: map(&m.consonants),
        to_voiceless: map(&m.voicing.to_voiceless),
        to_voiced: map(&m.voicing.to_voiced),
    }
});

fn seg(ph: &str, nucleus: bool) -> Seg {
    Seg {
        ph: js(ph),
        nucleus,
    }
}

/// `scan(word)`: over code points of the lowercased word.
fn scan(word: &JsString) -> Vec<Seg> {
    let t = &*T;
    let c = word.to_lower_case().code_point_strings();
    let empty = JsString::new();
    let at = |i: usize| c.get(i).unwrap_or(&empty);
    let is = |s: &JsString, x: &str| *s == js(x);
    let mut segs = Vec::new();
    let mut i = 0;
    while i < c.len() {
        let ch = &c[i];
        let next = at(i + 1);
        let next2 = at(i + 2);
        if is(ch, "d") && is(next, "ž") {
            segs.push(seg("d͡ʒ", false));
            i += 2;
            continue;
        }
        if (is(ch, "l") || is(ch, "n")) && is(next, "j") {
            segs.push(Seg {
                ph: ch.clone(),
                nucleus: false,
            });
            if t.vowel.contains_key(next2) {
                segs.push(seg("j", false));
            }
            i += 2;
            continue;
        }
        if is(ch, "l") {
            segs.push(seg("l", false));
        } else if is(ch, "x") {
            segs.push(seg("k", false));
            segs.push(seg("s", false));
        } else if let Some(v) = t.vowel.get(ch) {
            segs.push(Seg {
                ph: v.clone(),
                nucleus: true,
            });
        } else if let Some(k) = t.cons.get(ch) {
            segs.push(Seg {
                ph: k.clone(),
                nucleus: false,
            });
        }
        i += 1;
    }
    segs
}

/// `syllabicR(segs)`: an r with no nucleus beside it takes a preceding schwa.
fn syllabic_r(segs: &mut Vec<Seg>) {
    for i in (0..segs.len()).rev() {
        if segs[i].ph != js("r") {
            continue;
        }
        let left = i > 0 && segs[i - 1].nucleus;
        let right = segs.get(i + 1).is_some_and(|s| s.nucleus);
        if !left && !right {
            segs.insert(i, seg("ə", true));
        }
    }
}

/// `applyVoicing(segs)`: right to left; ⟨h⟩ (x/ɣ) does not trigger.
fn apply_voicing(segs: &mut [Seg]) {
    let t = &*T;
    let is_obstruent = |p: &JsString| t.to_voiceless.contains_key(p) || t.to_voiced.contains_key(p);
    for i in (0..segs.len()).rev() {
        let p = segs[i].ph.clone();
        if !is_obstruent(&p) {
            continue;
        }
        let target = match segs.get(i + 1) {
            None => Some(false),
            Some(nx) if is_obstruent(&nx.ph) && nx.ph != js("x") && nx.ph != js("ɣ") => {
                Some(t.to_voiceless.contains_key(&nx.ph))
            }
            _ => None,
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
}

/// `toSegments(word)`.
pub fn to_segments(word: &JsString) -> Vec<Seg> {
    let mut segs = scan(word);
    syllabic_r(&mut segs);
    apply_voicing(&mut segs);
    segs
}
