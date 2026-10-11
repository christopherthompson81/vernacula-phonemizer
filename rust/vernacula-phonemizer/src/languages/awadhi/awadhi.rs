//! Native Awadhi (awa) phonemizer: the shared Hindi Devanagari engine driven by `awadhi.jsonc`, with every
//! string-producing entry point wrapped in Saksena's intervocalic flap (ड/ढ → ɽ/ɽʱ except after a nasal).
//! Ported from src/languages/awadhi/awadhi.ts — see that file for the corpus evidence.

use std::sync::{Arc, LazyLock, OnceLock};

use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::phonology::load_shared_phonology;
use crate::core::trace::note_rewrite;
use crate::languages::hindi::hindi::{
    AbugidaScript, ForeignPhonemizer, NativeHindi, Overrides, make_native_hindi,
};
use crate::languages::hindi::manifest::{HindiDef, load_family_def};
use crate::registry::{Engine, PhonemizeError, read_as_english};

const V: &str = "aəʌɪiʊueɛoɔɐ";
static FLAP: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("(?<=[{V}]ː?)ɖ(ʱ?)(?=[ˈˌ]?[{V}])"), "gu").unwrap());

fn awadhify(s: &JsString) -> JsString {
    FLAP.replace(s, &js("ɽ$1"))
}

pub struct Awadhi {
    base: NativeHindi,
}

impl Awadhi {
    pub fn word(&self, w: &JsString) -> JsString {
        awadhify(&self.base.word(w))
    }

    pub fn word_rules(&self, w: &JsString) -> JsString {
        awadhify(&self.base.word_rules(w))
    }

    pub fn number(&self, d: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(awadhify(&self.base.number(d)?))
    }

    /// A whole-string post-pass, so it is reported to the trace (#1150).
    pub fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        let pre = self.base.text(input)?;
        let out = awadhify(&pre);
        note_rewrite("awadhi-flap", &pre, &out, true);
        Ok(out)
    }
}

impl Engine for Awadhi {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Awadhi::text(self, input)
    }
}

/// `createAwadhi(foreign)`.
pub fn create_awadhi(foreign: Option<ForeignPhonemizer>) -> Result<Awadhi, String> {
    static DEF: OnceLock<HindiDef> = OnceLock::new();
    let base = make_native_hindi(
        load_family_def(&DEF, "awadhi")?,
        load_shared_phonology()?,
        foreign,
        AbugidaScript::default(),
        None,
        Overrides::default(),
    )?;
    Ok(Awadhi { base })
}

/// The registry's `awa` arm: `createAwadhi(readAsEnglish)`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    let foreign: ForeignPhonemizer = Arc::new(read_as_english);
    Ok(Arc::new(
        create_awadhi(Some(foreign)).map_err(PhonemizeError::Data)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Every literal-argument engine call in test/awadhi.test.ts, with the TS engine's reading (its `toBe`
    /// literals cross-checked against it), extracted mechanically rather than typed.
    #[rustfmt::skip]
    const PINS: &[(&str, &str, &str, &str)] = &[
        // BEGIN GENERATED PINS
        ("word", "awa", "शहर", "sˈəɦəɾ"),
        ("word", "awa", "शेर", "sˈeːɾ"),
        ("word", "awa", "देश", "d̪ˈeːs"),
        ("word", "awa", "अडा", "ˈəɽaː"),
        ("word", "awa", "सडक", "sˈəɽək"),
        ("word", "awa", "पडोसी", "pəɽˈoːsiː"),
        ("word", "awa", "गढा", "ɡˈəɽʱaː"),
        ("word", "awa", "अंडा", "ˈə̃ɳɖaː"),
        ("word", "awa", "अँडा", "ˈə̃ɖaː"),
        ("word", "awa", "डर", "ɖˈəɾ"),
        ("word", "awa", "बैल", "bˈʌil"),
        ("word", "awa", "कौन", "kˈʌun"),
        ("word", "awa", "अवधी", "ˈəwd̪ʱiː"),
        ("word", "awa", "विशाल", "wɪsˈaːl"),
        ("word", "awa", "कडैल", "kˈəɽʌil"),
        ("word", "awa", "पडौरा", "pˈəɽʌuɾaː"),
        ("text", "awa", "गोडा डाल", "ɡˈoːɽaː ɖˈaːl"),
        ("word", "awa", "अड्डा", "ˈəɖɖaː"),
        ("word", "awa", "रामऽ", "ɾˈaːmə"),
        ("word", "awa", "राम", "ɾˈaːm"),
        ("word", "awa", "करऽ", "kˈəɾə"),
        ("word", "awa", "कर", "kˈəɾ"),
        ("word", "awa", "ज्ञान", "d͡ʒɲˈaːn"),
        ("word", "awa", "विज्ञान", "wɪd͡ʒɲˈaːn"),
        ("text", "awa", "₹500", "pˈaː̃t͡ʃ sˈʌu ɾˈʊpjeː"),
        ("text", "awa", "५०%", "pət͡ʃˈaːs pɾˈət̪ɪsət̪"),
        ("word", "awa", "पानी", "pˈaːniː"),
        ("word", "awa", "तीन", "t̪ˈiːn"),
        ("word", "awa", "किताब", "kɪt̪ˈaːb"),
        // END GENERATED PINS
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        let e = create_awadhi(None).unwrap();
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
