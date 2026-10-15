//! Kannada (kn) text normalization: zero-width characters, native digits, de-grouping, fused ordinals, era markers,
//! dotted abbreviations and initialisms, the dative rate, vulgar fractions, the shared symbol tier, the clock,
//! decimals, signs and degrees. Pure text to text.
//! Ported from src/languages/kannada/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{KannadaManifest, try_manifest};
use super::numbers::ordinal_to_words;
use crate::core::boundaries::{NOT_LETTER_AFTER, NOT_LETTER_BEFORE};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::postposed_sign::postposed_sign;
use crate::core::provenance::{rewrite, rewrite_with};
use crate::core::unicode::fold_native_digits;
use crate::js_re;

// Generated from the TS object literals (key order preserved).
const ERA: [(&str, &str); 2] = [("ಪೂ", "ಕ್ರಿಸ್ತ ಪೂರ್ವ"), ("ಶ", "ಕ್ರಿಸ್ತ ಶಕ")];
const RATE_DENOM: [(&str, &str); 2] = [("ಗಂ", "ಗಂಟೆಗೆ"), ("ಸೆ", "ಸೆಕೆಂಡಿಗೆ")];
const VULGAR: [(&str, &str); 3] = [("¼", "ಕಾಲು"), ("½", "ಅರ್ಧ"), ("¾", "ಮುಕ್ಕಾಲು")];

fn lookup(table: &[(&str, &'static str)], k: &JsString) -> &'static str {
    let k = k.to_string_lossy();
    table
        .iter()
        .find(|(t, _)| *t == k)
        .map(|(_, v)| *v)
        .unwrap_or_default()
}

fn re(pattern: String) -> JsRegex {
    JsRegex::new(&pattern, "gu").unwrap_or_else(|e| panic!("kannada normalize pattern: {e}"))
}

static KM_RE: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"{NOT_LETTER_BEFORE}(?:ಕಿ\s*\.\s*ಮ[ೀಿ]|ಕಿಮ[ೀಿ])")));
static MI_RATE_RE: LazyLock<JsRegex> =
    LazyLock::new(|| re(r"(\d[\d.]*)\s?ಮೈ\s*\/\s*ಗಂ\.?".to_string()));
static ORDINAL_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(format!(
        r"(?<![\d.,])(\d+)\s*-?\s*(ನೇ|ನೆಯ)(ದು)?{NOT_LETTER_AFTER}"
    ))
});
static ERA_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(format!(
        r"{NOT_LETTER_BEFORE}ಕ್ರಿ\s*\.\s*(ಪೂ|ಶ)(?:\s*\.(?=\s*[\p{{L}}\d]))?"
    ))
});
static MM_RE: LazyLock<JsRegex> = LazyLock::new(|| re(format!(r"{NOT_LETTER_BEFORE}ಮಿ\s*\.\s*ಮೀ")));
static RATE_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(format!(
        r"(\d[\d.]*)\s?ಕಿಲೋಮೀಟರ್\s*\/\s*(ಗಂ|ಸೆ)\.?{NOT_LETTER_AFTER}"
    ))
});

/// `INITIALISM_RE`, over the letter forms longest first (UTF-16 length, stable).
fn initialism_re(m: &KannadaManifest) -> JsRegex {
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

pub struct KannadaNormalizer {
    def: &'static KannadaManifest,
    symbols: SymbolNormalizer,
    initialism_re: JsRegex,
}

/// The module's top-level state: the shared symbol tier over `symbolTier`, these seven fields only.
pub fn make_kannada_normalizer() -> Result<KannadaNormalizer, String> {
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
    Ok(KannadaNormalizer {
        def,
        symbols,
        initialism_re: initialism_re(def),
    })
}

impl KannadaNormalizer {
    /// `normalizeKannada(input)`.
    pub fn normalize(&self, input: &JsString) -> JsString {
        let numbers = &self.def.numbers;

        // 1) Zero-width characters (the TS writes them as literal characters).
        let mut s = rewrite(
            input,
            js_re!("[\u{200B}\u{200C}\u{200D}\u{FEFF}]", "gu"),
            &JsString::new(),
        );

        // 2) Native digits.
        s = fold_native_digits(&s);

        // 3) Digit de-grouping.
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?:,\d|[^\d]|$))", "gu"),
            &JsString::new(),
        );

        // 4) Ordinals ನೇ / ನೆಯ, fused onto the last cardinal word.
        s = rewrite_with(&s, &ORDINAL_RE, |m, full| {
            let whole = m.value(full);
            let n = js_number(&m.group(1, full).unwrap_or_default());
            if !is_safe_integer(n) || n == 0.0 {
                return whole;
            }
            let suffix = m
                .group(2, full)
                .unwrap_or_default()
                .concat(&m.group(3, full).unwrap_or_default());
            let w = ordinal_to_words(n as u64, &suffix, numbers);
            if w.is_empty() { whole } else { w }
        });

        // 5) Era markers, before the dotted abbreviations.
        s = rewrite_with(&s, &ERA_RE, |m, full| {
            js(lookup(&ERA, &m.group(1, full).unwrap_or_default()))
        });

        // 6) Kannada unit abbreviations, then ಮಿ.ಮೀ, then the dotted initialisms.
        s = rewrite_with(&s, &KM_RE, |m, full| {
            let v = m.value(full);
            if js_re!(r"^[\p{L}\p{M}]", "u").test(&full.slice(m.end() as isize, None)) {
                js_re!(r"\s*\.\s*", "gu").replace(&v, &JsString::new())
            } else {
                js("ಕಿಲೋಮೀಟರ್")
            }
        });
        s = rewrite(&s, &MM_RE, &js("ಮಿಮೀ"));
        s = rewrite_with(&s, &self.initialism_re, |m, full| {
            js_re!(r"\s*\.\s*", "gu")
                .replace(&m.value(full), &js(" "))
                .trim()
        });

        // 7) Rate units: the dative prefix, unless the text already carries it.
        s = rewrite_with(&s, &RATE_RE, |m, full| {
            let n = m.group(1, full).unwrap_or_default();
            let den = lookup(&RATE_DENOM, &m.group(2, full).unwrap_or_default());
            dative(den, full, m.index())
                .concat(&n)
                .concat(&js(" ಕಿಲೋಮೀಟರ್"))
        });
        s = rewrite_with(&s, &MI_RATE_RE, |m, full| {
            let n = m.group(1, full).unwrap_or_default();
            dative("ಗಂಟೆಗೆ", full, m.index())
                .concat(&n)
                .concat(&js(" ಮೈಲಿ"))
        });

        // 8) Vulgar fractions.
        s = rewrite_with(&s, js_re!(r"(?<=\d)\s?([¼½¾])", "gu"), |m, full| {
            js(&format!(
                " {}",
                lookup(&VULGAR, &m.group(1, full).unwrap_or_default())
            ))
        });

        // 9) The shared symbol tier.
        s = self.symbols.apply(&s);

        // 10) Times.
        s = rewrite(
            &s,
            js_re!(r"(?<![\d:])([01]?\d|2[0-3]):\s?00(?![\d:.])", "gu"),
            &js("$1"),
        );
        s = rewrite(&s, js_re!(r"(?<=\d):\s?(?=\d)", "gu"), &js(" "));

        // 11) Decimals.
        s = rewrite_with(
            &s,
            js_re!(r"(?<![\d.])(\d+)\.(\d+)(?![\d.])", "gu"),
            |m, full| {
                let frac = m.group(2, full).unwrap_or_default();
                let digits: Vec<JsString> = frac.code_point_strings();
                m.group(1, full)
                    .unwrap_or_default()
                    .concat(&js(&format!(" {} ", numbers.decimal_word)))
                    .concat(&JsString::join(&digits, &js(" ")))
            },
        );

        // 12) Plus, degrees.
        s = rewrite(&s, js_re!(r"(\S)\+\s?(?=\d)", "gu"), &js("$1 ಪ್ಲಸ್ "));
        s = rewrite(&s, js_re!(r"(^|\s)\+\s?(?=\d)", "gu"), &js("$1ಪ್ಲಸ್ "));
        s = rewrite(&s, js_re!(r"(\d)\s?°\s?", "gu"), &js("$1 ಡಿಗ್ರಿ "));

        // The relational and division signs.
        s = postposed_sign(&s, "<", &js("ಗಿಂತ ಕಡಿಮೆ"));
        s = postposed_sign(&s, ">", &js("ಗಿಂತ ಹೆಚ್ಚು"));
        s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" ಸಮ "));
        s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" ಭಾಗಾಕಾರ "));

        s
    }
}
