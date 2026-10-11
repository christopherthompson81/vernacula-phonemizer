//! Thai word segmentation: DAG maximal-matching (fewest words) over the seg-words set, with every boundary on
//! a Thai Character Cluster edge. Ported from src/languages/thai/segment.ts — see that file for the corpus
//! evidence.

use std::collections::HashSet;
use std::sync::OnceLock;

use super::manifest::{DIR, THAI_TCC_RE};
use crate::core::data_source::load_once;
use crate::core::js_string::JsString;
use crate::core::segment::{SegWords, load_seg_words, segment_by_dag};

/// `thaiTccBoundaries(cs)`: the code-point indices (1..n) at which a TCC cluster ends.
fn thai_tcc_boundaries(cs: &[JsString]) -> HashSet<usize> {
    let mut joined = JsString::new();
    let mut off = Vec::with_capacity(cs.len());
    for c in cs {
        off.push(joined.len());
        joined.push_str(c);
    }
    let mut bounds = HashSet::new();
    let mut p = 0;
    while p < cs.len() {
        let rest = JsString::from_units(&joined.0[off[p]..]);
        p += match THAI_TCC_RE.exec(&rest) {
            Some(m) => m.value(&rest).code_points().count(),
            None => 1,
        };
        bounds.insert(p);
    }
    bounds
}

/// `segmentThai(text, words, maxLen)`.
pub fn segment_thai(text: &JsString, words: &HashSet<JsString>, max_len: usize) -> Vec<JsString> {
    let cs = text.code_point_strings();
    if cs.is_empty() {
        return Vec::new();
    }
    segment_by_dag(&cs, words, max_len, &thai_tcc_boundaries(&cs))
}

/// The seg-words set, or why it could not be loaded (a missing file is an empty set, as the TS `optional`).
pub fn try_words() -> Result<&'static SegWords, String> {
    static WORDS: OnceLock<SegWords> = OnceLock::new();
    load_once(&WORDS, || load_seg_words(DIR).map_err(|e| e.to_string()))
}

/// `segment(text)`: a Thai token into words (one in-dictionary word comes back unchanged).
pub fn segment(text: &JsString) -> Vec<JsString> {
    let w = try_words().unwrap_or_else(|e| panic!("{e}"));
    if w.set.is_empty() {
        return vec![text.clone()];
    }
    segment_thai(text, &w.set, w.max_len)
}
