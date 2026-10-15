//! Dutch (nl) phonemizer: the rule g2p per stress group (a compound split at its stem·stem seams, degeminated
//! there), first-full-syllable stress after an unstressed prefix, the reduced function words, and text() over
//! words, numbers (period grouping, comma decimal) and punctuation.
//! Ported from src/languages/dutch/dutch.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::LazyLock;

use super::g2p::{Seg, full_vowel, to_segments};
use super::manifest::{MANIFEST, try_manifest};
use super::morphology::{decompose, is_lexical_word};
use super::normalize::{is_unreadable_dutch, normalize_dutch, normalize_dutch_initialisms};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::germanic_morphology::{Decomp, Kind};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{
    ExponentWords, Multiply, SymbolData, SymbolNormalizer, UnitPer, make_symbol_normalizer,
};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

fn alt(xs: &[String]) -> JsRegex {
    JsRegex::new(&format!("^({})", xs.join("|")), "u").unwrap()
}

static UNSTRESSED_PREFIX: LazyLock<JsRegex> =
    LazyLock::new(|| alt(&MANIFEST.morphology.prefix_unstressed));
static SCHWA_PREFIX: LazyLock<JsRegex> = LazyLock::new(|| alt(&MANIFEST.morphology.prefix_schwa));
/// `DIGRAPH_PREFIX`: a be-/ge-/te- spelling whose ⟨e⟩ the scanner joins with the next letter (⟨ee⟩, ⟨ei⟩, ⟨eu⟩) is
/// not a prefix, so been·houwer neither shifts nor loses its digraph to schwa (#1524).
static DIGRAPH_PREFIX: LazyLock<JsRegex> = LazyLock::new(|| {
    let es: Vec<&str> = MANIFEST
        .morphology
        .prefix_unstressed
        .iter()
        .filter(|p| p.ends_with('e'))
        .map(String::as_str)
        .collect();
    JsRegex::new(&format!("^(?:{})[eiu]", es.join("|")), "u").unwrap()
});

/// `CONS_IPA`: the consonant phones a seam can degeminate, each one code unit in the manifest.
static CONS_IPA: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.consonant_phones.iter().map(|p| js(p)).collect());

fn schwa() -> JsString {
    js("ə")
}

/// A prefix shift may land on a reduced STEM ⟨e⟩ (#1550): the scanner reduced it before stress was placed, so
/// ver·tel·len kept the stress on the prefix. Not when only an ending follows the last-nucleus ⟨e⟩ (ge·ven, be·ter,
/// te·gen), and not after a longer STRESSED prefix (tegen, terug). See src/languages/dutch/dutch.ts.
const ENDING_AFTER_E: [&str; 5] = ["n", "r", "l", "m", ""];
static STRESSED_PREFIX_START: LazyLock<JsRegex> = LazyLock::new(|| {
    let m = &MANIFEST.morphology;
    let longer: Vec<&str> = m
        .prefix_stressed
        .iter()
        .filter(|p| {
            m.prefix_unstressed
                .iter()
                .any(|u| p.starts_with(u.as_str()) && p.len() > u.len())
        })
        .map(String::as_str)
        .collect();
    JsRegex::new(&format!("^(?:{})", longer.join("|")), "u").unwrap()
});
fn stem_vowel_e(lower: &JsString, at: usize, last: bool) -> bool {
    if lower.0.get(at) != Some(&u16::from(b'e')) || STRESSED_PREFIX_START.test(lower) {
        return false;
    }
    let rest = lower.slice(at as isize + 1, None);
    !last || !ENDING_AFTER_E.iter().any(|e| rest == js(e))
}

/// `placeStress(segs, word)`: the stressed-nucleus seg index, reducing a ge-/be-/ver-/te- prefix vowel when the
/// shift fires; `None` when there is no nucleus.
/// Words that START with a prefix spelling but are not prefixed (tennis, hertog); see nl-not-prefixed.txt (#1551).
fn not_prefixed_words() -> &'static HashSet<JsString> {
    static S: std::sync::OnceLock<HashSet<JsString>> = std::sync::OnceLock::new();
    S.get_or_init(|| {
        let mut set = HashSet::new();
        if let Ok(text) = crate::core::data_source::read_data_text(
            &crate::core::data_path::data_file("languages/dutch", "nl-not-prefixed.txt"),
        ) {
            for line in text.split('\n') {
                let w = js(line).trim().to_lower_case();
                if !w.is_empty() && !w.starts_with(&js("#")) {
                    set.insert(w);
                }
            }
        }
        set
    })
}

fn place_stress(segs: &mut [Seg], word: &JsString, not_prefixed: bool) -> Option<usize> {
    let nuclei: Vec<usize> = segs
        .iter()
        .enumerate()
        .filter(|(_, s)| s.vowel)
        .map(|(k, _)| k)
        .collect();
    if nuclei.is_empty() {
        return None;
    }
    let lower = word.to_lower_case();
    if !not_prefixed
        && nuclei.len() > 1
        && UNSTRESSED_PREFIX.test(&lower)
        && !DIGRAPH_PREFIX.test(&lower)
    {
        let at = segs[nuclei[1]].s;
        let stem_e = segs[nuclei[1]].ph == schwa() && stem_vowel_e(&lower, at, nuclei.len() == 2);
        if segs[nuclei[1]].ph != schwa() || stem_e {
            if stem_e {
                segs[nuclei[1]].ph = full_vowel(&lower, at);
            }
            if SCHWA_PREFIX.test(&lower) {
                segs[nuclei[0]].ph = schwa();
            }
            return Some(nuclei[1]);
        }
    }
    Some(
        nuclei
            .iter()
            .copied()
            .find(|&k| segs[k].ph != schwa())
            .unwrap_or(nuclei[0]),
    )
}

/// `phonemizeChunk(word)`: one stress group.
fn phonemize_chunk(word: &JsString, not_prefixed: bool) -> JsString {
    let mut segs = to_segments(word);
    if segs.is_empty() {
        return JsString::new();
    }
    let stress = place_stress(&mut segs, word, not_prefixed);
    let mut out = JsString::new();
    for (k, s) in segs.iter().enumerate() {
        if Some(k) == stress {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&s.ph);
    }
    out
}

/// `stressGroups(parts, kinds)`: a prefix joins the following element, a suffix the preceding; a second stem
/// starts a new group.
fn stress_groups(parts: &[JsString], kinds: &[Kind]) -> Vec<JsString> {
    let mut groups = Vec::new();
    let mut cur = JsString::new();
    let mut has_stem = false;
    for (p, &k) in parts.iter().zip(kinds.iter()) {
        if k == Kind::Stem && has_stem {
            groups.push(std::mem::take(&mut cur));
            has_stem = false;
        }
        cur.push_str(p);
        if k == Kind::Stem {
            has_stem = true;
        }
    }
    if !cur.is_empty() {
        groups.push(cur);
    }
    groups
}

/// `joinChunks(chunks)`: degeminate a doubled consonant across each seam (a leading stress mark skipped).
/// ⚠ The comparison is on single UTF-16 code units, as `g[0]` / `out[out.length - 1]` are in the TS.
fn join_chunks(chunks: &[JsString]) -> JsString {
    let mut out = chunks.first().cloned().unwrap_or_default();
    let stress = 'ˈ' as u16;
    for g in &chunks[1..] {
        let gu = g.units();
        let onset = if gu.first() == Some(&stress) {
            gu.get(1)
        } else {
            gu.first()
        }
        .copied();
        let coda = out.units().last().copied();
        if let Some(c) = coda
            && onset == Some(c)
            && CONS_IPA.contains(&JsString::from_units(&[c]))
        {
            out = out.slice(0, Some(-1));
        }
        out.push_str(g);
    }
    out
}

/// `phonemizeWord(word)`: one Dutch word to canonical IPA with a stress mark.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let w = word.to_lower_case();
    if let Some(reduced) = MANIFEST.function_words.get(&w.to_string_lossy()) {
        return js(reduced);
    }
    // A prefix SPELLING that is not a prefix (nl-not-prefixed.txt, #1551): no shift in the first chunk.
    let not_prefixed = not_prefixed_words().contains(&w);
    if is_lexical_word(&w) {
        return phonemize_chunk(word, not_prefixed);
    }
    let d = decompose(&w);
    if d.parts.len() > 1 {
        let groups = stress_groups(&d.parts, &d.kinds);
        if groups.len() > 1 {
            let chunks: Vec<JsString> = groups
                .iter()
                .enumerate()
                .map(|(i, g)| phonemize_chunk(g, not_prefixed && i == 0))
                .collect();
            return join_chunks(&chunks);
        }
    }
    phonemize_chunk(word, not_prefixed)
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        r"(['’]?[a-zà-ÿ]+(?:['’][a-zà-ÿ]+)*)|([1-9]\d{0,2}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?)|([.!?…,;:])",
        "giu",
    )
    .unwrap()
});

/// The Dutch engine (`createDutch`).
pub struct DutchPhonemizer {
    symbols: SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `DutchPhonemizer` proves the manifest loaded, so
/// none of these can reach a load panic. (The per-module differentials call them.)
impl DutchPhonemizer {
    /// `normalizeDutch(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_dutch(text)
    }

    /// `normalizeDutchInitialisms(text)`.
    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_dutch_initialisms(text)
    }

    /// The shared symbol tier, as Dutch builds it.
    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    /// `isUnreadableDutch(word)`.
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_dutch(word)
    }

    /// `ordinalWord(n)` (normalize.ts).
    pub fn ordinal_word(&self, n: f64) -> Option<JsString> {
        super::normalize::ordinal_word(n)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `toSegments(word)` (g2p.ts).
    pub fn segments(&self, word: &JsString) -> Vec<Seg> {
        to_segments(word)
    }

    /// `decompose(word)` (morphology.ts).
    pub fn decompose(&self, word: &JsString) -> Decomp {
        decompose(word)
    }

    /// `isLexicalWord(word)` (morphology.ts).
    pub fn is_lexical_word(&self, word: &JsString) -> bool {
        is_lexical_word(word)
    }

    /// `numberToWords(n, raw)` (numbers.ts).
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self
            .symbols
            .apply(&normalize_dutch_initialisms(&normalize_dutch(input)));
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(n) = m.group(2, s).filter(|n| !n.is_empty()) {
                // The period is thousands grouping and the comma the decimal point.
                let parts = js_re!(r"\.", "gu")
                    .replace(&n, &JsString::new())
                    .split(&js(","));
                let int_part = &parts[0];
                for wd in number_to_words(js_number(int_part), Some(int_part)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
                if let Some(frac) = parts.get(1) {
                    sink.emit(&phonemize_word(&js(&MANIFEST.numbers.decimal_word)));
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

impl Engine for DutchPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(DutchPhonemizer::text(self, input))
    }
}

/// `createDutch()`. Errors when the manifest cannot be loaded or the symbol tier refuses it. (A missing stem
/// list is not an error, as in the TS: the splitter is then a no-op.)
pub fn create_dutch() -> Result<DutchPhonemizer, String> {
    let m = try_manifest()?;
    let st = &m.symbol_tier;
    let symbols = make_symbol_normalizer(&SymbolData {
        percent: Some(st.percent.clone()),
        currency: Some(st.currency.clone()),
        units: Some(st.units.clone()),
        rate_denominators: Some(st.rate_denominators.clone()),
        unit_per: Some(UnitPer::All(st.unit_per.clone())),
        exponent_words: Some(ExponentWords {
            squared: Some(st.exponent_words.squared.clone()),
            cubed: Some(st.exponent_words.cubed.clone()),
            position: st.exponent_words.position.clone(),
        }),
        magnitudes: Some(st.magnitudes.clone()),
        multiply: Some(Multiply {
            times: st.multiply.times.clone(),
            by: st.multiply.by.clone(),
        }),
        ..Default::default()
    })?;
    Ok(DutchPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// test/dutch-1551-not-prefixed.test.ts: a prefix spelling that is not a prefix keeps first-syllable stress and
    /// a full first vowel; a real prefix still shifts (#1551).
    #[test]
    fn the_1551_not_prefixed_words() {
        let first_stressed_full = |w: &str| {
            let ipa = phonemize_word(&js(w)).to_string_lossy();
            let Some((vi, vc)) = ipa
                .char_indices()
                .find(|(_, c)| "aeiouyɑɛɪɔʏəøœ".contains(*c))
            else {
                return false;
            };
            ipa.find('ˈ').is_some_and(|s| s < vi) && vc != 'ə'
        };
        for w in [
            "tennis",
            "hertog",
            "hersenen",
            "generaal",
            "verreweg",
            "tempo",
            "technisch",
            "hersenletsel",
        ] {
            assert!(first_stressed_full(w), "{w}");
        }
        for w in ["vertellen", "bestellen", "gezellig", "verkopen", "geloven"] {
            assert!(!first_stressed_full(w), "{w}");
        }
    }

    /// test/dutch-1551-section-numbers.test.ts: a dotted number after a section word is not a clock (#1551).
    #[test]
    fn the_1551_section_numbers_are_not_clocks() {
        let nl = |s: &str| crate::phonemize(s, "nl").unwrap();
        for (section, plain) in [
            ("Zie hoofdstuk 3.12 hier", "Zie hoofdstuk 3 . 12 hier"),
            (
                "In Hoofdstuk 2.10 staat het",
                "In Hoofdstuk 2 . 10 staat het",
            ),
            ("Volgens art. 4.15 mag dat", "Volgens art. 4 . 15 mag dat"),
            ("versie 3.12 is uit", "versie 3 . 12 is uit"),
        ] {
            assert_eq!(nl(section), nl(plain), "{section}");
        }
        assert_eq!(nl("Het begint om 12.30 uur"), nl("Het begint om 12:30 uur"));
        assert_eq!(nl("rond 07.19 uur"), nl("rond 07:19 uur"));
    }

    /// test/dutch-1550-prefix-stem-e.test.ts: the prefix shift reaches a reduced stem ⟨e⟩; relational, built from
    /// words the engine already reads right (#1550).
    #[test]
    fn a_prefix_shift_reaches_a_reduced_stem_e() {
        let nl = |w: &str| phonemize_word(&js(w)).to_string_lossy();
        let prefix_of = |whole: &str, stem: &str| {
            let (w, s) = (nl(whole), nl(stem));
            assert!(w.ends_with(&s), "{whole}");
            w[..w.len() - s.len()].to_string()
        };
        for (word, ref_whole, ref_stem, stem) in [
            ("vertellen", "verkopen", "kopen", "tellen"),
            ("vergeten", "verkopen", "kopen", "geten"),
            ("herkennen", "herhalen", "halen", "kennen"),
            ("bestellen", "bekijken", "kijken", "stellen"),
            ("gezellig", "gekocht", "kocht", "zellig"),
        ] {
            assert_eq!(
                nl(word),
                prefix_of(ref_whole, ref_stem) + &nl(stem),
                "{word}"
            );
        }
        for w in ["geven", "beter", "tegen", "verder", "tegenstander"] {
            let ipa = nl(w);
            let v = ipa.find(|c: char| "aeiouyɑɛɪɔʏəøœ".contains(c)).unwrap();
            assert!(ipa.find('ˈ').unwrap() < v, "{w}: {ipa}");
        }
    }

    /// test/dutch.test.ts's `phonemizeWord(…).toBe(…)` and `d.text(…).trim()` pins, and
    /// test/rate-denominator.test.ts's nl `phonemize(…, "nl").trim()` pins, extracted from those files
    /// MECHANICALLY (each is a reading the TS suite asserts), so the two engines are held to one list.
    const WORD_PINS: &[(&str, &str)] = &[
        ("water", "ʋˈaːtər"),
        ("dag", "dˈɑx"),
        ("man", "mˈɑn"),
        ("maken", "mˈaːkən"),
        ("tijd", "tˈɛi̯t"),
        ("huis", "ɦˈœy̯s"),
        ("vrouw", "vrˈɑu̯"),
        ("deur", "dˈøːr"),
        ("boek", "bˈuk"),
        ("mooi", "mˈoːi̯"),
        ("nieuw", "nˈiu̯"),
        ("geven", "ɣˈeːvən"),
        ("groot", "ɣrˈoːt"),
        ("acht", "ˈɑxt"),
        ("school", "sxˈoːl"),
        ("weg", "ʋˈɛx"),
        ("hond", "ɦˈɔnt"),
        ("goed", "ɣˈut"),
        ("huis", "ɦˈœy̯s"),
        ("zeven", "zˈeːvən"),
        ("over", "ˈoːvər"),
        ("zingen", "zˈɪŋən"),
        ("bank", "bˈɑŋk"),
        ("twintig", "tʋˈɪntəx"),
        ("mogelijk", "mˈoːɣələk"),
        ("typisch", "tˈipis"),
        ("big", "bˈɪx"),
        ("lijk", "lˈɛi̯k"),
        ("verkopen", "vərkˈoːpən"),
        ("gemaakt", "ɣəmˈaːkt"),
        ("begin", "bəɣˈɪn"),
        ("geven", "ɣˈeːvən"),
        ("geel", "ɣˈeːl"),
        ("knieën", "knˈiən"),
        ("tweeën", "tʋˈeːən"),
        ("poëzie", "pˈoːeːzi"),
        ("voetbalveld", "vˈutbɑlvˈɛlt"),
        ("huisdeur", "ɦˈœy̯sdˈøːr"),
        ("knooppunt", "knˈoːpˈʏnt"),
        ("voedingsstof", "vˈudɪŋstˈɔf"),
        ("minister", "mˈinɪstər"),
        ("drinken", "drˈɪŋkən"),
    ];
    const TEXT_PINS: &[(&str, &str)] = &[
        ("de kat", "də kˈɑt"),
        ("21", "ˈeːnəntʋɪntəx"),
        ("100", "ɦˈɔndərt"),
        ("400.000", "vˈirɦˈɔndərtdˈœy̯zənt"),
        ("1.000", "dˈœy̯zənt"),
        ("5.000.000", "vˈɛi̯f mˈɪljun"),
        ("6,5", "zˈɛs kˈɔmaː vˈɛi̯f"),
        ("de 18e eeuw", "də ˈɑxtində ˈeːu̯"),
        ("de 15de eeuw", "də vˈɛi̯ftində ˈeːu̯"),
        ("zijn 60ste", "zˈɛi̯n zˈɛstɪxstə"),
        ("de 1e dag", "də ˈeːrstə dˈɑx"),
        ("het 8e", "ɦət ˈɑxtstə"),
        ("om 12.00 uur", "ˈɔm tʋˈaːlf ˈyr"),
        ("om 11:35 uur", "ˈɔm ˈɛlf ˈyr vˈɛi̯fəndərtəx"),
        ("om 8.46 uur", "ˈɔm ˈɑxt ˈyr zˈeːsənvˈeːrtəx"),
        (
            "3.850 kilometer",
            "drˈidˈœy̯zənt ˈɑxtɔndərtvɛi̯ftəx kˈiloːmətər",
        ),
        ("bijv. een satelliet", "bˈɛi̯voːrbeːlt ˈeːn sˈaːtəlit"),
        (
            "rond 10.000 v.Chr. was",
            "rˈɔnt tˈindœy̯zənt vˈoːr xrˈɪstʏs ʋˈɑs",
        ),
        ("foto's e.d. van", "fˈoːtɔs ˈɛn dˈɛrɣələkə vˈɑn"),
        ("kosmonaut nr. 11", "kˈɔsmoːnɑu̯t nˈʏmər ˈɛlf"),
        ("St. Petersburg", "sˈɪnt pˈeːtərsbˈʏrx"),
        ("de V.S. met", "də vˈeː ˈɛs mˈɛt"),
        ("de VS en", "də vˈeː ˈɛs ˈɛn"),
        ("de FBI", "də ˈɛf bˈeː ˈi"),
        ("de CEO", "də sˈeː ˈeː ˈoː"),
        ("D. K. Arya", "dˈeː kˈaː ˈaːriaː"),
        ("20% van", "tʋˈɪntəx prˈoːsənt vˈɑn"),
        ("$ 1000", "dˈœy̯zənt dˈɔlɑr"),
        ("£ 27 miljoen", "zˈeːvənəntʋˈɪntəx mˈɪljun pˈɔnt"),
        ("70 km", "zˈeːvəntəx kˈiloːmətər"),
        ("83 km/u", "drˈiəntˈɑxtəx kˈiloːmətər pˈɛr ˈyr"),
        (
            "3.850 km²",
            "drˈidˈœy̯zənt ˈɑxtɔndərtvɛi̯ftəx vˈirkˈɑntə kˈiloːmətər",
        ),
        ("30 °C", "dˈɛrtəx ɣrˈaːdən sˈɛlsiʏs"),
        (
            "US$ 14,7 miljard",
            "vˈeːrtin kˈɔmaː zˈeːvən mˈɪljɑrt dˈɔlɑr",
        ),
        (
            "US$\u{a0}14,7 miljard",
            "vˈeːrtin kˈɔmaː zˈeːvən mˈɪljɑrt dˈɔlɑr",
        ),
        ("AUD$\u{a0}5", "vˈɛi̯f dˈɔlɑr"),
        ("UTC+1", "ˈy tˈeː sˈeː plˈʏs ˈeːn"),
        ("Arts & Sciences", "ˈɑrts ˈɛn sˈinsəs"),
        ("de P&R", "də pˈeː ˈɛn ˈɛr"),
        ("1/5 inch", "ˈeːn vˈɛi̯fdə ˈɪnx"),
    ];
    const PUBLIC_PINS: &[(&str, &str)] = &[
        ("160 km/uur", "ɦˈɔndərtzˈɛstəx kˈiloːmətər ˈyr"),
        (
            "9.8 m/s2",
            "nˈeːɣən . ˈɑxt mˈeːtər pˈɛr vˈirkˈɑntə sˈeːkɔndə",
        ),
        (
            "3 m/s2020",
            "drˈi mˈeːtər pˈɛr sˈeːkɔndə tʋˈeːdˈœy̯zənt tʋˈɪntəx",
        ),
        ("5 km/h2a", "vˈɛi̯f kˈiloːmətər pˈɛr ˈyr tʋˈeː ˈaː"),
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        let d = create_dutch().unwrap();
        for (w, want) in WORD_PINS {
            assert_eq!(phonemize_word(&js(w)).to_string_lossy(), *want, "{w}");
        }
        for (t, want) in TEXT_PINS {
            assert_eq!(d.text(&js(t)).trim().to_string_lossy(), *want, "{t}");
        }
        for (t, want) in PUBLIC_PINS {
            assert_eq!(crate::phonemize(t, "nl").unwrap().trim(), *want, "{t}");
        }
    }

    /// test/dutch-1524.test.ts and the nl row of test/fraction-guards-1495.test.ts: relational or structural.
    #[test]
    fn the_1524_findings_are_fixed() {
        create_dutch().unwrap();
        let nl = |s: &str| crate::phonemize(s, "nl").unwrap();
        let same = [
            // 1) a grouped amount keeps its decimal
            ("3.000,50 euro", "3000,50 euro"),
            ("1.000.000,25 euro", "1000000,25 euro"),
            ("1.000, dan", "1000, dan"),
            // 2) ì ò ù are vowels
            ("però", "pero"),
            ("lì", "li"),
            ("più", "piu"),
            // 4) the fraction guards are mirrors
            ("1/2,5", "1 2,5"),
            ("1,5/2", "1,5 2"),
            ("1/2.5", "1 2.5"),
            ("1.5/2", "1.5 2"),
            ("3/1/2", "3 1 2"),
            ("1/2/3", "1 2 3"),
            ("1/2,3/4", "1/2, 3/4"),
            ("1/2.", "1/2 ."),
        ];
        for (a, b) in same {
            assert_eq!(nl(a), nl(b), "{a} vs {b}");
        }
        assert_ne!(nl("1/3"), nl("1 3"));
        assert!(to_segments(&js("però")).last().unwrap().vowel);
        // 3) an e-digraph spelling is not a prefix; a real prefix still shifts
        for w in ["beenhouwer", "geelzucht", "beurtman", "geilheid", "teelbal"] {
            let ipa: Vec<char> = phonemize_word(&js(w)).to_string_lossy().chars().collect();
            let onset = if w.starts_with('g') {
                'ɣ'
            } else {
                w.chars().next().unwrap()
            };
            assert_eq!(&ipa[..2], &[onset, 'ˈ'], "{w}");
            assert!(!ipa[..4].contains(&'ə'), "{w}");
        }
        for w in ["beginnen", "gebruiken", "beëdigen", "beamen", "verkopen"] {
            let ipa: Vec<char> = phonemize_word(&js(w)).to_string_lossy().chars().collect();
            assert!(!ipa[..2].contains(&'ˈ'), "{w}");
        }
    }
}
