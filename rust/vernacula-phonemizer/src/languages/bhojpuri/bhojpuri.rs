//! Native Bhojpuri (bho) phonemizer: the shared Hindi Devanagari engine (`makeNativeHindi`) driven by
//! `bhojpuri.jsonc`, with Hindi's normalizer and symbol tier inherited. Ported from
//! src/languages/bhojpuri/bhojpuri.ts — see that file for the corpus evidence.

use std::sync::{Arc, OnceLock};

use crate::core::phonology::load_shared_phonology;
use crate::languages::hindi::hindi::{
    AbugidaScript, ForeignPhonemizer, NativeHindi, Overrides, make_native_hindi,
};
use crate::languages::hindi::manifest::{HindiDef, load_family_def};
use crate::registry::{Engine, PhonemizeError, read_as_english};

/// `createBhojpuri(foreign)`.
pub fn create_bhojpuri(foreign: Option<ForeignPhonemizer>) -> Result<NativeHindi, String> {
    static DEF: OnceLock<HindiDef> = OnceLock::new();
    make_native_hindi(
        load_family_def(&DEF, "bhojpuri")?,
        load_shared_phonology()?,
        foreign,
        AbugidaScript::default(),
        None,
        Overrides::default(),
    )
}

/// The registry's `bho` arm: `createBhojpuri(readAsEnglish)`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    let foreign: ForeignPhonemizer = Arc::new(read_as_english);
    Ok(Arc::new(
        create_bhojpuri(Some(foreign)).map_err(PhonemizeError::Data)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::js_string::js;

    /// Every literal-argument engine call in test/bhojpuri.test.ts, with the TS engine's reading (its `toBe`
    /// literals cross-checked against it), extracted mechanically rather than typed.
    #[rustfmt::skip]
    const PINS: &[(&str, &str, &str, &str)] = &[
        // BEGIN GENERATED PINS
        ("word", "bho", "बैल", "bˈɛl"),
        ("word", "bho", "कौन", "kˈɔn"),
        ("word", "bho", "किताब", "kˈit̪ɑb"),
        ("word", "bho", "पानी", "pˈɑni"),
        ("word", "bho", "देश", "d̪ˈes"),
        ("word", "bho", "विशाल", "wˈisɑl"),
        ("word", "bho", "गणेश", "ɡˈənes"),
        ("word", "bho", "शहर", "sˈəɦəɾ"),
        ("word", "bho", "करऽ", "kˈəɾə"),
        ("word", "bho", "कर", "kˈəɾ"),
        ("word", "bho", "देखऽ", "d̪ˈekʰə"),
        ("word", "bho", "खइलऽ", "kʰˈəilə"),
        ("text", "bho", "कृष्ण", "kɾˈisn"),
        ("text", "bho", "ऋषि", "ɾˈisi"),
        ("text", "bho", "वृत्त", "wɾˈit̪ː"),
        ("text", "bho", "कर", "kˈəɾ"),
        ("text", "bho", "कृष्ण ऋषि कर", "kɾˈisn ɾˈisi kˈəɾ"),
        // END GENERATED PINS
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        let e = create_bhojpuri(None).unwrap();
        for (op, lang, input, want) in PINS {
            let got = match *op {
                "word" => e.word(&js(input)).to_string_lossy(),
                _ => crate::phonemize(input, lang).unwrap(),
            };
            assert_eq!(got.trim(), *want, "{op} {lang} {input}");
        }
    }
}
