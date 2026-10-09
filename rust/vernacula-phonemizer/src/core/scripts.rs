//! Which script a foreign run is in, and which language reads it from inside a given host.
//! Ported from src/core/scripts.ts — see that file for why each reader is the default it is.

use std::sync::LazyLock;

use super::js_regex::JsRegex;
use super::js_string::{JsString, js};
use super::provenance::{Form, normalize};
use crate::js_re;

const SCRIPTS: [(&str, &str); 34] = [
    ("Latin", r"\p{Script=Latin}"),
    ("Cyrillic", r"\p{Script=Cyrillic}"),
    ("Greek", r"\p{Script=Greek}"),
    ("Kana", r"[\p{Script=Hiragana}\p{Script=Katakana}]"),
    ("Han", r"\p{Script=Han}"),
    ("Hangul", r"\p{Script=Hangul}"),
    ("Arabic", r"\p{Script=Arabic}"),
    ("Hebrew", r"\p{Script=Hebrew}"),
    ("Devanagari", r"\p{Script=Devanagari}"),
    ("Bengali", r"\p{Script=Bengali}"),
    ("Tamil", r"\p{Script=Tamil}"),
    ("Thai", r"\p{Script=Thai}"),
    ("Ethiopic", r"\p{Script=Ethiopic}"),
    ("Armenian", r"\p{Script=Armenian}"),
    ("Georgian", r"\p{Script=Georgian}"),
    ("Myanmar", r"\p{Script=Myanmar}"),
    ("Telugu", r"\p{Script=Telugu}"),
    ("Kannada", r"\p{Script=Kannada}"),
    ("Malayalam", r"\p{Script=Malayalam}"),
    ("Gujarati", r"\p{Script=Gujarati}"),
    ("Gurmukhi", r"\p{Script=Gurmukhi}"),
    ("Oriya", r"\p{Script=Oriya}"),
    ("Sinhala", r"\p{Script=Sinhala}"),
    ("Khmer", r"\p{Script=Khmer}"),
    ("Lao", r"\p{Script=Lao}"),
    ("Tibetan", r"\p{Script=Tibetan}"),
    ("Tifinagh", r"\p{Script=Tifinagh}"),
    ("Cherokee", r"\p{Script=Cherokee}"),
    ("Ol_Chiki", r"\p{Script=Ol_Chiki}"),
    ("Adlam", r"\p{Script=Adlam}"),
    ("Nko", r"\p{Script=Nko}"),
    ("Syloti_Nagri", r"\p{Script=Syloti_Nagri}"),
    ("Javanese", r"\p{Script=Javanese}"),
    ("Sundanese", r"\p{Script=Sundanese}"),
];

static SCRIPT_TESTS: LazyLock<Vec<(&'static str, JsRegex)>> = LazyLock::new(|| {
    SCRIPTS
        .iter()
        .map(|(n, p)| (*n, JsRegex::new(p, "u").unwrap()))
        .collect()
});

pub const DEFAULT_READER: [(&str, &str); 34] = [
    ("Greek", "el"),
    ("Hangul", "ko"),
    ("Thai", "th"),
    ("Hebrew", "he"),
    ("Armenian", "hy"),
    ("Georgian", "ka"),
    ("Myanmar", "my"),
    ("Ethiopic", "am"),
    ("Kana", "ja"),
    ("Latin", "en"),
    ("Cyrillic", "ru"),
    ("Arabic", "ar"),
    ("Devanagari", "hi"),
    ("Bengali", "bn"),
    ("Tamil", "ta"),
    ("Han", "cmn"),
    ("Telugu", "te"),
    ("Kannada", "kn"),
    ("Malayalam", "ml"),
    ("Gujarati", "gu"),
    ("Gurmukhi", "pa"),
    ("Oriya", "or"),
    ("Sinhala", "si"),
    ("Khmer", "km"),
    ("Lao", "lo"),
    ("Tibetan", "bo"),
    ("Tifinagh", "shi"),
    ("Cherokee", "chr"),
    ("Ol_Chiki", "sat"),
    ("Adlam", "ff"),
    ("Nko", "bm"),
    ("Syloti_Nagri", "syl"),
    ("Javanese", "jv"),
    ("Sundanese", "su"),
];

/// (host, script, reader)
pub const OVERRIDES: [(&str, &str, &str); 9] = [
    ("ja", "Han", "ja"),
    ("ko", "Han", "ko"),
    ("yue", "Han", "yue"),
    ("uk", "Cyrillic", "uk"),
    ("sr", "Cyrillic", "sr"),
    ("fa", "Arabic", "fa"),
    ("ur", "Arabic", "ur"),
    ("mr", "Devanagari", "mr"),
    ("ne", "Devanagari", "ne"),
];

pub const MANIFESTLESS_SCRIPTS: [(&str, &[&str]); 20] = [
    ("acm", &["Arabic"]),
    ("acw", &["Arabic"]),
    ("afb", &["Arabic"]),
    ("ajp", &["Arabic"]),
    ("apc", &["Arabic"]),
    ("apd", &["Arabic"]),
    ("ary", &["Arabic"]),
    ("arz", &["Arabic"]),
    ("ayl", &["Arabic"]),
    ("en-GB", &["Latin"]),
    ("en-IN", &["Latin"]),
    ("es-419", &["Latin"]),
    ("fr-CA", &["Latin"]),
    ("pt-BR", &["Latin"]),
    ("ms", &["Latin"]),
    ("zsm", &["Latin"]),
    ("bgc", &["Devanagari"]),
    ("pnb", &["Arabic"]),
    ("skr", &["Arabic"]),
    ("pbt", &["Arabic"]),
];

pub const CYRILLIC_HOSTS: [&str; 15] = [
    "ab", "ba", "be", "bg", "chv", "kk", "ky", "mk", "mn", "nog", "ru", "sr", "tg", "tt", "uk",
];

pub fn script_of(run: &JsString) -> Option<&'static str> {
    SCRIPT_TESTS
        .iter()
        .find(|(_, re)| re.test(run))
        .map(|(n, _)| *n)
}

const GREEK_LETTER_NAME: [(&str, &str); 25] = [
    ("α", "άλφα"),
    ("β", "βήτα"),
    ("γ", "γάμμα"),
    ("δ", "δέλτα"),
    ("ε", "έψιλον"),
    ("ζ", "ζήτα"),
    ("η", "ήτα"),
    ("θ", "θήτα"),
    ("ι", "ιώτα"),
    ("κ", "κάππα"),
    ("λ", "λάμδα"),
    ("μ", "μι"),
    ("ν", "νι"),
    ("ξ", "ξι"),
    ("ο", "όμικρον"),
    ("π", "πι"),
    ("ρ", "ρο"),
    ("σ", "σίγμα"),
    ("ς", "σίγμα"),
    ("τ", "ταυ"),
    ("υ", "ύψιλον"),
    ("φ", "φι"),
    ("χ", "χι"),
    ("ψ", "ψι"),
    ("ω", "ωμέγα"),
];

fn lone_greek_letter_name(run: &JsString) -> Option<(JsString, JsString)> {
    let greek = js_re!(r"\p{Script=Greek}", "u");
    let mark = js_re!(r"\p{M}", "u");
    let letters: Vec<JsString> = run
        .code_point_strings()
        .into_iter()
        .filter(|c| greek.test(c) && !mark.test(c))
        .collect();
    if letters.len() != 1 {
        return None;
    }
    let letter = letters[0].clone();
    let nfd = normalize(&letter, Form::Nfd);
    if nfd.len() != 1 {
        return None;
    }
    let lower = nfd.to_lower_case();
    let name = GREEK_LETTER_NAME.iter().find(|(k, _)| lower == *k)?.1;
    Some((letter, js(name)))
}

/// The reader for `run` inside `host`: its language and the text to give it; `None` if no script is known or
/// the host reads it itself.
pub fn reader_for(run: &JsString, host: &str) -> Option<(&'static str, JsString)> {
    let script = script_of(run)?;
    let mut text = run.clone();
    if script == "Greek"
        && run
            .code_point_strings()
            .iter()
            .filter(|c| js_re!(r"\p{Script=Greek}", "u").test(c))
            .count()
            < 2
    {
        let (letter, name) = lone_greek_letter_name(run)?;
        // `run.replace(letter, name)`: the FIRST occurrence.
        if let Some(at) = text.index_of(&letter, 0) {
            text = text
                .slice(0, Some(at as isize))
                .concat(&name)
                .concat(&text.slice((at + letter.len()) as isize, None));
        }
    }
    let target = OVERRIDES
        .iter()
        .find(|(h, s, _)| *h == host && *s == script)
        .map(|(_, _, r)| *r)
        .or_else(|| {
            DEFAULT_READER
                .iter()
                .find(|(s, _)| *s == script)
                .map(|(_, r)| *r)
        })?;
    (target != host).then_some((target, text))
}
