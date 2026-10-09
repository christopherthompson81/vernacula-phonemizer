//! The English OOV G2P: compound split over the lexicon, then suffix morphology, then a joint n-gram beam
//! decode. Ported from src/languages/english/englishG2p.ts — see that file for the measured policy.

use std::collections::{HashMap, HashSet};

use indexmap::IndexMap;
use serde::Deserialize;

use super::english_arpabet::ArpabetToIpa;
use crate::core::js_math;
use crate::core::js_string::{JsString, js};
use crate::js_re;

#[derive(Deserialize)]
pub struct NgramEntry {
    pub t: f64,
    pub c: Vec<(String, f64)>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnglishG2pModel {
    pub order: usize,
    pub alpha: f64,
    pub evp: f64,
    pub evp_order: i64,
    pub grapheme_chunks: IndexMap<String, Vec<String>>,
    pub ngram: HashMap<String, NgramEntry>,
}

const START: &str = "^";
const BEAM: usize = 12;
const MINPART: usize = 3;

/// `p.replace(/[0-2]$/, "")`.
pub fn drop_stress(p: &str) -> &str {
    match p.as_bytes().last() {
        Some(b'0'..=b'2') => &p[..p.len() - 1],
        _ => p,
    }
}

fn stress_down(ph: &[String]) -> Vec<String> {
    ph.iter()
        .map(|p| {
            if let Some(b) = p.strip_suffix('1') {
                format!("{b}2")
            } else {
                p.clone()
            }
        })
        .collect()
}

pub fn collapse_geminates(ph: &[String], vowels: &HashSet<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for p in ph {
        if out.last() != Some(p) || vowels.contains(drop_stress(p)) {
            out.push(p.clone());
        }
    }
    out
}

pub fn enforce_single_primary(ph: &[String], vowels: &HashSet<String>) -> Vec<String> {
    let mut out = ph.to_vec();
    if !out.iter().any(|p| p.ends_with('1')) {
        if let Some(vi) = out.iter().position(|p| vowels.contains(drop_stress(p))) {
            // `replace(/[0-2]$/, "1")`: a phone with no stress digit is left as it is.
            if drop_stress(&out[vi]).len() != out[vi].len() {
                out[vi] = format!("{}1", drop_stress(&out[vi]));
            }
        }
    }
    out
}

pub struct G2pClasses {
    pub vowel_letters: Vec<String>,
    pub vowels: Vec<String>,
    pub voiceless: Vec<String>,
    pub sibilants: Vec<String>,
    pub stop_pieces: Vec<String>,
    pub stem_stress_prefixes: Vec<String>,
    pub letter_name_exceptions: IndexMap<String, String>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DecomposeSource {
    Compound,
    Morph,
    Ngram,
}

pub struct Decomposed {
    pub phones: Vec<String>,
    pub source: DecomposeSource,
}

/// An n-gram context's counts, indexed by token id. `e.c.find(([t]) => t === tok)` takes the FIRST row for
/// a token, so a duplicate keeps the first count.
struct Context {
    total: f64,
    counts: HashMap<u32, f64>,
}

/// A context key: the order and the last `order` token ids, left-padded with `NO_TOKEN`.
type ContextKey = (u8, [u32; 4]);

/// A token the model never saw. It appears in no context key, so a context holding it misses, which is
/// what the TS string lookup does for any unseen token.
const UNSEEN: u32 = u32::MAX;
const NO_TOKEN: u32 = u32::MAX - 1;

/// A context string back into its tokens. The TS joins tokens with " ", and a token's chunk may itself hold
/// spaces (`n:AH0 N`); every token starts `<letter>:` (or is the start token `^`) and no phone has `:`
/// second, so a piece without one continues the token before it.
fn split_context(ctx: &str) -> Vec<String> {
    let mut toks: Vec<String> = Vec::new();
    if ctx.is_empty() {
        return toks;
    }
    for piece in ctx.split(' ') {
        let starts = piece == START || piece.chars().nth(1) == Some(':');
        match toks.last_mut() {
            Some(last) if !starts => {
                last.push(' ');
                last.push_str(piece);
            }
            _ => toks.push(piece.to_string()),
        }
    }
    toks
}

/// A hypothesis's phones, as a chain back to the start (the TS copies the whole list per candidate).
struct Back {
    chunk: std::rc::Rc<str>,
    prev: Option<std::rc::Rc<Back>>,
}

pub struct EnglishG2p {
    model: EnglishG2pModel,
    contexts: HashMap<ContextKey, Context>,
    token_ids: HashMap<String, u32>,
    dict: IndexMap<JsString, Vec<String>>,
    common: HashSet<JsString>,
    arpabet_to_ipa: ArpabetToIpa,
    vowel_letter: HashSet<String>,
    vowel: HashSet<String>,
    voiceless: HashSet<String>,
    sibilant: HashSet<String>,
    stop_piece: HashSet<JsString>,
    stem_stress_prefix: HashSet<JsString>,
    letter_name_exceptions: HashMap<JsString, JsString>,
}

type StemFn = fn(&JsString) -> Vec<JsString>;

#[derive(Clone, Copy)]
enum Allo {
    Fixed(&'static [&'static str]),
    S,
    Ed,
}

fn cut(w: &JsString, n: isize) -> JsString {
    w.slice(0, Some(-n))
}

fn plus(w: JsString, s: &str) -> JsString {
    w.concat(&js(s))
}

fn i_to_y(w: JsString) -> JsString {
    js_re!("i$").replace(&w, &js("y"))
}

const SUFFIXES: [(&str, StemFn, Allo); 17] = [
    (
        "ies",
        |w| vec![plus(cut(w, 3), "y")],
        Allo::Fixed(&["IY0", "Z"]),
    ),
    ("ied", |w| vec![plus(cut(w, 3), "y")], Allo::Fixed(&["D"])),
    ("sses", |w| vec![cut(w, 2)], Allo::S),
    (
        "ing",
        |w| vec![cut(w, 3), plus(cut(w, 3), "e"), cut(w, 4)],
        Allo::Fixed(&["IH0", "NG"]),
    ),
    (
        "ings",
        |w| vec![cut(w, 4), plus(cut(w, 4), "e")],
        Allo::Fixed(&["IH0", "NG", "Z"]),
    ),
    (
        "edly",
        |w| vec![cut(w, 4), plus(cut(w, 4), "e")],
        Allo::Fixed(&["IH0", "D", "L", "IY0"]),
    ),
    (
        "ness",
        |w| vec![cut(w, 4), i_to_y(cut(w, 4))],
        Allo::Fixed(&["N", "AH0", "S"]),
    ),
    ("less", |w| vec![cut(w, 4)], Allo::Fixed(&["L", "AH0", "S"])),
    (
        "ment",
        |w| vec![cut(w, 4)],
        Allo::Fixed(&["M", "AH0", "N", "T"]),
    ),
    ("ful", |w| vec![cut(w, 3)], Allo::Fixed(&["F", "AH0", "L"])),
    (
        "est",
        |w| vec![cut(w, 3), plus(cut(w, 3), "e"), i_to_y(cut(w, 3))],
        Allo::Fixed(&["IH0", "S", "T"]),
    ),
    (
        "ers",
        |w| vec![cut(w, 3), plus(cut(w, 3), "e"), cut(w, 4)],
        Allo::Fixed(&["ER0", "Z"]),
    ),
    (
        "er",
        |w| {
            vec![
                cut(w, 2),
                plus(cut(w, 2), "e"),
                cut(w, 3),
                i_to_y(cut(w, 2)),
            ]
        },
        Allo::Fixed(&["ER0"]),
    ),
    (
        "ly",
        |w| vec![cut(w, 2), i_to_y(cut(w, 2)), plus(cut(w, 2), "le")],
        Allo::Fixed(&["L", "IY0"]),
    ),
    ("ed", |w| vec![cut(w, 2), cut(w, 1), cut(w, 3)], Allo::Ed),
    ("es", |w| vec![cut(w, 2), cut(w, 1)], Allo::S),
    ("s", |w| vec![cut(w, 1)], Allo::S),
];

const PLURAL_SUFFIX: [&str; 3] = ["s", "es", "sses"];

/// One code point of `s` at `i`, and its width.
fn code_point_str(s: &JsString, i: usize) -> (JsString, usize) {
    let w = if s.code_point_at(i).unwrap() > 0xFFFF {
        2
    } else {
        1
    };
    (JsString::from_units(&s.0[i..i + w]), w)
}

struct Best {
    parts: Vec<Vec<String>>,
    head: JsString,
    nparts: usize,
    min_len: usize,
    score: usize,
}

impl EnglishG2p {
    pub fn new(
        model: EnglishG2pModel,
        dict: IndexMap<JsString, Vec<String>>,
        common: HashSet<JsString>,
        arpabet_to_ipa: ArpabetToIpa,
        classes: G2pClasses,
    ) -> Result<EnglishG2p, String> {
        if model.order > 5 {
            return Err(format!(
                "g2p-model.json: order {} (the decoder keeps four tokens of history)",
                model.order
            ));
        }
        let set = |v: &[String]| v.iter().cloned().collect::<HashSet<String>>();
        let jset = |v: &[String]| v.iter().map(|s| js(s)).collect::<HashSet<JsString>>();
        let mut token_ids: HashMap<String, u32> = HashMap::new();
        let intern = |t: &str, ids: &mut HashMap<String, u32>| -> u32 {
            let n = ids.len() as u32;
            *ids.entry(t.to_string()).or_insert(n)
        };
        let mut contexts = HashMap::new();
        for (k, e) in &model.ngram {
            let bad = || {
                format!(
                    "g2p-model.json: ngram key {k:?} is not order|context with that many tokens"
                )
            };
            let (o, ctx) = k.split_once('|').ok_or_else(bad)?;
            let o: usize = o.parse().map_err(|_| bad())?;
            let toks = split_context(ctx);
            if toks.len() != o || o > 4 {
                return Err(bad());
            }
            let mut key = [NO_TOKEN; 4];
            for (slot, t) in key[4 - o..].iter_mut().zip(&toks) {
                *slot = intern(t, &mut token_ids);
            }
            let mut counts = HashMap::with_capacity(e.c.len());
            for (t, c) in &e.c {
                let id = intern(t, &mut token_ids);
                counts.entry(id).or_insert(*c);
            }
            contexts.insert((o as u8, key), Context { total: e.t, counts });
        }
        Ok(EnglishG2p {
            contexts,
            token_ids,
            vowel_letter: set(&classes.vowel_letters),
            vowel: set(&classes.vowels),
            voiceless: set(&classes.voiceless),
            sibilant: set(&classes.sibilants),
            stop_piece: jset(&classes.stop_pieces),
            stem_stress_prefix: jset(&classes.stem_stress_prefixes),
            letter_name_exceptions: classes
                .letter_name_exceptions
                .iter()
                .map(|(k, v)| (js(k), js(v)))
                .collect(),
            model,
            dict,
            common,
            arpabet_to_ipa,
        })
    }

    fn letter_phones(&self, l: &JsString) -> Option<&Vec<String>> {
        self.dict
            .get(self.letter_name_exceptions.get(l).unwrap_or(l))
    }

    fn is_letter_name_row(&self, piece: &JsString) -> bool {
        let Some(phones) = self.dict.get(piece) else {
            return false;
        };
        if piece.len() < 2 {
            return false;
        }
        let mut want: Vec<String> = Vec::new();
        let mut i = 0;
        while i < piece.len() {
            let (l, w) = code_point_str(piece, i);
            let Some(lp) = self.letter_phones(&l) else {
                return false;
            };
            want.extend(lp.iter().cloned());
            i += w;
        }
        want.len() == phones.len()
            && want
                .iter()
                .zip(phones)
                .all(|(x, y)| drop_stress(x) == drop_stress(y))
    }

    fn token_id(&self, tok: &str) -> u32 {
        self.token_ids.get(tok).copied().unwrap_or(UNSEEN)
    }

    /// `scoreTokAt(hist, tok)`: `last` holds the most recent four tokens of the history, newest last.
    fn score_tok_at(&self, last: &[u32; 4], tok: u32) -> (f64, i64) {
        let order = self.model.order;
        for o in (0..order).rev() {
            let mut key = [NO_TOKEN; 4];
            key[4 - o..].copy_from_slice(&last[4 - o..]);
            if let Some(e) = self.contexts.get(&(o as u8, key)) {
                if let Some(count) = e.counts.get(&tok) {
                    return (
                        js_math::log(count / e.total)
                            + (order - 1 - o) as f64 * js_math::log(self.model.alpha),
                        o as i64,
                    );
                }
            }
        }
        (js_math::log(1e-7), -1)
    }

    fn ngram_decode(&self, w: &JsString) -> Vec<String> {
        use std::rc::Rc;
        struct Hyp {
            last: [u32; 4],
            back: Option<Rc<Back>>,
            score: f64,
        }
        let start = self.token_id(START);
        let mut beam = vec![Hyp {
            last: [start; 4],
            back: None,
            score: 0.0,
        }];
        let empty = vec![String::new()];
        for i in 0..w.len() {
            let c = w.char_at(i);
            let cs = c.to_string_lossy();
            let raw = self.model.grapheme_chunks.get(&cs).unwrap_or(&empty);
            let is_vowel_letter = self.vowel_letter.contains(&cs);
            let empty_penalized = is_vowel_letter && !(cs == "e" && i == w.len() - 1);
            let final_consonant = i == w.len() - 1
                && js_re!("^[a-z]$", "u").test(&c)
                && !is_vowel_letter
                && cs != "y"
                && (i == 0 || w.char_at(i - 1) != c);
            let sib_letter = "sxzc".contains(cs.as_str()) && !cs.is_empty();
            let filtered: Vec<&String> = if sib_letter {
                raw.iter().collect()
            } else {
                raw.iter()
                    .filter(|ch| {
                        if ch.is_empty() {
                            return true;
                        }
                        let last = ch.split(' ').next_back().unwrap();
                        last != "S" && last != "Z"
                    })
                    .collect()
            };
            let chunks: Vec<&String> = if filtered.is_empty() {
                raw.iter().collect()
            } else {
                filtered
            };
            let toks: Vec<(u32, Rc<str>)> = chunks
                .iter()
                .map(|chunk| {
                    (
                        self.token_id(&format!("{cs}:{chunk}")),
                        Rc::from(chunk.as_str()),
                    )
                })
                .collect();
            let mut next: Vec<Hyp> = Vec::with_capacity(beam.len() * toks.len());
            for h in &beam {
                for (tok, chunk) in &toks {
                    let (lp, ord) = self.score_tok_at(&h.last, *tok);
                    let mut s = h.score + lp;
                    if chunk.is_empty() && empty_penalized && ord < self.model.evp_order {
                        s -= self.model.evp;
                    }
                    if chunk.is_empty() && final_consonant {
                        s -= self.model.evp / 2.0;
                    }
                    let mut last = [0; 4];
                    last[..3].copy_from_slice(&h.last[1..]);
                    last[3] = *tok;
                    let back = if chunk.is_empty() {
                        h.back.clone()
                    } else {
                        Some(Rc::new(Back {
                            chunk: chunk.clone(),
                            prev: h.back.clone(),
                        }))
                    };
                    next.push(Hyp {
                        last,
                        back,
                        score: s,
                    });
                }
            }
            // `sort((a, b) => b.score - a.score)`: stable, descending.
            next.sort_by(|a, b| {
                b.score
                    .partial_cmp(&a.score)
                    .unwrap_or(std::cmp::Ordering::Equal)
            });
            next.truncate(BEAM);
            beam = next;
        }
        let mut chunks = Vec::new();
        let mut cur = beam.swap_remove(0).back;
        while let Some(b) = cur {
            chunks.push(b.chunk.clone());
            cur = b.prev.clone();
        }
        chunks
            .iter()
            .rev()
            .flat_map(|c| c.split(' ').map(String::from).collect::<Vec<_>>())
            .collect()
    }

    fn allomorph(&self, allo: Allo, stem: &[String]) -> Vec<String> {
        let f = drop_stress(stem.last().map_or("", |s| s.as_str()));
        let v = |x: &[&str]| x.iter().map(|s| s.to_string()).collect();
        match allo {
            Allo::Fixed(x) => v(x),
            Allo::S if self.sibilant.contains(f) => v(&["IH0", "Z"]),
            Allo::S if self.voiceless.contains(f) => v(&["S"]),
            Allo::S => v(&["Z"]),
            Allo::Ed if f == "T" || f == "D" => v(&["IH0", "D"]),
            Allo::Ed if self.voiceless.contains(f) => v(&["T"]),
            Allo::Ed => v(&["D"]),
        }
    }

    fn join_morph(&self, stem: &JsString, sp: &[String], suffix: Vec<String>) -> Vec<String> {
        let keep = match sp.last() {
            None => true,
            Some(last) => {
                !stem.ends_with(&js("ire"))
                    || drop_stress(last) != "ER"
                    || suffix.is_empty()
                    || !self.vowel.contains(drop_stress(&suffix[0]))
            }
        };
        if keep {
            return sp.iter().cloned().chain(suffix).collect();
        }
        sp[..sp.len() - 1]
            .iter()
            .cloned()
            .chain(std::iter::once("R".to_string()))
            .chain(suffix)
            .collect()
    }

    fn morph_decode(&self, w: &JsString, as_piece: bool) -> Option<Vec<String>> {
        for (suf, stems, allo) in SUFFIXES {
            if !w.ends_with(&js(suf)) || w.len() <= suf.len() + 1 {
                continue;
            }
            for stem in stems(w) {
                if stem.len() < 2 {
                    continue;
                }
                if self.is_letter_name_row(&stem) && (as_piece || !PLURAL_SUFFIX.contains(&suf)) {
                    continue;
                }
                let Some(sp) = self.dict.get(&stem) else {
                    continue;
                };
                return Some(self.join_morph(&stem, sp, self.allomorph(allo, sp)));
            }
        }
        None
    }

    fn compound_split(&self, w: &JsString) -> Option<Vec<String>> {
        let n = w.len();
        let mut best: Vec<Option<Best>> = (0..=n).map(|_| None).collect();
        best[0] = Some(Best {
            parts: Vec::new(),
            head: JsString::new(),
            nparts: 0,
            min_len: usize::MAX,
            score: 0,
        });
        for i in 0..n {
            if best[i].is_none() {
                continue;
            }
            for j in (i + MINPART)..=n {
                let piece = JsString::from_units(&w.0[i..j]);
                if self.stop_piece.contains(&piece) {
                    continue;
                }
                if !self.common.is_empty()
                    && !self.common.contains(&piece)
                    && !(j == n && j - i >= 5)
                {
                    continue;
                }
                let mut phones: Option<Vec<String>> = if self.is_letter_name_row(&piece) {
                    None
                } else {
                    self.dict.get(&piece).cloned()
                };
                if phones.is_none() && j == n && j - i >= 5 {
                    if let Some(mp) = self.morph_decode(&piece, true) {
                        phones = Some(mp);
                    }
                }
                let Some(phones) = phones else { continue };
                let bi = best[i].as_ref().unwrap();
                let mut parts = bi.parts.clone();
                parts.push(phones);
                let cand = Best {
                    parts,
                    head: if i == 0 { piece } else { bi.head.clone() },
                    nparts: bi.nparts + 1,
                    min_len: bi.min_len.min(j - i),
                    score: bi.score + (j - i) * (j - i),
                };
                let replace = match &best[j] {
                    None => true,
                    Some(cur) => {
                        cand.min_len > cur.min_len
                            || (cand.min_len == cur.min_len && cand.score > cur.score)
                    }
                };
                if replace {
                    best[j] = Some(cand);
                }
            }
        }
        let full = best[n].as_ref()?;
        if full.nparts < 2 {
            return None;
        }
        // The stressed part keeps its primary; the rest are stepped down.
        let keep = if self.stem_stress_prefix.contains(&full.head) {
            1
        } else {
            0
        };
        Some(
            full.parts
                .iter()
                .enumerate()
                .flat_map(|(idx, p)| {
                    if idx == keep {
                        p.clone()
                    } else {
                        stress_down(p)
                    }
                })
                .collect(),
        )
    }

    fn has_nucleus(&self, ph: &[String]) -> bool {
        ph.iter().any(|p| self.vowel.contains(drop_stress(p)))
    }

    fn spell_out_phones(&self, w: &JsString) -> Option<Vec<String>> {
        let mut out = Vec::new();
        let mut i = 0;
        while i < w.len() {
            let (l, width) = code_point_str(w, i);
            out.extend(self.letter_phones(&l)?.iter().cloned());
            i += width;
        }
        (!out.is_empty()).then_some(out)
    }

    pub fn decompose(&self, w: &JsString) -> Decomposed {
        let finish = |ph: Vec<String>| {
            enforce_single_primary(&collapse_geminates(&ph, &self.vowel), &self.vowel)
        };
        if let Some(c) = self.compound_split(w) {
            return Decomposed {
                phones: finish(c),
                source: DecomposeSource::Compound,
            };
        }
        if let Some(m) = self.morph_decode(w, false) {
            return Decomposed {
                phones: finish(m),
                source: DecomposeSource::Morph,
            };
        }
        let n = finish(self.ngram_decode(w));
        let is_elongation = w.len() >= 3
            && w.0[w.len() - 1] == w.0[w.len() - 2]
            && w.0[w.len() - 2] == w.0[w.len() - 3];
        if w.len() >= 2 && !self.has_nucleus(&n) && !is_elongation {
            let plural = w.ends_with(&js("s"))
                && w.len() >= 4
                && !js_re!("[aeiouy]", "u").test(&w.slice(0, Some(-1)));
            if let Some(spelled) = self.spell_out_phones(&if plural {
                w.slice(0, Some(-1))
            } else {
                w.clone()
            }) {
                let ph = if plural {
                    spelled
                        .into_iter()
                        .chain(std::iter::once("Z".into()))
                        .collect()
                } else {
                    spelled
                };
                return Decomposed {
                    phones: enforce_single_primary(&ph, &self.vowel),
                    source: DecomposeSource::Ngram,
                };
            }
        }
        Decomposed {
            phones: n,
            source: DecomposeSource::Ngram,
        }
    }

    pub fn known_word(&self, w: &JsString) -> bool {
        self.dict.contains_key(w)
    }

    pub fn g2p(&self, word: &JsString) -> JsString {
        let d = self.decompose(word);
        let w = if d.source == DecomposeSource::Compound {
            JsString::new()
        } else {
            word.clone()
        };
        self.arpabet_to_ipa.convert(&d.phones, &w)
    }

    pub fn dict(&self) -> &IndexMap<JsString, Vec<String>> {
        &self.dict
    }
}
