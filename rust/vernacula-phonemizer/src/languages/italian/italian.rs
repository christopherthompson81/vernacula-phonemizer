//! Native Italian (it) phonemizer: the rule-based g2p (c/g softening, digraphs, gemination, glides,
//! penultimate stress), the cardinal compositor, and `text()`.
//! Ported from src/languages/italian/italian.ts — see that file for the corpus evidence.

use std::collections::HashMap;
use std::sync::LazyLock;

use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{
    BareExponent, ExponentWords, Multiply, SymbolData, SymbolNormalizer, make_symbol_normalizer,
};
use crate::core::provenance::{Form, normalize};

use super::manifest::{ItalianManifest, MANIFEST, try_manifest};
use super::normalize::{normalize_italian, normalize_italian_decimals, normalize_italian_initialisms};

const VOWEL_LETTERS: &str = "aeiouàèéìíîòóùú";
const FRONT: &str = "eièéìí";
const VOWEL_PH: &str = "aeɛioɔu";

fn has(set: &str, c: u32) -> bool {
    set.chars().any(|x| x as u32 == c)
}

/// `VOWEL_LETTERS.includes(c ?? "")`. ⚠ `"…".includes("")` is TRUE in JS, so a missing letter counts as a
/// vowel wherever the TS passes `x ?? ""` (word-final ⟨gn⟩, ⟨qu⟩, and the ⟨s⟩ voicing test).
fn is_vowel_opt(c: Option<u32>) -> bool {
    c.is_none_or(|c| has(VOWEL_LETTERS, c))
}

fn is_vowel_letter(c: u32) -> bool {
    has(VOWEL_LETTERS, c)
}

fn is_front(c: Option<u32>) -> bool {
    c.is_some_and(|c| has(FRONT, c))
}

fn is_cons_letter(c: u32) -> bool {
    (b'a' as u32..=b'z' as u32).contains(&c) && !is_vowel_letter(c)
}

/// `VOWEL_PH.includes(ph[0] ?? "")`: the first UTF-16 unit (an empty `ph` would count, as `""` does).
fn starts_with_vowel_ph(ph: &JsString) -> bool {
    ph.char_code_at(0).is_none_or(|u| has(VOWEL_PH, u as u32))
}

struct Seg {
    ph: JsString,
    accent: bool,
}

struct Tables {
    consonants: HashMap<u32, JsString>,
    vowels: HashMap<u32, JsString>,
    accented: HashMap<u32, JsString>,
}

/// The manifest's one-letter tables keyed by code point (`DEF.consonants[c]` for a one-code-point `c`:
/// a longer key could never be hit, and no single character names an `Object.prototype` member).
static TABLES: LazyLock<Tables> = LazyLock::new(|| {
    let by_cp = |m: &indexmap::IndexMap<String, String>| -> HashMap<u32, JsString> {
        m.iter()
            .filter_map(|(k, v)| {
                let mut cs = k.chars();
                match (cs.next(), cs.next()) {
                    (Some(c), None) => Some((c as u32, js(v))),
                    _ => None,
                }
            })
            .collect()
    };
    Tables {
        consonants: by_cp(&MANIFEST.consonants),
        vowels: by_cp(&MANIFEST.vowels),
        accented: by_cp(&MANIFEST.accented),
    }
});

fn cp_str(c: u32) -> JsString {
    match char::from_u32(c) {
        Some(ch) => js(ch.encode_utf8(&mut [0; 4])),
        None => JsString::from_units(&[c as u16]),
    }
}

fn vowel_seg(c: u32) -> Seg {
    if let Some(acc) = TABLES.accented.get(&c) {
        return Seg { ph: acc.clone(), accent: true };
    }
    Seg { ph: TABLES.vowels.get(&c).cloned().unwrap_or_else(|| cp_str(c)), accent: false }
}

fn ch(c: char) -> u32 {
    c as u32
}

/// Scan a lowercased word (`[...word]`, by code point) into phoneme segments.
fn scan(word: &JsString) -> Vec<Seg> {
    let s: Vec<u32> = word.code_points().collect();
    let n = s.len();
    let at = |i: usize| s.get(i).copied();
    let mut segs: Vec<Seg> = Vec::new();
    let prev_is_vowel = |segs: &Vec<Seg>| segs.last().is_some_and(|sg| starts_with_vowel_ph(&sg.ph));
    fn push(segs: &mut Vec<Seg>, ph: &str) {
        segs.push(Seg { ph: js(ph), accent: false });
    }
    let push_gem = |segs: &mut Vec<Seg>, ph: &str, next_vowel: bool| {
        if prev_is_vowel(segs) && next_vowel {
            push(segs, ph);
            push(segs, ph);
        } else {
            push(segs, ph);
        }
    };

    let mut i = 0;
    while i < n {
        let c = s[i];
        let nx = at(i + 1);
        let nn = at(i + 2);

        if c == ch('g') && nx == Some(ch('l')) && nn == Some(ch('i')) {
            let after = at(i + 3);
            push_gem(&mut segs, "ʎ", true);
            if after.is_some_and(is_vowel_letter) {
                i += 3;
            } else {
                i += 2;
            }
            continue;
        }
        if c == ch('g') && nx == Some(ch('n')) {
            push_gem(&mut segs, "ɲ", is_vowel_opt(nn));
            i += 2;
            continue;
        }
        if c == ch('s') && nx == Some(ch('c')) && is_front(nn) {
            let i_dot = nn == Some(ch('i')) || nn == Some(ch('ì'));
            let after = at(i + 3);
            push_gem(&mut segs, "ʃ", true);
            if i_dot && after.is_some_and(is_vowel_letter) {
                i += 3;
            } else {
                i += 2;
            }
            continue;
        }
        if c == ch('c') || c == ch('g') {
            let (hard, soft) = if c == ch('c') { ("k", "t͡ʃ") } else { ("ɡ", "d͡ʒ") };
            let doubled = nx == Some(c);
            let follow = if doubled { nn } else { nx };
            let rest = if doubled { at(i + 3) } else { nn };
            if follow == Some(ch('h')) {
                if doubled {
                    push(&mut segs, hard);
                }
                push(&mut segs, hard);
                i += if doubled { 3 } else { 2 };
                continue;
            }
            if is_front(follow) {
                if doubled {
                    push(&mut segs, soft);
                }
                push(&mut segs, soft);
                let i_dot = follow == Some(ch('i')) || follow == Some(ch('ì'));
                if i_dot && rest.is_some_and(is_vowel_letter) {
                    i += if doubled { 3 } else { 2 };
                } else {
                    i += if doubled { 2 } else { 1 };
                }
                continue;
            }
            if doubled {
                push(&mut segs, hard);
            }
            push(&mut segs, hard);
            i += if doubled { 2 } else { 1 };
            continue;
        }
        if c == ch('q') {
            push(&mut segs, "k");
            if nx == Some(ch('u')) && is_vowel_opt(nn) {
                push(&mut segs, "w");
                i += 2;
            } else {
                i += 1;
            }
            continue;
        }
        if c == ch('s') {
            if nx == Some(ch('s')) {
                push(&mut segs, "s");
                push(&mut segs, "s");
                i += 2;
                continue;
            }
            let next_voiced = nx.is_some_and(|x| has("bdglmnrvz", x));
            let voiced = (prev_is_vowel(&segs) && is_vowel_opt(nx)) || next_voiced;
            push(&mut segs, if voiced { "z" } else { "s" });
            i += 1;
            continue;
        }
        if c == ch('z') {
            let doubled = nx == Some(ch('z'));
            push(&mut segs, "t͡s");
            if doubled {
                push(&mut segs, "t͡s");
            }
            i += if doubled { 2 } else { 1 };
            continue;
        }

        let cons = TABLES.consonants.get(&c);
        // `DEF.consonants[c]` must be truthy: ⟨h⟩ maps to "" and falls through to the single-letter arm.
        if is_cons_letter(c) && nx == Some(c) && cons.is_some_and(|p| !p.is_empty()) {
            let ph = cons.unwrap().clone();
            segs.push(Seg { ph: ph.clone(), accent: false });
            segs.push(Seg { ph, accent: false });
            i += 2;
            continue;
        }
        if let Some(ph) = cons {
            if !ph.is_empty() {
                segs.push(Seg { ph: ph.clone(), accent: false });
            }
            i += 1;
            continue;
        }

        if is_vowel_letter(c) {
            let semivowel = (c == ch('i') || c == ch('u'))
                && (nx.is_some_and(is_vowel_letter) || prev_is_vowel(&segs));
            if semivowel {
                push(&mut segs, if c == ch('i') { "j" } else { "w" });
                i += 1;
                continue;
            }
            segs.push(vowel_seg(c));
            i += 1;
            continue;
        }
        i += 1;
    }
    segs
}

fn stress_index(segs: &[Seg]) -> Option<usize> {
    let nuclei: Vec<usize> =
        segs.iter().enumerate().filter(|(_, sg)| starts_with_vowel_ph(&sg.ph)).map(|(i, _)| i).collect();
    if nuclei.is_empty() {
        return None;
    }
    if let Some(&a) = nuclei.iter().find(|&&i| segs[i].accent) {
        return Some(a);
    }
    if nuclei.len() == 1 {
        return Some(nuclei[0]);
    }
    Some(nuclei[nuclei.len() - 2])
}

/// One Italian word → canonical IPA.
pub fn phonemize_word(word: &JsString) -> JsString {
    let segs = scan(&word.to_lower_case());
    if segs.is_empty() {
        return JsString::new();
    }
    let stress = stress_index(&segs);
    let mut out = JsString::new();
    for (i, sg) in segs.iter().enumerate() {
        if Some(i) == stress {
            out.push_str(&js("ˈ"));
        }
        out.push_str(&sg.ph);
    }
    normalize(&out, Form::Nfc)
}

// ── Numbers. JS Number arithmetic, kept in f64 (the ordinal path passes `Number(digits)` unbounded). ──

fn under1000(n: f64) -> String {
    let num = &MANIFEST.numbers;
    if n < 10.0 {
        return num.units[n as usize].clone();
    }
    if n < 20.0 {
        return num.teens[(n - 10.0) as usize].clone();
    }
    if n < 100.0 {
        let t = (n / 10.0).floor();
        let u = n % 10.0;
        let mut tens = num.tens[t as usize].clone();
        if u == 1.0 || u == 8.0 {
            tens.pop();
        }
        let unit = if u == 3.0 {
            "tré".to_string()
        } else if u != 0.0 {
            num.units[u as usize].clone()
        } else {
            String::new()
        };
        return tens + &unit;
    }
    let h = (n / 100.0).floor();
    let r = n % 100.0;
    let hundreds = if h > 1.0 { num.units[h as usize].clone() } else { String::new() } + &num.hundred;
    hundreds + &if r != 0.0 { under1000(r) } else { String::new() }
}

/// Spoken Italian for a non-negative integer: thousands fused, millions split into words.
pub fn number_words(n: f64) -> JsString {
    js(&number_words_s(n))
}

fn number_words_s(n: f64) -> String {
    let num = &MANIFEST.numbers;
    if n == 0.0 {
        return num.units[0].clone();
    }
    let mut parts: Vec<String> = Vec::new();
    let millions = (n / 1000000.0).floor();
    let rest = n % 1000000.0;
    if millions != 0.0 {
        parts.push(if millions == 1.0 {
            format!("un {}", num.million)
        } else {
            format!("{} {}", number_words_s(millions), num.millions)
        });
    }
    if rest != 0.0 || millions == 0.0 {
        let thousands = (rest / 1000.0).floor();
        let under = rest % 1000.0;
        let mut group = String::new();
        if thousands == 1.0 {
            group += &num.thousand;
        } else if thousands > 1.0 {
            group += &(under1000(thousands) + &num.thousands);
        }
        if under != 0.0 || thousands == 0.0 {
            group += &under1000(under);
        }
        if !group.is_empty() {
            parts.push(group);
        }
    }
    parts.join(" ")
}

/// `SYMBOLS` (italian.ts): the shared tier, from the manifest's `symbolTier` and `signWords`. Only the POSTPOSED currency
/// sign reaches it (normalize.rs claims the preposed form).
fn build_symbols(m: &ItalianManifest) -> Result<SymbolNormalizer, String> {
    let t = &m.symbol_tier;
    let b = &t.bare_exponent;
    make_symbol_normalizer(&SymbolData {
        multiply: Some(Multiply { times: m.sign_words.times.clone(), by: None }),
        ampersand: Some(m.sign_words.ampersand.clone()),
        percent: Some(t.percent.clone()),
        currency: Some(t.currency.clone()),
        magnitudes: Some(t.magnitudes.clone()),
        magnitude_connective: Some(t.magnitude_connective.clone()),
        units: Some(t.units.clone()),
        exponent_words: Some(ExponentWords {
            squared: Some(t.exponent_words.squared.clone()),
            cubed: Some(t.exponent_words.cubed.clone()),
            position: None,
        }),
        bare_exponent: Some(BareExponent {
            squared: Some(b.squared.clone()),
            cubed: Some(b.cubed.clone()),
            power: Some(b.power.clone()),
            negative: Some(b.negative.clone()),
        }),
        ..Default::default()
    })
}

const NATIVE_CLASS: &str = "[a-zA-ZàèéìíîòóùúÀÈÉÌÍÎÒÓÙÚ]";

pub struct ItalianPhonemizer {
    token: JsRegex,
    nat: Box<dyn Fn(&JsString) -> JsString + Send + Sync>,
    clause_mark: HashMap<JsString, JsString>,
    symbols: SymbolNormalizer,
}

fn is_safe_integer(n: f64) -> bool {
    n.is_finite() && n.fract() == 0.0 && n.abs() <= 9007199254740991.0
}

impl ItalianPhonemizer {
    fn emit_number(sink: &mut crate::core::clauses::ClauseSink, n: f64) {
        for wd in number_words(n).split(&js(" ")) {
            sink.emit(&phonemize_word(&wd));
        }
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = normalize_italian_decimals(&self.symbols.apply(&normalize_italian_initialisms(
            &normalize_italian(input),
        )));
        assemble_clauses(&normalized, &self.token, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&(self.nat)(&w)));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                let num = js_number(&d);
                if is_safe_integer(num) {
                    Self::emit_number(sink, num);
                } else {
                    for u in d.units() {
                        Self::emit_number(sink, (u - b'0' as u16) as f64);
                    }
                }
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty()) {
                if let Some(mk) = self.clause_mark.get(&p).filter(|mk| !mk.is_empty()) {
                    sink.pause(mk);
                }
            }
        })
    }
}

/// Build the Italian phonemizer (no data beyond the manifest: the engine is rule-based).
pub fn create_italian() -> Result<ItalianPhonemizer, String> {
    let m = try_manifest()?;
    Ok(ItalianPhonemizer {
        token: JsRegex::new(&format!(r"({})|(\d+)|([.?!,;:])", *LATIN_RUN), "gu").map_err(|e| e.to_string())?,
        nat: Box::new(make_nativiser(NATIVE_CLASS, "u")),
        symbols: build_symbols(m)?,
        clause_mark: m.clause_punctuation.iter().map(|(k, v)| (js(k), js(v))).collect(),
    })
}

impl crate::registry::Engine for ItalianPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, crate::registry::PhonemizeError> {
        Ok(ItalianPhonemizer::text(self, input))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Expectations are the TS engine's outputs (fn-diff it-g2p), not hand-derived IPA.
    #[test]
    fn js_empty_includes_is_reproduced() {
        // `isVowelLetter(nx ?? "")` is true word-finally, so a final ⟨s⟩ after a vowel voices (a TS finding).
        assert_eq!(phonemize_word(&js("gas")), js("ɡˈaz"));
        assert_eq!(phonemize_word(&js("magn")), js("mˈaɲɲ"));
        assert_eq!(phonemize_word(&js("qu")), js("kw"));
    }

    #[test]
    fn ordinals_compose_from_the_cardinal() {
        use super::super::roman_ordinals::italian_ordinal;
        assert_eq!(italian_ordinal(23.0), Some(js("ventitreesimo")));
        assert_eq!(italian_ordinal(3000.0), Some(js("tremillesimo")));
        assert_eq!(italian_ordinal(1e6), None);
        assert_eq!(number_words(21.0), js("ventuno"));
    }
}
