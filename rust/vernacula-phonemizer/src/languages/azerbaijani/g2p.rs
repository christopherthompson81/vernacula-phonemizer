//! Azerbaijani grapheme→phoneme scan: phonemic vowels, k palatalized and l dark/clear by the neighbouring vowel,
//! g → ɟ, q → ɡ (x word-finally), ğ → ɣ, geminate stops, nasal place assimilation; plus `azLower`.
//! Ported from src/languages/azerbaijani/g2p.ts — see that file for the corpus evidence.

use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::js_re;

#[derive(Debug, Clone, PartialEq)]
pub struct Seg {
    pub ph: JsString,
    pub nucleus: bool,
}

struct Tables {
    vowel_ipa: HashMap<JsString, JsString>,
    front: HashSet<JsString>,
    back: HashSet<JsString>,
    cons_ipa: HashMap<JsString, JsString>,
    geminate: HashSet<JsString>,
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
        back: set(&m.vowels.back),
        cons_ipa: map(&m.consonants),
        geminate: set(&m.geminate),
    }
});

/// `azLower(word)`: İ→i and I→ı, THEN plain `toLowerCase()`.
pub fn az_lower(word: &JsString) -> JsString {
    let s = js_re!("İ", "g").replace(word, &js("i"));
    js_re!("I", "g").replace(&s, &js("ı")).to_lower_case()
}

fn seg(ph: &str) -> Seg {
    Seg {
        ph: js(ph),
        nucleus: false,
    }
}

/// `toSegments(word)`, over the code points of `azLower(word)`.
pub fn to_segments(word: &JsString) -> Vec<Seg> {
    let t = &*T;
    let chars = az_lower(word).code_point_strings();
    let empty = JsString::new();
    // `c !== "" && c in VOWEL_IPA` — no Object.prototype member is one code point.
    let is_vowel = |c: &JsString| !c.is_empty() && t.vowel_ipa.contains_key(c);
    let mut segs: Vec<Seg> = Vec::new();
    let mut prev_vowel = JsString::new();
    for i in 0..chars.len() {
        let c = &chars[i];
        let next = chars.get(i + 1).unwrap_or(&empty);
        let prev_c = if i == 0 { &empty } else { &chars[i - 1] };
        let word_final = i == chars.len() - 1;
        if let Some(v) = t.vowel_ipa.get(c) {
            segs.push(Seg {
                ph: v.clone(),
                nucleus: true,
            });
            prev_vowel = c.clone();
            continue;
        }
        if c == prev_c && t.geminate.contains(c) {
            segs.push(seg("ː"));
            continue;
        }
        let ctx = if is_vowel(next) { next } else { &prev_vowel };
        match c.to_string_lossy().as_str() {
            "ğ" => segs.push(seg("ɣ")),
            "x" => segs.push(seg("x")),
            "l" => segs.push(seg(if t.back.contains(ctx) { "ɫ" } else { "l" })),
            "k" => segs.push(seg(if t.front.contains(ctx) { "c" } else { "k" })),
            "g" => segs.push(seg("ɟ")),
            "q" => segs.push(seg(if word_final { "x" } else { "ɡ" })),
            _ => {
                let cons = t.cons_ipa.get(c).cloned().or_else(|| {
                    latin_phone(
                        c,
                        PhoneOpts {
                            initial: i == 0,
                            include_h: true,
                        },
                    )
                });
                if let Some(ph) = cons {
                    segs.push(Seg { ph, nucleus: false });
                }
            }
        }
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
