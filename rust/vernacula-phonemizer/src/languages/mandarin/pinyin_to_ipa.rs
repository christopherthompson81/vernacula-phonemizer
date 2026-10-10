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
fn split_whitespace_runs(s: &JsString) -> Vec<JsString> {
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

    /// `makePinyinToIpa(tables)`: an unknown token is dropped.
    pub fn convert(&self, pinyin: &JsString) -> JsString {
        self.run(pinyin, false).unwrap()
    }

    /// `makeStrictPinyinToIpa(tables)`: `None` when a token is neither a table syllable nor erhua.
    pub fn convert_strict(&self, pinyin: &JsString) -> Option<JsString> {
        self.run(pinyin, true)
    }

    /// The converter. Erhua: a bare `r` is the rhotic suffix of the syllable before it, outside the tone
    /// sequence; the rhotic is `er`'s own reading after its nucleus (`ər` → `r`). With no syllable before it,
    /// it is `er`.
    fn run(&self, pinyin: &JsString, strict: bool) -> Option<JsString> {
        let tokens: Vec<JsString> = split_whitespace_runs(&pinyin.trim())
            .into_iter()
            .filter(|t| !t.is_empty())
            .collect();
        if tokens.is_empty() {
            return Some(JsString::new());
        }
        let ipa = &self.tables.syllable_ipa;
        let rhotic = ipa.get(&js("er")).map(|er| {
            let cps = er.code_point_strings();
            JsString::join(&cps[1.min(cps.len())..], &js(""))
        });
        let mut heads: Vec<(Syllable, JsString)> = Vec::new();
        for tok in &tokens {
            let syl = parse_syllable(tok);
            if let (true, Some(r)) = (syl.base == "r", rhotic.as_ref()) {
                match heads.last_mut() {
                    Some((_, suffix)) => suffix.push_str(r),
                    None => heads.push((
                        Syllable {
                            base: js("er"),
                            tone: syl.tone,
                        },
                        JsString::new(),
                    )),
                }
                continue;
            }
            if strict && !ipa.contains_key(&syl.base) {
                return None;
            }
            heads.push((syl, JsString::new()));
        }
        let realized = apply_third_tone_sandhi(
            &heads.iter().map(|(s, _)| s.tone).collect::<Vec<_>>(),
            self.tables.third_tone_sandhi,
        );
        let mut out: Vec<JsString> = Vec::with_capacity(heads.len());
        for (i, (syl, suffix)) in heads.iter().enumerate() {
            // An unknown token is dropped, keeping its slot in the tone sequence.
            if let Some(seg) = ipa.get(&syl.base) {
                let tone = self
                    .tables
                    .tones
                    .get(&js_number_to_string(realized[i]))
                    .map_or("", String::as_str);
                out.push(seg.concat(suffix).concat(&js(tone)));
            }
        }
        Some(JsString::join(&out, &js(" ")))
    }
}
