//! Shared DAG maximal-matching for the spaceless-script segmenters (Thai, Burmese, …): the fewest dictionary
//! words, every boundary inside the language's legal set, and out-of-dictionary runs coalesced into one token.
//! Ported from src/core/segment.ts — see that file for the corpus evidence.

use std::collections::HashSet;

use super::data_source::DataError;
use super::js_string::JsString;
use super::load_tsv::load_lines;

/// The words of `seg-words.txt` and the longest one's length in code points.
pub struct SegWords {
    pub set: HashSet<JsString>,
    pub max_len: usize,
}

/// `loadSegWords(metaUrl)`: `seg-words.txt` in `dir`, trimmed, empties dropped (optional file). `max_len`
/// starts at 1, as the TS `reduce` does.
pub fn load_seg_words(dir: &str) -> Result<SegWords, DataError> {
    let set: HashSet<JsString> = load_lines(dir, "seg-words.txt", true)?
        .iter()
        .map(JsString::trim)
        .filter(|l| !l.is_empty())
        .collect();
    let max_len = set
        .iter()
        .map(|w| w.code_points().count())
        .fold(1, usize::max);
    Ok(SegWords { set, max_len })
}

/// `segmentByDag(cs, words, maxLen, bound)`. `cs` is the run as code-point strings.
pub fn segment_by_dag(
    cs: &[JsString],
    words: &HashSet<JsString>,
    max_len: usize,
    bound: &HashSet<usize>,
) -> Vec<JsString> {
    let n = cs.len();
    if n == 0 {
        return Vec::new();
    }
    // Unit offset of each code point, so `cs.slice(i, j).join("")` is one slice of the joined run.
    let mut joined = JsString::new();
    let mut off = Vec::with_capacity(n + 1);
    for c in cs {
        off.push(joined.len());
        joined.push_str(c);
    }
    off.push(joined.len());
    let piece = |i: usize, j: usize| JsString::from_units(&joined.0[off[i]..off[j]]);

    let is_start = |i: usize| i == 0 || bound.contains(&i);
    let mut dp = vec![f64::INFINITY; n + 1];
    let mut next = vec![usize::MAX; n + 1];
    dp[n] = 0.0;
    for i in (0..n).rev() {
        if !is_start(i) {
            continue;
        }
        for len in 1..=max_len.min(n - i) {
            let j = i + len;
            if !bound.contains(&j) {
                continue;
            }
            if words.contains(&piece(i, j)) && dp[j] + 1.0 < dp[i] {
                dp[i] = dp[j] + 1.0;
                next[i] = j;
            }
        }
        if dp[i] == f64::INFINITY {
            let mut j = i + 1;
            while j < n && !bound.contains(&j) {
                j += 1;
            }
            dp[i] = dp[j] + 1.0;
            next[i] = j;
        }
    }
    let mut out = Vec::new();
    let mut i = 0;
    while i < n {
        let j = next[i];
        if !words.contains(&piece(i, j)) {
            let mut k = j;
            while k < n {
                let nk = next[k];
                if words.contains(&piece(k, nk)) {
                    break;
                }
                k = nk;
            }
            out.push(piece(i, k));
            i = k;
        } else {
            out.push(piece(i, j));
            i = j;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn cps(s: &str) -> Vec<JsString> {
        JsString::from(s).code_point_strings()
    }

    #[test]
    fn fewest_words_within_boundaries_and_oov_coalesces() {
        let words: HashSet<JsString> = ["ab", "abc", "cd", "d"]
            .into_iter()
            .map(JsString::from)
            .collect();
        let all: HashSet<usize> = (1..=6).collect();
        // A tie (ab·cd and abc·d) keeps the first, shorter word: the comparison is strict.
        let got = segment_by_dag(&cps("abcdxy"), &words, 3, &all);
        assert_eq!(got, ["ab", "cd", "xy"].map(JsString::from));
        // Without a boundary at 2, `ab` cannot end there.
        let no2: HashSet<usize> = [1, 3, 4, 5, 6].into_iter().collect();
        let got = segment_by_dag(&cps("abcdxy"), &words, 3, &no2);
        assert_eq!(got, ["abc", "d", "xy"].map(JsString::from));
        assert!(segment_by_dag(&[], &words, 3, &all).is_empty());
    }
}
