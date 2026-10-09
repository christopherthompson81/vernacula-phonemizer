//! Language registry: builds each engine once and wraps it in the registry's pre-passes (markup, the
//! encoding repairs, the confusable and digit folds) and its host scope. Ported from src/registry.ts — see
//! that file for why each pass is where it is.
//!
//! ⚠ PARTIAL: only the ported languages are registered. A foreign run routed to an unported engine is
//! recorded in `port_pending()` and dropped, as C#'s `Registry.PortPending` does, so "blocked" reads
//! differently from "wrong".

use std::collections::BTreeSet;
use std::sync::{Arc, Mutex, OnceLock};

use crate::core::foreign::{lookup_foreign_oov, set_default_foreign, with_host};
use crate::core::js_string::{JsString, js};
use crate::core::markup::strip_markup;
use crate::core::unicode::{
    fold_caret_exponents, fold_cyrillic_confusables, fold_cyrillic_stress_marks,
    fold_fullwidth_latin, fold_latin_confusables, fold_native_digits, fold_spaced_dash,
    fold_squared_degrees, fold_subscript_digits, fold_vulgar_fractions, repair_double_encoded,
};
use crate::languages::english::english::{EnglishPhonemizer, create_english};
use crate::languages::english::english_neural::phonemize_en_neural;
use crate::languages::english::english_tagger::{EnglishTagger, load_english_tagger_files};
use crate::languages::english_gb::english_gb::rp_word_transform;

/// `CYRILLIC_HOSTS` (core/scripts.ts).
const CYRILLIC_HOSTS: [&str; 15] = [
    "ab", "ba", "be", "bg", "chv", "kk", "ky", "mk", "mn", "nog", "ru", "sr", "tg", "tt", "uk",
];
const FOLD_OPT_OUT: [&str; 1] = ["te"];
const SPACED_DASH_OPT_OUT: [&str; 6] = ["en", "en-GB", "en-IN", "hmn", "kaa", "ug"];
const VULGAR_FOLD_OPT_OUT: [&str; 10] =
    ["az", "bs", "ca", "el", "ga", "hr", "kn", "mk", "te", "uz"];

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
    let pre = if VULGAR_FOLD_OPT_OUT.contains(&lang) {
        folded
    } else {
        fold_vulgar_fractions(&folded)
    };
    let subs = fold_subscript_digits(&pre);
    let digits = if FOLD_OPT_OUT.contains(&lang) {
        subs
    } else {
        fold_native_digits(&subs)
    };
    if SPACED_DASH_OPT_OUT.contains(&lang) {
        digits
    } else {
        fold_spaced_dash(&digits)
    }
}

/// The languages this build can phonemize.
pub const LANGUAGES: [&str; 2] = ["en", "en-GB"];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PhonemizeError {
    /// No engine for this code in this build (see `LANGUAGES`).
    UnknownLanguage(String),
    /// The language's data could not be read or parsed (a missing or wrong data root). Cached: the engine is
    /// built once per process, so fix the root before the first call (`core::data_source::set_data_root`).
    Data(String),
    /// The neural OOV model failed while running (a missing model is not an error: the best path degrades
    /// to the sync engine, as the TS does, and `tagger_unavailable_reason` says why).
    Neural(String),
}

impl std::fmt::Display for PhonemizeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PhonemizeError::UnknownLanguage(l) => write!(f, "no engine for language: {l}"),
            PhonemizeError::Data(e) => write!(f, "phonemizer data unavailable: {e}"),
            PhonemizeError::Neural(e) => write!(f, "neural OOV model failed: {e}"),
        }
    }
}

impl std::error::Error for PhonemizeError {}

/// en and en-GB share one immutable engine (the TS builds two identical ones).
static ENGLISH: OnceLock<Result<Arc<EnglishPhonemizer>, String>> = OnceLock::new();

pub fn english() -> Result<Arc<EnglishPhonemizer>, PhonemizeError> {
    ENGLISH
        .get_or_init(|| {
            install_foreign_readers();
            create_english().map(Arc::new)
        })
        .clone()
        .map_err(PhonemizeError::Data)
}

static PENDING: Mutex<BTreeSet<String>> = Mutex::new(BTreeSet::new());

/// Targets a foreign run asked for that are not ported yet.
pub fn port_pending() -> Vec<String> {
    PENDING.lock().unwrap().iter().cloned().collect()
}

/// `readAsEnglish`: a Latin run inside another language, read by the English engine in English's scope.
/// Without English data, a delegated run reads as nothing (the TS would have failed to start).
pub fn read_as_english(text: &JsString) -> JsString {
    let Ok(en) = english() else {
        return JsString::new();
    };
    with_host(&js("en"), || {
        en.text_with_oov(&fold_pass("en", text), &|k| lookup_foreign_oov(k))
    })
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
pub fn phonemize_in(lang: &str, input: &JsString) -> Result<JsString, PhonemizeError> {
    let run =
        |f: &dyn Fn(&JsString) -> JsString| with_host(&js(lang), || f(&fold_pass(lang, input)));
    match lang {
        "en" => {
            let en = english()?;
            Ok(run(&|s| en.text(s)))
        }
        "en-GB" => {
            let en = english()?;
            Ok(run(&|s| {
                en.text_full(s, Some(&rp_word_transform), None, false)
            }))
        }
        other => {
            PENDING.lock().unwrap().insert(other.to_string());
            Err(PhonemizeError::UnknownLanguage(other.to_string()))
        }
    }
}

/// The English BiLSTM OOV tagger, or `None` when its files are unreadable or its graph unsupported (the best
/// path then degrades to the sync engine, as the TS does without onnxruntime). `tagger_unavailable_reason`
/// says why.
pub fn english_tagger() -> Option<&'static EnglishTagger> {
    TAGGER.get_or_init(build_english_tagger).as_ref().ok()
}

static TAGGER: OnceLock<Result<EnglishTagger, String>> = OnceLock::new();

pub fn tagger_unavailable_reason() -> Option<String> {
    TAGGER
        .get_or_init(build_english_tagger)
        .as_ref()
        .err()
        .cloned()
}

fn build_english_tagger() -> Result<EnglishTagger, String> {
    let (meta, bytes) = load_english_tagger_files("en-g2p-tagger")?;
    let model = crate::core::neural::OnnxModel::from_bytes(&bytes).map_err(|e| e.to_string())?;
    Ok(EnglishTagger::new(meta, Box::new(model)))
}

/// `phonemizeAsync(text, lang)`: the best available path. For English, the neural OOV tagger.
pub fn phonemize_best_in(lang: &str, input: &JsString) -> Result<JsString, PhonemizeError> {
    let (host, wt): (
        &str,
        Option<crate::languages::english::english::WordTransform>,
    ) = match lang {
        "en" => ("en", None),
        "en-GB" => ("en-GB", Some(&rp_word_transform)),
        other => return phonemize_in(other, input),
    };
    let en = english()?;
    // A tagger error rejects phonemizeAsync in the TS; it is not swallowed into the sync reading here either.
    phonemize_en_neural(&en, english_tagger(), &fold_pass(host, input), host, wt)
        .map_err(PhonemizeError::Neural)
}
