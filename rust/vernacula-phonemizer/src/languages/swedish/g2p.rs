//! Swedish grapheme→phoneme scan: sje/tje sounds, onset softening, retroflex assimilation, silent digraphs,
//! geminates and the complementary vowel-length rule on the stressed syllable; a compound takes its lengths
//! from the NST-long set and softens at the secondary onset too.
//! Ported from src/languages/swedish/g2p.ts — see that file for the corpus evidence.

use std::collections::HashMap;
use std::sync::LazyLock;

use indexmap::IndexMap;

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::js_re;

#[derive(Debug, Clone, PartialEq)]
pub struct Seg {
    pub ph: JsString,
    pub vowel: bool,
}

/// NST compound prosody. Ordinals are `f64` because the TS reads them with `Number(…)`.
#[derive(Debug, Clone, Default)]
pub struct Compound {
    pub sec_ord: f64,
    /// `longOrds` (a `Set<number>`; only membership is read).
    pub long_ords: Vec<f64>,
    pub sec_vowel_initial: bool,
}

struct Tables {
    vowels: Vec<u16>,
    front: Vec<u16>,
    long: HashMap<u16, JsString>,
    short: HashMap<u16, JsString>,
    lbr: HashMap<u16, JsString>,
    sbr: HashMap<u16, JsString>,
    dig: HashMap<JsString, JsString>,
    cons: HashMap<u16, JsString>,
    retro: HashMap<JsString, JsString>,
}

/// A table keyed by one code unit. ⚠ A key of any other length can never equal `w[i]`, so it is dropped.
fn by_unit(m: &IndexMap<String, String>) -> HashMap<u16, JsString> {
    m.iter()
        .filter_map(|(k, v)| {
            let u: Vec<u16> = k.encode_utf16().collect();
            (u.len() == 1).then(|| (u[0], js(v)))
        })
        .collect()
}

fn by_string(m: &IndexMap<String, String>) -> HashMap<JsString, JsString> {
    m.iter().map(|(k, v)| (js(k), js(v))).collect()
}

static T: LazyLock<Tables> = LazyLock::new(|| {
    let v = &MANIFEST.vowels;
    Tables {
        vowels: "aeiouyåäöé".encode_utf16().collect(),
        front: js(&MANIFEST.front_vowels).to_lower_case().0,
        long: by_unit(&v.long),
        short: by_unit(&v.short),
        lbr: by_unit(&v.long_before_r),
        sbr: by_unit(&v.short_before_r),
        dig: by_string(&MANIFEST.digraphs),
        cons: by_unit(&MANIFEST.consonants),
        retro: by_string(&MANIFEST.retroflex),
    }
});

const RETRO_2ND: &str = "tdnsl";

fn is_v(c: Option<u16>) -> bool {
    c.is_some_and(|c| T.vowels.contains(&c))
}

fn is_front(c: Option<u16>) -> bool {
    c.is_some_and(|c| T.front.contains(&c))
}

fn ch(s: &str) -> u16 {
    s.encode_utf16().next().unwrap()
}

/// `stressedLong(w, i)`: coda consonant letters to the next vowel or the end, a retroflex r+dental counting as
/// one and ⟨x⟩ as two; at most one → long.
fn stressed_long(w: &[u16], i: usize) -> bool {
    let (mut j, mut count) = (i + 1, 0);
    while j < w.len() && !is_v(Some(w[j])) {
        if w[j] == ch("r") && j + 1 < w.len() && RETRO_2ND.encode_utf16().any(|r| r == w[j + 1]) {
            count += 1;
            j += 2;
        } else if w[j] == ch("x") {
            count += 2;
            j += 1;
        } else {
            count += 1;
            j += 1;
        }
    }
    count <= 1
}

/// `toSegments(word, stressOrd, oLong, compound)`: one code unit at a time, as the TS indexes it.
pub fn to_segments(
    word: &JsString,
    stress_ord: f64,
    o_long: bool,
    compound: Option<&Compound>,
) -> Vec<Seg> {
    let wj = word.to_lower_case();
    let w = wj.units();
    let n = w.len();
    let at = |k: usize| w.get(k).copied();
    let mut segs: Vec<Seg> = Vec::new();
    let mut i = 0;
    let mut vowel_ord = 0.0_f64;
    let push = |segs: &mut Vec<Seg>, ph: JsString, vowel: bool| segs.push(Seg { ph, vowel });

    while i < n {
        let c = w[i];
        let nx = at(i + 1);
        let nx2 = at(i + 2);
        if c == ch("'") || c == 0x2019 {
            i += 1;
            continue;
        }
        let three = wj.slice(i as isize, Some(i as isize + 3));
        let two = wj.slice(i as isize, Some(i as isize + 2));
        let soften_onset = vowel_ord == 0.0
            || compound.is_some_and(|cp| vowel_ord == cp.sec_ord && !cp.sec_vowel_initial);

        // -tion / -sion
        if i > 0
            && (two == "ti" || two == "si")
            && wj.slice(i as isize, Some(i as isize + 4))
                == JsString::from_units(&[c]).concat(&js("ion"))
        {
            push(&mut segs, js("ɧ"), false);
            push(&mut segs, js("uː"), true);
            push(&mut segs, js("n"), false);
            vowel_ord += 1.0;
            i += 4;
            continue;
        }

        if is_v(Some(c)) {
            let is_primary = vowel_ord == stress_ord;
            let long = match compound {
                Some(cp) => cp.long_ords.contains(&vowel_ord),
                None => is_primary && stressed_long(w, i),
            };
            let before_r = nx == Some(ch("r"));
            let raw = || JsString::from_units(&[c]);
            let ph = if long && o_long && c == ch("o") {
                js("oː")
            } else if long {
                before_r
                    .then(|| T.lbr.get(&c).cloned())
                    .flatten()
                    .or_else(|| T.long.get(&c).cloned())
                    .unwrap_or_else(raw)
            } else {
                before_r
                    .then(|| T.sbr.get(&c).cloned())
                    .flatten()
                    .or_else(|| T.short.get(&c).cloned())
                    .unwrap_or_else(raw)
            };
            push(&mut segs, ph, true);
            vowel_ord += 1.0;
            i += 1;
            continue;
        }

        if i == 0 && nx == Some(ch("j")) && "hldg".encode_utf16().any(|x| x == c) {
            push(&mut segs, js("j"), false);
            i += 2;
            continue;
        }

        if i == 0 && two == "gn" {
            push(&mut segs, js("ɡ"), false);
            push(&mut segs, js("n"), false);
            i += 2;
            continue;
        }

        if let Some(d) = T.dig.get(&three) {
            push(&mut segs, d.clone(), false);
            i += 3;
            continue;
        }

        if two == "sk" && soften_onset && is_front(nx2) {
            push(&mut segs, js("ɧ"), false);
            i += 2;
            continue;
        }

        if c == ch("r")
            && let Some(r) = T.retro.get(&two)
        {
            push(&mut segs, r.clone(), false);
            i += 2;
            continue;
        }

        if let Some(d) = T.dig.get(&two) {
            // `for (const ch of DIG[two])`: one segment per CODE POINT.
            for p in d.code_point_strings() {
                push(&mut segs, p, false);
            }
            i += 2;
            continue;
        }

        if nx == Some(c) && !is_v(Some(c)) {
            if c == ch("g") {
                push(&mut segs, js("ɡː"), false);
            } else if c == ch("k") {
                push(&mut segs, js("kː"), false);
            } else if c == ch("c") {
                if is_front(nx2) || nx2 == Some(ch("é")) {
                    push(&mut segs, js("k"), false);
                    push(&mut segs, js("s"), false);
                } else {
                    push(&mut segs, js("k"), false);
                }
            } else if let Some(p) = T.cons.get(&c) {
                push(&mut segs, p.concat(&js("ː")), false);
            } else {
                let cs = JsString::from_units(&[c]);
                let p = latin_phone(
                    &cs,
                    PhoneOpts {
                        initial: i == 0,
                        include_h: false,
                    },
                );
                push(&mut segs, p.map_or(cs, |p| p.concat(&js("ː"))), false);
            }
            i += 2;
            continue;
        }

        if c == ch("k") {
            let p = if soften_onset && is_front(nx) {
                "ɕ"
            } else {
                "k"
            };
            push(&mut segs, js(p), false);
            i += 1;
            continue;
        }
        if c == ch("g") {
            let prev = segs.last().map(|s| s.ph.clone()).unwrap_or_default();
            // ge/gi/gy/gä/gö in the stressed onset, or r/l + g (berg, älg) → j.
            let p = if (soften_onset && is_front(nx))
                || (!is_v(nx) && js_re!("[rlɭ]$", "").test(&prev))
            {
                "j"
            } else {
                "ɡ"
            };
            push(&mut segs, js(p), false);
            i += 1;
            continue;
        }
        if c == ch("c") {
            let p = if soften_onset && is_front(nx) {
                "s"
            } else {
                "k"
            };
            push(&mut segs, js(p), false);
            i += 1;
            continue;
        }

        if let Some(p) = T.cons.get(&c) {
            push(&mut segs, p.clone(), false);
            i += 1;
            continue;
        }

        let cs = JsString::from_units(&[c]);
        let p = latin_phone(
            &cs,
            PhoneOpts {
                initial: segs.is_empty(),
                include_h: false,
            },
        );
        push(&mut segs, p.unwrap_or(cs), false);
        i += 1;
    }

    segs
}
