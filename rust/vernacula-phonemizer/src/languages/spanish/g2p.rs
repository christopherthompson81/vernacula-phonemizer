//! Spanish grapheme→phoneme scan (broad Castilian): a left-to-right pass with small context rules that yields
//! segments (phoneme, nucleus, written accent); stress and spirantization are applied downstream.
//! Ported from src/languages/spanish/g2p.ts — see that file for the evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::js_re;

/// `STRONG.includes(c)` and friends: ⚠ SUBSTRING tests on the class string, guarded against "" (which every
/// string includes), exactly as the TS does.
fn in_class(class: &str, c: &JsString) -> bool {
    js(class).includes(c)
}

fn is_vowel(c: &JsString) -> bool {
    let v = &MANIFEST.vowels;
    !c.is_empty()
        && (in_class(&v.strong, c)
            || in_class(&v.weak_unaccented, c)
            || in_class(&v.weak_accented, c))
}

fn is_strong(c: &JsString) -> bool {
    !c.is_empty() && in_class(&MANIFEST.vowels.strong, c)
}

fn is_front(c: &JsString) -> bool {
    !c.is_empty() && in_class(&MANIFEST.vowels.front, c)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Seg {
    pub ph: JsString,
    pub nucleus: bool,
    pub accent: bool,
}

struct Role {
    nucleus: bool,
    accent: bool,
}

/// `classifyRun`: a maximal vowel run → nucleus vs glide roles (an all-weak run's LAST vowel is the nucleus).
fn classify_run(chars: &[JsString]) -> Vec<Role> {
    let weak_acc = &MANIFEST.vowels.weak_accented;
    let mut roles: Vec<bool> = chars
        .iter()
        .map(|c| is_strong(c) || in_class(weak_acc, c))
        .collect();
    if !roles.iter().any(|&r| r) {
        if let Some(last) = roles.last_mut() {
            *last = true;
        }
    }
    chars
        .iter()
        .zip(roles)
        .map(|(c, nucleus)| Role {
            nucleus,
            accent: in_class(weak_acc, c) || in_class("áéó", c),
        })
        .collect()
}

/// `glideOf`: an onglide is consonantal j/w, an offglide the non-syllabic ᶦ/ᶷ.
fn glide_of(c: &JsString, offglide: bool) -> JsString {
    js(if *c == "i" || *c == "í" {
        if offglide { "ᶦ" } else { "j" }
    } else if offglide {
        "ᶷ"
    } else {
        "w"
    })
}

/// `toSegments`: scan a word (lowercased here) into segments. Indexing is by UTF-16 code unit, as in the TS.
pub(crate) fn to_segments(word: &JsString) -> Vec<Seg> {
    let w = word.to_lower_case();
    let mut segs: Vec<Seg> = Vec::new();
    let n = w.len();
    let at = |k: usize| if k < n { w.char_at(k) } else { JsString::new() };
    let cons = |segs: &mut Vec<Seg>, ph: &str| {
        segs.push(Seg {
            ph: js(ph),
            nucleus: false,
            accent: false,
        })
    };
    let mut i = 0;
    while i < n {
        let c = at(i);
        let nx = at(i + 1);
        let nx2 = at(i + 2);

        if c == "c" && nx == "h" {
            cons(&mut segs, "t͡ʃ");
            i += 2;
            continue;
        }
        if c == "l" && nx == "l" {
            cons(&mut segs, "ʎ");
            i += 2;
            continue;
        }
        if c == "r" && nx == "r" {
            cons(&mut segs, "r");
            i += 2;
            continue;
        }
        if c == "q" && nx == "u" {
            cons(&mut segs, "k");
            if !is_front(&nx2) {
                cons(&mut segs, "w");
            }
            i += 2;
            continue;
        }
        if c == "g" && nx == "u" && is_front(&nx2) {
            cons(&mut segs, "ɡ");
            i += 2;
            continue;
        }
        if c == "g" && nx == "ü" && (nx2 == "e" || nx2 == "i") {
            cons(&mut segs, "ɡ");
            cons(&mut segs, "w");
            i += 2;
            continue;
        }

        if c == "y" {
            if is_vowel(&nx) {
                cons(&mut segs, "ʝ");
                i += 1;
                continue;
            }
            if segs.last().is_some_and(|p| p.nucleus) {
                cons(&mut segs, "ᶦ");
            } else {
                segs.push(Seg {
                    ph: js("i"),
                    nucleus: true,
                    accent: false,
                });
            }
            i += 1;
            continue;
        }

        if is_vowel(&c) {
            let mut j = i;
            while j < n && is_vowel(&w.char_at(j)) {
                j += 1;
            }
            let run = w.slice(i as isize, Some(j as isize)).code_point_strings();
            let roles = classify_run(&run);
            for (k, vc) in run.iter().enumerate() {
                let base = MANIFEST
                    .accents
                    .get(&vc.to_string_lossy())
                    .map_or_else(|| vc.clone(), |b| js(b));
                if roles[k].nucleus {
                    segs.push(Seg {
                        ph: base,
                        nucleus: true,
                        accent: roles[k].accent,
                    });
                } else {
                    let off = roles[..k].iter().any(|r| r.nucleus);
                    segs.push(Seg {
                        ph: glide_of(vc, off),
                        nucleus: false,
                        accent: false,
                    });
                }
            }
            i = j;
            continue;
        }

        match c.to_string_lossy().as_str() {
            "b" | "v" => cons(&mut segs, "b"),
            "c" => cons(&mut segs, if is_front(&nx) { "θ" } else { "k" }),
            "z" => cons(&mut segs, "θ"),
            "d" => cons(&mut segs, "d"),
            "f" => cons(&mut segs, "f"),
            "g" => cons(&mut segs, if is_front(&nx) { "x" } else { "ɡ" }),
            "h" => {}
            "j" => cons(&mut segs, "x"),
            "k" => cons(&mut segs, "k"),
            "l" => cons(&mut segs, "l"),
            "m" => cons(&mut segs, "m"),
            "n" => cons(&mut segs, "n"),
            "ñ" => cons(&mut segs, "ɲ"),
            "p" => cons(&mut segs, "p"),
            "r" => {
                // ⚠ `"nls".includes(lastPhoneme(segs))` is a SUBSTRING test.
                let trill = segs.is_empty() || js("nls").includes(&last_phoneme(&segs));
                cons(&mut segs, if trill { "r" } else { "ɾ" });
            }
            "s" => cons(&mut segs, "s"),
            "t" => cons(&mut segs, "t"),
            "w" => cons(&mut segs, "w"),
            "x" => {
                if segs.is_empty() {
                    cons(&mut segs, "s");
                } else {
                    cons(&mut segs, "k");
                    cons(&mut segs, "s");
                }
            }
            _ => {
                let p = latin_phone(
                    &c,
                    PhoneOpts {
                        initial: segs.is_empty(),
                        include_h: false,
                    },
                );
                if let Some(p) = p {
                    segs.push(Seg {
                        ph: p,
                        nucleus: false,
                        accent: false,
                    });
                } else if js_re!("[a-zñ]").test(&c) {
                    segs.push(Seg {
                        ph: c.clone(),
                        nucleus: false,
                        accent: false,
                    });
                }
            }
        }
        i += 1;
    }
    segs
}

fn last_phoneme(segs: &[Seg]) -> JsString {
    segs.last().map_or_else(JsString::new, |s| s.ph.clone())
}
