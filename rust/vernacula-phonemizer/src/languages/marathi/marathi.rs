//! Native Marathi (mr) phonemizer: the shared Hindi Devanagari engine driven by `marathi.jsonc`, with Marathi's
//! own normalizer and symbol tier, both read from the one manifest load, and `%` added to the bare-sign map.
//! Ported from src/languages/marathi/marathi.ts — see that file for the corpus evidence.

use std::sync::{Arc, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use super::normalize::{MarathiWords, make_marathi_normalizer};
use crate::core::data_source::load_once;
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{Multiply, SymbolData, make_symbol_normalizer};
use crate::core::phonology::load_shared_phonology;
use crate::languages::hindi::hindi::{
    AbugidaScript, ForeignPhonemizer, NativeHindi, Overrides, make_native_hindi,
};
use crate::languages::hindi::manifest::HindiDef;
use crate::registry::{Engine, PhonemizeError, read_as_english};

/// `MarathiDef extends HindiDef, MarathiWords`.
#[derive(FromJson, Clone)]
pub struct MarathiDef {
    #[json(flatten)]
    pub hindi: HindiDef,
    #[json(flatten)]
    pub words: MarathiWords,
    pub ampersand: String,
    pub multiply: String,
    pub units: IndexMap<String, String>,
}

/// `DEF`: one load, shared by the engine, the normalizer and the tier.
pub fn try_def() -> Result<&'static MarathiDef, String> {
    static DEF: OnceLock<MarathiDef> = OnceLock::new();
    load_once(&DEF, || {
        load_manifest("languages/marathi", "marathi.jsonc").map_err(|e| e.to_string())
    })
}

/// `WITH_SYMBOLS`: the engine's def with `%` → the plural percent word added to the bare-sign map.
fn with_symbols() -> Result<&'static HindiDef, String> {
    static W: OnceLock<HindiDef> = OnceLock::new();
    load_once(&W, || {
        let def = try_def()?;
        let mut h = def.hindi.clone();
        let mut symbols = h.symbols.clone().unwrap_or_default();
        symbols.insert("%".into(), def.words.percent.plural.clone());
        h.symbols = Some(symbols);
        Ok(h)
    })
}

/// `MR_SYMBOLS`'s data, from the manifest.
fn mr_symbols(def: &MarathiDef) -> SymbolData {
    let forms = |m: &IndexMap<String, String>| -> IndexMap<String, Vec<String>> {
        m.iter()
            .map(|(k, v)| (k.clone(), vec![v.clone()]))
            .collect()
    };
    SymbolData {
        multiply: Some(Multiply {
            times: def.multiply.clone(),
            by: None,
        }),
        ampersand: Some(def.ampersand.clone()),
        percent: Some(vec![def.words.percent.plural.clone()]),
        currency: Some(forms(&def.words.currency)),
        units: Some(forms(&def.units)),
        ..Default::default()
    }
}

/// `createMarathi(foreign)`.
pub fn create_marathi(foreign: Option<ForeignPhonemizer>) -> Result<NativeHindi, String> {
    let def = try_def()?;
    let tier = make_symbol_normalizer(&mr_symbols(def))?;
    let overrides = Overrides {
        normalize: Some(make_marathi_normalizer(&def.hindi.numbers, &def.words)?),
        symbols: Some(Box::new(move |s| Ok(tier.apply(s)))),
        ..Default::default()
    };
    make_native_hindi(
        with_symbols()?,
        load_shared_phonology()?,
        foreign,
        AbugidaScript::default(),
        None,
        overrides,
    )
}

/// The registry's `mr` arm: `createMarathi(readAsEnglish)`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    let foreign: ForeignPhonemizer = Arc::new(read_as_english);
    Ok(Arc::new(
        create_marathi(Some(foreign)).map_err(PhonemizeError::Data)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::js_string::js;

    /// Every literal-argument engine call in test/marathi.test.ts, test/marathi-minus-sign.test.ts and
    /// test/marathi-manifest-lifted.test.ts, with the TS engine's reading (its `toBe` literals cross-checked
    /// against it), extracted mechanically rather than typed.
    #[rustfmt::skip]
    const PINS: &[(&str, &str, &str, &str)] = &[
        // BEGIN GENERATED PINS
        ("text", "mr", "मराठी भाषा.", "məɾˈaːʈʰiː bʱˈaːʂaː ."),
        ("text", "mr", "25", "pə̃ɲt͡səʋˈiːs"),
        ("word", "mr", "पंचवीस", "pə̃ɲt͡səʋˈiːs"),
        ("text", "mr", "47", "sət̪ːeːt͡saːɭˈiːs"),
        ("word", "mr", "सत्तेचाळीस", "sət̪ːeːt͡saːɭˈiːs"),
        ("text", "mr", "99", "nˈəʋʋjaːɳːəʋ"),
        ("word", "mr", "नव्व्याण्णव", "nˈəʋʋjaːɳːəʋ"),
        ("text", "mr", "36", "t͡sʰət̪ːˈiːs"),
        ("word", "mr", "छत्तीस", "t͡sʰət̪ːˈiːs"),
        ("text", "mr", "९३", "t̪ɾjˈaːɳːəʋ"),
        ("text", "mr", "93", "t̪ɾjˈaːɳːəʋ"),
        ("text", "mr", "१,००० रुपये", "ˈeːk ɦəd͡zˈaːɾ ɾˈʊpjeː"),
        ("text", "mr", "1,000 रुपये", "ˈeːk ɦəd͡zˈaːɾ ɾˈʊpjeː"),
        ("text", "mr", "९३%", "t̪ɾjˈaːɳːəʋ ʈˈəkːeː"),
        ("text", "mr", "93%", "t̪ɾjˈaːɳːəʋ ʈˈəkːeː"),
        ("text", "mr", "90%", "nˈəʋʋəd̪ ʈˈəkːeː"),
        ("word", "mr", "नव्वद", "nˈəʋʋəd̪"),
        ("word", "mr", "टक्के", "ʈˈəkːeː"),
        ("text", "mr", "1%", "ˈeːk ʈˈəkːaː"),
        ("word", "mr", "टक्का", "ʈˈəkːaː"),
        ("text", "mr", "$२२,५००", "baːʋˈiːs ɦəd͡zˈaːɾ pˈaːt͡s ʃˈeː ɖˈɔːləɾ"),
        ("word", "mr", "डॉलर", "ɖˈɔːləɾ"),
        ("text", "mr", "€10", "d̪ˈəɦaː jˈʊɾoː"),
        ("word", "mr", "युरो", "jˈʊɾoː"),
        ("text", "mr", "$२.३ बिलियन", "d̪ˈoːn d̪əʃˈaː̃ʃ t̪ˈiːn bˈɪlɪjən ɖˈɔːləɾ"),
        ("text", "mr", "२.३ बिलियन डॉलर", "d̪ˈoːn d̪əʃˈaː̃ʃ t̪ˈiːn bˈɪlɪjən ɖˈɔːləɾ"),
        ("text", "mr", "9:30", "nˈəuː ʋaːd͡zˈuːn t̪ˈiːs mˈɪnɪʈeː"),
        ("text", "mr", "नऊ वाजून तीस मिनिटे", "nˈəuː ʋaːd͡zˈuːn t̪ˈiːs mˈɪnɪʈeː"),
        ("text", "mr", "8:30 वाजता", "ˈaːʈʰ ʋaːd͡zˈuːn t̪ˈiːs mˈɪnɪʈeː"),
        ("text", "mr", "आठ वाजून तीस मिनिटे", "ˈaːʈʰ ʋaːd͡zˈuːn t̪ˈiːs mˈɪnɪʈeː"),
        ("text", "mr", "11:00", "ˈəkɾaː ʋˈaːd͡zt̪aː"),
        ("text", "mr", "अकरा वाजता", "ˈəkɾaː ʋˈaːd͡zt̪aː"),
        ("text", "mr", "११ः०० वाजता", "ˈəkɾaː ʋˈaːd͡zt̪aː"),
        ("text", "mr", "11:00 वाजल्यानंतर", "ˈəkɾaː ʋaːd͡zəljaːnˈə̃n̪t̪əɾ"),
        ("text", "mr", "अकरा वाजल्यानंतर", "ˈəkɾaː ʋaːd͡zəljaːnˈə̃n̪t̪əɾ"),
        ("text", "mr", "4:41.30", "t͡sˈaːɾ eːkeːt͡saːɭˈiːs d̪əʃˈaː̃ʃ t̪ˈiːn ʃˈuːnjə"),
        ("text", "mr", "4 41.30", "t͡sˈaːɾ eːkeːt͡saːɭˈiːs d̪əʃˈaː̃ʃ t̪ˈiːn ʃˈuːnjə"),
        ("word", "mr", "मिनिटे", "mˈɪnɪʈeː"),
        ("text", "mr", "१६व्या", "soːɭˈaːʋjaː"),
        ("word", "mr", "सोळाव्या", "soːɭˈaːʋjaː"),
        ("text", "mr", "15 व्या", "pə̃n̪d̪ʱəɾˈaːʋjaː"),
        ("word", "mr", "पंधराव्या", "pə̃n̪d̪ʱəɾˈaːʋjaː"),
        ("text", "mr", "20 वा", "ʋɪsˈaːʋaː"),
        ("word", "mr", "विसावा", "ʋɪsˈaːʋaː"),
        ("text", "mr", "37 वा", "səd̪t̪ɪsˈaːʋaː"),
        ("word", "mr", "सदतिसावा", "səd̪t̪ɪsˈaːʋaː"),
        ("text", "mr", "60 वा", "saːʈʰˈaːʋaː"),
        ("word", "mr", "साठावा", "saːʈʰˈaːʋaː"),
        ("text", "mr", "9व्या", "nəʋˈəʋjaː"),
        ("word", "mr", "नवव्या", "nəʋˈəʋjaː"),
        ("text", "mr", "५ वे", "pˈaːt͡sʋeː"),
        ("word", "mr", "पाचवे", "pˈaːt͡sʋeː"),
        ("text", "mr", "1 वा", "pˈəɦɪlaː"),
        ("word", "mr", "पहिला", "pˈəɦɪlaː"),
        ("text", "mr", "3 व्या", "t̪ˈɪsjaː"),
        ("word", "mr", "तिसऱ्या", "t̪ˈɪsjaː"),
        ("text", "mr", "7 वेळा", "sˈaːt̪ ʋˈeːɭaː"),
        ("text", "mr", "सात वेळा", "sˈaːt̪ ʋˈeːɭaː"),
        ("text", "mr", "5 वाजता", "pˈaːt͡s ʋˈaːd͡zt̪aː"),
        ("text", "mr", "पाच वाजता", "pˈaːt͡s ʋˈaːd͡zt̪aː"),
        ("text", "mr", "४ वेगवेगळ्या", "t͡sˈaːɾ ʋˈeːɡʋeːɡəɭjaː"),
        ("text", "mr", "चार वेगवेगळ्या", "t͡sˈaːɾ ʋˈeːɡʋeːɡəɭjaː"),
        ("text", "mr", "10 वर्ष", "d̪ˈəɦaː ʋˈəɾʂə"),
        ("text", "mr", "दहा वर्ष", "d̪ˈəɦaː ʋˈəɾʂə"),
        ("text", "mr", "५ किमी", "pˈaːt͡s kɪloːmˈiːʈəɾ"),
        ("text", "mr", "पाच किलोमीटर", "pˈaːt͡s kɪloːmˈiːʈəɾ"),
        ("text", "mr", "७० किमी/तास", "sˈət̪ːəɾ kɪloːmˈiːʈəɾ pɾˈət̪ɪ t̪ˈaːs"),
        ("text", "mr", "सत्तर किलोमीटर प्रति तास", "sˈət̪ːəɾ kɪloːmˈiːʈəɾ pɾˈət̪ɪ t̪ˈaːs"),
        ("text", "mr", "३ किमी²", "t̪ˈiːn t͡sˈəuɾəs kɪloːmˈiːʈəɾ"),
        ("text", "mr", "तीन चौरस किलोमीटर", "t̪ˈiːn t͡sˈəuɾəs kɪloːmˈiːʈəɾ"),
        ("text", "mr", "19,500 km²", "eːkoːɳˈiːs ɦəd͡zˈaːɾ pˈaːt͡s ʃˈeː t͡sˈəuɾəs kɪloːmˈiːʈəɾ"),
        ("word", "mr", "चौरस", "t͡sˈəuɾəs"),
        ("text", "mr", "35 mm", "pəst̪ˈiːs mɪliːmˈiːʈəɾ"),
        ("text", "mr", "पस्तीस मिलीमीटर", "pəst̪ˈiːs mɪliːmˈiːʈəɾ"),
        ("text", "mr", "10 ha", "d̪ˈəɦaː ɦˈeːkʈəɾ"),
        ("text", "mr", "दहा हेक्टर", "d̪ˈəɦaː ɦˈeːkʈəɾ"),
        ("text", "mr", "10 l", "d̪ˈəɦaː lˈɪʈəɾ"),
        ("text", "mr", "दहा लिटर", "d̪ˈəɦaː lˈɪʈəɾ"),
        ("text", "mr", "10 L", "d̪ˈəɦaː lˈɪʈəɾ"),
        ("text", "mr", "100 ha", "ʃˈə̃mbʱəɾ ɦˈeːkʈəɾ"),
        ("text", "mr", "शंभर हेक्टर", "ʃˈə̃mbʱəɾ ɦˈeːkʈəɾ"),
        ("text", "mr", "802.11 g", "ˈaːʈʰ ʃˈeː d̪ˈoːn d̪əʃˈaː̃ʃ ˈeːk ˈeːk d͡ʒˈiː"),
        ("word", "mr", "ग्रॅम", "ɡɾˈɛːm"),
        ("text", "mr", "2-3 किमी", "d̪ˈoːn t̪ˈeː t̪ˈiːn kɪloːmˈiːʈəɾ"),
        ("text", "mr", "दोन ते तीन किलोमीटर", "d̪ˈoːn t̪ˈeː t̪ˈiːn kɪloːmˈiːʈəɾ"),
        ("text", "mr", "१६४४-१९१२", "ˈeːk ɦəd͡zˈaːɾ sˈəɦaː ʃˈeː t͡səʋʋeːt͡saːɭˈiːs t̪ˈeː ˈeːk ɦəd͡zˈaːɾ nˈəuː ʃˈeː bˈaːɾaː"),
        ("text", "mr", "1644 ते 1912", "ˈeːk ɦəd͡zˈaːɾ sˈəɦaː ʃˈeː t͡səʋʋeːt͡saːɭˈiːs t̪ˈeː ˈeːk ɦəd͡zˈaːɾ nˈəuː ʃˈeː bˈaːɾaː"),
        ("text", "mr", "5-3", "pˈaːt͡s t̪ˈiːn"),
        ("text", "mr", "5 3", "pˈaːt͡s t̪ˈiːn"),
        ("text", "mr", "६-६", "sˈəɦaː sˈəɦaː"),
        ("text", "mr", "6 6", "sˈəɦaː sˈəɦaː"),
        ("text", "mr", "२००", "d̪ˈoːn ʃˈeː"),
        ("text", "mr", "दोन शे", "d̪ˈoːn ʃˈeː"),
        ("text", "mr", "100", "ʃˈə̃mbʱəɾ"),
        ("word", "mr", "शंभर", "ʃˈə̃mbʱəɾ"),
        ("text", "mr", "100-200 मैल", "ʃˈə̃mbʱəɾ t̪ˈeː d̪ˈoːn ʃˈeː mˈəil"),
        ("text", "mr", "100 ते 200 मैल", "ʃˈə̃mbʱəɾ t̪ˈeː d̪ˈoːn ʃˈeː mˈəil"),
        ("text", "mr", "आपल्‍या", "aːpˈəljaː"),
        ("text", "mr", "आपल्या", "aːpˈəljaː"),
        ("text", "mr", "अ‍ॅनिमेशन", "ɛːnɪmˈeːʃən"),
        ("text", "mr", "ऍनिमेशन", "ɛːnɪmˈeːʃən"),
        ("text", "mr", "विशेषत:", "ʋɪʃˈeːʂt̪əh"),
        ("text", "mr", "विशेषतः", "ʋɪʃˈeːʂt̪əh"),
        ("text", "mr", "स्वत:चे", "sʋət̪ˈəht͡ʃeː"),
        ("text", "mr", "स्वतःचे", "sʋət̪ˈəht͡ʃeː"),
        ("text", "mr", "हे आहेत: एक", "ɦˈeː aːɦˈeːt̪ , ˈeːk"),
        ("text", "mr", "इ.स.पू. 323", "ˈɪsʋiː sˈən pˈuːɾʋə t̪ˈiːn ʃˈeː t̪eːʋˈiːs"),
        ("text", "mr", "इसवी सन पूर्व 323", "ˈɪsʋiː sˈən pˈuːɾʋə t̪ˈiːn ʃˈeː t̪eːʋˈiːs"),
        ("text", "mr", "इ.स. १६१०", "ˈɪsʋiː sˈən ˈeːk ɦəd͡zˈaːɾ sˈəɦaː ʃˈeː d̪ˈəɦaː"),
        ("text", "mr", "इसवी सन 1610", "ˈɪsʋiː sˈən ˈeːk ɦəd͡zˈaːɾ sˈəɦaː ʃˈeː d̪ˈəɦaː"),
        ("text", "mr", "डॉ. आंबेडकर", "ɖˈɔːkʈəɾ aː̃mbˈeːɖkəɾ"),
        ("text", "mr", "डॉक्टर आंबेडकर", "ɖˈɔːkʈəɾ aː̃mbˈeːɖkəɾ"),
        ("text", "mr", "१/२", "ˈəɾd̪ʱaː"),
        ("word", "mr", "अर्धा", "ˈəɾd̪ʱaː"),
        ("text", "mr", "३/४", "paːˈuːɳ"),
        ("word", "mr", "पाऊण", "paːˈuːɳ"),
        ("text", "mr", "1/5", "ˈeːk bʱˈaːɡɪleː pˈaːt͡s"),
        ("text", "mr", "एक भागिले पाच", "ˈeːk bʱˈaːɡɪleː pˈaːt͡s"),
        ("text", "mr", "30°", "t̪ˈiːs ˈə̃ʃ"),
        ("text", "mr", "तीस अंश", "t̪ˈiːs ˈə̃ʃ"),
        ("text", "mr", "+30°से.", "ˈəd̪ʱɪk t̪ˈiːs ˈə̃ʃ sˈeːlsɪəs"),
        ("text", "mr", "अधिक तीस अंश सेल्सिअस", "ˈəd̪ʱɪk t̪ˈiːs ˈə̃ʃ sˈeːlsɪəs"),
        ("text", "mr", "~500", "sʊmˈaːɾeː pˈaːt͡s ʃˈeː"),
        ("text", "mr", "सुमारे 500", "sʊmˈaːɾeː pˈaːt͡s ʃˈeː"),
        ("text", "mr", "चंद्रयान -1", "t͡sə̃n̪d̪ɾəjˈaːn ˈeːk"),
        ("word", "mr", "उणे", "ˈʊɳeː"),
        ("text", "mr", "मराठी भाषा। नवीन", "məɾˈaːʈʰiː bʱˈaːʂaː . nəʋˈiːn"),
        ("text", "mr", "ज्ञान", "d͡ʒnˈaːn"),
        ("text", "mr", "विज्ञान", "ʋɪd͡ʒnˈaːn"),
        ("text", "mr", "ज्ञात", "d͡ʒnˈaːt̪"),
        ("text", "mr", "−२५°C", "ˈʊɳeː pə̃ɲt͡səʋˈiːs ˈə̃ʃ sˈeːlsɪəs"),
        ("text", "mr", "−0.5", "ˈʊɳeː ʃˈuːnjə d̪əʃˈaː̃ʃ pˈaːt͡s"),
        ("text", "mr", "5 − 3", "pˈaːt͡s ˈʊɳeː t̪ˈiːn"),
        ("text", "mr", "५−३", "pˈaːt͡s t̪ˈiːn"),
        ("text", "mr", "१८३८−१९१७", "ˈeːk ɦəd͡zˈaːɾ ˈaːʈʰ ʃˈeː əɖt̪ˈiːs ˈeːk ɦəd͡zˈaːɾ nˈəuː ʃˈeː sˈət̪ɾaː"),
        ("text", "mr", "41−49", "eːkeːt͡saːɭˈiːs eːkoːɳpənːˈaːs"),
        ("text", "mr", "-५", "pˈaːt͡s"),
        ("text", "mr", "आस-पास", "ˈaːs pˈaːs"),
        ("text", "mr", "±५", "ˈəd̪ʱɪk ˈʊɳeː pˈaːt͡s"),
        ("text", "mr", "5%", "pˈaːt͡s ʈˈəkːeː"),
        // END GENERATED PINS
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        let e = create_marathi(None).unwrap();
        for (op, lang, input, want) in PINS {
            let got = match *op {
                "word" => e.word(&js(input)).to_string_lossy(),
                "rules" => e.word_rules(&js(input)).to_string_lossy(),
                _ => crate::phonemize(input, lang).unwrap(),
            };
            assert_eq!(got.trim(), *want, "{op} {lang} {input}");
        }
    }

    /// Every key marathi.jsonc declares is one `MarathiDef` names, or one the TS never reads.
    #[test]
    fn manifest_claims_every_key() {
        use crate::core::data_source::read_data_text;
        use crate::core::jsonc::parse_jsonc;
        let v: serde_json::Value =
            parse_jsonc(&read_data_text("languages/marathi/marathi.jsonc").unwrap()).unwrap();
        let claimed = [
            "language",
            "inherentVowel",
            "consonants",
            "independentVowels",
            "vowelSigns",
            "signs",
            "nasalVowelsAreShort",
            "postRules",
            "finalRules",
            "numbers",
            "schwaDeletion",
            "clausePunctuation",
            "stripSymbols",
            "percent",
            "currency",
            "ampersand",
            "multiply",
            "units",
            "unitWords",
            "magnitudeWords",
            "ordinals",
            "visargaAdverbs",
            "clock",
            "eraMarkers",
            "abbreviations",
            "degree",
            "fractions",
            "symbolWords",
            "rangeWord",
            "bareHundred",
        ];
        let doc_only = ["name", "script", "provenance"];
        for k in v.as_object().unwrap().keys() {
            assert!(
                claimed.contains(&k.as_str()) || doc_only.contains(&k.as_str()),
                "unclaimed key {k}"
            );
        }
        let d = try_def().unwrap();
        assert_eq!(d.words.ordinals.suffix_form.len(), 4);
        assert_eq!(
            with_symbols().unwrap().symbols.as_ref().unwrap().get("%"),
            Some(&d.words.percent.plural)
        );
    }

    /// Every `rewrite` in the normalizer is on the pipeline string: no probe or golden line poisons the mapping.
    #[test]
    fn marathi_rewrites_never_poison_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes =
            std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/mr.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/mr.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "mr").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 200);
        assert_eq!(hits.get(), 0);
    }
}
