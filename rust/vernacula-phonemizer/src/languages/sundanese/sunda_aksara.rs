//! Aksara Sunda (U+1B80–1BBF) → the Sundanese Latin orthography, so the Latin g2p reads both scripts with identical
//! IPA; plus the script test and the digit fold. Ported from src/languages/sundanese/sundaAksara.ts — see that file
//! for the corpus evidence.

use crate::core::js_string::{JsString, js};
use crate::core::provenance::{Form, normalize};

// Generated from sundaAksara.ts's object literals (key order preserved).
const ONSET: [(&str, &str); 26] = [
    ("ᮊ", "k"),
    ("ᮋ", "q"),
    ("ᮌ", "g"),
    ("ᮍ", "ng"),
    ("ᮎ", "c"),
    ("ᮏ", "j"),
    ("ᮐ", "z"),
    ("ᮑ", "ny"),
    ("ᮒ", "t"),
    ("ᮓ", "d"),
    ("ᮔ", "n"),
    ("ᮕ", "p"),
    ("ᮖ", "f"),
    ("ᮗ", "v"),
    ("ᮘ", "b"),
    ("ᮙ", "m"),
    ("ᮚ", "y"),
    ("ᮛ", "r"),
    ("ᮜ", "l"),
    ("ᮝ", "w"),
    ("ᮞ", "s"),
    ("ᮟ", "x"),
    ("ᮠ", "h"),
    ("ᮮ", "kh"),
    ("ᮯ", "sy"),
    ("ᮽ", "bh"),
];
const INDEP: [(&str, &str); 7] = [
    ("ᮃ", "a"),
    ("ᮄ", "i"),
    ("ᮅ", "u"),
    ("ᮆ", "é"),
    ("ᮇ", "o"),
    ("ᮈ", "e"),
    ("ᮉ", "eu"),
];
const SYLLABIC: [(&str, &str); 2] = [("ᮻ", "reu"), ("ᮼ", "leu")];
const VOWEL_SIGN: [(&str, &str); 6] = [
    ("ᮤ", "i"),
    ("ᮥ", "u"),
    ("ᮦ", "é"),
    ("ᮧ", "o"),
    ("ᮨ", "e"),
    ("ᮩ", "eu"),
];
const MEDIAL: [(&str, &str); 5] = [("ᮡ", "y"), ("ᮢ", "r"), ("ᮣ", "l"), ("ᮬ", "m"), ("ᮭ", "w")];
const FINAL: [(&str, &str); 5] = [("ᮀ", "ng"), ("ᮁ", "r"), ("ᮂ", "h"), ("ᮾ", "k"), ("ᮿ", "m")];
const DIGITS: [(&str, &str); 10] = [
    ("᮰", "0"),
    ("᮱", "1"),
    ("᮲", "2"),
    ("᮳", "3"),
    ("᮴", "4"),
    ("᮵", "5"),
    ("᮶", "6"),
    ("᮷", "7"),
    ("᮸", "8"),
    ("᮹", "9"),
];

/// `VIRAMA`: pamaéh / virama.
const VIRAMA: [&str; 2] = ["᮪", "᮫"];

/// A table keyed by one code point (a lone surrogate reads as U+FFFD, which is no key).
fn get(table: &[(&'static str, &'static str)], c: Option<&JsString>) -> Option<&'static str> {
    let c = c?.to_string_lossy();
    table.iter().find(|(k, _)| *k == c).map(|(_, v)| *v)
}

/// `isAksaraSunda(s)`: any code point in U+1B80–1BBF.
pub fn is_aksara_sunda(s: &JsString) -> bool {
    s.code_points().any(|c| (0x1b80..=0x1bbf).contains(&c))
}

/// `normalizeSundaDigits(s)`: Aksara Sunda digits → ASCII.
pub fn normalize_sunda_digits(s: &JsString) -> JsString {
    let parts: Vec<JsString> = s
        .code_point_strings()
        .into_iter()
        .map(|ch| get(&DIGITS, Some(&ch)).map_or(ch, js))
        .collect();
    JsString::join(&parts, &JsString::new())
}

/// `aksaraToLatin(word)`.
pub fn aksara_to_latin(word: &JsString) -> JsString {
    let s = normalize(word, Form::Nfc).code_point_strings();
    let n = s.len();
    let at = |i: usize| s.get(i);
    let mut out = String::new();
    let mut i = 0;
    let finals = |i: &mut usize, out: &mut String| {
        while *i < n
            && let Some(f) = get(&FINAL, at(*i))
        {
            out.push_str(f);
            *i += 1;
        }
    };
    while i < n {
        let ch = at(i);
        if let Some(o) = get(&ONSET, ch) {
            out.push_str(o);
            i += 1;
            while i < n
                && let Some(m) = get(&MEDIAL, at(i))
            {
                out.push_str(m);
                i += 1;
            }
            if let Some(v) = get(&VOWEL_SIGN, at(i)).filter(|_| i < n) {
                out.push_str(v);
                i += 1;
            } else if i < n && VIRAMA.iter().any(|v| at(i).is_some_and(|c| *c == js(v))) {
                i += 1;
            } else {
                out.push('a');
            }
            finals(&mut i, &mut out);
        } else if let Some(sy) = get(&SYLLABIC, ch) {
            out.push_str(sy);
            i += 1;
            finals(&mut i, &mut out);
        } else if let Some(v) = get(&INDEP, ch) {
            out.push_str(v);
            i += 1;
            finals(&mut i, &mut out);
        } else if let Some(f) = get(&FINAL, ch) {
            out.push_str(f);
            i += 1;
        } else {
            i += 1;
        }
    }
    js(&out)
}
