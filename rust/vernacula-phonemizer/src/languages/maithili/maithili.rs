//! Native Maithili (mai) phonemizer: the shared Hindi Devanagari engine driven by `maithili.jsonc`, with the
//! udatta ⟨॑⟩ (U+0951) folded to the avagraha ⟨ऽ⟩ at the normalize boundary and at both word entry points.
//! Ported from src/languages/maithili/maithili.ts — see that file for the corpus evidence.

use std::sync::{Arc, OnceLock};

use crate::core::js_string::{JsString, js};
use crate::core::phonology::load_shared_phonology;
use crate::core::provenance::rewrite;
use crate::js_re;
use crate::languages::hindi::hindi::{
    AbugidaScript, ForeignPhonemizer, NativeHindi, Overrides, make_native_hindi,
};
use crate::languages::hindi::manifest::{HindiDef, load_family_def};
use crate::languages::hindi::normalize::{OwnOrdinals, make_hindi_normalizer};
use crate::registry::{Engine, PhonemizeError, read_as_english};

/// On the seam: the normalize override hands this the pipeline string.
fn fold(s: &JsString) -> JsString {
    rewrite(s, js_re!("॑", "gu"), &js("ऽ"))
}

/// Off the seam: the word entry points hand this a word.
fn fold_word(s: &JsString) -> JsString {
    js_re!("॑", "gu").replace(s, &js("ऽ"))
}

pub struct Maithili {
    e: NativeHindi,
}

impl Maithili {
    pub fn word(&self, w: &JsString) -> JsString {
        self.e.word(&fold_word(w))
    }

    pub fn word_rules(&self, w: &JsString) -> JsString {
        self.e.word_rules(&fold_word(w))
    }

    /// Unwrapped, as the TS spreads the inner engine's `number`.
    pub fn number(&self, d: &JsString) -> Result<JsString, PhonemizeError> {
        self.e.number(d)
    }

    /// Unwrapped: `text` closes over the inner `word`, and the normalizer has already folded every U+0951.
    pub fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        self.e.text(input)
    }
}

impl Engine for Maithili {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Maithili::text(self, input)
    }
}

/// `createMaithili(foreign)`.
pub fn create_maithili(foreign: Option<ForeignPhonemizer>) -> Result<Maithili, String> {
    static DEF: OnceLock<HindiDef> = OnceLock::new();
    let def = load_family_def(&DEF, "maithili")?;
    let hindi = make_hindi_normalizer(
        &def.numbers,
        OwnOrdinals {
            irregular_ordinals: def.irregular_ordinals.as_ref(),
            ordinal_suffixes: def.ordinal_suffixes.as_ref(),
        },
    )?;
    let overrides = Overrides {
        normalize: Some(Box::new(move |input: &JsString| hindi(&fold(input)))),
        ..Default::default()
    };
    let e = make_native_hindi(
        def,
        load_shared_phonology()?,
        foreign,
        AbugidaScript::default(),
        None,
        overrides,
    )?;
    Ok(Maithili { e })
}

/// The registry's `mai` arm: `createMaithili(readAsEnglish)`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    let foreign: ForeignPhonemizer = Arc::new(read_as_english);
    Ok(Arc::new(
        create_maithili(Some(foreign)).map_err(PhonemizeError::Data)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Every literal-argument engine call in test/maithili.test.ts, with the TS engine's reading (its `toBe`
    /// literals cross-checked against it), extracted mechanically rather than typed.
    #[rustfmt::skip]
    const PINS: &[(&str, &str, &str, &str)] = &[
        // BEGIN GENERATED PINS
        ("word", "mai", "एकरा", "ˈekɾaː"),
        ("word", "mai", "ऎकरा", "ˈekɾaː"),
        ("word", "mai", "बैसब", "bˈəɪsəb"),
        ("word", "mai", "दौड़ब", "d̪ˈəʊɽəb"),
        ("word", "mai", "अऽ", "ˈə"),
        ("word", "mai", "अहाँलऽ", "əɦˈaː̃lə"),
        ("text", "mai", "अब॑", "ˈəbə"),
        ("text", "mai", "अबऽ", "ˈəbə"),
        ("text", "mai", "अब", "ˈəb"),
        ("word", "mai", "अब॑", "ˈəbə"),
        ("word", "mai", "करल॑", "kˈəɾlə"),
        ("word", "mai", "करलऽ", "kˈəɾlə"),
        ("rules", "mai", "अब॑", "ˈəbə"),
        ("text", "hi", "अब॑", "ˈəb"),
        ("text", "hi", "म॑थिली", "mˈət̪ʰɪliː"),
        ("text", "hi", "मथिली", "mˈət̪ʰɪliː"),
        ("text", "mai", "कꣿ", "kˈə"),
        ("text", "mai", "मꣿथिली", "mˈə t̪ʰˈɪliː"),
        ("text", "mai", "₹500", "pˈaː̃t͡ʃ sˈəʊ ɾˈʊpje"),
        ("text", "mai", "50%", "pət͡ʃˈaːs pɾˈət̪ɪʃət̪"),
        ("text", "mai", "₹ अछि", "ˈət͡ʃʰɪ"),
        ("text", "mai", "₹", ""),
        ("word", "mai", "मीत", "mˈiːt̪"),
        ("word", "mai", "पुस्तक", "pˈʊst̪ək"),
        ("word", "mai", "गाछ", "ɡˈaːt͡ʃʰ"),
        // END GENERATED PINS
    ];

    #[test]
    #[cfg(feature = "hi")]
    fn the_ts_suite_pins_hold() {
        let e = create_maithili(None).unwrap();
        for (op, lang, input, want) in PINS {
            let got = match *op {
                "word" => e.word(&js(input)).to_string_lossy(),
                "rules" => e.word_rules(&js(input)).to_string_lossy(),
                _ => crate::phonemize(input, lang).unwrap(),
            };
            assert_eq!(got.trim(), *want, "{op} {lang} {input}");
        }
    }

    /// The fold is on the seam: no probe or golden line poisons the input mapping.
    #[test]
    fn the_udatta_fold_never_poisons_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes =
            std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/mai.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/mai.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "mai").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 200);
        assert_eq!(hits.get(), 0);
    }
}
