//! Bengali (bn) text normalization: the digit fold, abbreviations, ordinal suffixes, unit abbreviations, degrees,
//! the clock, signs, the relational and division signs and fractions rewritten into words before tokenizing.
//! Pure text to text; it also serves as and bpy, through the shared maker.
//! Ported from src/languages/bengali/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::try_manifest;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::numbers::{NumbersDef, indic_number_words_js};
use crate::core::postposed_sign::postposed_sign;
use crate::core::provenance::{rewrite, rewrite_with};
use crate::core::unicode::BENGALI_DIGITS;
use crate::js_re;

// Generated from the TS object literals (key order preserved).
const DATE_SUPPLETIVE: [(f64, &str); 4] =
    [(1.0, "পহেলা"), (2.0, "দোসরা"), (3.0, "তেসরা"), (4.0, "চৌঠা")];
const CLASSICAL_SUFFIX: [&str; 5] = ["ম", "য়", "র্থ", "ষ্ঠ", "তম"];
const DATE_SUFFIX: [&str; 5] = ["শে", "ই", "লা", "রা", "ঠা"];
const UNIT_WORD: [(&str, &str); 7] = [
    ("কিমি", "কিলোমিটার"),
    ("কিমি/ঘন্টা", "কিলোমিটার প্রতি ঘন্টা"),
    ("সেমি", "সেন্টিমিটার"),
    ("মিমি", "মিলিমিটার"),
    ("কেজি", "কিলোগ্রাম"),
    ("গ্রা", "গ্রাম"),
    ("মি", "মিটার"),
];
const ABBREV: [(&str, &str); 4] = [("ড", "ডক্টর"), ("অধ্যা", "অধ্যায়"), ("পৃ", "পৃষ্ঠা"), ("সং", "সংখ্যা")];

pub type BengaliNormalizer = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;

fn lookup<'a>(table: &[(&'a str, &'a str)], k: &str) -> Option<&'a str> {
    table.iter().find(|(key, _)| *key == k).map(|(_, v)| *v)
}

/// `Object.keys(t).sort((a, b) => b.length - a.length).join("|")`: UTF-16 length, stable.
pub fn by_length_alt(table: &[(&str, &str)]) -> String {
    let mut k: Vec<&str> = table.iter().map(|(k, _)| *k).collect();
    k.sort_by_key(|a| std::cmp::Reverse(js(a).len()));
    k.join("|")
}

/// `Object.keys(BENGALI_DIGITS).join("")`.
pub fn bn_digit() -> String {
    BENGALI_DIGITS
        .iter()
        .map(|(k, _)| k.to_string_lossy())
        .collect()
}

/// `D`: either digit system.
pub static D: LazyLock<String> = LazyLock::new(|| format!("0-9{}", bn_digit()));

/// `toAscii(s)`: Bengali digits folded to ASCII, code point by code point.
pub fn to_ascii(s: &JsString) -> JsString {
    let mut out = JsString::new();
    for c in s.code_point_strings() {
        match BENGALI_DIGITS.iter().find(|(k, _)| *k == c) {
            Some((_, a)) => out.push_str(a),
            None => out.push_str(&c),
        }
    }
    out
}

/// `indicNumberWords(n, numbers).map((w) => w ?? "").join(" ")`.
pub fn cardinal(n: f64, numbers: &NumbersDef) -> String {
    indic_number_words_js(n, numbers)
        .into_iter()
        .map(|w| w.unwrap_or_default())
        .collect::<Vec<_>>()
        .join(" ")
}

fn re(pattern: String) -> JsRegex {
    JsRegex::new(&pattern, "gu").unwrap_or_else(|e| panic!("bengali normalize pattern: {e}"))
}

static ABBREV_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(format!(
        r"(?<![\p{{L}}\p{{M}}])({})[ঃ.]\s*(?=[\p{{L}}])",
        by_length_alt(&ABBREV)
    ))
});
static UNIT_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(format!(
        r"([{}])\s?({})(?![\p{{L}}\p{{M}}])",
        *D,
        by_length_alt(&UNIT_WORD)
    ))
});
static DEG_C: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"([{}])\s?°\s?C(?![\p{{L}}])", *D), "giu").unwrap());
static DEG_F: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"([{}])\s?°\s?F(?![\p{{L}}])", *D), "giu").unwrap());
static DEG: LazyLock<JsRegex> = LazyLock::new(|| re(format!(r"([{}])\s?°", *D)));
static CLOCK: LazyLock<JsRegex> = LazyLock::new(|| {
    let d = &*D;
    re(format!(
        r"(?<![{d}:])([{d}]{{1,2}}):([{d}]{{2}})(?![{d}:])(\s*টা)?"
    ))
});
static MINUS: LazyLock<JsRegex> = LazyLock::new(|| re(format!(r"(^|[\s(])[-−–]([{}])", *D)));
static PLUS_GLUED: LazyLock<JsRegex> = LazyLock::new(|| re(format!(r"(\S)\+\s?([{}])", *D)));
static PLUS_OPEN: LazyLock<JsRegex> = LazyLock::new(|| re(format!(r"(^|\s)\+\s?([{}])", *D)));
static FRACTION: LazyLock<JsRegex> = LazyLock::new(|| {
    let d = &*D;
    re(format!(
        r"(?<![{d}.,/])([{d}]{{1,3}})/([{d}]{{1,3}})(?![{d}/])"
    ))
});

/// `makeBengaliNormalizer(numbers)`. The ordinal tables are BENGALI's whatever language passes its numbers, as
/// the TS module-level `DEF` is.
pub fn make_bengali_normalizer(numbers: &NumbersDef) -> Result<BengaliNormalizer, String> {
    let ords = try_manifest()?
        .ordinals
        .clone()
        .ok_or("bengali.jsonc declares no `ordinals`")?;
    let ordinal_re = re(format!(
        r"(?<![{d}.,])([{d}]+)\s?({})(?![\p{{L}}\p{{M}}])",
        ords.suffixes.join("|"),
        d = *D
    ));
    let numbers = numbers.clone();
    Ok(Box::new(move |input: &JsString| -> JsString {
        let d = &numbers;
        let card = |n: f64| cardinal(n, d);
        let ordinal = |n: f64, suffix: &str| -> Option<String> {
            if DATE_SUFFIX.contains(&suffix)
                && let Some((_, w)) = DATE_SUPPLETIVE.iter().find(|(k, _)| *k == n)
            {
                return Some(w.to_string());
            }
            if CLASSICAL_SUFFIX.contains(&suffix)
                && let Some(w) = ords.suppletive.get(&js_number_to_string(n))
            {
                return Some(w.clone());
            }
            let mut words: Vec<String> = card(n).split(' ').map(str::to_string).collect();
            if words.iter().any(|w| w.is_empty()) {
                return None;
            }
            let last = words.len() - 1;
            words[last] = format!("{}{suffix}", words[last]);
            Some(words.join(" "))
        };

        // 0) The digit fold: a plain rebuild, not a rewrite, as the TS `[...input].map(…).join("")` is.
        let mut s = to_ascii(input);

        // 1) Abbreviations.
        s = rewrite_with(&s, &ABBREV_RE, |m, full| {
            let ab = m.group(1, full).unwrap_or_default().to_string_lossy();
            js(&format!("{} ", lookup(&ABBREV, &ab).unwrap_or_default()))
        });

        // 2) Ordinal suffixes.
        s = rewrite_with(&s, &ordinal_re, |m, full| {
            let digits = m.group(1, full).unwrap_or_default();
            let suffix = m.group(2, full).unwrap_or_default().to_string_lossy();
            ordinal(js_number(&to_ascii(&digits)), &suffix)
                .map_or_else(|| m.value(full), |o| js(&o))
        });

        // 3) Bengali unit abbreviations.
        s = rewrite_with(&s, &UNIT_RE, |m, full| {
            let u = m.group(2, full).unwrap_or_default().to_string_lossy();
            m.group(1, full).unwrap_or_default().concat(&js(&format!(
                " {}",
                lookup(&UNIT_WORD, &u).unwrap_or_default()
            )))
        });

        // 4) Degrees.
        s = rewrite(&s, &DEG_C, &js("$1 ডিগ্রি সেলসিয়াস"));
        s = rewrite(&s, &DEG_F, &js("$1 ডিগ্রি ফারেনহাইট"));
        s = rewrite(&s, &DEG, &js("$1 ডিগ্রি"));

        // 5) Clock.
        s = rewrite_with(&s, &CLOCK, |m, full| {
            let hv = js_number(&to_ascii(&m.group(1, full).unwrap_or_default()));
            let mv = js_number(&to_ascii(&m.group(2, full).unwrap_or_default()));
            if hv > 23.0 || mv > 59.0 {
                return m.value(full);
            }
            if mv == 0.0 {
                let ta = m.group(3, full).unwrap_or_else(|| js("টা"));
                return js(&card(hv)).concat(&ta);
            }
            js(&format!("{}টা {} মিনিট", card(hv), card(mv)))
        });

        // 6) Signs.
        s = rewrite(&s, &MINUS, &js("$1ঋণাত্মক $2"));
        s = rewrite(&s, &PLUS_GLUED, &js("$1 যোগ $2"));
        s = rewrite(&s, &PLUS_OPEN, &js("$1যোগ $2"));

        s = postposed_sign(&s, "<", &js("থেকে কম"));
        s = postposed_sign(&s, ">", &js("থেকে বেশি"));
        s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" সমান "));
        s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" ভাগ "));

        // 7) Fractions.
        s = rewrite_with(&s, &FRACTION, |m, full| {
            let num = js_number(&to_ascii(&m.group(1, full).unwrap_or_default()));
            let den = js_number(&to_ascii(&m.group(2, full).unwrap_or_default()));
            if num == 1.0 && den == 2.0 {
                return js("অর্ধেক");
            }
            let (nw, dw) = (card(num), card(den));
            if nw.is_empty() || dw.is_empty() {
                return m.value(full);
            }
            js(&format!("{dw} ভাগের {nw}"))
        });

        s
    }))
}
