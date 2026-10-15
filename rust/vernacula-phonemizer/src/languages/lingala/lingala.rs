//! Lingala (ln) phonemizer: written tone marks (acute high, grave low, circumflex falling, caron rising; unmarked
//! low), prenasalized stops by longest match, the number words, and text() over the NFD pipeline string.
//! Ported from src/languages/lingala/lingala.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::{normalize_lingala, try_first_ordinal};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::load_manifest::load_manifest;
use crate::core::provenance::{Form, normalize, renormalize};
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/lingala";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LingalaNumbers {
    pub ordinals: Vec<String>,
    pub zero: String,
    pub ten: String,
    pub tens: String,
    pub hundred: String,
    pub thousand: String,
    pub and: String,
    pub first_card: String,
    pub ten_thousand: String,
    pub ten_thousands: String,
    pub hundred_thousand: String,
    pub hundred_thousands: String,
    pub million: String,
    pub millions: String,
    pub billion: String,
    pub billions: String,
}

/// `LingalaDef`: every field the TS interface names is REQUIRED; documentation keys are ignored.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LingalaDef {
    pub consonants: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: LingalaNumbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_manifest() -> Result<&'static LingalaDef, String> {
    static M: OnceLock<LingalaDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "lingala.jsonc").map_err(|e| e.to_string())
    })
}

static DEF: LazyLock<&'static LingalaDef> =
    LazyLock::new(|| try_manifest().unwrap_or_else(|e| panic!("{e}")));

/// `CKEYS`: the consonant keys, LENGTH DESC by a stable sort, lengths in code units.
static CKEYS: LazyLock<Vec<JsString>> = LazyLock::new(|| {
    let mut keys: Vec<JsString> = DEF
        .consonants
        .keys()
        .map(|k| JsString::from(k.as_str()))
        .collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.len()));
    keys
});

/// `TONE[mark]`: acute, grave, circumflex, caron.
fn tone(mark: &JsString) -> Option<&'static str> {
    [("́", "˥"), ("̀", "˩"), ("̂", "˥˩"), ("̌", "˩˥")]
        .iter()
        .find(|(k, _)| js(k) == *mark)
        .map(|(_, v)| *v)
}

/// `phonemizeWord(word)`: by UTF-16 code unit over the lowercased NFD word, as the TS indexes `s[i]`.
pub fn phonemize_word(word: &JsString) -> JsString {
    let s = normalize(&word.to_lower_case(), Form::Nfd);
    let u = s.units();
    let mut out = JsString::new();
    let mut i = 0;
    while i < u.len() {
        if let Some(k) = CKEYS.iter().find(|k| u[i..].starts_with(k.units())) {
            out.push_str(&js(&DEF.consonants[&k.to_string_lossy()]));
            i += k.len();
            continue;
        }
        let c = JsString::from_units(&u[i..i + 1]);
        if let Some(v) = DEF.vowels.get(&c.to_string_lossy()) {
            out.push_str(&js(v));
            let mark = if i + 1 < u.len() {
                JsString::from_units(&u[i + 1..i + 2])
            } else {
                JsString::new()
            };
            let t = tone(&mark);
            out.push_str(&js(t.unwrap_or("˩")));
            i += if t.is_some() { 2 } else { 1 };
            continue;
        }
        if let Some(p) = latin_phone(
            &c,
            PhoneOpts {
                initial: i == 0,
                include_h: false,
            },
        ) {
            out.push_str(&p);
        }
        i += 1;
    }
    normalize(&out, Form::Nfc)
}

/// `cardinalWords(n)`: a non-negative integer below 10¹² → words.
pub fn cardinal_words(n: u64) -> String {
    let num = &DEF.numbers;
    let ord = |k: u64| num.ordinals[(k - 1) as usize].clone();
    if n == 0 {
        return num.zero.clone();
    }
    if n <= 10 {
        return ord(n);
    }
    if n < 20 {
        return format!("{} {} {}", num.ten, num.and, ord(n % 10));
    }
    if n < 100 {
        let (t, u) = (n / 10, n % 10);
        let tens = format!("{} {}", num.tens, ord(t));
        return if u == 0 {
            tens
        } else {
            format!("{tens} {} {}", num.and, ord(u))
        };
    }
    if n < 1000 {
        let (h, r) = (n / 100, n % 100);
        let hun = format!("{} {}", num.hundred, ord(h));
        return if r == 0 {
            hun
        } else {
            format!("{hun} {} {}", num.and, cardinal_words(r))
        };
    }
    let scales: [(u64, &str, Option<&str>); 5] = [
        (1_000_000_000, &num.billion, Some(&num.billions)),
        (1_000_000, &num.million, Some(&num.millions)),
        (100_000, &num.hundred_thousand, Some(&num.hundred_thousands)),
        (10_000, &num.ten_thousand, Some(&num.ten_thousands)),
        (1000, &num.thousand, None),
    ];
    for (value, sg, pl) in scales {
        if n < value {
            continue;
        }
        let (q, r) = (n / value, n % value);
        let head = match pl {
            None => format!("{sg} {}", cardinal_words(q)),
            Some(_) if q == 1 => sg.to_string(),
            Some(pl) => format!("{pl} {}", cardinal_words(q)),
        };
        return if r == 0 {
            head
        } else {
            format!("{head} {} {}", num.and, cardinal_words(r))
        };
    }
    String::new()
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"([a-zɛɔ̀-ͯ]+)|(\d+)|([.?!,;:])", "giu").unwrap());

/// The Lingala engine (`createLingala`).
pub struct LingalaPhonemizer;

impl LingalaPhonemizer {
    /// `normalizeLingala(text)` (normalize.ts).
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_lingala(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let s = renormalize(&normalize_lingala(input), Form::Nfd);
        assemble_clauses(&s, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                let num = js_number(&d);
                if is_safe_integer(num) && (0.0..1e12).contains(&num) {
                    for w in cardinal_words(num as u64).split(' ') {
                        sink.emit(&phonemize_word(&js(w)));
                    }
                } else {
                    for c in d.code_point_strings() {
                        for w in cardinal_words(js_number(&c) as u64).split(' ') {
                            sink.emit(&phonemize_word(&js(w)));
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

impl Engine for LingalaPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(LingalaPhonemizer::text(self, input))
    }
}

/// `createLingala()`. Loads the manifest up front.
pub fn create_lingala() -> Result<LingalaPhonemizer, String> {
    try_manifest()?;
    try_first_ordinal()?;
    Ok(LingalaPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/lingala.test.ts makes into the engine, with the value the TS returned, extracted
    // MECHANICALLY (the suite run under a recording vitest shim that also checked every matcher: all green), so each
    // of the suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("lingala.phonemizeWord", &["mbɔ́tɛ"], Some("ᵐbɔ˥tɛ˩")),
        ("lingala.phonemizeWord", &["ndáko"], Some("ⁿda˥ko˩")),
        ("lingala.phonemizeWord", &["nzóto"], Some("ⁿzo˥to˩")),
        ("lingala.phonemizeWord", &["Lingála"], Some("li˩ᵑɡa˥la˩")),
        ("lingala.phonemizeWord", &["nyama"], Some("ɲa˩ma˩")),
        ("lingala.phonemizeWord", &["mabelé"], Some("ma˩be˩le˥")),
        ("lingala.phonemizeWord", &["moto"], Some("mo˩to˩")),
        ("lingala.phonemizeWord", &["motó"], Some("mo˩to˥")),
        ("lingala.phonemizeWord", &["mái"], Some("ma˥i˩")),
        ("getPhonemizer(\"ln\").text", &["2"], Some("mi˥ba˩le˥")),
        ("getPhonemizer(\"ln\").text", &["Mbɔ́tɛ!"], Some("ᵐbɔ˥tɛ˩ !")),
        (
            "getPhonemizer(\"ln\").text",
            &["0"],
            Some("li˩bu˩ᵑɡu˩tu˥lu˩"),
        ),
        (
            "getPhonemizer(\"ln\").text",
            &["21"],
            Some("tu˥ku˥ mi˥ba˩le˥ na˩ mo˩˥ko˥"),
        ),
        (
            "getPhonemizer(\"ln\").text",
            &["101"],
            Some("ka˥ma˥ mo˩˥ko˥ na˩ mo˩˥ko˥"),
        ),
        (
            "getPhonemizer(\"ln\").text",
            &["1000"],
            Some("ko˥to˩ mo˩˥ko˥"),
        ),
        ("getPhonemizer(\"ln\").text", &["10000"], Some("mo˩ko˩ko˩")),
        (
            "getPhonemizer(\"ln\").text",
            &["20000"],
            Some("mi˩ko˩ko˩ mi˥ba˩le˥"),
        ),
        ("getPhonemizer(\"ln\").text", &["100000"], Some("e˩lu˥ⁿdu˩")),
        ("getPhonemizer(\"ln\").text", &["1000000"], Some("e˩fu˥ku˩")),
        (
            "getPhonemizer(\"ln\").text",
            &["2000000"],
            Some("bi˩fu˥ku˩ mi˥ba˩le˥"),
        ),
        (
            "getPhonemizer(\"ln\").text",
            &["1000000000"],
            Some("e˩pu˥na˥"),
        ),
        (
            "lingala.normalizeLingala",
            &["79 % ya etando"],
            Some("79 likolo ya mokama ya etando"),
        ),
        (
            "lingala.normalizeLingala",
            &["1,6%"],
            Some("1 6 likolo ya mokama"),
        ),
        (
            "lingala.normalizeLingala",
            &["2-3% ya batu"],
            Some("2 kino 3 likolo ya mokama ya batu"),
        ),
        (
            "lingala.normalizeLingala",
            &["5,500 bato"],
            Some("5500 bato"),
        ),
        (
            "lingala.normalizeLingala",
            &["1.180 km"],
            Some("kilomɛtrɛ 1180"),
        ),
        (
            "lingala.normalizeLingala",
            &["87 009 km2"],
            Some("kilomɛtrɛ-kare 87009"),
        ),
        (
            "lingala.normalizeLingala",
            &["24.383.301"],
            Some("24383301"),
        ),
        ("lingala.normalizeLingala", &["4,20"], Some("4 2 0")),
        ("lingala.normalizeLingala", &["362.07"], Some("362 0 7")),
        (
            "lingala.normalizeLingala",
            &["ntaka ya 120 km"],
            Some("ntaka ya kilomɛtrɛ 120"),
        ),
        (
            "lingala.normalizeLingala",
            &["100 kg"],
            Some("kilogálame 100"),
        ),
        (
            "lingala.normalizeLingala",
            &["35 cm"],
            Some("sɛntimɛtɛlɛ 35"),
        ),
        (
            "lingala.normalizeLingala",
            &["17 000 m²"],
            Some("mɛtrɛ-kare 17000"),
        ),
        (
            "lingala.normalizeLingala",
            &["0,44 km²"],
            Some("kilomɛtrɛ-kare 0 4 4"),
        ),
        (
            "lingala.normalizeLingala",
            &["-273,15 °C"],
            Some("-Celsius 273 1 5"),
        ),
        ("lingala.normalizeLingala", &["802.11n"], Some("802.11n")),
        (
            "lingala.normalizeLingala",
            &["Molaí (molómi): 75 - 90 cm"],
            Some("Molaí (molómi): sɛntimɛtɛlɛ 75 kino 90"),
        ),
        (
            "lingala.normalizeLingala",
            &["Bolaí ezalí 13-19 cm"],
            Some("Bolaí ezalí sɛntimɛtɛlɛ 13 kino 19"),
        ),
        (
            "lingala.normalizeLingala",
            &["(1500-1800 mm)"],
            Some("(milimɛtrɛ 1500 kino 1800)"),
        ),
        (
            "lingala.normalizeLingala",
            &["39 - 45 kg"],
            Some("kilogálame 39 kino 45"),
        ),
        ("lingala.normalizeLingala", &["90-75 cm"], Some("90-75 cm")),
        ("lingala.normalizeLingala", &["-5 km"], Some("-kilomɛtrɛ 5")),
        (
            "lingala.normalizeLingala",
            &["na mibu 1965-1975"],
            Some("na mibu 1965 kino 1975"),
        ),
        (
            "lingala.normalizeLingala",
            &["1975-1965"],
            Some("1975-1965"),
        ),
        (
            "lingala.normalizeLingala",
            &["(6 mársi 1475 - 18 febwáli 1564)"],
            Some("(6 mársi 1475 - 18 febwáli 1564)"),
        ),
        (
            "lingala.normalizeLingala",
            &["score ya 0 - 3"],
            Some("score ya 0 - 3"),
        ),
        (
            "lingala.normalizeLingala",
            &["ISBN 1-59427-034-1"],
            Some("ISBN 1 5 9 4 2 7 0 3 4 1"),
        ),
        (
            "lingala.normalizeLingala",
            &["1-59427-034-1"],
            Some("1-59427-034-1"),
        ),
        (
            "lingala.normalizeLingala",
            &["Malako 16:15-18"],
            Some("Malako 16:15-18"),
        ),
        ("lingala.normalizeLingala", &["77-81."], Some("77 kino 81.")),
        (
            "lingala.normalizeLingala",
            &["1876-1900."],
            Some("1876 kino 1900."),
        ),
        (
            "lingala.normalizeLingala",
            &["1900-1910)"],
            Some("1900 kino 1910)"),
        ),
        ("lingala.normalizeLingala", &["5-13.7"], Some("5-13 7")),
        (
            "lingala.normalizeLingala",
            &["doi:10.1186/1742-4690.3"],
            Some("doi:10 1 1 8 6/1742-4690 3"),
        ),
        ("lingala.normalizeLingala", &["5-13,7"], Some("5-13 7")),
        (
            "lingala.normalizeLingala",
            &["pene na 20%-40% ya batu"],
            Some("pene na 20 likolo ya mokama kino 40 likolo ya mokama ya batu"),
        ),
        (
            "lingala.normalizeLingala",
            &["7.5%-10%"],
            Some("7 5 likolo ya mokama kino 10 likolo ya mokama"),
        ),
        (
            "lingala.normalizeLingala",
            &["pene na 2-3% ya batu"],
            Some("pene na 2 kino 3 likolo ya mokama ya batu"),
        ),
        (
            "lingala.normalizeLingala",
            &["40%-20%"],
            Some("40 likolo ya mokama-20 likolo ya mokama"),
        ),
        ("lingala.normalizeLingala", &["2/3"], Some("2 ya 3")),
        ("lingala.normalizeLingala", &["3/4"], Some("3 ya 4")),
        (
            "lingala.normalizeLingala",
            &["¼ ya batu"],
            Some(" mǒkó ya mínei  ya batu"),
        ),
        (
            "lingala.normalizeLingala",
            &["Mobéko n°011/2002"],
            Some("Mobéko n°011/2002"),
        ),
        ("lingala.normalizeLingala", &["50/51"], Some("50/51")),
        (
            "lingala.normalizeLingala",
            &["12/04/2014"],
            Some("12/04/2014"),
        ),
        ("lingala.normalizeLingala", &["24/7"], Some("24/7")),
        (
            "lingala.normalizeLingala",
            &["Na mobu 586 L.T.B.,"],
            Some("Na mobu 586 liboso ya tango na biso,"),
        ),
        (
            "lingala.normalizeLingala",
            &["ekeke ya 7 T.B.,"],
            Some("ekeke ya 7 tango na biso,"),
        ),
        (
            "lingala.normalizeLingala",
            &["mobú ya 1979 n. Y.K."],
            Some("mobú ya 1979 nsima ya Yézu Klísto."),
        ),
        (
            "lingala.normalizeLingala",
            &["útá 311 yambo Y.K."],
            Some("útá 311 yambo Yézu Klísto."),
        ),
        (
            "lingala.normalizeLingala",
            &["Bambata, b.n.b."],
            Some("Bambata, bôngó na bôngó."),
        ),
        (
            "lingala.normalizeLingala",
            &["lokóla b.n.b. mpé"],
            Some("lokóla bôngó na bôngó mpé"),
        ),
        (
            "lingala.normalizeLingala",
            &["du 16ème siècle"],
            Some("du ya 16 siècle"),
        ),
        (
            "lingala.normalizeLingala",
            &["le 1er janvier"],
            Some("le ya libosó janvier"),
        ),
        ("lingala.normalizeLingala", &["2e éd."], Some("ya 2 éd.")),
        (
            "lingala.normalizeLingala",
            &["Com a morte em 1.533 e com a invasão"],
            Some("Com a morte em 1533 e com a invasão"),
        ),
        ("lingala.normalizeLingala", &["2 ème"], Some("ya 2")),
        ("lingala.normalizeLingala", &["A&B"], Some("A mpé B")),
        (
            "lingala.normalizeLingala",
            &["De Moor & JP Jacquemin"],
            Some("De Moor mpé JP Jacquemin"),
        ),
        (
            "getPhonemizer(\"ln\").text",
            &["79 %"],
            Some("tu˥ku˥ sa˩ᵐbo˩ na˩ li˩bwa˥ li˩ko˩lo˩ ja˩ mo˩ka˩ma˩"),
        ),
        (
            "getPhonemizer(\"ln\").text",
            &["100 kg"],
            Some("ki˩lo˩ɡa˥la˩me˩ ka˥ma˥ mo˩˥ko˥"),
        ),
        (
            "getPhonemizer(\"ln\").text",
            &["25 °C"],
            Some("ke˩lsi˩u˩s tu˥ku˥ mi˥ba˩le˥ na˩ mi˥ta˥no˩"),
        ),
        (
            "getPhonemizer(\"ln\").text",
            &["2/3"],
            Some("mi˥ba˩le˥ ja˩ mi˥sa˥to˩"),
        ),
        (
            "getPhonemizer(\"ln\").text",
            &["4,20"],
            Some("mi˥ne˩i˩ mi˥ba˩le˥ li˩bu˩ᵑɡu˩tu˥lu˩"),
        ),
        (
            "getPhonemizer(\"ln\").text",
            &["b.n.b."],
            Some("bo˥˩ᵑɡo˥ na˩ bo˥˩ᵑɡo˥ ."),
        ),
        ("getPhonemizer(\"ln\").text", &["A & B"], Some("a˩ ᵐpe˥ b")),
        (
            "lingala.normalizeLingala",
            &["1er décembre"],
            Some("ya libosó décembre"),
        ),
        (
            "lingala.normalizeLingala",
            &["1ère décembre"],
            Some("ya libosó décembre"),
        ),
        (
            "lingala.normalizeLingala",
            &["1re décembre"],
            Some("ya libosó décembre"),
        ),
        (
            "lingala.normalizeLingala",
            &["1 er décembre"],
            Some("ya libosó décembre"),
        ),
        (
            "lingala.normalizeLingala",
            &["16ème siècle"],
            Some("ya 16 siècle"),
        ),
        (
            "lingala.normalizeLingala",
            &["Na 8:46 na ntongo, kimya"],
            Some("Na 8 46 na ntongo, kimya"),
        ),
        (
            "lingala.normalizeLingala",
            &["na 10:08 ya butu na mokolo"],
            Some("na 10 08 ya butu na mokolo"),
        ),
        (
            "lingala.normalizeLingala",
            &["(15.00 UTC)"],
            Some("(15 00 UTC)"),
        ),
        ("lingala.normalizeLingala", &["Kol 1:26"], Some("Kol 1:26")),
        (
            "lingala.normalizeLingala",
            &["Na 11:20, polisi"],
            Some("Na 11:20, polisi"),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let call = |f: &str, args: &[&str]| -> Option<JsString> {
            let a = |i: usize| js(args[i]);
            match f {
                "lingala.phonemizeWord" => Some(phonemize_word(&a(0))),
                "lingala.normalizeLingala" => Some(normalize_lingala(&a(0))),
                "getPhonemizer(\"ln\").text" => {
                    Some(crate::registry::phonemize_in("ln", &a(0)).unwrap())
                }
                "phonemize" => Some(js(&crate::phonemize(args[0], args[1]).unwrap())),
                _ => panic!("no replay for {f}"),
            }
        };
        for (f, args, want) in TS_SUITE_CALLS {
            let got: Option<String> = call(f, args).map(|s| s.to_string_lossy());
            assert_eq!(got.as_deref(), *want, "{f}{args:?}");
        }
    }

    /// Every `rewrite` is on the pipeline string: no probe or golden line poisons the mapping (the TS
    /// `tools/provenance-poison.mts ln` reports 0 sites as well).
    #[test]
    fn lingala_rewrites_never_poison_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes =
            std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/ln.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/ln.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "ln").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 200);
        assert_eq!(hits.get(), 0);
    }
}
