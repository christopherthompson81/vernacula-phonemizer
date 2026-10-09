//! Medial schwa deletion for Indic-abugida IPA (Ohala's VCəCV rule, right to left, geminates keep the
//! syllable heavy). Pure IPA in and out, per whitespace-separated word.
//! Ported from src/core/schwa.ts — see that file for the corpus evidence.

use super::js_string::{JsString, js};
use crate::js_re;

const HI_VOWEL_BASES: &str = "aeiouɛɔəɪʊoɐɑɒʌæ";
const MOD: &str = "ʰʱʲˠʷⁱᵊːˑ";

struct Unit {
    text: JsString,
    is_stress: bool,
    is_vowel: bool,
}

fn has_unit(set: &str, u: u16) -> bool {
    set.encode_utf16().any(|c| c == u)
}

/// ⚠ Walks UTF-16 code UNITS (`ipa[i]`), as the TS does; every symbol involved is BMP.
fn segment_units(ipa: &JsString) -> Vec<Unit> {
    let s = &ipa.0;
    let mut units = Vec::new();
    let mut i = 0;
    while i < s.len() {
        let c = s[i];
        if c == 'ˈ' as u16 || c == 'ˌ' as u16 {
            units.push(Unit {
                text: JsString(vec![c]),
                is_stress: true,
                is_vowel: false,
            });
            i += 1;
            continue;
        }
        let mut unit = vec![c];
        i += 1;
        while i < s.len() {
            let n = s[i];
            if n == 0x0361 {
                unit.push(n);
                // `ipa[i + 1] ?? ""`
                if let Some(&next) = s.get(i + 1) {
                    unit.push(next);
                }
                i += 2;
                continue;
            }
            // `/[̀-ͯ]/u` on one code unit: the combining-diacritics block.
            if (0x0300..=0x036F).contains(&n) || has_unit(MOD, n) {
                unit.push(n);
                i += 1;
                continue;
            }
            break;
        }
        let is_vowel = has_unit(HI_VOWEL_BASES, unit[0]);
        units.push(Unit {
            text: JsString(unit),
            is_stress: false,
            is_vowel,
        });
    }
    units
}

/// `s.split(/(\s+)/u)`: pieces between the separators with each separator kept. `\s+` never matches
/// empty, so this is the leftmost-match walk.
fn split_keep_space(s: &JsString) -> Vec<JsString> {
    let re = js_re!(r"(\s+)", "gu");
    let mut out = Vec::new();
    let mut last = 0;
    for m in re.match_all(s) {
        out.push(JsString::from_units(&s.0[last..m.index()]));
        out.push(m.group(1, s).unwrap_or_default());
        last = m.end();
    }
    out.push(JsString::from_units(&s.0[last..]));
    out
}

fn delete_in_word(w: &JsString, schwa: &JsString) -> JsString {
    let units = segment_units(w);
    let len = units.len() as isize;
    let mut deleted = vec![false; units.len()];
    let prev_phon = |deleted: &[bool], from: isize| -> isize {
        let mut k = from;
        while k >= 0 && (units[k as usize].is_stress || deleted[k as usize]) {
            k -= 1;
        }
        k
    };
    let next_phon = |deleted: &[bool], from: isize| -> isize {
        let mut k = from;
        while k < len && (units[k as usize].is_stress || deleted[k as usize]) {
            k += 1;
        }
        k
    };
    let mut idx = len - 1;
    while idx >= 0 {
        let u = &units[idx as usize];
        if u.is_stress || deleted[idx as usize] || &u.text != schwa {
            idx -= 1;
            continue;
        }
        let p = prev_phon(&deleted, idx - 1);
        let pp = prev_phon(&deleted, p - 1);
        let n = next_phon(&deleted, idx + 1);
        let nn = next_phon(&deleted, n + 1);
        let long = js("ː");
        if p >= 0
            && pp >= 0
            && n < len
            && nn < len
            && !units[p as usize].is_vowel
            && units[pp as usize].is_vowel
            && !units[n as usize].is_vowel
            && units[nn as usize].is_vowel
            && !units[p as usize].text.includes(&long)
            && !units[n as usize].text.includes(&long)
        {
            deleted[idx as usize] = true;
            if idx - 1 >= 0 && units[(idx - 1) as usize].is_stress {
                deleted[(idx - 1) as usize] = true;
            }
        }
        idx -= 1;
    }
    let mut out = JsString::new();
    for (k, u) in units.iter().enumerate() {
        if !deleted[k] {
            out.push_str(&u.text);
        }
    }
    out
}

/// `deleteMedialSchwa(ipa, schwa = "ə")`.
pub fn delete_medial_schwa(ipa: &JsString, schwa: Option<&JsString>) -> JsString {
    let default = js("ə");
    let schwa = schwa.unwrap_or(&default);
    let mut out = JsString::new();
    for w in split_keep_space(ipa) {
        if !js_re!(r"\S").test(&w) {
            out.push_str(&w);
        } else {
            out.push_str(&delete_in_word(&w, schwa));
        }
    }
    out
}
