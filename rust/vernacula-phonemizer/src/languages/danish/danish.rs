//! Danish (da) phonemizer: the NST pronunciation lexicon first, then (best path only) the neural OOV tagger, then
//! a left-to-right rule g2p with Danish context rules and a first-syllable / unstressed-prefix stress model; and
//! text() over Latin words (a foreign name nativised), numbers and clause punctuation.
//! Ported from src/languages/danish/danish.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::manifest::{DIR, MANIFEST, try_manifest};
use super::normalize::{SYMBOLS, normalize_danish};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::make_nativiser;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};
use crate::core::normalize_symbols::SymbolNormalizer;
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;

/// `nat`: Danish's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser("[a-zæøåéöäü]", "iu")));

/// `nat(word)`.
pub fn nat(word: &JsString) -> JsString {
    NAT(word)
}

/// `lexicon()`: each key also filed under its nativised spelling (#1068).
pub fn try_lexicon() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static L: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&L, || {
        let fold = |k: &JsString| NAT(k);
        load_tsv_strings(
            DIR,
            "da-lexicon.tsv",
            TsvOptions {
                optional: true,
                fold: Some(&fold),
            },
        )
        .map_err(|e| e.to_string())
    })
}

/// ⚠ Reached only through a checked path (a `DanishPhonemizer`, whose constructor loads it).
pub fn lexicon() -> &'static IndexMap<JsString, JsString> {
    try_lexicon().unwrap_or_else(|e| panic!("{e}"))
}

/// `isV(ch)`: `ch !== "" && ch in V`.
fn is_v(ch: Option<u32>) -> bool {
    ch.and_then(char::from_u32).is_some_and(|c| {
        MANIFEST
            .vowels
            .contains_key(c.encode_utf8(&mut [0; 4]) as &str)
    })
}

fn table(map: &IndexMap<String, String>, c: u32) -> Option<&String> {
    let c = char::from_u32(c)?;
    map.get(c.encode_utf8(&mut [0; 4]) as &str)
}

struct Seg {
    ph: JsString,
    nuc: bool,
    reduced: bool,
    stress: bool,
}

/// `phonemizeWordRules(word)`: the rule engine (the OOV fallback).
pub fn phonemize_word_rules(word: &JsString) -> JsString {
    let lw = word.to_lower_case();
    let lu = lw.units();
    let af_prefix = js_re!(r"^af[bcdfghjklmnpqstvz]", "u").test(&lw) && lu.get(2) != Some(&0x72);
    let chars: Vec<u32> = lw.code_points().collect();
    let n = chars.len();
    let mut segs: Vec<Seg> = Vec::new();
    let c_ = |segs: &mut Vec<Seg>, ph: &str| {
        segs.push(Seg {
            ph: js(ph),
            nuc: false,
            reduced: false,
            stress: false,
        })
    };
    let v_ = |segs: &mut Vec<Seg>, ph: &str, reduced: bool| {
        segs.push(Seg {
            ph: js(ph),
            nuc: true,
            reduced,
            stress: false,
        })
    };
    let ch = |c: char| c as u32;
    let mut i = 0;
    while i < n {
        let c = chars[i];
        let prev = i.checked_sub(1).map(|k| chars[k]);
        let next = chars.get(i + 1).copied();
        let fin = i == n - 1;
        let has_nucleus = segs.iter().any(|s| s.nuc);

        if has_nucleus && c == ch('e') && next == Some(ch('r')) && i + 2 == n {
            v_(&mut segs, "ɐ", true);
            i += 2;
            continue;
        }
        if has_nucleus && c == ch('e') && next == Some(ch('t')) && i + 2 == n {
            v_(&mut segs, "ə", true);
            c_(&mut segs, "ð");
            i += 2;
            continue;
        }
        if has_nucleus
            && c == ch('e')
            && (next == Some(ch('n')) || next == Some(ch('l')))
            && i + 2 == n
        {
            v_(&mut segs, "ə", true);
            c_(
                &mut segs,
                table(&MANIFEST.consonants, next.unwrap()).unwrap(),
            );
            i += 3;
            continue;
        }

        if c == ch('f') && i == 1 && af_prefix {
            c_(&mut segs, "w");
            i += 1;
            continue;
        }
        if c == ch('n') && next == Some(ch('g')) {
            c_(&mut segs, "ŋ");
            i += 2;
            continue;
        }
        if c == ch('n') && next == Some(ch('k')) {
            c_(&mut segs, "ŋ");
            c_(&mut segs, "k");
            i += 2;
            continue;
        }
        if (c == ch('h') && (next == Some(ch('j')) || next == Some(ch('v'))))
            || (c == ch('t') && next == Some(ch('h')))
            || (c == ch('d') && (prev == Some(ch('n')) || prev == Some(ch('l'))))
            || (c == ch('g') && is_v(prev) && fin)
            || (!is_v(Some(c)) && next == Some(c))
        {
            i += 1;
            continue;
        }

        if is_v(Some(c)) {
            if c == ch('e') && fin {
                v_(&mut segs, "ə", true);
            } else {
                let nn = chars.get(i + 2).copied();
                if c == ch('i') && next == Some(ch('n')) && nn.is_some() && !is_v(nn) {
                    v_(&mut segs, "e", false);
                } else if c == ch('o') && next == Some(ch('l')) && nn == Some(ch('d')) {
                    v_(&mut segs, "ʌ", false);
                } else {
                    v_(&mut segs, table(&MANIFEST.vowels, c).unwrap(), false);
                }
            }
            i += 1;
            continue;
        }

        let cons = |c: u32| table(&MANIFEST.consonants, c).unwrap().as_str();
        if c == ch('d') {
            let ph = if is_v(prev) && (is_v(next) || next.is_none()) {
                "ð"
            } else {
                cons(c)
            };
            c_(&mut segs, ph);
        } else if c == ch('r') {
            c_(&mut segs, cons(c));
        } else if c == ch('t') {
            c_(&mut segs, if fin && is_v(prev) { "d" } else { cons(c) });
        } else if c == ch('c') {
            // `"eiyæø".includes(next)`: an absent next is "", which every string includes.
            let soft = next.is_none_or(|nx| "eiyæø".chars().any(|v| v as u32 == nx));
            c_(&mut segs, if soft { "s" } else { cons(c) });
        } else if let Some(cp) = table(&MANIFEST.consonants, c) {
            c_(&mut segs, cp);
        }
        i += 1;
    }

    let nuclei: Vec<usize> = (0..segs.len()).filter(|&k| segs[k].nuc).collect();
    if nuclei.len() >= 2 {
        let ord = if js_re!(r"^(be|for|ge|und|er)[^aeiouyæøå]*[aeiouyæøå]", "u").test(&lw) {
            1
        } else {
            0
        };
        let target = if !segs[nuclei[ord]].reduced {
            Some(nuclei[ord])
        } else {
            nuclei.iter().copied().find(|&k| !segs[k].reduced)
        };
        if let Some(k) = target {
            segs[k].stress = true;
        }
    }
    let mut out = JsString::new();
    for s in &segs {
        if s.stress {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&s.ph);
    }
    out
}

/// `OovResolver`: the raw word → IPA, or `None` to defer to the rule engine.
pub type OovResolver<'a> = &'a dyn Fn(&JsString) -> Option<JsString>;

/// `phonemizeWord(word, oovOverride)`: lexicon → override → rules.
pub fn phonemize_word(word: &JsString, oov: Option<OovResolver>) -> JsString {
    let w = word.to_lower_case();
    if let Some(v) = lexicon().get(&w) {
        return v.clone();
    }
    if let Some(r) = oov.and_then(|f| f(word)) {
        return r;
    }
    phonemize_word_rules(word)
}

const DA_LETTER: &str = r"(?!\p{Nd})[\p{Script=Latin}]";

/// `DA_WORD`.
pub fn da_word() -> String {
    format!("{DA_LETTER}(?:{DA_LETTER}|\\p{{M}}|(?<![A-ZÆØÅ]{{2}})['\u{2019}](?={DA_LETTER}))*")
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.!?…,;:])", da_word()), "gu").unwrap());

/// The Danish engine (`createDanish`).
pub struct DanishPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `DanishPhonemizer` proves the manifest, the lexicon
/// and the symbol tier loaded. (The per-module differentials call them.)
impl DanishPhonemizer {
    /// `normalizeDanish(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_danish(self.symbols, text)
    }

    /// `phonemizeWordRules(word)`.
    pub fn phonemize_word_rules(&self, word: &JsString) -> JsString {
        phonemize_word_rules(word)
    }

    /// `phonemizeWord(word)` (no override).
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word, None)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        nat(word)
    }

    /// `numberToWords(n, raw)`.
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    /// `lexicon().has(word)` (danish.ts).
    pub fn has_word(&self, word: &JsString) -> bool {
        lexicon().contains_key(word)
    }

    /// `text(input, oovOverride)`.
    pub fn text(&self, input: &JsString, oov: Option<OovResolver>) -> JsString {
        assemble_clauses(&self.normalize(input), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&nat(&w), oov));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                for wd in number_to_words(js_number(&d), Some(&d)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd, oov));
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

impl Engine for DanishPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(DanishPhonemizer::text(self, input, None))
    }

    fn neural(&self, pre_passed: &JsString) -> Option<Result<JsString, PhonemizeError>> {
        use super::{danish_neural::phonemize_da_neural, danish_tagger::danish_tagger};
        Some(phonemize_da_neural(self, danish_tagger(), pre_passed).map_err(PhonemizeError::Neural))
    }

    fn has_neural(&self) -> bool {
        true
    }
}

/// `createDanish()`. Errors when the manifest or the lexicon cannot be loaded, or the symbol tier refuses its data.
pub fn create_danish() -> Result<DanishPhonemizer, String> {
    try_manifest()?;
    try_lexicon()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(DanishPhonemizer { symbols })
}

#[cfg(all(test, feature = "da"))]
mod tests {
    use super::*;

    // Every call test/danish.test.ts and test/daNeural.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemize", &["gade", "da"], Some("ˈɡaːðə")),
        ("phonemize", &["mad", "da"], Some("ˈmað")),
        ("phonemize", &["absolut", "da"], Some("ɑbsoˈlud")),
        ("phonemize", &["København", "da"], Some("købənˈhɑwˀn")),
        ("phonemize", &["forstå", "da"], Some("fɒˈsdɔːˀ")),
        ("phonemize", &["hus", "da"], Some("ˈhuːˀs")),
        ("phonemize", &["kat", "da"], Some("ˈkad")),
        ("phonemize", &["dansk", "da"], Some("ˈdanˀsɡ")),
        ("phonemize", &["hjerte", "da"], Some("ˈjɛɐdə")),
        ("phonemizeWordRules", &["afbryde"], Some("ˈawbʁyðə")),
        ("phonemizeWordRules", &["adresse"], Some("ˈadʁesə")),
        ("phonemizeWordRules", &["hjul"], Some("jul")),
        ("phonemizeWordRules", &["lang"], Some("laŋ")),
        ("phonemizeWordRules", &["rolig"], Some("ʁˈoli")),
        ("numberToWords", &["0"], Some("nul")),
        ("numberToWords", &["7"], Some("syv")),
        ("numberToWords", &["21"], Some("enogtyve")),
        ("numberToWords", &["50"], Some("halvtreds")),
        ("numberToWords", &["60"], Some("tres")),
        ("numberToWords", &["70"], Some("halvfjerds")),
        ("numberToWords", &["75"], Some("femoghalvfjerds")),
        ("numberToWords", &["80"], Some("firs")),
        ("numberToWords", &["90"], Some("halvfems")),
        ("numberToWords", &["99"], Some("nioghalvfems")),
        ("numberToWords", &["40"], Some("fyrre")),
        ("numberToWords", &["100"], Some("et hundrede")),
        ("numberToWords", &["101"], Some("et hundrede og en")),
        (
            "numberToWords",
            &["555"],
            Some("fem hundrede og femoghalvtreds"),
        ),
        ("numberToWords", &["1000"], Some("et tusind")),
        (
            "numberToWords",
            &["12345"],
            Some("tolv tusind og tre hundrede og femogfyrre"),
        ),
        (
            "numberToWords",
            &["2538"],
            Some("to tusind og fem hundrede og otteogtredive"),
        ),
        ("numberToWords", &["1000000"], Some("en million")),
        ("numberToWords", &["1000000000"], Some("en milliard")),
        ("phonemize", &["21", "da"], Some("ˈeˀnɐwˌtyːvə")),
        ("phonemize", &["90", "da"], Some("halˈfɛmˀs")),
        ("phonemize", &["1000", "da"], Some("ˈɛd ˈtuːˀsen")),
        (
            "numberToWords",
            &["9007199254740992", "9007199254740993"],
            Some("ni nul nul syv en ni ni to fem fire syv fire nul ni ni tre"),
        ),
        (
            "numberToWords",
            &["9007199254740992", "9007199254740992"],
            Some("ni nul nul syv en ni ni to fem fire syv fire nul ni ni to"),
        ),
        (
            "numberToWords",
            &["12345678901234567000", "12345678901234567890"],
            Some("en to tre fire fem seks syv otte ni nul en to tre fire fem seks syv otte ni nul"),
        ),
        (
            "phonemize",
            &["9007199254740993", "da"],
            Some(
                "ˈniːˀ ˈnɔl ˈnɔl ˈsywˀ ˈeːˀn ˈniːˀ ˈniːˀ ˈtoːˀ ˈfɛmˀ ˈfiːɐ ˈsywˀ ˈfiːɐ ˈnɔl ˈniːˀ ˈniːˀ ˈtʁeːˀ",
            ),
        ),
        (
            "phonemize",
            &["9007199254740992", "da"],
            Some(
                "ˈniːˀ ˈnɔl ˈnɔl ˈsywˀ ˈeːˀn ˈniːˀ ˈniːˀ ˈtoːˀ ˈfɛmˀ ˈfiːɐ ˈsywˀ ˈfiːɐ ˈnɔl ˈniːˀ ˈniːˀ ˈtoːˀ",
            ),
        ),
        ("normalizeDanish", &["330.000"], Some("330000")),
        (
            "normalizeDanish",
            &["24.000 meteoritter"],
            Some("24000 meteoritter"),
        ),
        ("normalizeDanish", &["802.11n"], Some("802.11n")),
        ("normalizeDanish", &["12,5"], Some("12 komma 5")),
        ("normalizeDanish", &["kl. 14:30"], Some("klokken 14 30")),
        ("normalizeDanish", &["25 %"], Some("25 procent")),
        ("normalizeDanish", &["20 °C"], Some("20 grader celsius")),
        ("normalizeDanish", &["23 km²"], Some("23 kvadratkilometer")),
        ("normalizeDanish", &["35°V"], Some("35 grader V")),
        ("normalizeDanish", &["25°Cölner"], Some("25 grader Cölner")),
        (
            "phonemize",
            &["35°V", "da"],
            Some("fˈemoɡtʁeðivə ˈɡʁɑːðɐ ˈveːˀ"),
        ),
        ("normalizeDanish", &["20°"], Some("20 grader")),
        ("normalizeDanish", &["20 ° C"], Some("20 grader celsius")),
        ("normalizeDanish", &["20 °F"], Some("20 grader fahrenheit")),
        ("normalizeDanish", &["3. maj"], Some("tredje maj")),
        (
            "normalizeDanish",
            &["18. århundrede"],
            Some("attende århundrede"),
        ),
        (
            "normalizeDanish",
            &["I 1990. Han kom"],
            Some("I 1990. Han kom"),
        ),
        (
            "normalizeDanish",
            &["1. og 3. New Hampshire"],
            Some("første og tredje New Hampshire"),
        ),
        (
            "normalizeDanish",
            &["10.-11. århundrede"],
            Some("tiende til ellevte århundrede"),
        ),
        ("normalizeDanish", &["1000$"], Some("1000 dollar")),
        ("normalizeDanish", &["$22.500"], Some("22500 dollar")),
        ("normalizeDanish", &["11.000 US$"], Some("11000 US dollar")),
        ("normalizeDanish", &["¥2.500 og"], Some("2500 yen og")),
        ("normalizeDanish", &["1990-1995"], Some("1990 til 1995")),
        (
            "normalizeDanish",
            &["+30 °C"],
            Some("plus 30 grader celsius"),
        ),
        ("normalizeDanish", &["EX = uddød"], Some("EX lig med uddød")),
        ("normalizeDanish", &["A&B"], Some("A og B")),
        (
            "normalizeDanish",
            &["Dansk er et sprog."],
            Some("Dansk er et sprog."),
        ),
        (
            "phonemize",
            &["160 km/t", "da"],
            Some("ˈɛd ˈhunʁɐðə ˈɐw ˈtʁes kiloˈmeːˀdɐ ˈiːˀ ˈtiːmən"),
        ),
        (
            "phonemize",
            &["120 km/h", "da"],
            Some("ˈɛd ˈhunʁɐðə ˈɐw ˈtyːvə kiloˈmeːˀdɐ ˈiːˀ ˈtiːmən"),
        ),
        (
            "phonemize",
            &["133 m/s", "da"],
            Some("ˈɛd ˈhunʁɐðə ˈɐw tʁˈeoɡtʁeðivə ˈmeːˀdɐ ˈiːˀ seˈkɔnˀdəð"),
        ),
        ("phonemize", &["5 m", "da"], Some("ˈfɛmˀ ˈmeːˀdɐ")),
        ("phonemize", &["5 km", "da"], Some("ˈfɛmˀ kiloˈmeːˀdɐ")),
        ("phonemize", &["5 cm", "da"], Some("ˈfɛmˀ ˈsɛntiˌmeːˀdɐ")),
        (
            "phonemize",
            &["5 km²", "da"],
            Some("ˈfɛmˀ kvaˈdʁɑːˀdkiloˌmeːˀdɐ"),
        ),
        ("phonemize", &["Haiti's", "da"], Some("hˈaitis")),
        ("phonemize", &["O'Brien", "da"], Some("ˈobʁiən")),
        ("phonemize", &["Xi'an", "da"], Some("ksˈian")),
        ("phonemize", &["People's", "da"], Some("pˈeoples")),
        ("phonemize", &["FN's", "da"], Some("ˈɛfˌɛn ˈɛs")),
        ("phonemize", &["DNA'et", "da"], Some("deːɛˈnaːˀ ˈɛd")),
        ("phonemize", &["USA's", "da"], Some("uɛsˈaːˀ ˈɛs")),
        ("phonemize", &["REM'er", "da"], Some("ˈʁɛmˀ ˈɛɐ")),
        ("phonemize", &["sagde 'nej'", "da"], Some("ˈsaːə ˈnɑjˀ")),
        ("phonemize", &["Anders'", "da"], Some("ˈɑnɐs")),
        (
            "phonemizeDaNeural",
            &["Jeg bor i en gade i København."],
            Some("ˈjɑj ˈboɐˀ ˈiːˀ ˈeːˀn ˈɡaːðə ˈiːˀ købənˈhɑwˀn ."),
        ),
        (
            "phonemize",
            &["Jeg bor i en gade i København.", "da"],
            Some("ˈjɑj ˈboɐˀ ˈiːˀ ˈeːˀn ˈɡaːðə ˈiːˀ købənˈhɑwˀn ."),
        ),
        (
            "phonemizeDaNeural",
            &["Han har mad og øl."],
            Some("ˈhan ˈhɑːˀ ˈmað ˈɐw ˈøl ."),
        ),
        (
            "phonemize",
            &["Han har mad og øl.", "da"],
            Some("ˈhan ˈhɑːˀ ˈmað ˈɐw ˈøl ."),
        ),
        ("phonemizeDaNeural", &["gribletop"], Some("ˈɡʁibləˌtɐb")),
        ("phonemize", &["gribletop", "da"], Some("ɡʁˈibletop")),
        (
            "phonemizeDaNeural",
            &["Galápagosøer"],
            Some("ɡaˈlaːˀpaˌɡɐsˌøːˀɐ"),
        ),
        ("phonemize", &["Galápagosøer", "da"], Some("ɡˈalapaɡosøɐ")),
        ("phonemizeDaNeural", &["taínoer"], Some("ˈtɑjˌnoːˀɐ")),
        ("phonemize", &["taínoer", "da"], Some("tˈainoɐ")),
        ("phonemizeDaNeural", &["Guaraníerne"], Some("ɡuɑˈʁɑːˀnjɐnə")),
        ("phonemize", &["Guaraníerne", "da"], Some("ɡˈuaʁanieʁnə")),
        ("phonemizeDaNeural", &["Haldarsvík"], Some("ˈhaldɑːˌsviːɡ")),
        ("phonemize", &["Haldarsvík", "da"], Some("hˈalaʁsvik")),
        ("phonemizeDaNeural", &["Cañitas"], Some("kaˈnitas")),
        ("phonemize", &["Cañitas", "da"], Some("kˈanitas")),
        (
            "phonemizeDaNeural",
            &["Galapagosøer"],
            Some("ɡaˈlaːˀpaˌɡɐsˌøːˀɐ"),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_danish().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString, n: usize| -> Option<JsString> {
            match f {
                "phonemizeWordRules" => Some(e.phonemize_word_rules(&a(0))),
                "normalizeDanish" => Some(e.normalize(&a(0))),
                "numberToWords" => {
                    Some(e.number_to_words(js_number(&a(0)), (n > 1).then(|| a(1)).as_ref()))
                }
                "phonemizeDaNeural" => Some(
                    super::super::danish_neural::phonemize_da_neural(
                        &e,
                        super::super::danish_tagger::danish_tagger(),
                        &a(0),
                    )
                    .unwrap(),
                ),
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
