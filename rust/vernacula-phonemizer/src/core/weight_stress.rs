//! Weight-based (quantity-sensitive) word stress over IPA: tokenize into C/V units, then place ˈ before the
//! nucleus of the rightmost superheavy syllable, else the rightmost non-final heavy one, else the first.
//! Ported from src/core/weightStress.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::js_regex::JsRegex;
use super::js_string::{JsString, js};
use super::provenance::{Form, normalize};
use super::unicode::{ATTACHING_MODIFIERS, COMBINING_DIACRITICS, IPA_VOWELS, STRESS_PRIMARY, TIE_BAR};
use crate::js_re;

static VOWEL: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("[{IPA_VOWELS}]"), "").unwrap());
static MOD: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!("[{ATTACHING_MODIFIERS}{COMBINING_DIACRITICS}]"), "").unwrap()
});

/// `tokenizeIpa(ipa)`: NFD code points, with ties and modifiers attached to the unit before them.
pub fn tokenize_ipa(ipa: &JsString) -> Vec<JsString> {
    let s = normalize(ipa, Form::Nfd).code_point_strings();
    let tie = js(TIE_BAR);
    let mut out = Vec::new();
    let mut i = 0;
    while i < s.len() {
        let mut t = s[i].clone();
        i += 1;
        while i < s.len() && (MOD.test(&s[i]) || s[i] == tie) {
            t.push_str(&s[i]);
            if s[i] == tie && i + 1 < s.len() {
                i += 1;
                t.push_str(&s[i]);
            }
            i += 1;
        }
        out.push(t);
    }
    out
}

/// `VOWEL.test(tok[0])`: the token's first code UNIT.
fn is_vowel(tok: &JsString) -> bool {
    VOWEL.test(&tok.slice(0, Some(1)))
}

#[derive(PartialEq)]
enum Weight {
    L,
    H,
    S,
}

/// `applyWeightStress(ipa)`.
pub fn apply_weight_stress(ipa: &JsString) -> JsString {
    let t = tokenize_ipa(ipa);
    let nuclei: Vec<usize> = (0..t.len()).filter(|&k| is_vowel(&t[k])).collect();
    if nuclei.is_empty() {
        return ipa.clone();
    }
    let onset = |si: usize| -> usize {
        let v = nuclei[si];
        let prev_v: isize = if si > 0 { nuclei[si - 1] as isize } else { -1 };
        if v as isize > prev_v + 1 && !is_vowel(&t[v - 1]) { v - 1 } else { v }
    };
    let coda = |si: usize| -> isize {
        let v = nuclei[si];
        let end = if si + 1 < nuclei.len() { onset(si + 1) } else { t.len() };
        end as isize - v as isize - 1
    };
    let weight = |si: usize| -> Weight {
        let long_nas = js_re!("[ː̃]").test(&t[nuclei[si]]);
        let c = coda(si);
        if (long_nas && c >= 1) || (!long_nas && c >= 2) {
            Weight::S
        } else if long_nas || c >= 1 {
            Weight::H
        } else {
            Weight::L
        }
    };
    if nuclei.len() == 1 {
        return mark(&t, nuclei[0]);
    }
    let mut target: Option<usize> = (0..nuclei.len()).rev().find(|&si| weight(si) == Weight::S);
    if target.is_none() {
        target = (0..nuclei.len() - 1).rev().find(|&si| weight(si) == Weight::H);
    }
    mark(&t, nuclei[target.unwrap_or(0)])
}

fn mark(t: &[JsString], idx: usize) -> JsString {
    let mut out = JsString::join(&t[..idx], &JsString::new());
    out.push_str(&js(STRESS_PRIMARY));
    out.push_str(&JsString::join(&t[idx..], &JsString::new()));
    out
}
