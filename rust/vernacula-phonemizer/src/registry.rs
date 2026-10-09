//! Language registry: builds each engine once and wraps it in the registry's pre-passes (the Roman-numeral
//! pass, markup, the encoding repairs, the confusable and digit folds) and its host scope. Ported from
//! src/registry.ts and src/neuralRegistry.ts — see those files for why each pass is where it is.
//!
//! ⚠ PARTIAL: only the ported languages are registered. A foreign run routed to an unported engine is
//! recorded in `port_pending()` and dropped, as C#'s `Registry.PortPending` does, so "blocked" reads
//! differently from "wrong".
//!
//! ADDING A LANGUAGE: implement `Engine` for it, add one arm to `build` (and to `roman_policy` if it has its
//! own), and add its code to `LANGUAGES`. Nothing else in this file changes.

use std::collections::{BTreeSet, HashMap};
use std::sync::{Arc, Mutex, OnceLock};

use crate::core::foreign::{lookup_foreign_oov, set_default_foreign, set_script_reader, with_host};
use crate::core::js_string::{JsString, js};
use crate::core::markup::strip_markup;
use crate::core::roman::{RomanPolicy, normalize_romans, roman_exclusions};
use crate::core::scripts::{CYRILLIC_HOSTS, reader_for};
use crate::core::unicode::{
    fold_caret_exponents, fold_cyrillic_confusables, fold_cyrillic_stress_marks,
    fold_fullwidth_latin, fold_latin_confusables, fold_native_digits, fold_spaced_dash,
    fold_squared_degrees, fold_subscript_digits, fold_vulgar_fractions, repair_double_encoded,
};
use crate::languages::english::english::{EnglishPhonemizer, WordTransform, create_english};
use crate::languages::english::english_neural::{phonemize_en_neural, prewarm_foreign_english};
use crate::languages::english::english_tagger::{EnglishTagger, load_english_tagger_files};
use crate::languages::english_gb::english_gb::rp_word_transform;

/// The languages this build can phonemize.
pub const LANGUAGES: [&str; 2] = ["en", "en-GB"];

/// A language engine, as the registry holds it.
pub trait Engine: Send + Sync {
    /// The engine's own `text()`: the registry has already applied its pre-passes and host scope.
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError>;

    /// The neural best path (`neuralRegistry.ts`), given the PRE-PASSED text; `None` if the language has none,
    /// and `best` is then exactly `phonemize`. It runs its own host scope, as the TS neural entries do.
    fn neural(&self, _pre_passed: &JsString) -> Option<Result<JsString, PhonemizeError>> {
        None
    }

    /// Whether `neural` is implemented: the best path pre-passes the text only for an engine that uses it.
    fn has_neural(&self) -> bool {
        false
    }
}

/// `build(lang)`: one arm per ported language.
fn build(lang: &str) -> Option<Result<Arc<dyn Engine>, PhonemizeError>> {
    let english = |variant: EnglishVariant| -> Result<Arc<dyn Engine>, PhonemizeError> {
        Ok(Arc::new(EnglishEngine {
            en: english()?,
            variant,
        }))
    };
    Some(match lang {
        "en" => english(EnglishVariant::Us),
        "en-GB" => english(EnglishVariant::Gb),
        _ => return None,
    })
}

/// `ROMAN_POLICIES[lang] ?? { exclude: ROMAN_EXCLUSIONS[lang] }`. One arm per language with its own: a `match`
/// rather than a table, because a policy holds a compiled regex and an ordinal closure, which no `const` can.
fn roman_policy(lang: &str) -> RomanPolicy {
    match lang {
        _ => RomanPolicy {
            exclude: roman_exclusions(lang),
            ..Default::default()
        },
    }
}

/// Languages whose own normalizer reads Roman numerals, so the registry's pass is skipped.
const ROMAN_NATIVE: [&str; 5] = ["en", "en-GB", "en-IN", "fr", "fr-CA"];

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

/// `romanPass`: the Roman-numeral pass, skipped for a language that reads them itself.
pub fn roman_pass(lang: &str, input: &JsString) -> JsString {
    if ROMAN_NATIVE.contains(&lang) {
        return input.clone();
    }
    normalize_romans(input, &roman_policy(lang))
}

/// `prePass` (registry.ts): what the neural entries receive.
pub fn pre_pass(lang: &str, input: &JsString) -> JsString {
    fold_pass(lang, &roman_pass(lang, input))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PhonemizeError {
    /// No engine for this code in this build (see `LANGUAGES`).
    UnknownLanguage(String),
    /// The language's data could not be read or parsed (a missing or wrong data root). Not cached: a later
    /// call retries the build, as the TS `getPhonemizer` does when `build` throws.
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

/// `getPhonemizer(lang)`'s cache. Only a BUILT engine is cached: an unknown code or a failed build is not,
/// so a caller's bad codes cannot grow it and a fixed data root takes effect on the next call (the TS caches
/// nothing when `build` throws).
fn engine(lang: &str) -> Result<Arc<dyn Engine>, PhonemizeError> {
    static CACHE: Mutex<Option<HashMap<String, Arc<dyn Engine>>>> = Mutex::new(None);
    install_foreign_readers();
    if let Some(hit) = CACHE.lock().unwrap().as_ref().and_then(|c| c.get(lang)) {
        return Ok(hit.clone());
    }
    // Built OUTSIDE the lock: an engine's build may phonemize through another engine.
    let built =
        build(lang).unwrap_or_else(|| Err(PhonemizeError::UnknownLanguage(lang.to_string())))?;
    Ok(CACHE
        .lock()
        .unwrap()
        .get_or_insert_with(HashMap::new)
        .entry(lang.to_string())
        .or_insert(built)
        .clone())
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
        // `setScriptReader`: a non-Latin run goes to its script's reader. The TS CATCHES a reader that throws
        // and drops the run; an unported reader is that case here, recorded so "blocked" is visible.
        set_script_reader(Arc::new(|run, host| {
            let (target, text) = reader_for(run, &host.to_string_lossy())?;
            if target == "en" {
                return Some(read_as_english(&text));
            }
            match phonemize_in(target, &text) {
                Ok(ipa) => Some(ipa),
                Err(PhonemizeError::UnknownLanguage(t)) => {
                    PENDING.lock().unwrap().insert(t);
                    None
                }
                Err(_) => None,
            }
        }));
    });
}

/// `getPhonemizer(lang).text(input)`: Roman pass, then fold pass and engine inside the host scope.
pub fn phonemize_in(lang: &str, input: &JsString) -> Result<JsString, PhonemizeError> {
    let e = engine(lang)?;
    let s = roman_pass(lang, input);
    with_host(&js(lang), || e.text(&fold_pass(lang, &s)))
}

/// `MIXED_LATIN` (index.ts): a Latin run inside a non-Latin script, which the host will delegate to English.
fn mixed_latin(text: &JsString) -> bool {
    crate::js_re!(r"\p{Script=Latin}", "u").test(text)
        && crate::js_re!(
            r"[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Arabic}\p{Script=Cyrillic}\p{Script=Devanagari}\p{Script=Tamil}\p{Script=Ethiopic}\p{Script=Hebrew}\p{Script=Bengali}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Gujarati}\p{Script=Gurmukhi}\p{Script=Sinhala}\p{Script=Khmer}\p{Script=Lao}\p{Script=Myanmar}\p{Script=Georgian}\p{Script=Armenian}\p{Script=Greek}\p{Script=Tibetan}\p{Script=Oriya}\p{Script=Thaana}\p{Script=Syriac}\p{Script=Cherokee}]",
            "u"
        )
        .test(text)
}

/// `phonemizeAsync(text, lang)`: the best available path.
pub fn phonemize_best_in(lang: &str, input: &JsString) -> Result<JsString, PhonemizeError> {
    // FOREIGN RUNS FIRST (index.ts): every host but `en` prewarms the foreign-OOV memo from a mixed-script
    // text, on the raw text, and a failure never takes the utterance down. Before the engine is resolved, as
    // in the TS, where an unknown language throws only after the prewarm.
    if lang != "en" && mixed_latin(input) {
        if let Ok(en) = english() {
            let _ = prewarm_foreign_english(&en, english_tagger(), input);
        }
    }
    let e = engine(lang)?;
    if !e.has_neural() {
        return phonemize_in(lang, input);
    }
    e.neural(&pre_pass(lang, input))
        .unwrap_or_else(|| phonemize_in(lang, input))
}

// ── English ──────────────────────────────────────────────────────────────────────────────────────────

/// en and en-GB share one immutable engine (the TS builds two identical ones). A failed build is retried.
pub fn english() -> Result<Arc<EnglishPhonemizer>, PhonemizeError> {
    static ENGLISH: Mutex<Option<Arc<EnglishPhonemizer>>> = Mutex::new(None);
    if let Some(en) = ENGLISH.lock().unwrap().as_ref() {
        return Ok(en.clone());
    }
    let built = Arc::new(create_english().map_err(PhonemizeError::Data)?);
    Ok(ENGLISH.lock().unwrap().get_or_insert(built).clone())
}

#[derive(Clone, Copy)]
enum EnglishVariant {
    Us,
    Gb,
}

struct EnglishEngine {
    en: Arc<EnglishPhonemizer>,
    variant: EnglishVariant,
}

impl EnglishEngine {
    fn host_and_transform(&self) -> (&'static str, Option<WordTransform<'static>>) {
        match self.variant {
            EnglishVariant::Us => ("en", None),
            EnglishVariant::Gb => ("en-GB", Some(&rp_word_transform)),
        }
    }
}

impl Engine for EnglishEngine {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        let (_, wt) = self.host_and_transform();
        Ok(self.en.text_full(input, wt, None, false))
    }

    fn has_neural(&self) -> bool {
        true
    }

    fn neural(&self, pre_passed: &JsString) -> Option<Result<JsString, PhonemizeError>> {
        let (host, wt) = self.host_and_transform();
        // A tagger error rejects phonemizeAsync in the TS; it is not swallowed into the sync reading here either.
        Some(
            phonemize_en_neural(&self.en, english_tagger(), pre_passed, host, wt)
                .map_err(PhonemizeError::Neural),
        )
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
    EnglishTagger::new(meta, Box::new(model))
}
