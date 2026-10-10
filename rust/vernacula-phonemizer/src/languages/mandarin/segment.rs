//! Hanzi → pinyin: greedy longest match against the phrase dictionary, else the most common single-character
//! reading; non-Han passes through. Ported from src/languages/mandarin/segment.ts — see that file for the
//! corpus evidence.
//!
//! ⚠ `chars` are CODE POINTS (`Array.from` / `for…of` in the TS), each a one- or two-unit string, and
//! `max_phrase` counts code points: an astral Han character is one element here, as in the TS.

use std::collections::HashMap;

use crate::core::js_string::{JsString, js};
use crate::core::provenance::{Form, normalize};
use crate::js_re;

pub struct PinyinTables {
    /// Hanzi → its readings (base+tone), most common first.
    pub chars: HashMap<JsString, Vec<JsString>>,
    /// Multi-character phrase → space-separated base+tone tokens.
    pub phrases: HashMap<JsString, JsString>,
    /// Longest phrase key, in code points.
    pub max_phrase: usize,
}

/// A segmented token; `src` is the source character for a single-character emission (not for a phrase-dict
/// token, nor for a sandhi-exempt digit).
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Token {
    pub py: JsString,
    pub src: Option<JsString>,
}

pub(super) fn is_han(ch: &JsString) -> bool {
    js_re!(r"\p{Script=Han}", "u").test(ch)
}

/// `readAs(ch, t)`: a Han code point with no entry of its own that NFKC folds to a single Han character (a
/// Kangxi radical, a CJK compatibility ideograph: ⼀ → 一) reads as that character.
fn read_as(ch: &JsString, t: &PinyinTables) -> JsString {
    if !is_han(ch) || t.chars.contains_key(ch) {
        return ch.clone();
    }
    let f = normalize(ch, Form::Nfkc);
    if f != *ch && f.code_points().count() == 1 && is_han(&f) {
        f
    } else {
        ch.clone()
    }
}

/// `segment(chars, t, exempt)`; an `exempt` shorter than `chars` reads as false past its end.
pub fn segment(input: &[JsString], t: &PinyinTables, exempt: &[bool]) -> Vec<Token> {
    // Fold first, so a phrase can match across a folded character; 々 takes its predecessor once folded.
    let iteration = js("々");
    let mut chars: Vec<JsString> = Vec::with_capacity(input.len());
    for (k, c) in input.iter().enumerate() {
        let c = if *c == iteration && k > 0 && is_han(&chars[k - 1]) {
            chars[k - 1].clone()
        } else {
            read_as(c, t)
        };
        chars.push(c);
    }
    let yi = js("一");
    let di = js("第");
    let mut out: Vec<Token> = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let ch = &chars[i];
        if !is_han(ch) {
            out.push(Token {
                py: ch.clone(),
                src: None,
            });
            i += 1;
            continue;
        }
        if *ch == yi && out.last().and_then(|t| t.src.as_ref()) == Some(&di) {
            let py = t
                .chars
                .get(&yi)
                .map_or_else(|| yi.clone(), |r| r[0].clone());
            out.push(Token {
                py,
                src: Some(yi.clone()),
            });
            i += 1;
            continue;
        }
        let max_len = t.max_phrase.min(chars.len() - i);
        let mut matched = false;
        for len in (2..=max_len).rev() {
            let mut phrase = JsString::new();
            for c in &chars[i..i + len] {
                phrase.push_str(c);
            }
            if let Some(py) = t.phrases.get(&phrase) {
                for p in py.split(&js(" ")) {
                    out.push(Token { py: p, src: None });
                }
                i += len;
                matched = true;
                break;
            }
        }
        if matched {
            continue;
        }
        let py = t.chars.get(ch).map_or_else(|| ch.clone(), |r| r[0].clone());
        let src = if exempt.get(i).copied().unwrap_or(false) {
            None
        } else {
            Some(ch.clone())
        };
        out.push(Token { py, src });
        i += 1;
    }
    out
}
