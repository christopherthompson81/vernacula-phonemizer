//! Telugu (te) text normalization: zero-width characters, the ౦-for-ం homoglyph, native digits, fused ordinals,
//! century years, de-grouping, era markers and abbreviations, initialisms, the dative rate, fractions, the shared
//! symbol tier, the clock, decimals, signs and degrees. Pure text to text.
//! Ported from src/languages/telugu/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{TeluguManifest, try_manifest};
use super::numbers::{ordinal_to_words, year_to_words};
use crate::core::boundaries::{NOT_LETTER_AFTER, NOT_LETTER_BEFORE};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::postposed_sign::postposed_sign;
use crate::core::provenance::{rewrite, rewrite_with};
use crate::core::unicode::fold_native_digits;
use crate::js_re;

/// Telugu letters and marks, EXCLUDING the digit block (the TS writes the range as escapes).
const TE_LETTER: &str = r"\u0C00-\u0C65\u0C70-\u0C7F";

// Generated from the TS object literals (key order preserved).
const ERA: [(&str, &str); 2] = [("శ", "క్రీస్తు శకం"), ("పూ", "క్రీస్తు పూర్వం")];
const RATE_NUM: [(&str, &str); 4] = [
    ("km", "కిలోమీటర్లు"),
    ("m", "మీటర్లు"),
    ("mi", "మైళ్లు"),
    ("ft", "అడుగులు"),
];
const RATE_DENOM: [(&str, &str); 2] = [("h", "గంటకు"), ("s", "సెకనుకు")];

fn lookup(table: &[(&str, &'static str)], k: &JsString) -> Option<&'static str> {
    let k = k.to_string_lossy();
    table.iter().find(|(t, _)| *t == k).map(|(_, v)| *v)
}

fn re(pattern: String) -> JsRegex {
    JsRegex::new(&pattern, "gu").unwrap_or_else(|e| panic!("telugu normalize pattern: {e}"))
}

static KM_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(format!(
        r"{NOT_LETTER_BEFORE}కి\s*\.\s*మీ\.?{NOT_LETTER_AFTER}|{NOT_LETTER_BEFORE}కిమీ{NOT_LETTER_AFTER}"
    ))
});
static MI_RE: LazyLock<JsRegex> = LazyLock::new(|| re(format!(r"(?<=\d\s?)మై{NOT_LETTER_AFTER}")));
static ERA_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(format!(
        r"{NOT_LETTER_BEFORE}క్రీ\s*\.\s*(శ|పూ)\.?{NOT_LETTER_AFTER}"
    ))
});
static ZERO_RE: LazyLock<JsRegex> = LazyLock::new(|| re(r"(?<![౦-౯])౦(?![౦-౯])".to_string()));
static NEAR_RE: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("[{TE_LETTER}]"), "u").expect("telugu letter class"));
static ORDINAL_RE: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"(?<![\d.,])(\d+)\s*-?\s*వ(ది)?{NOT_LETTER_AFTER}")));
static EG_RE: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"{NOT_LETTER_BEFORE}ఉదా\s*\.\s*(?=[\p{{L}}])")));
static TE_RATE_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(format!(
        r"(\d[\d.]*)\s?కిలోమీటర్లు\s*\/\s*గం\.?{NOT_LETTER_AFTER}"
    ))
});

/// `INITIALISM_RE`, over the letter forms longest first (UTF-16 length, stable).
fn initialism_re(m: &TeluguManifest) -> JsRegex {
    let mut forms = m.initialism_letter_forms.clone();
    forms.sort_by_key(|a| std::cmp::Reverse(js(a).len()));
    let letter = format!("(?:{})", forms.join("|"));
    re(format!(
        r"{NOT_LETTER_BEFORE}{letter}(?:\s*\.\s*{letter})+(?:\s*\.(?=\s*[\p{{L}}]))?{NOT_LETTER_AFTER}"
    ))
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

pub struct TeluguNormalizer {
    def: &'static TeluguManifest,
    symbols: SymbolNormalizer,
    initialism_re: JsRegex,
}

/// The module's top-level state: the shared symbol tier over `symbolTier`, these seven fields only.
pub fn make_telugu_normalizer() -> Result<TeluguNormalizer, String> {
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
    Ok(TeluguNormalizer {
        def,
        symbols,
        initialism_re: initialism_re(def),
    })
}

impl TeluguNormalizer {
    /// `normalizeTelugu(input)`.
    pub fn normalize(&self, input: &JsString) -> JsString {
        let numbers = &self.def.numbers;

        // Zero-width characters (the TS writes the range as literal characters).
        let mut s = rewrite(
            input,
            js_re!("[\u{200B}-\u{200D}\u{FEFF}]", "gu"),
            &JsString::new(),
        );

        // The ౦ homoglyph beside a Telugu letter is the anusvara ం; BEFORE the digit fold.
        s = rewrite_with(&s, &ZERO_RE, |m, full| {
            let off = m.index();
            let near = |i: Option<usize>| {
                i.and_then(|i| full.char_code_at(i))
                    .is_some_and(|u| NEAR_RE.test(&JsString::from_units(&[u])))
            };
            if near(off.checked_sub(1)) || near(Some(off + 1)) {
                js("ం")
            } else {
                m.value(full)
            }
        });

        s = fold_native_digits(&s);

        // Ordinals వ / వది, fused onto the last word.
        s = rewrite_with(&s, &ORDINAL_RE, |m, full| {
            let whole = m.value(full);
            let n = js_number(&m.group(1, full).unwrap_or_default());
            if !is_safe_integer(n) || n == 0.0 {
                return whole;
            }
            let suffix = if m.group(2, full).is_none() {
                "వ"
            } else {
                "వది"
            };
            let w = ordinal_to_words(n as u64, &js(suffix), numbers);
            if w.is_empty() { whole } else { w }
        });

        // Century years, but not a numeral with a currency or percent sign on either side: that is the
        // symbol tier's amount (#1587).
        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\d.,])(?<![$%٪％]\s?)(1[1-9]\d{2})(?![\d]|\.\d)(?!\s?[$%٪％])",
                "gu"
            ),
            |m, full| {
                let y = js_number(&m.group(1, full).unwrap_or_default());
                year_to_words(y as u64, numbers)
            },
        );

        // Digit de-grouping.
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?:,\d|[^\d]|$))", "gu"),
            &JsString::new(),
        );

        // Era markers and ఉదా.
        s = rewrite_with(&s, &ERA_RE, |m, full| {
            js(lookup(&ERA, &m.group(1, full).unwrap_or_default()).unwrap_or_default())
        });
        s = rewrite(&s, &EG_RE, &js("ఉదాహరణకు "));

        // Unit abbreviations, then the dotted initialisms.
        s = rewrite(&s, &KM_RE, &js("కిలోమీటర్లు"));
        s = rewrite(&s, &MI_RE, &js("మైళ్లు"));
        s = rewrite_with(&s, &self.initialism_re, |m, full| {
            js_re!(r"\s*\.\s*", "gu")
                .replace(&m.value(full), &js(" "))
                .trim()
        });

        // Rates: the dative prefix, unless the text already carries it.
        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\p{L}\d])(\d[\d.]*)\s?(km|mi|ft|m)\s?\/\s?(h|s)(?![A-Za-z])",
                "giu"
            ),
            |m, full| {
                let n = m.group(1, full).unwrap_or_default();
                let u = m.group(2, full).unwrap_or_default().to_lower_case();
                let den = m.group(3, full).unwrap_or_default().to_lower_case();
                match (lookup(&RATE_NUM, &u), lookup(&RATE_DENOM, &den)) {
                    (Some(num), Some(d)) => dative(d, full, m.index())
                        .concat(&n)
                        .concat(&js(&format!(" {num}"))),
                    _ => m.value(full),
                }
            },
        );
        s = rewrite_with(&s, &TE_RATE_RE, |m, full| {
            let n = m.group(1, full).unwrap_or_default();
            dative("గంటకు", full, m.index())
                .concat(&n)
                .concat(&js(" కిలోమీటర్లు"))
        });

        // Fractions after a digit become decimals.
        s = rewrite(
            &rewrite(&s, js_re!(r"(?<=\d)\s?½", "gu"), &js(".5")),
            js_re!(r"(?<=\d)\s?¾", "gu"),
            &js(".75"),
        );

        // The shared symbol tier.
        s = self.symbols.apply(&s);

        // Times.
        s = rewrite(
            &s,
            js_re!(r"(?<![\d:])([01]?\d|2[0-3]):\s?00(?![\d:.])", "gu"),
            &js("$1"),
        );
        s = rewrite(&s, js_re!(r"(?<=\d):\s?(?=\d)", "gu"), &js(" "));

        // Decimals.
        s = rewrite_with(
            &s,
            js_re!(r"(?<![\d.])(\d+)\.(\d+)(?![\d.])", "gu"),
            |m, full| {
                let frac = m.group(2, full).unwrap_or_default();
                m.group(1, full)
                    .unwrap_or_default()
                    .concat(&js(" పాయింట్ "))
                    .concat(&JsString::join(&frac.code_point_strings(), &js(" ")))
            },
        );

        // Signs.
        s = rewrite(&s, js_re!(r"±", "gu"), &js(" ప్లస్ మైనస్ "));
        s = rewrite_with(
            &s,
            js_re!(r"(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)", "gu"),
            |m, full| {
                if js_re!(r"\d\s*$", "u").test(&full.slice(0, Some(m.index() as isize))) {
                    m.value(full)
                } else {
                    js("మైనస్ ")
                }
            },
        );
        s = rewrite(&s, js_re!(r"(\S)\+\s?(?=\d)", "gu"), &js("$1 ప్లస్ "));
        s = rewrite(&s, js_re!(r"(^|\s)\+\s?(?=\d)", "gu"), &js("$1ప్లస్ "));

        s = postposed_sign(&s, "<", &js("కంటే తక్కువ"));
        s = postposed_sign(&s, ">", &js("కంటే ఎక్కువ"));
        s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" సమానం "));
        s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" భాగించడం "));

        // Degrees.
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?C(?![\p{L}])", "giu"),
            &js("$1 డిగ్రీల సెల్సియస్"),
        );
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?F(?![\p{L}])", "giu"),
            &js("$1 డిగ్రీల ఫారెన్‌హీట్"),
        );
        s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 డిగ్రీలు"));

        s
    }
}
