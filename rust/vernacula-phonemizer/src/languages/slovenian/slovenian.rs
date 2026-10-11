//! Slovenian (sl) phonemizer, canonical IPA: the rule g2p's segments with ˈ before the stressed nucleus, from
//! stress.tsv, else a known compound tail's stress shifted by its prefix, else the penultimate; the five-slot
//! count selector and the symbol tier normalize.ts applies; text() over words, numbers and clause punctuation.
//! Ported from src/languages/slovenian/slovenian.ts — see that file for the corpus evidence.

use std::sync::{Arc, LazyLock, OnceLock};

use indexmap::IndexMap;

use super::g2p::{Seg, to_segments};
use super::manifest::{DIR, MANIFEST, try_manifest};
use super::normalize::normalize_slovenian;
use super::numbers::{number_to_words, read_digits};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_map};
use crate::core::normalize_symbols::{
    ExponentPosition, ExponentWords, Multiply, PositionDecl, SymbolData, SymbolNormalizer, UnitPer,
    make_symbol_normalizer,
};
use crate::registry::{Engine, PhonemizeError};

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[A-Za-zČčŠšŽžĆćĐđ]", "u")));

/// `nat(word)`.
pub fn nat(word: &JsString) -> JsString {
    NAT(word)
}

/// stress.tsv (word → the JS number of its nucleus ordinal), every key also filed under its `nat` fold.
fn try_stress() -> Result<&'static IndexMap<JsString, f64>, String> {
    static S: OnceLock<IndexMap<JsString, f64>> = OnceLock::new();
    load_once(&S, || {
        let fold = |k: &JsString| nat(k);
        load_tsv_map(
            DIR,
            "stress.tsv",
            |v, _| Some(js_number(v)),
            TsvOptions {
                optional: false,
                fold: Some(&fold),
            },
        )
        .map_err(|e| e.to_string())
    })
}

static STRESS: LazyLock<&'static IndexMap<JsString, f64>> =
    LazyLock::new(|| try_stress().unwrap_or_else(|e| panic!("{e}")));

/// `stressLexiconHas(word)`.
pub fn stress_lexicon_has(word: &JsString) -> bool {
    STRESS.contains_key(&word.to_lower_case())
}

const MIN_SUFFIX: isize = 6;

fn is_v(c: Option<u16>) -> bool {
    c.is_some_and(|c| "aeiou".encode_utf16().any(|v| v == c))
}

/// `countNuclei(w, end)`: vowels, and an ⟨r⟩ with no vowel letter beside it in the whole word.
fn count_nuclei(w: &JsString, end: usize) -> f64 {
    let mut n = 0.0;
    for i in 0..end {
        let c = w.0[i];
        let syllabic_r = c == b'r' as u16
            && !is_v(i.checked_sub(1).map(|j| w.0[j]))
            && !is_v(w.0.get(i + 1).copied());
        if is_v(Some(c)) || syllabic_r {
            n += 1.0;
        }
    }
    n
}

/// `bySuffix(w, nucleiCount)`: the longest lexicon tail of ≥ 6 units, its stress shifted by the prefix.
fn by_suffix(w: &JsString, nuclei_count: usize) -> Option<f64> {
    let mut cut = w.len() as isize - MIN_SUFFIX;
    while cut > 0 {
        let Some(&at) = STRESS.get(&w.slice(cut, None)) else {
            cut -= 1;
            continue;
        };
        let prefix = count_nuclei(w, cut as usize);
        if prefix < 1.0 {
            cut -= 1;
            continue;
        }
        let shifted = prefix + at;
        return (shifted < nuclei_count as f64).then_some(shifted);
    }
    None
}

/// `phonemizeWord(word)`.
pub fn phonemize_word(word: &JsString) -> JsString {
    let segs = to_segments(word);
    let join = |segs: &[Seg], mark: Option<usize>| {
        let mut out = JsString::new();
        for (i, s) in segs.iter().enumerate() {
            if Some(i) == mark {
                out.push_str(&js("ˈ"));
            }
            out.push_str(&s.ph);
        }
        out
    };
    let nuclei: Vec<usize> = (0..segs.len()).filter(|&i| segs[i].nucleus).collect();
    if nuclei.len() < 2 {
        return join(&segs, None);
    }
    let lower = word.to_lower_case();
    let at = match STRESS.get(&lower) {
        Some(&k) if k < nuclei.len() as f64 => k,
        _ => by_suffix(&lower, nuclei.len()).unwrap_or((nuclei.len() - 2) as f64),
    };
    // `nuclei[at]`: a negative or fractional ordinal indexes nothing, and no mark is placed.
    let mark = (at >= 0.0 && at.fract() == 0.0)
        .then(|| nuclei.get(at as usize).copied())
        .flatten();
    join(&segs, mark)
}

/// `slCountForm(n)`: 0 sg · 1 dual · 2 paucal (3–4) · 3 gen.pl · 4 gen.sg (a decimal).
pub fn sl_count_form(n: f64) -> f64 {
    if !(n.is_finite() && n.fract() == 0.0) {
        4.0
    } else if n == 1.0 {
        0.0
    } else if n == 2.0 {
        1.0
    } else if (3.0..=4.0).contains(&n) {
        2.0
    } else {
        3.0
    }
}

/// A counted noun's gender and its five `slCountForm` slots.
pub struct Counted {
    pub g: &'static str,
    pub forms: [&'static str; 5],
}

/// `COUNTED`, in the TS object's key order (the gender repair iterates it).
pub const COUNTED: [(&str, Counted); 14] = [
    (
        "km",
        Counted {
            g: "m",
            forms: [
                "kilometer",
                "kilometra",
                "kilometri",
                "kilometrov",
                "kilometra",
            ],
        },
    ),
    (
        "m",
        Counted {
            g: "m",
            forms: ["meter", "metra", "metri", "metrov", "metra"],
        },
    ),
    (
        "mm",
        Counted {
            g: "m",
            forms: [
                "milimeter",
                "milimetra",
                "milimetri",
                "milimetrov",
                "milimetra",
            ],
        },
    ),
    (
        "cm",
        Counted {
            g: "m",
            forms: [
                "centimeter",
                "centimetra",
                "centimetri",
                "centimetrov",
                "centimetra",
            ],
        },
    ),
    (
        "kg",
        Counted {
            g: "m",
            forms: [
                "kilogram",
                "kilograma",
                "kilogrami",
                "kilogramov",
                "kilograma",
            ],
        },
    ),
    (
        "ghz",
        Counted {
            g: "m",
            forms: [
                "gigaherc",
                "gigaherca",
                "gigaherci",
                "gigahercev",
                "gigaherca",
            ],
        },
    ),
    (
        "mbit",
        Counted {
            g: "m",
            forms: ["megabit", "megabita", "megabiti", "megabitov", "megabita"],
        },
    ),
    (
        "mph",
        Counted {
            g: "f",
            forms: [
                "milja na uro",
                "milji na uro",
                "milje na uro",
                "milj na uro",
                "milje na uro",
            ],
        },
    ),
    (
        "deg",
        Counted {
            g: "f",
            forms: ["stopinja", "stopinji", "stopinje", "stopinj", "stopinje"],
        },
    ),
    (
        "pct",
        Counted {
            g: "m",
            forms: ["odstotek", "odstotka", "odstotki", "odstotkov", "odstotka"],
        },
    ),
    (
        "usd",
        Counted {
            g: "m",
            forms: ["dolar", "dolarja", "dolarji", "dolarjev", "dolarja"],
        },
    ),
    (
        "eur",
        Counted {
            g: "m",
            forms: ["evro", "evra", "evri", "evrov", "evra"],
        },
    ),
    (
        "gbp",
        Counted {
            g: "m",
            forms: ["funt", "funta", "funti", "funtov", "funta"],
        },
    ),
    (
        "jpy",
        Counted {
            g: "m",
            forms: ["jen", "jena", "jeni", "jenov", "jena"],
        },
    ),
];

/// `COUNTED[key]!.forms`.
pub fn counted_forms(key: &str) -> &'static [&'static str; 5] {
    &COUNTED
        .iter()
        .find(|(k, _)| *k == key)
        .expect("a COUNTED key")
        .1
        .forms
}

fn forms(f: &[&str]) -> Vec<String> {
    f.iter().map(|s| s.to_string()).collect()
}

/// `SYMBOLS` (slovenian.ts).
pub(crate) static SYMBOLS: LazyLock<SymbolNormalizer> = LazyLock::new(|| {
    let mut currency = IndexMap::new();
    for (k, f) in [
        ("$", ["dolar", "dolarja", "dolarji", "dolarjev", "dolarja"]),
        (
            "USD",
            ["dolar", "dolarja", "dolarji", "dolarjev", "dolarja"],
        ),
        ("€", ["evro", "evra", "evri", "evrov", "evra"]),
        ("£", ["funt", "funta", "funti", "funtov", "funta"]),
        ("¥", ["jen", "jena", "jeni", "jenov", "jena"]),
    ] {
        currency.insert(k.to_string(), forms(&f));
    }
    let mut units = IndexMap::new();
    for k in ["km", "m", "mm", "cm", "kg", "ghz", "mbit", "mph"] {
        units.insert(k.to_string(), forms(counted_forms(k)));
    }
    let mut rate = IndexMap::new();
    rate.insert("h".to_string(), "uro".to_string());
    rate.insert("s".to_string(), "sekundo".to_string());
    make_symbol_normalizer(&SymbolData {
        multiply: Some(Multiply {
            times: "krat".into(),
            by: None,
        }),
        percent: Some(forms(counted_forms("pct"))),
        currency: Some(currency),
        units: Some(units),
        magnitudes: Some(forms(&[
            "milijon",
            "milijona",
            "milijoni",
            "milijonov",
            "milijarda",
            "milijardi",
            "milijarde",
            "milijard",
            "tisoč",
        ])),
        unit_per: Some(UnitPer::All("na".into())),
        rate_denominators: Some(rate),
        exponent_words: Some(ExponentWords {
            squared: Some(forms(&[
                "kvadratni",
                "kvadratna",
                "kvadratni",
                "kvadratnih",
                "kvadratnega",
            ])),
            cubed: Some(forms(&[
                "kubični",
                "kubična",
                "kubični",
                "kubičnih",
                "kubičnega",
            ])),
            position: Some(PositionDecl::All(ExponentPosition::Before)),
        }),
        count_form: Some(Arc::new(sl_count_form)),
        ..Default::default()
    })
    .expect("slovenian SYMBOLS")
});

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.!?…,;:])", *LATIN_RUN), "gu").unwrap());

/// The Slovenian engine (`createSlovenian`).
pub struct SlovenianPhonemizer;

impl SlovenianPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_slovenian(text)
    }

    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        super::normalize::normalize_slovenian_initialisms(text)
    }

    pub fn is_unreadable(&self, word: &JsString) -> bool {
        super::normalize::is_unreadable_slovenian(word)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        SYMBOLS.apply(text)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn segments(&self, word: &JsString) -> Vec<Seg> {
        to_segments(word)
    }

    pub fn nativise(&self, word: &JsString) -> JsString {
        nat(word)
    }

    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    pub fn read_digits(&self, digits: &JsString) -> JsString {
        read_digits(digits)
    }

    /// `ordinalWords(n, slot)` (normalize.ts); `None` for an unknown slot or an unreadable number.
    pub fn ordinal_words(&self, n: f64, slot: &str) -> Option<JsString> {
        super::normalize::ordinal_words(n, slot)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let m = &*MANIFEST;
        assemble_clauses(&normalize_slovenian(input), &TOKEN, |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&nat(&w)));
            } else if let Some(d) = mm.group(2, s).filter(|d| !d.is_empty()) {
                let words = if d.len() <= 15 {
                    number_to_words(js_number(&d), Some(&d))
                } else {
                    read_digits(&d)
                };
                for wd in words.split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = mm.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) = m
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for SlovenianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(SlovenianPhonemizer::text(self, input))
    }
}

/// `createSlovenian()`. Errors when the manifest or the stress table cannot be loaded.
pub fn create_slovenian() -> Result<SlovenianPhonemizer, String> {
    try_manifest()?;
    try_stress()?;
    Ok(SlovenianPhonemizer)
}

/// test/slovenian.test.ts's literal-input pins, extracted mechanically (`.probe/sh/pins.mts`) with every value
/// evaluated from the TS engine; never hand-typed.
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slovenian_test_ts_pins() {
        let e = create_slovenian().unwrap();
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("polje")).to_string_lossy(),
            "pˈɔljɛ"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("banja")).to_string_lossy(),
            "bˈanja"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("kralj")).to_string_lossy(),
            "kral"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("konj")).to_string_lossy(),
            "kɔn"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("Ljubljana"))
                .to_string_lossy(),
            "ljubljˈana"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("prst")).to_string_lossy(),
            "pərst"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("vrt")).to_string_lossy(),
            "ʋərt"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("grad")).to_string_lossy(),
            "ɡrat"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("glasba")).to_string_lossy(),
            "ɡlˈazba"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("Abhazija"))
                .to_string_lossy(),
            "abxˈazija"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("človek")).to_string_lossy(),
            "t͡ʃlˈɔʋɛk"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("voda")).to_string_lossy(),
            "ʋˈɔda"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("dober")).to_string_lossy(),
            "dˈɔbɛr"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("Đorđe")).to_string_lossy(),
            "d͡ʒˈɔrd͡ʒɛ"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("ćevapi")).to_string_lossy(),
            "t͡ʃɛʋˈapi"
        );
        assert_eq!(
            e.text(&js("21")).to_string_lossy().trim().to_string(),
            "ɛnaindʋˈajsɛt"
        );
        assert_eq!(
            e.text(&js("35")).to_string_lossy().trim().to_string(),
            "pɛtintrˈidɛsɛt"
        );
        assert_eq!(
            e.text(&js("234")).to_string_lossy().trim().to_string(),
            "dʋˈɛstɔ ʃtiriintrˈidɛsɛt"
        );
        assert_eq!(
            e.text(&js("2000000")).to_string_lossy().trim().to_string(),
            "dʋa milijˈɔna"
        );
        assert_eq!(
            e.text(&js("3000000")).to_string_lossy().trim().to_string(),
            "trˈijɛ milijˈɔni"
        );
        assert_eq!(
            e.text(&js("2000000000"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dʋɛ milijˈardi"
        );
        assert_eq!(
            e.text(&js("Dober dan, Slovenija!"))
                .to_string_lossy()
                .trim()
                .to_string(),
            "dˈɔbɛr dan , slɔʋˈɛnija !"
        );
        assert_eq!(
            e.normalize(&js("V 16. stoletju")).to_string_lossy(),
            "V šestnajstem stoletju"
        );
        assert_eq!(
            e.normalize(&js("19. stoletja")).to_string_lossy(),
            "devetnajstega stoletja"
        );
        assert_eq!(
            e.normalize(&js("17. stoletje, leta 1861"))
                .to_string_lossy(),
            "sedemnajsto stoletje, leta 1861"
        );
        assert_eq!(
            e.normalize(&js("9. julija")).to_string_lossy(),
            "devetega julija"
        );
        assert_eq!(
            e.normalize(&js("V 80. letih 20. stoletja"))
                .to_string_lossy(),
            "V osemdesetih letih dvajsetega stoletja"
        );
        assert_eq!(
            e.normalize(&js("na 190. mesto")).to_string_lossy(),
            "na sto devetdeseto mesto"
        );
        assert_eq!(
            e.normalize(&js("nevihte 4. kategorije")).to_string_lossy(),
            "nevihte četrte kategorije"
        );
        assert_eq!(
            e.normalize(&js("s 247. členom")).to_string_lossy(),
            "s dvesto sedeminštiridesetim členom"
        );
        assert_eq!(
            e.normalize(&js("Malo po 11. uri")).to_string_lossy(),
            "Malo po enajsti uri"
        );
        assert_eq!(
            e.normalize(&js("veliko nagrado Madžarske leta 2009."))
                .to_string_lossy(),
            "veliko nagrado Madžarske leta 2009."
        );
        assert_eq!(
            e.normalize(&js("prezasedenosti, 1300.")).to_string_lossy(),
            "prezasedenosti, 1300."
        );
        assert_eq!(
            e.normalize(&js("leta 2020 aktivnih 16.")).to_string_lossy(),
            "leta 2020 aktivnih 16."
        );
        assert_eq!(
            e.normalize(&js("severno od 1770. Občasno jih je"))
                .to_string_lossy(),
            "severno od 1770. Občasno jih je"
        );
        assert_eq!(
            e.normalize(&js("v 1. in 2. svetovni vojni."))
                .to_string_lossy(),
            "v prvi in drugi svetovni vojni."
        );
        assert_eq!(
            e.normalize(&js("Med 22. in 23. uro")).to_string_lossy(),
            "Med dvaindvajseto in triindvajseto uro"
        );
        assert_eq!(
            e.normalize(&js("njegov 60. v sezoni")).to_string_lossy(),
            "njegov šestdeseti v sezoni"
        );
        assert_eq!(
            e.normalize(&js("10. italijanske vojske")).to_string_lossy(),
            "desete italijanske vojske"
        );
        assert_eq!(
            e.normalize(&js("s 5. največjega")).to_string_lossy(),
            "s petega največjega"
        );
        assert_eq!(
            e.normalize(&js("v 5. največjih")).to_string_lossy(),
            "v petih največjih"
        );
        assert_eq!(
            e.normalize(&js("kraljica Elizabeta 2 zadnja"))
                .to_string_lossy(),
            "kraljica Elizabeta druga zadnja"
        );
        assert_eq!(
            e.normalize(&js("kraljice Elizabete 2 postati"))
                .to_string_lossy(),
            "kraljice Elizabete druge postati"
        );
        assert_eq!(
            e.normalize(&js("kralja Sejonga 4. je")).to_string_lossy(),
            "kralja Sejonga četrtega je"
        );
        assert_eq!(
            e.normalize(&js("Kar 20 odstotkov vode")).to_string_lossy(),
            "Kar 20 odstotkov vode"
        );
        assert_eq!(e.normalize(&js("0 %")).to_string_lossy(), "0 odstotkov");
        assert_eq!(
            e.normalize(&js("0 °C")).to_string_lossy(),
            "0 stopinj Celzija"
        );
        assert_eq!(e.normalize(&js("0 km")).to_string_lossy(), "0 kilometrov");
        assert_eq!(e.normalize(&js("1 %")).to_string_lossy(), "en odstotek");
        assert_eq!(e.normalize(&js("2 %")).to_string_lossy(), "2 odstotka");
        assert_eq!(
            e.normalize(&js("obsega 3 % države")).to_string_lossy(),
            "obsega trije odstotki države"
        );
        assert_eq!(
            e.normalize(&js("ima 93 % prebivalstva")).to_string_lossy(),
            "ima 93 odstotkov prebivalstva"
        );
        assert_eq!(e.normalize(&js("22 %")).to_string_lossy(), "22 odstotkov");
        assert_eq!(
            e.normalize(&js("2,5 %")).to_string_lossy(),
            "2 vejica 5 odstotka"
        );
        assert_eq!(e.normalize(&js("1 km")).to_string_lossy(), "en kilometer");
        assert_eq!(
            e.normalize(&js("4 km")).to_string_lossy(),
            "štirje kilometri"
        );
        assert_eq!(
            e.normalize(&js("2 mph")).to_string_lossy(),
            "dve milji na uro"
        );
        assert_eq!(
            e.normalize(&js("3 mph")).to_string_lossy(),
            "3 milje na uro"
        );
        assert_eq!(
            e.normalize(&js("prekriva 2–3 km ledu")).to_string_lossy(),
            "prekriva 2 do 3 kilometri ledu"
        );
        assert_eq!(
            e.normalize(&js("Park pokriva 19.500 km²"))
                .to_string_lossy(),
            "Park pokriva 19500 kvadratnih kilometrov"
        );
        assert_eq!(
            e.normalize(&js("5.000.000 posameznikov")).to_string_lossy(),
            "5000000 posameznikov"
        );
        assert_eq!(
            e.normalize(&js("magnitude 6,5.")).to_string_lossy(),
            "magnitude 6 vejica 5."
        );
        assert_eq!(
            e.normalize(&js("2,4 GHz")).to_string_lossy(),
            "2 vejica 4 gigaherca"
        );
        assert_eq!(
            e.normalize(&js("0,001 grama")).to_string_lossy(),
            "0 vejica 0 0 1 grama"
        );
        assert_eq!(
            e.normalize(&js("0,05 grama")).to_string_lossy(),
            "0 vejica 0 5 grama"
        );
        assert_eq!(
            e.normalize(&js("1,50 km")).to_string_lossy(),
            "1 vejica 50 kilometra"
        );
        assert_eq!(
            e.normalize(&js("so ob 23.35 naposled")).to_string_lossy(),
            "so ob triindvajseti uri petintrideset naposled"
        );
        assert_eq!(
            e.normalize(&js("začele ob 10.00 z")).to_string_lossy(),
            "začele ob deseti uri z"
        );
        assert_eq!(
            e.normalize(&js("okoli 9.30 ure po")).to_string_lossy(),
            "okoli devete ure trideset po"
        );
        assert_eq!(
            e.normalize(&js("pa od 6.30 do 7.30.")).to_string_lossy(),
            "pa od šeste ure trideset do sedme ure trideset."
        );
        assert_eq!(
            e.normalize(&js("ob 07:19 po")).to_string_lossy(),
            "ob sedmi uri devetnajst po"
        );
        assert_eq!(
            e.normalize(&js("(15.00 po UTC)")).to_string_lossy(),
            "(petnajsta ura po u te ce)"
        );
        assert_eq!(
            e.normalize(&js("zmagala 26:00 proti")).to_string_lossy(),
            "zmagala 26 00 proti"
        );
        assert_eq!(
            e.normalize(&js("je torej 3:2 razmerje")).to_string_lossy(),
            "je torej 3 proti 2 razmerje"
        );
        assert_eq!(
            e.normalize(&js("vojni (1894–1895) podpisala"))
                .to_string_lossy(),
            "vojni (1894 do 1895) podpisala"
        );
        assert_eq!(
            e.normalize(&js("izpred 4,2–3,9 milijona"))
                .to_string_lossy(),
            "izpred 4 vejica 2 do 3 vejica 9 milijona"
        );
        assert_eq!(
            e.normalize(&js("prekriva 2–3 km ledu")).to_string_lossy(),
            "prekriva 2 do 3 kilometri ledu"
        );
        assert_eq!(e.normalize(&js("COVID-19.")).to_string_lossy(), "COVID-19.");
        assert_eq!(
            e.normalize(&js("po rezultatu 6-6 tudi")).to_string_lossy(),
            "po rezultatu 6 proti 6 tudi"
        );
        assert_eq!(
            e.normalize(&js("proti Kanadčanu je 7–2."))
                .to_string_lossy(),
            "proti Kanadčanu je 7 proti 2."
        );
        assert_eq!(
            e.normalize(&js("je torej 3:2.")).to_string_lossy(),
            "je torej 3 proti 2."
        );
        assert_eq!(
            e.normalize(&js("izpred 4,2–3,9 milijona"))
                .to_string_lossy(),
            "izpred 4 vejica 2 do 3 vejica 9 milijona"
        );
        assert_eq!(
            e.normalize(&js("zmagala 26:00 proti peti"))
                .to_string_lossy(),
            "zmagala 26 00 proti peti"
        );
        assert_eq!(
            e.normalize(&js("(LaFasto, 1989: 109).")).to_string_lossy(),
            "(LaFasto, 1989: 109)."
        );
        assert_eq!(
            e.normalize(&js("od leta 1995–96, ko")).to_string_lossy(),
            "od leta 1995–96, ko"
        );
        assert_eq!(
            e.normalize(&js("dosegal 70 km/h")).to_string_lossy(),
            "dosegal 70 kilometrov na uro"
        );
        assert_eq!(
            e.normalize(&js("(133 m/s; 300 mph)")).to_string_lossy(),
            "(133 metrov na sekundo; 300 milj na uro)"
        );
        assert_eq!(
            e.normalize(&js("600 Mbit/s.")).to_string_lossy(),
            "600 megabitov na sekundo."
        );
        assert_eq!(
            e.normalize(&js("3136 mm2 proti")).to_string_lossy(),
            "3136 kvadratnih milimetrov proti"
        );
        assert_eq!(
            e.normalize(&js("2,2 milijona km2")).to_string_lossy(),
            "2 vejica 2 milijona kvadratnih kilometrov"
        );
        assert_eq!(
            e.normalize(&js("od 35-mm negativa")).to_string_lossy(),
            "od 35 milimetrov negativa"
        );
        assert_eq!(
            e.normalize(&js("pogosto 100–200 milj/uro"))
                .to_string_lossy(),
            "pogosto 100 do 200 milj na uro"
        );
        assert_eq!(
            e.normalize(&js("120–160 kubičnih metrov"))
                .to_string_lossy(),
            "120 do 160 kubičnih metrov"
        );
        assert_eq!(
            e.normalize(&js("leta 323 pr. n. š. obnovili."))
                .to_string_lossy(),
            "leta 323 pred našim štetjem obnovili."
        );
        assert_eq!(
            e.normalize(&js("do 1100 n. š.")).to_string_lossy(),
            "do 1100 našega štetja."
        );
        assert_eq!(
            e.normalize(&js("leto 5000 pr. n. št.!")).to_string_lossy(),
            "leto 5000 pred našim štetjem!"
        );
        assert_eq!(
            e.normalize(&js("N. Š. Kovač je prišel")).to_string_lossy(),
            "ne še Kovač je prišel"
        );
        assert_eq!(
            e.normalize(&js("Pr. N. Š. Kovač je prišel"))
                .to_string_lossy(),
            "Pr. ne še Kovač je prišel"
        );
        assert_eq!(
            e.normalize(&js("restavracije itd.")).to_string_lossy(),
            "restavracije in tako dalje."
        );
        assert_eq!(
            e.normalize(&js("jedi idr., ki se")).to_string_lossy(),
            "jedi in drugo, ki se"
        );
        assert_eq!(
            e.normalize(&js("(npr. vizo)")).to_string_lossy(),
            "(na primer vizo)"
        );
        assert_eq!(
            e.normalize(&js("kozmonavt št. 11")).to_string_lossy(),
            "kozmonavt številka 11"
        );
        assert_eq!(
            e.normalize(&js("Ga. Kirchner je")).to_string_lossy(),
            "gospa Kirchner je"
        );
        assert_eq!(
            e.normalize(&js("meni dr. Moll, in")).to_string_lossy(),
            "meni doktor Moll, in"
        );
        assert_eq!(
            e.normalize(&js("zato ga nisem zares poslušal ga."))
                .to_string_lossy(),
            "zato ga nisem zares poslušal ga."
        );
        assert_eq!(
            e.normalize(&js("Vzel ga. je")).to_string_lossy(),
            "Vzel ga. je"
        );
        assert_eq!(
            e.normalize(&js("dr. lee je prišel")).to_string_lossy(),
            "dr. lee je prišel"
        );
        assert_eq!(
            e.normalize(&js("kraljica Elizabeta 2 je"))
                .to_string_lossy(),
            "kraljica Elizabeta druga je"
        );
        assert_eq!(
            e.normalize(&js("kraljice Elizabete 2 je"))
                .to_string_lossy(),
            "kraljice Elizabete druge je"
        );
        assert_eq!(
            e.normalize(&js("kralj je bil 12 let")).to_string_lossy(),
            "kralj je bil 12 let"
        );
        assert_eq!(
            e.normalize(&js("cesar je umrl pri 40 letih"))
                .to_string_lossy(),
            "cesar je umrl pri 40 letih"
        );
        assert_eq!(
            e.normalize(&js("papež je bil star 78 let"))
                .to_string_lossy(),
            "papež je bil star 78 let"
        );
        assert_eq!(
            e.normalize(&js("poglavar je govoril 2 uri"))
                .to_string_lossy(),
            "poglavar je govoril 2 uri"
        );
        assert_eq!(
            e.normalize(&js("1,5 °C")).to_string_lossy(),
            "1 vejica 5 stopinje Celzija"
        );
        assert_eq!(
            e.normalize(&js("2,4 °C")).to_string_lossy(),
            "2 vejica 4 stopinje Celzija"
        );
        assert_eq!(
            e.normalize(&js("0,5 °C")).to_string_lossy(),
            "0 vejica 5 stopinje Celzija"
        );
        assert_eq!(
            e.normalize(&js("1 °C")).to_string_lossy(),
            "1 stopinja Celzija"
        );
        assert_eq!(
            e.normalize(&js("2 °C")).to_string_lossy(),
            "dve stopinji Celzija"
        );
        assert_eq!(
            e.normalize(&js("90 °F")).to_string_lossy(),
            "90 stopinj Fahrenheita"
        );
        assert_eq!(
            e.normalize(&js("presežejo +30 °C.")).to_string_lossy(),
            "presežejo plus 30 stopinj Celzija."
        );
        assert_eq!(
            e.normalize(&js("poldnevnika 35° zahodne"))
                .to_string_lossy(),
            "poldnevnika 35 stopinj zahodne"
        );
        assert_eq!(
            e.normalize(&js("negativ 36 x 24 mm")).to_string_lossy(),
            "negativ 36 krat 24 milimetrov"
        );
        assert_eq!(
            e.normalize(&js("B&B-ji na")).to_string_lossy(),
            "be in be-ji na"
        );
        assert_eq!(
            e.normalize(&js("meri 29 3/4 palca")).to_string_lossy(),
            "meri 29 in tri četrtine palca"
        );
        assert_eq!(
            e.normalize(&js("krat 24 1/2 palca")).to_string_lossy(),
            "krat 24 in pol palca"
        );
        assert_eq!(
            e.normalize(&js("(1/5 palca)")).to_string_lossy(),
            "(ena petina palca)"
        );
        assert_eq!(
            e.normalize(&js("(2/3 palca)")).to_string_lossy(),
            "(dve tretjini palca)"
        );
        assert_eq!(
            e.normalize(&js("v 1830-ih.")).to_string_lossy(),
            "v tisoč osemsto tridesetih."
        );
        assert_eq!(
            e.normalize(&js("ob 5-ih (ET)")).to_string_lossy(),
            "ob petih (e te)"
        );
        assert_eq!(
            e.normalize(&js("BDP in DVD in GMT")).to_string_lossy(),
            "be de pe in de ve de in ge me te"
        );
        assert_eq!(
            e.normalize(&js("naprave DSLR so")).to_string_lossy(),
            "naprave de se le re so"
        );
        assert_eq!(
            e.normalize(&js("Predsednik ZDA je")).to_string_lossy(),
            "Predsednik ze de a je"
        );
        assert_eq!(
            e.normalize(&js("področju MRI je")).to_string_lossy(),
            "področju me re i je"
        );
        assert_eq!(
            e.normalize(&js("virus COVID in UNESCO in OPEC so"))
                .to_string_lossy(),
            "virus COVID in UNESCO in OPEC so"
        );
        assert_eq!(
            e.normalize(&js("V renesansi so")).to_string_lossy(),
            "V renesansi so"
        );
        assert_eq!(
            e.normalize(&js("George W. Bush je")).to_string_lossy(),
            "George dvojni ve Bush je"
        );
        assert_eq!(
            e.normalize(&js("inšpektorja D. K. Arya je"))
                .to_string_lossy(),
            "inšpektorja de ke Arya je"
        );
        assert_eq!(
            crate::phonemize("V XV. stoletju", "sl")
                .unwrap()
                .trim()
                .to_string(),
            "ʋ pɛtnˈajstɛm stɔlˈɛtju"
        );
        assert_eq!(
            crate::phonemize("med II. svetovno vojno", "sl")
                .unwrap()
                .trim()
                .to_string(),
            "mɛt drˈuɡɔ sʋɛtˈɔʋnɔ ʋˈɔjnɔ"
        );
        assert_eq!(
            crate::phonemize("ima 93 % prebivalstva", "sl")
                .unwrap()
                .trim()
                .to_string(),
            "imˈa triindɛʋˈɛddɛsɛt ɔtstˈɔtkɔʋ prɛbiʋˈalstʋa"
        );
        assert_eq!(
            crate::phonemize("ob 23.35", "sl")
                .unwrap()
                .trim()
                .to_string(),
            "ɔp triindʋajsˈɛti ˈuri pɛtintrˈidɛsɛt"
        );
        assert_eq!(
            crate::phonemize("do leta 1945.", "sl")
                .unwrap()
                .trim()
                .to_string(),
            "dɔ lˈɛta tˈisɔt͡ʃ dɛʋˈɛtstɔ pɛtinʃtˈiridɛsɛt ."
        );
        assert_eq!(
            e.normalize(&js("(0230 UTC)")).to_string_lossy(),
            "(druga ura trideset u te ce)"
        );
        assert_eq!(
            e.normalize(&js("ob 0230 UTC v sredo")).to_string_lossy(),
            "ob drugi uri trideset u te ce v sredo"
        );
        assert_eq!(
            e.normalize(&js("(1500 po UTC)")).to_string_lossy(),
            "(petnajsta ura po u te ce)"
        );
        assert_eq!(
            e.normalize(&js("leta 1230 je bilo")).to_string_lossy(),
            "leta 1230 je bilo"
        );
        assert_eq!(
            e.normalize(&js("leta 2010 in 1995")).to_string_lossy(),
            "leta 2010 in 1995"
        );
        assert_eq!(
            e.normalize(&js("ob 0230 v sredo")).to_string_lossy(),
            "ob 0230 v sredo"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("robot")).to_string_lossy(),
            "rɔbˈɔt"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("planet")).to_string_lossy(),
            "planˈɛt"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("Slovenija"))
                .to_string_lossy(),
            "slɔʋˈɛnija"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("raven")).to_string_lossy(),
            "rˈaʋɛn"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("država")).to_string_lossy(),
            "dərʒˈaʋa"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("in")).to_string_lossy(),
            "in"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("na")).to_string_lossy(),
            "na"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("prst")).to_string_lossy(),
            "pərst"
        );
        assert_eq!(
            crate::languages::slovenian::slovenian::phonemize_word(&js("vrt")).to_string_lossy(),
            "ʋərt"
        );
        assert!(
            crate::languages::slovenian::slovenian::stress_lexicon_has(&js("robot")),
            "stressLexiconHas(\"robot\")"
        );
        assert!(
            crate::languages::slovenian::slovenian::stress_lexicon_has(&js("Slovenija")),
            "stressLexiconHas(\"Slovenija\")"
        );
        assert!(
            !crate::languages::slovenian::slovenian::stress_lexicon_has(&js("brezoblačnostjo")),
            "stressLexiconHas(\"brezoblačnostjo\")"
        );
    }

    /// The #1532 findings, pinned from test/sh-baltic-port-findings.test.ts (synthetic, TS-evaluated).
    #[test]
    fn slovenian_port_findings_1532() {
        let e = create_slovenian().unwrap();
        let n = |s: &str| e.normalize(&js(s)).to_string_lossy();
        assert_eq!(n("Seznam: - 5 jabolk."), "Seznam: - 5 jabolk.");
        assert_eq!(
            n("Temperatura je -5 stopinj."),
            "Temperatura je minus 5 stopinj."
        );
        assert_eq!(n("(-5 stopinj)"), "(minus 5 stopinj)");
    }
}
