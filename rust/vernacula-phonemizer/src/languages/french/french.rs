//! The French (fr) engine: Lexique lexicon → (neural OOV override) → rule g2p, context heteronyms, liaison
//! looked up one word ahead across the flattened stream, and one phrase-final accent per rhythmic group.
//! Ported from src/languages/french/french.ts — see that file for the evidence behind each rule.

use std::collections::HashSet;
use std::sync::LazyLock;

use indexmap::IndexMap;

use super::g2p::to_ipa_loaded;
use super::manifest::{DIR, MANIFEST, try_manifest};
use super::normalize::{normalize_french_initialisms_loaded, normalize_french_loaded};
use super::numbers::number_to_words_loaded;
use super::ordinals::{
    normalize_french_ordinal_digits_loaded, normalize_french_ordinal_romans_loaded,
};
use crate::core::clauses::foreign_run;
use crate::core::foreign::read_foreign_run;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};
use crate::core::normalize_symbols::{
    BareExponent, ExponentWords, PositionDecl, SymbolData, SymbolNormalizer, make_symbol_normalizer,
};
use crate::core::provenance::Span;
use crate::core::roman::{RomanPolicy, normalize_romans};
use crate::core::trace::{enter_engine, note_assembled, note_token};
use crate::js_re;

/// `OovResolver`: lowercased word → IPA, or `None` to defer to the rule g2p (the neural path only).
pub type OovResolver<'a> = &'a dyn Fn(&JsString) -> Option<JsString>;

const CLITIC: [&str; 13] = [
    "ne", "se", "me", "te", "nous", "vous", "le", "la", "les", "lui", "leur", "y", "en",
];

const NUMBER_WORD: [&str; 27] = [
    "zéro",
    "un",
    "une",
    "deux",
    "trois",
    "quatre",
    "cinq",
    "six",
    "sept",
    "huit",
    "neuf",
    "dix",
    "onze",
    "douze",
    "treize",
    "quatorze",
    "quinze",
    "seize",
    "vingt",
    "trente",
    "quarante",
    "cinquante",
    "soixante",
    "cent",
    "mille",
    "million",
    "milliard",
];

fn among(list: &[impl AsRef<str>], w: &JsString) -> bool {
    list.iter().any(|x| *w == x.as_ref())
}

/// `heteronymIpa(word, prev, prev2, next)`. The neighbours are built only for a word that has an entry.
fn heteronym_ipa(
    word: &JsString,
    neighbour: &dyn Fn(isize) -> Option<JsString>,
) -> Option<JsString> {
    let entry = MANIFEST.heteronyms.get(&word.to_string_lossy())?;
    let (prev, prev2, next) = (neighbour(-1), neighbour(-2), neighbour(1));
    let (prev, prev2, next) = (prev.as_ref(), prev2.as_ref(), next.as_ref());
    for c in &entry.cases {
        if c.next_is_number == Some(true) && next.is_some_and(|n| among(&NUMBER_WORD, n)) {
            return Some(js(&c.ipa));
        }
        if let (Some(cn), Some(n)) = (&c.next, next) {
            if among(cn, n) {
                return Some(js(&c.ipa));
            }
        }
        if let (Some(cp), Some(p)) = (&c.prev, prev) {
            if among(cp, p) {
                return Some(js(&c.ipa));
            }
            if among(&CLITIC, p) && prev2.is_some_and(|p2| among(cp, p2)) {
                return Some(js(&c.ipa));
            }
        }
    }
    None
}

fn vowel_ipa() -> &'static JsRegex {
    js_re!("[aeiouyɛɔøœəɑ]")
}

fn accent_final(tokens: &mut [JsString]) {
    for k in (0..tokens.len()).rev() {
        let t = &tokens[k];
        if !vowel_ipa().test(t) {
            continue;
        }
        let last = js_re!("[aeiouyɛɔøœəɑ]", "g")
            .match_all(t)
            .last()
            .unwrap()
            .index();
        tokens[k] = t
            .slice(0, Some(last as isize))
            .concat(&js("ˈ"))
            .concat(&t.slice(last as isize, None));
        return;
    }
}

static H_ASPIRE: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.h_aspire.iter().map(|w| js(w)).collect());

fn liaison_onto(prev: &JsString, next: &JsString) -> JsString {
    let Some(c) = MANIFEST
        .liaison
        .get(&prev.to_lower_case().to_string_lossy())
        .filter(|c| !c.is_empty())
    else {
        return JsString::new();
    };
    let nx = next.to_lower_case();
    let aspire =
        H_ASPIRE.contains(&nx) || H_ASPIRE.contains(&js_re!("s$").replace(&nx, &JsString::new()));
    if js_re!("^[aeiouyàâäéèêëîïôöûüùœæh]", "i").test(&nx) && !aspire {
        js(c)
    } else {
        JsString::new()
    }
}

fn strip_latent(ipa: &JsString, c: &JsString) -> JsString {
    let re = match c.to_string_lossy().as_str() {
        "z" => js_re!("[sz]$"),
        "t" => js_re!("[td]$"),
        "n" => js_re!("n$"),
        _ => return ipa.clone(),
    };
    if re.test(ipa) {
        ipa.slice(0, Some(-1))
    } else {
        ipa.clone()
    }
}

fn token_re() -> &'static JsRegex {
    js_re!(
        r"([a-zà-ÿœæ]+(?:[-'’][a-zà-ÿœæ]+)*)|(\d+(?:[.,]\d+)?)|([.!?…,;:])",
        "giu"
    )
}

#[derive(Clone)]
struct Src {
    span: Span,
    surface: JsString,
}

enum Kind {
    Word(JsString),
    Pause(JsString),
    Ipa(JsString),
}

struct Item {
    kind: Kind,
    src: Option<Src>,
}

struct Traced {
    span: Span,
    surface: JsString,
    emitted: Vec<JsString>,
    at: Span,
}

pub struct FrenchPhonemizer {
    lexicon: IndexMap<JsString, JsString>,
    supplement: IndexMap<JsString, JsString>,
    symbols: SymbolNormalizer,
}

/// `createFrench()`: loads the manifest, the Lexique lexicon and the supplement, or says why it cannot.
pub fn create_french() -> Result<FrenchPhonemizer, String> {
    try_manifest()?;
    let lexicon =
        load_tsv_strings(DIR, "lexicon.tsv", TsvOptions::default()).map_err(|e| e.to_string())?;
    let supplement = load_tsv_strings(DIR, "supplement.tsv", TsvOptions::default())
        .map_err(|e| e.to_string())?;
    Ok(FrenchPhonemizer {
        lexicon,
        supplement,
        symbols: build_symbols()?,
    })
}

impl FrenchPhonemizer {
    /// `frenchLexicon().has(lower)`.
    pub fn lexicon_has(&self, lower: &JsString) -> bool {
        self.lexicon.contains_key(lower)
    }

    /// `frenchHasWord(lower)`: Lexique or the supplement, the neural pre-pass's skip test (#1463).
    pub fn has_word(&self, lower: &JsString) -> bool {
        self.lexicon.contains_key(lower) || self.supplement.contains_key(lower)
    }

    /// `phonemizeWord(word, oovOverride?)`: lexicon, supplement, the override, then a hyphenated compound
    /// part by part, then the rule g2p.
    pub fn phonemize_word(&self, word: &JsString, oov: Option<OovResolver>) -> JsString {
        let lower = word.to_lower_case();
        let direct = self
            .lexicon
            .get(&lower)
            .or_else(|| self.supplement.get(&lower))
            .cloned()
            .or_else(|| oov.and_then(|f| f(&lower)));
        if let Some(d) = direct {
            return d;
        }
        if lower.includes(&js("-")) {
            let parts: Vec<JsString> = lower
                .split(&js("-"))
                .into_iter()
                .filter(|p| !p.is_empty())
                .collect();
            if parts.len() > 1 {
                let read: Vec<JsString> =
                    parts.iter().map(|p| self.phonemize_word(p, oov)).collect();
                return JsString::join(&read, &JsString::new());
            }
        }
        to_ipa_loaded(word)
    }

    fn normalize_numerals(&self, text: &JsString) -> JsString {
        let s = normalize_french_ordinal_romans_loaded(text, &|w| self.lexicon.contains_key(w));
        normalize_romans(
            &normalize_french_ordinal_digits_loaded(&s),
            &RomanPolicy::default(),
        )
    }

    /// `normalizedFor(input)`: every normalization pass, and nothing after.
    pub fn normalized_for(&self, input: &JsString) -> JsString {
        let is_word = |w: &JsString| self.lexicon.contains_key(w);
        self.symbols.apply(&normalize_french_initialisms_loaded(
            &self.normalize_numerals(&normalize_french_loaded(input)),
            &is_word,
        ))
    }

    /// `text(input, oovOverride?)`.
    pub fn text(&self, input: &JsString, oov: Option<OovResolver>) -> JsString {
        self.text_normalized(&self.normalized_for(input), oov)
    }

    /// `text(input, oovOverride, preNormalized: true)`: `input` has already been through `normalized_for`.
    pub fn text_normalized(&self, input: &JsString, oov: Option<OovResolver>) -> JsString {
        let input = input.clone();
        enter_engine(&input);

        let mut items: Vec<Item> = Vec::new();
        let mut gap_cursor = 0usize;
        let claim_gap = |upto: usize, gap_cursor: &mut usize, items: &mut Vec<Item>| {
            if upto > *gap_cursor {
                let gap = input.slice(*gap_cursor as isize, Some(upto as isize));
                for g in foreign_run().match_all(&gap) {
                    let surface = g.value(&gap);
                    let ipa = read_foreign_run(&surface);
                    let at = *gap_cursor + g.index();
                    if let Some(ipa) = ipa.filter(|i| !i.is_empty()) {
                        items.push(Item {
                            kind: Kind::Ipa(ipa),
                            src: Some(Src {
                                span: (at, at + surface.len()),
                                surface,
                            }),
                        });
                    }
                }
            }
            *gap_cursor = upto;
        };
        for m in token_re().match_all(&input) {
            claim_gap(m.index(), &mut gap_cursor, &mut items);
            let tok_at = m.index();
            gap_cursor = m.end();
            let src = Src {
                span: (tok_at, gap_cursor),
                surface: m.value(&input),
            };
            let word = |w: JsString| Item {
                kind: Kind::Word(w),
                src: Some(src.clone()),
            };
            if let Some(w) = m.group(1, &input).filter(|g| !g.is_empty()) {
                items.push(word(w));
            } else if let Some(num) = m.group(2, &input).filter(|g| !g.is_empty()) {
                // `m[2].split(/[.,]/)`: the class matches one separator at most.
                let sep = num
                    .0
                    .iter()
                    .position(|&u| u == b'.' as u16 || u == b',' as u16);
                let (int_part, frac) = match sep {
                    None => (num.clone(), None),
                    Some(p) => (
                        num.slice(0, Some(p as isize)),
                        Some(num.slice(p as isize + 1, None)),
                    ),
                };
                for w in
                    number_to_words_loaded(js_number(&int_part), Some(&int_part)).split(&js(" "))
                {
                    items.push(word(w));
                }
                if let Some(frac) = frac {
                    items.push(word(js(&MANIFEST.numbers.decimal_separator)));
                    let as_number = frac.len() <= 3 && !frac.starts_with(&js("0"));
                    let parts: Vec<JsString> = if as_number {
                        number_to_words_loaded(js_number(&frac), Some(&frac)).split(&js(" "))
                    } else {
                        frac.code_point_strings()
                            .iter()
                            .flat_map(|d| {
                                number_to_words_loaded(js_number(d), None).split(&js(" "))
                            })
                            .collect()
                    };
                    for w in parts {
                        items.push(word(w));
                    }
                }
            } else if let Some(p) = m.group(3, &input).filter(|g| !g.is_empty()) {
                if let Some(mk) = MANIFEST
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|k| !k.is_empty())
                {
                    items.push(Item {
                        kind: Kind::Pause(js(mk)),
                        src: Some(src.clone()),
                    });
                }
            }
        }
        claim_gap(input.len(), &mut gap_cursor, &mut items);

        let mut group: Vec<JsString> = Vec::new();
        let mut group_src: Vec<Option<Src>> = Vec::new();
        let mut out = JsString::new();
        let mut carry = JsString::new();
        let mut traced: IndexMap<Span, Traced> = IndexMap::new();
        let flush = |pause: Option<&JsString>,
                     group: &mut Vec<JsString>,
                     group_src: &mut Vec<Option<Src>>,
                     out: &mut JsString,
                     traced: &mut IndexMap<Span, Traced>| {
            if !group.is_empty() {
                accent_final(group);
                let mut off = out.len() + if out.is_empty() { 0 } else { 1 };
                for (gi, piece) in group.iter().enumerate() {
                    let at = (off, off + piece.len());
                    off += piece.len() + 1;
                    let Some(sc) = &group_src[gi] else { continue };
                    match traced.get_mut(&sc.span) {
                        Some(b) => {
                            b.emitted.push(piece.clone());
                            b.at = (b.at.0.min(at.0), b.at.1.max(at.1));
                        }
                        None => {
                            traced.insert(
                                sc.span,
                                Traced {
                                    span: sc.span,
                                    surface: sc.surface.clone(),
                                    emitted: vec![piece.clone()],
                                    at,
                                },
                            );
                        }
                    }
                }
                if !out.is_empty() {
                    out.push_str(&js(" "));
                }
                out.push_str(&JsString::join(group, &js(" ")));
                group.clear();
                group_src.clear();
            }
            if let Some(p) = pause.filter(|p| !p.is_empty()) {
                out.push_str(&js(" "));
                out.push_str(p);
            }
        };
        let neighbour = |j: isize| -> Option<JsString> {
            if j < 0 {
                return None;
            }
            match items.get(j as usize).map(|n| &n.kind) {
                Some(Kind::Word(w)) => Some(w.to_lower_case()),
                _ => None,
            }
        };
        for k in 0..items.len() {
            let it = &items[k];
            match &it.kind {
                Kind::Pause(p) => {
                    carry = JsString::new();
                    if !group.is_empty() || !out.is_empty() {
                        flush(Some(p), &mut group, &mut group_src, &mut out, &mut traced);
                    }
                }
                Kind::Ipa(ipa) => {
                    carry = JsString::new();
                    group.push(ipa.clone());
                    group_src.push(it.src.clone());
                }
                Kind::Word(w) => {
                    let w_lower = w.to_lower_case();
                    let het = heteronym_ipa(&w_lower, &|d| neighbour(k as isize + d));
                    let read = het.clone().unwrap_or_else(|| self.phonemize_word(w, oov));
                    let mut ipa = carry.concat(&read);
                    carry = JsString::new();
                    if let Some(Item {
                        kind: Kind::Word(nw),
                        ..
                    }) = items.get(k + 1)
                    {
                        if het.is_none() {
                            carry = liaison_onto(w, nw);
                            if !carry.is_empty() {
                                ipa = strip_latent(&ipa, &carry);
                            }
                        }
                    }
                    if !ipa.is_empty() {
                        group.push(ipa);
                        group_src.push(it.src.clone());
                    }
                }
            }
        }
        flush(None, &mut group, &mut group_src, &mut out, &mut traced);
        for t in traced.values() {
            note_token(t.span, &t.surface, &t.emitted, None, Some(t.at), None);
        }
        note_assembled(&out);
        out
    }
}

/// `SYMBOLS`: the shared tier configured from `MANIFEST.symbolTier`, with exactly the fields french.ts passes.
fn build_symbols() -> Result<SymbolNormalizer, String> {
    let t = &MANIFEST.symbol_tier;
    make_symbol_normalizer(&SymbolData {
        percent: Some(t.percent.clone()),
        currency: Some(t.currency.clone()),
        units: Some(t.units.clone()),
        exponent_words: Some(ExponentWords {
            squared: Some(t.exponent_words.squared.clone()),
            cubed: Some(t.exponent_words.cubed.clone()),
            position: t.exponent_words.position.map(PositionDecl::All),
        }),
        bare_exponent: Some(BareExponent {
            squared: Some(t.bare_exponent.squared.clone()),
            cubed: Some(t.bare_exponent.cubed.clone()),
            power: Some(t.bare_exponent.power.clone()),
            negative: Some(t.bare_exponent.negative.clone()),
        }),
        magnitudes: Some(t.magnitudes.clone()),
        magnitude_connective: Some(t.magnitude_connective.clone()),
        ampersand: Some(t.ampersand.clone()),
        multiply: Some(t.multiply.clone()),
        ..Default::default()
    })
}
