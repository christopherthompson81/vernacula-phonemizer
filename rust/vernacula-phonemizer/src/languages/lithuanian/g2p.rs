//! Lithuanian rule g2p segments: digraph-first letter units, palatalization (with its leftward spread and the
//! silent softening ⟨i⟩), the fronted ⟨a ą⟩ after a soft unit, n → ŋ before a velar, and regressive voicing.
//! Ported from src/languages/lithuanian/g2p.ts — see that file for the rules' evidence.

use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::js_re;

/// One segment: its IPA and whether it is a syllable nucleus.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Seg {
    pub ph: JsString,
    pub nucleus: bool,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum Kind {
    V,
    C,
    SoftI,
}

struct Unit {
    ch: JsString,
    kind: Kind,
    ph: JsString,
    soft: bool,
}

struct Tables {
    v: HashMap<JsString, JsString>,
    vdi: HashMap<JsString, JsString>,
    c: HashMap<JsString, JsString>,
    cdi: HashMap<JsString, JsString>,
    front: HashSet<JsString>,
    back: HashSet<u16>,
    to_voiceless: HashMap<JsString, JsString>,
    to_voiced: HashMap<JsString, JsString>,
}

static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*MANIFEST;
    let map =
        |t: &indexmap::IndexMap<String, String>| t.iter().map(|(k, v)| (js(k), js(v))).collect();
    Tables {
        v: map(&m.vowels),
        vdi: map(&m.vowel_digraphs),
        c: map(&m.consonants),
        cdi: map(&m.consonant_digraphs),
        front: js(&m.front_vowels)
            .code_point_strings()
            .into_iter()
            .collect(),
        // `BACK.has(nx[0])`: a set of code points tested with one code unit; every back vowel is in the BMP.
        back: js(&m.back_vowels).0.into_iter().collect(),
        to_voiceless: map(&m.voicing.to_voiceless),
        to_voiced: map(&m.voicing.to_voiced),
    }
});

/// `tokenize(w)`: digraphs first, then a vowel, a consonant, or the shared Latin fallback; others dropped.
fn tokenize(w: &JsString) -> Vec<Unit> {
    let t = &*T;
    let mut u = Vec::new();
    let mut i = 0;
    let unit = |ch: JsString, kind: Kind, ph: &JsString| Unit {
        ch,
        kind,
        ph: ph.clone(),
        soft: false,
    };
    while i < w.len() {
        let two = w.slice(i as isize, Some(i as isize + 2));
        if let Some(p) = t.cdi.get(&two) {
            u.push(unit(two, Kind::C, p));
            i += 2;
            continue;
        }
        if let Some(p) = t.vdi.get(&two) {
            u.push(unit(two, Kind::V, p));
            i += 2;
            continue;
        }
        let c = w.char_at(i);
        if let Some(p) = t.v.get(&c) {
            u.push(unit(c, Kind::V, p));
        } else if let Some(p) = t.c.get(&c) {
            u.push(unit(c, Kind::C, p));
        } else if let Some(p) = latin_phone(
            &c,
            PhoneOpts {
                initial: i == 0,
                include_h: true,
            },
        ) {
            u.push(unit(c, Kind::C, &p));
        }
        i += 1;
    }
    u
}

/// `triggers(unit)`: the softening ⟨i⟩, ⟨j⟩, ⟨ie⟩, or a single front vowel.
fn triggers(t: &Tables, unit: Option<&Unit>) -> bool {
    let Some(unit) = unit else {
        return false;
    };
    if unit.kind == Kind::SoftI || unit.ch == js("j") || unit.ch == js("ie") {
        return true;
    }
    unit.kind == Kind::V && unit.ch.len() == 1 && t.front.contains(&unit.ch)
}

/// `scan(word)`.
pub fn scan(word: &JsString) -> Vec<Seg> {
    let t = &*T;
    let mut u = tokenize(&word.to_lower_case());
    let n = u.len();
    for i in 1..n.saturating_sub(1) {
        if u[i].ch == js("i")
            && u[i - 1].kind == Kind::C
            && u[i + 1].kind == Kind::V
            && t.back.contains(&u[i + 1].ch.0[0])
        {
            u[i].kind = Kind::SoftI;
        }
    }
    for i in 0..n {
        if u[i].kind == Kind::C && triggers(t, u.get(i + 1)) {
            u[i].soft = true;
        }
    }
    for i in (0..n.saturating_sub(1)).rev() {
        let no_spread = u[i].ch == js("k") || u[i].ch == js("g");
        if u[i].kind == Kind::C
            && !no_spread
            && u[i + 1].kind == Kind::C
            && (u[i + 1].soft || u[i + 1].ch == js("j"))
        {
            u[i].soft = true;
        }
    }
    for i in 1..n {
        let a = u[i].ch == js("a");
        if u[i].kind != Kind::V || !(a || u[i].ch == js("ą")) {
            continue;
        }
        if u[i - 1].ch == js("j") || u[i - 1].kind == Kind::SoftI {
            u[i].ph = js(if a { "ɛ" } else { "ɛː" });
        }
    }
    let mut segs = Vec::new();
    for unit in u {
        match unit.kind {
            Kind::SoftI => {}
            Kind::V => segs.push(Seg {
                ph: unit.ph,
                nucleus: true,
            }),
            Kind::C => {
                let ph = if unit.ch != js("j") && unit.soft {
                    unit.ph.concat(&js("ʲ"))
                } else {
                    unit.ph
                };
                segs.push(Seg { ph, nucleus: false });
            }
        }
    }
    segs
}

/// `nasalAssim(segs)`: n → ŋ before k/ɡ, keeping ʲ.
fn nasal_assim(segs: &mut [Seg]) {
    for i in 0..segs.len().saturating_sub(1) {
        let p = segs[i].ph.clone();
        if (p == js("n") || p == js("nʲ")) && js_re!("^[kɡ]", "").test(&segs[i + 1].ph) {
            segs[i].ph = js(if p == js("nʲ") { "ŋʲ" } else { "ŋ" });
        }
    }
}

/// `applyVoicing(segs)`: the last obstruent of a run sets its voicing; ʲ is kept.
fn apply_voicing(segs: &mut [Seg]) {
    let t = &*T;
    let base = |p: &JsString| js_re!("ʲ$", "u").replace(p, &JsString::new());
    let is_obstruent = |p: &JsString| t.to_voiceless.contains_key(p) || t.to_voiced.contains_key(p);
    for i in (0..segs.len().saturating_sub(1)).rev() {
        let p = base(&segs[i].ph);
        if !is_obstruent(&p) {
            continue;
        }
        let nb = base(&segs[i + 1].ph);
        if !is_obstruent(&nb) {
            continue;
        }
        let map = if t.to_voiceless.contains_key(&nb) {
            &t.to_voiced
        } else {
            &t.to_voiceless
        };
        if let Some(v) = map.get(&p) {
            let soft = segs[i].ph.ends_with(&js("ʲ"));
            segs[i].ph = v.concat(&js(if soft { "ʲ" } else { "" }));
        }
    }
}

/// `toSegments(word)`.
pub fn to_segments(word: &JsString) -> Vec<Seg> {
    let mut segs = scan(word);
    nasal_assim(&mut segs);
    apply_voicing(&mut segs);
    segs
}
