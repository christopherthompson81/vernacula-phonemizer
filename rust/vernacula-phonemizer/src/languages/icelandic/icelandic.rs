//! Icelandic (is) phonemizer: a greedy longest-match scan (vowel digraphs, the sonorant and epenthetic-stop
//! clusters, geminate stops, ⟨k g⟩ palatalisation, the context-dependent ⟨nn⟩), then the velar nasal,
//! ⟨g⟩ spirantisation, preaspiration, the ⟨í⟩ hiatus glide and ⟨f⟩ realisation, with initial stress; text()
//! over Latin words (a foreign name nativised), numbers and clause punctuation.
//! Ported from src/languages/icelandic/icelandic.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use indexmap::IndexMap;
use serde::Deserialize;

use super::manifest::{MANIFEST, try_manifest};
use super::normalize::normalize_icelandic;
use super::numbers::{number_to_words, try_numbers};
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrdinalForms {
    pub masc: String,
    pub common: String,
    pub fem_oblique: String,
}

/// `IcelandicDef` (icelandic.jsonc). Every field the TS interface names is required; the `numbers` block is
/// numbers.rs's own slice, and `language`/`name`/`script` are documentation the TS does not read.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IcelandicDef {
    pub digraphs: IndexMap<String, String>,
    pub graphemes: IndexMap<String, String>,
    pub front_vowels: Vec<String>,
    pub hiatus_glide_vowels: Vec<String>,
    pub long_nuclei: Vec<String>,
    pub collapsing_doubles: Vec<String>,
    pub clause_punctuation: IndexMap<String, String>,
    pub ordinals: IndexMap<String, OrdinalForms>,
}

/// The lookup tables, as code-unit strings.
struct Tables {
    /// `ORDER`: the digraph keys stably sorted longest first, with their values.
    order: Vec<(JsString, JsString)>,
    /// `G[c]` for one code unit.
    g: IndexMap<u16, JsString>,
    front_v: Vec<JsString>,
    hiatus_glide: Vec<JsString>,
    long_nucleus: Vec<JsString>,
    other_double: Vec<u16>,
}

static T: LazyLock<Tables> = LazyLock::new(|| {
    let d = &*MANIFEST;
    let mut order: Vec<(JsString, JsString)> =
        d.digraphs.iter().map(|(k, v)| (js(k), js(v))).collect();
    order.sort_by_key(|k| std::cmp::Reverse(k.0.len()));
    let g = d
        .graphemes
        .iter()
        .filter_map(|(k, v)| {
            let k = js(k);
            (k.len() == 1).then(|| (k.0[0], js(v)))
        })
        .collect();
    let list = |v: &[String]| v.iter().map(|s| js(s)).collect::<Vec<_>>();
    Tables {
        order,
        g,
        front_v: list(&d.front_vowels),
        hiatus_glide: list(&d.hiatus_glide_vowels),
        long_nucleus: list(&d.long_nuclei),
        other_double: d
            .collapsing_doubles
            .iter()
            .filter_map(|s| {
                let s = js(s);
                (s.len() == 1).then(|| s.0[0])
            })
            .collect(),
    }
});

/// `VOWEL_PH`: IPA vowel heads (without ⟨e⟩ — see the TS).
const VOWEL_PH: &str = "aɛɪiɔouʏœøy";
/// `NUCLEUS_CH`: `VOWEL_PH` plus ⟨e⟩.
const NUCLEUS_CH: &str = "aɛɪiɔouʏœøye";
const FRONT_PH: &str = "ɛɪijy";
const VOICELESS_PH: &str = "ptksθfhc";

fn in_set(set: &str, c: Option<char>) -> bool {
    c.is_some_and(|c| set.contains(c))
}

/// `[...ph][0]` and `a[a.length - 1]` as chars (every phone is BMP text from the manifest or a literal).
fn first_ch(ph: &JsString) -> Option<char> {
    ph.to_string_lossy().chars().next()
}
fn last_ch(ph: &JsString) -> Option<char> {
    ph.to_string_lossy().chars().next_back()
}

fn starts_with_vowel(ph: &JsString) -> bool {
    in_set(VOWEL_PH, first_ch(ph))
}
fn ends_with_vowel(ph: &JsString) -> bool {
    in_set(VOWEL_PH, last_ch(ph))
}

#[derive(Clone, Debug, Default)]
struct Tok {
    ph: JsString,
    g_var: bool,
    hiatus_glide: bool,
    fortis: bool,
}

fn tok(ph: JsString) -> Tok {
    Tok {
        ph,
        ..Default::default()
    }
}

/// `scan(word)`.
fn scan(word: &JsString) -> Vec<Tok> {
    let t = &*T;
    let w = normalize(word, Form::Nfc).to_lower_case();
    let u = &w.0;
    let unit = |i: isize| -> JsString {
        if i < 0 || i as usize >= u.len() {
            JsString::new()
        } else {
            JsString::from_units(&[u[i as usize]])
        }
    };
    let (ch_n, ch_k, ch_g, ch_b, ch_d) = (
        u16::from(b'n'),
        u16::from(b'k'),
        u16::from(b'g'),
        u16::from(b'b'),
        u16::from(b'd'),
    );
    let is_stop = |c: u16| c == u16::from(b'p') || c == u16::from(b't') || c == ch_k;
    let mut toks: Vec<Tok> = Vec::new();
    let mut i = 0usize;
    'outer: while i < u.len() {
        let c = u[i];
        let next = unit(i as isize + 1);
        let next_is = |x: u16| next.0 == [x];
        if c == ch_n && next_is(ch_n) {
            let prev2 = w.slice(i.saturating_sub(2) as isize, Some(i as isize));
            let after_long = t.long_nucleus.contains(&unit(i as isize - 1))
                || prev2 == js("au")
                || prev2 == js("ei")
                || prev2 == js("ey");
            toks.push(tok(js(if after_long { "tn" } else { "n" })));
            i += 2;
            continue;
        }
        let prev_vowel = toks.last().is_some_and(|p| ends_with_vowel(&p.ph));
        if next_is(c) && (is_stop(c) || c == ch_b || c == ch_d || c == ch_g) {
            let fortis = is_stop(c);
            let after_pair = unit(i as isize + 2);
            let mut consumed = 2;
            let mut ph = t.g[&c].clone();
            if (c == ch_k || c == ch_g) && t.front_v.contains(&after_pair) {
                ph = js("c");
                if after_pair == js("j") {
                    consumed = 3;
                }
            }
            if fortis {
                toks.push(tok(js("h")));
            }
            toks.push(Tok {
                ph,
                fortis,
                ..Default::default()
            });
            i += consumed;
            continue;
        }
        if next_is(c) && t.other_double.contains(&c) {
            toks.push(tok(t.g[&c].clone()));
            i += 2;
            continue;
        }
        for (key, val) in &t.order {
            if u[i..].starts_with(&key.0) {
                toks.push(tok(val.clone()));
                i += key.len();
                continue 'outer;
            }
        }
        if (c == ch_k || c == ch_g) && t.front_v.contains(&next) {
            toks.push(Tok {
                ph: js(if c == ch_g && prev_vowel { "j" } else { "c" }),
                fortis: c == ch_k,
                ..Default::default()
            });
            i += if next == js("j") { 2 } else { 1 };
            continue;
        }
        if let Some(ph) = t.g.get(&c) {
            toks.push(Tok {
                ph: ph.clone(),
                g_var: c == ch_g,
                hiatus_glide: t.hiatus_glide.contains(&JsString::from_units(&[c])),
                fortis: is_stop(c),
            });
        }
        i += 1;
    }
    toks
}

/// `spirantizeG(toks)`.
fn spirantize_g(toks: &mut [Tok]) {
    for i in 0..toks.len() {
        if toks[i].ph != js("k") {
            continue;
        }
        let next = toks.get(i + 1).map(|t| t.ph.clone());
        if next
            .as_ref()
            .is_some_and(|n| *n == js("t") || *n == js("s"))
        {
            toks[i].ph = js("x");
            continue;
        }
        if !toks[i].g_var || i == 0 || !ends_with_vowel(&toks[i - 1].ph) {
            continue;
        }
        match &next {
            None => toks[i].ph = js("ɣ"),
            Some(n) if !in_set(VOICELESS_PH, first_ch(n)) => {
                toks[i].ph = js(if in_set(FRONT_PH, first_ch(n)) {
                    "j"
                } else {
                    "ɣ"
                });
            }
            _ => {}
        }
    }
}

/// `PRENASAL_V`. (`prev.ph in PRENASAL_V` also sees `Object.prototype`'s names, which no phone is.)
const PRENASAL_V: [(&str, &str); 6] = [
    ("a", "au"),
    ("ɛ", "ei"),
    ("ɔ", "ou"),
    ("œ", "øy"),
    ("ɪ", "i"),
    ("ʏ", "u"),
];

/// `velarNasal(toks)`.
fn velar_nasal(toks: &mut [Tok]) {
    for i in 0..toks.len().saturating_sub(1) {
        if toks[i].ph == js("n") && (toks[i + 1].ph == js("k") || toks[i + 1].ph == js("c")) {
            toks[i].ph = js("ŋ");
            if i > 0
                && let Some((_, d)) = PRENASAL_V.iter().find(|(k, _)| toks[i - 1].ph == js(k))
            {
                toks[i - 1].ph = js(d);
            }
        }
    }
}

/// `preaspirate(toks)`: right to left, an [h] inserted before a lone fortis stop before a sonorant.
fn preaspirate(toks: &mut Vec<Tok>) {
    if toks.len() < 2 {
        return;
    }
    for i in (0..toks.len() - 1).rev() {
        let nph = toks[i + 1].ph.to_string_lossy();
        let already_pre = i > 0 && toks[i - 1].ph == js("h");
        if toks[i].fortis && !already_pre && matches!(nph.as_str(), "l" | "m" | "n" | "tl" | "tn") {
            toks.insert(i, tok(js("h")));
        }
    }
}

/// `glideJ(toks)`: right to left, a [j] after an ⟨í⟩ before a vowel.
fn glide_j(toks: &mut Vec<Tok>) {
    if toks.len() < 2 {
        return;
    }
    for i in (0..toks.len() - 1).rev() {
        if toks[i].hiatus_glide && starts_with_vowel(&toks[i + 1].ph) {
            toks.insert(i + 1, tok(js("j")));
        }
    }
}

/// `realizeF(toks)`.
fn realize_f(toks: &mut [Tok]) {
    for i in 0..toks.len() {
        if toks[i].ph != js("f") {
            continue;
        }
        let next = toks.get(i + 1).map(|t| t.ph.clone());
        if next
            .as_ref()
            .is_some_and(|n| *n == js("n") || *n == js("m"))
        {
            toks[i].ph = js("p");
        } else if i > 0
            && next
                .as_ref()
                .is_none_or(|n| !in_set(VOICELESS_PH, first_ch(n)))
        {
            toks[i].ph = js("v");
        }
    }
}

/// `stressInitial(ipa)`: ˈ before the first nucleus code point, none without one.
fn stress_initial(ipa: &JsString) -> JsString {
    let cps = ipa.code_point_strings();
    let nucleus = |c: &JsString| c.len() == 1 && in_set(NUCLEUS_CH, first_ch(c));
    match cps.iter().position(nucleus) {
        None => ipa.clone(),
        Some(i) => JsString::join(&cps[..i], &JsString::new())
            .concat(&js("ˈ"))
            .concat(&JsString::join(&cps[i..], &JsString::new())),
    }
}

/// `phonemizeWord(word)`.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    let mut toks = scan(word);
    velar_nasal(&mut toks);
    spirantize_g(&mut toks);
    preaspirate(&mut toks);
    glide_j(&mut toks);
    realize_f(&mut toks);
    let mut joined = JsString::new();
    for t in &toks {
        joined.push_str(&t.ph);
    }
    stress_initial(&joined)
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let run = host_word_run(&["Latin"], "'-", "").unwrap();
    JsRegex::new(&format!(r"({run})|(\d+)|([.!?…,;:])"), "gu").unwrap()
});

const NATIVE_CLASS: &str = "[a-záéíóúýþðæöA-ZÁÉÍÓÚÝÞÐÆÖ'-]";

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "u")));

/// The Icelandic engine (`createIcelandic`).
pub struct IcelandicPhonemizer;

/// The module functions, exposed through the engine: holding an `IcelandicPhonemizer` proves the manifest
/// loaded. (The per-module differentials call them.)
impl IcelandicPhonemizer {
    /// `normalizeIcelandic(text)`.
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_icelandic(text)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    /// `numberToWords(n, raw)` (numbers.ts).
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let m = &*MANIFEST;
        assemble_clauses(&normalize_icelandic(input), &TOKEN, |mm, s, sink| {
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

impl Engine for IcelandicPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(IcelandicPhonemizer::text(self, input))
    }
}

/// `createIcelandic()`. Errors when the manifest cannot be loaded.
pub fn create_icelandic() -> Result<IcelandicPhonemizer, String> {
    try_manifest()?;
    try_numbers()?;
    Ok(IcelandicPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/icelandic.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["hús"], Some("hˈus")),
        ("phonemizeWord", &["sól"], Some("sˈoul")),
        ("phonemizeWord", &["læra"], Some("lˈaira")),
        ("phonemizeWord", &["þú"], Some("θˈu")),
        ("phonemizeWord", &["ís"], Some("ˈis")),
        ("phonemizeWord", &["bók"], Some("pˈouk")),
        ("phonemizeWord", &["taka"], Some("tˈaka")),
        ("phonemizeWord", &["dagur"], Some("tˈaɣʏr")),
        ("phonemizeWord", &["góður"], Some("kˈouðʏr")),
        ("phonemizeWord", &["gelda"], Some("cˈɛlta")),
        ("phonemizeWord", &["Bylgja"], Some("pˈɪlca")),
        ("phonemizeWord", &["fjall"], Some("fjˈatl")),
        ("phonemizeWord", &["karl"], Some("kˈartl")),
        ("phonemizeWord", &["Steinn"], Some("stˈeitn")),
        ("phonemizeWord", &["Hrafn"], Some("rˈapn")),
        ("phonemizeWord", &["hjörtur"], Some("çˈœrtʏr")),
        ("phonemizeWord", &["Frakki"], Some("frˈahcɪ")),
        ("phonemizeWord", &["Hekla"], Some("hˈɛhkla")),
        ("phonemizeWord", &["bang"], Some("pˈauŋk")),
        ("phonemizeWord", &["gengur"], Some("cˈeiŋkʏr")),
        ("phonemizeWord", &["Alþingi"], Some("ˈalθiŋcɪ")),
        ("phonemizeWord", &["lag"], Some("lˈaɣ")),
        ("phonemizeWord", &["Sigmar"], Some("sˈɪɣmar")),
        ("phonemizeWord", &["lukt"], Some("lˈʏxt")),
        ("phonemizeWord", &["drukkna"], Some("trˈʏhkna")),
        (
            "createIcelandic().text",
            &["Ég tala íslensku."],
            Some("jˈɛɣ tˈala ˈislɛnskʏ ."),
        ),
        ("numberToWords", &["0"], Some("núll")),
        ("numberToWords", &["7"], Some("sjö")),
        ("numberToWords", &["2"], Some("tveir")),
        ("numberToWords", &["21"], Some("tuttugu og einn")),
        ("numberToWords", &["45"], Some("fjörutíu og fimm")),
        ("numberToWords", &["99"], Some("níutíu og níu")),
        ("numberToWords", &["100"], Some("eitt hundrað")),
        ("numberToWords", &["101"], Some("eitt hundrað og einn")),
        (
            "numberToWords",
            &["121"],
            Some("eitt hundrað tuttugu og einn"),
        ),
        ("numberToWords", &["200"], Some("tvö hundruð")),
        (
            "numberToWords",
            &["555"],
            Some("fimm hundruð fimmtíu og fimm"),
        ),
        ("numberToWords", &["1000"], Some("eitt þúsund")),
        ("numberToWords", &["1001"], Some("eitt þúsund og einn")),
        (
            "numberToWords",
            &["12345"],
            Some("tólf þúsund þrjú hundruð fjörutíu og fimm"),
        ),
        ("numberToWords", &["1000000"], Some("ein milljón")),
        ("numberToWords", &["2000000"], Some("tvær milljónir")),
        ("numberToWords", &["1000000000"], Some("einn milljarður")),
        ("numberToWords", &["2000000000"], Some("tveir milljarðar")),
        (
            "createIcelandic().text",
            &["21"],
            Some("tˈʏhtʏɣʏ ˈɔɣ ˈeitn"),
        ),
        (
            "createIcelandic().text",
            &["1000000"],
            Some("ˈein mˈɪtljoun"),
        ),
        ("phonemizeWord", &["Biblía"], Some("pˈɪplija")),
        ("phonemizeWord", &["erkiengill"], Some("ˈɛrcɪeiŋcɪtl")),
        ("phonemizeWord", &["þríeyki"], Some("θrˈieicɪ")),
        ("phonemizeWord", &["hýena"], Some("hˈiɛna")),
        ("phonemizeWord", &["beitieski"], Some("pˈeitɪɛscɪ")),
        ("phonemizeWord", &["blýantur"], Some("plˈiantʏr")),
        ("phonemizeWord", &["Albanía"], Some("ˈalpanija")),
        ("phonemizeWord", &["Alaska"], Some("ˈalaska")),
        ("phonemizeWord", &["strjáll"], Some("strjˈautl")),
        ("phonemizeWord", &["ég"], Some("jˈɛɣ")),
        ("phonemizeWord", &["þ"], Some("θ")),
        ("normalizeIcelandic", &["3. maí"], Some("þriðji maí")),
        ("normalizeIcelandic", &["18. öld"], Some("átjánda öld")),
        ("normalizeIcelandic", &["18. aldar"], Some("átjándu aldar")),
        ("normalizeIcelandic", &["9. sæti"], Some("níunda sæti")),
        ("normalizeIcelandic", &["1. dag"], Some("fyrsta dag")),
        (
            "normalizeIcelandic",
            &["Árið 1990. Hann kom"],
            Some("Árið 1990. Hann kom"),
        ),
        ("normalizeIcelandic", &["1.234"], Some("1234")),
        ("normalizeIcelandic", &["12,5"], Some("12 komma 5")),
        ("normalizeIcelandic", &["11:00"], Some("11 núll núll")),
        ("normalizeIcelandic", &["25 %"], Some("25 prósent")),
        ("normalizeIcelandic", &["5 km"], Some("5 kílómetrar")),
        ("normalizeIcelandic", &["km²"], Some("ferkílómetrar")),
        ("normalizeIcelandic", &["1990-1995"], Some("1990 til 1995")),
        (
            "normalizeIcelandic",
            &["Íslenska er tungumál."],
            Some("Íslenska er tungumál."),
        ),
        ("createIcelandic().text", &["5 m³"], Some("fˈɪm rˈumɛtrar")),
        (
            "createIcelandic().text",
            &["5 km³"],
            Some("fˈɪm rˈumciloumɛtrar"),
        ),
        (
            "createIcelandic().text",
            &["802.11m"],
            Some("ˈauhta hˈʏntrʏð ˈɔɣ tvˈeir . ˈɛtlɛvʏ m"),
        ),
        (
            "createIcelandic().text",
            &["83 km/klst."],
            Some("ˈauhtatijʏ ˈɔɣ θrˈir cˈiloumɛtrar ˈau hklˈʏhkʏstʏnt"),
        ),
        (
            "createIcelandic().text",
            &["120 km/h"],
            Some("ˈeiht hˈʏntrað ˈɔɣ tˈʏhtʏɣʏ cˈiloumɛtrar ˈau hklˈʏhkʏstʏnt"),
        ),
        (
            "createIcelandic().text",
            &["133 m/s"],
            Some("ˈeiht hˈʏntrað θrjˈautijʏ ˈɔɣ θrˈir m s"),
        ),
        (
            "normalizeIcelandic",
            &["handlegginn o.s.frv."],
            Some("handlegginn og svo framvegis"),
        ),
        (
            "normalizeIcelandic",
            &["(James o.fl., 1995)"],
            Some("(James og fleira, 1995)"),
        ),
        (
            "normalizeIcelandic",
            &["o.s.frv. og fleira"],
            Some("og svo framvegis og fleira"),
        ),
        (
            "normalizeIcelandic",
            &["ofl og osfrv"],
            Some("ofl og osfrv"),
        ),
        (
            "normalizeIcelandic",
            &["300 mph"],
            Some("300 mílur á klukkustund"),
        ),
        (
            "normalizeIcelandic",
            &["40 mph (64 km/klst)"],
            Some("40 mílur á klukkustund (64 kílómetrar á klukkustund)"),
        ),
        (
            "createIcelandic().text",
            &["300 mph"],
            Some("θrjˈu hˈʏntrʏð mˈilʏr ˈau hklˈʏhkʏstʏnt"),
        ),
        // #1574 (synthetic probes; values from the TS engine)
        ("normalizeIcelandic", &["123:45 var"], Some("123:45 var")),
        (
            "normalizeIcelandic",
            &["klukkan 9:05"],
            Some("klukkan 9 núll 5"),
        ),
        (
            "normalizeIcelandic",
            &["klukkan 10:00"],
            Some("klukkan 10 núll núll"),
        ),
        (
            "normalizeIcelandic",
            &["klukkan 9:30"],
            Some("klukkan 9 30"),
        ),
        (
            "normalizeIcelandic",
            &["Um 100,000 manns"],
            Some("Um 100000 manns"),
        ),
        (
            "normalizeIcelandic",
            &["Um 5,000,000 manns"],
            Some("Um 5000000 manns"),
        ),
        (
            "normalizeIcelandic",
            &["Um 100,000, sagði hann"],
            Some("Um 100000, sagði hann"),
        ),
        ("normalizeIcelandic", &["0,500"], Some("0 komma 5 0 0")),
        ("normalizeIcelandic", &["1,2345"], Some("1 komma 2 3 4 5")),
        (
            "normalizeIcelandic",
            &["Leikurinn fór 3-2"],
            Some("Leikurinn fór 3-2"),
        ),
        (
            "normalizeIcelandic",
            &["jafntefli 2-2"],
            Some("jafntefli 2-2"),
        ),
        (
            "normalizeIcelandic",
            &["árin 1990-1995"],
            Some("árin 1990 til 1995"),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_icelandic().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeIcelandic" => Some(e.normalize(&a(0))),
                "numberToWords" => Some(e.number_to_words(js_number(&a(0)), None)),
                "createIcelandic().text" => Some(e.text(&a(0))),
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
