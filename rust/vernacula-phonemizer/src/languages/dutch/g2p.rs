//! Dutch (Northern Standard) grapheme→phoneme scan: open/closed-syllable vowel length, the diphthongs, the g→ɣ/x
//! split, sch→sx, w→ʋ, h→ɦ, the unstressed -lijk/-ig/-isch and schwa reductions, and final devoicing. Stress is
//! added in dutch.rs. Ported from src/languages/dutch/g2p.ts — see that file for the corpus evidence.

use std::collections::HashMap;
use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::latin_phones::{PhoneOpts, latin_phone};

#[derive(Debug, Clone, PartialEq)]
pub struct Seg {
    pub ph: JsString,
    pub s: usize,
    pub vowel: bool,
}

fn map(t: &indexmap::IndexMap<String, String>) -> HashMap<JsString, JsString> {
    t.iter().map(|(k, v)| (js(k), js(v))).collect()
}

struct Tables {
    long: HashMap<JsString, JsString>,
    short: HashMap<JsString, JsString>,
    cons: HashMap<JsString, JsString>,
    voiced_final: HashMap<JsString, JsString>,
    vowels: Vec<u16>,
    /// `new RegExp(`[${VOWELS}]`, "u")`, built once (the TS builds it per call; same pattern).
    any_vowel: JsRegex,
}

static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*MANIFEST;
    Tables {
        long: map(&m.vowels.long),
        short: map(&m.vowels.short),
        cons: map(&m.consonants),
        voiced_final: map(&m.voiced_final),
        vowels: m.vowel_letters.encode_utf16().collect(),
        any_vowel: JsRegex::new(&format!("[{}]", m.vowel_letters), "u").unwrap(),
    }
});

fn has(set: &str, u: u16) -> bool {
    set.encode_utf16().any(|x| x == u)
}

/// `isV(c)`: `c !== "" && VOWELS.includes(c)` for one code unit (or none).
fn is_v(c: Option<u16>) -> bool {
    c.is_some_and(|u| T.vowels.contains(&u))
}

fn is_liquid(c: Option<u16>) -> bool {
    is(c, 'l') || is(c, 'r')
}

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

/// `fullVowel(w, i)`: the FULL reading of the single plain vowel letter at i under the open/closed length rule
/// (#1550), for a prefix shift landing on a reduced stem ⟨e⟩.
pub fn full_vowel(w: &JsString, i: usize) -> JsString {
    let ch = JsString::from_units(&[w.0[i]]);
    let table = if is_open(&w.0, i) { &T.long } else { &T.short };
    table.get(&ch).cloned().unwrap_or(ch)
}

/// `isOpen(w, i)`: word-final or hiatus, or one consonant then a vowel.
fn is_open(w: &[u16], i: usize) -> bool {
    match cons_run(w, i + 1) {
        0 => true,
        1 => is_v(at(w, i + 2)),
        _ => false,
    }
}

/// The base letter an accented vowel reads as under the length rule.
fn base_of(c: u16) -> u16 {
    if has("áàâä", c) {
        'a' as u16
    } else if has("éèêë", c) {
        'e' as u16
    } else if has("íìîï", c) {
        'i' as u16
    } else if has("óòô", c) {
        'o' as u16
    } else if has("úùû", c) {
        'u' as u16
    } else {
        c
    }
}

/// `toSegments(word)`: the lowercased word as IPA segments (no stress; g/ch voicing and devoicing applied).
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

    while i < n {
        let c = w[i];
        let cc = Some(c);
        let (nx, nx2, nx3) = (at(w, i + 1), at(w, i + 2), at(w, i + 3));
        let seen_vowel = segs.iter().any(|s| s.vowel);

        if is(cc, 'l') && is(nx, 'i') && is(nx2, 'j') && is(nx3, 'k') && i > 0 {
            push(&mut segs, "l", i, false);
            push(&mut segs, "ə", i, true);
            push(&mut segs, "k", i, false);
            i += 4;
            continue;
        }

        if is(cc, 'i') && is(nx, 'e') && is(nx2, 'u') && is(nx3, 'w') {
            push(&mut segs, "i", i, true);
            push(&mut segs, "u̯", i, false);
            i += 4;
            continue;
        }
        if is(cc, 'e') && is(nx, 'e') && is(nx2, 'u') && is(nx3, 'w') {
            push(&mut segs, "eː", i, true);
            push(&mut segs, "u̯", i, false);
            i += 4;
            continue;
        }
        if is(cc, 'a') && is(nx, 'a') && is(nx2, 'i') {
            push(&mut segs, "aː", i, true);
            push(&mut segs, "i̯", i, false);
            i += 3;
            continue;
        }
        if is(cc, 'o') && is(nx, 'o') && is(nx2, 'i') {
            push(&mut segs, "oː", i, true);
            push(&mut segs, "i̯", i, false);
            i += 3;
            continue;
        }
        if is(cc, 'o') && is(nx, 'e') && is(nx2, 'i') {
            push(&mut segs, "u", i, true);
            push(&mut segs, "i̯", i, false);
            i += 3;
            continue;
        }

        if is(cc, 'i') && (is(nx, 'j') || is(nx, 'e')) {
            push(&mut segs, if is(nx, 'j') { "ɛi̯" } else { "i" }, i, true);
            i += 2;
            continue;
        }
        if (is(cc, 'e') || is(cc, 'a')) && is(nx, 'i') {
            push(&mut segs, "ɛi̯", i, true);
            i += 2;
            continue;
        }
        if is(cc, 'u') && is(nx, 'i') {
            push(&mut segs, "œy̯", i, true);
            i += 2;
            continue;
        }
        if (is(cc, 'o') || is(cc, 'a')) && is(nx, 'u') {
            push(&mut segs, "ɑu̯", i, true);
            i += if is(nx2, 'w') { 3 } else { 2 };
            continue;
        }
        if is(cc, 'e') && is(nx, 'u') {
            push(&mut segs, "øː", i, true);
            i += 2;
            continue;
        }
        if is(cc, 'o') && is(nx, 'e') {
            push(&mut segs, "u", i, true);
            i += 2;
            continue;
        }
        if nx == cc && has("aeou", c) {
            let ph = T.long[&JsString::from_units(&[c])].clone();
            segs.push(Seg {
                ph,
                s: i,
                vowel: true,
            });
            i += 2;
            continue;
        }

        if is(cc, 's') && is(nx, 'c') && is(nx2, 'h') {
            push(&mut segs, "s", i, false);
            if is_v(nx3) {
                push(&mut segs, "x", i, false);
            }
            i += 3;
            continue;
        }
        if is(cc, 'c') && is(nx, 'h') {
            push(&mut segs, "x", i, false);
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
        if is(cc, 't') && is(nx, 'h') {
            push(&mut segs, "t", i, false);
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
            push(&mut segs, "ʋ", i, false);
            i += 2;
            continue;
        }
        if is(cc, 's') && is(nx, 'j') {
            push(&mut segs, "ʃ", i, false);
            i += 2;
            continue;
        }

        if is_v(cc) {
            if is(cc, 'i') && is(nx, 'g') && nx2.is_none() && seen_vowel {
                push(&mut segs, "ə", i, true);
                push(&mut segs, "x", i, false);
                i += 2;
                continue;
            }
            if is(cc, 'i') && is(nx, 's') && is(nx2, 'c') && is(nx3, 'h') && i + 4 == n {
                push(&mut segs, "i", i, true);
                push(&mut segs, "s", i, false);
                i += 4;
                continue;
            }
            if is(cc, 'e') && seen_vowel {
                push(&mut segs, "ə", i, true);
                i += 1;
                continue;
            }
            if is(cc, 'ë') && seen_vowel && !T.any_vowel.test(&wj.slice((i + 1) as isize, None)) {
                push(&mut segs, "ə", i, true);
                i += 1;
                continue;
            }
            let base = JsString::from_units(&[base_of(c)]);
            let ch = JsString::from_units(&[c]);
            let pick = |t: &HashMap<JsString, JsString>| {
                t.get(&base)
                    .or_else(|| t.get(&ch))
                    .cloned()
                    .unwrap_or_default()
            };
            let ph = if is_open(w, i) {
                pick(&T.long)
            } else {
                pick(&T.short)
            };
            segs.push(Seg {
                ph,
                s: i,
                vowel: true,
            });
            i += 1;
            continue;
        }

        if is(cc, 'g') {
            let onset = is_v(nx) || (is(nx, 'g') && is_v(nx2)) || (is_liquid(nx) && is_v(nx2));
            push(&mut segs, if onset { "ɣ" } else { "x" }, i, false);
            if is(nx, 'g') {
                i += 1;
            }
            i += 1;
            continue;
        }
        if is(cc, 'c') {
            let soft = nx.is_some_and(|u| has("eiyíé", u));
            push(&mut segs, if soft { "s" } else { "k" }, i, false);
            i += 1;
            continue;
        }
        if is(cc, 'h') {
            push(&mut segs, "ɦ", i, false);
            i += 1;
            continue;
        }
        if is(cc, 'x') {
            push(&mut segs, "k", i, false);
            push(&mut segs, "s", i, false);
            i += 1;
            continue;
        }
        if is(cc, 'r') && is(nx, 'r') {
            i += 1;
            continue;
        }
        if is(cc, 'ñ') {
            push(&mut segs, "n", i, false);
            push(&mut segs, "j", i, false);
            i += 1;
            continue;
        }
        let ch = JsString::from_units(&[c]);
        let ph = T.cons.get(&ch).cloned().or_else(|| {
            latin_phone(
                &ch,
                PhoneOpts {
                    initial: i == 0,
                    ..Default::default()
                },
            )
        });
        if let Some(ph) = ph {
            segs.push(Seg {
                ph,
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
                    && ((!next.ph.is_empty() && has("ptksfxʃ", next.ph.units()[0]))
                        || T.voiced_final.get(&next.ph).is_some_and(|d| !d.is_empty()))
            }
        };
        if devoice {
            segs[k].ph = dev.clone();
        }
    }
}
