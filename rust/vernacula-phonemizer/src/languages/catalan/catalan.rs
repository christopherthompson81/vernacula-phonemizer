//! Catalan (ca) phonemizer, General Eastern/Central: rule g2p → 2R stress → unstressed vowel reduction →
//! voicing and nasal assimilation → final processes → bl/gl gemination → spirantization (within the word and
//! across word edges), and text() over words, numbers and clause punctuation.
//! Ported from src/languages/catalan/catalan.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::g2p::{Seg, to_segments};
use super::manifest::{DIR, MANIFEST, try_manifest};
use super::normalize::normalize_catalan;
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::trace::note_rewrite;
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

type WordMap = IndexMap<JsString, JsString>;

/// `mid-vowels.tsv` and `bl-gl-geminate.tsv`, both optional (a missing file is an empty map, as in the TS).
fn try_lists() -> Result<&'static (WordMap, WordMap), String> {
    static L: OnceLock<(WordMap, WordMap)> = OnceLock::new();
    load_once(&L, || {
        let opt = || TsvOptions {
            optional: true,
            ..Default::default()
        };
        let mid = load_tsv_strings(DIR, "mid-vowels.tsv", opt()).map_err(|e| e.to_string())?;
        let gem = load_tsv_strings(DIR, "bl-gl-geminate.tsv", opt()).map_err(|e| e.to_string())?;
        Ok((mid, gem))
    })
}

static LISTS: LazyLock<&'static (WordMap, WordMap)> =
    LazyLock::new(|| try_lists().unwrap_or_else(|e| panic!("{e}")));

fn set(xs: &[String]) -> HashSet<JsString> {
    xs.iter().map(|x| js(x)).collect()
}
static NASALS: LazyLock<HashSet<JsString>> = LazyLock::new(|| set(&MANIFEST.nasals));
static PALATALS: LazyLock<HashSet<JsString>> = LazyLock::new(|| set(&MANIFEST.palatals));
static FUNCTION_WORDS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| set(&MANIFEST.function_words));

fn lookup(map: &IndexMap<String, String>, ph: &JsString) -> Option<JsString> {
    map.get(&ph.to_string_lossy()).map(|f| js(f))
}
fn stop_to_fric(ph: &JsString) -> Option<JsString> {
    lookup(&MANIFEST.spirantize, ph)
}

fn is_sibilant(ph: &JsString) -> bool {
    *ph == "z" || *ph == "s" || *ph == "ʃ" || *ph == "ʒ"
}

/// `spirantizeAcrossWords`: the stop rule across a word edge of the assembled string. The sibilant is a
/// LOOKAHEAD capture (group 4), never consumed. Reported to the trace as positional.
fn spirantize_across_words(ipa: &JsString) -> JsString {
    let out = js_re!(r"([^\s])(\s+)([bdɡ])(?=([^\s]?))", "gu").replace_with(ipa, |m, s| {
        let whole = m.value(s);
        let prev = m.group(1, s).unwrap();
        let gap = m.group(2, s).unwrap();
        let stop = m.group(3, s).unwrap();
        let next = m.group(4, s).unwrap_or_default();
        if NASALS.contains(&prev) {
            return whole;
        }
        if stop == "d" && (prev == "ɫ" || prev == "ʎ") {
            return whole;
        }
        if is_sibilant(&next) {
            return whole;
        }
        if !js_re!(r"[\p{L}\p{M}ˈˌ]", "u").test(&prev) {
            return whole;
        }
        prev.concat(&gap)
            .concat(&stop_to_fric(&stop).unwrap_or(stop))
    });
    note_rewrite("spirantize-across-words", ipa, &out, true);
    out
}

/// `stressedNucleus`: written accent, a falling-diphthong final syllable, else the 2R rule.
fn stressed_nucleus(word: &JsString, segs: &[Seg]) -> Option<usize> {
    let nuclei: Vec<usize> = (0..segs.len()).filter(|&i| segs[i].nucleus).collect();
    if nuclei.is_empty() {
        return None;
    }
    if let Some(&a) = nuclei.iter().find(|&&i| segs[i].accent) {
        return Some(a);
    }
    if nuclei.len() == 1 {
        return Some(nuclei[0]);
    }
    let last_nuc = nuclei[nuclei.len() - 1];
    if let Some(after) = segs.get(last_nuc + 1)
        && !after.nucleus
        && (after.ph == "j" || after.ph == "w")
    {
        return Some(last_nuc);
    }
    let w = word.to_lower_case();
    let penult = js_re!("[aeiouàèéíòóúüï]$").test(&w)
        || js_re!("[aeiouàèéíòóúüï]s$").test(&w)
        || js_re!("[ei]n$").test(&w);
    Some(if penult {
        nuclei[nuclei.len() - 2]
    } else {
        last_nuc
    })
}

/// `reduce`: every unstressed nucleus takes its reduced vowel.
fn reduce(segs: &mut [Seg], stress: Option<usize>) {
    for (i, s) in segs.iter_mut().enumerate() {
        if s.nucleus
            && Some(i) != stress
            && let Some(r) = &s.reduced
        {
            s.ph = r.clone();
        }
    }
}

/// `DEVOICE` / `VOICE` (the TS objects' pairs).
const PAIRS: [(&str, &str); 8] = [
    ("b", "p"),
    ("d", "t"),
    ("ɡ", "k"),
    ("z", "s"),
    ("v", "f"),
    ("ʒ", "ʃ"),
    ("d͡ʒ", "t͡ʃ"),
    ("d͡z", "t͡s"),
];
fn devoice(ph: &JsString) -> Option<&'static str> {
    PAIRS.iter().find(|(v, _)| *ph == *v).map(|(_, u)| *u)
}
fn voice(ph: &JsString) -> Option<&'static str> {
    PAIRS.iter().find(|(_, u)| *ph == *u).map(|(v, _)| *v)
}

/// `voicingAssim`: regressive, right to left so it propagates through a cluster.
fn voicing_assim(segs: &mut [Seg]) {
    if segs.len() < 2 {
        return;
    }
    for i in (0..segs.len() - 1).rev() {
        let (a, b) = (segs[i].ph.clone(), segs[i + 1].ph.clone());
        if voice(&b).is_some() && devoice(&a).is_some() {
            segs[i].ph = js(devoice(&a).unwrap());
        } else if devoice(&b).is_some() && voice(&a).is_some() {
            segs[i].ph = js(voice(&a).unwrap());
        }
    }
}

/// `geminateBlGl`: an intervocalic-left b/ɡ before ɫ geminates.
fn geminate_bl_gl(segs: &mut [Seg]) {
    for i in 1..segs.len().saturating_sub(1) {
        let ph = segs[i].ph.clone();
        if (ph == "b" || ph == "ɡ") && segs[i - 1].nucleus && segs[i + 1].ph == "ɫ" {
            segs[i].ph = ph.concat(&js("ː"));
        }
    }
}

/// `spirantize`: b/d/ɡ → β/ð/ɣ except word-initially, after a nasal, d after a lateral, or before a sibilant.
fn spirantize(segs: &mut [Seg]) {
    for i in 0..segs.len() {
        let Some(fric) = stop_to_fric(&segs[i].ph) else {
            continue;
        };
        let prev = if i > 0 {
            segs[i - 1].ph.clone()
        } else {
            JsString::new()
        };
        let next_ph = segs.get(i + 1).map(|s| s.ph.clone()).unwrap_or_default();
        let after_lateral = prev == "ɫ" || prev == "ʎ" || prev == "ɫː";
        let stop = i == 0
            || NASALS.contains(&prev)
            || (after_lateral && segs[i].ph == "d")
            || is_sibilant(&next_ph);
        if !stop {
            segs[i].ph = fric;
        }
    }
}

/// `nasalAssim`: coda n → ɲ / ŋ / m by the following consonant's place.
fn nasal_assim(segs: &mut [Seg]) {
    for i in 0..segs.len().saturating_sub(1) {
        if segs[i].ph != "n" {
            continue;
        }
        let nx = segs[i + 1].ph.clone();
        if PALATALS.contains(&nx) {
            segs[i].ph = js("ɲ");
        } else if nx == "k" || nx == "ɡ" || nx == "ɣ" {
            segs[i].ph = js("ŋ");
        } else if nx == "p" || nx == "b" || nx == "m" || nx == "β" || nx == "f" {
            segs[i].ph = js("m");
        }
    }
}

/// `CLUSTER_DROP[son]?.includes(stop)`; `with_r` is `CLUSTER_DROP_S`, which adds r and ɾ.
fn cluster_drop(son: &JsString, stop: &JsString, with_r: bool) -> bool {
    let td = *stop == "t" || *stop == "d";
    match son.to_string_lossy().as_str() {
        "n" | "ɲ" | "ɫ" | "l" => td,
        "ŋ" => *stop == "k" || *stop == "ɡ",
        "m" => *stop == "p" || *stop == "b",
        "r" | "ɾ" => with_r && td,
        _ => false,
    }
}

/// `finalPass`: final-r deletion, the -Cs and final cluster drops (each re-entering), then final devoicing.
fn final_pass(segs: &mut Vec<Seg>, nuclei_count: usize) {
    let Some(last) = segs.last() else {
        return;
    };
    let last_ph = last.ph.clone();
    let n = segs.len();
    if (last_ph == "ɾ" || last_ph == "r") && nuclei_count >= 2 && n >= 2 && segs[n - 2].nucleus {
        segs.pop();
        return final_pass(segs, nuclei_count);
    }
    if last_ph == "s" && n >= 3 && cluster_drop(&segs[n - 3].ph, &segs[n - 2].ph, true) {
        segs.remove(n - 2);
        return final_pass(segs, nuclei_count);
    }
    if n >= 2 && cluster_drop(&segs[n - 2].ph, &last_ph, false) {
        segs.pop();
        return final_pass(segs, nuclei_count);
    }
    let new_last = segs.last_mut().unwrap();
    if let Some(dev) = lookup(&MANIFEST.final_devoice, &new_last.ph)
        && !new_last.nucleus
    {
        new_last.ph = dev;
    }
}

/// `phonemizeWord(word, unstressed)`: one Catalan word to canonical IPA. `unstressed` reads it as a proclitic
/// (no mark, every nucleus reduced).
pub fn phonemize_word(word: &JsString, unstressed: bool) -> JsString {
    let mut segs = to_segments(word);
    if segs.is_empty() {
        return JsString::new();
    }
    let stress = if unstressed {
        None
    } else {
        stressed_nucleus(word, &segs)
    };
    reduce(&mut segs, stress);
    let lower = word.to_lower_case();
    if let Some(st) = stress {
        match LISTS.0.get(&lower) {
            Some(f) if *f == "e" && segs[st].ph == "ɛ" => segs[st].ph = js("e"),
            Some(f) if *f == "o" && segs[st].ph == "ɔ" => segs[st].ph = js("o"),
            _ => {}
        }
    }
    nasal_assim(&mut segs);
    voicing_assim(&mut segs);
    let nuclei = segs.iter().filter(|s| s.nucleus).count();
    final_pass(&mut segs, nuclei);
    if LISTS.1.contains_key(&lower) {
        geminate_bl_gl(&mut segs);
    }
    spirantize(&mut segs);
    let mut out = JsString::new();
    for (i, s) in segs.iter().enumerate() {
        if Some(i) == stress {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&s.ph);
    }
    out
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"({})|(\d+(?:(?<!(?<!\d)0)\.\d+)*(?:,\d+)?)|([.!?…,;:])",
            host_word_run(&["Latin"], "·", "").unwrap()
        ),
        "giu",
    )
    .unwrap()
});

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: the nativiser over Catalan's own inventory.
pub static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[a-zàèéíòóúüïç·]", "iu")));

/// `numberTokenToWords`: thousands dots dropped, the decimal comma's digits read one by one.
fn number_token_to_words(tok: &JsString) -> JsString {
    let parts = tok.split(&js(","));
    let int_raw = js_re!(r"\.", "g").replace(&parts[0], &JsString::new());
    let mut words = number_to_words(js_number(&int_raw), Some(&int_raw));
    if let Some(frac) = parts.get(1) {
        let digits: Vec<JsString> = frac
            .code_point_strings()
            .iter()
            .map(|d| number_to_words(js_number(d), None))
            .collect();
        words = words
            .concat(&js(&format!(" {} ", MANIFEST.numbers.decimal_connector)))
            .concat(&JsString::join(&digits, &js(" ")));
    }
    words
}

/// `wordIpa`: a function word is de-stressed and reduced, except `o`/`no`/`com`, which only lose the mark.
fn word_ipa(word: &JsString) -> JsString {
    let lower = word.to_lower_case();
    if !FUNCTION_WORDS.contains(&lower) {
        return phonemize_word(word, false);
    }
    if lower == "o" || lower == "no" || lower == "com" {
        return js_re!("ˈ").replace(&phonemize_word(word, false), &JsString::new());
    }
    phonemize_word(word, true)
}

/// `SYMBOLS`'s argument, generated from the object literal in catalan.ts (key order preserved) by evaluating
/// that literal and printing `JSON.stringify` of it (the `symbols` dump records it).
const SYMBOL_DATA: &str = r#"{"multiply":{"times":"per"},"percent":["per cent"],"currency":{"€":["euro","euros"],"$":["dòlar","dòlars"],"£":["lliura","lliures"],"¥":["ien","iens"]},"units":{"km":["quilòmetre","quilòmetres"],"cm":["centímetre","centímetres"],"mm":["mil·límetre","mil·límetres"],"kg":["quilogram","quilograms"],"h":["hora","hores"],"s":["segon","segons"],"m":["metre","metres"]},"unitPer":"per","exponentWords":{"squared":["quadrat","quadrats"],"cubed":["cúbic","cúbics"]},"magnitudes":["milions","milió"],"magnitudeConnective":"de"}"#;

/// The Catalan engine (`createCatalan`).
pub struct CatalanPhonemizer {
    symbols: SymbolNormalizer,
}

impl CatalanPhonemizer {
    /// The shared symbol tier with Catalan's data.
    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self.symbols.apply(&normalize_catalan(input));
        let assembled = assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                sink.emit(&word_ipa(&NAT(&w)));
            } else if let Some(n) = m.group(2, s) {
                let words: Vec<JsString> = number_token_to_words(&n)
                    .split(&js(" "))
                    .iter()
                    .map(word_ipa)
                    .collect();
                sink.emit(&JsString::join(&words, &js(" ")));
            } else if let Some(p) = m.group(3, s)
                && let Some(mk) = MANIFEST
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        });
        spirantize_across_words(&assembled)
    }
}

impl Engine for CatalanPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(CatalanPhonemizer::text(self, input))
    }
}

/// `createCatalan()`. Errors when the manifest or a word list cannot be loaded, or the symbol tier refuses it.
pub fn create_catalan() -> Result<CatalanPhonemizer, String> {
    try_manifest()?;
    try_lists()?;
    let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
    Ok(CatalanPhonemizer {
        symbols: make_symbol_normalizer(&data)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::languages::catalan::normalize::ordinal_words;
    use crate::languages::catalan::roman_ordinals::{catalan_ordinal, roman_policy};

    // test/catalan.test.ts's pins, extracted from that file mechanically (each is a reading the TS suite asserts),
    // so the two engines are held to one list. `PH_PINS` are its `ph(s)` = `phonemize(s, "ca").trim()`.
    const WORD_PINS: &[(&str, &str)] = &[
        ("casa", "kˈazə"),
        ("mira", "mˈiɾə"),
        ("carro", "kˈaru"),
        ("xocolata", "ʃukuɫˈatə"),
        ("dona", "dˈɔnə"),
        ("pedra", "pˈeðɾə"),
        ("menja", "mˈeɲʒə"),
        ("por", "pˈoɾ"),
        ("Barcelona", "bəɾsəɫˈonə"),
        ("terra", "tˈɛrə"),
        ("cosa", "kˈɔzə"),
        ("any", "ˈaɲ"),
        ("panxa", "pˈaɲʃə"),
        ("caixa", "kˈaʃə"),
        ("peix", "pˈeʃ"),
        ("platja", "pɫˈad͡ʒə"),
        ("metge", "mˈed͡ʒə"),
        ("cotxe", "kˈot͡ʃə"),
        ("col·legi", "kuɫːˈɛʒi"),
        ("cel", "sˈɛɫ"),
        ("gel", "ʒˈɛɫ"),
        ("jo", "ʒˈɔ"),
        ("abduïda", "əβðuˈiðə"),
        ("peu", "pˈɛw"),
        ("ciutat", "siwtˈat"),
        ("ciència", "siˈɛnsiə"),
        ("llei", "ʎˈej"),
        ("cantar", "kəntˈa"),
        ("quinze", "kˈinzə"),
        ("absolta", "əpsˈɔɫtə"),
        ("esbós", "əzβˈos"),
        ("actitud", "əktitˈut"),
        ("vint", "bˈin"),
        ("cent", "sˈen"),
        ("molt", "mˈoɫ"),
        ("banc", "bˈaŋ"),
        ("sang", "sˈaŋ"),
        ("maig", "mˈat͡ʃ"),
        ("mig", "mˈit͡ʃ"),
        ("alga", "ˈaɫɣə"),
        ("remei", "rəmˈɛj"),
        ("correu", "kurˈɛw"),
        ("pausa", "pˈawzə"),
        ("taxi", "tˈaksi"),
        ("box", "bˈɔks"),
        ("examen", "əɡzˈamən"),
        ("forts", "fˈɔɾs"),
        ("fort", "fˈɔɾt"),
        ("poble", "pˈɔbːɫə"),
        ("regla", "rˈeɡːɫə"),
        ("problema", "pɾuβɫˈemə"),
        ("obligar", "uβɫiɣˈa"),
        ("correus", "kurˈɛws"),
        ("dijous", "diʒˈɔws"),
        ("remeis", "rəmˈɛjs"),
        ("aigua", "ˈajɣwə"),
        ("guardar", "ɡwəɾðˈa"),
        ("el", "ˈɛɫ"),
    ];
    const TEXT_PINS: &[(&str, &str)] = &[
        ("2", "dˈos"),
        ("21", "bˈin i un"),
        ("31", "tɾˈɛntə un"),
        ("100", "sˈen"),
        ("200", "dˈos sˈens"),
        ("2024", "dˈos mˈiɫ βˈin i kwˈatɾə"),
        ("El gat menja peix.", "əɫ ɣˈat mˈeɲʒə pˈeʃ ."),
        ("el gat", "əɫ ɣˈat"),
        ("del mar", "dəɫ mˈaɾ"),
        ("es posa", "əs pˈɔzə"),
        ("que ve", "kə βˈe"),
        ("ho fa", "u fˈa"),
        ("blanc o negre", "bɫˈaŋ o nˈɛɣɾə"),
        ("no ve", "no βˈe"),
        ("mel", "mˈɛɫ"),
        ("tren", "tɾˈɛn"),
        ("segle xix", "sˈeɡːɫə ðinˈɔw"),
        ("xix", "dinˈɔw"),
        ("cinquantè aniversari", "siŋkwəntˈɛ əniβəɾsˈaɾi"),
        ("vint i cinquè festival", "bˈin i siŋkˈɛ fəstiβˈaɫ"),
        ("la bota", "ɫə βˈotə"),
        ("la dona", "ɫə ðˈɔnə"),
        ("un dia", "un dˈiə"),
        ("el dia", "əɫ dˈiə"),
        ("segons de vídeo", "səɣˈons ðə βˈiðəu"),
    ];
    const PH_PINS: &[(&str, &str)] = &[
        ("el 4t dia", "əɫ kwˈaɾt ðˈiə"),
        ("20t", "bˈin t"),
        (
            "Durant els anys 1920s",
            "duɾˈan əɫs ˈaɲs mˈiɫ nˈɔw sˈens βˈin",
        ),
        ("els B&Bs", "əɫs βˈe i βˈes"),
        ("7è de rugbi", "sətˈɛ ðə rˈuɣβi"),
        ("la 7a illa", "ɫə sətˈɛnə ˈiʎə"),
        ("el 1r dia", "əɫ pɾimˈe ðˈiə"),
        ("1.400 persones", "mˈiɫ kwˈatɾə sˈens pəɾsˈonəs"),
        ("4.892 m", "kwˈatɾə mˈiɫ βˈujt sˈens nuɾˈantə ðˈos mˈɛtɾəs"),
        ("1.5 milions", "un pˈun sˈiŋ miɫiˈons"),
        ("2.4 Ghz", "dˈos pˈun kwˈatɾə ʒiɣəˈɛɾsis"),
        ("802.11n", "bˈujt sˈens ðˈos pˈun ˈonzə n"),
        ("11:35 PM", "ˈonzə tɾˈɛntə sˈiŋ pˈe ˈemə"),
        ("06:30 i les 07:30", "sˈis tɾəntˈaj ɫəs sˈɛt tɾˈɛntə"),
        ("segle III aC", "sˈeɡːɫə tɾˈɛs əβˈans ðə kɾˈist"),
        ("1.300 dC", "mˈiɫ tɾˈɛs sˈens ðəspɾˈes ðə kɾˈist"),
        ("1/5 polzades", "un siŋkˈɛ puɫzˈaðəs"),
        ("29¾ polzades", "bˈin i nˈɔw i tɾˈɛs kwˈaɾs puɫzˈaðəs"),
        ("30 °C", "tɾˈɛntə ɣɾˈaws səɫsˈiws"),
        ("2.500 ¥", "dˈos mˈiɫ sˈiŋ sˈens jˈɛns"),
        ("Dr. Moll", "duktˈo mˈɔʎ"),
        ("George W. Bush", "ʒəˈɔɾʒə w βˈus"),
        ("etc.", "ətsˈɛtəɾə ."),
        ("el 60è de la temporada", "əɫ səʃəntˈɛ ðə ɫə təmpuɾˈaðə"),
        ("la 190a posició", "ɫə sˈen nuɾəntˈɛnə puzisiˈo"),
        ("45s de vídeo", "kwəɾˈantə sˈiŋ səɣˈons ðə βˈiðəu"),
        ("35 ºS", "tɾˈɛntə sˈiŋ ɡɾˈaws sˈut"),
        ("els EUA", "əɫs ˈɛ ˈu ə"),
        ("l'ONU", "ɫ ˈɔnu"),
        ("B&B", "bˈe i βˈe"),
    ];
    const NORMALIZE_PINS: &[(&str, &str)] = &[
        ("7è de rugbi", "setè de rugbi"),
        ("la 7a illa", "la setena illa"),
        ("dC", "després de Crist"),
        ("aC", "abans de Crist"),
        ("el 4t dia", "el quart dia"),
        ("Durant els anys 1920s", "Durant els anys 1920"),
        ("els 2ns classificats", "els segons classificats"),
        ("els 22ns classificats", "els vint i segons classificats"),
        ("h5n1", "h5n1"),
        ("1/3", "un terç"),
        ("2/3", "dos terços"),
        ("3/4", "tres quarts"),
        ("2/5", "dos cinquens"),
        ("1/5", "un cinquè"),
        ("els anys 1920s", "els anys 1920"),
        ("els anys 90s", "els anys 90"),
        ("UTC +1", "u te ce més 1"),
    ];
    const ROMAN_PINS: &[(&str, &str)] = &[
        ("40", "quarantè"),
        ("50", "cinquantè"),
        ("60", "seixantè"),
        ("10", "desè"),
        ("19", "dinovè"),
        ("25", "vint i cinquè"),
        ("100", "centè"),
    ];
    const ORDINAL_WORDS_PINS: &[(f64, bool, &str)] = &[
        (40.0, false, "quarantè"),
        (60.0, false, "seixantè"),
        (90.0, true, "norantena"),
        (190.0, true, "cent norantena"),
        (200.0, false, "dos centè"),
        (900.0, true, "nou centena"),
        (102.0, false, "cent dosè"),
    ];

    #[test]
    fn ts_word_pins() {
        create_catalan().unwrap();
        for (w, want) in WORD_PINS {
            assert_eq!(
                phonemize_word(&js(w), false).to_string_lossy(),
                *want,
                "{w}"
            );
        }
    }

    #[test]
    fn ts_text_pins() {
        for (t, want) in TEXT_PINS {
            assert_eq!(crate::phonemize(t, "ca").unwrap(), *want, "{t}");
        }
        for (t, want) in PH_PINS {
            assert_eq!(crate::phonemize(t, "ca").unwrap().trim(), *want, "{t}");
        }
    }

    #[test]
    fn ts_normalize_and_ordinal_pins() {
        create_catalan().unwrap();
        for (t, want) in NORMALIZE_PINS {
            assert_eq!(normalize_catalan(&js(t)).to_string_lossy(), *want, "{t}");
        }
        for (n, want) in ROMAN_PINS {
            assert_eq!(
                catalan_ordinal(n.parse().unwrap())
                    .unwrap()
                    .to_string_lossy(),
                *want,
                "{n}"
            );
        }
        for (n, fem, want) in ORDINAL_WORDS_PINS {
            assert_eq!(
                ordinal_words(*n, *fem).unwrap().to_string_lossy(),
                *want,
                "{n}"
            );
        }
        let p = roman_policy();
        assert!(p.ordinal_before.is_none());
        let after = p.ordinal_after.as_ref().unwrap();
        assert!(
            !after.test(&js("segle"))
                && after.test(&js("aniversari"))
                && !after.test(&js("edició"))
        );
    }

    /// #1533: the digit and the Roman ordinal share one compositor, the suffixed cardinal.
    #[test]
    fn ts_one_ordinal_compositor_pins() {
        for n in [
            21.0, 22.0, 23.0, 24.0, 25.0, 29.0, 31.0, 101.0, 104.0, 105.0, 109.0, 110.0, 121.0,
            2024.0,
        ] {
            assert_eq!(ordinal_words(n, false), catalan_ordinal(n), "{n}");
        }
        for (n, fem, want) in [
            (21.0, false, "vint i unè"),
            (24.0, false, "vint i quatrè"),
            (21.0, true, "vint i unena"),
            (105.0, false, "cent cinquè"),
            (109.0, false, "cent novè"),
            (110.0, false, "cent desè"),
        ] {
            assert_eq!(
                ordinal_words(n, fem).unwrap().to_string_lossy(),
                want,
                "{n}"
            );
        }
        assert_eq!(
            crate::phonemize("El 21è aniversari i el XXI aniversari.", "ca").unwrap(),
            "əɫ βˈin i unˈɛ əniβəɾsˈaɾi i əɫ βˈin i unˈɛ əniβəɾsˈaɾi ."
        );
        assert_eq!(
            normalize_catalan(&js("el 21r")).to_string_lossy(),
            "el vint i primer"
        );
        assert_eq!(
            normalize_catalan(&js("la 21a")).to_string_lossy(),
            "la vint i unena"
        );
    }
}
