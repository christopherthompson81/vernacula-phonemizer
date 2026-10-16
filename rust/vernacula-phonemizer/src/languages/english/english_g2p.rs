//! The English OOV G2P: compound split over the lexicon, then suffix morphology, then a joint n-gram beam
//! decode. Ported from src/languages/english/englishG2p.ts — see that file for the measured policy.

use std::collections::{HashMap, HashSet};

use indexmap::IndexMap;

use super::english_arpabet::ArpabetToIpa;
use crate::core::js_math;
use crate::core::js_string::{JsString, js};
use crate::js_re;

/// The model as `g2p-model.bin` stores it (`g2p_model_binary`): a joint n-gram over grapheme:phone tokens, with
/// the tokens as ids. Context `i` has order `ctx_order[i]`, its tokens in the LAST that many of its four
/// `ctx_tok` slots (the rest `PAD`), total `total[i]`, and candidates `cand`/`count[row_start[i]..row_start[i + 1]]`.
pub struct EnglishG2pModel {
    pub order: usize,
    pub alpha: f64,
    pub evp: f64,
    pub evp_order: i64,
    pub grapheme_chunks: IndexMap<String, Vec<String>>,
    pub tokens: Vec<String>,
    pub ctx_order: Vec<u8>,
    pub ctx_tok: Vec<u16>,
    pub total: Vec<u32>,
    pub row_start: Vec<u32>,
    pub cand: Vec<u16>,
    pub count: Vec<u32>,
}

/// An empty context slot in `EnglishG2pModel::ctx_tok`.
pub const PAD: u16 = 0xFFFF;

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

const SUFFIXES: [(&str, StemFn, Allo); 19] = [
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
    // -able/-ible prefer the stem WITHOUT ⟨e⟩ (#1504); see the TS twin for the measurement.
    (
        "able",
        |w| {
            // `-iable` tries the ⟨y⟩ stem FIRST: `reli` is a dictionary row too (see the TS twin).
            let mut v = Vec::new();
            if w.len() >= 5 && w.0[w.len() - 5] == u16::from(b'i') {
                v.push(plus(cut(w, 5), "y"));
            }
            v.push(cut(w, 4));
            v.push(plus(cut(w, 4), "e"));
            if w.len() >= 6 && w.0[w.len() - 5] == w.0[w.len() - 6] {
                v.push(cut(w, 5));
            }
            v
        },
        Allo::Fixed(&["AH0", "B", "AH0", "L"]),
    ),
    (
        "ible",
        |w| vec![cut(w, 4), plus(cut(w, 4), "e")],
        Allo::Fixed(&["AH0", "B", "AH0", "L"]),
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
/// Suffixes `morph_decode` serves only to a WHOLE word, never to `compound_split`'s final piece (#1504): a
/// stem+able piece lets the splitter compose `in|credible` with the stress on `in`.
const DERIVATIONAL_ONLY: [&str; 2] = ["able", "ible"];
fn ends_derivational(w: &JsString) -> bool {
    DERIVATIONAL_ONLY.iter().any(|s| w.ends_with(&js(s)))
}

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
                "g2p-model.bin: order {} (the decoder keeps four tokens of history)",
                model.order
            ));
        }
        let set = |v: &[String]| v.iter().cloned().collect::<HashSet<String>>();
        let jset = |v: &[String]| v.iter().map(|s| js(s)).collect::<HashSet<JsString>>();
        let mut model = model;
        let token_ids: HashMap<String, u32> = model
            .tokens
            .iter()
            .enumerate()
            .map(|(i, t)| (t.clone(), i as u32))
            .collect();
        let mut contexts = HashMap::with_capacity(model.ctx_order.len());
        for (i, &o) in model.ctx_order.iter().enumerate() {
            let mut key = [NO_TOKEN; 4];
            for (slot, &t) in key.iter_mut().zip(&model.ctx_tok[i * 4..i * 4 + 4]) {
                if t != PAD {
                    *slot = u32::from(t);
                }
            }
            let rows = model.row_start[i] as usize..model.row_start[i + 1] as usize;
            let mut counts = HashMap::with_capacity(rows.len());
            for k in rows {
                // The first occurrence of a token wins, as the TS `find` did.
                counts
                    .entry(u32::from(model.cand[k]))
                    .or_insert(f64::from(model.count[k]));
            }
            contexts.insert(
                (o, key),
                Context {
                    total: f64::from(model.total[i]),
                    counts,
                },
            );
        }
        // The arrays are in `contexts` now; the model keeps only its parameters.
        for v in [&mut model.ctx_tok, &mut model.cand] {
            *v = Vec::new();
        }
        for v in [&mut model.total, &mut model.row_start, &mut model.count] {
            *v = Vec::new();
        }
        model.ctx_order = Vec::new();
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
            if as_piece && DERIVATIONAL_ONLY.contains(&suf) {
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
        // A derivational suffix outranks the compound split (#1504): `able` is a common word, so the
        // splitter read `accept|able` with the full vowel of the word *able*. See the TS twin.
        let derived = if ends_derivational(w) {
            self.morph_decode(w, false)
        } else {
            None
        };
        if derived.is_none() {
            if let Some(c) = self.compound_split(w) {
                return Decomposed {
                    phones: finish(c),
                    source: DecomposeSource::Compound,
                };
            }
        }
        if let Some(m) = derived.or_else(|| self.morph_decode(w, false)) {
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

    /// A derivational form read from its DICTIONARY STEM (`castable` = `cast` + -able), or None when the word
    /// has no such suffix or its stem is unknown. The resolver prefers it to the neural tagger (#1504).
    pub fn derived(&self, word: &JsString) -> Option<JsString> {
        if !ends_derivational(word) {
            return None;
        }
        let m = self.morph_decode(word, false)?;
        let ph = enforce_single_primary(&collapse_geminates(&m, &self.vowel), &self.vowel);
        Some(self.arpabet_to_ipa.convert(&ph, word))
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
