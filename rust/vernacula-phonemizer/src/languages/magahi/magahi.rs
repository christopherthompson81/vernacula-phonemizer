//! Native Magahi (mag) phonemizer: the shared Hindi Devanagari engine (`makeNativeHindi`) driven by
//! `magahi.jsonc`, with Hindi's normalizer and symbol tier inherited. Ported from
//! src/languages/magahi/magahi.ts — see that file for the corpus evidence.

use std::sync::{Arc, OnceLock};

use crate::core::phonology::load_shared_phonology;
use crate::languages::hindi::hindi::{
    AbugidaScript, ForeignPhonemizer, NativeHindi, Overrides, make_native_hindi,
};
use crate::languages::hindi::manifest::{HindiDef, load_family_def};
use crate::registry::{Engine, PhonemizeError, read_as_english};

/// `createMagahi(foreign)`.
pub fn create_magahi(foreign: Option<ForeignPhonemizer>) -> Result<NativeHindi, String> {
    static DEF: OnceLock<HindiDef> = OnceLock::new();
    make_native_hindi(
        load_family_def(&DEF, "magahi")?,
        load_shared_phonology()?,
        foreign,
        AbugidaScript::default(),
        None,
        Overrides::default(),
    )
}

/// The registry's `mag` arm: `createMagahi(readAsEnglish)`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    let foreign: ForeignPhonemizer = Arc::new(read_as_english);
    Ok(Arc::new(
        create_magahi(Some(foreign)).map_err(PhonemizeError::Data)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::js_string::js;

    /// Every literal-argument engine call in test/magahi.test.ts, with the TS engine's reading (its `toBe`
    /// literals cross-checked against it), extracted mechanically rather than typed.
    #[rustfmt::skip]
    const PINS: &[(&str, &str, &str, &str)] = &[
        // BEGIN GENERATED PINS
        ("word", "mag", "वंश", "bˈə̃s"),
        ("word", "mag", "यंत्र", "d͡ʒˈə̃n̪t̪ɾ"),
        ("word", "mag", "विशाल", "bˈisɑl"),
        ("word", "bho", "वंश", "wˈə̃s"),
        ("word", "mag", "देश", "d̪ˈes"),
        ("word", "mag", "बैल", "bˈɛl"),
        ("word", "mag", "गणेश", "ɡˈənes"),
        ("word", "bho", "देश", "d̪ˈes"),
        ("text", "mag", "५८० nm", "pˈɑ̃t͡ʃ sˈɔ ˈʌsːi nˈɛnomiʈəɾ"),
        ("text", "mag", "कृष्ण", "kɾˈisn"),
        ("text", "mag", "ऋषि", "ɾˈisi"),
        ("text", "mag", "कर", "kˈəɾ"),
        ("text", "mag", "कृष्ण ऋषि कर", "kɾˈisn ɾˈisi kˈəɾ"),
        ("text", "mag", "१७मा शताब्दी", "sət̪ɾˈəɦmɑ sət̪ˈɑbd̪i"),
        ("text", "mag", "१०मा बेर", "d̪ˈəsmɑ bˈeɾ"),
        ("text", "mag", "२३मा मुख्यमन्त्री", "t̪eˈismɑ mukʰd͡ʒəmˈənt̪ɾi"),
        ("text", "mag", "स्थल मा भद्रकाली", "st̪ʰˈəl mˈɑ bʱˈəd̪ɾəkɑli"),
        ("text", "mag", "१६वीं सदी", "solˈəɦbĩ sˈəd̪i"),
        ("text", "mag", "१ला", "pˈəɦlɑ"),
        ("text", "mag", "२रा", "d̪ˈusɾɑ"),
        ("text", "mag", "२था", "d̪ˈo t̪ʰˈɑ"),
        ("text", "mag", "२राज्य", "d̪ˈo ɾˈɑd͡ʒː"),
        ("text", "mag", "१० वापस", "d̪ˈəs bˈɑpəs"),
        ("word", "mag", "पाण्डव", "pˈɑnɖəb"),
        ("word", "mag", "महाकाव्य", "məɦɑkˈɑbd͡ʒ"),
        ("word", "mag", "भारतीय", "bʱˈɑɾt̪id͡ʒ"),
        // END GENERATED PINS
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        let e = create_magahi(None).unwrap();
        let bho = crate::languages::bhojpuri::bhojpuri::create_bhojpuri(None).unwrap();
        for (op, lang, input, want) in PINS {
            let got = match *op {
                "word" if *lang == "bho" => bho.word(&js(input)).to_string_lossy(),
                "word" => e.word(&js(input)).to_string_lossy(),
                "rules" => e.word_rules(&js(input)).to_string_lossy(),
                _ => crate::phonemize(input, lang).unwrap(),
            };
            assert_eq!(got.trim(), *want, "{op} {lang} {input}");
        }
    }

    /// The one golden row that differs (an Arabic run inside a Magahi sentence) is port-pending on `ar`, not
    /// wrong: the run is routed to the Arabic engine, and dropped only while that engine is unported.
    #[test]
    fn an_arabic_run_is_pending_on_ar_until_it_is_ported() {
        crate::phonemize("अरबी: صنعاء", "mag").unwrap();
        let pending = crate::registry::port_pending();
        assert_eq!(
            pending.iter().any(|p| p == "ar"),
            !crate::LANGUAGES.contains(&"ar"),
            "{pending:?}"
        );
    }
}
