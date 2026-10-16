//! Kazakh (kk) phonemizer: the rule g2p, STRESSPOSN_1RU stress (the first reduced ə pulls stress to the syllable
//! before it), initial-cluster epenthesis, word-wide ɫ lightening, and text() over Cyrillic words, pre-phonemized
//! numbers and punctuation. Ported from src/languages/kazakh/kazakh.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::g2p::{Seg, to_segments};
use super::manifest::{MANIFEST, try_manifest};
use super::normalize::{normalize_kazakh, ordinal_word, orthographic};
use super::numbers::{digits_to_ipa, number_to_ipa};
use super::roman_ordinals::kk_roman_ordinal;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::normalize_symbols::{
    ExponentPosition, ExponentWords, Multiply, PositionDecl, SymbolData, SymbolNormalizer,
    make_symbol_normalizer,
};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// `VOWEL_OR_GLIDE`: the manifest's vowel and glide letters, as one class.
static VOWEL_OR_GLIDE: LazyLock<JsRegex> = LazyLock::new(|| {
    let keys: String = MANIFEST
        .vowels
        .keys()
        .chain(MANIFEST.glides.keys())
        .map(|k| k.as_str())
        .collect();
    JsRegex::new(&format!("[{keys}]"), "u").unwrap()
});
static FRONT_VOWEL: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("[{}]", MANIFEST.front_vowels), "u").unwrap());

/// `phonemizeWord(word)`: one word → IPA with a single stress mark.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    if !VOWEL_OR_GLIDE.test(&word.to_lower_case()) {
        let cons: Vec<JsString> = to_segments(word).into_iter().map(|s| s.ph).collect();
        let mut out = JsString::new();
        for (i, c) in cons.iter().enumerate() {
            out.push_str(c);
            out.push_str(&js(if i == cons.len() - 1 { "ˈə" } else { "ə" }));
        }
        return out;
    }
    let mut segs = to_segments(word);
    let is_cons = |s: &Seg| !s.nucleus && s.ph != "w" && s.ph != "j";
    if segs.len() >= 3 && is_cons(&segs[0]) && is_cons(&segs[1]) && is_cons(&segs[2]) {
        segs.insert(
            1,
            Seg {
                ph: js("ə"),
                nucleus: true,
            },
        );
    }
    let nuc_idx: Vec<usize> = (0..segs.len()).filter(|&i| segs[i].nucleus).collect();
    let mut out = JsString::new();
    if nuc_idx.is_empty() {
        for s in &segs {
            out.push_str(&s.ph);
        }
        return out;
    }
    let stress_nuc = (1..nuc_idx.len())
        .find(|&k| segs[nuc_idx[k]].ph == "ə")
        .map_or(nuc_idx.len() - 1, |k| k - 1);
    let stress_idx = nuc_idx[stress_nuc];
    for (i, s) in segs.iter().enumerate() {
        if i == stress_idx {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&s.ph);
    }
    if FRONT_VOWEL.test(&out) {
        out = js_re!(r"ɫ", "gu").replace(&out, &js("l"));
    }
    out
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        r"([Ѐ-ӿ]+)|([1-9]\d{0,2}(?:[ \u00a0\u202f\u2009]\d{3})+(?:,\d+)?|\d+,\d+|\d+)|([.!?…,;:])",
        "gu",
    )
    .unwrap()
});

fn forms(words: &[&str]) -> Vec<String> {
    words.iter().map(|w| w.to_string()).collect()
}

fn table(rows: &[(&str, &[&str])]) -> IndexMap<String, Vec<String>> {
    rows.iter()
        .map(|(k, v)| (k.to_string(), forms(v)))
        .collect()
}

/// `SYMBOLS`, built once. normalize.ts applies it inside the pass (step 7) and text() again after it.
fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        make_symbol_normalizer(&SymbolData {
            multiply: Some(Multiply {
                times: "есе".into(),
                by: None,
            }),
            ampersand: Some("және".into()),
            percent: Some(forms(&["пайыз"])),
            currency: Some(table(&[
                ("$", &["доллар"]),
                ("€", &["еуро"]),
                ("¥", &["йен"]),
                ("£", &["фунт"]),
            ])),
            units: Some(table(&[
                ("км", &["километр"]),
                ("km", &["километр"]),
                ("кг", &["килограмм"]),
                ("kg", &["килограмм"]),
                ("м", &["метр"]),
                ("m", &["метр"]),
                ("мм", &["миллиметр"]),
                ("mm", &["миллиметр"]),
                ("см", &["сантиметр"]),
                ("cm", &["сантиметр"]),
            ])),
            exponent_words: Some(ExponentWords {
                squared: Some(forms(&["шаршы"])),
                cubed: Some(forms(&["текше"])),
                position: Some(PositionDecl::All(ExponentPosition::Before)),
            }),
            ..Default::default()
        })
    })
}

/// The symbol tier, for code reached only through a `KazakhPhonemizer` (whose constructor builds it).
pub(crate) fn symbols() -> &'static SymbolNormalizer {
    try_symbols().unwrap_or_else(|e| panic!("{e}"))
}

/// `part.split(/(?<=\p{Ll})(?=\p{Lu})/u)`: a camelCase compound at its internal capitals. The pattern is
/// zero-width, so JS's split cuts at every match position strictly inside the string.
fn split_camel(w: &JsString) -> Vec<JsString> {
    let mut parts = Vec::new();
    let mut p = 0;
    for m in js_re!(r"(?<=\p{Ll})(?=\p{Lu})", "gu").match_all(w) {
        let q = m.index();
        if q > p && q < w.len() {
            parts.push(w.slice(p as isize, Some(q as isize)));
            p = q;
        }
    }
    parts.push(w.slice(p as isize, None));
    parts
}

/// The Kazakh engine (`createKazakh`).
pub struct KazakhPhonemizer;

/// The module functions, exposed through the engine: holding one proves the manifest and the tier loaded.
/// (The per-module differentials call them.)
impl KazakhPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_kazakh(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        symbols().apply(text)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn segments(&self, word: &JsString) -> Vec<Seg> {
        to_segments(word)
    }

    pub fn number_to_ipa(&self, n: f64) -> JsString {
        number_to_ipa(n)
    }

    pub fn ordinal_word(&self, n: f64) -> Option<JsString> {
        ordinal_word(n)
    }

    pub fn orthographic(&self, n: f64) -> JsString {
        orthographic(n)
    }

    pub fn roman_ordinal(&self, n: f64) -> Option<JsString> {
        kk_roman_ordinal(n)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = symbols().apply(&normalize_kazakh(input));
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                for part in split_camel(&w) {
                    sink.emit(&phonemize_word(&part));
                }
            } else if let Some(n) = m.group(2, s).filter(|n| !n.is_empty()) {
                let digits = js_re!(r" ", "gu").replace(&n, &JsString::new());
                for ipa in digits_to_ipa(&digits).split(&js(" ")) {
                    sink.emit(&ipa);
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

impl Engine for KazakhPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(KazakhPhonemizer::text(self, input))
    }
}

/// `createKazakh()`. Errors when the manifest cannot be loaded, or the symbol tier refuses its table.
pub fn create_kazakh() -> Result<KazakhPhonemizer, String> {
    try_manifest()?;
    try_symbols()?;
    Ok(KazakhPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One pin's actual value: `kind` names the TS call the pin was extracted from.
    fn actual(kind: &str, input: &str) -> Option<JsString> {
        let s = js(input);
        let n = || input.parse::<f64>().unwrap();
        match kind {
            "word" => Some(phonemize_word(&s)),
            // `.replace(/ˈ/u, "")`: the first stress mark only.
            "word_unstressed" => {
                Some(js_re!("ˈ", "u").replace(&phonemize_word(&s), &JsString::new()))
            }
            "phonemize" => Some(js(&crate::phonemize(input, "kk").unwrap())),
            "normalize" => Some(normalize_kazakh(&s)),
            "roman" => kk_roman_ordinal(n()),
            k => panic!("no pin kind {k}"),
        }
    }

    /// test/kazakh.test.ts's pins, extracted by `.probe/turkic/pins.mjs` (no reading typed by hand). The two
    /// `ordinalAfter.test` pins are the kk-roman differential's.
    #[test]
    fn the_ts_suite_pins_hold() {
        create_kazakh().unwrap();
        let mut bad = Vec::new();
        for (kind, trim, op, input, want) in PINS {
            let got = actual(kind, input).map(|g| if trim { g.trim() } else { g });
            let ok = match (op, &got) {
                ("none", None) => true,
                ("eq", Some(g)) => *g == js(want),
                ("ne", Some(g)) => *g != js(want),
                ("contains", Some(g)) => g.includes(&js(want)),
                ("not_contains", Some(g)) => !g.includes(&js(want)),
                _ => false,
            };
            if !ok {
                bad.push(format!("{kind}({input}) {op} {want:?}: got {got:?}"));
            }
        }
        assert!(bad.is_empty(), "{}", bad.join("\n"));
    }

    /// 115 pins extracted mechanically from test/kazakh.test.ts (kind, trim, op, input,
    /// expected): 107 expect() sites, 2 skipped.
    const PINS: [(&str, bool, &str, &str, &str); 115] = [
        ("word", false, "eq", "Қазақстан", "qɑzɑqstˈɑn"),
        ("word", false, "eq", "мен", "mˈen"),
        ("word", false, "eq", "ғылым", "ʁˈəɫəm"),
        ("word", false, "eq", "тоғыз", "tˈoʁəz"),
        ("word", false, "eq", "хат", "χˈɑt"),
        ("word", false, "eq", "түрі", "tʏrˈɪ"),
        ("word", false, "eq", "қол", "qˈoɫ"),
        ("word", false, "eq", "алма", "ɑɫmˈɑ"),
        ("word", false, "eq", "тіл", "tˈɪl"),
        ("word", false, "eq", "Солтүстік", "soltʏstˈɪk"),
        ("word", false, "eq", "ел", "jˈel"),
        ("word_unstressed", false, "eq", "кино", "kəjno"),
        ("word", false, "eq", "тау", "tˈɑw"),
        ("word", false, "eq", "Санат", "sɑnˈɑt"),
        ("word", false, "eq", "бойынша", "bˈojənʃɑ"),
        ("word", false, "eq", "коды", "kˈodə"),
        ("word", false, "eq", "стратегия", "sətrɑtˈeɡəjja"),
        ("word", false, "eq", "км", "kəmˈə"),
        ("word", false, "eq", "РФ", "rəfˈə"),
        ("phonemize", false, "eq", "5", "bˈes"),
        ("phonemize", false, "eq", "21", "ʒəjərmˈɑbˈɪr"),
        ("phonemize", false, "eq", "100", "ʒˈʏz"),
        ("phonemize", false, "eq", "1000", "bˈɪr mˈəŋ"),
        ("roman", false, "eq", "1", "бірінші"),
        ("roman", false, "eq", "9", "тоғызыншы"),
        ("roman", false, "eq", "19", "он тоғызыншы"),
        ("roman", false, "eq", "20", "жиырмасыншы"),
        ("roman", false, "eq", "21", "жиырма бірінші"),
        ("roman", false, "eq", "40", "қырқыншы"),
        ("roman", false, "eq", "50", "елуінші"),
        ("roman", false, "eq", "63", "алпыс үшінші"),
        ("roman", false, "eq", "100", "жүзінші"),
        ("roman", false, "none", "101", ""),
        (
            "phonemize",
            true,
            "eq",
            "он тоғызыншы ғасыр",
            "ˈon tˈoʁəzənʃə ʁˈɑsər",
        ),
        ("phonemize", true, "eq", "елуінші съезд", "jelwɪnʃˈɪ sjˈezd"),
        ("phonemize", true, "eq", "xix", "ˈontˈoʁəz"),
        (
            "normalize",
            false,
            "eq",
            "190-шы орын",
            "жүз тоқсаныншы орын",
        ),
        ("phonemize", true, "eq", "60-шы гол", "ˈɑɫpəsənʃə ɡˈoɫ"),
        ("phonemize", true, "eq", "1-ші", "bɪrɪnʃˈɪ"),
        ("phonemize", true, "eq", "200-ге", "jekˈɪ ʒʏzɡˈe"),
        ("phonemize", true, "eq", "80-нен", "seksennˈen"),
        ("phonemize", true, "eq", "60-тан", "ˈɑɫpəstɑn"),
        ("phonemize", true, "eq", "1000-нан", "bˈɪr məŋnˈɑn"),
        ("normalize", false, "eq", "15-ке", "он беске"),
        ("normalize", false, "eq", "29-да", "жиырма тоғызда"),
        ("normalize", false, "eq", "11:00-ден", "он бірден"),
        ("normalize", false, "eq", "11000-нан", "он бір мыңнан"),
        ("normalize", false, "eq", "5-пен", "беспен"),
        ("normalize", false, "eq", "3-пен", "үшпен"),
        ("normalize", false, "eq", "4-пен", "төртпен"),
        ("normalize", false, "eq", "40-пен", "қырықпен"),
        ("normalize", false, "eq", "60-пен", "алпыспен"),
        ("normalize", false, "eq", "9-бен", "тоғызбен"),
        ("normalize", false, "eq", "100-бен", "жүзбен"),
        ("normalize", false, "eq", "7-мен", "жетімен"),
        ("normalize", false, "eq", "1-мен", "бірмен"),
        ("normalize", false, "eq", "1000-мен", "бір мыңмен"),
        ("normalize", false, "eq", "20-мен", "жиырмамен"),
        ("normalize", false, "eq", "8-ғасырдан", "сегізінші ғасырдан"),
        (
            "normalize",
            false,
            "eq",
            "20-ғасырдың",
            "жиырмасыншы ғасырдың",
        ),
        (
            "normalize",
            false,
            "eq",
            "2016-жылы",
            "екі мың он алтыншы жылы",
        ),
        (
            "normalize",
            false,
            "eq",
            "247-бабына",
            "екі жүз қырық жетінші бабына",
        ),
        ("normalize", false, "eq", "15-і", "он бесі"),
        ("normalize", false, "eq", "1000-шы", "бір мыңыншы"),
        ("phonemize", true, "eq", "08:46", "seɡˈɪz qˈərəq ˈɑɫtə"),
        ("phonemize", true, "eq", "13:15", "ˈon ˈʏʃ ˈon bˈes"),
        ("phonemize", true, "eq", "11:00-ден", "ˈon bɪrdˈen"),
        ("phonemize", true, "eq", "9:30-да", "tˈoʁəz ˈotəzdɑ"),
        ("phonemize", true, "eq", "17 000", "ˈonʒˈetɪ mˈəŋ"),
        ("phonemize", true, "eq", "5 000 000", "bˈes məjlɫəjˈon"),
        (
            "phonemize",
            true,
            "eq",
            "2,3 миллиард",
            "jˈekɪ bʏtˈɪn ˈʏʃ mˈəjɫɫəjɑrd",
        ),
        (
            "phonemize",
            true,
            "eq",
            "83 км/сағ",
            "seksˈen ˈʏʃ kəjlomˈetr sɑʁˈɑt",
        ),
        (
            "phonemize",
            true,
            "eq",
            "160 км/сағ-қа",
            "ʒˈʏz ˈɑɫpəs kəjlomˈetr sɑʁɑtqˈɑ",
        ),
        (
            "phonemize",
            true,
            "eq",
            "802.11n",
            "seɡˈɪz ʒˈʏz jekˈɪ nʏktˈe ˈon bˈɪr ˈɛn",
        ),
        (
            "phonemize",
            true,
            "eq",
            "1.1 суретті",
            "bˈɪr nʏktˈe bˈɪr swrettˈɪ",
        ),
        (
            "phonemize",
            true,
            "eq",
            "15.00 UTC",
            "ˈon bˈes jˈuː tʰˈiː sˈiː",
        ),
        ("normalize", false, "eq", "1000-ші", "бір мыңыншы"),
        (
            "phonemize",
            true,
            "eq",
            "б.д.д. 356 жылы",
            "bɪzdˈɪŋ dæwɪrɡˈe dejˈɪn ˈʏʃʒˈʏz jˈelwˈɑɫtə ʒˈəɫə",
        ),
        (
            "phonemize",
            true,
            "eq",
            "+ 30 °C-тан",
            "pɫjˈus ˈotəz ɡrˈɑdws t͡sˈelʲsəjjden",
        ),
        ("phonemize", true, "eq", "35°W", "ˈotəz bˈes ɡrˈɑdws bˈɑtəs"),
        (
            "phonemize",
            true,
            "eq",
            "XVI ғасырда",
            "ˈon ˈɑɫtənʃə ʁˈɑsərdɑ",
        ),
        ("phonemize", true, "eq", "80%", "seksˈen pˈɑjəz"),
        (
            "phonemize",
            true,
            "eq",
            "UTC + 1",
            "jˈuː tʰˈiː sˈiː pɫjˈus bˈɪr",
        ),
        (
            "phonemize",
            false,
            "contains",
            "2,2 km²",
            "ʃˈɑrʃə kəjlomˈetr",
        ),
        ("phonemize", false, "contains", "120 m³", "tekʃˈe mˈetr"),
        (
            "phonemize",
            false,
            "contains",
            "«№ 11 ғарышкер»",
            "nɵmˈɪr ˈonbˈɪr",
        ),
        ("phonemize", false, "eq", "миль", "mˈəjlʲ"),
        ("phonemize", false, "eq", "гольф", "ɡˈolʲf"),
        ("phonemize", false, "eq", "пальма", "pɑlʲmˈɑ"),
        ("phonemize", false, "eq", "чарльз", "t͡ʃˈɑrlʲz"),
        ("phonemize", false, "eq", "цинь", "t͡sˈəjnʲ"),
        ("phonemize", false, "eq", "нью", "nʲjˈu"),
        ("phonemize", false, "eq", "объектив", "objˈektəjv"),
        ("phonemize", false, "eq", "съезд", "sjˈezd"),
        ("phonemize", false, "eq", "абъ", "ˈɑb"),
        ("phonemize", false, "eq", "король", "korˈolʲ"),
        ("phonemize", false, "eq", "корольдік", "korolʲdˈɪk"),
        ("phonemize", false, "eq", "алма", "ɑɫmˈɑ"),
        ("phonemize", false, "eq", "бала", "bɑɫˈɑ"),
        ("phonemize", false, "not_contains", "миль", "ʔ"),
        ("phonemize", false, "not_contains", "гольф", "ʔ"),
        ("phonemize", false, "not_contains", "пальма", "ʔ"),
        ("phonemize", false, "not_contains", "нью", "ʔ"),
        ("phonemize", false, "not_contains", "премьер", "ʔ"),
        ("phonemize", false, "not_contains", "объектив", "ʔ"),
        ("phonemize", false, "contains", "00:43", "nˈɵl"),
        ("phonemize", false, "contains", "0.5", "nˈɵl"),
        ("phonemize", false, "ne", "00:00", ""),
        ("phonemize", false, "not_contains", "20", "nˈɵl"),
        ("phonemize", false, "not_contains", "10:00", "nˈɵl"),
        ("phonemize", false, "contains", "-1.5", "mˈəjnws"),
        ("phonemize", false, "contains", "-0.5", "mˈəjnws"),
        ("phonemize", false, "contains", "−0.5", "mˈəjnws"),
        ("phonemize", false, "contains", "-0,5", "mˈəjnws"),
        ("phonemize", false, "not_contains", "1.5-2.5", "mˈəjnws"),
    ];
}
