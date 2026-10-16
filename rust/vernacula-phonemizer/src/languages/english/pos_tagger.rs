//! The averaged-perceptron POS tagger (UD-EWT, Penn tags) that disambiguates heteronyms.
//! Ported from src/languages/english/posTagger.ts.

use std::collections::HashMap;

use crate::core::js_string::{JsString, js};
use crate::js_re;

pub const START: &str = "-START-";
pub const END: &str = "-END-";

pub fn normalize_token(word: &JsString) -> JsString {
    if word.len() == 4 && js_re!("^[0-9]+$").test(word) {
        return js("!YEAR");
    }
    if let Some(first) = word.char_code_at(0) {
        if (b'0' as u16..=b'9' as u16).contains(&first) {
            return js("!DIGITS");
        }
    }
    word.to_lower_case()
}

/// The feature strings, in the TS insertion order (a later duplicate key overwrites, so order is first-seen).
pub fn extract_features(
    i: usize,
    word: &JsString,
    context: &[JsString],
    prev: &JsString,
    prev2: &JsString,
) -> Vec<JsString> {
    let mut feats: Vec<JsString> = Vec::new();
    let mut add = |parts: &[&JsString]| {
        let f = JsString::join(
            &parts.iter().map(|p| (*p).clone()).collect::<Vec<_>>(),
            &js(" "),
        );
        if !feats.contains(&f) {
            feats.push(f);
        }
    };
    let c = i + 2;
    let empty = JsString::new();
    let at = |k: usize| context.get(k).unwrap_or(&empty);
    let suffix = |w: &JsString| w.slice(-3, None);
    let first = word.char_at(0);
    let (s_word, s_m1, s_p1) = (suffix(word), suffix(at(c - 1)), suffix(at(c + 1)));
    add(&[&js("bias")]);
    add(&[&js("i suffix"), &s_word]);
    add(&[&js("i pref1"), &first]);
    add(&[&js("i-1 tag"), prev]);
    add(&[&js("i-2 tag"), prev2]);
    add(&[&js("i tag+i-2 tag"), prev, prev2]);
    add(&[&js("i word"), at(c)]);
    add(&[&js("i-1 tag+i word"), prev, at(c)]);
    add(&[&js("i-1 word"), at(c - 1)]);
    add(&[&js("i-1 suffix"), &s_m1]);
    add(&[&js("i-2 word"), at(c - 2)]);
    add(&[&js("i+1 word"), at(c + 1)]);
    add(&[&js("i+1 suffix"), &s_p1]);
    add(&[&js("i+2 word"), at(c + 2)]);
    feats
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PosExpectation {
    pub verb: bool,
    pub noun: bool,
    pub past: bool,
    pub adj: bool,
}

pub fn pos_expectation(tag: &str) -> PosExpectation {
    PosExpectation {
        verb: tag == "MD" || tag.starts_with("VB"),
        noun: tag.starts_with("NN"),
        past: tag == "VBD" || tag == "VBN",
        adj: tag.starts_with("JJ"),
    }
}

pub fn heads_object_phrase(tag: &str) -> bool {
    matches!(tag, "DT" | "PDT" | "WDT" | "PRP$" | "PRP")
}

pub fn is_nominal_tag(tag: &str) -> bool {
    matches!(tag, "NOUN" | "PROPN" | "ADJ" | "NUM")
}

pub fn is_verbal_upos(tag: &str) -> bool {
    matches!(tag, "VERB" | "AUX")
}

/// The model as `pos-model.bin` stores it (`pos_model_binary`): a sparse matrix in compressed rows. Row
/// `rows[feature]` is `cls`/`weight[row_start[r]..row_start[r + 1]]`, classes ascending.
pub struct PosModel {
    pub scale: f64,
    pub classes: Vec<String>,
    pub tagdict: HashMap<String, usize>,
    pub rows: HashMap<String, usize>,
    pub row_start: Vec<u32>,
    pub cls: Vec<u8>,
    pub weight: Vec<i32>,
}

pub struct PosTagger {
    classes: Vec<String>,
    tagdict: HashMap<JsString, usize>,
    rows: HashMap<JsString, usize>,
    row_start: Vec<u32>,
    cls: Vec<u8>,
    weight: Vec<i32>,
}

impl PosTagger {
    pub fn new(model: PosModel) -> PosTagger {
        let keyed = |m: HashMap<String, usize>| m.into_iter().map(|(k, v)| (js(&k), v)).collect();
        PosTagger {
            classes: model.classes,
            tagdict: keyed(model.tagdict),
            rows: keyed(model.rows),
            row_start: model.row_start,
            cls: model.cls,
            weight: model.weight,
        }
    }

    fn predict(&self, features: &[JsString]) -> String {
        let mut scores = vec![0.0f64; self.classes.len()];
        for feat in features {
            let Some(&r) = self.rows.get(feat) else {
                continue;
            };
            // Classes ascending within the row, the order `for (idx in w)` visited the JSON row in.
            for k in self.row_start[r] as usize..self.row_start[r + 1] as usize {
                let ci = self.cls[k] as usize;
                if ci < scores.len() {
                    scores[ci] += f64::from(self.weight[k]);
                }
            }
        }
        let mut best = 0;
        let mut best_score = scores.first().copied().unwrap_or(0.0);
        for (k, &s) in scores.iter().enumerate().skip(1) {
            if s > best_score {
                best_score = s;
                best = k;
            }
        }
        self.classes
            .get(best)
            .cloned()
            .unwrap_or_else(|| "NN".into())
    }

    pub fn tag(&self, words: &[JsString]) -> Vec<String> {
        let norm: Vec<JsString> = words.iter().map(normalize_token).collect();
        let mut context = vec![js(START), js(START)];
        context.extend(norm.iter().cloned());
        context.push(js(END));
        context.push(js(END));
        let mut tags = Vec::new();
        let (mut prev, mut prev2) = (js(START), js(START));
        for (i, word) in norm.iter().enumerate() {
            let tag = match self.tagdict.get(word) {
                Some(&c) => self.classes.get(c).cloned().unwrap_or_else(|| "NN".into()),
                None => self.predict(&extract_features(i, word, &context, &prev, &prev2)),
            };
            tags.push(tag.clone());
            prev2 = prev;
            prev = js(&tag);
        }
        tags
    }
}
