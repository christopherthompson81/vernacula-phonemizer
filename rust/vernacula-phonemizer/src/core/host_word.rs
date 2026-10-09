//! A host language's word run (its scripts' letters, marks medially, never a digit) and the nativiser that
//! folds a foreign letter a host cannot read onto its Latin base. Ported from src/core/hostWord.ts.

use std::sync::LazyLock;

use super::js_regex::JsRegex;
use super::js_string::{JsString, js};
use super::provenance::{Form, normalize};
use super::trace::note_nativised;
use crate::js_re;

/// The word-run pattern for `scripts` (`ScriptName`s, e.g. "Latin"), with `extra` letters anywhere and
/// `medial_only` ones after the first. Errors as the TS throws: when the class does not compile.
pub fn host_word_run(scripts: &[&str], extra: &str, medial_only: &str) -> Result<String, String> {
    let letters: String = scripts
        .iter()
        .map(|s| format!("\\p{{Script={s}}}"))
        .collect();
    let nd = "(?!\\p{Nd})";
    let run = format!("{nd}[{letters}{extra}](?:{nd}[{letters}\\p{{M}}{extra}{medial_only}])*");
    JsRegex::new(&run, "u").map_err(|e| {
        format!(
            "hostWordRun: extra={extra:?} medialOnly={medial_only:?} does not form a valid character class \
             (put a literal \"-\" LAST; a range like \"а-ш\" is fine as written): {e}"
        )
    })?;
    Ok(run)
}

pub static LATIN_RUN: LazyLock<String> =
    LazyLock::new(|| host_word_run(&["Latin"], "", "").unwrap());

/// Insertion order is the TS object's: it builds the character class.
/// Generated from the TS object (key order preserved): never hand-typed.
const UNDECOMPOSABLE: [(&str, &str); 43] = [
    ("\u{e6}", "a"),
    ("\u{c6}", "A"),
    ("\u{153}", "o"),
    ("\u{152}", "O"),
    ("\u{f8}", "o"),
    ("\u{d8}", "O"),
    ("\u{f0}", "d"),
    ("\u{d0}", "D"),
    ("\u{fe}", "t"),
    ("\u{de}", "T"),
    ("\u{df}", "ss"),
    ("\u{142}", "l"),
    ("\u{141}", "L"),
    ("\u{111}", "d"),
    ("\u{110}", "D"),
    ("\u{127}", "h"),
    ("\u{126}", "H"),
    ("\u{14b}", "n"),
    ("\u{14a}", "N"),
    ("\u{25b}", "e"),
    ("\u{190}", "E"),
    ("\u{254}", "o"),
    ("\u{186}", "O"),
    ("\u{259}", "e"),
    ("\u{18f}", "E"),
    ("\u{253}", "b"),
    ("\u{181}", "B"),
    ("\u{257}", "d"),
    ("\u{18a}", "D"),
    ("\u{199}", "k"),
    ("\u{198}", "K"),
    ("\u{1b4}", "y"),
    ("\u{1b3}", "Y"),
    ("\u{131}", "i"),
    ("\u{289}", "u"),
    ("\u{268}", "i"),
    ("\u{180}", "b"),
    ("\u{167}", "t"),
    ("\u{17f}", "s"),
    ("\u{192}", "f"),
    ("\u{191}", "F"),
    ("\u{261}", "g"),
    ("\u{a7ac}", "G"),
];
static UNDECOMPOSABLE_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let keys: String = UNDECOMPOSABLE.iter().map(|(k, _)| *k).collect();
    JsRegex::new(&format!("[{keys}]"), "gu").unwrap()
});

pub fn fold_latin_to_base(w: &JsString) -> JsString {
    let d = normalize(w, Form::Nfd);
    let stripped = js_re!(r"\p{M}+", "gu").replace(&d, &JsString::new());
    let c = normalize(&stripped, Form::Nfc);
    UNDECOMPOSABLE_RE.replace_with(&c, |m, s| {
        let ch = m.value(s);
        UNDECOMPOSABLE
            .iter()
            .find(|(k, _)| ch == *k)
            .map_or(ch, |(_, v)| js(v))
    })
}

/// The nativiser: a word wholly in `native_class` passes; otherwise each cluster outside it is folded.
pub fn make_nativiser(
    native_class: &str,
    flags: &str,
) -> impl Fn(&JsString) -> JsString + Send + Sync + use<> {
    let in_class = JsRegex::new(&format!("^(?:{native_class})+$"), flags).unwrap();
    move |w: &JsString| {
        let known = |s: &JsString| in_class.test(&normalize(s, Form::Nfc));
        if known(w) {
            return w.clone();
        }
        let mut out = JsString::new();
        for m in js_re!(r"\P{M}\p{M}*", "gu").match_all(w) {
            let c = m.value(w);
            out.push_str(&if known(&c) { c } else { fold_latin_to_base(&c) });
        }
        note_nativised(w, &out);
        out
    }
}
