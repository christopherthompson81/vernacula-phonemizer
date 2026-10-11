//! The Thai orthographic parser: leading-vowel reorder, mark stripping, vowel-span tokenizing, the epitran
//! schwa fates, and the syllable scan that yields onset/nucleus/coda and computed tone in one pass.
//! Ported from src/languages/thai/syllabifier.ts — see that file for the corpus evidence.
//!
//! Characters are code points (`u32`), as `[...s]` yields them; every Thai letter is in the BMP.

use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;

use super::manifest::MANIFEST;
use super::thai_tone::{
    SilentLeader, ThaiConsonantClass, ThaiTone, ThaiToneMark, compute_thai_tone,
    thai_consonant_class, thai_effective_class,
};
use crate::core::js_string::JsString;
use crate::js_re;

// Generated from the TS literals by .probe/th/gen_tables.mts (key order preserved).
const THAI_LEXICAL_FIXUPS: [(&str, &str); 1] = [("ก็", "ก่อ")];
const THAI_CONS_PH: [(&str, &str); 44] = [
    ("ก", "k"),
    ("ข", "kh"),
    ("ฃ", "kh"),
    ("ค", "kh"),
    ("ฅ", "kh"),
    ("ฆ", "kh"),
    ("ง", "N"),
    ("จ", "tS"),
    ("ฉ", "tSh"),
    ("ช", "tSh"),
    ("ฌ", "tSh"),
    ("ซ", "s"),
    ("ญ", "j"),
    ("ฎ", "d"),
    ("ด", "d"),
    ("ฏ", "t"),
    ("ต", "t"),
    ("ฐ", "th"),
    ("ฑ", "th"),
    ("ฒ", "th"),
    ("ถ", "th"),
    ("ท", "th"),
    ("ธ", "th"),
    ("ณ", "n"),
    ("น", "n"),
    ("บ", "b"),
    ("ป", "p"),
    ("ผ", "ph"),
    ("พ", "ph"),
    ("ภ", "ph"),
    ("ฝ", "f"),
    ("ฟ", "f"),
    ("ม", "m"),
    ("ย", "j"),
    ("ร", "r"),
    ("ล", "l"),
    ("ฬ", "l"),
    ("ว", "w"),
    ("ศ", "s"),
    ("ษ", "s"),
    ("ส", "s"),
    ("ห", "h"),
    ("ฮ", "h"),
    ("ฤ", "r"),
];
const THAI_E_COMBOS: [&str; 11] = [
    "เือะ",
    "เือ",
    "เียะ",
    "เีย",
    "เาะ",
    "เา",
    "เอะ",
    "เอ",
    "เิ",
    "เะ",
    "เ",
];
const THAI_CLUSTER_FORMER: [(&str, &str); 6] = [
    ("k", "k"),
    ("kh", "k"),
    ("p", "p"),
    ("ph", "p"),
    ("t", "t"),
    ("th", "t"),
];

const KO_KAI: u32 = 0x0E01; // ก
const HO_NOKHUK: u32 = 0x0E2E; // ฮ
const HO_HIP: u32 = 0x0E2B; // ห
const O_ANG: u32 = 0x0E2D; // อ
const YO_YAK: u32 = 0x0E22; // ย
const RO_RUA: u32 = 0x0E23; // ร
const WO_WAEN: u32 = 0x0E27; // ว
const SARA_E: u32 = 0x0E40; // เ
const SARA_AE: u32 = 0x0E41; // แ
const SARA_O: u32 = 0x0E42; // โ
const SARA_AI_MAIMUAN: u32 = 0x0E43; // ใ
const SARA_AI_MAIMALAI: u32 = 0x0E44; // ไ
const SARA_A: u32 = 0x0E30; // ะ
const MAI_HAN_AKAT: u32 = 0x0E31; // ั
const SARA_AM: u32 = 0x0E33; // ำ
const SARA_UEE: u32 = 0x0E37; // ื
const MAITAIKHU: u32 = 0x0E47; // ็

/// `[...s]`.
pub fn cps(s: &JsString) -> Vec<u32> {
    s.code_points().collect()
}

/// `cs.join("")`.
pub fn from_cps(cs: &[u32]) -> JsString {
    let mut out = JsString::new();
    for &c in cs {
        if c > 0xFFFF {
            let v = c - 0x10000;
            out.0.push(0xD800 + (v >> 10) as u16);
            out.0.push(0xDC00 + (v & 0x3FF) as u16);
        } else {
            out.0.push(c as u16);
        }
    }
    out
}

fn one_cp(s: &str) -> Option<u32> {
    let mut it = s.chars();
    match (it.next(), it.next()) {
        (Some(c), None) => Some(c as u32),
        _ => None,
    }
}

/// A `Set<string>` probed with one code point or `""` (an index past the end). Entries that are not a single
/// code point can never equal one, so only the empty string survives from them.
pub(super) struct CpSet {
    set: HashSet<u32>,
    has_empty: bool,
}

impl CpSet {
    pub(super) fn new<'a>(items: impl IntoIterator<Item = &'a str>) -> CpSet {
        let mut set = HashSet::new();
        let mut has_empty = false;
        for s in items {
            if s.is_empty() {
                has_empty = true;
            } else if let Some(c) = one_cp(s) {
                set.insert(c);
            }
        }
        CpSet { set, has_empty }
    }
    pub(super) fn has(&self, c: Option<u32>) -> bool {
        match c {
            Some(c) => self.set.contains(&c),
            None => self.has_empty,
        }
    }
}

/// `/[เ-ไ]/` (no `u`) tested on one code point.
fn is_leading_vowel(c: Option<u32>) -> bool {
    c.is_some_and(|c| (SARA_E..=SARA_AI_MAIMALAI).contains(&c))
}

/// `c >= "ก" && c <= "ฮ"`.
fn is_thai_consonant(c: Option<u32>) -> bool {
    c.is_some_and(|c| (KO_KAI..=HO_NOKHUK).contains(&c))
}

/// `THAI_H_RAISABLE`: from thai.jsonc's `raisable`, the list g2p reads too.
pub(super) static THAI_H_RAISABLE: LazyLock<HashSet<u32>> =
    LazyLock::new(|| MANIFEST.raisable.chars().map(|c| c as u32).collect());

fn raisable(c: Option<u32>) -> bool {
    c.is_some_and(|c| THAI_H_RAISABLE.contains(&c))
}

/// `THAI_LEADER_SONORANT`: the raisable set minus ย/ร/ล/ว.
static THAI_LEADER_SONORANT: LazyLock<HashSet<u32>> = LazyLock::new(|| {
    THAI_H_RAISABLE
        .iter()
        .copied()
        .filter(|&c| !"ยรลว".chars().any(|x| x as u32 == c))
        .collect()
});

static THAI_CONS_PH_MAP: LazyLock<HashMap<u32, &'static str>> = LazyLock::new(|| {
    THAI_CONS_PH
        .iter()
        .map(|&(g, p)| (one_cp(g).unwrap(), p))
        .collect()
});

/// `THAI_CONS`: the phoneme table's keys plus อ.
fn is_thai_cons(c: u32) -> bool {
    c == O_ANG || THAI_CONS_PH_MAP.contains_key(&c)
}

static THAI_VSIGN: LazyLock<CpSet> =
    LazyLock::new(|| CpSet::new(MANIFEST.vowel_signs.iter().map(String::as_str)));
static THAI_O_GLOTTAL_NEXT: LazyLock<CpSet> =
    LazyLock::new(|| CpSet::new(MANIFEST.o_glottal_next.iter().map(String::as_str)));
static THAI_SHORT_VSIGN: LazyLock<CpSet> =
    LazyLock::new(|| CpSet::new(MANIFEST.short_vowel_signs.iter().map(String::as_str)));
static THAI_LIVE_CODA: LazyLock<CpSet> =
    LazyLock::new(|| CpSet::new(MANIFEST.live_codas.iter().map(String::as_str)));
static THAI_E_COMBO_CPS: LazyLock<Vec<Vec<u32>>> = LazyLock::new(|| {
    THAI_E_COMBOS
        .iter()
        .map(|p| p.chars().map(|c| c as u32).collect())
        .collect()
});

/// `thaiLexicalFixup(text)`: a token-initial ก็ is read as ก่อ.
pub fn thai_lexical_fixup(text: &JsString) -> JsString {
    for (from, to) in THAI_LEXICAL_FIXUPS {
        let from = JsString::from(from);
        if text.starts_with(&from) {
            return JsString::from(to).concat(&text.slice(from.len() as isize, None));
        }
    }
    text.clone()
}

/// `reorderThaiLeadingVowels(text)`: move each pre-posed vowel after its onset.
pub fn reorder_thai_leading_vowels(text: &JsString) -> JsString {
    if !text
        .0
        .iter()
        .any(|&u| (SARA_E as u16..=SARA_AI_MAIMALAI as u16).contains(&u))
    {
        return text.clone();
    }
    let mut cs = cps(text);
    let n = cs.len();
    let mut i = 0;
    while i + 1 < n {
        if !(is_leading_vowel(Some(cs[i])) && is_thai_consonant(Some(cs[i + 1]))) {
            i += 1;
            continue;
        }
        if cs[i + 1] == HO_HIP && raisable(cs.get(i + 2).copied()) {
            let v = cs[i];
            cs[i] = cs[i + 1];
            cs[i + 1] = cs[i + 2];
            cs[i + 2] = v;
            i += 3;
            continue;
        }
        let c1cls = thai_consonant_class(cs[i + 1]);
        if cs[i] == SARA_E
            && matches!(
                c1cls,
                Some(ThaiConsonantClass::High | ThaiConsonantClass::Mid)
            )
            && cs
                .get(i + 2)
                .is_some_and(|c| THAI_LEADER_SONORANT.contains(c))
            && cs.get(i + 3) == Some(&O_ANG)
        {
            let v = cs[i];
            cs[i] = cs[i + 1];
            cs[i + 1] = cs[i + 2];
            cs[i + 2] = v;
            i += 3;
            continue;
        }
        cs.swap(i, i + 1);
        i += 2;
    }
    from_cps(&cs)
}

/// `stripThaiMarks(text)`: tone marks, then a thanthakhat with the character it silences, then mai-taikhu,
/// nikhahit and phinthu.
pub fn strip_thai_marks(text: &JsString) -> JsString {
    if !js_re!("[ฺ็-ํ]", "u").test(text) {
        return text.clone();
    }
    let e = JsString::new();
    let s = js_re!("[่-๋]", "gu").replace(text, &e);
    let s = js_re!(".์", "gu").replace(&s, &e);
    js_re!("[็ํฺ]", "gu").replace(&s, &e)
}

fn thai_is_cluster(former: Option<&str>, med: &str) -> bool {
    match former {
        Some("k") => med == "l" || med == "r" || med == "w",
        Some("p") => med == "l" || med == "r",
        Some("t") => med == "r",
        _ => false,
    }
}

fn cluster_former(ph: &str) -> Option<&'static str> {
    THAI_CLUSTER_FORMER
        .iter()
        .find(|(k, _)| *k == ph)
        .map(|(_, v)| *v)
}

/// A consonant unit, or a vowel unit with its optional trailing glide (`j` for ไ/ใ, `m` for ำ).
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum ThaiUnit {
    C {
        g: u32,
        ph: &'static str,
    },
    V {
        gs: Vec<u32>,
        glide: Option<&'static str>,
    },
}

impl ThaiUnit {
    fn is_c(&self) -> bool {
        matches!(self, ThaiUnit::C { .. })
    }
    fn is_v(&self) -> bool {
        matches!(self, ThaiUnit::V { .. })
    }
    fn width(&self) -> usize {
        match self {
            ThaiUnit::C { .. } => 1,
            ThaiUnit::V { gs, .. } => gs.len(),
        }
    }
}

/// `thaiVowelSpan(s, i)`.
fn thai_vowel_span(s: &[u32], i: usize) -> Option<(Vec<u32>, Option<&'static str>)> {
    let c = s[i];
    let at = |k: usize| s.get(i + k).copied();
    if c == SARA_E {
        let at2 = at(2);
        if at(1) == Some(YO_YAK)
            && !(THAI_VSIGN.has(at2) || is_leading_vowel(at2) || at2 == Some(O_ANG))
        {
            return Some((vec![SARA_E, YO_YAK], Some("j")));
        }
        for pat in THAI_E_COMBO_CPS.iter() {
            let end = (i + pat.len()).min(s.len());
            if s[i..end] == pat[..] {
                return Some((pat.clone(), None));
            }
        }
    }
    if c == MAI_HAN_AKAT {
        if at(1) == Some(WO_WAEN) && at(2) == Some(SARA_A) {
            return Some((vec![MAI_HAN_AKAT, WO_WAEN, SARA_A], None));
        }
        if at(1) == Some(WO_WAEN) {
            return Some((vec![MAI_HAN_AKAT, WO_WAEN], None));
        }
        return Some((vec![MAI_HAN_AKAT], None));
    }
    if c == SARA_AI_MAIMALAI {
        return Some(if at(1) == Some(YO_YAK) {
            (vec![SARA_AI_MAIMALAI, YO_YAK], Some("j"))
        } else {
            (vec![SARA_AI_MAIMALAI], Some("j"))
        });
    }
    if c == SARA_AI_MAIMUAN {
        return Some((vec![SARA_AI_MAIMUAN], Some("j")));
    }
    if c == SARA_AM {
        return Some((vec![SARA_AM], Some("m")));
    }
    if c == SARA_AE {
        return Some(if at(1) == Some(SARA_A) {
            (vec![SARA_AE, SARA_A], None)
        } else {
            (vec![SARA_AE], None)
        });
    }
    if c == SARA_O {
        return Some(if at(1) == Some(SARA_A) {
            (vec![SARA_O, SARA_A], None)
        } else {
            (vec![SARA_O], None)
        });
    }
    if c == SARA_UEE && at(1) == Some(O_ANG) {
        return Some((vec![SARA_UEE, O_ANG], None));
    }
    if THAI_VSIGN.has(Some(c)) {
        return Some((vec![c], None));
    }
    if c == O_ANG && !THAI_O_GLOTTAL_NEXT.has(at(1)) && !(i == 0 && is_thai_consonant(at(1))) {
        return Some((vec![O_ANG], None));
    }
    // `"กขฃคฅฆ".includes(s[0])`: s[0] is one code point here (i === 1).
    if c == WO_WAEN
        && i == 1
        && is_thai_consonant(Some(s[0]))
        && is_thai_consonant(at(1))
        && at(1) != Some(O_ANG)
        && s[0] != HO_HIP
        && !((0x0E01..=0x0E06).contains(&s[0]) && at(1) == Some(RO_RUA))
    {
        return Some((vec![WO_WAEN], None));
    }
    if c == WO_WAEN
        && i >= 2
        && s[i - 2] == HO_HIP
        && s[i - 1] != WO_WAEN
        && raisable(Some(s[i - 1]))
        && is_thai_consonant(at(1))
        && at(1) != Some(O_ANG)
    {
        return Some((vec![WO_WAEN], None));
    }
    None
}

/// `thaiTokenize(word)`.
fn thai_tokenize(s: &[u32]) -> Vec<ThaiUnit> {
    let mut units = Vec::new();
    let mut i = 0;
    while i < s.len() {
        if let Some((gs, glide)) = thai_vowel_span(s, i) {
            i += gs.len();
            units.push(ThaiUnit::V { gs, glide });
            continue;
        }
        let c = s[i];
        if is_thai_cons(c) {
            let ph = if c == O_ANG {
                "?"
            } else {
                THAI_CONS_PH_MAP[&c]
            };
            units.push(ThaiUnit::C { g: c, ph });
        } else {
            units.push(ThaiUnit::V {
                gs: vec![c],
                glide: None,
            });
        }
        i += 1;
    }
    units
}

/// `thaiIsSilentLeader(units, i)`.
fn thai_is_silent_leader(units: &[ThaiUnit], i: usize) -> bool {
    let Some(ThaiUnit::C { g: u, .. }) = units.get(i) else {
        return false;
    };
    let Some(ThaiUnit::C { g: nx, .. }) = units.get(i + 1) else {
        return false;
    };
    (*u == HO_HIP && THAI_H_RAISABLE.contains(nx)) || (i == 0 && *u == O_ANG && *nx == YO_YAK)
}

/// An inherent vowel's fate: `'o'` or `'a'`.
pub type Fate = char;

#[derive(Clone, Copy)]
struct Tok {
    sym: &'static str,
    owner: Option<usize>,
}

fn is_v(t: Option<&Tok>) -> bool {
    t.is_some_and(|t| t.sym == "V" || t.sym == "ə")
}

fn is_c(t: Option<&Tok>) -> bool {
    t.is_some() && !is_v(t)
}

/// `rewriteThai(seq, width, apply)`: one non-overlapping left-to-right pass.
fn rewrite_thai(
    seq: Vec<Tok>,
    width: usize,
    apply: impl Fn(&[Tok]) -> Option<Vec<Tok>>,
) -> Vec<Tok> {
    let mut out = Vec::with_capacity(seq.len());
    let mut i = 0;
    while i < seq.len() {
        let repl = if i + width <= seq.len() {
            apply(&seq[i..i + width])
        } else {
            None
        };
        match repl {
            Some(r) => {
                out.extend(r);
                i += width;
            }
            None => {
                out.push(seq[i]);
                i += 1;
            }
        }
    }
    out
}

/// `thaiSchwaFates(units)`: each consonant's inherent-vowel fate (absent = deleted).
fn thai_schwa_fates(units: &[ThaiUnit]) -> HashMap<usize, Fate> {
    let mut seq: Vec<Tok> = Vec::new();
    for (ci, u) in units.iter().enumerate() {
        match u {
            ThaiUnit::C { ph, .. } => {
                seq.push(Tok {
                    sym: ph,
                    owner: Some(ci),
                });
                seq.push(Tok {
                    sym: "ə",
                    owner: Some(ci),
                });
            }
            ThaiUnit::V { glide, .. } => {
                seq.push(Tok {
                    sym: "V",
                    owner: None,
                });
                if let Some(g) = glide {
                    seq.push(Tok {
                        sym: g,
                        owner: None,
                    });
                }
            }
        }
    }

    // 1: ə → 0 / _V (indices of the unfiltered sequence)
    let seq1: Vec<Tok> = seq
        .iter()
        .enumerate()
        .filter(|(i, t)| !(t.sym == "ə" && is_v(seq.get(i + 1))))
        .map(|(_, t)| *t)
        .collect();
    let mut seq = seq1;

    // 2: ə → 0 / VC_#
    let n = seq.len();
    if n >= 3 && seq[n - 1].sym == "ə" && is_c(seq.get(n - 2)) && is_v(seq.get(n - 3)) {
        seq.pop();
    }

    // 3: ə → 0 / VC_CV, sparing a kr/pr/tr cluster's nucleus schwa
    seq = rewrite_thai(seq, 5, |w| {
        if !(is_v(Some(&w[0]))
            && is_c(Some(&w[1]))
            && w[2].sym == "ə"
            && is_c(Some(&w[3]))
            && is_v(Some(&w[4])))
        {
            return None;
        }
        if let Some(ThaiUnit::C { ph, .. }) = w[0].owner.and_then(|o| units.get(o))
            && w[0].sym == "ə"
            && w[1].sym == "r"
            && thai_is_cluster(cluster_former(ph), "r")
        {
            return None;
        }
        Some(vec![w[0], w[1], w[3], w[4]])
    });

    // 4: neutralization before #/C
    for i in 0..seq.len() {
        if !is_c(seq.get(i)) || is_v(seq.get(i + 1)) {
            continue;
        }
        let p = seq[i].sym;
        seq[i].sym = match p {
            "kh" => "k",
            "tS" | "tSh" | "d" | "th" | "s" => "t",
            "ph" => "p",
            "l" | "r" => "n",
            _ => p,
        };
    }

    // 5: cluster schwa-deletion (consume C·ə·C)
    seq = rewrite_thai(seq, 3, |w| {
        if !(is_c(Some(&w[0])) && w[1].sym == "ə" && is_c(Some(&w[2]))) {
            return None;
        }
        thai_is_cluster(cluster_former(w[0].sym), w[2].sym).then(|| vec![w[0], w[2]])
    });

    // 6: ə → o / _C(#|C)
    for i in 0..seq.len() {
        if seq[i].sym == "ə"
            && is_c(seq.get(i + 1))
            && (seq.get(i + 2).is_none() || is_c(seq.get(i + 2)))
        {
            seq[i].sym = "o";
        }
    }
    // 7: ə → a
    for t in seq.iter_mut() {
        if t.sym == "ə" {
            t.sym = "a";
        }
    }

    let mut out = HashMap::new();
    for t in &seq {
        if t.sym == "o" || t.sym == "a" {
            // A schwa always has a consonant owner.
            out.insert(t.owner.unwrap(), if t.sym == "o" { 'o' } else { 'a' });
        }
    }
    out
}

/// `thaiPrep(reordered)`'s result.
pub struct ThaiPrep {
    pub units: Vec<ThaiUnit>,
    pub fates: HashMap<usize, Fate>,
    pub unit_mark: Vec<Option<ThaiToneMark>>,
    pub short_mark: Vec<bool>,
}

/// `/[่-๋̄]/u` on one code point.
fn is_tone_mark(c: u32) -> bool {
    (0x0E48..=0x0E4B).contains(&c) || c == 0x0304
}

/// `thaiPrep(reordered)`: capture tone marks and mai-taikhu, strip, tokenize, run the fates, project the marks.
pub fn thai_prep(reordered: &JsString) -> Option<ThaiPrep> {
    let mut mark_at: HashMap<usize, ThaiToneMark> = HashMap::new();
    let mut short_at: HashSet<usize> = HashSet::new();
    let mut cleaned: Vec<u32> = Vec::new();
    for c in reordered.code_points() {
        if is_tone_mark(c) {
            if !cleaned.is_empty() {
                mark_at.insert(cleaned.len() - 1, c);
            }
            continue;
        }
        if c == MAITAIKHU {
            if !cleaned.is_empty() {
                short_at.insert(cleaned.len() - 1);
            }
            continue;
        }
        cleaned.push(c);
    }
    let word = cps(&strip_thai_marks(&from_cps(&cleaned)));
    let mut unit_mark_by_char: Vec<Option<ThaiToneMark>> = Vec::with_capacity(word.len());
    let mut short_by_char: Vec<bool> = Vec::with_capacity(word.len());
    let mut ci = 0;
    for &wc in &word {
        let mut m: Option<ThaiToneMark> = None;
        let mut sh = false;
        while ci < cleaned.len() && cleaned[ci] != wc {
            m = m.or(mark_at.get(&ci).copied());
            sh = sh || short_at.contains(&ci);
            ci += 1;
        }
        unit_mark_by_char.push(mark_at.get(&ci).copied().or(m));
        short_by_char.push(short_at.contains(&ci) || sh);
        ci += 1;
    }
    if !word.iter().any(|&c| is_thai_cons(c)) {
        return None;
    }
    let units = thai_tokenize(&word);
    let fates = thai_schwa_fates(&units);
    let mut unit_mark = Vec::with_capacity(units.len());
    let mut short_mark = Vec::with_capacity(units.len());
    let mut p = 0;
    for u in &units {
        let len = u.width();
        let mut m: Option<ThaiToneMark> = None;
        let mut sh = false;
        for k in 0..len {
            m = m.or(unit_mark_by_char.get(p + k).copied().flatten());
            sh = sh || short_by_char.get(p + k).copied().unwrap_or(false);
        }
        unit_mark.push(m);
        short_mark.push(sh);
        p += len;
    }
    Some(ThaiPrep {
        units,
        fates,
        unit_mark,
        short_mark,
    })
}

/// One scanned syllable.
#[derive(Clone, Debug)]
pub struct ThaiSyllableScan {
    pub nucleus: usize,
    pub tone: Option<ThaiTone>,
    /// Onset consonant graphemes (may include a silent ห/อ leader).
    pub onset_cs: Vec<u32>,
    pub nuc_unit: ThaiUnit,
    /// The coda grapheme, `None` for the TS `""`.
    pub coda_g: Option<u32>,
    pub long: bool,
    pub fate: Option<Fate>,
}

/// `thaiScanSyllables(units, fates, unitMark, shortMark)`.
pub fn thai_scan_syllables(
    units: &[ThaiUnit],
    fates: &HashMap<usize, Fate>,
    unit_mark: &[Option<ThaiToneMark>],
    short_mark: &[bool],
) -> Vec<ThaiSyllableScan> {
    let is_nucleus = |i: usize| {
        !thai_is_silent_leader(units, i)
            && (units[i].is_v() || (units[i].is_c() && fates.contains_key(&i)))
    };
    let mut out = Vec::new();
    let mut onset_start = 0;
    let mut pending_leader_class: Option<ThaiConsonantClass> = None;
    for i in 0..units.len() {
        if !is_nucleus(i) {
            continue;
        }
        let u = &units[i];
        let onset_cs: Vec<u32> = units[onset_start..=i]
            .iter()
            .filter_map(|uj| match uj {
                ThaiUnit::C { g, .. } => Some(*g),
                _ => None,
            })
            .collect();
        if onset_cs.is_empty() {
            onset_start = i + 1;
            pending_leader_class = None;
            continue;
        }
        let cls = if onset_cs[0] == HO_HIP && onset_cs.len() >= 2 && raisable(Some(onset_cs[1])) {
            thai_effective_class(onset_cs[1], Some(SilentLeader::Ho))
        } else if onset_cs[0] == O_ANG && onset_cs.len() >= 2 && onset_cs[1] == YO_YAK {
            thai_effective_class(YO_YAK, Some(SilentLeader::O))
        } else if onset_cs.len() == 1
            && pending_leader_class.is_some()
            && raisable(Some(onset_cs[0]))
        {
            pending_leader_class
        } else {
            thai_effective_class(onset_cs[0], None)
        };
        let long = match u {
            ThaiUnit::V { gs, .. } if !short_mark.get(i).copied().unwrap_or(false) => {
                !THAI_SHORT_VSIGN.has(gs.last().copied())
            }
            _ => false,
        };
        let glide_vowel = matches!(u, ThaiUnit::V { glide: Some(_), .. });
        let mut coda_g: Option<u32> = None;
        let mut next_i = i + 1;
        let un = units.get(next_i);
        let nn = units.get(next_i + 1);
        let h_leader_next = matches!(un, Some(ThaiUnit::C { g, .. }) if *g == HO_HIP)
            && matches!(nn, Some(ThaiUnit::C { g, .. }) if THAI_H_RAISABLE.contains(g));
        if let Some(ThaiUnit::C { g, .. }) = un
            && !fates.contains_key(&next_i)
            && !nn.is_some_and(ThaiUnit::is_v)
            && !h_leader_next
        {
            coda_g = Some(*g);
            next_i += 1;
        }
        let live = glide_vowel || THAI_LIVE_CODA.has(coda_g) || (coda_g.is_none() && long);
        let mut mark: Option<ThaiToneMark> = None;
        for m in &unit_mark[onset_start..=i] {
            mark = mark.or(*m);
        }
        let fate = fates.get(&i).copied();
        out.push(ThaiSyllableScan {
            nucleus: i,
            tone: cls.map(|c| compute_thai_tone(c, live, long, mark)),
            onset_cs: onset_cs.clone(),
            nuc_unit: u.clone(),
            coda_g,
            long,
            fate,
        });
        let own_cls = thai_consonant_class(onset_cs[0]);
        pending_leader_class = if onset_cs.len() == 1
            && matches!(
                own_cls,
                Some(ThaiConsonantClass::High | ThaiConsonantClass::Mid)
            )
            && u.is_c()
            && fate == Some('a')
            && coda_g.is_none()
            && mark.is_none()
        {
            own_cls
        } else {
            None
        };
        onset_start = next_i;
    }
    out
}
