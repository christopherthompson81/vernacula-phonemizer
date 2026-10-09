//! ARPABET phones to canonical IPA: stress marks, the conditional vowels, barred i, flapping, aspiration,
//! dark l, syllabic sonorants. Ported from src/languages/english/englishArpabet.ts — see that file for the
//! evidence behind each rule.

use indexmap::IndexMap;
use serde::Deserialize;

use crate::core::js_string::{JsString, js};
use crate::js_re;

#[derive(Debug, Deserialize, Clone)]
pub struct StressPair {
    pub unstressed: String,
    pub stressed: String,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct IyForms {
    pub before_r: String,
    pub unstressed: String,
    pub stressed: String,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UwForms {
    pub before_r: String,
    pub default: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ConditionalVowels {
    #[serde(rename = "AH")]
    pub ah: StressPair,
    #[serde(rename = "ER")]
    pub er: StressPair,
    #[serde(rename = "IY")]
    pub iy: IyForms,
    #[serde(rename = "UW")]
    pub uw: UwForms,
}

#[derive(Debug, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ArpabetDef {
    pub map: IndexMap<String, String>,
    pub vowels: Vec<String>,
    pub conditional_vowels: ConditionalVowels,
}

#[derive(Clone, Debug)]
struct Phone {
    base: String,
    stress: i32,
}

/// `/^([A-Z]+)([0-2])?$/`: base and stress, or the whole phone with stress -1.
fn split(phone: &str) -> Phone {
    let b = phone.as_bytes();
    let letters = b.iter().take_while(|c| c.is_ascii_uppercase()).count();
    let rest = &b[letters..];
    let ok =
        letters > 0 && (rest.is_empty() || (rest.len() == 1 && (b'0'..=b'2').contains(&rest[0])));
    if !ok {
        return Phone {
            base: phone.to_string(),
            stress: -1,
        };
    }
    Phone {
        base: phone[..letters].to_string(),
        stress: rest.first().map_or(-1, |d| (d - b'0') as i32),
    }
}

const SIBILANT: [&str; 6] = ["S", "Z", "SH", "ZH", "CH", "JH"];

fn is_barred_i(word: &JsString, p: &[Phone], vi: usize, ni: usize, nuclei_count: usize) -> bool {
    let Phone { base, stress } = &p[vi];
    if *stress > 0 || (base != "IH" && base != "AH") {
        return false;
    }
    let last_nucleus = ni + 1 == nuclei_count;
    if js_re!("(ed|es)$").test(word)
        && last_nucleus
        && vi + 1 < p.len()
        && vi > 0
        && (p[vi - 1].base == "T" || p[vi - 1].base == "D")
    {
        return true;
    }
    if js_re!("es$").test(word)
        && last_nucleus
        && vi > 0
        && vi + 1 < p.len()
        && p[vi + 1].base == "Z"
        && SIBILANT.contains(&p[vi - 1].base.as_str())
    {
        return true;
    }
    if js_re!("est$").test(word)
        && !js_re!("(forest|harvest|honest|modest|tempest|interest)$").test(word)
        && last_nucleus
        && vi + 3 == p.len()
        && p.get(vi + 1).is_some_and(|x| x.base == "S")
        && p.get(vi + 2).is_some_and(|x| x.base == "T")
    {
        return true;
    }
    if js_re!("(it|iti|ities|ety|ities)y?$").test(word)
        && p.get(vi + 1).is_some_and(|x| x.base == "T")
    {
        return true;
    }
    if js_re!("ibl[ey]?$").test(word) && vi + 1 < p.len() && p[vi + 1].base == "B" {
        return true;
    }
    ni == 0 && js_re!("^(be|de|re|se|pre)[^aeiouy]").test(word)
}

fn rebase_suffix_ih(p: &mut [Phone], word: &JsString) {
    let n = p.len() as isize;
    let at = |p: &[Phone], i: isize| -> String {
        if i < 0 {
            String::new()
        } else {
            p.get(i as usize).map_or(String::new(), |x| x.base.clone())
        }
    };
    let unstressed_vowel =
        |p: &[Phone], i: isize| i >= 0 && p.get(i as usize).is_some_and(|x| x.stress == 0);
    let mut vi: isize = -1;
    if js_re!("ists?$").test(word) {
        if at(p, n - 2) == "S" && at(p, n - 1) == "T" {
            vi = n - 3;
        } else if at(p, n - 3) == "S" && at(p, n - 2) == "T" && at(p, n - 1) == "S" {
            vi = n - 4;
        }
    } else if js_re!("is$").test(word) {
        if at(p, n - 1) == "S" {
            vi = n - 2;
        }
    } else if js_re!("ages?$").test(word) {
        if at(p, n - 1) == "JH" {
            vi = n - 2;
        } else if at(p, n - 3) == "JH" && at(p, n - 1) == "Z" && unstressed_vowel(p, n - 2) {
            vi = n - 4;
        }
    }
    if vi >= 0 {
        if let Some(x) = p.get_mut(vi as usize) {
            if x.base == "AH" && x.stress == 0 {
                x.base = "IH".to_string();
            }
        }
    }
}

fn demote_final_iy2(p: &mut [Phone], word: &JsString) {
    if let Some(last) = p.last_mut() {
        if word.ends_with(&js("y")) && last.base == "IY" && last.stress == 2 {
            last.stress = 0;
        }
    }
}

/// Every primary but the LAST becomes secondary.
pub fn single_primary(phones: &[String]) -> Vec<String> {
    let last_primary = phones.iter().rposition(|p| p.ends_with('1'));
    phones
        .iter()
        .enumerate()
        .map(|(i, p)| match last_primary {
            Some(lp) if i != lp && p.ends_with('1') => format!("{}2", &p[..p.len() - 1]),
            _ => p.clone(),
        })
        .collect()
}

const STRONG_OPEN_FINAL: [&str; 6] = ["EY", "AY", "OY", "AW", "AO", "UW"];
const R_OFFGLIDE_DIPHTHONG: [&str; 5] = ["AY", "AW", "OW", "EY", "OY"];

/// The converter. `syllabic` and `nasal_seam` map a word to phone slots (en-syllabic.tsv, en-nasal-seam.tsv).
pub struct ArpabetToIpa {
    def: ArpabetDef,
    syllabic: IndexMap<JsString, Vec<usize>>,
    nasal_seam: IndexMap<JsString, Vec<usize>>,
}

pub fn make_arpabet_to_ipa(
    def: &ArpabetDef,
    syllabic: IndexMap<JsString, Vec<usize>>,
    nasal_seam: IndexMap<JsString, Vec<usize>>,
) -> ArpabetToIpa {
    ArpabetToIpa {
        def: def.clone(),
        syllabic,
        nasal_seam,
    }
}

impl ArpabetToIpa {
    fn mapped(&self, base: &str) -> String {
        self.def
            .map
            .get(base)
            .cloned()
            .unwrap_or_else(|| base.to_string())
    }

    pub fn convert(&self, phones: &[String], word: &JsString) -> JsString {
        let cv = &self.def.conditional_vowels;
        let is_vowel = |b: &str| self.def.vowels.iter().any(|v| v == b);
        let resolved = single_primary(phones);
        let demoted: Vec<bool> = phones.iter().zip(&resolved).map(|(a, b)| a != b).collect();
        let mut p: Vec<Phone> = resolved.iter().map(|x| split(x)).collect();
        demote_final_iy2(&mut p, word);
        rebase_suffix_ih(&mut p, word);
        let syl_slots = self.syllabic.get(word);
        let mut pending_syllabic = false;
        let nuclei_idx: Vec<usize> = (0..p.len()).filter(|&i| is_vowel(&p[i].base)).collect();
        let nucleus_num = |vi: usize| nuclei_idx.iter().position(|&x| x == vi).unwrap();
        let primary_ni = nuclei_idx.iter().position(|&vi| p[vi].stress == 1);
        let mut out = String::new();
        for i in 0..p.len() {
            let Phone { base, stress } = p[i].clone();
            let next_is_r = i + 1 < p.len() && p[i + 1].base == "R";
            let next_is_v = i + 1 < p.len() && is_vowel(&p[i + 1].base);
            if is_vowel(&base) && syl_slots.is_some_and(|s| s.contains(&i)) {
                let son = i + 1;
                let son_is_onset = son + 1 < p.len() && is_vowel(&p[son + 1].base);
                if son_is_onset {
                    out.push_str("ə\u{0306}");
                    continue;
                }
                pending_syllabic = true;
                continue;
            }
            if is_vowel(&base) {
                let ni = nucleus_num(i);
                let mut mark = match stress {
                    1 => "ˈ",
                    2 => "ˌ",
                    _ => "",
                };
                if stress == 2
                    && !demoted[i]
                    && primary_ni.is_some_and(|pn| ni.abs_diff(pn) == 1)
                    && !(ni == nuclei_idx.len() - 1
                        && (i < p.len() - 1 || STRONG_OPEN_FINAL.contains(&base.as_str())))
                    && !(R_OFFGLIDE_DIPHTHONG.contains(&base.as_str())
                        && p.get(i + 1)
                            .is_some_and(|x| x.base == "ER" && x.stress == 0))
                {
                    mark = "";
                }
                out.push_str(mark);
                if (base == "AH" || base == "IH") && is_barred_i(word, &p, i, ni, nuclei_idx.len())
                {
                    out.push('ᵻ');
                } else if base == "AH" {
                    out.push_str(if stress <= 0 {
                        &cv.ah.unstressed
                    } else {
                        &cv.ah.stressed
                    });
                } else if base == "ER" {
                    out.push_str(if stress <= 0 {
                        &cv.er.unstressed
                    } else {
                        &cv.er.stressed
                    });
                } else if base == "IY" {
                    out.push_str(
                        if next_is_r && !js_re!("^(?:copy|deoxy|re|pre|de)(?:r|wr)", "u").test(word)
                        {
                            &cv.iy.before_r
                        } else if stress <= 0 {
                            &cv.iy.unstressed
                        } else {
                            &cv.iy.stressed
                        },
                    );
                } else if base == "UW" {
                    out.push_str(if next_is_r {
                        &cv.uw.before_r
                    } else {
                        &cv.uw.default
                    });
                } else {
                    out.push_str(&self.mapped(&base));
                }
                if base == "IY" && next_is_v {
                    out.push('ʲ');
                }
                continue;
            }
            if pending_syllabic {
                pending_syllabic = false;
                out.push_str(&if base == "L" {
                    "ɫ".to_string()
                } else {
                    self.mapped(&base)
                });
                out.push('\u{0329}');
                continue;
            }
            if base == "N"
                && i + 1 < p.len()
                && (p[i + 1].base == "K" || p[i + 1].base == "G")
                && !(i <= 6
                    && js_re!(
                        "^(?:dis|re|mis|over|under|pre|post)?(?:un|in|non|con|en|syn|down|trans)",
                        "u"
                    )
                    .test(word))
                && !self.nasal_seam.get(word).is_some_and(|s| s.contains(&i))
            {
                out.push('ŋ');
                continue;
            }
            if (base == "T" || base == "D") && i > 0 && i + 1 < p.len() {
                let (prev, next) = (&p[i - 1], &p[i + 1]);
                if (is_vowel(&prev.base) || prev.base == "R")
                    && is_vowel(&next.base)
                    && next.stress == 0
                {
                    out.push_str(if base == "T" { "t̬" } else { "d̬" });
                    continue;
                }
            }
            if base == "P" || base == "T" || base == "K" {
                let prev_base = if i > 0 { p[i - 1].base.as_str() } else { "#" };
                let next = p.get(i + 1);
                let onset = i == 0 || is_vowel(prev_base);
                if prev_base != "S"
                    && onset
                    && next.is_some_and(|n| is_vowel(&n.base) && n.stress >= 1)
                {
                    out.push_str(match base.as_str() {
                        "P" => "pʰ",
                        "T" => "tʰ",
                        _ => "kʰ",
                    });
                    continue;
                }
            }
            if base == "L" && !(i + 1 < p.len() && is_vowel(&p[i + 1].base)) {
                out.push('ɫ');
                continue;
            }
            out.push_str(&self.mapped(&base));
        }
        js(&out)
    }
}
