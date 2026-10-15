//! Faroese (fo) phonemizer: a greedy grapheme scan where the stressed vowel's LENGTH (open/closed syllable)
//! selects its QUALITY, the skerping remaps, the consonant passes (geminates, hv/hj, Cj, g/k affrication, the
//! ð/g glide, v-vocalisation, retroflex r-clusters, final -um) and the nasal pass; the symbol tier; and text()
//! over Latin words (a foreign name nativised), numbers with a decimal comma, and clause punctuation.
//! Ported from src/languages/faroese/faroese.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::normalize_faroese;
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/faroese";

/// `FaroeseDef` (faroese.jsonc). Every field the TS interface names is required; `language`, `name` and
/// `script` are documentation the TS does not read.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FaroeseDef {
    pub vowels: IndexMap<String, (String, String)>,
    pub consonants: IndexMap<String, String>,
    pub affricating_vowels: Vec<String>,
    pub front_glide_vowels: Vec<String>,
    pub round_glide_vowels: Vec<String>,
    pub skerping: IndexMap<String, String>,
    pub skerping_ggj: IndexMap<String, String>,
    pub prenasal: IndexMap<String, String>,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_def() -> Result<&'static FaroeseDef, String> {
    static M: OnceLock<FaroeseDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "faroese.jsonc").map_err(|e| e.to_string())
    })
}

/// ⚠ Reached only through a checked path (a `FaroesePhonemizer`, whose constructor loads it).
static DEF: LazyLock<&'static FaroeseDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

/// `VOWEL_KEYS`: the vowel graphemes stably sorted longest first (digraphs first).
static VOWEL_KEYS: LazyLock<Vec<JsString>> = LazyLock::new(|| {
    let mut keys: Vec<JsString> = DEF.vowels.keys().map(|k| js(k)).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.len()));
    keys
});

fn get<'a>(map: &'a IndexMap<String, String>, key: &JsString) -> Option<&'a String> {
    map.get(&key.to_string_lossy())
}

fn has(list: &[String], key: &JsString) -> bool {
    list.iter().any(|s| js(s) == *key)
}

#[derive(Clone, Debug)]
struct Seg {
    g: JsString,
    ph: JsString,
    vowel: bool,
    stressed: bool,
    long: bool,
}

/// `scan(word)`.
fn scan(word: &JsString) -> Vec<Seg> {
    let w = normalize(word, Form::Nfc).to_lower_case();
    let mut segs = Vec::new();
    let mut i = 0;
    'outer: while i < w.len() {
        for k in VOWEL_KEYS.iter() {
            if w.0[i..].starts_with(&k.0) {
                segs.push(Seg {
                    g: k.clone(),
                    ph: JsString::new(),
                    vowel: true,
                    stressed: false,
                    long: false,
                });
                i += k.len();
                continue 'outer;
            }
        }
        let c = JsString::from_units(&[w.0[i]]);
        let ph = get(&DEF.consonants, &c).map_or_else(JsString::new, |p| js(p));
        segs.push(Seg {
            g: c,
            ph,
            vowel: false,
            stressed: false,
            long: false,
        });
        i += 1;
    }
    segs
}

/// `phonemizeWord(word)`.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let d = &*DEF;
    let mut segs = scan(word);
    if let Some(first_v) = segs.iter().position(|s| s.vowel) {
        segs[first_v].stressed = true;
        let mut n_cons = 0;
        for s in &segs[first_v + 1..] {
            if s.vowel {
                break;
            }
            if s.g == js("ð") {
                continue;
            }
            n_cons += 1;
        }
        segs[first_v].long = n_cons <= 1;
    }
    for s in segs.iter_mut().filter(|s| s.vowel) {
        let pair = &d.vowels[&s.g.to_string_lossy()];
        s.ph = js(if s.stressed && s.long {
            &pair.0
        } else {
            &pair.1
        });
    }
    for k in 0..segs.len().saturating_sub(2) {
        if !segs[k].vowel {
            continue;
        }
        let (g1, g2) = (segs[k + 1].g.clone(), segs[k + 2].g.clone());
        let table = if g1 == js("g") && g2 == js("v") {
            Some(&d.skerping)
        } else if g1 == js("g") && g2 == js("g") {
            Some(&d.skerping_ggj)
        } else {
            None
        };
        if let Some(p) = table.and_then(|t| get(t, &segs[k].g)) {
            segs[k].ph = js(p);
        }
    }
    consonant_passes(&mut segs);
    nasal_pass(&mut segs);
    let mut out = JsString::new();
    for s in &segs {
        out.push_str(&s.ph);
    }
    out
}

/// `gdGlide(prev, next)`: [j] if either vowel neighbour is front, else [v] if either is round, else nothing.
fn gd_glide(prev: Option<&Seg>, next: Option<&Seg>) -> JsString {
    let d = &*DEF;
    let near: Vec<&Seg> = [prev, next]
        .into_iter()
        .flatten()
        .filter(|s| s.vowel)
        .collect();
    if near.iter().any(|s| has(&d.front_glide_vowels, &s.g)) {
        return js("j");
    }
    if near.iter().any(|s| has(&d.round_glide_vowels, &s.g)) {
        return js("v");
    }
    JsString::new()
}

const RETRO: [(&str, &str); 5] = [("n", "ɳ"), ("t", "ʈ"), ("d", "ɖ"), ("s", "ʂ"), ("l", "ɭ")];

/// `consonantPasses(segs)`: left to right; an earlier step may blank a later segment's `g`, which the later
/// step then sees (an empty `g` matches nothing but another empty `g`).
fn consonant_passes(segs: &mut [Seg]) {
    let d = &*DEF;
    let front = |s: &Seg| {
        if s.vowel {
            has(&d.affricating_vowels, &s.g)
        } else {
            s.g == js("j")
        }
    };
    let n = segs.len();
    for i in 0..n {
        if segs[i].vowel {
            continue;
        }
        let g = segs[i].g.clone();
        let gs = g.to_string_lossy();
        let has_next = i + 1 < n;
        if has_next && segs[i + 1].g == g {
            if gs == "l" {
                segs[i].ph = js("t");
                segs[i + 1].ph = js("l");
                continue;
            }
            if (gs == "g" || gs == "k") && i + 2 < n && front(&segs[i + 2]) {
                segs[i].ph = js("t͡ʃ");
                segs[i + 1].ph = JsString::new();
                segs[i + 1].g = JsString::new();
                if segs[i + 2].g == js("j") {
                    segs[i + 2].ph = JsString::new();
                    segs[i + 2].g = JsString::new();
                }
                continue;
            }
            if let Some(p) = get(&d.consonants, &g) {
                segs[i].ph = js(p);
            }
            segs[i + 1].ph = JsString::new();
            segs[i + 1].g = JsString::new();
            continue;
        }
        let next_g = has_next.then(|| segs[i + 1].g.clone());
        let next_is = |x: &str| next_g.as_ref().is_some_and(|g| *g == js(x));
        if gs == "h" && next_is("v") {
            segs[i].ph = js("k");
            continue;
        }
        if gs == "h" && next_is("j") {
            segs[i].ph = JsString::new();
            continue;
        }
        if next_is("j") && (gs == "t" || gs == "d" || gs == "s") {
            segs[i].ph = js(match gs.as_str() {
                "t" => "t͡ʃ",
                "d" => "d͡ʒ",
                _ => "ʃ",
            });
            segs[i + 1].ph = JsString::new();
            segs[i + 1].g = JsString::new();
            continue;
        }
        let prev_v = i > 0 && segs[i - 1].vowel;
        let next_v = has_next && segs[i + 1].vowel;
        if (gs == "g" || gs == "k")
            && !(gs == "g" && prev_v && next_v)
            && has_next
            && front(&segs[i + 1])
        {
            segs[i].ph = js("t͡ʃ");
            if next_is("j") {
                segs[i + 1].ph = JsString::new();
            }
            continue;
        }
        if gs == "ð" || (gs == "g" && prev_v && next_v) {
            let ph = if prev_v && next_v {
                gd_glide(i.checked_sub(1).map(|p| &segs[p]), segs.get(i + 1))
            } else {
                JsString::new()
            };
            segs[i].ph = ph;
            continue;
        }
        if gs == "v" && prev_v && has_next && !segs[i + 1].vowel {
            segs[i].ph = js("u");
            continue;
        }
        if gs == "r" && has_next {
            if let Some((_, r)) = RETRO.iter().find(|(k, _)| segs[i + 1].g == js(k)) {
                segs[i].ph = js("ɻ");
                segs[i + 1].ph = js(r);
                continue;
            }
            segs[i].ph = js("ɹ");
            continue;
        }
        if gs == "r" {
            segs[i].ph = js("ɹ");
            continue;
        }
        if gs == "m" && i == n - 1 && i > 0 && segs[i - 1].g == js("u") && !segs[i - 1].stressed {
            segs[i].ph = js("n");
        }
    }
}

/// `nasalPass(segs)`: ⟨n⟩ → [ŋ] before [k], [ɲ] before [t͡ʃ], and the pre-nasal vowel shift.
fn nasal_pass(segs: &mut [Seg]) {
    let d = &*DEF;
    for i in 0..segs.len().saturating_sub(1) {
        if segs[i].ph != js("n") {
            continue;
        }
        let nph = segs[i + 1].ph.clone();
        if nph == js("k") || nph == js("t͡ʃ") {
            segs[i].ph = js(if nph == js("t͡ʃ") { "ɲ" } else { "ŋ" });
            if i > 0
                && segs[i - 1].vowel
                && let Some(p) = get(&d.prenasal, &segs[i - 1].g)
            {
                segs[i - 1].ph = js(p);
            }
        }
    }
}

/// `SYMBOLS`'s argument, generated from the object literal in faroese.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it. No `countForm`: the default selector.
const SYMBOL_DATA: &str = r#"{"percent":["prosent"],"currency":{"kr":["króna","krónur"],"$":["dollari","dollarar"],"€":["evra","evrur"]},"units":{"km":["kilometur","kilometrar"],"m":["metur","metrar"],"cm":["sentimetur","sentimetrar"],"mm":["millimetur","millimetrar"],"kg":["kilogramm","kilogrommum"]},"exponentWords":{"squared":["fervent"],"cubed":["teningsmát"],"position":"after"},"ampersand":"og","magnitudes":["túsund","milliónir","miljardir"]}"#;

static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
    make_symbol_normalizer(&data)
});

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let run = host_word_run(&["Latin"], "'-", "").unwrap();
    JsRegex::new(
        &format!("({run})|(\\d+(?:,\\d+)?)|([.!?\u{2026},;:])"),
        "gu",
    )
    .unwrap()
});

const NATIVE_CLASS: &str = "[a-záíóúýæøðþA-ZÁÍÓÚÝÆØÐÞ'-]";

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "u")));

/// The Faroese engine (`createFaroese`).
pub struct FaroesePhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `FaroesePhonemizer` proves the manifest and the
/// symbol tier loaded. (The per-module differentials call them.)
impl FaroesePhonemizer {
    /// `normalizeFaroese(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_faroese(text)
    }

    /// `SYMBOLS(text)`.
    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    /// `numberToWords(n, raw)` (numbers.ts).
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let emit_words = |words: &JsString, sink: &mut crate::core::clauses::ClauseSink| {
            for wd in words.split(&js(" ")) {
                sink.emit(&phonemize_word(&wd));
            }
        };
        assemble_clauses(
            &self.symbols.apply(&normalize_faroese(input)),
            &TOKEN,
            |mm, s, sink| {
                if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                    sink.emit(&phonemize_word(&NAT(&w)));
                } else if let Some(num) = mm.group(2, s).filter(|n| !n.is_empty()) {
                    let pieces = num.split(&js(","));
                    let int_part = &pieces[0];
                    emit_words(&number_to_words(js_number(int_part), Some(int_part)), sink);
                    if let Some(frac) = pieces.get(1) {
                        sink.emit(&phonemize_word(&js("komma")));
                        for dg in frac.code_point_strings() {
                            emit_words(&number_to_words(js_number(&dg), None), sink);
                        }
                    }
                } else if let Some(p) = mm.group(3, s).filter(|p| !p.is_empty()) {
                    let keep = p == js(".") || p == js("!") || p == js("?");
                    sink.pause(&if keep { p } else { js(",") });
                }
            },
        )
    }
}

impl Engine for FaroesePhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(FaroesePhonemizer::text(self, input))
    }
}

/// `createFaroese()`. Errors when the manifest cannot be loaded or the symbol tier refuses its data.
pub fn create_faroese() -> Result<FaroesePhonemizer, String> {
    try_def()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(FaroesePhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/faroese.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["maður"], Some("mɛaːvʊɹ")),
        ("phonemizeWord", &["land"], Some("lant")),
        ("phonemizeWord", &["dagur"], Some("tɛaːvʊɹ")),
        ("phonemizeWord", &["bátur"], Some("pɔɑːtʊɹ")),
        ("phonemizeWord", &["vegur"], Some("veːvʊɹ")),
        ("phonemizeWord", &["Eyður"], Some("ɛiːjʊɹ")),
        ("phonemizeWord", &["kirkja"], Some("t͡ʃɪɹt͡ʃa")),
        ("phonemizeWord", &["gøta"], Some("køːta")),
        ("phonemizeWord", &["dúgva"], Some("tɪkva")),
        ("phonemizeWord", &["nýggjur"], Some("nʊt͡ʃʊɹ")),
        ("phonemizeWord", &["gangi"], Some("kɛɲt͡ʃɪ")),
        ("phonemizeWord", &["fólk"], Some("fœlk")),
        ("phonemizeWord", &["hús"], Some("hʉuːs")),
        ("getPhonemizer(\"fo\").text", &["land"], Some("lant")),
        ("numberToWords", &["0"], Some("null")),
        ("numberToWords", &["3"], Some("trý")),
        ("numberToWords", &["21"], Some("einogtjúgu")),
        ("numberToWords", &["55"], Some("fimmogfimmti")),
        ("numberToWords", &["99"], Some("níggjuogníti")),
        ("numberToWords", &["100"], Some("eitt hundrað")),
        (
            "numberToWords",
            &["555"],
            Some("fimm hundrað og fimmogfimmti"),
        ),
        ("numberToWords", &["1000"], Some("eitt túsund")),
        (
            "numberToWords",
            &["12345"],
            Some("tólv túsund og trý hundrað og fimmogfýrati"),
        ),
        ("numberToWords", &["1000000"], Some("ein millión")),
        ("numberToWords", &["1000000000"], Some("ein milliard")),
        ("getPhonemizer(\"fo\").text", &["21"], Some("aiːnɔkt͡ʃʏvʊ")),
        (
            "getPhonemizer(\"fo\").text",
            &["1000"],
            Some("ait tʉuːsʊnt"),
        ),
        ("normalizeFaroese", &["23.59.60"], Some("23 59 60")),
        ("normalizeFaroese", &["49.267"], Some("49267")),
        ("normalizeFaroese", &["11.738"], Some("11738")),
        ("normalizeFaroese", &["3.00 kr"], Some("3,00 kr")),
        ("normalizeFaroese", &["4.19$"], Some("4,19$")),
        ("normalizeFaroese", &["1. juli 2011"], Some("1 juli 2011")),
        (
            "normalizeFaroese",
            &["2. og 3. ættarlið"],
            Some("2 og 3 ættarlið"),
        ),
        (
            "normalizeFaroese",
            &["Tað var 1998. Síðan kom"],
            Some("Tað var 1998. Síðan kom"),
        ),
        (
            "phonemize",
            &["23. apríl", "fo"],
            Some("tɹʊiːɔkt͡ʃʏvʊ apɹʊil"),
        ),
        (
            "phonemize",
            &["23 apríl", "fo"],
            Some("tɹʊiːɔkt͡ʃʏvʊ apɹʊil"),
        ),
        ("phonemize", &["1. juli", "fo"], Some("ait juːlɪ")),
        (
            "normalizeFaroese",
            &["57°71° n.br."],
            Some("57 stig 71 stig norðurbreidd."),
        ),
        (
            "normalizeFaroese",
            &["4000 f.Kr."],
            Some("4000 fyri Kristus."),
        ),
        (
            "normalizeFaroese",
            &["kl. 3 e.m."],
            Some("klokkan 3 eftir middag."),
        ),
        (
            "normalizeFaroese",
            &["2,5 mió. kr."],
            Some("2,5 milliónir kr."),
        ),
        ("normalizeFaroese", &["9:59.91"], Some("9:59,91")),
        (
            "phonemize",
            &["56,7 °C", "fo"],
            Some("sɛksɔkfɪmtɪ kɔma ʃɛiː stiːk kɛlsɪʊs"),
        ),
        ("phonemize", &["79 %", "fo"], Some("nʊt͡ʃʊɔkʃɛitɪ pɹoːsɛnt")),
        ("normalizeFaroese", &["1269–1308"], Some("1269, 1308")),
        ("normalizeFaroese", &["s. 96-100."], Some("s. 96, 100.")),
        (
            "phonemize",
            &["9007199254740993", "fo"],
            Some(
                "nʊt͡ʃʊ nʊtl nʊtl ʃɛiː ait nʊt͡ʃʊ nʊt͡ʃʊ tvɛiː fɪm fʊiːɹa ʃɛiː fʊiːɹa nʊtl nʊt͡ʃʊ nʊt͡ʃʊ tɹʊiː",
            ),
        ),
        (
            "phonemize",
            &["1000000000000000000000", "fo"],
            Some(
                "ait nʊtl nʊtl nʊtl nʊtl nʊtl nʊtl nʊtl nʊtl nʊtl nʊtl nʊtl nʊtl nʊtl nʊtl nʊtl nʊtl nʊtl nʊtl nʊtl nʊtl nʊtl",
            ),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_faroese().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeFaroese" => Some(e.normalize(&a(0))),
                "numberToWords" => Some(e.number_to_words(js_number(&a(0)), None)),
                "getPhonemizer(\"fo\").text" => {
                    Some(crate::registry::phonemize_in("fo", &a(0)).unwrap())
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
