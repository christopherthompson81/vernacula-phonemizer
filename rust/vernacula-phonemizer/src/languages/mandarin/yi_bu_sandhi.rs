//! 一 / 不 tone sandhi on segmented single-character tokens, in place.
//! Ported from src/languages/mandarin/yiBuSandhi.ts — see that file for the corpus evidence.

use super::segment::Token;
use crate::core::js_string::{JsString, js, js_number};
use crate::js_re;

fn tone_of(py: &JsString) -> f64 {
    match js_re!(r"([1-5])$").exec(py) {
        Some(m) => js_number(&m.group(1, py).unwrap()),
        None => 5.0,
    }
}

fn set_tone(py: &JsString, t: u8) -> JsString {
    js_re!(r"[1-5]?$").replace(py, &js(&t.to_string()))
}

/// `applyYiBuSandhi(tokens)`.
pub fn apply_yi_bu_sandhi(tokens: &mut [Token]) {
    let (yi, bu, di) = (js("一"), js("不"), js("第"));
    for i in 0..tokens.len() {
        let src = match &tokens[i].src {
            Some(s) if *s == yi || *s == bu => s.clone(),
            _ => continue,
        };
        // 0 = no following syllable
        let next_tone = tokens.get(i + 1).map_or(0.0, |n| tone_of(&n.py));
        if src == bu {
            tokens[i].py = set_tone(&tokens[i].py, if next_tone == 4.0 { 2 } else { 4 });
            continue;
        }
        let ordinal = i > 0 && tokens[i - 1].src.as_ref() == Some(&di);
        let t = if next_tone == 0.0 || ordinal {
            1
        } else if next_tone == 4.0 {
            2
        } else {
            4
        };
        tokens[i].py = set_tone(&tokens[i].py, t);
    }
}
