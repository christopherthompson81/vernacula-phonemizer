//! Hindi (hi) text normalization: era markers, ordinal suffixes, abbreviations, Devanagari units, degrees,
//! clock times, signs and fractions rewritten into words before tokenizing. Pure text to text.
//! Ported from src/languages/hindi/normalize.ts — see that file for the corpus evidence.

use indexmap::IndexMap;

use super::manifest::{OrdinalSuffixes, try_manifest};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::numbers::{NumbersDef, indic_number_words_js};
use crate::core::postposed_sign::postposed_sign;
use crate::core::provenance::{escape, rewrite, rewrite_with};
use crate::js_re;
use crate::registry::PhonemizeError;

// Generated from the TS object literals by .probe/hi/gen_tables.mts (key order preserved).
const UNIT_WORD: [(&str, &str); 8] = [
    ("किमी", "किलोमीटर"),
    ("किमी/घंटा", "किलोमीटर प्रति घंटा"),
    ("किग्रा", "किलोग्राम"),
    ("सेमी", "सेंटीमीटर"),
    ("मिमी", "मिलीमीटर"),
    ("ग्रा", "ग्राम"),
    ("मि", "मिनट"),
    ("मी/से", "मीटर प्रति सेकंड"),
];
const ABBREV: [(&str, &str); 7] = [
    ("डॉ", "डॉक्टर"),
    ("प्रो", "प्रोफ़ेसर"),
    ("कु", "कुमारी"),
    ("श्रीमती", "श्रीमती"),
    ("सं", "संख्या"),
    ("पृ", "पृष्ठ"),
    ("अध्या", "अध्याय"),
];

/// Keys sorted longest first (UTF-16 length, a stable sort as V8's is), joined with `|`.
fn by_length(keys: &[&str]) -> Vec<String> {
    let mut k: Vec<&str> = keys.to_vec();
    k.sort_by(|a, b| js(b).len().cmp(&js(a).len()));
    k.into_iter().map(String::from).collect()
}

/// `alt(keys)`: longest first, regex metacharacters escaped.
fn alt(keys: &[&str]) -> String {
    by_length(keys)
        .iter()
        .map(|k| escape(k))
        .collect::<Vec<_>>()
        .join("|")
}

/// A JS object's own-key order: canonical array-index keys first, ascending, then the rest in insertion
/// order (`JSON.parse` builds the object, so the jsonc's `"1": …` keys are reordered this way).
fn js_key_order<V>(m: &IndexMap<String, V>) -> Vec<(&String, &V)> {
    let index = |k: &str| -> Option<u64> {
        let ok = !k.is_empty()
            && k.bytes().all(|b| b.is_ascii_digit())
            && (k == "0" || !k.starts_with('0'));
        ok.then(|| k.parse::<u64>().ok())
            .flatten()
            .filter(|&n| n < u32::MAX as u64)
    };
    let mut ints: Vec<(u64, (&String, &V))> = m
        .iter()
        .filter_map(|(k, v)| index(k).map(|n| (n, (k, v))))
        .collect();
    ints.sort_by_key(|(n, _)| *n);
    let mut out: Vec<(&String, &V)> = ints.into_iter().map(|(_, kv)| kv).collect();
    out.extend(m.iter().filter(|(k, _)| index(k).is_none()));
    out
}

/// `indicNumberWords(n, numbers).map((w) => w ?? "")`. An unsafe integer is a gap (`[""]`), so the ordinal
/// declines and the number path spells the digits.
fn cardinal(n: f64, d: &NumbersDef) -> Vec<String> {
    indic_number_words_js(n, d)
        .into_iter()
        .map(|w| w.unwrap_or_default())
        .collect()
}

fn join(words: &[String]) -> String {
    words.join(" ")
}

/// The language's own ordinal data, when it declares any; Hindi's is the default.
#[derive(Default, Clone, Copy)]
pub struct OwnOrdinals<'a> {
    pub irregular_ordinals: Option<&'a IndexMap<String, Vec<String>>>,
    pub ordinal_suffixes: Option<&'a OrdinalSuffixes>,
}

/// A text pass that may fail as its TS twin may throw.
pub type TextFn = Box<dyn Fn(&JsString) -> Result<JsString, PhonemizeError> + Send + Sync>;

/// `makeHindiNormalizer(numbers, own)`.
pub fn make_hindi_normalizer(numbers: &NumbersDef, own: OwnOrdinals) -> Result<TextFn, String> {
    let manifest = try_manifest()?;
    let irregular: IndexMap<String, Vec<String>> = own
        .irregular_ordinals
        .or(manifest.irregular_ordinals.as_ref())
        .cloned()
        .unwrap_or_default();
    // ⚠ `own?.ordinalSuffixes ?? DEFAULT_SUFFIXES`: a language declaring none falls back to HINDI's, as the TS does.
    let ord_suf = own
        .ordinal_suffixes
        .or(manifest.ordinal_suffixes.as_ref())
        .cloned();
    let suffix_form: IndexMap<String, usize> = ord_suf
        .as_ref()
        .map(|o| o.regular.clone())
        .unwrap_or_default();
    let suppletive: IndexMap<String, String> = ord_suf
        .as_ref()
        .map(|o| o.suppletive_consonants.clone())
        .unwrap_or_default();
    let vowel_form: IndexMap<String, usize> = ord_suf
        .as_ref()
        .map(|o| o.vowel_forms.clone())
        .unwrap_or_default();
    let numbers = numbers.clone();

    let suffix_keys: Vec<&str> = js_key_order(&suffix_form)
        .into_iter()
        .map(|(k, _)| k.as_str())
        .collect();
    let pattern_error =
        |what: &str, e: crate::core::js_regex::JsRegexError| format!("hindi {what} pattern: {e}");
    let ordinal_re = (!suffix_form.is_empty())
        .then(|| {
            JsRegex::new(
                &format!(
                    r"(?<![\d.,])(\d+)\s?({})(?![\p{{L}}\p{{M}}])",
                    alt(&suffix_keys)
                ),
                "gu",
            )
            .map_err(|e| pattern_error("ordinal", e))
        })
        .transpose()?;
    let suppletive_re = (!suppletive.is_empty())
        .then(|| {
            let mut cons: Vec<&str> = Vec::new();
            for (_, v) in js_key_order(&suppletive) {
                if !cons.contains(&v.as_str()) {
                    cons.push(v);
                }
            }
            let vowels: Vec<&str> = js_key_order(&vowel_form)
                .into_iter()
                .map(|(k, _)| k.as_str())
                .collect();
            JsRegex::new(
                &format!(
                    r"(?<![\d.,])(\d)({})({})(?![\p{{L}}\p{{M}}])",
                    alt(&cons),
                    alt(&vowels)
                ),
                "gu",
            )
            .map_err(|e| pattern_error("suppletive", e))
        })
        .transpose()?;
    let abbrev_alt = by_length(&ABBREV.map(|(k, _)| k)).join("|");
    let abbrev_re = JsRegex::new(
        &format!(r"(?<![\p{{L}}\p{{M}}])({abbrev_alt})\.?(\s+)(?=[\p{{L}}])"),
        "gu",
    )
    .map_err(|e| pattern_error("abbreviation", e))?;
    let unit_alt = by_length(&UNIT_WORD.map(|(k, _)| k)).join("|");
    let unit_re = JsRegex::new(&format!(r"(\d)\s?({unit_alt})(?![\p{{L}}\p{{M}}])"), "gu")
        .map_err(|e| pattern_error("unit", e))?;

    Ok(Box::new(
        move |input: &JsString| -> Result<JsString, PhonemizeError> {
            let d = &numbers;
            // `IRREGULAR_L[n]`: the key is `String(n)`.
            let irregular_at =
                |n: f64| -> Option<&Vec<String>> { irregular.get(&js_number_to_string(n)) };
            let card = |n: f64| cardinal(n, d);
            let ordinal = |n: f64, form: usize, suffix: &str| -> Option<String> {
                if let Some(irr) = irregular_at(n) {
                    return irr.get(form).cloned();
                }
                let mut words = cardinal(n, d);
                if words.is_empty() || words.iter().any(|w| w.is_empty()) {
                    return None;
                }
                let last = words.len() - 1;
                words[last] = format!("{}{suffix}", words[last]);
                Some(join(&words))
            };
            let mut s = input.clone();

            // 1) Era markers.
            s = rewrite(
                &s,
                js_re!(r"(?<![\p{L}\p{M}])ई\.?\s?स\.?\s?पू\.?", "gu"),
                &js("ईसा पूर्व"),
            );
            s = rewrite(
                &s,
                js_re!(r"(?<![\p{L}\p{M}])ई\.?\s?पू\.?", "gu"),
                &js("ईसा पूर्व"),
            );

            // 2) Ordinal suffixes.
            if let Some(re) = &ordinal_re {
                s = rewrite_with(&s, re, |m, full| {
                    let digits = m.group(1, full).unwrap_or_default();
                    let suffix = m.group(2, full).unwrap_or_default().to_string_lossy();
                    let Some(&form) = suffix_form.get(suffix.as_str()) else {
                        return m.value(full);
                    };
                    ordinal(js_number(&digits), form, &suffix)
                        .map_or_else(|| m.value(full), |o| js(&o))
                });
            }

            // 2b) Suppletive spellings.
            if let Some(re) = &suppletive_re {
                s = rewrite_with(&s, re, |m, full| {
                    let dg = m.group(1, full).unwrap_or_default().to_string_lossy();
                    let cons = m.group(2, full).unwrap_or_default().to_string_lossy();
                    let vowel = m.group(3, full).unwrap_or_default().to_string_lossy();
                    if suppletive.get(&dg) != Some(&cons) {
                        return m.value(full);
                    }
                    vowel_form
                        .get(&vowel)
                        .and_then(|&f| irregular_at(js_number(&js(&dg))).and_then(|irr| irr.get(f)))
                        .map_or_else(|| m.value(full), |w| js(w))
                });
            }

            // 3) Abbreviations.
            s = rewrite_with(&s, &abbrev_re, |m, full| {
                let ab = m.group(1, full).unwrap_or_default().to_string_lossy();
                let Some(word) = ABBREV.iter().find(|(k, _)| *k == ab).map(|(_, v)| *v) else {
                    return m.value(full);
                };
                js(word).concat(&m.group(2, full).unwrap_or_default())
            });

            // 4) Devanagari unit abbreviations.
            s = rewrite_with(&s, &unit_re, |m, full| {
                let u = m.group(2, full).unwrap_or_default().to_string_lossy();
                let Some(word) = UNIT_WORD.iter().find(|(k, _)| *k == u).map(|(_, v)| *v) else {
                    return m.value(full);
                };
                m.group(1, full)
                    .unwrap_or_default()
                    .concat(&js(&format!(" {word}")))
            });

            // 5) Degrees: coordinates, then ℃/℉, then °C/°F, then the bare sign.
            s = rewrite_with(
                &s,
                js_re!(r#"(\d)\s?[°º]\s?(\d+)\s?[´′'](?:\s?(\d+)\s?[″"])?"#, "gu"),
                |m, full| {
                    let deg = m.group(1, full).unwrap_or_default().to_string_lossy();
                    let min = m.group(2, full).unwrap_or_default().to_string_lossy();
                    let sec = m
                        .group(3, full)
                        .map(|x| format!(" {} सेकंड", x.to_string_lossy()))
                        .unwrap_or_default();
                    js(&format!("{deg} डिग्री {min} मिनट{sec}"))
                },
            );
            s = rewrite(&s, js_re!(r"(\d)\s?℃", "gu"), &js("$1 डिग्री सेल्सियस"));
            s = rewrite(&s, js_re!(r"(\d)\s?℉", "gu"), &js("$1 डिग्री फ़ारेनहाइट"));
            s = rewrite(
                &s,
                js_re!(r"(\d)\s?[°º]\s?C(?![\p{L}])", "giu"),
                &js("$1 डिग्री सेल्सियस"),
            );
            s = rewrite(
                &s,
                js_re!(r"(\d)\s?[°º]\s?F(?![\p{L}])", "giu"),
                &js("$1 डिग्री फ़ारेनहाइट"),
            );
            s = rewrite(&s, js_re!(r"(\d)\s?[°º]", "gu"), &js("$1 डिग्री"));

            // 6) Times.
            s = rewrite_with(
                &s,
                js_re!(
                    r"(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(\s*बजे)?",
                    "gu"
                ),
                |m, full| {
                    let h = m.group(1, full).unwrap_or_default();
                    let min = m.group(2, full).unwrap_or_default();
                    let hw = join(&card(js_number(&h)));
                    if js_number(&min) == 0.0 {
                        let baje = m
                            .group(3, full)
                            .map_or_else(|| " बजे".to_string(), |b| b.to_string_lossy());
                        return js(&format!("{hw}{baje}"));
                    }
                    js(&format!("{hw} बजकर {} मिनट", join(&card(js_number(&min)))))
                },
            );

            // 7) Plus.
            s = rewrite(&s, js_re!(r"(\S)\+\s?(\d)", "gu"), &js("$1 प्लस $2"));
            s = rewrite(&s, js_re!(r"(^|\s)\+\s?(\d)", "gu"), &js("$1प्लस $2"));

            // 7b) Minus, where it is unambiguous.
            s = rewrite(&s, js_re!(r"(^|[(\[（])\s?[-−–](\d)", "gu"), &js("$1ऋण $2"));
            s = rewrite(
                &s,
                js_re!(
                    r"(?<![\p{L}\p{M}\p{Nd}-])[-−–](\d+(?:[.,]\d+)?)(?=\s?(?:°|℃|℉|डिग्री))",
                    "gu"
                ),
                &js("ऋण $1"),
            );
            s = rewrite(
                &s,
                js_re!(
                    r"(?<![\p{L}\p{M}\p{Nd}-])(?<!\p{Nd}[\p{L}\p{M}]{0,2}[.,]?[ \t]?)[-−–](\d+[.,]\d+)(?![\d.,])",
                    "gu"
                ),
                &js("ऋण $1"),
            );

            // 7c) The remaining signs.
            s = postposed_sign(&s, "<", &js("से कम"));
            s = postposed_sign(&s, ">", &js("से अधिक"));
            s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" बराबर "));
            s = rewrite(&s, js_re!(r"\s?×\s?", "gu"), &js(" गुणा "));
            s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" भाग "));
            s = rewrite(&s, js_re!(r"±", "gu"), &js(" धन ऋण "));
            s = rewrite(
                &s,
                js_re!(r"(?<=[A-Za-z])\s?&\s?(?=[A-Za-z])", "gu"),
                &js(" and "),
            );
            s = rewrite(&s, js_re!(r"\s?&\s?", "gu"), &js(" और "));

            // 8) Fractions. The two guards are mirrors (as ur and cmn, #1477/#1492): each side refuses a
            //    digit or `/`, a `.` with a digit beyond it (a decimal), and a grouped number — a `,` before
            //    exactly three digits, or (right side) the Indian lakh group `,dd,`. Any other `,` is a list
            //    separator.
            s = rewrite_with(
                &s,
                js_re!(
                    r"(?<![\d/]|\d\.|\d,(?=\d{3}\/))(\d{1,3})\/(\d{1,3})(?![\d/]|\.\d|,(?:\d{3}(?!\d)|\d{2},\d))",
                    "gu"
                ),
                |m, full| {
                    let num = js_number(&m.group(1, full).unwrap_or_default());
                    let den = js_number(&m.group(2, full).unwrap_or_default());
                    if num == 1.0 && den == 2.0 {
                        return js("आधा");
                    }
                    if num == 1.0 && den == 4.0 {
                        return js("चौथाई");
                    }
                    if den == 3.0 {
                        return js(&format!("{} तिहाई", join(&card(num))));
                    }
                    let (nw, dw) = (join(&card(num)), join(&card(den)));
                    if nw.is_empty() || dw.is_empty() {
                        m.value(full)
                    } else {
                        js(&format!("{nw} बटा {dw}"))
                    }
                },
            );

            Ok(s)
        },
    ))
}
