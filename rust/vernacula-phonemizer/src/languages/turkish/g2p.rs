//! Turkish grapheme→phoneme scan: phonemic vowels, k/g palatalization and dark/clear l by the neighbouring
//! vowel, ğ as a glide or a lengthening, geminate stops, and nasal place assimilation; plus `trLower`.
//! Ported from src/languages/turkish/g2p.ts — see that file for the corpus evidence.

use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};
use crate::js_re;

#[derive(Debug, Clone, PartialEq)]
pub struct Seg {
    pub ph: JsString,
    pub nucleus: bool,
}

struct Tables {
    vowel_ipa: HashMap<JsString, JsString>,
    front: HashSet<JsString>,
    front_unround: HashSet<JsString>,
    back: HashSet<JsString>,
    cons_ipa: HashMap<JsString, JsString>,
    geminate: HashSet<JsString>,
    circumflex_fold: HashMap<JsString, JsString>,
}

fn map(m: &indexmap::IndexMap<String, String>) -> HashMap<JsString, JsString> {
    m.iter().map(|(k, v)| (js(k), js(v))).collect()
}

fn set(v: &[String]) -> HashSet<JsString> {
    v.iter().map(|s| js(s)).collect()
}

static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*MANIFEST;
    Tables {
        vowel_ipa: map(&m.vowels.ipa),
        front: set(&m.vowels.front),
        front_unround: set(&m.vowels.front_unround),
        back: set(&m.vowels.back),
        cons_ipa: map(&m.consonants),
        geminate: set(&m.geminate),
        circumflex_fold: map(&m.circumflex_fold),
    }
});

/// `trLower(word)`: İ→i and I→ı, THEN plain `toLowerCase()` (not a Turkish-locale one), then the circumflex
/// fold. ⚠ The order is the behaviour: `toLowerCase` first would turn İ into i + U+0307 and I into i.
pub fn tr_lower(word: &JsString) -> JsString {
    let s = js_re!("İ", "g").replace(word, &js("i"));
    let s = js_re!("I", "g").replace(&s, &js("ı"));
    let s = s.to_lower_case();
    js_re!("[âîû]", "g").replace_with(&s, |m, s| {
        let c = m.value(s);
        T.circumflex_fold.get(&c).cloned().unwrap_or(c)
    })
}

/// `toSegments(word)`, over the code points of `trLower(word)`.
pub fn to_segments(word: &JsString) -> Vec<Seg> {
    let t = &*T;
    let chars = tr_lower(word).code_point_strings();
    let empty = JsString::new();
    // `c !== "" && c in VOWEL_IPA` — no Object.prototype member is one code point.
    let is_vowel = |c: &JsString| !c.is_empty() && t.vowel_ipa.contains_key(c);
    let mut segs: Vec<Seg> = Vec::new();
    let mut prev_vowel = JsString::new();
    let mut g_merge = JsString::new();
    let ri = js("ı");
    let sl = js("l");
    let sk = js("k");
    let sg = js("g");
    let soft_g = js("ğ");
    for i in 0..chars.len() {
        let c = &chars[i];
        let next = chars.get(i + 1).unwrap_or(&empty);
        let prev_c = if i == 0 { &empty } else { &chars[i - 1] };
        if let Some(v) = t.vowel_ipa.get(c) {
            if g_merge == *c && *c != ri {
                g_merge = JsString::new();
                prev_vowel = c.clone();
                continue;
            }
            g_merge = JsString::new();
            segs.push(Seg {
                ph: v.clone(),
                nucleus: true,
            });
            prev_vowel = c.clone();
            continue;
        }
        g_merge = JsString::new();
        if c == prev_c && t.geminate.contains(c) {
            segs.push(Seg {
                ph: js("ː"),
                nucleus: false,
            });
            continue;
        }
        if *c == soft_g {
            if t.front_unround.contains(&prev_vowel) {
                segs.push(Seg {
                    ph: js("j"),
                    nucleus: false,
                });
            } else if let Some(last) = segs.last_mut() {
                // ⚠ The LAST segment, which may be a consonant (a ğ after a consonant lengthens it).
                last.ph.push_str(&js("ː"));
                g_merge = prev_vowel.clone();
            }
            continue;
        }
        let ctx = if is_vowel(next) { next } else { &prev_vowel };
        let ph = if *c == sl {
            if t.back.contains(ctx) { "ɫ" } else { "l" }
        } else if *c == sk {
            if t.front.contains(ctx) { "c" } else { "k" }
        } else if *c == sg {
            if t.front.contains(ctx) { "ɟ" } else { "ɡ" }
        } else {
            if let Some(cons) = t.cons_ipa.get(c) {
                segs.push(Seg {
                    ph: cons.clone(),
                    nucleus: false,
                });
            }
            continue;
        };
        segs.push(Seg {
            ph: js(ph),
            nucleus: false,
        });
    }
    let (n, k, g, c, gy) = (js("n"), js("k"), js("ɡ"), js("c"), js("ɟ"));
    for i in 0..segs.len().saturating_sub(1) {
        if segs[i].ph != n {
            continue;
        }
        let nx = &segs[i + 1].ph;
        if *nx == k || *nx == g {
            segs[i].ph = js("ŋ");
        } else if *nx == c || *nx == gy {
            segs[i].ph = js("ɲ");
        }
    }
    segs
}
