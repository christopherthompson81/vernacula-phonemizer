//! Afrikaans (af) phonemizer: the curated and RCRL lexicons, then (best path only) the neural OOV tagger, then the
//! rule engine — a greedy longest-match grapheme scan with the open/closed vowel-length rule, positional and
//! regressive devoicing, suffix- and prefix-driven stress, compounds decomposed and joined at their seams; and
//! text() over Latin words, numbers (period decimal, comma grouping) and clause punctuation.
//! Ported from src/languages/afrikaans/afrikaans.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::manifest::{DIR, FIXED_KEYS, MANIFEST, try_manifest};
use super::morphology::decompose;
use super::normalize::{normalize_afrikaans, normalize_afrikaans_initialisms};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::germanic_morphology::Kind;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};
use crate::core::normalize_symbols::{
    Multiply, SymbolData, SymbolNormalizer, UnitPer, make_symbol_normalizer,
};
use crate::core::provenance::{Form, normalize};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

type Lexicon = IndexMap<JsString, JsString>;

/// `lexicon()`: the curated proper-noun / opaque-loan rows (required).
fn try_lexicon() -> Result<&'static Lexicon, String> {
    static L: OnceLock<Lexicon> = OnceLock::new();
    load_once(&L, || {
        load_tsv_strings(DIR, "af-lexicon.tsv", TsvOptions::default()).map_err(|e| e.to_string())
    })
}

/// `rcrl()`: the RCRL pronunciation lexicon (optional).
fn try_rcrl() -> Result<&'static Lexicon, String> {
    static L: OnceLock<Lexicon> = OnceLock::new();
    load_once(&L, || {
        load_tsv_strings(
            DIR,
            "af-rcrl-lexicon.tsv",
            TsvOptions {
                optional: true,
                fold: None,
            },
        )
        .map_err(|e| e.to_string())
    })
}

/// ⚠ Both reached only through a checked path (an `AfrikaansPhonemizer`, whose constructor loads them).
fn lexicon() -> &'static Lexicon {
    try_lexicon().unwrap_or_else(|e| panic!("{e}"))
}
fn rcrl() -> &'static Lexicon {
    try_rcrl().unwrap_or_else(|e| panic!("{e}"))
}

fn set(list: &[String]) -> HashSet<JsString> {
    list.iter().map(|s| js(s)).collect()
}

fn get<'a>(map: &'a IndexMap<String, String>, key: &JsString) -> Option<&'a String> {
    map.get(&key.to_string_lossy())
}

/// One code unit as a string (`w[i]`).
fn unit(u: u16) -> JsString {
    JsString::from_units(&[u])
}

/// `DIA[c]` is truthy.
fn dia(c: &JsString) -> Option<&'static String> {
    get(&MANIFEST.diacritic_vowels, c).filter(|v| !v.is_empty())
}

static BARE_VOWELS: LazyLock<HashSet<JsString>> = LazyLock::new(|| set(&MANIFEST.bare_vowels));
static VOWEL_LETTER: LazyLock<HashSet<JsString>> = LazyLock::new(|| set(&MANIFEST.vowel_letters));
static C_SOFT: LazyLock<HashSet<JsString>> = LazyLock::new(|| set(&MANIFEST.c_soft_before));
static W_GLIDE_AFTER: LazyLock<HashSet<JsString>> = LazyLock::new(|| set(&MANIFEST.w_glide_after));
static RESYLLABIFY: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| set(&MANIFEST.morphology.resyllabifying_suffixes));

/// `VOICELESS_NEXT`: ⟨c⟩, plus every one-unit grapheme whose phone begins with a voiceless obstruent.
static VOICELESS_NEXT: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    let voiceless = set(&MANIFEST.voiceless_phones);
    let mut s = HashSet::from([js("c")]);
    for (k, v) in &MANIFEST.fixed {
        let first = js(v).code_point_strings().into_iter().next();
        if js(k).len() == 1 && first.is_some_and(|f| voiceless.contains(&f)) {
            s.insert(js(k));
        }
    }
    s
});

/// `KNOWN_LETTERS`: every single CODE POINT the scan has a rule for.
static KNOWN_LETTERS: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    let mut s: HashSet<JsString> = MANIFEST
        .fixed
        .keys()
        .map(|k| js(k))
        .filter(|k| k.code_point_strings().len() == 1)
        .collect();
    s.extend(MANIFEST.diacritic_vowels.keys().map(|k| js(k)));
    s.extend(MANIFEST.bare_vowels.iter().map(|k| js(k)));
    s.insert(js("c"));
    s.insert(js("'"));
    s
});

/// `foldForeignLetters(w)`: a letter outside the inventory is read as its base, one code point for one.
fn fold_foreign_letters(w: &JsString) -> JsString {
    let cps = w.code_point_strings();
    if cps.iter().all(|c| KNOWN_LETTERS.contains(c)) {
        return w.clone();
    }
    let mut out = JsString::new();
    for c in cps {
        if KNOWN_LETTERS.contains(&c) {
            out.push_str(&c);
            continue;
        }
        let b = js_re!(r"\p{M}+", "gu").replace(&normalize(&c, Form::Nfd), &JsString::new());
        out.push_str(if b.len() == 1 && KNOWN_LETTERS.contains(&b) {
            &b
        } else {
            &c
        });
    }
    out
}

/// `isOpen(w, i)`, over code units.
fn is_open(w: &[u16], i: usize) -> bool {
    let mut j = i + 1;
    while j < w.len() && !VOWEL_LETTER.contains(&unit(w[j])) {
        j += 1;
    }
    let cons = j - (i + 1);
    if cons == 0 {
        return true;
    }
    cons == 1 && j < w.len()
}

/// `byLen(xs)`: stably sorted by UTF-16 length, longest first, joined with `|`.
fn by_len(xs: &[String]) -> String {
    let mut v: Vec<&String> = xs.iter().collect();
    v.sort_by_key(|s| std::cmp::Reverse(js(s).len()));
    v.iter().map(|s| s.as_str()).collect::<Vec<_>>().join("|")
}

static STRESS_FROM_END_KEYS: LazyLock<Vec<(JsString, f64)>> = LazyLock::new(|| {
    let mut keys: Vec<(JsString, f64)> = MANIFEST
        .stress_from_end
        .iter()
        .map(|(k, &v)| (js(k), v))
        .collect();
    keys.sort_by_key(|(k, _)| std::cmp::Reverse(k.len()));
    keys
});
static STRESS_FINAL: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!("({})$", by_len(&MANIFEST.stress_final_suffixes)),
        "u",
    )
    .unwrap()
});
static STRESS_PENULT: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!("({})$", by_len(&MANIFEST.stress_penult_suffixes)),
        "u",
    )
    .unwrap()
});
static UNSTRESSED_PREFIX: LazyLock<JsRegex> = LazyLock::new(|| {
    let v = MANIFEST.vowel_letters.join("");
    let p = MANIFEST.morphology.prefix_unstressed.join("|");
    JsRegex::new(&format!("^({p})[^{v}]*[{v}]"), "u").unwrap()
});

/// `w.startsWith(key, i)` over code units.
fn starts_with_at(w: &[u16], key: &JsString, i: usize) -> bool {
    w.len() >= i + key.len() && w[i..i + key.len()] == key.units()[..]
}

/// The doubled-consonant skip both walks share: `!VOWEL_LETTER.has(c) && w[i + 1] === c && c !== "'"`.
fn doubled_consonant(w: &[u16], i: usize) -> bool {
    let c = w[i];
    !VOWEL_LETTER.contains(&unit(c)) && w.get(i + 1) == Some(&c) && c != b'\'' as u16
}

/// `countNuclei(w)`: walked with the same decisions `phonemizeMorpheme` makes.
fn count_nuclei(w: &JsString) -> usize {
    let u = w.units();
    let mut n = 0;
    let mut i = 0;
    while i < u.len() {
        let c = unit(u[i]);
        if dia(&c).is_some() {
            n += 1;
            i += 1;
            continue;
        }
        if doubled_consonant(u, i) {
            i += 1;
            continue;
        }
        if u[i] == b'c' as u16 && u.get(i + 1) != Some(&(b'h' as u16)) {
            i += 1;
            continue;
        }
        if let Some(key) = FIXED_KEYS.iter().find(|k| starts_with_at(u, k, i)) {
            if VOWEL_LETTER.contains(&unit(key.units()[0])) {
                n += 1;
            }
            i += key.len();
            continue;
        }
        if BARE_VOWELS.contains(&c) {
            n += 1;
        }
        i += 1;
    }
    n
}

/// `stressedNucleus(w)`: the 0-based nucleus carrying primary stress.
fn stressed_nucleus(w: &JsString) -> usize {
    let n = count_nuclei(w);
    if n <= 1 {
        return 0;
    }
    for (s, from_end) in STRESS_FROM_END_KEYS.iter() {
        if !w.ends_with(s) {
            continue;
        }
        if *from_end < n as f64 {
            return n - 1 - *from_end as usize;
        }
        break;
    }
    if STRESS_FINAL.test(w) {
        return n - 1;
    }
    if STRESS_PENULT.test(w) {
        return n - 2;
    }
    usize::from(UNSTRESSED_PREFIX.test(w))
}

/// `phonemizeMorpheme(word, finalDevoice, emitStress)`.
fn phonemize_morpheme(word: &JsString, final_devoice: bool, emit_stress: bool) -> JsString {
    let w = fold_foreign_letters(&normalize(word, Form::Nfc).to_lower_case());
    let stress_nucleus = stressed_nucleus(&w);
    let u = w.units();
    let mut out = JsString::new();
    let mut i = 0;
    let mut nucleus = 0;
    let mut stress_at: Option<usize> = None;
    'scan: while i < u.len() {
        let c = unit(u[i]);
        if let Some(v) = dia(&c) {
            if nucleus == stress_nucleus && stress_at.is_none() {
                stress_at = Some(out.len());
            }
            out.push_str(&js(v));
            i += 1;
            nucleus += 1;
            continue;
        }
        if doubled_consonant(u, i) {
            i += 1;
            continue;
        }
        if u[i] == b'c' as u16 && u.get(i + 1) != Some(&(b'h' as u16)) {
            // `C_SOFT.has(w[i + 1] ?? "")`
            let next = u.get(i + 1).map_or_else(JsString::new, |&n| unit(n));
            out.push_str(&js(if C_SOFT.contains(&next) { "s" } else { "k" }));
            i += 1;
            continue;
        }
        if u[i] == b'w' as u16 && i == 1 && W_GLIDE_AFTER.contains(&unit(u[0])) {
            out.push_str(&js("w"));
            i += 1;
            continue;
        }
        for key in FIXED_KEYS.iter() {
            if starts_with_at(u, key, i) {
                let devoice_here = match u.get(i + key.len()) {
                    None => final_devoice,
                    Some(&next) => VOICELESS_NEXT.contains(&unit(next)),
                };
                let is_vowel = VOWEL_LETTER.contains(&unit(key.units()[0]));
                if is_vowel && nucleus == stress_nucleus && stress_at.is_none() {
                    stress_at = Some(out.len());
                }
                let devoiced = get(&MANIFEST.voiced_final, key).filter(|d| !d.is_empty());
                let ph = match devoiced {
                    Some(d) if devoice_here => d,
                    _ => get(&MANIFEST.fixed, key).unwrap(),
                };
                out.push_str(&js(ph));
                if is_vowel {
                    nucleus += 1;
                }
                i += key.len();
                continue 'scan;
            }
        }
        if BARE_VOWELS.contains(&c) {
            let stressed = nucleus == stress_nucleus;
            if stressed && stress_at.is_none() {
                stress_at = Some(out.len());
            }
            let cl = c.to_string_lossy();
            let ph: String = if cl == "e" && i == u.len() - 1 {
                "ə".to_string()
            } else if cl == "i" {
                (if is_open(u, i) { "i" } else { "ə" }).to_string()
            } else if stressed {
                let table = if is_open(u, i) {
                    &MANIFEST.vowels_long
                } else {
                    &MANIFEST.vowels_short
                };
                table[cl.as_str()].clone()
            } else {
                // `(isOpen(w, i) ? REDUCE_OPEN[c] : undefined) ?? REDUCE[c]!`
                is_open(u, i)
                    .then(|| MANIFEST.unstressed_open.get(cl.as_str()).cloned().flatten())
                    .flatten()
                    .unwrap_or_else(|| MANIFEST.unstressed_reduction[cl.as_str()].clone())
            };
            out.push_str(&js(&ph));
            i += 1;
            nucleus += 1;
            continue;
        }
        i += 1;
    }
    match stress_at {
        Some(at) if emit_stress => out
            .slice(0, Some(at as isize))
            .concat(&js("ˈ"))
            .concat(&out.slice(at as isize, None)),
        _ => out,
    }
}

/// `joinSeams(parts)`: a ⟨d⟩ coda's stop is absorbed by a following coronal-stop onset.
fn join_seams(parts: &[(JsString, JsString)]) -> JsString {
    let coronal = js_re!(r"[td]", "u");
    let mut out = JsString::new();
    let mut prev_src = JsString::new();
    for (ipa, src) in parts {
        if let Some(&last) = out.units().last()
            && prev_src.ends_with(&js("d"))
            && coronal.test(&unit(last))
            && coronal.test(&ipa.char_at(0))
        {
            out = out.slice(0, Some(-1));
        }
        out.push_str(ipa);
        prev_src = src.clone();
    }
    out
}

/// `afrikaansLexiconHas(word)`: is this word served by either shipped lexicon?
pub fn afrikaans_lexicon_has(word: &JsString) -> bool {
    let w = normalize(word, Form::Nfc).to_lower_case();
    lexicon().contains_key(&w) || rcrl().contains_key(&w)
}

/// `afrikaansRuleReserved(word)`: ⟨'n⟩, a bare single letter and the letter names (#1578: the tagger read the
/// initialism letter `er` *ər* against the rule path's *ɛr*) belong to the rule path.
pub fn afrikaans_rule_reserved(word: &JsString) -> bool {
    let w = normalize(word, Form::Nfc).to_lower_case();
    w == "'n" || w == "’n" || w.code_point_strings().len() == 1 || LETTER_NAME_WORDS.contains(&w)
}

/// The letter names as words (`bee`, `er`, `zet`), for `afrikaans_rule_reserved`.
static LETTER_NAME_WORDS: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    MANIFEST
        .letter_names
        .values()
        .map(|n| js(n).to_lower_case())
        .collect()
});

/// `withStress(ipa, word)`: a reading without a primary mark gets one where the rule computes it.
fn with_stress(ipa: &JsString, word: &JsString) -> JsString {
    if ipa.is_empty() || ipa.includes(&js("\u{2c8}")) {
        return ipa.clone();
    }
    let nucleus = js_re!(r"[aeiouyɑɛɔœəøæɪʊ]", "u");
    let target = stressed_nucleus(&fold_foreign_letters(
        &normalize(word, Form::Nfc).to_lower_case(),
    ));
    let mut seen: isize = -1;
    let mut i = 0;
    while i < ipa.len() {
        if nucleus.test(&ipa.char_at(i)) {
            seen += 1;
            if seen == target as isize {
                return ipa
                    .slice(0, Some(i as isize))
                    .concat(&js("\u{2c8}"))
                    .concat(&ipa.slice(i as isize, None));
            }
            while i + 1 < ipa.len() && nucleus.test(&ipa.char_at(i + 1)) {
                i += 1;
            }
        }
        i += 1;
    }
    ipa.clone()
}

/// `OovResolver`: word → IPA, or `None` to defer to the rule engine.
pub type OovResolver<'a> = &'a dyn Fn(&JsString) -> Option<JsString>;

/// `phonemizeWord(word, oovOverride)`: curated lexicon → RCRL → override → rules.
pub fn phonemize_word(word: &JsString, oov: Option<OovResolver>) -> JsString {
    let w = normalize(word, Form::Nfc).to_lower_case();
    if let Some(pinned) = lexicon().get(&w) {
        return with_stress(pinned, &w);
    }
    if let Some(dict) = rcrl().get(&w) {
        return with_stress(dict, &w);
    }
    if !afrikaans_rule_reserved(&w)
        && let Some(r) = oov.and_then(|f| f(&w)).filter(|r| !r.is_empty())
    {
        return with_stress(&r, &w);
    }
    phonemize_word_rules(&w)
}

/// `phonemizeWordRules(word)`: the rule engine alone.
pub fn phonemize_word_rules(word: &JsString) -> JsString {
    let w = normalize(word, Form::Nfc).to_lower_case();
    if w == "'n" || w == "’n" {
        return js("ə");
    }
    if w.code_point_strings().len() == 1
        && let Some(spelled) = get(&MANIFEST.letter_names, &w)
    {
        return phonemize_morpheme(&js(spelled), true, true);
    }
    let d = decompose(&w);
    if d.parts.len() <= 1 {
        return phonemize_morpheme(&w, true, true);
    }
    let parts: Vec<(JsString, JsString)> = d
        .parts
        .iter()
        .enumerate()
        .map(|(idx, p)| {
            let ipa = if d.kinds[idx] == Kind::Prefix && idx < d.stress_part {
                get(&MANIFEST.prefix_ipa, p)
                    .map(|v| js(v))
                    .unwrap_or_else(|| phonemize_morpheme(p, true, false))
            } else {
                let next = d.parts.get(idx + 1).cloned().unwrap_or_default();
                phonemize_morpheme(p, !RESYLLABIFY.contains(&next), idx == d.stress_part)
            };
            (ipa, p.clone())
        })
        .collect();
    join_seams(&parts)
}

/// The word arm of `TOKEN` (also the neural pre-pass's `WORD`).
pub const AF_WORD: &str = r"['’]?\p{Script=Latin}[\p{Script=Latin}\p{M}]*(?:['’]\p{Script=Latin}[\p{Script=Latin}\p{M}]*)*";

/// The Afrikaans engine (`createAfrikaans`).
pub struct AfrikaansPhonemizer {
    symbols: SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding an `AfrikaansPhonemizer` proves the manifest, both
/// lexicons and the symbol tier loaded. (The per-module differentials call them.)
impl AfrikaansPhonemizer {
    /// `normalizeAfrikaans(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_afrikaans(text)
    }

    /// The shared symbol tier, as Afrikaans builds it.
    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    /// `normalizeAfrikaansInitialisms(text)`.
    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_afrikaans_initialisms(text)
    }

    /// `ordinalWord(n)` (normalize.ts).
    pub fn ordinal_word(&self, n: f64) -> Option<JsString> {
        super::normalize::ordinal_word(n)
    }

    /// `isUnreadableAfrikaans(word)` (normalize.ts).
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        (super::normalize::IS_UNREADABLE)(word)
    }

    /// `phonemizeWordRules(word)`.
    pub fn phonemize_word_rules(&self, word: &JsString) -> JsString {
        phonemize_word_rules(word)
    }

    /// `phonemizeWord(word)` (no override).
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word, None)
    }

    /// `numberToWords(n, raw)`.
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    /// `decompose(word)` (morphology.ts).
    pub fn decompose(&self, word: &JsString) -> crate::core::germanic_morphology::Decomp {
        decompose(word)
    }

    /// `afrikaansLexiconHas(word)`.
    pub fn lexicon_has(&self, word: &JsString) -> bool {
        afrikaans_lexicon_has(word)
    }

    /// `text(input, oovOverride)`.
    pub fn text(&self, input: &JsString, oov: Option<OovResolver>) -> JsString {
        static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
            JsRegex::new(
                &format!(r"({AF_WORD})|(\d+\.\d+|[1-9]\d{{0,2}}(?:,\d{{3}})+|\d+)|([.!?…,;:])"),
                "gu",
            )
            .unwrap()
        });
        let prepared =
            normalize_afrikaans_initialisms(&self.symbols.apply(&normalize_afrikaans(input)));
        assemble_clauses(&prepared, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w, oov));
            } else if let Some(n) = m.group(2, s).filter(|n| !n.is_empty()) {
                let bare = js_re!(r",", "gu").replace(&n, &JsString::new());
                let parts = bare.split(&js("."));
                let int_part = &parts[0];
                for wd in number_to_words(js_number(int_part), Some(int_part)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd, None));
                }
                if let Some(frac) = parts.get(1) {
                    sink.emit(&phonemize_word(&js(&MANIFEST.decimal_word), None));
                    for d in frac.code_point_strings() {
                        for wd in number_to_words(js_number(&d), None).split(&js(" ")) {
                            sink.emit(&phonemize_word(&wd, None));
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

impl Engine for AfrikaansPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(AfrikaansPhonemizer::text(self, input, None))
    }

    fn neural(&self, pre_passed: &JsString) -> Option<Result<JsString, PhonemizeError>> {
        use super::{afrikaans_neural::phonemize_af_neural, afrikaans_tagger::afrikaans_tagger};
        Some(
            phonemize_af_neural(self, afrikaans_tagger(), pre_passed)
                .map_err(PhonemizeError::Neural),
        )
    }

    fn has_neural(&self) -> bool {
        true
    }
}

/// `createAfrikaans()`. Errors when the manifest or a lexicon cannot be loaded, or the symbol tier refuses the
/// manifest's data.
pub fn create_afrikaans() -> Result<AfrikaansPhonemizer, String> {
    let m = try_manifest()?;
    try_lexicon()?;
    try_rcrl()?;
    let st = &m.symbol_tier;
    let symbols = make_symbol_normalizer(&SymbolData {
        multiply: Some(Multiply {
            times: m.sign_words.times.clone(),
            by: None,
        }),
        percent: Some(st.percent.clone()),
        currency: Some(st.currency.clone()),
        units: Some(st.units.clone()),
        rate_denominators: Some(st.rate_denominators.clone()),
        unit_per: Some(UnitPer::All(st.unit_per.clone())),
        exponent_words: Some(st.exponent_words.clone()),
        magnitudes: Some(st.magnitudes.clone()),
        ..Default::default()
    })?;
    Ok(AfrikaansPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/afrikaans.test.ts and test/afNeural.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["dag"], Some("dˈaχ")),
        ("phonemizeWord", &["agt"], Some("ˈaχt")),
        ("phonemizeWord", &["goed"], Some("χˈut")),
        ("phonemizeWord", &["hond"], Some("ɦˈɔnt")),
        ("phonemizeWord", &["aand"], Some("ˈɑːnt")),
        ("phonemizeWord", &["kˈat"], Some("kˈat")),
        ("phonemizeWord", &["water"], Some("vˈɑːtər")),
        ("phonemizeWord", &["appel"], Some("ˈapəl")),
        ("phonemizeWord", &["een"], Some("ˈiən")),
        ("phonemizeWord", &["twee"], Some("twˈiə")),
        ("phonemizeWord", &["groot"], Some("χrˈuət")),
        ("phonemizeWord", &["sewe"], Some("sˈiəvə")),
        ("phonemizeWord", &["huis"], Some("ɦˈœys")),
        ("phonemizeWord", &["bietjie"], Some("bˈiki")),
        ("phonemizeWord", &["altyd"], Some("ˈaltəit")),
        ("phonemizeWord", &["môre"], Some("mˈɔːrə")),
        (
            "createAfrikaans().text",
            &["Die man loop huis toe."],
            Some("dˈi mˈan lˈuəp ɦˈœys tˈu ."),
        ),
        ("phonemizeWord", &["Schalk"], Some("skˈalk")),
        ("phonemizeWord", &["Schoeman"], Some("skˈuman")),
        ("phonemizeWord", &["skryf"], Some("skrˈəif")),
        ("phonemizeWordRules", &["chirurg"], Some("ʃˈirœrχ")),
        ("phonemizeWordRules", &["China"], Some("ʃˈina")),
        ("phonemizeWordRules", &["Christus"], Some("krˈəstœs")),
        ("phonemizeWord", &["Christus"], Some("χrˈəstœs")),
        ("phonemizeWordRules", &["chemie"], Some("ʃˈiəmi")),
        ("phonemizeWord", &["chemie"], Some("χˈiəmi")),
        ("phonemizeWord", &["C"], Some("sˈiə")),
        ("phonemizeWord", &["B"], Some("bˈiə")),
        ("phonemizeWord", &["X"], Some("ˈɛks")),
        (
            "createAfrikaans().text",
            &["Vitamien C"],
            Some("fitamˈin sˈiə"),
        ),
        ("phonemizeWord", &["'n"], Some("ə")),
        (
            "createAfrikaans().text",
            &["x = 5"],
            Some("ˈɛks χəlˈəik ˈɑːn fˈəif"),
        ),
        ("createAfrikaans().text", &["e-pos"], Some("ˈiə pˈɔs")),
        (
            "createAfrikaans().text",
            &["3 g suiker"],
            Some("drˈi χrˈam sˈœykər"),
        ),
        (
            "createAfrikaans().text",
            &["5 l water"],
            Some("fˈəif lˈitər vˈɑːtər"),
        ),
        ("phonemizeWord", &["franc"], Some("frˈank")),
        ("phonemizeWord", &["arc"], Some("ˈark")),
        ("phonemizeWord", &["bloc"], Some("blˈɔk")),
        ("phonemizeWord", &["cent"], Some("sˈɛnt")),
        ("phonemizeWord", &["advies"], Some("ˈatfis")),
        ("phonemizeWord", &["goedkoop"], Some("χˈutkuəp")),
        ("phonemizeWord", &["ontbyt"], Some("ɔntbˈəit")),
        ("phonemizeWord", &["sending"], Some("sˈɛndəŋ")),
        ("phonemizeWord", &["verbeelding"], Some("fərbˈiəldəŋ")),
        ("phonemizeWord", &["skoolvoeding"], Some("skˈuəlfudəŋ")),
        ("phonemizeWord", &["bloedarm"], Some("blˈutarm")),
        ("phonemizeWord", &["handomkeer"], Some("ɦˈantɔmkiər")),
        ("phonemizeWord", &["veldtog"], Some("fˈɛltɔχ")),
        ("phonemizeWord", &["wildtuin"], Some("vˈəltœyn")),
        ("phonemizeWord", &["landdros"], Some("lˈandrɔs")),
        ("phonemizeWord", &["bestanddeel"], Some("bəstˈandiəl")),
        ("phonemizeWord", &["groottoon"], Some("χrˈuəttuən")),
        ("phonemizeWord", &["swaar"], Some("swˈɑːr")),
        ("phonemizeWord", &["kwaad"], Some("kwˈɑːt")),
        ("phonemizeWord", &["dwaal"], Some("dwˈɑːl")),
        ("phonemizeWord", &["verdwyn"], Some("fərdwˈəin")),
        ("phonemizeWord", &["antwoord"], Some("ˈantvuərt")),
        ("phonemizeWord", &["brandweer"], Some("brˈantviər")),
        ("phonemizeWord", &["weer"], Some("vˈiər")),
        ("phonemizeWord", &["voedingswaarde"], Some("fˈudəŋsvɑːrdə")),
        (
            "phonemizeWord",
            &["gebruikswaarde"],
            Some("χəbrˈœyksvɑːrdə"),
        ),
        (
            "phonemizeWord",
            &["kruideniersware"],
            Some("krœydənˈirsvɑːrə"),
        ),
        ("phonemizeWord", &["kilometer"], Some("kˈilumiətər")),
        ("phonemizeWord", &["kilogram"], Some("kˈiluχram")),
        ("phonemizeWord", &["advokaat"], Some("atfukˈɑːt")),
        ("phonemizeWord", &["ammoniete"], Some("amunˈitə")),
        ("phonemizeWord", &["formule"], Some("fˈɔrmylə")),
        ("phonemizeWord", &["akkuraat"], Some("akyrˈɑːt")),
        ("phonemizeWord", &["afsku"], Some("ˈafsky")),
        ("phonemizeWordRules", &["kanon"], Some("kˈɑːnɔn")),
        ("phonemizeWordRules", &["muskiet"], Some("mˈœskit")),
        ("phonemizeWord", &["klassifiseer"], Some("klasifisˈiər")),
        ("phonemizeWord", &["neutraliseer"], Some("nøːtralisˈiər")),
        ("phonemizeWord", &["privatisering"], Some("prifatisˈiərəŋ")),
        ("phonemizeWord", &["akrobatiese"], Some("akrubˈɑːtisə")),
        ("phonemizeWord", &["negentig"], Some("nˈiəχəntəχ")),
        ("phonemizeWord", &["sewentig"], Some("sˈiəvəntəχ")),
        ("phonemizeWordRules", &["biologiese"], Some("biulˈuəχisə")),
        ("phonemizeWordRules", &["dialektiese"], Some("dialˈɛktisə")),
        (
            "phonemizeWordRules",
            &["nasionalisme"],
            Some("nasiunalˈəsmə"),
        ),
        ("phonemizeWord", &["polisie"], Some("pˈuəlisi")),
        ("phonemizeWord", &["nasionalisme"], Some("naʃiunalˈəsmə")),
        ("phonemizeWordRules", &["polisie"], Some("pˈuəlisi")),
        ("phonemizeWord", &["Afrikaans"], Some("ˈafrikɑ̃ːs")),
        ("phonemizeWord", &["argeologiese"], Some("arχiulˈuəχisə")),
        ("phonemizeWord", &["biologiese"], Some("biulˈuəχisə")),
        ("phonemizeWord", &["Botha"], Some("bˈuəta")),
        ("phonemizeWord", &["Blignault"], Some("blˈəχnœut")),
        ("phonemizeWord", &["botha"], Some("bˈuəta")),
        ("ordinalWord", &["1"], Some("eerste")),
        ("ordinalWord", &["9"], Some("neënde")),
        ("ordinalWord", &["11"], Some("elfde")),
        ("ordinalWord", &["15"], Some("vyftiende")),
        ("ordinalWord", &["19"], Some("negentiende")),
        ("ordinalWord", &["20"], Some("twintigste")),
        ("ordinalWord", &["60"], Some("sestigste")),
        ("ordinalWord", &["190"], Some("honderd en negentigste")),
        ("ordinalWord", &["110"], Some("honderd en tiende")),
        ("ordinalWord", &["111"], Some("honderd en elfde")),
        ("ordinalWord", &["112"], Some("honderd en twaalfde")),
        ("ordinalWord", &["119"], Some("honderd en negentiende")),
        ("ordinalWord", &["101"], Some("honderd en eerste")),
        (
            "normalizeAfrikaans",
            &["11de Hussars"],
            Some("elfde Hussars"),
        ),
        ("normalizeAfrikaans", &["15de eeu"], Some("vyftiende eeu")),
        (
            "normalizeAfrikaans",
            &["9e Augustus"],
            Some("neënde Augustus"),
        ),
        (
            "normalizeAfrikaans",
            &["60ste van die seisoen"],
            Some("sestigste van die seisoen"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["17,500 myl"],
            Some("sˈiəvəntin dˈœysənt fˈəif ɦˈɔndərt mˈəil"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["100,000 mense"],
            Some("ɦˈɔndərt dˈœysənt mˈɛnsə"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["12.8 km"],
            Some("twˈɑːlf kˈɔma ˈaχt kˈilumiətər"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["2.3 miljoen"],
            Some("twˈiə kˈɔma drˈi məljˈun"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["10:00vm"],
            Some("tˈin fˈuərmədaχ"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["8:30 n.m."],
            Some("ˈaχt dˈɛrtəχ nˈɑːmədaχ ."),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["11:20"],
            Some("ˈɛlf twˈəntəχ"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["323 v.C."],
            Some("drˈi ɦˈɔndərt ˈɛn drˈi ˈɛn twˈəntəχ fˈuər χrˈəstœs ."),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["d.i. 0 of 1"],
            Some("dˈət ˈəs nˈœl ˈɔf ˈiən"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["Dr. Lee"],
            Some("dˈɔktər lˈiə"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["40 m.p.u"],
            Some("fˈiərtəχ mˈəil pˈər ˈyːr"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["480 km/h"],
            Some("fˈir ɦˈɔndərt ˈɛn tˈaχtəχ kˈilumiətər pˈər ˈyːr"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["35 mm"],
            Some("fˈəif ˈɛn dˈɛrtəχ mˈəlimiətər"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["3 850 km²"],
            Some("drˈi ˈaχt ɦˈɔndərt ˈɛn fˈəiftəχ fˈirkantə kˈilumiətər"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["93%"],
            Some("drˈi ˈɛn nˈiəχəntəχ pərsˈɛnt"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["£27 miljoen"],
            Some("sˈiəvə ˈɛn twˈəntəχ məljˈun pˈɔnt"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["$2.3 biljoen"],
            Some("twˈiə kˈɔma drˈi bəljˈun dˈɔlər"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["+30°C"],
            Some("plˈœs dˈɛrtəχ χrˈɑːdə sˈəlsiœs"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["Qatar Airways &amp; Turkish Airlines"],
            Some("kˈɑːtar ˈɑːərvaəis ˈɛn tˈœrkəsɦ ˈɑːərlinəs"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["B&amp;B"],
            Some("bˈiə ˈɛn bˈiə"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["1/5 duim"],
            Some("ˈiən fˈəifdə dˈœym"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["Wêreld Oorlog II"],
            Some("twˈiədə vˈɛːrəltuərlɔχ"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["Wêreldoorlog II"],
            Some("twˈiədə vˈɛːrəltuərlɔχ"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["Wêreld Oorlog I"],
            Some("ˈiərstə vˈɛːrəltuərlɔχ"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["'n Avenger myn skip"],
            Some("ə ˈɑːfəŋər mˈəin skˈəp"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["’n Avenger myn skip"],
            Some("ə ˈɑːfəŋər mˈəin skˈəp"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["‘n Avenger myn skip"],
            Some("ə ˈɑːfəŋər mˈəin skˈəp"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["ʼn Avenger myn skip"],
            Some("ə ˈɑːfəŋər mˈəin skˈəp"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["ń Avenger myn skip"],
            Some("ə ˈɑːfəŋər mˈəin skˈəp"),
        ),
        ("normalizeAfrikaans", &["‘nuwe’ idee"], Some("‘nuwe’ idee")),
        (
            "normalizeAfrikaans",
            &["'n Chinese skip"],
            Some("'n Chinese skip"),
        ),
        (
            "normalizeAfrikaans",
            &["323 v.C."],
            Some("323 voor Christus."),
        ),
        ("normalizeAfrikaans", &["356 VC"], Some("356 voor Christus")),
        (
            "normalizeAfrikaans",
            &["5 000 v. C."],
            Some("5 000 voor Christus."),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["6.34 duim"],
            Some("sˈɛs kˈɔma drˈi fˈir dˈœym"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["3.50-meter"],
            Some("drˈi kˈɔma fˈəif nˈœl mˈiətər"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["15.00 GUT"],
            Some("fˈəiftin χˈœt"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["4:41.30"],
            Some("fˈir , ˈiən ˈɛn fˈiərtəχ kˈɔma drˈi nˈœl"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["9:30 vm"],
            Some("nˈiəχə dˈɛrtəχ fˈuərmədaχ"),
        ),
        ("getPhonemizer(\"af\").text", &["10nm"], Some("tˈin nm")),
        (
            "normalizeAfrikaans",
            &["11De Hussars"],
            Some("elfde Hussars"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["12,5 kilometer"],
            Some("twˈɑːlf kˈɔma fˈəif kˈilumiətər"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["3,5 miljoen"],
            Some("drˈi kˈɔma fˈəif məljˈun"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["In 1990, 5 mense"],
            Some("ˈən dˈœysənt nˈiəχə ɦˈɔndərt ˈɛn nˈiəχəntəχ , fˈəif mˈɛnsə"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["12.5km"],
            Some("twˈɑːlf kˈɔma fˈəif kˈilumiətər"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["802.11n"],
            Some("ˈaχt ɦˈɔndərt ˈɛn twˈiə pˈœnt ˈɛlf ˈɛn"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["Figuur 1.1"],
            Some("fiχˈyːr ˈiən pˈœnt ˈiən"),
        ),
        ("numberToWords", &["1000000"], Some("een miljoen")),
        (
            "numberToWords",
            &["1500000"],
            Some("een miljoen vyf honderd duisend"),
        ),
        ("numberToWords", &["1000"], Some("duisend")),
        ("numberToWords", &["2000000"], Some("twee miljoen")),
        (
            "getPhonemizer(\"af\").text",
            &["133 m/s"],
            Some("ɦˈɔndərt ˈɛn drˈi ˈɛn dˈɛrtəχ mˈiətər pˈər səkˈɔndə"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["5 m³"],
            Some("fˈəif kˈyːbikə mˈiətər"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["±5"],
            Some("plˈœs ˈɔf mˈinœs fˈəif"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["3 = 3"],
            Some("drˈi χəlˈəik ˈɑːn drˈi"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["3 × 4"],
            Some("drˈi kˈiər fˈir"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["8 ÷ 2"],
            Some("ˈaχt χədˈiəl dˈøːr twˈiə"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["4 < 5"],
            Some("fˈir klˈəinər ˈas fˈəif"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["Jan & Piet"],
            Some("jˈan ˈɛn pˈit"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["1/2 duim"],
            Some("ˈiən ɦˈalf dˈœym"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["3/2 koppies"],
            Some("drˈi ɦˈɑːlvə kˈɔpis"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["om mnr. Reid te meet"],
            Some("ˈɔm mənˈiər rˈəit tˈə mˈiət"),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["Mnr. Blake was hier."],
            Some("mənˈiər blˈɑːkə vˈas ɦˈir ."),
        ),
        (
            "getPhonemizer(\"af\").text",
            &["Die Dromaeosauridae is groot."],
            Some("dˈi drˈuəmaəusœuridaə ˈəs χrˈuət ."),
        ),
        (
            "phonemizeAfNeural",
            &["Die man loop huis toe."],
            Some("dˈi mˈan lˈuəp ɦˈœys tˈu ."),
        ),
        (
            "phonemize",
            &["Die man loop huis toe.", "af"],
            Some("dˈi mˈan lˈuəp ɦˈœys tˈu ."),
        ),
        (
            "phonemizeAfNeural",
            &["Ek het 100 boeke."],
            Some("ˈɛk ɦˈɛt ɦˈɔndərt bˈukə ."),
        ),
        (
            "phonemize",
            &["Ek het 100 boeke.", "af"],
            Some("ˈɛk ɦˈɛt ɦˈɔndərt bˈukə ."),
        ),
        (
            "phonemizeAfNeural",
            &["Dit is 12,5 kilometer."],
            Some("dˈət ˈəs twˈɑːlf kˈɔma fˈəif kˈilumiətər ."),
        ),
        (
            "phonemize",
            &["Dit is 12,5 kilometer.", "af"],
            Some("dˈət ˈəs twˈɑːlf kˈɔma fˈəif kˈilumiətər ."),
        ),
        (
            "phonemizeAfNeural",
            &["Dit is 'n boek."],
            Some("dˈət ˈəs ə bˈuk ."),
        ),
        (
            "phonemize",
            &["Dit is 'n boek.", "af"],
            Some("dˈət ˈəs ə bˈuk ."),
        ),
        (
            "phonemizeAfNeural",
            &["Vitamien C is goed."],
            Some("fitamˈin sˈiə ˈəs χˈut ."),
        ),
        (
            "phonemize",
            &["Vitamien C is goed.", "af"],
            Some("fitamˈin sˈiə ˈəs χˈut ."),
        ),
        (
            "phonemizeAfNeural",
            &["Die reënwater is groot."],
            Some("dˈi rˈiənvɑːtər ˈəs χrˈuət ."),
        ),
        (
            "phonemizeAfNeural",
            &["Die reënwater is groot."],
            Some("dˈi rˈiənvɑːtər ˈəs χrˈuət ."),
        ),
        (
            "afrikaansLexiconHas",
            &["kwantumverstrengeling"],
            Some("false"),
        ),
        (
            "afrikaansLexiconHas",
            &["rekenaarwetenskaplike"],
            Some("false"),
        ),
        (
            "phonemizeAfNeural",
            &["Die rekenaarwetenskaplike werk."],
            Some("dˈi rˈiəkənɑːrviətənskapləkə vˈɛrk ."),
        ),
        (
            "phonemize",
            &["Die rekenaarwetenskaplike werk.", "af"],
            Some("dˈi rˈiəkənɑːrvətənskaplikə vˈɛrk ."),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_afrikaans().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString, n: usize| -> Option<JsString> {
            match f {
                "phonemizeWordRules" => Some(e.phonemize_word_rules(&a(0))),
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeAfrikaans" => Some(e.normalize(&a(0))),
                "ordinalWord" => e.ordinal_word(js_number(&a(0))),
                "numberToWords" => {
                    Some(e.number_to_words(js_number(&a(0)), (n > 1).then(|| a(1)).as_ref()))
                }
                "afrikaansLexiconHas" => Some(js(if e.lexicon_has(&a(0)) {
                    "true"
                } else {
                    "false"
                })),
                "createAfrikaans().text" => Some(e.text(&a(0), None)),
                "getPhonemizer(\"af\").text" => {
                    Some(crate::registry::phonemize_in("af", &a(0)).unwrap())
                }
                "phonemizeAfNeural" => Some(
                    super::super::afrikaans_neural::phonemize_af_neural(
                        &e,
                        super::super::afrikaans_tagger::afrikaans_tagger(),
                        &a(0),
                    )
                    .unwrap(),
                ),
                "phonemize" => Some(js(&crate::phonemize(
                    &a(0).to_string_lossy(),
                    &a(1).to_string_lossy(),
                )
                .unwrap())),
                _ => panic!("no replay for {f}"),
            }
        };
        for (f, args, want) in TS_SUITE_CALLS {
            let a = |i: usize| js(args[i]);
            let got: Option<String> = call(f, &a, args.len()).map(|s| s.to_string_lossy());
            assert_eq!(got.as_deref(), *want, "{f}{args:?}");
        }
    }
}
