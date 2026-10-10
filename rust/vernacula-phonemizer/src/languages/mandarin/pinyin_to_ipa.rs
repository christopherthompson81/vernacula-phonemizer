//! Tokenized pinyin with tone digits → canonical IPA: toneless syllable lookup, third-tone sandhi over the
//! tone sequence, the Chao tone appended at syllable end.
//! Ported from src/languages/mandarin/pinyinToIpa.ts — see that file for the corpus evidence.

use indexmap::IndexMap;

use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::js_re;

/// The third-tone sandhi rule as tone NUMBERS (`Number(…)` of the manifest's strings, so possibly NaN).
#[derive(Clone, Copy, Debug)]
pub struct ThirdToneSandhi {
    pub from: f64,
    pub before: f64,
    pub to: f64,
}

pub struct MandarinTables {
    /// Toneless pinyin syllable → segmental IPA.
    pub syllable_ipa: IndexMap<JsString, JsString>,
    /// Tone number ("1".."5") → Chao contour letters.
    pub tones: IndexMap<String, String>,
    pub third_tone_sandhi: ThirdToneSandhi,
}

struct Syllable {
    base: JsString,
    tone: f64,
}

fn normalize_u(base: &JsString) -> JsString {
    if base == "lv" || base == "nv" {
        return JsString::from_units(&base.0[..1]).concat(&js("ü"));
    }
    if base == "lve" || base == "nve" {
        return JsString::from_units(&base.0[..1]).concat(&js("üe"));
    }
    js_re!(r"u:", "g").replace(base, &js("ü"))
}

/// `isPinyinSyllable(token, syllableIpa)`: the syllable shape, with a toneless base (after the ü respellings)
/// that is a key of the table.
pub fn is_pinyin_syllable(token: &JsString, syllable_ipa: &IndexMap<JsString, JsString>) -> bool {
    js_re!(r"^([a-zü:]+?)([1-5])?$", "i")
        .exec(token)
        .is_some_and(|m| {
            syllable_ipa.contains_key(&normalize_u(&m.group(1, token).unwrap().to_lower_case()))
        })
}

fn parse_syllable(token: &JsString) -> Syllable {
    let re = js_re!(r"^([a-zü:]+?)([1-5])?$", "i");
    let Some(m) = re.exec(token) else {
        return Syllable {
            base: token.to_lower_case(),
            tone: 5.0,
        };
    };
    Syllable {
        base: normalize_u(&m.group(1, token).unwrap().to_lower_case()),
        tone: m
            .group(2, token)
            .filter(|t| !t.is_empty())
            .map_or(5.0, |t| js_number(&t)),
    }
}

/// `applyThirdToneSandhi(tones, rule)`: left-to-right pairwise, a copy.
pub fn apply_third_tone_sandhi(tones: &[f64], rule: ThirdToneSandhi) -> Vec<f64> {
    let mut out = tones.to_vec();
    for i in 0..out.len().saturating_sub(1) {
        if out[i] == rule.from && out[i + 1] == rule.before {
            out[i] = rule.to;
        }
    }
    out
}

/// `s.split(/\s+/)`: the pieces between the (never empty) matches, the last piece included.
pub(super) fn split_whitespace_runs(s: &JsString) -> Vec<JsString> {
    let mut out = Vec::new();
    let mut cursor = 0;
    for m in js_re!(r"\s+", "g").match_all(s) {
        out.push(JsString::from_units(&s.0[cursor..m.index()]));
        cursor = m.end();
    }
    out.push(JsString::from_units(&s.0[cursor..]));
    out
}

/// `makePinyinToIpa(tables)`.
pub struct PinyinToIpa {
    tables: MandarinTables,
}

impl PinyinToIpa {
    pub fn new(tables: MandarinTables) -> Self {
        Self { tables }
    }

    pub fn is_syllable(&self, token: &JsString) -> bool {
        is_pinyin_syllable(token, &self.tables.syllable_ipa)
    }

    pub fn convert(&self, pinyin: &JsString) -> JsString {
        let tokens: Vec<JsString> = split_whitespace_runs(&pinyin.trim())
            .into_iter()
            .filter(|t| !t.is_empty())
            .collect();
        if tokens.is_empty() {
            return JsString::new();
        }
        let syls: Vec<Syllable> = tokens.iter().map(parse_syllable).collect();
        let realized = apply_third_tone_sandhi(
            &syls.iter().map(|s| s.tone).collect::<Vec<_>>(),
            self.tables.third_tone_sandhi,
        );
        let mut out: Vec<JsString> = Vec::with_capacity(syls.len());
        for (i, syl) in syls.iter().enumerate() {
            // An unknown token is dropped, keeping its slot in the tone sequence.
            match self.tables.syllable_ipa.get(&syl.base) {
                None => {}
                Some(seg) => {
                    let tone = self
                        .tables
                        .tones
                        .get(&js_number_to_string(realized[i]))
                        .map_or("", String::as_str);
                    out.push(seg.concat(&js(tone)));
                }
            }
        }
        JsString::join(&out, &js(" "))
    }
}
