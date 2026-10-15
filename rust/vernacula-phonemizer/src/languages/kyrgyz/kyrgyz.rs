//! Kyrgyz (ky) phonemizer: the Cyrillic scan with velar/uvular and dark-l harmony keyed on the governing vowel,
//! long vowels, intervocalic б → β; the cardinal composer; text() over words, digit runs and punctuation.
//! Ported from src/languages/kyrgyz/kyrgyz.ts — see that file for the sources.

use std::sync::LazyLock;

use super::manifest::{MANIFEST, try_manifest};
use super::normalize::{
    is_unreadable_kyrgyz, kyrgyz_ordinal, normalize_kyrgyz, normalize_kyrgyz_initialisms,
};
use crate::core::clauses::assemble_clauses;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::numbers::{NumbersDef, Word, render_number, spell_digits};
use crate::registry::{Engine, PhonemizeError};

/// `c in V` on one code point (no `Object.prototype` member is one).
fn is_vowel_letter(c: &str) -> bool {
    MANIFEST.vowels.contains_key(c)
}

fn is_back(c: &str) -> bool {
    MANIFEST.back_vowels.chars().any(|b| b.to_string() == c)
}

/// `backHarmony(chars, i)`: a coda takes the preceding vowel; otherwise the nearest following, else the
/// nearest preceding; front when the word has no vowel.
fn back_harmony(chars: &[String], i: usize) -> bool {
    let at = |k: isize| -> &str {
        if k < 0 {
            ""
        } else {
            chars.get(k as usize).map_or("", |c| c.as_str())
        }
    };
    let i = i as isize;
    if is_vowel_letter(at(i - 1)) && !is_vowel_letter(at(i + 1)) {
        return is_back(at(i - 1));
    }
    if let Some(c) = chars[(i + 1) as usize..]
        .iter()
        .find(|c| is_vowel_letter(c))
    {
        return is_back(c);
    }
    if let Some(c) = chars[..i as usize]
        .iter()
        .rev()
        .find(|c| is_vowel_letter(c))
    {
        return is_back(c);
    }
    false
}

/// `phonemizeWord(word)`: one word → IPA (no stress mark: the TS emits none).
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    // `[...word.toLowerCase()]`: code points, a lone surrogate as its own item.
    let chars: Vec<String> = word
        .to_lower_case()
        .code_point_strings()
        .iter()
        .map(|c| c.to_string_lossy())
        .collect();
    let raw: Vec<JsString> = word.to_lower_case().code_point_strings();
    let m = &*MANIFEST;
    let mut out = JsString::new();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i].as_str();
        let vowel = is_vowel_letter(c);
        if vowel && raw.get(i + 1) == Some(&raw[i]) {
            out.push_str(&js(&m.vowels[c]));
            out.push_str(&js("ː"));
            i += 2;
            continue;
        }
        if vowel {
            out.push_str(&js(&m.vowels[c]));
        } else if c == "к" {
            out.push_str(&js(if back_harmony(&chars, i) { "q" } else { "k" }));
        } else if c == "г" {
            out.push_str(&js(if back_harmony(&chars, i) { "ʁ" } else { "ɡ" }));
        } else if c == "л" {
            out.push_str(&js(if back_harmony(&chars, i) { "ɫ" } else { "l" }));
        } else if c == "б"
            && i > 0
            && is_vowel_letter(&chars[i - 1])
            && chars.get(i + 1).is_some_and(|n| is_vowel_letter(n))
        {
            out.push_str(&js("β"));
        } else if let Some(io) = m.iotated.get(c) {
            out.push_str(&js(io));
        } else if let Some(cons) = m.consonants.get(c) {
            out.push_str(&js(cons));
        }
        i += 1;
    }
    out
}

/// `kyrgyzNumberWords(n, d)`: tens + units + hundred / thousand / million / billion, space-separated; the
/// hundred omits a leading 1, the thousand keeps it.
pub(crate) fn kyrgyz_number_words(n: u64, d: &NumbersDef) -> Vec<Word> {
    let unit = |k: u64| d.units.get(k as usize).cloned();
    let more = |r: u64| {
        if r != 0 {
            kyrgyz_number_words(r, d)
        } else {
            Vec::new()
        }
    };
    if n < 10 {
        return vec![unit(n)];
    }
    if n < 100 {
        let (t, u) = (n / 10 * 10, n % 10);
        let mut v = vec![d.tens.get(&t.to_string()).cloned()];
        if u != 0 {
            v.push(unit(u));
        }
        return v;
    }
    let mag = &d.magnitudes;
    if n < 1000 {
        let (h, r) = (n / 100, n % 100);
        let mut v = Vec::new();
        if h > 1 {
            v.push(unit(h));
        }
        v.push(mag.hundred.clone());
        v.extend(more(r));
        return v;
    }
    let (div, word) = if n < 1_000_000 {
        (1000, &mag.thousand)
    } else if n < 1_000_000_000 {
        (1_000_000, &mag.million)
    } else {
        (1_000_000_000, &mag.billion)
    };
    let mut v = kyrgyz_number_words(n / div, d);
    v.push(word.clone());
    v.extend(more(n % div));
    v
}

/// `numberWords(n)`: the cardinal in orthography, 0 … 10¹² − 1 (safe integers only); else `None`.
pub(crate) fn number_words(n: f64) -> Option<JsString> {
    if !is_safe_integer(n) || n < 0.0 || n >= 1_000_000_000_000.0 {
        return None;
    }
    let words: Vec<JsString> = kyrgyz_number_words(n as u64, &MANIFEST.numbers)
        .into_iter()
        .flatten()
        .filter(|w| !w.is_empty())
        .map(|w| js(&w))
        .collect();
    Some(JsString::join(&words, &js(" ")))
}

/// `number(digits)`: an unsafe integer is read digit at a time.
fn number(digits: &JsString) -> JsString {
    let n = js_number(digits);
    let word = |w: &str| phonemize_word(&js(w)).to_string_lossy();
    if !is_safe_integer(n) {
        return js(&spell_digits(
            &digits.to_string_lossy(),
            &MANIFEST.numbers,
            &word,
        ));
    }
    js(&render_number(
        n as u64,
        &MANIFEST.numbers,
        &word,
        kyrgyz_number_words,
    ))
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"([Ѐ-ӿ]+)|(\d+)|([.?!,;:…—])", "gu").unwrap());

/// The Kyrgyz engine (`createKyrgyz`).
pub struct KyrgyzPhonemizer;

/// The module functions, exposed through the engine: holding one proves the manifest loaded. (The per-module
/// differentials call them.)
impl KyrgyzPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_kyrgyz(text)
    }

    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_kyrgyz_initialisms(text, false)
    }

    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_kyrgyz(word)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn number_words(&self, n: f64) -> Option<JsString> {
        number_words(n)
    }

    pub fn ordinal(&self, n: f64) -> Option<JsString> {
        kyrgyz_ordinal(n)
    }

    pub fn number(&self, digits: &JsString) -> JsString {
        number(digits)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        assemble_clauses(&normalize_kyrgyz(input), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(n) = m.group(2, s).filter(|n| !n.is_empty()) {
                sink.emit(&number(&n));
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

impl Engine for KyrgyzPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(KyrgyzPhonemizer::text(self, input))
    }
}

/// `createKyrgyz()`. Errors when the manifest cannot be loaded, or the symbol tier refuses its table.
pub fn create_kyrgyz() -> Result<KyrgyzPhonemizer, String> {
    try_manifest()?;
    super::normalize::try_symbols()?;
    Ok(KyrgyzPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One pin's actual value: `kind` names the TS call the pin was extracted from.
    fn actual(ky: &KyrgyzPhonemizer, kind: &str, input: &str) -> Option<JsString> {
        let s = js(input);
        match kind {
            "word" => Some(phonemize_word(&s)),
            "engine" => Some(ky.text(&s)),
            "ordinal" => kyrgyz_ordinal(input.parse::<f64>().unwrap()),
            k => panic!("no pin kind {k}"),
        }
    }

    /// test/kyrgyz.test.ts's pins, extracted by `.probe/turkic/pins.mjs` (no reading typed by hand). A `same`
    /// pin is relational: both inputs must read alike.
    #[test]
    fn the_ts_suite_pins_hold() {
        let ky = create_kyrgyz().unwrap();
        let mut bad = Vec::new();
        for (kind, trim, op, input, want) in PINS {
            let get = |i: &str| actual(&ky, kind, i).map(|g| if trim { g.trim() } else { g });
            let got = get(input);
            let ok = match (op, &got) {
                ("none", None) => true,
                ("eq", Some(g)) => *g == js(want),
                ("ne", Some(g)) => *g != js(want),
                ("contains", Some(g)) => g.includes(&js(want)),
                ("not_contains", Some(g)) => !g.includes(&js(want)),
                ("same", Some(g)) => Some(g.clone()) == get(want),
                ("not_same", Some(g)) => Some(g.clone()) != get(want),
                _ => false,
            };
            if !ok {
                bad.push(format!("{kind}({input}) {op} {want:?}: got {got:?}"));
            }
        }
        assert!(bad.is_empty(), "{}", bad.join("\n"));
    }

    /// 65 pins extracted mechanically from test/kyrgyz.test.ts (kind, trim, op, input,
    /// expected): 65 expect() sites, 0 skipped.
    const PINS: [(&str, bool, &str, &str, &str); 65] = [
        ("word", false, "eq", "кыз", "qɯz"),
        ("word", false, "eq", "ак", "ɑq"),
        ("word", false, "eq", "китеп", "kitep"),
        ("word", false, "eq", "Баткен", "bɑtken"),
        ("word", false, "eq", "жол", "d͡ʒoɫ"),
        ("word", false, "eq", "көз", "køz"),
        ("word", false, "eq", "үй", "yj"),
        ("word", false, "eq", "ыр", "ɯr"),
        ("word", false, "eq", "обон", "oβon"),
        ("word", false, "eq", "тоо", "toː"),
        ("word", false, "eq", "Айсулуу", "ɑjsuɫuː"),
        ("engine", true, "eq", "0", "nøl"),
        ("engine", true, "eq", "21", "d͡ʒɯjɯrmɑ bir"),
        ("engine", true, "eq", "100", "d͡ʒyz"),
        ("engine", true, "eq", "1000", "bir miŋ"),
        (
            "engine",
            true,
            "eq",
            "1991",
            "bir miŋ toʁuz d͡ʒyz toqson bir",
        ),
        ("engine", true, "eq", "1000000000", "bir milliɑrd"),
        ("engine", false, "eq", "Мен барам.", "men bɑrɑm ."),
        ("ordinal", false, "eq", "1", "биринчи"),
        ("ordinal", false, "eq", "3", "үчүнчү"),
        ("ordinal", false, "eq", "40", "кыркынчы"),
        ("ordinal", false, "eq", "10", "онунчу"),
        ("ordinal", false, "eq", "2", "экинчи"),
        ("ordinal", false, "eq", "20", "жыйырманчы"),
        ("ordinal", false, "eq", "50", "элүүнчү"),
        (
            "ordinal",
            false,
            "eq",
            "1991",
            "бир миң тогуз жүз токсон биринчи",
        ),
        ("ordinal", false, "eq", "100", "жүзүнчү"),
        ("ordinal", false, "eq", "1000", "бир миңинчи"),
        (
            "engine",
            true,
            "eq",
            "1991-жылы",
            "bir miŋ toʁuz d͡ʒyz toqson birint͡ʃi d͡ʒɯɫɯ",
        ),
        ("engine", true, "eq", "19-кылымда", "on toʁuzunt͡ʃu qɯɫɯmdɑ"),
        ("engine", true, "eq", "9-Май", "toʁuzunt͡ʃu mɑj"),
        (
            "engine",
            true,
            "eq",
            "10-12-кылымдагы",
            "onunt͡ʃu on ekint͡ʃi qɯɫɯmdɑʁɯ",
        ),
        (
            "engine",
            true,
            "eq",
            "1991-ж.",
            "bir miŋ toʁuz d͡ʒyz toqson birint͡ʃi d͡ʒɯɫɯ",
        ),
        ("engine", true, "eq", "150дөн", "d͡ʒyz elyːdøn"),
        ("engine", true, "eq", "1000ге", "bir miŋɡe"),
        ("engine", true, "eq", "25ге", "d͡ʒɯjɯrmɑ beʃke"),
        ("engine", true, "eq", "2-декабрда", "ekint͡ʃi deqɑbrdɑ"),
        ("engine", true, "eq", "50%", "elyː pɑjɯz"),
        ("engine", true, "eq", "80%ке", "seksen pɑjɯzʁɑ"),
        ("engine", true, "eq", "20 °C", "d͡ʒɯjɯrmɑ ʁrɑdus"),
        ("engine", true, "eq", "-18°Сден", "minus on seɡiz ʁrɑdustɑn"),
        ("engine", true, "same", "30 °c", "30 °C"),
        ("engine", true, "eq", "30 °C-дан", "otuz ʁrɑdustɑn"),
        ("engine", true, "same", "30 °C-ДАН", "30 °-ДАН"),
        (
            "engine",
            true,
            "eq",
            "температура -38°С",
            "temperɑturɑ minus otuz seɡiz ʁrɑdus",
        ),
        ("engine", true, "eq", "—40°С", "minus qɯrq ʁrɑdus"),
        (
            "engine",
            true,
            "contains",
            "-23...-29 °C",
            "minus d͡ʒɯjɯrmɑ yt͡ʃ",
        ),
        ("engine", true, "not_contains", "6-16 °C", "minus"),
        ("engine", true, "not_contains", "39°11′–43°16′", "minus"),
        ("engine", true, "not_contains", "2750-3800 метр", "minus"),
        ("engine", true, "eq", "2,5", "eki bytyn ondon beʃ"),
        ("engine", true, "eq", "0,54", "nøl bytyn d͡ʒyzdøn elyː tørt"),
        ("engine", true, "eq", "3/4", "tørttøn yt͡ʃ"),
        ("engine", true, "eq", "1/10", "ondon bir"),
        ("engine", true, "eq", "1 000 000", "bir million"),
        ("engine", true, "eq", "5 км", "beʃ kiɫometr"),
        (
            "engine",
            true,
            "eq",
            "1090 км²",
            "bir miŋ toqson t͡ʃɑrt͡ʃɯ kiɫometr",
        ),
        ("engine", true, "eq", "$100 миллион", "d͡ʒyz million doɫɫɑr"),
        ("engine", true, "eq", "СССР", "es es es er"),
        ("engine", true, "eq", "СССРдин", "es es es erdin"),
        ("engine", true, "eq", "ГЭС", "ɡes"),
        (
            "engine",
            true,
            "eq",
            "Мен барам. Сен барасың.",
            "men bɑrɑm . sen bɑrɑsɯŋ .",
        ),
        ("engine", true, "not_contains", "ПК = Upgrading", "bɑrɑβɑr"),
        ("engine", true, "not_contains", "802.11г", "ɡrɑmm"),
        ("engine", true, "eq", "3-4", "yt͡ʃ tørt"),
    ];
}
