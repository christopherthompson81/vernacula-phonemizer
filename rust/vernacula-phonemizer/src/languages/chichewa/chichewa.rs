//! Chichewa / Chinyanja (nya) phonemizer: a greedy longest-match scan over the grapheme table (implosives,
//! prenasalized, aspirated and palatalized series), a Latin fallback for a letter with no rule, the shared symbol
//! tier, and text(). Ported from src/languages/chichewa/chichewa.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::manifest::{GRAPHEME_KEYS, MANIFEST, try_manifest};
use super::normalize::normalize_chichewa;
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::normalize_symbols::{
    ExponentPosition, ExponentWords, PositionDecl, SymbolData, SymbolNormalizer, UnitPer,
    make_symbol_normalizer,
};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// `phonemizeWord(word)`: by UTF-16 code unit, as the TS indexes `w[i]`.
pub fn phonemize_word(word: &JsString) -> JsString {
    let w = word.to_lower_case();
    let u = w.units();
    let mut out = JsString::new();
    let mut i = 0;
    while i < u.len() {
        if let Some(key) = GRAPHEME_KEYS.iter().find(|k| u[i..].starts_with(k.units())) {
            out.push_str(&js(&MANIFEST.graphemes[&key.to_string_lossy()]));
            i += key.len();
            continue;
        }
        if let Some(p) = latin_phone(
            &JsString::from_units(&u[i..i + 1]),
            PhoneOpts {
                initial: i == 0,
                include_h: true,
            },
        ) {
            out.push_str(&p);
        }
        i += 1;
    }
    out
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"({})|(\d+)|([.!?…,;:])",
            host_word_run(&["Latin"], "'’", "").unwrap()
        ),
        "giu",
    )
    .unwrap()
});

const NATIVE_CLASS: &str = "[a-z'’]";
type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: a foreign letter folded onto the Latin base the g2p reads.
pub static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "iu")));

/// `SYMBOLS`, or why the tier refused its data. The tables are generated from chichewa.ts's object literals.
pub(crate) fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<Result<SymbolNormalizer, String>> = OnceLock::new();
    S.get_or_init(|| {
        let map = |rows: &[(&str, &str)]| -> IndexMap<String, Vec<String>> {
            rows.iter()
                .map(|(k, w)| (k.to_string(), vec![w.to_string()]))
                .collect()
        };
        make_symbol_normalizer(&SymbolData {
            percent: Some(vec!["peresenti".to_string()]),
            currency: Some(map(&[("$", "madola"), ("£", "mapaundi")])),
            currency_prefix: Some(true),
            units: Some(map(&[
                ("km", "makilomita"),
                ("cm", "sentimita"),
                ("mm", "milimita"),
                ("mi", "mailosi"),
                ("kg", "makilogalamu"),
                ("g", "magalamu"),
                ("l", "malita"),
                ("L", "malita"),
                ("ha", "mahekitala"),
            ])),
            unit_prefix: Some(true),
            unit_per: Some(UnitPer::All("pa".to_string())),
            rate_denominators: Some([("h".to_string(), "ola".to_string())].into_iter().collect()),
            exponent_words: Some(ExponentWords {
                squared: Some(vec!["sikweya".to_string()]),
                cubed: None,
                position: Some(PositionDecl::All(ExponentPosition::Before)),
            }),
            ..Default::default()
        })
    })
    .as_ref()
    .map_err(|e| e.clone())
}

/// The Chichewa engine (`createChichewa`).
pub struct ChichewaPhonemizer;

impl ChichewaPhonemizer {
    /// `normalizeChichewa(text)` (normalize.ts).
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_chichewa(text)
    }

    /// `SYMBOLS(text)`.
    pub fn symbols(&self, text: &JsString) -> JsString {
        try_symbols()
            .expect("checked by create_chichewa")
            .apply(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let s = normalize_chichewa(&self.symbols(input));
        assemble_clauses(&s, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                let w = js_re!(r"’", "gu").replace(&NAT(&w), &js("'"));
                sink.emit(&phonemize_word(&w));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                for wd in number_to_words(js_number(&d), Some(&d)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) = MANIFEST
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for ChichewaPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(ChichewaPhonemizer::text(self, input))
    }
}

/// `createChichewa()`. Loads the manifest and the symbol tier up front.
pub fn create_chichewa() -> Result<ChichewaPhonemizer, String> {
    try_manifest()?;
    try_symbols()?;
    Ok(ChichewaPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/chichewa.test.ts makes into the engine, with the value the TS returned, extracted
    // MECHANICALLY (the suite run under a recording vitest shim that also checked every matcher: all green), so each
    // of the suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("chichewa.numberToWords", &["1"], Some("chimodzi")),
        (
            "chichewa.numberToWords",
            &["6"],
            Some("zisanu ndi chimodzi"),
        ),
        ("chichewa.numberToWords", &["9"], Some("zisanu ndi zinayi")),
        ("phonemize", &["1", "nya"], Some("t͡ʃimod͡zi")),
        ("phonemize", &["6", "nya"], Some("zisanu ⁿdi t͡ʃimod͡zi")),
        ("chichewa.numberToWords", &["10"], Some("khumi")),
        (
            "chichewa.numberToWords",
            &["11"],
            Some("khumi ndi chimodzi"),
        ),
        (
            "chichewa.numberToWords",
            &["21"],
            Some("makumi awiri ndi chimodzi"),
        ),
        (
            "chichewa.numberToWords",
            &["42"],
            Some("makumi anayi ndi ziwiri"),
        ),
        ("phonemize", &["42", "nya"], Some("makumi anaji ⁿdi ziwiɽi")),
        ("chichewa.numberToWords", &["50"], Some("makumi asanu")),
        (
            "chichewa.numberToWords",
            &["60"],
            Some("makumi asanu ndi limodzi"),
        ),
        (
            "chichewa.numberToWords",
            &["70"],
            Some("makumi asanu ndi awiri"),
        ),
        (
            "chichewa.numberToWords",
            &["80"],
            Some("makumi asanu ndi atatu"),
        ),
        (
            "chichewa.numberToWords",
            &["90"],
            Some("makumi asanu ndi anayi"),
        ),
        (
            "chichewa.numberToWords",
            &["51"],
            Some("makumi asanu ndi chimodzi"),
        ),
        (
            "chichewa.numberToWords",
            &["52"],
            Some("makumi asanu ndi ziwiri"),
        ),
        (
            "chichewa.numberToWords",
            &["61"],
            Some("makumi asanu ndi limodzi ndi chimodzi"),
        ),
        (
            "chichewa.numberToWords",
            &["53"],
            Some("makumi asanu ndi zitatu"),
        ),
        (
            "chichewa.numberToWords",
            &["54"],
            Some("makumi asanu ndi zinayi"),
        ),
        ("chichewa.numberToWords", &["100"], Some("zana")),
        ("chichewa.numberToWords", &["200"], Some("mazana awiri")),
        (
            "chichewa.numberToWords",
            &["555"],
            Some("mazana asanu ndi makumi asanu ndi zisanu"),
        ),
        ("phonemize", &["200", "nya"], Some("mazana awiɽi")),
        ("chichewa.numberToWords", &["1000"], Some("chikwi")),
        ("chichewa.numberToWords", &["2000"], Some("zikwi ziwiri")),
        (
            "chichewa.numberToWords",
            &["12345"],
            Some("zikwi khumi ndi ziwiri ndi mazana atatu ndi makumi anayi ndi zisanu"),
        ),
        ("phonemize", &["1000", "nya"], Some("t͡ʃikwi")),
        (
            "chichewa.numberToWords",
            &["1000000"],
            Some("miliyoni imodzi"),
        ),
        (
            "chichewa.numberToWords",
            &["2000000"],
            Some("mamiliyoni awiri"),
        ),
        (
            "chichewa.numberToWords",
            &["9000000"],
            Some("mamiliyoni asanu ndi anayi"),
        ),
        (
            "chichewa.numberToWords",
            &["12000000"],
            Some("mamiliyoni khumi ndi awiri"),
        ),
        (
            "chichewa.numberToWords",
            &["1000000000"],
            Some("biliyoni imodzi"),
        ),
        (
            "chichewa.numberToWords",
            &["4700000000"],
            Some("mabiliyoni anayi ndi mamiliyoni mazana asanu ndi awiri"),
        ),
        (
            "chichewa.numberToWords",
            &["1600000"],
            Some("miliyoni imodzi ndi zikwi mazana asanu ndi limodzi"),
        ),
        ("chichewa.numberToWords", &["0"], Some("ziro")),
        (
            "chichewa.numberToWords",
            &["1000000000000"],
            Some("chimodzi ziro ziro ziro ziro ziro ziro ziro ziro ziro ziro ziro ziro"),
        ),
        (
            "chichewa.numberToWords",
            &["999999999999"],
            Some(
                "mabiliyoni mazana asanu ndi anayi ndi makumi asanu ndi anayi ndi asanu ndi anayi ndi mamiliyoni mazana asanu ndi anayi ndi makumi asanu ndi anayi ndi asanu ndi anayi ndi zikwi mazana asanu ndi anayi ndi makumi asanu ndi anayi ndi zisanu ndi zinayi ndi mazana asanu ndi anayi ndi makumi asanu ndi anayi ndi zisanu ndi zinayi",
            ),
        ),
        (
            "chichewa.normalizeChichewa",
            &["1,600,000"],
            Some("1600000"),
        ),
        ("chichewa.normalizeChichewa", &["14,591"], Some("14591")),
        (
            "chichewa.normalizeChichewa",
            &["2.289.780"],
            Some("2289780"),
        ),
        (
            "chichewa.normalizeChichewa",
            &["30 890 000"],
            Some("30890000"),
        ),
        ("chichewa.normalizeChichewa", &["1.234"], Some("1234")),
        (
            "chichewa.normalizeChichewa",
            &["ISBN 0 620 17697 0"],
            Some("ISBN 0 620 17697 0"),
        ),
        ("chichewa.normalizeChichewa", &["66.7"], Some("66 7")),
        ("chichewa.normalizeChichewa", &["104.0"], Some("104 0")),
        ("chichewa.normalizeChichewa", &["12,5"], Some("12 5")),
        (
            "chichewa.normalizeChichewa",
            &["Novembala 26,2008"],
            Some("Novembala 26,2008"),
        ),
        (
            "chichewa.normalizeChichewa",
            &["1:30 mmawa"],
            Some("1 koloko ndi mphindi 30 mmawa"),
        ),
        (
            "chichewa.normalizeChichewa",
            &["6:23 p.m."],
            Some("6 koloko ndi mphindi 23 masana"),
        ),
        (
            "chichewa.normalizeChichewa",
            &["11:30 AM."],
            Some("11 koloko ndi mphindi 30 m'mawa"),
        ),
        (
            "chichewa.normalizeChichewa",
            &["18:30 BST"],
            Some("18 koloko ndi mphindi 30 BST"),
        ),
        (
            "chichewa.normalizeChichewa",
            &["21:00 UTC"],
            Some("21 koloko UTC"),
        ),
        (
            "chichewa.normalizeChichewa",
            &["Machitidwe 5:37"],
            Some("Machitidwe 5:37"),
        ),
        (
            "chichewa.normalizeChichewa",
            &["Marko 14:2"],
            Some("Marko 14:2"),
        ),
        (
            "chichewa.normalizeChichewa",
            &["mphindi 64:51"],
            Some("mphindi 64:51"),
        ),
        ("chichewa.normalizeChichewa", &["2:07:06"], Some("2:07:06")),
        (
            "chichewa.normalizeChichewa",
            &["40 °C"],
            Some("madigiri 40"),
        ),
        ("chichewa.normalizeChichewa", &["30°F"], Some("madigiri 30")),
        (
            "chichewa.normalizeChichewa",
            &["25 ° S"],
            Some("madigiri 25 kumwera"),
        ),
        (
            "chichewa.normalizeChichewa",
            &["35°W"],
            Some("madigiri 35 kumadzulo"),
        ),
        ("chichewa.normalizeChichewa", &["30 °"], Some("madigiri 30")),
        (
            "chichewa.normalizeChichewa",
            &["10 ° C 20 ° C madigiri"],
            Some("10 20 madigiri"),
        ),
        ("chichewa.normalizeChichewa", &["107 m"], Some("mamita 107")),
        (
            "chichewa.normalizeChichewa",
            &["10,000 m"],
            Some("mamita 10000"),
        ),
        (
            "chichewa.normalizeChichewa",
            &["105 m'ma"],
            Some("105 m'ma"),
        ),
        (
            "chichewa.normalizeChichewa",
            &["2004-2009"],
            Some("2004 mpaka 2009"),
        ),
        ("chichewa.normalizeChichewa", &["3-1"], Some("3-1")),
        ("chichewa.normalizeChichewa", &["2014-15"], Some("2014-15")),
        (
            "chichewa.normalizeChichewa",
            &["1642 - 20 March"],
            Some("1642 - 20 March"),
        ),
        ("chichewa.normalizeChichewa", &["2-3-5"], Some("2-3-5")),
        (
            "chichewa.normalizeChichewa",
            &["19-23."],
            Some("19 mpaka 23."),
        ),
        (
            "chichewa.normalizeChichewa",
            &["2003-2004."],
            Some("2003 mpaka 2004."),
        ),
        (
            "chichewa.normalizeChichewa",
            &["my 1994-1996,"],
            Some("my 1994 mpaka 1996,"),
        ),
        (
            "chichewa.normalizeChichewa",
            &["2018-19,"],
            Some("2018-19,"),
        ),
        (
            "chichewa.normalizeChichewa",
            &["Europu & Asia"],
            Some("Europu ndi Asia"),
        ),
        (
            "chichewa.normalizeChichewa",
            &["T&T Clark"],
            Some("T ndi T Clark"),
        ),
        ("chichewa.normalizeChichewa", &["a &nbsp; b"], Some("a b")),
        ("chichewa.normalizeChichewa", &["&amp;"], Some("ndi")),
        (
            "chichewa.normalizeChichewa",
            &["U.S. Census"],
            Some("US Census"),
        ),
        ("chichewa.normalizeChichewa", &["B.C.E"], Some("BCE.")),
        ("chichewa.normalizeChichewa", &["U.S."], Some("US.")),
        ("chichewa.normalizeChichewa", &["20th"], Some("20")),
        ("chichewa.normalizeChichewa", &["3RD"], Some("3")),
        ("chichewa.normalizeChichewa", &["a & b"], Some("a ndi b")),
        (
            "chichewa.normalizeChichewa",
            &["40 °C ndi 25 ° S"],
            Some("madigiri 40 ndi 25 kumwera"),
        ),
        ("chichewa.normalizeChichewa", &[" 1,000 "], Some("1000")),
        (
            "phonemize",
            &["25 %", "nya"],
            Some("makumi awiɽi ⁿdi zisanu peɽeseⁿti"),
        ),
        ("phonemize", &["$5", "nya"], Some("maɗoɽa zisanu")),
        (
            "phonemize",
            &["$ 350 miliyoni", "nya"],
            Some("maɗoɽa mazana atatu ⁿdi makumi asanu miɽijoni"),
        ),
        (
            "phonemize",
            &["€ 100 miliyoni", "nya"],
            Some("zana miɽijoni"),
        ),
        (
            "phonemize",
            &["253 km", "nya"],
            Some("makiɽomita mazana awiɽi ⁿdi makumi asanu ⁿdi zitatu"),
        ),
        (
            "phonemize",
            &["150cm", "nya"],
            Some("seⁿtimita zana ⁿdi makumi asanu"),
        ),
        (
            "phonemize",
            &["1200 mm", "nya"],
            Some("miɽimita t͡ʃikwi ⁿdi mazana awiɽi"),
        ),
        ("phonemize", &["50 mi", "nya"], Some("maiɽosi makumi asanu")),
        (
            "phonemize",
            &["5 km²", "nya"],
            Some("sikweja makiɽomita zisanu"),
        ),
        (
            "phonemize",
            &["480 km/h", "nya"],
            Some("makiɽomita mazana anaji ⁿdi makumi asanu ⁿdi atatu pa oɽa"),
        ),
        ("phonemize", &["10 kg", "nya"], Some("makiɽoɡaɽamu kʰumi")),
        ("phonemize", &["10 ha", "nya"], Some("mahekitaɽa kʰumi")),
        ("phonemize", &["10 l", "nya"], Some("maɽita kʰumi")),
        ("phonemize", &["10 L", "nya"], Some("maɽita kʰumi")),
        ("phonemize", &["10 g", "nya"], Some("maɡaɽamu kʰumi")),
        (
            "phonemize",
            &["240 ha", "nya"],
            Some("mahekitaɽa mazana awiɽi ⁿdi makumi anaji"),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let call = |f: &str, args: &[&str]| -> Option<JsString> {
            let a = |i: usize| js(args[i]);
            match f {
                "chichewa.normalizeChichewa" => Some(normalize_chichewa(&a(0))),
                "chichewa.numberToWords" => Some(number_to_words(
                    js_number(&a(0)),
                    (args.len() > 1).then(|| a(1)).as_ref(),
                )),
                "phonemize" => Some(js(&crate::phonemize(args[0], args[1]).unwrap())),
                _ => panic!("no replay for {f}"),
            }
        };
        for (f, args, want) in TS_SUITE_CALLS {
            let got: Option<String> = call(f, args).map(|s| s.to_string_lossy());
            assert_eq!(got.as_deref(), *want, "{f}{args:?}");
        }
    }

    /// Every `rewrite` is on the pipeline string: no probe or golden line poisons the mapping (the TS
    /// `tools/provenance-poison.mts nya` reports 0 sites as well).
    #[test]
    fn chichewa_rewrites_never_poison_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes =
            std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/nya.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/nya.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "nya").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 200);
        assert_eq!(hits.get(), 0);
    }
}

/// #1595, as test/ebantu-defects-1595.test.ts: relational, so no IPA is typed. Synthetic inputs.
#[cfg(all(test, feature = "nya"))]
mod defects_1595_tests {
    #[test]
    fn a_long_decimal_reads_as_one_number() {
        for (input, written) in [("0.125", "0 1 2 5"), ("3.14159", "3 1 4 1 5 9")] {
            assert_eq!(
                crate::phonemize(input, "nya").unwrap(),
                crate::phonemize(written, "nya").unwrap(),
                "{input}"
            );
        }
    }
}
