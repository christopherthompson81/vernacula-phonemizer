//! Swahili / Kiswahili (sw) phonemizer: the rule g2p (implosives, prenasalized stops, ng' against ng, syllabic
//! nasals, long vowels, labialization), penultimate stress, the number words, and text().
//! Ported from src/languages/swahili/swahili.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::manifest::{MANIFEST, try_manifest};
use super::normalize::normalize_swahili;
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{Form, normalize};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

struct Seg {
    ph: JsString,
    nucleus: bool,
}

/// `TWO = { ...prenasal, ...digraphs }`.
static TWO: LazyLock<IndexMap<String, String>> = LazyLock::new(|| {
    let mut t = MANIFEST.prenasal.clone();
    for (k, v) in &MANIFEST.digraphs {
        t.insert(k.clone(), v.clone());
    }
    t
});

/// `VOWEL_LETTER.includes(c)` for one code point `c` (never empty here).
fn is_vowel(c: &JsString) -> bool {
    js("aeiou").includes(c)
}

/// `isVowelLetter(c)`: undefined and "" are not vowels (#1476).
fn is_vowel_letter(c: Option<&JsString>) -> bool {
    c.is_some_and(|c| !c.is_empty() && is_vowel(c))
}

/// `isConsonantLetter(c)`: `/[a-z]/u.test(c)` on one code point.
fn is_consonant_letter(c: &JsString) -> bool {
    js_re!(r"[a-z]", "u").test(c) && !is_vowel(c)
}

/// `scan(w)`: a lowercased word into segments.
fn scan(w: &JsString) -> Vec<Seg> {
    let s = w.code_point_strings();
    let n = s.len();
    let velar = js(&MANIFEST.velar_nasal);
    let mut segs: Vec<Seg> = Vec::new();
    let mut i = 0;
    while i < n {
        // JS semantic: `w.startsWith(velarNasal, i)` takes `i` as a CODE UNIT index although `i` counts code
        // points here; the two differ only after an astral character.
        if w.units()
            .get(i..)
            .is_some_and(|r| r.starts_with(velar.units()))
        {
            segs.push(Seg {
                ph: js("ŋ"),
                nucleus: false,
            });
            i += velar.len();
            continue;
        }
        let two = s[i].concat(s.get(i + 1).unwrap_or(&JsString::new()));
        if let Some(p) = TWO.get(&two.to_string_lossy()).filter(|p| !p.is_empty()) {
            segs.push(Seg {
                ph: js(p),
                nucleus: false,
            });
            i += 2;
            continue;
        }
        let c = &s[i];
        if is_vowel(c) {
            let long = s.get(i + 1) == Some(c);
            let mut ph = js(&MANIFEST.vowels[&c.to_string_lossy()]);
            if long {
                ph.push_str(&js("ː"));
            }
            segs.push(Seg { ph, nucleus: true });
            i += if long { 2 } else { 1 };
        } else if *c == js("w")
            && segs.last().is_some_and(|l| !l.nucleus)
            && is_vowel_letter(s.get(i + 1))
        {
            segs.last_mut().unwrap().ph.push_str(&js("ʷ"));
            i += 1;
        } else if *c == js("m") || *c == js("n") {
            let syllabic = match s.get(i + 1) {
                None => true,
                Some(nx) => is_consonant_letter(nx) && *nx != js("w") && *nx != js("y"),
            };
            segs.push(Seg {
                ph: if syllabic {
                    c.concat(&js("̩"))
                } else {
                    c.clone()
                },
                nucleus: syllabic,
            });
            i += 1;
        } else if let Some(p) = MANIFEST.consonants.get(&c.to_string_lossy()) {
            segs.push(Seg {
                ph: js(p),
                nucleus: false,
            });
            i += 1;
        } else {
            i += 1;
        }
    }
    segs
}

/// `phonemizeWord(word)`: one Swahili word, penultimate stress.
pub fn phonemize_word(word: &JsString) -> JsString {
    let segs = scan(&word.to_lower_case());
    if segs.is_empty() {
        return JsString::new();
    }
    let nuclei: Vec<usize> = (0..segs.len()).filter(|&i| segs[i].nucleus).collect();
    let stress = if nuclei.len() >= 2 {
        Some(nuclei[nuclei.len() - 2])
    } else {
        nuclei.first().copied()
    };
    let mut out = JsString::new();
    for (i, sg) in segs.iter().enumerate() {
        if Some(i) == stress {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&sg.ph);
    }
    normalize(&out, Form::Nfc)
}

fn units_word(n: u64) -> String {
    MANIFEST.numbers.units[n as usize].clone()
}

/// `belowHundred(n)`.
fn below_hundred(n: u64) -> String {
    let num = &MANIFEST.numbers;
    if n == 0 {
        return String::new();
    }
    if n < 10 {
        return units_word(n);
    }
    if n == 10 {
        return num.ten.clone();
    }
    if n < 20 {
        return format!("{} {} {}", num.ten, num.and, units_word(n - 10));
    }
    let (t, u) = (n / 10, n % 10);
    let tens = num.tens[&t.to_string()].clone();
    if u != 0 {
        format!("{tens} {} {}", num.and, units_word(u))
    } else {
        tens
    }
}

/// `belowThousand(n)`.
fn below_thousand(n: u64) -> String {
    let (h, r) = (n / 100, n % 100);
    if h == 0 {
        return below_hundred(n);
    }
    let hw = format!("{} {}", MANIFEST.numbers.hundred, units_word(h));
    if r != 0 {
        format!("{hw} {} {}", MANIFEST.numbers.and, below_hundred(r))
    } else {
        hw
    }
}

/// `numberToText(n)`: a non-negative safe integer to words, or "" beyond `milioni` (10⁹ and up).
pub fn number_to_text(n: u64) -> String {
    let num = &MANIFEST.numbers;
    if n == 0 {
        return units_word(0);
    }
    let mut n = n;
    let mut groups: Vec<String> = Vec::new();
    let mil = n / 1_000_000;
    if mil >= 1000 {
        return String::new();
    }
    if mil != 0 {
        groups.push(format!("{} {}", num.million, below_thousand(mil)));
        n %= 1_000_000;
    }
    let th = n / 1000;
    if th != 0 {
        groups.push(format!("{} {}", num.thousand, below_thousand(th)));
        n %= 1000;
    }
    if n != 0 {
        groups.push(below_thousand(n));
    }
    groups.join(&format!(" {} ", num.and))
}

const NATIVE_CLASS: &str = "[a-zA-Z']";
type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: a foreign accent folded onto the base the g2p reads.
pub static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "u")));

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"({})|(\d+)|([.?!,;:])",
            host_word_run(&["Latin"], "'", "").unwrap()
        ),
        "gu",
    )
    .unwrap()
});

/// `SYMBOLS`, or why the tier refused its data.
pub(crate) fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<Result<SymbolNormalizer, String>> = OnceLock::new();
    S.get_or_init(|| {
        let st = &MANIFEST.symbol_tier;
        make_symbol_normalizer(&SymbolData {
            percent: Some(st.percent.clone()),
            currency: Some(st.currency.clone()),
            units: Some(st.units.clone()),
            percent_prefix: Some(st.percent_prefix),
            currency_prefix: Some(st.currency_prefix),
            unit_prefix: Some(st.unit_prefix),
            unit_per: Some(st.unit_per.clone()),
            rate_denominators: Some(st.rate_denominators.clone()),
            multiply: Some(st.multiply.clone()),
            ampersand: Some(st.ampersand.clone()),
            ..Default::default()
        })
    })
    .as_ref()
    .map_err(|e| e.clone())
}

/// The Swahili engine (`createSwahili`). No foreign reader is wired, as in the TS.
pub struct SwahiliPhonemizer;

impl SwahiliPhonemizer {
    /// `normalizeSwahili(text)` (normalize.ts).
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_swahili(text)
    }

    /// `SYMBOLS(text)`.
    pub fn symbols(&self, text: &JsString) -> JsString {
        try_symbols()
            .expect("checked by create_swahili")
            .apply(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let s = normalize_swahili(&self.symbols(input));
        assemble_clauses(&s, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                let num = js_number(&d);
                let composed = if is_safe_integer(num) {
                    number_to_text(num as u64)
                } else {
                    String::new()
                };
                if !composed.is_empty() {
                    for wd in composed.split(' ') {
                        sink.emit(&phonemize_word(&js(wd)));
                    }
                } else {
                    for dg in d.code_point_strings() {
                        let n = js_number(&dg) as u64;
                        for wd in number_to_text(n).split(' ') {
                            sink.emit(&phonemize_word(&js(wd)));
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

impl Engine for SwahiliPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(SwahiliPhonemizer::text(self, input))
    }
}

/// `createSwahili()`. Loads the manifest and the symbol tier up front.
pub fn create_swahili() -> Result<SwahiliPhonemizer, String> {
    try_manifest()?;
    try_symbols()?;
    Ok(SwahiliPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/swahili.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["baba"], Some("ɓˈaɓa")),
        ("phonemizeWord", &["dada"], Some("ɗˈaɗa")),
        ("phonemizeWord", &["jambo"], Some("ʄˈaᵐbo")),
        ("phonemizeWord", &["ngoma"], Some("ᵑɡˈoma")),
        ("phonemizeWord", &["simba"], Some("sˈiᵐba")),
        ("phonemizeWord", &["ndege"], Some("ⁿdˈeɠe")),
        ("phonemizeWord", &["njia"], Some("ⁿd͡ʒˈia")),
        ("phonemizeWord", &["mtu"], Some("ˈm̩tu")),
        ("phonemizeWord", &["nchi"], Some("ˈn̩t͡ʃi")),
        ("phonemizeWord", &["ng'ombe"], Some("ŋˈoᵐbe")),
        ("phonemizeWord", &["kuu"], Some("kˈuː")),
        ("phonemizeWord", &["mwezi"], Some("mʷˈezi")),
        ("phonemizeWord", &["kweli"], Some("kʷˈeli")),
        ("phonemizeWord", &["chakula"], Some("t͡ʃakˈula")),
        ("phonemizeWord", &["habari"], Some("haɓˈaɾi")),
        ("phonemize", &["11", "sw"], Some("kˈumi nˈa mˈoʄa")),
        ("phonemize", &["21", "sw"], Some("iʃiɾˈini nˈa mˈoʄa")),
        ("phonemize", &["100", "sw"], Some("mˈia mˈoʄa")),
        ("phonemize", &["1000", "sw"], Some("ˈelfu mˈoʄa")),
        (
            "phonemize",
            &["Watoto wanacheza.", "sw"],
            Some("watˈoto wanat͡ʃˈeza ."),
        ),
        ("phonemize", &["1,000", "sw"], Some("ˈelfu mˈoʄa")),
        (
            "phonemize",
            &["104,500", "sw"],
            Some("ˈelfu mˈia mˈoʄa nˈa ˈn̩ne nˈa mˈia tˈano"),
        ),
        (
            "phonemize",
            &["mnamo 2010, 500 watu", "sw"],
            Some("m̩nˈamo ˈelfu ᵐbˈili nˈa kˈumi , mˈia tˈano wˈatu"),
        ),
        ("phonemize", &["1.5", "sw"], Some("mˈoʄa nˈukta tˈano")),
        (
            "phonemize",
            &["6.34", "sw"],
            Some("sˈita nˈukta tˈatu ˈn̩ne"),
        ),
        (
            "phonemize",
            &["802.11n", "sw"],
            Some("mˈia nˈane nˈa ᵐbˈili . kˈumi nˈa mˈoʄa ˈn̩"),
        ),
        ("phonemize", &["80%", "sw"], Some("asilimˈia θemanˈini")),
        (
            "phonemize",
            &["kilomita 2-3", "sw"],
            Some("kilomˈita ᵐbˈili hˈaɗi tˈatu"),
        ),
        (
            "phonemize",
            &["1469-1539", "sw"],
            Some(
                "ˈelfu mˈoʄa nˈa mˈia ˈn̩ne nˈa sitˈini nˈa tˈisa hˈaɗi ˈelfu mˈoʄa nˈa mˈia tˈano nˈa θelaθˈini nˈa tˈisa",
            ),
        ),
        (
            "phonemize",
            &["ushindi wa 5-3", "sw"],
            Some("uʃˈiⁿdi wˈa tˈano tˈatu"),
        ),
        (
            "phonemize",
            &["+30ºC", "sw"],
            Some("plˈas ɲˈuzi ʄˈoto θelaθˈini selsiˈasi"),
        ),
        (
            "phonemize",
            &["30°C", "sw"],
            Some("ɲˈuzi ʄˈoto θelaθˈini selsiˈasi"),
        ),
        (
            "phonemize",
            &["ilidumu hadi karibu 1100 A.D.", "sw"],
            Some("iliɗˈumu hˈaɗi kaɾˈiɓu ˈelfu mˈoʄa nˈa mˈia mˈoʄa ɓˈaːɗa jˈa kɾˈisto ."),
        ),
        (
            "phonemize",
            &["mwaka wa 10,000 BCE.", "sw"],
            Some("mʷˈaka wˈa ˈelfu kˈumi kˈaɓla jˈa kɾˈisto ."),
        ),
        (
            "phonemize",
            &["takribani 400 A.D. na ilidumu", "sw"],
            Some("takɾiɓˈani mˈia ˈn̩ne ɓˈaːɗa jˈa kɾˈisto nˈa iliɗˈumu"),
        ),
        (
            "phonemize",
            &["picha n.k., kwa sehemu", "sw"],
            Some("pˈit͡ʃa nˈa kaðalˈika , kʷˈa sehˈemu"),
        ),
        (
            "phonemize",
            &["Nilikwenda BC. Kisha", "sw"],
            Some("nilikʷˈeⁿda ɓk . kˈiʃa"),
        ),
        ("phonemize", &["Sámi", "sw"], Some("sˈami")),
        ("phonemize", &["Sami", "sw"], Some("sˈami")),
        ("phonemize", &["Gürses", "sw"], Some("ɠˈuɾses")),
        ("phonemize", &["Gurses", "sw"], Some("ɠˈuɾses")),
        (
            "phonemize",
            &["nchi thabiti - si hata Armenia", "sw"],
            Some("ˈn̩t͡ʃi θaɓˈiti , sˈi hˈata aɾmenˈia"),
        ),
        (
            "phonemize",
            &["kwa 26 - 00 kwa urahisi", "sw"],
            Some("kʷˈa iʃiɾˈini nˈa sˈita sifˈuɾi kʷˈa uɾahˈisi"),
        ),
        (
            "phonemize",
            &["999999999", "sw"],
            Some(
                "miliˈoni mˈia tˈisa nˈa tisˈini nˈa tˈisa nˈa ˈelfu mˈia tˈisa nˈa tisˈini nˈa tˈisa nˈa mˈia tˈisa nˈa tisˈini nˈa tˈisa",
            ),
        ),
        (
            "phonemize",
            &["1000000000", "sw"],
            Some("mˈoʄa sifˈuɾi sifˈuɾi sifˈuɾi sifˈuɾi sifˈuɾi sifˈuɾi sifˈuɾi sifˈuɾi sifˈuɾi"),
        ),
        (
            "phonemize",
            &["4082940073", "sw"],
            Some("ˈn̩ne sifˈuɾi nˈane ᵐbˈili tˈisa ˈn̩ne sifˈuɾi sifˈuɾi sˈaɓa tˈatu"),
        ),
        (
            "phonemize",
            &["1000000000000", "sw"],
            Some(
                "mˈoʄa sifˈuɾi sifˈuɾi sifˈuɾi sifˈuɾi sifˈuɾi sifˈuɾi sifˈuɾi sifˈuɾi sifˈuɾi sifˈuɾi sifˈuɾi sifˈuɾi",
            ),
        ),
        ("phonemize", &["asilimia 2", "sw"], Some("asilimˈia ᵐbˈili")),
        ("phonemize", &["masaa 2", "sw"], Some("mˈasaː ᵐbˈili")),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(phonemize_word(&a(0))),
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

    /// Every `rewrite` is on the pipeline string: no probe or golden line poisons the mapping (the TS
    /// `tools/provenance-poison.mts sw` reports 0 sites as well).
    #[test]
    fn swahili_rewrites_never_poison_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes =
            std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/sw.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/sw.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "sw").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 200);
        assert_eq!(hits.get(), 0);
    }
}

/// #1595, as test/ebantu-defects-1595.test.ts: relational, so no IPA is typed. Synthetic inputs.
#[cfg(all(test, feature = "sw"))]
mod defects_1595_tests {
    #[test]
    fn a_temperature_range_keeps_its_span_word() {
        for (input, written) in [
            ("10-15°C", "nyuzi joto 10 hadi 15 Selsiasi"),
            ("2.5-3.5°F", "nyuzi joto 2.5 hadi 3.5 Fahrenheit"),
            ("10-15°", "nyuzi joto 10 hadi 15"),
            ("15-10°C", "15-nyuzi joto 10 Selsiasi"),
        ] {
            assert_eq!(
                crate::phonemize(input, "sw").unwrap(),
                crate::phonemize(written, "sw").unwrap(),
                "{input}"
            );
        }
    }
}
