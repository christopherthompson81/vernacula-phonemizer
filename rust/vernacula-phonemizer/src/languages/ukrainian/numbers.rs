//! East-Slavic (uk, be) cardinal composition: the Western composer below 1000, and above it each magnitude
//! noun agreeing in gender and count with its multiplier (дві тисячі, п'ять тисяч).
//! Ported from src/languages/ukrainian/numbers.ts — see that file for the sources of every form.

use super::manifest::{EastSlavicNumbers, MagnitudeForms};
use crate::core::normalize_symbols::slavic_count_form;
use crate::core::numbers::{Word, western_number_words};

/// `magnitude(count, sg, forms)`: nom.sg / nom.pl / gen.pl by the shared Slavic selector.
fn magnitude(count: u64, sg: &str, forms: &MagnitudeForms) -> String {
    match slavic_count_form(count as f64) as usize {
        0 => sg.to_string(),
        1 => forms.few.clone(),
        _ => forms.many.clone(),
    }
}

/// `group(count, d, sg, forms, opts)`: the multiplier's words and the agreeing noun.
fn group(
    count: u64,
    d: &EastSlavicNumbers,
    sg: &str,
    forms: &MagnitudeForms,
    feminine: bool,
    omit_one: bool,
) -> Vec<Word> {
    let noun = magnitude(count, sg, forms);
    if count == 1 && omit_one {
        return vec![Some(noun)];
    }
    // `.map((w) => w ?? "?")`: a gap becomes the STRING "?" here (the word function then reads it), where
    // `renderNumber` would render a top-level gap as "?" verbatim.
    let mut words: Vec<String> = east_slavic_number_words(count, d)
        .into_iter()
        .map(|w| w.unwrap_or_else(|| "?".to_string()))
        .collect();
    if feminine && let Some(last) = words.last_mut() {
        let units = &d.base.units;
        if units.get(1) == Some(last) {
            *last = d.feminine.one.clone();
        } else if units.get(2) == Some(last) {
            *last = d.feminine.two.clone();
        }
    }
    let mut out: Vec<Word> = words.into_iter().map(Some).collect();
    out.push(Some(noun));
    out
}

/// `eastSlavicNumberWords(n, def)`.
pub fn east_slavic_number_words(n: u64, d: &EastSlavicNumbers) -> Vec<Word> {
    if n < 1000 {
        return western_number_words(n, &d.base);
    }
    let m = &d.magnitude_counts;
    let mags = &d.base.magnitudes;
    let mut parts = Vec::new();
    let (bil, mil, th, r) = (
        n / 1_000_000_000,
        (n % 1_000_000_000) / 1_000_000,
        (n % 1_000_000) / 1000,
        n % 1000,
    );
    if bil != 0 {
        let sg = mags.billion.as_deref().expect("validated");
        parts.extend(group(bil, d, sg, &m.billion, false, false));
    }
    if mil != 0 {
        let sg = mags.million.as_deref().expect("validated");
        parts.extend(group(mil, d, sg, &m.million, false, false));
    }
    if th != 0 {
        let sg = mags.thousand.as_deref().expect("validated");
        parts.extend(group(th, d, sg, &m.thousand, true, true));
    }
    if r != 0 {
        parts.extend(western_number_words(r, &d.base));
    }
    parts
}
