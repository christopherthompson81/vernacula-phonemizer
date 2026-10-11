//! Russian grapheme→phoneme engine: a lowercased Cyrillic word plus its stressed-vowel ordinal → canonical IPA
//! (palatalization, iotation, akanye/ikanye, final devoicing, regressive voicing assimilation).
//! Ported from src/languages/russian/g2p.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};
use crate::js_re;

struct Tables {
    always_hard: HashSet<JsString>,
    always_soft: HashSet<JsString>,
    soft_vowel: HashSet<JsString>,
    vowels: HashSet<JsString>,
    iotated: HashSet<JsString>,
    voiceless_obstr: HashSet<JsString>,
    voiced_obstr: HashSet<JsString>,
    gen_keep_g: HashSet<JsString>,
    soften_tgt: JsString,
    soften_trig: JsString,
    soften_trig_tdn: JsString,
}

static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*MANIFEST;
    let set = |v: &Vec<String>| v.iter().map(|s| js(s)).collect::<HashSet<_>>();
    Tables {
        always_hard: set(&m.always_hard),
        always_soft: set(&m.always_soft),
        soft_vowel: set(&m.soft_vowels),
        vowels: js(&m.vowel_letters)
            .code_point_strings()
            .into_iter()
            .collect(),
        iotated: set(&m.iotated_vowels),
        voiceless_obstr: set(&m.voiceless_obstruents),
        voiced_obstr: set(&m.voiced_obstruents),
        gen_keep_g: set(&m.genitive_keep_g),
        soften_tgt: js(&m.soften_targets),
        soften_trig: js(&m.soften_triggers),
        soften_trig_tdn: js(&m.soften_triggers_tdn),
    }
});

/// `CONS[c]`: the [hard, soft] IPA of a consonant letter. `c` is one code point, which no `Object.prototype`
/// member's name is, so an own-key lookup is the same thing.
fn cons(c: &JsString) -> Option<(JsString, JsString)> {
    MANIFEST
        .consonants
        .get(&c.to_string_lossy())
        .map(|(h, s)| (js(h), js(s)))
}

fn lookup(map: &indexmap::IndexMap<String, String>, ph: &JsString) -> Option<JsString> {
    map.get(&ph.to_string_lossy()).map(|v| js(v))
}

#[derive(Clone)]
struct Cons {
    ph: JsString,
    soft: bool,
}

#[derive(Clone)]
struct Vowel {
    letter: JsString,
    glide: bool,
    ph: JsString,
}

struct Unit {
    cyr: JsString,
    cons: Option<Cons>,
    vowel: Option<Vowel>,
}

fn consonant(cyr: &str, ph: &str, soft: bool) -> Unit {
    Unit {
        cyr: js(cyr),
        cons: Some(Cons { ph: js(ph), soft }),
        vowel: None,
    }
}

/// `parse(w)`: consonant / vowel units, palatalization and iotation resolved; ь/ъ carry no unit.
fn parse(w: &JsString) -> Vec<Unit> {
    let t = &*T;
    let chars = w.code_point_strings();
    let at = |i: isize| -> Option<&JsString> { if i < 0 { None } else { chars.get(i as usize) } };
    let is = |i: isize, s: &str| at(i).is_some_and(|c| *c == js(s));
    let mut units: Vec<Unit> = Vec::new();
    let mut i: isize = 0;
    while (i as usize) < chars.len() {
        let c = chars[i as usize].clone();
        if c == js("т") || c == js("д") {
            let soft = is(i + 1, "ь");
            let s_idx = if soft { i + 2 } else { i + 1 };
            if is(s_idx, "с") {
                units.push(consonant("ц", if soft { "t͡sː" } else { "t͡s" }, false));
                i = s_idx + 1;
                continue;
            }
            if is(i + 1, "ч") {
                units.push(consonant("ч", "t͡ɕː", true));
                i += 2;
                continue;
            }
            if is(i + 1, "ц") {
                i += 1;
                continue;
            }
        }
        if (c == js("с") || c == js("з") || c == js("ж")) && is(i + 1, "ч") {
            units.push(consonant("щ", "ɕː", true));
            i += 2;
            continue;
        }
        if c == js("д") && is(i + 1, "ж") {
            units.push(consonant("ж", "d͡ʐ", false));
            i += 2;
            continue;
        }
        // `!VOWELS.has(chars[i - 1] ?? "")`: a Set never holds "", so a missing neighbour is not a vowel.
        if c == js("с")
            && (is(i + 1, "я") || is(i + 1, "ь"))
            && (i + 2) as usize >= chars.len()
            && !is(i - 1, "й")
            && !at(i - 1).is_some_and(|p| t.vowels.contains(p))
            // A reflexive needs a stem with a vowel: `вся` is the pronoun and keeps its soft с.
            && chars[..i as usize].iter().any(|ch| t.vowels.contains(ch))
        {
            units.push(consonant("с", "s", false));
            i += 1;
            continue;
        }
        if let Some((hard, softph)) = cons(&c) {
            let next = at(i + 1).cloned().unwrap_or_default();
            let soft = if t.always_hard.contains(&c) {
                false
            } else if t.always_soft.contains(&c) {
                true
            } else {
                next == js("ь") || t.soft_vowel.contains(&next)
            };
            units.push(Unit {
                cyr: c.clone(),
                cons: Some(Cons {
                    ph: if soft { softph } else { hard },
                    soft,
                }),
                vowel: None,
            });
        } else if t.vowels.contains(&c) {
            let prev = at(i - 1);
            let glide = t.iotated.contains(&c)
                && match prev {
                    None => true,
                    Some(p) => t.vowels.contains(p) || *p == js("ь") || *p == js("ъ"),
                };
            units.push(Unit {
                cyr: c.clone(),
                cons: None,
                vowel: Some(Vowel {
                    letter: c.clone(),
                    glide,
                    ph: JsString::new(),
                }),
            });
        }
        i += 1;
    }
    // Regressive palatalization of a dental before a soft dental.
    for i in 0..units.len() {
        let Some(c) = units[i].cons.as_ref() else {
            continue;
        };
        if c.soft || !t.soften_tgt.includes(&units[i].cyr) {
            continue;
        }
        let Some(nx) = units.get(i + 1) else { continue };
        if !nx.cons.as_ref().is_some_and(|c| c.soft) {
            continue;
        }
        let ok = if js("сз").includes(&units[i].cyr) {
            t.soften_trig.includes(&nx.cyr)
        } else {
            t.soften_trig_tdn.includes(&nx.cyr)
        };
        if ok {
            let (_, soft) = cons(&units[i].cyr).unwrap();
            units[i].cons = Some(Cons {
                ph: soft,
                soft: true,
            });
        }
    }
    // Geminate softness agreement.
    for i in 0..units.len().saturating_sub(1) {
        let (a, b) = (&units[i], &units[i + 1]);
        if let (Some(ac), Some(bc)) = (&a.cons, &b.cons)
            && a.cyr == b.cyr
            && bc.soft
            && !ac.soft
            && let Some((_, soft)) = cons(&a.cyr)
        {
            units[i].cons = Some(Cons {
                ph: soft,
                soft: true,
            });
        }
    }
    units
}

/// `stressedVowel(letter, softContext)`.
fn stressed_vowel(letter: &JsString, soft_context: bool) -> JsString {
    let l = letter.to_string_lossy();
    js(match l.as_str() {
        "а" => {
            if soft_context {
                "æ"
            } else {
                "a"
            }
        }
        "я" => "æ",
        "о" | "ё" => "o",
        "э" => "ɛ",
        "е" => "e",
        "у" | "ю" => "u",
        "и" => "i",
        "ы" => "ɨ",
        _ => return letter.clone(),
    })
}

/// `reducedVowel(letter, softContext, strong, postTonic)`.
fn reduced_vowel(
    letter: &JsString,
    soft_context: bool,
    strong: bool,
    post_tonic: bool,
) -> JsString {
    let l = letter.to_string_lossy();
    let soft = soft_context || matches!(l.as_str(), "я" | "е" | "и" | "ё" | "ю");
    js(match l.as_str() {
        "а" | "о" => {
            if soft {
                if post_tonic { "ə" } else { "ɪ" }
            } else if strong {
                "ɐ"
            } else {
                "ə"
            }
        }
        "я" | "э" => {
            if post_tonic {
                "ə"
            } else {
                "ɪ"
            }
        }
        "е" | "и" => "ɪ",
        "у" | "ю" => "ʊ",
        "ы" => "ɨ",
        "ё" => "o",
        _ => return letter.clone(),
    })
}

/// `arr[o]` for a JS number `o`: only a non-negative integer index inside the array reads an element.
fn at_js<T: Copy>(v: &[T], o: f64) -> Option<T> {
    if o >= 0.0 && o.fract() == 0.0 && o < v.len() as f64 {
        Some(v[o as usize])
    } else {
        None
    }
}

/// `toIpa(word, stressOrd, hard)`: `stressOrd` is the dictionary's JS number (any value: an index that is not
/// a vowel's falls back to the last vowel); `hard` the vowel ordinals whose preceding consonant is hard.
pub(crate) fn to_ipa(word: &JsString, stress_ord: f64, hard: Option<&[f64]>) -> JsString {
    let t = &*T;
    let w0 = word.to_lower_case();
    let mut units = parse(&w0);
    if (w0.ends_with(&js("ого")) || w0.ends_with(&js("его"))) && !t.gen_keep_g.contains(&w0) {
        for u in units.iter_mut().rev() {
            if u.cons
                .as_ref()
                .is_some_and(|c| c.ph == js("ɡ") || c.ph == js("ɡʲ"))
            {
                u.cons = Some(Cons {
                    ph: js("v"),
                    soft: false,
                });
                break;
            }
        }
    }
    let vowel_idx: Vec<isize> = units
        .iter()
        .enumerate()
        .filter(|(_, u)| u.vowel.is_some())
        .map(|(i, _)| i as isize)
        .collect();
    let stress_pos = at_js(&vowel_idx, stress_ord)
        .or_else(|| vowel_idx.last().copied())
        .unwrap_or(-1);

    let stress_k = vowel_idx
        .iter()
        .position(|&i| i == stress_pos)
        .map_or(-1, |k| k as isize);
    let n = units.len();
    for (k, &iv) in vowel_idx.iter().enumerate() {
        let i = iv as usize;
        let k = k as isize;
        let prev_cons = if i > 0 {
            units[i - 1].cons.clone()
        } else {
            None
        };
        let prev_soft = prev_cons.as_ref().is_some_and(|c| c.soft);
        let (letter, glide) = {
            let v = units[i].vowel.as_ref().unwrap();
            (v.letter.clone(), v.glide)
        };
        let soft_ctx = prev_soft || (glide && letter != js("э") && letter != js("ы"));
        let mut next_soft = false;
        for u in &units[i + 1..] {
            if let Some(c) = &u.cons {
                next_soft = c.soft;
                break;
            }
            if let Some(v) = &u.vowel {
                next_soft = v.glide;
                break;
            }
        }
        let mut ph;
        if iv == stress_pos {
            ph = stressed_vowel(&letter, soft_ctx);
            if (letter == js("я") || letter == js("а")) && ph == js("æ") && !next_soft {
                ph = js("a");
            }
            if (letter == js("ё") && i > 0) || (letter == js("о") && prev_soft) {
                ph = js("ɵ");
            }
        } else {
            let strong = k == stress_k - 1 || i == 0;
            ph = reduced_vowel(&letter, soft_ctx, strong, k > stress_k);
        }
        if (letter == js("у") || letter == js("ю")) && (prev_soft || glide) && next_soft {
            ph = js("ʉ");
        }
        if i > 0 {
            let prev_cyr = &units[i - 1].cyr;
            if !prev_cyr.is_empty() && js("жшц").includes(prev_cyr) {
                if letter == js("и") {
                    ph = js("ɨ");
                } else if letter == js("е") {
                    ph = js(if iv == stress_pos { "ɛ" } else { "ɨ" });
                }
            }
        }
        if i == n - 1 && iv != stress_pos {
            if letter == js("е") {
                ph = js("e");
            } else if letter == js("я") {
                ph = js("ə");
            }
        }
        units[i].vowel.as_mut().unwrap().ph = ph;
    }

    // Voicing, right to left.
    for i in (0..n).rev() {
        let Some(c) = units[i].cons.clone() else {
            continue;
        };
        let mut next: Option<(JsString, bool)> = None;
        for u in &units[i + 1..] {
            if let Some(nc) = &u.cons {
                next = Some((nc.ph.clone(), true));
                break;
            }
            if let Some(v) = &u.vowel {
                next = Some((v.ph.clone(), false));
                break;
            }
        }
        let new_ph = match next {
            None => {
                if t.voiced_obstr.contains(&c.ph) {
                    lookup(&MANIFEST.devoice, &c.ph).unwrap_or(c.ph.clone())
                } else {
                    c.ph.clone()
                }
            }
            Some((_, false)) => continue,
            Some((nph, true)) => {
                if t.voiceless_obstr.contains(&nph) && t.voiced_obstr.contains(&c.ph) {
                    lookup(&MANIFEST.devoice, &c.ph).unwrap_or(c.ph.clone())
                } else if t.voiced_obstr.contains(&nph)
                    && nph != js("v")
                    && nph != js("vʲ")
                    && t.voiceless_obstr.contains(&c.ph)
                {
                    lookup(&MANIFEST.voice, &c.ph).unwrap_or(c.ph.clone())
                } else {
                    c.ph.clone()
                }
            }
        };
        units[i].cons.as_mut().unwrap().ph = new_ph;
    }

    // Loanword hard consonant before е/и.
    if let Some(hard) = hard {
        for &o in hard {
            let Some(iv) = at_js(&vowel_idx, o) else {
                continue;
            };
            let i = iv as usize;
            let letter = units[i].vowel.as_ref().unwrap().letter.clone();
            if letter != js("е") && letter != js("и") {
                continue;
            }
            if i > 0 && units[i - 1].cons.as_ref().is_some_and(|c| c.soft) {
                if let Some((h, _)) = cons(&units[i - 1].cyr) {
                    let p = units[i - 1].cons.as_mut().unwrap();
                    p.ph = h;
                    p.soft = false;
                }
                if i > 1
                    && units[i - 2].cons.as_ref().is_some_and(|c| c.soft)
                    && t.soften_tgt.includes(&units[i - 2].cyr)
                {
                    let (h, _) = cons(&units[i - 2].cyr).unwrap();
                    let p2 = units[i - 2].cons.as_mut().unwrap();
                    p2.ph = h;
                    p2.soft = false;
                }
            }
            units[i].vowel.as_mut().unwrap().ph = js(if letter == js("и") {
                "ɨ"
            } else if iv == stress_pos {
                "ɛ"
            } else {
                "ɨ"
            });
        }
    }

    with_stress(&units, stress_pos)
}

/// `withStress(units, stressPos)`: ˈ before the stressed vowel (after its j-glide) unless a monosyllable;
/// a repeated consonant is a length mark, except a sibilant assimilated across letters, or word-finally.
fn with_stress(units: &[Unit], stress_pos: isize) -> JsString {
    let n_vowels = units.iter().filter(|u| u.vowel.is_some()).count();
    let last_idx = units.len() as isize - 1;
    let mut out = JsString::new();
    let mut prev_cons = JsString::new();
    let mut prev_cyr = JsString::new();
    for (i, u) in units.iter().enumerate() {
        let i = i as isize;
        if let Some(c) = &u.cons {
            if c.ph == prev_cons {
                let sibilant_assim = js_re!("^[szʂʐ]|ɕ").test(&c.ph) && u.cyr != prev_cyr;
                if !sibilant_assim && i != last_idx {
                    out.push_str(&js("ː"));
                }
            } else {
                out.push_str(&c.ph);
            }
            prev_cons = c.ph.clone();
            prev_cyr = u.cyr.clone();
            continue;
        }
        if let Some(v) = &u.vowel {
            if v.glide {
                out.push_str(&js("j"));
            }
            if i == stress_pos && n_vowels > 1 {
                out.push_str(&js("ˈ"));
            }
            out.push_str(&v.ph);
            prev_cons = JsString::new();
            prev_cyr = JsString::new();
        }
    }
    out
}
