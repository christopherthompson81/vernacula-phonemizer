//! Ilocano / Iloko (ilo) phonemizer: the rule transliterator (trigraphs, digraphs, the high-vowel gliding hiatus,
//! glottal stops at onset and in non-high hiatus), penultimate stress, the pronunciation lexicon, native numbers,
//! and text() over words, numbers and punctuation. Ported from src/languages/ilocano/ilocano.ts — see that file
//! for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use super::normalize::{normalize_ilocano, try_symbols};
use super::numbers::{number_to_words, try_numbers};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/ilocano";

/// `IlocanoDef`: ilocano.jsonc (declared in ilocano.ts). `numbers` is numbers.ts's own load.
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct IlocanoDef {
    pub digraphs: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
}

pub fn try_manifest() -> Result<&'static IlocanoDef, String> {
    static M: OnceLock<IlocanoDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "ilocano.jsonc").map_err(|e| e.to_string())
    })
}

/// ⚠ Reached only through an `IlocanoPhonemizer` (whose constructor loads it).
static DEF: LazyLock<&'static IlocanoDef> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

fn try_lexicon() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static L: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&L, || {
        load_tsv_strings(DIR, "ilo-lexicon.tsv", TsvOptions::default()).map_err(|e| e.to_string())
    })
}

/// `"aeiou".includes(c)` for one code point.
fn is_vowel_letter(c: &JsString) -> bool {
    c.len() == 1 && "aeiou".encode_utf16().any(|x| x == c.units()[0])
}

/// `prev !== undefined && VOWEL_PH.includes(prev[0])` with `VOWEL_PH = "aeiouɛ"`: the first code UNIT.
fn is_nucleus(u: &JsString) -> bool {
    u.units()
        .first()
        .is_some_and(|&x| "aeiouɛ".encode_utf16().any(|v| v == x))
}

/// `splitNucleus(ipa)` (#1534): a trigraph's IPA as separate consonant and vowel units when it ends in a vowel, so
/// stress and the hiatus test see the vowel.
fn split_nucleus(ipa: &str) -> Vec<JsString> {
    let u = js(ipa);
    let n = u.len();
    if n > 1 && is_nucleus(&u.substring(n - 1, None)) {
        vec![u.substring(0, Some(n - 1)), u.substring(n - 1, None)]
    } else {
        vec![u]
    }
}

fn table(t: &'static IndexMap<String, String>, k: &JsString) -> Option<&'static String> {
    t.get(&k.to_string_lossy()).filter(|v| !v.is_empty())
}

/// `scan(w)`: a lowercased word → IPA units. A high vowel before a vowel (and not after one) is a glide.
fn scan(w: &JsString) -> Vec<JsString> {
    let s = w.code_point_strings();
    let empty = JsString::new();
    let at = |j: usize| s.get(j).unwrap_or(&empty);
    let mut out: Vec<JsString> = Vec::new();
    let mut i = 0;
    while i < s.len() {
        let c = &s[i];
        if *c == js("-") || *c == js("‑") {
            if !out.is_empty() && i + 1 < s.len() {
                out.push(js("ʔ"));
            }
        } else if let Some(t) = table(&DEF.digraphs, &c.concat(at(i + 1)).concat(at(i + 2))) {
            out.extend(split_nucleus(t));
            i += 2;
        } else if let Some(d) = table(&DEF.digraphs, &c.concat(at(i + 1))) {
            out.push(js(d));
            i += 1;
        } else if is_vowel_letter(c) {
            let next_is_vowel = i + 1 < s.len() && is_vowel_letter(&s[i + 1]);
            let prev_is_vowel = out.last().is_some_and(is_nucleus);
            if (*c == js("i") || *c == js("u")) && next_is_vowel && !prev_is_vowel {
                out.push(js(if *c == js("i") { "j" } else { "w" }));
            } else {
                if out.is_empty() || prev_is_vowel {
                    out.push(js("ʔ"));
                }
                out.push(js(DEF
                    .vowels
                    .get(&c.to_string_lossy())
                    .expect("every vowel letter has a reading")));
            }
        } else if let Some(p) = table(&DEF.consonants, c) {
            out.push(js(p));
        }
        i += 1;
    }
    out
}

/// `stressed(units)`: the penultimate nucleus.
fn stressed(units: &[JsString]) -> JsString {
    let nuclei: Vec<usize> = (0..units.len())
        .filter(|&i| is_nucleus(&units[i]))
        .collect();
    if nuclei.is_empty() {
        return JsString::join(units, &JsString::new());
    }
    let idx = nuclei[nuclei.len().saturating_sub(2)];
    let mut out = JsString::new();
    for (i, u) in units.iter().enumerate() {
        if i == idx {
            out.push_str(&js("ˈ"));
        }
        out.push_str(u);
    }
    out
}

/// `phonemizeWordRules(word)`: the rule g2p only.
pub(crate) fn phonemize_word_rules(word: &JsString) -> JsString {
    let units = scan(&word.to_lower_case());
    if units.is_empty() {
        return JsString::new();
    }
    normalize(&stressed(&units), Form::Nfc)
}

/// `phonemizeWord(word)`: the lexicon (keyed on the NFC lowercase), else the rules.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let lex = try_lexicon().unwrap_or_else(|e| panic!("{e}"));
    match lex.get(&normalize(&word.to_lower_case(), Form::Nfc)) {
        Some(hit) => hit.clone(),
        None => phonemize_word_rules(word),
    }
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"({})|(\d+)|([.?!,;:])",
            host_word_run(&["Latin"], "'ʼ-", "").unwrap()
        ),
        "giu",
    )
    .unwrap()
});

const NATIVE_CLASS: &str = "[a-zñ'ʼ-]";
type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "iu")));

/// The Ilocano engine (`createIlocano`).
pub struct IlocanoPhonemizer;

impl IlocanoPhonemizer {
    /// `normalizeIlocano(text)` (normalize.ts).
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_ilocano(text)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `phonemizeWordRules(word)`.
    pub fn phonemize_word_rules(&self, word: &JsString) -> JsString {
        phonemize_word_rules(word)
    }

    /// `numberToWords(n, raw)` (numbers.ts).
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        assemble_clauses(&normalize_ilocano(input), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                for wd in number_to_words(js_number(&d), Some(&d)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) = table(&DEF.clause_punctuation, &p)
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for IlocanoPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(IlocanoPhonemizer::text(self, input))
    }
}

/// `createIlocano()`. Errors when the manifest or the lexicon cannot be loaded, or the tier refuses its data.
pub fn create_ilocano() -> Result<IlocanoPhonemizer, String> {
    try_manifest()?;
    try_numbers()?;
    try_lexicon()?;
    try_symbols()?;
    Ok(IlocanoPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // test/ilocano.test.ts's literal pins, extracted from that file mechanically (.probe/pins.mjs evaluates
    // each string literal; no reading was typed by hand), so the two engines are held to one list.
    const PHONEMIZEWORDRULES_1_PINS: &[(&str, &str)] = &[
        ("dua", "dwˈa"),
        ("radio", "ɾˈadjo"),
        ("dies", "djˈɛs"),
        ("tao", "tˈaʔo"),
        ("naimbag", "naʔˈimbaɡ"),
        ("agtutubo", "ʔaɡtutˈubo"),
    ];
    const PHONEMIZEWORD_1_PINS: &[(&str, &str)] = &[
        ("garcia", "ɡaɾsˈia"),
        ("kua", "kuˈa"),
        ("biblioteka", "bibliotˈɛka"),
    ];
    const SAY_N_PINS: &[(f64, &str)] = &[
        (0.0, "sˈɛɾo"),
        (5.0, "lˈima"),
        (20.0, "dwapˈulo"),
        (40.0, "ʔˈuppat ʔˈa pˈulo"),
        (11.0, "saŋapˈulo kˈɛt mˈajsa"),
        (25.0, "dwapˈulo kˈɛt lˈima"),
        (99.0, "sjˈam ʔˈa pˈulo kˈɛt sjˈam"),
        (100.0, "saŋaɡˈasut"),
        (101.0, "saŋaɡˈasut kˈɛt mˈajsa"),
        (555.0, "limaɡˈasut kˈɛt limapˈulo kˈɛt lˈima"),
        (1000.0, "saŋaɾˈibo"),
        (1000000.0, "saŋaɾˈiwɾiw"),
    ];
    const SAY_PINS: &[(&str, &str)] = &[
        (
            "populasion iti 822,352",
            "populˈasjon ʔˈiti waloɡˈasut kˈɛt dwapˈulo kˈɛt dwˈa ʔˈa ɾˈibo kˈɛt talloɡˈasut kˈɛt limapˈulo kˈɛt dwˈa",
        ),
        (
            "May 302.18 kilometro",
            "mˈaj talloɡˈasut kˈɛt dwˈa pˈunto mˈajsa wˈalo kilomˈɛtɾo",
        ),
        (
            "1,497.70 kuadrado kilometro",
            "saŋaɾˈibo kˈɛt ʔˈuppat ʔˈa ɡasˈut kˈɛt sjˈam ʔˈa pˈulo kˈɛt pˈito pˈunto pˈito sˈɛɾo kwadɾˈado kilomˈɛtɾo",
        ),
        (
            "aggibus iti 0,1,8,9",
            "ʔaɡɡˈibus ʔˈiti sˈɛɾo , mˈajsa , wˈalo , sjˈam",
        ),
        ("manipud iti 6:00 AM", "manˈipud ʔˈiti ʔinnˈɛm ʔˈam"),
        (
            "iti 8:16 ti agsapa",
            "ʔˈiti wˈalo kˈɛt saŋapˈulo kˈɛt ʔinnˈɛm tˈi ʔaɡsˈapa",
        ),
        (
            "iti oras a 6:30 aginggana",
            "ʔˈiti ʔˈoɾas ʔˈa ʔinnˈɛm kˈɛt tallopˈulo ʔaɡiŋɡˈana",
        ),
        ("Ti UTC+08:00 ket", "tˈi ʔˈutk wˈalo , sˈɛɾo kˈɛt"),
        (
            "naibasar iti Juan 13:21",
            "naʔibˈasaɾ ʔˈiti hwˈan saŋapˈulo kˈɛt tˈallo , dwapˈulo kˈɛt mˈajsa",
        ),
        ("ti ratio ket 5:8", "tˈi ɾˈatjo kˈɛt lˈima , wˈalo"),
        (
            "mangbukel iti 11.60%",
            "maŋbˈukɛl ʔˈiti saŋapˈulo kˈɛt mˈajsa pˈunto ʔinnˈɛm sˈɛɾo poɾsjˈɛnto",
        ),
        (
            "nalako iti US$53.9 milion",
            "nalˈako ʔˈiti limapˈulo kˈɛt tˈallo pˈunto sjˈam mˈiljon dˈoljaɾ tˈi ʔɛstˈados ʔunˈidos",
        ),
        ("bayad iti ₱50", "bˈajad ʔˈiti limapˈulo pˈisos"),
        (
            "ngem €890 bilion",
            "ŋˈɛm waloɡˈasut kˈɛt sjˈam ʔˈa pˈulo bˈiljon ʔɛʔˈuɾo",
        ),
        ("tangdan a £200", "tˈaŋdan ʔˈa dwaɡˈasut lˈibɾa ʔɛstɛɾlˈina"),
        (
            "iti lugar ti 636 km²",
            "ʔˈiti lˈuɡaɾ tˈi ʔinnˈɛm ʔˈa ɡasˈut kˈɛt tallopˈulo kˈɛt ʔinnˈɛm kwadɾˈado kilomˈɛtɾo",
        ),
        ("1,000 kubiko metro", "saŋaɾˈibo kubˈiko mˈɛtɾo"),
        (
            "adda ti 250 ml ken 3 mi ken 5 kg ken 100 mm ken 20 cm",
            "addˈa tˈi dwaɡˈasut kˈɛt limapˈulo mililˈitɾo kˈɛn tˈallo mˈilja kˈɛn lˈima kiloɡɾˈamo kˈɛn saŋaɡˈasut milimˈɛtɾo kˈɛn dwapˈulo sɛntimˈɛtɾo",
        ),
        (
            "5 km/s ken 60 mph",
            "lˈima kilomˈɛtɾo kˈada sɛɡˈundo kˈɛn ʔinnˈɛm ʔˈa pˈulo mˈilja kˈada ʔˈoɾas",
        ),
        ("Luna & Balaoan", "lˈuna kˈɛn balaʔˈoʔan"),
        (
            "12.70 a tattao tunggal maysa a km²",
            "saŋapˈulo kˈɛt dwˈa pˈunto pˈito sˈɛɾo ʔˈa tattˈaʔo tˈuŋɡal mˈajsa ʔˈa kwadɾˈado kilomˈɛtɾo",
        ),
        (
            "iti tunggal kuadrado kilometro",
            "ʔˈiti tˈuŋɡal kwadɾˈado kilomˈɛtɾo",
        ),
        (
            "panagpangato a 12 h 49 m",
            "panaɡpaŋˈato ʔˈa saŋapˈulo kˈɛt dwˈa ʔˈoɾas ʔˈuppat ʔˈa pˈulo kˈɛt sjˈam minˈuto",
        ),
        (
            "Dagiti 40-45 a rancheria",
            "daɡˈiti ʔˈuppat ʔˈa pˈulo ʔaɡiŋɡˈana ʔˈiti ʔˈuppat ʔˈa pˈulo kˈɛt lˈima ʔˈa ɾankhˈɛɾja",
        ),
        (
            "manipud 15 aginggana iti 64",
            "manˈipud saŋapˈulo kˈɛt lˈima ʔaɡiŋɡˈana ʔˈiti ʔinnˈɛm ʔˈa pˈulo kˈɛt ʔˈuppat",
        ),
        (
            "0.25–0.33 pulgada",
            "sˈɛɾo pˈunto dwˈa lˈima ʔaɡiŋɡˈana ʔˈiti sˈɛɾo pˈunto tˈallo tˈallo pulɡˈada",
        ),
        (
            "idi maika-19 a siglo",
            "ʔˈidi maʔˈika saŋapˈulo kˈɛt sjˈam ʔˈa sˈiɡlo",
        ),
        (
            "temperatura ti −224 °C",
            "tɛmpɛɾatˈuɾa tˈi nɛɡatˈibo dwaɡˈasut kˈɛt dwapˈulo kˈɛt ʔˈuppat ɡɾˈado kˈɛlsjus",
        ),
        (
            "−129 °F",
            "nɛɡatˈibo saŋaɡˈasut kˈɛt dwapˈulo kˈɛt sjˈam ɡɾˈado pahɾɛnhˈɛʔit",
        ),
        (
            "iti 16°Am 26'",
            "ʔˈiti saŋapˈulo kˈɛt ʔinnˈɛm ɡɾˈado ʔˈam dwapˈulo kˈɛt ʔinnˈɛm ʔ",
        ),
        (
            "ti 47.8°",
            "tˈi ʔˈuppat ʔˈa pˈulo kˈɛt pˈito pˈunto wˈalo ɡɾˈado",
        ),
        ("Bilin Blng. 1", "bˈilin bˈilaŋ mˈajsa"),
        (
            "Dr. Jose Rizal ken Ramon Mitra, Sr.",
            "dˈoktoɾ hˈosɛ ɾˈisal kˈɛn ɾˈamon mˈitɾa , sˈɛnjoɾ",
        ),
        (
            "Mathew, S. P. and C. R. Chitra",
            "mˈathɛw , s . p . ʔˈand k . ɾ . khˈitɾa",
        ),
        ("Bilin ſr. 1", "bˈilin ɾ . mˈajsa"),
        ("iti 3/4 ti kalawa", "ʔˈiti tˈallo ʔˈuppat tˈi kalˈawa"),
    ];
    const NORMALIZEILOCANO_1_PINS: &[(&str, &str)] = &[
        ("3.5–3.8 bilion", "3 punto 5 aginggana iti 3 punto 8 bilion"),
        ("Iti 676,578 km²", "Iti 676578 kuadrado kilometro"),
        (
            "ti 12.5 km ken 802.11m",
            "ti 12 punto 5 kilometro ken 802 punto 1 1m",
        ),
    ];
    const CONTAINS_PINS: &[(&str, &str)] = &[
        ("20,320 pié ken 35,797 ft", "pjˈɛ kˈɛn"),
        ("agsobra nga 3.7 m", "mˈɛtɾo"),
        ("ni Theophrastus (c. 371 BC)", "ʔaɡˈaɾup ʔˈa talloɡˈasut"),
        ("ti kaadayuna 3 a bilion km", "bˈiljon kilomˈɛtɾo"),
    ];
    const NOTCONTAINS_PINS: &[(&str, &str)] = &[("Ti UTC+08:00 ket", "kˈɛt wˈalo kˈɛt")];
    const REL_PINS: &[(&str, &str)] = &[("zzqx", "zzqx")];

    #[test]
    fn the_ts_suite_pins_hold() {
        let ilo = create_ilocano().unwrap();
        // The suite's `say`: `createIlocano().text(s).trim()` (a number goes through `String(n)`).
        let say = |t: &str| ilo.text(&js(t)).trim().to_string_lossy();
        for (w, want) in PHONEMIZEWORDRULES_1_PINS {
            assert_eq!(phonemize_word_rules(&js(w)).to_string_lossy(), *want, "{w}");
        }
        for (w, want) in PHONEMIZEWORD_1_PINS {
            assert_eq!(phonemize_word(&js(w)).to_string_lossy(), *want, "{w}");
        }
        for (n, want) in SAY_N_PINS {
            assert_eq!(
                say(&crate::core::js_string::js_number_to_string(*n)),
                *want,
                "{n}"
            );
        }
        for (t, want) in SAY_PINS {
            assert_eq!(say(t), *want, "{t}");
        }
        for (t, want) in NORMALIZEILOCANO_1_PINS {
            assert_eq!(normalize_ilocano(&js(t)).to_string_lossy(), *want, "{t}");
        }
        for (t, part) in CONTAINS_PINS {
            assert!(say(t).contains(part), "{t}");
        }
        for (t, part) in NOTCONTAINS_PINS {
            assert!(!say(t).contains(part), "{t}");
        }
        // `phonemizeWord(w) === phonemizeWordRules(w)` for a word outside the lexicon.
        for (w, w2) in REL_PINS {
            assert_eq!(phonemize_word(&js(w)), phonemize_word_rules(&js(w2)), "{w}");
        }
        // `expect(say(1000000000).split(" ")).toHaveLength(10)`: the digit-by-digit fallback.
        assert_eq!(say("1000000000").split(' ').count(), 10);
    }

    /// test/malayic-philippine-1534.test.ts, the ilo rows: relational, never typed IPA.
    #[test]
    fn the_1534_findings_are_fixed() {
        let say = |t: &str| crate::phonemize(t, "ilo").unwrap();
        for (a, b) in [
            ("3.141 a metro", "3 punto 1 4 1 a metro"),
            ("45° N", "45 grado amianan"),
            ("45°S ken", "45 grado abagatan ken"),
            ("12° E", "12 grado daya"),
            ("12°W", "12 grado laud"),
        ] {
            assert_eq!(say(a), say(b), "{a}");
        }
        let at = |w: &str| {
            phonemize_word_rules(&js(w))
                .to_string_lossy()
                .find('ˈ')
                .unwrap()
        };
        for (a, b) in [("queso", "keso"), ("Quezon", "Keson")] {
            assert_eq!(at(a), at(b), "{a}");
        }
    }
}
