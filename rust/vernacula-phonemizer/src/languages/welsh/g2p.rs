//! Welsh grapheme→phoneme scanner: digraphs, the word-initial nasal mutation, vowel clusters longest-first, and the
//! context rules for ⟨si⟩, consonantal ⟨w i⟩ and obscure/clear ⟨y⟩. Stress and length are welsh.rs.
//! Ported from src/languages/welsh/g2p.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::js_re;

/// `VOWEL_CLUSTERS`: the manifest's vowel keys, longest first. `sort` is stable, so equal lengths keep the
/// manifest's order.
static VOWEL_CLUSTERS: LazyLock<Vec<JsString>> = LazyLock::new(|| {
    let mut keys: Vec<JsString> = MANIFEST.vowels.keys().map(|k| js(k)).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.len()));
    keys
});
static OBSCURE_Y: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.obscure_y.iter().map(|w| js(w)).collect());
/// The single-UNIT vowel keys, plus ⟨y⟩.
static VOWEL_LETTERS: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    let mut s: HashSet<JsString> = MANIFEST
        .vowels
        .keys()
        .map(|k| js(k))
        .filter(|k| k.len() == 1)
        .collect();
    s.insert(js("y"));
    s
});

fn is_vowel_letter(c: &JsString) -> bool {
    !c.is_empty() && VOWEL_LETTERS.contains(c)
}

/// One code unit of `w` at `i`, or "" past the end (`w[i] ?? ""`).
fn unit(w: &JsString, i: usize) -> JsString {
    if i < w.len() {
        w.char_at(i)
    } else {
        JsString::new()
    }
}

/// A truthy manifest lookup (`TABLE[k]` with a non-empty value).
fn look<'a>(t: &'a indexmap::IndexMap<String, String>, k: &JsString) -> Option<&'a String> {
    t.get(&k.to_string_lossy()).filter(|v| !v.is_empty())
}

#[derive(Debug, Clone)]
pub struct Seg {
    pub ph: JsString,
    pub nucleus: bool,
    pub long: bool,
}

fn seg(ph: JsString, nucleus: bool, long: bool) -> Seg {
    Seg { ph, nucleus, long }
}

fn vowel_after(w: &JsString, i: usize) -> bool {
    (i..w.len()).any(|j| is_vowel_letter(&w.char_at(j)))
}

/// `toSegments(word)`: the scan over the lowercased word, one CODE UNIT at a time.
pub fn to_segments(word: &JsString) -> Vec<Seg> {
    let w = word.to_lower_case();
    let n = w.len();
    let obscure_word = OBSCURE_Y.contains(&js_re!(r"['’]", "g").replace(&w, &JsString::new()));
    let mut segs: Vec<Seg> = Vec::new();
    let mut i = 0;
    let at = |a: usize, b: usize| w.slice(a as isize, Some(b as isize));
    while i < n {
        let c = w.char_at(i);
        let three = at(i, i + 3);
        let two = at(i, i + 2);

        if i == 0 {
            if let Some(ph) = look(&MANIFEST.nasal_mutation, &three) {
                segs.push(seg(js(ph), false, false));
                i += 3;
                continue;
            }
            if let Some(ph) = look(&MANIFEST.nasal_mutation, &two) {
                segs.push(seg(js(ph), false, false));
                i += 2;
                continue;
            }
        }

        if let Some(ph) = look(&MANIFEST.digraphs, &two) {
            segs.push(seg(js(ph), false, false));
            i += 2;
            continue;
        }

        if c == "s" && unit(&w, i + 1) == "i" && is_vowel_letter(&unit(&w, i + 2)) {
            segs.push(seg(js("ʃ"), false, false));
            i += 2;
            continue;
        }

        if is_vowel_letter(&c) {
            let mut key = VOWEL_CLUSTERS
                .iter()
                .find(|k| k.len() >= 2 && w.slice(i as isize, None).starts_with(k))
                .cloned();
            let pph = segs.last().map(|s| s.ph.clone());
            if key.as_ref().is_some_and(|k| *k == "wy")
                && pph.as_ref().is_some_and(|p| *p == "ɡ" || *p == "χ")
            {
                key = None;
            }
            if let Some(key) = key {
                let mut ph = js(&MANIFEST.vowels[&key.to_string_lossy()]);
                if key == "au" && i + 2 == w.len() && segs.iter().any(|s| s.nucleus) {
                    ph = js(MANIFEST.vowels.get("a").map_or("a", |v| v.as_str()));
                }
                let long = ph.includes(&js("ː")) || js_re!("[ᶤᶦᶷᵘ]").test(&ph);
                segs.push(seg(ph, true, long));
                i += key.len();
                continue;
            }
            let prev_g = segs.last().is_some_and(|s| s.ph == "ɡ");
            if c == "w" && (is_vowel_letter(&unit(&w, i + 1)) || prev_g) {
                segs.push(seg(js("w"), false, false));
                i += 1;
                continue;
            }
            if c == "i" && is_vowel_letter(&unit(&w, i + 1)) {
                segs.push(seg(js("j"), false, false));
                i += 1;
                continue;
            }
            if c == "y" {
                let clear = !obscure_word
                    && (!vowel_after(&w, i + 1) || segs.last().is_some_and(|s| s.ph == "w"));
                segs.push(seg(js(if clear { "ɨ" } else { "ə" }), true, false));
                i += 1;
                continue;
            }
            let ph = MANIFEST
                .vowels
                .get(&c.to_string_lossy())
                .map_or_else(|| c.clone(), |v| js(v));
            let long = ph.includes(&js("ː"));
            segs.push(seg(ph, true, long));
            i += 1;
            continue;
        }

        if let Some(ph) = look(&MANIFEST.consonants, &c) {
            segs.push(seg(js(ph), false, false));
        } else {
            let p = latin_phone(
                &c,
                PhoneOpts {
                    initial: segs.is_empty(),
                    include_h: false,
                },
            );
            if let Some(p) = p {
                segs.push(seg(p, false, false));
            } else if js_re!("[a-z]").test(&c) {
                segs.push(seg(c, false, false));
            }
        }
        i += 1;
    }
    segs
}
