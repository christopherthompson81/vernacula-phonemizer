//! German (de) phonemizer: the rule g2p composed morpheme by morpheme, first-syllable stress with the kaikki
//! stress/length/quality/consonant/-er correction lexicons, and text() over words, numbers and punctuation.
//! Ported from src/languages/german/german.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::g2p::{Seg, to_segments};
use super::manifest::{DIR, MANIFEST, try_manifest};
use super::morphology::{PREFIX_IPA, SUFFIX_IPA, decompose, try_lexicon};
use super::normalize::{
    is_unreadable_german, normalize_german, normalize_german_initialisms, normalize_german_years,
};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::germanic_morphology::{Decomp, Kind};
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_map};
use crate::core::normalize_symbols::{
    BareExponent, ExponentWords, Multiply, SymbolData, SymbolNormalizer, make_symbol_normalizer,
};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// The five kaikki correction lexicons. `stress` keeps `Number(value)` (a NaN row is representable).
struct Dicts {
    stress: IndexMap<JsString, f64>,
    length: IndexMap<JsString, JsString>,
    quality: IndexMap<JsString, JsString>,
    consonant: IndexMap<JsString, JsString>,
    er: IndexMap<JsString, JsString>,
}

fn try_dicts() -> Result<&'static Dicts, String> {
    static D: OnceLock<Dicts> = OnceLock::new();
    load_once(&D, || {
        let opts = || TsvOptions {
            optional: true,
            ..Default::default()
        };
        let strings = |f: &str| {
            load_tsv_map(DIR, f, |v, _| Some(v.clone()), opts()).map_err(|e| e.to_string())
        };
        Ok(Dicts {
            stress: load_tsv_map(DIR, "stress.tsv", |v, _| Some(js_number(v)), opts())
                .map_err(|e| e.to_string())?,
            length: strings("length.tsv")?,
            quality: strings("quality.tsv")?,
            consonant: strings("consonant.tsv")?,
            er: strings("er.tsv")?,
        })
    })
}

fn dicts() -> &'static Dicts {
    try_dicts().unwrap_or_else(|e| panic!("{e}"))
}

const SHORT_A_MARK: u16 = 0x0190; // Ɛ
const NONSYLLABIC: u16 = 0x032F; // ̯
const LENGTH: u16 = 0x02D0; // ː

struct VowelTables {
    vowel_chars: Vec<u16>,
    long_of: std::collections::HashMap<u16, JsString>,
    short_of: std::collections::HashMap<u16, JsString>,
}

/// `LONG_OF`, `SHORT_OF`, `VOWEL_CHARS`, keyed by one code unit (every key in the manifest is one).
static VT: LazyLock<VowelTables> = LazyLock::new(|| {
    let one = |k: &String| -> u16 {
        let u: Vec<u16> = k.encode_utf16().collect();
        assert_eq!(
            u.len(),
            1,
            "german.jsonc vowels key {k:?} is not one code unit"
        );
        u[0]
    };
    let mut long_of: std::collections::HashMap<u16, JsString> = MANIFEST
        .vowels
        .long_of
        .iter()
        .map(|(k, v)| (one(k), js(v)))
        .collect();
    long_of.insert(SHORT_A_MARK, js("ɛː"));
    let mut vowel_chars: Vec<u16> = MANIFEST.vowel_chars.encode_utf16().collect();
    vowel_chars.push(SHORT_A_MARK);
    VowelTables {
        vowel_chars,
        long_of,
        short_of: MANIFEST
            .vowels
            .short_of
            .iter()
            .map(|(k, v)| (one(k), js(v)))
            .collect(),
    }
});

fn is_vowel_char(u: u16) -> bool {
    VT.vowel_chars.contains(&u)
}

/// A JS `Map<number, T>` filled by `set` (the last write for a key wins), read with `get(ord)`.
struct OrdMap<T>(Vec<(f64, T)>);

impl<T> OrdMap<T> {
    fn get(&self, ord: usize) -> Option<&T> {
        self.0
            .iter()
            .rev()
            .find(|(k, _)| *k == ord as f64)
            .map(|(_, v)| v)
    }
}

/// `spec.split(",")`, each non-empty `c` as `Number(c.slice(0, -1)) → c.slice(-1)`.
fn flag_map(spec: &JsString) -> OrdMap<JsString> {
    let mut corr = Vec::new();
    for c in spec.split(&js(",")) {
        if !c.is_empty() {
            corr.push((js_number(&c.slice(0, Some(-1))), c.slice(-1, None)));
        }
    }
    OrdMap(corr)
}

fn unit(ipa: &[u16], i: usize) -> Option<u16> {
    ipa.get(i).copied()
}

/// `applyLength(ipa, spec)`.
fn apply_length(ipa: &JsString, spec: Option<&JsString>) -> JsString {
    let normalise = |s: &JsString| js_re!("Ɛ", "gu").replace(s, &js("ɛ"));
    let Some(spec) = spec.filter(|s| !s.is_empty()) else {
        return normalise(ipa);
    };
    let corr = flag_map(spec);
    let u = ipa.units();
    let mut out = JsString::new();
    let (mut ord, mut i) = (0usize, 0usize);
    while i < u.len() {
        let ch = u[i];
        if !is_vowel_char(ch) {
            out.push_units(&[ch]);
            i += 1;
            continue;
        }
        if unit(u, i + 1) == Some(NONSYLLABIC) {
            out.push_units(&[ch]);
            i += 1;
            continue;
        }
        let long = unit(u, i + 1) == Some(LENGTH);
        let diphthong = i + 1 < u.len()
            && "ɪʊʏ".encode_utf16().any(|x| x == u[i + 1])
            && unit(u, i + 2) == Some(NONSYLLABIC);
        let flag = corr.get(ord);
        if !diphthong && flag.is_some_and(|f| *f == "L") && !long {
            match VT.long_of.get(&ch) {
                Some(l) => out.push_str(l),
                None => out.push_units(&[ch]),
            }
            i += 1;
        } else if !diphthong && flag.is_some_and(|f| *f == "S") && long {
            match VT.short_of.get(&ch) {
                Some(s) => out.push_str(s),
                None => out.push_units(&[ch]),
            }
            i += 2;
        } else {
            out.push_units(&[ch]);
            if long {
                out.push_units(&[LENGTH]);
            }
            i += if long { 2 } else { 1 };
        }
        ord += 1;
    }
    normalise(&out)
}

/// `applyQuality(ipa, spec)`: never the stressed nucleus.
fn apply_quality(ipa: &JsString, spec: Option<&JsString>) -> JsString {
    let Some(spec) = spec.filter(|s| !s.is_empty()) else {
        return ipa.clone();
    };
    let corr = flag_map(spec);
    let u = ipa.units();
    let mut out = JsString::new();
    let (mut ord, mut i) = (0usize, 0usize);
    while i < u.len() {
        let ch = u[i];
        if !is_vowel_char(ch) {
            out.push_units(&[ch]);
            i += 1;
            continue;
        }
        if unit(u, i + 1) == Some(NONSYLLABIC) {
            out.push_units(&[ch]);
            i += 1;
            continue;
        }
        let long = unit(u, i + 1) == Some(LENGTH);
        match corr.get(ord) {
            Some(t) if !js_re!("[ˈˌ]$").test(&out) => out.push_str(t),
            _ => {
                out.push_units(&[ch]);
                if long {
                    out.push_units(&[LENGTH]);
                }
            }
        }
        i += if long { 2 } else { 1 };
        ord += 1;
    }
    out
}

/// `applyConsonant(ipa, spec)`: the target after the ordinal may be more than one character (`k → t͡s`).
fn apply_consonant(ipa: &JsString, spec: Option<&JsString>) -> JsString {
    let Some(spec) = spec.filter(|s| !s.is_empty()) else {
        return ipa.clone();
    };
    let mut corr = Vec::new();
    for c in spec.split(&js(",")) {
        if let Some(m) = js_re!(r"^(\d+)(.+)$", "u").exec(&c) {
            corr.push((js_number(&m.group(1, &c).unwrap()), m.group(2, &c).unwrap()));
        }
    }
    let corr = OrdMap(corr);
    let skip: Vec<u16> = "ˈˌʔ()ː̯̩̥͡".encode_utf16().collect();
    let u = ipa.units();
    let mut out = JsString::new();
    let mut ci = 0usize;
    let mut i = 0usize;
    while i < u.len() {
        let ch = u[i];
        if ch == 'ɐ' as u16 && unit(u, i + 1) == Some(NONSYLLABIC) {
            match corr.get(ci) {
                Some(t) => out.push_str(t),
                None => out.push_str(&js("ɐ̯")),
            }
            ci += 1;
            i += 2;
            continue;
        }
        if !is_vowel_char(ch) && !skip.contains(&ch) {
            match corr.get(ci) {
                Some(t) => out.push_str(t),
                None => out.push_units(&[ch]),
            }
            ci += 1;
        } else {
            out.push_units(&[ch]);
        }
        i += 1;
    }
    out
}

/// `fixStressedSchwa`: a stressed ə is the weak-schwa rule misfiring on the root; restore ɛ.
fn fix_stressed_schwa(ipa: &JsString) -> JsString {
    js_re!("([ˈˌ])ə", "gu").replace(ipa, &js("$1ɛ"))
}

/// `restoreStressedIe`: a stressed -ie/-ien glide+schwa back to iː.
fn restore_stressed_ie(ipa: &JsString) -> JsString {
    js_re!("i̯([ˈˌ])[əɛ]", "gu").replace(ipa, &js("$1iː"))
}

/// `applyErRestore(ipa, spec)`: ⚠ `spec.split(",").map(Number)` keeps an empty piece as 0.
fn apply_er_restore(ipa: &JsString, spec: Option<&JsString>) -> JsString {
    let Some(spec) = spec.filter(|s| !s.is_empty()) else {
        return ipa.clone();
    };
    let corr: Vec<f64> = spec.split(&js(",")).iter().map(js_number).collect();
    let u = ipa.units();
    let mut out = JsString::new();
    let (mut ord, mut i) = (0usize, 0usize);
    while i < u.len() {
        let ch = u[i];
        if !is_vowel_char(ch) || unit(u, i + 1) == Some(NONSYLLABIC) {
            out.push_units(&[ch]);
            i += 1;
            continue;
        }
        if corr.contains(&(ord as f64)) && ch == 'ɐ' as u16 {
            out.push_str(&js("ɛʁ"));
            i += 1;
        } else {
            let long = unit(u, i + 1) == Some(LENGTH);
            out.push_units(&[ch]);
            if long {
                out.push_units(&[LENGTH]);
            }
            i += if long { 2 } else { 1 };
        }
        ord += 1;
    }
    out
}

/// `restoreStressedEr`: a stressed bare ɐ (not the ɐ̯ offglide) is the full ɛʁ.
fn restore_stressed_er(ipa: &JsString) -> JsString {
    js_re!("([ˈˌ])ɐ(?!̯)", "gu").replace(ipa, &js("$1ɛʁ"))
}

fn vowel_g() -> &'static JsRegex {
    js_re!("[aɐeɛiɪoɔuʊøœyʏəƐ]", "g")
}

/// `countNuclei(ipa)`.
fn count_nuclei(ipa: &JsString) -> usize {
    vowel_g()
        .match_all(ipa)
        .iter()
        .filter(|m| ipa.char_code_at(m.index() + 1) != Some(NONSYLLABIC))
        .count()
}

/// `placeStress(ipa, ordinal)`: ˈ before the ordinal-th nucleus; unchanged when there is none (or a NaN).
fn place_stress(ipa: &JsString, ordinal: f64) -> JsString {
    let mut n = 0usize;
    for m in vowel_g().match_all(ipa) {
        if ipa.char_code_at(m.index() + 1) == Some(NONSYLLABIC) {
            continue;
        }
        if n as f64 == ordinal {
            return ipa
                .slice(0, Some(m.index() as isize))
                .concat(&js("ˈ"))
                .concat(&ipa.slice(m.index() as isize, None));
        }
        n += 1;
    }
    ipa.clone()
}

struct Merged {
    text: JsString,
    kind: Kind,
}

/// `PREFIX_IPA[text]` / `SUFFIX_IPA[text]` as the TS truthiness test reads them.
fn affix_ipa(m: &Merged) -> Option<JsString> {
    let table = match m.kind {
        Kind::Prefix => &*PREFIX_IPA,
        Kind::Suffix => &*SUFFIX_IPA,
        Kind::Stem => return None,
    };
    table.get(&m.text).filter(|v| !v.is_empty()).cloned()
}

fn strip_stress(s: &JsString) -> JsString {
    js_re!("[ˈˌ]", "gu").replace(s, &JsString::new())
}

/// `composeMorphemeKeyed(merged, stressPart)`: each stem through the full pipeline, one primary stress.
fn compose_morpheme_keyed(merged: &[Merged], stress_part: usize) -> JsString {
    let pieces: Vec<JsString> = merged
        .iter()
        .map(|m| affix_ipa(m).unwrap_or_else(|| phonemize_word(&m.text)))
        .collect();
    let sp = stress_part.min(pieces.len() - 1);
    let before = strip_stress(&JsString::join(&pieces[..sp], &JsString::new()));
    let sp_piece = pieces.get(sp).cloned().unwrap_or_default();
    let local_ord = match js_re!("[ˈˌ]", "u").exec(&sp_piece) {
        None => 0,
        Some(m) => count_nuclei(&sp_piece.slice(0, Some(m.index() as isize))),
    };
    place_stress(
        &strip_stress(&JsString::join(&pieces, &JsString::new())),
        (count_nuclei(&before) + local_ord) as f64,
    )
}

const INFLECT: [&str; 15] = [
    "esten", "sten", "eten", "ten", "est", "en", "et", "em", "es", "er", "e", "n", "st", "t", "s",
];

/// `inflectedStressOrd(w)`: the lemma's stress ordinal, reached by stripping an inflectional ending.
fn inflected_stress_ord(w: &JsString) -> Option<f64> {
    let dict = &dicts().stress;
    for suf in INFLECT {
        let suf = js(suf);
        if !w.ends_with(&suf) || (w.len() as isize - suf.len() as isize) < 3 {
            continue;
        }
        let base = w.slice(0, Some(-(suf.len() as isize)));
        let hit = dict
            .get(&base)
            .or_else(|| dict.get(&base.concat(&js("e"))))
            .or_else(|| dict.get(&base.concat(&js("en"))));
        if let Some(&h) = hit {
            return Some(h);
        }
    }
    None
}

/// `guessUnstressedPrefix(w)`.
fn guess_unstressed_prefix(w: &JsString) -> bool {
    js_re!("^(?:be|ge|ver|zer|ent|emp|er)(?=([a-zäöüß]{4,})$)")
        .exec(w)
        .is_some_and(|m| {
            js_re!("^[bcdfghjklmnpqrstvwxzß]{0,3}[aeiouäöüy]").test(&m.group(1, w).unwrap())
        })
}

/// The whole-word correction chain, from `fixStressedSchwa` to `restoreStressedEr`.
fn corrections(stressed: &JsString, w: &JsString) -> JsString {
    let d = dicts();
    let l = apply_length(&fix_stressed_schwa(stressed), d.length.get(w));
    let q = apply_quality(&l, d.quality.get(w));
    let e = apply_er_restore(&q, d.er.get(w));
    let c = apply_consonant(&e, d.consonant.get(w));
    restore_stressed_er(&restore_stressed_ie(&c))
}

static VINIT_SUFFIX: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    MANIFEST
        .morphology
        .vowel_initial_suffixes
        .iter()
        .map(|s| js(s))
        .collect()
});

/// `phonemizeWord(word)`: one German word to canonical IPA.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let w = word.to_lower_case();
    let d = decompose(&w);
    let mut merged: Vec<Merged> = Vec::new();
    for (p, &k) in d.parts.iter().zip(d.kinds.iter()) {
        if let Some(last) = merged.last_mut()
            && k == Kind::Suffix
            && VINIT_SUFFIX.contains(p)
            && last.kind == Kind::Stem
        {
            last.text.push_str(p);
            continue;
        }
        merged.push(Merged {
            text: p.clone(),
            kind: k,
        });
    }
    let dd = dicts();
    if merged.len() > 1 {
        let known = dd.stress.contains_key(&w)
            || dd.length.contains_key(&w)
            || dd.quality.contains_key(&w)
            || dd.consonant.contains_key(&w)
            || dd.er.contains_key(&w);
        if !known {
            return compose_morpheme_keyed(&merged, d.stress_part);
        }
        let pieces: Vec<JsString> = merged
            .iter()
            .map(|m| {
                affix_ipa(m).unwrap_or_else(|| {
                    let segs: Vec<JsString> =
                        to_segments(&m.text).into_iter().map(|s| s.ph).collect();
                    JsString::join(&segs, &JsString::new())
                })
            })
            .collect();
        let full = JsString::join(&pieces, &JsString::new());
        let ord = match dd.stress.get(&w) {
            Some(&o) => o,
            None => count_nuclei(&JsString::join(
                &pieces[..d.stress_part.min(pieces.len())],
                &JsString::new(),
            )) as f64,
        };
        return corrections(&place_stress(&full, ord), &w);
    }

    let mut segs: Vec<Seg> = to_segments(&w);
    let vowel_idx: Vec<usize> = segs
        .iter()
        .enumerate()
        .filter(|(_, s)| s.vowel)
        .map(|(i, _)| i)
        .collect();
    if vowel_idx.is_empty() {
        let phs: Vec<JsString> = segs.into_iter().map(|s| s.ph).collect();
        return JsString::join(&phs, &JsString::new());
    }
    let dict_ord = dd
        .stress
        .get(&w)
        .copied()
        .or_else(|| inflected_stress_ord(&w));
    let prefix_guess = dict_ord.is_none() && guess_unstressed_prefix(&w);
    let ord = dict_ord.unwrap_or(if prefix_guess { 1.0 } else { 0.0 });
    // `vowelIdx[Math.min(ord, n - 1)]`: undefined for a NaN, negative or fractional index.
    let k = ord.min((vowel_idx.len() - 1) as f64);
    let stress_pos = if ord.is_nan() || k < 0.0 || k.fract() != 0.0 {
        None
    } else {
        Some(vowel_idx[k as usize])
    };

    if (dict_ord.is_some() || prefix_guess) && ord > 0.0 {
        let first = &mut segs[vowel_idx[0]];
        if w.starts_with(&js("be")) || w.starts_with(&js("ge")) {
            first.ph = js("ə");
        } else if js_re!("^(ver|zer|ent|emp|er)").test(&w) {
            first.ph = js("ɛ");
        }
    }

    let mut out = JsString::new();
    for (i, s) in segs.iter().enumerate() {
        if Some(i) == stress_pos && vowel_idx.len() > 1 {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&s.ph);
    }
    corrections(&out, &w)
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"({})|([1-9]\d{{0,2}}(?:\.\d{{3}})+(?:,\d+)?|\d+(?:,\d+)?)|([.!?…,;:])",
            *LATIN_RUN
        ),
        "gu",
    )
    .unwrap()
});

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: German's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[a-zäöüßA-ZÄÖÜ]", "u")));

/// The German engine (`createGerman`).
pub struct GermanPhonemizer {
    symbols: SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `GermanPhonemizer` proves the manifest and the
/// lexicons loaded, so none of these can reach a load panic. (The per-module differentials call them.)
impl GermanPhonemizer {
    /// `normalizeGerman(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_german(text)
    }

    /// `normalizeGermanInitialisms(text)`.
    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_german_initialisms(text)
    }

    /// `normalizeGermanYears(text)`.
    pub fn normalize_years(&self, text: &JsString) -> JsString {
        normalize_german_years(text)
    }

    /// The shared symbol tier, as German builds it.
    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    /// `isUnreadableGerman(word)`.
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_german(word)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `toSegments(word)` (g2p.ts).
    pub fn segments(&self, word: &JsString) -> Vec<Seg> {
        to_segments(word)
    }

    /// `decompose(word)` (morphology.ts).
    pub fn decompose(&self, word: &JsString) -> Decomp {
        decompose(word)
    }

    /// `numberToWords(n, raw)` (numbers.ts).
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }
}

impl GermanPhonemizer {
    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = normalize_german_years(
            &self
                .symbols
                .apply(&normalize_german_initialisms(&normalize_german(input))),
        );
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(n) = m.group(2, s).filter(|n| !n.is_empty()) {
                let parts = js_re!(r"\.", "gu")
                    .replace(&n, &JsString::new())
                    .split(&js(","));
                let int_part = &parts[0];
                for wd in number_to_words(js_number(int_part), Some(int_part)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
                if let Some(frac) = parts.get(1) {
                    sink.emit(&phonemize_word(&js("Komma")));
                    for d in frac.code_point_strings() {
                        for wd in number_to_words(js_number(&d), None).split(&js(" ")) {
                            sink.emit(&phonemize_word(&wd));
                        }
                    }
                }
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) = MANIFEST
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for GermanPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(GermanPhonemizer::text(self, input))
    }
}

/// `createGerman()`. Errors when the manifest or a lexicon cannot be loaded, or the symbol tier refuses it.
pub fn create_german() -> Result<GermanPhonemizer, String> {
    let m = try_manifest()?;
    try_lexicon()?;
    try_dicts()?;
    let st = &m.symbol_tier;
    let symbols = make_symbol_normalizer(&SymbolData {
        percent: Some(st.percent.clone()),
        currency: Some(st.currency.clone()),
        units: Some(st.units.clone()),
        exponent_words: Some(ExponentWords {
            squared: Some(st.exponent_words.squared.clone()),
            cubed: Some(st.exponent_words.cubed.clone()),
            position: st.exponent_words.position.clone(),
        }),
        bare_exponent: Some(BareExponent {
            squared: Some(st.bare_exponent.squared.clone()),
            cubed: Some(st.bare_exponent.cubed.clone()),
            power: Some(st.bare_exponent.power.clone()),
            negative: Some(st.bare_exponent.negative.clone()),
        }),
        magnitudes: Some(st.magnitudes.clone()),
        ampersand: Some(st.ampersand.clone()),
        multiply: Some(Multiply {
            times: st.multiply.times.clone(),
            by: st.multiply.by.clone(),
        }),
        ..Default::default()
    })?;
    Ok(GermanPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// test/german.test.ts's `phonemizeWord(…).toBe(…)` and `phonemize(…, "de").toBe(…)` pins, extracted from that
    /// file mechanically (each is a reading the TS suite asserts), so the two engines are held to one list.
    const WORD_PINS: &[(&str, &str)] = &[
        ("Vater", "fˈaːtɐ"),
        ("Wasser", "vˈasɐ"),
        ("machen", "mˈaxən"),
        ("über", "ˈyːbɐ"),
        ("lieben", "lˈiːbən"),
        ("sehen", "zˈeːən"),
        ("Hamburg", "hˈambʊɐ̯k"),
        ("das", "das"),
        ("ich", "ɪç"),
        ("Buch", "buːx"),
        ("König", "kˈøːnɪç"),
        ("Straße", "ʃtʁˈaːsə"),
        ("Zeit", "t͡saɪ̯t"),
        ("Deutschland", "dˈɔʏ̯t͡ʃlant"),
        ("Häuser", "hˈɔʏ̯zɐ"),
        ("müssen", "mˈʏsən"),
        ("Tag", "taːk"),
        ("Hund", "hʊnt"),
        ("gemacht", "ɡəmˈaxt"),
        ("bestimmt", "bəʃtˈɪmt"),
        ("gehen", "ɡˈeːən"),
        ("Laubsturm", "lˈaʊ̯pʃtʊɐ̯m"),
        ("Warenkorb", "vˈaːʁənkɔɐ̯p"),
        ("aufstehen", "ˈaʊ̯fʃteːən"),
        ("verstehen", "fəɐ̯ʃtˈeːən"),
        ("freundlich", "fʁˈɔʏ̯ntlɪç"),
        ("Zeitung", "t͡sˈaɪ̯tʊŋ"),
        ("Zeitungsartikel", "t͡sˈaɪ̯tʊŋsaɐ̯tiːkəl"),
        ("Geburtstag", "ɡəbˈuːɐ̯tstaːk"),
        ("beiden", "bˈaɪ̯dən"),
        ("beten", "bˈeːtən"),
        ("Möglichkeit", "mˈøːɡlɪçkaɪ̯t"),
        ("endlich", "ˈɛndlɪç"),
        ("gehör", "ɡəhˈøːɐ̯"),
        ("Behörde", "bəhˈøːɐ̯də"),
        ("fröhlich", "fʁˈøːlɪç"),
        ("mittelmäßig", "mˈɪtəlmɛsɪç"),
        ("mitteilen", "mˈɪttaɪ̯lən"),
        ("ungefähr", "ˈʊnɡəfɛːɐ̯"),
        ("Union", "uːni̯ˈoːn"),
        ("Universität", "ʊnifɛʁzitˈɛːt"),
        ("gestern", "ɡˈɛstɐn"),
        ("erst", "eːɐ̯st"),
        ("Gestein", "ɡəʃtˈaɪ̯n"),
        ("erstaunen", "ɛɐ̯ʃtˈaʊ̯nən"),
        ("feststellen", "fˈɛstʃtɛlən"),
        ("klarstellen", "klˈaːɐ̯ʃtɛlən"),
        ("schreiben", "ʃʁˈaɪ̯bən"),
        ("Klarinette", "klaʁinˈɛtə"),
        ("Krabbe", "kʁˈabə"),
        ("Widder", "vˈɪdɐ"),
        ("Smaragd", "smaʁˈakt"),
        ("Talent", "talˈɛnt"),
        ("Dokument", "dɔkumˈɛnt"),
        ("Friseur", "fʁizˈøːɐ̯"),
        ("Amateur", "amatˈøːɐ̯"),
        ("Steuer", "ʃtˈɔʏ̯ɐ"),
        ("Aluminium", "aːluːmˈiːni̯ʊm"),
        ("Zentrum", "t͡sˈɛntʁʊm"),
        ("Bündnis", "bˈʏntnɪs"),
        ("Ergebnis", "ɛɐ̯ɡˈeːpnɪs"),
        ("Tennis", "tˈɛnɪs"),
        ("universal", "univɛʁzˈaːl"),
        ("Adverb", "ˈatfɛʁp"),
        ("Expertise", "ɛkspɛʁtˈiːzə"),
        ("Wanderer", "vˈandəʁɐ"),
        ("genial", "ɡeni̯ˈaːl"),
        ("Material", "maːteːʁi̯ˈaːl"),
        ("Liberia", "libˈeːʁia"),
        ("Wahnvorstellung", "vˈaːnfoːɐ̯ʃtɛlʊŋ"),
        ("Vorstellung", "fˈoːɐ̯ʃtɛlʊŋ"),
        ("Donaudampfschiff", "dˈoːnaʊ̯dampfʃɪf"),
        ("Laterne", "latˈɛʁnə"),
        ("Inferno", "ɪnfˈɛʁno"),
        ("Marge", "mˈaɐ̯ʒə"),
        ("Garage", "ɡaʁˈaːʒə"),
        ("Etage", "etˈaːʒə"),
        ("Regen", "ʁˈeːɡən"),
        ("Familie", "famˈiːli̯ə"),
        ("Ferien", "fˈeːʁi̯ən"),
        ("Melodie", "melodˈiː"),
        ("Knie", "kniː"),
        ("Mädchen", "mˈɛːtçən"),
        ("Bildchen", "bˈɪltçən"),
        ("Ärzte", "ˈɛːɐ̯t͡stə"),
        ("Gespräch", "ɡəʃpʁˈɛːç"),
        ("Hätte", "hˈɛtə"),
        ("Käse", "kˈɛːzə"),
        ("Waffenstillstand", "vˈafənʃtɪlʃtant"),
        ("Landstraße", "lˈantʃtʁaːsə"),
        ("Geschwindigkeit", "ɡəʃvˈɪndɪçkaɪ̯t"),
        ("Iglu", "ˈiːɡlu"),
        ("würdigen", "vˈʏɐ̯dɪɡən"),
        ("Liga", "lˈiːɡa"),
        ("Christentum", "kʁˈɪstəntuːm"),
        ("Heidelbeere", "hˈaɪ̯dəlbeːʁə"),
        ("Waldsterben", "vˈaltʃtɛɐ̯bən"),
        ("Vase", "vˈaːzə"),
        ("Pseudonym", "psɔʏ̯donˈyːm"),
        ("Sonne", "zˈɔnə"),
        ("rauschen", "ʁˈaʊ̯ʃən"),
        ("waschen", "vˈaʃən"),
        ("Tuch", "tuːx"),
        ("China", "çˈiːna"),
        ("Christ", "kʁɪst"),
        ("Chaos", "kˈaːɔs"),
        ("Milch", "mɪlç"),
        ("Adler", "ˈaːdlɐ"),
        ("leben", "lˈeːbən"),
        ("November", "nofˈɛmbɐ"),
        ("digital", "diɡitˈaːl"),
        ("Dezember", "det͡sˈɛmbɐ"),
        ("Plural", "pluʁˈaːl"),
        ("gesetz", "ɡəzˈɛt͡s"),
        ("generell", "ɡenəʁˈɛl"),
        ("Problem", "pʁoblˈeːm"),
        ("wesentlich", "vˈeːzəntlɪç"),
        ("anderen", "ˈandəʁən"),
        ("helikopter", "helikˈɔptɐ"),
        ("Aktion", "akt͡si̯ˈoːn"),
        ("Nation", "naːt͡si̯ˈoːn"),
        ("Garantie", "ɡaʁantˈiː"),
        ("Studie", "ʃtˈuːdi̯ə"),
        ("Musikverein", "muzˈiːkfɛʁaɪ̯n"),
        ("Musikschule", "muzˈiːkʃuːlə"),
        ("Naturschutzgebiet", "natˈuːɐ̯ʃʊt͡sɡəbiːt"),
        ("thema", "tˈeːma"),
        ("theater", "teˈaːtɐ"),
        ("theresa", "teʁˈeːza"),
        ("behaglich", "bəhˈaːɡlɪç"),
        ("vorbehalten", "fˈoːɐ̯bəhaltən"),
        ("enthalten", "ɛnthˈaltən"),
        ("dreharbeit", "dʁˈeːaɐ̯baɪ̯t"),
        ("rohöl", "ʁˈoːøːl"),
        ("einweihung", "ˈaɪ̯nvaɪ̯ʊŋ"),
        ("uhr", "uːɐ̯"),
        ("fahren", "fˈaːʁən"),
        ("ruhig", "ʁˈuːɪç"),
        ("gasthaus", "ɡˈasthaʊ̯s"),
        ("kunsthändler", "kˈʊnsthɛndlɐ"),
        ("achthundert", "ˈaxthʊndɐt"),
        ("schönheit", "ʃˈøːnhaɪ̯t"),
    ];
    const TEXT_PINS: &[(&str, &str)] = &[
        ("21", "ˈaɪ̯nʊntt͡svant͡sɪç"),
        ("100", "ˈaɪ̯nhʊndɐt"),
        ("bedeutet", "bədˈɔʏ̯tət"),
        ("genutzten", "ɡənˈʊt͡stən"),
        ("behörden", "bəhˈœɐ̯dən"),
        ("gegangen", "ɡəɡˈaŋən"),
        ("gebracht", "ɡəbʁˈaxt"),
        ("gegen", "ɡˈɛɡən"),
        ("erste", "ˈeːɐ̯stə"),
        ("im 16. Jahrhundert", "ɪm zˈɛçt͡seːntən jaːɐ̯hˈʊndɐt"),
        ("das 16. Jahrhundert", "das zˈɛçt͡seːntə jaːɐ̯hˈʊndɐt"),
        ("des 16. Jahrhunderts", "dəs zˈɛçt͡seːntən jaːɐ̯hˈʊndɐts"),
        ("am 1. Januar", "am ˈɛɐ̯stən jˈanuaːɐ̯"),
        ("am 26. November", "am zˈɛçzʊntt͡svant͡sɪkstən nofˈɛmbɐ"),
        ("am 16. februar", "am zˈɛçt͡seːntən fˈeːbʁuaːɐ̯"),
        ("der 3. mai", "deːɐ̯ dʁˈɪtə maɪ̯"),
        ("des 16. jahrhunderts", "dəs zˈɛçt͡seːntən jaːɐ̯hˈʊndɐts"),
        ("1.000 Menschen", "ˈaɪ̯ntaʊ̯zənt mˈɛnʃən"),
        ("22.500", "t͡svaɪ̯ʊntt͡svˈant͡sɪçtaʊ̯zənt fˈʏnfhʊndɐt"),
        ("1,5 Meter", "aɪ̯ns kˈɔma fʏnf mˈeːtɐ"),
        ("11:00 Uhr", "ɛlf uːɐ̯"),
        ("8:46", "axt uːɐ̯ zˈɛçsʊntfɪɐ̯t͡sɪç"),
        ("z. B. das", "t͡suːm bˈaɪ̯ʃpiːl das"),
        ("bzw. auch", "bət͡sˈiːʊŋsvaɪ̯zə aʊ̯x"),
        ("Dr. Meier", "dˈɔktoːɐ̯ mˈaɪ̯ɐ"),
        ("usw.", "ʊnt zoː vˈaɪ̯tɐ ."),
        ("356 v. Chr.", "dʁˈaɪ̯ʊndɐtzɛçzʊntfʏnft͡sɪç foːɐ̯ kʁˈɪstʊs"),
        ("im Jahr 1945", "ɪm jaːɐ̯ nˈɔʏ̯nt͡seːnhʊndɐtfʏnfʊntfiːɐ̯t͡sɪç"),
        ("1900", "nˈɔʏ̯nt͡seːnhʊndɐt"),
        ("1905", "nˈɔʏ̯nt͡seːnhʊndɐtfʏnf"),
        ("die 1980er Jahre", "diː nˈɔʏ̯nt͡seːnhʊndɐtaxt͡siːɡɐ jˈaːʁə"),
        ("im Jahr 2019", "ɪm jaːɐ̯ t͡svˈaɪ̯taʊ̯zənt nˈɔʏ̯nt͡seːn"),
        ("1066", "ˈaɪ̯ntaʊ̯zənt zˈɛçsʊntzɛçt͡sɪç"),
        ("1200 Menschen", "ˈaɪ̯ntaʊ̯zənt t͡svˈaɪ̯hʊndɐt mˈɛnʃən"),
        ("1200 menschen", "ˈaɪ̯ntaʊ̯zənt t͡svˈaɪ̯hʊndɐt mˈɛnʃən"),
        ("1500 Euro", "ˈaɪ̯ntaʊ̯zənt fˈʏnfhʊndɐt ˈɔʏ̯ʁo"),
        ("€1500", "ˈaɪ̯ntaʊ̯zənt fˈʏnfhʊndɐt ˈɔʏ̯ʁo"),
        ("1980ers", "ˈaɪ̯ntaʊ̯zənt nˈɔʏ̯nhʊndɐtaxtt͡sɪç eːɐ̯s"),
        ("die USA", "diː uː ɛs aː"),
        ("AOL", "aː oː ɛl"),
        ("120 km/h", "ˈaɪ̯nhʊndɐtt͡svant͡sɪç kilomˈeːtɐ pʁoː ʃtˈʊndə"),
        ("20 °C", "t͡svˈant͡sɪç ɡʁaːt t͡sˈɛlzi̯ʊs"),
        ("32 °c", "t͡svaɪ̯ʊndʁˈaɪ̯sɪç ɡʁaːt t͡sˈɛlzi̯ʊs"),
        ("90 °f", "nˈɔʏ̯nt͡sɪç ɡʁaːt fˈaːʁənhaɪ̯t"),
        ("Celsius", "t͡sˈɛlzi̯ʊs"),
        ("circa", "t͡sˈɪɐ̯ka"),
        ("Mercedes", "mɛɐ̯t͡sˈeːdəs"),
        ("Cafe", "kafˈeː"),
        ("Computer", "kɔmpˈuːtɐ"),
        ("Calcium", "kˈalki̯uːm"),
        ("+3 Grad", "plʊs dʁaɪ̯ ɡʁaːt"),
        ("1/5", "aɪ̯n fˈʏnftəl"),
        ("10 g", "t͡seːn ɡʁam"),
        ("10 ha", "t͡seːn hˈɛktaːɐ̯"),
        ("10 l", "t͡seːn lˈɪtɐ"),
        ("10 L", "t͡seːn lˈɪtɐ"),
        ("um 11.00 uhr", "ʊm ɛlf uːɐ̯"),
        ("um 8:30", "ʊm axt uːɐ̯ dʁˈaɪ̯sɪç"),
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        create_german().unwrap();
        for (w, want) in WORD_PINS {
            assert_eq!(phonemize_word(&js(w)).to_string_lossy(), *want, "{w}");
        }
        for (t, want) in TEXT_PINS {
            assert_eq!(crate::phonemize(t, "de").unwrap(), *want, "{t}");
        }
    }

    /// test/abbrev-word-edge.test.ts (de): each rule fires alone and declines glued after a non-ASCII letter.
    #[test]
    fn an_abbreviation_glued_after_a_non_ascii_letter_is_not_one() {
        let e = create_german().unwrap();
        let n = |s: &str| e.normalize(&js(s)).to_string_lossy();
        for (fires, declines) in [
            ("Er kam St. Peter", "Es ist gelöst. Peter"),
            ("Er wohnt in St.", "Es ist gelöst."),
            ("im Jahr 50 v. Chr. kam", "im Jahr 50 Öv. Chr. kam"),
            ("im Jahr 50 n. Chr. kam", "im Jahr 50 Ön. Chr. kam"),
            ("Obst, z. B. Äpfel", "Obst, Öz. B. Äpfel"),
            ("also d. h. nein", "also Öd. h. nein"),
            ("Leute, u. a. wir", "Leute, Öu. a. wir"),
            ("Obst u. Ä. hier", "Obst Öu. Ä. hier"),
        ] {
            assert_ne!(n(fires), fires, "{fires}");
            assert_eq!(n(declines), declines, "{declines}");
        }
    }

    /// test/german-1543.test.ts: an abbreviation's dot before , ; : ! ? goes (that mark carries the pause), a
    /// sentence-end dot stays, and a closing German quote is a phrase end.
    #[test]
    fn the_1543_findings_are_fixed() {
        use crate::languages::german::normalize::normalize_german;
        create_german().unwrap();
        let norm = |s: &str| normalize_german(&js(s)).to_string_lossy();
        let de = |s: &str| crate::phonemize(s, "de").unwrap();
        for (abbr, plain) in [
            (
                "Es kostet 21 Mio., also viel.",
                "Es kostet 21 Millionen, also viel.",
            ),
            (
                "Es kostet 1 Mio., also viel.",
                "Es kostet eine Million, also viel.",
            ),
            (
                "Es sind 21 Mio.; danach mehr.",
                "Es sind 21 Millionen; danach mehr.",
            ),
            ("Es sind 21 Mio.: genug.", "Es sind 21 Millionen: genug."),
            ("Sind es 21 Mio.?", "Sind es 21 Millionen?"),
            ("Es sind 21 Mio.!", "Es sind 21 Millionen!"),
            ("Siehe S., dann weiter.", "Siehe Seite, dann weiter."),
            ("Es kostet 21 Mio.", "Es kostet 21 Millionen."),
            ("Es kostet 1 Mio.  ", "Es kostet eine Million.  "),
            ("(Es sind 21 Mio.)", "(Es sind 21 Millionen.)"),
            ("Es sind 21 Mio... mehr", "Es sind 21 Millionen... mehr"),
        ] {
            assert_eq!(norm(abbr), norm(plain), "{abbr}");
        }
        for (abbr, plain) in [
            ("Er sagte »21 Mio.«", "Er sagte »21 Millionen.«"),
            ("Er sagte „21 Mio.“", "Er sagte „21 Millionen.“"),
        ] {
            assert_eq!(de(abbr), de(plain), "{abbr}");
        }
    }

    /// test/german-1514.test.ts: each input reads as a spelling the engine already reads correctly.
    #[test]
    fn the_1514_findings_are_fixed() {
        use crate::languages::german::g2p::to_segments;
        use crate::languages::german::normalize::normalize_german;
        create_german().unwrap();
        let de = |s: &str| crate::phonemize(s, "de").unwrap();
        let norm = |s: &str| normalize_german(&js(s)).to_string_lossy();
        let same = [
            // 1) a grouped amount keeps its decimal comma
            ("3.000,50 Euro", "3000,50 Euro"),
            ("1.000,5", "1000,5"),
            ("1.000.000,25 Euro", "1000000,25 Euro"),
            ("1.000, dann", "1000, dann"),
            // 2) z. B. and u. Ä. match lowercased input
            ("z. b. das", "z. B. das"),
            ("z.b. das", "z.B. das"),
            ("u. ä. mehr", "u. Ä. mehr"),
            // 3) a denominator of 1 is not a fraction word
            ("1/1", "1 1"),
            // 4) 1 Mio. and 1 Mrd. are singular with the article; anything else keeps the plural
            ("1 Mio. Euro", "eine Million Euro"),
            ("1 mio. Euro", "eine Million Euro"),
            ("1 Mrd. Menschen", "eine Milliarde Menschen"),
            ("das kostet 1 Mio.", "das kostet eine Million."),
            ("2 Mio. Euro", "2 Millionen Euro"),
            ("11 Mio. Euro", "11 Millionen Euro"),
            ("1,1 Mio. Euro", "1,1 Millionen Euro"),
        ];
        for (a, b) in same {
            assert_eq!(de(a), de(b), "{a} vs {b}");
        }
        assert_eq!(norm("z. b. das"), norm("z. B. das"));
        assert_eq!(norm("1/1"), "1/1");
        assert_eq!(norm("2/1"), "2/1");
        assert_ne!(norm("1/2"), "1/2");
        // 5) a non-initial ch with no vowel before it is the ich-laut; a back vowel still gives the ach-laut
        let phs = |w: &str| {
            to_segments(&js(w))
                .iter()
                .map(|s| s.ph.to_string_lossy())
                .collect::<Vec<_>>()
        };
        assert!(!phs("lchen").contains(&"x".to_string()));
        assert!(phs("lchen").contains(&"ç".to_string()));
        assert!(phs("lachen").contains(&"x".to_string()));
    }
}
