//! Luxembourgish (lb) phonemizer: a greedy longest-match grapheme scan (diphthongs and digraphs first), then the
//! code rules — stress and short-⟨e⟩ realization, onset ⟨s⟩ voicing, initial ⟨st sp⟩, geminate collapse, the velar
//! nasal, intervocalic g-spirantization, devoicing; the symbol tier; and text() over Latin words (a foreign name
//! nativised), numbers (with the Eifeler Regel across the number's right edge) and clause punctuation.
//! Ported from src/languages/luxembourgish/luxembourgish.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::normalize_luxembourgish;
use super::numbers::{DIR, apply_eifeler_regel, number_to_words, try_numbers};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::ipa::IPA_VOWELS;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{Form, normalize};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// `LuxDef`: this module's own slice of luxembourgish.jsonc, as in the TS.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LuxDef {
    pub digraphs: IndexMap<String, String>,
    pub graphemes: IndexMap<String, String>,
    pub voiceless_obstruents: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
}

/// The manifest slice, or why it could not be loaded.
pub fn try_def() -> Result<&'static LuxDef, String> {
    static M: OnceLock<LuxDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "luxembourgish.jsonc").map_err(|e| e.to_string())
    })
}

/// ⚠ Reached only through a checked path (a `LuxembourgishPhonemizer`, whose constructor loads it).
static DEF: LazyLock<&'static LuxDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

/// `ORDER`: the digraph keys stably sorted by UTF-16 length, longest first.
static ORDER: LazyLock<Vec<(JsString, JsString)>> = LazyLock::new(|| {
    let mut keys: Vec<(JsString, JsString)> =
        DEF.digraphs.iter().map(|(k, v)| (js(k), js(v))).collect();
    keys.sort_by_key(|(k, _)| std::cmp::Reverse(k.len()));
    keys
});

static VOICELESS_OBSTR: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| DEF.voiceless_obstruents.iter().map(|s| js(s)).collect());

/// `DEVOICE[ph]`: an own-key lookup (no phone is an `Object.prototype` member).
fn devoice(ph: &JsString) -> Option<&'static str> {
    Some(match ph.to_string_lossy().as_str() {
        "b" => "p",
        "d" => "t",
        "ɡ" => "k",
        "z" => "s",
        "v" => "f",
        _ => return None,
    })
}

#[derive(Clone, Debug)]
struct Tok {
    ph: JsString,
    s_var: bool,
    e_var: bool,
    stress: bool,
}

fn tok(ph: JsString, s_var: bool, e_var: bool) -> Tok {
    Tok {
        ph,
        s_var,
        e_var,
        stress: false,
    }
}

/// `scan(word)`: longest-match digraphs, then single graphemes, over code units.
fn scan(word: &JsString) -> Vec<Tok> {
    let w = normalize(word, Form::Nfc).to_lower_case();
    let u = w.units();
    let mut toks = Vec::new();
    let mut i = 0;
    'outer: while i < u.len() {
        for (key, ph) in ORDER.iter() {
            if u.len() >= i + key.len() && u[i..i + key.len()] == key.units()[..] {
                toks.push(tok(ph.clone(), false, false));
                i += key.len();
                continue 'outer;
            }
        }
        let c = JsString::from_units(&[u[i]]);
        // `G[c] ?? latinPhone(c, { initial: i === 0 })`
        let ph = DEF
            .graphemes
            .get(&c.to_string_lossy())
            .map(|p| js(p))
            .or_else(|| {
                latin_phone(
                    &c,
                    PhoneOpts {
                        initial: i == 0,
                        include_h: false,
                    },
                )
            });
        if let Some(ph) = ph {
            toks.push(tok(ph, c == "s", c == "e"));
        }
        i += 1;
    }
    toks
}

/// `coreChars(ph)`: the NFD code points, less U+0300–036F and the length mark.
fn core_chars(ph: &JsString) -> Vec<u32> {
    normalize(ph, Form::Nfd)
        .code_points()
        .filter(|&x| !(0x300..=0x36f).contains(&x) && x != 0x2d0)
        .collect()
}

fn is_vowel_cp(x: u32) -> bool {
    char::from_u32(x).is_some_and(|c| IPA_VOWELS.contains(c))
}

fn starts_with_vowel(ph: &JsString) -> bool {
    core_chars(ph).first().is_some_and(|&x| is_vowel_cp(x))
}

fn ends_with_vowel(ph: &JsString) -> bool {
    core_chars(ph).last().is_some_and(|&x| is_vowel_cp(x))
}

/// `realizeE(word, toks)`: place the stress, and realize short ⟨e⟩ off it.
fn realize_e(word: &JsString, toks: &mut [Tok]) {
    let vowel_idx: Vec<usize> = (0..toks.len())
        .filter(|&i| starts_with_vowel(&toks[i].ph))
        .collect();
    let prefixed = js_re!(r"^(ge|be|er|zer|ze)[^aeiouyäëéô]|^ver", "u").test(&word.to_lower_case());
    let stress_ordinal = if prefixed && vowel_idx.len() > 1 {
        1
    } else {
        0
    };
    let stress_tok = vowel_idx.get(stress_ordinal).copied();
    for (i, t) in toks.iter_mut().enumerate() {
        if t.e_var {
            t.ph = js(if Some(i) == stress_tok { "æ" } else { "ə" });
        }
    }
    if let Some(k) = stress_tok {
        toks[k].stress = true;
    }
}

/// `voiceS(toks)`.
fn voice_s(toks: &mut [Tok]) {
    for i in 0..toks.len() {
        if !toks[i].s_var {
            continue;
        }
        let next_vowel = i + 1 < toks.len() && starts_with_vowel(&toks[i + 1].ph);
        let prev_vowel = i > 0 && ends_with_vowel(&toks[i - 1].ph);
        if next_vowel && (i == 0 || prev_vowel) {
            toks[i].ph = js("z");
        }
    }
}

/// `initialSCluster(toks)`.
fn initial_s_cluster(toks: &mut [Tok]) {
    if toks.len() >= 2 && toks[0].ph == "s" && (toks[1].ph == "t" || toks[1].ph == "p") {
        toks[0].ph = js("ʃ");
    }
}

/// `applyDevoicing(toks)`.
fn apply_devoicing(toks: &mut [Tok]) {
    let Some(last) = toks.len().checked_sub(1) else {
        return;
    };
    for i in 0..=last {
        let Some(voiceless) = devoice(&toks[i].ph) else {
            continue;
        };
        let word_final = i == last;
        let before_voiceless = i < last && VOICELESS_OBSTR.contains(&toks[i + 1].ph);
        if !word_final && !before_voiceless {
            continue;
        }
        toks[i].ph = if toks[i].ph == "ɡ" && word_final {
            js(if i > 0 && ends_with_vowel(&toks[i - 1].ph) {
                "χ"
            } else {
                "k"
            })
        } else {
            js(voiceless)
        };
    }
}

/// `velarNasal(toks)`.
fn velar_nasal(toks: &mut [Tok]) {
    for i in 0..toks.len().saturating_sub(1) {
        if toks[i].ph == "n" && (toks[i + 1].ph == "k" || toks[i + 1].ph == "ɡ") {
            toks[i].ph = js("ŋ");
        }
    }
}

/// `spirantizeG(toks)`.
fn spirantize_g(toks: &mut [Tok]) {
    for i in 1..toks.len().saturating_sub(1) {
        if toks[i].ph == "ɡ"
            && ends_with_vowel(&toks[i - 1].ph)
            && starts_with_vowel(&toks[i + 1].ph)
        {
            toks[i].ph = js("ʁ");
        }
    }
}

/// `degeminate(toks)`.
fn degeminate(toks: &mut Vec<Tok>) {
    let mut i = toks.len().saturating_sub(1);
    while i > 0 {
        if toks[i].ph == toks[i - 1].ph && !starts_with_vowel(&toks[i].ph) {
            toks.remove(i);
        }
        i -= 1;
    }
}

/// `phonemizeWord(word)`.
pub fn phonemize_word(word: &JsString) -> JsString {
    let mut toks = scan(word);
    realize_e(word, &mut toks);
    voice_s(&mut toks);
    initial_s_cluster(&mut toks);
    degeminate(&mut toks);
    velar_nasal(&mut toks);
    spirantize_g(&mut toks);
    apply_devoicing(&mut toks);
    let mut out = JsString::new();
    for t in &toks {
        if t.stress {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&t.ph);
    }
    out
}

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;

/// `nat`: Luxembourgish's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[a-zéëäA-ZÉËÄ'-]", "u")));

/// `SYMBOLS`'s argument, generated from the object literal in luxembourgish.ts (key order preserved) by recording
/// it through the fn-diff symbols hook and printing `JSON.stringify` of it. No `countForm`: the default selector.
const SYMBOL_DATA: &str = r#"{"multiply":{"times":"mol"},"percent":["Prozent"],"currency":{"$":["Dollar"],"€":["Euro"],"¥":["Yen"]},"units":{"km":["Kilometer"],"m":["Meter"],"cm":["Zentimeter"],"mm":["Millimeter"],"kg":["Kilogramm"]},"magnitudes":["Milliounen","Millioune","Millioun","Milliarden","Milliard"],"unitPer":{"h":"an der","s":"pro"},"rateDenominators":{"h":"Stonn","s":"Sekonn"},"exponentWords":{"squared":["Quadrat"],"cubed":["Kubik"],"position":"compound"}}"#;

static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
    make_symbol_normalizer(&data)
});

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let run = host_word_run(&["Latin"], "'-", "").unwrap();
    JsRegex::new(&format!(r"({run})|(\d+)|([.!?…,;:–])"), "gu").unwrap()
});

/// The Luxembourgish engine (`createLuxembourgish`).
pub struct LuxembourgishPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `LuxembourgishPhonemizer` proves the manifest and
/// the symbol tier loaded. (The per-module differentials call them.)
impl LuxembourgishPhonemizer {
    /// `normalizeLuxembourgish(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_luxembourgish(text)
    }

    /// `SYMBOLS(text)`.
    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    /// `numberToWords(n, raw)` (numbers.ts).
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    /// `applyEifelerRegel(word, following)` (numbers.ts).
    pub fn eifeler(&self, word: &JsString, following: &JsString) -> JsString {
        apply_eifeler_regel(word, following)
    }

    /// `ordinalStem(n)` (normalize.ts).
    pub fn ordinal_stem(&self, n: f64) -> Option<JsString> {
        super::normalize::ordinal_stem(n)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self.symbols.apply(&normalize_luxembourgish(input));
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                let mut words = number_to_words(js_number(&d), Some(&d)).split(&js(" "));
                let rest = s.slice(m.end() as isize, None);
                let after = js_re!(r"^\s*([\p{L}\p{M}])", "u")
                    .exec(&rest)
                    .and_then(|a| a.group(1, &rest));
                let last = words.len() - 1;
                if let Some(a) = after
                    && js_re!(r"en$", "u").test(&words[last])
                {
                    words[last] = apply_eifeler_regel(&words[last], &a);
                }
                for wd in &words {
                    sink.emit(&phonemize_word(wd));
                }
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) = DEF
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for LuxembourgishPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(LuxembourgishPhonemizer::text(self, input))
    }
}

/// `createLuxembourgish()`. Errors when the manifest cannot be loaded or the symbol tier refuses its data.
pub fn create_luxembourgish() -> Result<LuxembourgishPhonemizer, String> {
    try_def()?;
    try_numbers()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(LuxembourgishPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/luxembourgish.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["Haus"], Some("hˈæu̯s")),
        ("phonemizeWord", &["Kou"], Some("kˈəu̯")),
        ("phonemizeWord", &["Dréi"], Some("drˈei̯")),
        ("phonemizeWord", &["Méi"], Some("mˈei̯")),
        ("phonemizeWord", &["Waasser"], Some("vˈaːsər")),
        ("phonemizeWord", &["Buch"], Some("bˈuχ")),
        ("phonemizeWord", &["zéng"], Some("t͡sˈeːŋ")),
        ("phonemizeWord", &["Quell"], Some("kvˈæl")),
        ("phonemizeWord", &["Been"], Some("bˈeːn")),
        ("phonemizeWord", &["Strooss"], Some("ʃtrˈoːs")),
        ("phonemizeWord", &["Spill"], Some("ʃpˈil")),
        ("phonemizeWord", &["Sonn"], Some("zˈon")),
        ("phonemizeWord", &["Iesel"], Some("ˈiəzəl")),
        ("phonemizeWord", &["Belsch"], Some("bˈælʃ")),
        ("phonemizeWord", &["Decken"], Some("dˈækən")),
        ("phonemizeWord", &["Gemeng"], Some("ɡəmˈæŋ")),
        ("phonemizeWord", &["erfuerdert"], Some("ərfˈuərdərt")),
        ("phonemizeWord", &["veränneren"], Some("fərˈænərən")),
        ("phonemizeWord", &["Bett"], Some("bˈæt")),
        ("phonemizeWord", &["Becher"], Some("bəχˈær")),
        ("phonemizeWord", &["'t"], Some("t")),
        ("phonemizeWord", &["Flott"], Some("flˈot")),
        ("phonemizeWord", &["Hand"], Some("hˈant")),
        ("phonemizeWord", &["Abt"], Some("ˈapt")),
        ("phonemizeWord", &["Dag"], Some("dˈaχ")),
        ("phonemizeWord", &["Alg"], Some("ˈalk")),
        ("phonemizeWord", &["Bankrott"], Some("bˈaŋkrot")),
        ("phonemizeWord", &["Lager"], Some("lˈaʁər")),
        (
            "createLuxembourgish().text",
            &["Ech schwätzen Lëtzebuergesch."],
            Some("ˈæχ ʃvˈæt͡sən lˈət͡səbuərɡəʃ ."),
        ),
        ("numberToWords", &["0"], Some("null")),
        ("numberToWords", &["21"], Some("eenanzwanzeg")),
        ("numberToWords", &["31"], Some("eenandrësseg")),
        ("numberToWords", &["35"], Some("fënnefandrësseg")),
        ("numberToWords", &["45"], Some("fënnefavéierzeg")),
        ("numberToWords", &["55"], Some("fënnefafofzeg")),
        ("numberToWords", &["65"], Some("fënnefasiechzeg")),
        ("numberToWords", &["85"], Some("fënnefanachtzeg")),
        ("numberToWords", &["95"], Some("fënnefannonzeg")),
        ("numberToWords", &["100"], Some("honnert")),
        ("numberToWords", &["101"], Some("honnerteent")),
        (
            "numberToWords",
            &["555"],
            Some("fënnefhonnertfënnefafofzeg"),
        ),
        ("numberToWords", &["1000"], Some("dausend")),
        (
            "numberToWords",
            &["12345"],
            Some("zwielefdausend dräihonnertfënnefavéierzeg"),
        ),
        ("numberToWords", &["1000000"], Some("eng Millioun")),
        ("numberToWords", &["1000000000"], Some("eng Milliard")),
        (
            "createLuxembourgish().text",
            &["21"],
            Some("ˈeːnant͡svant͡səχ"),
        ),
        (
            "createLuxembourgish().text",
            &["45"],
            Some("fˈənəfafei̯ərt͡səχ"),
        ),
        ("ordinalStem", &["1"], Some("éischt")),
        ("ordinalStem", &["3"], Some("drëtt")),
        ("ordinalStem", &["7"], Some("siwent")),
        ("ordinalStem", &["8"], Some("aacht")),
        ("ordinalStem", &["19"], Some("nonzéngt")),
        ("ordinalStem", &["20"], Some("zwanzegst")),
        ("ordinalStem", &["24"], Some("véieranzwanzegst")),
        ("ordinalStem", &["100"], Some("honnertst")),
        (
            "ordinalStem",
            &["1922"],
            Some("dausend nénghonnertzweeanzwanzegst"),
        ),
        (
            "normalizeLuxembourgish",
            &["am 16. Joerhonnert"],
            Some("am siechzéngte Joerhonnert"),
        ),
        (
            "normalizeLuxembourgish",
            &["den 1. Dag vum Mount"],
            Some("den éischten Dag vum Mount"),
        ),
        (
            "normalizeLuxembourgish",
            &["den 3. August"],
            Some("den drëtten August"),
        ),
        (
            "normalizeLuxembourgish",
            &["de 14. Mäerz"],
            Some("de véierzéngte Mäerz"),
        ),
        (
            "normalizeLuxembourgish",
            &["op der 3. Plaz"],
            Some("op der drëtter Plaz"),
        ),
        (
            "normalizeLuxembourgish",
            &["den 190. vun der Lëscht"],
            Some("den honnertnonzegste vun der Lëscht"),
        ),
        (
            "normalizeLuxembourgish",
            &["Säin 1 000. Timber"],
            Some("Säin dausendsten Timber"),
        ),
        (
            "normalizeLuxembourgish",
            &["am 11., 12. an 13. Joerhonnert"],
            Some("am eeleften, zwieleften an dräizéngte Joerhonnert"),
        ),
        (
            "normalizeLuxembourgish",
            &["tëschent dem 10. bis 11. an dem 14. Joerhonnert"],
            Some("tëschent dem zéngte bis eeleften an dem véierzéngte Joerhonnert"),
        ),
        (
            "normalizeLuxembourgish",
            &["an Afghanistan 1979."],
            Some("an Afghanistan 1979."),
        ),
        (
            "normalizeLuxembourgish",
            &["am Joer 2020."],
            Some("am Joer 2020."),
        ),
        (
            "normalizeLuxembourgish",
            &["d'Wanterolympiad 2010."],
            Some("d'Wanterolympiad 2010."),
        ),
        (
            "normalizeLuxembourgish",
            &["Kapitel 5. Dat ass gutt"],
            Some("Kapitel 5. Dat ass gutt"),
        ),
        (
            "createLuxembourgish().text",
            &["an Afghanistan 1979."],
            Some("ˈan ˈafɡhanistan dˈæu̯zənt nˈeːŋhonərtneːŋazivənt͡səχ ."),
        ),
        (
            "normalizeLuxembourgish",
            &["vun 1.000 Dollar"],
            Some("vun 1000 Dollar"),
        ),
        (
            "normalizeLuxembourgish",
            &["um 7.19 Auer"],
            Some("um 7 Auer 19"),
        ),
        (
            "normalizeLuxembourgish",
            &["Den 802.11n-Standard"],
            Some("Den 802.11n-Standard"),
        ),
        (
            "normalizeLuxembourgish",
            &["Ofbildung 1.1."],
            Some("Ofbildung 1.1."),
        ),
        (
            "normalizeLuxembourgish",
            &["4.41,30"],
            Some("4 41 Komma 3 0"),
        ),
        ("normalizeLuxembourgish", &["7:2"], Some("7:2")),
        (
            "normalizeLuxembourgish",
            &["D'Endresultat war 21:20"],
            Some("D'Endresultat war 21:20"),
        ),
        (
            "normalizeLuxembourgish",
            &["mat 3:2 bezeechent"],
            Some("mat 3:2 bezeechent"),
        ),
        (
            "normalizeLuxembourgish",
            &["um 20.30 Auer Lokalzäit (15.00 UTC)"],
            Some("um 20 Auer 30 Lokalzäit (15 Auer UTC)"),
        ),
        (
            "normalizeLuxembourgish",
            &["Tëschent 22.00 an 23.00 Auer MDT"],
            Some("Tëschent 22 Auer an 23 Auer MDT"),
        ),
        (
            "normalizeLuxembourgish",
            &["E Samschdeg um 1.15 Auer"],
            Some("E Samschdeg um eng Auer 15"),
        ),
        (
            "normalizeLuxembourgish",
            &["tëschent 6.30 a 7.30 Auer"],
            Some("tëschent 6 Auer 30 a 7 Auer 30"),
        ),
        (
            "normalizeLuxembourgish",
            &["De Programm ass 20.30 lassgaangen"],
            Some("De Programm ass 20.30 lassgaangen"),
        ),
        (
            "normalizeLuxembourgish",
            &["12.5 Kilometer"],
            Some("12 Komma 5 Kilometer"),
        ),
        (
            "normalizeLuxembourgish",
            &["130.000 Yen"],
            Some("130000 Yen"),
        ),
        (
            "normalizeLuxembourgish",
            &["55 000 Barrellen"],
            Some("55000 Barrellen"),
        ),
        (
            "normalizeLuxembourgish",
            &["9\u{a0}000 Leit"],
            Some("9000 Leit"),
        ),
        (
            "normalizeLuxembourgish",
            &["4\u{202f}830 Kilometer"],
            Some("4830 Kilometer"),
        ),
        (
            "createLuxembourgish().text",
            &["9\u{a0}000"],
            Some("nˈeːŋdæu̯zənt"),
        ),
        (
            "normalizeLuxembourgish",
            &["1,5 Kilometer"],
            Some("1 Komma 5 Kilometer"),
        ),
        (
            "normalizeLuxembourgish",
            &["7,74 Meter"],
            Some("7 Komma 7 4 Meter"),
        ),
        (
            "normalizeLuxembourgish",
            &["Whistler (1.5 Fuerstonne)"],
            Some("Whistler (1 Komma 5 Fuerstonne)"),
        ),
        (
            "normalizeLuxembourgish",
            &["ofgeschloss, 12 Leit"],
            Some("ofgeschloss, 12 Leit"),
        ),
        (
            "normalizeLuxembourgish",
            &["(1894\u{a0}–\u{a0}1895)"],
            Some("(1894 bis 1895)"),
        ),
        (
            "normalizeLuxembourgish",
            &["vun 2\u{a0}–\u{a0}3 km Äis"],
            Some("vun 2 bis 3 km Äis"),
        ),
        (
            "normalizeLuxembourgish",
            &["7\u{a0}–\u{a0}8 Deeg"],
            Some("siwe bis 8 Deeg"),
        ),
        (
            "normalizeLuxembourgish",
            &["1000000\u{a0}–\u{a0}2000000"],
            Some("1000000 bis 2000000"),
        ),
        (
            "normalizeLuxembourgish",
            &["ers 1995\u{a0}–\u{a0}1996, pan"],
            Some("ers 1995 bis 1996, pan"),
        ),
        (
            "normalizeLuxembourgish",
            &["gëtt\u{a0}– duerch"],
            Some("gëtt\u{a0}– duerch"),
        ),
        (
            "normalizeLuxembourgish",
            &["5 mm (1/5 Zoll)"],
            Some("5 mm (ee Fënneftel Zoll)"),
        ),
        (
            "normalizeLuxembourgish",
            &["1/3 vum Land"],
            Some("een Drëttel vum Land"),
        ),
        (
            "normalizeLuxembourgish",
            &["1/4 Stonn"],
            Some("ee Véierel Stonn"),
        ),
        (
            "normalizeLuxembourgish",
            &["1/2 Zoll"],
            Some("een hallef Zoll"),
        ),
        (
            "normalizeLuxembourgish",
            &["3/4 vun der Zäit"],
            Some("dräi Véierel vun der Zäit"),
        ),
        (
            "normalizeLuxembourgish",
            &["2/3 vun de Leit"],
            Some("zwee Drëttel vun de Leit"),
        ),
        (
            "normalizeLuxembourgish",
            &["am 10. Joerhonnert v.\u{a0}Chr. ass"],
            Some("am zéngte Joerhonnert vir Christus ass"),
        ),
        (
            "normalizeLuxembourgish",
            &["(1000\u{a0}–\u{a0}1300 n.\u{a0}Chr.)"],
            Some("(1000 bis 1300 no Christus)"),
        ),
        (
            "normalizeLuxembourgish",
            &["z.\u{a0}B. de Pennsylvania Wilds"],
            Some("zum Beispill de Pennsylvania Wilds"),
        ),
        (
            "normalizeLuxembourgish",
            &["Kéis, Thon asw."],
            Some("Kéis, Thon an sou weider."),
        ),
        (
            "normalizeLuxembourgish",
            &["Nëss, Iessen asw., déi"],
            Some("Nëss, Iessen an sou weider, déi"),
        ),
        (
            "normalizeLuxembourgish",
            &["den Dr. Damadian"],
            Some("den Dokter Damadian"),
        ),
        (
            "normalizeLuxembourgish",
            &["Six Flags St. Louis"],
            Some("Six Flags St. Louis"),
        ),
        (
            "normalizeLuxembourgish",
            &["bei 32\u{a0}°C Hëtzt"],
            Some("bei 32 Grad Celsius Hëtzt"),
        ),
        (
            "normalizeLuxembourgish",
            &["12\u{a0}°F"],
            Some("12 Grad Fahrenheit"),
        ),
        (
            "normalizeLuxembourgish",
            &["iwwer +30 Grad Celsius"],
            Some("iwwer plus 30 Grad Celsius"),
        ),
        ("normalizeLuxembourgish", &["(UTC+1)"], Some("(UTC plus 1)")),
        (
            "normalizeLuxembourgish",
            &["Typ-1-Diabetes an COVID-19"],
            Some("Typ-1-Diabetes an COVID-19"),
        ),
        (
            "normalizeLuxembourgish",
            &["Standard-35-mm-Film"],
            Some("Standard-35-mm-Film"),
        ),
        (
            "normalizeLuxembourgish",
            &["50 Kilometer (31 Meile) vu Buenos Aires"],
            Some("50 Kilometer (31 Meile) vu Buenos Aires"),
        ),
        (
            "createLuxembourgish().text",
            &["20 km (15 Meilen) nord"],
            Some("t͡svˈant͡səχ kˈilomətər fˈoft͡seːŋ mˈai̯lən nˈort"),
        ),
        (
            "createLuxembourgish().text",
            &["20 Kilometer (15 Meilen) nord"],
            Some("t͡svˈant͡səχ kˈilomətər fˈoft͡seːŋ mˈai̯lən nˈort"),
        ),
        (
            "normalizeLuxembourgish",
            &["165 km/h (105 Meile/h)"],
            Some("165 km/h (105 Meilen an der Stonn)"),
        ),
        (
            "normalizeLuxembourgish",
            &["300 mph"],
            Some("300 Meilen an der Stonn"),
        ),
        (
            "createLuxembourgish().text",
            &["19 500 km²"],
            Some("nˈont͡seːŋdæu̯zənt fˈənəfhonərt kvˈadratkilomətər"),
        ),
        (
            "createLuxembourgish().text",
            &["19500 Quadratkilometer"],
            Some("nˈont͡seːŋdæu̯zənt fˈənəfhonərt kvˈadratkilomətər"),
        ),
        (
            "createLuxembourgish().text",
            &["5 m²"],
            Some("fˈənəf kvˈadratmətər"),
        ),
        (
            "createLuxembourgish().text",
            &["5 Quadratmeter"],
            Some("fˈənəf kvˈadratmətər"),
        ),
        (
            "createLuxembourgish().text",
            &["7 m³"],
            Some("zˈivə kˈubikmətər"),
        ),
        (
            "createLuxembourgish().text",
            &["7 Kubikmeter"],
            Some("zˈivə kˈubikmətər"),
        ),
        (
            "normalizeLuxembourgish",
            &["College of Arts & Sciences"],
            Some("College of Arts an Sciences"),
        ),
        ("normalizeLuxembourgish", &["x = y"], Some("x ass gläich y")),
        (
            "normalizeLuxembourgish",
            &["5 < 6"],
            Some("5 méi kleng ewéi 6"),
        ),
        (
            "normalizeLuxembourgish",
            &["7 > 6"],
            Some("7 méi grouss ewéi 6"),
        ),
        ("normalizeLuxembourgish", &["6 × 6 cm"], Some("6 mol 6 cm")),
        (
            "normalizeLuxembourgish",
            &["12 ÷ 4"],
            Some("12 dividéiert duerch 4"),
        ),
        ("normalizeLuxembourgish", &["4x4"], Some("4x4")),
        (
            "createLuxembourgish().text",
            &["88\u{202f}%"],
            Some("ˈaːχtanaχt͡səχ prˈot͡sənt"),
        ),
        (
            "createLuxembourgish().text",
            &["88 Prozent"],
            Some("ˈaːχtanaχt͡səχ prˈot͡sənt"),
        ),
        (
            "createLuxembourgish().text",
            &["30\u{202f}$"],
            Some("drˈəsəχ dˈolar"),
        ),
        (
            "createLuxembourgish().text",
            &["30 Dollar"],
            Some("drˈəsəχ dˈolar"),
        ),
        (
            "createLuxembourgish().text",
            &["165 km/h"],
            Some("hˈonərtfənəfaziəχt͡səχ kˈilomətər ˈan dˈær ʃtˈon"),
        ),
        (
            "createLuxembourgish().text",
            &["165 Kilometer an der Stonn"],
            Some("hˈonərtfənəfaziəχt͡səχ kˈilomətər ˈan dˈær ʃtˈon"),
        ),
        (
            "createLuxembourgish().text",
            &["133 m/s"],
            Some("hˈonərtdræiandrəsəχ mˈætər prˈo zˈækon"),
        ),
        (
            "createLuxembourgish().text",
            &["133 Meter pro Sekonn"],
            Some("hˈonərtdræiandrəsəχ mˈætər prˈo zˈækon"),
        ),
        (
            "createLuxembourgish().text",
            &["7 cm"],
            Some("zˈivən t͡səntˈimətər"),
        ),
        (
            "createLuxembourgish().text",
            &["7 Zentimeter"],
            Some("zˈivən t͡səntˈimətər"),
        ),
        (
            "createLuxembourgish().text",
            &["0 kg"],
            Some("nˈul kˈiloɡram"),
        ),
        (
            "createLuxembourgish().text",
            &["0 Kilogramm"],
            Some("nˈul kˈiloɡram"),
        ),
        (
            "getPhonemizer(\"lb\").text",
            &["Kloteren a Sprangen – erfuerdert awer Training."],
            Some("klˈotərən ˈa ʃprˈaŋən , ərfˈuərdərt ˈavər trˈai̯niŋ ."),
        ),
        (
            "normalizeLuxembourgish",
            &["vun 2 – 3 km"],
            Some("vun 2 bis 3 km"),
        ),
        (
            "getPhonemizer(\"lb\").text",
            &["Et sinn 7 Kilometer."],
            Some("ˈæt zˈin zˈivə kˈilomətər ."),
        ),
        (
            "getPhonemizer(\"lb\").text",
            &["Et sinn 7 Deeg."],
            Some("ˈæt zˈin zˈivən dˈeːχ ."),
        ),
        (
            "getPhonemizer(\"lb\").text",
            &["Et sinn 7 Auer."],
            Some("ˈæt zˈin zˈivən ˈæu̯ər ."),
        ),
        (
            "getPhonemizer(\"lb\").text",
            &["Et sinn 7."],
            Some("ˈæt zˈin zˈivən ."),
        ),
        (
            "getPhonemizer(\"lb\").text",
            &["Et sinn 1000000 Kilometer."],
            Some("ˈæt zˈin ˈæŋ mˈiliəu̯n kˈilomətər ."),
        ),
        (
            "getPhonemizer(\"lb\").text",
            &["iwwer 2,2 Millioune km² vum Ozean"],
            Some("ˈivər t͡svˈeː kˈoma t͡svˈeː mˈiliəu̯nə kvˈadratkilomətər fˈum ˈot͡səan"),
        ),
        (
            "phonemize",
            &["9007199254740993", "lb"],
            Some(
                "nˈeːŋ nˈul nˈul zˈivən ˈeːnt nˈeːŋ nˈeːŋ t͡svˈeː fˈənəf fˈei̯ər zˈivən fˈei̯ər nˈul nˈeːŋ nˈeːŋ drˈæi",
            ),
        ),
        (
            "phonemize",
            &["1000000000000000000000", "lb"],
            Some(
                "ˈeːnt nˈul nˈul nˈul nˈul nˈul nˈul nˈul nˈul nˈul nˈul nˈul nˈul nˈul nˈul nˈul nˈul nˈul nˈul nˈul nˈul nˈul",
            ),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_luxembourgish().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString, n: usize| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeLuxembourgish" => Some(e.normalize(&a(0))),
                "ordinalStem" => e.ordinal_stem(js_number(&a(0))),
                "numberToWords" => {
                    Some(e.number_to_words(js_number(&a(0)), (n > 1).then(|| a(1)).as_ref()))
                }
                "createLuxembourgish().text" => Some(e.text(&a(0))),
                "getPhonemizer(\"lb\").text" => {
                    Some(crate::registry::phonemize_in("lb", &a(0)).unwrap())
                }
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
