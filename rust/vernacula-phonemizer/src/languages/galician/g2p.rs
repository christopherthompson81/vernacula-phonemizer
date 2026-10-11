//! Galician grapheme→phoneme scan: the Spanish shape (segments with nucleus and written-accent flags) with the
//! Galician graphemes (⟨x⟩/⟨j⟩ → ʃ, ⟨g⟩ always ɡ, ⟨nh⟩ → ŋ); stress, velarization and spirantization run downstream.
//! Ported from src/languages/galician/g2p.ts — see that file for the evidence.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::js_re;

/// ⚠ SUBSTRING tests on the class strings, guarded against "" where the TS guards (and NOT where it does not).
fn has(class: &str, c: &JsString) -> bool {
    js(class).includes(c)
}
fn is_vowel(c: &JsString) -> bool {
    let v = &MANIFEST.vowels;
    !c.is_empty() && (has(&v.strong, c) || has(&v.weak_unaccented, c) || has(&v.weak_accented, c))
}
fn is_strong(c: &JsString) -> bool {
    !c.is_empty() && has(&MANIFEST.vowels.strong, c)
}
fn is_front(c: &JsString) -> bool {
    !c.is_empty() && has(&MANIFEST.vowels.front, c)
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

/// `classifyRun(run)`: nucleus vs glide; an accented weak vowel promotes a PRECEDING unaccented weak one.
fn classify_run(chars: &[JsString]) -> Vec<Role> {
    let v = &MANIFEST.vowels;
    // `WEAK_ACC.includes(c)` here is unguarded in the TS; `c` is never "" (a run's own characters).
    let strongish = |c: &JsString| is_strong(c) || has(&v.weak_accented, c);
    let has_nucleus = chars.iter().any(strongish);
    let mut roles: Vec<bool> = chars.iter().map(strongish).collect();
    for k in 0..chars.len() {
        let next = chars.get(k + 1).cloned().unwrap_or_default();
        if !roles[k]
            && has(&v.weak_unaccented, &chars[k])
            && !next.is_empty()
            && has(&v.weak_accented, &next)
        {
            roles[k] = true;
        }
    }
    if !has_nucleus && let Some(last) = roles.last_mut() {
        *last = true;
    }
    chars
        .iter()
        .zip(roles)
        .map(|(c, nucleus)| Role {
            nucleus,
            accent: has(&v.weak_accented, c) || has("áéó", c),
        })
        .collect()
}

/// `glideOf`: an onglide is consonantal j/w, an offglide the non-syllabic ᶦ/ᶷ.
fn glide_of(c: &JsString, offglide: bool) -> &'static str {
    if *c == "i" || *c == "í" {
        if offglide { "ᶦ" } else { "j" }
    } else if offglide {
        "ᶷ"
    } else {
        "w"
    }
}

/// `toSegments(word)`: scan the lowercased word. Indexing is by UTF-16 code unit, as in the TS.
pub fn to_segments(word: &JsString) -> Vec<Seg> {
    let w = word.to_lower_case();
    let n = w.len();
    let at = |k: usize| if k < n { w.char_at(k) } else { JsString::new() };
    let mut segs: Vec<Seg> = Vec::new();
    let push = |segs: &mut Vec<Seg>, ph: JsString, nucleus: bool, accent: bool| {
        segs.push(Seg {
            ph,
            nucleus,
            accent,
        })
    };
    let cons = |segs: &mut Vec<Seg>, ph: &str| push(segs, js(ph), false, false);
    let mut i = 0;
    while i < n {
        let c = at(i);
        let nx = at(i + 1);
        let nx2 = at(i + 2);
        let two = |a: &str, b: &str| c == a && nx == b;

        if two("c", "h") {
            cons(&mut segs, "t͡ʃ");
            i += 2;
            continue;
        }
        if two("l", "l") {
            cons(&mut segs, "ʎ");
            i += 2;
            continue;
        }
        if two("n", "h") {
            cons(&mut segs, "ŋ");
            i += 2;
            continue;
        }
        if two("r", "r") {
            cons(&mut segs, "r");
            i += 2;
            continue;
        }
        if two("q", "u") {
            cons(&mut segs, "k");
            if !is_front(&nx2) {
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
        if two("g", "ü") && (nx2 == "e" || nx2 == "i") {
            cons(&mut segs, "ɡ");
            cons(&mut segs, "w");
            i += 2;
            continue;
        }

        if c == "y" {
            if is_vowel(&nx) {
                cons(&mut segs, "ʝ");
            } else if segs.last().is_some_and(|p| p.nucleus) {
                cons(&mut segs, "ᶦ");
            } else {
                push(&mut segs, js("i"), true, false);
            }
            i += 1;
            continue;
        }

        if is_vowel(&c) {
            let mut j = i;
            while j < n && is_vowel(&w.char_at(j)) {
                j += 1;
            }
            let run: Vec<JsString> = (i..j).map(|k| w.char_at(k)).collect();
            let roles = classify_run(&run);
            for (k, vc) in run.iter().enumerate() {
                if roles[k].nucleus {
                    let base = MANIFEST
                        .accents
                        .get(&vc.to_string_lossy())
                        .map_or_else(|| vc.clone(), |b| js(b));
                    push(&mut segs, base, true, roles[k].accent);
                } else {
                    let off = roles[..k].iter().any(|r| r.nucleus);
                    cons(&mut segs, glide_of(vc, off));
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
            "g" => cons(&mut segs, "ɡ"),
            "h" => {}
            "j" => cons(&mut segs, "ʃ"),
            "k" => cons(&mut segs, "k"),
            "l" => cons(&mut segs, "l"),
            "m" => cons(&mut segs, "m"),
            "n" => cons(&mut segs, "n"),
            "ñ" => cons(&mut segs, "ɲ"),
            "p" => cons(&mut segs, "p"),
            "r" => {
                // `"nls".includes(lastPhoneme(segs))`: a SUBSTRING test, unguarded — but `segs` is non-empty here.
                let last = segs.last().map(|s| s.ph.clone()).unwrap_or_default();
                let trill = segs.is_empty() || has("nls", &last);
                cons(&mut segs, if trill { "r" } else { "ɾ" });
            }
            "s" => cons(&mut segs, "s"),
            "t" => cons(&mut segs, "t"),
            "w" => cons(&mut segs, "w"),
            "x" => {
                if is_vowel(&nx) || nx.is_empty() {
                    cons(&mut segs, "ʃ");
                } else {
                    cons(&mut segs, "k");
                    cons(&mut segs, "s");
                }
            }
            _ => {
                let opts = PhoneOpts {
                    initial: segs.is_empty(),
                    include_h: false,
                };
                if let Some(p) = latin_phone(&c, opts) {
                    push(&mut segs, p, false, false);
                } else if js_re!("[a-zñ]").test(&c) {
                    push(&mut segs, c.clone(), false, false);
                }
            }
        }
        i += 1;
    }
    segs
}
