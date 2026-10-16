//! Sundanese (su) phonemizer: a flat digraph-first scan of the Latin orthography (Aksara Sunda transliterated first),
//! glottal insertion, penult stress skipping a schwa, the decimal number words, and text().
//! Ported from src/languages/sundanese/sundanese.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::{normalize_sundanese, try_symbols};
use super::sunda_aksara::{aksara_to_latin, is_aksara_sunda, normalize_sunda_digits};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/sundanese";

#[derive(Debug, Deserialize)]
pub struct NumbersDef {
    pub units: Vec<String>,
    pub belas: String,
    pub puluh: String,
    pub ratus: String,
    pub rebu: String,
    pub yuta: String,
    pub seprefix: String,
    pub miliar: String,
    pub triliun: String,
}

/// `SundaneseDef` (sundanese.ts).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SundaneseDef {
    pub digraphs: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub glottal: String,
    pub numbers: NumbersDef,
    pub clause_punctuation: IndexMap<String, String>,
}

pub fn try_def() -> Result<&'static SundaneseDef, String> {
    static D: OnceLock<SundaneseDef> = OnceLock::new();
    load_once(&D, || {
        load_manifest(DIR, "sundanese.jsonc").map_err(|e| e.to_string())
    })
}

/// `DEF`, for code reached only through a checked path (`createSundanese` loads it first).
static DEF: LazyLock<&'static SundaneseDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

/// `isVowelPh(s)`: `VOWEL_PH.includes(s)`, a SUBSTRING test (so "" counts as a vowel, as in the TS).
fn is_vowel_ph(s: &JsString) -> bool {
    js("aeiouəɨ").includes(s)
}

/// `phonemizeWord(word)`: either script, then the shared g2p, glottal insertion and stress.
pub fn phonemize_word(word: &JsString) -> JsString {
    let latin = if is_aksara_sunda(word) {
        aksara_to_latin(word)
    } else {
        word.clone()
    };
    let s = normalize(&latin.to_lower_case(), Form::Nfc).code_point_strings();
    let mut segs: Vec<JsString> = Vec::new();
    let mut i = 0;
    while i < s.len() {
        let two = s[i].concat(&s.get(i + 1).cloned().unwrap_or_default());
        if let Some(d) = DEF.digraphs.get(&two.to_string_lossy()) {
            segs.push(js(d));
            i += 2;
            continue;
        }
        let c = s[i].to_string_lossy();
        if let Some(v) = DEF.vowels.get(&c) {
            segs.push(js(v));
        } else if let Some(k) = DEF.consonants.get(&c) {
            segs.push(js(k));
        }
        i += 1;
    }
    let glottal = js(&DEF.glottal);
    if !segs.is_empty() && is_vowel_ph(&segs[0]) {
        segs.insert(0, glottal.clone());
    }
    let mut i = segs.len().saturating_sub(1);
    while i > 0 {
        if is_vowel_ph(&segs[i]) && segs[i] == segs[i - 1] {
            segs.insert(i, glottal.clone());
        }
        i -= 1;
    }
    let vidx: Vec<usize> = (0..segs.len()).filter(|&k| is_vowel_ph(&segs[k])).collect();
    if vidx.len() >= 2 {
        let penult = vidx[vidx.len() - 2];
        let at = if segs[penult] == js("ə") {
            vidx[vidx.len() - 1]
        } else {
            penult
        };
        segs.insert(at, js("ˈ"));
    }
    normalize(&JsString::join(&segs, &JsString::new()), Form::Nfc)
}

/// `toWords(n)`: the decimal composition, the `sa-` prefix on a leading 1.
fn to_words(n: f64) -> String {
    let num = &DEF.numbers;
    let u = |k: f64| num.units[k as usize].clone();
    if n < 10.0 {
        return u(n);
    }
    if n < 20.0 {
        return if n == 10.0 {
            format!("{}{}", num.seprefix, num.puluh)
        } else if n == 11.0 {
            format!("{}{}", num.seprefix, num.belas)
        } else {
            format!("{} {}", u(n - 10.0), num.belas)
        };
    }
    if n < 100.0 {
        let (t, un) = ((n / 10.0).floor(), n % 10.0);
        let tail = if un != 0.0 {
            format!(" {}", u(un))
        } else {
            String::new()
        };
        return format!("{} {}{tail}", u(t), num.puluh);
    }
    let tail = |r: f64| {
        if r != 0.0 {
            format!(" {}", to_words(r))
        } else {
            String::new()
        }
    };
    if n < 1000.0 {
        let (h, r) = ((n / 100.0).floor(), n % 100.0);
        let head = if h == 1.0 {
            format!("{}{}", num.seprefix, num.ratus)
        } else {
            format!("{} {}", u(h), num.ratus)
        };
        return head + &tail(r);
    }
    if n < 1_000_000.0 {
        let (th, r) = ((n / 1000.0).floor(), n % 1000.0);
        let head = if th == 1.0 {
            format!("{}{}", num.seprefix, num.rebu)
        } else {
            format!("{} {}", to_words(th), num.rebu)
        };
        return head + &tail(r);
    }
    // Above yuta: miliar (10⁹) and triliun (10¹²), then the count of triliun (#1589). See sundanese.ts.
    scale(n, 1e12, &num.triliun)
        .or_else(|| scale(n, 1e9, &num.miliar))
        .unwrap_or_else(|| scale(n, 1e6, &num.yuta).unwrap_or_default())
}

/// `n` read as a count of `unit` plus the remainder, or `None` if `n` is below one `unit`.
fn scale(n: f64, unit: f64, word: &str) -> Option<String> {
    if n < unit {
        return None;
    }
    let num = &DEF.numbers;
    let (c, r) = ((n / unit).floor(), n % unit);
    let head = if c == 1.0 {
        format!("{}{}", num.seprefix, word)
    } else {
        format!("{} {}", to_words(c), word)
    };
    Some(if r != 0.0 {
        format!("{head} {}", to_words(r))
    } else {
        head
    })
}

/// `number(digits)`: digit at a time above 2⁵³.
fn number(digits: &JsString) -> JsString {
    let n = js_number(digits);
    let words = if is_safe_integer(n) {
        to_words(n)
    } else {
        digits
            .code_point_strings()
            .iter()
            .map(|d| to_words(js_number(d)))
            .collect::<Vec<_>>()
            .join(" ")
    };
    let parts: Vec<JsString> = words.split(' ').map(|w| phonemize_word(&js(w))).collect();
    JsString::join(&parts, &js(" "))
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"({})|(\d+)|([.?!,;:…])",
            host_word_run(&["Latin", "Sundanese"], "", "").unwrap()
        ),
        "giu",
    )
    .unwrap()
});

const NATIVE_CLASS: &str = r"[a-zéÉ\u{1B80}-\u{1BAF}\u{1BBA}-\u{1BBF}]";
type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: a foreign letter folded onto the Latin base the g2p reads.
pub static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "iu")));

pub struct SundanesePhonemizer;

impl SundanesePhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_sundanese(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        try_symbols()
            .expect("checked by create_sundanese")
            .apply(text)
    }

    pub fn number(&self, digits: &JsString) -> JsString {
        number(digits)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let s = normalize_sundanese(&normalize_sunda_digits(input));
        assemble_clauses(&s, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                sink.emit(&number(&d));
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

impl Engine for SundanesePhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(SundanesePhonemizer::text(self, input))
    }
}

/// `createSundanese()`. Loads the manifest and the symbol tier up front.
pub fn create_sundanese() -> Result<SundanesePhonemizer, String> {
    try_def()?;
    try_symbols()?;
    Ok(SundanesePhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/sundanese.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["ieu"], Some("ʔˈiɨ")),
        ("phonemizeWord", &["seukeut"], Some("sˈɨkɨt")),
        ("phonemizeWord", &["kecap"], Some("kət͡ʃˈap")),
        ("phonemizeWord", &["ngéwé"], Some("ŋˈewe")),
        ("phonemizeWord", &["kuring"], Some("kˈuriŋ")),
        ("phonemizeWord", &["naam"], Some("nˈaʔam")),
        ("phonemizeWord", &["basa"], Some("bˈasa")),
        ("getPhonemizer(\"su\").text", &["11"], Some("sabəlˈas")),
        ("getPhonemizer(\"su\").text", &["12"], Some("dˈua bəlˈas")),
        (
            "getPhonemizer(\"su\").text",
            &["25"],
            Some("dˈua pˈuluh lˈima"),
        ),
        ("getPhonemizer(\"su\").text", &["100"], Some("sarˈatus")),
        ("phonemizeWord", &["ᮃᮊ᮪ᮞᮛ"], Some("ʔaksˈara")),
        ("phonemizeWord", &["aksara"], Some("ʔaksˈara")),
        ("phonemizeWord", &["ᮊᮨ"], Some("kə")),
        ("phonemizeWord", &["ᮊᮦ"], Some("ke")),
        ("phonemizeWord", &["ᮊᮩ"], Some("kɨ")),
        ("phonemizeWord", &["ᮊᮀ"], Some("kaŋ")),
        ("phonemizeWord", &["ᮝᮤᮜᮥᮏᮨᮀ"], Some("wilˈud͡ʒəŋ")),
        ("getPhonemizer(\"su\").text", &["᮱᮱"], Some("sabəlˈas")),
        (
            "phonemize",
            &["3.000 taun", "su"],
            Some("tˈilu rəbˈu tˈaun"),
        ),
        (
            "phonemize",
            &["3,000 pulo", "su"],
            Some("tˈilu rəbˈu pˈulo"),
        ),
        (
            "phonemize",
            &["1,69%", "su"],
            Some("hˈid͡ʒi kˈoma ɡənˈəp salˈapan pərsˈen"),
        ),
        (
            "phonemize",
            &["0.01%", "su"],
            Some("ʔənˈol kˈoma ʔənˈol hˈid͡ʒi pərsˈen"),
        ),
        ("phonemize", &["5 000", "su"], Some("lˈima rəbˈu")),
        (
            "phonemize",
            &["764.387,59 ha", "su"],
            Some(
                "tˈud͡ʒuh rˈatus ɡənˈəp pˈuluh ʔˈopat rəbˈu tˈilu rˈatus dalˈapan pˈuluh tˈud͡ʒuh kˈoma lˈima salˈapan hˈektar",
            ),
        ),
        (
            "phonemize",
            &["764,387.59 ha", "su"],
            Some(
                "tˈud͡ʒuh rˈatus ɡənˈəp pˈuluh ʔˈopat rəbˈu tˈilu rˈatus dalˈapan pˈuluh tˈud͡ʒuh kˈoma lˈima salˈapan hˈektar",
            ),
        ),
        (
            "phonemize",
            &["taun 1990 2000", "su"],
            Some("tˈaun sarəbˈu salˈapan rˈatus salˈapan pˈuluh dˈua rəbˈu"),
        ),
        ("phonemize", &["jam 05.00", "su"], Some("d͡ʒam lˈima")),
        (
            "phonemize",
            &["tabuh 11:10", "su"],
            Some("tˈabuh sabəlˈas lˈiwat sapˈuluh"),
        ),
        (
            "phonemize",
            &["100 SM", "su"],
            Some("sarˈatus samˈemeh masˈehi"),
        ),
        (
            "phonemize",
            &["170-an SM", "su"],
            Some("sarˈatus tˈud͡ʒuh pˈuluh ʔan samˈemeh masˈehi"),
        ),
        (
            "phonemize",
            &["434 M", "su"],
            Some("ʔˈopat rˈatus tˈilu pˈuluh ʔˈopat masˈehi"),
        ),
        (
            "phonemize",
            &["1350-1357", "su"],
            Some(
                "sarəbˈu tˈilu rˈatus lˈima pˈuluh nəpˈi ka sarəbˈu tˈilu rˈatus lˈima pˈuluh tˈud͡ʒuh",
            ),
        ),
        (
            "phonemize",
            &["nepi ka 8–20 méter", "su"],
            Some("nəpˈi ka dalˈapan dˈua pˈuluh mˈetər"),
        ),
        (
            "phonemize",
            &["Nomer CAS 50-21-5", "su"],
            Some("nˈomər t͡ʃas lˈima pˈuluh dˈua pˈuluh hˈid͡ʒi lˈima"),
        ),
        (
            "phonemize",
            &["Mangsa Taun 1270-1910.", "su"],
            Some(
                "mˈaŋsa tˈaun sarəbˈu dˈua rˈatus tˈud͡ʒuh pˈuluh nəpˈi ka sarəbˈu salˈapan rˈatus sapˈuluh .",
            ),
        ),
        (
            "phonemize",
            &["taun 1884–1894.", "su"],
            Some(
                "tˈaun sarəbˈu dalˈapan rˈatus dalˈapan pˈuluh ʔˈopat nəpˈi ka sarəbˈu dalˈapan rˈatus salˈapan pˈuluh ʔˈopat .",
            ),
        ),
        (
            "phonemize",
            &["jaman 1808-1811.", "su"],
            Some(
                "d͡ʒˈaman sarəbˈu dalˈapan rˈatus dalˈapan nəpˈi ka sarəbˈu dalˈapan rˈatus sabəlˈas .",
            ),
        ),
        (
            "phonemize",
            &["taun 1884–1894,", "su"],
            Some(
                "tˈaun sarəbˈu dalˈapan rˈatus dalˈapan pˈuluh ʔˈopat sarəbˈu dalˈapan rˈatus salˈapan pˈuluh ʔˈopat ,",
            ),
        ),
        (
            "phonemize",
            &["300 km", "su"],
            Some("tˈilu rˈatus kilomˈetər"),
        ),
        (
            "phonemize",
            &["100 km²", "su"],
            Some("sarˈatus kilomˈetər pasˈaɡi"),
        ),
        (
            "phonemize",
            &["jiwa/km²", "su"],
            Some("d͡ʒˈiwa pər kilomˈetər pasˈaɡi"),
        ),
        (
            "phonemize",
            &["$120 juta", "su"],
            Some("sarˈatus dˈua pˈuluh d͡ʒˈuta dˈolar"),
        ),
        (
            "phonemize",
            &["Rp 13,1", "su"],
            Some("tˈilu bəlˈas kˈoma hˈid͡ʒi rupˈiah"),
        ),
        (
            "phonemize",
            &["£26 juta", "su"],
            Some("dˈua pˈuluh ɡənˈəp d͡ʒˈuta poundstˈerliŋ"),
        ),
        (
            "phonemize",
            &["40,9 °C", "su"],
            Some("ʔˈopat pˈuluh kˈoma salˈapan darˈad͡ʒat t͡ʃəlsˈius"),
        ),
        ("phonemize", &["A & B", "su"], Some("ʔa d͡ʒɨŋ b")),
        ("phonemize", &["1/2", "su"], Some("satəŋˈah")),
        ("phonemize", &["3/4", "su"], Some("tˈilu pər ʔˈopat")),
        (
            "phonemize",
            &["5 + (−3) = 2", "su"],
            Some("lˈima tˈambah kˈuraŋ tˈilu sarˈua d͡ʒɨŋ dˈua"),
        ),
        (
            "phonemize",
            &["5 mg séng", "su"],
            Some("lˈima milˈiɡram seŋ"),
        ),
        (
            "phonemize",
            &["beuratna 150 gr", "su"],
            Some("bɨrˈatna sarˈatus lˈima pˈuluh ɡram"),
        ),
        (
            "phonemize",
            &["(96 pm)", "su"],
            Some("salˈapan pˈuluh ɡənˈəp pikomˈetər"),
        ),
        (
            "phonemize",
            &["160 km/h", "su"],
            Some("sarˈatus ɡənˈəp pˈuluh kilomˈetər pər d͡ʒam"),
        ),
        (
            "phonemize",
            &["10 m/s", "su"],
            Some("sapˈuluh mˈetər pər dətˈik"),
        ),
        (
            "phonemize",
            &["$10^{12}$", "su"],
            Some("sapˈuluh pˈaŋkat dˈua bəlˈas"),
        ),
        (
            "phonemize",
            &["$120", "su"],
            Some("sarˈatus dˈua pˈuluh dˈolar"),
        ),
        (
            "phonemize",
            &["50 000.", "su"],
            Some("lˈima pˈuluh rəbˈu ."),
        ),
        ("phonemize", &["50 000", "su"], Some("lˈima pˈuluh rəbˈu")),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(phonemize_word(&a(0))),
                // `getPhonemizer("su").text(t)`: the registry's wrapped engine, i.e. `phonemize`.
                "getPhonemizer(\"su\").text" => {
                    Some(js(&crate::phonemize(&a(0).to_string_lossy(), "su").unwrap()))
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

    /// Every `rewrite` is on the pipeline string: no probe or golden line poisons the mapping (the TS
    /// `tools/provenance-poison.mts su` reports 0 sites as well).
    #[test]
    fn sundanese_rewrites_never_poison_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes =
            std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/su.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/su.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "su").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 200);
        assert_eq!(hits.get(), 0);
    }
}

/// #1589, as test/sea-defects-1589.test.ts: relational, so no IPA is typed. Synthetic probes.
#[cfg(all(test, feature = "su"))]
mod defects_1589_tests {
    #[test]
    fn reads_as_its_spelled_form() {
        for (input, spelled) in [
            ("3,14159", "3 koma 1 4 1 5 9"),
            ("1000000000", "samiliar"),
            ("1000000000000", "satriliun"),
            ("2500000000", "dua miliar lima ratus yuta"),
        ] {
            assert_eq!(
                crate::phonemize(input, "su").unwrap(),
                crate::phonemize(spelled, "su").unwrap(),
                "{input}"
            );
        }
    }
}
