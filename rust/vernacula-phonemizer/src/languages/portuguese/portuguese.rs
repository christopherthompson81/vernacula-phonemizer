//! Portuguese phonemizer: the g2p scan, stress, onglides, the dialect's vowel realization (EP blanket
//! reduction / BP final raising), the BP consonant surface rules, and `text()` over words, numbers and clause
//! punctuation. Ported from src/languages/portuguese/portuguese.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock, OnceLock};

use indexmap::IndexMap;

use super::g2p::{Dialect, Seg, sibilants, to_segments};
use super::manifest::{DIR, MANIFEST, try_manifest};
use super::normalize::{normalize_portuguese, normalize_portuguese_initialisms};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_map};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// A lexical correction (`Corr`): open the stressed mid vowel, override grapheme x, set a word-initial e.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct Corr {
    pub open: Option<JsString>,
    pub x: Option<JsString>,
    pub init_e: Option<JsString>,
}

fn parse_corr(cell: &JsString) -> Corr {
    let mut corr = Corr::default();
    for code in cell.split(&js("|")) {
        if code == "ɛ" || code == "ɔ" {
            corr.open = Some(code);
        } else if code.starts_with(&js("x:")) {
            corr.x = Some(code.slice(2, None));
        } else if code.starts_with(&js("e:")) {
            corr.init_e = Some(code.slice(2, None));
        }
    }
    corr
}

fn try_lexicon() -> Result<&'static IndexMap<JsString, Corr>, String> {
    static L: OnceLock<Result<IndexMap<JsString, Corr>, String>> = OnceLock::new();
    L.get_or_init(|| {
        let opts = || TsvOptions { optional: true, ..Default::default() };
        let mut lex = load_tsv_map(DIR, "lexicon.tsv", |v, _| Some(parse_corr(v)), opts())
            .map_err(|e| e.to_string())?;
        for (k, v) in load_tsv_map(DIR, "lexicon-manual.tsv", |v, _| Some(parse_corr(v)), opts())
            .map_err(|e| e.to_string())?
        {
            lex.insert(k, v);
        }
        Ok(lex)
    })
    .as_ref()
    .map_err(Clone::clone)
}

fn lexicon() -> &'static IndexMap<JsString, Corr> {
    try_lexicon().unwrap_or_else(|e| panic!("{e}"))
}

struct Tables {
    reduce: IndexMap<JsString, JsString>,
    nasal: IndexMap<JsString, JsString>,
    liquid: HashSet<JsString>,
    function_words: HashSet<JsString>,
    clause_mark: IndexMap<JsString, JsString>,
}

static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*MANIFEST;
    let map = |t: &IndexMap<String, String>| t.iter().map(|(k, v)| (js(k), js(v))).collect();
    Tables {
        reduce: map(&m.reduce),
        nasal: map(&m.nasal),
        liquid: m.liquids.iter().map(|s| js(s)).collect(),
        function_words: m.function_words.iter().map(|s| js(s)).collect(),
        clause_mark: map(&m.clause_punctuation),
    }
});

/// `stressedNucleus`: index of the stressed nucleus, -1 when there is none.
fn stressed_nucleus(word: &JsString, segs: &[Seg]) -> isize {
    let nuclei: Vec<usize> = (0..segs.len()).filter(|&i| segs[i].nucleus).collect();
    if nuclei.is_empty() {
        return -1;
    }
    if let Some(&a) = nuclei.iter().find(|&&i| segs[i].accent) {
        return a as isize;
    }
    if nuclei.len() == 1 {
        return nuclei[0] as isize;
    }
    let w = js_re!("s$", "").replace(&word.to_lower_case(), &JsString::new());
    let last = w.len().checked_sub(1).map_or_else(JsString::new, |i| w.char_at(i));
    // `"lrzx".includes(last)`: true for the empty string, as JS's is.
    let oxytone = last.is_empty()
        || js("lrzx").includes(&last)
        || last == "i"
        || last == "u"
        || last == "í"
        || last == "ú"
        || js_re!("[ãõ]$", "").test(&w)
        || js_re!("(ão|ãe|õe)$", "").test(&w)
        || js_re!("[iu][mn]$", "").test(&w);
    if oxytone {
        nuclei[nuclei.len() - 1] as isize
    } else {
        nuclei[nuclei.len() - 2] as isize
    }
}

fn is_glide_ph(ph: &JsString) -> bool {
    *ph == "j" || *ph == "w" || *ph == "j̃" || *ph == "w̃"
}

fn onglides(segs: &mut [Seg], stress: isize) {
    for i in 0..segs.len() {
        let s = &segs[i];
        if !s.nucleus || i as isize == stress || (s.raw != "i" && s.raw != "u" && s.raw != "e") {
            continue;
        }
        let Some(next) = segs.get(i + 1) else { continue };
        if !next.nucleus {
            continue;
        }
        if (i + 1) as isize == stress && (next.raw == "i" || next.raw == "u") {
            continue;
        }
        if i >= 2 && T.liquid.contains(&segs[i - 1].ph) && !segs[i - 2].nucleus {
            continue;
        }
        let s = &mut segs[i];
        s.nucleus = false;
        s.ph = js(if s.raw == "u" { "w" } else { "j" });
    }
}

fn realize(segs: &[Seg], stress: isize, dialect: Dialect) -> JsString {
    let mut out = JsString::new();
    for i in 0..segs.len() {
        let s = &segs[i];
        let mut ph = s.ph.clone();
        let next = segs.get(i + 1);
        let diphthong = next.is_some_and(|n| !n.nucleus && is_glide_ph(&n.ph));
        let is_stress = i as isize == stress;
        if s.nucleus && !is_stress && !s.nasal && !diphthong && !s.raw.is_empty() {
            let before_dark_l = next.is_some_and(|n| n.ph == "ɫ");
            if dialect == Dialect::Bp {
                let is_final = !segs[i + 1..].iter().any(|x| x.nucleus);
                ph = if before_dark_l {
                    if s.raw == "a" {
                        js("a")
                    } else if s.raw == "e" {
                        js("e")
                    } else if s.raw == "o" {
                        js("o")
                    } else {
                        ph
                    }
                } else {
                    let r = s.raw.to_string_lossy();
                    let table: &[(&str, &str)] = if is_final {
                        &[("a", "ɐ"), ("e", "i"), ("o", "u")]
                    } else {
                        &[("a", "a"), ("e", "e"), ("o", "o")]
                    };
                    table.iter().find(|(k, _)| *k == r).map_or(ph, |(_, v)| js(v))
                };
            } else {
                ph = if before_dark_l && s.raw == "a" {
                    js("a")
                } else if before_dark_l && s.raw == "e" {
                    js("ɛ")
                } else if i == 0 && s.raw == "e" {
                    js("i")
                } else {
                    T.reduce.get(&s.raw).cloned().unwrap_or(ph)
                };
            }
        }
        if dialect == Dialect::Bp && is_stress && !s.accent && !s.nasal && (ph == "ɔ" || ph == "ɛ") {
            if let Some(nx) = next {
                if !nx.nucleus && (nx.ph == "m" || nx.ph == "n" || nx.ph == "ɲ") {
                    ph = js(if ph == "ɔ" { "o" } else { "e" });
                }
            }
        }
        if s.nasal && s.nucleus {
            ph = T.nasal.get(&ph).cloned().unwrap_or(ph);
        }
        if is_stress {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&ph);
    }
    out
}

fn correct(segs: &mut [Seg], stress: isize, corr: &Corr) {
    if let Some(open) = corr.open.as_ref() {
        if stress >= 0 && (stress as usize) < segs.len() {
            let close = if *open == "ɛ" { "e" } else { "o" };
            let s = &mut segs[stress as usize];
            if s.ph == close {
                s.ph = open.clone();
            }
        }
    }
    if let Some(x) = corr.x.as_ref().filter(|x| !x.is_empty()) {
        for s in segs.iter_mut() {
            if s.raw == "x" {
                s.ph = x.clone();
            }
        }
    }
    if let Some(e) = corr.init_e.as_ref().filter(|e| !e.is_empty()) {
        if let Some(s0) = segs.first_mut() {
            if s0.nucleus && s0.raw == "e" {
                s0.ph = e.clone();
                s0.raw = JsString::new();
            }
        }
    }
}

/// `renderWord(word, corr?, dialect)`.
pub fn render_word(word: &JsString, corr: Option<&Corr>, dialect: Dialect) -> JsString {
    let mut segs = to_segments(word, dialect);
    if segs.is_empty() {
        return JsString::new();
    }
    sibilants(&mut segs, dialect);
    let stress = stressed_nucleus(word, &segs);
    onglides(&mut segs, stress);
    if let Some(c) = corr {
        correct(&mut segs, stress, c);
    }
    let ipa = realize(&segs, stress, dialect);
    if dialect == Dialect::Bp { bp_consonants(&ipa) } else { ipa }
}

fn bp_consonants(ipa: &JsString) -> JsString {
    let s = js_re!("t([ˈˌ]?[iĩj])", "gu").replace(ipa, &js("t͡ʃ$1"));
    let s = js_re!("d([ˈˌ]?[iĩj])", "gu").replace(&s, &js("d͡ʒ$1"));
    js_re!("ɫ", "gu").replace(&s, &js("w"))
}

/// `phonemizeWord(word, dialect)`: the rule engine plus the shared correction lexicon.
pub fn phonemize_word(word: &JsString, dialect: Dialect) -> JsString {
    render_word(word, lexicon().get(&word.to_lower_case()), dialect)
}

fn token() -> &'static JsRegex {
    js_re!(r"([a-zà-ÿ]+)|(\d+(?:(?<!(?<!\d)0)\.\d+)*(?:,\d+)?)|([.!?…,;:])", "giu")
}

fn number_token_to_words(tok: &JsString, dialect: Dialect) -> JsString {
    let parts = tok.split(&js(","));
    let int_digits = js_re!(r"\.", "g").replace(&parts[0], &JsString::new());
    let mut words = number_to_words(js_number(&int_digits), dialect, Some(&int_digits));
    if let Some(frac) = parts.get(1) {
        words.push_str(&js(&format!(" {} ", MANIFEST.numbers.decimal_connector)));
        let digits: Vec<JsString> = (0..frac.len())
            .map(|i| number_to_words(js_number(&frac.char_at(i)), dialect, None))
            .collect();
        words.push_str(&JsString::join(&digits, &js(" ")));
    }
    words
}

/// The per-word IPA refinement hook (`postWord`): the BP open/close lexicon.
pub type PostWord = fn(&JsString, &JsString) -> JsString;

/// `s.replace("ˈ", "")`: the first occurrence only.
fn drop_first_stress(ipa: &JsString) -> JsString {
    let mark = js("ˈ");
    match ipa.index_of(&mark, 0) {
        Some(i) => {
            let mut out = JsString::from_units(&ipa.0[..i]);
            out.push_units(&ipa.0[i + mark.len()..]);
            out
        }
        None => ipa.clone(),
    }
}

fn word_ipa(word: &JsString, dialect: Dialect, post_word: Option<PostWord>) -> JsString {
    let mut ipa = phonemize_word(word, dialect);
    let lower = word.to_lower_case();
    if let Some(pw) = post_word {
        ipa = pw(&ipa, &lower);
    }
    if T.function_words.contains(&lower) { drop_first_stress(&ipa) } else { ipa }
}

pub struct PortuguesePhonemizer {
    dialect: Dialect,
    post_word: Option<PostWord>,
}

impl PortuguesePhonemizer {
    /// The normalized text `text()` tokenizes.
    pub fn normalized_for(&self, input: &JsString) -> JsString {
        normalize_portuguese_initialisms(&normalize_portuguese(input, self.dialect == Dialect::Bp))
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let (d, pw) = (self.dialect, self.post_word);
        let normalized = self.normalized_for(input);
        assemble_clauses(&normalized, token(), |m, s, sink| {
            let nonempty = |i| m.group(i, s).filter(|g: &JsString| !g.is_empty());
            if let Some(w) = nonempty(1) {
                sink.emit(&word_ipa(&w, d, pw));
            } else if let Some(n) = nonempty(2) {
                let words: Vec<JsString> = number_token_to_words(&n, d)
                    .split(&js(" "))
                    .iter()
                    .map(|w| word_ipa(w, d, pw))
                    .collect();
                sink.emit(&JsString::join(&words, &js(" ")));
            } else if let Some(p) = nonempty(3) {
                if let Some(mk) = T.clause_mark.get(&p).filter(|mk| !mk.is_empty()) {
                    sink.pause(mk);
                }
            }
        })
    }
}

impl Engine for PortuguesePhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(PortuguesePhonemizer::text(self, input))
    }
}

/// `createPortuguese(dialect, postWord?)`. Checks the manifest and the lexicons up front, so a missing data
/// root is an error here rather than a panic mid-sentence.
pub fn create_portuguese(dialect: Dialect, post_word: Option<PostWord>) -> Result<Arc<PortuguesePhonemizer>, PhonemizeError> {
    try_manifest().map_err(PhonemizeError::Data)?;
    try_lexicon().map_err(PhonemizeError::Data)?;
    Ok(Arc::new(PortuguesePhonemizer { dialect, post_word }))
}
