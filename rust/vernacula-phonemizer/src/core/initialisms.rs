//! Initialisms: dotted initials spelled out, capital runs read as letters when nothing can say them as a
//! word, and the phonotactic test that decides "nothing can". Ported from src/core/initialisms.ts — see that
//! file for the measured policy.

use std::sync::{Arc, LazyLock};

use super::js_regex::{JsMatch, JsRegex};
use super::js_string::{JsString, js};
use super::provenance::rewrite_with;
use crate::js_re;

pub type LetterName = Arc<dyn Fn(&JsString) -> Option<JsString> + Send + Sync>;

/// `R` is the `isRecorded` predicate's type, so a caller may lend a borrowed one (English builds the pass
/// per call around its lexicon, as the TS does); with a `Send + Sync` predicate the normalizer is too.
pub struct InitialismData<R: Fn(&JsString) -> bool> {
    pub letter_name: LetterName,
    pub lower: Option<Arc<dyn Fn(&JsString) -> JsString + Send + Sync>>,
    pub acronym_letters: Arc<dyn Fn(&JsString) -> bool + Send + Sync>,
    pub is_recorded: R,
    pub is_unreadable: Arc<dyn Fn(&JsString) -> bool + Send + Sync>,
}

pub const LATIN_MARK: &str = r"\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\uFE20-\uFE2F";

static RUN_OR_CODE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}{m}])\p{{Lu}}{{2,}}(?![\p{{L}}{m}])|(?<![\p{{L}}{m}])\p{{Lu}}+(?=\d)|(?<=\d)\p{{Lu}}(?![\p{{L}}{m}\d])",
            m = LATIN_MARK
        ),
        "gu",
    )
    .unwrap()
});
static INITIAL_RUN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!("(?<![\\p{{L}}{LATIN_MARK}])(?:\\p{{Lu}}\\.[ \u{a0}]*){{2,}}"), "gu").unwrap()
});

fn lone_initial() -> &'static JsRegex {
    js_re!(r"(?<=^|\p{Lu}\p{L}*[  ])(\p{Lu})\.(?=[  ]+\p{Lu}\p{Ll})", "gu")
}

/// The normalizer. `on_pipeline` false keeps its replaces off the provenance seam (a nested use).
pub fn make_initialism_normalizer<R: Fn(&JsString) -> bool>(d: InitialismData<R>, on_pipeline: bool) -> impl Fn(&JsString) -> JsString {
    let d = Arc::new(d);
    move |raw: &JsString| {
        let rw = |x: &JsString, re: &JsRegex, f: &mut dyn FnMut(&JsMatch, &JsString) -> JsString| -> JsString {
            if on_pipeline { rewrite_with(x, re, f) } else { re.replace_with(x, f) }
        };
        let lower = |s: &JsString| d.lower.as_ref().map_or_else(|| s.to_lower_case(), |f| f(s));
        let spell_initials = |run: &JsString| {
            let parts: Vec<JsString> = js_re!(r"\p{Lu}", "gu")
                .match_all(run)
                .iter()
                .map(|m| {
                    let l = m.value(run);
                    (d.letter_name)(&lower(&l)).unwrap_or(l)
                })
                .collect();
            JsString::join(&parts, &js(" "))
        };
        let text = rw(raw, &INITIAL_RUN, &mut |m, s| spell_initials(&m.value(s)).concat(&js(" ")));
        let text = rw(&text, lone_initial(), &mut |m, s| {
            let letter = m.group(1, s).unwrap();
            (d.letter_name)(&lower(&letter)).unwrap_or(letter)
        });
        // inner(text)
        let shouting = !js_re!(r"\p{Ll}", "u").test(&text)
            && js_re!(r"\S+", "gu")
                .match_all(&text)
                .iter()
                .filter(|w| js_re!(r"\p{Lu}{2,}", "u").test(&w.value(&text)))
                .count()
                >= 2;
        rw(&text, &RUN_OR_CODE, &mut |m, whole| {
            let tok = m.value(whole);
            let glued = js_re!(r"^\d", "u").test(&whole.slice(m.end() as isize, None));
            let low = lower(&tok);
            let spelled = spell_out(&low, &d.letter_name);
            if tok.len() < 2 {
                return spelled.unwrap_or(tok);
            }
            if glued && tok.len() == 2 {
                return spelled.unwrap_or(tok);
            }
            if shouting {
                return tok;
            }
            if (d.acronym_letters)(&low) {
                return spelled.unwrap_or(tok);
            }
            if (d.is_recorded)(&low) {
                return tok;
            }
            if (d.is_unreadable)(&low) {
                return spelled.unwrap_or(tok);
            }
            tok
        })
    }
}

/// Code point by code point (`[...lower]`); `None` unless every letter has a name.
fn spell_out(lower: &JsString, letter_name: &LetterName) -> Option<JsString> {
    let mut names = Vec::new();
    let mut i = 0;
    while i < lower.len() {
        let w = if lower.code_point_at(i).unwrap() > 0xFFFF { 2 } else { 1 };
        names.push(letter_name(&JsString::from_units(&lower.0[i..i + w]))?);
        i += w;
    }
    Some(JsString::join(&names, &js(" ")))
}

pub struct PhonotacticsData {
    pub vowels: JsRegex,
    pub legal_onsets: Vec<JsString>,
    pub legal_codas: Vec<JsString>,
    pub liquids: Option<JsRegex>,
    pub digraphs: Option<Vec<JsString>>,
}

pub fn liquids() -> &'static JsRegex {
    js_re!("[lrлр]", "u")
}

/// ⚠ `vowels.test` is called repeatedly; a `g`/`y` vowels regex would carry `lastIndex` in the TS. None does.
pub fn make_unreadable_test(d: PhonotacticsData) -> impl Fn(&JsString) -> bool + Send + Sync {
    assert!(!d.vowels.global && !d.vowels.sticky, "stateful vowels regex: port lastIndex explicitly");
    let inner = js_re!(r"^\[|\]$", "g").replace(&js(&d.vowels.source), &JsString::new());
    let consonant_run = JsRegex::new(&format!("[^{}]{{3,}}", inner.to_string_lossy()), "u").unwrap();
    move |word: &JsString| {
        let is_consonant = |ch: &JsString| js_re!(r"\p{L}", "u").test(ch) && !d.vowels.test(ch);
        let has_digraph = |s: &JsString| d.digraphs.as_ref().is_some_and(|g| g.contains(s));
        let collapse = |w: &JsString| -> JsString {
            let Some(g) = d.digraphs.as_ref().filter(|g| !g.is_empty()) else { return w.clone() };
            let mut out = JsString::new();
            let mut i = 0;
            'outer: while i < w.len() {
                for n in (2..=3).rev() {
                    if g.contains(&w.slice(i as isize, Some((i + n) as isize))) {
                        out.push_str(&js("ẋ"));
                        i += n;
                        continue 'outer;
                    }
                }
                out.0.push(w.0[i]);
                i += 1;
            }
            out
        };
        let w = word.to_lower_case();
        if !d.vowels.test(&w) {
            return true;
        }
        let collapsed = collapse(&w);
        if let Some(run) = consonant_run.exec(&collapsed) {
            if !d.liquids.as_ref().unwrap_or(liquids()).test(&run.value(&collapsed)) {
                return true;
            }
        }
        let head = w.slice(0, Some(2));
        if w.len() >= 2 && is_consonant(&w.char_at(0)) && is_consonant(&w.char_at(1)) && !d.legal_onsets.contains(&head) && !has_digraph(&head) {
            return true;
        }
        let tail = w.slice(-2, None);
        if tail.len() == 2 && is_consonant(&tail.char_at(0)) && is_consonant(&tail.char_at(1)) && !d.legal_codas.contains(&tail) && !has_digraph(&tail) {
            return true;
        }
        false
    }
}
