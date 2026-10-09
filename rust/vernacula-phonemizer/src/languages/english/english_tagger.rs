//! The English neural OOV G2P: a per-letter BiLSTM tagger emitting ARPABET chunks, finished with the n-gram
//! G2P's stress and geminate rules. Ported from src/languages/english/englishTagger.ts.

use std::collections::HashSet;

use indexmap::IndexMap;

use super::english_arpabet::{ArpabetToIpa, make_arpabet_to_ipa};
use super::english_g2p::{collapse_geminates, enforce_single_primary};
use super::manifest::{DIR, try_manifest};
use crate::core::js_string::{JsString, js};
use crate::core::structural_tagger::{CharLogits, TaggerMeta, TaggerTables, load_tagger};
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
    tables: TaggerTables,
    model: Box<dyn CharLogits>,
    arpabet_to_ipa: ArpabetToIpa,
    vowels: HashSet<String>,
}

impl EnglishTagger {
    /// The meta is validated by `TaggerTables::new` (a `charTags` id outside the tag table is refused).
    pub fn new(meta: TaggerMeta, model: Box<dyn CharLogits>) -> Result<EnglishTagger, String> {
        let manifest = try_manifest()?;
        let tables = TaggerTables::new(&meta)?;
        Ok(EnglishTagger {
            tables,
            model,
            arpabet_to_ipa: make_arpabet_to_ipa(
                &manifest.arpabet,
                IndexMap::new(),
                IndexMap::new(),
            ),
            vowels: manifest.arpabet.vowels.iter().cloned().collect(),
        })
    }

    /// The reading, or empty when the tagger declines (an out-of-vocabulary grapheme, a position with no
    /// permitted tag, or no phones at all): empty means "defer to the rule engine".
    pub fn tag(&self, word: &JsString) -> Result<JsString, String> {
        let lower = word.to_lower_case();
        let cps: Vec<u32> = lower.code_points().collect();
        let chars: Vec<String> = cps
            .iter()
            .map(|&cp| char::from_u32(cp).map_or_else(String::new, |c| c.to_string()))
            .collect();
        let t = chars.len();
        if t == 0 {
            return Ok(JsString::new());
        }
        let mut ids = Vec::with_capacity(t);
        for &cp in &cps {
            match self.tables.id_of(cp) {
                Some(id) => ids.push(id),
                None => return Ok(JsString::new()),
            }
        }
        let logits = self.model.logits(&ids)?;
        self.tables.check_logits(&logits, t)?;
        let vowel_letter = |c: &str| js_re!("^[aeiouy]$", "u").test(&js(c));
        let mut phones: Vec<String> = Vec::new();
        let mut last_from_char: isize = -2;
        for k in 0..t {
            let Some(best) = self.tables.best(&logits, k, ids[k]) else {
                return Ok(JsString::new());
            };
            let chunk = self.tables.tag(best);
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

/// The tagger's files: its meta and its graph loaded by the pure-Rust runtime, or why they are unusable.
pub fn load_english_tagger_files(basename: &str) -> Result<(TaggerMeta, Box<dyn CharLogits>), String> {
    load_tagger(DIR, basename, &format!("{basename}.int8.onnx"))
}
