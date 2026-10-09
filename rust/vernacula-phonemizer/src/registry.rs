//! Language registry: builds each engine once and wraps it in the registry's pre-passes (markup, the
//! encoding repairs, the confusable and digit folds) and its host scope. Ported from src/registry.ts — see
//! that file for why each pass is where it is.
//!
//! ⚠ PARTIAL: only the ported languages are registered. A foreign run routed to an unported engine is
//! recorded in `port_pending()` and dropped, as C#'s `Registry.PortPending` does, so "blocked" reads
//! differently from "wrong".

use std::collections::BTreeSet;
use std::sync::{Arc, LazyLock, Mutex, OnceLock};

use crate::core::foreign::{lookup_foreign_oov, set_default_foreign, with_host};
use crate::core::js_string::{JsString, js};
use crate::core::markup::strip_markup;
use crate::core::unicode::{
    fold_caret_exponents, fold_cyrillic_confusables, fold_cyrillic_stress_marks, fold_fullwidth_latin, fold_latin_confusables,
    fold_native_digits, fold_spaced_dash, fold_squared_degrees, fold_subscript_digits, fold_vulgar_fractions, repair_double_encoded,
};
use crate::languages::english::english::{EnglishPhonemizer, create_english};
use crate::languages::english::english_neural::phonemize_en_neural;
use crate::languages::english::english_tagger::EnglishTagger;
use crate::languages::english_gb::english_gb::rp_word_transform;

/// `CYRILLIC_HOSTS` (core/scripts.ts).
const CYRILLIC_HOSTS: [&str; 15] = ["ab", "ba", "be", "bg", "chv", "kk", "ky", "mk", "mn", "nog", "ru", "sr", "tg", "tt", "uk"];
const FOLD_OPT_OUT: [&str; 1] = ["te"];
const SPACED_DASH_OPT_OUT: [&str; 6] = ["en", "en-GB", "en-IN", "hmn", "kaa", "ug"];
const VULGAR_FOLD_OPT_OUT: [&str; 10] = ["az", "bs", "ca", "el", "ga", "hr", "kn", "mk", "te", "uz"];

/// The registry's fold pre-pass for `lang`.
pub fn fold_pass(lang: &str, input: &JsString) -> JsString {
    let s = strip_markup(input);
    let s = repair_double_encoded(&s);
    let s = fold_squared_degrees(&s);
    let s = fold_fullwidth_latin(&s);
    let s = fold_cyrillic_confusables(&s, CYRILLIC_HOSTS.contains(&lang));
    let s = fold_latin_confusables(&s);
    let s = fold_caret_exponents(&s);
    let folded = fold_cyrillic_stress_marks(&s);
    let pre = if VULGAR_FOLD_OPT_OUT.contains(&lang) { folded } else { fold_vulgar_fractions(&folded) };
    let subs = fold_subscript_digits(&pre);
    let digits = if FOLD_OPT_OUT.contains(&lang) { subs } else { fold_native_digits(&subs) };
    if SPACED_DASH_OPT_OUT.contains(&lang) { digits } else { fold_spaced_dash(&digits) }
}

/// The languages this build can phonemize.
pub const LANGUAGES: [&str; 2] = ["en", "en-GB"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UnknownLanguage(pub String);

impl std::fmt::Display for UnknownLanguage {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "no engine for language: {}", self.0)
    }
}

impl std::error::Error for UnknownLanguage {}

/// en and en-GB share one immutable engine (the TS builds two identical ones).
static ENGLISH: LazyLock<Arc<EnglishPhonemizer>> = LazyLock::new(|| {
    install_foreign_readers();
    Arc::new(create_english())
});

pub fn english() -> Arc<EnglishPhonemizer> {
    ENGLISH.clone()
}

static PENDING: Mutex<BTreeSet<String>> = Mutex::new(BTreeSet::new());

/// Targets a foreign run asked for that are not ported yet.
pub fn port_pending() -> Vec<String> {
    PENDING.lock().unwrap().iter().cloned().collect()
}

/// `readAsEnglish`: a Latin run inside another language, read by the English engine in English's scope.
pub fn read_as_english(text: &JsString) -> JsString {
    let en = english();
    with_host(&js("en"), || en.text_with_oov(&fold_pass("en", text), &|k| lookup_foreign_oov(k)))
}

fn install_foreign_readers() {
    static ONCE: OnceLock<()> = OnceLock::new();
    ONCE.get_or_init(|| {
        set_default_foreign(Arc::new(read_as_english));
        // The script reader (core/scripts.ts `readerFor`) routes a non-Latin run to its script's engine.
        // No such engine is ported yet, so none is installed: a run is dropped, as the TS drops one whose
        // engine throws. TODO(#1463): port scripts.ts with the first non-Latin language.
    });
}

/// `getPhonemizer(lang).text(input)`.
pub fn phonemize_in(lang: &str, input: &JsString) -> Result<JsString, UnknownLanguage> {
    let run = |f: &dyn Fn(&JsString) -> JsString| with_host(&js(lang), || f(&fold_pass(lang, input)));
    match lang {
        "en" => {
            let en = english();
            Ok(run(&|s| en.text(s)))
        }
        "en-GB" => {
            let en = english();
            Ok(run(&|s| en.text_full(s, Some(&rp_word_transform), None, false)))
        }
        other => {
            PENDING.lock().unwrap().insert(other.to_string());
            Err(UnknownLanguage(other.to_string()))
        }
    }
}

/// The English BiLSTM OOV tagger, or `None` when its model cannot be built (the best path then degrades to
/// the sync engine, as the TS does without onnxruntime). TODO(#1463): built from `core::neural` once the
/// runtime lands; until then there is no runtime and this is always `None`.
pub fn english_tagger() -> Option<&'static EnglishTagger> {
    static TAGGER: OnceLock<Option<EnglishTagger>> = OnceLock::new();
    TAGGER.get_or_init(|| None).as_ref()
}

/// `phonemizeAsync(text, lang)`: the best available path. For English, the neural OOV tagger.
pub fn phonemize_best_in(lang: &str, input: &JsString) -> Result<JsString, UnknownLanguage> {
    let en = english();
    let tagger = english_tagger();
    let render = |host: &str, wt: Option<crate::languages::english::english::WordTransform>| {
        // A tagger error rejects phonemizeAsync in the TS; it is not swallowed into the sync reading here either.
        phonemize_en_neural(&en, tagger, &fold_pass(host, input), host, wt).unwrap_or_else(|e| panic!("English tagger: {e}"))
    };
    match lang {
        "en" => Ok(render("en", None)),
        "en-GB" => Ok(render("en-GB", Some(&rp_word_transform))),
        other => phonemize_in(other, input),
    }
}
