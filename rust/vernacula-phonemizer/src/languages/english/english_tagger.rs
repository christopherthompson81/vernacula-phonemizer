//! The English neural OOV G2P: a per-letter BiLSTM tagger emitting ARPABET chunks, finished with the n-gram
//! G2P's stress and geminate rules. Ported from src/languages/english/englishTagger.ts.

use std::collections::{HashMap, HashSet};

use indexmap::IndexMap;

use super::english_arpabet::{ArpabetToIpa, make_arpabet_to_ipa};
use super::english_g2p::{collapse_geminates, enforce_single_primary};
use super::manifest::{DIR, try_manifest};
use crate::core::data_source::{read_data, read_data_text};
use crate::core::js_string::{JsString, js};
use crate::core::structural_tagger::{CharLogits, TaggerMeta, masked_argmax};
use crate::js_re;

fn base(p: &str) -> &str {
    match p.as_bytes().last() {
        Some(b'0'..=b'2') => &p[..p.len() - 1],
        _ => p,
    }
}

fn stress(p: &str) -> &str {
    match p.as_bytes().last() {
        Some(b'0'..=b'2') => &p[p.len() - 1..],
        _ => "",
    }
}

fn strength(s: &str) -> i32 {
    match s {
        "1" => 3,
        "2" => 2,
        "0" => 1,
        _ => 0,
    }
}

pub struct EnglishTagger {
    meta: TaggerMeta,
    n_tags: usize,
    model: Box<dyn CharLogits>,
    arpabet_to_ipa: ArpabetToIpa,
    vowels: HashSet<String>,
    tag_by_id: HashMap<usize, String>,
}

impl EnglishTagger {
    /// ⚠ A `charTags` id outside the tag table is refused here: `masked_argmax` would otherwise read the NEXT
    /// position's row (or past the end), which is a meta.json that does not belong to this model.
    pub fn new(meta: TaggerMeta, model: Box<dyn CharLogits>) -> Result<EnglishTagger, String> {
        let manifest = try_manifest()?;
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
        let tag_by_id = meta
            .tags
            .iter()
            .filter_map(|(k, v)| k.parse().ok().map(|i| (i, v.clone())))
            .collect();
        Ok(EnglishTagger {
            meta,
            n_tags,
            model,
            arpabet_to_ipa: make_arpabet_to_ipa(
                &manifest.arpabet,
                IndexMap::new(),
                IndexMap::new(),
            ),
            vowels: manifest.arpabet.vowels.iter().cloned().collect(),
            tag_by_id,
        })
    }

    /// The reading, or empty when the tagger declines (an out-of-vocabulary grapheme, a position with no
    /// permitted tag, or no phones at all): empty means "defer to the rule engine".
    pub fn tag(&self, word: &JsString) -> Result<JsString, String> {
        let lower = word.to_lower_case();
        let chars: Vec<String> = lower
            .code_points()
            .map(|cp| char::from_u32(cp).map_or_else(String::new, |c| c.to_string()))
            .collect();
        let t = chars.len();
        if t == 0 {
            return Ok(JsString::new());
        }
        let mut ids = Vec::with_capacity(t);
        for c in &chars {
            match self.meta.src.get(c) {
                Some(&id) if !c.is_empty() => ids.push(id),
                _ => return Ok(JsString::new()),
            }
        }
        let logits = self.model.logits(&ids)?;
        if logits.len() != t * self.n_tags {
            return Err(format!(
                "logits length {} for T={t} × {} tags",
                logits.len(),
                self.n_tags
            ));
        }
        let vowel_letter = |c: &str| js_re!("^[aeiouy]$", "u").test(&js(c));
        let mut phones: Vec<String> = Vec::new();
        let mut last_from_char: isize = -2;
        for k in 0..t {
            let Some(best) = masked_argmax(
                &logits,
                k * self.n_tags,
                self.meta.char_tags.get(&ids[k].to_string()),
            ) else {
                return Ok(JsString::new());
            };
            let chunk = self.tag_by_id.get(&best).cloned().unwrap_or_default();
            if chunk.is_empty() {
                continue;
            }
            for p in chunk.split(' ') {
                if let Some(prev) = phones.last() {
                    if base(prev) == base(p)
                        && self.vowels.contains(base(p))
                        && k as isize - 1 == last_from_char
                        && vowel_letter(&chars[k])
                        && k > 0
                        && vowel_letter(&chars[k - 1])
                    {
                        if strength(stress(p)) > strength(stress(prev)) {
                            let merged = format!("{}{}", base(p), stress(p));
                            *phones.last_mut().unwrap() = merged;
                        }
                        continue;
                    }
                }
                phones.push(p.to_string());
                last_from_char = k as isize;
            }
        }
        if phones.is_empty() {
            return Ok(JsString::new());
        }
        let finished =
            enforce_single_primary(&collapse_geminates(&phones, &self.vowels), &self.vowels);
        Ok(self.arpabet_to_ipa.convert(&finished, word))
    }
}

/// The tagger's files: `(meta, model bytes)`, or why they are unreadable.
pub fn load_english_tagger_files(basename: &str) -> Result<(TaggerMeta, Vec<u8>), String> {
    let meta_key = format!("{DIR}/{basename}.meta.json");
    let meta: TaggerMeta =
        serde_json::from_str(&read_data_text(&meta_key).map_err(|e| e.to_string())?)
            .map_err(|e| format!("{meta_key}: {e}"))?;
    let bytes = read_data(&format!("{DIR}/{basename}.int8.onnx")).map_err(|e| e.to_string())?;
    Ok((meta, bytes))
}
