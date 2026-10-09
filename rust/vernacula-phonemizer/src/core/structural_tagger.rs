//! The shared word-level tagger contract: a char → id vocabulary, an id → tag table, and a per-character
//! mask of permitted tags. Ported from src/core/structuralTagger.ts (only what the ported taggers use).

use std::collections::HashMap;

use serde::Deserialize;

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
