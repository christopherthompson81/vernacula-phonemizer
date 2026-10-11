//! Shared West-Germanic morphological decomposition: PREFIX* · STEM (+link · STEM)* · SUFFIX*, with every
//! language fact supplied as config (de now; nl and af when they are ported).
//! Ported from src/core/germanicMorphology.ts — see that file for the corpus evidence.

use std::collections::HashSet;

use super::js_regex::JsRegex;
use super::js_string::{JsString, js};
use crate::js_re;

/// Inserted between morphemes; the g2p treats the next letter as element-initial.
pub const BOUNDARY: &str = "·";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Kind {
    Prefix,
    Stem,
    Suffix,
}

impl Kind {
    pub fn as_str(self) -> &'static str {
        match self {
            Kind::Prefix => "prefix",
            Kind::Stem => "stem",
            Kind::Suffix => "suffix",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Decomp {
    pub parts: Vec<JsString>,
    pub kinds: Vec<Kind>,
    pub stress_part: usize,
}

type Pred = Box<dyn Fn(&JsString) -> bool + Send + Sync>;
type Links = Box<dyn Fn(&JsString) -> Vec<JsString> + Send + Sync>;
type PairPred = Box<dyn Fn(&JsString, &JsString) -> bool + Send + Sync>;

/// `MorphologyConfig`. The optional quirks are `None`/`false` for a language that does not set them.
pub struct MorphologyConfig {
    pub vowels: JsString,
    pub prefix_unstressed: Vec<JsString>,
    pub prefix_stressed: Vec<JsString>,
    pub ambiguous_prefixes: HashSet<JsString>,
    pub suffixes: Vec<JsString>,
    pub vowel_initial_suffixes: HashSet<JsString>,
    pub reliable_cons_suffixes: HashSet<JsString>,
    pub links_for: Links,
    pub valid_onsets: HashSet<JsString>,
    pub st_keep: HashSet<JsString>,
    pub is_word: Pred,
    pub is_constituent: Pred,
    pub negation_prefix: Option<JsString>,
    /// A non-`g` regex (`.test` is stateless).
    pub negation_follows: Option<JsRegex>,
    pub real_word_stressed_prefixes: Option<HashSet<JsString>>,
    pub suffix_digraph_guard: Option<PairPred>,
    pub seam_element_initial: Option<JsRegex>,
    pub whole_verb_suffix: Option<JsString>,
    pub min_trailing_constituent: Option<usize>,
    pub dont_split_known_words: bool,
}

/// `makeDecompose(cfg)`: the returned value's `decompose` is the TS closure.
pub struct Decomposer {
    cfg: MorphologyConfig,
}

/// `w[i] ?? ""` as a one-unit string.
fn unit_at(w: &JsString, i: usize) -> JsString {
    w.char_at(i)
}

impl Decomposer {
    pub fn new(cfg: MorphologyConfig) -> Self {
        Decomposer { cfg }
    }

    /// ⚠ `VOWELS.includes(x)` is true for `x === ""` (JS), which the onset gate relies on for a one-letter `w`.
    fn is_stemish(&self, w: &JsString) -> bool {
        let v = &self.cfg.vowels;
        if !w.units().iter().any(|&u| v.units().contains(&u)) {
            return false;
        }
        let (a, b) = (unit_at(w, 0), unit_at(w, 1));
        if v.includes(&a) {
            return true;
        }
        if v.includes(&b) || b.is_empty() {
            return true;
        }
        self.cfg.valid_onsets.contains(&a.concat(&b))
            || self.cfg.valid_onsets.contains(&w.slice(0, Some(3)))
    }

    fn resolves(&self, w: &JsString) -> bool {
        (self.cfg.is_word)(w) || (self.cfg.is_constituent)(w) || self.split_compound(w, 0).is_some()
    }

    fn split_compound(&self, w: &JsString, depth: usize) -> Option<Vec<JsString>> {
        if depth > 2 {
            return None;
        }
        if self.cfg.dont_split_known_words && (self.cfg.is_word)(w) {
            return None;
        }
        let min_tail = self.cfg.min_trailing_constituent.unwrap_or(3);
        let mut i = w.len() as isize - min_tail as isize;
        while i >= 4 {
            let iu = i as usize;
            let head = w.slice(0, Some(i));
            i -= 1;
            if !(self.cfg.is_constituent)(&head) {
                continue;
            }
            for lk in (self.cfg.links_for)(&head) {
                if !w.slice(iu as isize, None).starts_with(&lk) {
                    continue;
                }
                let rest = w.slice((iu + lk.len()) as isize, None);
                if rest.len() < min_tail {
                    continue;
                }
                let hl = head.concat(&lk);
                if (self.cfg.is_constituent)(&rest) {
                    let deeper = self
                        .split_compound(&rest, depth + 1)
                        .or_else(|| self.split_prefixed_stem(&rest, depth + 1));
                    return Some(match deeper {
                        Some(d) => std::iter::once(hl).chain(d).collect(),
                        None => vec![hl, rest],
                    });
                }
                if let Some(tail) = self.split_compound(&rest, depth + 1) {
                    return Some(std::iter::once(hl).chain(tail).collect());
                }
            }
        }
        None
    }

    fn split_prefixed_stem(&self, w: &JsString, depth: usize) -> Option<Vec<JsString>> {
        if depth > 2 {
            return None;
        }
        for p in &self.cfg.prefix_stressed {
            if !w.starts_with(p) || (w.len() as isize - p.len() as isize) < 4 {
                continue;
            }
            let r = w.slice(p.len() as isize, None);
            if (self.cfg.is_constituent)(&r) {
                return Some(vec![p.clone(), r]);
            }
            if let Some(sub) = self.split_compound(&r, depth + 1) {
                return Some(std::iter::once(p.clone()).chain(sub).collect());
            }
            if self.is_stemish(&r) {
                return Some(vec![p.clone(), r]);
            }
        }
        None
    }

    /// `decompose(word)`.
    pub fn decompose(&self, word: &JsString) -> Decomp {
        let cfg = &self.cfg;
        let w = word.to_lower_case();
        if cfg.st_keep.contains(&w) {
            return Decomp {
                parts: vec![w],
                kinds: vec![Kind::Stem],
                stress_part: 0,
            };
        }
        let mut prefixes: Vec<JsString> = Vec::new();
        let mut rest = w;
        for _ in 0..3 {
            let mut stripped = false;
            for p in &cfg.prefix_unstressed {
                if !rest.starts_with(p) || (rest.len() as isize - p.len() as isize) < 4 {
                    continue;
                }
                let r = rest.slice(p.len() as isize, None);
                let ok = if cfg.negation_prefix.as_ref() == Some(p) {
                    cfg.negation_follows.as_ref().is_some_and(|re| re.test(&r))
                } else if cfg.ambiguous_prefixes.contains(p) {
                    (cfg.is_word)(&r) || self.split_compound(&r, 0).is_some()
                } else {
                    self.is_stemish(&r)
                };
                if ok {
                    prefixes.push(p.clone());
                    rest = r;
                    stripped = true;
                    break;
                }
            }
            if !stripped {
                break;
            }
        }
        let mut sep_prefix: Option<JsString> = None;
        for p in &cfg.prefix_stressed {
            if !rest.starts_with(p) || (rest.len() as isize - p.len() as isize) < 4 {
                continue;
            }
            let r = rest.slice(p.len() as isize, None);
            let ok = if cfg
                .real_word_stressed_prefixes
                .as_ref()
                .is_some_and(|s| s.contains(p))
            {
                (cfg.is_word)(&r) || self.split_compound(&r, 0).is_some()
            } else {
                self.is_stemish(&r)
            };
            if ok {
                sep_prefix = Some(p.clone());
                rest = r;
                break;
            }
        }
        // ⚠ `sepPrefix` is a string in the TS, and `""` is falsy: an empty stressed prefix would match and
        // be dropped. No language lists one; `Some` here is always non-empty for the same reason.
        let sep_prefix = sep_prefix.filter(|p| !p.is_empty());
        let mut suffixes: Vec<JsString> = Vec::new();
        for _ in 0..2 {
            let mut stripped = false;
            for s in &cfg.suffixes {
                if !rest.ends_with(s) || (rest.len() as isize - s.len() as isize) < 3 {
                    continue;
                }
                let stem = rest.slice(0, Some((rest.len() - s.len()) as isize));
                if cfg
                    .suffix_digraph_guard
                    .as_ref()
                    .is_some_and(|g| g(s, &stem))
                {
                    continue;
                }
                let reliable_loose =
                    cfg.reliable_cons_suffixes.contains(s) && js_re!("[bdg]$").test(&stem);
                let ok = if cfg.vowel_initial_suffixes.contains(s) || reliable_loose {
                    self.is_stemish(&stem)
                } else {
                    self.resolves(&stem)
                };
                if ok {
                    suffixes.insert(0, s.clone());
                    rest = stem;
                    stripped = true;
                    break;
                }
            }
            if !stripped {
                break;
            }
        }
        let mut stem_parts = self
            .split_compound(&rest, 0)
            .unwrap_or_else(|| vec![rest.clone()]);
        if stem_parts.len() == 1 && !suffixes.is_empty() {
            let whole = rest.concat(&JsString::join(&suffixes, &JsString::new()));
            let split = self.split_compound(&whole, 0);
            let seam_split = match (&split, &cfg.seam_element_initial) {
                (Some(sp), Some(seam)) if sp.len() >= 2 => sp[1..].iter().any(|p| seam.test(p)),
                _ => false,
            };
            let keep_whole = cfg.whole_verb_suffix.as_ref().is_some_and(|v| {
                !v.is_empty() && (cfg.is_word)(&whole) && whole.ends_with(v) && !seam_split
            });
            let cs = if keep_whole { None } else { split };
            if let Some(cs) = cs.filter(|cs| cs.len() >= 2) {
                stem_parts = cs;
                suffixes.clear();
            }
        }

        let mut parts = prefixes.clone();
        let mut kinds = vec![Kind::Prefix; prefixes.len()];
        if let Some(p) = sep_prefix {
            parts.push(p);
            kinds.push(Kind::Prefix);
        }
        kinds.extend(std::iter::repeat_n(Kind::Stem, stem_parts.len()));
        parts.extend(stem_parts);
        kinds.extend(std::iter::repeat_n(Kind::Suffix, suffixes.len()));
        parts.extend(suffixes);
        Decomp {
            parts,
            kinds,
            stress_part: prefixes.len(),
        }
    }
}

/// `new Set(list)` of JsStrings.
pub fn js_set(list: &[String]) -> HashSet<JsString> {
    list.iter().map(|s| js(s)).collect()
}
