//! The shared word-level tagger contract: a char → id vocabulary, an id → tag table, and a per-character
//! mask of permitted tags, plus the word-level tagger and its serving pre-pass. Ported from
//! src/core/structuralTagger.ts (only what the ported taggers use).

use std::collections::HashMap;

use serde::Deserialize;

use super::js_regex::JsRegex;
use super::js_string::JsString;

#[derive(Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TaggerMeta {
    pub src: HashMap<String, i64>,
    pub tags: HashMap<String, String>,
    pub char_tags: HashMap<String, Vec<usize>>,
}

/// Argmax over only the permitted tag ids of one position; `None` when none is permitted. Ties keep the
/// FIRST permitted id, as the TS's strict `>` does.
pub fn masked_argmax(
    logits: &[f32],
    row_offset: usize,
    valid: Option<&Vec<usize>>,
) -> Option<usize> {
    let valid = valid.filter(|v| !v.is_empty())?;
    let mut best = valid[0];
    let mut best_lo = logits[row_offset + best];
    for &t in &valid[1..] {
        let v = logits[row_offset + t];
        if v > best_lo {
            best_lo = v;
            best = t;
        }
    }
    Some(best)
}

/// A character-sequence model: `chars` int64 [1, T] in, `logits` f32 [T · n_tags] out, row-major.
pub trait CharLogits: Send + Sync {
    fn logits(&self, ids: &[i64]) -> Result<Vec<f32>, String>;
}

/// A tagger graph run by the pure-Rust runtime: input `chars`, output `logits`.
impl CharLogits for super::neural::OnnxModel {
    fn logits(&self, ids: &[i64]) -> Result<Vec<f32>, String> {
        let input = super::neural::Tensor::i64(vec![1, ids.len()], ids.to_vec())
            .map_err(|e| e.to_string())?;
        let out = self.run(&[("chars", input)]).map_err(|e| e.to_string())?;
        let (_, logits) = out
            .into_iter()
            .find(|(n, _)| n == "logits")
            .ok_or("model has no `logits` output")?;
        Ok(logits.as_f32().map_err(|e| e.to_string())?.to_vec())
    }
}

/// `WordTaggerOptions`, less what the pure-Rust runtime does not need (the ORT context string and the
/// execution-provider env var).
pub struct WordTaggerOptions {
    /// The calling module's data-directory key; model and meta live beside it.
    pub dir: &'static str,
    /// Loads `${basename}.meta.json`.
    pub basename: String,
    pub model_file: String,
    /// Normalizes a word to the training vocabulary before it is split into code points.
    pub preprocess: fn(&JsString) -> JsString,
    pub postprocess: Option<fn(&JsString) -> JsString>,
}

/// A bare word → canonical IPA, or empty to defer to the rule engine (`WordStructuralTagger`).
pub struct WordStructuralTagger {
    meta: TaggerMeta,
    n_tags: usize,
    model: Box<dyn CharLogits>,
    preprocess: fn(&JsString) -> JsString,
    postprocess: Option<fn(&JsString) -> JsString>,
}

/// `createWordStructuralTagger`: `Err` (why) where the TS resolves `undefined` — unreadable files, or a
/// graph the runtime does not reproduce.
pub fn create_word_structural_tagger(opts: WordTaggerOptions) -> Result<WordStructuralTagger, String> {
    use super::data_source::{read_data, read_data_text};
    let meta_key = format!("{}/{}.meta.json", opts.dir, opts.basename);
    let meta: TaggerMeta =
        serde_json::from_str(&read_data_text(&meta_key).map_err(|e| e.to_string())?)
            .map_err(|e| format!("{meta_key}: {e}"))?;
    let bytes =
        read_data(&format!("{}/{}", opts.dir, opts.model_file)).map_err(|e| e.to_string())?;
    let model = super::neural::OnnxModel::from_bytes(&bytes).map_err(|e| e.to_string())?;
    WordStructuralTagger::new(meta, Box::new(model), opts.preprocess, opts.postprocess)
}

impl WordStructuralTagger {
    /// ⚠ A `charTags` id outside the tag table is refused: the TS would read a neighbouring row, which is a
    /// meta.json that does not belong to this model.
    pub fn new(
        meta: TaggerMeta,
        model: Box<dyn CharLogits>,
        preprocess: fn(&JsString) -> JsString,
        postprocess: Option<fn(&JsString) -> JsString>,
    ) -> Result<WordStructuralTagger, String> {
        let n_tags = meta.tags.len();
        if let Some((c, bad)) = meta
            .char_tags
            .iter()
            .find_map(|(c, ids)| ids.iter().find(|&&t| t >= n_tags).map(|t| (c, *t)))
        {
            return Err(format!(
                "tagger meta: charTags[{c}] names tag {bad}, but there are only {n_tags} tags"
            ));
        }
        Ok(WordStructuralTagger { meta, n_tags, model, preprocess, postprocess })
    }

    /// `tag(word)`: preprocess → decline on an out-of-vocabulary code point → one forward pass → masked
    /// argmax per position → postprocess. Empty means "defer to the rule engine".
    pub fn tag(&self, word: &JsString) -> Result<JsString, String> {
        let pre = (self.preprocess)(word);
        let mut ids = Vec::new();
        for cp in pre.code_points() {
            // A lone surrogate is its own element of `[...s]`, and no vocabulary key.
            let Some(ch) = char::from_u32(cp) else {
                return Ok(JsString::new());
            };
            match self.meta.src.get(ch.to_string().as_str()) {
                Some(&id) => ids.push(id),
                None => return Ok(JsString::new()),
            }
        }
        if ids.is_empty() {
            return Ok(JsString::new());
        }
        let logits = self.model.logits(&ids)?;
        if logits.len() != ids.len() * self.n_tags {
            return Err(format!(
                "logits length {} for T={} × {} tags",
                logits.len(),
                ids.len(),
                self.n_tags
            ));
        }
        let mut out = JsString::new();
        for (k, id) in ids.iter().enumerate() {
            let Some(best) =
                masked_argmax(&logits, k * self.n_tags, self.meta.char_tags.get(&id.to_string()))
            else {
                return Ok(JsString::new());
            };
            if let Some(t) = self.meta.tags.get(&best.to_string()) {
                out.push_str(&JsString::from(t.as_str()));
            }
        }
        Ok(match self.postprocess {
            Some(p) => p(&out),
            None => out,
        })
    }
}

/// `wordLevelNeuralPrepass`: tag each DISTINCT out-of-lexicon word once (in text order), then render the
/// whole text through the sync engine with those readings as its OOV override. A declined word is not
/// memoized, so it is offered to the tagger again at its next occurrence, as in the TS.
pub fn word_level_neural_prepass(
    text: &JsString,
    word: &JsRegex,
    key: &dyn Fn(&JsString) -> JsString,
    lex_has: &dyn Fn(&JsString) -> bool,
    tag: &dyn Fn(&JsString) -> Result<JsString, String>,
    render: &dyn Fn(&JsString, &dyn Fn(&JsString) -> Option<JsString>) -> JsString,
) -> Result<JsString, String> {
    let mut tagged: HashMap<JsString, JsString> = HashMap::new();
    for m in word.match_all(text) {
        let w = key(&m.value(text));
        if tagged.contains_key(&w) || lex_has(&w) {
            continue;
        }
        let out = tag(&w)?;
        if !out.is_empty() {
            tagged.insert(w, out);
        }
    }
    Ok(render(text, &|w| tagged.get(w).cloned()))
}
