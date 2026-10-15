//! Wolof (wo) phonemizer: a code-unit scan with consonant gemination, ⟨n⟩ → ŋ before a velar, and a longest-match
//! grapheme table (a missed letter read through the shared Latin phones), and text() over the normalizer.
//! Ported from src/languages/wolof/wolof.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{GRAPHEME_KEYS, MANIFEST, try_manifest};
use super::normalize::{normalize_wolof, try_symbols};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::registry::{Engine, PhonemizeError};

/// `phonemizeWord(word)`: gemination, nasal assimilation, then the longest grapheme at each code unit.
pub fn phonemize_word(word: &JsString) -> JsString {
    let g = &MANIFEST.graphemes;
    let w = word.to_lower_case();
    let mut out = JsString::new();
    let mut i = 0;
    while i < w.len() {
        let c = w.char_at(i);
        let cs = c.to_string_lossy();
        let is_vowel_letter = MANIFEST.vowel_letters.iter().any(|v| c == js(v));
        if !is_vowel_letter
            && w.char_at(i + 1) == c
            && let Some(p) = g.get(&cs).filter(|p| !p.is_empty())
        {
            out.push_str(&js(p));
            out.push_str(&js("ː"));
            i += 2;
            continue;
        }
        if cs == "n" && (w.char_at(i + 1) == "g" || w.char_at(i + 1) == "k") {
            out.push_str(&js("ŋ"));
            i += 1;
            continue;
        }
        if let Some((key, ipa)) = GRAPHEME_KEYS
            .iter()
            .find(|(k, _)| w.0[i..].starts_with(&k.0))
        {
            out.push_str(ipa);
            i += key.len();
        } else {
            let opts = PhoneOpts {
                initial: i == 0,
                include_h: false,
            };
            if let Some(p) = latin_phone(&c, opts) {
                out.push_str(&p);
            }
            i += 1;
        }
    }
    out
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.!?…,;:])", *LATIN_RUN), "giu").unwrap());

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: Wolof's own inventory; a token outside it is a foreign name and is folded.
pub static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[a-zàéëóñŋ]", "iu")));

/// The Wolof engine (`createWolof()`).
pub struct WolofPhonemizer;

impl WolofPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_wolof(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        try_symbols().expect("checked by create_wolof").apply(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        assemble_clauses(&normalize_wolof(input), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                for wd in number_to_words(js_number(&d), Some(&d)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = m.group(3, s)
                && let Some(mk) = MANIFEST
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|v| !v.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for WolofPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(WolofPhonemizer::text(self, input))
    }
}

/// `createWolof()`: loads the manifest and the symbol tier, or says which failed.
pub fn create_wolof() -> Result<WolofPhonemizer, String> {
    try_manifest()?;
    try_symbols()?;
    Ok(WolofPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::super::numbers::number_to_words;
    use super::*;

    // Every call test/wolof.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["cere"], Some("cɛrɛ")),
    ("phonemizeWord", &["jigéen"], Some("ɟiɡeːn")),
    ("phonemizeWord", &["gox"], Some("ɡɔx")),
    ("phonemizeWord", &["góor"], Some("ɡoːr")),
    ("phonemizeWord", &["kër"], Some("kər")),
    ("phonemizeWord", &["baaxoñ"], Some("baːxɔɲ")),
    ("phonemizeWord", &["ndox"], Some("ndɔx")),
    ("phonemizeWord", &["ñuul"], Some("ɲuːl")),
    ("phonemizeWord", &["benn"], Some("bɛnː")),
    ("phonemizeWord", &["làkk"], Some("laːkː")),
    ("phonemizeWord", &["dëjj"], Some("dəɟː")),
    ("phonemizeWord", &["Angale"], Some("aŋɡalɛ")),
    ("phonemizeWord", &["weex"], Some("wɛːx")),
    ("numberToWords", &["5"], Some("juróom")),
    ("numberToWords", &["6"], Some("juróom benn")),
    ("numberToWords", &["7"], Some("juróom ñaar")),
    ("numberToWords", &["8"], Some("juróom ñett")),
    ("numberToWords", &["9"], Some("juróom ñeent")),
    ("numberToWords", &["10"], Some("fukk")),
    ("numberToWords", &["15"], Some("fukk ak juróom")),
    ("numberToWords", &["20"], Some("ñaar fukk")),
    ("numberToWords", &["21"], Some("ñaar fukk ak benn")),
    ("numberToWords", &["47"], Some("ñeent fukk ak juróom ñaar")),
    ("numberToWords", &["90"], Some("juróom ñeent fukk")),
    ("numberToWords", &["99"], Some("juróom ñeent fukk ak juróom ñeent")),
    ("numberToWords", &["100"], Some("téeméer")),
    ("numberToWords", &["101"], Some("téeméer ak benn")),
    ("numberToWords", &["555"], Some("juróom téeméer ak juróom fukk ak juróom")),
    ("numberToWords", &["1000"], Some("junni")),
    ("numberToWords", &["12345"], Some("fukk ak ñaar junni ak ñett téeméer ak ñeent fukk ak juróom")),
    ("numberToWords", &["1000000"], Some("milyoŋ")),
    ("numberToWords", &["2000000"], Some("ñaar milyoŋ")),
    ("numberToWords", &["1000000000"], Some("milyaar")),
    ("createWolof().text", &["6"], Some("ɟuroːm bɛnː")),
    ("createWolof().text", &["20"], Some("ɲaːr fukː")),
    ("normalizeWolof", &["Wolof (43,3 %)"], Some("Wolof (43 3 ci téeméer)")),
    ("normalizeWolof", &["20,3% ci jéeri"], Some("20 3 ci téeméer ci jéeri")),
    ("normalizeWolof", &["5% ci at"], Some("5 ci téeméer ci at")),
    ("createWolof().text", &["5%"], Some("ɟuroːm ci teːmeːr")),
    ("normalizeWolof", &["$375"], Some("375 dolaar")),
    ("normalizeWolof", &["US$5 ngir jàll"], Some("5 dolaar ngir jàll")),
    ("normalizeWolof", &["US$ 65 milyoŋ"], Some("65 milyoŋ ciy dolaar")),
    ("normalizeWolof", &["$12 miliyaar ciy dolaar"], Some("12 miliyaar ciy dolaar")),
    ("createWolof().text", &["150mm"], Some("teːmeːr ak ɟuroːm fukː milimɛt")),
    ("normalizeWolof", &["2 798 km"], Some("2798 kilomet")),
    ("normalizeWolof", &["146km"], Some("146 kilomet")),
    ("normalizeWolof", &["40 cm"], Some("40 sàntimet")),
    ("normalizeWolof", &["1,5 kg"], Some("1 5 kilogaraam")),
    ("normalizeWolof", &["ci km kaare lay tollu"], Some("ci kilomet kaare lay tollu")),
    ("normalizeWolof", &["30.065.000 km²"], Some("30065000 kilomet kaare")),
    ("normalizeWolof", &["4,033 km2"], Some("4033 kilomet kaare")),
    ("normalizeWolof", &["74.900.000 km&sup2"], Some("74900000 kilomet kaare")),
    ("normalizeWolof", &["74.900.000 km&sup2;"], Some("74900000 kilomet kaare")),
    ("normalizeWolof", &["12°8 ak 16°41"], Some("12 aj 8 ak 16 aj 41")),
    ("normalizeWolof", &["0° walla 20°"], Some("0 aj walla 20 aj")),
    ("normalizeWolof", &["wu 60° (60 aj) ci bëj-gànnaar"], Some("wu 60 (60 aj) ci bëj-gànnaar")),
    ("normalizeWolof", &["série B, n° 3"], Some("série B, n° 3")),
    ("normalizeWolof", &["Senghor(1906-2001)"], Some("Senghor(1906 ba 2001)")),
    ("normalizeWolof", &["( 1265 - 1321 g )"], Some("( 1265 ba 1321 g )")),
    ("normalizeWolof", &["yàggug 10-20 fan"], Some("yàggug 10 ba 20 fan")),
    ("normalizeWolof", &["Jëf 19:26-27 21:27"], Some("Jëf 19:26-27 21:27")),
    ("normalizeWolof", &["1–1 mooy"], Some("1–1 mooy")),
    ("normalizeWolof", &["9,10 · 10−31 kg"], Some("9 1 0 · 10−31 kilogaraam")),
    ("normalizeWolof", &["1,602 189 2 ∙ 10 -19 C"], Some("1602 189 2 ∙ 10 -19 C")),
    ("normalizeWolof", &["yàggug 15-20."], Some("yàggug 15 ba 20.")),
    ("normalizeWolof", &["atum 1939–1940."], Some("atum 1939 ba 1940.")),
    ("normalizeWolof", &["115-128."], Some("115 ba 128.")),
    ("normalizeWolof", &["atum 1939–1940,"], Some("atum 1939 ba 1940,")),
    ("normalizeWolof", &["atum 1939–1940,5"], Some("atum 1939–1940 5")),
    ("normalizeWolof", &["$150,000"], Some("150000 dolaar")),
    ("normalizeWolof", &["am na 605 695 ciy way-dëkk"], Some("am na 605695 ciy way-dëkk")),
    ("normalizeWolof", &["tollu ci 112.622 yu kaare"], Some("tollu ci 112622 yu kaare")),
    ("normalizeWolof", &["doomi aadama ci 0.449 ci 2021"], Some("doomi aadama ci 0 4 4 9 ci 2021")),
    ("normalizeWolof", &["Am 15.85 miliyoŋ"], Some("Am 15 8 5 miliyoŋ")),
    ("normalizeWolof", &["ak 2,8 milyoŋ"], Some("ak 2 8 milyoŋ")),
    ("createWolof().text", &["15.85"], Some("fukː ak ɟuroːm ɟuroːm ɲɛtː ɟuroːm")),
    ("normalizeWolof", &["ci Jëf 2:9; 19:10,22,26,27"], Some("ci Jëf 2:9; 19:10,22,26,27")),
    ("normalizeWolof", &["Ci 27 g.K. la juddu"], Some("Ci 27 g K la juddu")),
    ("normalizeWolof", &["Yonnant bi (j.m) daan na"], Some("Yonnant bi (j m) daan na")),
    ("normalizeWolof", &["darajay Yonant bi (j.y.m)"], Some("darajay Yonant bi (j y m)")),
    ("normalizeWolof", &["atum 1967 g.K. Te delloosi"], Some("atum 1967 g K. Te delloosi")),
    ("normalizeWolof", &["atum 1967 g.K."], Some("atum 1967 g K.")),
    ("normalizeWolof", &["ci wo.wikipedia bi"], Some("ci wo.wikipedia bi")),
    ("normalizeWolof", &["soul, R&B, disco"], Some("soul, R ak B, disco")),
    ("normalizeWolof", &["suufus 10&nbsp;km."], Some("suufus 10 kilomet.")),
    ("normalizeWolof", &["20°. &alpha di ab ngungu"], Some("20 aj. alpha di ab ngungu")),
    ("normalizeWolof", &["Marko 14:2 ak Ge 1:26"], Some("Marko 14:2 ak Ge 1:26")),
    ("normalizeWolof", &["ci 31/12/2007"], Some("ci 31/12/2007")),
    ("normalizeWolof", &["cer (2/3) yu fekke"], Some("cer (2/3) yu fekke")),
    ("normalizeWolof", &["baziira = gisug xol"], Some("baziira = gisug xol")),
    ("normalizeWolof", &["atum 1967 g."], Some("atum 1967 g.")),
    ("normalizeWolof", &["1392 gg, dëppook"], Some("1392 gg, dëppook")),
    ("normalizeWolof", &["ca Tuubaa (aaliya)sosu/2012m."], Some("ca Tuubaa (aaliya)sosu/2012m.")),
    ("normalizeWolof", &["the 20th century"], Some("the 20 century")),
    ("normalizeWolof", &["Ci bi 8:46 ci suba joté"], Some("Ci bi 8 46 ci suba joté")),
    ("normalizeWolof", &["lakk bi ci 11:35 ci ngoon."], Some("lakk bi ci 11 35 ci ngoon.")),
    ("normalizeWolof", &["rapooram tay ci ci 12:00 GMT."], Some("rapooram tay ci ci 12 00 GMT.")),
    ("normalizeWolof", &["Ge 1:26-30"], Some("Ge 1:26-30")),
    ("normalizeWolof", &["1Ki 15:8-24"], Some("1Ki 15:8-24")),
    ("normalizeWolof", &["bu toll ci 4:41.30, 2:11"], Some("bu toll ci 4:41.30, 2:11")),
    ("normalizeWolof", &["Bi 11:20 jotee"], Some("Bi 11:20 jotee")),
    ("normalizeWolof", &["ci 8:46 ci suba"], Some("ci 8 46 ci suba")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_wolof().unwrap();
        let mut count = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => phonemize_word(&js(args[0])).to_string_lossy(),
                "normalizeWolof" => normalize_wolof(&js(args[0])).to_string_lossy(),
                "numberToWords" => {
                    number_to_words(js_number(&js(args[0])), args.get(1).map(|r| js(r)).as_ref())
                        .to_string_lossy()
                }
                "createWolof().text" => {
                    crate::core::foreign::with_host(&js("wo"), || e.text(&js(args[0])))
                        .to_string_lossy()
                }
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            count += 1;
        }
        assert_eq!(count, 102);
    }
}
