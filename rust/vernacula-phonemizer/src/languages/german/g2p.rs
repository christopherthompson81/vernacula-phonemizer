//! German (Standard/Hochdeutsch) grapheme→phoneme scan: vowel length from spelling, diphthongs, the ich/ach
//! split, sch and element-initial sp/st, final devoicing and r-vocalization. Stress is added in german.rs.
//! Ported from src/languages/german/g2p.ts — see that file for the corpus evidence.

use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};
use crate::js_re;

#[derive(Debug, Clone, PartialEq)]
pub struct Seg {
    pub ph: JsString,
    pub s: usize,
    pub vowel: bool,
}

const VOWELS: &str = "aeiouäöüy";
const FULL_VOWEL: &str = "aouäöü";

fn has(set: &str, u: u16) -> bool {
    set.encode_utf16().any(|x| x == u)
}

/// `isV(c)`: `c !== "" && VOWELS.includes(c)` for one code unit (or none).
fn is_v(c: Option<u16>) -> bool {
    c.is_some_and(|u| has(VOWELS, u))
}

/// `set.includes(c)` with `c = w[i] ?? ""`: ⚠ true for the missing letter, as JS `includes("")` is.
fn includes_or_empty(set: &str, c: Option<u16>) -> bool {
    c.is_none_or(|u| has(set, u))
}

fn map(t: &indexmap::IndexMap<String, String>) -> HashMap<JsString, JsString> {
    t.iter().map(|(k, v)| (js(k), js(v))).collect()
}

struct Tables {
    long: HashMap<JsString, JsString>,
    short: HashMap<JsString, JsString>,
    cons: HashMap<JsString, JsString>,
    voiced_final: HashMap<JsString, JsString>,
    short_mono: HashSet<JsString>,
    long_ch: Vec<JsString>,
    st_keep: HashSet<JsString>,
}

static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*MANIFEST;
    Tables {
        long: map(&m.vowels.long),
        short: map(&m.vowels.short),
        cons: map(&m.consonants),
        voiced_final: map(&m.voiced_final),
        short_mono: m.short_monosyllables.iter().map(|w| js(w)).collect(),
        long_ch: m.long_ch.iter().map(|w| js(w)).collect(),
        st_keep: m.morphology.st_keep_words.iter().map(|w| js(w)).collect(),
    }
});

fn at(w: &[u16], i: usize) -> Option<u16> {
    w.get(i).copied()
}

fn is(c: Option<u16>, ch: char) -> bool {
    c == Some(ch as u16)
}

fn cons_run(w: &[u16], mut j: usize) -> usize {
    let mut n = 0;
    while j < w.len() && !is_v(Some(w[j])) {
        n += 1;
        j += 1;
    }
    n
}

fn is_long(word: &JsString, i: usize) -> bool {
    let w = word.units();
    let c = w[i];
    let (nx, nx2) = (at(w, i + 1), at(w, i + 2));
    if T.short_mono.contains(word) {
        return false;
    }
    if is(nx, 'h') {
        return true;
    }
    if nx == Some(c) && has("aeou", c) {
        return true;
    }
    if is(nx, 'ß') {
        return true;
    }
    if is(nx, 'c') && is(nx2, 'h') {
        return T.long_ch.iter().any(|s| word.starts_with(s));
    }
    cons_run(w, i + 1) < 2
}

/// `chSound(prevVowel)`: ⚠ the ach-laut also for an EMPTY previous vowel (`"aou".includes("")`).
fn ch_sound(prev_vowel: Option<u16>) -> &'static str {
    if includes_or_empty("aou", prev_vowel) {
        "x"
    } else {
        "ç"
    }
}

/// `toSegments(word)`: the lowercased word as IPA segments (no stress; devoicing and r-vocalization applied).
pub fn to_segments(word: &JsString) -> Vec<Seg> {
    let wj = word.to_lower_case();
    let w = wj.units();
    let n = w.len();
    let mut segs: Vec<Seg> = Vec::new();
    let mut i = 0;
    fn push(segs: &mut Vec<Seg>, ph: &str, s: usize, vowel: bool) {
        segs.push(Seg {
            ph: js(ph),
            s,
            vowel,
        });
    }
    let mut last_vowel_letter: Option<u16> = None;

    while i < n {
        let c = w[i];
        let (nx, nx2, nx3) = (at(w, i + 1), at(w, i + 2), at(w, i + 3));
        let cc = Some(c);
        let initial = i == 0;

        if (is(cc, 'e') || is(cc, 'a')) && is(nx, 'i') {
            push(&mut segs, "aɪ̯", i, true);
            last_vowel_letter = Some('i' as u16);
            i += 2;
            continue;
        }
        if is(cc, 'a') && is(nx, 'u') {
            push(&mut segs, "aʊ̯", i, true);
            last_vowel_letter = Some('u' as u16);
            i += 2;
            continue;
        }
        if is(cc, 'e') && is(nx, 'u') && is(nx2, 'r') && i + 3 == n {
            push(&mut segs, "øː", i, true);
            push(&mut segs, "ɐ̯", i, false);
            last_vowel_letter = Some('u' as u16);
            i += 3;
            continue;
        }
        if (is(cc, 'e') && is(nx, 'u')) || (is(cc, 'ä') && is(nx, 'u')) {
            push(&mut segs, "ɔʏ̯", i, true);
            last_vowel_letter = Some('u' as u16);
            i += 2;
            continue;
        }
        if is(cc, 't') && is(nx, 'i') && (is(nx2, 'o') || (is(nx2, 'a') && is(nx3, 'l'))) {
            push(&mut segs, "t͡s", i, false);
            push(&mut segs, "i̯", i, false);
            last_vowel_letter = Some('i' as u16);
            i += 2;
            continue;
        }

        if is(cc, 's') && is(nx, 'c') && is(nx2, 'h') {
            push(&mut segs, "ʃ", i, false);
            i += 3;
            continue;
        }
        if is(cc, 's') && is(nx, 's') {
            push(&mut segs, "s", i, false);
            i += 2;
            continue;
        }
        if is(cc, 'ß') {
            push(&mut segs, "s", i, false);
            i += 1;
            continue;
        }
        if is(cc, 's')
            && (is(nx, 'p') || is(nx, 't'))
            && (initial
                || (!T.st_keep.contains(&wj)
                    && js_re!("^(be|ge|ver|zer|ent|emp|er)$").test(&wj.slice(0, Some(i as isize)))))
        {
            push(&mut segs, "ʃ", i, false);
            i += 1;
            continue;
        }
        if is(cc, 'c') && is(nx, 'h') {
            if initial {
                let front = nx2.is_some_and(|u| has("eiäöüy", u));
                push(&mut segs, if front { "ç" } else { "k" }, i, false);
            } else {
                push(&mut segs, ch_sound(last_vowel_letter), i, false);
            }
            i += 2;
            continue;
        }
        if is(cc, 'c') && is(nx, 'k') {
            push(&mut segs, "k", i, false);
            i += 2;
            continue;
        }
        if is(cc, 'g') && i > 0 && is(at(w, i - 1), 'i') && is(nx, 'k') {
            push(&mut segs, "ç", i, false);
            i += 1;
            continue;
        }
        if is(cc, 't') && is(nx, 's') && is(nx2, 'c') && is(nx3, 'h') {
            push(&mut segs, "t͡ʃ", i, false);
            i += 4;
            continue;
        }
        if is(cc, 't') && is(nx, 'z') {
            push(&mut segs, "t͡s", i, false);
            i += 2;
            continue;
        }
        if is(cc, 'd') && is(nx, 't') {
            push(&mut segs, "t", i, false);
            i += 2;
            continue;
        }
        if is(cc, 'p') && is(nx, 'h') {
            push(&mut segs, "f", i, false);
            i += 2;
            continue;
        }
        if is(cc, 'q') && is(nx, 'u') {
            push(&mut segs, "k", i, false);
            push(&mut segs, "v", i, false);
            i += 2;
            continue;
        }
        if is(cc, 'n') && is(nx, 'g') {
            push(&mut segs, "ŋ", i, false);
            i += 2;
            continue;
        }
        if is(cc, 'n') && is(nx, 'k') {
            push(&mut segs, "ŋ", i, false);
            push(&mut segs, "k", i, false);
            i += 2;
            continue;
        }
        if is(cc, 'p') && is(nx, 'f') {
            push(&mut segs, "p", i, false);
            push(&mut segs, "f", i, false);
            i += 2;
            continue;
        }
        if is(cc, 'i') && is(nx, 'g') && nx2.is_none() {
            push(&mut segs, "ɪ", i, true);
            push(&mut segs, "ç", i, false);
            i += 2;
            continue;
        }

        if is_v(cc) {
            last_vowel_letter = cc;
            let seen_vowel = segs.iter().any(|s| s.vowel);
            if is(cc, 'ä') && !is_long(&wj, i) {
                push(&mut segs, "Ɛ", i, true);
                i += 1;
                continue;
            }
            let no_vowel_after = !js_re!("[aeiouäöüy]").test(&wj.slice((i + 1) as isize, None));
            if is(cc, 'e') && is(nx, 'r') && !is_v(nx2) && seen_vowel {
                push(&mut segs, "ɐ", i, true);
                i += 2;
                continue;
            }
            if is(cc, 'i') && is(nx, 'e') {
                let ie_end = i + 2 == n;
                let ien_end = is(nx2, 'n') && i + 3 == n;
                if (ie_end || ien_end) && segs.iter().any(|s| s.vowel) {
                    push(&mut segs, "i̯", i, false);
                    push(&mut segs, "ə", i, true);
                    if ien_end {
                        push(&mut segs, "n", i, false);
                    }
                    i += if ien_end { 3 } else { 2 };
                    continue;
                }
                push(&mut segs, "iː", i, true);
                i += 2;
                continue;
            }
            if is(cc, 'i') && includes_or_empty(FULL_VOWEL, nx) && seen_vowel && i + 2 < n {
                push(&mut segs, "i̯", i, false);
                i += 1;
                continue;
            }
            let ch = JsString::from_units(&[c]);
            if nx == cc && has("aeo", c) {
                segs.push(Seg {
                    ph: T.long[&ch].clone(),
                    s: i,
                    vowel: true,
                });
                i += 2;
                continue;
            }
            if is(cc, 'e') && seen_vowel && no_vowel_after {
                push(&mut segs, "ə", i, true);
                i += 1;
                continue;
            }
            let ph = if is_long(&wj, i) {
                T.long[&ch].clone()
            } else {
                T.short[&ch].clone()
            };
            segs.push(Seg {
                ph,
                s: i,
                vowel: true,
            });
            i += 1;
            continue;
        }

        if is(cc, 'r') {
            let prev_vowel = segs.last().is_some_and(|s| s.vowel);
            if is(nx, 'r') {
                i += 1;
            }
            let after = at(w, i + 1);
            let coda = after.is_none() || !is_v(after);
            if coda && prev_vowel {
                push(&mut segs, "ɐ̯", i, false);
            } else {
                push(&mut segs, "ʁ", i, false);
            }
            i += 1;
            continue;
        }

        let prev = if i > 0 { at(w, i - 1) } else { None };
        if is(cc, 'h') {
            if is(prev, 't') && (i == 1 || i == n - 1) {
                // word-edge ⟨th⟩: silent
            } else if !is_v(prev)
                || (nx.is_some()
                    && includes_or_empty(FULL_VOWEL, nx)
                    && js_re!("(be|ge|ver|zer|er|vor|zu|un|emp|ent|miss)$")
                        .test(&wj.slice(0, Some(i as isize))))
            {
                push(&mut segs, "h", i, false);
            }
        } else if is(cc, 's') {
            push(&mut segs, if is_v(nx) { "z" } else { "s" }, i, false);
        } else if is(cc, 'x') {
            push(&mut segs, "k", i, false);
            push(&mut segs, "s", i, false);
        } else if let Some(cp) = T.cons.get(&JsString::from_units(&[c])) {
            segs.push(Seg {
                ph: cp.clone(),
                s: i,
                vowel: false,
            });
        }
        i += 1;
    }

    let mut out: Vec<Seg> = Vec::new();
    for s in segs {
        if let Some(prev) = out.last()
            && !prev.vowel
            && !s.vowel
            && prev.ph == s.ph
            && s.ph.len() == 1
        {
            continue;
        }
        out.push(s);
    }
    final_devoice(&mut out);
    out
}

/// `finalDevoice`: a voiced obstruent devoices word-finally, before a voiceless obstruent, or before another
/// voiced obstruent that will itself devoice.
fn final_devoice(segs: &mut [Seg]) {
    for k in 0..segs.len() {
        let Some(dev) = T.voiced_final.get(&segs[k].ph).filter(|d| !d.is_empty()) else {
            continue;
        };
        let devoice = match segs.get(k + 1) {
            None => true,
            Some(next) => {
                !next.vowel
                    && ((!next.ph.is_empty() && has("ptksfçxʃ", next.ph.units()[0]))
                        || T.voiced_final.get(&next.ph).is_some_and(|d| !d.is_empty()))
            }
        };
        if devoice {
            segs[k].ph = dev.clone();
        }
    }
}
