//! Uzbek (uz) phonemizer: the flat Latin scan (digraphs, the comma-letters oʻ/gʻ against the tutuq belgisi
//! glottal stop), final stress, and text() over words, numbers (comma decimal) and punctuation. Ported from
//! src/languages/uzbek/uzbek.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::{is_unreadable_uzbek, normalize_uzbek, normalize_uzbek_initialisms};
use super::numbers::{DIR, NUM, number_to_words, ordinal_words, try_num, turkic_number_words};
use super::roman_ordinals::uz_roman_ordinal;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::ipa::is_ipa_vowel;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{
    ExponentPosition, ExponentWords, Multiply, PerPower, PositionDecl, SymbolData,
    SymbolNormalizer, make_symbol_normalizer,
};
use crate::core::numbers::{render_number, spell_digits};
use crate::core::provenance::{Form, normalize};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// `UzbekDef` (uzbek.ts). Every field the TS interface names is required; `numbers` is read through
/// numbers.rs's own loader, as numbers.ts does.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UzbekDef {
    pub vowels: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub digraphs: IndexMap<String, String>,
    pub glottal: String,
    pub clause_punctuation: IndexMap<String, String>,
}

pub fn try_def() -> Result<&'static UzbekDef, String> {
    static D: OnceLock<UzbekDef> = OnceLock::new();
    load_once(&D, || {
        load_manifest(DIR, "uzbek.jsonc").map_err(|e| e.to_string())
    })
}

/// `DEF`, for code reached only through a checked path (`createUzbek` loads it first).
static DEF: LazyLock<&'static UzbekDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

/// `APOS_C`, the comma-letter ʻ (U+02BB) every apostrophe variant folds to.
const APOS_C: &str = "\u{2bb}";

/// `phonemizeWord(word)`: one Latin word → IPA, the stress mark before the last vowel.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let d = &*DEF;
    let s = js_re!("['\u{2019}\u{2018}`\u{2bb}\u{2bc}\u{2032}]", "gu")
        .replace(&normalize(&word.to_lower_case(), Form::Nfc), &js(APOS_C));
    let chars: Vec<String> = s
        .code_point_strings()
        .iter()
        .map(|c| c.to_string_lossy())
        .collect();
    let mut out = JsString::new();
    let mut i = 0;
    while i < chars.len() {
        let two = format!(
            "{}{}",
            chars[i],
            chars.get(i + 1).map_or("", |c| c.as_str())
        );
        if let Some(dg) = d.digraphs.get(&two)
            && !(two == "ng" && chars.get(i + 2).is_some_and(|c| c == APOS_C))
        {
            out.push_str(&js(dg));
            i += 2;
            continue;
        }
        let c = chars[i].as_str();
        if c == APOS_C {
            if i > 0 && i + 1 < chars.len() {
                out.push_str(&js(&d.glottal));
            }
            i += 1;
            continue;
        }
        if let Some(v) = d.vowels.get(c) {
            out.push_str(&js(v));
        } else if let Some(k) = d.consonants.get(c) {
            out.push_str(&js(k));
        } else if let Some(p) = latin_phone(
            &s.code_point_strings()[i],
            PhoneOpts {
                initial: i == 0,
                include_h: false,
            },
        ) {
            out.push_str(&p);
        }
        i += 1;
    }
    // The last vowel's CODE-POINT index (`[...x]`), used as a CODE-UNIT slice offset, as the TS does.
    let at = out
        .code_point_strings()
        .iter()
        .enumerate()
        .rev()
        .find(|(_, c)| c.len() == 1 && is_ipa_vowel(c.units()[0]))
        .map(|(idx, _)| idx);
    let x = match at {
        Some(at) => out
            .slice(0, Some(at as isize))
            .concat(&js("ˈ"))
            .concat(&out.slice(at as isize, None)),
        None => out,
    };
    normalize(&x, Form::Nfc)
}

/// `number(digits)`: an unsafe integer is read digit at a time.
fn number(digits: &JsString) -> JsString {
    let n = js_number(digits);
    let word = |w: &str| phonemize_word(&js(w)).to_string_lossy();
    if !is_safe_integer(n) {
        return js(&spell_digits(&digits.to_string_lossy(), &NUM, &word));
    }
    js(&render_number(n as u64, &NUM, &word, turkic_number_words))
}

/// `DECIMAL_IPA`: the decimal-comma word, phonemized.
static DECIMAL_IPA: LazyLock<JsString> = LazyLock::new(|| {
    phonemize_word(&js(NUM
        .decimal_word
        .as_deref()
        .expect("uzbek.jsonc numbers.decimalWord")))
});

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let run = host_word_run(&["Latin"], "\u{2bb}'\u{2019}\u{2018}`\u{2bc}\u{2032}", "").unwrap();
    JsRegex::new(&format!(r"({run})|(\d+(?:,\d+)?)|([.!?…,;:])"), "giu").unwrap()
});

const NATIVE_CLASS: &str = "[a-z\u{2bb}'\u{2019}\u{2018}`\u{2bc}\u{2032}]";
type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "iu")));

fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let forms = |w: &[&str]| w.iter().map(|x| x.to_string()).collect::<Vec<_>>();
        let table = |rows: &[(&str, &str)]| -> IndexMap<String, Vec<String>> {
            rows.iter()
                .map(|(k, w)| (k.to_string(), vec![w.to_string()]))
                .collect()
        };
        make_symbol_normalizer(&SymbolData {
            multiply: Some(Multiply {
                times: "karra".into(),
                by: None,
            }),
            percent: Some(forms(&["foiz"])),
            currency: Some(table(&[("$", "dollar"), ("¥", "iyena")])),
            units: Some(table(&[
                ("km", "kilometr"),
                ("mm", "millimetr"),
                ("sm", "santimetr"),
                ("cm", "santimetr"),
                ("m", "metr"),
            ])),
            exponent_words: Some(ExponentWords {
                squared: Some(forms(&["kvadrat"])),
                cubed: Some(forms(&["kubo"])),
                position: Some(PositionDecl::Per(PerPower {
                    squared: Some(ExponentPosition::Before),
                    cubed: Some(ExponentPosition::Compound),
                })),
            }),
            ..Default::default()
        })
    })
}

/// The Uzbek engine (`createUzbek`).
pub struct UzbekPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding one proves the manifest and the tier loaded.
/// (The per-module differentials call them.)
impl UzbekPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_uzbek(text)
    }

    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_uzbek_initialisms(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_uzbek(word)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    pub fn number_to_words(&self, n: f64) -> JsString {
        number_to_words(n)
    }

    pub fn ordinal_words(&self, n: f64) -> Option<JsString> {
        ordinal_words(n)
    }

    pub fn roman_ordinal(&self, n: f64) -> Option<JsString> {
        uz_roman_ordinal(n)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self.symbols.apply(&normalize_uzbek(input));
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(n) = m.group(2, s).filter(|n| !n.is_empty()) {
                let parts = n.split(&js(","));
                for wd in number(&parts[0]).split(&js(" ")) {
                    sink.emit(&wd);
                }
                if let Some(frac) = parts.get(1) {
                    sink.emit(&DECIMAL_IPA);
                    for d in frac.code_point_strings() {
                        for wd in number(&d).split(&js(" ")) {
                            sink.emit(&wd);
                        }
                    }
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

impl Engine for UzbekPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(UzbekPhonemizer::text(self, input))
    }
}

/// `createUzbek()`. Errors when the manifest cannot be loaded, or the symbol tier refuses its table.
pub fn create_uzbek() -> Result<UzbekPhonemizer, String> {
    try_def()?;
    try_num()?;
    Ok(UzbekPhonemizer {
        symbols: try_symbols()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// One pin's actual value: `kind` names the TS call the pin was extracted from.
    fn actual(kind: &str, input: &str) -> Option<JsString> {
        let s = js(input);
        match kind {
            "word" => Some(phonemize_word(&s)),
            "registry" => Some(crate::registry::phonemize_in("uz", &s).unwrap()),
            "normalize" => Some(normalize_uzbek(&s)),
            "roman" => uz_roman_ordinal(input.parse::<f64>().unwrap()),
            k => panic!("no pin kind {k}"),
        }
    }

    /// test/uzbek.test.ts's pins, extracted by `.probe/turkic/pins.mjs` (no reading typed by hand). The two
    /// `ordinalAfter.test` pins are the uz-roman differential's.
    #[test]
    fn the_ts_suite_pins_hold() {
        create_uzbek().unwrap();
        let mut bad = Vec::new();
        for (kind, trim, op, input, want) in PINS {
            let get = |i: &str| actual(kind, i).map(|g| if trim { g.trim() } else { g });
            let got = get(input);
            let ok = match (op, &got) {
                ("none", None) => true,
                ("eq", Some(g)) => *g == js(want),
                ("ne", Some(g)) => *g != js(want),
                ("contains", Some(g)) => g.includes(&js(want)),
                ("not_contains", Some(g)) => !g.includes(&js(want)),
                ("same", Some(g)) => Some(g.clone()) == get(want),
                ("not_same", Some(g)) => Some(g.clone()) != get(want),
                _ => false,
            };
            if !ok {
                bad.push(format!("{kind}({input}) {op} {want:?}: got {got:?}"));
            }
        }
        assert!(bad.is_empty(), "{}", bad.join("\n"));
    }

    /// 89 pins extracted mechanically from test/uzbek.test.ts (kind, trim, op, input,
    /// expected): 91 expect() sites, 2 skipped.
    const PINS: [(&str, bool, &str, &str, &str); 89] = [
        ("word", false, "eq", "Oʻzbekiston", "ozbekistˈɒn"),
        ("word", false, "eq", "Toshkent", "tɒʃkˈent"),
        ("word", false, "eq", "gʻalaba", "ʁalabˈa"),
        ("word", false, "eq", "qishloq", "qiʃlˈɒq"),
        ("word", false, "eq", "rang", "rˈaŋ"),
        ("word", false, "eq", "toʻngʻiz", "tonʁˈiz"),
        ("word", false, "eq", "chiroyli", "t͡ʃirɒjlˈi"),
        ("word", false, "eq", "sanʼat", "sanʔˈat"),
        ("registry", true, "eq", "11", "ˈon bˈir"),
        ("registry", true, "eq", "25", "jiɡirmˈa bˈeʃ"),
        (
            "registry",
            true,
            "eq",
            "1984",
            "mˈiŋ toqqˈiz jˈuz saksˈɒn tˈort",
        ),
        ("roman", false, "eq", "1", "birinchi"),
        ("roman", false, "eq", "4", "toʻrtinchi"),
        ("roman", false, "eq", "6", "oltinchi"),
        ("roman", false, "eq", "19", "oʻn toʻqqizinchi"),
        ("roman", false, "eq", "20", "yigirmanchi"),
        ("roman", false, "eq", "40", "qirqinchi"),
        ("roman", false, "eq", "50", "ellikinchi"),
        ("roman", false, "eq", "63", "oltmish uchinchi"),
        ("roman", false, "eq", "100", "yuzinchi"),
        ("roman", false, "none", "101", ""),
        (
            "registry",
            true,
            "eq",
            "oʻn toʻqqizinchi asr",
            "ˈon toqqizint͡ʃˈi ˈasr",
        ),
        (
            "registry",
            true,
            "eq",
            "ellikinchi yubiley",
            "ellikint͡ʃˈi jubilˈej",
        ),
        ("registry", true, "eq", "xix", "ˈon toqqˈiz"),
        (
            "normalize",
            false,
            "eq",
            "1978-yildagi",
            "ming toʻqqiz yuz yetmish sakkizinchi yildagi",
        ),
        (
            "normalize",
            false,
            "eq",
            "190-oʻrinni",
            "yuz toʻqsoninchi oʻrinni",
        ),
        ("normalize", false, "eq", "16-noyabr", "oʻn oltinchi noyabr"),
        ("normalize", false, "eq", "7-regbi", "yetti regbi"),
        ("normalize", false, "eq", "800 000 dan", "800000 dan"),
        ("normalize", false, "eq", "19 500 km²", "19500 km²"),
        (
            "normalize",
            false,
            "eq",
            "m.a. 356-yil",
            "miloddan avval uch yuz ellik oltinchi yil",
        ),
        (
            "normalize",
            false,
            "eq",
            "2 mln. yildan",
            "2 million yildan",
        ),
        ("normalize", false, "eq", "va h.k.)", "va hokazo.)"),
        (
            "registry",
            true,
            "eq",
            "1978-yildagi",
            "mˈiŋ toqqˈiz jˈuz jetmˈiʃ sakkizint͡ʃˈi jildaɡˈi",
        ),
        ("registry", true, "eq", "15-asrda", "ˈon beʃint͡ʃˈi asrdˈa"),
        ("registry", true, "eq", "16-noyabr", "ˈon ɒltint͡ʃˈi nɒjˈabr"),
        (
            "registry",
            true,
            "eq",
            "190-oʻrinni",
            "jˈuz toqsɒnint͡ʃˈi orinnˈi",
        ),
        (
            "registry",
            true,
            "eq",
            "7-eng yirik",
            "jettint͡ʃˈi ˈeŋ jirˈik",
        ),
        (
            "registry",
            true,
            "eq",
            "1970-yillarning",
            "mˈiŋ toqqˈiz jˈuz jetmiʃint͡ʃˈi jillarnˈiŋ",
        ),
        (
            "registry",
            true,
            "eq",
            "2010-yilgi",
            "ikkˈi mˈiŋ onint͡ʃˈi jilɡˈi",
        ),
        ("registry", true, "eq", "1000-markasi", "miŋint͡ʃˈi markasˈi"),
        ("registry", true, "eq", "400 000 ta", "tˈort jˈuz mˈiŋ tˈa"),
        (
            "registry",
            true,
            "eq",
            "800 000 dan",
            "sakkˈiz jˈuz mˈiŋ dˈan",
        ),
        (
            "registry",
            true,
            "eq",
            "6,5 ballik",
            "ɒltˈi ʋerɡˈul bˈeʃ ballˈik",
        ),
        (
            "registry",
            true,
            "eq",
            "1,5 million",
            "bˈir ʋerɡˈul bˈeʃ milliˈɒn",
        ),
        (
            "registry",
            true,
            "eq",
            "6,34 duymga",
            "ɒltˈi ʋerɡˈul ˈut͡ʃ tˈort dujmɡˈa",
        ),
        (
            "registry",
            true,
            "eq",
            "soat 11:35 da",
            "sɒˈat ˈon bˈir ottˈiz bˈeʃ dˈa",
        ),
        (
            "registry",
            true,
            "eq",
            "soat 12:00 GMT da",
            "sɒˈat ˈon ikkˈi ɡˈe ˈem tˈe dˈa",
        ),
        (
            "registry",
            true,
            "eq",
            "soat 06:30 da",
            "sɒˈat ɒltˈi ottˈiz dˈa",
        ),
        (
            "registry",
            true,
            "eq",
            "m.a. 356-yil 21-iyulda",
            "milɒddˈan aʋʋˈal ˈut͡ʃ jˈuz ellˈik ɒltint͡ʃˈi jˈil jiɡirmˈa birint͡ʃˈi ijuldˈa",
        ),
        (
            "registry",
            true,
            "eq",
            "m. 1000-yillar",
            "milɒdˈij miŋint͡ʃˈi jillˈar",
        ),
        (
            "registry",
            true,
            "eq",
            "2 mln. yildan",
            "ikkˈi milliˈɒn jildˈan",
        ),
        ("registry", true, "eq", "va h.k.", "ʋˈa hɒkazˈɒ ."),
        ("registry", true, "eq", "88%", "saksˈɒn sakkˈiz fɒˈiz"),
        (
            "registry",
            true,
            "eq",
            "93%i ulangan",
            "toqsˈɒn ˈut͡ʃ fɒizˈi ulaŋˈan",
        ),
        (
            "registry",
            true,
            "eq",
            "5$ va 100$",
            "bˈeʃ dɒllˈar ʋˈa jˈuz dɒllˈar",
        ),
        ("registry", true, "eq", "7000 ¥", "jettˈi mˈiŋ ijenˈa"),
        ("registry", true, "eq", "70 km", "jetmˈiʃ kilɒmˈetr"),
        ("registry", true, "eq", "35 mm", "ottˈiz bˈeʃ millimˈetr"),
        (
            "registry",
            true,
            "eq",
            "19 500 km²",
            "ˈon toqqˈiz mˈiŋ bˈeʃ jˈuz kʋadrˈat kilɒmˈetr",
        ),
        ("registry", true, "eq", "40 mil/soat", "sɒatiɡˈa qˈirq mˈil"),
        (
            "registry",
            true,
            "eq",
            "11 km/soat",
            "sɒatiɡˈa ˈon bˈir kilɒmˈetr",
        ),
        ("registry", true, "eq", "+30°C", "pljˈus ottˈiz darad͡ʒˈa"),
        ("registry", true, "eq", "UTC+1", "ˈu tˈe sˈe pljˈus bˈir"),
        ("registry", true, "eq", "B&B lar", "bˈe ʋˈa bˈe lˈar"),
        ("registry", true, "eq", "x = y", "χ tˈeŋ j"),
        ("registry", true, "eq", "5 < 6", "bˈeʃ kit͡ʃˈik ɒltˈi"),
        ("registry", true, "eq", "6 × 6", "ɒltˈi karrˈa ɒltˈi"),
        (
            "registry",
            true,
            "eq",
            "BMT global isish",
            "bˈe ˈem tˈe ɡlɒbˈal isˈiʃ",
        ),
        (
            "registry",
            true,
            "eq",
            "GPS xaritasi",
            "ɡˈe pˈe ˈes χaritasˈi",
        ),
        (
            "registry",
            true,
            "eq",
            "AQSH Prezidenti",
            "ˈaqʃ prezidentˈi",
        ),
        ("registry", true, "eq", "T. rex", "tˈe rˈeχ"),
        (
            "registry",
            true,
            "eq",
            "M16 avtomatida",
            "ˈem ˈon ɒltˈi aʋtɒmatidˈa",
        ),
        (
            "registry",
            true,
            "eq",
            "Yelizaveta II hukmronligidan",
            "jelizaʋetˈa ikkint͡ʃˈi hukmrɒnliɡidˈan",
        ),
        (
            "registry",
            true,
            "eq",
            "Lealofi III ning",
            "lealɒfˈi ut͡ʃint͡ʃˈi nˈiŋ",
        ),
        (
            "registry",
            true,
            "eq",
            "Izmir 3,7 million",
            "izmˈir ˈut͡ʃ ʋerɡˈul jettˈi milliˈɒn",
        ),
        ("normalize", false, "eq", "Sahifa 12.", "Sahifa 12."),
        ("normalize", false, "eq", "16-Noyabr", "oʻn oltinchi Noyabr"),
        ("normalize", false, "eq", "1-Mart", "birinchi Mart"),
        ("normalize", false, "eq", "1.1-Rasmga", "1 nuqta 1 Rasmga"),
        ("normalize", false, "eq", "1/5", "beshdan bir"),
        ("normalize", false, "eq", "3/4 qismi", "toʻrtdan uch qismi"),
        ("normalize", false, "eq", "2/3", "uchdan ikki"),
        ("normalize", false, "eq", "1/2", "yarim"),
        ("normalize", false, "eq", "16/11/1978", "16/11/1978"),
        ("registry", true, "eq", "30°F", "ottˈiz darad͡ʒˈa fareŋˈejt"),
        ("registry", true, "eq", "2+2", "ikkˈi pljˈus ikkˈi"),
        ("registry", true, "contains", "120 m³", "kubɒmˈetr"),
        (
            "registry",
            true,
            "contains",
            "783 562 km²",
            "kʋadrˈat kilɒmˈetr",
        ),
    ];
}
