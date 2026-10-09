//! Japanese (Tokyo) lexical pitch accent: the nucleus lookup (surface, stripped stem, reading) and the
//! downstep ꜜ placed after the nucleus mora. Ported from src/languages/japanese/pitch.ts — see that file
//! for the corpus evidence.
//!
//! pitch-accent.tsv (~7.7 MB) loads lazily, once, on first use, as the TS does.

use std::collections::HashMap;
use std::sync::{LazyLock, OnceLock};

use super::to_hiragana;
use super::manifest::{DIR, MANIFEST};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_js_space, js};
use crate::core::load_tsv::{TsvOptions, load_tsv_map};
use crate::js_re;

/// `Number.parseInt(v, 10)`: leading JS whitespace, an optional sign, then the longest digit prefix; NaN if
/// there are no digits.
fn parse_int10(v: &JsString) -> f64 {
    let u = &v.0;
    let mut i = 0;
    while i < u.len() && is_js_space(u[i]) {
        i += 1;
    }
    let mut neg = false;
    if i < u.len() && (u[i] == b'+' as u16 || u[i] == b'-' as u16) {
        neg = u[i] == b'-' as u16;
        i += 1;
    }
    let start = i;
    while i < u.len() && (b'0' as u16..=b'9' as u16).contains(&u[i]) {
        i += 1;
    }
    if i == start {
        return f64::NAN;
    }
    let digits: String = u[start..i].iter().map(|&c| c as u8 as char).collect();
    let n: f64 = digits.parse().unwrap_or(f64::NAN);
    if neg { -n } else { n }
}

fn load() -> Result<HashMap<JsString, f64>, String> {
    Ok(load_tsv_map(
        DIR,
        "pitch-accent.tsv",
        |v, _| {
            let n = parse_int10(v);
            // `Number.isInteger(n) && n >= 0` (−0 passes, as in JS).
            (n.is_finite() && n.fract() == 0.0 && n >= 0.0).then_some(n)
        },
        TsvOptions::default(),
    )
    .map_err(|e| e.to_string())?
    .into_iter()
    .collect())
}

/// The pitch lexicon, or why it could not be loaded. Cached once loaded; a failure is retried.
pub fn try_lex() -> Result<&'static HashMap<JsString, f64>, String> {
    static L: OnceLock<HashMap<JsString, f64>> = OnceLock::new();
    super::load_once(&L, load)
}

fn lex() -> &'static HashMap<JsString, f64> {
    try_lex().unwrap_or_else(|e| panic!("{e}"))
}

/// Raw key, then the katakana→hiragana folded key.
fn get(k: &JsString) -> Option<f64> {
    let m = lex();
    if let Some(&n) = m.get(k) {
        return Some(n);
    }
    m.get(&to_hiragana(k)).copied()
}

/// Whether the pitch lexicon has an entry for a surface/reading key (with the fold `get` applies).
pub fn pitch_lexicon_has(key: &JsString) -> bool {
    get(key).is_some()
}

static STRIPS: LazyLock<[JsRegex; 2]> = LazyLock::new(|| {
    let ps = &MANIFEST.pitch_strip;
    [
        JsRegex::new(&format!("[{}]+$", ps.particles), "u").expect("pitchStrip.particles"),
        JsRegex::new(
            &format!("(?:{})(?:[{}])?$", ps.copula.join("|"), ps.copula_final_particles),
            "u",
        )
        .expect("pitchStrip.copula"),
    ]
});

const PARTICLE_TOKENS: [&str; 24] = [
    "は", "が", "を", "に", "で", "と", "の", "も", "や", "へ", "わ", "え",
    "から", "まで", "など", "には", "では", "でわ", "とは", "とわ", "への", "からの", "までの", "にわ",
];

/// The accent nucleus (mora index, 0 = heiban) for a bunsetsu: surface first, then the stripped stems, then
/// the reading.
pub fn accent_nucleus(surface: &JsString, reading: &JsString) -> f64 {
    if PARTICLE_TOKENS.iter().any(|p| *surface == *p) {
        return 0.0;
    }
    let mut n = get(surface);
    if n.is_none() {
        for re in STRIPS.iter() {
            let Some(m) = re.exec(surface) else { continue };
            let m0 = m.value(surface);
            let cut = -(m0.len() as isize);
            let ks = surface.slice(0, Some(cut));
            if ks.is_empty() || !js_re!(r"\p{Script=Han}$", "u").test(&ks) {
                continue;
            }
            n = get(&ks);
            if n.is_none() && reading.ends_with(&m0) {
                let rs = reading.slice(0, Some(cut));
                if !rs.is_empty() {
                    n = get(&rs);
                }
            }
            if n.is_some() {
                break;
            }
        }
    }
    if n.is_none() {
        n = get(reading);
    }
    n.unwrap_or(0.0)
}

/// Place ꜜ after the nucleus-th mora (1-based; ≤0 = heiban, no mark).
pub fn place_downstep(morae: &[JsString], nucleus: f64) -> JsString {
    let empty = JsString::new();
    if nucleus <= 0.0 || morae.is_empty() {
        return JsString::join(morae, &empty);
    }
    let n = (nucleus.min(morae.len() as f64)) as usize;
    JsString::join(&morae[..n], &empty)
        .concat(&js("ꜜ"))
        .concat(&JsString::join(&morae[n..], &empty))
}
