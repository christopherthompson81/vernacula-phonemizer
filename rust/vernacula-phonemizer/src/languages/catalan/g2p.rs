//! Catalan (Central) grapheme→phoneme scan: digraphs, context consonants and vowel runs into segments, each
//! vowel carrying its stressed and reduced IPA; stress and the post-lexical processes run in catalan.rs.
//! Ported from src/languages/catalan/g2p.ts — see that file for the evidence.

use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::js_re;

static VOWEL_CHARS: LazyLock<JsString> =
    LazyLock::new(|| js(&MANIFEST.vowels.keys().cloned().collect::<String>()));
const STRONG: &str = "aeoàèéòó";

/// ⚠ SUBSTRING tests on the class strings, guarded against "" as the TS does.
fn is_vowel(c: &JsString) -> bool {
    !c.is_empty() && VOWEL_CHARS.includes(c)
}
fn is_front(c: &JsString) -> bool {
    !c.is_empty() && js(&MANIFEST.front_vowels).includes(c)
}
fn is_accented(c: &JsString) -> bool {
    !c.is_empty() && js(&MANIFEST.accented_vowels).includes(c)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Seg {
    pub ph: JsString,
    pub nucleus: bool,
    pub accent: bool,
    pub reduced: Option<JsString>,
}

/// `classifyRun(run, atWordStart)`: nucleus vs glide per vowel of a maximal run.
fn classify_run(chars: &[JsString], at_word_start: bool) -> Vec<bool> {
    let mut nucleus: Vec<bool> = chars
        .iter()
        .map(|c| js(STRONG).includes(c) || is_accented(c))
        .collect();
    for k in 0..chars.len() {
        if nucleus[k] {
            continue;
        }
        let preceded_by_nucleus = nucleus[..k].iter().any(|&b| b);
        let word_initial_onglide = at_word_start && k == 0 && chars.len() > 1;
        if !preceded_by_nucleus && !word_initial_onglide {
            nucleus[k] = true;
        }
    }
    if !nucleus.iter().any(|&b| b)
        && let Some(last) = nucleus.last_mut()
    {
        *last = true;
    }
    nucleus
}

fn vowel(c: &str) -> (JsString, JsString) {
    let v = &MANIFEST.vowels[c];
    (js(&v.stressed), js(&v.reduced))
}

/// `toSegments(word)`: scan the lowercased word. Indexing is by UTF-16 code unit, as in the TS.
pub fn to_segments(word: &JsString) -> Vec<Seg> {
    let w = word.to_lower_case();
    let n = w.len();
    let at = |k: usize| if k < n { w.char_at(k) } else { JsString::new() };
    let mut segs: Vec<Seg> = Vec::new();
    let cons = |segs: &mut Vec<Seg>, ph: &str| {
        segs.push(Seg {
            ph: js(ph),
            nucleus: false,
            accent: false,
            reduced: None,
        })
    };
    let prev_vocalic = |segs: &[Seg]| {
        segs.last()
            .is_some_and(|p| p.nucleus || p.ph == "j" || p.ph == "w")
    };
    let mut i = 0;
    while i < n {
        let c = at(i);
        let nx = at(i + 1);
        let nx2 = at(i + 2);

        // multi-letter units (longest first)
        let two = |a: &str, b: &str| c == a && nx == b;
        if two("l", "·") && nx2 == "l" {
            cons(&mut segs, "ɫː");
            i += 3;
            continue;
        }
        let digraph = [
            ("n", "y", "ɲ"),
            ("l", "l", "ʎ"),
            ("r", "r", "r"),
            ("s", "s", "s"),
            ("t", "x", "t͡ʃ"),
            ("t", "j", "d͡ʒ"),
        ]
        .iter()
        .find(|(a, b, _)| two(a, b));
        if let Some((_, _, ph)) = digraph {
            cons(&mut segs, ph);
            i += 2;
            continue;
        }
        if two("t", "g") && is_front(&nx2) {
            cons(&mut segs, "d͡ʒ");
            i += 2;
            continue;
        }
        if two("t", "z") {
            cons(&mut segs, "d͡z");
            i += 2;
            continue;
        }
        if two("i", "g") && i + 2 == n {
            let (st, red) = vowel("i");
            segs.push(Seg {
                ph: st,
                nucleus: true,
                accent: false,
                reduced: Some(red),
            });
            cons(&mut segs, "t͡ʃ");
            i += 2;
            continue;
        }
        if two("q", "u") {
            cons(&mut segs, "k");
            if nx2 == "a" || nx2 == "o" || nx2 == "ü" {
                cons(&mut segs, "w");
            }
            i += 2;
            continue;
        }
        if two("g", "u") && is_front(&nx2) {
            cons(&mut segs, "ɡ");
            i += 2;
            continue;
        }
        if two("g", "u") && (nx2 == "a" || nx2 == "o") {
            cons(&mut segs, "ɡ");
            cons(&mut segs, "w");
            i += 2;
            continue;
        }
        if two("g", "ü") {
            cons(&mut segs, "ɡ");
            cons(&mut segs, "w");
            i += 2;
            continue;
        }
        if two("q", "ü") {
            cons(&mut segs, "k");
            cons(&mut segs, "w");
            i += 2;
            continue;
        }

        // vowel run → nuclei + glides
        if is_vowel(&c) {
            let mut j = i;
            while j < n && is_vowel(&w.char_at(j)) {
                j += 1;
            }
            let mut run_end = j;
            let ix_digraph = at(j) == "x" && w.char_at(j - 1) == "i" && j - 1 > i;
            let ig_final = at(j) == "g" && w.char_at(j - 1) == "i" && j + 1 == n && j - 1 > i;
            if ix_digraph || ig_final {
                run_end = j - 1;
            }
            let run: Vec<JsString> = (i..run_end).map(|k| w.char_at(k)).collect();
            let nuc = classify_run(&run, i == 0);
            for (k, vc) in run.iter().enumerate() {
                let (st, red) = vowel(&vc.to_string_lossy());
                if nuc[k] {
                    segs.push(Seg {
                        ph: st,
                        nucleus: true,
                        accent: is_accented(vc),
                        reduced: Some(red),
                    });
                } else {
                    cons(&mut segs, if *vc == "i" || *vc == "í" { "j" } else { "w" });
                }
            }
            if ix_digraph {
                cons(&mut segs, "ʃ");
                i = j + 1;
                continue;
            }
            if ig_final {
                cons(&mut segs, "t͡ʃ");
                i = n;
                continue;
            }
            i = j;
            continue;
        }

        // single consonants
        match c.to_string_lossy().as_str() {
            "b" | "v" => cons(&mut segs, "b"),
            "c" => cons(&mut segs, if is_front(&nx) { "s" } else { "k" }),
            "ç" => cons(&mut segs, "s"),
            "d" => cons(&mut segs, "d"),
            "f" => cons(&mut segs, "f"),
            "g" => cons(&mut segs, if is_front(&nx) { "ʒ" } else { "ɡ" }),
            "h" => {}
            "j" => cons(&mut segs, "ʒ"),
            "k" => cons(&mut segs, "k"),
            "l" => cons(&mut segs, "ɫ"),
            "m" => cons(&mut segs, "m"),
            "n" => cons(&mut segs, "n"),
            "p" => cons(&mut segs, "p"),
            "r" => {
                let trill = segs.is_empty()
                    || segs
                        .last()
                        .is_some_and(|p| p.ph == "n" || p.ph == "ɫ" || p.ph == "s");
                cons(&mut segs, if trill { "r" } else { "ɾ" });
            }
            "s" => {
                let z = prev_vocalic(&segs) && is_vowel(&nx);
                cons(&mut segs, if z { "z" } else { "s" });
            }
            "t" => cons(&mut segs, "t"),
            "w" => cons(&mut segs, "w"),
            "x" => {
                if !prev_vocalic(&segs) {
                    cons(&mut segs, "ʃ");
                } else if i == 1 && w.char_at(0) == "e" && is_vowel(&nx) {
                    cons(&mut segs, "ɡ");
                    cons(&mut segs, "z");
                } else {
                    cons(&mut segs, "k");
                    cons(&mut segs, "s");
                }
            }
            "y" => cons(&mut segs, "j"),
            "z" => cons(&mut segs, "z"),
            _ => {
                let opts = PhoneOpts {
                    initial: segs.is_empty(),
                    include_h: false,
                };
                if let Some(p) = latin_phone(&c, opts) {
                    segs.push(Seg {
                        ph: p,
                        nucleus: false,
                        accent: false,
                        reduced: None,
                    });
                } else if js_re!("[a-zç]").test(&c) {
                    segs.push(Seg {
                        ph: c.clone(),
                        nucleus: false,
                        accent: false,
                        reduced: None,
                    });
                }
            }
        }
        i += 1;
    }
    segs
}
