//! Bulgarian (bg) phonemizer, canonical IPA: a left-to-right grapheme scan (palatalisation before ь я ю, the ⟨л⟩
//! environments) and the ordered consonant post-rules (n→ŋ, final devoicing, regressive voicing, стк, stop-geminate
//! collapse, sibilant assimilation); text() over Cyrillic words, numbers and clause punctuation.
//! Ported from src/languages/bulgarian/bulgarian.ts — see that file for the referee evidence.

use std::collections::{HashMap, HashSet};
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::normalize_bulgarian;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::ipa::is_ipa_vowel;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/bulgarian";

/// The local `NumbersDef` interface in bulgarian.ts.
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
    pub billion: String,
    pub billions: String,
    pub masculine: HashMap<String, String>,
    #[serde(rename = "and")]
    pub and_word: String,
}

/// `BulgarianDef`: every field the TS interface names, required.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulgarianDef {
    pub letters: IndexMap<String, String>,
    pub palatalizing_letters: Vec<String>,
    pub front_vowel_letters: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: NumbersDef,
}

/// `DEF`, or why bulgarian.jsonc could not be loaded. Cached once loaded; a failure is retried.
pub fn try_manifest() -> Result<&'static BulgarianDef, String> {
    static M: OnceLock<BulgarianDef> = OnceLock::new();
    load_once(&M, || {
        let m: BulgarianDef = load_manifest(DIR, "bulgarian.jsonc").map_err(|e| e.to_string())?;
        let n = &m.numbers;
        let tens_ok = (2..10).all(|t| n.tens.contains_key(&(t * 10).to_string()));
        let hundreds_ok = (1..10).all(|h| n.hundreds.contains_key(&h.to_string()));
        if n.units.len() < 10 || n.teens.len() < 9 || !tens_ok || !hundreds_ok {
            return Err(
                "bulgarian.jsonc numbers: a table numberToText indexes is short".to_string(),
            );
        }
        Ok(m)
    })
}

/// The manifest for code reached only through a checked path. ⚠ Crate-private: touching it unchecked panics.
pub(crate) static DEF: LazyLock<&'static BulgarianDef> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

struct Tables {
    letters: IndexMap<JsString, JsString>,
    front: HashSet<JsString>,
    pal: HashSet<JsString>,
}

/// Every lookup key is one scanned code point, never an `Object.prototype` member's name.
static T: LazyLock<Tables> = LazyLock::new(|| {
    let m = &*DEF;
    Tables {
        letters: m.letters.iter().map(|(k, v)| (js(k), js(v))).collect(),
        front: m.front_vowel_letters.iter().map(|k| js(k)).collect(),
        pal: m.palatalizing_letters.iter().map(|k| js(k)).collect(),
    }
});

/// `DEVOICE`, in its literal's order.
const DEVOICE: [(&str, &str); 8] = [
    ("b", "p"),
    ("v", "f"),
    ("ɡ", "k"),
    ("d", "t"),
    ("ʒ", "ʃ"),
    ("z", "s"),
    ("d͡ʒ", "t͡ʃ"),
    ("d͡z", "t͡s"),
];

fn devoice(b: &JsString) -> Option<JsString> {
    DEVOICE
        .iter()
        .find(|(k, _)| js(k) == *b)
        .map(|(_, v)| js(v))
}

/// `VOICE`: `DEVOICE` inverted.
fn voice(b: &JsString) -> Option<JsString> {
    DEVOICE
        .iter()
        .find(|(_, v)| js(v) == *b)
        .map(|(k, _)| js(k))
}

/// `VOICELESS`: `DEVOICE`'s values plus x and ʃt.
fn voiceless(b: &JsString) -> bool {
    *b == js("x") || *b == js("ʃt") || DEVOICE.iter().any(|(_, v)| js(v) == *b)
}

/// `base(t)`: `t.replace("ʲ", "")`, the FIRST ʲ only.
fn base(t: &JsString) -> JsString {
    js_re!("ʲ", "").replace(t, &JsString::new())
}

/// `isCons(t)`: non-empty and its base's first code UNIT is not an IPA vowel (an empty base counts as a
/// consonant: `VOWELS.has(undefined)` is false).
fn is_cons(t: &JsString) -> bool {
    !t.is_empty() && !base(t).char_code_at(0).is_some_and(is_ipa_vowel)
}

/// `phonemizeWord(word)`: the scan, then the post-rules. No stress, no reduction, not NFC-normalized.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let t = &*T;
    let w = js_re!("['\u{301}\u{300}]", "gu").replace(&word.to_lower_case(), &JsString::new());
    let chars = w.code_point_strings();
    let empty = JsString::new();
    let soft = js("ʲ");
    let mut toks: Vec<JsString> = Vec::new();
    for (i, c) in chars.iter().enumerate() {
        let nxt = chars.get(i + 1).unwrap_or(&empty);
        if *c == js("л") {
            toks.push(js(if t.pal.contains(nxt) {
                "lʲ"
            } else if t.front.contains(nxt) {
                "l"
            } else {
                "ɫ"
            }));
        } else if *c == js("я") || *c == js("ю") {
            let v = js(if *c == js("я") { "a" } else { "u" });
            match toks.last_mut() {
                Some(last) if is_cons(last) && *last != js("j") => {
                    if !last.ends_with(&soft) {
                        *last = last.concat(&soft);
                    }
                    toks.push(v);
                }
                _ => {
                    toks.push(js("j"));
                    toks.push(v);
                }
            }
        } else if *c == js("ь") {
            if let Some(last) = toks.last_mut()
                && is_cons(last)
                && !last.ends_with(&soft)
            {
                *last = last.concat(&soft);
            }
        } else if let Some(ph) = t.letters.get(c) {
            toks.push(ph.clone());
        }
    }
    apply_phonotactics(toks)
}

/// `applyPhonotactics(toks)`: the ordered consonant post-rules, each keyed on the token's base.
fn apply_phonotactics(mut toks: Vec<JsString>) -> JsString {
    let suf = |t: &JsString| {
        if t.ends_with(&js("ʲ")) {
            js("ʲ")
        } else {
            JsString::new()
        }
    };
    let among = |b: &JsString, xs: &[&str]| xs.iter().any(|x| js(x) == *b);
    for k in 0..toks.len().saturating_sub(1) {
        if base(&toks[k]) == js("n") && among(&base(&toks[k + 1]), &["k", "ɡ"]) {
            toks[k] = js("ŋ").concat(&suf(&toks[k]));
        }
    }
    if let Some(last) = toks.last_mut()
        && let Some(v) = devoice(&base(last))
    {
        *last = v.concat(&suf(last));
    }
    for k in (0..toks.len().saturating_sub(1)).rev() {
        let (b, nb) = (base(&toks[k]), base(&toks[k + 1]));
        if nb == js("v") {
            continue;
        }
        if let Some(v) = devoice(&b)
            && voiceless(&nb)
        {
            toks[k] = v.concat(&suf(&toks[k]));
        } else if let Some(v) = voice(&b)
            && devoice(&nb).is_some()
        {
            toks[k] = v.concat(&suf(&toks[k]));
        }
    }
    let mut out: Vec<JsString> = Vec::new();
    for k in 0..toks.len() {
        if toks[k] == js("t")
            && k > 0
            && base(&toks[k - 1]) == js("s")
            && k + 1 < toks.len()
            && base(&toks[k + 1]) == js("k")
        {
            continue;
        }
        out.push(toks[k].clone());
    }
    let toks = out;
    let mut out: Vec<JsString> = Vec::new();
    for t in toks {
        if out.last() == Some(&t) && among(&base(&t), &["t", "d", "k", "p", "b", "ɡ"]) {
            continue;
        }
        out.push(t);
    }
    let mut toks = out;
    for k in 0..toks.len().saturating_sub(1) {
        if among(&base(&toks[k]), &["s", "z"]) && among(&base(&toks[k + 1]), &["ʃ", "t͡ʃ"]) {
            toks[k] = js("ʃ");
        }
    }
    JsString::join(&toks, &JsString::new())
}

/// `numberToText(n)`: Bulgarian words for a safe integer, `и` before the final component.
fn number_to_text(n: f64) -> String {
    let num = &DEF.numbers;
    if n < 0.0 {
        return String::new();
    }
    if n < 10.0 {
        return num.units[n as usize].clone();
    }
    if n == 10.0 {
        return num.ten.clone();
    }
    if n < 20.0 {
        return num.teens[(n - 11.0) as usize].clone();
    }
    let and = &num.and_word;
    if n < 100.0 {
        let t = &num.tens[&(((n / 10.0).floor() * 10.0) as u64).to_string()];
        let u = (n % 10.0) as usize;
        return if u != 0 {
            format!("{t} {and} {}", num.units[u])
        } else {
            t.clone()
        };
    }
    let connect = |r: f64, cond: bool| {
        format!(
            "{}{}",
            if cond {
                format!("{and} ")
            } else {
                String::new()
            },
            number_to_text(r)
        )
    };
    if n < 1000.0 {
        let h = &num.hundreds[&((n / 100.0).floor() as u64).to_string()];
        let r = n % 100.0;
        if r == 0.0 {
            return h.clone();
        }
        return format!("{h} {}", connect(r, r < 20.0 || r % 10.0 == 0.0));
    }
    if n < 1_000_000.0 {
        let (th, r) = ((n / 1000.0).floor(), n % 1000.0);
        let th_word = if th == 1.0 {
            num.thousand.clone()
        } else {
            format!("{} {}", number_to_text(th), num.thousands)
        };
        if r == 0.0 {
            return th_word;
        }
        return format!("{th_word} {}", connect(r, r < 100.0 || r % 100.0 == 0.0));
    }
    for (value, sg, pl) in [
        (1e9, &num.billion, &num.billions),
        (1e6, &num.million, &num.millions),
    ] {
        if n >= value {
            let (q, r) = ((n / value).floor(), n % value);
            let m_word = format!(
                "{} {}",
                masculine_text(q),
                if q % 10.0 == 1.0 { sg } else { pl }
            );
            if r == 0.0 {
                return m_word;
            }
            return format!("{m_word} {}", connect(r, r < 100.0 || r % 100.0 == 0.0));
        }
    }
    crate::core::js_string::js_number_to_string(n)
}

/// `masculineText(n)`: the masculine 1/2 that милион/милиард take.
fn masculine_text(n: f64) -> String {
    let m = DEF.numbers.masculine.get(&((n % 10.0) as u64).to_string());
    match m {
        Some(m) if !(n > 10.0 && n < 20.0) => {
            if n < 10.0 {
                m.clone()
            } else {
                js_re!(r"\S+$", "u")
                    .replace(&js(&number_to_text(n)), &js(m))
                    .to_string_lossy()
            }
        }
        _ => number_to_text(n),
    }
}

/// `number(digits)`: composed for a safe integer, else digit by digit through the same composer.
fn number(digits: &JsString) -> JsString {
    let n = js_number(digits);
    let words = if is_safe_integer(n) {
        number_to_text(n)
    } else {
        digits
            .code_point_strings()
            .iter()
            .map(|d| number_to_text(js_number(d)))
            .collect::<Vec<_>>()
            .join(" ")
    };
    let ipa: Vec<JsString> = words
        .split(' ')
        .filter(|w| !w.is_empty())
        .map(|w| phonemize_word(&js(w)))
        .collect();
    JsString::join(&ipa, &js(" "))
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new("([а-яёА-ЯЁ']+)|(\\d+)|([.!?…,;:—])", "gu").unwrap());

/// The Bulgarian engine (`createBulgarian`).
pub struct BulgarianPhonemizer;

/// The module functions, exposed through the engine: holding a `BulgarianPhonemizer` proves the manifest
/// loaded, so none of these can reach a load panic. (The per-module differentials call them.)
impl BulgarianPhonemizer {
    /// `normalizeBulgarian(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_bulgarian(text)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `numberToText(n)`.
    pub fn number_to_text(&self, n: f64) -> JsString {
        js(&number_to_text(n))
    }

    /// `number(digits)`.
    pub fn number(&self, digits: &JsString) -> JsString {
        number(digits)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let m = &*DEF;
        assemble_clauses(&normalize_bulgarian(input), &TOKEN, |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(n) = mm.group(2, s).filter(|n| !n.is_empty()) {
                sink.emit(&number(&n));
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

impl Engine for BulgarianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(BulgarianPhonemizer::text(self, input))
    }
}

/// `createBulgarian()`. Errors when the manifest cannot be loaded.
pub fn create_bulgarian() -> Result<BulgarianPhonemizer, String> {
    try_manifest()?;
    Ok(BulgarianPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // test/bulgarian.test.ts's literal `phonemizeWord`, `normalizeBulgarian` and `.text(…)` pins,
    // extracted from that file mechanically (each is a reading the TS suite asserts), so the two engines are held
    // to one list. `ENGINE_TEXT_PINS` go through `createBulgarian().text` (no registry pre-pass).
    // The bool says whether the TS trims the result.
    const WORD_PINS: &[(&str, &str)] = &[
        ("град", "ɡrat"),
        ("хляб", "xlʲap"),
        ("сграда", "zɡrada"),
        ("мляко", "mlʲakɔ"),
        ("бял", "bʲaɫ"),
        ("език", "ɛzik"),
        ("България", "bɤɫɡarija"),
        ("съществителен", "sɤʃtɛstvitɛlɛn"),
    ];
    const NORM_PINS: &[(&str, &str)] = &[
        ("1767 г.", "1767 година"),
        ("323 г. пр.н.е.", "323 година преди новата ера"),
        ("5 000", "5000"),
        ("12,5", "12 цяло и 5"),
        ("22:00", "22 00"),
        ("25 %", "25 процента"),
        ("50 км", "50 километра"),
        ("км2", "квадратни километра"),
        ("км²", "квадратни километра"),
        ("50 км/ч", "50 километра в час"),
        ("Това е 1990. Той дойде", "Това е 1990. Той дойде"),
        ("20 °C", "20 градуса по Целзий"),
        ("1990-1995", "1990 до 1995"),
        ("$2500", "2500 долара"),
        ("EX = изчезнал", "EX равно на изчезнал"),
        ("Българският е език.", "Българският е език."),
    ];
    const ENGINE_TEXT_PINS: &[(&str, &str, bool)] = &[
        ("21", "dvajsɛt i ɛdnɔ", false),
        ("123", "stɔ dvajsɛt i tri", false),
        ("2025", "dvɛ xilʲadi i dvajsɛt i pɛt", false),
        ("7", "sɛdɛm", false),
        ("42", "t͡ʃɛtirijsɛt i dvɛ", false),
        ("555", "pɛtstɔtin pɛdɛsɛt i pɛt", false),
        ("12345", "dvanajsɛt xilʲadi trista t͡ʃɛtirijsɛt i pɛt", false),
        ("1000000", "ɛdin miliɔn", false),
        ("2000000", "dva miliɔna", false),
        ("5000000", "pɛt miliɔna", false),
        ("21000000", "dvajsɛt i ɛdin miliɔn", false),
        ("1000000000", "ɛdin miliart", false),
        ("2000000000", "dva miliarda", false),
    ];
    const ENGINE_CONTAINS_PINS: &[(&str, &str)] = &[
        ("133 м/сек", "mɛtra f sɛkunda"),
        ("133 м/с", "mɛtra f sɛkunda"),
        ("120 km/h", "kiɫɔmɛtra f t͡ʃas"),
        ("120 км/ч", "kiɫɔmɛtra f t͡ʃas"),
        ("космонавт № 11", "nɔmɛr ɛdinajsɛt"),
        ("реактори № 1", "nɔmɛr"),
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        let e = create_bulgarian().unwrap();
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
        for (t, part) in ENGINE_CONTAINS_PINS {
            assert!(e.text(&js(t)).to_string_lossy().contains(part), "{t}");
        }
    }

    /// Cyrillic-in-host routing: bg has no `HOST_OVERRIDES` entry and its TOKEN is `[а-яёА-ЯЁ']`, so ѝ (U+045D)
    /// is an unclaimed Cyrillic run that goes to the Russian reader, which reads it as nothing — the TS reading
    /// (`и ѝ каза` → `i kaza`), reported in the port log, reproduced here.
    #[test]
    fn an_unclaimed_cyrillic_run_goes_to_russian() {
        assert_eq!(crate::phonemize("и ѝ каза", "bg").unwrap(), "i kaza");
        assert_eq!(
            crate::core::scripts::reader_for(&js("ѝ"), "bg").map(|(t, _)| t),
            Some("ru")
        );
    }
}
