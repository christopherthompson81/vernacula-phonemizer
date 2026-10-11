//! Native Nepali (ne) phonemizer: the shared Hindi Devanagari engine driven by `nepali.jsonc`, with Nepali's
//! own normalizer and symbol tier, and the inherent vowel ə → ʌ on every output (a foreign run's ə shielded
//! from that fold by a sentinel). Ported from src/languages/nepali/nepali.ts — see that file for the corpus
//! evidence.

use std::sync::{Arc, LazyLock, OnceLock};

use indexmap::IndexMap;

use super::normalize::make_nepali_normalizer;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::markers::PUA_SENTINEL;
use crate::core::normalize_symbols::{
    ExponentPosition, ExponentWords, Multiply, PositionDecl, SymbolData, UnitPer,
    make_symbol_normalizer,
};
use crate::core::phonology::load_shared_phonology;
use crate::core::trace::note_rewrite;
use crate::languages::hindi::hindi::{
    AbugidaScript, ForeignPhonemizer, NativeHindi, Overrides, make_native_hindi,
};
use crate::languages::hindi::manifest::{HindiDef, load_family_def};
use crate::registry::{Engine, PhonemizeError, read_as_english};

static SCHWA: LazyLock<JsRegex> = LazyLock::new(|| JsRegex::new("ə", "gu").unwrap());

fn nepali_vowel(s: &JsString) -> JsString {
    SCHWA.replace(s, &js("ʌ"))
}

/// `NE_SYMBOLS`'s data, from the TS object literal (key order preserved).
fn ne_symbols() -> SymbolData {
    let forms = |w: &str| vec![w.to_string()];
    let units: IndexMap<String, Vec<String>> = [
        ("km", "किलोमीटर"),
        ("किमि", "किलोमीटर"),
        ("किमी", "किलोमीटर"),
        ("cm", "सेन्टिमिटर"),
        ("mm", "मिलीमीटर"),
        ("kg", "किलोग्राम"),
        ("m", "मिटर"),
    ]
    .into_iter()
    .map(|(k, v)| (k.to_string(), forms(v)))
    .collect();
    SymbolData {
        ampersand: Some("र".into()),
        multiply: Some(Multiply {
            times: "गुणा".into(),
            by: None,
        }),
        percent: Some(forms("प्रतिशत")),
        units: Some(units),
        unit_per: Some(UnitPer::All("प्रति".into())),
        rate_denominators: Some(
            [("h", "घण्टा"), ("s", "सेकेण्ड")]
                .into_iter()
                .map(|(k, v)| (k.to_string(), v.to_string()))
                .collect(),
        ),
        exponent_words: Some(ExponentWords {
            squared: Some(forms("वर्ग")),
            cubed: Some(forms("घन")),
            position: Some(PositionDecl::All(ExponentPosition::Before)),
        }),
        ..Default::default()
    }
}

pub struct Nepali {
    base: NativeHindi,
}

impl Nepali {
    pub fn word(&self, w: &JsString) -> JsString {
        nepali_vowel(&self.base.word(w))
    }

    pub fn word_rules(&self, w: &JsString) -> JsString {
        nepali_vowel(&self.base.word_rules(w))
    }

    pub fn number(&self, d: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(nepali_vowel(&self.base.number(d)?))
    }

    /// A whole-string post-pass, reported to the trace; the sentinel turns back into ə afterwards.
    pub fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        let pre = self.base.text(input)?;
        let out = JsString::join(&nepali_vowel(&pre).split(&js(PUA_SENTINEL)), &js("ə"));
        note_rewrite("nepali-inherent-vowel", &pre, &out, true);
        Ok(out)
    }
}

impl Engine for Nepali {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Nepali::text(self, input)
    }
}

/// `createNepali(foreign)`.
pub fn create_nepali(foreign: Option<ForeignPhonemizer>) -> Result<Nepali, String> {
    static DEF: OnceLock<HindiDef> = OnceLock::new();
    let shielded: Option<ForeignPhonemizer> = foreign.map(|f| -> ForeignPhonemizer {
        Arc::new(move |latin: &JsString| SCHWA.replace(&f(latin), &js(PUA_SENTINEL)))
    });
    let def = load_family_def(&DEF, "nepali")?;
    let tier = make_symbol_normalizer(&ne_symbols())?;
    let overrides = Overrides {
        normalize: Some(make_nepali_normalizer(&def.numbers)),
        symbols: Some(Box::new(move |s: &JsString| Ok(tier.apply(s)))),
        ..Default::default()
    };
    let base = make_native_hindi(
        def,
        load_shared_phonology()?,
        shielded,
        AbugidaScript::default(),
        None,
        overrides,
    )?;
    Ok(Nepali { base })
}

/// The registry's `ne` arm: `createNepali(readAsEnglish)`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    let foreign: ForeignPhonemizer = Arc::new(read_as_english);
    Ok(Arc::new(
        create_nepali(Some(foreign)).map_err(PhonemizeError::Data)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Every literal-argument engine call in test/nepali.test.ts, with the TS engine's reading (its `toBe`
    /// literals cross-checked against it), extracted mechanically rather than typed.
    #[rustfmt::skip]
    const PINS: &[(&str, &str, &str, &str)] = &[
        // BEGIN GENERATED PINS
        ("word", "ne", "गर्नु", "ɡˈʌɾnu"),
        ("word", "ne", "अचार", "ˈʌt͡saɾ"),
        ("word", "ne", "मान्छे", "mˈant͡sʰe"),
        ("word", "ne", "भाषा", "bʱˈasa"),
        ("word", "ne", "नेपाल", "nˈepal"),
        ("word", "ne", "हिमाल", "ɦˈimal"),
        ("text", "ne", "म computer", "mˈʌ kəmpjˈuːt̬ɚ"),
        ("text", "ne", "6", "t͡sʰˈʌ"),
        ("text", "ne", "2", "d̪ˈui"),
        ("text", "ne", "100", "ˈek sˈʌj"),
        ("text", "ne", "21", "ˈekːais"),
        ("text", "ne", "35", "pʌˈĩn̪t̪is"),
        ("text", "ne", "99", "unˈansʌj"),
        ("text", "ne", "1995", "ˈek ɦˈʌd͡zaɾ nˈʌu sˈʌj pˈʌnt͡sanʌbːe"),
        ("text", "ne", "2000", "d̪ˈui ɦˈʌd͡zaɾ"),
        ("text", "ne", "गर्‍यो", "ɡˈʌɾjo"),
        ("text", "ne", "प्राय: यो", "pɾˈajʌh jˈo"),
        ("text", "ne", "राय: अर्को", "ɾˈaj , ˈʌɾko"),
        ("text", "ne", "15 औं", "pˈʌnd̪ʱɾʌũ"),
        ("text", "ne", "9 औँ", "nˈʌwʌũ"),
        ("text", "ne", "6 औं", "t͡sʰˈʌiʈʰʌũ"),
        ("text", "ne", "छैठौं", "t͡sʰˈʌiʈʰʌũ"),
        ("text", "ne", "1,000 औँ", "ˈek ɦˈʌd͡zaɾʌũ"),
        ("text", "ne", "बिहान 9:30 बजे", "bˈiɦan nˈʌu bˈʌd͡zeɾ t̪ˈis mˈineʈ"),
        ("text", "ne", "11:00 बजेपछि", "ˈeɡʱaɾ bʌd͡zˈept͡sʰi"),
        ("text", "ne", "10:00-11:00 राती", "d̪ˈʌs bˈʌd͡ze d̪ˈekʰi ˈeɡʱaɾ bˈʌd͡ze ɾˈat̪i"),
        ("text", "ne", "4:41.30 मिनेट", "t͡sˈaɾ ˈekt͡salis d̪ʌsˈʌmlʌw t̪ˈin sˈunjʌ mˈineʈ"),
        ("text", "ne", "$500", "pˈãt͡s sˈʌj ɖˈʌlʌɾ"),
        ("text", "ne", "US$30", "jˈuː ˈɛs t̪ˈis ɖˈʌlʌɾ"),
        ("text", "ne", "$1000 डलर", "ˈek ɦˈʌd͡zaɾ ɖˈʌlʌɾ"),
        ("text", "ne", "£27 मिलियन", "sˈʌt̪ːais mˈilijʌn paˈunɖʌ"),
        ("text", "ne", "35-40 माइल", "pʌˈĩn̪t̪is d̪ˈekʰi t͡sˈalis mˈail"),
        ("text", "ne", "5-3 ले", "pˈãt͡s t̪ˈin lˈe"),
        ("text", "ne", "1995-1996 देखि", "ˈek ɦˈʌd͡zaɾ nˈʌu sˈʌj pˈʌnt͡sanʌbːe ˈek ɦˈʌd͡zaɾ nˈʌu sˈʌj t͡sʰˈʌjanʌbːe d̪ˈekʰi"),
        ("text", "ne", "165 किमी/ घण्टा", "ˈek sˈʌj pʌĩsˈʌʈʰʈʰi kˈilomiʈʌɾ pɾˈʌt̪i ɡʱˈʌɳʈa"),
        ("text", "ne", "6 सेमी", "t͡sʰˈʌ sˈenʈimiʈʌɾ"),
        ("text", "ne", "1600 कि.मी. को", "ˈek ɦˈʌd͡zaɾ t͡sʰˈʌ sˈʌj kˈilomiʈʌɾ kˈo"),
        ("text", "ne", "डा. मोल", "ɖˈakʈʌɾ mˈol"),
        ("text", "ne", "88%", "ˈʌʈʰasi pɾˈʌt̪isʌt̪"),
        ("text", "ne", "+30°Cभन्दा", "plˈʌs t̪ˈis ɖˈiɡɾi sˈelsijʌs bʱˈʌnd̪a"),
        ("text", "ne", "35°W", "pʌˈĩn̪t̪is ɖˈiɡɾi pˈʌst͡sim"),
        ("text", "ne", "~500", "lˈʌɡbʱʌɡ pˈãt͡s sˈʌj"),
        ("text", "ne", "युटिसी+1", "jˈuʈisi plˈʌs ˈek"),
        ("text", "ne", "3,850 km²", "t̪ˈin ɦˈʌd͡zaɾ ˈaʈʰ sˈʌj pˈʌt͡sas wˈʌɾɡʌ kˈilomiʈʌɾ"),
        ("text", "ne", "5 m", "pˈãt͡s mˈiʈʌɾ"),
        ("text", "ne", "120 m³", "ˈek sˈʌj bˈis ɡʱˈʌn mˈiʈʌɾ"),
        ("text", "ne", "802.11m", "ˈaʈʰ sˈʌj d̪ˈui d̪ʌsˈʌmlʌw ˈek ˈek ˈɛm"),
        ("text", "ne", "$5.", "pˈãt͡s ɖˈʌlʌɾ ."),
        ("text", "ne", "$5,", "pˈãt͡s ɖˈʌlʌɾ ,"),
        ("text", "ne", "$5", "pˈãt͡s ɖˈʌlʌɾ"),
        ("text", "ne", "$5.5", "pˈãt͡s d̪ʌsˈʌmlʌw pˈãt͡s ɖˈʌlʌɾ"),
        ("word", "ne", "मक्का", "mˈʌkːa"),
        ("word", "ne", "सत्तरी", "sˈʌt̪ːʌɾi"),
        ("word", "ne", "गद्दी", "ɡˈʌd̪ːi"),
        ("word", "ne", "एकाउन्न", "ˈekaunːʌ"),
        ("word", "ne", "बच्चा", "bˈʌt͡sːa"),
        ("word", "ne", "पच्चीस", "pˈʌt͡sːis"),
        ("word", "ne", "लज्जा", "lˈʌd͡zːa"),
        ("word", "ne", "अच्छा", "ˈʌt͡sʰːa"),
        ("text", "ne", "ज्ञान", "ɡjˈan"),
        ("text", "ne", "विज्ञान", "wˈiɡjan"),
        ("text", "ne", "ज्ञात", "ɡjˈat̪"),
        // END GENERATED PINS
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        let e = create_nepali(None).unwrap();
        for (op, lang, input, want) in PINS {
            let got = match *op {
                "word" => e.word(&js(input)).to_string_lossy(),
                "rules" => e.word_rules(&js(input)).to_string_lossy(),
                _ => crate::phonemize(input, lang).unwrap(),
            };
            assert_eq!(got.trim(), *want, "{op} {lang} {input}");
        }
    }

    /// Every `rewrite` in the normalizer is on the pipeline string: no probe or golden line poisons the mapping.
    #[test]
    fn nepali_rewrites_never_poison_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes =
            std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/ne.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/ne.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "ne").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 200);
        assert_eq!(hits.get(), 0);
    }
}
