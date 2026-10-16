//! Tamil (ta) text normalization: zero-width characters, native digits, de-grouping, era markers and abbreviations,
//! Tamil unit spellings, initialisms, the dative rate, the shared symbol tier, the clock, fractions, decimals,
//! signs, degrees, ordinal suffixes and the locative clitic. Pure text to text.
//! Ported from src/languages/tamil/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{TamilManifest, try_manifest};
use super::numbers::{number_to_words, ordinal_stem};
use crate::core::boundaries::{NOT_LETTER_AFTER, NOT_LETTER_BEFORE};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::postposed_sign::postposed_sign;
use crate::core::provenance::{rewrite, rewrite_with};
use crate::core::unicode::fold_native_digits;
use crate::js_re;

// Generated from the TS object literals (key order preserved).
const TAMIL_UNIT: [(&str, &str); 7] = [
    ("கிமீ", "கிலோமீட்டர்"),
    ("கிமி", "கிலோமீட்டர்"),
    ("மிமீ", "மில்லிமீட்டர்"),
    ("மிமி", "மில்லிமீட்டர்"),
    ("செமீ", "சென்டிமீட்டர்"),
    ("செமி", "சென்டிமீட்டர்"),
    ("கிகி", "கிலோகிராம்"),
];
const ERA: [(&str, &str); 2] = [("மு", "கிறிஸ்துவுக்கு முன்"), ("பி", "கிறிஸ்துவுக்கு பின்")];
const FRACTION_WORD: [(&str, &str); 3] = [("1/2", "அரை"), ("1/4", "கால்"), ("3/4", "முக்கால்")];
const RATE_DENOM: [(&str, &str); 2] = [("h", "மணிக்கு"), ("s", "வினாடிக்கு")];
const RATE_NUM: [(&str, &str); 4] = [
    ("km", "கிலோமீட்டர்"),
    ("m", "மீட்டர்"),
    ("mi", "மைல்"),
    ("ft", "அடி"),
];

fn lookup(table: &[(&str, &'static str)], k: &str) -> Option<&'static str> {
    table.iter().find(|(t, _)| *t == k).map(|(_, v)| *v)
}

/// `alt(keys)`: longest first (UTF-16 length, stable), joined.
fn alt(keys: &[&str]) -> String {
    let mut k = keys.to_vec();
    k.sort_by_key(|a| std::cmp::Reverse(js(a).len()));
    k.join("|")
}

fn re(pattern: String, flags: &str) -> JsRegex {
    JsRegex::new(&pattern, flags).unwrap_or_else(|e| panic!("tamil normalize pattern: {e}"))
}

static TAMIL_UNIT_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let keys: Vec<&str> = TAMIL_UNIT.iter().map(|(k, _)| *k).collect();
    re(
        format!("{NOT_LETTER_BEFORE}({}){NOT_LETTER_AFTER}", alt(&keys)),
        "gu",
    )
});
static TAMIL_UNIT_DOT_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(r"{NOT_LETTER_BEFORE}(கி|மி|செ)\s*\.\s*(மீ|மி){NOT_LETTER_AFTER}"),
        "gu",
    )
});
static TAMIL_UNIT_SPACED_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(r"(?<=\d\s?)(கி|மி|செ)\s(மீ|மி){NOT_LETTER_AFTER}"),
        "gu",
    )
});
static ERA_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(r"{NOT_LETTER_BEFORE}கி\s*\.?\s*(மு|பி)\.?{NOT_LETTER_AFTER}"),
        "gu",
    )
});
static EG_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(r"{NOT_LETTER_BEFORE}எ\s*\.\s*கா\s*\.?{NOT_LETTER_AFTER}"),
        "gu",
    )
});
static MR_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(r"{NOT_LETTER_BEFORE}திரு\s*\.\s*(?=[\p{{L}}])"),
        "gu",
    )
});
static RATE_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        r"(?<![\p{L}\d])(\d[\d.]*)\s?(km|mi|ft|m)\s?/\s?(h|s)(?![A-Za-z])".to_string(),
        "giu",
    )
});
static MPH_RE: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"(\d[\d.]*)\s?mph{NOT_LETTER_AFTER}"), "giu"));

/// `INITIALISM_RE`, over the letter forms longest first.
fn initialism_re(m: &TamilManifest) -> JsRegex {
    let forms: Vec<&str> = m
        .initialism_letter_forms
        .iter()
        .map(String::as_str)
        .collect();
    let letter = format!("(?:{})", alt(&forms));
    re(
        format!(
            r"{NOT_LETTER_BEFORE}{letter}(?:\s*\.\s*{letter})+(?:\s*\.(?=\s+[\p{{L}}]))?{NOT_LETTER_AFTER}"
        ),
        "gu",
    )
}

/// `dative(word, full, offset)`: the prefix, unless the text before the match already ends with it.
fn dative(word: &str, full: &JsString, offset: usize) -> JsString {
    let already = JsRegex::new(&format!(r"{word}\s*$"), "u")
        .expect("dative pattern")
        .test(&full.slice(0, Some(offset as isize)));
    if already {
        JsString::new()
    } else {
        js(&format!("{word} "))
    }
}

pub struct TamilNormalizer {
    def: &'static TamilManifest,
    symbols: SymbolNormalizer,
    initialism_re: JsRegex,
    ordinal_re: JsRegex,
}

/// The module's top-level state: the shared symbol tier over `symbolTier`, these seven fields only.
pub fn make_tamil_normalizer() -> Result<TamilNormalizer, String> {
    let def = try_manifest()?;
    let t = &def.symbol_tier;
    let symbols = make_symbol_normalizer(&SymbolData {
        percent: t.percent.clone(),
        currency: t.currency.clone(),
        units: t.units.clone(),
        exponent_words: t.exponent_words.clone(),
        magnitudes: t.magnitudes.clone(),
        ampersand: t.ampersand.clone(),
        multiply: t.multiply.clone(),
        ..Default::default()
    })?;
    let ordinal_re = re(
        format!(
            r"(?<![\d.,])(\d+)\s*-?\s*({}){NOT_LETTER_AFTER}",
            def.ordinal_suffixes.join("|")
        ),
        "gu",
    );
    Ok(TamilNormalizer {
        def,
        symbols,
        initialism_re: initialism_re(def),
        ordinal_re,
    })
}

impl TamilNormalizer {
    fn cardinal(&self, n: f64) -> JsString {
        number_to_words(n, None, &self.def.numbers)
    }

    /// `ordinal(n, suffix)`: the ordinal ending on the last cardinal word's stem, or `None`.
    fn ordinal(&self, n: f64, suffix: &JsString) -> Option<JsString> {
        let mut words = self.cardinal(n).split(&js(" "));
        let last = words.last().cloned()?;
        if last.is_empty() {
            return None;
        }
        let stem = ordinal_stem(&last)?;
        let suffix = suffix.to_string_lossy();
        let ending = if suffix == "ஆவது" || suffix == "வது" {
            "ாவது"
        } else {
            "ாம்"
        };
        let i = words.len() - 1;
        words[i] = stem.concat(&js(ending));
        Some(JsString::join(&words, &js(" ")))
    }

    /// `normalizeTamil(input)`.
    pub fn normalize(&self, input: &JsString) -> JsString {
        // Zero-width characters (the TS writes the range as literal characters).
        let mut s = rewrite(
            input,
            js_re!("[\u{200B}-\u{200D}\u{FEFF}]", "gu"),
            &JsString::new(),
        );

        s = fold_native_digits(&s);

        // Digit de-grouping (Western and Indian).
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d])0),(?=\d{2,3}(?:,\d|[^\d]|$))", "gu"),
            &JsString::new(),
        );

        // Era markers and எ.கா.
        s = rewrite_with(&s, &ERA_RE, |m, full| {
            js(lookup(
                &ERA,
                &m.group(1, full).unwrap_or_default().to_string_lossy(),
            )
            .unwrap_or_default())
        });
        s = rewrite(&s, &EG_RE, &js("எடுத்துக்காட்டாக"));

        // Tamil unit spellings: dotted, spaced after a number, then fused.
        let unit = |a: &JsString, b: &JsString| -> Option<&'static str> {
            let a = a.to_string_lossy();
            lookup(&TAMIL_UNIT, &format!("{a}{}", b.to_string_lossy()))
                .or_else(|| lookup(&TAMIL_UNIT, &format!("{a}மீ")))
        };
        s = rewrite_with(&s, &TAMIL_UNIT_DOT_RE, |m, full| {
            let (a, b) = (
                m.group(1, full).unwrap_or_default(),
                m.group(2, full).unwrap_or_default(),
            );
            unit(&a, &b).map(js).unwrap_or_else(|| a.concat(&b))
        });
        s = rewrite_with(&s, &TAMIL_UNIT_SPACED_RE, |m, full| {
            let (a, b) = (
                m.group(1, full).unwrap_or_default(),
                m.group(2, full).unwrap_or_default(),
            );
            unit(&a, &b)
                .map(js)
                .unwrap_or_else(|| a.concat(&js(" ")).concat(&b))
        });
        s = rewrite_with(&s, &TAMIL_UNIT_RE, |m, full| {
            js(lookup(
                &TAMIL_UNIT,
                &m.group(1, full).unwrap_or_default().to_string_lossy(),
            )
            .unwrap_or_default())
        });
        s = rewrite_with(&s, &self.initialism_re, |m, full| {
            js_re!(r"\s*\.\s*", "gu")
                .replace(&m.value(full), &js(" "))
                .trim()
        });
        s = rewrite(&s, &MR_RE, &js("திரு "));

        // Rates: the dative prefix, unless the text already carries it.
        s = rewrite_with(&s, &RATE_RE, |m, full| {
            let n = m.group(1, full).unwrap_or_default();
            let u = m
                .group(2, full)
                .unwrap_or_default()
                .to_lower_case()
                .to_string_lossy();
            let den = m
                .group(3, full)
                .unwrap_or_default()
                .to_lower_case()
                .to_string_lossy();
            match (lookup(&RATE_NUM, &u), lookup(&RATE_DENOM, &den)) {
                (Some(num), Some(d)) => dative(d, full, m.index())
                    .concat(&n)
                    .concat(&js(&format!(" {num}"))),
                _ => m.value(full),
            }
        });
        s = rewrite_with(&s, &MPH_RE, |m, full| {
            dative("மணிக்கு", full, m.index())
                .concat(&m.group(1, full).unwrap_or_default())
                .concat(&js(" மைல்"))
        });

        // The shared symbol tier.
        s = self.symbols.apply(&s);

        // Times: a dotted clock before UTC/GMT, :00 dropped, any other colon a space.
        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\d.:])([01]?\d|2[0-3])\.([0-5]\d)(?=\s*(?:UTC|GMT))",
                "gu"
            ),
            |m, full| {
                let h = m.group(1, full).unwrap_or_default();
                let min = m.group(2, full).unwrap_or_default();
                if js_number(&min) == 0.0 {
                    h
                } else {
                    h.concat(&js(" ")).concat(&min)
                }
            },
        );
        s = rewrite(
            &s,
            js_re!(r"(?<![\d:])([01]?\d|2[0-3]):00(?![\d:.])", "gu"),
            &js("$1"),
        );
        s = rewrite(&s, js_re!(r"(?<=\d):(?=\d)", "gu"), &js(" "));

        // Fractions.
        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\d/]|\d\.|\d,(?=\d{3}\/))(\d{1,3})\/(\d{1,3})(?![\d/]|\.\d|,(?:\d{3}(?!\d)|\d{2},\d))",
                "gu"
            ),
            |m, full| {
                let a = m.group(1, full).unwrap_or_default();
                let b = m.group(2, full).unwrap_or_default();
                let key = format!("{}/{}", a.to_string_lossy(), b.to_string_lossy());
                if let Some(lex) = lookup(&FRACTION_WORD, &key) {
                    return js(lex);
                }
                let nb = js_number(&b);
                let mut dw = self.cardinal(nb).split(&js(" "));
                let den = ordinal_stem(dw.last().unwrap_or(&JsString::new()));
                let Some(den) = den.filter(|_| nb != 0.0) else {
                    return m.value(full);
                };
                let i = dw.len() - 1;
                dw[i] = den.concat(&js("ில்"));
                let na = js_number(&a);
                let count = if na == 1.0 {
                    js("ஒரு")
                } else {
                    self.cardinal(na)
                };
                JsString::join(&dw, &js(" "))
                    .concat(&js(" "))
                    .concat(&count)
                    .concat(&js(" பங்கு"))
            },
        );

        // Decimals.
        s = rewrite_with(
            &s,
            js_re!(r"(?<![\d.])(\d+)\.(\d+)(?![\d.])", "gu"),
            |m, full| {
                let frac = m.group(2, full).unwrap_or_default();
                m.group(1, full)
                    .unwrap_or_default()
                    .concat(&js(" புள்ளி "))
                    .concat(&JsString::join(&frac.code_point_strings(), &js(" ")))
            },
        );

        // Signs.
        s = rewrite(&s, js_re!(r"±", "gu"), &js(" கூட்டல் கழித்தல் "));
        s = rewrite(&s, js_re!(r"(\S)\+\s?(\d)", "gu"), &js("$1 பிளஸ் $2"));
        s = rewrite(&s, js_re!(r"(^|\s)\+\s?(\d)", "gu"), &js("$1பிளஸ் $2"));

        s = postposed_sign(&s, "<", &js("ஐ விட குறைவாக"));
        s = postposed_sign(&s, ">", &js("ஐ விட அதிகமாக"));
        s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" சமம் "));
        s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" வகுத்தல் "));

        // Degrees.
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?C(?![\p{L}])", "giu"),
            &js("$1 டிகிரி செல்சியஸ்"),
        );
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?F(?![\p{L}])", "giu"),
            &js("$1 டிகிரி பாரன்ஹீட்"),
        );
        s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 டிகிரி"));

        // Ordinal suffixes. An unsafe integer is declined, as kn, te and ml decline it (#1587): the bare-numeral
        // path reads the written digits, where the composer read the rounded float's.
        s = rewrite_with(&s, &self.ordinal_re, |m, full| {
            let n = js_number(&m.group(1, full).unwrap_or_default());
            if !is_safe_integer(n) {
                return m.value(full);
            }
            self.ordinal(n, &m.group(2, full).unwrap_or_default())
                .unwrap_or_else(|| m.value(full))
        });

        // The locative clitic on a number.
        s = rewrite(
            &s,
            js_re!(r"(\d)\s*-?\s*ல்(?![\p{L}\p{M}])", "gu"),
            &js("$1 இல்"),
        );

        s
    }
}
