//! Norwegian Bokmål (nb) phonemizer: the NST lexicon first, then (best path only) the neural OOV tagger, then a
//! left-to-right rule g2p (complementary length on the first syllable, front-vowel softening, digraphs, silent
//! digraphs, retroflex r + coronal, silent final ⟨d⟩, geminates) with first-syllable stress; and text() over Latin
//! words (a foreign name nativised), numbers and clause punctuation.
//! Ported from src/languages/norwegian/norwegian.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::manifest::{DIR, MANIFEST, try_manifest};
use super::normalize::{SYMBOLS, normalize_norwegian};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::make_nativiser;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};
use crate::core::normalize_symbols::SymbolNormalizer;
use crate::core::numbers::{render_number, spell_digits, western_number_words};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;

/// `nat`: Norwegian's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[A-Za-zÆØÅæøåÉéÈèÊêËëÀàÂâÔôÜü]", "u")));

/// `nat(word)`.
pub fn nat(word: &JsString) -> JsString {
    NAT(word)
}

/// `lexicon()`: each key also filed under its nativised spelling (#1068).
pub fn try_lexicon() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static L: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&L, || {
        let fold = |k: &JsString| NAT(k);
        load_tsv_strings(
            DIR,
            "nb-lexicon.tsv",
            TsvOptions {
                optional: true,
                fold: Some(&fold),
            },
        )
        .map_err(|e| e.to_string())
    })
}

/// ⚠ Reached only through a checked path (a `NorwegianPhonemizer`, whose constructor loads it).
pub fn lexicon() -> &'static IndexMap<JsString, JsString> {
    try_lexicon().unwrap_or_else(|e| panic!("{e}"))
}

const VOWEL_LETTERS: &str = "aeiouyæøåéèêëàâôü";

fn in_str(set: &str, u: u16) -> bool {
    set.encode_utf16().any(|x| x == u)
}

/// `isV(c)` over one code unit.
fn is_v(u: Option<u16>) -> bool {
    u.is_some_and(|u| in_str(VOWEL_LETTERS, u))
}

/// `isFront(c)` over one code unit.
fn is_front(u: Option<u16>) -> bool {
    static FRONT: LazyLock<JsString> = LazyLock::new(|| js(&MANIFEST.front_vowels).to_lower_case());
    u.is_some_and(|u| FRONT.units().contains(&u))
}

fn get<'a>(map: &'a IndexMap<String, String>, key: &JsString) -> Option<&'a String> {
    map.get(&key.to_string_lossy())
}

/// `stressedLong(w, i)`, over code units.
fn stressed_long(w: &[u16], i: usize) -> bool {
    let mut j = i + 1;
    let mut count = 0;
    while j < w.len() && !is_v(Some(w[j])) {
        if w[j] == b'r' as u16 && j + 1 < w.len() && in_str("tnlsd", w[j + 1]) {
            count += 1;
            j += 2;
        } else if w[j] == b'x' as u16 {
            count += 2;
            j += 1;
        } else {
            count += 1;
            j += 1;
        }
    }
    count <= 1
}

/// `toSegments(word)`: the scan walks UTF-16 code units (`w[i]`, `w.length`).
fn to_segments(word: &JsString) -> Vec<JsString> {
    let lw = word.to_lower_case();
    let w = lw.units();
    let n = w.len();
    let at = |k: usize| w.get(k).copied();
    let slice = |a: usize, len: usize| JsString::from_units(&w[a.min(n)..(a + len).min(n)]);
    let unit = |u: u16| JsString::from_units(&[u]);
    let mut out: Vec<JsString> = Vec::new();
    let mut i = 0;
    let mut vowel_ord = 0;
    while i < n {
        let c = w[i];
        let nx = at(i + 1);
        let nx2 = at(i + 2);
        let two = slice(i, 2);
        let three = slice(i, 3);

        let four = slice(i, 4);
        if i > 0 && (four == "sjon" || four == "tion") {
            out.extend([js("ʃ"), js("uː"), js("n")]);
            vowel_ord += 1;
            i += 4;
            continue;
        }

        if is_v(Some(c)) {
            if vowel_ord > 0 && c == b'e' as u16 {
                out.push(js("ə"));
                vowel_ord += 1;
                i += 1;
                continue;
            }
            let long = vowel_ord == 0 && stressed_long(w, i);
            let before_r = nx == Some(b'r' as u16);
            let v = &MANIFEST.vowels;
            let key = unit(c);
            // `(beforeR && LBR[c]) || LONG[c]!`: an empty before-r entry falls through as well as a missing one.
            let (br, plain) = if long {
                (&v.long_before_r, &v.long)
            } else {
                (&v.short_before_r, &v.short)
            };
            let ph = before_r
                .then(|| get(br, &key))
                .flatten()
                .filter(|p| !p.is_empty())
                .or_else(|| get(plain, &key))
                .expect("every vowel letter has a long and a short reading");
            out.push(js(ph));
            vowel_ord += 1;
            i += 1;
            continue;
        }

        if i == 0 && nx == Some(b'j' as u16) && in_str("hgld", c) {
            out.push(js("j"));
            i += 2;
            continue;
        }

        // `DIG[three]`: at the word end `three` may be only two units, so a final two-letter digraph is claimed
        // here, whole, as ONE segment.
        if let Some(d) = get(&MANIFEST.digraphs, &three).filter(|d| !d.is_empty()) {
            out.push(js(d));
            i += 3;
            continue;
        }

        if two == "sk" && vowel_ord == 0 && is_front(nx2) {
            out.push(js("ʃ"));
            i += 2;
            continue;
        }

        if c == b'r' as u16
            && let Some(r) = get(&MANIFEST.retroflex, &two).filter(|r| !r.is_empty())
        {
            out.push(js(r));
            i += 2;
            continue;
        }

        // `for (const ch of DIG[two])`: one segment per CODE POINT.
        if let Some(d) = get(&MANIFEST.digraphs, &two).filter(|d| !d.is_empty()) {
            out.extend(js(d).code_point_strings());
            i += 2;
            continue;
        }

        if vowel_ord == 0 && (c == b'k' as u16 || c == b'g' as u16) && is_front(nx) {
            out.push(js(if c == b'k' as u16 { "ç" } else { "j" }));
            i += 1;
            continue;
        }

        if c == b'd' as u16
            && i == n - 1
            && i > 0
            && (is_v(Some(w[i - 1])) || in_str("lnr", w[i - 1]))
        {
            i += 1;
            continue;
        }

        if Some(c) == nx && !is_v(Some(c)) {
            let cons = get(&MANIFEST.consonants, &unit(c)).filter(|p| !p.is_empty());
            out.push(if c == b'g' as u16 {
                js("ɡː")
            } else if c == b'k' as u16 {
                js("kː")
            } else if let Some(p) = cons {
                js(p).concat(&js("ː"))
            } else {
                unit(c)
            });
            i += 2;
            continue;
        }

        if let Some(p) = get(&MANIFEST.consonants, &unit(c)).filter(|p| !p.is_empty()) {
            out.push(js(p));
        }
        i += 1;
    }
    out
}

/// `phonemizeWordRules(word)`: first-syllable stress over the segmental scan.
pub fn phonemize_word_rules(word: &JsString) -> JsString {
    let segs = to_segments(word);
    let vowel = js_re!(r"[ɑaeɛiɪoɔuʉʊyʏøœæ]", "u");
    let join = |s: &[JsString]| JsString::join(s, &JsString::new());
    let Some(first_v) = segs.iter().position(|p| vowel.test(p)) else {
        return join(&segs);
    };
    let mut onset = first_v;
    while onset > 0 && !js_re!(r"[ɑaeɛiɪoɔuʉʊyʏøœæ]", "u").test(&segs[onset - 1]) {
        onset -= 1;
    }
    join(&segs[..onset])
        .concat(&js("ˈ"))
        .concat(&join(&segs[onset..]))
}

/// `OovResolver`: word → IPA, or `None` to defer to the rule engine.
pub type OovResolver<'a> = &'a dyn Fn(&JsString) -> Option<JsString>;

/// `phonemizeWord(word, oovOverride)`: lexicon → override → rules.
pub fn phonemize_word(word: &JsString, oov: Option<OovResolver>) -> JsString {
    if let Some(hit) = lexicon().get(&word.to_lower_case()) {
        return hit.clone();
    }
    if let Some(r) = oov.and_then(|f| f(word)) {
        return r;
    }
    phonemize_word_rules(word)
}

/// `number(digits, oovOverride)`: an unsafe integer is read digit at a time. The number words take the OOV
/// override too (#1578): 8 of the 42 are outside the lexicon (`tohundre` … `nihundre`).
fn number(digits: &JsString, oov: Option<OovResolver>) -> JsString {
    let nn = js_number(digits);
    let word = |w: &str| phonemize_word(&js(w), oov).to_string_lossy();
    if !is_safe_integer(nn) {
        return js(&spell_digits(
            &digits.to_string_lossy(),
            &MANIFEST.numbers,
            &word,
        ));
    }
    js(&render_number(
        nn as u64,
        &MANIFEST.numbers,
        &word,
        western_number_words,
    ))
}

const NB_LETTER: &str = r"(?!\p{Nd})[\p{Script=Latin}]";

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let word = format!("{NB_LETTER}(?:{NB_LETTER}|\\p{{M}}|['’](?={NB_LETTER}))*");
    JsRegex::new(&format!(r"({word})|(\d+)|([.?!,;:…—])"), "gu").unwrap()
});

/// The Norwegian Bokmål engine (`createNorwegian`).
pub struct NorwegianPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `NorwegianPhonemizer` proves the manifest, the
/// lexicon and the symbol tier loaded. (The per-module differentials call them.)
impl NorwegianPhonemizer {
    /// `normalizeNorwegian(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_norwegian(self.symbols, text)
    }

    /// `phonemizeWordRules(word)`.
    pub fn phonemize_word_rules(&self, word: &JsString) -> JsString {
        phonemize_word_rules(word)
    }

    /// `phonemizeWord(word)` (no override).
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word, None)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        nat(word)
    }

    /// `number(digits)` (norwegian.ts).
    pub fn number(&self, digits: &JsString) -> JsString {
        number(digits, None)
    }

    /// `text(input, oovOverride)`.
    pub fn text(&self, input: &JsString, oov: Option<OovResolver>) -> JsString {
        assemble_clauses(&self.normalize(input), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&nat(&w), oov));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                sink.emit(&number(&d, oov));
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

impl Engine for NorwegianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(NorwegianPhonemizer::text(self, input, None))
    }

    fn neural(&self, pre_passed: &JsString) -> Option<Result<JsString, PhonemizeError>> {
        use super::{norwegian_neural::phonemize_nb_neural, norwegian_tagger::norwegian_tagger};
        Some(
            phonemize_nb_neural(self, norwegian_tagger(), pre_passed)
                .map_err(PhonemizeError::Neural),
        )
    }

    fn has_neural(&self) -> bool {
        true
    }
}

/// `createNorwegian()`. Errors when the manifest or the lexicon cannot be loaded, or the symbol tier refuses its
/// data.
pub fn create_norwegian() -> Result<NorwegianPhonemizer, String> {
    try_manifest()?;
    try_lexicon()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(NorwegianPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/norwegian.test.ts and test/nbNeural.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWordRules", &["bok"], Some("ˈbuːk")),
        ("phonemizeWordRules", &["hus"], Some("ˈhʉːs")),
        ("phonemizeWordRules", &["norsk"], Some("ˈnɔʂk")),
        ("phonemizeWordRules", &["hånd"], Some("ˈhɔn")),
        ("phonemizeWordRules", &["år"], Some("ˈoːɾ")),
        ("phonemizeWordRules", &["fôr"], Some("ˈfuːɾ")),
        ("phonemizeWordRules", &["sjø"], Some("ˈʃøː")),
        ("phonemizeWordRules", &["kjøre"], Some("ˈçøːɾə")),
        ("phonemizeWordRules", &["gjøre"], Some("ˈjøːɾə")),
        ("phonemizeWordRules", &["hva"], Some("ˈʋɑː")),
        ("phonemizeWordRules", &["ski"], Some("ˈʃiː")),
        ("phonemizeWordRules", &["barn"], Some("ˈbɑːɳ")),
        ("phonemizeWordRules", &["god"], Some("ˈɡuː")),
        ("phonemizeWordRules", &["jord"], Some("ˈjuːɾ")),
        ("phonemizeWordRules", &["Bergen"], Some("ˈbæɾɡən")),
        ("phonemizeWordRules", &["idé"], Some("ˈiːdeː")),
        ("phonemizeWord", &["absorbere"], Some("ɑbsɔɾˈbeːɾə")),
        ("phonemizeWord", &["stasjon"], Some("stɑˈʃuːn")),
        ("phonemizeWord", &["er"], Some("ˈæːɾ")),
        ("createNorwegian().text", &["0"], Some("ˈnʊl")),
        ("createNorwegian().text", &["7"], Some("ˈʃʉː")),
        ("createNorwegian().text", &["100"], Some("ˈhʊndɾə")),
        ("createNorwegian().text", &["1000"], Some("ˈtʉːsn")),
        (
            "createNorwegian().text",
            &["1000000"],
            Some("ˈeːn mɪlɪˈuːn"),
        ),
        (
            "createNorwegian().text",
            &["2000000"],
            Some("ˈtuː mɪlɪˈuːnəɾ"),
        ),
        (
            "createNorwegian().text",
            &["1000000000"],
            Some("ˈeːn mɪlɪˈɑːɖ"),
        ),
        (
            "createNorwegian().text",
            &["3000000000"],
            Some("ˈtɾeː mɪlɪˈɑɖəɾ"),
        ),
        (
            "createNorwegian().text",
            &["21000000"],
            Some("ˈtjʉːə ˈeːn mɪlɪˈuːnəɾ"),
        ),
        ("createNorwegian().text", &["2000"], Some("ˈtuː ˈtʉːsn")),
        (
            "createNorwegian().text",
            &["Norsk er et språk."],
            Some("ˈnɔʂk ˈæːɾ ˈɛt ˈspɾoːk ."),
        ),
        (
            "createNorwegian().text",
            &["O'Shannessy"],
            Some("ˈɔshɑnːəsːʏ"),
        ),
        ("createNorwegian().text", &["l'Oyapock"], Some("ˈluːʏɑpɔkː")),
        (
            "createNorwegian().text",
            &["President's"],
            Some("ˈpɾeːsɪdənts"),
        ),
        (
            "createNorwegian().text",
            &["Anders' bok"],
            Some("ˈɑnəʂ ˈbuːk"),
        ),
        (
            "createNorwegian().text",
            &["Han sa 'nei'"],
            Some("ˈhɑn ˈsɑː ˈnæɪ"),
        ),
        ("normalizeNorwegian", &["5 000 000"], Some("5000000")),
        ("normalizeNorwegian", &["1 250"], Some("1250")),
        ("normalizeNorwegian", &["12,5"], Some("12 komma 5")),
        ("normalizeNorwegian", &["1,25"], Some("1 komma 2 5")),
        ("normalizeNorwegian", &["23,764"], Some("23764")),
        ("normalizeNorwegian", &["291,773"], Some("291773")),
        ("normalizeNorwegian", &["kl. 14:30"], Some("klokka 14 30")),
        ("normalizeNorwegian", &["25 %"], Some("25 prosent")),
        ("normalizeNorwegian", &["20 °C"], Some("20 grader celsius")),
        (
            "normalizeNorwegian",
            &["23 km²"],
            Some("23 kvadratkilometer"),
        ),
        ("normalizeNorwegian", &["3. mai"], Some("tredje mai")),
        (
            "normalizeNorwegian",
            &["15. århundre"],
            Some("femtende århundre"),
        ),
        (
            "normalizeNorwegian",
            &["I 1990. Han kom"],
            Some("I 1990. Han kom"),
        ),
        ("normalizeNorwegian", &["802.11n"], Some("802.11n")),
        (
            "normalizeNorwegian",
            &["24.08.2021"],
            Some("tjuefjerde august 2021"),
        ),
        ("normalizeNorwegian", &["1990-1995"], Some("1990 til 1995")),
        ("normalizeNorwegian", &["-5 grader"], Some("minus 5 grader")),
        ("normalizeNorwegian", &["¥2500"], Some("2500 yen")),
        (
            "normalizeNorwegian",
            &["+30°C"],
            Some("pluss 30 grader celsius"),
        ),
        ("normalizeNorwegian", &["UTC +1"], Some("UTC pluss 1")),
        (
            "normalizeNorwegian",
            &["10.–11. århundre"],
            Some("tiende til ellevte århundre"),
        ),
        (
            "normalizeNorwegian",
            &["ca. 220 mennesker"],
            Some("cirka 220 mennesker"),
        ),
        (
            "createNorwegian().text",
            &["ca. én cent"],
            Some("ˈsɪɾkɑ ˈeːn ˈsɛnt"),
        ),
        (
            "normalizeNorwegian",
            &["Costa Rica. Deretter"],
            Some("Costa Rica. Deretter"),
        ),
        (
            "createNorwegian().text",
            &["Piquet jr. i Singapore"],
            Some("ˈpiːkʉət ˈjʉːnɪʊɾ ˈiː ˈsɪŋɑˌpoːɾ"),
        ),
        (
            "normalizeNorwegian",
            &["323 f.Kr. etter"],
            Some("323 før Kristus etter"),
        ),
        (
            "normalizeNorwegian",
            &["1000 år f.kr"],
            Some("1000 år før Kristus"),
        ),
        (
            "normalizeNorwegian",
            &["5000 f.Kr!"],
            Some("5000 før Kristus!"),
        ),
        (
            "normalizeNorwegian",
            &["400 e.kr til"],
            Some("400 etter Kristus til"),
        ),
        (
            "normalizeNorwegian",
            &["100 e.Kr."],
            Some("100 etter Kristus"),
        ),
        (
            "createNorwegian().text",
            &["323 f.Kr."],
            Some("ˈtɾeːhʉndɾə ˈtjʉːə ˈtɾeː ˈføːɾ ˈkɾɪstʊs"),
        ),
        ("normalizeNorwegian", &["f.Kristian"], Some("f.Kristian")),
        (
            "normalizeNorwegian",
            &["¥2500 og ¥130 000"],
            Some("2500 yen og 130000 yen"),
        ),
        (
            "normalizeNorwegian",
            &["$5 og noe"],
            Some("5 dollar og noe"),
        ),
        (
            "createNorwegian().text",
            &["mellom ¥2500 og"],
            Some("ˈmɛlɔm ˈtuː ˈtʉːsn ˈfɛmhʉndɾə ˈjɛn ˈoːɡ"),
        ),
        (
            "normalizeNorwegian",
            &["Norsk er et språk."],
            Some("Norsk er et språk."),
        ),
        (
            "createNorwegian().text",
            &["160 km/t"],
            Some("ˈhʊndɾə ˈsɛkstɪ ˈçiːlʊˌmeːtəɾ ˈiː ˈtiːmən"),
        ),
        (
            "createNorwegian().text",
            &["133 m/s"],
            Some("ˈhʊndɾə ˈtɾɛtɪ ˈtɾeː ˈmeːtəɾ ˈiː səˈkʊnə"),
        ),
        ("createNorwegian().text", &["5 m"], Some("ˈfɛm ˈmeːtəɾ")),
        (
            "createNorwegian().text",
            &["35 mm"],
            Some("ˈtɾɛtɪ ˈfɛm ˈmɪlɪˌmeːtəɾ"),
        ),
        (
            "createNorwegian().text",
            &["5 km²"],
            Some("ˈfɛm kʋɑˈdɾɑːtçɪlʊˌmeːtəɾ"),
        ),
        (
            "phonemizeNbNeural",
            &["Norsk er et språk."],
            Some("ˈnɔʂk ˈæːɾ ˈɛt ˈspɾoːk ."),
        ),
        (
            "phonemize",
            &["Norsk er et språk.", "nb"],
            Some("ˈnɔʂk ˈæːɾ ˈɛt ˈspɾoːk ."),
        ),
        (
            "phonemizeNbNeural",
            &["Jeg har en bok."],
            Some("ˈjæɪ ˈhɑːɾ ˈeːn ˈbuːk ."),
        ),
        (
            "phonemize",
            &["Jeg har en bok.", "nb"],
            Some("ˈjæɪ ˈhɑːɾ ˈeːn ˈbuːk ."),
        ),
        (
            "phonemizeNbNeural",
            &["Det er 100 hus."],
            Some("ˈdeː ˈæːɾ ˈhʊndɾə ˈhʉːs ."),
        ),
        (
            "phonemize",
            &["Det er 100 hus.", "nb"],
            Some("ˈdeː ˈæːɾ ˈhʊndɾə ˈhʉːs ."),
        ),
        (
            "phonemizeNbNeural",
            &["Kvantekromodynamikken forbløffer."],
            Some("ˈkʋɑntəkɾʊmʊdʏnɑˌmɪkən fɔɾˈblœfəɾ ."),
        ),
        (
            "phonemize",
            &["Kvantekromodynamikken forbløffer.", "nb"],
            Some("ˈkʋɑntəkɾɔmɔdʏnɑmɪkːən fɔɾˈblœfəɾ ."),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_norwegian().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWordRules" => Some(e.phonemize_word_rules(&a(0))),
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeNorwegian" => Some(e.normalize(&a(0))),
                "createNorwegian().text" => Some(e.text(&a(0), None)),
                "phonemizeNbNeural" => Some(
                    super::super::norwegian_neural::phonemize_nb_neural(
                        &e,
                        super::super::norwegian_tagger::norwegian_tagger(),
                        &a(0),
                    )
                    .unwrap(),
                ),
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
}
