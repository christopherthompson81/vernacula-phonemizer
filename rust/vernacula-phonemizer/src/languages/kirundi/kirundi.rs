//! Kirundi / Ikirundi (rn) phonemizer: a greedy longest-match scan over the grapheme table (Kinyarwanda's, with
//! ⟨j⟩ an affricate), a Latin fallback for a letter with no rule, and text().
//! Ported from src/languages/kirundi/kirundi.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{GRAPHEME_KEYS, MANIFEST, try_manifest};
use super::normalize::{normalize_kirundi, try_symbols};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
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
        &format!(r"({})|(\d+)|([.!?…,;:])", LATIN_RUN.as_str()),
        "giu",
    )
    .unwrap()
});

const NATIVE_CLASS: &str = "[a-z]";
type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: a foreign letter folded onto the Latin base the g2p reads.
pub static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "iu")));

/// The Kirundi engine (`createKirundi`).
pub struct KirundiPhonemizer;

impl KirundiPhonemizer {
    /// `normalizeKirundi(text)` (normalize.ts; it owns the symbol-tier call).
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_kirundi(text)
    }

    /// The symbol tier normalize.ts builds.
    pub fn symbols(&self, text: &JsString) -> JsString {
        try_symbols()
            .expect("checked by create_kirundi")
            .apply(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        assemble_clauses(&normalize_kirundi(input), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
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

impl Engine for KirundiPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(KirundiPhonemizer::text(self, input))
    }
}

/// `createKirundi()`. Loads the manifest and the symbol tier up front.
pub fn create_kirundi() -> Result<KirundiPhonemizer, String> {
    try_manifest()?;
    try_symbols()?;
    Ok(KirundiPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/kirundi.test.ts makes into the engine, with the value the TS returned, extracted
    // MECHANICALLY (the suite run under a recording vitest shim that also checked every matcher: all green), so each
    // of the suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("kirundi.phonemizeWord", &["ijana"], Some("id͡ʒana")),
        ("kirundi.phonemizeWord", &["jenoside"], Some("d͡ʒenoside")),
        ("kinyarwanda.phonemizeWord", &["ijana"], Some("iʒana")),
        ("kirundi.phonemizeWord", &["umuntu"], Some("umuntu")),
        ("kinyarwanda.phonemizeWord", &["umuntu"], Some("umuntu")),
        ("kirundi.phonemizeWord", &["icyenda"], Some("ikʲenda")),
        ("kinyarwanda.phonemizeWord", &["icyenda"], Some("ikʲenda")),
        ("kirundi.phonemizeWord", &["ubwenge"], Some("ubweŋe")),
        ("kinyarwanda.phonemizeWord", &["ubwenge"], Some("ubweŋe")),
        ("kirundi.phonemizeWord", &["kirundi"], Some("kiɾundi")),
        ("kinyarwanda.phonemizeWord", &["kirundi"], Some("kiɾundi")),
        ("kirundi.phonemizeWord", &["abantu"], Some("abantu")),
        ("kinyarwanda.phonemizeWord", &["abantu"], Some("abantu")),
        ("kirundi.phonemizeWord", &["umunani"], Some("umunani")),
        ("kinyarwanda.phonemizeWord", &["umunani"], Some("umunani")),
        ("kirundi.phonemizeWord", &["gatatu"], Some("ɡatatu")),
        ("kirundi.numberToWords", &["7"], Some("indwi")),
        ("kirundi.numberToWords", &["8"], Some("umunani")),
        ("kirundi.numberToWords", &["9"], Some("icenda")),
        ("kinyarwanda.numberToWords", &["9"], Some("icyenda")),
        ("phonemize", &["9", "rn"], Some("it͡ʃenda")),
        ("kirundi.numberToWords", &["18"], Some("icumi na umunani")),
        ("kirundi.numberToWords", &["20"], Some("mirongo ibiri")),
        ("kinyarwanda.numberToWords", &["20"], Some("makumyabiri")),
        (
            "kirundi.numberToWords",
            &["42"],
            Some("mirongo ine na kabiri"),
        ),
        ("kirundi.numberToWords", &["80"], Some("mirongo inani")),
        ("phonemize", &["20", "rn"], Some("miɾoŋo ibiɾi")),
        ("kirundi.numberToWords", &["100"], Some("ijana")),
        ("kirundi.numberToWords", &["200"], Some("amajana abiri")),
        (
            "kirundi.numberToWords",
            &["555"],
            Some("amajana atanu na mirongo itanu na gatanu"),
        ),
        ("phonemize", &["200", "rn"], Some("amad͡ʒana abiɾi")),
        ("kirundi.numberToWords", &["1000"], Some("igihumbi")),
        ("kirundi.numberToWords", &["2000"], Some("ibihumbi bibiri")),
        (
            "kirundi.numberToWords",
            &["12345"],
            Some("ibihumbi icumi na kabiri na amajana atatu na mirongo ine na gatanu"),
        ),
        ("kirundi.numberToWords", &["1000000"], Some("umuriyoni")),
        ("phonemize", &["1000000", "rn"], Some("umuɾijoni")),
        (
            "kirundi.numberToWords",
            &["1000000000"],
            Some("rimwe zeru zeru zeru zeru zeru zeru zeru zeru zeru"),
        ),
        (
            "kinyarwanda.numberToWords",
            &["1000000000"],
            Some("miriyari"),
        ),
        (
            "kirundi.numberToWords",
            &["1000000001"],
            Some("rimwe zeru zeru zeru zeru zeru zeru zeru zeru rimwe"),
        ),
        (
            "phonemize",
            &["1000000000", "rn"],
            Some("ɾimwe zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu"),
        ),
        (
            "kirundi.numberToWords",
            &["999999999"],
            Some(
                "umuriyoni amajana cenda na mirongo icenda na icenda na ibihumbi amajana cenda na mirongo icenda na icenda na amajana cenda na mirongo icenda na icenda",
            ),
        ),
        (
            "kirundi.normalizeKirundi",
            &["606km²"],
            Some("ibirometero kwadarato 606"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["km² 517"],
            Some("ibirometero kwadarato 517"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["3.287.263 km2"],
            Some("ibirometero kwadarato 3287263"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["(233/km²)"],
            Some("(233 kuri kirometero kwadarato)"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["kilometero kare"],
            Some("kilometero kare"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["km³ 517"],
            Some("ibirometero³ 517"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["(233/km3)"],
            Some("(233 kuri kirometero³)"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["3372 hab/km3"],
            Some("3372 hab kuri kirometero³"),
        ),
        (
            "phonemize",
            &["(233/km3)", "rn"],
            Some("amad͡ʒana abiɾi na miɾoŋo itatu na ɡatatu kuɾi kiɾometeɾo"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["(233/km³)"],
            Some("(233 kuri kirometero³)"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["517 km³"],
            Some("ibirometero³ 517"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["517 km²"],
            Some("ibirometero kwadarato 517"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["mm³ 1000"],
            Some("milimetero³ 1000"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["km2 517"],
            Some("ibirometero kwadarato 517"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["mm2 500"],
            Some("milimetero kwadarato 500"),
        ),
        (
            "phonemize",
            &["km2\u{a0}517", "rn"],
            Some("ibiɾometeɾo kwadaɾato amad͡ʒana atanu na it͡ʃumi na indwi"),
        ),
        (
            "phonemize",
            &["km2 517", "rn"],
            Some("ibiɾometeɾo kwadaɾato amad͡ʒana atanu na it͡ʃumi na indwi"),
        ),
        (
            "phonemize",
            &["mm3\u{a0}517", "rn"],
            Some("milimeteɾo amad͡ʒana atanu na it͡ʃumi na indwi"),
        ),
        (
            "phonemize",
            &["mm3 517", "rn"],
            Some("milimeteɾo amad͡ʒana atanu na it͡ʃumi na indwi"),
        ),
        (
            "phonemize",
            &["km2\u{202f}517", "rn"],
            Some("ibiɾometeɾo kwadaɾato amad͡ʒana atanu na it͡ʃumi na indwi"),
        ),
        (
            "phonemize",
            &["mm3\u{202f}517", "rn"],
            Some("milimeteɾo amad͡ʒana atanu na it͡ʃumi na indwi"),
        ),
        (
            "phonemize",
            &["km2\u{2009}517", "rn"],
            Some("ibiɾometeɾo kwadaɾato amad͡ʒana atanu na it͡ʃumi na indwi"),
        ),
        (
            "phonemize",
            &["mm3\u{2009}517", "rn"],
            Some("milimeteɾo amad͡ʒana atanu na it͡ʃumi na indwi"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["km2 517 000"],
            Some("ibirometero kwadarato 517000"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["km3 517"],
            Some("ibirometero³ 517"),
        ),
        ("kirundi.normalizeKirundi", &["R2 500"], Some("R2500")),
        (
            "kirundi.normalizeKirundi",
            &["km 1,965"],
            Some("ibirometero 1965"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["km 1 965"],
            Some("ibirometero 1965"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["mm 1.000"],
            Some("milimetero 1000"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["12.100.000"],
            Some("12100000"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["104 000 000 000"],
            Some("104000000000"),
        ),
        ("kirundi.normalizeKirundi", &["1,964.54"], Some("1964 5 4")),
        (
            "kirundi.normalizeKirundi",
            &["Ibirometero kwadarato 1,457.40."],
            Some("Ibirometero kwadarato 1457 4 0."),
        ),
        (
            "kirundi.normalizeKirundi",
            &["26.08.1940"],
            Some("26 08 1940"),
        ),
        ("kirundi.normalizeKirundi", &["2.2.1946"], Some("2 2 1946")),
        (
            "kirundi.normalizeKirundi",
            &["24.11.1949 - 17.12.2020"],
            Some("24 11 1949 - 17 12 2020"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["(1981-1989)"],
            Some("(kuva 1981 gushika 1989)"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["kuva 2008 - 2009"],
            Some("kuva 2008 gushika 2009"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["metero 1.500 / 1.800"],
            Some("metero 1500 gushika kuri 1800"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["2009-2005"],
            Some("2009-2005"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["Tübingen 1997–2005."],
            Some("Tübingen kuva 1997 gushika 2005."),
        ),
        (
            "kirundi.normalizeKirundi",
            &["kuva 2005 – 2007."],
            Some("kuva 2005 gushika 2007."),
        ),
        (
            "kirundi.normalizeKirundi",
            &["Mugihe co kuva muri 2010 – 2012."],
            Some("Mugihe co kuva muri 2010 gushika 2012."),
        ),
        (
            "kirundi.normalizeKirundi",
            &["Kuva muri 2007 – 2008 yariko"],
            Some("Kuva muri 2007 gushika 2008 yariko"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["Ivyo 1996—2003)"],
            Some("Ivyo kuva 1996 gushika 2003)"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["COVID-19."],
            Some("COVID-19."),
        ),
        (
            "kirundi.normalizeKirundi",
            &["27/28 ° C"],
            Some("dogere 27 na 28"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["dogere 22/25"],
            Some("dogere 22 na 25"),
        ),
        ("kirundi.normalizeKirundi", &["30 ° C"], Some("dogere 30")),
        ("kirundi.normalizeKirundi", &["0,6 ° C"], Some("dogere 0 6")),
        ("phonemize", &["20 °C", "rn"], Some("doɡeɾe miɾoŋo ibiɾi")),
        ("kirundi.normalizeKirundi", &["9°55'"], Some("dogere 9 55'")),
        ("kirundi.normalizeKirundi", &["30%"], Some("30 kw'ijana")),
        (
            "kirundi.normalizeKirundi",
            &["bane kw'ijana (4%)"],
            Some("bane kw'ijana (4)"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["ibice mirongo icenda kw’ijana (90%)"],
            Some("ibice mirongo icenda kw’ijana (90)"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["27 664 $"],
            Some("amadorari 27664"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["$ 4,000"],
            Some("amadorari 4000"),
        ),
        ("kirundi.normalizeKirundi", &["-39°C"], Some("dogere -39")),
        (
            "kirundi.normalizeKirundi",
            &["+1 000 000"],
            Some("+1000000"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["IVYAKOZW 11:22"],
            Some("IVYAKOZW 11 22"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["Mariko 16:16"],
            Some("Mariko 16 16"),
        ),
        ("kirundi.normalizeKirundi", &["12:22/24"], Some("12 22/24")),
        (
            "kirundi.normalizeKirundi",
            &["( E.P.E.L )"],
            Some("( EPEL )"),
        ),
        ("kirundi.normalizeKirundi", &["(B.E.R.)"], Some("(BER)")),
        (
            "kirundi.normalizeKirundi",
            &["L. L. Zamenhof"],
            Some("LL Zamenhof"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["zigira 49 na 50 m’ubumwe bwa Leta"],
            Some("zigira 49 na 50 m’ubumwe bwa Leta"),
        ),
        (
            "kirundi.normalizeKirundi",
            &["196.7km²"],
            Some("ibirometero kwadarato 196 7"),
        ),
        ("kirundi.normalizeKirundi", &["R & D"], Some("R na D")),
        (
            "phonemize",
            &["9007199254740993", "rn"],
            Some(
                "it͡ʃenda zeɾu zeɾu indwi ɾimwe it͡ʃenda it͡ʃenda kabiɾi ɡatanu kane indwi kane zeɾu it͡ʃenda it͡ʃenda ɡatatu",
            ),
        ),
        (
            "phonemize",
            &["1000000000000000000000", "rn"],
            Some(
                "ɾimwe zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu zeɾu",
            ),
        ),
        (
            "phonemize",
            &["12345678901234567890", "rn"],
            Some(
                "ɾimwe kabiɾi ɡatatu kane ɡatanu ɡatandatu indwi umunani it͡ʃenda zeɾu ɾimwe kabiɾi ɡatatu kane ɡatanu ɡatandatu indwi umunani it͡ʃenda zeɾu",
            ),
        ),
        ("phonemize", &["42", "rn"], Some("miɾoŋo ine na kabiɾi")),
        ("phonemize", &["1000", "rn"], Some("iɡihumbi")),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let call = |f: &str, args: &[&str]| -> Option<JsString> {
            let a = |i: usize| js(args[i]);
            match f {
                "kirundi.phonemizeWord" => Some(phonemize_word(&a(0))),
                "kinyarwanda.phonemizeWord" => Some(
                    crate::languages::kinyarwanda::kinyarwanda::phonemize_word(&a(0)),
                ),
                "kirundi.normalizeKirundi" => Some(normalize_kirundi(&a(0))),
                "kirundi.numberToWords" => Some(number_to_words(
                    js_number(&a(0)),
                    (args.len() > 1).then(|| a(1)).as_ref(),
                )),
                "kinyarwanda.numberToWords" => {
                    Some(crate::languages::kinyarwanda::numbers::number_to_words(
                        js_number(&a(0)),
                        (args.len() > 1).then(|| a(1)).as_ref(),
                    ))
                }
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
    /// `tools/provenance-poison.mts rn` reports 0 sites as well).
    #[test]
    fn kirundi_rewrites_never_poison_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes =
            std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/rn.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/rn.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "rn").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 200);
        assert_eq!(hits.get(), 0);
    }
}

/// #1595, as test/ebantu-defects-1595.test.ts: relational, so no IPA is typed. Synthetic inputs.
#[cfg(all(test, feature = "rn"))]
mod defects_1595_tests {
    #[test]
    fn a_long_decimal_reads_as_one_number() {
        for (input, written) in [("0.125", "0 1 2 5"), ("3.14159", "3 1 4 1 5 9")] {
            assert_eq!(
                crate::phonemize(input, "rn").unwrap(),
                crate::phonemize(written, "rn").unwrap(),
                "{input}"
            );
        }
    }
}
