//! Occitan (oc) phonemizer, Languedocien: a longest-first digraph + grapheme scan with the ⟨qu gu⟩, ⟨c g⟩, ⟨u⟩
//! offglide and ⟨i⟩ glide rules, then intervocalic ⟨s⟩ voicing, the velar nasal, the dropped final n/r, final
//! ⟨a⟩ → [ɔ] and final devoicing; text() over words, decimals and punctuation.
//! Ported from src/languages/occitan/occitan.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::normalize_occitan;
use super::numbers::{DIR, number_to_words, try_numbers};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::ipa::is_ipa_vowel;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{
    CountForms, ExponentPosition, ExponentWords, PositionDecl, SymbolData, SymbolNormalizer,
    make_symbol_normalizer,
};
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

#[derive(Debug, Deserialize)]
pub struct TierExponents {
    pub squared: CountForms,
    pub cubed: CountForms,
    /// Optional in the TS interface (`position?:`).
    #[serde(default)]
    pub position: Option<ExponentPosition>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub magnitudes: Vec<String>,
    pub ampersand: String,
    pub exponent_words: TierExponents,
}

/// `OccitanDef`: declared in occitan.ts itself, as here. Every field is REQUIRED.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OccitanDef {
    pub digraphs: IndexMap<String, String>,
    pub graphemes: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub voiceless_phones: Vec<String>,
    pub vowel_letters: Vec<String>,
    pub front_letters: Vec<String>,
    pub decimal_word: String,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_def() -> Result<&'static OccitanDef, String> {
    static M: OnceLock<OccitanDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "occitan.jsonc").map_err(|e| e.to_string())
    })
}

/// ⚠ Reached only through a checked path (an `OccitanPhonemizer`, whose constructor loads it).
static DEF: LazyLock<&'static OccitanDef> =
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
static VOICELESS_PH: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| DEF.voiceless_phones.iter().map(|x| js(x)).collect());

struct Tok {
    ph: JsString,
    s_var: bool,
}

fn tok(ph: JsString) -> Tok {
    Tok { ph, s_var: false }
}

/// `w[i] ?? ""` (one code unit), a negative index reading as past the end.
fn unit(w: &JsString, i: isize) -> JsString {
    if i >= 0 && (i as usize) < w.len() {
        w.char_at(i as usize)
    } else {
        JsString::new()
    }
}

/// `scan(word)`: NFC, lowercase, then one CODE UNIT at a time.
fn scan(word: &JsString) -> Vec<Tok> {
    let w = normalize(word, Form::Nfc).to_lower_case();
    let mut toks: Vec<Tok> = Vec::new();
    let mut i = 0;
    'outer: while i < w.len() {
        let (c, next) = (w.char_at(i), unit(&w, i as isize + 1));
        let rest = w.slice(i as isize, None);
        for (key, ph) in ORDER.iter() {
            if rest.starts_with(key) {
                toks.push(tok(ph.clone()));
                i += key.len();
                continue 'outer;
            }
        }
        let after = unit(&w, i as isize + 2);
        if (c == "q" || c == "g") && next == "u" && VOWEL_LETTER.contains(&after) {
            let base = if c == "q" { "k" } else { "ɡ" };
            toks.push(tok(js(&if FRONT_LETTER.contains(&after) {
                base.to_string()
            } else {
                format!("{base}w")
            })));
            i += 2;
            continue;
        }
        let front = FRONT_LETTER.contains(&next);
        let fixed = if c == "c" {
            Some(if front { "s" } else { "k" })
        } else if c == "g" {
            Some(if front { "d͡ʒ" } else { "ɡ" })
        } else if c == "u" {
            Some(if VOWEL_LETTER.contains(&unit(&w, i as isize - 1)) {
                "w"
            } else {
                "y"
            })
        } else if c == "i" && next != "u" && VOWEL_LETTER.contains(&next) {
            Some("j")
        } else {
            None
        };
        if let Some(ph) = fixed {
            toks.push(tok(js(ph)));
            i += 1;
            continue;
        }
        if let Some(ph) = DEF
            .graphemes
            .get(&c.to_string_lossy())
            .filter(|p| !p.is_empty())
        {
            toks.push(Tok {
                ph: js(ph),
                s_var: c == "s",
            });
        }
        i += 1;
    }
    toks
}

/// `VOWEL_PH.has(cp)` for one code point's string.
fn is_vowel_cp(cp: Option<u32>) -> bool {
    cp.is_some_and(|c| c <= 0xFFFF && is_ipa_vowel(c as u16))
}

fn ends_with_vowel(ph: &JsString) -> bool {
    is_vowel_cp(ph.code_points().last())
}

fn voice_s(toks: &mut [Tok]) {
    for i in 1..toks.len() {
        if !toks[i].s_var || !ends_with_vowel(&toks[i - 1].ph) {
            continue;
        }
        if let Some(next) = toks.get(i + 1) {
            let head = next.ph.code_point_strings().into_iter().next();
            if !head.is_some_and(|h| VOICELESS_PH.contains(&h)) {
                toks[i].ph = js("z");
            }
        }
    }
}

fn final_devoice(toks: &mut [Tok]) {
    if let Some(last) = toks.last_mut() {
        let d = match last.ph.to_string_lossy().as_str() {
            "b" => Some("p"),
            "d" => Some("t"),
            "ɡ" => Some("k"),
            "z" => Some("s"),
            "v" => Some("f"),
            _ => None,
        };
        if let Some(d) = d {
            last.ph = js(d);
        }
    }
}

fn velar_nasal(toks: &mut [Tok]) {
    for i in 0..toks.len().saturating_sub(1) {
        if toks[i].ph == "n" && (toks[i + 1].ph == "k" || toks[i + 1].ph == "ɡ") {
            toks[i].ph = js("ŋ");
        }
    }
}

fn final_a(word: &JsString, toks: &mut [Tok]) {
    let w = normalize(word, Form::Nfc).to_lower_case();
    if let Some(last) = toks.last_mut()
        && last.ph == "a"
        && w.ends_with(&js("a"))
    {
        last.ph = js("ɔ");
    }
}

fn drop_final_nr(toks: &mut Vec<Tok>) {
    let n = toks.len();
    if n >= 2
        && (toks[n - 1].ph == "n" || toks[n - 1].ph == "ɾ")
        && ends_with_vowel(&toks[n - 2].ph)
    {
        toks.pop();
    }
}

/// `phonemizeWord(word)`.
pub fn phonemize_word(word: &JsString) -> JsString {
    let mut toks = scan(word);
    voice_s(&mut toks);
    velar_nasal(&mut toks);
    drop_final_nr(&mut toks);
    final_a(word, &mut toks);
    final_devoice(&mut toks);
    let phs: Vec<JsString> = toks.into_iter().map(|t| t.ph).collect();
    JsString::join(&phs, &JsString::new())
}

/// `SYMBOLS`: the tier over the manifest's `symbolTier`, the fields in the TS call's order.
static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let st = &DEF.symbol_tier;
    make_symbol_normalizer(&SymbolData {
        percent: Some(st.percent.clone()),
        currency: Some(st.currency.clone()),
        units: Some(st.units.clone()),
        exponent_words: Some(ExponentWords {
            squared: Some(st.exponent_words.squared.clone()),
            cubed: Some(st.exponent_words.cubed.clone()),
            position: st.exponent_words.position.map(PositionDecl::All),
        }),
        magnitudes: Some(st.magnitudes.clone()),
        ampersand: Some(st.ampersand.clone()),
        ..SymbolData::default()
    })
});

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let run = host_word_run(&["Latin"], "'\u{b7}-", "").unwrap();
    JsRegex::new(
        &format!("({run})|(\\d+(?:,\\d+)?)|([.!?\u{2026},;:])"),
        "gu",
    )
    .unwrap()
});

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: Occitan's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[a-zàèòáéíóúïüçA-ZÀÈÒÁÉÍÓÚÏÜÇ'·-]", "u")));

/// The Occitan engine (`createOccitan`).
pub struct OccitanPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding one proves the manifest and the symbol tier loaded.
impl OccitanPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_occitan(text)
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
        let normalized = self.symbols.apply(&normalize_occitan(input));
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
                    sink.emit(&phonemize_word(&js(&DEF.decimal_word)));
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

impl Engine for OccitanPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(OccitanPhonemizer::text(self, input))
    }
}

/// `createOccitan()`: loads the manifest, the numbers and the symbol tier, or says which failed.
pub fn create_occitan() -> Result<OccitanPhonemizer, String> {
    try_def()?;
    try_numbers()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(OccitanPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/occitan.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["França"], Some("fɾansɔ")),
        ("phonemizeWord", &["Barcelona"], Some("baɾselunɔ")),
        ("phonemizeWord", &["Bordèu"], Some("buɾdɛw")),
        ("phonemizeWord", &["Nòrd"], Some("nɔɾt")),
        ("phonemizeWord", &["filha"], Some("fiʎɔ")),
        ("phonemizeWord", &["montanha"], Some("muntaɲɔ")),
        ("phonemizeWord", &["Ardecha"], Some("aɾdet͡ʃɔ")),
        ("phonemizeWord", &["Occitània"], Some("uksitanjɔ")),
        ("phonemizeWord", &["Lisbona"], Some("lizbunɔ")),
        ("phonemizeWord", &["Japon"], Some("d͡ʒapu")),
        ("phonemizeWord", &["cantar"], Some("kanta")),
        ("phonemizeWord", &["abandonar"], Some("abanduna")),
        ("phonemizeWord", &["arriu"], Some("ariw")),
        ("phonemizeWord", &["afluent"], Some("aflyent")),
        ("phonemizeWord", &["aigua"], Some("aiɡwɔ")),
        (
            "createOccitan().text",
            &["Parli occitan."],
            Some("paɾli uksita ."),
        ),
        ("numberToWords", &["7"], Some("sèt")),
        ("numberToWords", &["16"], Some("setze")),
        ("numberToWords", &["21"], Some("vint e un")),
        ("numberToWords", &["31"], Some("trenta un")),
        ("numberToWords", &["90"], Some("nonanta")),
        ("numberToWords", &["555"], Some("cinc cents cinquanta cinc")),
        (
            "numberToWords",
            &["12345"],
            Some("dotze mila tres cents quaranta cinc"),
        ),
        ("numberToWords", &["1000000"], Some("un milion")),
        ("numberToWords", &["1000000000"], Some("un miliard")),
        ("createOccitan().text", &["21"], Some("bint e y")),
        ("createOccitan().text", &["100"], Some("sent")),
        ("createOccitan().text", &["1000"], Some("milɔ")),
        ("normalizeOccitan", &["19 042 936"], Some("19042936")),
        ("normalizeOccitan", &["1 275 207"], Some("1275207")),
        ("normalizeOccitan", &["1640.93"], Some("1640,93")),
        (
            "phonemize",
            &["13,1°C", "oc"],
            Some("tɾet͡se biɾɡylɔ y ɡɾaws selsiws"),
        ),
        ("normalizeOccitan", &["3500 abC"], Some("3500 abans Crist")),
        (
            "normalizeOccitan",
            &["484-425 avC"],
            Some("484, 425 abans Crist"),
        ),
        (
            "phonemize",
            &["3500 abC", "oc"],
            Some("tɾes milɔ siŋk sents abans kɾist"),
        ),
        ("normalizeOccitan", &["2 in-12°"], Some("2 in-12°")),
        ("normalizeOccitan", &["100°C"], Some("100 graus Celsius")),
        ("normalizeOccitan", &["250°"], Some("250 graus ")),
        ("normalizeOccitan", &["12:30 h"], Some("12 30 h")),
        (
            "normalizeOccitan",
            &["-20,4°C"],
            Some("mens 20,4 graus Celsius"),
        ),
        ("normalizeOccitan", &["1909-2006"], Some("1909, 2006")),
        ("normalizeOccitan", &["18-20)."], Some("18, 20).")),
        (
            "normalizeOccitan",
            &["Eucariòtas > Metazoaris"],
            Some("Eucariòtas > Metazoaris"),
        ),
        ("phonemize", &["50 %", "oc"], Some("sinkwantɔ pe sent")),
        ("phonemize", &["9 km", "oc"], Some("nɔw kilumɛtɾes")),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_occitan().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString, n: usize| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeOccitan" => Some(e.normalize(&a(0))),
                "numberToWords" => {
                    Some(e.number_to_words(js_number(&a(0)), (n > 1).then(|| a(1)).as_ref()))
                }
                "createOccitan().text" => Some(e.text(&a(0))),
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
