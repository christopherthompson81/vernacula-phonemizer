//! Irish grapheme→phoneme scanner over the broad/slender axis: word-initial eclipsis, lenition digraphs, doubled
//! consonants, longest-match vowel clusters, and each consonant's quality from its flanking vowel letters.
//! Ported from src/languages/irish/g2p.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use indexmap::IndexMap;

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::js_re;

/// `VOWEL_CLUSTERS`: the manifest's vowel keys, longest first (a stable sort: equal lengths keep its order).
static VOWEL_CLUSTERS: LazyLock<Vec<JsString>> = LazyLock::new(|| {
    let mut keys: Vec<JsString> = MANIFEST.vowels.keys().map(|k| js(k)).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.len()));
    keys
});
static SLENDER_V: LazyLock<JsString> = LazyLock::new(|| js(&MANIFEST.slender_vowels));
static VOWELS: LazyLock<JsString> = LazyLock::new(|| SLENDER_V.concat(&js(&MANIFEST.broad_vowels)));

fn is_vowel(c: &JsString) -> bool {
    !c.is_empty() && VOWELS.includes(c)
}

fn is_slender_v(c: &JsString) -> bool {
    !c.is_empty() && SLENDER_V.includes(c)
}

/// `ECLIPSIS[two]`.
fn eclipsis(two: &JsString) -> Option<&'static str> {
    [
        ("mb", "m"),
        ("gc", "g"),
        ("nd", "n"),
        ("bp", "b"),
        ("dt", "d"),
        ("ts", "t"),
    ]
    .iter()
    .find(|(k, _)| *two == *k)
    .map(|(_, v)| *v)
}

#[derive(Debug, Clone)]
pub struct Seg {
    pub ph: JsString,
    pub nucleus: bool,
    pub no_glide: bool,
}

/// `w[i] ?? ""` (one code unit), with a negative index reading as past the end.
fn unit(w: &JsString, i: isize) -> JsString {
    if i >= 0 && (i as usize) < w.len() {
        w.char_at(i as usize)
    } else {
        JsString::new()
    }
}

fn get<'a>(t: &'a IndexMap<String, String>, k: &JsString) -> Option<&'a String> {
    t.get(&k.to_string_lossy())
}

/// `consonantSlender(w, i)`: the quality of the consonant at `i` from the adjacent vowel letters.
fn consonant_slender(w: &JsString, i: usize) -> bool {
    let c = unit(w, i as isize);
    if c == "r" && i == 0 {
        return false;
    }
    let (nx, pv) = (unit(w, i as isize + 1), unit(w, i as isize - 1));
    if is_vowel(&nx) {
        return is_slender_v(&nx);
    }
    if is_vowel(&pv) {
        return is_slender_v(&pv);
    }
    if c == "s" {
        return false;
    }
    for j in i + 1..w.len() {
        let wj = w.char_at(j);
        if is_vowel(&wj) {
            return is_slender_v(&wj);
        }
    }
    false
}

/// `toSegments(word)`: the scan over the lowercased word, one CODE UNIT at a time.
pub fn to_segments(word: &JsString) -> Vec<Seg> {
    let w = word.to_lower_case();
    let n = w.len();
    let mut segs: Vec<Seg> = Vec::new();
    let cons = |segs: &mut Vec<Seg>, ph: &JsString| {
        if !ph.is_empty() {
            segs.push(Seg {
                ph: ph.clone(),
                nucleus: false,
                no_glide: false,
            });
        }
    };
    let quality = |slender: bool| {
        if slender {
            &MANIFEST.slender
        } else {
            &MANIFEST.broad
        }
    };
    let mut i = 0;
    while i < n {
        let c = w.char_at(i);
        let two = w.slice(i as isize, Some(i as isize + 2));

        if i == 0 {
            let slender = consonant_slender(&w, 0);
            if w.slice(0, Some(3)) == "bhf" {
                cons(&mut segs, &js(if slender { "vʲ" } else { "w" }));
                i += 3;
                continue;
            }
            if two == "ng" {
                cons(&mut segs, &js(if slender { "ɲ" } else { "ŋ" }));
                i += 2;
                continue;
            }
            if let Some(e) = eclipsis(&two) {
                if let Some(ph) = quality(slender).get(e) {
                    cons(&mut segs, &js(ph));
                }
                i += 2;
                continue;
            }
        }

        if (two == "dh" || two == "gh") && i + 2 == n && !segs.is_empty() {
            i += 2;
            continue;
        }

        let lenition = MANIFEST.lenition.get(&two.to_string_lossy());
        if let Some(pair) = lenition {
            let slender = consonant_slender(&w, i);
            cons(&mut segs, &js(&pair[if slender { 1 } else { 0 }]));
            i += 2;
            continue;
        }

        if c == unit(&w, i as isize + 1) && !is_vowel(&c) {
            if let Some(ph) = get(quality(consonant_slender(&w, i)), &c) {
                cons(&mut segs, &js(ph));
            }
            i += 2;
            continue;
        }

        if is_vowel(&c) {
            let rest = w.slice(i as isize, None);
            if let Some(key) = VOWEL_CLUSTERS.iter().find(|k| rest.starts_with(k)) {
                segs.push(Seg {
                    ph: js(&MANIFEST.vowels[&key.to_string_lossy()]),
                    nucleus: true,
                    no_glide: js_re!("^e[oó]").test(key),
                });
                i += key.len();
                continue;
            }
            segs.push(Seg {
                ph: c,
                nucleus: true,
                no_glide: false,
            });
            i += 1;
            continue;
        }

        if let Some(ph) = get(quality(consonant_slender(&w, i)), &c) {
            cons(&mut segs, &js(ph));
        } else if let Some(p) = latin_phone(
            &c,
            PhoneOpts {
                initial: segs.is_empty(),
                include_h: false,
            },
        ) {
            cons(&mut segs, &p);
        } else if js_re!("[a-z]").test(&c) {
            cons(&mut segs, &c);
        }
        i += 1;
    }
    segs
}
