//! Hausa (ha) phonemizer: text() over the normalizer and the shared symbol tier, a TOKEN that keeps grouped and
//! decimal numbers whole, the Boko nativiser, and the g2p; an out-of-range number falls back to one digit at a time.
//! Ported from src/languages/hausa/hausa.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

pub use super::g2p::phonemize_word;
use super::g2p::try_tone;
use super::manifest::{MANIFEST, try_manifest};
use super::normalize::normalize_hausa;
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{
    ExponentWords, PositionDecl, SymbolData, SymbolNormalizer, make_symbol_normalizer,
};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let run = host_word_run(&["Latin"], "'’", "").unwrap();
    JsRegex::new(
        &format!(r"({run})|([1-9]\d{{0,2}}(?:,\d{{3}})+(?:\.\d+)?|\d+\.\d+|\d+)|([.!?…,;:])"),
        "gu",
    )
    .unwrap()
});

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: Hausa's own inventory; a token outside it is a foreign name and is folded.
pub static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[a-zɓɗƙƴA-ZƁƊƘƳ'’]", "u")));

/// `SYMBOLS`: the shared tier over the manifest's `symbolTier`.
pub fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let t = &try_manifest()?.symbol_tier;
        make_symbol_normalizer(&SymbolData {
            percent: Some(t.percent.clone()),
            currency: Some(t.currency.clone()),
            units: Some(t.units.clone()),
            exponent_words: Some(ExponentWords {
                squared: Some(t.exponent_words.squared.clone()),
                cubed: Some(t.exponent_words.cubed.clone()),
                position: t.exponent_words.position.map(PositionDecl::All),
            }),
            percent_prefix: Some(t.percent_prefix),
            multiply: Some(t.multiply.clone()),
            ..Default::default()
        })
    })
}

/// The Hausa engine (`createHausa()`).
pub struct HausaPhonemizer {
    symbols: &'static SymbolNormalizer,
}

impl HausaPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_hausa(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self.symbols.apply(&normalize_hausa(input));
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(
                    &js_re!("’", "g").replace(&NAT(&w), &js("'")),
                ));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                let bare = js_re!(",", "gu").replace(&d, &JsString::new());
                let composed = number_to_words(js_number(&bare));
                let words: Vec<JsString> = if composed.is_empty() {
                    bare.code_point_strings()
                        .iter()
                        .map(|c| number_to_words(js_number(c)))
                        .collect()
                } else {
                    composed.split(&js(" "))
                };
                for wd in words {
                    if !wd.is_empty() {
                        sink.emit(&phonemize_word(&wd));
                    }
                }
            } else if let Some(p) = m.group(3, s)
                && let Some(mk) = MANIFEST
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|v| !v.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for HausaPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(HausaPhonemizer::text(self, input))
    }
}

/// `createHausa()`: loads the manifest, the tone lexicon and the symbol tier, or says which failed.
pub fn create_hausa() -> Result<HausaPhonemizer, String> {
    try_manifest()?;
    try_tone()?;
    let symbols = try_symbols()?;
    Ok(HausaPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/hausa.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["ɓera"], Some("ɓˈera")),
    ("phonemizeWord", &["ɗaya"], Some("ɗˈa˥ja˥")),
    ("phonemizeWord", &["ƙasa"], Some("kʼˈa˥sa˥")),
    ("phonemizeWord", &["hankali"], Some("ha˥ŋkˈa˩li˩")),
    ("phonemizeWord", &["kai"], Some("kˈaⁱ")),
    ("phonemizeWord", &["sau"], Some("sˈaᵘ")),
    ("phonemizeWord", &["faa"], Some("ɸˈaː")),
    ("phonemizeWord", &["Najeriya"], Some("na˩d͡ʒe˥rˈi˥ja˩")),
    ("phonemizeWord", &["mutum"], Some("mˈu˩tu˥˩m")),
    ("phonemizeWord", &["ruwa"], Some("rˈu˥wa˥")),
    ("phonemizeWord", &["uku"], Some("ˈu˥ku˩")),
    ("phonemizeWord", &["sannu"], Some("sˈannu")),
    ("numberToWords", &["7"], Some("bakwai")),
    ("numberToWords", &["11"], Some("goma sha ɗaya")),
    ("numberToWords", &["42"], Some("arba'in da biyu")),
    ("numberToWords", &["101"], Some("ɗari da ɗaya")),
    ("numberToWords", &["555"], Some("ɗari biyar da hamsin da biyar")),
    ("numberToWords", &["12345"], Some("dubu goma sha biyu da ɗari uku da arba'in da biyar")),
    ("numberToWords", &["100000"], Some("dubu ɗari")),
    ("numberToWords", &["1000000"], Some("miliyan")),
    ("numberToWords", &["2000000"], Some("miliyan biyu")),
    ("numberToWords", &["1000000000"], Some("biliyan")),
    ("numberToWords", &["2000000000"], Some("biliyan biyu")),
    ("phonemize", &["kashi 80%", "ha"], Some("kˈaʃi ta˩mˈa˩ni˥n")),
    ("phonemize", &["88%", "ha"], Some("kˈaʃi ta˩mˈa˩ni˥n dˈa tˈa˥kʷa˩s")),
    ("phonemize", &["6,387 km", "ha"], Some("dˈu˥bu˥ ʃˈi˥da˩ dˈa ɗˈa˩ri˥ ˈu˥ku˩ dˈa ta˩mˈa˩ni˥n dˈa bˈakʷaⁱ kilomˈita")),
    ("phonemize", &["5,000,000", "ha"], Some("milˈijan bˈi˩ja˥r")),
    ("phonemize", &["Hoto na 1.1", "ha"], Some("hˈo˩to˥ nˈa ɗˈa˥ja˥ mˈaki ɗˈa˥ja˥")),
    ("phonemize", &["8:46 na safe", "ha"], Some("tˈa˥kʷa˩s dˈa a˩rbˈa˩ʔi˥n dˈa ʃˈi˥da˩ nˈa sˈa˥ɸe˥")),
    ("phonemize", &["8:30 na yamma", "ha"], Some("tˈa˥kʷa˩s dˈa ta˩lˈa˩ti˥n nˈa jˈa˥˩mma˥")),
    ("phonemize", &["15.00 UTC", "ha"], Some("ɡˈo˥ma˩ ʃˈa˥ bˈi˩ja˥r ˈu tˈa t͡ʃˈa˥")),
    ("phonemize", &["1000 B.C.", "ha"], Some("dˈu˥bu˥ kˈa˩ɸi˩n haⁱhˈuwar jˈesu")),
    ("phonemize", &["10,000 BCE", "ha"], Some("dˈu˥bu˥ ɡˈo˥ma˩ kˈa˩ɸi˩n haⁱhˈuwar jˈesu")),
    ("phonemize", &["1990-1995", "ha"], Some("dˈu˥bu˥ dˈa ɗˈa˩ri˥ tˈa˩ra˥ dˈa t͡ʃa˩sˈa˩ʔi˥n zˈu˥wa˩ dˈu˥bu˥ dˈa ɗˈa˩ri˥ tˈa˩ra˥ dˈa t͡ʃa˩sˈa˩ʔi˥n dˈa bˈi˩ja˥r")),
    ("phonemize", &["480 km/h", "ha"], Some("ɗˈa˩ri˥ hˈu˥ɗu˥ dˈa ta˩mˈa˩ni˥n kilomˈita ˈa ˈa˥wa˩")),
    ("phonemize", &["133 m/s", "ha"], Some("ɗˈa˩ri˥ dˈa ta˩lˈa˩ti˥n dˈa ˈu˥ku˩ mˈita ˈa da˩kʼˈi˥kʼa˩")),
    ("phonemize", &["12.8 km/h", "ha"], Some("ɡˈo˥ma˩ ʃˈa˥ bˈi˥ju˥ mˈaki tˈa˥kʷa˩s kilomˈita ˈa ˈa˥wa˩")),
    ("phonemize", &["3.5%", "ha"], Some("kˈaʃi ˈu˥ku˩ mˈaki bˈi˩ja˥r")),
    ("phonemize", &["kashi 3.5%", "ha"], Some("kˈaʃi ˈu˥ku˩ mˈaki bˈi˩ja˥r")),
    ("phonemize", &["$11,000", "ha"], Some("dˈu˥bu˥ ɡˈo˥ma˩ ʃˈa˥ ɗˈa˥ja˥ dˈa˩la˥")),
    ("phonemize", &["US $ 30", "ha"], Some("dˈa˩la˥ ta˩lˈa˩ti˥n")),
    ("phonemize", &["£27", "ha"], Some("a˩ʃˈi˩ri˥n dˈa bˈakʷaⁱ ɸˈa˥˩m")),
    ("phonemize", &["30°C", "ha"], Some("ta˩lˈa˩ti˥n diɡˈiri t͡ʃelsˈius")),
    ("phonemize", &["+30°C", "ha"], Some("kʼˈari ta˩lˈa˩ti˥n diɡˈiri t͡ʃelsˈius")),
    ("phonemize", &["35°W", "ha"], Some("ta˩lˈa˩ti˥n dˈa bˈi˩ja˥r diɡˈiri jˈa˥˩mma˥")),
    ("phonemize", &["inci 1/5", "ha"], Some("ˈint͡ʃi ɗˈa˥ja˥ bˈi˥sa˥ bˈi˩ja˥r")),
    ("phonemize", &["A1GP", "ha"], Some("ˈa ɗˈa˥ja˥ ɡˈa pˈa")),
    ("phonemize", &["H5N1", "ha"], Some("hˈa bˈi˩ja˥r nˈa ɗˈa˥ja˥")),
    ("phonemize", &["Roe v. Wade", "ha"], Some("rˈoe dˈa wˈade")),
    ("phonemize", &["km 2", "ha"], Some("kilomˈita bˈi˥ju˥")),
    ("phonemize", &["mai nisan km 2-3", "ha"], Some("mˈaⁱ nˈisan kilomˈita bˈi˥ju˥ zˈu˥wa˩ ˈu˥ku˩")),
    ("phonemize", &["5 km", "ha"], Some("bˈi˩ja˥r kilomˈita")),
    ("phonemize", &["100 km/h", "ha"], Some("ɗˈa˩ri˥ kilomˈita ˈa ˈa˥wa˩")),
    ("phonemizeWord", &["china"], Some("t͡ʃˈina")),
    ("phonemizeWord", &["richard"], Some("rˈit͡ʃard")),
    ("phonemizeWord", &["gingrich"], Some("ɡˈiŋɡrit͡ʃ")),
    ("phonemizeWord", &["charles"], Some("t͡ʃˈarles")),
    ("phonemizeWord", &["chile"], Some("t͡ʃˈile")),
    ("phonemizeWord", &["shiri"], Some("ʃˈiri")),
    ("phonemizeWord", &["wacce"], Some("wˈat͡ʃt͡ʃe")),
    ("phonemizeWord", &["wadataccen"], Some("wadatˈat͡ʃt͡ʃen")),
    ("phonemizeWord", &["chhatrapati"], Some("t͡ʃatrapˈati")),
    ("phonemizeWord", &["chhappan"], Some("t͡ʃˈappan")),
    ("phonemize", &["1, -2", "ha"], Some("ɗˈa˥ja˥ , rˈaʃin bˈi˥ju˥")),
    ("phonemize", &["5, -3 degrees", "ha"], Some("bˈi˩ja˥r , rˈaʃin ˈu˥ku˩ dˈeɡreːs")),
    ("phonemize", &["1-2", "ha"], Some("ɗˈa˥ja˥ zˈu˥wa˩ bˈi˥ju˥")),
    ("phonemize", &["1,234-5,678", "ha"], Some("dˈu˥bu˥ dˈa ɗˈa˩ri˥ bˈi˥ju˥ dˈa ta˩lˈa˩ti˥n dˈa hˈu˥ɗu˥ zˈu˥wa˩ dˈu˥bu˥ bˈi˩ja˥r dˈa ɗˈa˩ri˥ ʃˈi˥da˩ dˈa sa˩bˈa˩ʔi˥n dˈa tˈa˥kʷa˩s")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        create_hausa().unwrap();
        let mut count = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => phonemize_word(&js(args[0])).to_string_lossy(),
                "numberToWords" => number_to_words(js_number(&js(args[0]))).to_string_lossy(),
                "phonemize" => crate::phonemize(args[0], args[1]).unwrap(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            count += 1;
        }
        assert_eq!(count, 67);
    }
}
