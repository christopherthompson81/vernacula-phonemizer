//! Latvian grapheme→phoneme segments: written palatals and length direct, native ⟨o⟩ → [uɔ̯], the falling
//! diphthongs' offglides, ⟨ie⟩, ⟨v⟩ → [w] before a non-vowel, n → ŋ before a velar, regressive devoicing.
//! Ported from src/languages/latvian/g2p.ts — see that file for the evidence.

use std::collections::HashMap;
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

struct Tables {
    v: HashMap<JsString, JsString>,
    lv: HashMap<JsString, JsString>,
    c: HashMap<JsString, JsString>,
    cdi: HashMap<JsString, JsString>,
    to_voiceless: HashMap<JsString, JsString>,
    to_voiced: HashMap<JsString, JsString>,
}

static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*MANIFEST;
    let map =
        |t: &indexmap::IndexMap<String, String>| t.iter().map(|(k, v)| (js(k), js(v))).collect();
    Tables {
        v: map(&m.vowels),
        lv: map(&m.long_vowels),
        c: map(&m.consonants),
        cdi: map(&m.consonant_digraphs),
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
    let w = word.to_lower_case().code_point_strings();
    let empty = JsString::new();
    let at = |i: usize| w.get(i).unwrap_or(&empty);
    let is_vowel_char = |c: &JsString| {
        !c.is_empty() && (t.v.contains_key(c) || t.lv.contains_key(c) || *c == js("o"))
    };
    let mut segs = Vec::new();
    let mut i = 0;
    // `vowel(ph)`: the nucleus, and ⟨i⟩/⟨u⟩ after one of the real pairs as a non-syllabic offglide.
    let vowel = |segs: &mut Vec<Seg>, ph: &JsString, i: &mut usize| {
        segs.push(Seg {
            ph: ph.clone(),
            nucleus: true,
        });
        let nx = at(*i + 1);
        let s = ph.to_string_lossy();
        let i_glide = *nx == js("i") && matches!(s.as_str(), "a" | "ɛ" | "u");
        let u_glide = *nx == js("u") && matches!(s.as_str(), "a" | "i");
        if i_glide || u_glide {
            segs.push(Seg {
                ph: t.v[nx].clone(),
                nucleus: false,
            });
            *i += 1;
        }
    };
    while i < w.len() {
        let c = &w[i];
        let two = c.concat(at(i + 1));
        if let Some(p) = t.cdi.get(&two) {
            segs.push(Seg {
                ph: p.clone(),
                nucleus: false,
            });
            i += 2;
            continue;
        }
        if two == js("ie") {
            segs.push(seg("i", true));
            segs.push(seg("ɛ", false));
            i += 2;
            continue;
        }
        if let Some(p) = t.lv.get(c) {
            vowel(&mut segs, p, &mut i);
        } else if *c == js("o") {
            segs.push(seg("u", true));
            segs.push(seg("ɔ̯", false));
        } else if let Some(p) = t.v.get(c) {
            vowel(&mut segs, p, &mut i);
        } else if *c == js("v") {
            segs.push(seg(if is_vowel_char(at(i + 1)) { "v" } else { "w" }, false));
        } else if let Some(p) = t.c.get(c) {
            segs.push(Seg {
                ph: p.clone(),
                nucleus: false,
            });
        } else if let Some(p) = latin_phone(
            c,
            PhoneOpts {
                initial: i == 0,
                include_h: true,
            },
        ) {
            segs.push(Seg {
                ph: p,
                nucleus: false,
            });
        }
        i += 1;
    }
    segs
}

/// `nasalAssim(segs)`: n → ŋ before k/ɡ.
fn nasal_assim(segs: &mut [Seg]) {
    for i in 0..segs.len().saturating_sub(1) {
        if segs[i].ph == js("n") && js_re!("^[kɡ]", "").test(&segs[i + 1].ph) {
            segs[i].ph = js("ŋ");
        }
    }
}

/// `applyVoicing(segs)`: a voiced obstruent devoices before a voiceless one (never the reverse).
fn apply_voicing(segs: &mut [Seg]) {
    let t = &*T;
    for i in (0..segs.len().saturating_sub(1)).rev() {
        if let Some(v) = t.to_voiceless.get(&segs[i].ph)
            && t.to_voiced.contains_key(&segs[i + 1].ph)
        {
            segs[i].ph = v.clone();
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
