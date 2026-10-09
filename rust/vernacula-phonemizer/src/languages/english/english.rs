//! The English (General American) engine: lexicon, heteronyms by POS, the OOV G2P, numbers, clause
//! stress. Ported from src/languages/english/english.ts — see that file for the evidence behind each rule.

use std::collections::HashSet;

use indexmap::IndexMap;

use super::english_arpabet::make_arpabet_to_ipa;
use super::english_g2p::{EnglishG2p, EnglishG2pModel, G2pClasses};
use super::manifest::{DIR, HeteronymEntry, try_manifest};
use super::normalize::{normalize_english, normalize_english_initialisms};
use super::numbers::{BigNat, number_to_words, ordinal_to_words};
use super::pos_tagger::{
    PosExpectation, PosModel, PosTagger, heads_object_phrase, pos_expectation,
};
use super::spelling_variants::american_spelling;
use crate::core::clauses::foreign_run;
use crate::core::foreign::read_foreign_run;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_manifest::load_json;
use crate::core::load_tsv::{TsvOptions, load_lines, load_tsv_map};
use crate::core::provenance::{Form, Span, normalize};
use crate::core::trace::{TokenSource, enter_engine, note_assembled, note_token};
use crate::core::unicode::fold_latin_diacritics;
use crate::js_re;

fn sibilant_allomorph(ipa: &JsString) -> &'static str {
    let nfc = normalize(ipa, Form::Nfc);
    let chars: Vec<JsString> = code_point_strings(&nfc);
    let mut i = chars.len() as isize - 1;
    while i >= 0 && js_re!("[̀-ͯːˈˌ‿ᶦᶷʰʲ]", "u").test(&chars[i as usize]) {
        i -= 1;
    }
    let last = if i >= 0 {
        chars[i as usize].clone()
    } else {
        JsString::new()
    };
    // `"szʃʒ".includes(last)`: true for the empty string.
    if js("szʃʒ").includes(&last) {
        return "ᵻz";
    }
    if js("ptkfθ").includes(&last) {
        return "s";
    }
    "z"
}

/// `[...s]`: one string per code point.
fn code_point_strings(s: &JsString) -> Vec<JsString> {
    let mut out = Vec::new();
    let mut i = 0;
    while i < s.len() {
        let w = if s.code_point_at(i).unwrap() > 0xFFFF {
            2
        } else {
            1
        };
        out.push(JsString::from_units(&s.0[i..i + w]));
        i += w;
    }
    out
}

fn is_voicing_heteronym(het: &HeteronymEntry) -> bool {
    let Some(marked) = het
        .verb
        .as_ref()
        .or(het.noun.as_ref())
        .or(het.past.as_ref())
    else {
        return false;
    };
    let strip = |s: &str| {
        let d = js_re!("[̀-ͯ]", "gu").replace(&normalize(&js(s), Form::Nfd), &JsString::new());
        js_re!("[ˈˌː]", "g").replace(&d, &JsString::new())
    };
    let (a, b) = (strip(&het.default), strip(marked));
    a.len() == b.len()
        && !a.is_empty()
        && a.slice(0, Some(-1)) == b.slice(0, Some(-1))
        && a.slice(-1, None) != b.slice(-1, None)
}

fn promote_first_vowel(ipa: &JsString) -> JsString {
    match js_re!("[aeiouɪʊɛɔəɐæɑɒʌɝɚɜɨʉ]", "u").exec(ipa) {
        None => ipa.clone(),
        Some(m) => ipa
            .slice(0, Some(m.index() as isize))
            .concat(&js("ˈ"))
            .concat(&ipa.slice(m.index() as isize, None)),
    }
}

fn creole_citation(ipa: &JsString) -> JsString {
    let a = js_re!(r"(\S)̩", "gu").replace(ipa, &js("ə$1"));
    js_re!(r"̆", "gu").replace(&a, &JsString::new())
}

enum Token {
    Word {
        text: JsString,
        span: Span,
    },
    Number {
        text: JsString,
        ordinal: bool,
        span: Span,
    },
    Clause {
        text: JsString,
        span: Span,
    },
    Foreign {
        ipa: JsString,
        span: Span,
        surface: JsString,
    },
}

fn token_re() -> &'static crate::core::js_regex::JsRegex {
    js_re!(
        r"(\d+(?:(?<!(?<!\d)0),\d+)*(?:\.\d+)?)(st|nd|rd|th)?|(\p{Script=Latin}[\p{Script=Latin}\p{M}]*(?:['’]\p{Script=Latin}[\p{Script=Latin}\p{M}]*)*['’]?)|([.?!,;:])",
        "gu"
    )
}

/// An OOV override: the neural tagger's reading for a g2p key, or `None` to fall through.
pub type OovOverride<'a> = &'a dyn Fn(&JsString) -> Option<JsString>;
/// en-GB's per-word rewrite of the American reading.
pub type WordTransform<'a> = &'a dyn Fn(&JsString, &JsString) -> JsString;

pub struct EnglishPhonemizer {
    lexicon: IndexMap<JsString, JsString>,
    heteronyms: IndexMap<JsString, HeteronymEntry>,
    g2p: EnglishG2p,
    tagger: PosTagger,
    unstressed: HashSet<JsString>,
    clause_punctuation: IndexMap<JsString, JsString>,
    non_tonic_final: HashSet<JsString>,
    wh_secondary: HashSet<JsString>,
    clause_initial_stressed: IndexMap<JsString, JsString>,
}

struct NumWord {
    text: JsString,
    reduced: bool,
}

struct Unit {
    words: Vec<NumWord>,
    span: Span,
    surface: JsString,
    clause: Option<JsString>,
    foreign: Option<JsString>,
}

struct Item {
    word: JsString,
    citation: JsString,
    reduced: bool,
    display: JsString,
    span: Span,
    surface: JsString,
    tier: TokenSource,
}

struct Traced {
    span: Span,
    surface: JsString,
    emitted: Vec<JsString>,
    parts: Vec<usize>,
    tier: Option<TokenSource>,
    disagreed: bool,
}

impl EnglishPhonemizer {
    pub fn lexicon(&self) -> &IndexMap<JsString, JsString> {
        &self.lexicon
    }

    pub fn has_word(&self, word: &JsString) -> bool {
        let lower = word.to_lower_case();
        if self.lexicon.contains_key(&lower) || self.heteronyms.contains_key(&lower) {
            return true;
        }
        american_spelling(&lower, &|w| self.lexicon.contains_key(w)).is_some()
    }

    pub fn known_word(&self, word: &JsString) -> Option<JsString> {
        let lower = word.to_lower_case();
        let direct = self
            .lexicon
            .get(&lower)
            .cloned()
            .or_else(|| self.heteronyms.get(&lower).map(|h| js(&h.default)));
        if let Some(d) = direct {
            return Some(creole_citation(&d));
        }
        let american = american_spelling(&lower, &|w| self.lexicon.contains_key(w))?;
        self.lexicon.get(&american).map(creole_citation)
    }

    pub fn normalized_for(&self, input: &JsString) -> JsString {
        normalize_english_initialisms(&normalize_english(input), &|w| self.lexicon.contains_key(w))
    }

    pub fn text_with_oov(&self, input: &JsString, oov: OovOverride) -> JsString {
        self.text_full(input, None, Some(oov), false)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        self.text_full(input, None, None, false)
    }

    fn resolve_word(
        &self,
        word: &JsString,
        e: Option<&PosExpectation>,
        oov: Option<OovOverride>,
    ) -> (JsString, TokenSource) {
        let lower =
            js_re!("’", "gu").replace(&fold_latin_diacritics(&word.to_lower_case()), &js("'"));
        let mut het = self.heteronyms.get(&lower);
        let mut plural_allomorph = false;
        if het.is_none() {
            let base = if lower.ends_with(&js("es"))
                && self.heteronyms.contains_key(&lower.slice(0, Some(-2)))
            {
                Some(lower.slice(0, Some(-2)))
            } else if lower.ends_with(&js("s"))
                && lower.len() > 1
                && self.heteronyms.contains_key(&lower.slice(0, Some(-1)))
            {
                Some(lower.slice(0, Some(-1)))
            } else {
                None
            };
            if let Some(cand) = base.and_then(|b| self.heteronyms.get(&b)) {
                if !is_voicing_heteronym(cand) {
                    het = Some(cand);
                    plural_allomorph = true;
                }
            }
        }
        if let Some(het) = het {
            // `(e?.past && het.past) || …`: an empty reading is falsy and falls through.
            let pick = |want: bool, v: &Option<String>| {
                if want {
                    v.clone().filter(|s| !s.is_empty())
                } else {
                    None
                }
            };
            let e = e.copied().unwrap_or(PosExpectation {
                verb: false,
                noun: false,
                past: false,
                adj: false,
            });
            let mut ipa = js(&pick(e.past, &het.past)
                .or_else(|| pick(e.verb, &het.verb))
                .or_else(|| pick(e.adj, &het.adj))
                .or_else(|| pick(e.noun, &het.noun))
                .unwrap_or_else(|| het.default.clone()));
            if plural_allomorph {
                let suffix = sibilant_allomorph(&ipa);
                ipa.push_str(&js(suffix));
            }
            return (ipa, TokenSource::Heteronym);
        }
        let mut lookup_key = lower.clone();
        let mut poss_allomorph = false;
        if lower.ends_with(&js("'s")) && lower.len() > 2 {
            lookup_key = lower.slice(0, Some(-2));
            poss_allomorph = true;
        } else if lower.ends_with(&js("'"))
            && lower.len() > 2
            && lower.char_at(lower.len() - 2) == "s"
        {
            lookup_key = lower.slice(0, Some(-1));
        }
        let mut over = self.lexicon.get(&lookup_key).cloned();
        if over.is_none() && js_re!("^[a-z']+$").test(&lookup_key) {
            if let Some(american) =
                american_spelling(&lookup_key, &|w| self.lexicon.contains_key(w))
            {
                over = self.lexicon.get(&american).cloned();
            }
        }
        let mut source = TokenSource::Lexicon;
        let mut over = match over {
            Some(o) => o,
            None => {
                let g2p_key = js_re!("'", "g").replace(&lookup_key, &JsString::new());
                if let Some(tagged) = oov.and_then(|f| f(&g2p_key)) {
                    source = TokenSource::Tagger;
                    tagged
                } else if js_re!("^[a-z]+$").test(&g2p_key) {
                    source = TokenSource::G2p;
                    self.g2p.g2p(&g2p_key)
                } else {
                    source = TokenSource::Passthrough;
                    g2p_key
                }
            }
        };
        if poss_allomorph {
            let suffix = sibilant_allomorph(&over);
            over.push_str(&js(suffix));
        }
        (over, source)
    }

    fn pos_expectations(&self, words: &[JsString], break_after: &[bool]) -> Vec<PosExpectation> {
        let tags = self.tagger.tag(words);
        let tag_at = |i: usize| tags.get(i).map_or("", |t| t.as_str());
        let mut out: Vec<PosExpectation> = tags.iter().map(|t| pos_expectation(t)).collect();
        for i in 0..out.len() {
            if out[i].adj && !tag_at(i + 1).starts_with("NN") {
                out[i].adj = false;
            }
        }
        for i in 0..out.len() {
            let Some(before) = self
                .heteronyms
                .get(&words[i].to_lower_case())
                .and_then(|h| h.before.as_ref())
            else {
                continue;
            };
            let next = words
                .get(i + 1)
                .map_or_else(JsString::new, |w| w.to_lower_case());
            let lo = i.saturating_sub(3);
            let fires = next == before.word.as_str()
                && break_after.get(i) != Some(&true)
                && before.when.iter().any(|alt| {
                    alt.tags
                        .as_ref()
                        .is_none_or(|t| t.iter().any(|x| x == tag_at(i)))
                        && alt
                            .next_tags
                            .as_ref()
                            .is_none_or(|t| t.iter().any(|x| x == tag_at(i + 1)))
                        && alt.after_words.as_ref().is_none_or(|aw| {
                            words[lo..i].iter().enumerate().any(|(k, w)| {
                                let lw = w.to_lower_case();
                                aw.iter().any(|a| lw == a.as_str())
                                    && !break_after.get(lo + k..i).unwrap_or(&[]).contains(&true)
                            })
                        })
                });
            match before.slot.as_str() {
                "verb" => out[i].verb = fires,
                "noun" => out[i].noun = fires,
                "past" => out[i].past = fires,
                "adj" => out[i].adj = fires,
                other => panic!("heteronym slot {other:?}"),
            }
        }
        let heads_np = |t: &str| t == "DT" || t == "PDT" || t == "PRP$" || t.starts_with("JJ");
        for i in 0..out.len() {
            if tag_at(i) == "VBN"
                && tag_at(i + 1).starts_with("NN")
                && (i == 0 || heads_np(tag_at(i - 1)))
            {
                out[i] = PosExpectation {
                    verb: false,
                    past: false,
                    adj: true,
                    ..out[i]
                };
            }
        }
        if out.len() > 1 && !out[0].verb && heads_object_phrase(tag_at(1)) {
            out[0] = PosExpectation {
                verb: true,
                noun: false,
                past: false,
                adj: false,
            };
        }
        out
    }

    /// `text(input, wordTransform?, oovOverride?, preNormalized?)`.
    pub fn text_full(
        &self,
        input: &JsString,
        word_transform: Option<WordTransform>,
        oov: Option<OovOverride>,
        pre_normalized: bool,
    ) -> JsString {
        let input = if pre_normalized {
            input.clone()
        } else {
            self.normalized_for(input)
        };
        enter_engine(&input);
        let mut tokens: Vec<Token> = Vec::new();
        let mut gap_cursor = 0;
        let claim_gap = |upto: usize, gap_cursor: &mut usize, tokens: &mut Vec<Token>| {
            if upto > *gap_cursor {
                let gap = JsString::from_units(&input.0[*gap_cursor..upto]);
                for g in foreign_run().match_all(&gap) {
                    let surface = g.value(&gap);
                    let ipa = read_foreign_run(&surface);
                    let at = *gap_cursor + g.index();
                    if let Some(ipa) = ipa.filter(|i| !i.is_empty()) {
                        tokens.push(Token::Foreign {
                            ipa,
                            span: (at, at + surface.len()),
                            surface,
                        });
                    }
                }
            }
            *gap_cursor = upto;
        };
        // ⚠ The TS drives a module-level /g regex with `exec`; matchAll is the same walk (no empty matches).
        for m in token_re().match_all(&input) {
            claim_gap(m.index(), &mut gap_cursor, &mut tokens);
            gap_cursor = m.end();
            let span = (m.index(), m.end());
            if let Some(t) = m.group(1, &input) {
                tokens.push(Token::Number {
                    text: t,
                    ordinal: m.group(2, &input).is_some(),
                    span,
                });
            } else if let Some(t) = m.group(3, &input) {
                tokens.push(Token::Word { text: t, span });
            } else if let Some(t) = m.group(4, &input) {
                tokens.push(Token::Clause { text: t, span });
            }
        }
        claim_gap(input.len(), &mut gap_cursor, &mut tokens);

        let words_of = |n: Vec<String>| {
            n.into_iter()
                .map(|w| NumWord {
                    text: js(&w),
                    reduced: false,
                })
                .collect::<Vec<_>>()
        };
        let mut units: Vec<Unit> = Vec::new();
        for t in tokens {
            match t {
                Token::Clause { text, span } => {
                    if let Some(mk) = self.clause_punctuation.get(&text).filter(|m| !m.is_empty()) {
                        units.push(Unit {
                            words: Vec::new(),
                            span,
                            surface: text,
                            clause: Some(mk.clone()),
                            foreign: None,
                        });
                    }
                }
                Token::Foreign { ipa, span, surface } => {
                    units.push(Unit {
                        words: Vec::new(),
                        span,
                        surface,
                        clause: None,
                        foreign: Some(ipa),
                    });
                }
                Token::Word { text, span } => {
                    units.push(Unit {
                        words: vec![NumWord {
                            text: text.clone(),
                            reduced: false,
                        }],
                        span,
                        surface: text,
                        clause: None,
                        foreign: None,
                    });
                }
                Token::Number {
                    text,
                    ordinal,
                    span,
                } => {
                    let digits = |s: &JsString| s.to_string_lossy();
                    let dot = text.index_of(&js("."), 0);
                    let words = match dot {
                        Some(dot) => {
                            let int_part = js_re!(",", "g")
                                .replace(&text.slice(0, Some(dot as isize)), &JsString::new());
                            let int_part = if int_part.is_empty() {
                                js("0")
                            } else {
                                int_part
                            };
                            let mut w = words_of(number_to_words(
                                &BigNat::parse(&digits(&int_part)).unwrap(),
                            ));
                            w.push(NumWord {
                                text: js("point"),
                                reduced: true,
                            });
                            for d in code_point_strings(&text.slice((dot + 1) as isize, None)) {
                                let first = number_to_words(&BigNat::parse(&digits(&d)).unwrap())
                                    .swap_remove(0);
                                w.push(NumWord {
                                    text: js(&first),
                                    reduced: false,
                                });
                            }
                            w
                        }
                        None => {
                            let n = BigNat::parse(&digits(
                                &js_re!("[,.]", "g").replace(&text, &JsString::new()),
                            ))
                            .unwrap();
                            words_of(if ordinal {
                                ordinal_to_words(&n)
                            } else {
                                number_to_words(&n)
                            })
                        }
                    };
                    units.push(Unit {
                        words,
                        span,
                        surface: text,
                        clause: None,
                        foreign: None,
                    });
                }
            }
        }

        let mut all_words: Vec<JsString> = Vec::new();
        let mut break_after: Vec<bool> = Vec::new();
        for u in &units {
            if u.words.is_empty() {
                if u.clause.is_some() {
                    if let Some(last) = break_after.last_mut() {
                        *last = true;
                    }
                }
                continue;
            }
            for w in &u.words {
                all_words.push(w.text.clone());
                break_after.push(false);
            }
        }
        let expect = self.pos_expectations(&all_words, &break_after);
        let mut wi = 0;

        struct Clause {
            items: Vec<Item>,
            mark: Option<JsString>,
        }
        let mut clauses = vec![Clause {
            items: Vec::new(),
            mark: None,
        }];
        for u in &units {
            if let Some(c) = &u.clause {
                let cur = clauses.last_mut().unwrap();
                if !cur.items.is_empty() {
                    cur.mark = Some(c.clone());
                    clauses.push(Clause {
                        items: Vec::new(),
                        mark: None,
                    });
                }
                continue;
            }
            if let Some(f) = &u.foreign {
                clauses.last_mut().unwrap().items.push(Item {
                    word: JsString::new(),
                    citation: f.clone(),
                    reduced: false,
                    display: f.clone(),
                    span: u.span,
                    surface: u.surface.clone(),
                    tier: TokenSource::Foreign,
                });
                continue;
            }
            for w in &u.words {
                let (citation, source) = self.resolve_word(&w.text, expect.get(wi), oov);
                wi += 1;
                if citation.is_empty() {
                    continue;
                }
                let lw = w.text.to_lower_case();
                let reduced = w.reduced || self.unstressed.contains(&lw);
                clauses.last_mut().unwrap().items.push(Item {
                    word: lw,
                    display: citation.clone(),
                    citation,
                    tier: source,
                    reduced,
                    span: u.span,
                    surface: u.surface.clone(),
                });
            }
        }

        let mut parts: Vec<JsString> = Vec::new();
        let mut traced: IndexMap<Span, Traced> = IndexMap::new();
        for c in clauses.iter_mut() {
            let strong = c
                .items
                .first()
                .and_then(|h| self.clause_initial_stressed.get(&h.word))
                .cloned();
            let resumes = strong.is_some();
            for (idx, it) in c.items.iter_mut().enumerate() {
                if idx == 0 {
                    if let Some(s) = &strong {
                        it.display = s.clone();
                        continue;
                    }
                }
                if self.wh_secondary.contains(&it.word) {
                    it.display = js_re!("ˈ", "g").replace(&it.citation, &js("ˌ"));
                } else if it.reduced {
                    it.display = js_re!("ˈ", "g").replace(&it.citation, &JsString::new());
                }
            }
            if !c.items.is_empty() {
                let terminal = c
                    .mark
                    .as_ref()
                    .is_none_or(|m| *m == "." || *m == "?" || *m == "!");
                let primary = js("ˈ");
                let has_primary = c
                    .items
                    .iter()
                    .enumerate()
                    .any(|(idx, it)| !(idx == 0 && resumes) && it.display.includes(&primary));
                let last = c.items.last_mut().unwrap();
                let promote = !has_primary
                    || (terminal
                        && !last.display.includes(&primary)
                        && !self.non_tonic_final.contains(&last.word));
                if promote {
                    last.display = if last.citation.includes(&primary) {
                        last.citation.clone()
                    } else {
                        promote_first_vowel(&last.citation)
                    };
                }
            }
            for it in &c.items {
                let rendered = match word_transform {
                    Some(f) => f(&it.display, &it.word),
                    None => it.display.clone(),
                };
                parts.push(rendered.clone());
                match traced.get_mut(&it.span) {
                    Some(bucket) => {
                        bucket.emitted.push(rendered);
                        bucket.parts.push(parts.len() - 1);
                        if bucket.tier != Some(it.tier) {
                            bucket.tier = None;
                            bucket.disagreed = true;
                        }
                    }
                    None => {
                        traced.insert(
                            it.span,
                            Traced {
                                span: it.span,
                                surface: it.surface.clone(),
                                emitted: vec![rendered],
                                parts: vec![parts.len() - 1],
                                tier: Some(it.tier),
                                disagreed: false,
                            },
                        );
                    }
                }
            }
            if let Some(m) = &c.mark {
                parts.push(m.clone());
            }
        }
        let mut at = Vec::with_capacity(parts.len());
        let mut cursor = 0;
        for piece in &parts {
            at.push(cursor);
            cursor += piece.len() + 1;
        }
        for t in traced.values() {
            let lo = t.parts.iter().map(|&i| at[i]).min().unwrap();
            let hi = t
                .parts
                .iter()
                .map(|&i| at[i] + parts[i].len())
                .max()
                .unwrap();
            note_token(
                t.span,
                &t.surface,
                &t.emitted,
                None,
                Some((lo, hi)),
                if t.disagreed { None } else { t.tier },
            );
        }
        let assembled = JsString::join(&parts, &js(" "));
        note_assembled(&assembled);
        assembled
    }
}

fn slot_list(v: &JsString, _: &JsString) -> Option<Vec<usize>> {
    Some(
        v.split(&js(","))
            .iter()
            .map(js_number)
            .filter(|n| n.is_finite() && n.fract() == 0.0)
            .map(|n| n as usize)
            .collect(),
    )
}

/// Load the English data and build the phonemizer, or say which file is missing or malformed.
pub fn create_english() -> Result<EnglishPhonemizer, String> {
    let m = try_manifest()?;
    // accent-lexicon.tsv is word<TAB>?<TAB>ipa; the value is the post-first-tab remainder.
    let lexicon = load_tsv_map(
        DIR,
        "accent-lexicon.tsv",
        |rest, _| {
            let fields = rest.split(&js("\t"));
            let ipa = fields.get(1).map(|f| f.trim())?;
            (fields.len() >= 2 && !ipa.is_empty()).then_some(ipa)
        },
        TsvOptions::default(),
    )
    .map_err(|e| e.to_string())?;
    let heteronyms = m
        .heteronyms
        .iter()
        .map(|(k, v)| (js(k), v.clone()))
        .collect();
    let syllabic = load_tsv_map(DIR, "en-syllabic.tsv", slot_list, TsvOptions::default())
        .map_err(|e| e.to_string())?;
    let nasal = load_tsv_map(DIR, "en-nasal-seam.tsv", slot_list, TsvOptions::default())
        .map_err(|e| e.to_string())?;
    let arpabet_to_ipa = make_arpabet_to_ipa(&m.arpabet, syllabic, nasal);
    let g2p_dict = load_tsv_map(
        DIR,
        "g2p-dict.tsv",
        |v, _| {
            Some(
                v.split(&js(" "))
                    .iter()
                    .map(|p| p.to_string_lossy())
                    .collect::<Vec<String>>(),
            )
        },
        TsvOptions::default(),
    )
    .map_err(|e| e.to_string())?;
    let common = load_lines(DIR, "g2p-common.txt", false)
        .map_err(|e| e.to_string())?
        .into_iter()
        .collect();
    let classes = G2pClasses {
        vowel_letters: m.g2p_classes.vowel_letters.clone(),
        vowels: m.arpabet.vowels.clone(),
        voiceless: m.g2p_classes.voiceless.clone(),
        sibilants: m.g2p_classes.sibilants.clone(),
        stop_pieces: m.g2p_classes.stop_pieces.clone(),
        stem_stress_prefixes: m.g2p_classes.stem_stress_prefixes.clone(),
        letter_name_exceptions: m.letter_name_exceptions.clone(),
    };
    let g2p = EnglishG2p::new(
        load_json::<EnglishG2pModel>(DIR, "g2p-model.json").map_err(|e| e.to_string())?,
        g2p_dict,
        common,
        arpabet_to_ipa,
        classes,
    );
    let tagger =
        PosTagger::new(load_json::<PosModel>(DIR, "pos-model.json").map_err(|e| e.to_string())?);
    let set = |v: &[String]| v.iter().map(|s| js(s)).collect::<HashSet<JsString>>();
    let map = |v: &IndexMap<String, String>| {
        v.iter()
            .map(|(k, x)| (js(k), js(x)))
            .collect::<IndexMap<JsString, JsString>>()
    };
    Ok(EnglishPhonemizer {
        lexicon,
        heteronyms,
        g2p,
        tagger,
        unstressed: set(&m.unstressed_words),
        clause_punctuation: map(&m.clause_punctuation),
        non_tonic_final: set(&m.non_tonic_final),
        wh_secondary: set(&m.wh_secondary),
        clause_initial_stressed: map(&m.clause_initial_stressed),
    })
}
