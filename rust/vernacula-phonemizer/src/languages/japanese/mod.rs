pub mod counters;
pub mod japanese;
pub mod kana;
pub mod kanji;
pub mod manifest;
pub mod normalize;
pub mod numbers;
pub mod pitch;

use crate::core::js_string::JsString;
use crate::js_re;

pub(crate) use crate::core::data_source::load_once;

/// `String.fromCodePoint(cp)`.
pub(crate) fn from_code_point(cp: u32) -> JsString {
    match char::from_u32(cp) {
        Some(c) => {
            let mut buf = [0u16; 2];
            JsString::from_units(c.encode_utf16(&mut buf))
        }
        None => JsString(vec![cp as u16]),
    }
}

/// `s[0]` as a string (the first CODE UNIT), or `None` for "".
pub(crate) fn first_unit(s: &JsString) -> Option<JsString> {
    s.0.first().map(|&u| JsString(vec![u]))
}

/// Shift every code point in `lo..=hi` by `delta`, leaving the rest (lone surrogates included) alone.
fn shift_range(s: &JsString, lo: u32, hi: u32, delta: i32) -> JsString {
    let mut out = JsString::new();
    for c in s.code_points() {
        let c = if (lo..=hi).contains(&c) {
            (c as i32 + delta) as u32
        } else {
            c
        };
        out.push_str(&from_code_point(c));
    }
    out
}

/// Hiragana → katakana: `s.replace(/[ぁ-ゖ]/gu, c => +0x60)` (japanese.ts, normalize.ts).
pub(crate) fn to_katakana(s: &JsString) -> JsString {
    shift_range(s, 0x3041, 0x3096, 0x60)
}

/// Katakana ァ..ヶ → hiragana: the fold kana.ts writes as a loop and normalize.ts / pitch.ts as
/// `/[ァ-ヶ]/gu`. The long mark ー (U+30FC) is outside the range and stays.
pub(crate) fn to_hiragana(s: &JsString) -> JsString {
    shift_range(s, 0x30a1, 0x30f6, -0x60)
}

/// `s.replace(KANA_ONLY, "")`: strip everything the reading pass left that is not kana.
pub(crate) fn strip_non_kana(s: &JsString) -> JsString {
    js_re!(r"[^ぁ-ゖァ-ヺー]", "gu").replace(s, &JsString::new())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::js_regex::JsRegex;

    /// The shifts must equal the TS regex replaces they stand in for, over the whole BMP plus an astral and
    /// a lone surrogate.
    #[test]
    fn folds_match_the_ts_patterns() {
        let mut s: Vec<u16> = (0x3000..0x3100).collect();
        s.extend([0xD842, 0xDFB7, 0xD842, 0x61]);
        let s = JsString(s);
        let by_re = |pat: &str, d: i32| {
            JsRegex::new(pat, "gu").unwrap().replace_with(&s, |m, s| {
                from_code_point((m.value(s).code_point_at(0).unwrap() as i32 + d) as u32)
            })
        };
        assert_eq!(to_katakana(&s), by_re("[ぁ-ゖ]", 0x60));
        assert_eq!(to_hiragana(&s), by_re("[ァ-ヶ]", -0x60));
    }
}
