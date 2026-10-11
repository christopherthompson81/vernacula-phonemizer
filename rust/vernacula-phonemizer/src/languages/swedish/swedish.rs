//! Swedish (sv) phonemizer: the rule g2p with the NST accent/stress lexicon (pitch accent 1/2 as a grave on
//! the primary vowel, non-initial stress, compound secondary stress), an OOV accent rule, and text() over
//! words, numbers and punctuation. Ported from src/languages/swedish/swedish.ts — see that file for the
//! corpus evidence.

use std::collections::HashMap;
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::g2p::{Compound, Seg, to_segments};
use super::manifest::{DIR, MANIFEST, try_manifest};
use super::normalize::{is_unreadable_swedish, normalize_swedish, normalize_swedish_initialisms};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::make_nativiser;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_map};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{Form, normalize};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

const GRAVE: u16 = 0x0300;

static EXCEPTIONS: LazyLock<HashMap<JsString, JsString>> = LazyLock::new(|| {
    MANIFEST
        .exceptions
        .iter()
        .map(|(k, v)| (js(k), js(v)))
        .collect()
});

/// One `accent-stress.tsv` row, as the TS parses it.
#[derive(Debug, Clone)]
pub struct LexEntry {
    pub accent: JsString,
    pub ord: Option<f64>,
    pub o_long: bool,
    pub sec_ord: Option<f64>,
    pub long_ords: Option<Vec<f64>>,
    pub sec_vowel_initial: bool,
}

fn parse_entry(rest: &JsString) -> LexEntry {
    let parts = rest.split(&js("\t"));
    let tokens = &parts[1..];
    let find = |re: &JsRegex| tokens.iter().find(|t| re.test(t));
    let ord_tok = find(js_re!(r"^\d+$", ""));
    let sec_tok = find(js_re!(r"^s\d+$", ""));
    let long_tok = find(js_re!(r"^L[\d,]+$", ""));
    LexEntry {
        accent: parts[0].clone(),
        ord: ord_tok.map(js_number),
        o_long: tokens.iter().any(|t| *t == "o"),
        sec_ord: sec_tok.map(|t| js_number(&t.slice(1, None))),
        long_ords: long_tok.map(|t| {
            t.slice(1, None)
                .split(&js(","))
                .iter()
                .map(js_number)
                .collect()
        }),
        sec_vowel_initial: tokens.iter().any(|t| *t == "vi"),
    }
}

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: Swedish's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[a-zåäöéA-ZÅÄÖÉ]", "u")));

/// `lexicon()`: each key also filed under its nativised spelling (#1068).
pub fn try_lexicon() -> Result<&'static IndexMap<JsString, LexEntry>, String> {
    static L: OnceLock<IndexMap<JsString, LexEntry>> = OnceLock::new();
    load_once(&L, || {
        let fold = |k: &JsString| NAT(k);
        load_tsv_map(
            DIR,
            "accent-stress.tsv",
            |v, _| Some(parse_entry(v)),
            TsvOptions {
                optional: true,
                fold: Some(&fold),
            },
        )
        .map_err(|e| e.to_string())
    })
}

fn lexicon() -> &'static IndexMap<JsString, LexEntry> {
    try_lexicon().unwrap_or_else(|e| panic!("{e}"))
}

/// `oovAccent(nuclei, stressOrd)`.
fn oov_accent(nuclei: usize, stress_ord: f64) -> &'static str {
    if nuclei > 1 && stress_ord == 0.0 {
        "2"
    } else {
        "1"
    }
}

fn nuclei_of(segs: &[Seg]) -> usize {
    segs.iter().filter(|s| s.vowel).count()
}

/// `phonemizeWord(word)`.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let w = normalize(&word.to_lower_case(), Form::Nfc);
    if let Some(exc) = EXCEPTIONS.get(&w) {
        return exc.clone();
    }

    let lex = lexicon().get(&w);
    let raw_ord = lex.and_then(|l| l.ord).unwrap_or(0.0);
    let o_long = lex.is_some_and(|l| l.o_long);
    let nuclei_probe = nuclei_of(&to_segments(&w, raw_ord, o_long, None)) as f64;
    let compound: Option<Compound> = lex.and_then(|l| {
        let sec = l.sec_ord?;
        (sec != raw_ord && sec < nuclei_probe).then(|| Compound {
            sec_ord: sec,
            long_ords: l.long_ords.clone().unwrap_or_default(),
            sec_vowel_initial: l.sec_vowel_initial,
        })
    });
    let mut segs = to_segments(&w, raw_ord, o_long, compound.as_ref());
    let nuclei = nuclei_of(&segs);
    if nuclei == 0 {
        let parts: Vec<JsString> = segs.iter().map(|s| s.ph.clone()).collect();
        return JsString::join(&parts, &JsString::new());
    }

    let ord = raw_ord.min((nuclei - 1) as f64);
    if ord != raw_ord {
        segs = to_segments(&w, ord, o_long, compound.as_ref());
    }
    let accent = lex.map_or_else(|| js(oov_accent(nuclei, ord)), |l| l.accent.clone());

    let mut out = JsString::new();
    let mut seen = 0.0_f64;
    for s in &segs {
        if s.vowel {
            if seen == ord && nuclei > 1 {
                out.push_str(&js("ˈ"));
                if accent == "2" {
                    let u = s.ph.units();
                    // `s.ph[0]! + GRAVE + s.ph.slice(1)`: the first CODE UNIT.
                    out.push_units(&u[..1]);
                    out.push_units(&[GRAVE]);
                    out.push_units(&u[1..]);
                } else {
                    out.push_str(&s.ph);
                }
            } else if compound.as_ref().is_some_and(|c| seen == c.sec_ord) {
                out.push_str(&js("ˌ"));
                out.push_str(&s.ph);
            } else {
                out.push_str(&s.ph);
            }
            seen += 1.0;
        } else {
            out.push_str(&s.ph);
        }
    }
    normalize(&out, Form::Nfc)
}

const SV_LETTER: &str = r"(?!\p{Nd})[\p{Script=Latin}]";

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let word = format!("{SV_LETTER}(?:{SV_LETTER}|\\p{{M}}|['\u{2019}](?={SV_LETTER}))*");
    JsRegex::new(&format!(r"({word})|(\d+(?:[.,]\d+)?)|([.!?…,;:])"), "gu").unwrap()
});

/// `SYMBOLS`'s argument, generated from the object literal in swedish.ts (key order preserved) by
/// evaluating that literal and printing `JSON.stringify` of it.
const SYMBOL_DATA: &str = r#"{"multiply":{"times":"gånger"},"percent":["procent"],"currency":{"€":["euro"],"$":["dollar"],"£":["pund"]},"units":{"km":["kilometer"],"m":["meter"],"cm":["centimeter"],"mm":["millimeter"],"kg":["kilogram"],"ghz":["gigahertz"],"mbit":["megabit"]},"rateDenominators":{"h":"timme","t":"timme","s":"sekund","min":"minut"},"unitPer":"per","exponentWords":{"squared":["kvadrat"],"cubed":["kubik"],"position":"compound"},"magnitudes":["miljoner","miljon","miljarder","miljard"]}"#;

/// The Swedish engine (`createSwedish`).
pub struct SwedishPhonemizer {
    symbols: SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `SwedishPhonemizer` proves the manifest and the
/// lexicon loaded, so none of these can reach a load panic. (The per-module differentials call them.)
impl SwedishPhonemizer {
    /// `normalizeSwedish(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_swedish(text)
    }

    /// `normalizeSwedishInitialisms(text)`.
    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_swedish_initialisms(text)
    }

    /// The shared symbol tier, as Swedish builds it.
    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    /// `isUnreadableSwedish(word)`.
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_swedish(word)
    }

    /// `ordinal(n)` (normalize.ts).
    pub fn ordinal(&self, n: f64) -> Option<JsString> {
        super::normalize::ordinal(n)
    }

    /// `hundredsYear(n)` (normalize.ts).
    pub fn hundreds_year(&self, n: f64) -> Option<JsString> {
        super::normalize::hundreds_year(n)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `toSegments(word, stressOrd, oLong, compound)` (g2p.ts).
    pub fn segments(
        &self,
        word: &JsString,
        stress_ord: f64,
        o_long: bool,
        compound: Option<&Compound>,
    ) -> Vec<Seg> {
        to_segments(word, stress_ord, o_long, compound)
    }

    /// `numberToWords(n, raw)` (numbers.ts).
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    /// `lexicon().get(word)`.
    pub fn lexicon_entry(&self, word: &JsString) -> Option<&'static LexEntry> {
        lexicon().get(word)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self
            .symbols
            .apply(&normalize_swedish_initialisms(&normalize_swedish(input)));
        assemble_clauses(&normalize(&normalized, Form::Nfc), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(n) = m.group(2, s).filter(|n| !n.is_empty()) {
                // `m[2].split(/[.,]/)`: the token admits at most one separator.
                let parts = match n.units().iter().position(|&u| u == 0x2E || u == 0x2C) {
                    Some(k) => vec![n.slice(0, Some(k as isize)), n.slice(k as isize + 1, None)],
                    None => vec![n.clone()],
                };
                let int_part = &parts[0];
                for wd in number_to_words(js_number(int_part), Some(int_part)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
                if let Some(frac) = parts.get(1) {
                    sink.emit(&phonemize_word(&js("komma")));
                    for d in frac.code_point_strings() {
                        for wd in number_to_words(js_number(&d), None).split(&js(" ")) {
                            sink.emit(&phonemize_word(&wd));
                        }
                    }
                }
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

impl Engine for SwedishPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(SwedishPhonemizer::text(self, input))
    }
}

/// `createSwedish()`. Errors when the manifest or the lexicon cannot be loaded, or the symbol tier refuses it.
pub fn create_swedish() -> Result<SwedishPhonemizer, String> {
    try_manifest()?;
    try_lexicon()?;
    let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
    Ok(SwedishPhonemizer {
        symbols: make_symbol_normalizer(&data)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // test/swedish.test.ts's literal `expect(f("…")).toBe("…")` pins, extracted from that file mechanically
    // (each is a reading the TS suite asserts), so the two engines are held to one list.
    const WORD_PINS: &[(&str, &str)] = &[
        ("sjö", "ɧøː"),
        ("skjorta", "ɧˈùːʈa"),
        ("stjärna", "ɧˈæ̀ːɳa"),
        ("själ", "ɧɛːl"),
        ("skön", "ɧøːn"),
        ("kött", "ɕœtː"),
        ("kyrka", "ɕˈʏ̀rka"),
        ("känna", "ɕˈɛ̀nːa"),
        ("göra", "jˈœ̀ːra"),
        ("get", "jeːt"),
        ("gärna", "jˈæ̀ːɳa"),
        ("boken", "bˈuːkɛn"),
        ("dragen", "drˈɑ̀ːɡɛn"),
        ("hjul", "jʉːl"),
        ("ljus", "jʉːs"),
        ("djur", "jʉːr"),
        ("miljon", "mɪljˈuːn"),
        ("familj", "famˈɪlj"),
        ("barn", "bɑːɳ"),
        ("berg", "bɛrj"),
        ("bok", "buːk"),
        ("fisk", "fɪsk"),
        ("egg", "ɛɡː"),
        ("ligga", "lˈɪɡːa"),
        ("flicka", "flˈɪ̀kːa"),
        ("tala", "tˈɑ̀ːla"),
        ("flicka", "flˈɪ̀kːa"),
        ("bil", "biːl"),
        ("boken", "bˈuːkɛn"),
        ("storstad", "stˈùːʂtˌɑːd"),
        ("storkök", "stˈùːrɕˌøːk"),
        ("järnväg", "jˈæ̀ːɳvˌɛːɡ"),
        ("arbetsplats", "ˈàrbeːtsplˌats"),
        ("barnbok", "bˈɑ̀ːɳbˌuːk"),
        ("björkö", "bjˈœ̀rkˌøː"),
        ("barnkör", "bˈɑ̀ːɳɕˌœːr"),
        ("polis", "pɔlˈiːs"),
        ("station", "staɧˈuːn"),
        ("student", "stɵdˈɛnt"),
        ("universitet", "ɵnɪvɛʂɪtˈeːt"),
        ("europa", "ɛɵrˈuːpa"),
        ("telefon", "tɛlɛfˈoːn"),
        ("kol", "koːl"),
        ("biolog", "bɪɔlˈoːɡ"),
        ("monopol", "mɔnɔpˈoːl"),
        ("adobe", "adˈoːbɛ"),
        ("bok", "buːk"),
        ("son", "suːn"),
        ("stor", "stuːr"),
        ("neurolog", "nɛɵrˈuːlɔɡ"),
        ("idé", "ɪdˈeː"),
        ("kafé", "kafˈeː"),
        ("gnista", "ɡnˈɪ̀sta"),
        ("regn", "rɛŋn"),
        ("sex", "sɛks"),
        ("dricka", "drˈɪ̀kːa"),
        ("tionde", "tˈìːɔndɛ"),
        ("är", "æːr"),
        ("jag", "jɑː"),
        ("och", "ɔ"),
    ];
    const TEXT_PINS: &[(&str, &str)] = &[
        ("2", "tvoː"),
        ("7", "ɧʉː"),
        ("21", "ɕˈʉ̀ːɡɔɛtː"),
        ("100", "ɛtːhˈɵndra"),
        ("1000", "ˈɛ̀tːɵsɛn"),
        ("1000000", "ɛn mɪljˈuːn"),
        ("30", "trˈɛ̀tːɪɔ"),
        ("50", "fˈɛ̀mtɪɔ"),
        ("80", "ˈɔ̀tːɪɔ"),
        ("Jag talar svenska.", "jɑː tˈɑ̀ːlar svˈɛ̀nska ."),
        ("TV", "teː veː"),
        ("DVD", "deː veː deː"),
        ("BNP", "beː ɛnː peː"),
        ("UTC", "ʉː teː seː"),
        ("GPS", "ɡeː peː ɛsː"),
        ("NSW", "ɛnː ɛsː dˈɵbːɛl veː"),
        ("USA", "ʉː ɛsː ɑː"),
        ("NASA", "nˈɑ̀ːsa"),
        (
            "vid OS 2012 i London",
            "viːd uː ɛsː tvɔtˈʉːsɛn tɔlv iː lˈɔndɔn",
        ),
        ("AI", "ɑː iː"),
        ("USOC", "ʉː ɛsː uː seː"),
        ("det luktar os", "deː lˈɵ̀ktar uːs"),
        ("EU", "ˈèːˌʉː"),
        ("H5N1", "hoː feːm ɛnː ɛtː"),
        ("Ludvig XV", "lˈɵdvɪɡ fˈɛ̀mtɔn"),
        ("USA:s president", "ʉː ɛsː ɑːs prɛsɪdˈɛnt"),
        ("FN:s", "ɛfː ɛnːs"),
        ("TV:n", "teː veːn"),
        ("133 m/s", "ˈɛ̀tːhɵndratrɛtːɪɔtrɛ mˈeːtɛr peːr sɛkˈɵnd"),
        ("2,4 GHz", "tvoː kˈɔ̀mːa fˈỳːra jˈìːɡahɛʈs"),
        ("600 Mbit/s", "sˈɛ̀kshɵndra mˈèːɡabɪt peːr sɛkˈɵnd"),
        ("gitarr", "jɪtˈarː"),
    ];
    const NORMALIZE_PINS: &[(&str, &str)] = &[
        ("1400-talet", "fjortonhundratalet"),
        ("På 1500-talet.", "På femtonhundratalet."),
        ("1900-tal", "nittonhundratal"),
        ("1700-talsmarknaden", "sjuttonhundratalsmarknaden"),
        ("1000-talet", "tusentalet"),
        ("800-talet", "åttahundratalet"),
        ("1100-1200-talet", "elvahundra till tolvhundratalet"),
        ("2000-talet", "2000-talet"),
        ("år 1945 och", "år nittonhundrafyrtiofem och"),
        ("1956 flyttade", "nittonhundrafemtiosex flyttade"),
        ("norr om 1770. De", "norr om sjuttonhundrasjuttio. De"),
        ("år 1000 f.Kr.", "år 1000 före Kristus."),
        ("valet 2010 hade", "valet 2010 hade"),
        ("1300 km av", "1300 km av"),
        ("1300 %", "1300 %"),
        ("kl. 20.30", "klockan 20 30"),
        ("kl.12.00", "klockan 12 0 0"),
        ("Klockan 01.15", "Klockan 01 15"),
        ("Mellan 22.00–23.00 MDT", "Mellan 22 0 0 till 23 0 0 MDT"),
        ("Standarden 802.11n", "Standarden 802.11n"),
        ("se figur 1.1.", "se figur 1.1."),
        ("priset 1.75", "priset 1.75"),
        ("klockan 12:00", "klockan 12 0 0"),
        ("Cirka 11:29 rörde", "Cirka 11 29 rörde"),
        ("tid på 4:41,30.", "tid på 4 41,30."),
        ("och 1:09.02 minuter", "och 1 09,02 minuter"),
        ("vara 3:2.", "vara 3 2."),
        ("1:a januari", "första januari"),
        ("det 37:e största", "det trettiosjunde största"),
        ("Elizabeth 2:s", "Elizabeth andras"),
        ("Il-76:or", "Il-sjuttiosexor"),
        ("Se upp: småstadsbar", "Se upp: småstadsbar"),
        (
            "Cuddeback, 21. Cuddeback var",
            "Cuddeback, 21. Cuddeback var",
        ),
        ("5 september 2021. Vissa", "5 september 2021. Vissa"),
        ("t.ex. visering", "till exempel visering"),
        ("t.o.m. en kajak", "till och med en kajak"),
        ("dvs. 0 eller 1", "det vill säga 0 eller 1"),
        ("s.k. flikstup", "så kallad flikstup"),
        ("Truex, Jr. är", "Truex, junior är"),
        ("Six Flags St. Louis", "Six Flags Sankt Louis"),
        ("templet 323 f.Kr.", "templet 323 före Kristus."),
        ("ens arm, etc.", "ens arm, etcetera."),
        ("storytelling, etc.)", "storytelling, etcetera.)"),
        ("omkring 10000 f.v.t.", "omkring 10000 före vår tidräkning."),
        (
            "år 400 e.Kr. och fortsatte",
            "år 400 efter Kristus och fortsatte",
        ),
        ("t.ex. Camp David", "till exempel Camp David"),
        ("dvs. Northern Rock", "det vill säga Northern Rock"),
        ("Av 1 400 människor", "Av fjortonhundra människor"),
        ("5 000 000 unika", "5000000 unika"),
        ("23,764 kvadratkilometer", "23764 kvadratkilometer"),
        ("plats med 2,243.", "plats med 2243."),
        ("12,8 km", "12,8 km"),
        ("2-3 km tjock", "2 till 3 km tjock"),
        ("från 4,2-3,9 miljoner", "från 4,2 till 3,9 miljoner"),
        ("Washingtons 5-3-seger", "Washingtons 5-3-seger"),
        ("mot kanadensaren är 7–2.", "mot kanadensaren är 7–2."),
        ("blivit 6-6.", "blivit 6-6."),
        ("ett poäng, 21-20, vilket", "ett poäng, 21-20, vilket"),
        ("1990-1995", "nittonhundranittio till nittonhundranittiofem"),
        ("över +30°C", "över plus 30 grader celsius"),
        ("öster om 35°V.", "öster om 35 grader väst."),
        ("(UTC+1) på", "(UTC plus 1) på"),
        ("-5 grader", "minus 5 grader"),
        ("3+1 gassturbiner", "3 plus 1 gassturbiner"),
        ("bed & breakfasts", "bed och breakfasts"),
        ("75,6 cm x 62,2", "75,6 cm gånger 62,2"),
        ("A = B", "A lika med B"),
    ];
    const INITIALISM_PINS: &[(&str, &str)] = &[
        ("UNESCO:s", "UNESCOs"),
        ("NASA:s chef", "NASAs chef"),
        ("Luno:n hade", "Lunon hade"),
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        let e = create_swedish().unwrap();
        for (w, want) in WORD_PINS {
            assert_eq!(e.phonemize_word(&js(w)).to_string_lossy(), *want, "{w}");
        }
        for (t, want) in TEXT_PINS {
            assert_eq!(crate::phonemize(t, "sv").unwrap(), *want, "{t}");
        }
        for (t, want) in NORMALIZE_PINS {
            assert_eq!(e.normalize(&js(t)).to_string_lossy(), *want, "{t}");
        }
        for (t, want) in INITIALISM_PINS {
            assert_eq!(
                e.normalize_initialisms(&js(t)).to_string_lossy(),
                *want,
                "{t}"
            );
        }
    }
}
