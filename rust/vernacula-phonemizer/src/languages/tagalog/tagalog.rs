//! Tagalog / Filipino (tl) phonemizer: the rule transliterator (digraphs, glottal stops at onset, in hiatus and
//! at a hyphen), penultimate stress with the stress and final-glottal lexicons, the loanword override, native
//! numbers with ligature sandhi and number-sense stress, ika- ordinals, clock times, and text() over all of it.
//! Ported from src/languages/tagalog/tagalog.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::manifest::{DIR, MANIFEST, try_manifest};
use super::normalize::normalize_tagalog;
use crate::core::clauses::{ClauseSink, assemble_clauses};
use crate::core::data_source::load_once;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number, js_number_to_string};
use crate::core::load_tsv::{TsvOptions, load_lines, load_tsv_map, load_tsv_strings};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

fn is_vowel_unit(u: u16) -> bool {
    "aeiou".encode_utf16().any(|x| x == u)
}

/// `"aeiou".includes(c)` for one code point `c`.
fn is_vowel_letter(c: &JsString) -> bool {
    c.len() == 1 && is_vowel_unit(c.units()[0])
}

/// `u !== "" && VOWEL_PH.includes(u[0])`: the first code UNIT.
fn is_nucleus(u: &JsString) -> bool {
    u.units().first().is_some_and(|&x| is_vowel_unit(x))
}

fn table(t: &'static IndexMap<String, String>, k: &JsString) -> Option<&'static String> {
    t.get(&k.to_string_lossy())
}

/// `scan(w)`: a lowercased word → IPA units.
fn scan(w: &JsString) -> Vec<JsString> {
    let s = w.code_point_strings();
    let mut out: Vec<JsString> = Vec::new();
    let mut i = 0;
    while i < s.len() {
        let c = &s[i];
        if *c == js("-") || *c == js("‑") {
            out.push(js("ʔ"));
            i += 1;
            continue;
        }
        let dg = c.concat(s.get(i + 1).unwrap_or(&JsString::new()));
        if let Some(d) = table(&MANIFEST.digraphs, &dg).filter(|d| !d.is_empty()) {
            out.push(js(d));
            i += 2;
            continue;
        }
        if is_vowel_letter(c) {
            if out.last().is_none_or(is_nucleus) {
                out.push(js("ʔ"));
            }
            out.push(js(
                table(&MANIFEST.vowels, c).expect("every vowel letter has a reading")
            ));
        } else if let Some(p) = table(&MANIFEST.consonants, c).filter(|p| !p.is_empty()) {
            out.push(js(p));
        }
        i += 1;
    }
    out
}

/// `stressed(units, overrideVowelIdx)`.
fn stressed(units: &[JsString], override_idx: Option<f64>) -> JsString {
    let nuclei: Vec<usize> = (0..units.len())
        .filter(|&i| is_nucleus(&units[i]))
        .collect();
    if nuclei.is_empty() {
        return JsString::join(units, &JsString::new());
    }
    let vni = match override_idx {
        Some(o) if o >= 0.0 && o < nuclei.len() as f64 => o as usize,
        _ => nuclei.len().saturating_sub(2),
    };
    let idx = nuclei[vni];
    let mut out = JsString::new();
    for (i, u) in units.iter().enumerate() {
        if i == idx {
            out.push_str(&js("ˈ"));
        }
        out.push_str(u);
    }
    out
}

/// `phonemizeCore(word, overrideVowelIdx)`.
fn phonemize_core(word: &JsString, override_idx: Option<f64>) -> JsString {
    let lw = word.to_lower_case();
    let units = match table(&MANIFEST.special_words, &lw) {
        Some(special) => scan(&js(special)),
        None => scan(&lw),
    };
    if units.is_empty() {
        return JsString::new();
    }
    normalize(&stressed(&units, override_idx), Form::Nfc)
}

/// `phonemizeWordRules(word)`: the rule engine only.
pub(crate) fn phonemize_word_rules(word: &JsString) -> JsString {
    phonemize_core(word, None)
}

fn try_final_glottal() -> Result<&'static HashSet<JsString>, String> {
    static S: OnceLock<HashSet<JsString>> = OnceLock::new();
    load_once(&S, || {
        load_lines(DIR, "final-glottal.txt", false)
            .map(|l| l.into_iter().collect())
            .map_err(|e| e.to_string())
    })
}

/// stress-lexicon.tsv: word → 0-based nucleus, rejecting empty and non-integer values.
fn try_stress_lex() -> Result<&'static IndexMap<JsString, f64>, String> {
    static S: OnceLock<IndexMap<JsString, f64>> = OnceLock::new();
    load_once(&S, || {
        load_tsv_map(
            DIR,
            "stress-lexicon.tsv",
            |v, _| {
                let n = js_number(v);
                (!v.trim().is_empty() && n.is_finite() && n.fract() == 0.0 && n >= 0.0).then_some(n)
            },
            TsvOptions::default(),
        )
        .map_err(|e| e.to_string())
    })
}

fn try_loanword_lex() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static S: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&S, || {
        load_tsv_strings(DIR, "loanword-lexicon.tsv", TsvOptions::default())
            .map_err(|e| e.to_string())
    })
}

fn checked<T>(r: Result<&'static T, String>) -> &'static T {
    r.unwrap_or_else(|e| panic!("{e}"))
}

/// `phonemizeShippedNoLoan(word)`: rules + stress lexicon + the final-glottal pin.
pub(crate) fn phonemize_shipped_no_loan(word: &JsString) -> JsString {
    let lw = word.to_lower_case();
    let ipa = phonemize_core(word, checked(try_stress_lex()).get(&lw).copied());
    if !ipa.is_empty() && !ipa.ends_with(&js("ʔ")) && checked(try_final_glottal()).contains(&lw) {
        return ipa.concat(&js("ʔ"));
    }
    ipa
}

/// `phonemizeWord(word)`: the loanword override, else the shipped path.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    match checked(try_loanword_lex()).get(&word.to_lower_case()) {
        Some(hit) => hit.clone(),
        None => phonemize_shipped_no_loan(word),
    }
}

fn ends_in_vowel(s: &str) -> bool {
    s.encode_utf16().last().is_some_and(is_vowel_unit)
}

/// `ligate(phrase)`: +ng after a vowel, +g after n, else + " na".
fn ligate(phrase: &str) -> String {
    if ends_in_vowel(phrase) {
        format!("{phrase}ng")
    } else if phrase.ends_with('n') {
        format!("{phrase}g")
    } else {
        format!("{phrase} na")
    }
}

/// `joinRemainder(high, r)`.
fn join_remainder(high: &str, r: f64) -> String {
    if r == 0.0 {
        return high.to_string();
    }
    let low = number_words(r);
    if r >= 100.0 {
        return format!("{high} {low}");
    }
    if ends_in_vowel(high) {
        format!("{high}'t {low}")
    } else {
        format!("{high} {} {low}", MANIFEST.numbers.and)
    }
}

/// `numberWords(n)`: a non-negative integer → Tagalog words, in JS number arithmetic (an unsafe integer
/// composes on the float, as in the TS). ⚠ `n` must be finite: the TS recurses without end on Infinity.
pub(crate) fn number_words(n: f64) -> String {
    let num = &MANIFEST.numbers;
    if n < 0.0 {
        return String::new();
    }
    if n < 10.0 {
        return num.units[n as usize].clone();
    }
    if n < 20.0 {
        return num.teens[(n - 10.0) as usize].clone();
    }
    if n < 100.0 {
        return join_remainder(&num.tens[(n / 10.0).floor() as usize], n % 10.0);
    }
    if n < 1000.0 {
        let h = (n / 100.0).floor();
        let lig = ligate(&num.units[h as usize]);
        let daan = if lig.ends_with("na") {
            &num.hundred_after_na
        } else {
            &num.hundred
        };
        let hundreds = if h == 1.0 {
            num.hundred1.clone()
        } else {
            format!("{lig} {daan}")
        };
        return join_remainder(&hundreds, n % 100.0);
    }
    if n < 1_000_000.0 {
        let th = (n / 1000.0).floor();
        let thousands = if th == 1.0 {
            num.thousand1.clone()
        } else {
            format!("{} {}", ligate(&number_words(th)), num.thousand)
        };
        return join_remainder(&thousands, n % 1000.0);
    }
    if n < 1e9 {
        let m = (n / 1_000_000.0).floor();
        return join_remainder(
            &format!("{} {}", ligate(&number_words(m)), num.million),
            n % 1_000_000.0,
        );
    }
    if n < 1e12 {
        return join_remainder(
            &format!(
                "{} {}",
                ligate(&number_words((n / 1e9).floor())),
                num.billion
            ),
            n % 1e9,
        );
    }
    join_remainder(
        &format!(
            "{} {}",
            ligate(&number_words((n / 1e12).floor())),
            num.trillion
        ),
        n % 1e12,
    )
}

static NUM_PENULT: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    MANIFEST
        .numbers
        .stress_penult
        .iter()
        .map(|s| js(s))
        .collect()
});

/// `numberStressIdx(token)`: final by default, penult for a listed root (the ligature and 't stripped).
fn number_stress_idx(token: &JsString) -> Option<f64> {
    let strip = |n: isize| token.slice(0, Some(-n));
    // The TS chain's first two arms both strip two (`'t`, or `-ng` off a listed root), merged.
    let root = if token.ends_with(&js("'t"))
        || (token.ends_with(&js("ng")) && NUM_PENULT.contains(&strip(2)))
    {
        strip(2)
    } else if token.ends_with(&js("g"))
        && strip(1).ends_with(&js("n"))
        && NUM_PENULT.contains(&strip(1))
    {
        strip(1)
    } else if token.ends_with(&js("ng")) {
        strip(2)
    } else {
        token.clone()
    };
    let nuclei = token
        .code_point_strings()
        .iter()
        .filter(|c| is_vowel_letter(c))
        .count();
    if nuclei == 0 {
        return None;
    }
    Some(if NUM_PENULT.contains(&root) && nuclei >= 2 {
        (nuclei - 2) as f64
    } else {
        (nuclei - 1) as f64
    })
}

const SYMBOL_DATA: &str = r#"{"percent":["porsiyento"],"currency":{"US$":["dolyar"],"$":["dolyar"],"₱":["piso"],"¥":["yen"],"€":["euro"]},"magnitudes":["milyon","bilyon","trilyon","libo","milyong","bilyong","trilyong","libong","Milyon","Bilyon","Trilyon"],"ampersand":"at","units":{"km":["kilometro"],"kilometro":["kilometro"],"m":["metro"],"cm":["sentimetro"],"mm":["milimetro"],"kg":["kilogramo"],"mg":["miligramo"],"nm":["nanometro"],"lb":["libra"],"lbs":["libra"],"l":["litro"],"L":["litro"],"ha":["ektarya"],"katao":["katao"],"naninirahan":["naninirahan"]},"rateDenominators":{"s":"segundo","h":"oras"},"exponentWords":{"squared":["kuwadrado"],"cubed":["kubiko"],"position":"after"},"unitPer":"bawat"}"#;

const ORDINAL_ONE: &str = "una";
const ORDINAL_PREFIX: &str = "ika";
/// `ORDINAL_PREFIX`'s own vowel count.
static ORDINAL_PREFIX_NUCLEI: LazyLock<f64> = LazyLock::new(|| {
    ORDINAL_PREFIX
        .encode_utf16()
        .filter(|&u| is_vowel_unit(u))
        .count() as f64
});

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\d:])(\d{{1,2}}):([0-5]\d)(?::([0-5]\d))?(?![\d:])|[Ii]ka-?(\d+)(?![\p{{L}}\d])|({lr}(?:[-‑]{lr})*)|([1-9]\d{{0,2}}(?:,\d{{3}})+(?:\.\d+)?|\d+\.\d+|\d+)|([.?!,;:])",
            lr = *LATIN_RUN
        ),
        "gu",
    )
    .unwrap()
});

const NATIVE_CLASS: &str = "[A-Za-zÑñ‑-]";
type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "u")));

/// The Tagalog engine (`createTagalog`).
pub struct TagalogPhonemizer {
    symbols: SymbolNormalizer,
}

impl TagalogPhonemizer {
    /// `normalizeTagalog(text)` (normalize.ts).
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_tagalog(text)
    }

    /// The shared symbol tier, as Tagalog builds it.
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

    /// `phonemizeShippedNoLoan(word)`.
    pub fn phonemize_shipped_no_loan(&self, word: &JsString) -> JsString {
        phonemize_shipped_no_loan(word)
    }

    /// `numberWords(n)`; `None` where the TS recurses without end (n = Infinity).
    pub fn number_words(&self, n: f64) -> Option<String> {
        n.is_finite().then(|| number_words(n))
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    /// `text(input)`.
    pub fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        let normalized = self.symbols.apply(&normalize_tagalog(input));
        let emit_word = |wd: &str, sink: &mut ClauseSink| {
            let w = js(wd);
            sink.emit(&phonemize_core(&w, number_stress_idx(&w)));
        };
        let emit_number = |digits: &JsString, sink: &mut ClauseSink| {
            let n = js_number(digits);
            if !is_safe_integer(n) {
                for d in digits.code_point_strings() {
                    for wd in number_words(js_number(&d)).split(' ') {
                        emit_word(wd, sink);
                    }
                }
                return;
            }
            for wd in number_words(n).split(' ') {
                emit_word(wd, sink);
            }
        };
        let out = assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(h) = m.group(1, s) {
                emit_number(&h, sink);
                let min = m.group(2, s).unwrap();
                if min != js("00") {
                    emit_number(&js(&js_number_to_string(js_number(&min))), sink);
                }
                if let Some(sec) = m.group(3, s) {
                    emit_number(&js(&js_number_to_string(js_number(&sec))), sink);
                }
            } else if let Some(digits) = m.group(4, s) {
                let n = js_number(&digits);
                if n == 1.0 {
                    sink.emit(&phonemize_word(&js(ORDINAL_ONE)));
                    return;
                }
                if let Some(c) = MANIFEST.contracted_ordinals.get(&js_number_to_string(n)) {
                    for wd in c.split(' ') {
                        emit_word(wd, sink);
                    }
                    return;
                }
                // Above 2^53 the ordinal reads its digits, as `emit_number` does (#1534).
                let words: Vec<String> = if is_safe_integer(n) {
                    number_words(n).split(' ').map(String::from).collect()
                } else {
                    digits
                        .code_point_strings()
                        .iter()
                        .flat_map(|d| {
                            number_words(js_number(d))
                                .split(' ')
                                .map(String::from)
                                .collect::<Vec<_>>()
                        })
                        .collect()
                };
                for (i, wd) in words.iter().enumerate() {
                    let w = js(wd);
                    let idx = number_stress_idx(&w);
                    if i != 0 {
                        sink.emit(&phonemize_core(&w, idx));
                        continue;
                    }
                    sink.emit(&phonemize_core(
                        &js(ORDINAL_PREFIX).concat(&w),
                        idx.map(|x| x + *ORDINAL_PREFIX_NUCLEI),
                    ));
                }
            } else if let Some(w) = m.group(5, s) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(num) = m.group(6, s) {
                let plain = crate::js_re!(r",", "gu").replace(&num, &JsString::new());
                let parts = plain.split(&js("."));
                emit_number(&parts[0], sink);
                if let Some(frac) = parts.get(1) {
                    for d in frac.code_point_strings() {
                        emit_number(&d, sink);
                    }
                }
            } else if let Some(p) = m.group(7, s)
                && let Some(mk) =
                    table(&MANIFEST.clause_punctuation, &p).filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        });
        Ok(out)
    }
}

impl Engine for TagalogPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        TagalogPhonemizer::text(self, input)
    }
}

/// `createTagalog()`. Errors when the manifest or a lexicon cannot be loaded, or the tier refuses its data.
pub fn create_tagalog() -> Result<TagalogPhonemizer, String> {
    try_manifest()?;
    try_final_glottal()?;
    try_stress_lex()?;
    try_loanword_lex()?;
    let data: SymbolData =
        crate::core::from_json::parse_json(SYMBOL_DATA).map_err(|e| e.to_string())?;
    Ok(TagalogPhonemizer {
        symbols: make_symbol_normalizer(&data)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // test/tagalog.test.ts's literal pins, extracted from that file mechanically (.probe/pins.mjs evaluates
    // each string literal; no reading was typed by hand), so the two engines are held to one list.
    const PHONEMIZEWORD_1_PINS: &[(&str, &str)] = &[
        ("acda", "ʔˈakdaʔ"),
        ("aguho", "ʔaɡˈuhoʔ"),
        ("tao", "tˈaʔo"),
        ("araw", "ʔˈaɾaw"),
        ("salmon", "salmˈon"),
        ("doktor", "doktˈoɾ"),
        ("balik", "bˈalik"),
        ("abenojar", "ʔabenˈohaɾ"),
        ("abece", "ʔabˈese"),
        ("siya", "sˈija"),
        ("tao", "tˈaʔo"),
        ("mabuti", "mabˈuti"),
        ("mabuti", "mabˈuti"),
        ("tao", "tˈaʔo"),
        ("maganda", "maɡandˈa"),
        ("kaibigan", "kaʔibˈiɡan"),
        ("ngayon", "ŋajˈon"),
        ("mga", "maŋˈa"),
        ("araw", "ʔˈaɾaw"),
    ];
    const PHONEMIZEWORDRULES_1_PINS: &[(&str, &str)] = &[
        ("acda", "ʔˈakda"),
        ("salmon", "sˈalmon"),
        ("doktor", "dˈoktoɾ"),
        ("almarez", "ʔalmˈaɾes"),
        ("aparri", "ʔapˈaɾi"),
        ("abenojar", "ʔabenˈod͡ʒaɾ"),
    ];
    const PHONEMIZE_2_PINS: &[(&str, &str, &str)] = &[
        ("pag-ibig", "tl", "paɡʔˈibiɡ"),
        ("0", "tl", "sˈeɾo"),
        ("5", "tl", "limˈa"),
        ("20", "tl", "dalawampˈu"),
        ("100", "tl", "sandaʔˈan"),
        ("1000", "tl", "sanlˈibo"),
        ("200", "tl", "dalawˈaŋ daʔˈan"),
        ("Cañitas", "tl", "kaɲˈitas"),
        ("kaibigan-ko", "tl", "kaʔibiɡˈanʔko"),
        ("ang mga bata", "tl", "ʔˈaŋ maŋˈa bˈata"),
        ("computer", "tl", "kompˈuteɾ"),
        (
            "50% ng populasyon",
            "tl",
            "limampˈu poɾsijˈento nˈaŋ populˈaʃon",
        ),
        ("₱1,000", "tl", "sanlˈibo pˈiso"),
        ("$19.8 bilyon", "tl", "labinsijˈam walˈo bˈiljon doljˈaɾ"),
        ("3.5 kilometro", "tl", "tatlˈo limˈa kilomˈetɾo"),
        ("ika-20 siglo", "tl", "ʔikadalawampˈu sˈiɡlo"),
        ("ika-2", "tl", "ʔikalawˈa"),
        ("ika-3", "tl", "ʔikatlˈo"),
        ("ika-1", "tl", "ʔˈuna"),
        ("ika-4", "tl", "ʔikaʔˈapat"),
        ("ika-6", "tl", "ʔikaʔˈanim"),
        ("ika-14", "tl", "ʔikalabiŋʔˈapat"),
        ("ika-1000", "tl", "ʔikasanlˈibo"),
        ("ika-5", "tl", "ʔikalimˈa"),
        ("ika-104", "tl", "ʔikasandaʔˈan ʔˈat ʔˈapat"),
        ("constructor", "tl", "konstɾˈuktoɾ"),
        ("A & B", "tl", "ʔˈa ʔˈat b"),
        ("14 &ndash; 16", "tl", "labiŋʔˈapat haŋɡˈaŋ labiŋʔˈanim"),
        (
            "1995–2000",
            "tl",
            "sanlˈibo sijˈam nˈa ɾaʔˈan ʔˈat sijamnapˈut limˈa haŋɡˈaŋ dalawˈaŋ lˈibo",
        ),
        ("10 km", "tl", "sampˈu kilomˈetɾo"),
        ("12:23", "tl", "labindalawˈa dalawampˈut tatlˈo"),
        ("08:50:38", "tl", "walˈo limampˈu tatlumpˈut walˈo"),
        ("5:00", "tl", "limˈa"),
        ("10 m", "tl", "sampˈu mˈetɾo"),
        ("10 mm", "tl", "sampˈu milimˈetɾo"),
        ("10 l", "tl", "sampˈu lˈitɾo"),
        ("10 L", "tl", "sampˈu lˈitɾo"),
        ("10 ha", "tl", "sampˈu ʔektˈaɾja"),
        ("23 m", "tl", "dalawampˈut tatlˈo mˈetɾo"),
        ("10 cm", "tl", "sampˈu sentimˈetɾo"),
        ("150cm", "tl", "sandaʔˈan ʔˈat limampˈu sentimˈetɾo"),
        ("40 kg", "tl", "ʔapatnapˈu kiloɡɾˈamo"),
        ("200 mg", "tl", "dalawˈaŋ daʔˈan miliɡɾˈamo"),
        (
            "11 milyong mga Pilipino",
            "tl",
            "labiŋʔisˈa mˈiljoŋ maŋˈa pilipˈino",
        ),
        (
            "299 m/s",
            "tl",
            "dalawˈaŋ daʔˈan ʔˈat sijamnapˈut sijˈam mˈetɾo bˈawat seɡˈundo",
        ),
        ("5 lb", "tl", "limˈa lˈibɾa"),
        ("libong bahay", "tl", "lˈiboŋ bˈahaj"),
        ("apatng bahay", "tl", "ʔˈapatŋ bˈahaj"),
        ("libo", "tl", "lˈibo"),
        ("sanlibo", "tl", "sanlˈibo"),
    ];
    const NUMBERWORDS_1_PINS: &[(f64, &str)] = &[
        (12.0, "labindalawa"),
        (14.0, "labing-apat"),
        (17.0, "labimpito"),
        (20.0, "dalawampu"),
        (21.0, "dalawampu't isa"),
        (40.0, "apatnapu"),
        (90.0, "siyamnapu"),
        (100.0, "sandaan"),
        (101.0, "sandaan at isa"),
        (125.0, "sandaan at dalawampu't lima"),
        (200.0, "dalawang daan"),
        (400.0, "apat na raan"),
        (900.0, "siyam na raan"),
        (1000.0, "sanlibo"),
        (2000.0, "dalawang libo"),
        (
            12345.0,
            "labindalawang libo tatlong daan at apatnapu't lima",
        ),
        (100000.0, "sandaang libo"),
        (200000.0, "dalawang daang libo"),
        (1000000.0, "isang milyon"),
    ];
    const CONTAINS_PINS: &[(&str, &str, &str)] = &[
        ("salamat", "tl", "salˈamat"),
        ("Doña Maria", "tl", "dˈoɲa"),
        ("ang constructor pattern", "tl", "konstɾˈuktoɾ"),
        ("400-700 nm", "tl", "nanomˈetɾo"),
        ("40 kg (90 lbs)", "tl", "lˈibɾa"),
        ("1.07 fm", "tl", "fm"),
        ("43,079 katao/km²", "tl", "bˈawat kilomˈetɾo kuwadɾˈado"),
        ("64,710 (ikalawa) katao/km²", "tl", "km"),
    ];
    const NOTCONTAINS_PINS: &[(&str, &str, &str)] = &[
        ("Klöcker", "tl", "ˈoᶷ"),
        ("2GO Travel", "tl", "ɡɾˈamo"),
        ("76s", "tl", "seɡˈundo"),
        ("101.1 FM", "tl", "femtomˈetɾo"),
    ];
    const REL_PINS: &[(&str, &str, &str, &str)] = &[
        ("São Paulo", "tl", "Sao Paulo", "tl"),
        ("Klöcker", "tl", "Klocker", "tl"),
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        create_tagalog().unwrap();
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
        for (n, want) in NUMBERWORDS_1_PINS {
            assert_eq!(number_words(*n), *want, "{n}");
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
    }

    /// test/tagalog-1534.test.ts: above 2^53 an `ika-` ordinal reads its digits (it threw on Infinity), and
    /// the cardinal has scales above milyon.
    #[test]
    fn the_1534_findings_are_fixed() {
        let tl = |s: &str| crate::phonemize(s, "tl").unwrap();
        let long = format!("ika-{}", "9".repeat(400));
        assert_eq!(tl(&long).split(' ').count(), 400);
        let (a, b) = (
            tl("ika-12345678901234567891"),
            tl("ika-12345678901234567899"),
        );
        assert_ne!(a, b);
        assert_eq!(
            a.split(' ').skip(1).collect::<Vec<_>>(),
            tl("12345678901234567891")
                .split(' ')
                .skip(1)
                .collect::<Vec<_>>()
        );
        assert_eq!(number_words(2e9), "dalawang bilyon");
        assert_eq!(number_words(1e9), "isang bilyon");
        assert_eq!(number_words(3e12 + 5e9), "tatlong trilyon limang bilyon");
        assert_eq!(number_words(1e15), "sanlibong trilyon");
        assert_eq!(number_words(999_999_999.0).split(' ').last(), Some("siyam"));
    }
}
