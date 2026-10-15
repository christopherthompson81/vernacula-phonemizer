//! Kazakh grapheme→phoneme scan (Cyrillic): phonemic vowels, word-initial е → je, the iotated / glide letters,
//! л always dark (kazakh.rs lightens it word-wide), ь palatalizing and ъ separating. Ported from
//! src/languages/kazakh/g2p.ts — see that file for the corpus evidence.

use std::collections::HashMap;
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
    glide_ipa: HashMap<JsString, JsString>,
    cons_ipa: HashMap<JsString, JsString>,
}

fn map(m: &indexmap::IndexMap<String, String>) -> HashMap<JsString, JsString> {
    m.iter().map(|(k, v)| (js(k), js(v))).collect()
}

static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*MANIFEST;
    Tables {
        vowel_ipa: map(&m.vowels),
        glide_ipa: map(&m.glides),
        cons_ipa: map(&m.consonants),
    }
});

fn seg(ph: &str) -> Seg {
    Seg {
        ph: js(ph),
        nucleus: false,
    }
}

/// `toSegments(word)`, over the code points of `word.toLowerCase()`. (`c in TABLE` on one code point: no
/// `Object.prototype` member is one.)
pub fn to_segments(word: &JsString) -> Vec<Seg> {
    let t = &*T;
    let chars = word.to_lower_case().code_point_strings();
    let empty = JsString::new();
    let mut segs: Vec<Seg> = Vec::new();
    for i in 0..chars.len() {
        let c = &chars[i];
        let next = chars.get(i + 1).unwrap_or(&empty);
        if let Some(v) = t.vowel_ipa.get(c) {
            if *c == "е" && i == 0 {
                segs.push(seg("j"));
            }
            segs.push(Seg {
                ph: v.clone(),
                nucleus: true,
            });
            continue;
        }
        if let Some(ph) = t.glide_ipa.get(c) {
            if *c == "у" {
                segs.push(Seg {
                    ph: ph.clone(),
                    nucleus: false,
                });
            } else {
                for p in ph.code_point_strings() {
                    let nucleus = js_re!(r"[əauo]", "u").test(&p);
                    segs.push(Seg { ph: p, nucleus });
                }
            }
            continue;
        }
        if *c == "л" {
            segs.push(seg("ɫ"));
            continue;
        }
        if *c == "ь" {
            if let Some(prev) = segs.last_mut()
                && !prev.nucleus
                && !prev.ph.ends_with(&js("ʲ"))
            {
                if prev.ph == "ɫ" {
                    prev.ph = js("l");
                }
                prev.ph.push_str(&js("ʲ"));
            }
            continue;
        }
        if *c == "ъ" {
            if t.vowel_ipa.contains_key(next) || t.glide_ipa.contains_key(next) {
                segs.push(seg("j"));
            }
            continue;
        }
        if let Some(cons) = t.cons_ipa.get(c) {
            segs.push(Seg {
                ph: cons.clone(),
                nucleus: false,
            });
        }
    }
    segs
}
