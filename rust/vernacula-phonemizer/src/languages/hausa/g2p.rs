//! Hausa grapheme→phoneme: a longest-match scan of the Boko rule table (n → ŋ before a velar), penultimate stress,
//! and the per-nucleus tone overlay from the Wiktionary-derived tone lexicon.
//! Ported from src/languages/hausa/g2p.ts — see that file for the corpus evidence.

use std::sync::OnceLock;

use indexmap::IndexMap;

use super::manifest::{DIR, MANIFEST};
use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, js};
use crate::core::load_tsv::{TsvOptions, load_tsv_map};
use crate::js_re;

/// The tone lexicon (`tone.tsv`, optional): word → per-nucleus tone codes, each value trimmed.
pub fn try_tone() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static T: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&T, || {
        load_tsv_map(
            DIR,
            "tone.tsv",
            |v, _| Some(v.trim()),
            TsvOptions {
                optional: true,
                fold: None,
            },
        )
        .map_err(|e| e.to_string())
    })
}

struct Seg {
    ph: JsString,
    nuc: bool,
}

/// `toSegments(word)`: the lowercased word scanned by code unit; an unknown unit is skipped.
fn to_segments(word: &JsString) -> Vec<Seg> {
    let w = word.to_lower_case();
    let mut segs = Vec::new();
    let mut i = 0;
    'outer: while i < w.len() {
        for (orth, ipa, nuc) in &MANIFEST.rules {
            let o = js(orth);
            if w.0[i..].starts_with(&o.0) {
                if orth == "n" && js_re!("[kgƙ]").test(&w.char_at(i + 1)) {
                    segs.push(Seg {
                        ph: js("ŋ"),
                        nuc: false,
                    });
                } else {
                    segs.push(Seg {
                        ph: js(ipa),
                        nuc: *nuc,
                    });
                }
                i += o.len();
                continue 'outer;
            }
        }
        i += 1;
    }
    segs
}

/// `phonemizeWord(word)`: segments + penultimate stress + the lexical tone overlay.
pub fn phonemize_word(word: &JsString) -> JsString {
    let segs = to_segments(word);
    let nuc_idx: Vec<usize> = (0..segs.len()).filter(|&i| segs[i].nuc).collect();
    if nuc_idx.is_empty() {
        let mut out = JsString::new();
        for s in &segs {
            out.push_str(&s.ph);
        }
        return out;
    }
    let stress_idx = if nuc_idx.len() >= 2 {
        nuc_idx[nuc_idx.len() - 2]
    } else {
        nuc_idx[0]
    };
    let tone = try_tone().expect("checked by create_hausa");
    let codes = tone
        .get(word)
        .or_else(|| tone.get(&word.to_lower_case()))
        .cloned()
        .unwrap_or_default();
    let mut out = JsString::new();
    let mut n = 0;
    for (i, sg) in segs.iter().enumerate() {
        if i == stress_idx {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&sg.ph);
        if sg.nuc {
            // `codes[n]` is one code UNIT (undefined past the end, which `?? ""` keys as "").
            let k = if n < codes.len() {
                codes.char_at(n).to_string_lossy()
            } else {
                String::new()
            };
            if let Some(c) = MANIFEST.tone_chao.get(&k) {
                out.push_str(&js(c));
            }
            n += 1;
        }
    }
    out
}
