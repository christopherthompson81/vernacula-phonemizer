//! Native Rangpuri (rkt) phonemizer: the shared Hindi Devanagari engine (`makeNativeHindi`) driven by
//! `rangpuri.jsonc`, with Hindi's normalizer and symbol tier inherited. Ported from
//! src/languages/rangpuri/rangpuri.ts — see that file for the corpus evidence.

use std::sync::{Arc, OnceLock};

use crate::core::phonology::load_shared_phonology;
use crate::languages::hindi::hindi::{
    AbugidaScript, ForeignPhonemizer, NativeHindi, Overrides, make_native_hindi,
};
use crate::languages::hindi::manifest::{HindiDef, load_family_def};
use crate::registry::{Engine, PhonemizeError, read_as_english};

/// `createRangpuri(foreign)`.
pub fn create_rangpuri(foreign: Option<ForeignPhonemizer>) -> Result<NativeHindi, String> {
    static DEF: OnceLock<HindiDef> = OnceLock::new();
    make_native_hindi(
        load_family_def(&DEF, "rangpuri")?,
        load_shared_phonology()?,
        foreign,
        AbugidaScript::default(),
        None,
        Overrides::default(),
    )
}

/// The registry's `rkt` arm: `createRangpuri(readAsEnglish)`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    let foreign: ForeignPhonemizer = Arc::new(read_as_english);
    Ok(Arc::new(
        create_rangpuri(Some(foreign)).map_err(PhonemizeError::Data)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::js_string::js;

    /// Every literal-argument engine call in test/rangpuri.test.ts, with the TS engine's reading (its `toBe`
    /// literals cross-checked against it), extracted mechanically rather than typed.
    #[rustfmt::skip]
    const PINS: &[(&str, &str, &str, &str)] = &[
        // BEGIN GENERATED PINS
        ("rules", "rkt", "काचे", "kˈase"),
        ("rules", "rkt", "गाजोर", "ɡˈad͡zoɾ"),
        ("rules", "rkt", "घर", "ɡʱˈɔɾ"),
        ("rules", "rkt", "आधाचेर", "ˈad̪ʱaseɾ"),
        ("rules", "rkt", "ठीक", "ʈʰˈik"),
        ("rules", "rkt", "आठ", "ˈaʈ"),
        ("rules", "rkt", "खलान", "kʰˈɔlan"),
        ("rules", "rkt", "आगोत", "ˈaɡot̪"),
        ("rules", "rkt", "आदा", "ˈad̪a"),
        ("rules", "rkt", "आगोन", "ˈaɡon"),
        ("rules", "rkt", "आम", "ˈam"),
        ("rules", "rkt", "आकाश", "ˈakaʃ"),
        ("rules", "rkt", "बिष", "bˈiʃ"),
        ("rules", "rkt", "आलु", "ˈalu"),
        ("text", "rkt", "आम खलान।", "ˈam kʰˈɔlan ."),
        // END GENERATED PINS
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        let e = create_rangpuri(None).unwrap();
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
