//! Language registry: builds each engine once and wraps it in the registry's pre-passes (the Roman-numeral
//! pass, markup, the encoding repairs, the confusable and digit folds) and its host scope. Ported from
//! src/registry.ts and src/neuralRegistry.ts — see those files for why each pass is where it is.
//!
//! ⚠ PARTIAL: only the ported languages are registered. A foreign run routed to an unported engine is
//! recorded in `port_pending()` and dropped, as C#'s `Registry.PortPending` does, so "blocked" reads
//! differently from "wrong".
//!
//! ADDING A LANGUAGE: implement `Engine` for it, add one arm to `build` (and to `roman_policy` if it has its
//! own), and add its code to `LANGUAGES`, each under `#[cfg(feature = "<code>")]`. Then give the code a feature
//! in Cargo.toml (and in `default`), and gate its module in `languages/mod.rs` on every feature that uses it.
//!
//! FEATURES: with a language's feature off, its arms compile out and its code is an `UnknownLanguage`, as a
//! code this crate never had is. A foreign run routed to it is then dropped and listed in `port_pending()`.

use std::collections::{BTreeSet, HashMap};
use std::sync::{Arc, Mutex, OnceLock};

use crate::core::foreign::{lookup_foreign_oov, set_default_foreign, set_script_reader, with_host};
use crate::core::js_string::{JsString, js};
use crate::core::markup::strip_markup;
use crate::core::roman::{RomanPolicy, normalize_romans, roman_exclusions};
use crate::core::scripts::{CYRILLIC_HOSTS, reader_for};
use crate::core::unicode::{
    fold_caret_exponents, fold_cyrillic_confusables, fold_cyrillic_stress_marks,
    fold_fullwidth_latin, fold_historic_forms, fold_latin_confusables, fold_native_digits,
    fold_spaced_dash, fold_squared_degrees, fold_subscript_digits, fold_vulgar_fractions,
    repair_double_encoded,
};
use crate::languages::english::english::{EnglishPhonemizer, WordTransform, create_english};
use crate::languages::english::english_neural::{phonemize_en_neural, prewarm_foreign_english};
use crate::languages::english::english_tagger::{EnglishTagger, load_english_tagger_files};
#[cfg(feature = "en-GB")]
use crate::languages::english_gb::english_gb::rp_word_transform;
#[cfg(feature = "en-IN")]
use crate::languages::english_in::english_in::indian_word_transform;
#[cfg(feature = "pt")]
use crate::languages::portuguese::g2p::Dialect;
#[cfg(feature = "pt")]
use crate::languages::portuguese::portuguese::create_portuguese;
#[cfg(feature = "pt")]
use crate::languages::portuguese::roman_ordinals::roman_policy as pt_roman_policy;
#[cfg(feature = "pt-BR")]
use crate::languages::portuguese_br::portuguese_br::create_portuguese_br;
#[cfg(feature = "pt-BR")]
use crate::languages::portuguese_br::roman_ordinals::roman_policy as pt_br_roman_policy;

/// The languages this build can phonemize, one per golden. `zsm` (ISO 639-3 Standard Malay) is also built, as the
/// same engine as `ms`, but has no golden of its own, so it is not listed.
pub const LANGUAGES: &[&str] = &[
    "en",
    #[cfg(feature = "en-GB")]
    "en-GB",
    #[cfg(feature = "ja")]
    "ja",
    #[cfg(feature = "it")]
    "it",
    #[cfg(feature = "es")]
    "es",
    #[cfg(feature = "pt")]
    "pt",
    #[cfg(feature = "pt-BR")]
    "pt-BR",
    #[cfg(feature = "hi")]
    "hi",
    #[cfg(feature = "cmn")]
    "cmn",
    #[cfg(feature = "fr")]
    "fr",
    #[cfg(feature = "el")]
    "el",
    #[cfg(feature = "ko")]
    "ko",
    #[cfg(feature = "th")]
    "th",
    #[cfg(feature = "ru")]
    "ru",
    #[cfg(feature = "de")]
    "de",
    #[cfg(feature = "pl")]
    "pl",
    #[cfg(feature = "tr")]
    "tr",
    #[cfg(feature = "nl")]
    "nl",
    #[cfg(feature = "uk")]
    "uk",
    #[cfg(feature = "sv")]
    "sv",
    #[cfg(feature = "sr")]
    "sr",
    #[cfg(feature = "hr")]
    "hr",
    #[cfg(feature = "bs")]
    "bs",
    #[cfg(feature = "sl")]
    "sl",
    #[cfg(feature = "lt")]
    "lt",
    #[cfg(feature = "lv")]
    "lv",
    #[cfg(feature = "es-419")]
    "es-419",
    #[cfg(feature = "fr-CA")]
    "fr-CA",
    #[cfg(feature = "en-IN")]
    "en-IN",
    #[cfg(feature = "ca")]
    "ca",
    #[cfg(feature = "gl")]
    "gl",
    #[cfg(feature = "ro")]
    "ro",
    #[cfg(feature = "id")]
    "id",
    #[cfg(feature = "ms")]
    "ms",
    #[cfg(feature = "tl")]
    "tl",
    #[cfg(feature = "ceb")]
    "ceb",
    #[cfg(feature = "hil")]
    "hil",
    #[cfg(feature = "ilo")]
    "ilo",
    #[cfg(feature = "cs")]
    "cs",
    #[cfg(feature = "sk")]
    "sk",
    #[cfg(feature = "be")]
    "be",
    #[cfg(feature = "bg")]
    "bg",
    #[cfg(feature = "mk")]
    "mk",
    #[cfg(feature = "bho")]
    "bho",
    #[cfg(feature = "mag")]
    "mag",
    #[cfg(feature = "awa")]
    "awa",
    #[cfg(feature = "mai")]
    "mai",
    #[cfg(feature = "hne")]
    "hne",
    #[cfg(feature = "rkt")]
    "rkt",
    #[cfg(feature = "ne")]
    "ne",
    #[cfg(feature = "mr")]
    "mr",
    #[cfg(feature = "fi")]
    "fi",
    #[cfg(feature = "et")]
    "et",
    #[cfg(feature = "hu")]
    "hu",
    #[cfg(feature = "is")]
    "is",
    #[cfg(feature = "fo")]
    "fo",
    #[cfg(feature = "az")]
    "az",
    #[cfg(feature = "kk")]
    "kk",
    #[cfg(feature = "ky")]
    "ky",
    #[cfg(feature = "uz")]
    "uz",
    #[cfg(feature = "tk")]
    "tk",
    #[cfg(feature = "tt")]
    "tt",
    #[cfg(feature = "da")]
    "da",
    #[cfg(feature = "nb")]
    "nb",
    #[cfg(feature = "af")]
    "af",
    #[cfg(feature = "lb")]
    "lb",
    #[cfg(feature = "bar")]
    "bar",
    #[cfg(feature = "ba")]
    "ba",
    #[cfg(feature = "crh")]
    "crh",
    #[cfg(feature = "kaa")]
    "kaa",
    #[cfg(feature = "nog")]
    "nog",
    #[cfg(feature = "chv")]
    "chv",
    #[cfg(feature = "tg")]
    "tg",
    #[cfg(feature = "cy")]
    "cy",
    #[cfg(feature = "ga")]
    "ga",
    #[cfg(feature = "gd")]
    "gd",
    #[cfg(feature = "eu")]
    "eu",
    #[cfg(feature = "sq")]
    "sq",
    #[cfg(feature = "ast")]
    "ast",
    #[cfg(feature = "an")]
    "an",
    #[cfg(feature = "oc")]
    "oc",
    #[cfg(feature = "bn")]
    "bn",
    #[cfg(feature = "as")]
    "as",
    #[cfg(feature = "bpy")]
    "bpy",
    #[cfg(feature = "syl")]
    "syl",
    #[cfg(feature = "or")]
    "or",
    #[cfg(feature = "kn")]
    "kn",
    #[cfg(feature = "te")]
    "te",
    #[cfg(feature = "ta")]
    "ta",
    #[cfg(feature = "ml")]
    "ml",
    #[cfg(feature = "si")]
    "si",
    #[cfg(feature = "vi")]
    "vi",
    #[cfg(feature = "lo")]
    "lo",
    #[cfg(feature = "my")]
    "my",
    #[cfg(feature = "jv")]
    "jv",
    #[cfg(feature = "su")]
    "su",
    #[cfg(feature = "mad")]
    "mad",
    #[cfg(feature = "zu")]
    "zu",
    #[cfg(feature = "xh")]
    "xh",
    #[cfg(feature = "st")]
    "st",
    #[cfg(feature = "tn")]
    "tn",
    #[cfg(feature = "nso")]
    "nso",
    #[cfg(feature = "sn")]
    "sn",
    #[cfg(feature = "sw")]
    "sw",
    #[cfg(feature = "rw")]
    "rw",
    #[cfg(feature = "rn")]
    "rn",
    #[cfg(feature = "lg")]
    "lg",
    #[cfg(feature = "ln")]
    "ln",
    #[cfg(feature = "nya")]
    "nya",
    #[cfg(feature = "yo")]
    "yo",
    #[cfg(feature = "ig")]
    "ig",
    #[cfg(feature = "ha")]
    "ha",
    #[cfg(feature = "ee")]
    "ee",
    #[cfg(feature = "ak")]
    "ak",
    #[cfg(feature = "wo")]
    "wo",
];

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
        #[cfg(feature = "en-GB")]
        "en-GB" => english(EnglishVariant::Gb),
        #[cfg(feature = "en-IN")]
        "en-IN" => english(EnglishVariant::In),
        #[cfg(feature = "ja")]
        "ja" => crate::languages::japanese::japanese::create_japanese()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "it")]
        "it" => crate::languages::italian::italian::create_italian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "es")]
        "es" => crate::languages::spanish::spanish::create_spanish(false)
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "pt")]
        "pt" => create_portuguese(Dialect::Ep, None).map(|e| e as Arc<dyn Engine>),
        #[cfg(feature = "pt-BR")]
        "pt-BR" => create_portuguese_br().map(|e| e as Arc<dyn Engine>),
        #[cfg(feature = "hi")]
        "hi" => crate::languages::hindi::hindi::engine(),
        #[cfg(feature = "cmn")]
        "cmn" => {
            crate::languages::mandarin::mandarin::create_mandarin(Some(Arc::new(read_as_english)))
                .map(|m| Arc::new(m) as Arc<dyn Engine>)
                .map_err(PhonemizeError::Data)
        }
        #[cfg(feature = "fr")]
        "fr" => crate::languages::french::french::create_french()
            .map(|fr| Arc::new(FrenchEngine(fr)) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "el")]
        "el" => crate::languages::greek::greek::create_greek()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "ko")]
        "ko" => crate::languages::korean::korean::create_korean()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "th")]
        "th" => crate::languages::thai::thai::create_thai()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "ru")]
        "ru" => crate::languages::russian::russian::create_russian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "de")]
        "de" => crate::languages::german::german::create_german()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "pl")]
        "pl" => crate::languages::polish::polish::create_polish()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "tr")]
        "tr" => crate::languages::turkish::turkish::create_turkish()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "nl")]
        "nl" => crate::languages::dutch::dutch::create_dutch()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "uk")]
        "uk" => crate::languages::ukrainian::ukrainian::create_ukrainian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "sv")]
        "sv" => crate::languages::swedish::swedish::create_swedish()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "id")]
        "id" => crate::languages::indonesian::indonesian::create_indonesian(Some(Arc::new(
            read_as_english,
        )))
        .map(|e| Arc::new(e) as Arc<dyn Engine>)
        .map_err(PhonemizeError::Data),
        #[cfg(feature = "ms")]
        "ms" | "zsm" => {
            crate::languages::malay::malay::create_malay(Some(Arc::new(read_as_english)))
                .map(|e| Arc::new(e) as Arc<dyn Engine>)
                .map_err(PhonemizeError::Data)
        }
        #[cfg(feature = "tl")]
        "tl" => crate::languages::tagalog::tagalog::create_tagalog()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "ceb")]
        "ceb" => crate::languages::cebuano::cebuano::create_cebuano()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "hil")]
        "hil" => crate::languages::hiligaynon::hiligaynon::create_hiligaynon()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "ilo")]
        "ilo" => crate::languages::ilocano::ilocano::create_ilocano()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "sr")]
        "sr" => crate::languages::serbian::serbian::create_serbian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "hr")]
        "hr" => crate::languages::croatian::croatian::create_croatian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "bs")]
        "bs" => crate::languages::bosnian::bosnian::create_bosnian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "sl")]
        "sl" => crate::languages::slovenian::slovenian::create_slovenian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "lt")]
        "lt" => crate::languages::lithuanian::lithuanian::create_lithuanian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "lv")]
        "lv" => crate::languages::latvian::latvian::create_latvian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "es-419")]
        "es-419" => crate::languages::spanish_419::spanish_419::create_spanish_419()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "fr-CA")]
        "fr-CA" => crate::languages::french_ca::french_ca::create_french_ca()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "ca")]
        "ca" => crate::languages::catalan::catalan::create_catalan()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "gl")]
        "gl" => crate::languages::galician::galician::create_galician()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "ro")]
        "ro" => crate::languages::romanian::romanian::create_romanian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "cs")]
        "cs" => crate::languages::czech::czech::create_czech()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "sk")]
        "sk" => crate::languages::slovak::slovak::create_slovak()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "be")]
        "be" => crate::languages::belarusian::belarusian::create_belarusian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "bg")]
        "bg" => crate::languages::bulgarian::bulgarian::create_bulgarian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "mk")]
        "mk" => crate::languages::macedonian::macedonian::create_macedonian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "bho")]
        "bho" => crate::languages::bhojpuri::bhojpuri::engine(),
        #[cfg(feature = "mag")]
        "mag" => crate::languages::magahi::magahi::engine(),
        #[cfg(feature = "awa")]
        "awa" => crate::languages::awadhi::awadhi::engine(),
        #[cfg(feature = "mai")]
        "mai" => crate::languages::maithili::maithili::engine(),
        #[cfg(feature = "hne")]
        "hne" => crate::languages::chhattisgarhi::chhattisgarhi::engine(),
        #[cfg(feature = "rkt")]
        "rkt" => crate::languages::rangpuri::rangpuri::engine(),
        #[cfg(feature = "ne")]
        "ne" => crate::languages::nepali::nepali::engine(),
        #[cfg(feature = "mr")]
        "mr" => crate::languages::marathi::marathi::engine(),
        #[cfg(feature = "fi")]
        "fi" => crate::languages::finnish::finnish::create_finnish()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "et")]
        "et" => crate::languages::estonian::estonian::create_estonian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "hu")]
        "hu" => crate::languages::hungarian::hungarian::create_hungarian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "is")]
        "is" => crate::languages::icelandic::icelandic::create_icelandic()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "fo")]
        "fo" => crate::languages::faroese::faroese::create_faroese()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "az")]
        "az" => crate::languages::azerbaijani::azerbaijani::create_azerbaijani()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "kk")]
        "kk" => crate::languages::kazakh::kazakh::create_kazakh()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "ky")]
        "ky" => crate::languages::kyrgyz::kyrgyz::create_kyrgyz()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "uz")]
        "uz" => crate::languages::uzbek::uzbek::create_uzbek()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "tk")]
        "tk" => crate::languages::turkmen::turkmen::create_turkmen()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "tt")]
        "tt" => crate::languages::tatar::tatar::create_tatar()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "da")]
        "da" => crate::languages::danish::danish::create_danish()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "nb")]
        "nb" => crate::languages::norwegian::norwegian::create_norwegian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "af")]
        "af" => crate::languages::afrikaans::afrikaans::create_afrikaans()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "lb")]
        "lb" => crate::languages::luxembourgish::luxembourgish::create_luxembourgish()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "bar")]
        "bar" => crate::languages::bavarian::bavarian::create_bavarian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "ba")]
        "ba" => crate::languages::bashkir::bashkir::create_bashkir()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "crh")]
        "crh" => crate::languages::crimeantatar::crimeantatar::create_crimean_tatar()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "kaa")]
        "kaa" => crate::languages::karakalpak::karakalpak::create_karakalpak()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "nog")]
        "nog" => crate::languages::nogai::nogai::create_nogai()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "chv")]
        "chv" => crate::languages::chuvash::chuvash::create_chuvash()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "tg")]
        "tg" => crate::languages::tajik::tajik::create_tajik()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "cy")]
        "cy" => crate::languages::welsh::welsh::create_welsh()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "ga")]
        "ga" => crate::languages::irish::irish::create_irish()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "gd")]
        "gd" => crate::languages::scottishgaelic::scottishgaelic::create_scottish_gaelic()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "eu")]
        "eu" => crate::languages::basque::basque::create_basque()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "sq")]
        "sq" => crate::languages::albanian::albanian::create_albanian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "ast")]
        "ast" => crate::languages::asturian::asturian::create_asturian()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "an")]
        "an" => crate::languages::aragonese::aragonese::create_aragonese()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "oc")]
        "oc" => crate::languages::occitan::occitan::create_occitan()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "bn")]
        "bn" => crate::languages::bengali::bengali::engine(),
        #[cfg(feature = "as")]
        "as" => crate::languages::assamese::assamese::engine(),
        #[cfg(feature = "bpy")]
        "bpy" => crate::languages::bishnupriya::bishnupriya::engine(),
        #[cfg(feature = "syl")]
        "syl" => crate::languages::sylheti::sylheti::engine(),
        #[cfg(feature = "or")]
        "or" => crate::languages::odia::odia::engine(),
        #[cfg(feature = "kn")]
        "kn" => crate::languages::kannada::kannada::engine(),
        #[cfg(feature = "te")]
        "te" => crate::languages::telugu::telugu::engine(),
        #[cfg(feature = "ta")]
        "ta" => crate::languages::tamil::tamil::engine(),
        #[cfg(feature = "ml")]
        "ml" => crate::languages::malayalam::malayalam::engine(),
        #[cfg(feature = "si")]
        "si" => crate::languages::sinhala::sinhala::engine(),
        #[cfg(feature = "vi")]
        "vi" => crate::languages::vietnamese::vietnamese::create_vietnamese(Some(Arc::new(
            read_as_english,
        )))
        .map(|e| Arc::new(e) as Arc<dyn Engine>)
        .map_err(PhonemizeError::Data),
        #[cfg(feature = "lo")]
        "lo" => crate::languages::lao::lao::create_lao()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "my")]
        "my" => crate::languages::burmese::burmese::create_burmese(Some(Arc::new(read_as_english)))
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "jv")]
        "jv" => crate::languages::javanese::javanese::create_javanese()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "su")]
        "su" => crate::languages::sundanese::sundanese::create_sundanese()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "mad")]
        "mad" => crate::languages::madurese::madurese::create_madurese()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "zu")]
        "zu" => crate::languages::zulu::zulu::create_zulu(
            Some(Arc::new(read_as_english)),
            Some(Arc::new(|w: &JsString| {
                crate::registry::english().is_ok_and(|en| en.known_word(w).is_some())
            })),
        )
        .map(|e| Arc::new(e) as Arc<dyn Engine>)
        .map_err(PhonemizeError::Data),
        #[cfg(feature = "xh")]
        "xh" => crate::languages::xhosa::xhosa::create_xhosa(
            Some(Arc::new(read_as_english)),
            Some(Arc::new(|w: &JsString| {
                crate::registry::english().is_ok_and(|en| en.known_word(w).is_some())
            })),
        )
        .map(|e| Arc::new(e) as Arc<dyn Engine>)
        .map_err(PhonemizeError::Data),
        #[cfg(feature = "st")]
        "st" => crate::languages::sesotho::sesotho::create_sesotho()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "tn")]
        "tn" => crate::languages::setswana::setswana::create_setswana()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "nso")]
        "nso" => crate::languages::sepedi::sepedi::create_sepedi()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "sn")]
        "sn" => crate::languages::shona::shona::create_shona()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "sw")]
        "sw" => crate::languages::swahili::swahili::create_swahili()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "rw")]
        "rw" => crate::languages::kinyarwanda::kinyarwanda::create_kinyarwanda()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "rn")]
        "rn" => crate::languages::kirundi::kirundi::create_kirundi()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "lg")]
        "lg" => crate::languages::luganda::luganda::create_luganda()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "ln")]
        "ln" => crate::languages::lingala::lingala::create_lingala()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "nya")]
        "nya" => crate::languages::chichewa::chichewa::create_chichewa()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "yo")]
        "yo" => crate::languages::yoruba::yoruba::create_yoruba(Some(Arc::new(read_as_english)))
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "ig")]
        "ig" => crate::languages::igbo::igbo::create_igbo()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "ha")]
        "ha" => crate::languages::hausa::hausa::create_hausa()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "ee")]
        "ee" => crate::languages::ewe::ewe::create_ewe()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "ak")]
        "ak" => crate::languages::akan::akan::create_akan()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        #[cfg(feature = "wo")]
        "wo" => crate::languages::wolof::wolof::create_wolof()
            .map(|e| Arc::new(e) as Arc<dyn Engine>)
            .map_err(PhonemizeError::Data),
        _ => return None,
    })
}

/// `ROMAN_POLICIES[lang] ?? { exclude: ROMAN_EXCLUSIONS[lang] }`. One arm per language with its own: a `match`
/// rather than a table, because a policy holds a compiled regex and an ordinal closure, which no `const` can.
fn roman_policy(lang: &str) -> RomanPolicy {
    match lang {
        #[cfg(feature = "it")]
        "it" => crate::languages::italian::roman_ordinals::roman_policy(),
        #[cfg(feature = "es")]
        "es" => crate::languages::spanish::roman_ordinals::roman_policy(),
        #[cfg(feature = "es-419")]
        "es-419" => crate::languages::spanish_419::roman_ordinals::roman_policy(),
        #[cfg(feature = "ca")]
        "ca" => crate::languages::catalan::roman_ordinals::roman_policy(),
        #[cfg(feature = "ro")]
        "ro" => crate::languages::romanian::roman_ordinals::roman_policy(),
        #[cfg(feature = "pt")]
        "pt" => pt_roman_policy(),
        #[cfg(feature = "pt-BR")]
        "pt-BR" => pt_br_roman_policy(),
        #[cfg(feature = "ru")]
        "ru" => crate::languages::russian::roman_ordinals::roman_policy(),
        #[cfg(feature = "pl")]
        "pl" => crate::languages::polish::roman_ordinals::roman_policy(),
        #[cfg(feature = "uk")]
        "uk" => crate::languages::ukrainian::roman_ordinals::roman_policy(),
        #[cfg(feature = "be")]
        "be" => crate::languages::belarusian::roman_ordinals::roman_policy(),
        #[cfg(feature = "hu")]
        "hu" => crate::languages::hungarian::roman_ordinals::roman_policy(),
        #[cfg(feature = "az")]
        "az" => crate::languages::azerbaijani::roman_ordinals::roman_policy(),
        #[cfg(feature = "kk")]
        "kk" => crate::languages::kazakh::roman_ordinals::roman_policy(),
        #[cfg(feature = "uz")]
        "uz" => crate::languages::uzbek::roman_ordinals::roman_policy(),
        #[cfg(feature = "tk")]
        "tk" => crate::languages::turkmen::roman_ordinals::roman_policy(),
        #[cfg(feature = "tt")]
        "tt" => crate::languages::tatar::roman_ordinals::roman_policy(),
        #[cfg(feature = "ba")]
        "ba" => crate::languages::bashkir::roman_ordinals::roman_policy(),
        #[cfg(feature = "chv")]
        "chv" => crate::languages::chuvash::roman_ordinals::roman_policy(),
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
    let s = fold_historic_forms(&s);
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
    normalize_romans(input, &cached_roman_policy(lang))
}

/// `roman_policy(lang)`, built once per language: a policy compiles its context regexes, and the TS builds
/// `ROMAN_POLICIES` once at module load.
fn cached_roman_policy(lang: &str) -> Arc<RomanPolicy> {
    static CACHE: Mutex<Option<HashMap<String, Arc<RomanPolicy>>>> = Mutex::new(None);
    if let Some(p) = CACHE.lock().unwrap().as_ref().and_then(|c| c.get(lang)) {
        return p.clone();
    }
    let built = Arc::new(roman_policy(lang));
    CACHE
        .lock()
        .unwrap()
        .get_or_insert_with(HashMap::new)
        .entry(lang.to_string())
        .or_insert(built)
        .clone()
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
    /// The TS engine THROWS on this input, so the port returns an error rather than a reading. Its first
    /// producer, Hindi's ordinal rule on a 309-digit run, was fixed TS-first to decline above 2^53 (#1463), and
    /// so were Tagalog's `ika-` ordinal (#1534) and Czech's inflected ordinal outside 1–999 (#1535). Nothing
    /// produces it today; it stays so that a future TS throw has a typed home rather than a panic.
    Input(String),
}

impl std::fmt::Display for PhonemizeError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            PhonemizeError::UnknownLanguage(l) => write!(f, "no engine for language: {l}"),
            PhonemizeError::Data(e) => write!(f, "phonemizer data unavailable: {e}"),
            PhonemizeError::Neural(e) => write!(f, "neural OOV model failed: {e}"),
            PhonemizeError::Input(e) => write!(f, "input the engine cannot read: {e}"),
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
    #[cfg(feature = "en-GB")]
    Gb,
    #[cfg(feature = "en-IN")]
    In,
}

struct EnglishEngine {
    en: Arc<EnglishPhonemizer>,
    variant: EnglishVariant,
}

impl EnglishEngine {
    fn host_and_transform(&self) -> (&'static str, Option<WordTransform<'static>>) {
        match self.variant {
            EnglishVariant::Us => ("en", None),
            #[cfg(feature = "en-GB")]
            EnglishVariant::Gb => ("en-GB", Some(&rp_word_transform)),
            #[cfg(feature = "en-IN")]
            EnglishVariant::In => ("en-IN", Some(&indian_word_transform)),
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
    let (meta, model) = load_english_tagger_files("en-g2p-tagger")?;
    EnglishTagger::new(meta, model)
}

// ── French ───────────────────────────────────────────────────────────────────────────────────────────

/// Why the French BiLSTM OOV tagger is unavailable (the fr best path then serves the sync reading), or `None`.
#[cfg(feature = "fr")]
pub fn french_tagger_unavailable_reason() -> Option<String> {
    crate::languages::french::french_tagger::french_tagger_unavailable_reason()
}

#[cfg(feature = "fr")]
struct FrenchEngine(crate::languages::french::french::FrenchPhonemizer);

#[cfg(feature = "fr")]
impl Engine for FrenchEngine {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(self.0.text(input, None))
    }

    fn neural(&self, pre_passed: &JsString) -> Option<Result<JsString, PhonemizeError>> {
        use crate::languages::french::{
            french_neural::phonemize_fr_neural, french_tagger::french_tagger,
        };
        Some(
            phonemize_fr_neural(&self.0, french_tagger(), pre_passed)
                .map_err(PhonemizeError::Neural),
        )
    }

    fn has_neural(&self) -> bool {
        true
    }
}

/// A language whose feature is off is an unknown code. Runs only in a build without `de`, e.g.
/// `cargo test --no-default-features --features en-GB`.
#[cfg(all(test, not(feature = "de")))]
mod feature_off_tests {
    use super::*;

    #[test]
    fn a_language_without_its_feature_is_unknown() {
        assert!(!LANGUAGES.contains(&"de"));
        assert_eq!(
            phonemize_in("de", &js("Haus")).err(),
            Some(PhonemizeError::UnknownLanguage("de".to_string()))
        );
    }
}
