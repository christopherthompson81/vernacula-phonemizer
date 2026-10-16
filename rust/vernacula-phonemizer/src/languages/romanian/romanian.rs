//! Romanian (ro) phonemizer: contextual c/g softening, rising diphthongs, i/u glides, final-i palatalisation and
//! rule stress (with a mined stress lexicon), the gender-agreeing cardinal compositor, and text().
//! Ported from src/languages/romanian/romanian.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use super::normalize::normalize_romanian;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number, js_number_to_string};
use crate::core::load_manifest::load_manifest;
use crate::core::load_tsv::{TsvOptions, load_tsv_map};
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/romanian";

#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct Gendered {
    pub one_masculine: String,
    pub one_feminine: String,
    pub one_feminine_final: String,
    pub two_feminine: String,
    pub twelve_feminine: String,
}

/// `NUM` (the TS casts `numbers` to this shape; every field it reads is required here).
#[derive(Debug, FromJson)]
pub struct Numbers {
    pub units: Vec<String>,
    pub teens: Vec<String>,
    pub tens: Vec<String>,
    pub hundred: String,
    pub hundreds: String,
    pub thousand: String,
    pub thousands: String,
    pub million: String,
    pub millions: String,
    pub billion: String,
    pub billions: String,
    pub and: String,
    pub of: String,
    pub gendered: Gendered,
}

/// `RomanianDef` (romanian.jsonc).
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct RomanianDef {
    pub consonants: IndexMap<String, String>,
    pub obstruents: Vec<String>,
    pub vowels: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: Numbers,
}

/// The manifest and the optional stress lexicon, or why they could not be loaded.
fn try_data() -> Result<&'static (RomanianDef, IndexMap<JsString, f64>), String> {
    static D: OnceLock<(RomanianDef, IndexMap<JsString, f64>)> = OnceLock::new();
    load_once(&D, || {
        let def: RomanianDef = load_manifest(DIR, "romanian.jsonc").map_err(|e| e.to_string())?;
        // `loadStressLex`: `Number(v)` kept only when it is an integer ≥ 1.
        let raw = load_tsv_map(
            DIR,
            "romanian-stress.tsv",
            |v, _| Some(v.clone()),
            TsvOptions {
                optional: true,
                ..Default::default()
            },
        )
        .map_err(|e| e.to_string())?;
        let mut lex = IndexMap::new();
        for (k, v) in raw {
            let n = js_number(&v);
            if n.is_finite() && n.trunc() == n && n >= 1.0 {
                lex.insert(k, n);
            }
        }
        Ok((def, lex))
    })
}

static DATA: LazyLock<&'static (RomanianDef, IndexMap<JsString, f64>)> =
    LazyLock::new(|| try_data().unwrap_or_else(|e| panic!("{e}")));

fn def() -> &'static RomanianDef {
    &DATA.0
}

const VOWEL_LETTERS: &str = "aeiouăâî";
const FRONT: &str = "ei";
const VOWEL_PH: &str = "aeiouəɨ";

static OBSTRUENT: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| def().obstruents.iter().map(|o| js(o)).collect());

/// `isVowelLetter(c)` / `isFront(c)`: `undefined` past the end; otherwise a SUBSTRING test.
fn is_vowel_letter(c: Option<&JsString>) -> bool {
    c.is_some_and(|c| js(VOWEL_LETTERS).includes(c))
}
fn is_front(c: Option<&JsString>) -> bool {
    c.is_some_and(|c| js(FRONT).includes(c))
}
/// `VOWEL_PH.includes(p.slice(-1))`.
fn ends_vowel_ph(p: &JsString) -> bool {
    js(VOWEL_PH).includes(&p.slice(-1, None))
}

const INITIAL_JE: [&str; 13] = [
    "este", "ești", "e", "el", "ea", "ei", "ele", "eram", "erai", "era", "erați", "erau", "esti",
];

/// `scan(word)`: the lowercased word's CODE POINTS → phoneme strings.
fn scan(word: &JsString) -> Vec<JsString> {
    let s = word.code_point_strings();
    let n = s.len();
    let mut out: Vec<JsString> = Vec::new();
    let prev_is_vowel = |out: &[JsString]| out.last().is_some_and(ends_vowel_ph);
    let after_muta_liquida = |out: &[JsString]| {
        out.len() >= 2
            && js("lr").includes(&out[out.len() - 1])
            && OBSTRUENT.contains(&out[out.len() - 2])
    };
    let push = |out: &mut Vec<JsString>, p: &str| out.push(js(p));
    let mut i = 0;
    while i < n {
        let c = &s[i];
        let nx = s.get(i + 1);
        let nn = s.get(i + 2);
        let is = |x: Option<&JsString>, v: &str| x.is_some_and(|x| *x == v);

        if *c == "c" || *c == "g" {
            let (hard, soft) = if *c == "c" {
                ("k", "t͡ʃ")
            } else {
                ("ɡ", "d͡ʒ")
            };
            if is(nx, "h") {
                push(&mut out, hard);
                i += 2;
                continue;
            }
            if is_front(nx) {
                push(&mut out, soft);
                i += if is(nx, "i") && is_vowel_letter(nn) {
                    2
                } else {
                    1
                };
                continue;
            }
            push(&mut out, hard);
            i += 1;
            continue;
        }
        if *c == "q" {
            push(&mut out, "k");
            if is(nx, "u") && is_vowel_letter(nn) {
                push(&mut out, "w");
                i += 2;
            } else {
                i += 1;
            }
            continue;
        }

        if is_vowel_letter(Some(c)) {
            if (*c == "e" || *c == "o") && is(nx, "a") {
                push(&mut out, if *c == "e" { "e̯" } else { "o̯" });
                i += 1;
                continue;
            }
            if *c == "i" && is(nx, "e") && i + 2 == n && !prev_is_vowel(&out) {
                push(&mut out, "i");
                i += 1;
                continue;
            }
            let is_high = |x: Option<&JsString>| is(x, "i") || is(x, "u");
            let onglide = is_vowel_letter(nx) && !is_high(nx) && !after_muta_liquida(&out);
            if is_high(Some(c)) && (prev_is_vowel(&out) || onglide) {
                push(&mut out, if *c == "i" { "j" } else { "w" });
                i += 1;
                continue;
            }
            out.push(
                def()
                    .vowels
                    .get(&c.to_string_lossy())
                    .map_or_else(|| c.clone(), |v| js(v)),
            );
            i += 1;
            continue;
        }

        if *c == "x" {
            let gz = i == 1 && s[0] == "e" && is_vowel_letter(nx);
            push(&mut out, if gz { "ɡz" } else { "ks" });
            i += 1;
            continue;
        }
        // `c in DEF.consonants`: a single code point is never an `Object.prototype` member, so own keys suffice.
        if let Some(ph) = def().consonants.get(&c.to_string_lossy())
            && !ph.is_empty()
        {
            out.push(js(ph));
        }
        i += 1;
    }
    out
}

/// `finalI(segs)`: a final unstressed ⟨i⟩ after a consonant palatalises it; syllabic in a monosyllable and after
/// an obstruent + liquid.
fn final_i(segs: Vec<JsString>) -> Vec<JsString> {
    let n = segs.len();
    if n < 2 || segs[n - 1] != "i" {
        return segs;
    }
    if segs.iter().filter(|p| ends_vowel_ph(p)).count() < 2 {
        return segs;
    }
    let prev = segs[n - 2].clone();
    if (prev == "r" || prev == "l") && n >= 3 && !ends_vowel_ph(&segs[n - 3]) {
        return segs;
    }
    let mut out = segs[..n - 2].to_vec();
    out.push(prev.concat(&js("ʲ")));
    out
}

/// `stressFromEnd(word, nucleiCount)`: 1 = final nucleus, 2 = penult. `word[…]` is a code UNIT.
fn stress_from_end(word: &JsString, nuclei: usize) -> f64 {
    if nuclei <= 1 {
        return 1.0;
    }
    let vl = js(VOWEL_LETTERS);
    let last = word.slice(-1, None);
    if !vl.includes(&last) {
        return if last == "c" { 2.0 } else { 1.0 };
    }
    if last == "i" {
        return if word.len() >= 2 && vl.includes(&word.char_at(word.len() - 2)) {
            2.0
        } else {
            1.0
        };
    }
    if last == "a" { 1.0 } else { 2.0 }
}

fn phonemize_core(word: &JsString, use_lex: bool) -> JsString {
    let lw = word.to_lower_case();
    let mut segs = final_i(scan(&lw));
    if segs.is_empty() {
        return JsString::new();
    }
    if INITIAL_JE.iter().any(|w| lw == *w) {
        segs.insert(0, js("j"));
    }
    let is_nucleus = |p: &JsString| p.len() == 1 && js(VOWEL_PH).includes(p);
    let nuclei: Vec<usize> = (0..segs.len()).filter(|&i| is_nucleus(&segs[i])).collect();
    let mut out = JsString::new();
    if nuclei.is_empty() {
        for p in &segs {
            out.push_str(p);
        }
    } else {
        let from_end = use_lex
            .then(|| DATA.1.get(&lw).copied())
            .flatten()
            .unwrap_or_else(|| stress_from_end(&lw, nuclei.len()));
        // `Math.max(0, nuclei.length - fromEnd)`: fromEnd is an integer ≥ 1.
        let at = (nuclei.len() as f64 - from_end).max(0.0) as usize;
        let idx = nuclei[at];
        let mut onset = idx;
        while onset > 0 && !is_nucleus(&segs[onset - 1]) {
            onset -= 1;
        }
        for (i, p) in segs.iter().enumerate() {
            if i == onset {
                out.push_str(&js("ˈ"));
            }
            out.push_str(p);
        }
    }
    normalize(&out, Form::Nfc)
}

/// `phonemizeWord(word)`: the shipped path (stress rule + the mined lexicon).
pub fn phonemize_word(word: &JsString) -> JsString {
    phonemize_core(word, true)
}

/// `phonemizeWordRules(word)`: the rule-only stress path.
pub fn phonemize_word_rules(word: &JsString) -> JsString {
    phonemize_core(word, false)
}

// ── Numbers ──────────────────────────────────────────────────────────────────────────────────────────

#[derive(Clone, Copy, PartialEq, Eq)]
enum Gender {
    F,
    N,
    M,
}

fn num() -> &'static Numbers {
    &def().numbers
}

/// `gendered(word, g)`: 2 and 12 feminise for a feminine or neuter-plural noun, 1 only for a feminine one.
fn gendered(word: &str, g: Gender) -> String {
    let (nm, gd) = (num(), &num().gendered);
    if g == Gender::M {
        return word.to_string();
    }
    if word == nm.units[2] {
        return gd.two_feminine.clone();
    }
    if word == nm.teens[2] {
        return gd.twelve_feminine.clone();
    }
    if word == nm.units[1] && g == Gender::F {
        return gd.one_feminine_final.clone();
    }
    word.to_string()
}

fn needs_de(count: f64) -> bool {
    count % 100.0 == 0.0 || count % 100.0 >= 20.0
}

fn under100(n: f64, g: Gender) -> String {
    let nm = num();
    if n < 10.0 {
        return gendered(&nm.units[n as usize], g);
    }
    if n < 20.0 {
        return gendered(&nm.teens[(n - 10.0) as usize], g);
    }
    let (t, u) = ((n / 10.0).floor() as usize, n % 10.0);
    if u == 0.0 {
        nm.tens[t].clone()
    } else {
        format!(
            "{} {} {}",
            nm.tens[t],
            nm.and,
            gendered(&nm.units[u as usize], g)
        )
    }
}

fn under1000(n: f64, g: Gender, stem: bool) -> String {
    let nm = num();
    if n < 100.0 {
        return under100(n, g);
    }
    let (h, rest) = ((n / 100.0).floor(), n % 100.0);
    let head = if h == 1.0 {
        if stem {
            nm.hundred.clone()
        } else {
            format!("{} {}", nm.gendered.one_feminine, nm.hundred)
        }
    } else {
        format!(
            "{} {}",
            gendered(&nm.units[h as usize], Gender::F),
            nm.hundreds
        )
    };
    if rest == 0.0 {
        head
    } else {
        format!("{head} {}", under100(rest, g))
    }
}

fn magnitude_group(count: f64, g: Gender, sg: &str, pl: &str, stem: bool) -> String {
    let gd = &num().gendered;
    if count == 1.0 {
        return if stem {
            sg.to_string()
        } else {
            let one = if g == Gender::F {
                &gd.one_feminine
            } else {
                &gd.one_masculine
            };
            format!("{one} {sg}")
        };
    }
    let head = under1000(count, g, stem);
    if needs_de(count) && !stem {
        format!("{head} {} {pl}", num().of)
    } else {
        format!("{head} {pl}")
    }
}

/// `numberWords(n, { stem })`: the cardinal with agreeing multipliers; ≥ 10¹² reads `String(n)` digit by digit
/// (`NUM.units[Number(d)]`, a non-digit's `undefined` slot written as "" by `join`).
pub fn number_words(n: f64, stem: bool) -> JsString {
    let nm = num();
    if n == 0.0 {
        return js(&nm.units[0]);
    }
    if n >= 1e12 {
        let words: Vec<JsString> = js(&js_number_to_string(n))
            .code_point_strings()
            .iter()
            .map(|d| {
                let i = js_number(d);
                if i.is_finite() && i.trunc() == i && i >= 0.0 && (i as usize) < nm.units.len() {
                    js(&nm.units[i as usize])
                } else {
                    JsString::new()
                }
            })
            .collect();
        return JsString::join(&words, &js(" "));
    }
    let mut parts: Vec<String> = Vec::new();
    let bil = (n / 1e9).floor();
    let mil = ((n % 1e9) / 1e6).floor();
    let th = ((n % 1e6) / 1000.0).floor();
    let rest = n % 1000.0;
    if bil > 0.0 {
        parts.push(magnitude_group(
            bil,
            Gender::N,
            &nm.billion,
            &nm.billions,
            stem,
        ));
    }
    if mil > 0.0 {
        parts.push(magnitude_group(
            mil,
            Gender::N,
            &nm.million,
            &nm.millions,
            stem,
        ));
    }
    if th > 0.0 {
        parts.push(magnitude_group(
            th,
            Gender::F,
            &nm.thousand,
            &nm.thousands,
            stem,
        ));
    }
    if rest > 0.0 {
        parts.push(under1000(rest, Gender::M, stem));
    }
    js(&parts.join(" "))
}

/// `THOUSAND_NOUN`: the thousand noun (singular, plural). An ordinal that ENDS on the thousand is built on the
/// plural stem whatever the count — al miilea, al două miilea (#1533).
pub fn thousand_noun() -> (JsString, JsString) {
    let nm = num();
    (js(&nm.thousand), js(&nm.thousands))
}

// ── text() ───────────────────────────────────────────────────────────────────────────────────────────

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: the nativiser over Romanian's own inventory (flags `u`, as the TS).
pub static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[a-zA-ZăâîșțA-ZĂÂÎȘȚ]", "u")));

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.?!,;:])", *LATIN_RUN), "gu").unwrap());

/// The Romanian engine (`createRomanian`).
pub struct RomanianPhonemizer;

impl RomanianPhonemizer {
    pub fn text(&self, raw_input: &JsString) -> JsString {
        assemble_clauses(&normalize_romanian(raw_input), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(digits) = m.group(2, s) {
                let n = js_number(&digits);
                if is_safe_integer(n) {
                    for w in number_words(n, false).split(&js(" ")) {
                        sink.emit(&phonemize_word(&w));
                    }
                } else {
                    // `for (const d of m[2])`: ASCII digits, so code units and code points agree.
                    for d in digits.code_point_strings() {
                        for w in number_words(js_number(&d), false).split(&js(" ")) {
                            sink.emit(&phonemize_word(&w));
                        }
                    }
                }
            } else if let Some(p) = m.group(3, s)
                && let Some(mk) = def()
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for RomanianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(RomanianPhonemizer::text(self, input))
    }
}

/// `createRomanian()`. Errors when the manifest or the stress lexicon cannot be loaded.
pub fn create_romanian() -> Result<RomanianPhonemizer, String> {
    try_data()?;
    Ok(RomanianPhonemizer)
}

/// For the Roman policy, which the registry reaches without building the engine.
pub(crate) fn data_loaded() -> bool {
    try_data().is_ok()
}
