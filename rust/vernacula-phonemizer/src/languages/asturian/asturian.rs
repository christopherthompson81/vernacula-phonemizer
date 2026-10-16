//! Asturian (ast) phonemizer: a longest-first digraph + grapheme scan with the ⟨qu gu⟩, distinción ⟨c⟩, glide and
//! ⟨y⟩ context rules, nasal place assimilation before a labial, and text() over words, decimals and punctuation.
//! Ported from src/languages/asturian/asturian.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use super::normalize::normalize_asturian;
use super::numbers::{DIR, number_to_words, try_numbers};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{
    CountForms, ExponentPosition, ExponentWords, PositionDecl, SymbolData, SymbolNormalizer,
    make_symbol_normalizer,
};
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

#[derive(Debug, FromJson)]
pub struct TierExponents {
    pub squared: CountForms,
    pub cubed: CountForms,
    /// Optional in the TS interface (`position?:`).
    #[json(default)]
    pub position: Option<ExponentPosition>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub magnitudes: Vec<String>,
    pub ampersand: String,
    pub exponent_words: TierExponents,
}

/// `AsturianDef`: declared in asturian.ts itself, as here. Every field is REQUIRED.
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct AsturianDef {
    pub digraphs: IndexMap<String, String>,
    pub graphemes: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub vowel_letters: Vec<String>,
    pub front_letters: Vec<String>,
    pub decimal_word: String,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_def() -> Result<&'static AsturianDef, String> {
    static M: OnceLock<AsturianDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "asturian.jsonc").map_err(|e| e.to_string())
    })
}

/// ⚠ Reached only through a checked path (an `AsturianPhonemizer`, whose constructor loads it).
static DEF: LazyLock<&'static AsturianDef> =
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
        if c == "c" {
            out.push(js(if FRONT_LETTER.contains(&next) {
                "θ"
            } else {
                "k"
            }));
            i += 1;
            continue;
        }
        if c == "i" && VOWEL_LETTER.contains(&next) {
            out.push(js("j"));
            i += 1;
            continue;
        }
        if c == "u" && VOWEL_LETTER.contains(&next) {
            out.push(js("w"));
            i += 1;
            continue;
        }
        if c == "y" {
            out.push(js(if VOWEL_LETTER.contains(&next) {
                "ʝ"
            } else {
                "i"
            }));
            i += 1;
            continue;
        }
        if c == "r" && i == 0 {
            out.push(js("r"));
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
    let run = host_word_run(&["Latin"], "'\u{b7}", "").unwrap();
    JsRegex::new(
        &format!("({run})|(\\d+(?:,\\d+)?)|([.!?\u{2026},;:])"),
        "gu",
    )
    .unwrap()
});

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: Asturian's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[a-zñáéíóúüïḥḷA-ZÑÁÉÍÓÚÜÏḤḶ'·]", "u")));

/// The Asturian engine (`createAsturian`).
pub struct AsturianPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding one proves the manifest and the symbol tier loaded.
impl AsturianPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_asturian(text)
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
        let normalized = self.symbols.apply(&normalize_asturian(input));
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

impl Engine for AsturianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(AsturianPhonemizer::text(self, input))
    }
}

/// `createAsturian()`: loads the manifest, the numbers and the symbol tier, or says which failed.
pub fn create_asturian() -> Result<AsturianPhonemizer, String> {
    try_def()?;
    try_numbers()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(AsturianPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/asturian.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["xente"], Some("ʃente")),
        ("phonemizeWord", &["Asturies"], Some("astuɾjes")),
        ("phonemizeWord", &["cielu"], Some("θjelu")),
        ("phonemizeWord", &["zapatu"], Some("θapatu")),
        ("phonemizeWord", &["lleche"], Some("ʎet͡ʃe")),
        ("phonemizeWord", &["ñeru"], Some("ɲeɾu")),
        ("phonemizeWord", &["güeyu"], Some("ɡweʝu")),
        ("phonemizeWord", &["Olay"], Some("olai")),
        ("phonemizeWord", &["nueche"], Some("nwet͡ʃe")),
        ("phonemizeWord", &["home"], Some("ome")),
        ("phonemizeWord", &["bienvenida"], Some("bjembenida")),
        ("phonemizeWord", &["doctor"], Some("doktoɾ")),
        ("phonemizeWord", &["carru"], Some("karu")),
        ("phonemizeWord", &["falar"], Some("falaɾ")),
        ("phonemizeWord", &["abeḷḷugu"], Some("abet͡ʂuɡu")),
        (
            "createAsturian().text",
            &["Falo asturianu."],
            Some("falo astuɾjanu ."),
        ),
        ("numberToWords", &["7"], Some("siete")),
        ("numberToWords", &["16"], Some("dieciséis")),
        ("numberToWords", &["21"], Some("ventiún")),
        ("numberToWords", &["31"], Some("trenta y un")),
        (
            "numberToWords",
            &["555"],
            Some("quinientos cincuenta y cinco"),
        ),
        (
            "numberToWords",
            &["12345"],
            Some("doce mil trescientos cuarenta y cinco"),
        ),
        ("numberToWords", &["1000000"], Some("un millón")),
        ("numberToWords", &["1000000000"], Some("mil millones")),
        ("numberToWords", &["100"], Some("cien")),
        ("numberToWords", &["101"], Some("cientu un")),
        ("numberToWords", &["131"], Some("cientu trenta y un")),
        ("numberToWords", &["100000"], Some("cien mil")),
        ("createAsturian().text", &["21"], Some("bentjun")),
        ("createAsturian().text", &["101"], Some("θjentu un")),
        (
            "phonemize",
            &["23ºC", "ast"],
            Some("bentitɾes ɡɾaos θelsjus"),
        ),
        (
            "phonemize",
            &["23°C", "ast"],
            Some("bentitɾes ɡɾaos θelsjus"),
        ),
        (
            "phonemize",
            &["30º de media", "ast"],
            Some("tɾenta ɡɾaos de medja"),
        ),
        (
            "phonemize",
            &["30 graos de media", "ast"],
            Some("tɾenta ɡɾaos de medja"),
        ),
        (
            "phonemize",
            &["60º col planu", "ast"],
            Some("sesenta ɡɾaos kol planu"),
        ),
        (
            "phonemize",
            &["60 graos col planu", "ast"],
            Some("sesenta ɡɾaos kol planu"),
        ),
        (
            "normalizeAsturian",
            &["5° presidente"],
            Some("5° presidente"),
        ),
        ("normalizeAsturian", &["171.057"], Some("171057")),
        ("normalizeAsturian", &["1.012.292"], Some("1012292")),
        ("normalizeAsturian", &["132.46"], Some("132,46")),
        (
            "phonemize",
            &["0,54%", "ast"],
            Some("θeɾo koma θinko kwatɾo poɾ θjentu"),
        ),
        ("normalizeAsturian", &["25 000"], Some("25000")),
        (
            "phonemize",
            &["504.645 km²", "ast"],
            Some("kinjentos kwatɾo mil seisθjentos kwaɾenta i θinko kilometɾos kwadɾaos"),
        ),
        (
            "normalizeAsturian",
            &["24-X-1793"],
            Some("24 de ochobre de 1793"),
        ),
        (
            "normalizeAsturian",
            &["1-3-1700"],
            Some("1 de marzu de 1700"),
        ),
        (
            "normalizeAsturian",
            &["31-XII-1805"],
            Some("31 de avientu de 1805"),
        ),
        ("normalizeAsturian", &["3-14-1700"], Some("3-14-1700")),
        (
            "normalizeAsturian",
            &["1200 e.C."],
            Some("1200 enantes de Cristu."),
        ),
        (
            "normalizeAsturian",
            &["996 d. C."],
            Some("996 dempués de Cristu."),
        ),
        ("normalizeAsturian", &["23:40 h."], Some("23 40 h.")),
        ("normalizeAsturian", &["6000 - 3000"], Some("6000, 3000")),
        ("normalizeAsturian", &["1900-1910."], Some("1900, 1910.")),
        ("normalizeAsturian", &["C 0-1/0-1"], Some("C 0-1/0-1")),
        ("phonemize", &["70%", "ast"], Some("setenta poɾ θjentu")),
        (
            "phonemize",
            &["21.035 €", "ast"],
            Some("bentjun mil tɾenta i θinko euɾos"),
        ),
        ("phonemize", &["90 kg", "ast"], Some("nobenta kiloɡɾamos")),
        (
            "phonemize",
            &["44,9 °C", "ast"],
            Some("kwaɾenta i kwatɾo koma nwebe ɡɾaos θelsjus"),
        ),
        (
            "phonemize",
            &["88°23' S", "ast"],
            Some("ot͡ʃenta i ot͡ʃo ɡɾaos bentitɾes minutos s"),
        ),
        ("phonemize", &["ḷḷobu", "ast"], Some("t͡ʂobu")),
        ("phonemize", &["llobu", "ast"], Some("ʎobu")),
        ("phonemize", &["Ḷḷena", "ast"], Some("t͡ʂena")),
        ("phonemize", &["ḷḷendáu", "ast"], Some("t͡ʂendau")),
        ("phonemize", &["ḷḷindes", "ast"], Some("t͡ʂindes")),
        ("phonemize", &["Munieḷḷos", "ast"], Some("munjet͡ʂos")),
        ("phonemize", &["vaḷḷes", "ast"], Some("bat͡ʂes")),
        ("phonemize", &["Viḷḷapedre", "ast"], Some("bit͡ʂapedɾe")),
        ("phonemize", &["ḷobu", "ast"], Some("lobu")),
        ("phonemize", &["Łódź", "ast"], Some("lodθ")),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_asturian().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString, n: usize| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeAsturian" => Some(e.normalize(&a(0))),
                "numberToWords" => {
                    Some(e.number_to_words(js_number(&a(0)), (n > 1).then(|| a(1)).as_ref()))
                }
                "createAsturian().text" => Some(e.text(&a(0))),
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
