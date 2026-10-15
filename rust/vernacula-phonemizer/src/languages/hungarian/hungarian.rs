//! Hungarian (hu) phonemizer: a longest-match scan over the manifest's rule table, gemination, j-palatalisation,
//! nasal place assimilation, regressive voicing and a geminate merge, with fixed first-syllable stress; text()
//! over Latin words (a foreign name nativised), numbers and clause punctuation.
//! Ported from src/languages/hungarian/hungarian.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{MANIFEST, try_manifest};
use super::normalize::{is_unreadable_hungarian, normalize_hungarian, try_symbols};
use super::numbers::{multiplicative_words, number_to_words, ordinal_words, stem_for_suffix};
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

#[derive(Clone, Debug)]
pub struct Seg {
    pub ph: JsString,
    pub v: bool,
}

/// `RULES`, as code-unit strings.
static RULES: LazyLock<Vec<(JsString, JsString, bool)>> = LazyLock::new(|| {
    MANIFEST
        .rules
        .iter()
        .map(|(o, i, v)| (js(o), js(i), *v))
        .collect()
});

const PAL: [(&str, &str); 6] = [
    ("d", "ɟ"),
    ("t", "c"),
    ("n", "ɲ"),
    ("l", "j"),
    ("ɟ", "ɟ"),
    ("c", "c"),
];
const DEVOICE: [(&str, &str); 9] = [
    ("b", "p"),
    ("d", "t"),
    ("ɡ", "k"),
    ("v", "f"),
    ("z", "s"),
    ("ʒ", "ʃ"),
    ("d͡z", "t͡s"),
    ("d͡ʒ", "t͡ʃ"),
    ("ɟ", "c"),
];
const VOICE: [(&str, &str); 9] = [
    ("p", "b"),
    ("t", "d"),
    ("k", "ɡ"),
    ("f", "v"),
    ("s", "z"),
    ("ʃ", "ʒ"),
    ("t͡s", "d͡z"),
    ("t͡ʃ", "d͡ʒ"),
    ("c", "ɟ"),
];

fn lookup(table: &[(&str, &str)], key: &JsString) -> Option<JsString> {
    table
        .iter()
        .find(|(k, _)| js(k) == *key)
        .map(|(_, v)| js(v))
}

/// `base(ph)`: one trailing ː removed.
fn base(ph: &JsString) -> JsString {
    js_re!("ː$", "u").replace(ph, &JsString::new())
}

fn long(ph: &JsString) -> JsString {
    ph.concat(&js("ː"))
}

/// `toSegments(word)`.
pub(crate) fn to_segments(word: &JsString) -> Vec<Seg> {
    let w = word.to_lower_case();
    let (csz, ch) = (js("csz"), js("ch"));
    let mut segs: Vec<Seg> = Vec::new();
    let mut i = 0;
    'outer: while i < w.len() {
        let rest = w.slice(i as isize, None);
        for (orth, ipa, v) in RULES.iter() {
            if *orth == js("cs") && rest.starts_with(&csz) {
                continue;
            }
            if *orth == ch
                && (js_re!("(?:harmin|kilen)c$", "u").test(&w.slice(0, Some((i + 1) as isize)))
                    || js_re!("^ch(?:oz|ez|öz)$", "u").test(&rest))
            {
                continue;
            }
            if rest.starts_with(orth) {
                segs.push(Seg {
                    ph: ipa.clone(),
                    v: *v,
                });
                i += orth.len();
                continue 'outer;
            }
        }
        i += 1;
    }
    let mut out: Vec<Seg> = Vec::new();
    for s in segs {
        if let Some(prev) = out.last_mut()
            && !prev.v
            && !s.v
            && prev.ph == s.ph
            && !js_re!("ː$", "").test(&s.ph)
        {
            prev.ph = long(&prev.ph);
            continue;
        }
        out.push(s);
    }
    let mut k = 0;
    while k + 1 < out.len() {
        if out[k + 1].ph == js("j")
            && let Some(p) = lookup(&PAL, &base(&out[k].ph))
        {
            out[k].ph = long(&p);
            out.remove(k + 1);
        }
        k += 1;
    }
    for k in 0..out.len().saturating_sub(1) {
        if out[k].ph != js("n") {
            continue;
        }
        let nb = base(&out[k + 1].ph).to_string_lossy();
        match nb.as_str() {
            "k" | "ɡ" => out[k].ph = js("ŋ"),
            "ɟ" | "c" => out[k].ph = js("ɲ"),
            "p" | "b" => out[k].ph = js("m"),
            _ => {}
        }
    }
    voicing_assimilation(&mut out);
    merge_geminates(&mut out);
    out
}

/// `mergeGeminates(segs)`: right to left, two consonants with one base → one long consonant.
fn merge_geminates(segs: &mut Vec<Seg>) {
    if segs.len() < 2 {
        return;
    }
    for k in (0..segs.len() - 1).rev() {
        let (a, b) = (&segs[k], &segs[k + 1]);
        if !a.v && !b.v && base(&a.ph) == base(&b.ph) {
            segs[k].ph = long(&base(&segs[k].ph));
            segs.remove(k + 1);
        }
    }
}

/// `voicingAssimilation(segs)`: regressive, right to left, length preserved.
fn voicing_assimilation(segs: &mut [Seg]) {
    let m = &*MANIFEST;
    if segs.len() < 2 {
        return;
    }
    for k in (0..segs.len() - 1).rev() {
        let b = base(&segs[k].ph);
        let nb = base(&segs[k + 1].ph).to_string_lossy();
        let is_long = segs[k].ph.ends_with(&js("ː"));
        let with_len = |p: JsString| if is_long { long(&p) } else { p };
        if m.voiceless_triggers.contains(&nb)
            && let Some(p) = lookup(&DEVOICE, &b)
        {
            segs[k].ph = with_len(p);
        } else if m.voiced_triggers.contains(&nb)
            && let Some(p) = lookup(&VOICE, &b)
        {
            segs[k].ph = with_len(p);
        }
    }
}

/// `phonemizeWord(word)`: the segments with a word-initial ˈ (empty for no segment).
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let segs = to_segments(word);
    if segs.is_empty() {
        return JsString::new();
    }
    let mut out = js("ˈ");
    for s in &segs {
        out.push_str(&s.ph);
    }
    out
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.!?…,;:])", *LATIN_RUN), "giu").unwrap());

const NATIVE_CLASS: &str = "[a-záéíóöőúüű]";

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "iu")));

/// The Hungarian engine (`createHungarian`).
pub struct HungarianPhonemizer;

/// The module functions, exposed through the engine: holding a `HungarianPhonemizer` proves the manifest and
/// the symbol tier loaded. (The per-module differentials call them.)
impl HungarianPhonemizer {
    /// `normalizeHungarian(text)` (the symbol tier and the initialism pass included).
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_hungarian(text)
    }

    /// `isUnreadableHungarian(word)`.
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_hungarian(word)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `toSegments(word)`.
    pub fn segments(&self, word: &JsString) -> Vec<Seg> {
        to_segments(word)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    /// `numberToWords(n, raw)` (numbers.ts).
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    /// `ordinalWords(n)` (numbers.ts).
    pub fn ordinal_words(&self, n: f64) -> Option<JsString> {
        ordinal_words(n)
    }

    /// `multiplicativeWords(n)` (numbers.ts).
    pub fn multiplicative_words(&self, n: f64) -> Option<JsString> {
        multiplicative_words(n)
    }

    /// `stemForSuffix(word, suffix)` (numbers.ts).
    pub fn stem_for_suffix(&self, word: &JsString, suffix: &JsString) -> JsString {
        stem_for_suffix(word, suffix)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let m = &*MANIFEST;
        assemble_clauses(&normalize_hungarian(input), &TOKEN, |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(num) = mm.group(2, s).filter(|n| !n.is_empty()) {
                for wd in number_to_words(js_number(&num), Some(&num)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = mm.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) = m
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for HungarianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(HungarianPhonemizer::text(self, input))
    }
}

/// `createHungarian()`. Errors when the manifest cannot be loaded or the symbol tier refuses its data.
pub fn create_hungarian() -> Result<HungarianPhonemizer, String> {
    try_manifest()?;
    try_symbols()?;
    Ok(HungarianPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/hungarian.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["magyar"], Some("ˈmɒɟɒr")),
        ("phonemizeWord", &["ország"], Some("ˈorsaːɡ")),
        ("phonemizeWord", &["szív"], Some("ˈsiːv")),
        ("phonemizeWord", &["gyerek"], Some("ˈɟɛrɛk")),
        ("phonemizeWord", &["kutya"], Some("ˈkucɒ")),
        ("phonemizeWord", &["könyv"], Some("ˈkøɲv")),
        ("phonemizeWord", &["asszony"], Some("ˈɒsːoɲ")),
        ("phonemizeWord", &["meggy"], Some("ˈmɛɟː")),
        ("phonemizeWord", &["dzsungel"], Some("ˈd͡ʒuŋɡɛl")),
        ("phonemizeWord", &["biztat"], Some("ˈbistɒt")),
        ("phonemizeWord", &["feddj"], Some("ˈfɛɟː")),
        ("phonemizeWord", &["hang"], Some("ˈhɒŋɡ")),
        ("createHungarian().text", &["21"], Some("ˈhusonɛɟ")),
        ("createHungarian().text", &["200"], Some("ˈkeːtsaːz")),
        (
            "createHungarian().text",
            &["234"],
            Some("ˈkeːtsaːzhɒrmint͡sneːɟ"),
        ),
        ("createHungarian().text", &["2000"], Some("ˈkeːtɛzɛr")),
        ("ROMAN_POLICY.ordinal", &["1"], Some("első")),
        ("ROMAN_POLICY.ordinal", &["2"], Some("második")),
        ("ROMAN_POLICY.ordinal", &["19"], Some("tizenkilencedik")),
        ("ROMAN_POLICY.ordinal", &["21"], Some("huszonegyedik")),
        ("ROMAN_POLICY.ordinal", &["40"], Some("negyvenedik")),
        ("ROMAN_POLICY.ordinal", &["50"], Some("ötvenedik")),
        ("ROMAN_POLICY.ordinal", &["63"], Some("hatvanharmadik")),
        ("ROMAN_POLICY.ordinal", &["100"], Some("századik")),
        ("ROMAN_POLICY.ordinal", &["101"], Some("százegyedik")),
        (
            "ROMAN_POLICY.ordinal",
            &["247"],
            Some("kétszáznegyvenhetedik"),
        ),
        ("ROMAN_POLICY.ordinal", &["1000"], Some("ezredik")),
        ("ROMAN_POLICY.ordinal", &["2000"], Some("kétezredik")),
        ("ROMAN_POLICY.ordinalAfter.test", &["század"], Some("true")),
        (
            "ROMAN_POLICY.ordinalAfter.test",
            &["században"],
            Some("true"),
        ),
        ("ROMAN_POLICY.ordinalAfter.test", &["századi"], Some("true")),
        (
            "ROMAN_POLICY.ordinalAfter.test",
            &["századtól"],
            Some("true"),
        ),
        (
            "ROMAN_POLICY.ordinalAfter.test",
            &["századok"],
            Some("true"),
        ),
        (
            "ROMAN_POLICY.ordinalAfter.test",
            &["évszázad"],
            Some("true"),
        ),
        ("ROMAN_POLICY.ordinalAfter.test", &["évezred"], Some("true")),
        ("ROMAN_POLICY.ordinalAfter.test", &["kerület"], Some("true")),
        (
            "ROMAN_POLICY.ordinalAfter.test",
            &["évforduló"],
            Some("true"),
        ),
        ("ROMAN_POLICY.ordinalAfter.test", &["szazad"], Some("false")),
        (
            "getPhonemizer(\"hu\").text",
            &["tizenkilencedik század"],
            Some("ˈtizɛŋkilɛnt͡sɛdik ˈsaːzɒd"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["XIX. század"],
            Some("ˈtizɛŋkilɛnt͡sɛdik ˈsaːzɒd"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["ötvenedik évforduló"],
            Some("ˈøtvɛnɛdik ˈeːfːorduloː"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["xix"],
            Some("ˈtizɛŋkilɛnt͡s"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["a 19. században"],
            Some("ˈɒ ˈtizɛŋkilɛnt͡sɛdik ˈsaːzɒdbɒn"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["a 7. legnagyobb"],
            Some("ˈɒ ˈhɛtɛdik ˈlɛɡnɒɟobː"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["Az 1000. bélyege"],
            Some("ˈɒz ˈɛzrɛdik ˈbeːjɛɡɛ"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["alkotmány 247. cikkelye"],
            Some("ˈɒlkotmaːɲ ˈkeːtsaːznɛɟvɛnhɛtɛdik ˈt͡sikːɛjɛ"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["a 11., 12. és 13. századokban"],
            Some("ˈɒ ˈtizɛnɛɟɛdik , ˈtizɛŋkɛtːɛdik ˈeːʃ ˈtizɛnhɒrmɒdik ˈsaːzɒdoɡbɒn"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["a görkorong és a Forma-1."],
            Some("ˈɒ ˈɡørkoroŋɡ ˈeːʃ ˈɒ ˈformɒ ˈɛɟ ."),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["rekordja 7 - 2."],
            Some("ˈrɛkorɟːɒ ˈheːt ˈkɛtːøː ."),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["az 1. és 2. New Hampshire ezred"],
            Some("ˈɒz ˈɛlʃøː ˈeːʃ ˈkɛtːøː . ˈnɛv ˈhɒmpʃhirɛ ˈɛzrɛd"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["1965. március 18-án"],
            Some("ˈɛzɛrkilɛnt͡ssaːzhɒtvɒnøt ˈmaːrt͡siuʃ ˈtizɛɲːolt͡sɒdikaːn"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["2017. szeptemberében"],
            Some("ˈkeːtɛzɛrtizɛnheːt ˈsɛptɛmbɛreːbɛn"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["a 2000. évi"],
            Some("ˈɒ ˈkeːtɛzrɛdik ˈeːvi"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["szeptember 17-én"],
            Some("ˈsɛptɛmbɛr ˈtizɛnhɛtɛdikeːn"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["július 1-jén"],
            Some("ˈjuːliuʃ ˈɛlʃɛjeːn"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["január 1-én"],
            Some("ˈjɒnuaːr ˈɛlʃɛjeːn"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["szeptember 11-e"],
            Some("ˈsɛptɛmbɛr ˈtizɛnɛɟɛdikɛ"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["augusztus 24. és"],
            Some("ˈɒuɡustuʃ ˈhusonːɛɟɛdikɛ ˈeːʃ"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["március 3. és"],
            Some("ˈmaːrt͡siuʃ ˈhɒrmɒdikɒ ˈeːʃ"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["1848-ban"],
            Some("ˈɛzɛrɲolt͡ssaːznɛɟvɛɲːold͡zbɒn"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["1970-es"],
            Some("ˈɛzɛrkilɛnt͡ssaːzhɛtvɛnɛʃ"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["6500-an"],
            Some("ˈhɒtɛzɛrøtsaːzɒn"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["2022-es"],
            Some("ˈkeːtɛzɛrhusoŋkɛtːɛʃ"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["1907-es"],
            Some("ˈɛzɛrkilɛnt͡ssaːzhɛtɛʃ"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["100.000 ember"],
            Some("ˈsaːzɛzɛr ˈɛmbɛr"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["30 000 ember"],
            Some("ˈhɒrmint͡sɛzɛr ˈɛmbɛr"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["3,5 méter"],
            Some("ˈhaːrom ˈɛɡeːs ˈøt ˈmeːtɛr"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["100,000 ember"],
            Some("ˈsaːzɛzɛr ˈɛmbɛr"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["10:00 és 11:00 között"],
            Some("ˈtiːz ˈeːʃ ˈtizɛnɛɟ ˈkøzøtː"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["11: 20-kor"],
            Some("ˈtizɛnɛɟ ˈhuːskor"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["120 km/h"],
            Some("ˈsaːzhuːs ˈkilomeːtɛr ˈpɛr ˈoːrɒ"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["19500 km²"],
            Some("ˈtizɛŋkilɛnt͡sɛzɛrøtsaːz ˈneːɟzɛtkilomeːtɛr"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["20 km-re"],
            Some("ˈhuːs ˈkilomeːtɛrːɛ"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["29%-a"],
            Some("ˈhusoŋkilɛnt͡s ˈsaːzɒleːkɒ"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["30°C"],
            Some("ˈhɒrmint͡s ˈt͡sɛlʃiuʃ ˈfok"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["35°-tól"],
            Some("ˈhɒrmint͡søt ˈfoktoːl"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["UTC+1"],
            Some("ˈuː ˈteː ˈt͡seː ˈplus ˈɛɟ"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["GPS"],
            Some("ˈɡeː ˈpeː ˈɛʃ"),
        ),
        ("getPhonemizer(\"hu\").text", &["FBI"], Some("ˈɛf ˈbeː ˈiː")),
        (
            "getPhonemizer(\"hu\").text",
            &["a GDP-je"],
            Some("ˈɒ ˈɡeː ˈdeː ˈpeːjɛ"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["az FBI-nak"],
            Some("ˈɒz ˈɛf ˈbeː ˈiːnɒk"),
        ),
        ("getPhonemizer(\"hu\").text", &["ENSZ"], Some("ˈɛns")),
        ("getPhonemizer(\"hu\").text", &["USA"], Some("ˈuʃɒ")),
        (
            "getPhonemizer(\"hu\").text",
            &["a WC-ben"],
            Some("ˈɒ ˈveːt͡seːbɛn"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["mint pl. vírus"],
            Some("ˈmint ˈpeːldaːul ˈviːruʃ"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["kb. 20 km-re"],
            Some("ˈkørylbɛlyl ˈhuːs ˈkilomeːtɛrːɛ"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["Kr.e. 356"],
            Some("ˈkristuʃ ˈɛløːtː ˈhaːromsaːzøtvɛnhɒt"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["Dr. Moll"],
            Some("ˈdoktor ˈmolː"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["ételek stb."],
            Some("ˈeːtɛlɛk ˈʃɒtøbːi ."),
        ),
        ("phonemizeWord", &["nyolcszáz"], Some("ˈɲolt͡ssaːz")),
        ("phonemizeWord", &["kilencszáz"], Some("ˈkilɛnt͡ssaːz")),
        ("phonemizeWord", &["kilencszer"], Some("ˈkilɛnt͡ssɛr")),
        (
            "getPhonemizer(\"hu\").text",
            &["22500"],
            Some("ˈhusoŋkeːtɛzɛrøtsaːz"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["32000"],
            Some("ˈhɒrmint͡skeːtɛzɛr"),
        ),
        ("numberToWords", &["10"], Some("tíz")),
        ("numberToWords", &["11"], Some("tizenegy")),
        ("numberToWords", &["19"], Some("tizenkilenc")),
        ("numberToWords", &["1015"], Some("ezertizenöt")),
        ("numberToWords", &["20"], Some("húsz")),
        ("numberToWords", &["21"], Some("huszonegy")),
        ("numberToWords", &["2012"], Some("kétezertizenkettő")),
        (
            "getPhonemizer(\"hu\").text",
            &["10 mp"],
            Some("ˈtiːz ˈmaːʃotpɛrt͡s"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["300 mp/h"],
            Some("ˈhaːromsaːz ˈmaːʃotpɛrt͡s ˈpɛr ˈoːrɒ"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["133 m/s"],
            Some("ˈsaːzhɒrmint͡shaːrom ˈmeːtɛr ˈpɛr ˈmaːʃotpɛrt͡s"),
        ),
        (
            "getPhonemizer(\"hu\").text",
            &["480 km/h"],
            Some("ˈneːcsaːzɲolt͡svɒn ˈkilomeːtɛr ˈpɛr ˈoːrɒ"),
        ),
        ("phonemizeWord", &["charles"], Some("ˈt͡ʃɒrlɛʃ")),
        ("phonemizeWord", &["zachary"], Some("ˈzɒt͡ʃɒri")),
        ("phonemizeWord", &["nicholas"], Some("ˈnit͡ʃolɒʃ")),
        ("phonemizeWord", &["schumacher"], Some("ˈʃumɒt͡ʃɛr")),
        ("phonemizeWord", &["schneider"], Some("ˈʃnɛidɛr")),
        ("phonemizeWord", &["harminchat"], Some("ˈhɒrmint͡shɒt")),
        ("phonemizeWord", &["harminchárom"], Some("ˈhɒrmint͡shaːrom")),
        ("phonemizeWord", &["archoz"], Some("ˈɒrt͡shoz")),
        ("phonemizeWord", &["tánchoz"], Some("ˈtaːnt͡shoz")),
        ("phonemizeWord", &["perchez"], Some("ˈpɛrt͡shɛz")),
        ("phonemizeWord", &["cukor"], Some("ˈt͡sukor")),
        ("phonemizeWord", &["kilenc"], Some("ˈkilɛnt͡s")),
        ("phonemizeWord", &["csak"], Some("ˈt͡ʃɒk")),
        ("phonemizeWord", &["meccs"], Some("ˈmɛt͡ʃː")),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_hungarian().unwrap();
        let roman = super::super::roman_ordinals::roman_policy();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "numberToWords" => Some(e.number_to_words(js_number(&a(0)), None)),
                "createHungarian().text" => Some(e.text(&a(0))),
                "getPhonemizer(\"hu\").text" => {
                    Some(crate::registry::phonemize_in("hu", &a(0)).unwrap())
                }
                "ROMAN_POLICY.ordinal" => {
                    (roman.ordinal.as_ref().unwrap())(js_number(&a(0)) as u32)
                }
                "ROMAN_POLICY.ordinalAfter.test" => Some(js(&roman
                    .ordinal_after
                    .as_ref()
                    .unwrap()
                    .test(&a(0))
                    .to_string())),
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
