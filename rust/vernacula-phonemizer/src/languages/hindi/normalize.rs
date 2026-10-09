//! Hindi (hi) text normalization: era markers, ordinal suffixes, abbreviations, Devanagari units, degrees,
//! clock times, signs and fractions rewritten into words before tokenizing. Pure text to text.
//! Ported from src/languages/hindi/normalize.ts — see that file for the corpus evidence.

use indexmap::IndexMap;

use super::manifest::{OrdinalSuffixes, try_manifest};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::numbers::{NumbersDef, indic_number_words};
use crate::core::postposed_sign::postposed_sign;
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

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

const MAX_SAFE: f64 = 9_007_199_254_740_991.0;

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
        .map(|k| {
            let mut out = String::new();
            for c in k.chars() {
                if ".*+?^${}()|[]\\".contains(c) {
                    out.push('\\');
                }
                out.push(c);
            }
            out
        })
        .collect::<Vec<_>>()
        .join("|")
}

/// A JS object's own-key order: canonical array-index keys first, ascending, then the rest in insertion
/// order (`JSON.parse` builds the object, so the jsonc's `"1": …` keys are reordered this way).
fn js_key_order<V>(m: &IndexMap<String, V>) -> Vec<(&String, &V)> {
    let index = |k: &str| -> Option<u64> {
        let ok = !k.is_empty() && k.bytes().all(|b| b.is_ascii_digit()) && (k == "0" || !k.starts_with('0'));
        ok.then(|| k.parse::<u64>().ok()).flatten().filter(|&n| n < u32::MAX as u64)
    };
    let mut ints: Vec<(u64, (&String, &V))> = m.iter().filter_map(|(k, v)| index(k).map(|n| (n, (k, v)))).collect();
    ints.sort_by_key(|(n, _)| *n);
    let mut out: Vec<(&String, &V)> = ints.into_iter().map(|(_, kv)| kv).collect();
    out.extend(m.iter().filter(|(k, _)| index(k).is_none()));
    out
}

/// `String(n)` for a non-negative integer that may be a table key; `None` where no small key could match.
fn int_key(n: f64) -> Option<String> {
    (n.fract() == 0.0 && (0.0..=MAX_SAFE).contains(&n)).then(|| (n as u64).to_string())
}

/// `indicNumberWords(n, numbers).map((w) => w ?? "")`, for the `Number(...)` of a digit run.
///
/// ⚠ ABOVE 2^53 THE TS COMPOSES THE FLOAT: the crore arm splits `Math.floor(n / 1e7)` and `n % 1e7` in
/// doubles, so a long ordinal reads a quantity the text did not write. Reproduced here (only that arm is
/// reachable above 2^53); below it the shared u64 composer is exact and identical. A digit run of 309 or more
/// digits is `Infinity` and the TS recursion overflows the stack (a RangeError out of `phonemize`); that
/// throw is reproduced as a panic.
fn cardinal(n: f64, d: &NumbersDef) -> Vec<String> {
    if n <= MAX_SAFE {
        return indic_number_words(n as u64, d).into_iter().map(|w| w.unwrap_or_default()).collect();
    }
    if !n.is_finite() {
        panic!("RangeError: Maximum call stack size exceeded (indicNumberWords(Infinity), as in the TS)");
    }
    let (c, r) = ((n / 10_000_000.0).floor(), n % 10_000_000.0);
    let mut out = cardinal(c, d);
    out.push(d.magnitudes.crore.clone().unwrap_or_default());
    if r != 0.0 {
        out.extend(cardinal(r, d));
    }
    out
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

pub type TextFn = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;

/// `makeHindiNormalizer(numbers, own)`.
pub fn make_hindi_normalizer(numbers: &NumbersDef, own: OwnOrdinals) -> Result<TextFn, String> {
    let manifest = try_manifest()?;
    let irregular: IndexMap<String, Vec<String>> =
        own.irregular_ordinals.or(manifest.irregular_ordinals.as_ref()).cloned().unwrap_or_default();
    // ⚠ `own?.ordinalSuffixes ?? DEFAULT_SUFFIXES`: a language declaring none falls back to HINDI's, as the TS does.
    let ord_suf = own.ordinal_suffixes.or(manifest.ordinal_suffixes.as_ref()).cloned();
    let suffix_form: IndexMap<String, usize> = ord_suf.as_ref().map(|o| o.regular.clone()).unwrap_or_default();
    let suppletive: IndexMap<String, String> =
        ord_suf.as_ref().map(|o| o.suppletive_consonants.clone()).unwrap_or_default();
    let vowel_form: IndexMap<String, usize> = ord_suf.as_ref().map(|o| o.vowel_forms.clone()).unwrap_or_default();
    let numbers = numbers.clone();

    let suffix_keys: Vec<&str> = js_key_order(&suffix_form).into_iter().map(|(k, _)| k.as_str()).collect();
    let ordinal_re = (!suffix_form.is_empty()).then(|| {
        JsRegex::new(
            &format!(r"(?<![\d.,])(\d+)\s?({})(?![\p{{L}}\p{{M}}])", alt(&suffix_keys)),
            "gu",
        )
        .expect("ordinal pattern")
    });
    let suppletive_re = (!suppletive.is_empty()).then(|| {
        let mut cons: Vec<&str> = Vec::new();
        for (_, v) in js_key_order(&suppletive) {
            if !cons.contains(&v.as_str()) {
                cons.push(v);
            }
        }
        let vowels: Vec<&str> = js_key_order(&vowel_form).into_iter().map(|(k, _)| k.as_str()).collect();
        JsRegex::new(
            &format!(r"(?<![\d.,])(\d)({})({})(?![\p{{L}}\p{{M}}])", alt(&cons), alt(&vowels)),
            "gu",
        )
        .expect("suppletive pattern")
    });
    let abbrev_alt = by_length(&ABBREV.map(|(k, _)| k)).join("|");
    let abbrev_re = JsRegex::new(&format!(r"(?<![\p{{L}}\p{{M}}])({abbrev_alt})\.?(\s+)(?=[\p{{L}}])"), "gu")
        .expect("abbreviation pattern");
    let unit_alt = by_length(&UNIT_WORD.map(|(k, _)| k)).join("|");
    let unit_re = JsRegex::new(&format!(r"(\d)\s?({unit_alt})(?![\p{{L}}\p{{M}}])"), "gu").expect("unit pattern");

    Ok(Box::new(move |input: &JsString| -> JsString {
        let d = &numbers;
        let irregular_at = |n: f64| -> Option<&Vec<String>> { int_key(n).and_then(|k| irregular.get(&k)) };
        let card = |n: f64| cardinal(n, d);
        let ordinal = |n: f64, form: usize, suffix: &str| -> Option<String> {
            if let Some(irr) = irregular_at(n) {
                return irr.get(form).cloned();
            }
            let mut words = card(n);
            if words.is_empty() || words.iter().any(|w| w.is_empty()) {
                return None;
            }
            let last = words.len() - 1;
            words[last] = format!("{}{suffix}", words[last]);
            Some(join(&words))
        };
        let mut s = input.clone();

        // 1) Era markers.
        s = rewrite(&s, js_re!(r"(?<![\p{L}\p{M}])ई\.?\s?स\.?\s?पू\.?", "gu"), &js("ईसा पूर्व"));
        s = rewrite(&s, js_re!(r"(?<![\p{L}\p{M}])ई\.?\s?पू\.?", "gu"), &js("ईसा पूर्व"));

        // 2) Ordinal suffixes.
        if let Some(re) = &ordinal_re {
            s = rewrite_with(&s, re, |m, full| {
                let digits = m.group(1, full).unwrap();
                let suffix = m.group(2, full).unwrap().to_string_lossy();
                let form = suffix_form[suffix.as_str()];
                ordinal(js_number(&digits), form, &suffix).map_or_else(|| m.value(full), |o| js(&o))
            });
        }

        // 2b) Suppletive spellings.
        if let Some(re) = &suppletive_re {
            s = rewrite_with(&s, re, |m, full| {
                let dg = m.group(1, full).unwrap().to_string_lossy();
                let cons = m.group(2, full).unwrap().to_string_lossy();
                let vowel = m.group(3, full).unwrap().to_string_lossy();
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
            let ab = m.group(1, full).unwrap().to_string_lossy();
            let word = ABBREV.iter().find(|(k, _)| *k == ab).map(|(_, v)| *v).unwrap();
            js(word).concat(&m.group(2, full).unwrap())
        });

        // 4) Devanagari unit abbreviations.
        s = rewrite_with(&s, &unit_re, |m, full| {
            let u = m.group(2, full).unwrap().to_string_lossy();
            let word = UNIT_WORD.iter().find(|(k, _)| *k == u).map(|(_, v)| *v).unwrap();
            m.group(1, full).unwrap().concat(&js(&format!(" {word}")))
        });

        // 5) Degrees: coordinates, then ℃/℉, then °C/°F, then the bare sign.
        s = rewrite_with(&s, js_re!(r#"(\d)\s?[°º]\s?(\d+)\s?[´′'](?:\s?(\d+)\s?[″"])?"#, "gu"), |m, full| {
            let deg = m.group(1, full).unwrap().to_string_lossy();
            let min = m.group(2, full).unwrap().to_string_lossy();
            let sec = m.group(3, full).map(|x| format!(" {} सेकंड", x.to_string_lossy())).unwrap_or_default();
            js(&format!("{deg} डिग्री {min} मिनट{sec}"))
        });
        s = rewrite(&s, js_re!(r"(\d)\s?℃", "gu"), &js("$1 डिग्री सेल्सियस"));
        s = rewrite(&s, js_re!(r"(\d)\s?℉", "gu"), &js("$1 डिग्री फ़ारेनहाइट"));
        s = rewrite(&s, js_re!(r"(\d)\s?[°º]\s?C(?![\p{L}])", "giu"), &js("$1 डिग्री सेल्सियस"));
        s = rewrite(&s, js_re!(r"(\d)\s?[°º]\s?F(?![\p{L}])", "giu"), &js("$1 डिग्री फ़ारेनहाइट"));
        s = rewrite(&s, js_re!(r"(\d)\s?[°º]", "gu"), &js("$1 डिग्री"));

        // 6) Times.
        s = rewrite_with(&s, js_re!(r"(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(\s*बजे)?", "gu"), |m, full| {
            let h = m.group(1, full).unwrap();
            let min = m.group(2, full).unwrap();
            let hw = join(&card(js_number(&h)));
            if js_number(&min) == 0.0 {
                let baje = m.group(3, full).map_or_else(|| " बजे".to_string(), |b| b.to_string_lossy());
                return js(&format!("{hw}{baje}"));
            }
            js(&format!("{hw} बजकर {} मिनट", join(&card(js_number(&min)))))
        });

        // 7) Plus.
        s = rewrite(&s, js_re!(r"(\S)\+\s?(\d)", "gu"), &js("$1 प्लस $2"));
        s = rewrite(&s, js_re!(r"(^|\s)\+\s?(\d)", "gu"), &js("$1प्लस $2"));

        // 7b) Minus, where it is unambiguous.
        s = rewrite(&s, js_re!(r"(^|[(\[（])\s?[-−–](\d)", "gu"), &js("$1ऋण $2"));
        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}\p{Nd}-])[-−–](\d+(?:[.,]\d+)?)(?=\s?(?:°|℃|℉|डिग्री))", "gu"),
            &js("ऋण $1"),
        );
        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}\p{Nd}-])(?<!\p{Nd}[\p{L}\p{M}]{0,2}[.,]?[ \t]?)[-−–](\d+[.,]\d+)(?![\d.,])", "gu"),
            &js("ऋण $1"),
        );

        // 7c) The remaining signs.
        s = postposed_sign(&s, "<", &js("से कम"));
        s = postposed_sign(&s, ">", &js("से अधिक"));
        s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" बराबर "));
        s = rewrite(&s, js_re!(r"\s?×\s?", "gu"), &js(" गुणा "));
        s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" भाग "));
        s = rewrite(&s, js_re!(r"±", "gu"), &js(" धन ऋण "));
        s = rewrite(&s, js_re!(r"(?<=[A-Za-z])\s?&\s?(?=[A-Za-z])", "gu"), &js(" and "));
        s = rewrite(&s, js_re!(r"\s?&\s?", "gu"), &js(" और "));

        // 8) Fractions.
        s = rewrite_with(&s, js_re!(r"(?<![\d.,])(\d{1,3})\/(\d{1,3})(?![\d/])", "gu"), |m, full| {
            let num = js_number(&m.group(1, full).unwrap());
            let den = js_number(&m.group(2, full).unwrap());
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
            if nw.is_empty() || dw.is_empty() { m.value(full) } else { js(&format!("{nw} बटा {dw}")) }
        });

        s
    }))
}
