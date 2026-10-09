//! Portuguese grapheme → segment scan (phoneme + nucleus/accent/nasal flags + the raw vowel letter) and the
//! positional sibilant pass. Ported from src/languages/portuguese/g2p.ts — see that file for the evidence.

use std::collections::HashSet;
use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, js};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::provenance::{Form, normalize};
use crate::js_re;

/// `"ep" | "bp"`.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Dialect {
    Ep,
    Bp,
}

#[derive(Clone, Debug)]
pub struct Seg {
    pub ph: JsString,
    pub nucleus: bool,
    pub accent: bool,
    /// The base vowel letter; "" for a consonant (except `s` and `x`, which carry their letter).
    pub raw: JsString,
    pub nasal: bool,
}

struct Tables {
    accented: Vec<(JsString, JsString)>,
    acute_grave: JsString,
    circumflex: JsString,
    tilde: JsString,
    vowels: JsString,
    front: JsString,
    vowel_ipa: Vec<(JsString, JsString)>,
    known_letters: HashSet<JsString>,
    voiced: HashSet<JsString>,
}

static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*MANIFEST;
    let pairs = |t: &indexmap::IndexMap<String, String>| t.iter().map(|(k, v)| (js(k), js(v))).collect();
    let vowels = js(&m.vowel_letters);
    // `new Set([...VOWELS, ..."bcçdfghjklmnñpqrstvwxz"])`: code points.
    let known_letters = m
        .vowel_letters
        .chars()
        .chain("bcçdfghjklmnñpqrstvwxz".chars())
        .map(|c| js(&c.to_string()))
        .collect();
    Tables {
        accented: pairs(&m.accents.to_base),
        acute_grave: js(&m.accents.acute_grave),
        circumflex: js(&m.accents.circumflex),
        tilde: js(&m.accents.tilde),
        vowels,
        front: js(&m.front_letters),
        vowel_ipa: pairs(&m.vowel_ipa),
        known_letters,
        voiced: m.voiced_consonants.iter().map(|s| js(s)).collect(),
    }
});

fn lookup<'a>(t: &'a [(JsString, JsString)], k: &JsString) -> Option<&'a JsString> {
    t.iter().find(|(key, _)| key == k).map(|(_, v)| v)
}

fn is_v(c: &JsString) -> bool {
    !c.is_empty() && T.vowels.includes(c)
}
fn is_front(c: &JsString) -> bool {
    !c.is_empty() && T.front.includes(c)
}
fn base(c: &JsString) -> JsString {
    lookup(&T.accented, c).cloned().unwrap_or_else(|| c.clone())
}
fn vowel_ipa(ch: &JsString) -> JsString {
    lookup(&T.vowel_ipa, ch).cloned().unwrap_or_else(|| ch.clone())
}

fn push_v(segs: &mut Vec<Seg>, ch: &JsString, nasal: bool) {
    segs.push(Seg {
        ph: vowel_ipa(ch),
        nucleus: true,
        accent: T.acute_grave.includes(ch) || T.circumflex.includes(ch),
        raw: base(ch),
        nasal,
    });
}
fn push_glide(segs: &mut Vec<Seg>, ph: &str, nasal: bool) {
    segs.push(Seg { ph: js(ph), nucleus: false, accent: false, raw: JsString::new(), nasal });
}
fn push_c(segs: &mut Vec<Seg>, ph: &str) {
    push_c_js(segs, js(ph));
}
fn push_c_js(segs: &mut Vec<Seg>, ph: JsString) {
    segs.push(Seg { ph, nucleus: false, accent: false, raw: JsString::new(), nasal: false });
}

/// `w[i] ?? ""`: one UTF-16 code unit.
fn at(w: &JsString, i: usize) -> JsString {
    w.char_at(i)
}

fn nasalized_here(w: &JsString, vi: usize) -> bool {
    let c = at(w, vi);
    if T.tilde.includes(&c) {
        return true;
    }
    let nx = at(w, vi + 1);
    if nx != "m" && nx != "n" {
        return false;
    }
    let after = at(w, vi + 2);
    if nx == "n" && after == "h" {
        return false;
    }
    after.is_empty() || !is_v(&after)
}

/// `FOREIGN_LETTER`: `{ y: "i" }`.
fn foreign_letter(c: &JsString) -> Option<JsString> {
    (*c == "y").then(|| js("i"))
}

fn fold_foreign_letters(w: &JsString) -> JsString {
    let cps = w.code_point_strings();
    if cps.iter().all(|c| T.known_letters.contains(c)) {
        return w.clone();
    }
    let mut out = JsString::new();
    for c in cps {
        if T.known_letters.contains(&c) {
            out.push_str(&c);
            continue;
        }
        if let Some(named) = foreign_letter(&c) {
            out.push_str(&named);
            continue;
        }
        let b = js_re!(r"\p{M}+", "gu").replace(&normalize(&c, Form::Nfd), &JsString::new());
        let r = foreign_letter(&b)
            .unwrap_or_else(|| if b.len() == 1 && T.known_letters.contains(&b) { b } else { c });
        out.push_str(&r);
    }
    out
}

/// `toSegments(word, dialect)`: scan a word (lowercased here) into segments.
pub fn to_segments(word: &JsString, dialect: Dialect) -> Vec<Seg> {
    let w = fold_foreign_letters(&word.to_lower_case());
    let n = w.len();
    let mut segs: Vec<Seg> = Vec::new();
    let mut i = 0;
    while i < n {
        let c = at(&w, i);
        let nx = at(&w, i + 1);
        let nx2 = at(&w, i + 2);

        if c == "c" && nx == "h" {
            push_c(&mut segs, "ʃ");
            i += 2;
            continue;
        }
        if c == "l" && nx == "h" {
            push_c(&mut segs, "ʎ");
            i += 2;
            continue;
        }
        if c == "n" && nx == "h" {
            push_c(&mut segs, "ɲ");
            i += 2;
            continue;
        }
        if c == "r" && nx == "r" {
            push_c(&mut segs, "ʁ");
            i += 2;
            continue;
        }
        if c == "s" && nx == "s" {
            push_c(&mut segs, "s");
            i += 2;
            continue;
        }
        if c == "q" && nx == "u" {
            push_c(&mut segs, "k");
            if !is_front(&nx2) {
                push_glide(&mut segs, "w", false);
            }
            i += 2;
            continue;
        }
        if c == "g" && nx == "u" && is_front(&nx2) {
            push_c(&mut segs, "ɡ");
            i += 2;
            continue;
        }

        if is_v(&c) {
            let nasal = nasalized_here(&w, i);
            if nx == "m" && nx2.is_empty() && (c == "a" || c == "á" || c == "e" || c == "é") {
                let acc = T.acute_grave.includes(&c);
                let is_e = c == "e" || c == "é";
                segs.push(Seg {
                    ph: js(if is_e && dialect == Dialect::Bp { "e" } else { "ɐ" }),
                    nucleus: true,
                    accent: acc,
                    raw: js(if is_e { "e" } else { "a" }),
                    nasal: true,
                });
                push_glide(&mut segs, if c == "a" || c == "á" { "w̃" } else { "j̃" }, true);
                i += 2;
                continue;
            }
            if c == "o" && nx == "u" && !nasal {
                segs.push(Seg { ph: js("o"), nucleus: true, accent: false, raw: JsString::new(), nasal: false });
                i += 2;
                continue;
            }
            if c == "ã" && nx == "o" {
                push_v(&mut segs, &js("ã"), true);
                push_glide(&mut segs, "w̃", true);
                i += 2;
                continue;
            }
            if c == "ã" && nx == "e" {
                push_v(&mut segs, &js("ã"), true);
                push_glide(&mut segs, "j̃", true);
                i += 2;
                continue;
            }
            if c == "õ" && nx == "e" {
                push_v(&mut segs, &js("õ"), true);
                push_glide(&mut segs, "j̃", true);
                i += 2;
                continue;
            }
            push_v(&mut segs, &c, nasal);
            i += 1;
            if nasal && (nx == "m" || nx == "n") {
                i += 1;
            }
            let g = at(&w, i);
            let after = at(&w, i + 1);
            let hiatus = !after.is_empty() && after != "s" && !is_v(&after) && at(&w, i + 2).is_empty();
            let accented_next = !after.is_empty() && js("áàâãéêíóôõúü").includes(&after);
            if (g == "i" || g == "u") && !hiatus && !accented_next {
                push_glide(&mut segs, if g == "i" { "j" } else { "w" }, false);
                i += 1;
            }
            continue;
        }

        match c.to_string_lossy().as_str() {
            "b" => push_c(&mut segs, "b"),
            "c" => push_c(&mut segs, if is_front(&nx) { "s" } else { "k" }),
            "ç" => push_c(&mut segs, "s"),
            "ñ" => push_c(&mut segs, "ɲ"),
            "d" => push_c(&mut segs, "d"),
            "f" => push_c(&mut segs, "f"),
            "g" => push_c(&mut segs, if is_front(&nx) { "ʒ" } else { "ɡ" }),
            "h" => {}
            "j" => push_c(&mut segs, "ʒ"),
            "k" => push_c(&mut segs, "k"),
            "l" => push_c(&mut segs, if nx.is_empty() || !is_v(&nx) { "ɫ" } else { "l" }),
            "m" => push_c(&mut segs, "m"),
            "n" => push_c(&mut segs, "n"),
            "p" => push_c(&mut segs, "p"),
            "q" => push_c(&mut segs, "k"),
            "r" => {
                let prev = if i == 0 { JsString::new() } else { at(&w, i - 1) };
                let strong = i == 0 || prev == "n" || prev == "l" || prev == "s";
                push_c(&mut segs, if strong { "ʁ" } else { "ɾ" });
            }
            "s" => segs.push(Seg { ph: js("s"), nucleus: false, accent: false, raw: js("s"), nasal: false }),
            "t" => push_c(&mut segs, "t"),
            "v" => push_c(&mut segs, "v"),
            "w" => push_c(&mut segs, "v"),
            "x" => segs.push(Seg { ph: js("ʃ"), nucleus: false, accent: false, raw: js("x"), nasal: false }),
            "z" => push_c(&mut segs, "z"),
            // A lone surrogate's lossy form is U+FFFD, which matches no arm; `c` itself goes to the table.
            _ => {
                if let Some(ph) = latin_phone(&c, PhoneOpts { initial: i == 0, include_h: false }) {
                    push_c_js(&mut segs, ph);
                }
            }
        }
        i += 1;
    }
    segs
}

fn is_vowel_ph(ph: &JsString) -> bool {
    js_re!("[aɐɛeiɔouɨ]", "").test(ph)
}

/// `sibilants(segs, dialect)`: intervocalic single s → z; a coda s/z → the dialect's coda sibilant, voiced
/// before a voiced consonant.
pub fn sibilants(segs: &mut [Seg], dialect: Dialect) {
    let (coda, coda_voiced) = if dialect == Dialect::Bp { ("s", "z") } else { ("ʃ", "ʒ") };
    for i in 0..segs.len() {
        if segs[i].ph != "s" && segs[i].ph != "z" {
            continue;
        }
        let prev_v = i > 0 && (segs[i - 1].nucleus || is_vowel_ph(&segs[i - 1].ph));
        let next = segs.get(i + 1);
        let next_v = next.is_some_and(|n| n.nucleus || is_vowel_ph(&n.ph));
        if next_v {
            if prev_v && !segs[i - 1].nasal && segs[i].raw == "s" {
                segs[i].ph = js("z");
            }
            continue;
        }
        let ph = match next {
            None => coda,
            Some(n) if T.voiced.contains(&n.ph) => coda_voiced,
            Some(_) => coda,
        };
        segs[i].ph = js(ph);
    }
}
