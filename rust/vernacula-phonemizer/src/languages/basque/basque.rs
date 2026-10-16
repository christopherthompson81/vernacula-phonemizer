//! Basque (eu) phonemizer: a greedy digraph + letter scan with the ⟨r⟩ tap/trill split, the vigesimal cardinals,
//! and text() over words, numbers and clause punctuation.
//! Ported from src/languages/basque/basque.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::{normalize_basque, try_symbols};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::provenance::{Form, normalize, renormalize};
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/basque";

#[derive(Debug, Deserialize)]
pub struct BasqueNumbers {
    pub ones: Vec<String>,
    pub scores: Vec<String>,
    pub hundreds: Vec<String>,
    pub thousand: String,
    pub million: String,
    pub and: String,
}

/// `BasqueDef`: declared in basque.ts itself, as here. Every field is REQUIRED.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BasqueDef {
    pub digraphs: Vec<(String, String)>,
    pub letters: IndexMap<String, String>,
    pub vowel_letters: Vec<String>,
    pub numbers: BasqueNumbers,
}

/// The manifest, or why it could not be loaded. Cached once loaded; a failure is retried on the next call.
pub fn try_def() -> Result<&'static BasqueDef, String> {
    static M: OnceLock<BasqueDef> = OnceLock::new();
    load_once(&M, || {
        load_manifest(DIR, "basque.jsonc").map_err(|e| e.to_string())
    })
}

/// ⚠ Reached only through a checked path (a `BasquePhonemizer`, whose constructor loads it).
static DEF: LazyLock<&'static BasqueDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

static VOWELS: LazyLock<HashSet<u32>> = LazyLock::new(|| {
    DEF.vowel_letters
        .iter()
        .filter_map(|v| {
            let mut cs = v.chars();
            match (cs.next(), cs.next()) {
                (Some(c), None) => Some(c as u32),
                _ => None,
            }
        })
        .collect()
});

fn cp_str(c: u32) -> String {
    char::from_u32(c).map(String::from).unwrap_or_default()
}

/// `phonemizeWord(word)`: NFC, lowercase, then one CODE POINT at a time.
pub fn phonemize_word(word: &JsString) -> JsString {
    let chars: Vec<u32> = normalize(word, Form::Nfc)
        .to_lower_case()
        .code_points()
        .collect();
    let mut out = JsString::new();
    let mut i = 0;
    while i < chars.len() {
        let c = chars[i];
        // `chars[i] === k[0] && chars[i + 1] === k[1]`: a key's first two code UNITS against two code points.
        let dg = DEF.digraphs.iter().find(|(k, _)| {
            let ku = js(k);
            ku.len() >= 2
                && u32::from(ku.0[0]) == c
                && chars.get(i + 1) == Some(&u32::from(ku.0[1]))
        });
        if let Some((_, ph)) = dg {
            out.push_str(&js(ph));
            i += 2;
            continue;
        }
        if c == 'h' as u32 {
            out.push_str(&js("h"));
            i += 1;
            continue;
        }
        if c == 'r' as u32 {
            let prev_v = i > 0 && VOWELS.contains(&chars[i - 1]);
            let next_v = i + 1 < chars.len() && VOWELS.contains(&chars[i + 1]);
            out.push_str(&js(if prev_v && next_v { "ɾ" } else { "r" }));
            i += 1;
            continue;
        }
        if let Some(ph) = DEF.letters.get(&cp_str(c)) {
            out.push_str(&js(ph));
        }
        i += 1;
    }
    out
}

/// `cardinalWords(n)`: the vigesimal cardinal, 0 ≤ n < 10¹².
pub fn cardinal_words(n: u64) -> String {
    let num = &DEF.numbers;
    if n < 20 {
        return num.ones[n as usize].clone();
    }
    if n < 100 {
        let (score, rem) = (n / 20, n % 20);
        return if rem == 0 {
            num.scores[score as usize].clone()
        } else {
            format!(
                "{}ta {}",
                num.scores[score as usize], num.ones[rem as usize]
            )
        };
    }
    if n < 1000 {
        let (h, rem) = (n / 100, n % 100);
        return if rem == 0 {
            num.hundreds[h as usize].clone()
        } else {
            format!(
                "{} {} {}",
                num.hundreds[h as usize],
                num.and,
                cardinal_words(rem)
            )
        };
    }
    let join = |head: String, rem: u64| {
        if rem == 0 {
            head
        } else if rem < 100 {
            format!("{head} {} {}", num.and, cardinal_words(rem))
        } else {
            format!("{head} {}", cardinal_words(rem))
        }
    };
    if n < 1_000_000 {
        let (th, rem) = (n / 1000, n % 1000);
        let head = if th == 1 {
            num.thousand.clone()
        } else {
            format!("{} {}", cardinal_words(th), num.thousand)
        };
        return join(head, rem);
    }
    if n < 1_000_000_000 {
        let (mil, rem) = (n / 1_000_000, n % 1_000_000);
        let head = if mil == 1 {
            format!("{} bat", num.million)
        } else {
            format!("{} {}", cardinal_words(mil), num.million)
        };
        return join(head, rem);
    }
    let (bil, rem) = (n / 1_000_000_000, n % 1_000_000_000);
    let head = if bil == 1 {
        format!("{} {}", num.thousand, num.million)
    } else {
        format!("{} {} {}", cardinal_words(bil), num.thousand, num.million)
    };
    join(head, rem)
}

/// `number(digits)`: the cardinal's words, each phonemized; out of range, each digit's word.
fn number(digits: &JsString) -> JsString {
    let n = js_number(digits);
    let words: Vec<JsString> = if !is_safe_integer(n) || n < 0.0 || n >= 1e12 {
        digits
            .code_point_strings()
            .iter()
            .map(|c| js(&cardinal_words(js_number(c) as u64)))
            .collect()
    } else {
        js(&cardinal_words(n as u64)).split(&js(" "))
    };
    let ipa: Vec<JsString> = words.iter().map(phonemize_word).collect();
    JsString::join(&ipa, &js(" "))
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.?!,;:…])", *LATIN_RUN), "gu").unwrap());

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: Basque's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser("[a-zñçA-ZÑÇ]", "u")));

/// The Basque engine (`createBasque`).
pub struct BasquePhonemizer;

/// The module functions, exposed through the engine: holding one proves the manifest and the symbol tier loaded.
impl BasquePhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_basque(text)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    pub fn cardinal_words(&self, n: u64) -> JsString {
        js(&cardinal_words(n))
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = normalize_basque(&renormalize(input, Form::Nfc));
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(n) = m.group(2, s) {
                sink.emit(&number(&n));
            } else if let Some(p) = m.group(3, s) {
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

impl Engine for BasquePhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(BasquePhonemizer::text(self, input))
    }
}

/// `createBasque()`: loads the manifest and the symbol tier, or says which failed.
pub fn create_basque() -> Result<BasquePhonemizer, String> {
    try_def()?;
    try_symbols()?;
    Ok(BasquePhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/basque.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["zu"], Some("s̻u")),
        ("phonemizeWord", &["su"], Some("s̺u")),
        ("phonemizeWord", &["xede"], Some("ʃede")),
        ("phonemizeWord", &["gizon"], Some("ɡis̻on")),
        ("phonemizeWord", &["atzo"], Some("at͡s̻o")),
        ("phonemizeWord", &["hots"], Some("hot͡s̺")),
        ("phonemizeWord", &["etxe"], Some("et͡ʃe")),
        ("phonemizeWord", &["hotz"], Some("hot͡s̻")),
        ("phonemizeWord", &["udare"], Some("udaɾe")),
        ("phonemizeWord", &["hartu"], Some("hartu")),
        ("phonemizeWord", &["herri"], Some("heri")),
        ("phonemizeWord", &["lur"], Some("lur")),
        ("phonemizeWord", &["onddo"], Some("onɟo")),
        ("phonemizeWord", &["jan"], Some("xan")),
        ("phonemizeWord", &["euskara"], Some("eus̺kaɾa")),
        ("createBasque().text", &["20"], Some("hoɡei")),
        ("createBasque().text", &["30"], Some("hoɡeita hamar")),
        ("createBasque().text", &["40"], Some("beroɡei")),
        ("createBasque().text", &["60"], Some("hiɾuɾoɡei")),
        ("createBasque().text", &["80"], Some("lauɾoɡei")),
        ("createBasque().text", &["99"], Some("lauɾoɡeita hemeɾet͡s̻i")),
        ("createBasque().text", &["101"], Some("ehun eta bat")),
        (
            "createBasque().text",
            &["234"],
            Some("berehun eta hoɡeita hamalau"),
        ),
        (
            "createBasque().text",
            &["2025"],
            Some("bi mila eta hoɡeita bos̺t"),
        ),
        ("createBasque().text", &["7"], Some("s̻as̻pi")),
        (
            "createBasque().text",
            &["12345"],
            Some("hamabi mila hiɾuɾehun eta beroɡeita bos̺t"),
        ),
        ("createBasque().text", &["100000"], Some("ehun mila")),
        ("createBasque().text", &["1000000"], Some("milioi bat")),
        ("createBasque().text", &["2000000"], Some("bi milioi")),
        ("createBasque().text", &["1000000000"], Some("mila milioi")),
        (
            "createBasque().text",
            &["2000000000"],
            Some("bi mila milioi"),
        ),
        ("normalizeBasque", &["42.262.142"], Some("42262142")),
        ("normalizeBasque", &["1.000"], Some("1000")),
        ("normalizeBasque", &["Am 2.18.19-26"], Some("Am 2.18.19-26")),
        ("normalizeBasque", &["41.000 urteko"], Some("41000 urteko")),
        (
            "phonemize",
            &["93,55", "eu"],
            Some("lauɾoɡeita hamahiɾu koma beroɡeita hamabos̺t"),
        ),
        ("normalizeBasque", &["93,55."], Some("93 koma 55.")),
        (
            "phonemize",
            &["% 32,1", "eu"],
            Some("ehuneko hoɡeita hamabi koma bat"),
        ),
        ("phonemize", &["%7a", "eu"], Some("ehuneko s̻as̻pia")),
        ("phonemize", &["5 km", "eu"], Some("bos̺t kilometro")),
        (
            "normalizeBasque",
            &["42.262.142 km²"],
            Some("42262142 kilometro karratu"),
        ),
        ("normalizeBasque", &["5 km³"], Some("5 kilometro kubiko")),
        (
            "phonemize",
            &["120 km/h", "eu"],
            Some("ehun eta hoɡei kilometro orduko"),
        ),
        (
            "phonemize",
            &["56,7 ° C", "eu"],
            Some("beroɡeita hamas̺ei koma s̻as̻pi ɡradu kels̺ius̺"),
        ),
        ("normalizeBasque", &["26 °F"], Some("26 gradu Fahrenheit")),
        (
            "normalizeBasque",
            &["23,4° ingurukoa"],
            Some("23 koma 4 gradu ingurukoa"),
        ),
        (
            "phonemize",
            &["1980an", "eu"],
            Some("mila bedeɾat͡s̻iehun eta lauɾoɡeian"),
        ),
        (
            "phonemize",
            &["1980ko", "eu"],
            Some("mila bedeɾat͡s̻iehun eta lauɾoɡeiko"),
        ),
        ("phonemize", &["25ean", "eu"], Some("hoɡeita bos̺tean")),
        ("normalizeBasque", &["% 80ko"], Some("ehuneko laurogeiko")),
        (
            "phonemize",
            &["% 93,55a", "eu"],
            Some("ehuneko lauɾoɡeita hamahiɾu koma beroɡeita hamabos̺ta"),
        ),
        ("normalizeBasque", &["2x3"], Some("2x3")),
        (
            "normalizeBasque",
            &["44.579.000 km²ko eremua"],
            Some("44579000 kilometro karratuko eremua"),
        ),
        (
            "normalizeBasque",
            &["40 091 km-koa"],
            Some("40091 kilometrokoa"),
        ),
        ("normalizeBasque", &["kg-ko"], Some("kilogramoko")),
        ("normalizeBasque", &["man"], Some("man")),
        (
            "normalizeBasque",
            &["gizonak eta emakumeak"],
            Some("gizonak eta emakumeak"),
        ),
        (
            "normalizeBasque",
            &["44 milioi km²"],
            Some("44 milioi kilometro karratu"),
        ),
        (
            "normalizeBasque",
            &["399 milioi km-koa"],
            Some("399 milioi kilometrokoa"),
        ),
        (
            "normalizeBasque",
            &["(141 bizt./km²)"],
            Some("(141 bizt./km²)"),
        ),
        (
            "phonemize",
            &["5,09", "eu"],
            Some("bos̺t koma s̻eɾo bedeɾat͡s̻i"),
        ),
        ("phonemize", &["5,9", "eu"], Some("bos̺t koma bedeɾat͡s̻i")),
        ("normalizeBasque", &["5,09"], Some("5 koma zero 9")),
        ("normalizeBasque", &["5,9"], Some("5 koma 9")),
        ("normalizeBasque", &["0,08"], Some("0 koma zero 8")),
        (
            "normalizeBasque",
            &["5,09eko"],
            Some("bost koma zero bederatzieko"),
        ),
        (
            "normalizeBasque",
            &["0,4º C"],
            Some("0 koma 4 gradu Celsius"),
        ),
        (
            "normalizeBasque",
            &["0,1-0,5º"],
            Some("0 koma 1-0 koma 5 gradu"),
        ),
        (
            "normalizeBasque",
            &["30º-ko latitudearen"],
            Some("30 graduko latitudearen"),
        ),
        (
            "normalizeBasque",
            &["5 km/h-ko"],
            Some("5 kilometro orduko"),
        ),
        (
            "normalizeBasque",
            &["120 km/h-koa"],
            Some("120 kilometro ordukoa"),
        ),
        (
            "normalizeBasque",
            &["300 km/s-ko"],
            Some("300 kilometro segundoko"),
        ),
        (
            "normalizeBasque",
            &["120 km/h"],
            Some("120 kilometro orduko"),
        ),
        ("normalizeBasque", &["26-en"], Some("hogeita seien")),
        ("normalizeBasque", &["995-ko"], Some("995-ko")),
        ("normalizeBasque", &["km-koa"], Some("kilometrokoa")),
        (
            "normalizeBasque",
            &["3,14159265358979a"],
            Some("3,14159265358979a"),
        ),
        (
            "createBasque().text",
            &["-66 °C"],
            Some("minus̺ hiɾuɾoɡeita s̺ei ɡradu kels̺ius̺"),
        ),
        (
            "createBasque().text",
            &["magnitudea -2,8 da"],
            Some("maɡnitudea minus̺ bi koma s̻ort͡s̻i da"),
        ),
        (
            "createBasque().text",
            &["2.000 – 1.000"],
            Some("bi mila mila"),
        ),
        (
            "createBasque().text",
            &["21. - 29. liburuak"],
            Some("hoɡeita bat . hoɡeita bedeɾat͡s̻i . libuɾuak"),
        ),
        (
            "createBasque().text",
            &["ugaria –700 inguru– mota"],
            Some("uɡaɾia s̻as̻piehun inɡuɾu mota"),
        ),
        (
            "createBasque().text",
            &["995-ko"],
            Some("bedeɾat͡s̻iehun eta lauɾoɡeita hamabos̺t ko"),
        ),
        (
            "createBasque().text",
            &["Bilbo - 400.000 biztanle"],
            Some("bilbo lauɾehun mila bis̻tanle"),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_basque().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeBasque" => Some(e.normalize(&a(0))),
                "createBasque().text" => Some(e.text(&a(0))),
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
