//! Belarusian (be) phonemizer, canonical IPA: a left-to-right letter scan (palatalisation before ь/і/iotated
//! vowels, the iotated vowels' glide, ⟨ў⟩, the дз/дж affricates), voicing assimilation with final devoicing,
//! regressive palatalisation and geminates; text() over Cyrillic words, numbers with a decimal comma (the
//! East-Slavic agreeing compositor shared with Ukrainian), and clause punctuation.
//! Ported from src/languages/belarusian/belarusian.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::{normalize_belarusian, normalize_belarusian_initialisms};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{
    SymbolData, SymbolNormalizer, make_symbol_normalizer, slavic_count_form,
};
use crate::core::numbers::{NumbersDef, Word, render_number, spell_digits};
use crate::core::provenance::{Form, normalize};
use crate::js_re;
use crate::languages::ukrainian::manifest::EastSlavicNumbers;
use crate::languages::ukrainian::numbers::east_slavic_number_words;
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/belarusian";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Voicing {
    pub to_voiceless: IndexMap<String, String>,
    pub to_voiced: IndexMap<String, String>,
}

/// `EastSlavicNumbers & { decimalConnector }`.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BeNumbers {
    #[serde(flatten)]
    pub east: EastSlavicNumbers,
    pub decimal_connector: String,
}

/// `BelarusianDef`: every field the TS interface names, required.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BelarusianDef {
    pub vowels: IndexMap<String, String>,
    pub iotated: IndexMap<String, String>,
    pub palatalizers: Vec<String>,
    pub vowel_letters: Vec<String>,
    pub consonants: IndexMap<String, String>,
    pub voicing: Voicing,
    pub numbers: BeNumbers,
    pub clause_punctuation: IndexMap<String, String>,
}

/// `DEF`, or why belarusian.jsonc could not be loaded. Cached once loaded; a failure is retried.
pub fn try_manifest() -> Result<&'static BelarusianDef, String> {
    static M: OnceLock<BelarusianDef> = OnceLock::new();
    load_once(&M, || {
        let m: BelarusianDef = load_manifest(DIR, "belarusian.jsonc").map_err(|e| e.to_string())?;
        let b = &m.numbers.east.base;
        let mags = &b.magnitudes;
        if b.units.len() < 10
            || b.teens.as_ref().is_none_or(|t| t.len() < 10)
            || b.hundreds.as_ref().is_none_or(|h| h.len() < 10)
            || mags.thousand.is_none()
            || mags.million.is_none()
            || mags.billion.is_none()
        {
            return Err(
                "belarusian.jsonc numbers: a table the composer indexes is short".to_string(),
            );
        }
        Ok(m)
    })
}

/// The manifest for code reached only through a checked path (a `BelarusianPhonemizer`, or `try_manifest`
/// first). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static DEF: LazyLock<&'static BelarusianDef> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

const SOFT: &str = "ь";

/// The manifest's letter tables as `JsString`s (an own-key lookup: every key is one code point or a phone).
struct Letters {
    consonants: IndexMap<JsString, JsString>,
    iotated: IndexMap<JsString, JsString>,
    vowels: IndexMap<JsString, JsString>,
    palatalizers: HashSet<JsString>,
    vowel_letters: HashSet<JsString>,
    to_voiceless: IndexMap<JsString, JsString>,
    to_voiced: IndexMap<JsString, JsString>,
}

static LETTERS: LazyLock<Letters> = LazyLock::new(|| {
    let m = &*DEF;
    let map = |t: &IndexMap<String, String>| t.iter().map(|(k, v)| (js(k), js(v))).collect();
    let set = |t: &[String]| t.iter().map(|k| js(k)).collect();
    Letters {
        consonants: map(&m.consonants),
        iotated: map(&m.iotated),
        vowels: map(&m.vowels),
        palatalizers: set(&m.palatalizers),
        vowel_letters: set(&m.vowel_letters),
        to_voiceless: map(&m.voicing.to_voiceless),
        to_voiced: map(&m.voicing.to_voiced),
    }
});

/// `palatalise(ipa)`: dark ɫ → lʲ, everything else appends ʲ.
fn palatalise(ipa: &JsString) -> JsString {
    if *ipa == js("ɫ") {
        js("lʲ")
    } else {
        ipa.concat(&js("ʲ"))
    }
}

/// `PALC`: a palatalised coronal, labial or soft l (not a velar).
const PALC: &str = "(?:t͡s|d͡z|[tdsznbpvfml])ʲ";

static RE_DARKL_SOFT: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("ɫ(?={PALC}|lʲ)"), "gu").unwrap());
static RE_SIB_SOFT: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("(t͡s|d͡z|[sz])(?={PALC})"), "gu").unwrap());

/// `applyVoicing(out)`: regressive assimilation and final devoicing right to left; `v` is a target, never a
/// trigger. The palatalisation mark rides along (`split`).
fn apply_voicing(out: &mut [JsString]) {
    let l = &*LETTERS;
    let split = |p: &JsString| -> (JsString, JsString) {
        if p.ends_with(&js("ʲ")) {
            (p.slice(0, Some(-1)), js("ʲ"))
        } else {
            (p.clone(), JsString::new())
        }
    };
    let obstruent = |b: &JsString| l.to_voiceless.contains_key(b) || l.to_voiced.contains_key(b);
    for i in (0..out.len()).rev() {
        let (base, soft) = split(&out[i]);
        if !obstruent(&base) {
            continue;
        }
        // None = keep; Some(true) = voiced; Some(false) = voiceless.
        let target = match out.get(i + 1) {
            None => Some(false),
            Some(nx) => {
                let (nbase, _) = split(nx);
                if obstruent(&nbase) && nbase != js("v") {
                    Some(l.to_voiceless.contains_key(&nbase))
                } else {
                    None
                }
            }
        };
        match target {
            Some(false) => {
                if let Some(v) = l.to_voiceless.get(&base) {
                    out[i] = v.concat(&soft);
                }
            }
            Some(true) => {
                if let Some(v) = l.to_voiced.get(&base) {
                    out[i] = v.concat(&soft);
                }
            }
            None => {}
        }
    }
}

/// `phonemizeWord(word)`: one Belarusian word to canonical IPA, NFC.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let l = &*LETTERS;
    let chars = word.to_lower_case().code_point_strings();
    let empty = JsString::new();
    let soft = js(SOFT);
    let at = |i: usize| chars.get(i).unwrap_or(&empty);
    let is_cons = |c: &JsString| l.consonants.contains_key(c);
    let mut out: Vec<JsString> = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let c = &chars[i];
        let nxt = at(i + 1);
        if *c == js("д") && (*nxt == js("з") || *nxt == js("ж")) {
            let after = at(i + 2);
            let mut aff = js(if *nxt == js("з") { "d͡z" } else { "d͡ʐ" });
            if l.palatalizers.contains(after) && *nxt == js("з") {
                aff = palatalise(&aff);
            }
            out.push(aff);
            i += 2;
            if *after == soft {
                i += 1;
            }
            continue;
        }
        if *c == js("ў") {
            let prev = if i > 0 { at(i - 1) } else { &empty };
            out.push(js(if l.vowel_letters.contains(prev) {
                "u̯"
            } else {
                "w"
            }));
            i += 1;
            continue;
        }
        if let Some(hard) = l.consonants.get(c) {
            let mut ipa = hard.clone();
            if l.palatalizers.contains(nxt) {
                ipa = palatalise(&ipa);
            }
            out.push(ipa);
            i += 1;
            if *nxt == soft {
                i += 1;
            }
            continue;
        }
        if let Some(v) = l.iotated.get(c) {
            let prev = if i > 0 { at(i - 1) } else { &empty };
            if !is_cons(prev) || *prev == js("й") {
                out.push(js("j"));
            }
            out.push(v.clone());
            i += 1;
            continue;
        }
        if let Some(v) = l.vowels.get(c) {
            out.push(v.clone());
            i += 1;
            continue;
        }
        if *c == soft {
            if let Some(last) = out.last_mut()
                && !last.is_empty()
                && !last.ends_with(&js("ʲ"))
            {
                *last = palatalise(last);
            }
            i += 1;
            continue;
        }
        i += 1;
    }
    apply_voicing(&mut out);
    let mut x = JsString::join(&out, &JsString::new());
    x = RE_DARKL_SOFT.replace(&x, &js("lʲ"));
    x = RE_SIB_SOFT.replace(&x, &js("$1ʲ"));
    x = js_re!("n(?=(?:t͡s|d͡z)ʲ)", "gu").replace(&x, &js("nʲ"));
    x = js_re!(r"(t͡ʂ|t͡s|d͡ʐ|d͡z)(ʲ?)\1\2", "gu").replace(&x, &js("$1$2ː"));
    x = js_re!(r"([bvɣɡdʐznɫlmnprstfxʂ])ʲ\1ʲ", "gu").replace(&x, &js("$1ʲː"));
    x = js_re!(r"([bvɣɡdʐznɫlmnprstfxʂ])\1ʲ", "gu").replace(&x, &js("$1ʲː"));
    x = js_re!(r"([bvɣɡdʐznɫlmprstfxʂ])\1(?!ʲ)", "gu").replace(&x, &js("$1ː"));
    normalize(&x, Form::Nfc)
}

/// `eastSlavicNumberWords` as the `NumberComposer` `renderNumber` takes. ⚠ It reads the be table, the only
/// `NumbersDef` this engine passes (`DEF.numbers`).
fn compose(n: u64, _base: &NumbersDef) -> Vec<Word> {
    east_slavic_number_words(n, &DEF.numbers.east)
}

/// `number(digits)`: an unsafe integer is read digit at a time.
fn number(digits: &JsString) -> JsString {
    let n = js_number(digits);
    let base = &DEF.numbers.east.base;
    let word = |w: &str| phonemize_word(&js(w)).to_string_lossy();
    if !is_safe_integer(n) {
        return js(&spell_digits(&digits.to_string_lossy(), base, &word));
    }
    js(&render_number(n as u64, base, &word, compose))
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let cyrillic = r"Ѐ-ӿ";
    JsRegex::new(
        &format!("([{cyrillic}'’ʼ]+)|(\\d+(?:,\\d+)?)|([.?!,;:…—])"),
        "gu",
    )
    .unwrap()
});

/// `SYMBOLS`'s argument, generated from the object literal in belarusian.ts (key order preserved) by recording
/// it through the `symbols` dump and printing `JSON.stringify` of it. `countForm` is attached in code.
const SYMBOL_DATA: &str = r#"{"percent":["працэнт","працэнты","працэнтаў","працэнта"],"currency":{"€":["еўра"],"$":["долар","долары","долараў","долара"],"£":["фунт","фунты","фунтаў","фунта"],"₽":["рубель","рублі","рублёў","рубля"]},"units":{"км":["кіламетр","кіламетры","кіламетраў","кіламетра"],"см":["сантыметр","сантыметры","сантыметраў","сантыметра"],"мм":["міліметр","міліметры","міліметраў","міліметра"],"кг":["кілаграм","кілаграмы","кілаграмаў","кілаграма"],"га":["гектар","гектары","гектараў","гектара"],"ггц":["гігагерц","гігагерцы","гігагерцаў","гігагерца"],"km":["кіламетр","кіламетры","кіламетраў","кіламетра"],"cm":["сантыметр","сантыметры","сантыметраў","сантыметра"],"mm":["міліметр","міліметры","міліметраў","міліметра"],"kg":["кілаграм","кілаграмы","кілаграмаў","кілаграма"]},"unitPer":"на","rateDenominators":{"гадз":"гадзіну","год":"гадзіну","h":"гадзіну","s":"секунду"},"exponentWords":{"squared":["квадратны","квадратныя","квадратных","квадратнага"],"cubed":["кубічны","кубічныя","кубічных","кубічнага"],"position":"before"},"bareExponent":{"squared":"{n} у квадраце"},"multiply":{"times":"на"},"ampersand":"і","magnitudes":["тысячы","тысяч","мільён","мільёна","мільёны","мільёнаў","мільярд","мільярда","мільярды","мільярдаў"]}"#;

/// `(n) => (Number.isInteger(n) ? slavicCountForm(n) : 3)`: a decimal governs the genitive singular.
fn be_count_form(n: f64) -> f64 {
    if n.is_finite() && n.fract() == 0.0 {
        slavic_count_form(n)
    } else {
        3.0
    }
}

/// The Belarusian engine (`createBelarusian`).
pub struct BelarusianPhonemizer {
    symbols: SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `BelarusianPhonemizer` proves the manifest
/// loaded, so none of these can reach a load panic. (The per-module differentials call them.)
impl BelarusianPhonemizer {
    /// `normalizeBelarusian(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_belarusian(text)
    }

    /// `normalizeBelarusianInitialisms(text)`.
    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_belarusian_initialisms(text)
    }

    /// The shared symbol tier, as Belarusian builds it.
    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    /// `isUnreadableBelarusian(word)`.
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        super::normalize::is_unreadable_belarusian(word)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `number(digits)`.
    pub fn number(&self, digits: &JsString) -> JsString {
        number(digits)
    }

    /// `renderNumber(n, DEF.numbers, identity, eastSlavicNumberWords)`: the composer with no g2p.
    pub fn number_words(&self, n: u64) -> JsString {
        js(&render_number(
            n,
            &DEF.numbers.east.base,
            &|w: &str| w.to_string(),
            compose,
        ))
    }

    /// `ROMAN_POLICY.ordinal(n)` (romanOrdinals.ts).
    pub fn roman_ordinal(&self, n: f64) -> Option<JsString> {
        super::roman_ordinals::belarusian_roman_ordinal(n)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let prepared =
            self.symbols
                .apply(&normalize_belarusian_initialisms(&normalize_belarusian(
                    input,
                )));
        let m = &*DEF;
        assemble_clauses(&prepared, &TOKEN, |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(num) = mm.group(2, s).filter(|n| !n.is_empty()) {
                // `m[2].split(",")`: the token holds at most one comma.
                let parts = num.split(&js(","));
                sink.emit(&number(&parts[0]));
                if let Some(frac) = parts.get(1) {
                    sink.emit(&phonemize_word(&js(&m.numbers.decimal_connector)));
                    for dg in frac.code_point_strings() {
                        sink.emit(&number(&dg));
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

impl Engine for BelarusianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(BelarusianPhonemizer::text(self, input))
    }
}

/// `createBelarusian()`. Errors when the manifest cannot be loaded, or the symbol tier refuses its data.
pub fn create_belarusian() -> Result<BelarusianPhonemizer, String> {
    try_manifest()?;
    let mut data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
    data.count_form = Some(Arc::new(be_count_form));
    Ok(BelarusianPhonemizer {
        symbols: make_symbol_normalizer(&data)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // test/belarusian.test.ts's literal `phonemizeWord`, `normalizeBelarusian`, `phonemize(…, "be")` and `.text(…)` pins,
    // extracted from that file mechanically (each is a reading the TS suite asserts), so the two engines are held
    // to one list. `ENGINE_TEXT_PINS` go through `createBelarusian().text` (no registry pre-pass), the registry ones
    // through `phonemize(…, "be")`; the bool says whether the TS trims the result.
    const WORD_PINS: &[(&str, &str)] = &[
        ("вада", "vada"),
        ("галава", "ɣaɫava"),
        ("чалавек", "t͡ʂaɫavʲek"),
        ("яблык", "jabɫɨk"),
        ("Іван", "jivan"),
        ("ён", "jon"),
        ("дзень", "d͡zʲenʲ"),
        ("люблю", "lʲublʲu"),
        ("воўк", "vou̯k"),
        ("ўзяць", "wzʲat͡sʲ"),
        ("сям'я", "sʲamja"),
        ("горад", "ɣorat"),
        ("хлеб", "xlʲep"),
        ("снег", "sʲnʲex"),
        ("везці", "vʲesʲt͡sʲi"),
        ("абразлівы", "abrazʲlʲivɨ"),
        ("нерв", "nʲerv"),
    ];
    const NORM_PINS: &[(&str, &str)] = &[
        ("+28 °C", "плюс 28 градусаў Цэльсія"),
        ("+28 °С", "плюс 28 градусаў Цэльсія"),
        ("74.2 %", "74,2 %"),
        ("81-717.5М", "81 да 717.5М"),
        ("1-ы", "першы"),
        ("4-га", "чацвёртага"),
        ("7-е месца", "сёмае месца"),
        ("30-ай", "трыццатай"),
        ("2000-я гады", "двухтысячныя гады"),
        ("2010-х", "дзве тысячы дзясятых"),
        ("1950-х", "тысяча дзевяцьсот пяцідзясятых"),
        ("з 28-мі краін", "з дваццаці васьмі краін"),
        ("28-гадовы", "28-гадовы"),
        ("1991 г.", "1991 года"),
        ("2014-2016 гг.", "2014 да 2016 гадоў"),
        ("У 438 г. н.э.", "У 438 года нашай эры."),
        ("да н.э.", "да нашай эры."),
        ("Python, Ruby і г.д.", "Python, Ruby і гэтак далей."),
        ("нар. 1920", "нарадзіўся 1920"),
        ("574,8 км/г.", "574,8 кіламетраў на гадзіну."),
        ("552 с.", "552 с."),
        ("БЭ ў 18 т.", "БЭ ў 18 т."),
        ("16 млрд долараў", "16 мільярдаў долараў"),
        ("2,5 млн", "2,5 мільёна"),
        ("3 млн", "3 мільёны"),
        (
            "фунт стэрлінгаў = 100 пенсаў",
            "фунт стэрлінгаў ёсць 100 пенсаў",
        ),
        ("Запісы = Zapisy", "Запісы = Zapisy"),
        ("2 < 5", "2 менш за 5"),
        ("5 > 2", "5 больш за 2"),
        ("(0,28±0,04)", "(0,28 плюс-мінус 0,04)"),
        ("−16 °C", "мінус 16 градусаў Цэльсія"),
        ("10—20 мм", "10 да 20 мм"),
        ("1-3 працоўных дзён", "1 да 3 працоўных дзён"),
        ("1/3", "адна трэцяя"),
        ("2/5", "дзве пятыя"),
        ("673/674", "673/674"),
        ("285/286", "285/286"),
        ("64/67", "64/67"),
        ("10:30", "дзесяць трыццаць"),
        ("23:59", "дваццаць тры пяцьдзесят дзевяць"),
        ("06:00", "шэсць"),
        ("11:12:01", "11 12 01"),
    ];
    const ENGINE_TEXT_PINS: &[(&str, &str, bool)] = &[
        ("0", "nulʲ", true),
        ("5", "pʲat͡sʲ", true),
        ("21", "dvat͡sːat͡sʲ ad͡zʲin", true),
        ("100", "sto", true),
        ("1000", "tɨsʲat͡ʂa", true),
        ("1000", "tɨsʲat͡ʂa", true),
        ("2000", "d͡zʲvʲe tɨsʲat͡ʂɨ", true),
        ("5000", "pʲat͡sʲ tɨsʲat͡ʂ", true),
        ("21000", "dvat͡sːat͡sʲ adna tɨsʲat͡ʂa", true),
        ("1000000", "ad͡zʲin mʲilʲjon", true),
        ("2000000", "dva mʲilʲjonɨ", true),
        ("Мова жыве.", "mova ʐɨvʲe .", false),
        ("3 000 000", "trɨ mʲilʲjonɨ", true),
        ("31 800", "trɨt͡sːat͡sʲ adna tɨsʲat͡ʂa vosʲemsot", true),
        (
            "+28 °C",
            "plʲus dvat͡sːat͡sʲ vosʲem ɣradusau̯ t͡sɛlʲsʲija",
            true,
        ),
        ("5,3 %", "pʲat͡sʲ koska trɨ prat͡sɛnta", true),
        ("12,5 км", "dvanat͡sːat͡sʲ koska pʲat͡sʲ kʲiɫamʲetra", true),
        ("70 %", "sʲemd͡zʲesʲat prat͡sɛntau̯", true),
        ("21 %", "dvat͡sːat͡sʲ ad͡zʲin prat͡sɛnt", true),
        ("22 %", "dvat͡sːat͡sʲ dva prat͡sɛntɨ", true),
        ("$ 300", "trɨsta doɫarau̯", true),
        ("100 кг", "sto kʲiɫaɣramau̯", true),
        ("10 км²", "d͡zʲesʲat͡sʲ kvadratnɨx kʲiɫamʲetrau̯", true),
        ("5²", "pʲat͡sʲ u kvadrat͡sʲe", true),
        (
            "270×18 метраў",
            "d͡zʲvʲesʲt͡sʲe sʲemd͡zʲesʲat na vasʲamnat͡sːat͡sʲ mʲetrau̯",
            true,
        ),
        ("100—200 м.", "sto da d͡zʲvʲesʲt͡sʲe mʲetrau̯ .", true),
        ("ЗША", "zɛ ʂa a", true),
        ("СССР", "ɛs ɛs ɛs ɛr", true),
        ("ВУП", "vɛ u pɛ", true),
    ];
    const REGISTRY_TEXT_PINS: &[(&str, &str, bool)] = &[
        ("XIX ст.", "d͡zʲevʲatnat͡sːataje staɣodː͡zʲa .", true),
        ("XIX стагоддзе", "d͡zʲevʲatnat͡sːataje staɣodː͡zʲe", true),
        ("XX век", "dvat͡sːat͡sʲ vʲek", true),
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        let e = create_belarusian().unwrap();
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
                trim(crate::phonemize(t, "be").unwrap(), *trimmed),
                *want,
                "{t}"
            );
        }
    }

    /// Cyrillic-in-host routing: be has no `HOST_OVERRIDES` entry, so a Cyrillic run its TOKEN does not claim
    /// (outside U+0400–U+04FF) goes to the Russian reader, as in the TS (`ꙗблоко` → `bɫoko`, the ꙗ read by ru as
    /// nothing; values from the TS engine).
    #[test]
    fn an_unclaimed_cyrillic_run_goes_to_russian() {
        assert_eq!(crate::phonemize("ꙗблоко", "be").unwrap(), "bɫoko");
        assert_eq!(
            crate::core::scripts::reader_for(&js("ԑ"), "be").map(|(t, _)| t),
            Some("ru")
        );
    }

    /// test/slavic-port-findings.test.ts, the Belarusian block (#1535).
    #[test]
    fn the_1535_findings_hold() {
        let e = create_belarusian().unwrap();
        for (t, want) in [
            ("гэта \u{1C83}т. слова", "гэта \u{1C83}т. слова"),
            ("гэта \u{1C83}т., слова", "гэта \u{1C83}т., слова"),
            ("гэта \u{1C83}т.", "гэта \u{1C83}т."),
            ("1/2.", "адна другая."),
            ("5/8, і", "пяць восьмых, і"),
            ("29/30.10.1937", "29/30.10.1937"),
            ("кнігі і інш. Потым", "кнігі і іншае. Потым"),
            ("кнігі і г.д. Потым", "кнігі і гэтак далей. Потым"),
            ("Гл. Потым", "глядзі Потым"),
            ("у 1990 г. Потым", "у 1990 года Потым"),
        ] {
            assert_eq!(e.normalize(&js(t)).to_string_lossy(), want, "{t}");
        }
        assert!(
            !crate::phonemize("гэта \u{1C83}т. слова", "be")
                .unwrap()
                .contains("ˌʌndɪfˈaᶦnd")
        );
    }
}
