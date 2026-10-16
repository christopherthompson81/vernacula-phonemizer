//! Scottish Gaelic (gd) phonemizer: the broad/slender rule scan, pre-aspiration of a non-initial fortis stop, the
//! ⟨chd⟩ cluster, first-syllable stress and unstressed reduction, and text() over words, numbers and punctuation.
//! Ported from src/languages/scottishgaelic/scottishgaelic.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use super::normalize::normalize_scottish_gaelic;
use super::numbers::{GaelicNumbers, NumberToWords, make_number_to_words};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{Form, normalize};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/scottishgaelic";

/// `GaelicManifest`: declared in scottishgaelic.ts itself, as here. Every field is REQUIRED.
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct GaelicManifest {
    pub slender_vowels: String,
    pub broad_vowels: String,
    pub sonorants: Vec<String>,
    pub broad: IndexMap<String, String>,
    pub slender: IndexMap<String, String>,
    pub lenition: IndexMap<String, [String; 2]>,
    pub vowels: IndexMap<String, String>,
    pub numbers: GaelicNumbers,
    pub clause_punctuation: IndexMap<String, String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static GaelicManifest, String> {
    static M: OnceLock<GaelicManifest> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "scottishgaelic.jsonc").map_err(|e| e.to_string())
    })
}

/// ⚠ Reached only through a checked path (a `ScottishGaelicPhonemizer`, whose constructor loads it).
static M: LazyLock<&'static GaelicManifest> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

static SLENDER_V: LazyLock<JsString> = LazyLock::new(|| js(&M.slender_vowels));
static VOWELS: LazyLock<JsString> = LazyLock::new(|| SLENDER_V.concat(&js(&M.broad_vowels)));
/// `VOWEL_CLUSTERS`: longest first, a stable sort.
static VOWEL_CLUSTERS: LazyLock<Vec<JsString>> = LazyLock::new(|| {
    let mut keys: Vec<JsString> = M.vowels.keys().map(|k| js(k)).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.len()));
    keys
});
static SONORANT: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| M.sonorants.iter().map(|x| js(x)).collect());
static SHORT: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    ["a", "e", "ɛ", "i", "ɪ", "ɔ", "o", "u", "ʊ"]
        .iter()
        .map(|x| js(x))
        .collect()
});

fn is_vowel(c: &JsString) -> bool {
    !c.is_empty() && VOWELS.includes(c)
}

fn is_slender_v(c: &JsString) -> bool {
    !c.is_empty() && SLENDER_V.includes(c)
}

struct Seg {
    ph: JsString,
    nucleus: bool,
}

/// `w[i] ?? ""` (one code unit), a negative index reading as past the end.
fn unit(w: &JsString, i: isize) -> JsString {
    if i >= 0 && (i as usize) < w.len() {
        w.char_at(i as usize)
    } else {
        JsString::new()
    }
}

fn consonant_slender(w: &JsString, i: usize) -> bool {
    let c = unit(w, i as isize);
    if c == "r" && i == 0 {
        return false;
    }
    let (nx, pv) = (unit(w, i as isize + 1), unit(w, i as isize - 1));
    if is_vowel(&nx) {
        return is_slender_v(&nx);
    }
    if is_vowel(&pv) {
        return is_slender_v(&pv);
    }
    if c == "s" {
        return false;
    }
    for j in i + 1..w.len() {
        let wj = w.char_at(j);
        if is_vowel(&wj) {
            return is_slender_v(&wj);
        }
    }
    false
}

/// `scan(word)`: NFC, lowercase, then one CODE UNIT at a time.
fn scan(word: &JsString) -> Vec<Seg> {
    let w = normalize(word, Form::Nfc).to_lower_case();
    let n = w.len();
    let mut segs: Vec<Seg> = Vec::new();
    let cons = |segs: &mut Vec<Seg>, ph: &str| {
        if !ph.is_empty() {
            segs.push(Seg {
                ph: js(ph),
                nucleus: false,
            });
        }
    };
    let quality = |slender: bool| if slender { &M.slender } else { &M.broad };
    let mut i = 0;
    while i < n {
        let c = w.char_at(i);
        let two = w.slice(i as isize, Some(i as isize + 2));
        if (two == "dh" || two == "gh") && i + 2 == n && !segs.is_empty() {
            i += 2;
            continue;
        }
        if let Some(pair) = M.lenition.get(&two.to_string_lossy()) {
            cons(
                &mut segs,
                &pair[if consonant_slender(&w, i) { 1 } else { 0 }],
            );
            i += 2;
            continue;
        }
        if c == unit(&w, i as isize + 1) && !is_vowel(&c) {
            if let Some(ph) = quality(consonant_slender(&w, i)).get(&c.to_string_lossy()) {
                cons(&mut segs, ph);
            }
            i += 2;
            continue;
        }
        if is_vowel(&c) {
            let rest = w.slice(i as isize, None);
            if let Some(key) = VOWEL_CLUSTERS.iter().find(|k| rest.starts_with(k)) {
                segs.push(Seg {
                    ph: js(&M.vowels[&key.to_string_lossy()]),
                    nucleus: true,
                });
                i += key.len();
                continue;
            }
            segs.push(Seg {
                ph: c,
                nucleus: true,
            });
            i += 1;
            continue;
        }
        if let Some(ph) = quality(consonant_slender(&w, i)).get(&c.to_string_lossy()) {
            cons(&mut segs, ph);
        } else if js_re!("[a-z]").test(&c) {
            segs.push(Seg {
                ph: c,
                nucleus: false,
            });
        }
        i += 1;
    }
    segs
}

/// `PREASP` / `DEASP`.
fn preasp(ph: &JsString) -> Option<(&'static str, &'static str)> {
    [
        ("pʰ", "hp", "p"),
        ("t̪ʰ", "ht̪", "t̪"),
        ("tʲʰ", "htʲ", "tʲ"),
        ("kʰ", "xk", "k"),
        ("kʲʰ", "çkʲ", "kʲ"),
    ]
    .iter()
    .find(|(k, _, _)| *ph == *k)
    .map(|(_, p, d)| (*p, *d))
}

fn preaspirate(segs: &mut [Seg]) {
    for i in 1..segs.len() {
        let Some((pre, de)) = preasp(&segs[i].ph) else {
            continue;
        };
        let site = segs[i - 1].nucleus || SONORANT.contains(&segs[i - 1].ph);
        segs[i].ph = js(if site { pre } else { de });
    }
}

fn chd_cluster(segs: &mut [Seg]) {
    for i in 1..segs.len() {
        let prev = &segs[i - 1].ph;
        if (*prev == "x" || *prev == "ç") && (segs[i].ph == "t̪" || segs[i].ph == "tʲ") {
            segs[i].ph = js("k");
        }
    }
}

/// `phonemizeWord(word)`: one Scottish Gaelic word to canonical IPA.
pub fn phonemize_word(word: &JsString) -> JsString {
    let mut segs = scan(&js_re!(r"['’\-]", "gu").replace(word, &JsString::new()));
    if segs.is_empty() {
        return JsString::new();
    }
    preaspirate(&mut segs);
    chd_cluster(&mut segs);
    let nuclei: Vec<usize> = (0..segs.len()).filter(|&i| segs[i].nucleus).collect();
    if nuclei.is_empty() {
        let phs: Vec<JsString> = segs.iter().map(|s| s.ph.clone()).collect();
        return JsString::join(&phs, &JsString::new());
    }
    let stress = nuclei[0];
    for &idx in &nuclei {
        if idx != stress && SHORT.contains(&segs[idx].ph) {
            segs[idx].ph = js("ə");
        }
    }
    let mut out = JsString::new();
    for (i, s) in segs.iter().enumerate() {
        if i == stress {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&s.ph);
    }
    out
}

/// `SYMBOLS`'s argument, generated from the object literal in scottishgaelic.ts (key order preserved) by
/// recording it through the fn-diff symbols hook and printing `JSON.stringify` of it. No `countForm`.
const SYMBOL_DATA: &str = r#"{"percent":["sa cheud"],"currency":{"£":["not"],"$":["dolar"],"€":["Euro"]},"units":{"km":["cilemeatair"],"cm":["ceudameatair"],"mm":["milemeatair"],"kg":["cileagram"],"m":["meatair"],"g":["gram"]},"exponentWords":{"squared":["ceàrnagach"],"cubed":["ciùbach"],"position":"after"},"unitPer":"san","rateDenominators":{"h":"uair","u":"uair","s":"diog"},"ampersand":"agus","magnitudes":["muillean","billean"]}"#;

static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let data: SymbolData =
        crate::core::from_json::parse_json(SYMBOL_DATA).map_err(|e| e.to_string())?;
    make_symbol_normalizer(&data)
});

/// `numberToWords`: the renderer over this manifest's numeral table.
static NUMBER_TO_WORDS: LazyLock<NumberToWords> =
    LazyLock::new(|| make_number_to_words(&M.numbers));

/// `numberToWords(n, raw?)`.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    NUMBER_TO_WORDS.call(n, raw)
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let run = host_word_run(&["Latin"], "", "'’-").unwrap();
    JsRegex::new(&format!(r"({run})|(\d+)|([.!?…,;:])"), "gu").unwrap()
});

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: Scottish Gaelic's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[a-zàèìòùáéíóúA-ZÀÈÌÒÙÁÉÍÓÚ]", "u")));

/// The Scottish Gaelic engine (`createScottishGaelic`).
pub struct ScottishGaelicPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding one proves the manifest and the symbol tier loaded.
impl ScottishGaelicPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_scottish_gaelic(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self.symbols.apply(&normalize_scottish_gaelic(input));
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(n) = m.group(2, s) {
                for wd in number_to_words(js_number(&n), Some(&n)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = m.group(3, s)
                && let Some(mk) = M
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for ScottishGaelicPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(ScottishGaelicPhonemizer::text(self, input))
    }
}

/// `createScottishGaelic()`: loads the manifest and the symbol tier, or says which failed.
pub fn create_scottish_gaelic() -> Result<ScottishGaelicPhonemizer, String> {
    try_manifest()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(ScottishGaelicPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/scottishgaelic.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["mac"], Some("mˈaxk")),
        ("phonemizeWord", &["cat"], Some("kʰˈaht̪")),
        ("phonemizeWord", &["cù"], Some("kʰˈuː")),
        ("phonemizeWord", &["bochd"], Some("pˈɔxk")),
        ("phonemizeWord", &["annta"], Some("ˈan̪ˠt̪ə")),
        ("phonemizeWord", &["geal"], Some("kʲˈɛl̪ˠ")),
        ("phonemizeWord", &["balach"], Some("pˈal̪ˠəx")),
        ("phonemizeWord", &["sgoil"], Some("s̪kˈɔlʲ")),
        ("phonemizeWord", &["uisge"], Some("ˈuʃkʲə")),
        ("phonemizeWord", &["mòr"], Some("mˈɔːrˠ")),
        ("phonemizeWord", &["each"], Some("ˈɛx")),
        ("phonemizeWord", &["math"], Some("mˈah")),
        ("getPhonemizer(\"gd\").text", &["mac"], Some("mˈaxk")),
        ("numberToWords", &["0"], Some("neoni")),
        ("numberToWords", &["1"], Some("a h-aon")),
        ("numberToWords", &["2"], Some("a dhà")),
        ("numberToWords", &["8"], Some("a h-ochd")),
        ("numberToWords", &["11"], Some("a h-aon deug")),
        ("numberToWords", &["12"], Some("a dhà dheug")),
        ("numberToWords", &["13"], Some("a trì deug")),
        ("numberToWords", &["20"], Some("fichead")),
        ("numberToWords", &["21"], Some("fichead agus a h-aon")),
        ("numberToWords", &["25"], Some("fichead agus a còig")),
        ("numberToWords", &["40"], Some("ceathrad")),
        ("numberToWords", &["42"], Some("ceathrad agus a dhà")),
        ("numberToWords", &["99"], Some("naochad agus a naoi")),
        ("numberToWords", &["100"], Some("ceud")),
        ("numberToWords", &["101"], Some("ceud agus a h-aon")),
        ("numberToWords", &["200"], Some("dà cheud")),
        ("numberToWords", &["300"], Some("trì ceud")),
        ("numberToWords", &["900"], Some("naoi ceud")),
        ("numberToWords", &["1000"], Some("mìle")),
        ("numberToWords", &["2000"], Some("dà mhìle")),
        ("numberToWords", &["1009"], Some("mìle agus a naoi")),
        (
            "numberToWords",
            &["1998"],
            Some("mìle naoi ceud naochad agus a h-ochd"),
        ),
        ("numberToWords", &["1000000"], Some("muillean")),
        ("numberToWords", &["1000000000"], Some("billean")),
        ("phonemize", &["21", "gd"], Some("fˈiçət̪ ˈakəs̪ ˈa hˈɯːn̪ˠ")),
        ("phonemize", &["40", "gd"], Some("kʲʰˈɛhrˠət̪")),
        ("phonemize", &["2000", "gd"], Some("t̪ˈaː vˈiːlʲə")),
        (
            "normalizeScottishGaelic",
            &["6,000 duine"],
            Some("6000 duine"),
        ),
        (
            "normalizeScottishGaelic",
            &["9,984,670 km²"],
            Some("9984670 km²"),
        ),
        ("normalizeScottishGaelic", &["130,161"], Some("130161")),
        (
            "normalizeScottishGaelic",
            &["12.5 km"],
            Some("12 puing 5 km"),
        ),
        ("normalizeScottishGaelic", &["0.94%"], Some("0 puing 9 4%")),
        ("normalizeScottishGaelic", &["32.976.026"], Some("32976026")),
        (
            "phonemize",
            &["6,000 duine", "gd"],
            Some("ʃˈiə mˈiːlʲə t̪ˈuɲə"),
        ),
        (
            "normalizeScottishGaelic",
            &["19mh linn"],
            Some("naoidheamh linn deug"),
        ),
        (
            "normalizeScottishGaelic",
            &["an 18mh linn"],
            Some("an ochdamh linn deug"),
        ),
        (
            "normalizeScottishGaelic",
            &["an 12na linn"],
            Some("an dàrna linn deug"),
        ),
        (
            "normalizeScottishGaelic",
            &["an 11mh linn"],
            Some("an aonamh linn deug"),
        ),
        (
            "normalizeScottishGaelic",
            &["6mh linn"],
            Some("siathamh linn"),
        ),
        ("normalizeScottishGaelic", &["1d"], Some("chiad")),
        ("normalizeScottishGaelic", &["2na"], Some("dàrna")),
        ("normalizeScottishGaelic", &["3s"], Some("treas")),
        (
            "normalizeScottishGaelic",
            &["an 19mh"],
            Some("an naoidheamh deug"),
        ),
        (
            "normalizeScottishGaelic",
            &["14mh cheann-suidhe"],
            Some("ceathramh cheann-suidhe deug"),
        ),
        ("normalizeScottishGaelic", &["3 s"], Some("3 s")),
        ("normalizeScottishGaelic", &["1990s"], Some("1990")),
        (
            "normalizeScottishGaelic",
            &["BBC Naidheachdan 2016-12-31"],
            Some("BBC Naidheachdan 2016-12-31"),
        ),
        (
            "normalizeScottishGaelic",
            &["ISBN 3-89940-263-4"],
            Some("ISBN 3-89940-263-4"),
        ),
        ("normalizeScottishGaelic", &["6-0"], Some("6-0")),
        (
            "normalizeScottishGaelic",
            &["{ ..., -3, -2 }"],
            Some("{ ..., minus 3, minus 2 }"),
        ),
        (
            "normalizeScottishGaelic",
            &["1805 -1869"],
            Some("1805 -1869"),
        ),
        ("phonemize", &["70 %", "gd"], Some("ʃˈɛxkət̪ s̪ˈa çˈiaːt̪")),
        ("phonemize", &["£20", "gd"], Some("fˈiçət̪ n̪ˠˈɔht̪")),
        (
            "phonemize",
            &["100 kg", "gd"],
            Some("kʲʰˈiaːt̪ kʲʰˈilʲəkrˠəm"),
        ),
        ("normalizeScottishGaelic", &["176km"], Some("176km")),
        (
            "phonemize",
            &["5 km²", "gd"],
            Some("ˈa kʰˈɔːəkʲ kʲʰˈilʲəməht̪əɾʲ kʲʰˈeaːrˠn̪ˠəkəx"),
        ),
        (
            "phonemize",
            &["320 km/h", "gd"],
            Some("tʲʰɾʲˈiː kʲʰˈiaːt̪ fˈiçət̪ kʲʰˈilʲəməht̪əɾʲ s̪ˈan̪ˠ ˈuəəɾʲ"),
        ),
        (
            "phonemize",
            &["10 m/s", "gd"],
            Some("ˈa tʲˈeç mˈɛht̪əɾʲ s̪ˈan̪ˠ tʲˈik"),
        ),
        (
            "normalizeScottishGaelic",
            &["srl."],
            Some("agus mar sin air adhart."),
        ),
        ("normalizeScottishGaelic", &["no. 5"], Some("àireamh 5")),
        (
            "phonemize",
            &["Ross & Hendry", "gd"],
            Some("rˠˈɔs̪ ˈakəs̪ hˈeɲt̪rˠy"),
        ),
        ("normalizeScottishGaelic", &["20 °C"], Some("20 °C")),
        ("normalizeScottishGaelic", &["7 × 14"], Some("7 × 14")),
        (
            "normalizeScottishGaelic",
            &["== Hallstatt =="],
            Some("== Hallstatt =="),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_scottish_gaelic().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeScottishGaelic" => Some(e.normalize(&a(0))),
                "numberToWords" => Some(e.number_to_words(js_number(&a(0)), None)),
                "getPhonemizer(\"gd\").text" => {
                    Some(crate::registry::phonemize_in("gd", &a(0)).unwrap())
                }
                "phonemize" => Some(js(&crate::phonemize(
                    &a(0).to_string_lossy(),
                    &a(1).to_string_lossy(),
                )
                .unwrap())),
                _ => panic!("no replay for {f}"),
            }
        };
        for (f, args, want) in TS_SUITE_CALLS {
            let a = |i: usize| js(args[i]);
            let got: Option<String> = call(f, &a).map(|s| s.to_string_lossy());
            assert_eq!(got.as_deref(), *want, "{f}{args:?}");
        }
    }
}
