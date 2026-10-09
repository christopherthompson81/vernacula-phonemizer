//! Kanji → kana readings (longest match over the whole-word map, per-kanji on/kun/rendaku fallback) and
//! bunsetsu segmentation of spaceless text. Ported from src/languages/japanese/kanji.ts — see that file for
//! the corpus evidence.
//!
//! The ~9 MB of data loads lazily, once, on first use, as the TS does.

use std::collections::{HashMap, HashSet};
use std::sync::OnceLock;

use super::manifest::DIR;
use crate::core::js_string::{JsString, js};
use crate::core::load_tsv::{TsvOptions, load_lines, load_tsv_map};
use crate::core::provenance::{Piece, rebuilt, tracing};
use crate::js_re;

#[derive(Clone, Default)]
pub struct KanjiFallback {
    pub on: Option<JsString>,
    pub kun: Option<JsString>,
    pub rendaku: Option<JsString>,
}

pub struct Readings {
    pub map: HashMap<JsString, JsString>,
    /// Longest word key, in code points.
    pub max_key_length: usize,
    pub fallback: HashMap<JsString, KanjiFallback>,
    pub adverbs: HashSet<JsString>,
    /// Longest of (map keys ∪ adverbs), in code points.
    pub max_unit_length: usize,
}

fn cp_len(s: &JsString) -> usize {
    s.code_points().count()
}

fn load() -> Result<Readings, String> {
    let e = |e: crate::core::data_source::DataError| e.to_string();
    let map: HashMap<JsString, JsString> =
        load_tsv_map(DIR, "readings.tsv", |v, _| Some(v.clone()), TsvOptions::default())
            .map_err(e)?
            .into_iter()
            .collect();
    let fallback = load_tsv_map(
        DIR,
        "fallback.tsv",
        |rest, _| {
            let mut parts = rest.split(&js("\t")).into_iter();
            let keep = |p: Option<JsString>| p.filter(|s| !s.is_empty());
            let (on, kun, rendaku) = (keep(parts.next()), keep(parts.next()), keep(parts.next()));
            Some(KanjiFallback { on, kun, rendaku })
        },
        TsvOptions::default(),
    )
    .map_err(e)?
    .into_iter()
    .collect();
    let adverbs: HashSet<JsString> = load_lines(DIR, "adverbs.txt", false).map_err(e)?.into_iter().collect();
    let max_key_length = map.keys().map(cp_len).max().unwrap_or(0);
    let max_unit_length = adverbs.iter().map(cp_len).fold(max_key_length, usize::max);
    Ok(Readings { map, max_key_length, fallback, adverbs, max_unit_length })
}

/// The reading tables, or why they could not be loaded. Loaded once; a failure is cached.
pub fn try_readings() -> Result<&'static Readings, String> {
    static R: OnceLock<Result<Readings, String>> = OnceLock::new();
    R.get_or_init(load).as_ref().map_err(Clone::clone)
}

/// The tables for code that runs after `try_readings` has succeeded (the engine checks it per call).
fn readings() -> &'static Readings {
    try_readings().unwrap_or_else(|e| panic!("{e}"))
}

fn is_hiragana(ch: &JsString) -> bool {
    js_re!(r"[ぁ-ゖ]", "u").test(ch)
}

pub(crate) fn is_kanji(ch: &JsString) -> bool {
    js_re!(r"[㐀-鿿\u{20000}-\u{2a6df}々]", "u").test(ch)
}

fn is_kana(ch: &JsString) -> bool {
    js_re!(r"[ぁ-ゖァ-ヿー]", "u").test(ch)
}

/// A string's code points, with their unit offsets so a run of them can be sliced without re-joining.
struct Cps {
    units: Vec<u16>,
    chars: Vec<JsString>,
    starts: Vec<usize>,
}

impl Cps {
    fn new(s: &JsString) -> Cps {
        let chars = s.code_point_strings();
        let mut starts = Vec::with_capacity(chars.len() + 1);
        let mut at = 0;
        for c in &chars {
            starts.push(at);
            at += c.len();
        }
        starts.push(at);
        Cps { units: s.0.clone(), chars, starts }
    }

    fn len(&self) -> usize {
        self.chars.len()
    }

    /// `chars.slice(i, i + len).join("")`.
    fn join(&self, i: usize, len: usize) -> JsString {
        let end = (i + len).min(self.len());
        let i = i.min(end);
        JsString::from_units(&self.units[self.starts[i]..self.starts[end]])
    }
}

/// The longest key matching at `chars[i]`, scanning from min(max_key_length, remaining) down to `min_len`.
fn longest_key_match(
    chars: &Cps,
    i: usize,
    max_key_length: usize,
    min_len: usize,
    in_keyset: impl Fn(&JsString) -> bool,
) -> Option<(JsString, usize)> {
    let max_len = max_key_length.min(chars.len() - i);
    let mut len = max_len;
    while len >= min_len {
        let sub = chars.join(i, len);
        if in_keyset(&sub) {
            return Some((sub, len));
        }
        if len == 0 {
            break;
        }
        len -= 1;
    }
    None
}

/// Split a compound's stored reading at its morpheme boundaries by aligning each character's own readings
/// (fallback on/kun/rendaku; a kana matches itself). `None` when no alignment exists.
fn align_compound_reading(
    unit: &JsString,
    reading: &JsString,
    fallback: &HashMap<JsString, KanjiFallback>,
) -> Option<Vec<JsString>> {
    let chars = unit.code_point_strings();
    if chars.len() < 2 {
        return None;
    }
    fn solve(
        ci: usize,
        ri: usize,
        chars: &[JsString],
        reading: &JsString,
        fallback: &HashMap<JsString, KanjiFallback>,
    ) -> Option<Vec<JsString>> {
        if ci == chars.len() {
            return (ri == reading.len()).then(Vec::new);
        }
        let ch = &chars[ci];
        let mut cands: Vec<JsString> = Vec::new();
        if is_kanji(ch) {
            if let Some(fb) = fallback.get(ch) {
                for r in [&fb.on, &fb.kun, &fb.rendaku].into_iter().flatten() {
                    if !r.is_empty() {
                        cands.push(r.clone());
                    }
                }
            }
        } else {
            cands.push(ch.clone());
        }
        for cand in cands {
            // `reading.startsWith(cand, ri)`.
            if cand.is_empty() || ri > reading.len() || !reading.0[ri..].starts_with(&cand.0) {
                continue;
            }
            if let Some(rest) = solve(ci + 1, ri + cand.len(), chars, reading, fallback) {
                let mut out = vec![cand];
                out.extend(rest);
                return Some(out);
            }
        }
        None
    }
    solve(0, 0, &chars, reading, fallback)
}

/// Longest-match kanji→kana over one token, as SEGMENTS: one per kanji reading, a literal-kana run kept whole.
pub fn apply_reading_segments(word: &JsString) -> Vec<JsString> {
    let r = readings();
    let chars = Cps::new(word);
    let mut segs: Vec<JsString> = Vec::new();
    let mut kana_run = JsString::new();
    fn push_reading(segs: &mut Vec<JsString>, kana_run: &mut JsString, r: JsString) {
        if !kana_run.is_empty() {
            segs.push(std::mem::take(kana_run));
        }
        segs.push(r);
    }
    let mut i = 0;
    let mut prev_kanji_reading = JsString::new();
    let mut prev_was_kanji = false;
    while i < chars.len() {
        let ch = &chars.chars[i];
        if (*ch == "々" || *ch == "〻") && !prev_kanji_reading.is_empty() {
            push_reading(&mut segs, &mut kana_run, prev_kanji_reading.clone());
            i += 1;
            continue;
        }
        if let Some((unit, len)) = longest_key_match(&chars, i, r.max_key_length, 1, |k| r.map.contains_key(k)) {
            let mut reading = r.map[&unit].clone();
            let single = len == 1 && is_kanji(&unit);
            if single && prev_was_kanji {
                if let Some(fb) = r.fallback.get(&unit) {
                    if let Some(rd) = &fb.rendaku {
                        if fb.kun.as_ref() == Some(&reading) {
                            reading = rd.clone();
                        }
                    }
                }
            }
            let parts = if single { None } else { align_compound_reading(&unit, &reading, &r.fallback) };
            match parts {
                None => push_reading(&mut segs, &mut kana_run, reading.clone()),
                Some(parts) => {
                    for p in parts {
                        push_reading(&mut segs, &mut kana_run, p);
                    }
                }
            }
            prev_kanji_reading = if single { reading } else { JsString::new() };
            prev_was_kanji = unit.code_point_strings().iter().any(is_kanji);
            i += len;
            continue;
        }
        if let Some(fb) = r.fallback.get(ch) {
            let reading = match (&fb.rendaku, prev_was_kanji) {
                (Some(rd), true) => rd.clone(),
                _ => {
                    let want_kun = chars.chars.get(i + 1).is_some_and(is_hiragana);
                    let pick = if want_kun { fb.kun.as_ref().or(fb.on.as_ref()) } else { fb.on.as_ref().or(fb.kun.as_ref()) };
                    pick.cloned().unwrap_or_else(|| ch.clone())
                }
            };
            push_reading(&mut segs, &mut kana_run, reading.clone());
            prev_kanji_reading = reading;
            prev_was_kanji = true;
            i += 1;
            continue;
        }
        kana_run.push_str(ch);
        prev_kanji_reading = JsString::new();
        prev_was_kanji = false;
        i += 1;
    }
    if !kana_run.is_empty() {
        segs.push(kana_run);
    }
    segs
}

/// The flattened reading (segments joined).
pub fn apply_readings(word: &JsString) -> JsString {
    JsString::join(&apply_reading_segments(word), &JsString::new())
}

/// True if a ≥2-character whole-word entry whose SECOND character is a kanji starts at the head of `text`.
pub fn heads_compound(text: &JsString) -> bool {
    let r = readings();
    longest_key_match(&Cps::new(text), 0, r.max_key_length, 2, |k| {
        r.map.contains_key(k) && k.code_point_strings().get(1).is_some_and(is_kanji)
    })
    .is_some()
}

const SINGLE_PARTICLES: [&str; 8] = ["が", "を", "に", "の", "と", "も", "や", "で"];
const MULTI_PARTICLES: [&str; 3] = ["から", "まで", "など"];
const DEMONSTRATIVES: [&str; 4] = ["この", "その", "あの", "どの"];

fn in_list(list: &[&str], s: &JsString) -> bool {
    list.iter().any(|p| *s == *p)
}

/// Insert spaces at bunsetsu boundaries in a spaceless Japanese run.
pub fn segment_text(text: &JsString) -> JsString {
    let r = readings();
    let chars = Cps::new(text);
    let rec = tracing();
    let mut pieces: Vec<Piece> = Vec::new();
    let mut at = 0usize;
    let mut out = JsString::new();
    let mut prev: Option<JsString> = None;
    let mut prev_adv = false;
    let mut prev_particle = false;
    let mut i = 0;
    let katakana = js_re!(r"^[ァ-ー]$");
    let space = js(" ");
    while i < chars.len() {
        let ch = &chars.chars[i];
        if !is_kanji(ch) && !is_kana(ch) {
            out.push_str(ch);
            if rec {
                pieces.push((ch.clone(), at, at + ch.len()));
            }
            at += ch.len();
            prev = Some(ch.clone());
            prev_adv = false;
            prev_particle = false;
            i += 1;
            continue;
        }
        let m = longest_key_match(&chars, i, r.max_unit_length, 2, |k| {
            r.map.contains_key(k) || r.adverbs.contains(k)
        });
        let mut unit = m.as_ref().map_or_else(|| ch.clone(), |(u, _)| u.clone());
        let mut forced_particle = false;
        let prev_content = prev.as_ref().is_some_and(|p| is_kanji(p) || katakana.test(p));
        if m.is_none() {
            if prev_content {
                for mp in MULTI_PARTICLES {
                    let mp = js(mp);
                    if chars.join(i, mp.len()) == mp {
                        unit = mp;
                        forced_particle = true;
                        break;
                    }
                }
            }
            if !forced_particle && (prev.is_none() || prev_particle || out.is_empty() || out.ends_with(&space)) {
                for dm in DEMONSTRATIVES {
                    let dm = js(dm);
                    if chars.join(i, dm.len()) == dm {
                        unit = dm;
                        forced_particle = true;
                        break;
                    }
                }
            }
        }
        if !forced_particle && prev_content && in_list(&MULTI_PARTICLES, &unit) {
            forced_particle = true;
        }
        if !forced_particle && unit == "を" && prev.is_some() {
            forced_particle = true;
        }
        let is_adv = r.adverbs.contains(&unit);
        let u = unit.code_point_strings();
        let is_kana_adverb = is_adv && u.iter().all(is_kana);
        // `unit[0]`: the first CODE UNIT, so an astral kanji's high surrogate is not a kanji here.
        let unit0 = JsString(vec![unit.0[0]]);
        let head_kanji = is_kanji(&unit0);
        let te_form_aux = unit0 == "い" && prev.as_ref().is_some_and(|p| *p == "て" || *p == "で");
        let chained_particle = (in_list(&SINGLE_PARTICLES, &unit)
            || unit == "は"
            || unit == "へ"
            || in_list(&MULTI_PARTICLES, &unit))
            && u.iter().all(is_kana);
        let boundary = prev.as_ref().is_some_and(|p| {
            (is_kana(p) && head_kanji) || (prev_adv && head_kanji && u.len() >= 2) || is_kana_adverb
        }) || (prev_particle && !chained_particle)
            || te_form_aux;
        if boundary {
            out.push_str(&space);
            if rec {
                pieces.push((space.clone(), at, at));
            }
        }
        let next1 = chars.chars.get(i + 1);
        let copula_de = unit == "で" && next1.is_some_and(|n| *n == "す" || *n == "し" || *n == "き");
        let particle = forced_particle
            || (prev_particle && chained_particle)
            || (u.len() == 1
                && !copula_de
                && prev.as_ref().is_some_and(|p| {
                    (in_list(&SINGLE_PARTICLES, &unit) && is_kanji(p))
                        || ((unit == "は" || unit == "へ")
                            && (is_kanji(p) || is_kana(p) || js_re!(r"\d", "u").test(p)))
                }));
        let emitted = if particle && unit == "は" {
            js("わ")
        } else if particle && unit == "へ" {
            js("え")
        } else {
            unit.clone()
        };
        out.push_str(&emitted);
        if rec {
            pieces.push((emitted, at, at + unit.len()));
        }
        at += unit.len();
        prev_particle = particle;
        prev = u.last().cloned();
        prev_adv = is_adv;
        i += u.len();
    }
    if rec { rebuilt(text, &pieces) } else { out }
}
