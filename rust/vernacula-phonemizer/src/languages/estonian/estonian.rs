//! Estonian (et) phonemizer: a greedy grapheme scan with gemination (a doubled consonant only after a vowel) and
//! fixed first-syllable stress, the cardinal compositor, the symbol tier, and text() over Latin words (a foreign
//! name nativised), numbers and clause punctuation.
//! Ported from src/languages/estonian/estonian.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::{
    NOMINATIVE, is_unreadable_estonian, normalize_estonian, normalize_estonian_initialisms, ordinal,
};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::numbers::digit_index;
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/estonian";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NumbersDef {
    pub units: Vec<String>,
    pub ten: String,
    pub teens: Vec<String>,
    pub tens_suffix: String,
    pub hundred: String,
    pub thousand: String,
    pub million: String,
    pub millions: String,
}

/// `EstonianDef` (estonian.jsonc). Every field the TS interface names is required; `language`, `name` and
/// `script` are documentation the TS does not read.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EstonianDef {
    pub graphemes: IndexMap<String, String>,
    pub vowel_letters: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: NumbersDef,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_def() -> Result<&'static EstonianDef, String> {
    static M: OnceLock<EstonianDef> = OnceLock::new();
    load_once(&M, || {
        let d: EstonianDef = load_manifest(DIR, "estonian.jsonc").map_err(|e| e.to_string())?;
        let n = &d.numbers;
        if n.units.len() < 10 || n.teens.len() < 9 {
            return Err("estonian.jsonc numbers: units needs 10 entries, teens 9".to_string());
        }
        Ok(d)
    })
}

/// ⚠ Reached only through a checked path (an `EstonianPhonemizer`, whose constructor loads it).
static DEF: LazyLock<&'static EstonianDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

/// `G[c]` for one code unit, and whether `c` is in `VOWEL_LETTERS`.
static G: LazyLock<IndexMap<u16, (JsString, bool)>> = LazyLock::new(|| {
    let vowels: Vec<JsString> = DEF.vowel_letters.iter().map(|v| js(v)).collect();
    DEF.graphemes
        .iter()
        .filter_map(|(k, v)| {
            let k = js(k);
            (k.len() == 1).then(|| (k.0[0], (js(v), vowels.contains(&k))))
        })
        .collect()
});

/// `phonemizeWord(word)`.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let w = word.to_lower_case();
    let u = &w.0;
    let mut segs: Vec<(JsString, bool)> = Vec::new();
    let mut i = 0;
    while i < u.len() {
        let c = u[i];
        let Some((ph, vowel)) = G.get(&c) else {
            i += 1;
            continue;
        };
        if u.get(i + 1) == Some(&c) && (*vowel || segs.last().is_some_and(|s| s.1)) {
            segs.push((ph.concat(&js("ː")), *vowel));
            i += 2;
            continue;
        }
        segs.push((ph.clone(), *vowel));
        i += 1;
    }
    let first = segs.iter().position(|s| s.1);
    let mut out = JsString::new();
    for (i, s) in segs.iter().enumerate() {
        if Some(i) == first {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&s.0);
    }
    out
}

/// `sub100(n)`, 0 ≤ n < 100.
fn sub100(n: i64) -> String {
    let d = &DEF.numbers;
    if n < 10 {
        return d.units[n as usize].clone();
    }
    if n == 10 {
        return d.ten.clone();
    }
    if n < 20 {
        return d.teens[(n - 11) as usize].clone();
    }
    let t = format!("{}{}", d.units[(n / 10) as usize], d.tens_suffix);
    let u = n % 10;
    if u != 0 {
        format!("{t} {}", d.units[u as usize])
    } else {
        t
    }
}

/// `sub1000(n)`, 0 ≤ n < 1000.
fn sub1000(n: i64) -> String {
    let d = &DEF.numbers;
    let (h, r) = (n / 100, n % 100);
    if h == 0 {
        return sub100(r);
    }
    let hw = format!(
        "{}{}",
        if h == 1 {
            ""
        } else {
            d.units[h as usize].as_str()
        },
        d.hundred
    );
    if r != 0 {
        format!("{hw} {}", sub100(r))
    } else {
        hw
    }
}

/// `numberToText(n)`, 0 ≤ n < 10⁹.
fn number_to_text(mut n: i64) -> String {
    let d = &DEF.numbers;
    if n == 0 {
        return d.units[0].clone();
    }
    let mut parts: Vec<String> = Vec::new();
    let mil = n / 1_000_000;
    n %= 1_000_000;
    if mil != 0 {
        parts.push(if mil == 1 {
            format!("{} {}", d.units[1], d.million)
        } else {
            format!("{} {}", sub1000(mil), d.millions)
        });
    }
    let th = n / 1000;
    n %= 1000;
    if th != 0 {
        parts.push(if th == 1 {
            d.thousand.clone()
        } else {
            format!("{} {}", sub1000(th), d.thousand)
        });
    }
    if n != 0 {
        parts.push(sub1000(n));
    }
    parts.join(" ")
}

/// `number(digits)`: a safe integer below 10⁹ as phonemized words; otherwise digit by digit (by code point).
fn number(digits: &JsString) -> JsString {
    let n = js_number(digits);
    let words: Vec<JsString> = if !is_safe_integer(n) || n >= 1e9 {
        digits
            .code_point_strings()
            .iter()
            .map(|d| {
                let i = if d.len() == 1 {
                    digit_index(d.0[0])
                } else {
                    -1
                };
                if i >= 0 {
                    phonemize_word(&js(&DEF.numbers.units[i as usize]))
                } else {
                    phonemize_word(d)
                }
            })
            .collect()
    } else {
        number_to_text(n as i64)
            .split(' ')
            .filter(|w| !w.is_empty())
            .map(|w| phonemize_word(&js(w)))
            .collect()
    };
    JsString::join(&words, &js(" "))
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.!?…,;:])", *LATIN_RUN), "giu").unwrap());

const NATIVE_CLASS: &str = "[a-zõäöüšžáéíóú]";

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "iu")));

/// `SYMBOLS`'s argument, generated from the object literal in estonian.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it. No `countForm`: the default selector.
const SYMBOL_DATA: &str = r#"{"percent":["protsent","protsenti"],"currency":{"$":["dollar","dollarit"],"€":["euro","eurot"],"£":["nael","naela"]},"units":{"km":["kilomeeter","kilomeetrit"],"cm":["sentimeeter","sentimeetrit"],"mm":["millimeeter","millimeetrit"],"kg":["kilogramm","kilogrammi"],"ha":["hektar","hektarit"],"m":["meeter","meetrit"]},"exponentWords":{"squared":["ruut"],"cubed":["kuup"],"position":"compound"},"magnitudes":["miljon","miljonit","miljard","miljardit","biljon","biljonit"],"ampersand":"ja"}"#;

static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
    make_symbol_normalizer(&data)
});

/// The Estonian engine (`createEstonian`).
pub struct EstonianPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding an `EstonianPhonemizer` proves the manifest and
/// the symbol tier loaded. (The per-module differentials call them.)
impl EstonianPhonemizer {
    /// `normalizeEstonian(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_estonian(text)
    }

    /// `normalizeEstonianInitialisms(text)`.
    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_estonian_initialisms(text)
    }

    /// `SYMBOLS(text)`.
    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    /// `isUnreadableEstonian(word)`.
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_estonian(word)
    }

    /// `ordinal(n, ending)` (normalize.ts); `None` for the ending is `NOMINATIVE`.
    pub fn ordinal(&self, n: f64, ending: Option<&str>) -> Option<JsString> {
        ordinal(n, ending.unwrap_or(NOMINATIVE)).map(|o| js(&o))
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `number(digits)`.
    pub fn number(&self, digits: &JsString) -> JsString {
        number(digits)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    pub fn text(&self, raw: &JsString) -> JsString {
        let input = self
            .symbols
            .apply(&normalize_estonian_initialisms(&normalize_estonian(raw)));
        assemble_clauses(&input, &TOKEN, |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(num) = mm.group(2, s).filter(|n| !n.is_empty()) {
                sink.emit(&number(&num));
            } else if let Some(p) = mm.group(3, s).filter(|p| !p.is_empty())
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

impl Engine for EstonianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(EstonianPhonemizer::text(self, input))
    }
}

/// `createEstonian()`. Errors when the manifest cannot be loaded or the symbol tier refuses its data.
pub fn create_estonian() -> Result<EstonianPhonemizer, String> {
    try_def()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(EstonianPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/estonian.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["õun"], Some("ˈɤun")),
        ("phonemizeWord", &["külm"], Some("kˈylm")),
        ("phonemizeWord", &["töö"], Some("tˈøː")),
        ("phonemizeWord", &["kõik"], Some("kˈɤik")),
        ("phonemizeWord", &["pea"], Some("pˈeɑ")),
        ("phonemizeWord", &["kass"], Some("kˈɑsː")),
        ("phonemizeWord", &["tikk"], Some("tˈikː")),
        ("phonemizeWord", &["raamat"], Some("rˈɑːmɑt")),
        ("phonemizeWord", &["keskkool"], Some("kˈeskkoːl")),
        ("phonemizeWord", &["Eesti"], Some("ˈeːsti")),
        ("phonemizeWord", &["linn"], Some("lˈinː")),
        ("phonemizeWord", &["õpetaja"], Some("ˈɤpetɑjɑ")),
        ("createEstonian().text", &["11"], Some("ˈyksteist")),
        ("createEstonian().text", &["21"], Some("kˈɑkskymːend ˈyks")),
        (
            "createEstonian().text",
            &["234"],
            Some("kˈɑkssɑdɑ kˈolmkymːend nˈeli"),
        ),
        ("createEstonian().text", &["2000"], Some("kˈɑks tˈuhɑt")),
        ("createEstonian().text", &["1000000"], Some("ˈyks mˈiljon")),
        ("phonemizeWord", &["taxi"], Some("tˈɑksi")),
        ("createEstonian().text", &["Aragón"], Some("ˈɑrɑɡon")),
        (
            "createEstonian().text",
            &["Tere, Eesti!"],
            Some("tˈere , ˈeːsti !"),
        ),
        ("ordinal", &["1", "\u{0}nom"], Some("esimene")),
        ("ordinal", &["2", "\u{0}nom"], Some("teine")),
        ("ordinal", &["3", "\u{0}nom"], Some("kolmas")),
        ("ordinal", &["9", "\u{0}nom"], Some("üheksas")),
        ("ordinal", &["10", "\u{0}nom"], Some("kümnes")),
        ("ordinal", &["11", "\u{0}nom"], Some("üheteistkümnes")),
        ("ordinal", &["19", "\u{0}nom"], Some("üheksateistkümnes")),
        ("ordinal", &["20", "\u{0}nom"], Some("kahekümnes")),
        ("ordinal", &["22", "\u{0}nom"], Some("kahekümne teine")),
        ("ordinal", &["22", "l"], Some("kahekümne teisel")),
        ("ordinal", &["100", "\u{0}nom"], Some("sajas")),
        ("ordinal", &["100", "l"], Some("sajandal")),
        (
            "ordinal",
            &["126", "\u{0}nom"],
            Some("saja kahekümne kuues"),
        ),
        ("ordinal", &["900", "\u{0}nom"], Some("üheksasajas")),
        ("ordinal", &["1000", "\u{0}nom"], Some("tuhandes")),
        ("ordinal", &["2000", "\u{0}nom"], Some("kahe tuhandes")),
        (
            "ordinal",
            &["2011", "l"],
            Some("kahe tuhande üheteistkümnendal"),
        ),
        (
            "ordinal",
            &["9999", ""],
            Some("üheksa tuhande üheksasaja üheksakümne üheksanda"),
        ),
        (
            "ordinal",
            &["1924", "l"],
            Some("tuhande üheksasaja kahekümne neljandal"),
        ),
        (
            "normalizeEstonian",
            &["1924. aastal"],
            Some("tuhande üheksasaja kahekümne neljandal aastal"),
        ),
        (
            "normalizeEstonian",
            &["19. sajandil"],
            Some("üheksateistkümnendal sajandil"),
        ),
        (
            "normalizeEstonian",
            &["1913. aasta"],
            Some("tuhande üheksasaja kolmeteistkümnenda aasta"),
        ),
        (
            "normalizeEstonian",
            &["2005. aastast"],
            Some("kahe tuhande viiendast aastast"),
        ),
        (
            "normalizeEstonian",
            &["2012. aastaks"],
            Some("kahe tuhande kaheteistkümnendaks aastaks"),
        ),
        (
            "normalizeEstonian",
            &["1766. aastat"],
            Some("tuhande seitsmesaja kuuekümne kuuendat aastat"),
        ),
        (
            "normalizeEstonian",
            &["19. sajandini"],
            Some("üheksateistkümnenda sajandini"),
        ),
        (
            "normalizeEstonian",
            &["1920. aastatel"],
            Some("tuhande üheksasaja kahekümnendatel aastatel"),
        ),
        (
            "normalizeEstonian",
            &["1980. aastail"],
            Some("tuhande üheksasaja kaheksakümnendail aastail"),
        ),
        (
            "normalizeEstonian",
            &["9. augustil"],
            Some("üheksandal augustil"),
        ),
        (
            "normalizeEstonian",
            &["24. oktoober"],
            Some("kahekümne neljas oktoober"),
        ),
        (
            "normalizeEstonian",
            &["1868. aastani"],
            Some("tuhande kaheksasaja kuuekümne kaheksanda aastani"),
        ),
        (
            "normalizeEstonian",
            &["kuni 9. oktoobrini 1933"],
            Some("kuni üheksanda oktoobrini 1933"),
        ),
        (
            "normalizeEstonian",
            &["3.–8. sajandini"],
            Some("kolmanda kaheksanda sajandini"),
        ),
        (
            "normalizeEstonian",
            &["15.–16. eluaastani"],
            Some("viieteistkümnenda kuueteistkümnenda eluaastani"),
        ),
        (
            "ordinal",
            &["1920", "tel"],
            Some("tuhande üheksasaja kahekümnendatel"),
        ),
        ("ordinal", &["1921", "tel"], None),
        ("ordinal", &["1922", "tel"], None),
        ("ordinal", &["2", "tel"], None),
        (
            "normalizeEstonian",
            &["1921. aastatel"],
            Some("1921. aastatel"),
        ),
        (
            "normalizeEstonian",
            &["aastal 1964. See nägi ette"],
            Some("aastal 1964. See nägi ette"),
        ),
        (
            "normalizeEstonian",
            &["Historical Method. New York 1946."],
            Some("Historical Method. New York 1946."),
        ),
        (
            "normalizeEstonian",
            &["9. augustil 1985. 12. detsembril 1985"],
            Some("üheksandal augustil 1985. kaheteistkümnendal detsembril 1985"),
        ),
        (
            "normalizeEstonian",
            &["1. ametlik"],
            Some("esimene ametlik"),
        ),
        ("normalizeEstonian", &["1. tundmatu"], Some("1. tundmatu")),
        (
            "normalizeEstonian",
            &["7. ja 6. sajandil"],
            Some("seitsmendal ja kuuendal sajandil"),
        ),
        (
            "normalizeEstonian",
            &["1920.–1940. aastatel"],
            Some("tuhande üheksasaja kahekümnendatel tuhande üheksasaja neljakümnendatel aastatel"),
        ),
        ("normalizeEstonian", &["84 000 km²"], Some("84000 km²")),
        (
            "normalizeEstonian",
            &["2 831 741 elanikku"],
            Some("2831741 elanikku"),
        ),
        (
            "normalizeEstonian",
            &["28 150 000 eurot"],
            Some("28150000 eurot"),
        ),
        ("normalizeEstonian", &["30 9"], Some("30 9")),
        (
            "normalizeEstonian",
            &["aastal 1985 200 inimest"],
            Some("aastal 1985 200 inimest"),
        ),
        ("normalizeEstonian", &["74,2%"], Some("74 koma 2%")),
        (
            "normalizeEstonian",
            &["120,758 miljardit"],
            Some("120 koma 7 5 8 miljardit"),
        ),
        (
            "normalizeEstonian",
            &["Diogenes Laertios 5.14"],
            Some("Diogenes Laertios 5.14"),
        ),
        ("normalizeEstonian", &["1,6 cm"], Some("1 koma 6 cm")),
        ("normalizeEstonian", &["1912–1913"], Some("1912 kuni 1913")),
        ("normalizeEstonian", &["70–110 cm"], Some("70 kuni 110 cm")),
        (
            "normalizeEstonian",
            &["3000...4000 m"],
            Some("3000 kuni 4000 m"),
        ),
        (
            "normalizeEstonian",
            &["3000–2000 eKr"],
            Some("3000–2000 enne Kristust"),
        ),
        (
            "normalizeEstonian",
            &["14,5-30 atm"],
            Some("14 koma 5-30 atm"),
        ),
        (
            "normalizeEstonian",
            &["1750/1500–500"],
            Some("1750/1500–500"),
        ),
        (
            "normalizeEstonian",
            &["lk 137–151."],
            Some("lk 137 kuni 151."),
        ),
        (
            "normalizeEstonian",
            &["1944–1980."],
            Some("1944 kuni 1980."),
        ),
        (
            "normalizeEstonian",
            &["50 000 – 100 000."],
            Some("50000 kuni 100000."),
        ),
        (
            "normalizeEstonian",
            &["II.16-17.98b32–34"],
            Some("II.16-17.98b32–34"),
        ),
        (
            "normalizeEstonian",
            &["5–13,7 °C"],
            Some("5–13 koma 7 kraadi"),
        ),
        ("normalizeEstonian", &["25 °C"], Some("25 kraadi")),
        (
            "normalizeEstonian",
            &["46° ja 49° põhjalaiuse"],
            Some("46 kraadi ja 49 kraadi põhjalaiuse"),
        ),
        (
            "normalizeEstonian",
            &["ligikaudu 109°."],
            Some("ligikaudu 109 kraadi."),
        ),
        (
            "normalizeEstonian",
            &["38°51' ja 41°16'"],
            Some("38°51' ja 41°16'"),
        ),
        (
            "normalizeEstonian",
            &["ulatub temperatuur +26 °C kraadini"],
            Some("ulatub temperatuur pluss 26 kraadini"),
        ),
        (
            "normalizeEstonian",
            &["Kraadini ulatub 26 °C"],
            Some("Kraadini ulatub 26"),
        ),
        (
            "normalizeEstonian",
            &["asub kaheksandal põhjalaiuskraadil, 26 °C"],
            Some("asub kaheksandal põhjalaiuskraadil, 26 kraadi"),
        ),
        (
            "normalizeEstonian",
            &["Temperatuur oli 30 °C. Sellest sai kraadi mõõdetud."],
            Some("Temperatuur oli 30 kraadi. Sellest sai kraadi mõõdetud."),
        ),
        (
            "normalizeEstonian",
            &["Kasutati püsse jms. Teise maailmasõja ajal oli teisiti."],
            Some("Kasutati püsse ja muu selline. Teise maailmasõja ajal oli teisiti."),
        ),
        (
            "normalizeEstonian",
            &["vaata ka jt."],
            Some("vaata ka ja teised."),
        ),
        ("normalizeEstonian", &["nt. kass"], Some("näiteks kass")),
        (
            "normalizeEstonian",
            &["alla −15 °C"],
            Some("alla miinus 15 kraadi"),
        ),
        (
            "normalizeEstonian",
            &["(-35$ aastas)"],
            Some("(miinus 35$ aastas)"),
        ),
        (
            "normalizeEstonian",
            &["maakood on +376"],
            Some("maakood on pluss 376"),
        ),
        ("normalizeEstonian", &["(315+35)"], Some("(315 pluss 35)")),
        (
            "normalizeEstonian",
            &["18–13,7 °C"],
            Some("18–13 koma 7 kraadi"),
        ),
        ("normalizeEstonian", &["322 eKr"], Some("322 enne Kristust")),
        (
            "normalizeEstonian",
            &["3.–4. sajandil pKr"],
            Some("kolmandal neljandal sajandil pärast Kristust"),
        ),
        (
            "normalizeEstonian",
            &["632 m.a.j."],
            Some("632 meie aja arvamise järgi"),
        ),
        ("normalizeEstonian", &["nr 665"], Some("number 665")),
        (
            "normalizeEstonian",
            &["sh hazara keel"],
            Some("sealhulgas hazara keel"),
        ),
        (
            "normalizeEstonian",
            &["u 1230 Werna"],
            Some("umbes 1230 Werna"),
        ),
        (
            "normalizeEstonian",
            &["n o r t u ũ w y"],
            Some("n o r t u ũ w y"),
        ),
        (
            "normalizeEstonian",
            &["1,5% SKP-st"],
            Some("1 koma 5% SKP-st"),
        ),
        (
            "normalizeEstonian",
            &["5000–6000-ni"],
            Some("5000–kuue tuhandeni"),
        ),
        ("normalizeEstonian", &["tõsta 4-le"], Some("tõsta neljale")),
        (
            "normalizeEstonian",
            &["tõste on $2-le"],
            Some("tõste on $2-le"),
        ),
        ("normalizeEstonian", &["63-aastaselt"], Some("63-aastaselt")),
        (
            "normalizeEstonian",
            &["2,6-trimetüül"],
            Some("2 koma 6-trimetüül"),
        ),
        ("isUnreadableEstonian", &["skp"], Some("true")),
        ("isUnreadableEstonian", &["tgv"], Some("true")),
        ("isUnreadableEstonian", &["wc"], Some("true")),
        ("isUnreadableEstonian", &["nato"], Some("false")),
        ("isUnreadableEstonian", &["unesco"], Some("false")),
        ("isUnreadableEstonian", &["icann"], Some("false")),
        ("isUnreadableEstonian", &["üro"], Some("false")),
        (
            "normalizeEstonianInitialisms",
            &["SKP kasvas"],
            Some("ess kaa pee kasvas"),
        ),
        (
            "normalizeEstonianInitialisms",
            &["NATO ja UNESCO"],
            Some("NATO ja UNESCO"),
        ),
        (
            "normalizeEstonianInitialisms",
            &["Šveitsi ja USA turg"],
            Some("Šveitsi ja uu ess aa turg"),
        ),
        (
            "normalizeEstonianInitialisms",
            &["1,5% SKP-st"],
            Some("1,5% ess kaa peest"),
        ),
        (
            "normalizeEstonianInitialisms",
            &["ja USA-sse"],
            Some("ja uu ess aasse"),
        ),
        (
            "normalizeEstonianInitialisms",
            &["SNCF-i liin"],
            Some("ess enn tsee effi liin"),
        ),
        (
            "normalizeEstonianInitialisms",
            &["TGV-rongile"],
            Some("tee gee vee-rongile"),
        ),
        (
            "normalizeEstonianInitialisms",
            &["SI-süsteemis"],
            Some("SI-süsteemis"),
        ),
        ("prePass", &["et", "XV sajand"], Some("15 sajand")),
        (
            "getPhonemizer(\"et\").text",
            &["15 sajand"],
            Some("vˈiːsteist sˈɑjɑnd"),
        ),
        (
            "prePass",
            &["et", "29 743&nbsp;km²"],
            Some("29 743\u{a0}km²"),
        ),
        (
            "getPhonemizer(\"et\").text",
            &["29 743\u{a0}km²"],
            Some("kˈɑkskymːend ˈyheksɑ tˈuhɑt sˈeitsesɑdɑ nˈelikymːend kˈolm rˈuːtkilomeːtrit"),
        ),
        ("prePass", &["et", "70%"], Some("70%")),
        (
            "getPhonemizer(\"et\").text",
            &["70%"],
            Some("sˈeitsekymːend prˈotsenti"),
        ),
        ("prePass", &["et", "1 km"], Some("1 km")),
        (
            "getPhonemizer(\"et\").text",
            &["1 km"],
            Some("ˈyks kˈilomeːter"),
        ),
        ("prePass", &["et", "5 km"], Some("5 km")),
        (
            "getPhonemizer(\"et\").text",
            &["5 km"],
            Some("vˈiːs kˈilomeːtrit"),
        ),
        (
            "prePass",
            &["et", "200 kuupmeetrit"],
            Some("200 kuupmeetrit"),
        ),
        (
            "getPhonemizer(\"et\").text",
            &["200 kuupmeetrit"],
            Some("kˈɑkssɑdɑ kˈuːpmeːtrit"),
        ),
        ("prePass", &["et", "13 m³"], Some("13 m³")),
        (
            "getPhonemizer(\"et\").text",
            &["13 m³"],
            Some("kˈolmteist kˈuːpmeːtrit"),
        ),
        ("prePass", &["et", "Smith & Wesson"], Some("Smith & Wesson")),
        (
            "getPhonemizer(\"et\").text",
            &["Smith & Wesson"],
            Some("smˈith jˈɑ vˈesːon"),
        ),
        ("prePass", &["et", "WC"], Some("WC")),
        (
            "getPhonemizer(\"et\").text",
            &["WC"],
            Some("kˈɑksisveː tsˈeː"),
        ),
        (
            "normalizeEstonian",
            &["Kell 11.20 palus politsei"],
            Some("Kell 11 20 palus politsei"),
        ),
        (
            "normalizeEstonian",
            &["Kella 11.29 paiku liikus"],
            Some("Kella 11 29 paiku liikus"),
        ),
        (
            "normalizeEstonian",
            &["kell 22:08 mõõdukas"],
            Some("kell 22 08 mõõdukas"),
        ),
        (
            "normalizeEstonian",
            &["kella 11.35-ks."],
            Some("kella 11 35-ks."),
        ),
        (
            "normalizeEstonian",
            &["võit, 21:20, mis lõpetas"],
            Some("võit, 21:20, mis lõpetas"),
        ),
        (
            "normalizeEstonian",
            &["Standard 802.11n toimib"],
            Some("Standard 802.11n toimib"),
        ),
        (
            "normalizeEstonian",
            &["6.30 ja 7.30 vahel"],
            Some("6.30 ja 7.30 vahel"),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_estonian().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeEstonian" => Some(e.normalize(&a(0))),
                "normalizeEstonianInitialisms" => Some(e.normalize_initialisms(&a(0))),
                "isUnreadableEstonian" => Some(js(&e.is_unreadable(&a(0)).to_string())),
                "ordinal" => e.ordinal(js_number(&a(0)), Some(&a(1).to_string_lossy())),
                "createEstonian().text" => Some(e.text(&a(0))),
                "getPhonemizer(\"et\").text" => {
                    Some(crate::registry::phonemize_in("et", &a(0)).unwrap())
                }
                "prePass" => Some(crate::registry::pre_pass(&a(0).to_string_lossy(), &a(1))),
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
