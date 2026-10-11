//! Slovak grapheme→phoneme segments: the orthographic scan (ch dz dž, x, the rising diphthongs, ô, long syllabic
//! ĺ ŕ, d/t/n/l palatalisation), syllabic r̩/l̩, gemination and voicing (⟨v⟩ a limited target).
//! Ported from src/languages/slovak/g2p.ts — see that file for the rule evidence.

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
        let is = |s: &JsString, lit: &str| *s == js(lit);
        if is(ch, "c") && is(next, "h") {
            segs.push(seg("x", false));
            i += 2;
            continue;
        }
        if is(ch, "d") && is(next, "z") {
            segs.push(seg("d͡z", false));
            i += 2;
            continue;
        }
        if is(ch, "d") && is(next, "ž") {
            segs.push(seg("d͡ʒ", false));
            i += 2;
            continue;
        }
        if is(ch, "x") {
            segs.push(seg("k", false));
            segs.push(seg("s", false));
            i += 1;
            continue;
        }
        if is(ch, "i") && (is(next, "a") || is(next, "e") || is(next, "u")) {
            let ph = if is(next, "a") {
                "ɪ̯a"
            } else if is(next, "e") {
                "ɪ̯e"
            } else {
                "ɪ̯u"
            };
            segs.push(seg(ph, true));
            i += 2;
            continue;
        }
        let single = if is(ch, "ô") {
            Some("u̯ɔ")
        } else if is(ch, "ĺ") {
            Some("l̩ː")
        } else if is(ch, "ŕ") {
            Some("r̩ː")
        } else {
            None
        };
        if let Some(ph) = single {
            segs.push(seg(ph, true));
            i += 1;
            continue;
        }
        if let Some(v) = t.vowel.get(ch) {
            segs.push(Seg {
                ph: v.clone(),
                nucleus: true,
            });
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

/// `applyVoicing`: right to left. An onset ⟨v⟩ devoices before a voiceless obstruent and is otherwise inert
/// (never a trigger); every other obstruent assimilates regressively, and devoices word-finally.
fn apply_voicing(segs: &mut [Seg]) {
    let t = &*T;
    for i in (0..segs.len()).rev() {
        let p = segs[i].ph.clone();
        if p == js("v") {
            let coda_v = i > 0 && segs[i - 1].nucleus;
            if !coda_v
                && let Some(nx) = segs.get(i + 1)
                && is_obstruent(&nx.ph)
                && nx.ph != js("v")
                && !is_voiced(&nx.ph)
            {
                segs[i].ph = js("f");
            }
            continue;
        }
        if !is_obstruent(&p) {
            continue;
        }
        // None = keep the base voicing; Some(true) = voiced; Some(false) = voiceless.
        let target = match segs.get(i + 1) {
            None => Some(false),
            Some(nx) if is_obstruent(&nx.ph) && nx.ph != js("v") => Some(is_voiced(&nx.ph)),
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
}

/// `geminate`: adjacent identical non-nucleus segments merge into one long one, right to left.
fn geminate(segs: &mut Vec<Seg>) {
    let mut i = segs.len().saturating_sub(1);
    while i > 0 {
        if !segs[i - 1].nucleus && !segs[i].nucleus && segs[i - 1].ph == segs[i].ph {
            segs[i - 1].ph.push_str(&js("ː"));
            segs.remove(i);
        }
        i -= 1;
    }
}

/// `toSegments(word)`.
pub fn to_segments(word: &JsString) -> Vec<Seg> {
    let mut segs = scan(word);
    mark_syllabic(&mut segs);
    geminate(&mut segs);
    apply_voicing(&mut segs);
    segs
}
