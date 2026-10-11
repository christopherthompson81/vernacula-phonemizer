//! Macedonian (mk) phonemizer, canonical IPA: a grapheme scan (dark-l in code, every other letter from the
//! table), syllabic ⟨р⟩, the South-Slavic consonant post-rules and fixed ANTEPENULT stress; text() over Cyrillic
//! words, numbers with their decimal comma or 3-digit grouping comma, and clause punctuation.
//! Ported from src/languages/macedonian/macedonian.ts — see that file for the corpus evidence.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::{
    is_unreadable_macedonian, normalize_macedonian, normalize_macedonian_initialisms,
};
use super::numbers::{mk_ordinal, number_to_text};
use crate::core::clauses::{ClauseSink, assemble_clauses};
use crate::core::data_source::load_once;
use crate::core::ipa::is_ipa_vowel;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/macedonian";

/// The local `NumbersDef` interface (macedonian.ts and numbers.ts).
#[derive(Debug, Deserialize)]
pub struct NumbersDef {
    pub units: Vec<String>,
    pub ten: String,
    pub teens: Vec<String>,
    pub tens: HashMap<String, String>,
    pub hundreds: HashMap<String, String>,
    pub thousand: String,
    pub thousands: String,
    pub million: String,
    pub millions: String,
    #[serde(rename = "and")]
    pub and_word: String,
}

/// `MacedonianDef` plus normalize.ts's `acronymLetters` (the three TS modules each load macedonian.jsonc with
/// the fields they read; this is their union, every field required).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MacedonianDef {
    pub letters: IndexMap<String, String>,
    pub front_letters: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: NumbersDef,
    pub acronym_letters: Vec<String>,
}

/// `DEF`, or why macedonian.jsonc could not be loaded. Cached once loaded; a failure is retried.
pub fn try_manifest() -> Result<&'static MacedonianDef, String> {
    static M: OnceLock<MacedonianDef> = OnceLock::new();
    load_once(&M, || {
        let m: MacedonianDef = load_manifest(DIR, "macedonian.jsonc").map_err(|e| e.to_string())?;
        let n = &m.numbers;
        let tens_ok = (2..10).all(|t| n.tens.contains_key(&(t * 10).to_string()));
        let hundreds_ok = (1..10).all(|h| n.hundreds.contains_key(&h.to_string()));
        if n.units.len() < 10 || n.teens.len() < 9 || !tens_ok || !hundreds_ok {
            return Err(
                "macedonian.jsonc numbers: a table numberToText indexes is short".to_string(),
            );
        }
        Ok(m)
    })
}

/// The manifest for code reached only through a checked path. ⚠ Crate-private: touching it unchecked panics.
pub(crate) static DEF: LazyLock<&'static MacedonianDef> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

/// `mkCountForm(n)`: singular when the last digit is 1 (not 11), else plural.
fn mk_count_form(n: f64) -> f64 {
    let m = n.abs() % 100.0;
    if m % 10.0 == 1.0 && m != 11.0 {
        0.0
    } else {
        1.0
    }
}

/// `SYMBOLS`'s argument, generated from the object literal in macedonian.ts (key order preserved) by recording
/// it through the `symbols` dump and printing `JSON.stringify` of it. `countForm` is `mkCountForm`.
const SYMBOL_DATA: &str = r#"{"multiply":{"times":"пати"},"percent":["процент","проценти"],"currency":{"$":["долар","долари"],"¥":["јен","јени"],"€":["евро","евра"],"£":["фунта","фунти"]},"magnitudes":["милијарди","милиони"],"units":{"км":["километар","километри"],"km":["километар","километри"],"м":["метар","метри"],"m":["метар","метри"],"см":["сантиметар","сантиметри"],"cm":["сантиметар","сантиметри"],"мм":["милиметар","милиметри"],"mm":["милиметар","милиметри"]},"exponentWords":{"squared":["квадратен","квадратни"],"cubed":["кубен","кубни"],"position":"before"},"unitPer":{"h":"на","ч":"на","s":"во","с":"во"},"rateDenominators":{"h":"час","ч":"час","s":"секунда","с":"секунда"}}"#;

struct Tables {
    letters: IndexMap<JsString, JsString>,
    front_l: HashSet<JsString>,
}

/// Every lookup key is one scanned code point, never an `Object.prototype` member's name.
static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*DEF;
    Tables {
        letters: m.letters.iter().map(|(k, v)| (js(k), js(v))).collect(),
        front_l: m.front_letters.iter().map(|k| js(k)).collect(),
    }
});

/// `DEVOICE`, in its literal's order.
const DEVOICE: [(&str, &str); 9] = [
    ("b", "p"),
    ("v", "f"),
    ("ɡ", "k"),
    ("d", "t"),
    ("ʒ", "ʃ"),
    ("z", "s"),
    ("d͡ʒ", "t͡ʃ"),
    ("d͡z", "t͡s"),
    ("ɟ", "c"),
];

fn devoice(b: &JsString) -> Option<JsString> {
    DEVOICE
        .iter()
        .find(|(k, _)| js(k) == *b)
        .map(|(_, v)| js(v))
}

fn voice(b: &JsString) -> Option<JsString> {
    DEVOICE
        .iter()
        .find(|(_, v)| js(v) == *b)
        .map(|(k, _)| js(k))
}

/// `VOICELESS`: `DEVOICE`'s values plus x.
fn voiceless(b: &JsString) -> bool {
    *b == js("x") || DEVOICE.iter().any(|(_, v)| js(v) == *b)
}

/// `isVowel(t)`: the WHOLE token is one IPA vowel character.
fn is_vowel(t: &JsString) -> bool {
    t.len() == 1 && is_ipa_vowel(t.0[0])
}

fn is_nucleus(t: &JsString) -> bool {
    is_vowel(t) || *t == js("r̩")
}

/// `scan(word)`: over the code points of the lowercased word.
fn scan(word: &JsString) -> Vec<JsString> {
    let t = &*T;
    let chars = word.to_lower_case().code_point_strings();
    let empty = JsString::new();
    let mut toks = Vec::new();
    for (i, c) in chars.iter().enumerate() {
        if *c == js("л") {
            let nxt = chars.get(i + 1).unwrap_or(&empty);
            toks.push(js(if t.front_l.contains(nxt) { "l" } else { "ɫ" }));
        } else if let Some(ph) = t.letters.get(c) {
            toks.push(ph.clone());
        }
    }
    toks
}

/// `syllabicR`: an r with no vowel-token neighbour becomes r̩ (left to right, but only vowels count).
fn syllabic_r(toks: &mut [JsString]) {
    for k in 0..toks.len() {
        if toks[k] != js("r") {
            continue;
        }
        let left = k > 0 && is_vowel(&toks[k - 1]);
        let right = k + 1 < toks.len() && is_vowel(&toks[k + 1]);
        if !left && !right {
            toks[k] = js("r̩");
        }
    }
}

/// `applyPhonotactics`: n→ŋ before k/ɡ, final devoicing, regressive voicing, sibilant assimilation.
fn apply_phonotactics(toks: &mut [JsString]) {
    let n = toks.len();
    for k in 0..n.saturating_sub(1) {
        if toks[k] == js("n") && (toks[k + 1] == js("k") || toks[k + 1] == js("ɡ")) {
            toks[k] = js("ŋ");
        }
    }
    if let Some(last) = toks.last_mut()
        && let Some(v) = devoice(last)
    {
        *last = v;
    }
    for k in (0..n.saturating_sub(1)).rev() {
        let (b, nb) = (toks[k].clone(), toks[k + 1].clone());
        if nb == js("v") {
            continue;
        }
        if let Some(v) = devoice(&b)
            && voiceless(&nb)
        {
            toks[k] = v;
        } else if let Some(v) = voice(&b)
            && devoice(&nb).is_some()
        {
            toks[k] = v;
        }
    }
    for k in 0..n.saturating_sub(1) {
        if (toks[k] == js("s") || toks[k] == js("z"))
            && (toks[k + 1] == js("ʃ") || toks[k + 1] == js("t͡ʃ"))
        {
            toks[k] = js("ʃ");
        }
    }
}

/// `withStress`: ˈ before the third-from-last nucleus (or the first, when fewer).
fn with_stress(toks: &[JsString]) -> JsString {
    let nuclei: Vec<usize> = (0..toks.len()).filter(|&i| is_nucleus(&toks[i])).collect();
    if nuclei.is_empty() {
        return JsString::join(toks, &JsString::new());
    }
    let stress_idx = nuclei[nuclei.len().saturating_sub(3)];
    let mut out = JsString::new();
    for (i, t) in toks.iter().enumerate() {
        if i == stress_idx {
            out.push_str(&js("ˈ"));
        }
        out.push_str(t);
    }
    out
}

/// `phonemizeWord(word)`. Not NFC-normalized.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let mut toks = scan(word);
    syllabic_r(&mut toks);
    apply_phonotactics(&mut toks);
    with_stress(&toks)
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        "([а-шА-ШѓѕјљњќџЃЅЈЉЊЌЏѐѝЀЍ]+)|(\\d+(?:,\\d+)?)|([.!?…,;:—])",
        "gu",
    )
    .unwrap()
});

/// Each word of `numberToText(n, raw)` through the g2p.
fn emit_number(sink: &mut ClauseSink, n: f64, raw: Option<&str>) {
    for wd in number_to_text(n, raw).split(' ') {
        sink.emit(&phonemize_word(&js(wd)));
    }
}

/// The Macedonian engine (`createMacedonian`).
pub struct MacedonianPhonemizer {
    symbols: SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `MacedonianPhonemizer` proves the manifest
/// loaded, so none of these can reach a load panic. (The per-module differentials call them.)
impl MacedonianPhonemizer {
    /// `normalizeMacedonian(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_macedonian(text)
    }

    /// `normalizeMacedonianInitialisms(text)`.
    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_macedonian_initialisms(text)
    }

    /// The shared symbol tier, as Macedonian builds it.
    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    /// `isUnreadableMacedonian(word)`.
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_macedonian(word)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `numberToText(n, raw)` (numbers.ts).
    pub fn number_to_text(&self, n: f64, raw: Option<&JsString>) -> JsString {
        js(&number_to_text(
            n,
            raw.map(|r| r.to_string_lossy()).as_deref(),
        ))
    }

    /// `mkOrdinal(n)` (numbers.ts).
    pub fn ordinal(&self, n: f64) -> Option<JsString> {
        mk_ordinal(n).map(|o| js(&o))
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized =
            self.symbols
                .apply(&normalize_macedonian_initialisms(&normalize_macedonian(
                    input,
                )));
        let m = &*DEF;
        assemble_clauses(&normalized, &TOKEN, |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(num) = mm.group(2, s).filter(|n| !n.is_empty()) {
                // `m[2].split(",")`: the token holds at most one comma.
                let parts = num.split(&js(","));
                let int_part = &parts[0];
                match parts.get(1) {
                    // A 3-digit block after the comma is grouping — unless the integer part is a lone `0`.
                    Some(frac) if frac.len() == 3 && *int_part != js("0") => {
                        let joined = int_part.concat(frac);
                        emit_number(sink, js_number(&joined), Some(&joined.to_string_lossy()));
                    }
                    frac => {
                        emit_number(sink, js_number(int_part), Some(&int_part.to_string_lossy()));
                        if let Some(frac) = frac {
                            sink.emit(&phonemize_word(&js("запирка")));
                            for d in frac.code_point_strings() {
                                emit_number(sink, js_number(&d), None);
                            }
                        }
                    }
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

impl Engine for MacedonianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(MacedonianPhonemizer::text(self, input))
    }
}

/// `createMacedonian()`. Errors when the manifest cannot be loaded, or the symbol tier refuses its data.
pub fn create_macedonian() -> Result<MacedonianPhonemizer, String> {
    try_manifest()?;
    let mut data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
    data.count_form = Some(Arc::new(mk_count_form));
    Ok(MacedonianPhonemizer {
        symbols: make_symbol_normalizer(&data)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // test/macedonian.test.ts's literal `phonemizeWord`, `normalizeMacedonian`, `getPhonemizer("mk").text` (`ph`) and `.text(…)` pins,
    // extracted from that file mechanically (each is a reading the TS suite asserts), so the two engines are held
    // to one list. `ENGINE_TEXT_PINS` go through `createMacedonian().text` (no registry pre-pass), the registry ones
    // through `phonemize(…, "mk")`; the bool says whether the TS trims the result.
    const WORD_PINS: &[(&str, &str)] = &[
        ("ѓавол", "ɟˈavɔɫ"),
        ("куќа", "kˈuca"),
        ("љубов", "ʎˈubɔf"),
        ("коњ", "kˈɔɲ"),
        ("ѕид", "d͡zˈit"),
        ("џамија", "d͡ʒˈamija"),
        ("волк", "vˈɔɫk"),
        ("леб", "lˈɛp"),
        ("прст", "pˈr̩st"),
        ("срце", "sˈr̩t͡sɛ"),
        ("град", "ɡrˈat"),
        ("Македонија", "makɛdˈɔnija"),
        ("планина", "pɫˈanina"),
        ("ноќ", "nˈɔc"),
    ];
    const NORM_PINS: &[(&str, &str)] = &[
        ("400.000 познати случаи", "400000 познати случаи"),
        ("5.000.000 уникатни", "5000000 уникатни"),
        ("40 000 луѓе", "40000 луѓе"),
        ("17-ти век", "седумнаесетти век"),
        ("18-тиот век", "осумнаесеттиот век"),
        ("18-от век", "осумнаесеттиот век"),
        ("7-миот", "седмиот"),
        ("21-ви", "дваесет и први"),
        ("37-ма земја", "триесет и седма земја"),
        ("1-та и 3-та дивизија", "првата и третата дивизија"),
        ("1.000-та марка", "илјадита марка"),
        ("116-те напреварувачи", "сто и шеснаесетте напреварувачи"),
        ("40-тина", "четириесетина"),
        ("190ти", "сто и деведесетти"),
        ("60-ти", "шеесетти"),
        (
            "1970-тите години",
            "илјада деветстотини и седумдесеттите години",
        ),
        ("1850-те години", "илјада осумстотини и педесеттите години"),
        (
            "1920- тите години",
            "илјада деветстотини и дваесеттите години",
        ),
        ("100-200 милји/час", "100 до 200 милји на час"),
        (
            "меѓу 10 и 11 век и 14 век",
            "меѓу десетти и единаесетти век и четиринаесетти век",
        ),
        ("на 6 октомври 1789", "на шести октомври 1789"),
        (
            "24 август - 5 септември 2021",
            "дваесет и четврти август до петти септември 2021",
        ),
        ("4. јули 1776", "четврти јули 1776"),
        ("356 г. п.н.е.", "356 година пред нашата ера"),
        ("400 г. н.е.", "400 година од нашата ера"),
        ("1978 г.", "1978 година"),
        ("25 г.", "25 години"),
    ];
    const ENGINE_TEXT_PINS: &[(&str, &str, bool)] = &[
        ("15", "pɛtnˈaɛsɛt", true),
        ("21", "dvˈaɛsɛt ˈi ˈɛdɛn", true),
        ("234", "dvˈɛstɛ trˈiɛsɛt ˈi t͡ʃˈɛtiri", true),
        ("2000", "dvˈɛ ˈiljadi", true),
        ("1000000", "mˈiliɔn", true),
        ("2000000", "dvˈa milˈiɔni", true),
    ];
    const REGISTRY_TEXT_PINS: &[(&str, &str, bool)] = &[
        (
            "Од 1,400 луѓе",
            "ˈɔt ˈiljada ˈi t͡ʃɛtiristˈɔtini ɫˈuɟɛ",
            true,
        ),
        ("6,5 степени", "ʃˈɛst zˈapirka pˈɛt stˈɛpɛni", true),
        ("12,8 km", "dvanˈaɛsɛt zˈapirka ˈɔsum kiɫˈɔmɛtri", true),
        ("2,243", "dvˈɛ ˈiljadi dvˈɛstɛ t͡ʃɛtirˈiɛsɛt ˈi trˈi", true),
        (
            "меѓу 06:30 и 07:30 часот",
            "mˈɛɟu ʃˈɛst ˈi trˈiɛsɛt ˈi sˈɛdum ˈi trˈiɛsɛt t͡ʃˈasɔt",
            true,
        ),
        ("во 10:00 часот", "vˈɔ dˈɛsɛt t͡ʃˈasɔt", true),
        (
            "до 23:35 ч.",
            "dˈɔ dvˈaɛsɛt ˈi trˈi ˈi trˈiɛsɛt ˈi pˈɛt t͡ʃˈasɔt",
            true,
        ),
        (
            "Помеѓу 22:00-23:00 часот",
            "pˈɔmɛɟu dvˈaɛsɛt ˈi dvˈa dˈɔ dvˈaɛsɛt ˈi trˈi t͡ʃˈasɔt",
            true,
        ),
        ("83 km/h", "ɔsˈumdɛsɛt ˈi trˈi kiɫˈɔmɛtri nˈa t͡ʃˈas", true),
        (
            "165 км/ч",
            "stˈɔ ʃˈɛɛsɛt ˈi pˈɛt kiɫˈɔmɛtri nˈa t͡ʃˈas",
            true,
        ),
        (
            "3.850 км²",
            "trˈi ˈiljadi ɔsumstˈɔtini ˈi pˈɛdɛsɛt kvˈadratni kiɫˈɔmɛtri",
            true,
        ),
        (
            "3136 мм2",
            "trˈi ˈiljadi stˈɔ trˈiɛsɛt ˈi ʃˈɛst kvˈadratni milˈimɛtri",
            true,
        ),
        (
            "4892 м",
            "t͡ʃˈɛtiri ˈiljadi ɔsumstˈɔtini dɛvˈɛdɛsɛt ˈi dvˈa mˈɛtri",
            true,
        ),
        ("88 %", "ɔsˈumdɛsɛt ˈi ˈɔsum prˈɔt͡sɛnti", true),
        ("600 Mbit/s", "ʃɛstˈɔtini mɛɡˈabiti nˈa sˈɛkunda", true),
        ("90°F", "dɛvˈɛdɛsɛt stˈɛpɛni pˈɔ fˈarɛnxajt", true),
        ("35° W", "trˈiɛsɛt ˈi pˈɛt stˈɛpɛni zˈapat", true),
        (
            "над +30 степени целзиусови",
            "nˈat pɫˈus trˈiɛsɛt stˈɛpɛni t͡sɛɫziˈusɔvi",
            true,
        ),
        ("Б&Б", "p ˈi p", true),
        ("ФБИ", "ˈɛf bˈɛ ˈi", true),
        ("ДНК", "dˈɛ ˈɛn kˈa", true),
        ("СССР", "ˈɛs ˈɛs ˈɛs ˈɛr", true),
        ("САД", "sˈat", true),
        ("ОН", "ˈɔ ˈɛn", true),
        ("GPS", "ɡˈɛ pˈɛ ˈɛs", true),
        ("Д-р Малар", "dˈɔktɔr mˈaɫar", true),
        ("Г-дин Рид", "ɡˈɔspɔdin rˈit", true),
        ("НАСА, Н. Вејн", "nˈasa , ˈɛn vˈɛjn", true),
        ("Џорџ В. Буш", "d͡ʒˈɔrt͡ʃ vˈɛ bˈuʃ", true),
        ("Лиалофи III", "liˈaɫɔfi trˈɛti", true),
        ("Кралица Елизабета II", "krˈalit͡sa ɛlizˈabɛta ftˈɔra", true),
        ("Луј XVI", "ɫˈuj ʃɛsnaˈɛsɛtti", true),
        ("во Формула 1.", "vˈɔ fˈɔrmuɫa ˈɛdɛn .", true),
        (
            "29¾ инчи на 24½ инчи",
            "dvˈaɛsɛt ˈi dˈɛvɛt ˈi trˈi t͡ʃɛtvˈr̩tini ˈint͡ʃi nˈa dvˈaɛsɛt ˈi t͡ʃˈɛtiri ˈi pɔɫˈɔvina ˈint͡ʃi",
            true,
        ),
        (
            "5 мм (1/5 инчи)",
            "pˈɛt milˈimɛtri ˈɛdna pˈɛttina ˈint͡ʃi",
            true,
        ),
        (
            "802.11n",
            "ɔsumstˈɔtini ˈi dvˈa tˈɔt͡ʃka ɛdinˈaɛsɛt ˈɛn",
            true,
        ),
        (
            "Добар ден, Македонија!",
            "dˈɔbar dˈɛn , makɛdˈɔnija !",
            true,
        ),
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        let e = create_macedonian().unwrap();
        let trim = |s: String, t: bool| if t { s.trim().to_string() } else { s };
        for (w, want) in WORD_PINS {
            assert_eq!(e.phonemize_word(&js(w)).to_string_lossy(), *want, "{w}");
        }
        for (t, want) in NORM_PINS {
            assert_eq!(e.normalize(&js(t)).to_string_lossy(), *want, "{t}");
        }
        for (t, want, trimmed) in ENGINE_TEXT_PINS {
            assert_eq!(
                trim(e.text(&js(t)).to_string_lossy(), *trimmed),
                *want,
                "{t}"
            );
        }
        for (t, want, trimmed) in REGISTRY_TEXT_PINS {
            assert_eq!(
                trim(crate::phonemize(t, "mk").unwrap(), *trimmed),
                *want,
                "{t}"
            );
        }
    }

    /// Cyrillic-in-host routing: mk has no `HOST_OVERRIDES` entry and its TOKEN omits the Russian-only letters,
    /// so `Ю` in `Юрий` is an unclaimed Cyrillic run read by the Russian reader (and `й`, inside the class but in
    /// no letter table, is dropped) — the TS reading `ju rˈi`, reported in the port log, reproduced here.
    #[test]
    fn an_unclaimed_cyrillic_run_goes_to_russian() {
        assert_eq!(crate::phonemize("Юрий", "mk").unwrap(), "ju rˈi");
        assert_eq!(
            crate::core::scripts::reader_for(&js("Ю"), "mk").map(|(t, _)| t),
            Some("ru")
        );
    }
}
