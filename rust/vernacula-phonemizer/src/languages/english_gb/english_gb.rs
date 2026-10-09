//! English (RP) as a per-word rewrite of the General American reading: non-rhotic, un-flapped, GOAT
//! fronting, the BATH/CLOTH/YOD/PALM/LOT-r/TRAP/MARRY lexical sets and a lexical override table.
//! Ported from src/languages/english-gb/english-gb.ts — see that file for the set evidence.

use std::collections::HashSet;
use std::sync::LazyLock;

use indexmap::IndexMap;

use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::load_tsv::{TsvOptions, load_tsv_map};
use crate::js_re;

pub const DIR: &str = "languages/english-gb";

const VOWEL: &str = "iɪeɛæəɜɐɑɒɔʌʊuoaᵻᶦᶷ";
const SYLLABIC: &str = "\u{0329}";

fn coda() -> String {
    format!("(?![ˈˌ]*(?:[{VOWEL}]|[nmɫlŋ]{SYLLABIC}))")
}

fn pre_nucleus() -> String {
    format!("(?=[ˈˌ]*(?:[{VOWEL}ɚɝ]|[nmɫlŋ]{SYLLABIC}))")
}

fn re(pattern: String) -> JsRegex {
    JsRegex::new(&pattern, "gu").unwrap()
}

struct Patterns {
    nurse_prevocalic: JsRegex,
    letter_prevocalic: JsRegex,
    iglide_r: JsRegex,
    uglide_r: JsRegex,
    near: JsRegex,
    square: JsRegex,
    cure: JsRegex,
    north: JsRegex,
    start: JsRegex,
    coda_r: JsRegex,
}

static P: LazyLock<Patterns> = LazyLock::new(|| Patterns {
    nurse_prevocalic: re(format!("ɝ{}", pre_nucleus())),
    letter_prevocalic: re(format!("ɚ{}", pre_nucleus())),
    iglide_r: re(format!("ᶦɹ{}", coda())),
    uglide_r: re(format!("ᶷɹ{}", coda())),
    near: re(format!("ɪɹ{}", coda())),
    square: re(format!("ɛɹ{}", coda())),
    cure: re(format!("ʊɹ{}", coda())),
    north: re(format!("ɔːɹ{}", coda())),
    start: re(format!("ɑːɹ{}", coda())),
    coda_r: re(format!("ɹ{}", coda())),
});

#[derive(Clone, Debug)]
pub struct LexicalRow {
    pub to: JsString,
    pub from: Option<JsString>,
}

pub struct LexSets {
    pub bath: HashSet<JsString>,
    pub cloth: HashSet<JsString>,
    pub yod: HashSet<JsString>,
    pub palm: HashSet<JsString>,
    pub lotr: HashSet<JsString>,
    pub trap: HashSet<JsString>,
    pub marry: HashSet<JsString>,
    pub lexical: IndexMap<JsString, LexicalRow>,
}

fn load_set(file: &str) -> HashSet<JsString> {
    load_tsv_map(
        DIR,
        file,
        |v, _| Some(v.clone()),
        TsvOptions {
            optional: true,
            ..Default::default()
        },
    )
    .unwrap_or_else(|e| panic!("{e}"))
    .into_keys()
    .collect()
}

pub static SETS: LazyLock<LexSets> = LazyLock::new(|| LexSets {
    bath: load_set("en-gb-bath.tsv"),
    cloth: load_set("en-gb-cloth.tsv"),
    yod: load_set("en-gb-yod.tsv"),
    palm: load_set("en-gb-palm.tsv"),
    lotr: load_set("en-gb-lotr.tsv"),
    trap: load_set("en-gb-trap.tsv"),
    marry: load_set("en-gb-marry.tsv"),
    lexical: load_tsv_map(
        DIR,
        "en-gb-lexical.tsv",
        |v, _| {
            Some(match v.index_of(&js("\t"), 0) {
                None => LexicalRow {
                    to: v.clone(),
                    from: None,
                },
                Some(tab) => LexicalRow {
                    to: v.slice(0, Some(tab as isize)),
                    from: Some(v.slice((tab + 1) as isize, None)),
                },
            })
        },
        TsvOptions {
            optional: true,
            ..Default::default()
        },
    )
    .unwrap_or_else(|e| panic!("{e}")),
});

pub fn to_rp(gen_am: &JsString, word: &JsString, lex: Option<&LexSets>) -> JsString {
    let w = word.to_lower_case();
    let row = lex.and_then(|l| l.lexical.get(&w));
    let lexical = row
        .filter(|r| r.from.as_ref().is_none_or(|f| f == gen_am))
        .map(|r| r.to.clone());
    let none = JsString::new();
    let mut s = lexical.clone().unwrap_or_else(|| gen_am.clone());
    s = js_re!("t̬", "gu").replace(&s, &js("t"));
    s = js_re!("d̬", "gu").replace(&s, &js("d"));
    s = js_re!("oᶷ", "gu").replace(&s, &js("əᶷ"));
    s = js_re!("ʲ", "gu").replace(&s, &none);
    s = P.nurse_prevocalic.replace(&s, &js("ɜːɹ"));
    s = js_re!("ɝ", "gu").replace(&s, &js("ɜː"));
    s = P.letter_prevocalic.replace(&s, &js("əɹ"));
    s = js_re!("ɚ", "gu").replace(&s, &js("ə"));
    if lexical.is_none() && !lex.is_some_and(|l| l.palm.contains(&w)) {
        s = js_re!("ɑː(?!ɹ)", "gu").replace(&s, &js("ɒ"));
    }
    if let (Some(lex), None) = (lex, &lexical) {
        if lex.marry.contains(&w) {
            s = js_re!("ɛ(ˈ|ˌ)?ɹ", "u").replace(&s, &js("æ$1ɹ"));
        }
        if lex.bath.contains(&w) {
            s = js_re!("æ", "u").replace(&s, &js("ɑː"));
        }
        if lex.cloth.contains(&w) {
            s = js_re!("ɔː", "u").replace(&s, &js("ɒ"));
        }
        if lex.yod.contains(&w) {
            s = js_re!("([tdnszθl])(ʰ?)([ˈˌ]?)uː", "u").replace(&s, &js("$1$2j$3uː"));
        }
        if lex.lotr.contains(&w) {
            s = js_re!("[ɑɔ]ːɹ", "u").replace(&s, &js("ɒɹ"));
        }
        if lex.trap.contains(&w) {
            s = js_re!("ɒ", "u").replace(&s, &js("æ"));
        }
    }
    if lexical.is_none()
        && js_re!(r"(ar|er|or)(y|ies)\W?s?$", "u").test(&w)
        && !js_re!(r"story\W?s?$", "u").test(&w)
    {
        s = js_re!("ˌ(?:ɛ|ɔː)(ɹiz?)$", "u").replace(&s, &js("ə$1"));
        s = js_re!("(?<![ˈˌ])(?:ɛ|ɔː)(ɹiz?)$", "u").replace(&s, &js("ə$1"));
    }
    s = P.iglide_r.replace(&s, &js("ᶦə"));
    s = P.uglide_r.replace(&s, &js("ᶷə"));
    s = P.near.replace(&s, &js("ɪə"));
    s = P.square.replace(&s, &js("ɛə"));
    s = P.cure.replace(&s, &js("ʊə"));
    s = P.north.replace(&s, &js("ɔː"));
    s = P.start.replace(&s, &js("ɑː"));
    P.coda_r.replace(&s, &none)
}

/// en-GB as the registry runs it: the shared English engine with this as its word transform.
pub fn rp_word_transform(ipa: &JsString, word: &JsString) -> JsString {
    to_rp(ipa, word, Some(&SETS))
}
