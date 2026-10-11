//! Polish grapheme→phoneme segments: the orthographic scan (digraphs, the ⟨i⟩ palatalizer, ą/ę marking), nasal
//! vowel realization, n→ŋ before a velar, then voicing assimilation.
//! Ported from src/languages/polish/g2p.ts — see that file for the rule evidence.

use std::sync::LazyLock;

use indexmap::IndexMap;

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};

/// `Seg`. `nasal`/`rz` are the TS's optional flags, absent = false.
#[derive(Debug, Clone)]
pub struct Seg {
    pub ph: JsString,
    pub nucleus: bool,
    pub nasal: bool,
    pub rz: bool,
}

impl Seg {
    fn new(ph: JsString, nucleus: bool) -> Self {
        Seg {
            ph,
            nucleus,
            nasal: false,
            rz: false,
        }
    }
}

type Table = IndexMap<JsString, JsString>;

fn table(m: &IndexMap<String, String>) -> Table {
    m.iter().map(|(k, v)| (js(k), js(v))).collect()
}

struct Tables {
    vowel: Table,
    nasal: Table,
    cons: Table,
    digraph: Table,
    soft_i: Table,
    to_voiceless: Table,
    to_voiced: Table,
}

/// The manifest's tables keyed by `JsString`. Every lookup key is a scanned code point (or two), a phone, or a
/// letter pair, never an `Object.prototype` member's name, so an own-key lookup is the TS's `X[k]` / `k in X`.
static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*MANIFEST;
    Tables {
        vowel: table(&m.vowels),
        nasal: table(&m.nasal_vowels),
        cons: table(&m.consonants),
        digraph: table(&m.digraphs),
        soft_i: table(&m.soft_i),
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

/// `isVowelLetter(ch)`: one UTF-16 unit, among `aeiouóyąę`.
fn is_vowel_letter(ch: Option<&JsString>) -> bool {
    ch.is_some_and(|c| c.len() == 1 && js("aeiouóyąę").includes(c))
}

fn is(ch: Option<&JsString>, s: &str) -> bool {
    ch.is_some_and(|c| *c == js(s))
}

/// `scan(word)`: over the code points of `word.toLowerCase()`.
fn scan(word: &JsString) -> Vec<Seg> {
    let w = word.to_lower_case().code_point_strings();
    let at = |i: usize| w.get(i);
    let t = &*T;
    let mut segs: Vec<Seg> = Vec::new();
    let n = w.len();
    let mut i = 0;
    while i < n {
        let ch = &w[i];
        if *ch == js("d") && is(at(i + 1), "z") && is(at(i + 2), "i") {
            segs.push(Seg::new(js("d͡ʑ"), false));
            if !is_vowel_letter(at(i + 3)) {
                segs.push(Seg::new(js("i"), true));
            }
            i += 3;
            continue;
        }
        let dg = ch.concat(at(i + 1).unwrap_or(&JsString::new()));
        if let Some(ph) = t.digraph.get(&dg) {
            let mut s = Seg::new(ph.clone(), false);
            s.rz = dg == js("rz");
            segs.push(s);
            i += 2;
            continue;
        }
        if let Some(ph) = t.soft_i.get(ch)
            && is(at(i + 1), "i")
        {
            segs.push(Seg::new(ph.clone(), false));
            i = advance_soft(&w, &mut segs, i);
            continue;
        }
        if *ch == js("i") {
            if is_vowel_letter(at(i + 1)) {
                segs.push(Seg::new(js("j"), false));
            } else {
                segs.push(Seg::new(js("i"), true));
            }
            i += 1;
            continue;
        }
        if let Some(ph) = t.vowel.get(ch) {
            let au_prefix = i == 2 && (w[0] == js("n") || w[0] == js("z"));
            if *ch == js("u") && i > 0 && is(at(i - 1), "a") && !au_prefix {
                segs.push(Seg::new(js("w"), false));
            } else {
                segs.push(Seg::new(ph.clone(), true));
            }
            i += 1;
            continue;
        }
        if let Some(ph) = t.nasal.get(ch) {
            let mut s = Seg::new(ph.clone(), true);
            s.nasal = true;
            segs.push(s);
            i += 1;
            continue;
        }
        if let Some(ph) = t.cons.get(ch) {
            segs.push(Seg::new(ph.clone(), false));
        }
        i += 1;
    }
    segs
}

/// `advanceSoft(w, segs, i)`: consume "Ci"; the i is silent before a vowel letter, else the [i] vowel.
fn advance_soft(w: &[JsString], segs: &mut Vec<Seg>, i: usize) -> usize {
    if !is_vowel_letter(w.get(i + 2)) {
        segs.push(Seg::new(js("i"), true));
    }
    i + 2
}

/// `nasalRealization(segs)`. ⚠ The loop bound is re-read every pass: an inserted nasal consonant is visited
/// (and skipped, as it is not nasal).
fn nasal_realization(segs: &mut Vec<Seg>) {
    let mut i = 0;
    while i < segs.len() {
        if !segs[i].nasal {
            i += 1;
            continue;
        }
        let Some(nx) = segs.get(i + 1) else {
            if segs[i].ph != js("ɛ") {
                segs[i].ph = js("ɔw̃");
            }
            i += 1;
            continue;
        };
        match nasal_before(&nx.ph) {
            Some("w̃") => segs[i].ph = segs[i].ph.concat(&js("w̃")),
            Some(h) => segs.insert(i + 1, Seg::new(js(h), false)),
            None => segs[i].ph = segs[i].ph.concat(&js("\u{303}")),
        }
        i += 1;
    }
}

/// `nasalBefore(p)`: the homorganic nasal, `"w̃"` for the glide, or `None` to nasalize the vowel. The string
/// `includes` tests are substring tests, as in the TS.
fn nasal_before(p: &JsString) -> Option<&'static str> {
    let any = |xs: &[&str]| xs.iter().any(|x| *p == js(x));
    if js("pbfv").includes(p) {
        return Some("m");
    }
    if any(&["ɕ", "ʑ"]) {
        return Some("w̃");
    }
    if any(&["t͡ɕ", "d͡ʑ"]) {
        return Some("ɲ");
    }
    if any(&["k", "ɡ", "x"]) {
        return Some("ŋ");
    }
    if js("tdsz").includes(p) || any(&["t͡s", "d͡z", "t͡ʂ", "d͡ʐ", "ʂ", "ʐ"]) {
        return Some("n");
    }
    None
}

#[derive(PartialEq)]
enum Target {
    Voiced,
    Voiceless,
}

/// `applyVoicing(segs)`: regressive right to left (final devoicing included), then progressive devoicing of v
/// and ⟨rz⟩ left to right.
fn apply_voicing(segs: &mut [Seg]) {
    let t = &*T;
    for i in (0..segs.len()).rev() {
        let p = segs[i].ph.clone();
        if !is_obstruent(&p) {
            continue;
        }
        let target = match segs.get(i + 1) {
            None => Some(Target::Voiceless),
            Some(nx) if is_obstruent(&nx.ph) && nx.ph != js("v") && !nx.rz => {
                Some(if is_voiced(&nx.ph) {
                    Target::Voiced
                } else {
                    Target::Voiceless
                })
            }
            Some(_) => None,
        };
        if target == Some(Target::Voiceless)
            && let Some(v) = t.to_voiceless.get(&p)
        {
            segs[i].ph = v.clone();
        } else if target == Some(Target::Voiced)
            && let Some(v) = t.to_voiced.get(&p)
        {
            segs[i].ph = v.clone();
        }
    }
    for i in 1..segs.len() {
        let prev = segs[i - 1].ph.clone();
        let s = &segs[i];
        if (s.ph == js("v") || (s.rz && s.ph == js("ʐ")))
            && is_obstruent(&prev)
            && !is_voiced(&prev)
        {
            segs[i].ph = js(if segs[i].ph == js("v") { "f" } else { "ʂ" });
        }
    }
}

/// `nasalAssim(segs)`: n → ŋ before k/ɡ/x.
fn nasal_assim(segs: &mut [Seg]) {
    for i in 0..segs.len().saturating_sub(1) {
        let nx = &segs[i + 1].ph;
        if segs[i].ph == js("n") && (*nx == js("k") || *nx == js("ɡ") || *nx == js("x")) {
            segs[i].ph = js("ŋ");
        }
    }
}

/// `toSegments(word)`: one Polish word → IPA phoneme segments.
pub fn to_segments(word: &JsString) -> Vec<Seg> {
    let mut segs = scan(word);
    nasal_realization(&mut segs);
    nasal_assim(&mut segs);
    apply_voicing(&mut segs);
    segs
}
