//! Chuvash (chv) phonemizer: a Cyrillic scan (е iotated initially, after a vowel and after ъ / ь; geminates; ь
//! flagged to palatalize), then the allophonic voicing pass, then palatalization, then stress on the last full
//! vowel; text() over words, numbers (comma decimal) and punctuation.
//! Ported from src/languages/chuvash/chuvash.ts — see that file for the sources.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use super::normalize::{
    is_unreadable_chuvash, normalize_chuvash, normalize_chuvash_initialisms, ordinal_of,
    spell_attributive,
};
use super::numbers::number_to_words;
use super::roman_ordinals::chv_roman_ordinal;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/chuvash";

/// `ChuvashDef` (chuvash.ts). Every field the TS interface names is required.
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct ChuvashDef {
    pub onset: IndexMap<String, String>,
    pub voiced: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub iotated: IndexMap<String, String>,
    pub voicing_sonorants: Vec<String>,
    pub liquids: Vec<String>,
    pub vowel_letters: Vec<String>,
}

pub fn try_def() -> Result<&'static ChuvashDef, String> {
    static D: OnceLock<ChuvashDef> = OnceLock::new();
    load_once(&D, || {
        load_manifest(DIR, "chuvash.jsonc").map_err(|e| e.to_string())
    })
}

/// `DEF`, for code reached only through a checked path (`createChuvash` loads it first).
static DEF: LazyLock<&'static ChuvashDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

/// `Seg`.
struct Seg {
    ipa: String,
    vowel: bool,
    reduced: bool,
    palatal: bool,
}

fn seg(ipa: &str, vowel: bool, reduced: bool) -> Seg {
    Seg {
        ipa: ipa.to_string(),
        vowel,
        reduced,
        palatal: false,
    }
}

fn contains(list: &[String], c: &str) -> bool {
    list.iter().any(|x| x == c)
}

/// `phonemizeWord(word)`: the scan, the voicing pass, palatalization, then reduced-vowel stress.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let d = &*DEF;
    // `[...w]`: code points, a lone surrogate as its own item (it matches no table).
    let chars: Vec<String> = normalize(word, Form::Nfc)
        .to_lower_case()
        .code_point_strings()
        .iter()
        .map(|c| c.to_string_lossy())
        .collect();
    let reduced = |v: &str| v == "ə" || v == "ɘ";
    let mut segs: Vec<Seg> = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        let ch = chars[i].as_str();
        if ch == "е" {
            let prev_v = i > 0
                && (contains(&d.vowel_letters, &chars[i - 1])
                    || chars[i - 1] == "ъ"
                    || chars[i - 1] == "ь");
            if i == 0 || prev_v {
                segs.push(seg("j", false, false));
            }
            segs.push(seg("e", true, false));
        } else if let Some(v) = d.vowels.get(ch) {
            segs.push(seg(v, true, reduced(v)));
        } else if let Some(iot) = d.iotated.get(ch) {
            let mut cps = iot.chars();
            let (g, v) = (cps.next().unwrap(), cps.next().unwrap());
            segs.push(seg(&g.to_string(), false, false));
            segs.push(seg(&v.to_string(), true, false));
        } else if let Some(c) = d.onset.get(ch) {
            if i + 1 < chars.len() && chars[i + 1] == ch {
                segs.push(seg(&format!("{c}ː"), false, false));
                i += 1;
            } else {
                segs.push(seg(c, false, false));
            }
        } else if ch == "ь"
            && let Some(prev) = segs.last_mut()
            && !prev.vowel
            && prev.ipa != "j"
        {
            prev.palatal = true;
        }
        i += 1;
    }

    // ⚠ Voicing reads `prev` AFTER it may itself have been voiced: the pass mutates in place, left to right.
    for k in 0..segs.len() {
        let Some(voiced) = d.voiced.get(&segs[k].ipa) else {
            continue;
        };
        if k == 0 || k + 1 >= segs.len() || !segs[k + 1].vowel {
            continue;
        }
        let (prev, next) = (&segs[k - 1], &segs[k + 1]);
        let trigger = prev.vowel
            || contains(&d.voicing_sonorants, &prev.ipa)
            || (contains(&d.liquids, &prev.ipa) && !next.reduced);
        if trigger {
            segs[k].ipa = voiced.clone();
        }
    }

    for s in segs.iter_mut().filter(|s| s.palatal) {
        s.ipa.push('ʲ');
    }

    let vidx: Vec<usize> = (0..segs.len()).filter(|&i| segs[i].vowel).collect();
    if let Some(&first) = vidx.first() {
        let nucleus = vidx
            .iter()
            .rev()
            .find(|&&i| !segs[i].reduced)
            .copied()
            .unwrap_or(first);
        let at = if nucleus > 0 && !segs[nucleus - 1].vowel {
            nucleus - 1
        } else {
            nucleus
        };
        segs.insert(at, seg("ˈ", false, false));
    }
    let joined: String = segs.iter().map(|s| s.ipa.as_str()).collect();
    normalize(&js(&joined), Form::Nfc)
}

/// `number(digits)`: an unsafe integer is read digit at a time, each digit's words phonemized.
fn number(digits: &JsString) -> JsString {
    let n = js_number(digits);
    let words: Vec<&str> = if is_safe_integer(n) {
        number_to_words(n, false)
    } else {
        digits
            .code_point_strings()
            .iter()
            .flat_map(|d| number_to_words(js_number(d), false))
            .collect()
    };
    let ipa: Vec<JsString> = words.iter().map(|w| phonemize_word(&js(w))).collect();
    JsString::join(&ipa, &js(" "))
}

/// chuvash.ts's `makeSymbolNormalizer({…})` literal, evaluated from the source and `JSON.stringify`'d.
const SYMBOL_DATA: &str = r#"{"percent":["процент"],"currency":{"$":["доллар"],"€":["евро"],"₽":["тенкӗ"]},"units":{"км":["километр"],"см":["сантиметр"],"мм":["миллиметр"],"кг":["килограмм"],"га":["гектар"],"м":["метр"],"km":["километр"],"cm":["сантиметр"],"mm":["миллиметр"],"m":["метр"]},"unitPer":"","rateDenominators":{"ҫ":"ҫеккунтра","ç":"ҫеккунтра","s":"ҫеккунтра","h":"сехетре"},"exponentWords":{"squared":["тӑваткал"],"cubed":["куб"],"position":"before"},"ampersand":"тата","magnitudes":["пин","миллион","миллиард","триллион"]}"#;

fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let data: SymbolData =
            crate::core::from_json::parse_json(SYMBOL_DATA).map_err(|e| e.to_string())?;
        make_symbol_normalizer(&data)
    })
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"([Ѐ-ӿ]+)|(\d+(?:,\d+)?)|([.!?…,;:])", "gu").unwrap());

/// The Chuvash engine (`createChuvash`).
pub struct ChuvashPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding one proves the manifest and the tier loaded.
/// (The per-module differentials call them.)
impl ChuvashPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_chuvash(text)
    }

    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_chuvash_initialisms(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    pub fn spell_attributive(&self, text: &JsString) -> JsString {
        spell_attributive(text)
    }

    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_chuvash(word)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn number_words(&self, n: f64, attr: bool) -> JsString {
        js(&number_to_words(n, attr).join("|"))
    }

    pub fn ordinal_of(&self, n: f64) -> Option<JsString> {
        ordinal_of(n)
    }

    pub fn roman_ordinal(&self, n: f64) -> Option<JsString> {
        chv_roman_ordinal(n)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let prepared = spell_attributive(&self.symbols.apply(&normalize_chuvash_initialisms(
            &normalize_chuvash(&normalize(input, Form::Nfc)),
        )));
        assemble_clauses(&prepared, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(n) = m.group(2, s).filter(|n| !n.is_empty()) {
                let parts = n.split(&js(","));
                sink.emit(&number(&parts[0]));
                if let Some(frac) = parts.get(1) {
                    sink.emit(&phonemize_word(&js("хӳрешке")));
                    for dg in frac.code_point_strings() {
                        sink.emit(&number(&dg));
                    }
                }
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty()) {
                let mark = if p == "." || p == "!" || p == "?" {
                    p
                } else {
                    js(",")
                };
                sink.pause(&mark);
            }
        })
    }
}

impl Engine for ChuvashPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(ChuvashPhonemizer::text(self, input))
    }
}

/// `createChuvash()`. Errors when the manifest cannot be loaded, or the symbol tier refuses its table.
pub fn create_chuvash() -> Result<ChuvashPhonemizer, String> {
    try_def()?;
    Ok(ChuvashPhonemizer {
        symbols: try_symbols()?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/chuvash.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["апат"], Some("aˈbat")),
        ("phonemizeWord", &["ача"], Some("aˈd͡ʑa")),
        ("phonemizeWord", &["вӑкӑр"], Some("ˈʋəɡər")),
        ("phonemizeWord", &["эпир"], Some("eˈbir")),
        ("phonemizeWord", &["манпа"], Some("manˈba")),
        ("phonemizeWord", &["чухӑнлӑх"], Some("ˈt͡ɕuɣənləχ")),
        ("phonemizeWord", &["вӑлсем"], Some("ʋəlˈzem")),
        ("phonemizeWord", &["чӗрпӗк"], Some("ˈt͡ɕɘrpɘk")),
        ("phonemizeWord", &["иккӗ"], Some("ˈikːɘ")),
        ("phonemizeWord", &["саккӑр"], Some("ˈsakːər")),
        ("phonemizeWord", &["чӑваш"], Some("t͡ɕəˈʋaʂ")),
        ("phonemizeWord", &["сӑмах"], Some("səˈmaχ")),
        ("phonemizeWord", &["вӑтӑр"], Some("ˈʋədər")),
        ("phonemizeWord", &["мӗн"], Some("ˈmɘn")),
        ("phonemizeWord", &["кӗҫнерникун"], Some("kɘɕnerniˈɡun")),
        ("getPhonemizer(\"chv\").text", &["7"], Some("ˈɕit͡ɕːɘ")),
        ("getPhonemizer(\"chv\").text", &["11"], Some("ˈʋun pɘˈrːe")),
        (
            "getPhonemizer(\"chv\").text",
            &["25"],
            Some("ˈɕirɘm ˈpilːɘk"),
        ),
        ("getPhonemizer(\"chv\").text", &["100"], Some("ˈɕɘr")),
        (
            "getPhonemizer(\"chv\").text",
            &["138"],
            Some("ˈɕɘr ˈʋədər ˈsakːər"),
        ),
        (
            "getPhonemizer(\"chv\").text",
            &["555"],
            Some("ˈpilɘk ˈɕɘr ˈalːə ˈpilːɘk"),
        ),
        (
            "getPhonemizer(\"chv\").text",
            &["1984"],
            Some("ˈpin ˈtəɣər ˈɕɘr saɡərˈʋunːə təˈʋatːə"),
        ),
        (
            "getPhonemizer(\"chv\").text",
            &["12345"],
            Some("ˈʋun ˈik ˈpin ˈʋiɕ ˈɕɘr ˈχɘrɘχ ˈpilːɘk"),
        ),
        (
            "getPhonemizer(\"chv\").text",
            &["1000000"],
            Some("ˈpɘr milːiˈon"),
        ),
        ("phonemizeWord", &["чул"], Some("ˈt͡ɕul")),
        ("phonemizeWord", &["хула"], Some("χuˈla")),
        ("phonemizeWord", &["шыв"], Some("ˈʂɯʋ")),
        ("phonemizeWord", &["ҫил"], Some("ˈɕil")),
        ("phonemizeWord", &["выльӑх"], Some("ˈʋɯlʲəχ")),
        ("phonemizeWord", &["тӑрать"], Some("təˈratʲ")),
        ("phonemizeWord", &["январь"], Some("janˈʋarʲ")),
        ("phonemizeWord", &["Перечень"], Some("pereˈd͡ʑenʲ")),
        ("phonemizeWord", &["объектов"], Some("objekˈtoʋ")),
        ("phonemizeWord", &["съезде"], Some("sjezˈde")),
        ("phonemize", &["вăтам", "chv"], Some("ʋəˈdam")),
        ("phonemize", &["вӑтам", "chv"], Some("ʋəˈdam")),
        ("phonemize", &["Чăваш", "chv"], Some("t͡ɕəˈʋaʂ")),
        ("phonemize", &["Чӑваш", "chv"], Some("t͡ɕəˈʋaʂ")),
        ("phonemize", &["пĕрремĕш", "chv"], Some("pɘˈrːemɘʂ")),
        ("phonemize", &["пӗрремӗш", "chv"], Some("pɘˈrːemɘʂ")),
        ("phonemize", &["çĕр", "chv"], Some("ˈɕɘr")),
        ("phonemize", &["ҫӗр", "chv"], Some("ˈɕɘr")),
        ("phonemize", &["ĕмĕр", "chv"], Some("ˈɘmɘr")),
        ("phonemize", &["ӗмӗр", "chv"], Some("ˈɘmɘr")),
        ("phonemize", &["ăшă", "chv"], Some("ˈəʐə")),
        ("phonemize", &["ӑшӑ", "chv"], Some("ˈəʐə")),
        ("phonemize", &["çĕнĕ", "chv"], Some("ˈɕɘnɘ")),
        ("phonemize", &["ҫӗнӗ", "chv"], Some("ˈɕɘnɘ")),
        (
            "foldCyrillicConfusables",
            &["Ку München хула", "true"],
            Some("Ку München хула"),
        ),
        ("foldCyrillicConfusables", &["für", "true"], Some("für")),
        ("phonemize", &["1 км", "chv"], Some("ˈpɘr kiloˈmetr")),
        ("phonemize", &["5 км", "chv"], Some("ˈpilɘk kiloˈmetr")),
        (
            "phonemize",
            &["21 км", "chv"],
            Some("ˈɕirɘm ˈpɘr kiloˈmetr"),
        ),
        ("phonemize", &["5", "chv"], Some("ˈpilːɘk")),
        ("phonemize", &["1", "chv"], Some("pɘˈrːe")),
        ("ordinalOf", &["1"], Some("пӗрремӗш")),
        ("ordinalOf", &["4"], Some("тӑваттӑмӗш")),
        ("ordinalOf", &["20"], Some("ҫирӗммӗш")),
        ("ordinalOf", &["100"], Some("ҫӗрмӗш")),
        ("ordinalOf", &["1000"], Some("пинмӗш")),
        (
            "phonemize",
            &["22-мĕшĕнче", "chv"],
            Some("ˈɕirɘm ikːɘmɘʐɘnˈd͡ʑe"),
        ),
        (
            "phonemize",
            &["3-мĕш космонавчĕ", "chv"],
            Some("ˈʋiɕːɘmɘʂ kosmoˈnaʋt͡ɕɘ"),
        ),
        (
            "phonemize",
            &["1-5-мӗш класӗсенче", "chv"],
            Some("pɘˈrːemɘʂ , ˈpilːɘkmɘʂ klazɘzenˈd͡ʑe"),
        ),
        (
            "phonemize",
            &["−19 °C", "chv"],
            Some("miˈnus ˈʋun ˈtəɣər t͡selʲˈzi ɡraˈduzɘ"),
        ),
        (
            "phonemize",
            &["-13°С", "chv"],
            Some("miˈnus ˈʋun ˈʋiɕ t͡selʲˈzi ɡraˈduzɘ"),
        ),
        (
            "phonemize",
            &["+20°с", "chv"],
            Some("plˈjus ˈɕirɘm t͡selʲˈzi ɡraˈduzɘ"),
        ),
        (
            "phonemize",
            &["4/5 пайĕ", "chv"],
            Some("təˈʋatːə ˈpilːɘkmɘʂ ˈpajɘ"),
        ),
        (
            "phonemize",
            &["1/2 пайĕн", "chv"],
            Some("pɘˈrːe ˈikːɘmɘʂ ˈpajɘn"),
        ),
        (
            "normalizeChuvash",
            &["1608/09 çулхи"],
            Some("1608/09 çулхи"),
        ),
        ("normalizeChuvash", &["57/1 ҫурт"], Some("57/1 ҫурт")),
        ("normalizeChuvash", &["3/14"], Some("3/14")),
        (
            "phonemize",
            &["XVIII ĕмĕр", "chv"],
            Some("ˈʋun ˈsakːərmɘʂ ˈɘmɘr"),
        ),
        (
            "phonemize",
            &["XVIII ӗмӗр", "chv"],
            Some("ˈʋun ˈsakːərmɘʂ ˈɘmɘr"),
        ),
        (
            "phonemize",
            &["Екатерина II", "chv"],
            Some("jeɡaderiˈna ˈikːɘ"),
        ),
        (
            "phonemize",
            &["23:59:60", "chv"],
            Some("ˈɕirɘm ˈʋiɕːɘ ˈalːə ˈtəχːər ˈutməl"),
        ),
        (
            "normalizeChuvash",
            &["п. эрч. 2040"],
            Some("пирӗн эраччен 2040"),
        ),
        ("normalizeChuvash", &["530 ҫ."], Some("530 ҫул")),
        (
            "phonemize",
            &["1 032 343 çын", "chv"],
            Some("ˈpɘr milːiˈon ˈʋədər ˈik ˈpin ˈʋiɕ ˈɕɘr ˈχɘrɘχ ˈʋiɕ ˈɕɯn"),
        ),
        (
            "phonemize",
            &["12,5", "chv"],
            Some("ˈʋun ˈikːɘ χyreʂˈke ˈpilːɘk"),
        ),
        (
            "phonemize",
            &["С. 61-63.", "chv"],
            Some("s . ˈutməl pɘˈrːe , ˈutməl ˈʋiɕːɘ ."),
        ),
        (
            "phonemize",
            &["84%", "chv"],
            Some("saɡərˈʋunːə təˈʋat proˈt͡sent"),
        ),
        ("phonemize", &["$10 000", "chv"], Some("ˈʋun ˈpin doˈlːar")),
        (
            "phonemize",
            &["8 413 km²", "chv"],
            Some("ˈsaɡər ˈpin təˈʋat ˈɕɘr ˈʋun ˈʋiɕ təʋatˈkal kiloˈmetr"),
        ),
        (
            "phonemize",
            &["2,8 м/ç", "chv"],
            Some("ˈikːɘ χyreʂˈke ˈsakːər ˈmetr ɕekːuntˈra"),
        ),
        ("phonemize", &["ЧР", "chv"], Some("ˈt͡ɕe ˈer")),
        ("phonemize", &["АПШ", "chv"], Some("ˈa ˈpe ˈʂa")),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_chuvash().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeChuvash" => Some(e.normalize(&a(0))),
                "ordinalOf" => e.ordinal_of(js_number(&a(0))),
                "foldCyrillicConfusables" => Some(crate::core::unicode::fold_cyrillic_confusables(
                    &a(0),
                    a(1) == js("true"),
                )),
                "getPhonemizer(\"chv\").text" => {
                    Some(crate::registry::phonemize_in("chv", &a(0)).unwrap())
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
            let got: Option<String> = call(f, &a).map(|s| s.to_string_lossy());
            assert_eq!(got.as_deref(), *want, "{f}{args:?}");
        }
    }
}

/// #1581, as test/turkic2-defects-1581.test.ts: relational, so no IPA is typed.
#[cfg(all(test, feature = "chv"))]
mod defects_1581_tests {
    use crate::core::js_string::js;

    fn say(s: &str) -> String {
        crate::phonemize(s, "chv").unwrap()
    }

    #[test]
    fn latin_suffix_forms_and_hour_24() {
        use super::super::normalize::normalize_chuvash as n;
        assert_eq!(n(&js("15-мĕшĕсенче")), n(&js("15-мӗшӗсенче")));
        assert_eq!(n(&js("11-15-мĕшĕсенче")), n(&js("11-15-мӗшӗсенче")));
        assert!(!n(&js("15-мĕшĕсенче")).to_string_lossy().contains("15"));
        assert_eq!(n(&js("24:30")), js("24:30"));
        assert_eq!(say("24:00"), say("24"));
    }
}
