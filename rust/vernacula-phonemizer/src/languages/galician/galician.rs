//! Galician (gl) phonemizer, galego: rule g2p → coda nasal velarization → spirantization (within the word and
//! across word edges) → rule stress, and text() over words, numbers and clause punctuation.
//! Ported from src/languages/galician/galician.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::LazyLock;

use super::g2p::{Seg, to_segments};
use super::manifest::{MANIFEST, try_manifest};
use super::normalize::normalize_galician;
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::trace::note_rewrite;
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

fn set(xs: &[String]) -> HashSet<JsString> {
    xs.iter().map(|x| js(x)).collect()
}
static NASALS: LazyLock<HashSet<JsString>> = LazyLock::new(|| set(&MANIFEST.nasals));
static VELARS: LazyLock<HashSet<JsString>> = LazyLock::new(|| set(&MANIFEST.velars));
static FUNCTION_WORDS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| set(&MANIFEST.function_words));

fn stop_to_fric(ph: &JsString) -> Option<JsString> {
    MANIFEST
        .spirantize
        .get(&ph.to_string_lossy())
        .map(|f| js(f))
}

/// `velarizeNasal`: n → ŋ word-finally, before a velar, or in the final -ns; a word-final m → ŋ.
fn velarize_nasal(segs: &mut [Seg]) {
    let len = segs.len();
    for i in 0..len {
        let next = if i + 1 < len {
            segs[i + 1].ph.clone()
        } else {
            JsString::new()
        };
        if segs[i].ph == "n" {
            if next.is_empty() || VELARS.contains(&next) || (next == "s" && i + 2 == len) {
                segs[i].ph = js("ŋ");
            }
        } else if segs[i].ph == "m" && next.is_empty() {
            segs[i].ph = js("ŋ");
        }
    }
}

/// `spirantize`: b/d/ɡ → β/ð/ɣ except word-initially, after a nasal, or d after l.
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
        let stop = i == 0 || NASALS.contains(&prev) || (segs[i].ph == "d" && prev == "l");
        if !stop {
            segs[i].ph = fric;
        }
    }
}

/// `spirantizeAcrossWords`, reported to the trace as positional.
fn spirantize_across_words(ipa: &JsString) -> JsString {
    let out = js_re!(r"([^\s])(\s+)([bdɡ])", "gu").replace_with(ipa, |m, s| {
        let whole = m.value(s);
        let (prev, gap, stop) = (
            m.group(1, s).unwrap(),
            m.group(2, s).unwrap(),
            m.group(3, s).unwrap(),
        );
        if NASALS.contains(&prev) || (stop == "d" && prev == "l") {
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

/// `stressedNucleus`: the written accent, else penult when the last SEGMENT is a nucleus or the word ends in n/s.
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
    // `word.toLowerCase().at(-1) ?? ""`: the last code UNIT.
    let w = word.to_lower_case();
    let last = if w.is_empty() {
        JsString::new()
    } else {
        w.char_at(w.len() - 1)
    };
    let penult = segs[segs.len() - 1].nucleus || last == "n" || last == "s";
    Some(if penult {
        nuclei[nuclei.len() - 2]
    } else {
        nuclei[nuclei.len() - 1]
    })
}

/// `phonemizeWord(word)`: one Galician word to canonical IPA, with its stress mark.
pub fn phonemize_word(word: &JsString) -> JsString {
    let mut segs = to_segments(word);
    if segs.is_empty() {
        return JsString::new();
    }
    velarize_nasal(&mut segs);
    spirantize(&mut segs);
    let stress = stressed_nucleus(word, &segs);
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
            *LATIN_RUN
        ),
        "giu",
    )
    .unwrap()
});

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: the nativiser over Galician's own inventory.
pub static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[a-záéíóúüñ]", "iu")));

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

/// `wordIpa`: a function word loses its (first) stress mark.
fn word_ipa(word: &JsString) -> JsString {
    let ipa = phonemize_word(word);
    if FUNCTION_WORDS.contains(&word.to_lower_case()) {
        js_re!("ˈ").replace(&ipa, &JsString::new())
    } else {
        ipa
    }
}

/// `SYMBOLS`'s argument, generated from the object literal in galician.ts (key order preserved) by evaluating
/// that literal and printing `JSON.stringify` of it (the `symbols` dump records it).
const SYMBOL_DATA: &str = r#"{"percent":["por cento"],"currency":{"€":["euro","euros"],"$":["dólar","dólares"],"£":["libra","libras"],"¥":["ien","iens"]},"units":{"km":["quilómetro","quilómetros"],"cm":["centímetro","centímetros"],"mm":["milímetro","milímetros"],"kg":["quilogramo","quilogramos"],"t":["tonelada","toneladas"],"g":["gramo","gramos"],"l":["litro","litros"],"ha":["hectárea","hectáreas"],"h":["hora","horas"],"s":["segundo","segundos"],"m":["metro","metros"]},"unitPer":"por","exponentWords":{"squared":["cadrado","cadrados"],"cubed":["cúbico","cúbicos"]},"bareExponent":{"squared":"{n} ao cadrado"},"multiply":{"times":"multiplicado por","by":"por"},"ampersand":"e","magnitudes":["millóns","millón"],"magnitudeConnective":"de"}"#;

/// The Galician engine (`createGalician`).
pub struct GalicianPhonemizer {
    symbols: SymbolNormalizer,
}

impl GalicianPhonemizer {
    /// The shared symbol tier with Galician's data.
    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self.symbols.apply(&normalize_galician(input));
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

impl Engine for GalicianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(GalicianPhonemizer::text(self, input))
    }
}

/// `createGalician()`. Errors when the manifest cannot be loaded or the symbol tier refuses it.
pub fn create_galician() -> Result<GalicianPhonemizer, String> {
    try_manifest()?;
    let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
    Ok(GalicianPhonemizer {
        symbols: make_symbol_normalizer(&data)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::languages::galician::normalize::galician_ordinal;

    // test/galician.test.ts's pins, extracted from that file mechanically (each is a reading the TS suite asserts),
    // so the two engines are held to one list. `TEXT_PINS` are its `gl.text(s).trim()`, `PHONEMIZE_PINS` its
    // `phonemize(s, "gl").trim()`.
    const WORD_PINS: &[(&str, &str)] = &[
        ("peixe", "pˈeᶦʃe"),
        ("xente", "ʃˈente"),
        ("caixa", "kˈaᶦʃa"),
        ("baixo", "bˈaᶦʃo"),
        ("galego", "ɡalˈeɣo"),
        ("xénero", "ʃˈeneɾo"),
        ("unha", "ˈuŋa"),
        ("cinco", "θˈiŋko"),
        ("un", "ˈuŋ"),
        ("carballo", "kaɾβˈaʎo"),
        ("ollo", "ˈoʎo"),
        ("mañá", "maɲˈa"),
        ("chave", "t͡ʃˈaβe"),
        ("home", "ˈome"),
        ("auga", "ˈaᶷɣa"),
        ("dous", "dˈoᶷs"),
        ("cantou", "kantˈoᶷ"),
        ("amei", "amˈeᶦ"),
        ("muíño", "muˈiɲo"),
        ("ruído", "ruˈiðo"),
        ("viúva", "biˈuβa"),
        ("saíu", "saˈiᶷ"),
        ("cans", "kˈaŋs"),
        ("cancións", "kanθjˈoŋs"),
        ("texto", "tˈeksto"),
    ];
    const TEXT_PINS: &[(&str, &str)] = &[
        ("21", "bˈinte e uŋ"),
        ("35", "tɾˈinta e θˈiŋko"),
        ("100", "θˈeŋ"),
        ("275", "doᶷsθˈentos setˈenta e θˈiŋko"),
        ("1200", "mˈil doᶷsθˈentos"),
        ("3000000", "tɾˈes miʎˈoŋs"),
        ("2000000000", "dˈoᶷs mˈil miʎˈoŋs"),
        ("Bo día, Galicia!", "bˈo ðˈia , ɡalˈiθja !"),
        ("1º", "pɾimˈeᶦɾo"),
        ("35 %", "tɾˈinta e θˈiŋko poɾ θˈento"),
        ("100 €", "θˈeŋ ˈeᶷɾos"),
        ("US$ 500", "θiŋkoθˈentos ðˈolaɾes"),
        ("R$ 30", "tɾˈinta rˈeaᶦs"),
        ("12,5 km", "dˈoθe kˈoma θˈiŋko kilˈometɾos"),
        ("120 km/h", "θˈento βˈinte kilˈometɾos poɾ ˈoɾa"),
        ("5 millóns de euros", "θˈiŋko miʎˈoŋs ðe ˈeᶷɾos"),
        ("1 millón de km²", "uŋ miʎˈoŋ de kilˈometɾos kaðɾˈaðos"),
        ("10 km²", "dˈeθ kilˈometɾos kaðɾˈaðos"),
        ("5²", "θˈiŋko ao kaðɾˈaðo"),
        ("5 × 3", "θˈiŋko multiplikˈaðo poɾ tɾˈes"),
        ("4x4", "kˈatɾo poɾ kˈatɾo"),
        ("Thames & Hudson", "tˈames e ˈuðsoŋ"),
        (
            "de 1996-1998",
            "de mˈil noβeθˈentos noβˈenta e sˈeᶦs a mˈil noβeθˈentos noβˈenta e ˈoᶦto",
        ),
        ("1.500 persoas", "mˈil θiŋkoθˈentos peɾsˈoas"),
        ("EEUU", "e e ˈu ˈu"),
        ("ONU", "ˈonu"),
    ];
    const PHONEMIZE_PINS: &[(&str, &str)] = &[
        ("século XV", "sˈekulo kˈinθe"),
        ("século XIX", "sˈekulo ðeθanˈoβe"),
    ];
    const NORMALIZE_PINS: &[(&str, &str)] = &[
        ("1º", "primeiro"),
        ("2ª", "segunda"),
        ("21ª", "vixésima primeira"),
        ("a 4.ª vez", "a cuarta vez"),
        ("o 1.000º", "o 1.000"),
        ("entre 400º e 1300º", "entre 400 e 1300"),
        ("1200 a. C.", "1200 antes de Cristo"),
        ("534 a.C. e", "534 antes de Cristo e"),
        ("2000 d.C.", "2000 despois de Cristo"),
        ("a. e. c.", "antes da Era común"),
        ("n.º 5", "número 5"),
        ("no 5 de maio", "no 5 de maio"),
        ("Dr. Silva", "doutor Silva"),
        ("etc.", "etcétera."),
        ("ſr. Silva", "ſr. Silva"),
        ("ſra. Pardo", "ſra. Pardo"),
        ("0 °C", "0 graos Celsius"),
        ("104,45°", "104,45 graos"),
        ("-5°C a 600 atm", "menos 5 graos Celsius a 600 atm"),
        ("10⁻³", "10⁻³"),
        ("ás 11:35", "ás once e trinta e cinco"),
        ("ás 06:00", "ás seis"),
        ("ás 11:12:01 do martes", "ás 11 12 01 do martes"),
        ("(00:36:59)", "(00 36 59)"),
        ("3 > 0", "3 maior que 0"),
        ("2 < 5", "2 menor que 5"),
        ("a = b", "a igual a b"),
        ("8593 ÷ 23", "8593 dividido por 23"),
        ("UTC +1", "u te ce máis 1"),
        ("1/2", "medio"),
        ("1/3", "un terzo"),
        ("2/3", "dous terzos"),
        ("3/4", "tres cuartos"),
        ("8/9", "oito novenos"),
        ("1/12", "un décimo segundo"),
        ("MARPOL 73/78", "MARPOL 73/78"),
        ("1994/1995", "1994/1995"),
        ("de 1996-1998", "de 1996 a 1998"),
        ("100–200 metros", "100 a 200 metros"),
        ("entre 1824–1843.", "entre 1824 a 1843."),
        ("48.26 km", "48 coma 26 km"),
        ("(11.1%)", "(11 coma 1%)"),
        ("4.2-3.9", "4 coma 2 a 3 coma 9"),
        ("460.000 km", "460.000 km"),
        ("106.460.000 km²", "106.460.000 km²"),
    ];
    const ORDINAL_PINS: &[(&str, &str)] = &[
        ("1", "primeiro"),
        ("9", "noveno"),
        ("10", "décimo"),
        ("28", "vixésimo oitavo"),
        ("90", "nonaxésimo"),
        ("100", "centésimo"),
    ];

    #[test]
    fn ts_word_and_text_pins() {
        let gl = create_galician().unwrap();
        for (w, want) in WORD_PINS {
            assert_eq!(phonemize_word(&js(w)).to_string_lossy(), *want, "{w}");
        }
        for (t, want) in TEXT_PINS {
            assert_eq!(gl.text(&js(t)).trim().to_string_lossy(), *want, "{t}");
        }
        for (t, want) in PHONEMIZE_PINS {
            assert_eq!(crate::phonemize(t, "gl").unwrap().trim(), *want, "{t}");
        }
    }

    #[test]
    fn ts_normalize_and_ordinal_pins() {
        create_galician().unwrap();
        for (t, want) in NORMALIZE_PINS {
            assert_eq!(normalize_galician(&js(t)).to_string_lossy(), *want, "{t}");
        }
        for (n, want) in ORDINAL_PINS {
            assert_eq!(
                galician_ordinal(n.parse().unwrap())
                    .unwrap()
                    .to_string_lossy(),
                *want,
                "{n}"
            );
        }
        assert!(galician_ordinal(101.0).is_none() && galician_ordinal(0.0).is_none());
    }
}
