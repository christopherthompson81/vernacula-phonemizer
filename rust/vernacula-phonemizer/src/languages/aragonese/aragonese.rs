//! Aragonese (an) phonemizer: a longest-first digraph + grapheme scan with the ⟨qu gu⟩, distinción ⟨c⟩, jota ⟨g⟩,
//! glide and ⟨y⟩ context rules, the dropped final -r, nasal place assimilation before a labial, and text() over
//! words, decimals and punctuation. Ported from src/languages/aragonese/aragonese.ts — see that file for the corpus
//! evidence.

use std::collections::HashSet;
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::normalize_aragonese;
use super::numbers::{DIR, number_to_words, try_numbers};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::ipa::is_ipa_vowel;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

/// `AragoneseDef`: declared in aragonese.ts itself, as here. Every field is REQUIRED.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AragoneseDef {
    pub digraphs: IndexMap<String, String>,
    pub graphemes: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub vowel_letters: Vec<String>,
    pub front_letters: Vec<String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_def() -> Result<&'static AragoneseDef, String> {
    static M: OnceLock<AragoneseDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "aragonese.jsonc").map_err(|e| e.to_string())
    })
}

/// ⚠ Reached only through a checked path (an `AragonesePhonemizer`, whose constructor loads it).
static DEF: LazyLock<&'static AragoneseDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

/// `ORDER`: the digraph keys longest first (a stable sort).
static ORDER: LazyLock<Vec<(JsString, JsString)>> = LazyLock::new(|| {
    let mut keys: Vec<(JsString, JsString)> =
        DEF.digraphs.iter().map(|(k, v)| (js(k), js(v))).collect();
    keys.sort_by_key(|(k, _)| std::cmp::Reverse(k.len()));
    keys
});
static VOWEL_LETTER: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| DEF.vowel_letters.iter().map(|x| js(x)).collect());
static FRONT_LETTER: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| DEF.front_letters.iter().map(|x| js(x)).collect());

/// `w[i] ?? ""` (one code unit).
fn unit(w: &JsString, i: usize) -> JsString {
    if i < w.len() {
        w.char_at(i)
    } else {
        JsString::new()
    }
}

/// `IPA_VOWEL.has(seg)`: a set of single characters.
fn is_vowel(seg: &JsString) -> bool {
    seg.len() == 1 && is_ipa_vowel(seg.0[0])
}

/// `scan(word)`: NFC, lowercase, then one CODE UNIT at a time.
fn scan(word: &JsString) -> Vec<JsString> {
    let w = normalize(word, Form::Nfc).to_lower_case();
    let mut out: Vec<JsString> = Vec::new();
    let mut i = 0;
    'outer: while i < w.len() {
        let (c, next) = (w.char_at(i), unit(&w, i + 1));
        let rest = w.slice(i as isize, None);
        for (key, ph) in ORDER.iter() {
            if rest.starts_with(key) {
                out.push(ph.clone());
                i += key.len();
                continue 'outer;
            }
        }
        let after = unit(&w, i + 2);
        if (c == "q" || c == "g") && (next == "u" || next == "ü") && VOWEL_LETTER.contains(&after)
        {
            let base = if c == "q" { "k" } else { "ɡ" };
            let glide = next == "ü" || !FRONT_LETTER.contains(&after);
            out.push(js(&if glide {
                format!("{base}w")
            } else {
                base.to_string()
            }));
            i += 2;
            continue;
        }
        let front = FRONT_LETTER.contains(&next);
        let fixed = if c == "c" {
            Some(if front { "θ" } else { "k" })
        } else if c == "g" {
            Some(if front { "x" } else { "ɡ" })
        } else if c == "i" && VOWEL_LETTER.contains(&next) {
            Some("j")
        } else if c == "u" && VOWEL_LETTER.contains(&next) {
            Some("w")
        } else if c == "y" {
            Some(if VOWEL_LETTER.contains(&next) {
                "ʝ"
            } else {
                "i"
            })
        } else if c == "r" && i == 0 {
            Some("r")
        } else {
            None
        };
        if let Some(ph) = fixed {
            out.push(js(ph));
            i += 1;
            continue;
        }
        let ph = DEF
            .graphemes
            .get(&c.to_string_lossy())
            .map(|p| js(p))
            .or_else(|| {
                latin_phone(
                    &c,
                    PhoneOpts {
                        initial: i == 0,
                        include_h: false,
                    },
                )
            });
        if let Some(ph) = ph.filter(|p| !p.is_empty()) {
            out.push(ph);
        }
        i += 1;
    }
    let l = out.len();
    if l >= 2 && out[l - 1] == "ɾ" && is_vowel(&out[l - 2]) {
        out.pop();
    }
    out
}

fn labial_nasal(toks: &mut [JsString]) {
    for i in 0..toks.len().saturating_sub(1) {
        if toks[i] == "n" && (toks[i + 1] == "b" || toks[i + 1] == "p" || toks[i + 1] == "m") {
            toks[i] = js("m");
        }
    }
}

/// `phonemizeWord(word)`.
pub fn phonemize_word(word: &JsString) -> JsString {
    let mut toks = scan(word);
    labial_nasal(&mut toks);
    JsString::join(&toks, &JsString::new())
}

/// `SYMBOLS`'s argument, generated from the object literal in aragonese.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it. No `countForm`: the default selector.
const SYMBOL_DATA: &str = r#"{"percent":["por cient"],"currency":{"US$":["dólar estausunidense","dólars estausunidenses"],"€":["euro","euros"],"£":["libra","libras"],"$":["dólar","dólars"]},"units":{"km":["kilometro","kilometros"],"m":["metro","metros"],"cm":["centimetro","centimetros"],"mm":["milimetro","milimetros"],"kg":["kilogramo","kilogramos"],"g":["gramo","gramos"],"hab":["habitant","habitants"],"habitants":["habitant","habitants"]},"unitPer":"por","rateDenominators":{"h":"ora","s":"segundo"},"exponentWords":{"squared":["cuadrau","cuadraus"],"cubed":["cubico","cubicos"],"position":"after"},"ampersand":"y","magnitudes":["millón","millons","billón","billons"],"magnitudeConnective":"de"}"#;

static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
    make_symbol_normalizer(&data)
});

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let run = host_word_run(&["Latin"], "'·", "").unwrap();
    JsRegex::new(&format!(r"({run})|(\d+(?:,\d+)?)|([.!?…,;:])"), "gu").unwrap()
});

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: Aragonese's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[a-zñáéíóúüïA-ZÑÁÉÍÓÚÜÏ'·]", "u")));

/// The Aragonese engine (`createAragonese`).
pub struct AragonesePhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding one proves the manifest and the symbol tier loaded.
impl AragonesePhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_aragonese(text)
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
        let normalized = self.symbols.apply(&normalize_aragonese(input));
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(n) = m.group(2, s) {
                let parts = n.split(&js(","));
                let int_part = &parts[0];
                for wd in number_to_words(js_number(int_part), Some(int_part)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
                if let Some(frac) = parts.get(1) {
                    sink.emit(&phonemize_word(&js("coma")));
                    for dg in frac.code_point_strings() {
                        for wd in number_to_words(js_number(&dg), Some(&dg)).split(&js(" ")) {
                            sink.emit(&phonemize_word(&wd));
                        }
                    }
                }
            } else if let Some(p) = m.group(3, s)
                && let Some(mk) = DEF
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for AragonesePhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(AragonesePhonemizer::text(self, input))
    }
}

/// `createAragonese()`: loads the manifest, the numbers and the symbol tier, or says which failed.
pub fn create_aragonese() -> Result<AragonesePhonemizer, String> {
    try_def()?;
    try_numbers()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(AragonesePhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/aragonese.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["Chesús"], Some("t͡ʃesus")),
        ("phonemizeWord", &["Espanya"], Some("espaɲa")),
        ("phonemizeWord", &["baxo"], Some("baʃo")),
        ("phonemizeWord", &["chuego"], Some("t͡ʃweɡo")),
        ("phonemizeWord", &["abanza"], Some("abanθa")),
        ("phonemizeWord", &["cielo"], Some("θjelo")),
        ("phonemizeWord", &["tierra"], Some("tjera")),
        ("phonemizeWord", &["fillo"], Some("fiʎo")),
        ("phonemizeWord", &["Aragón"], Some("aɾaɡon")),
        ("phonemizeWord", &["cantar"], Some("kanta")),
        ("phonemizeWord", &["muller"], Some("muʎe")),
        ("getPhonemizer(\"an\").text", &["Chesús"], Some("t͡ʃesus")),
        ("numberToWords", &["7"], Some("siete")),
        ("numberToWords", &["16"], Some("decisiéis")),
        ("numberToWords", &["21"], Some("vintiun")),
        ("numberToWords", &["31"], Some("trenta y un")),
        (
            "numberToWords",
            &["555"],
            Some("cincocientos cinquanta y cinco"),
        ),
        (
            "numberToWords",
            &["12345"],
            Some("dotze mil trecientos quaranta y cinco"),
        ),
        ("numberToWords", &["1000000"], Some("un millón")),
        ("numberToWords", &["1000000000"], Some("mil millons")),
        ("getPhonemizer(\"an\").text", &["21"], Some("bintjun")),
        ("getPhonemizer(\"an\").text", &["100"], Some("θjent")),
        ("normalizeAragonese", &["30.689"], Some("30689")),
        ("normalizeAragonese", &["8.443.713"], Some("8443713")),
        ("normalizeAragonese", &["450 295"], Some("450295")),
        ("normalizeAragonese", &["1 000 000"], Some("1000000")),
        ("normalizeAragonese", &["10.92"], Some("10,92")),
        ("normalizeAragonese", &["21,9"], Some("21,9")),
        (
            "normalizeAragonese",
            &["bellas 25.000 personas."],
            Some("bellas 25000 personas."),
        ),
        (
            "normalizeAragonese",
            &["baixan d'os -10º."],
            Some("baixan d'os menos 10 graus ."),
        ),
        (
            "normalizeAragonese",
            &["de 3º y la de agosto de 21,9°"],
            Some("de 3 graus y la de agosto de 21,9 graus "),
        ),
        ("normalizeAragonese", &["28°C"], Some("28 graus Celsius")),
        (
            "normalizeAragonese",
            &["11°U y 12°E"],
            Some("11 graus ueste y 12 graus este"),
        ),
        (
            "normalizeAragonese",
            &["o 57° país mas gran"],
            Some("o 57° país mas gran"),
        ),
        (
            "normalizeAragonese",
            &["A las 17:07 se produce"],
            Some("A las 17 07 se produce"),
        ),
        (
            "normalizeAragonese",
            &["a las 04:35 UTC"],
            Some("a las 04 35 UTC"),
        ),
        (
            "normalizeAragonese",
            &["3.000 metros obstaclos - 8:09.09 min"],
            Some("3000 metros obstaclos - 8:09,09 min"),
        ),
        (
            "normalizeAragonese",
            &["un tiempo de 3:34.91"],
            Some("un tiempo de 3:34,91"),
        ),
        (
            "normalizeAragonese",
            &["eixemplo 41:20:00"],
            Some("eixemplo 41:20:00"),
        ),
        (
            "normalizeAragonese",
            &["de -37,8 °C"],
            Some("de menos 37,8 graus Celsius"),
        ),
        (
            "normalizeAragonese",
            &["1.500 metros lisos - 3:40.96 min"],
            Some("1500 metros lisos - 3:40,96 min"),
        ),
        (
            "normalizeAragonese",
            &["dende arredol d'o 12.500 a. C."],
            Some("dende arredol d'o 12500 antes de Cristo."),
        ),
        (
            "normalizeAragonese",
            &["(490 a. C.?)"],
            Some("(490 antes de Cristo?)"),
        ),
        ("normalizeAragonese", &["nº 132"], Some("numero 132")),
        ("normalizeAragonese", &["lum. 160"], Some("lumero 160")),
        ("normalizeAragonese", &["413 hab./km²"], Some("413 hab/km²")),
        (
            "normalizeAragonese",
            &["fa ±415 - ±360 m.a."],
            Some("fa ±415 - ±360 millons d'anyadas"),
        ),
        ("normalizeAragonese", &["1961-1990"], Some("1961, 1990")),
        ("normalizeAragonese", &["pp. 28–37"], Some("pp. 28, 37")),
        ("normalizeAragonese", &["Lei 10/2009"], Some("Lei 10/2009")),
        ("normalizeAragonese", &["30/10/1977"], Some("30/10/1977")),
        (
            "phonemize",
            &["45.000 km²", "an"],
            Some("kwaɾanta i θinko mil kilometɾos kwadɾaus"),
        ),
        (
            "phonemize",
            &["43,5 hab/km²", "an"],
            Some("kwaɾanta i tɾes koma θinko abitants po kilometɾo kwadɾau"),
        ),
        (
            "phonemize",
            &["un 60% d'os ingresos", "an"],
            Some("un siʃanta po θjent dos inɡɾesos"),
        ),
        (
            "phonemize",
            &["$359,9 billons", "an"],
            Some("tɾeθjentos θinkwanta i nweu koma nweu biʎons de dolaɾs"),
        ),
        (
            "phonemize",
            &["92.000€", "an"],
            Some("nobanta i dos mil euɾos"),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_aragonese().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString, n: usize| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeAragonese" => Some(e.normalize(&a(0))),
                "numberToWords" => {
                    Some(e.number_to_words(js_number(&a(0)), (n > 1).then(|| a(1)).as_ref()))
                }
                "getPhonemizer(\"an\").text" => {
                    Some(crate::registry::phonemize_in("an", &a(0)).unwrap())
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
            let got: Option<String> = call(f, &a, args.len()).map(|s| s.to_string_lossy());
            assert_eq!(got.as_deref(), *want, "{f}{args:?}");
        }
    }
}
