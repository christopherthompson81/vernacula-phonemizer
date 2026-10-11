//! Thai grapheme→phoneme: the irregulars dictionary, else the syllabifier's {onset, nucleus, coda, tone} scan
//! rendered to IPA with stress. Ported from src/languages/thai/g2p.ts — see that file for the corpus evidence.

use std::collections::{HashMap, HashSet};
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::manifest::{DIR, MANIFEST};
use super::segment::segment;
use super::syllabifier::{
    ThaiSyllableScan, ThaiUnit, from_cps, reorder_thai_leading_vowels, thai_lexical_fixup,
    thai_prep, thai_scan_syllables,
};
use super::thai_tone::thai_tone_ipa;
use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, js};
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};
use crate::js_re;

/// The irregulars dictionary, or why it could not be read (a missing file is an empty map).
pub fn try_dict() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static DICT: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&DICT, || {
        load_tsv_strings(
            DIR,
            "dictionary.tsv",
            TsvOptions {
                optional: true,
                ..Default::default()
            },
        )
        .map_err(|e| e.to_string())
    })
}

fn to_js_map(m: &IndexMap<String, String>) -> HashMap<JsString, JsString> {
    m.iter().map(|(k, v)| (js(k), js(v))).collect()
}

static INIT: LazyLock<HashMap<JsString, JsString>> = LazyLock::new(|| to_js_map(&MANIFEST.onset));
static CODA: LazyLock<HashMap<JsString, JsString>> = LazyLock::new(|| to_js_map(&MANIFEST.coda));
static VQUAL: LazyLock<HashMap<JsString, JsString>> =
    LazyLock::new(|| to_js_map(&MANIFEST.vowel_quality));
static NO_LENGTH: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.no_length.iter().map(|s| js(s)).collect());
static FORCE_LONG: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.force_long.iter().map(|s| js(s)).collect());

const HO_HIP: u32 = 0x0E2B; // ห
const O_ANG: u32 = 0x0E2D; // อ
const YO_YAK: u32 = 0x0E22; // ย

fn cp(c: u32) -> JsString {
    from_cps(&[c])
}

/// `onsetIpa(cs, first)`: drop a silent ห/อ leader, then map each consonant.
fn onset_ipa(cs: &[u32], first: bool) -> JsString {
    let mut g = cs;
    if g.len() >= 2
        && ((g[0] == HO_HIP && MANIFEST.raisable.chars().any(|c| c as u32 == g[1]))
            || (first && g[0] == O_ANG && g[1] == YO_YAK))
    {
        g = &g[1..];
    }
    let mut out = JsString::new();
    for &c in g {
        if let Some(v) = INIT.get(&cp(c)) {
            out.push_str(v);
        }
    }
    out
}

/// `renderSyllable(s, first, last)`.
fn render_syllable(s: &ThaiSyllableScan, first: bool, last: bool) -> JsString {
    let onset = onset_ipa(&s.onset_cs, first);
    let mut glide = JsString::new();
    let mut v_short = false;
    let nucleus = match &s.nuc_unit {
        ThaiUnit::C { .. } => js(if s.fate == Some('o') { "o" } else { "a" }),
        ThaiUnit::V { gs, glide: g } => {
            let gs = from_cps(gs);
            let q = VQUAL.get(&gs).cloned().unwrap_or_else(|| js("a"));
            if let Some(g) = g {
                glide = js(g);
            } else if gs == js("เา") {
                glide = js("w");
            }
            let is_ey = gs == js("เย");
            let long = (s.long || FORCE_LONG.contains(&gs) || is_ey)
                && !NO_LENGTH.contains(&q)
                && (glide.is_empty() || is_ey);
            v_short = !long && glide.is_empty() && !NO_LENGTH.contains(&q);
            if long { q.concat(&js("ː")) } else { q }
        }
    };
    let coda = match s.coda_g {
        Some(c) => CODA.get(&cp(c)).cloned().unwrap_or_default(),
        None => glide,
    };
    let tone = s
        .tone
        .map(|t| js(thai_tone_ipa().get(t)))
        .unwrap_or_default();
    let open_last = last && coda.is_empty();
    let final_coda = if !coda.is_empty() {
        coda
    } else if open_last && (v_short || matches!(s.nuc_unit, ThaiUnit::C { .. })) {
        js("ʔ")
    } else {
        JsString::new()
    };
    let mut out = onset;
    out.push_str(&nucleus);
    out.push_str(&tone);
    out.push_str(&final_coda);
    out
}

/// `phonemizeWord(token)`: segment the token, then phonemize each word.
pub fn phonemize_word(token: &JsString) -> JsString {
    let parts: Vec<JsString> = segment(token)
        .iter()
        .map(phonemize_subword)
        .filter(|s| !s.is_empty())
        .collect();
    JsString::join(&parts, &js(" "))
}

/// `phonemizeSubword(word)`: the dictionary, else the syllabifier and render, with stress.
pub fn phonemize_subword(word: &JsString) -> JsString {
    if let Some(lex) = try_dict().unwrap_or_else(|e| panic!("{e}")).get(word) {
        return lex.clone();
    }
    let reordered = reorder_thai_leading_vowels(&thai_lexical_fixup(word));
    let Some(prep) = thai_prep(&reordered) else {
        return JsString::new();
    };
    let syls = thai_scan_syllables(&prep.units, &prep.fates, &prep.unit_mark, &prep.short_mark);
    let n = syls.len();
    let mut out = JsString::new();
    for (i, s) in syls.iter().enumerate() {
        let syl = render_syllable(s, i == 0, i == n - 1);
        let mark = if i == 0 {
            "ˈ"
        } else if i >= 2 && i % 2 == 0 {
            "ˌ"
        } else {
            ""
        };
        if mark.is_empty() {
            out.push_str(&syl);
            continue;
        }
        match js_re!("[aeiouɛɔɤɯ]", "u").exec(&syl) {
            Some(m) => {
                out.push_str(&syl.slice(0, Some(m.index() as isize)));
                out.push_str(&js(mark));
                out.push_str(&syl.slice(m.index() as isize, None));
            }
            None => {
                out.push_str(&js(mark));
                out.push_str(&syl);
            }
        }
    }
    out
}
