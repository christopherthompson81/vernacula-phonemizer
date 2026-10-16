//! Indonesian (id) phonemizer: the rule transliterator (digraphs, ⟨e⟩ → schwa, coda ⟨k⟩ → glottal stop,
//! penultimate stress off a schwa), the acronym gate and lexicon, the ⟨e⟩ taling lexicon, the compositional
//! numbers, and text() over words, numbers and punctuation with a foreign reader for diacritic words.
//! Ported from src/languages/indonesian/indonesian.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use super::normalize::normalize_indonesian;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::foreign::ForeignPhonemizer;
use crate::core::initialisms::{PhonotacticsData, make_unreadable_test};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};
use crate::core::normalize_symbols::{
    CountForms, ExponentWords, Multiply, PositionDecl, SymbolData, SymbolNormalizer,
    make_symbol_normalizer,
};
use crate::core::provenance::{Form, normalize};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/indonesian";

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct NumbersDef {
    pub units: Vec<String>,
    pub belas: String,
    pub puluh: String,
    pub ratus: String,
    pub ribu: String,
    pub juta: String,
    pub seprefix: String,
    pub decimal_word: Option<String>,
}

#[derive(Debug, FromJson)]
pub struct Phonotactics {
    pub vowels: String,
    pub onsets: Vec<String>,
    pub codas: Vec<String>,
    pub digraphs: Vec<String>,
}

#[derive(Debug, FromJson)]
pub struct MultiplyDef {
    pub times: String,
    pub by: Option<String>,
}

/// `cubed` is optional, as in the TS interface (#1534): indonesian.jsonc declares `squared` only, so the tier has
/// no cube word.
#[derive(Debug, FromJson)]
pub struct ExponentWordsDef {
    pub squared: CountForms,
    pub cubed: Option<CountForms>,
    pub position: Option<PositionDecl>,
}

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct SymbolTier {
    pub percent: CountForms,
    pub currency: IndexMap<String, CountForms>,
    pub units: IndexMap<String, CountForms>,
    pub magnitudes: Vec<String>,
    pub ampersand: String,
    pub multiply: MultiplyDef,
    pub exponent_words: ExponentWordsDef,
}

/// `IndonesianDef`: indonesian.jsonc. Documentation keys the TS does not read are ignored.
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct IndonesianDef {
    pub digraphs: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub lax_vowels: IndexMap<String, String>,
    pub diphthongs: IndexMap<String, String>,
    pub letter_names: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: NumbersDef,
    pub phonotactics: Phonotactics,
    pub symbol_tier: SymbolTier,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static IndonesianDef, String> {
    static M: OnceLock<IndonesianDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "indonesian.jsonc").map_err(|e| e.to_string())
    })
}

/// The manifest for code reached only through a checked path (an `IndonesianPhonemizer`, whose constructor
/// loads it). ⚠ Crate-private, because touching it unchecked panics.
pub(crate) static DEF: LazyLock<&'static IndonesianDef> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

fn get<'a>(table: &'a IndexMap<String, String>, key: &JsString) -> Option<&'a String> {
    table.get(&key.to_string_lossy())
}

/// A truthy table hit: present and non-empty.
fn truthy<'a>(table: &'a IndexMap<String, String>, key: &JsString) -> Option<&'a String> {
    get(table, key).filter(|v| !v.is_empty())
}

const VOWEL_PH: &str = "aeiouəɛɔɪʊ";

/// `VOWEL_PH.includes(ph[0])` for a non-empty `ph`: its first code UNIT.
fn starts_with_vowel_ph(ph: &JsString) -> bool {
    ph.units()
        .first()
        .is_some_and(|u| VOWEL_PH.encode_utf16().any(|x| x == *u))
}

/// One scanned segment: a consonant or a tense-default vowel (`vowelLetter` is never read past the scan).
#[derive(Clone, Debug)]
pub struct Seg {
    pub ph: JsString,
    pub vowel_letter: JsString,
}

/// `scan(w)`: a lowercased word, by code point, into segments.
fn scan(w: &JsString) -> Vec<Seg> {
    let s = w.code_point_strings();
    let mut segs = Vec::new();
    let mut i = 0;
    while i < s.len() {
        let pair = s[i].concat(s.get(i + 1).unwrap_or(&JsString::new()));
        if let Some(d) = truthy(&DEF.diphthongs, &pair)
            && i + 2 == s.len()
        {
            segs.push(Seg {
                ph: js(d),
                vowel_letter: JsString::new(),
            });
            i += 2;
            continue;
        }
        if let Some(d) = truthy(&DEF.digraphs, &pair) {
            segs.push(Seg {
                ph: js(d),
                vowel_letter: JsString::new(),
            });
            i += 2;
            continue;
        }
        let c = &s[i];
        if "aeiou".encode_utf16().any(|x| c.units() == [x]) {
            segs.push(Seg {
                ph: js(get(&DEF.vowels, c).expect("every vowel letter has a reading")),
                vowel_letter: c.clone(),
            });
        } else if let Some(p) = truthy(&DEF.consonants, c) {
            segs.push(Seg {
                ph: js(p),
                vowel_letter: JsString::new(),
            });
        }
        i += 1;
    }
    segs
}

/// `stressIndex(segs)`: the penultimate nucleus, or the final one when the penult is a schwa.
fn stress_index(segs: &[Seg]) -> Option<usize> {
    let nuclei: Vec<usize> = (0..segs.len())
        .filter(|&i| !segs[i].ph.is_empty() && starts_with_vowel_ph(&segs[i].ph))
        .collect();
    match nuclei.len() {
        0 => None,
        1 => Some(nuclei[0]),
        n => {
            let penult = nuclei[n - 2];
            if segs[penult].ph == js("ə") {
                Some(nuclei[n - 1])
            } else {
                Some(penult)
            }
        }
    }
}

type WordTest = Box<dyn Fn(&JsString) -> bool + Send + Sync>;

/// `isUnreadableIndonesian`.
static IS_UNREADABLE: LazyLock<WordTest> = LazyLock::new(|| {
    let p = &DEF.phonotactics;
    Box::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(&format!("[{}]", p.vowels), "u").unwrap(),
        legal_onsets: p.onsets.iter().map(|o| js(o)).collect(),
        legal_codas: p.codas.iter().map(|c| js(c)).collect(),
        liquids: None,
        digraphs: Some(p.digraphs.iter().map(|d| js(d)).collect()),
    }))
});

const SPELLED_ANYWAY: [&str; 4] = ["as", "rem", "oha", "aol"];

/// `ACRONYM_LEXICON`. Generated from indonesian.ts's Map literal (order preserved).
const ACRONYM_LEXICON: [(&str, &str); 3] = [
    ("unesco", "unˈɛsko"),
    ("covid", "kˈovid"),
    ("acta", "ˈakta"),
];

fn all_caps(word: &JsString) -> bool {
    js_re!(r"^[A-Z]{2,}$").test(word)
}

/// `phonemizeWordRules(word)`: the rule engine only (no ⟨e⟩ lexicon).
pub(crate) fn phonemize_word_rules(word: &JsString) -> JsString {
    if all_caps(word) {
        let low = word.to_lower_case();
        if let Some((_, lex)) = ACRONYM_LEXICON.iter().find(|(k, _)| js(k) == low) {
            return js(lex);
        }
        if SPELLED_ANYWAY.iter().any(|k| js(k) == low) || IS_UNREADABLE(&low) {
            let mut out = JsString::new();
            for c in low.code_point_strings() {
                if let Some(n) = get(&DEF.letter_names, &c) {
                    out.push_str(&js(n));
                }
            }
            return out;
        }
    }
    let mut segs = scan(&word.to_lower_case());
    if segs.is_empty() {
        return JsString::new();
    }
    for i in 0..segs.len() {
        if segs[i].ph != js("k") {
            continue;
        }
        let coda = match segs.get(i + 1) {
            None => true,
            Some(next) => !next.ph.is_empty() && !starts_with_vowel_ph(&next.ph),
        };
        if coda {
            segs[i].ph = js("ʔ");
        }
    }
    let stress = stress_index(&segs);
    let mut out = JsString::new();
    for (i, s) in segs.iter().enumerate() {
        if Some(i) == stress {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&s.ph);
    }
    normalize(&out, Form::Nfc)
}

fn try_lexicon() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static L: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&L, || {
        load_tsv_strings(
            DIR,
            "indonesian-e-lexicon.tsv",
            TsvOptions {
                optional: true,
                ..Default::default()
            },
        )
        .map_err(|e| e.to_string())
    })
}

/// `phonemizeWord(word)`: the ⟨e⟩ lexicon (not for an all-caps run), else the rules.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    if !all_caps(word) {
        let lex = try_lexicon().unwrap_or_else(|e| panic!("{e}"));
        if let Some(hit) = lex.get(&word.to_lower_case()) {
            return hit.clone();
        }
    }
    phonemize_word_rules(word)
}

/// `numberWords(n)`: a non-negative integer → Indonesian words.
pub(crate) fn number_words(n: u64) -> String {
    let num = &DEF.numbers;
    let tail = |r: u64| {
        if r != 0 {
            format!(" {}", number_words(r))
        } else {
            String::new()
        }
    };
    if n < 10 {
        return num.units[n as usize].clone();
    }
    if n < 12 {
        return if n == 10 {
            format!("{}{}", num.seprefix, num.puluh)
        } else {
            format!("{}{}", num.seprefix, num.belas)
        };
    }
    if n < 20 {
        return format!("{} {}", num.units[(n - 10) as usize], num.belas);
    }
    if n < 100 {
        return format!(
            "{} {}{}",
            num.units[(n / 10) as usize],
            num.puluh,
            tail(n % 10)
        );
    }
    if n < 200 {
        return format!("{}{}{}", num.seprefix, num.ratus, tail(n % 100));
    }
    if n < 1000 {
        return format!(
            "{} {}{}",
            num.units[(n / 100) as usize],
            num.ratus,
            tail(n % 100)
        );
    }
    if n < 2000 {
        return format!("{}{}{}", num.seprefix, num.ribu, tail(n % 1000));
    }
    if n < 1_000_000 {
        return format!("{} {}{}", number_words(n / 1000), num.ribu, tail(n % 1000));
    }
    format!(
        "{} {}{}",
        number_words(n / 1_000_000),
        num.juta,
        tail(n % 1_000_000)
    )
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        r"(\p{Script=Latin}[\p{Script=Latin}\p{M}]*)|([1-9]\d{0,2}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)|([.?!,;:])",
        "gu",
    )
    .unwrap()
});

/// The Indonesian engine (`createIndonesian`).
pub struct IndonesianPhonemizer {
    foreign: Option<ForeignPhonemizer>,
    symbols: SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding an `IndonesianPhonemizer` proves the manifest and
/// the lexicon loaded. (The per-module differentials call them.)
impl IndonesianPhonemizer {
    /// `normalizeIndonesian(text)` (normalize.ts).
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_indonesian(text)
    }

    /// The shared symbol tier, as Indonesian builds it.
    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `phonemizeWordRules(word)`.
    pub fn phonemize_word_rules(&self, word: &JsString) -> JsString {
        phonemize_word_rules(word)
    }

    /// `isUnreadableIndonesian(word)`.
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        IS_UNREADABLE(word)
    }

    /// `numberWords(n)`.
    pub fn number_words(&self, n: u64) -> String {
        number_words(n)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self.symbols.apply(&normalize_indonesian(input));
        let rules_all = |n: f64, sink: &mut crate::core::clauses::ClauseSink| {
            for wd in number_words(n as u64).split(' ') {
                sink.emit(&phonemize_word_rules(&js(wd)));
            }
        };
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                let native = js_re!(r"^[a-zA-Z]+$", "u").test(&w);
                match &self.foreign {
                    Some(f) if !native => sink.emit(&f(&w)),
                    _ => sink.emit(&phonemize_word(&w)),
                }
            } else if let Some(raw) = m.group(2, s).filter(|r| !r.is_empty()) {
                let stripped = js_re!(r"\.", "gu").replace(&raw, &JsString::new());
                let parts = stripped.split(&js(","));
                let int_part = &parts[0];
                let n = js_number(int_part);
                // ⚠ Above 2^53 the integer reads digit by digit (the float has lost the low digits).
                if is_safe_integer(n) {
                    rules_all(n, sink);
                } else {
                    for d in int_part.code_point_strings() {
                        rules_all(js_number(&d), sink);
                    }
                }
                if let Some(frac) = parts.get(1).filter(|f| !f.is_empty()) {
                    if let Some(dot) = DEF.numbers.decimal_word.as_ref().filter(|d| !d.is_empty()) {
                        sink.emit(&phonemize_word_rules(&js(dot)));
                    }
                    for d in frac.code_point_strings() {
                        rules_all(js_number(&d), sink);
                    }
                }
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) = truthy(&DEF.clause_punctuation, &p)
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for IndonesianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(IndonesianPhonemizer::text(self, input))
    }
}

/// `createIndonesian(foreign)`. Errors when the manifest or the lexicon cannot be loaded, or the symbol tier
/// refuses its data.
pub fn create_indonesian(
    foreign: Option<ForeignPhonemizer>,
) -> Result<IndonesianPhonemizer, String> {
    let d = try_manifest()?;
    try_lexicon()?;
    let st = &d.symbol_tier;
    let symbols = make_symbol_normalizer(&SymbolData {
        percent: Some(st.percent.clone()),
        currency: Some(st.currency.clone()),
        units: Some(st.units.clone()),
        exponent_words: Some(ExponentWords {
            squared: Some(st.exponent_words.squared.clone()),
            cubed: st.exponent_words.cubed.clone(),
            position: st.exponent_words.position.clone(),
        }),
        magnitudes: Some(st.magnitudes.clone()),
        ampersand: Some(st.ampersand.clone()),
        multiply: Some(Multiply {
            times: st.multiply.times.clone(),
            by: st.multiply.by.clone(),
        }),
        ..Default::default()
    })?;
    Ok(IndonesianPhonemizer { foreign, symbols })
}

#[cfg(all(test, feature = "id"))]
mod tests {
    use super::*;

    // test/indonesian.test.ts's literal pins, extracted from that file mechanically (.probe/pins.mjs evaluates
    // each string literal; no reading was typed by hand), so the two engines are held to one list.
    const PHONEMIZEWORD_1_PINS: &[(&str, &str)] = &[
        ("DPK", "depeka"),
        ("AKP", "akape"),
        ("absen", "ˈabsen"),
        ("ablepsia", "ablɛpsˈia"),
        ("abonemen", "abonəmˈɛn"),
        ("sekolah", "səkˈolah"),
        ("makan", "mˈakan"),
        ("dengan", "dəŋˈan"),
        ("kecil", "kət͡ʃˈil"),
        ("banyak", "bˈaɲaʔ"),
        ("tidak", "tˈidaʔ"),
        ("belajar", "bəlˈad͡ʒar"),
        ("sekolah", "səkˈolah"),
    ];
    const PHONEMIZEWORDRULES_1_PINS: &[(&str, &str)] = &[("absen", "ˈabsən")];
    const PHONEMIZE_2_PINS: &[(&str, &str, &str)] = &[
        ("6", "id", "ənˈam"),
        ("21", "id", "dˈua pˈuluh sˈatu"),
        ("9.000 orang", "id", "səmbˈilan rˈibu ˈoraŋ"),
        ("1.000", "id", "sərˈibu"),
        ("1,5 meter", "id", "sˈatu kˈoma lˈima mɛtˈər"),
        (
            "Ini kalimat. Kedua, benar?",
            "id",
            "ˈini kalˈimat . kədˈua , bənˈar ?",
        ),
        ("pukul 11.00", "id", "pˈukul səbəlˈas"),
        ("08.46", "id", "dəlˈapan lewˈat əmpˈat pˈuluh ənˈam"),
        ("kosmonot No. 11", "id", "kosmˈonot nˈomor səbəlˈas"),
        ("Dr. Budi", "id", "dˈoʔtər bˈudi"),
        ("dll.", "id", "dˈan lˈain lˈain ."),
        ("Rp 50.000", "id", "lˈima pˈuluh rˈibu rupˈiah"),
        ("3%", "id", "tˈiɡa pərsˈɛn"),
        ("30 km", "id", "tˈiɡa pˈuluh kilomətˈər"),
        (
            "120 km/jam",
            "id",
            "sərˈatus dˈua pˈuluh kilomətˈər pˈɛr d͡ʒˈam",
        ),
        ("20 °C", "id", "dˈua pˈuluh dərˈad͡ʒat t͡ʃəlsˈius"),
        ("abad ke-16", "id", "ˈabad kˈə ənˈam bəlˈas"),
        ("PBB", "id", "pebebe"),
        ("Perang Dunia II", "id", "pərˈaŋ dunˈia dˈua"),
        ("1/5", "id", "sˈatu pˈɛr lˈima"),
        ("-5 derajat", "id", "mˈinus lˈima dərˈad͡ʒat"),
        ("makan nasi goreng", "id", "mˈakan nˈasi ɡˈoreŋ"),
        ("UNESCO", "id", "unˈɛsko"),
        ("COVID", "id", "kˈovid"),
        ("ACTA", "id", "ˈakta"),
        ("NATO", "id", "nˈato"),
        ("ASEAN", "id", "asəˈan"),
        ("NATO", "ms", "nˈato"),
        ("TV", "id", "tefe"),
        ("DVD", "id", "defede"),
        ("GPS", "id", "ɡepeɛs"),
        ("PBB", "id", "pebebe"),
        ("BBM", "id", "bebeɛm"),
        ("AS", "id", "aɛs"),
        ("REM", "id", "ɛreɛm"),
    ];
    const CONTAINS_PINS: &[(&str, &str, &str)] = &[
        ("saya makan.", "id", "mˈakan"),
        ("783.562 km²", "id", "kilomətˈər pərsəɡˈi"),
        ("10 miliar euro (US$ 14,7 miliar) per tahun", "id", "dˈolar"),
        (
            "10 miliar euro (US$ 14,7 miliar) per tahun",
            "id",
            "milˈiar dˈolar",
        ),
        ("biaya US $30", "id", "dˈolar"),
        ("di timur 35°W", "id", "dərˈad͡ʒat bˈarat"),
        ("di timur 35Â°W", "id", "dərˈad͡ʒat bˈarat"),
        ("suhu di atas 30°C", "id", "dərˈad͡ʒat t͡ʃəlsˈius"),
        ("250 tahun kemudian", "id", "dˈua rˈatus lˈima pˈuluh"),
    ];
    const NOTCONTAINS_PINS: &[(&str, &str, &str)] = &[
        ("1:09.02 menit", "id", "lewˈat"),
        (
            "10 miliar euro (US$ 14,7 miliar) per tahun",
            "id",
            "dˈolar milˈiar",
        ),
        ("Cañitas", "id", "t͡ʃaˈitas"),
    ];
    const REL_PINS: &[(&str, &str, &str, &str)] = &[
        ("Cañitas", "id", "Cañitas", "en"),
        ("Klöcker", "id", "Klöcker", "en"),
        ("São", "id", "São", "en"),
        ("Cañitas", "ms", "Cañitas", "id"),
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        create_indonesian(None).unwrap();
        let say = |t: &str, l: &str| crate::phonemize(t, l).unwrap();
        for (w, want) in PHONEMIZEWORD_1_PINS {
            assert_eq!(phonemize_word(&js(w)).to_string_lossy(), *want, "{w}");
        }
        for (w, want) in PHONEMIZEWORDRULES_1_PINS {
            assert_eq!(phonemize_word_rules(&js(w)).to_string_lossy(), *want, "{w}");
        }
        for (t, l, want) in PHONEMIZE_2_PINS {
            assert_eq!(say(t, l), *want, "{t}");
        }
        for (t, l, part) in CONTAINS_PINS {
            assert!(say(t, l).contains(part), "{t}");
        }
        for (t, l, part) in NOTCONTAINS_PINS {
            assert!(!say(t, l).contains(part), "{t}");
        }
        for (t, l, t2, l2) in REL_PINS {
            assert_eq!(say(t, l), say(t2, l2), "{t}");
        }
        // "an ordinary word in caps reads as that word": the test's own word list, as a relation.
        for w in ["RUMAH", "YANG", "BESAR", "DENGAN"] {
            assert_eq!(say(w, "id"), say(&w.to_lowercase(), "id"), "{w}");
        }
    }

    /// test/malayic-philippine-1534.test.ts, the id and ms rows: relational, never typed IPA.
    #[test]
    fn the_1534_findings_are_fixed() {
        create_indonesian(None).unwrap();
        let say = |t: &str, l: &str| crate::phonemize(t, l).unwrap();
        for (a, b) in [
            ("1.000,5", "1000,5"),
            ("Rp 1.000,50", "Rp 1000,50"),
            ("1.000.000,25 orang", "1000000,25 orang"),
            ("1.000, dan", "1000, dan"),
        ] {
            assert_eq!(say(a, "id"), say(b, "id"), "{a}");
        }
        assert_eq!(say("skor 21:20", "id"), say("skor 21, 20", "id"));
        assert!(!say("skor 21:20", "id").contains("lewˈat"));
        for t in [
            "pukul 21:20",
            "Pukul 9:30",
            "jam 9:30 pagi",
            "21:20 WIB",
            "pukul 8.46",
            "8.46",
        ] {
            assert!(say(t, "id").contains("lewˈat"), "{t}");
        }
        assert_eq!(say("yuran US$30", "ms"), say("yuran $30", "ms"));
        assert_eq!(say("yuran US $30", "ms"), say("yuran $30", "ms"));
        assert_eq!(
            crate::languages::malay::normalize::normalize_malay(&js("yuran AS$30")),
            js("yuran AS $30")
        );
        assert_eq!(say("12.345.678 orang", "ms"), say("12345678 orang", "ms"));
        assert!(say("3.141", "ms").contains("pərpulˈuhan"));
    }
}
