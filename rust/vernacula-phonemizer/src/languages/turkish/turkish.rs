//! Turkish (tr) phonemizer: the rule g2p, final-syllable stress with a pre-accenting-suffix rule and the
//! stress.tsv exception lexicon, the apostrophe-suffixed unit pass, and text() over words, numbers and
//! punctuation. Ported from src/languages/turkish/turkish.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::g2p::{Seg, to_segments, tr_case, tr_lower};
use super::manifest::{DIR, MANIFEST, try_manifest};
use super::normalize::{
    attach_suffix, is_unreadable_turkish, normalize_turkish, normalize_turkish_initialisms,
    ordinal_words,
};
use super::numbers::{digits_to_words, number_to_words};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_map};
use crate::core::normalize_symbols::{
    ExponentWords, Multiply, SymbolData, SymbolNormalizer, make_symbol_normalizer,
};
use crate::core::provenance::rewrite;
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// stress.tsv: word → 1-based stressed syllable, as `Number(value)` (a NaN row is representable).
fn try_stress() -> Result<&'static IndexMap<JsString, f64>, String> {
    static S: OnceLock<IndexMap<JsString, f64>> = OnceLock::new();
    load_once(&S, || {
        load_tsv_map(
            DIR,
            "stress.tsv",
            |v, _| Some(js_number(v)),
            TsvOptions {
                optional: true,
                ..Default::default()
            },
        )
        .map_err(|e| e.to_string())
    })
}

fn stress_dict() -> &'static IndexMap<JsString, f64> {
    try_stress().unwrap_or_else(|e| panic!("{e}"))
}

/// `nVowels(s)`: `VOWEL_LETTER` (no `u`) tested per code point; a surrogate half is never one, so this is a
/// count of code units.
fn n_vowels(s: &JsString) -> usize {
    s.units()
        .iter()
        .filter(|&&u| "aeıioöuüâîû".encode_utf16().any(|x| x == u))
        .count()
}

// PRE-ACCENTING suffixes, narrowed to what the sources list and to shapes the spelling can show (#1551). The
// measurement and the sources are in src/languages/turkish/turkish.ts; this is its mirror, arm for arm.
const H: &str = "[ıiuü]";
const A: &str = "[ae]";
static PERSON: LazyLock<String> =
    LazyLock::new(|| format!("(?:m|n|k|n{H}z|l{A}r|{H}m|{H}z|s{H}n{H}z|s{H}n|{H}n|{H}k)?"));
/// Where the suffix starts (the stress is on the syllable before it).
#[derive(Clone, Copy)]
enum Start {
    AtMatch,
    AtLastS,
    Existential,
    KenTail,
}
struct PreAccent {
    re: JsRegex,
    start: Start,
    /// The fewest syllables the host must have; a shorter host is a root that only looks suffixed.
    min_host: usize,
}
static PRE_ACCENT: LazyLock<Vec<PreAccent>> = LazyLock::new(|| {
    let p = &*PERSON;
    let arm = |re: String, start: Start, min_host: usize| PreAccent {
        re: JsRegex::new(&re, "u").unwrap(),
        start,
        min_host,
    };
    vec![
        arm(
            r"^(?:var|yok|değil)s[ae](?:m|n|k|n[ıiuü]z|l[ae]r)?$".into(),
            Start::AtLastS,
            1,
        ),
        arm(
            r"^(?:var|yok|değil)[dt][ıiuü]r(?:l[ae]r)?$".into(),
            Start::Existential,
            1,
        ),
        arm(format!("(?<=..)m{H}yor{p}$"), Start::AtMatch, 1),
        arm(
            format!("m{A}(?:d{H}|m{H}ş|s{A}|y{A}c{A}[kğ]|s{H}n|d{A}n|y{A}n|m{A}k|y{A}l{H}m){p}$"),
            Start::AtMatch,
            1,
        ),
        arm(
            format!("(?<=[dt]{A})y(?:{H}m|{H}z|s{H}n{H}z|s{H}n)$"),
            Start::AtMatch,
            2,
        ),
        arm(
            format!("(?<=[aeıioöuü])y(?:l{A}|ken|s{A}{p})$"),
            Start::AtMatch,
            1,
        ),
        arm(
            format!("(?:{H}r|{A}r|m{A}z|{A}c{A}k|m{H}ş|yor)s{A}{p}$"),
            Start::AtLastS,
            2,
        ),
        arm(
            format!("(?:{H}r|{A}r|m{A}z|m{H}ş|yor)ken$"),
            Start::KenTail,
            2,
        ),
        arm(format!("[dt]{H}r(?:l{A}r)?$"), Start::AtMatch, 1),
        arm(r"(?<=[^aeıioöuüâîûy])l[ae]$".into(), Start::AtMatch, 2),
    ]
});

/// `morphStress(wl)`: the syllable before the first matching pre-accenting suffix, or the I of -Iyor.
fn morph_stress(wl: &JsString) -> Option<f64> {
    for a in PRE_ACCENT.iter() {
        let Some(m) = a.re.exec(wl) else {
            continue;
        };
        let start = match a.start {
            Start::AtMatch => m.index(),
            Start::AtLastS => wl.last_index_of(&js("s")).unwrap_or(0),
            Start::Existential => js_re!(r"[dt][ıiuü]r(?:l[ae]r)?$", "u")
                .exec(wl)
                .map_or(0, |e| e.index()),
            Start::KenTail => wl.len() - 3,
        };
        let syl = n_vowels(&wl.slice(0, Some(start as isize)));
        return (syl >= a.min_host).then_some(syl as f64);
    }
    if let Some(iyor) = js_re!(r"([ıiuü])yor(?:um|sun|uz|sunuz|lar)?$", "u").exec(wl) {
        return Some(n_vowels(&wl.slice(0, Some(iyor.index() as isize + 1))) as f64);
    }
    None
}

/// `phonemizeWord(word, finalStress)`: segments with a stress mark before the stressed nucleus.
pub(crate) fn phonemize_word(word: &JsString, final_stress: bool) -> JsString {
    let segs = to_segments(word);
    let nuclei: Vec<usize> = (0..segs.len()).filter(|&i| segs[i].nucleus).collect();
    let mut out = JsString::new();
    if nuclei.is_empty() {
        for s in &segs {
            out.push_str(&s.ph);
        }
        return out;
    }
    let wl = tr_lower(word);
    let syl = if final_stress {
        None
    } else {
        stress_dict()
            .get(&wl)
            .copied()
            .or_else(|| morph_stress(&wl))
    };
    // A non-integer `syl` falls back to final stress, as the TS `Number.isInteger` test does (#1523).
    let stress_idx = match syl {
        Some(n) if n.fract() == 0.0 && n >= 1.0 && n <= nuclei.len() as f64 => {
            nuclei[n as usize - 1]
        }
        _ => nuclei[nuclei.len() - 1],
    };
    for (i, s) in segs.iter().enumerate() {
        if i == stress_idx {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&s.ph);
    }
    out
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"({})|(\d+)\.(?=[^\S\n]+\S)|(\d+(?:(?<!(?<!\d)0)\.\d{{3}})*(?:,\d+)?)(?:['’]([a-zçğıiöşüâîûİ]+))?|([.!?…,;:])",
            *LATIN_RUN
        ),
        "giu",
    )
    .unwrap()
});

/// `CAPITAL_NEXT`: a year (≥4 digits) before a capital is a sentence end, not an ordinal (#1523).
static CAPITAL_NEXT: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"^[^\S\n]+\p{Lu}", "u").unwrap());

const NATIVE_CLASS: &str = "[a-zçğıiöşüâîûİ]";
type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "iu")));

/// `numberTokenToWords(tok)`: thousands dots dropped, a decimal comma read digit by digit.
fn number_token_to_words(tok: &JsString) -> JsString {
    let parts = tok.split(&js(","));
    let int_raw = js_re!(r"\.", "g").replace(&parts[0], &JsString::new());
    let mut words = digits_to_words(&int_raw); // exact past 2⁵³ (#1523)
    if let Some(frac) = parts.get(1) {
        let digits: Vec<JsString> = frac
            .code_point_strings()
            .iter()
            .map(|d| number_to_words(js_number(d)))
            .collect();
        words = words
            .concat(&js(&format!(" {} ", MANIFEST.numbers.decimal_connector)))
            .concat(&JsString::join(&digits, &js(" ")));
    }
    words
}

/// `UNIT_ALT`: the symbol tier's unit keys, longest first (a stable sort).
static UNIT_ALT: LazyLock<String> = LazyLock::new(|| {
    let mut keys: Vec<&String> = MANIFEST.symbol_tier.units.keys().collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.encode_utf16().count()));
    keys.iter()
        .map(|k| k.as_str())
        .collect::<Vec<_>>()
        .join("|")
});
const SUFFIX_MARK: &str = "\u{1}";
static SUFFIXED_UNIT: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(\d[\d.,]*\s?(?:{})(?:\s?[²³23])?)['’](\p{{L}}+)",
            *UNIT_ALT
        ),
        "gu",
    )
    .unwrap()
});
static MARKED_SUFFIX: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"(\S+)\s{SUFFIX_MARK}(\p{{L}}+)"), "gu").unwrap());
static MARK_RE: LazyLock<JsRegex> = LazyLock::new(|| JsRegex::new(SUFFIX_MARK, "gu").unwrap());

/// The Turkish engine (`createTurkish`).
pub struct TurkishPhonemizer {
    symbols: SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `TurkishPhonemizer` proves the manifest and
/// the lexicon loaded, so none of these can reach a load panic. (The per-module differentials call them.)
impl TurkishPhonemizer {
    /// `normalizeTurkish(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_turkish(text)
    }

    /// The initialism pass alone, as normalize.ts builds it.
    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_turkish_initialisms(text)
    }

    /// The shared symbol tier, as Turkish builds it.
    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    /// `readSuffixedUnits(text)`: park an apostrophe suffix, let the tier speak the unit, glue it back.
    pub fn read_suffixed_units(&self, text: &JsString) -> JsString {
        let parked = rewrite(text, &SUFFIXED_UNIT, &js(&format!("$1 {SUFFIX_MARK}$2")));
        let glued = rewrite(&self.symbols.apply(&parked), &MARKED_SUFFIX, &js("$1$2"));
        rewrite(&glued, &MARK_RE, &JsString::new())
    }

    /// `isUnreadableTurkish(word)`.
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_turkish(word)
    }

    /// `phonemizeWord(word, finalStress)`.
    pub fn phonemize_word(&self, word: &JsString, final_stress: bool) -> JsString {
        phonemize_word(word, final_stress)
    }

    /// `toSegments(word)` (g2p.ts).
    pub fn segments(&self, word: &JsString) -> Vec<Seg> {
        to_segments(word)
    }

    /// `trLower(word)` (g2p.ts).
    pub fn tr_lower(&self, word: &JsString) -> JsString {
        tr_lower(word)
    }

    /// `numberToWords(n)` (numbers.ts).
    pub fn number_to_words(&self, n: f64) -> JsString {
        number_to_words(n)
    }

    /// `digitsToWords(digits)` (numbers.ts).
    pub fn digits_to_words(&self, digits: &JsString) -> JsString {
        digits_to_words(digits)
    }

    /// `ordinalWords(n)` (normalize.ts).
    pub fn ordinal_words(&self, n: f64) -> Option<JsString> {
        ordinal_words(n)
    }

    /// `attachSuffix(words, suffix)` (normalize.ts).
    pub fn attach_suffix(&self, words: &[JsString], suffix: &JsString) -> Vec<JsString> {
        attach_suffix(words, suffix)
    }

    /// `numberTokenToWords(tok)`.
    pub fn number_token_to_words(&self, tok: &JsString) -> JsString {
        number_token_to_words(tok)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }
}

impl TurkishPhonemizer {
    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self.read_suffixed_units(&normalize_turkish(input));
        let mark = |p: &JsString| {
            MANIFEST
                .clause_punctuation
                .get(&p.to_string_lossy())
                .filter(|mk| !mk.is_empty())
                .map(|mk| js(mk))
        };
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            let emit_all = |words: &[JsString], sink: &mut crate::core::clauses::ClauseSink| {
                for wd in words {
                    sink.emit(&phonemize_word(wd, true));
                }
            };
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w), false));
            } else if let Some(n) = m.group(2, s) {
                let sentence_end =
                    n.len() >= 4 && CAPITAL_NEXT.test(&s.slice(m.end() as isize, None));
                let ord = if sentence_end {
                    None
                } else {
                    ordinal_words(js_number(&n))
                };
                match ord {
                    Some(ord) => emit_all(&ord.split(&js(" ")), sink),
                    None => {
                        emit_all(&number_token_to_words(&n).split(&js(" ")), sink);
                        if let Some(mk) = mark(&js(".")) {
                            sink.pause(&mk);
                        }
                    }
                }
            } else if let Some(n) = m.group(3, s).filter(|n| !n.is_empty()) {
                let words = number_token_to_words(&n).split(&js(" "));
                match m.group(4, s).filter(|x| !x.is_empty()) {
                    Some(suffix) => emit_all(&attach_suffix(&words, &tr_case(&suffix)), sink),
                    None => emit_all(&words, sink),
                }
            } else if let Some(p) = m.group(5, s).filter(|p| !p.is_empty())
                && let Some(mk) = mark(&p)
            {
                sink.pause(&mk);
            }
        })
    }
}

impl Engine for TurkishPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(TurkishPhonemizer::text(self, input))
    }
}

/// `createTurkish()`. Errors when the manifest or the lexicon cannot be loaded, or the symbol tier refuses it.
pub fn create_turkish() -> Result<TurkishPhonemizer, String> {
    let m = try_manifest()?;
    try_stress()?;
    let st = &m.symbol_tier;
    let symbols = make_symbol_normalizer(&SymbolData {
        percent: Some(st.percent.clone()),
        currency: Some(st.currency.clone()),
        units: Some(st.units.clone()),
        exponent_words: Some(ExponentWords {
            squared: Some(st.exponent_words.squared.clone()),
            cubed: Some(st.exponent_words.cubed.clone()),
            position: st.exponent_words.position.clone(),
        }),
        percent_prefix: Some(st.percent_prefix),
        multiply: Some(Multiply {
            times: st.multiply.times.clone(),
            by: st.multiply.by.clone(),
        }),
        ..Default::default()
    })?;
    Ok(TurkishPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// test/turkish-1551-pre-accent.test.ts: the narrowed pre-accent rule; each expectation is the 1-based stressed
    /// syllable the sources give, not typed IPA (#1551).
    #[test]
    fn the_1551_pre_accenting_suffixes() {
        let stressed = |w: &str| {
            let ipa = phonemize_word(&js(w), false).to_string_lossy();
            let ipa: String = {
                use unicode_normalization::UnicodeNormalization;
                ipa.nfd().collect()
            };
            let (mut n, mut in_v) = (0, false);
            for ch in ipa[..ipa.find('ˈ').unwrap()].chars() {
                let v = "aeiouyɯøœɛɑ".contains(ch);
                if v && !in_v {
                    n += 1;
                }
                in_v = v;
            }
            n + 1
        };
        for (w, syl) in [
            ("gelmedi", 1),
            ("gelmiyor", 1),
            ("gelmeden", 1),
            ("olmayan", 1),
            ("olmasa", 1),
            ("olsa", 2),
            ("gelse", 2),
            ("hastaysa", 2),
            ("gelirse", 2),
            ("varsa", 1),
            ("vardır", 1),
            ("yoktur", 1),
            ("güzeldir", 2),
            ("nedeniyle", 3),
            ("gelirken", 2),
            ("evdeyim", 2),
            ("deniz", 2),
            ("dokuz", 2),
            ("yıldız", 2),
            ("koruma", 3),
            ("kele", 2),
            ("geldim", 2),
        ] {
            assert_eq!(stressed(w), syl, "{w}");
        }
    }

    // test/turkish.test.ts's `phonemizeWord`, `phonemize(…, "tr")` and `ordinalWords` pins, extracted from that file
    // mechanically (each is a reading the TS suite asserts), so the two engines are held to one list.
    const WORD_PINS: &[(&str, &str)] = &[
        ("merhaba", "mˈeɾhaba"),
        ("türkiye", "tˈyɾcije"),
        ("güzel", "ɟyzˈel"),
        ("okul", "okˈuɫ"),
        ("dil", "dˈil"),
        ("çocuk", "t͡ʃod͡ʒˈuk"),
        ("dağ", "dˈaː"),
        ("değil", "dejˈil"),
        ("düğün", "dˈyːn"),
        ("asker", "ascˈeɾ"),
        ("teşekkür", "teʃecːˈyɾ"),
        ("anne", "annˈe"),
        ("İzmir", "ˈizmiɾ"),
        ("geliyor", "ɟelˈijoɾ"),
        ("istiyorum", "istˈijoɾum"),
        ("giderken", "ɟidˈeɾcen"),
        ("benimle", "benˈimle"),
        ("kaybetme", "kajbetmˈe"), // #1551: the bare -mA is the verbal noun
        ("güzeldir", "ɟyzˈeldiɾ"),
        ("evdeyim", "evdˈejim"),
        ("olsa", "oɫsˈa"), // #1551: the conditional on a verb stem is final
        ("varsa", "vˈaɾsa"),
        ("kitap", "citˈap"),
        ("araba", "aɾabˈa"),
        ("olsun", "oɫsˈun"),
        ("arasında", "aɾasɯndˈa"),
    ];
    const TEXT_PINS: &[(&str, &str)] = &[
        ("0", "sɯfˈɯɾ"),
        ("42", "kˈɯɾk icˈi"),
        ("1985", "bˈin dokˈuz jˈyz secsˈen bˈeʃ"),
        ("18. yüzyıl", "ˈon secizind͡ʒˈi jyzjˈɯɫ"),
        ("1. Dünya Savaşı", "biɾind͡ʒˈi dˈynja savaʃˈɯ"),
        ("247. Maddesine", "icˈi jˈyz kˈɯɾk jedind͡ʒˈi madːesinˈe"),
        ("rekoru 7-2.", "ɾekoɾˈu jedˈi icˈi ."),
        ("1.234 kişi", "bˈin icˈi jˈyz otˈuz dˈøɾt ciʃˈi"),
        ("1985'te", "bˈin dokˈuz jˈyz secsˈen beʃtˈe"),
        ("2020’ye", "icˈi bˈin jiɾmijˈe"),
        ("1970'lerin", "bˈin dokˈuz jˈyz jetmiʃleɾˈin"),
        ("36'sı", "otˈuz aɫtɯsˈɯ"),
        ("34'ü", "otˈuz døɾdˈy"),
        ("saat 11:35'te", "saˈat ˈon bˈiɾ otˈuz beʃtˈe"),
        ("07:19", "jedˈi ˈon dokˈuz"),
        ("saat 11:00 civarında", "saˈat ˈon bˈiɾ d͡ʒivaɾɯndˈa"),
        ("bugün 12.00 sularında", "bˈuɟyn ˈon icˈi suɫaɾɯndˈa"),
        ("%40", "jyzdˈe kˈɯɾk"),
        ("40%", "jyzdˈe kˈɯɾk"),
        ("%80'ini", "jyzdˈe secseninˈi"),
        ("MÖ 10. yüzyılda", "miɫatːˈan ønd͡ʒˈe onund͡ʒˈu jyzjɯɫdˈa"),
        ("M.Ö. 323'te", "miɫatːˈan ønd͡ʒˈe ˈyt͡ʃ jˈyz jiɾmˈi yt͡ʃtˈe"),
        ("peynir vb. lezzet", "pejnˈiɾ vˈe benzeɾˈi lezzˈet"),
        ("Dr. Ahmet", "doktˈoɾ ahmˈet"),
        ("MS 400", "miɫatːˈan sonɾˈa dˈøɾt jˈyz"),
        ("MS hastalığı", "mˈe sˈe hastaɫɯːˈɯ"),
        ("ABD raporu", "ˈa bˈe dˈe ɾapoɾˈu"),
        ("BM uzmanı", "bˈe mˈe uzmanˈɯ"),
        ("FBI'ın uyarısı", "fˈe bˈe ˈɯ ˈɯn ujaɾɯsˈɯ"),
        ("GPS uygulaması", "ɟˈe pˈe sˈe ujɡuɫamasˈɯ"),
        ("FIFA turnuvası", "fɯfˈa tuɾnuvasˈɯ"),
        ("70 km yol", "jetmˈiʃ ciɫometɾˈe jˈoɫ"),
        ("4892 m", "dˈøɾt bˈin secˈiz jˈyz doksˈan icˈi mˈetɾe"),
        (
            "165 km/s rüzgar",
            "saatːˈe jˈyz aɫtmˈɯʃ bˈeʃ ciɫometɾˈe ɾyzɡˈaɾ",
        ),
        ("30°C", "otˈuz deɾed͡ʒˈe"),
        ("UTC+1", "ˈu tˈe d͡ʒˈe aɾtˈɯ bˈiɾ"),
    ];
    const ORDINAL_PINS: &[(f64, &str)] = &[
        (1.0, "birinci"),
        (2.0, "ikinci"),
        (3.0, "üçüncü"),
        (4.0, "dördüncü"),
        (5.0, "beşinci"),
        (6.0, "altıncı"),
        (7.0, "yedinci"),
        (8.0, "sekizinci"),
        (9.0, "dokuzuncu"),
        (10.0, "onuncu"),
        (15.0, "on beşinci"),
        (20.0, "yirminci"),
        (40.0, "kırkıncı"),
        (60.0, "altmışıncı"),
        (90.0, "doksanıncı"),
        (100.0, "yüzüncü"),
        (190.0, "yüz doksanıncı"),
        (247.0, "iki yüz kırk yedinci"),
        (1000.0, "bininci"),
    ];
    const CONTAINS_PINS: &[(&str, &str)] =
        &[("783.562 km²", "ciɫometɾekaɾˈe"), ("120 m³", "metɾecˈyp")];

    #[test]
    fn the_ts_suite_pins_hold() {
        create_turkish().unwrap();
        for (w, want) in WORD_PINS {
            assert_eq!(
                phonemize_word(&js(w), false).to_string_lossy(),
                *want,
                "{w}"
            );
        }
        for (t, want) in TEXT_PINS {
            assert_eq!(crate::phonemize(t, "tr").unwrap(), *want, "{t}");
        }
        for (n, want) in ORDINAL_PINS {
            assert_eq!(ordinal_words(*n).unwrap().to_string_lossy(), *want, "{n}");
        }
        for (t, part) in CONTAINS_PINS {
            assert!(crate::phonemize(t, "tr").unwrap().contains(part), "{t}");
        }
    }

    /// test/turkish.test.ts's `Turkish #1523` block (each value the TS engine's output).
    #[test]
    fn the_1523_pins_hold() {
        create_turkish().unwrap();
        let say = |t: &str| crate::phonemize(t, "tr").unwrap();
        let dw = |d: &str| digits_to_words(&js(d)).to_string_lossy();
        assert_eq!(dw("1000000000000000000000"), "bir sekstilyon");
        assert_eq!(dw("2005000000000000000000"), "iki sekstilyon beş kentilyon");
        assert_eq!(number_to_words(1e18).to_string_lossy(), "bir kentilyon");
        assert!(dw("1234567890123456789012").ends_with("yedi yüz seksen dokuz bin on iki"));
        let mut zeros = vec!["bir"];
        zeros.extend(std::iter::repeat_n("sıfır", 36));
        assert_eq!(dw(&format!("1{}", "0".repeat(36))), zeros.join(" "));
        assert_eq!(say("1000000000000000000000"), "bˈiɾ secstiljˈon");
        assert!(say("1234567890123456789012").ends_with("dokˈuz bˈin ˈon icˈi"));
        assert_eq!(
            say("5 < 1000000000000000001"),
            "bˈeʃ bˈiɾ centiljˈon biɾdˈen cyt͡ʃˈyctyɾ"
        );
        for (w, want) in [
            ("kâr", "cˈaɾ"),
            ("kar", "kˈaɾ"),
            ("lâle", "lalˈe"),
            ("rüzgâr", "ɾyzɟˈaɾ"),
            ("elma", "elmˈa"),
            ("masa", "masˈa"),
            ("olsa", "oɫsˈa"), // #1551: the conditional on a verb stem is final
        ] {
            assert_eq!(phonemize_word(&js(w), false).to_string_lossy(), want, "{w}");
        }
        assert_eq!(say("34'Ü"), say("34'ü"));
        assert_eq!(say("1985'İN"), say("1985'in"));
        assert_eq!(
            say("Yıl 2004. Sonra geldi."),
            "jˈɯɫ icˈi bˈin dˈøɾt . sonɾˈa ɟeldˈi ."
        );
        assert_eq!(say("1. Dünya Savaşı"), "biɾind͡ʒˈi dˈynja savaʃˈɯ");
        let segs: String = to_segments(&js("rğa"))
            .iter()
            .map(|s| s.ph.to_string_lossy())
            .collect();
        assert_eq!(segs, "ɾa");
    }
}
