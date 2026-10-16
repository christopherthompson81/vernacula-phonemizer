//! Akan / Twi (ak) phonemizer: a letter scan with ATR harmony on ⟨e⟩ / ⟨o⟩, the rounded-vowel glide, nasal
//! assimilation and the post-nasal ⟨b⟩, an optional per-nucleus tone lexicon, the numbers, and text().
//! Ported from src/languages/akan/akan.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use super::normalize::normalize_akan;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::ipa::is_ipa_vowel;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number, js_number_to_string};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::load_manifest::load_manifest;
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};
use crate::core::provenance::{Form, normalize};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/akan";

#[derive(Debug, FromJson)]
pub struct AkanNumbers {
    pub zero: String,
    pub units: Vec<String>,
    pub ten: String,
    pub tens: Vec<String>,
    pub hundreds: Vec<String>,
    pub thousand: String,
    pub thousands: String,
    pub million: String,
    pub millions: String,
    pub billion: String,
    pub billions: String,
}

/// `AkanDef`: the tables of akan.jsonc.
#[derive(Debug, FromJson)]
#[json(rename_all = "camelCase")]
pub struct AkanDef {
    pub digraphs: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub numbers: AkanNumbers,
}

fn try_def() -> Result<&'static AkanDef, String> {
    static D: OnceLock<AkanDef> = OnceLock::new();
    load_once(&D, || {
        load_manifest(DIR, "akan.jsonc").map_err(|e| e.to_string())
    })
}

static DEF: LazyLock<&'static AkanDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

/// `TONE_LEX` (akan-tone.tsv, optional): word → comma-separated per-nucleus tones, the value as written.
fn try_tone_lex() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static T: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&T, || {
        load_tsv_strings(
            DIR,
            "akan-tone.tsv",
            TsvOptions {
                optional: true,
                fold: None,
            },
        )
        .map_err(|e| e.to_string())
    })
}

const TILDE: &str = "̃";

fn is_vowel(c: Option<&JsString>) -> bool {
    c.is_some_and(|c| DEF.vowels.contains_key(&c.to_string_lossy()))
}

/// `atrByIndex(s)`: each vowel's ±ATR, spread forward then backward from i/u (+) and ɛ/ɔ (−); + where none decides.
fn atr_by_index(s: &[JsString]) -> IndexMap<usize, bool> {
    let mut idx = Vec::new();
    let mut val: Vec<Option<bool>> = Vec::new();
    for (k, c) in s.iter().enumerate() {
        let cs = c.to_string_lossy();
        if !DEF.vowels.contains_key(&cs) {
            continue;
        }
        idx.push(k);
        val.push(match cs.as_str() {
            "i" | "u" => Some(true),
            "ɛ" | "ɔ" => Some(false),
            _ => None,
        });
    }
    let mut last: Option<bool> = None;
    for v in val.iter_mut() {
        if v.is_some() {
            last = *v;
        } else if last.is_some() {
            *v = last;
        }
    }
    last = None;
    for v in val.iter_mut().rev() {
        if v.is_some() {
            last = *v;
        } else if last.is_some() {
            *v = last;
        }
    }
    idx.into_iter()
        .zip(val)
        .map(|(k, v)| (k, v.unwrap_or(true)))
        .collect()
}

fn phonemize_core(word: &JsString, use_tone: bool) -> JsString {
    let def = &*DEF;
    let lw = word.to_lower_case();
    let s = lw.code_point_strings();
    let n = s.len();
    let atr = atr_by_index(&s);
    let empty = JsString::new();
    let mut out: Vec<JsString> = Vec::new();
    let mut i = 0;
    while i < n {
        let c = &s[i];
        let cs = c.to_string_lossy();
        let nx = s.get(i + 1);
        let two = c.concat(nx.unwrap_or(&empty)).to_string_lossy();
        if let Some(p) = def.digraphs.get(&two) {
            out.push(js(p));
            i += 2;
            continue;
        }
        if let Some(v) = def.vowels.get(&cs) {
            if js("oɔu").includes(c) && is_vowel(nx) && nx != Some(c) {
                out.push(js("w"));
            } else if cs == "e" {
                out.push(js(if atr.get(&i).copied().unwrap_or(false) {
                    "e"
                } else {
                    "ɪ"
                }));
            } else if cs == "o" {
                out.push(js(if atr.get(&i).copied().unwrap_or(false) {
                    "o"
                } else {
                    "ʊ"
                }));
            } else {
                out.push(js(v));
            }
            i += 1;
            continue;
        }
        let nx_is = |t: &str| nx.is_some_and(|x| *x == t);
        if cs == "n" {
            let p = if is_vowel(nx) {
                "n"
            } else if nx_is("k") || nx_is("g") {
                "ŋ"
            } else if nx_is("p") || nx_is("b") || nx_is("f") || nx_is("m") {
                "m"
            } else {
                "n"
            };
            out.push(js(p));
            i += 1;
            continue;
        }
        if cs == "ŋ" {
            out.push(js("ŋ"));
            i += 1;
            continue;
        }
        if cs == "b" {
            let after_nasal = js_re!("[mnɲŋ]$", "u").test(out.last().unwrap_or(&empty));
            out.push(js(if after_nasal { "m" } else { "b" }));
            i += 1;
            continue;
        }
        if let Some(p) = def.consonants.get(&cs) {
            out.push(js(p));
            i += 1;
            continue;
        }
        if *c == TILDE {
            if let Some(last) = out.last_mut() {
                last.push_str(&js(TILDE));
            }
            i += 1;
            continue;
        }
        if let Some(p) = latin_phone(
            c,
            PhoneOpts {
                initial: i == 0,
                include_h: false,
            },
        ) {
            out.push(p);
        }
        i += 1;
    }
    if use_tone
        && let Some(pat) = try_tone_lex()
            .expect("checked by create_akan")
            .get(&lw)
            .filter(|p| !p.is_empty())
    {
        let toks = pat.split(&js(","));
        let nuc: Vec<usize> = (0..out.len())
            .filter(|&k| out[k].len() == 1 && is_ipa_vowel(out[k].0[0]))
            .collect();
        if toks.len() == nuc.len() {
            for (k, &at) in nuc.iter().enumerate() {
                let t = &toks[k];
                if t.includes(&js("~")) {
                    out[at].push_str(&js(TILDE));
                }
                out[at].push_str(&js(if t.char_code_at(0) == Some(u16::from(b'H')) {
                    "˥"
                } else {
                    "˩"
                }));
            }
        }
    }
    normalize(&JsString::join(&out, &JsString::new()), Form::Nfc)
}

/// `phonemizeWord(word)`: the scan with the tone lexicon applied.
pub fn phonemize_word(word: &JsString) -> JsString {
    phonemize_core(word, true)
}

/// `phonemizeWordRules(word)`: the scan alone.
pub fn phonemize_word_rules(word: &JsString) -> JsString {
    phonemize_core(word, false)
}

fn unit(i: f64) -> String {
    DEF.numbers.units[i as usize].clone()
}

fn under100(n: f64) -> String {
    let nb = &DEF.numbers;
    if n < 10.0 {
        return unit(n - 1.0);
    }
    if n == 10.0 {
        return nb.ten.clone();
    }
    if n < 20.0 {
        return format!("{} {}", nb.ten, unit(n - 11.0));
    }
    let t = (n / 10.0).floor();
    let u = n % 10.0;
    let tens = &nb.tens[(t - 2.0) as usize];
    if u == 0.0 {
        tens.clone()
    } else {
        format!("{tens} {}", unit(u - 1.0))
    }
}

fn under1000(n: f64) -> String {
    if n < 100.0 {
        return under100(n);
    }
    let h = (n / 100.0).floor();
    let r = n % 100.0;
    let hundreds = &DEF.numbers.hundreds[(h - 1.0) as usize];
    if r == 0.0 {
        hundreds.clone()
    } else {
        format!("{hundreds} {}", under100(r))
    }
}

/// `numberWords(n)` for a safe integer (the only kind text() hands it).
fn number_words(n: f64) -> String {
    let nb = &DEF.numbers;
    if n == 0.0 {
        return nb.zero.clone();
    }
    if n >= 1e12 {
        // `units[Number(d) - 1]`, joined: a miss would join as "" (Array.join), as in the TS.
        return js_number_to_string(n)
            .chars()
            .map(|d| match d {
                '0' => nb.zero.clone(),
                _ => d
                    .to_digit(10)
                    .and_then(|v| nb.units.get(v as usize - 1))
                    .cloned()
                    .unwrap_or_default(),
            })
            .collect::<Vec<_>>()
            .join(" ");
    }
    let mut parts = Vec::new();
    let bil = (n / 1e9).floor();
    let mil = ((n % 1e9) / 1e6).floor();
    let th = ((n % 1e6) / 1000.0).floor();
    let r = n % 1000.0;
    if bil > 0.0 {
        parts.push(if bil == 1.0 {
            nb.billion.clone()
        } else {
            format!("{} {}", nb.billions, under1000(bil))
        });
    }
    if mil > 0.0 {
        parts.push(if mil == 1.0 {
            nb.million.clone()
        } else {
            format!("{} {}", nb.millions, under1000(mil))
        });
    }
    if th > 0.0 {
        parts.push(if th == 1.0 {
            nb.thousand.clone()
        } else {
            format!("{} {}", nb.thousands, under1000(th))
        });
    }
    if r > 0.0 {
        parts.push(under1000(r));
    }
    parts.join(" ")
}

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: Akan's own inventory; a token outside it is a foreign name and is folded.
pub static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[A-Za-zɛɔƐƆ̃ŋŊ]", "u")));

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.?!,;:])", *LATIN_RUN), "gu").unwrap());

/// The Akan engine (`createAkan()`).
pub struct AkanPhonemizer;

impl AkanPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_akan(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        assemble_clauses(&normalize_akan(input), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                let num = js_number(&d);
                let emit_words = |sink: &mut crate::core::clauses::ClauseSink, n: f64| {
                    for w in number_words(n).split(' ') {
                        sink.emit(&phonemize_word(&js(w)));
                    }
                };
                if is_safe_integer(num) {
                    emit_words(sink, num);
                } else {
                    for c in d.code_point_strings() {
                        emit_words(sink, js_number(&c));
                    }
                }
            } else if let Some(p) = m.group(3, s)
                && let Some(mk) = DEF
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|v| !v.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for AkanPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(AkanPhonemizer::text(self, input))
    }
}

/// `createAkan()`: loads the tables and the tone lexicon, or says which failed.
pub fn create_akan() -> Result<AkanPhonemizer, String> {
    try_def()?;
    try_tone_lex()?;
    Ok(AkanPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/akan.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    // `getPhonemizer("ak").text` is `phonemize(text, "ak")` (index.ts).
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWordRules", &["kyerɛ"], Some("t͡ɕɪrɛ")),
    ("phonemizeWordRules", &["gyina"], Some("d͡ʑina")),
    ("phonemizeWordRules", &["ɔhyɛ"], Some("ɔɕɛ")),
    ("phonemizeWordRules", &["nyansa"], Some("ɲansa")),
    ("phonemizeWordRules", &["twi"], Some("t͡ɕʷi")),
    ("phonemizeWordRules", &["dwom"], Some("d͡ʑʷom")),
    ("phonemizeWordRules", &["kwan"], Some("kʷan")),
    ("phonemizeWordRules", &["hwɛ"], Some("ɕʷɛ")),
    ("phonemizeWordRules", &["akwaaba"], Some("akʷaaba")),
    ("phonemizeWordRules", &["boa"], Some("bwa")),
    ("phonemizeWordRules", &["mba"], Some("mma")),
    ("phonemizeWordRules", &["nkran"], Some("ŋkran")),
    ("phonemizeWordRules", &["bisa"], Some("bisa")),
    ("phonemizeWordRules", &["ɔkɔtɔ"], Some("ɔkɔtɔ")),
    ("phonemizeWordRules", &["obue"], Some("obwe")),
    ("phonemizeWord", &["papa"], Some("pa˩pa˥")),
    ("phonemizeWord", &["ɔkɔtɔ"], Some("ɔ˩kɔ˥tɔ˩")),
    ("phonemizeWord", &["huu"], Some("hu˥u˩")),
    ("phonemizeWord", &["mifi"], Some("mĩ˩fi˥")),
    ("phonemizeWordRules", &["papa"], Some("papa")),
    ("getPhonemizer(\"ak\").text", &["12"], Some("du mmienu")),
    ("getPhonemizer(\"ak\").text", &["100"], Some("ɔha")),
    ("getPhonemizer(\"ak\").text", &["4"], Some("nnan")),
    ("getPhonemizer(\"ak\").text", &["40"], Some("adwanan")),
    ("getPhonemizer(\"ak\").text", &["44"], Some("adwanan nnan")),
    ("getPhonemizer(\"ak\").text", &["21"], Some("adwonu baako")),
    ("getPhonemizer(\"ak\").text", &["555"], Some("ahanum adwonum nnum")),
    ("getPhonemizer(\"ak\").text", &["1000"], Some("apem")),
    ("getPhonemizer(\"ak\").text", &["2000"], Some("mpem mmienu")),
    ("getPhonemizer(\"ak\").text", &["1000000"], Some("ɔpɪpɪm")),
    ("getPhonemizer(\"ak\").text", &["1000000000"], Some("ɔpɪpɪpɪm")),
    ("getPhonemizer(\"ak\").text", &["Akwaaba, wo ho te sɛn?"], Some("akʷaaba , wo ho te sɛn ?")),
    ("getPhonemizer(\"ak\").text", &["ŋa"], Some("ŋa")),
    ("getPhonemizer(\"ak\").text", &["na"], Some("na")),
    ("getPhonemizer(\"ak\").text", &["aŋa"], Some("aŋa")),
    ("getPhonemizer(\"ak\").text", &["dwoŋ"], Some("d͡ʑʷoŋ")),
    ("getPhonemizer(\"ak\").text", &["Ŋa"], Some("ŋa")),
    ("getPhonemizer(\"ak\").text", &["ŋw"], Some("ŋw")),
    ("getPhonemizer(\"ak\").text", &["ŋg"], Some("ŋɡ")),
    ("getPhonemizer(\"ak\").text", &["ŋy"], Some("ŋj")),
    ("getPhonemizer(\"ak\").text", &["Ŋgozi"], Some("ŋɡozi")),
    ("getPhonemizer(\"ak\").text", &["np"], Some("mp")),
    ("getPhonemizer(\"ak\").text", &["ŋp"], Some("ŋp")),
    ("getPhonemizer(\"ak\").text", &["nw"], Some("ŋʷ")),
    ("getPhonemizer(\"ak\").text", &["ng"], Some("ŋ")),
    ("getPhonemizer(\"ak\").text", &["ny"], Some("ɲ")),
    ("normalizeAkan", &["n'awofoɔ"], Some("nawofoɔ")),
    ("normalizeAkan", &["w'ate"], Some("wate")),
    ("normalizeAkan", &["m'adwuma"], Some("madwuma")),
    ("getPhonemizer(\"ak\").text", &["n'adwuma"], Some("nad͡ʑʷuma")),
    ("normalizeAkan", &["People's Convention"], Some("People's Convention")),
    ("normalizeAkan", &["Women's Union"], Some("Women's Union")),
    ("normalizeAkan", &["Lincoln's Inn"], Some("Lincoln's Inn")),
    ("normalizeAkan", &["16,083"], Some("16083")),
    ("normalizeAkan", &["3 500 nnipa"], Some("3500 nnipa")),
    ("normalizeAkan", &["3.038.217"], Some("3038217")),
    ("normalizeAkan", &["0.206 km"], Some("0 akyiri pɔ 2 0 6 kilomita")),
    ("normalizeAkan", &["24,000, na"], Some("24000, na")),
    ("normalizeAkan", &["49.6%"], Some("ɔha mu nkyekyɛmu 49 akyiri pɔ 6")),
    ("normalizeAkan", &["10-15%"], Some("ɔha mu nkyekyɛmu 10 kosi 15")),
    ("normalizeAkan", &["40%-50%"], Some("ɔha mu nkyekyɛmu 40 kosi 50")),
    ("normalizeAkan", &["ɔha mu nkyekyɛmu 58.99%"], Some("ɔha mu nkyekyɛmu 58 akyiri pɔ 99")),
    ("normalizeAkan", &["ɔha mu nkyekyɛmu aduonu. Na 12%"], Some("ɔha mu nkyekyɛmu aduonu. Na ɔha mu nkyekyɛmu 12")),
    ("normalizeAkan", &["55.77"], Some("55 akyiri pɔ 77")),
    ("normalizeAkan", &["1.8"], Some("1 akyiri pɔ 8")),
    ("normalizeAkan", &["1.05"], Some("1 akyiri pɔ 0 5")),
    ("normalizeAkan", &["3.14159"], Some("3 akyiri pɔ 1 4 1 5 9")),
    ("normalizeAkan", &["12,5"], Some("12 akyiri pɔ 5")),
    ("getPhonemizer(\"ak\").text", &["0.53%"], Some("ɔha mu ŋt͡ɕɪt͡ɕɛmu ɕʷee at͡ɕiri pɔ adwonum mmiɛnsa")),
    ("normalizeAkan", &["1989-1997"], Some("1989 kosi 1997")),
    ("normalizeAkan", &["1961 – 25 Ɔbɛnem"], Some("1961 – 25 Ɔbɛnem")),
    ("normalizeAkan", &["ISBN 978-9988-1-2"], Some("ISBN 978-9988-1-2")),
    ("normalizeAkan", &["1964-1967."], Some("1964 kosi 1967.")),
    ("normalizeAkan", &["1964-1967, Belfast"], Some("1964 kosi 1967, Belfast")),
    ("normalizeAkan", &["1964-1967,5"], Some("1964-1967 akyiri pɔ 5")),
    ("normalizeAkan", &["10-15.5"], Some("10 kosi 15 akyiri pɔ 5")),
    ("normalizeAkan", &["12 km"], Some("12 kilomita")),
    ("normalizeAkan", &["62 m tenten"], Some("62 mita tenten")),
    ("normalizeAkan", &["173cm"], Some("173 sɛntimita")),
    ("normalizeAkan", &["5 kg"], Some("5 kilogram")),
    ("normalizeAkan", &["45 km²"], Some("45 kilomita ahinanan")),
    ("normalizeAkan", &["11.41 km2"], Some("11 akyiri pɔ 41 kilomita ahinanan")),
    ("normalizeAkan", &["45 km³"], Some("45 km³")),
    ("normalizeAkan", &["45 km3"], Some("45 km3")),
    ("normalizeAkan", &["973.78|km²"], Some("973 akyiri pɔ 78 kilomita ahinanan")),
    ("normalizeAkan", &["US$ 1m"], Some("dɔla 1m")),
    ("normalizeAkan", &["5.20m"], Some("5 akyiri pɔ 20 mita")),
    ("normalizeAkan", &["$10,000"], Some("dɔla 10000")),
    ("normalizeAkan", &["US$120"], Some("dɔla 120")),
    ("normalizeAkan", &["GH₵50"], Some("sidi 50")),
    ("getPhonemizer(\"ak\").text", &["GH₵50"], Some("sidi adwonum")),
    ("normalizeAkan", &["€126 million"], Some("€126 million")),
    ("normalizeAkan", &["U.S.A."], Some("USA.")),
    ("normalizeAkan", &["afe 3500 A.Y.B."], Some("afe 3500 AYB.")),
    ("normalizeAkan", &["500 Y.B."], Some("500 YB.")),
    ("getPhonemizer(\"ak\").text", &["U.S.A. Ɛyɛ"], Some("usa . ɛjɛ")),
    ("normalizeAkan", &["24th February"], Some("24 February")),
    ("normalizeAkan", &["3rd century"], Some("3 century")),
    ("normalizeAkan", &["S&P"], Some("S ne P")),
    ("normalizeAkan", &["-1.850"], Some("-1 akyiri pɔ 8 5 0")),
    ("normalizeAkan", &["37.2 °C"], Some("37 akyiri pɔ 2 °C")),
    ("normalizeAkan", &["12:30"], Some("12:30")),
    ("normalizeAkan", &["2/3"], Some("2/3")),
    ("normalizeAkan", &["2 + 2 = 4"], Some("2 + 2 = 4")),
    ("normalizeAkan", &["mu no. 2."], Some("mu no. 2.")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        create_akan().unwrap();
        let mut count = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => phonemize_word(&js(args[0])).to_string_lossy(),
                "phonemizeWordRules" => phonemize_word_rules(&js(args[0])).to_string_lossy(),
                "normalizeAkan" => normalize_akan(&js(args[0])).to_string_lossy(),
                "getPhonemizer(\"ak\").text" => crate::phonemize(args[0], "ak").unwrap(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            count += 1;
        }
        assert_eq!(count, 105);
    }

    /// A Tibetan run inside Akan is read by the `bo` engine in the TS. Until `bo` is ported the run is dropped and
    /// recorded as port-pending (the ak golden's one differing row); this flips when `bo` lands.
    #[test]
    fn a_tibetan_run_is_pending_on_bo_until_it_is_ported() {
        crate::phonemize("Butan (འབྲུག་) yɛ ɔman", "ak").unwrap();
        let pending = crate::registry::port_pending();
        assert_eq!(
            pending.iter().any(|p| p == "bo"),
            !crate::LANGUAGES.contains(&"bo"),
            "{pending:?}"
        );
    }
}

/// #1597, relational: mirrors test/wafrica-defects-1597.test.ts.
#[cfg(all(test, feature = "ak"))]
mod defects_1597_tests {
    fn count(out: &str, token: &str) -> usize {
        out.split(' ').filter(|t| *t == token).count()
    }
    fn say(s: &str, lang: &str) -> String {
        crate::phonemize(s, lang).unwrap()
    }

    #[test]
    fn a_digit_flanked_x_reads_as_times() {
        for (ascii, times) in [
            ("4x100", "4×100"),
            ("4 x 100", "4 × 100"),
            ("4X100", "4×100"),
            ("4x100m", "4×100m"),
        ] {
            assert_eq!(say(ascii, "ak"), say(times, "ak"), "{ascii}");
        }
        assert_ne!(say("x 100", "ak"), say("× 100", "ak"));
    }
}
