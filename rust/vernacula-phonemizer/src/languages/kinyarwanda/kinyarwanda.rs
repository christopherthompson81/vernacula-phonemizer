//! Kinyarwanda / Ikinyarwanda (rw) phonemizer: a greedy longest-match scan over the grapheme table (palatalized
//! Cy, the affricates, ng, long vowels), a Latin fallback for a letter with no rule, and text().
//! Ported from src/languages/kinyarwanda/kinyarwanda.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{GRAPHEME_KEYS, MANIFEST, try_manifest};
use super::normalize::{normalize_kinyarwanda, try_symbols};
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

/// The Kinyarwanda engine (`createKinyarwanda`).
pub struct KinyarwandaPhonemizer;

impl KinyarwandaPhonemizer {
    /// `normalizeKinyarwanda(text)` (normalize.ts; it owns the symbol-tier call).
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_kinyarwanda(text)
    }

    /// The symbol tier normalize.ts builds.
    pub fn symbols(&self, text: &JsString) -> JsString {
        try_symbols()
            .expect("checked by create_kinyarwanda")
            .apply(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        assemble_clauses(&normalize_kinyarwanda(input), &TOKEN, |m, s, sink| {
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

impl Engine for KinyarwandaPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(KinyarwandaPhonemizer::text(self, input))
    }
}

/// `createKinyarwanda()`. Loads the manifest and the symbol tier up front.
pub fn create_kinyarwanda() -> Result<KinyarwandaPhonemizer, String> {
    try_manifest()?;
    try_symbols()?;
    Ok(KinyarwandaPhonemizer)
}

#[cfg(all(test, feature = "rw"))]
mod tests {
    use super::*;

    // Every call test/kinyarwanda.test.ts makes into the engine, with the value the TS returned, extracted
    // MECHANICALLY (the suite run under a recording vitest shim that also checked every matcher: all green), so each
    // of the suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("numberToWords", &["0"], Some("zeru")),
        ("numberToWords", &["1"], Some("rimwe")),
        ("numberToWords", &["8"], Some("umunani")),
        ("numberToWords", &["10"], Some("icumi")),
        ("phonemize", &["8", "rw"], Some("umunani")),
        ("numberToWords", &["18"], Some("icumi na umunani")),
        ("numberToWords", &["20"], Some("makumyabiri")),
        ("numberToWords", &["21"], Some("makumyabiri na rimwe")),
        ("numberToWords", &["30"], Some("mirongo itatu")),
        ("numberToWords", &["80"], Some("mirongo inani")),
        ("numberToWords", &["88"], Some("mirongo inani na umunani")),
        ("numberToWords", &["99"], Some("mirongo icyenda na icyenda")),
        ("phonemize", &["20", "rw"], Some("makumʲabiɾi")),
        ("phonemize", &["80", "rw"], Some("miɾoŋo inani")),
        ("numberToWords", &["100"], Some("ijana")),
        ("numberToWords", &["200"], Some("magana abiri")),
        (
            "numberToWords",
            &["555"],
            Some("magana atanu na mirongo itanu na gatanu"),
        ),
        ("phonemize", &["200", "rw"], Some("maɡana abiɾi")),
        ("numberToWords", &["1000"], Some("igihumbi")),
        ("numberToWords", &["2000"], Some("ibihumbi bibiri")),
        ("numberToWords", &["8000"], Some("ibihumbi munani")),
        (
            "numberToWords",
            &["12345"],
            Some("ibihumbi icumi na kabiri na magana atatu na mirongo ine na gatanu"),
        ),
        ("numberToWords", &["1000000"], Some("miriyoni")),
        ("numberToWords", &["3000000"], Some("miriyoni gatatu")),
        ("numberToWords", &["1000001"], Some("miriyoni na rimwe")),
        ("phonemize", &["1000000", "rw"], Some("miɾijoni")),
        ("numberToWords", &["1000000000"], Some("miriyari")),
        ("numberToWords", &["2000000000"], Some("miriyari kabiri")),
        ("numberToWords", &["1000000001"], Some("miriyari na rimwe")),
        (
            "numberToWords",
            &["53910000000"],
            Some("miriyari mirongo itanu na gatatu na miriyoni magana cyenda na icumi"),
        ),
        ("phonemize", &["1000000000", "rw"], Some("miɾijaɾi")),
        (
            "numberToWords",
            &["1234567890123"],
            Some(
                "rimwe kabiri gatatu kane gatanu gatandatu karindwi umunani icyenda zeru rimwe kabiri gatatu",
            ),
        ),
        (
            "numberToWords",
            &["1234567890124"],
            Some(
                "rimwe kabiri gatatu kane gatanu gatandatu karindwi umunani icyenda zeru rimwe kabiri kane",
            ),
        ),
        (
            "numberToWords",
            &["9007199254740992"],
            Some(
                "icyenda zeru zeru karindwi rimwe icyenda icyenda kabiri gatanu kane karindwi kane zeru icyenda icyenda kabiri",
            ),
        ),
        (
            "phonemize",
            &["1234567890123", "rw"],
            Some(
                "ɾimwe kabiɾi ɡatatu kane ɡatanu ɡatandatu kaɾindwi umunani ikʲenda zeɾu ɾimwe kabiɾi ɡatatu",
            ),
        ),
        ("numberToWords", &["100000000000"], Some("miriyari ijana")),
        (
            "numberToWords",
            &["9007199254740992", "9007199254740993"],
            Some(
                "icyenda zeru zeru karindwi rimwe icyenda icyenda kabiri gatanu kane karindwi kane zeru icyenda icyenda gatatu",
            ),
        ),
        (
            "numberToWords",
            &["9007199254740994", "9007199254740994"],
            Some(
                "icyenda zeru zeru karindwi rimwe icyenda icyenda kabiri gatanu kane karindwi kane zeru icyenda icyenda kane",
            ),
        ),
        (
            "phonemize",
            &["9007199254740993", "rw"],
            Some(
                "ikʲenda zeɾu zeɾu kaɾindwi ɾimwe ikʲenda ikʲenda kabiɾi ɡatanu kane kaɾindwi kane zeɾu ikʲenda ikʲenda ɡatatu",
            ),
        ),
        (
            "phonemize",
            &["9007199254740994", "rw"],
            Some(
                "ikʲenda zeɾu zeɾu kaɾindwi ɾimwe ikʲenda ikʲenda kabiɾi ɡatanu kane kaɾindwi kane zeɾu ikʲenda ikʲenda kane",
            ),
        ),
        (
            "phonemize",
            &["12345678901234567890", "rw"],
            Some(
                "ɾimwe kabiɾi ɡatatu kane ɡatanu ɡatandatu kaɾindwi umunani ikʲenda zeɾu ɾimwe kabiɾi ɡatatu kane ɡatanu ɡatandatu kaɾindwi umunani ikʲenda zeɾu",
            ),
        ),
        ("normalizeKinyarwanda", &["60%"], Some("60 ku ijana")),
        ("normalizeKinyarwanda", &["49.5%"], Some("49 5 ku ijana")),
        ("normalizeKinyarwanda", &["98,6%"], Some("98 6 ku ijana")),
        (
            "phonemize",
            &["60%", "rw"],
            Some("miɾoŋo itandatu ku iʒana"),
        ),
        (
            "normalizeKinyarwanda",
            &["25%-30%"],
            Some("25 kugeza kuri 30 ku ijana"),
        ),
        ("normalizeKinyarwanda", &["$1,000"], Some("amadolari 1000")),
        (
            "normalizeKinyarwanda",
            &["US $ 115,600,000"],
            Some("amadolari 115600000"),
        ),
        (
            "normalizeKinyarwanda",
            &["US$115,600,000"],
            Some("amadolari 115600000"),
        ),
        (
            "normalizeKinyarwanda",
            &["Rwf120,250"],
            Some("amafaranga y'u Rwanda 120250"),
        ),
        (
            "normalizeKinyarwanda",
            &["miliyari 290 Frw"],
            Some("amafaranga y'u Rwanda miliyari 290"),
        ),
        (
            "normalizeKinyarwanda",
            &["miliyoni 158$"],
            Some("amadolari miliyoni 158"),
        ),
        (
            "normalizeKinyarwanda",
            &["miliyoni $800"],
            Some("amadolari miliyoni 800"),
        ),
        (
            "normalizeKinyarwanda",
            &["miliyoni 2 Frw"],
            Some("amafaranga y'u Rwanda miliyoni 2"),
        ),
        (
            "normalizeKinyarwanda",
            &["miliyari 290"],
            Some("miliyari 290"),
        ),
        (
            "normalizeKinyarwanda",
            &["290 Frw"],
            Some("amafaranga y'u Rwanda 290"),
        ),
        (
            "normalizeKinyarwanda",
            &["ni iyero (€)"],
            Some("ni iyero (€)"),
        ),
        (
            "normalizeKinyarwanda",
            &["26,338 km²"],
            Some("kilometero kare 26338"),
        ),
        (
            "normalizeKinyarwanda",
            &["km² 26,338"],
            Some("kilometero kare 26338"),
        ),
        ("normalizeKinyarwanda", &["m 900"], Some("metero 900")),
        ("normalizeKinyarwanda", &["cm 25"], Some("santimetero 25")),
        ("normalizeKinyarwanda", &["kg 250"], Some("kirogarama 250")),
        (
            "normalizeKinyarwanda",
            &["450,1hab/km2"],
            Some("450 1hab kuri kilometero kare"),
        ),
        (
            "normalizeKinyarwanda",
            &["hagati ya 1.300m na 1.800m"],
            Some("hagati ya metero 1300 na metero 1800"),
        ),
        ("normalizeKinyarwanda", &["802.11g"], Some("802 1 1g")),
        (
            "normalizeKinyarwanda",
            &["8090 km²"],
            Some("kilometero kare 8090"),
        ),
        (
            "normalizeKinyarwanda",
            &["metero kibe 256"],
            Some("metero kibe 256"),
        ),
        (
            "normalizeKinyarwanda",
            &["kilometero kibe 65"],
            Some("kilometero kibe 65"),
        ),
        (
            "normalizeKinyarwanda",
            &["16.598/km²"],
            Some("16598 kuri kilometero kare"),
        ),
        (
            "normalizeKinyarwanda",
            &["abantu 438 kuri buri km²"],
            Some("abantu 438 kuri buri kilometero kare"),
        ),
        (
            "normalizeKinyarwanda",
            &["100kg/ha"],
            Some("kirogarama 100 kuri hegitari"),
        ),
        (
            "normalizeKinyarwanda",
            &["200g/l"],
            Some("garama 200 kuri litiro"),
        ),
        (
            "normalizeKinyarwanda",
            &["20 °C"],
            Some("dogere selisiyusi 20"),
        ),
        (
            "normalizeKinyarwanda",
            &["24 ° C (75 ° F)"],
            Some("dogere selisiyusi 24 (dogere 75)"),
        ),
        (
            "normalizeKinyarwanda",
            &["hagati ya dogere 22° na 35°"],
            Some("hagati ya dogere 22 na 35"),
        ),
        (
            "normalizeKinyarwanda",
            &["–7 °C"],
            Some("dogere selisiyusi 7 munsi ya zeru"),
        ),
        (
            "normalizeKinyarwanda",
            &["−27.2 °C"],
            Some("dogere selisiyusi 27 2 munsi ya zeru"),
        ),
        (
            "normalizeKinyarwanda",
            &["ubushyuhe bwa -5"],
            Some("ubushyuhe bwa -5"),
        ),
        (
            "normalizeKinyarwanda",
            &["2° 36′ 58″ S"],
            Some("dogere 2 36′ 58″ amajyepfo"),
        ),
        (
            "normalizeKinyarwanda",
            &["1.867 ° S 30.367 ° E"],
            Some("dogere 1 8 6 7 amajyepfo dogere 30 3 6 7 iburasirazuba"),
        ),
        (
            "normalizeKinyarwanda",
            &["15-24"],
            Some("15 kugeza kuri 24"),
        ),
        (
            "normalizeKinyarwanda",
            &["1250-1750mm"],
            Some("milimetero 1250 kugeza kuri 1750"),
        ),
        (
            "normalizeKinyarwanda",
            &["80-94 cm"],
            Some("santimetero 80 kugeza kuri 94"),
        ),
        (
            "normalizeKinyarwanda",
            &["dogere selisiyusi 26-28"],
            Some("dogere selisiyusi 26 kugeza kuri 28"),
        ),
        (
            "normalizeKinyarwanda",
            &["40-42 °"],
            Some("dogere 40 kugeza kuri 42"),
        ),
        ("normalizeKinyarwanda", &["1990–91"], Some("1990–91")),
        (
            "normalizeKinyarwanda",
            &["igitego 1-0"],
            Some("igitego 1-0"),
        ),
        (
            "normalizeKinyarwanda",
            &["NPK(17-17-17)"],
            Some("NPK(17-17-17)"),
        ),
        ("normalizeKinyarwanda", &["COVID-19"], Some("COVID-19")),
        (
            "normalizeKinyarwanda",
            &["Kuva 2006-Ukwakira"],
            Some("Kuva 2006-Ukwakira"),
        ),
        (
            "normalizeKinyarwanda",
            &["hagati yimyaka 15-24."],
            Some("hagati yimyaka 15 kugeza kuri 24."),
        ),
        (
            "normalizeKinyarwanda",
            &["Muri 2009-2010,"],
            Some("Muri 2009 kugeza kuri 2010,"),
        ),
        (
            "normalizeKinyarwanda",
            &["Crises 1900 – 1994,"],
            Some("Crises 1900 kugeza kuri 1994,"),
        ),
        (
            "normalizeKinyarwanda",
            &["1250-1750mm."],
            Some("milimetero 1250 kugeza kuri 1750."),
        ),
        ("normalizeKinyarwanda", &["2,2-2,8"], Some("2 2-2 8")),
        (
            "normalizeKinyarwanda",
            &["NPK(17-17-17)."],
            Some("NPK(17-17-17)."),
        ),
        (
            "normalizeKinyarwanda",
            &["saa 10:00 za mbere"],
            Some("saa 10 za mbere"),
        ),
        (
            "normalizeKinyarwanda",
            &["saa 3:15"],
            Some("saa 3 na iminota 15"),
        ),
        (
            "normalizeKinyarwanda",
            &["igihe cya 2:51:07"],
            Some("igihe cya amasaha 2 iminota 51 amasegonda 7"),
        ),
        (
            "normalizeKinyarwanda",
            &["11:59:59 UTC"],
            Some("11 59 59 UTC"),
        ),
        (
            "normalizeKinyarwanda",
            &["Marko 14:25"],
            Some("Marko 14 25"),
        ),
        ("normalizeKinyarwanda", &["2,944,459"], Some("2944459")),
        ("normalizeKinyarwanda", &["19.000.700"], Some("19000700")),
        ("normalizeKinyarwanda", &["8 000 000"], Some("8000000")),
        ("normalizeKinyarwanda", &["7.87"], Some("7 8 7")),
        (
            "normalizeKinyarwanda",
            &["1157,3 km²"],
            Some("kilometero kare 1157 3"),
        ),
        (
            "normalizeKinyarwanda",
            &["NPK17.17.17"],
            Some("NPK17.17.17"),
        ),
        ("normalizeKinyarwanda", &["ni 49.5."], Some("ni 49 5.")),
        (
            "normalizeKinyarwanda",
            &["Ukuboza 26,2008"],
            Some("Ukuboza 26,2008"),
        ),
        (
            "normalizeKinyarwanda",
            &["muri U.R.S.S. no muri Pologne"],
            Some("muri URSS no muri Pologne"),
        ),
        (
            "normalizeKinyarwanda",
            &["muri U.R.S.S."],
            Some("muri URSS."),
        ),
        (
            "normalizeKinyarwanda",
            &["R.R.A Rwanda Revenue Authority"],
            Some("RRA Rwanda Revenue Authority"),
        ),
        (
            "normalizeKinyarwanda",
            &["Arts & Sciences"],
            Some("Arts na Sciences"),
        ),
        (
            "normalizeKinyarwanda",
            &["E&D Limited"],
            Some("E na D Limited"),
        ),
        (
            "normalizeKinyarwanda",
            &[
                "U Rwanda ni igihugu giherereye muri Afurika y'uburengerazuba, mu karere k’ibiyaga bigari.",
            ],
            Some(
                "U Rwanda ni igihugu giherereye muri Afurika y'uburengerazuba, mu karere k’ibiyaga bigari.",
            ),
        ),
        (
            "normalizeKinyarwanda",
            &["Mu karere ka Huye, abantu bahageze kare kandi bagumye kuri gahunda."],
            Some("Mu karere ka Huye, abantu bahageze kare kandi bagumye kuri gahunda."),
        ),
        (
            "phonemize",
            &["agafuniko 1 kagira gm 6", "rw"],
            Some("aɡafuniko ɾimwe kaɡiɾa ɡaɾama ɡatandatu"),
        ),
        (
            "phonemize",
            &["ifumbire ya NPK gr 12.5", "rw"],
            Some("ifumbiɾe ja npk ɡaɾama it͡ʃumi na kabiɾi ɡatanu"),
        ),
        ("phonemize", &["imodoka ya GM", "rw"], Some("imodoka ja ɡm")),
        (
            "normalizeKinyarwanda",
            &["−27.2 °C (−17.0 °F)"],
            Some("dogere selisiyusi 27 2 munsi ya zeru (dogere 17 0 munsi ya zeru)"),
        ),
        (
            "normalizeKinyarwanda",
            &["−14.4 °C (6.1 °F)"],
            Some("dogere selisiyusi 14 4 munsi ya zeru (dogere 6 1)"),
        ),
        (
            "normalizeKinyarwanda",
            &["dogere 22° na 35°"],
            Some("dogere 22 na 35"),
        ),
        (
            "normalizeKinyarwanda",
            &["hagati ya 22° na 35°"],
            Some("hagati ya dogere 22 na dogere 35"),
        ),
        (
            "normalizeKinyarwanda",
            &["−5 °C na 30°"],
            Some("dogere selisiyusi 5 munsi ya zeru na dogere 30"),
        ),
        (
            "normalizeKinyarwanda",
            &["2° 36′ 58″ S, 29° 44′ 34″ E"],
            Some("dogere 2 36′ 58″ amajyepfo, dogere 29 44′ 34″ iburasirazuba"),
        ),
        (
            "phonemize",
            &["−27.2 °C (−17.0 °F)", "rw"],
            Some(
                "doɡeɾe selisijusi makumʲabiɾi na kaɾindwi kabiɾi munsi ja zeɾu doɡeɾe it͡ʃumi na kaɾindwi zeɾu munsi ja zeɾu",
            ),
        ),
        (
            "phonemize",
            &["40-42 °", "rw"],
            Some("doɡeɾe miɾoŋo ine kuɡeza kuɾi miɾoŋo ine na kabiɾi"),
        ),
        (
            "phonemize",
            &["2° 36′ 58″ S", "rw"],
            Some("doɡeɾe kabiɾi miɾoŋo itatu na ɡatandatu miɾoŋo itanu na umunani amaɡʲepfo"),
        ),
        ("normalizeKinyarwanda", &["dogere 22°"], Some("dogere 22")),
        (
            "phonemize",
            &["dogere 22°", "rw"],
            Some("doɡeɾe makumʲabiɾi na kabiɾi"),
        ),
        ("normalizeKinyarwanda", &["42"], Some("42")),
        ("phonemize", &["42", "rw"], Some("miɾoŋo ine na kabiɾi")),
        ("normalizeKinyarwanda", &["x"], Some("x")),
        ("phonemize", &["x", "rw"], Some("z")),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let call = |f: &str, args: &[&str]| -> Option<JsString> {
            let a = |i: usize| js(args[i]);
            match f {
                "phonemizeWord" => Some(phonemize_word(&a(0))),
                "normalizeKinyarwanda" => Some(normalize_kinyarwanda(&a(0))),
                "numberToWords" => Some(number_to_words(
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
    /// `tools/provenance-poison.mts rw` reports 0 sites as well).
    #[test]
    fn kinyarwanda_rewrites_never_poison_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes =
            std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/rw.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/rw.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "rw").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 200);
        assert_eq!(hits.get(), 0);
    }
}
