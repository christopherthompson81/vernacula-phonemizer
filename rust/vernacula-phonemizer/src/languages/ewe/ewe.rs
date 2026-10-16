//! Ewe (ee) phonemizer: a longest-match scan over the NFC word with the ⟨r⟩ [l]~[r] and ⟨w⟩ [w]/[ɰ] allophony and
//! the nasalisation tilde kept (tone dropped), and text() over the normalizer, an NFD pass and the number compositor.
//! Ported from src/languages/ewe/ewe.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::from_json::FromJson;
use indexmap::IndexMap;

use super::normalize::normalize_ewe;
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::load_manifest::load_manifest;
use crate::core::provenance::{Form, normalize, renormalize};
use crate::registry::{Engine, PhonemizeError};

pub const DIR: &str = "languages/ewe";

/// `EweDef`: the digraph and letter tables of ewe.jsonc.
#[derive(Debug, FromJson)]
pub struct EweDef {
    pub digraphs: IndexMap<String, String>,
    pub letters: IndexMap<String, String>,
}

fn try_def() -> Result<&'static EweDef, String> {
    static D: OnceLock<EweDef> = OnceLock::new();
    load_once(&D, || {
        load_manifest(DIR, "ewe.jsonc").map_err(|e| e.to_string())
    })
}

static DEF: LazyLock<&'static EweDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

const TILDE: &str = "̃";

fn is_vowel_seg(s: Option<&JsString>) -> bool {
    s.is_some_and(|s| {
        normalize(s, Form::Nfd)
            .code_point_strings()
            .iter()
            .any(|c| js("aeiouɛɔ").includes(c))
    })
}

/// `phonemizeWord(word)`: one Ewe word → canonical IPA (nasalisation kept, tone not emitted).
pub fn phonemize_word(word: &JsString) -> JsString {
    let (digraph, g) = (&DEF.digraphs, &DEF.letters);
    let w = normalize(word, Form::Nfc).to_lower_case();
    let chars = w.code_point_strings();
    let mut segs: Vec<JsString> = Vec::new();
    let mut i = 0;
    while i < chars.len() {
        if i + 1 < chars.len() {
            let two = chars[i].concat(&chars[i + 1]).to_string_lossy();
            if let Some(p) = digraph.get(&two) {
                segs.push(js(p));
                i += 2;
                continue;
            }
        }
        let c = &chars[i];
        let cs = c.to_string_lossy();
        if cs == "r" {
            let r = segs.is_empty() || is_vowel_seg(segs.last());
            segs.push(js(if r { "r" } else { "l" }));
            i += 1;
            continue;
        }
        if cs == "w" {
            // `chars[i + 1]?.normalize("NFD")[0]`: the first code UNIT of the next code point's NFD.
            let nb = chars.get(i + 1).map(|x| normalize(x, Form::Nfd).char_at(0));
            let after_consonant = !segs.is_empty() && !is_vowel_seg(segs.last());
            let rounded = nb.is_some_and(|b| js("ouɔ").includes(&b));
            segs.push(js(if after_consonant || rounded {
                "w"
            } else {
                "ɰ"
            }));
            i += 1;
            continue;
        }
        let tilde_next = chars.get(i + 1).is_some_and(|x| *x == TILDE);
        if let Some(p) = g.get(&cs) {
            segs.push(if tilde_next {
                normalize(&js(p).concat(&js(TILDE)), Form::Nfc)
            } else {
                js(p)
            });
            if tilde_next {
                i += 1;
            }
            i += 1;
            continue;
        }
        let nfd = normalize(c, Form::Nfd).code_point_strings();
        let base = &nfd[0];
        if let Some(p) = g.get(&base.to_string_lossy()) {
            let nasal = nfd.iter().any(|x| *x == TILDE) && js("aeiouɛɔ").includes(base);
            let mut seg = js(p);
            if nasal {
                seg.push_str(&js(TILDE));
            }
            segs.push(normalize(&seg, Form::Nfc));
            i += 1;
            continue;
        }
        if let Some(ph) = latin_phone(
            c,
            PhoneOpts {
                initial: i == 0,
                include_h: false,
            },
        ) {
            segs.push(ph);
            i += 1;
            continue;
        }
        i += 1;
    }
    normalize(&JsString::join(&segs, &JsString::new()), Form::Nfc)
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"([a-zɖƒʋɣŋɔɛA-ZƉƑƲƔŊƆƐ̀-ͯ']+)|(\d+)|([.!?…,;:])", "gu").unwrap());

/// The Ewe engine (`createEwe()`).
pub struct EwePhonemizer;

impl EwePhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_ewe(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = renormalize(&normalize_ewe(input), Form::Nfd);
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                for wd in number_to_words(js_number(&d), Some(&d)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty()) {
                let stop = p == "." || p == "!" || p == "?";
                sink.pause(&js(if stop { "." } else { "," }));
            }
        })
    }
}

impl Engine for EwePhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(EwePhonemizer::text(self, input))
    }
}

/// `createEwe()`: loads the letter tables, or says why not.
pub fn create_ewe() -> Result<EwePhonemizer, String> {
    try_def()?;
    Ok(EwePhonemizer)
}

#[cfg(test)]
mod tests {
    use super::super::numbers::number_to_words;
    use super::*;

    // Every call test/ewe.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["Eʋegbe"], Some("eβeɡ͡be")),
    ("phonemizeWord", &["agbe"], Some("aɡ͡be")),
    ("phonemizeWord", &["atsiaƒu"], Some("at͡siaɸu")),
    ("phonemizeWord", &["nyɔnu"], Some("ɲɔnu")),
    ("phonemizeWord", &["wɔ"], Some("wɔ")),
    ("phonemizeWord", &["Xawa"], Some("xaɰa")),
    ("phonemizeWord", &["ɣ"], Some("ɰ")),
    ("phonemizeWord", &["adre"], Some("adle")),
    ("phonemizeWord", &["agbalẽ"], Some("aɡ͡balẽ")),
    ("phonemizeWord", &["fukpekpe"], Some("fuk͡pek͡pe")),
    ("phonemizeWord", &["ŋusẽ"], Some("ŋusẽ")),
    ("createEwe().text", &["agbalẽ"], Some("aɡ͡balẽ")),
    ("createEwe().text", &["Ɖekawo"], Some("ɖekawo")),
    ("numberToWords", &["7"], Some("adre")),
    ("numberToWords", &["10"], Some("ewo")),
    ("numberToWords", &["11"], Some("wuiɖeke")),
    ("numberToWords", &["20"], Some("blaeve")),
    ("numberToWords", &["21"], Some("blaeve vɔ ɖeka")),
    ("numberToWords", &["42"], Some("blaene vɔ eve")),
    ("numberToWords", &["99"], Some("blaasieke vɔ asieke")),
    ("numberToWords", &["100"], Some("alafa ɖeka")),
    ("numberToWords", &["101"], Some("alafa ɖeka kple ɖeka")),
    ("numberToWords", &["555"], Some("alafa atɔ̃ kple blaatɔ̃ vɔ atɔ̃")),
    ("numberToWords", &["1000"], Some("akpe ɖeka")),
    ("numberToWords", &["12345"], Some("akpe wuieve kple alafa etɔ̃ kple blaene vɔ atɔ̃")),
    ("numberToWords", &["1000000"], Some("miliɔn ɖeka")),
    ("numberToWords", &["2000000"], Some("miliɔn eve")),
    ("createEwe().text", &["20"], Some("blaeve")),
    ("createEwe().text", &["1000"], Some("ak͡pe ɖeka")),
    ("createEwe().text", &["Ðasefowo"], Some("ɖasefowo")),
    ("createEwe().text", &["Đoɖo"], Some("ɖoɖo")),
    ("createEwe().text", &["Ƞkɔ"], Some("ŋkɔ")),
    ("createEwe().text", &["ha͂"], Some("hã")),
    ("createEwe().text", &["kata͂"], Some("katã")),
    ("createEwe().text", &["Ɖasefowo"], Some("ɖasefowo")),
    ("normalizeEwe", &["/boʊnˈfoʊ ɑːbˈæs/"], Some("/boʊnˈfoʊ ɑːbˈæs/")),
    ("normalizeEwe", &["ð đ ƞ"], Some("ð đ ƞ")),
    ("createEwe().text", &["90%"], Some("blaasieke le alafa me")),
    ("createEwe().text", &["25–33%"], Some("blaeve vɔ atɔ̃ va ɖo blaetɔ̃ vɔ etɔ̃ le alafa me")),
    ("normalizeEwe", &["$400"], Some("dɔlar 400")),
    ("normalizeEwe", &["GH¢ 1"], Some("cedi 1")),
    ("normalizeEwe", &["€200"], Some("euro 200")),
    ("normalizeEwe", &["£7,500"], Some("pound 7500")),
    ("normalizeEwe", &["5 km"], Some("kilometa 5")),
    ("normalizeEwe", &["100,210 km2"], Some("kilometa 100210")),
    ("normalizeEwe", &["56.52m"], Some("meta 56 5 2")),
    ("normalizeEwe", &["$400mm"], Some("dɔlar 400mm")),
    ("normalizeEwe", &["5 kg"], Some("5 kg")),
    ("normalizeEwe", &["1648-1654"], Some("1648 va ɖo 1654")),
    ("normalizeEwe", &["7000–3300"], Some("7000–3300")),
    ("normalizeEwe", &["7–6"], Some("7–6")),
    ("normalizeEwe", &["Luka 19:28-44"], Some("Luka 19:28-44")),
    ("normalizeEwe", &["ISBN 0-582-49219-X"], Some("ISBN 0-582-49219-X")),
    ("normalizeEwe", &["207-213."], Some("207 va ɖo 213.")),
    ("normalizeEwe", &["le May 10-11, 2007"], Some("le May 10 va ɖo 11, 2007")),
    ("normalizeEwe", &["7–6, 4–6"], Some("7–6, 4–6")),
    ("normalizeEwe", &["Mateo 21:1-11."], Some("Mateo 21:1-11.")),
    ("createEwe().text", &["51,446,201"], Some("miliɔn blaatɔ̃ vɔ ɖeka k͡ple ak͡pe alafa ene k͡ple blaene vɔ ade k͡ple alafa eve k͡ple ɖeka")),
    ("normalizeEwe", &["10 955 000"], Some("10955000")),
    ("normalizeEwe", &["0.5"], Some("0 5")),
    ("normalizeEwe", &["44.4%"], Some("44 4 le alafa me")),
    ("normalizeEwe", &["U.S."], Some("US.")),
    ("normalizeEwe", &["D.M.Ŋ."], Some("DMŊ.")),
    ("createEwe().text", &["3rd edition"], Some("etɔ̃ edition")),
    ("normalizeEwe", &["GH¢&nbsp;1"], Some("cedi 1")),
    ("normalizeEwe", &["meter 3&nbsp (afɔ 10&nbsp)"], Some("meter 3  (afɔ 10 )")),
    ("createEwe().text", &["Duncker & Humblot"], Some("dunt͡sker k͡ple humblot")),
    ("normalizeEwe", &["Wodzi Ephraim le Peki-Avetile le Anyɔnyɔ 13 le ƒe 1899 me."], Some("Wodzi Ephraim le Peki-Avetile le Anyɔnyɔ 13 le ƒe 1899 me.")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_ewe().unwrap();
        let mut count = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => phonemize_word(&js(args[0])).to_string_lossy(),
                "normalizeEwe" => normalize_ewe(&js(args[0])).to_string_lossy(),
                "numberToWords" => {
                    number_to_words(js_number(&js(args[0])), args.get(1).map(|r| js(r)).as_ref())
                        .to_string_lossy()
                }
                "createEwe().text" => {
                    crate::core::foreign::with_host(&js("ee"), || e.text(&js(args[0])))
                        .to_string_lossy()
                }
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            count += 1;
        }
        assert_eq!(count, 68);
    }
}
