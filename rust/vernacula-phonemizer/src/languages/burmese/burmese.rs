//! Burmese (my) phonemizer: the syllable scan (medials, rime by coda class, orthographic tone, minor syllables), the
//! voicing and pronunciation lexicons, the DAG segmenter over syllable starts, and text() with its own token loop.
//! Ported from src/languages/burmese/burmese.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::normalize_burmese;
use super::numbers::{number_to_words, spell_digits, try_numbers};
use crate::core::clauses::{ClauseSink, emit_unclaimed};
use crate::core::data_source::load_once;
use crate::core::foreign::ForeignPhonemizer;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};
use crate::core::provenance::{Form, normalize};
use crate::core::segment::{SegWords, load_seg_words, segment_by_dag};
use crate::core::trace::{begin_token, end_token, enter_engine};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/burmese";

/// `BurmeseDef` (burmese.ts).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BurmeseDef {
    pub consonants: IndexMap<String, String>,
    pub independent_vowels: IndexMap<String, String>,
    pub independent_tone: IndexMap<String, String>,
    pub vowel_signs: IndexMap<String, String>,
    pub coda_class: IndexMap<String, String>,
    pub rime_chart: IndexMap<String, IndexMap<String, String>>,
    pub tones: IndexMap<String, String>,
    pub voicing: IndexMap<String, String>,
    pub voiceless: IndexMap<String, String>,
    pub palatal: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
}

pub fn try_def() -> Result<&'static BurmeseDef, String> {
    static D: OnceLock<BurmeseDef> = OnceLock::new();
    load_once(&D, || {
        load_manifest(DIR, "burmese.jsonc").map_err(|e| e.to_string())
    })
}

/// `DEF`, for code reached only through a checked path (`createBurmese` loads it first).
static DEF: LazyLock<&'static BurmeseDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

const VIRAMA: &str = "်";
const STACKER: &str = "္";
const ANUSVARA: &str = "ံ";
const VISARGA: &str = "း";
const DOT_BELOW: &str = "့";
const MEDIAL_Y: &str = "ျ";
const MEDIAL_R: &str = "ြ";
const MEDIAL_W: &str = "ွ";
const MEDIAL_H: &str = "ှ";
const E_SIGN: &str = "ေ";
const AA_SIGN: &str = "ာ";
const AA_TALL: &str = "ါ";
const II_SHORT: &str = "ိ";
const U_SHORT: &str = "ု";

/// A lookup keyed by one code point (a lone surrogate reads as U+FFFD, which is no key).
fn get<'a>(m: &'a IndexMap<String, String>, c: &JsString) -> Option<&'a String> {
    m.get(&c.to_string_lossy())
}

fn is_consonant(c: &JsString) -> bool {
    get(&DEF.consonants, c).is_some()
}

fn eq(c: Option<&JsString>, lit: &str) -> bool {
    c.is_some_and(|c| *c == js(lit))
}

/// `toneLetter(…)`: the orthographic tone, "" for a checked syllable.
#[allow(clippy::too_many_arguments)]
fn tone_letter(
    vowel: &str,
    signs: &[JsString],
    coda: &str,
    checked: bool,
    asat_on_vowel: bool,
    has_visarga: bool,
    has_dot: bool,
) -> JsString {
    if checked {
        return JsString::new();
    }
    let has = |x: &str| signs.iter().any(|s| *s == js(x));
    let cat = if has_visarga {
        "high"
    } else if has_dot {
        "creaky"
    } else if asat_on_vowel || coda != "open" {
        "low"
    } else if vowel == "au" || vowel == "ai" {
        "high"
    } else if vowel == "inherent"
        || vowel == "wu"
        || (has(II_SHORT) && !has(U_SHORT))
        || (has(U_SHORT) && !has(II_SHORT))
    {
        "creaky"
    } else {
        "low"
    };
    js(&DEF.tones[cat])
}

/// One syllable: the onset, the body (glide + rime + tone) and the code-point index where it starts.
#[derive(Debug, Clone)]
pub struct Syllable {
    pub onset: JsString,
    pub body: JsString,
    pub start: usize,
}

/// `syllabify(word)`.
pub fn syllabify(word: &JsString) -> Vec<Syllable> {
    let s = normalize(word, Form::Nfc).code_point_strings();
    let n = s.len();
    let at = |i: usize| s.get(i);
    let mut syls = Vec::new();
    let mut i = 0;
    while i < n {
        let ch = &s[i];
        if let Some(iv) = get(&DEF.independent_vowels, ch) {
            let start = i;
            i += 1;
            let mut cat = get(&DEF.independent_tone, ch).map_or("low", |c| c.as_str());
            while i < n && (eq(at(i), VISARGA) || eq(at(i), DOT_BELOW)) {
                cat = if eq(at(i), VISARGA) { "high" } else { "creaky" };
                i += 1;
            }
            let tone = DEF.tones.get(cat).map_or("", |t| t.as_str());
            syls.push(Syllable {
                onset: JsString::new(),
                body: js(&format!("{iv}{tone}")),
                start,
            });
            continue;
        }
        if !is_consonant(ch) {
            i += 1;
            continue;
        }
        let start = i;
        let mut onset = get(&DEF.consonants, ch).cloned().unwrap();
        i += 1;
        let mut glide = "";
        let (mut w_medial, mut has_palatal, mut has_h) = (false, false, false);
        while i < n
            && [MEDIAL_Y, MEDIAL_R, MEDIAL_W, MEDIAL_H]
                .iter()
                .any(|m| eq(at(i), m))
        {
            if eq(at(i), MEDIAL_Y) || eq(at(i), MEDIAL_R) {
                has_palatal = true;
            } else if eq(at(i), MEDIAL_W) {
                w_medial = true;
            } else if eq(at(i), MEDIAL_H) {
                has_h = true;
            }
            i += 1;
        }
        if has_h {
            onset = DEF.voiceless.get(&onset).cloned().unwrap_or(onset);
        }
        if has_palatal {
            onset = DEF
                .palatal
                .get(&onset)
                .cloned()
                .unwrap_or_else(|| format!("{onset}j"));
        }
        let mut signs: Vec<JsString> = Vec::new();
        while i < n && get(&DEF.vowel_signs, &s[i]).is_some() {
            signs.push(s[i].clone());
            i += 1;
        }
        let has = |x: &str| signs.iter().any(|s| *s == js(x));
        let mut vowel: String = "inherent".into();
        if has(II_SHORT) && has(U_SHORT) {
            vowel = "o".into();
        } else if has(E_SIGN) && (has(AA_SIGN) || has(AA_TALL)) {
            vowel = "au".into();
        } else if let Some(last) = signs.last() {
            vowel = get(&DEF.vowel_signs, last).cloned().unwrap();
        }
        if w_medial && vowel != "inherent" {
            glide = "w";
        }
        let mut coda: String = "open".into();
        let mut asat_on_vowel = false;
        let cons_here = at(i).is_some_and(is_consonant);
        if eq(at(i), ANUSVARA) {
            coda = "anu".into();
            i += 1;
        } else if cons_here
            && (eq(at(i + 1), VIRAMA) || (eq(at(i + 1), DOT_BELOW) && eq(at(i + 2), VIRAMA)))
        {
            coda = get(&DEF.coda_class, &s[i])
                .cloned()
                .unwrap_or_else(|| "t".into());
            i += if eq(at(i + 1), VIRAMA) { 2 } else { 1 };
        } else if cons_here && eq(at(i + 1), STACKER) {
            coda = get(&DEF.coda_class, &s[i])
                .cloned()
                .unwrap_or_else(|| "t".into());
            i += 2;
        } else if eq(at(i), VIRAMA) {
            asat_on_vowel = true;
            i += 1;
        }
        if vowel == "inherent" && (w_medial || onset == "w") {
            if coda == "ng" || coda == "open" {
                if w_medial {
                    glide = "w";
                }
            } else {
                vowel = "wu".into();
            }
        }
        let (mut has_visarga, mut has_dot) = (false, false);
        while i < n
            && !is_consonant(&s[i])
            && get(&DEF.independent_vowels, &s[i]).is_none()
            && get(&DEF.clause_punctuation, &s[i]).is_none_or(|m| m.is_empty())
        {
            if eq(at(i), VISARGA) {
                has_visarga = true;
            } else if eq(at(i), DOT_BELOW) {
                has_dot = true;
            }
            i += 1;
        }
        let minor = vowel == "inherent" && coda == "open" && i < n && is_consonant(&s[i]);
        if minor {
            syls.push(Syllable {
                onset: js(&onset),
                body: js(&format!("{glide}ə")),
                start,
            });
            continue;
        }
        let rime = js(DEF
            .rime_chart
            .get(&coda)
            .and_then(|r| r.get(&vowel))
            .or_else(|| DEF.rime_chart["open"].get(&vowel))
            .map_or("a", |r| r.as_str()));
        let checked = rime.ends_with(&js("ʔ"));
        let tone = tone_letter(
            &vowel,
            &signs,
            &coda,
            checked,
            asat_on_vowel,
            has_visarga,
            has_dot,
        );
        let coda_char = if js_re!(r"[ɴʔ]$", "u").test(&rime) {
            rime.slice(-1, None)
        } else {
            JsString::new()
        };
        let nucleus = if coda_char.is_empty() {
            rime.clone()
        } else {
            rime.slice(0, Some(-(coda_char.len() as isize)))
        };
        syls.push(Syllable {
            onset: js(&onset),
            body: js(glide).concat(&nucleus).concat(&tone).concat(&coda_char),
            start,
        });
    }
    syls
}

fn try_voicing() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static V: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&V, || {
        load_tsv_strings(
            DIR,
            "voicing-lexicon.tsv",
            TsvOptions {
                optional: true,
                ..Default::default()
            },
        )
        .map_err(|e| e.to_string())
    })
}

fn try_dictionary() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static L: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&L, || {
        load_tsv_strings(
            DIR,
            "dictionary.tsv",
            TsvOptions {
                optional: true,
                ..Default::default()
            },
        )
        .map_err(|e| e.to_string())
    })
}

fn try_seg_words() -> Result<&'static SegWords, String> {
    static W: OnceLock<SegWords> = OnceLock::new();
    load_once(&W, || load_seg_words(DIR).map_err(|e| e.to_string()))
}

const CHECKED: &str = "checked by create_burmese";

/// `phonemizeWordRules(word)`: syllabify, voicing sandhi from the per-word flags, NFC.
pub fn phonemize_word_rules(word: &JsString) -> JsString {
    let nfc = normalize(word, Form::Nfc);
    let mut syls = syllabify(&nfc);
    if let Some(flags) = try_voicing()
        .expect(CHECKED)
        .get(&nfc)
        .filter(|f| !f.is_empty())
    {
        for (k, syl) in syls.iter_mut().enumerate().take(flags.len()) {
            if flags.char_code_at(k) == Some(b'1' as u16)
                && let Some(v) = DEF
                    .voicing
                    .get(&syl.onset.to_string_lossy())
                    .filter(|v| !v.is_empty())
            {
                syl.onset = js(v);
            }
        }
    }
    let parts: Vec<JsString> = syls.iter().map(|s| s.onset.concat(&s.body)).collect();
    normalize(&JsString::join(&parts, &JsString::new()), Form::Nfc)
}

/// `phonemizeSubword(word)`: the lexicon override (a blank value falls through), else the rules.
fn phonemize_subword(word: &JsString) -> JsString {
    match try_dictionary()
        .expect(CHECKED)
        .get(&normalize(word, Form::Nfc))
    {
        Some(lex) if !lex.is_empty() => lex.clone(),
        _ => phonemize_word_rules(word),
    }
}

/// `segment(token)`: DAG segmentation over syllable starts, a partial cover kept only when it preserves every
/// syllable body.
pub fn segment(token: &JsString) -> Vec<JsString> {
    let SegWords { set, max_len } = try_seg_words().expect(CHECKED);
    let cs = normalize(token, Form::Nfc).code_point_strings();
    if set.is_empty() || cs.is_empty() {
        return vec![token.clone()];
    }
    let sylls = syllabify(&JsString::join(&cs, &JsString::new()));
    let mut bound: HashSet<usize> = HashSet::from([cs.len()]);
    for syl in &sylls {
        bound.insert(syl.start);
    }
    let parts = segment_by_dag(&cs, set, *max_len, &bound);
    if parts.len() <= 1 || parts.iter().all(|w| set.contains(w)) {
        return parts;
    }
    let sep = js("\u{0001}");
    let whole = JsString::join(
        &sylls.iter().map(|s| s.body.clone()).collect::<Vec<_>>(),
        &sep,
    );
    let split = JsString::join(
        &parts
            .iter()
            .flat_map(|p| syllabify(p).into_iter().map(|s| s.body))
            .collect::<Vec<_>>(),
        &sep,
    );
    if whole == split {
        parts
    } else {
        vec![token.clone()]
    }
}

/// `phonemizeWord(token)`: segment, phonemize each word, space-join the non-empty readings.
pub fn phonemize_word(token: &JsString) -> JsString {
    let words: Vec<JsString> = segment(token)
        .iter()
        .map(phonemize_subword)
        .filter(|w| !w.is_empty())
        .collect();
    JsString::join(&words, &js(" "))
}

/// `TOKEN`: the letter class stops before U+104A so ၊ and ။ reach the clause group.
static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let my_digits = "\u{1040}-\u{1049}";
    JsRegex::new(
        &format!(
            "([\u{1000}-\u{103F}\u{104C}-\u{109F}\u{a9e0}-\u{a9f9}]+)|([0-9{my_digits}]+)|([။၊.?!,])"
        ),
        "gu",
    )
    .unwrap()
});

pub struct BurmesePhonemizer {
    /// Stored and never read, as in the TS (the registry comment: embedded Latin is served by the default
    /// foreign reader instead).
    _foreign: Option<ForeignPhonemizer>,
}

impl BurmesePhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_burmese(text)
    }

    /// `text(rawInput)`: normalize, then the engine's own token loop with the gap pass and explicit trace notes.
    pub fn text(&self, raw_input: &JsString) -> JsString {
        let input = normalize_burmese(raw_input);
        let mut sink = ClauseSink::new();
        enter_engine(&input);
        let mut cursor = 0;
        for m in TOKEN.match_all(&input) {
            if m.index() > cursor {
                emit_unclaimed(
                    &JsString::from_units(&input.0[cursor..m.index()]),
                    &mut sink,
                    cursor,
                );
            }
            cursor = m.end();
            begin_token((m.index(), cursor), &m.value(&input));
            if let Some(w) = m.group(1, &input).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(dg) = m.group(2, &input).filter(|d| !d.is_empty()) {
                let ascii: Vec<u16> = dg
                    .units()
                    .iter()
                    .map(|&u| {
                        if (0x1040..=0x1049).contains(&u) {
                            u - 0x1040 + b'0' as u16
                        } else {
                            u
                        }
                    })
                    .collect();
                let ascii = JsString::from_units(&ascii);
                let n = js_number(&ascii);
                if is_safe_integer(n) && n >= 0.0 {
                    sink.emit(&phonemize_word(&number_to_words(n)));
                } else {
                    for wd in spell_digits(&ascii).split(&js(" ")) {
                        sink.emit(&phonemize_word(&wd));
                    }
                }
            } else if let Some(p) = m.group(3, &input).filter(|p| !p.is_empty())
                && let Some(mk) = DEF
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
            end_token();
        }
        if cursor < input.len() {
            emit_unclaimed(&JsString::from_units(&input.0[cursor..]), &mut sink, cursor);
        }
        sink.finish()
    }
}

impl Engine for BurmesePhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(BurmesePhonemizer::text(self, input))
    }
}

/// `createBurmese(foreign)`. Loads the manifest, the numbers block, both lexicons and the seg-words up front.
pub fn create_burmese(foreign: Option<ForeignPhonemizer>) -> Result<BurmesePhonemizer, String> {
    try_def()?;
    try_numbers()?;
    try_voicing()?;
    try_dictionary()?;
    try_seg_words()?;
    Ok(BurmesePhonemizer { _foreign: foreign })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/burmese.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["မြန်မာ"], Some("mja˨ɴma˨")),
        ("phonemizeWord", &["ဗမာ"], Some("bəma˨")),
        ("phonemizeWord", &["ကျောင်း"], Some("t͡ɕaʊ˥˩ɴ")),
        ("phonemizeWord", &["အိမ်"], Some("ʔeɪ˨ɴ")),
        ("phonemizeWord", &["တစ်"], Some("tɪʔ")),
        ("phonemizeWord", &["ဆရာ"], Some("sʰəja˨")),
        ("phonemizeWord", &["ငြိမ့်"], Some("ɲeɪ˥ˀɴ")),
        ("phonemizeWord", &["လွင်"], Some("lwɪ˨ɴ")),
        ("phonemizeWord", &["ဗုဒ္ဓ"], Some("boʊʔda˥ˀ")),
        ("phonemizeWord", &["မှ"], Some("m̥a˥ˀ")),
        ("phonemizeWord", &["လှ"], Some("l̥a˥ˀ")),
        ("phonemizeWord", &["ကွန်"], Some("kʊ˨ɴ")),
        ("phonemizeWord", &["က"], Some("ka˥ˀ")),
        ("phonemizeWord", &["ကန်"], Some("ka˨ɴ")),
        ("phonemizeWord", &["ကန်း"], Some("ka˥˩ɴ")),
        ("phonemizeWord", &["ကန့်"], Some("ka˥ˀɴ")),
        ("phonemizeWord", &["ကျော်"], Some("t͡ɕɔ˨")),
        ("phonemizeWord", &["မီး"], Some("mi˥˩")),
        ("phonemizeWord", &["ဩ"], Some("ʔɔ˥˩")),
        ("phonemizeWord", &["ဦး"], Some("ʔu˥˩")),
        ("phonemizeWord", &["စကား"], Some("zəɡa˥˩")),
        ("phonemizeWord", &["ဗုဒ္ဓဟူး"], Some("boʊʔdəhu˥˩")),
        ("phonemizeWord", &["ကတော့"], Some("ɡədɔ˥ˀ")),
        ("phonemizeWord", &["လည်"], Some("lɛ˨")),
        ("phonemizeWord", &["ချေး"], Some("t͡ɕʰi˥˩")),
        ("phonemizeWord", &["ဘုရား"], Some("pʰəja˥˩")),
        ("segment[]", &["စကားပြော"], Some("စကား\u{1}ပြော")),
        ("segment[]", &["မြန်မာစကား"], Some("မြန်မာ\u{1}စကား")),
        ("segment[]", &["စကား"], Some("စကား")),
        ("phonemize", &["မြန်မာစကား", "my"], Some("mja˨ɴma˨ zəɡa˥˩")),
        ("phonemize", &["0", "my"], Some("θo˨ʊɴɲa˥ˀ")),
        ("phonemize", &["သုည", "my"], Some("θo˨ʊɴɲa˥ˀ")),
        ("phonemize", &["5", "my"], Some("ŋa˥˩")),
        ("phonemize", &["ငါး", "my"], Some("ŋa˥˩")),
        ("phonemize", &["၅", "my"], Some("ŋa˥˩")),
        ("phonemize", &["၂၅", "my"], Some("n̥ɪʔ sʰɛ˥ˀŋa˥˩")),
        ("phonemize", &["25", "my"], Some("n̥ɪʔ sʰɛ˥ˀŋa˥˩")),
        ("phonemize", &["10", "my"], Some("sʰɛ˨")),
        ("phonemize", &["ဆယ်", "my"], Some("sʰɛ˨")),
        ("phonemize", &["100", "my"], Some("təja˨")),
        ("phonemize", &["တစ်ရာ", "my"], Some("təja˨")),
        ("phonemize", &["1000", "my"], Some("tətʰa˨ʊɴ")),
        ("phonemize", &["တစ်ထောင်", "my"], Some("tətʰa˨ʊɴ")),
        ("phonemize", &["20", "my"], Some("n̥əsʰɛ˨")),
        ("phonemize", &["နှစ်ဆယ်", "my"], Some("n̥əsʰɛ˨")),
        ("phonemize", &["နှစ်ဆယ့်ငါး", "my"], Some("n̥ɪʔ sʰɛ˥ˀŋa˥˩")),
        ("phonemize", &["101", "my"], Some("tɪʔja˥ˀtɪʔ")),
        ("phonemize", &["တစ်ရာ့တစ်", "my"], Some("tɪʔja˥ˀtɪʔ")),
        (
            "phonemize",
            &["12345", "my"],
            Some("tɪʔθaʊ˥˩ɴn̥ɪʔtʰaʊ˥ˀɴθoʊ˥˩ɴja˥ˀle˥˩ sʰɛ˥ˀŋa˥˩"),
        ),
        (
            "phonemize",
            &["တစ်သောင်းနှစ်ထောင့်သုံးရာ့လေးဆယ့်ငါး", "my"],
            Some("tɪʔθaʊ˥˩ɴn̥ɪʔtʰaʊ˥ˀɴθoʊ˥˩ɴja˥ˀle˥˩ sʰɛ˥ˀŋa˥˩"),
        ),
        ("phonemize", &["1000000", "my"], Some("tɪʔθa˥˩ɴ")),
        ("phonemize", &["တစ်သန်း", "my"], Some("tɪʔθa˥˩ɴ")),
        ("phonemize", &["1000000000", "my"], Some("təja˨ ɡəde˨")),
        ("phonemize", &["တစ်ရာကုဋေ", "my"], Some("təja˨ ɡəde˨")),
        ("normalizeBurmese", &["၉၈%"], Some("၉၈ ရာခိုင်နှုန်း")),
        ("normalizeBurmese", &["၅၀,၀၀၀"], Some("၅၀၀၀၀")),
        ("normalizeBurmese", &["၁,၂၃၄,၅၆၇"], Some("၁၂၃၄၅၆၇")),
        ("normalizeBurmese", &["၈၆.၄"], Some("၈၆ ဒသမ ၄")),
        ("normalizeBurmese", &["၈၆.၄၅"], Some("၈၆ ဒသမ ၄ ၅")),
        ("normalizeBurmese", &["၁၄:၃၀"], Some("၁၄ နာရီ ၃၀ မိနစ်")),
        ("normalizeBurmese", &["၃၅°C"], Some("၃၅ ဒီဂရီ စင်တီဂရိတ်")),
        ("normalizeBurmese", &["၈၄°F"], Some("၈၄ ဒီဂရီ ဖာရင်ဟိုက်")),
        ("normalizeBurmese", &["၅၉°"], Some("၅၉ ဒီဂရီ")),
        ("normalizeBurmese", &["$5"], Some("5 ဒေါ်လာ")),
        ("normalizeBurmese", &["€၂၀"], Some("၂၀ ယူရို")),
        ("normalizeBurmese", &["၃/၄"], Some("၄ ပုံ ၃ ပုံ")),
        ("normalizeBurmese", &["၁၉၄၈-၁၉၅၂"], Some("၁၉၄၈ မှ ၁၉၅၂ အထိ")),
        ("normalizeBurmese", &["၂၀-၁-၂၀၂၄"], Some("၂၀-၁-၂၀၂၄")),
        (
            "normalizeBurmese",
            &["ဆီးချိုအမျိုးအစား-၂"],
            Some("ဆီးချိုအမျိုးအစား-၂"),
        ),
        ("normalizeBurmese", &["၁၂ - ၁၃ အထိ"], Some("၁၂ - ၁၃ အထိ")),
        ("normalizeBurmese", &["၁၀ km"], Some("၁၀ ကီလိုမီတာ")),
        ("normalizeBurmese", &["500 mg TDS"], Some("500 မီလီဂရမ် TDS")),
        ("normalizeBurmese", &["Mg Mg"], Some("Mg Mg")),
        (
            "normalizeBurmese",
            &["30 mg/kg"],
            Some("တစ်ကီလိုဂရမ်လျှင် 30 မီလီဂရမ်"),
        ),
        ("normalizeBurmese", &["5 mg/day"], Some("တစ်ရက်လျှင် 5 မီလီဂရမ်")),
        (
            "normalizeBurmese",
            &["0.75 mg/kg BD"],
            Some("တစ်ကီလိုဂရမ်လျှင် 0 ဒသမ 7 5 မီလီဂရမ် BD"),
        ),
        (
            "normalizeBurmese",
            &["10-15 mg/kg QID"],
            Some("တစ်ကီလိုဂရမ်လျှင် 10 မှ 15 အထိ မီလီဂရမ် QID"),
        ),
        (
            "normalizeBurmese",
            &["1.4 ug/kg daily"],
            Some("တစ်ကီလိုဂရမ်လျှင် 1 ဒသမ 4 မိုက်ခရိုဂရမ် daily"),
        ),
        (
            "normalizeBurmese",
            &["×10 −27 kg"],
            Some(" မြှောက် 10 −27 ကီလိုဂရမ်"),
        ),
        ("normalizeBurmese", &["U.S."], Some("US")),
        (
            "phonemize",
            &["မြန်မာနိုင်ငံ။", "my"],
            Some("mja˨ɴma˨ naɪ˨ɴŋa˨ɴ ."),
        ),
        ("normalizeBurmese", &["၃၈၅၀ km²"], Some("၃၈၅၀ စတုရန်းကီလိုမီတာ")),
        ("normalizeBurmese", &["၅ m³"], Some("၅ ကုဗမီတာ")),
        ("normalizeBurmese", &["A&B"], Some("A နှင့် B")),
        (
            "normalizeBurmese",
            &["မြန်မာနိုင်ငံသည် အရှေ့တောင်အာရှတွင် ရှိသည်။"],
            Some("မြန်မာနိုင်ငံသည် အရှေ့တောင်အာရှတွင် ရှိသည်။"),
        ),
        ("segment[]", &["ကစကား"], Some("ကစကား")),
        ("phonemize", &["ကစကား", "my"], Some("kəsəka˥˩")),
        ("segment[]", &["မြန်မာနိုင်ငံ"], Some("မြန်မာ\u{1}နိုင်ငံ")),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(phonemize_word(&a(0))),
                "segment[]" => Some(JsString::join(&segment(&a(0)), &js("\u{1}"))),
                "normalizeBurmese" => Some(normalize_burmese(&a(0))),
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

    /// Every `rewrite` is on the pipeline string: no probe or golden line poisons the mapping (the TS
    /// `tools/provenance-poison.mts my` reports 0 sites as well).
    #[test]
    fn burmese_rewrites_never_poison_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes =
            std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/my.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/my.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "my").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 200);
        assert_eq!(hits.get(), 0);
    }
}
