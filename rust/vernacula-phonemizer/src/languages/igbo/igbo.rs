//! Igbo (ig) phonemizer: a scan over the NFD word (the [-ATR] dotted vowels, syllabic nasals, ⟨ṅ⟩, the digraphs,
//! tone only where a mark is written), and text() over the normalizer and the decimal number compositor.
//! Ported from src/languages/igbo/igbo.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::manifest::{DIR, try_manifest};
use super::normalize::{normalize_igbo, try_symbols};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::load_manifest::load_manifest;
use crate::core::provenance::{Form, normalize};
use crate::registry::{Engine, PhonemizeError};

#[derive(Debug, Deserialize)]
pub struct Tones {
    pub high: String,
    pub low: String,
    pub down: String,
}

/// `IgboDef`: igbo.ts's own slice of igbo.jsonc.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IgboDef {
    pub digraphs: IndexMap<String, String>,
    pub consonants: IndexMap<String, String>,
    pub vowels: IndexMap<String, String>,
    pub tones: Tones,
    pub clause_punctuation: IndexMap<String, String>,
}

fn try_def() -> Result<&'static IgboDef, String> {
    static D: OnceLock<IgboDef> = OnceLock::new();
    load_once(&D, || {
        load_manifest(DIR, "igbo.jsonc").map_err(|e| e.to_string())
    })
}

static DEF: LazyLock<&'static IgboDef> =
    LazyLock::new(|| try_def().unwrap_or_else(|e| panic!("{e}")));

const DOT_BELOW: &str = "̣";
const ACUTE: &str = "́";
const GRAVE: &str = "̀";
const MACRON: &str = "̄";

fn is_tone_mark(c: &JsString) -> bool {
    *c == ACUTE || *c == GRAVE || *c == MACRON
}

fn tone_of(mark: &JsString) -> &'static str {
    if *mark == ACUTE {
        &DEF.tones.high
    } else if *mark == GRAVE {
        &DEF.tones.low
    } else {
        &DEF.tones.down
    }
}

/// `phonemizeWord(word)`: one Igbo word → canonical IPA (segments + tone-when-marked).
pub fn phonemize_word(word: &JsString) -> JsString {
    let def = &*DEF;
    let s = normalize(&word.to_lower_case(), Form::Nfd).code_point_strings();
    let n = s.len();
    let empty = JsString::new();
    let mut out = JsString::new();
    let mut i = 0;
    while i < n {
        let c = &s[i];
        let cs = c.to_string_lossy();
        let nx = s.get(i + 1).unwrap_or(&empty);
        if js("aeiou").includes(c) {
            let mut ipa = js(&def.vowels[&cs]);
            let mut tone = JsString::new();
            let mut dot = false;
            i += 1;
            while i < n && (s[i] == DOT_BELOW || is_tone_mark(&s[i])) {
                if s[i] == DOT_BELOW {
                    dot = true;
                } else {
                    tone = js(tone_of(&s[i]));
                }
                i += 1;
            }
            if dot {
                ipa = match cs.as_str() {
                    "i" => js("ɪ"),
                    "o" => js("ɔ"),
                    "u" => js("ʊ"),
                    _ => ipa,
                };
            }
            out.push_str(&ipa);
            out.push_str(&tone);
            continue;
        }
        if (cs == "m" || cs == "n") && is_tone_mark(nx) {
            out.push_str(&js(if cs == "m" { "m̩" } else { "n̩" }));
            out.push_str(&js(tone_of(nx)));
            i += 2;
            continue;
        }
        if cs == "n" && *nx == "̇" {
            out.push_str(&js("ŋ"));
            i += 2;
            continue;
        }
        let dg = c.concat(nx).to_string_lossy();
        if let Some(p) = def.digraphs.get(&dg).filter(|p| !p.is_empty()) {
            out.push_str(&js(p));
            i += 2;
            continue;
        }
        if let Some(p) = def.consonants.get(&cs) {
            out.push_str(&js(p));
            i += 1;
            continue;
        }
        if let Some(p) = latin_phone(
            c,
            PhoneOpts {
                initial: i == 0,
                include_h: true,
            },
        ) {
            out.push_str(&p);
        }
        i += 1;
    }
    normalize(&out, Form::Nfc)
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"([A-Za-zÀ-ɏḀ-ỿ̀-ͯ]+)|(\d+)|([.?!,;:])", "gu").unwrap());

/// The Igbo engine (`createIgbo()`).
pub struct IgboPhonemizer;

impl IgboPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_igbo(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        try_symbols().expect("checked by create_igbo").apply(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        assemble_clauses(&normalize_igbo(input), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                for wd in number_to_words(js_number(&d), Some(&d)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
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

impl Engine for IgboPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(IgboPhonemizer::text(self, input))
    }
}

/// `createIgbo()`: loads the manifest, igbo.ts's slice of it and the symbol tier, or says which failed.
pub fn create_igbo() -> Result<IgboPhonemizer, String> {
    try_manifest()?;
    try_def()?;
    try_symbols()?;
    Ok(IgboPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::super::numbers::number_to_words;
    use super::*;

    // Every call test/igbo.test.ts, test/igboNormalize.test.ts and test/igboNumbers.test.ts make into the engine,
    // with the value the TS returned, extracted MECHANICALLY (each suite run under a recording vitest shim that also
    // checked every matcher: all green), so each of the suites' expectations holds here exactly when the Rust returns
    // the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["Igbo"], Some("iɡ͡bo")),
    ("phonemizeWord", &["asụsụ"], Some("asʊsʊ")),
    ("phonemizeWord", &["nwoke"], Some("ŋʷoke")),
    ("phonemizeWord", &["nwaanyị"], Some("ŋʷaaɲɪ")),
    ("phonemizeWord", &["kpọọ"], Some("k͡pɔɔ")),
    ("phonemizeWord", &["chọrọ"], Some("t͡ʃɔɾɔ")),
    ("phonemizeWord", &["ọma"], Some("ɔma")),
    ("phonemizeWord", &["ụlọ"], Some("ʊlɔ")),
    ("phonemizeWord", &["mmadụ"], Some("mmadʊ")),
    ("phonemizeWord", &["ọ́nụ"], Some("ɔ˥nʊ")),
    ("phonemizeWord", &["àkwụ́kwọ́"], Some("a˩kʷʊ˥kʷɔ˥")),
    ("phonemizeWord", &["ọ̀tụ̀tụ̀"], Some("ɔ˩tʊ˩tʊ˩")),
    ("normalizeIgbo", &["1,500"], Some("1500")),
    ("normalizeIgbo", &["1,234,567"], Some("1234567")),
    ("phonemize", &["1,500", "ig"], Some("otu puku na naɾɪ ise")),
    ("phonemize", &["60%", "ig"], Some("pasent iɾi isii")),
    ("phonemize", &["8.3%", "ig"], Some("pasent asatɔ ntʊk͡pɔ atɔ")),
    ("phonemize", &["₦500", "ig"], Some("naɾɪ ise naiɾa")),
    ("phonemize", &["$20", "ig"], Some("iɾi abʊɔ dollaɾ")),
    ("normalizeIgbo", &["1967-1970"], Some("1967 ruo 1970")),
    ("normalizeIgbo", &["1,200-2,000"], Some("1200 ruo 2000")),
    ("phonemize", &["A & B", "ig"], Some("a na b")),
    ("normalizeIgbo", &["2.5"], Some("2 ntụkpọ 5")),
    ("phonemize", &["2.5", "ig"], Some("abʊɔ ntʊk͡pɔ ise")),
    ("normalizeIgbo", &["3.14159"], Some("3 ntụkpọ 1 4 1 5 9")),
    ("phonemize", &["3.14159", "ig"], Some("atɔ ntʊk͡pɔ otu anɔ otu ise itoolu")),
    ("normalizeIgbo", &["Afọ 2020. Ọ dị mma."], Some("Afọ 2020. Ọ dị mma.")),
    ("phonemize", &["10 km", "ig"], Some("kilomita iɾi")),
    ("phonemize", &["48 kg", "ig"], Some("kiloɡɾam iɾi anɔ na asatɔ")),
    ("phonemize", &["24 cm", "ig"], Some("sentimita iɾi abʊɔ na anɔ")),
    ("normalizeIgbo", &["10 km"], Some("kilomita 10")),
    ("normalizeIgbo", &["1500 mm"], Some("milimita 1500")),
    ("phonemize", &["1,100mm na 1,300mm", "ig"], Some("milimita otu puku na otu naɾɪ na milimita otu puku na naɾɪ atɔ")),
    ("phonemize", &["$60 m", "ig"], Some("iɾi isii dollaɾ m")),
    ("normalizeIgbo", &["790 km2"], Some("kilomita skwea 790")),
    ("phonemize", &["790 km²", "ig"], Some("kilomita skʷea naɾɪ asaa na iɾi itoolu")),
    ("normalizeIgbo", &["mpaghara ala198 km2"], Some("mpaghara ala kilomita skwea 198")),
    ("normalizeIgbo", &["Il-76 na 1990"], Some("Il-76 na 1990")),
    ("normalizeIgbo", &["COVID19 na 2020"], Some("COVID19 na 2020")),
    ("normalizeIgbo", &["mba 32nd kachasị"], Some("mba nke 32 kachasị")),
    ("phonemize", &["Nigeria bụ mba 8th", "ig"], Some("niɡeɾia bʊ mba nke asatɔ")),
    ("phonemize", &["Naijiria na 2007 bu 37th", "ig"], Some("naid͡ʒiɾia na puku abʊɔ na asaa bu nke iɾi atɔ na asaa")),
    ("normalizeIgbo", &["1,000th"], Some("nke 1000")),
    ("normalizeIgbo", &["Ndị Kraịst na ndị ọzọ"], Some("Ndị Kraịst na ndị ọzọ")),
    ("normalizeIgbo", &["nke Ndị Kraịst bịa St. Columba"], Some("nke Ndị Kraịst bịa St. Columba")),
    ("phonemize", &["0", "ig"], Some("efu")),
    ("phonemize", &["7", "ig"], Some("asaa")),
    ("phonemize", &["1945", "ig"], Some("otu puku na naɾɪ itoolu na iɾi anɔ na ise")),
    ("phonemize", &["20", "ig"], Some("iɾi abʊɔ")),
    ("phonemize", &["100", "ig"], Some("otu naɾɪ")),
    ("phonemize", &["1000000", "ig"], Some("otu nde")),
    ("phonemize", &["Afọ 1960", "ig"], Some("afɔ otu puku na naɾɪ itoolu na iɾi isii")),
    ("numberToWords", &["11"], Some("iri na otu")),
    ("numberToWords", &["12"], Some("iri na abụọ")),
    ("numberToWords", &["20"], Some("iri abụọ")),
    ("numberToWords", &["30"], Some("iri atọ")),
    ("numberToWords", &["90"], Some("iri itoolu")),
    ("numberToWords", &["873"], Some("narị asatọ na iri asaa na atọ")),
    ("numberToWords", &["200"], Some("narị abụọ")),
    ("numberToWords", &["100"], Some("otu narị")),
    ("numberToWords", &["1000"], Some("otu puku")),
    ("numberToWords", &["2000000"], Some("nde abụọ")),
    ("numberToWords", &["1401873"], Some("otu nde na puku narị anọ na otu na narị asatọ na iri asaa na atọ")),
    ("numberToWords", &["10000000000000"], Some("otu efu efu efu efu efu efu efu efu efu efu efu efu efu")),
    ("phonemize", &["10000000000000", "ig"], Some("otu efu efu efu efu efu efu efu efu efu efu efu efu efu")),
    ("numberToWords", &["NaN"], Some("N a N")),
    ("numberToWords", &["0"], Some("efu")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        create_igbo().unwrap();
        let mut count = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => phonemize_word(&js(args[0])).to_string_lossy(),
                "normalizeIgbo" => normalize_igbo(&js(args[0])).to_string_lossy(),
                "numberToWords" => {
                    number_to_words(js_number(&js(args[0])), args.get(1).map(|r| js(r)).as_ref())
                        .to_string_lossy()
                }
                "phonemize" => crate::phonemize(args[0], args[1]).unwrap(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            count += 1;
        }
        assert_eq!(count, 67);
    }
}
