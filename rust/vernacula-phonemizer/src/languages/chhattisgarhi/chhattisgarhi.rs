//! Native Chhattisgarhi (hne) phonemizer: the shared Hindi Devanagari engine (`makeNativeHindi`) driven by
//! `chhattisgarhi.jsonc`, with Hindi's normalizer and symbol tier inherited. Ported from
//! src/languages/chhattisgarhi/chhattisgarhi.ts — see that file for the corpus evidence.

use std::sync::{Arc, OnceLock};

use crate::core::phonology::load_shared_phonology;
use crate::languages::hindi::hindi::{
    AbugidaScript, ForeignPhonemizer, NativeHindi, Overrides, make_native_hindi,
};
use crate::languages::hindi::manifest::{HindiDef, load_family_def};
use crate::registry::{Engine, PhonemizeError, read_as_english};

/// `createChhattisgarhi(foreign)`.
pub fn create_chhattisgarhi(foreign: Option<ForeignPhonemizer>) -> Result<NativeHindi, String> {
    static DEF: OnceLock<HindiDef> = OnceLock::new();
    make_native_hindi(
        load_family_def(&DEF, "chhattisgarhi")?,
        load_shared_phonology()?,
        foreign,
        AbugidaScript::default(),
        None,
        Overrides::default(),
    )
}

/// The registry's `hne` arm: `createChhattisgarhi(readAsEnglish)`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    let foreign: ForeignPhonemizer = Arc::new(read_as_english);
    Ok(Arc::new(
        create_chhattisgarhi(Some(foreign)).map_err(PhonemizeError::Data)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::js_string::js;

    /// Every literal-argument engine call in test/chhattisgarhi.test.ts, with the TS engine's reading (its `toBe`
    /// literals cross-checked against it), extracted mechanically rather than typed.
    #[rustfmt::skip]
    const PINS: &[(&str, &str, &str, &str)] = &[
        // BEGIN GENERATED PINS
        ("word", "hne", "शहर", "sˈəɦəɾ"),
        ("word", "hne", "देश", "d̪ˈeːs"),
        ("word", "hne", "शेर", "sˈeːɾ"),
        ("word", "hne", "बैल", "bˈɛːl"),
        ("word", "hne", "कौन", "kˈɔːn"),
        ("word", "hne", "गौरव", "ɡˈɔːɾəʋ"),
        ("word", "hne", "पानी", "pˈaːniː"),
        ("word", "hne", "तीन", "t̪ˈiːn"),
        ("word", "hne", "गाय", "ɡˈaːj"),
        ("word", "hne", "समय", "sˈəməj"),
        ("word", "hne", "जहर", "d͡ʒˈəɦəɾ"),
        ("word", "hne", "ज्ञान", "d͡ʒɲˈaːn"),
        ("word", "hne", "विज्ञान", "ʋɪd͡ʒɲˈaːn"),
        ("text", "hne", "₹500", "pˈaː̃t͡ʃ sˈɔː ɾˈʊpjeː"),
        ("text", "hne", "50%", "pət͡ʃˈaːs pɾˈət̪ɪsət̪"),
        ("text", "hne", "%", "pɾˈət̪ɪsət̪"),
        ("text", "hne", "16वीं", "soːlˈəɦʋiː̃"),
        ("text", "hne", "11:20", "ɡjˈaːɾəɦ bˈəd͡ʒkəɾ bˈiːs mˈɪnəʈ"),
        ("text", "hne", "5 किमी", "pˈaː̃t͡ʃ kɪloːmˈiːʈəɾ"),
        // END GENERATED PINS
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        let e = create_chhattisgarhi(None).unwrap();
        for (op, lang, input, want) in PINS {
            let got = match *op {
                "word" => e.word(&js(input)).to_string_lossy(),
                "rules" => e.word_rules(&js(input)).to_string_lossy(),
                _ => crate::phonemize(input, lang).unwrap(),
            };
            assert_eq!(got.trim(), *want, "{op} {lang} {input}");
        }
    }
}
