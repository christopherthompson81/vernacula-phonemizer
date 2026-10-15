//! Malayalam (ml) text normalization: the legacy ZWJ chillu spellings, zero-width characters, native digits,
//! de-grouping, the clitics welded onto a numeral (ordinal, plural, oblique), the shared symbol tier, the clock,
//! decimals, signs and degrees. Pure text to text.
//! Ported from src/languages/malayalam/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{MalayalamManifest, try_manifest};
use super::numbers::{clitic_to_words, oblique_stem, ordinal_to_words, plural_stem};
use crate::core::boundaries::NOT_LETTER_AFTER;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::postposed_sign::postposed_sign;
use crate::core::provenance::{rewrite, rewrite_with};
use crate::core::unicode::fold_native_digits;
use crate::js_re;

// Generated from the TS object/array literals (order preserved).
const ZWJ_CHILLU: [(&str, &str); 6] = [
    ("ണ", "ൺ"),
    ("ന", "ൻ"),
    ("ര", "ർ"),
    ("ല", "ൽ"),
    ("ള", "ൾ"),
    ("ക", "ൿ"),
];
const OBLIQUE_CLITICS: [&str; 10] = [
    "ത്തിലെ",
    "ത്തിൽ",
    "ത്തില്",
    "ലാണ്",
    "ന്റെ",
    "ലോ",
    "നും",
    "ലെ",
    "ൽ",
    "ന്",
];
const PLURAL_CLITICS: [&str; 4] = ["കളുടെ", "കളിലെ", "കളിൽ", "കൾ"];
const FOLD_CLITIC: [(&str, &str); 3] = [("ത്തിലെ", "ലെ"), ("ത്തിൽ", "ൽ"), ("ത്തില്", "ൽ")];

fn lookup(table: &[(&str, &'static str)], k: &str) -> Option<&'static str> {
    table.iter().find(|(t, _)| *t == k).map(|(_, v)| *v)
}

/// `longestFirst(a)`: UTF-16 length, stable, joined.
fn longest_first(a: &[&str]) -> String {
    let mut k = a.to_vec();
    k.sort_by_key(|x| std::cmp::Reverse(js(x).len()));
    k.join("|")
}

/// `clitic(list)`.
fn clitic(list: &[&str]) -> JsRegex {
    JsRegex::new(
        &format!(
            r"(?<![\d.,])(\d+)\s*[-–]?\s*({}){NOT_LETTER_AFTER}",
            longest_first(list)
        ),
        "gu",
    )
    .unwrap_or_else(|e| panic!("malayalam clitic pattern: {e}"))
}

static PLURAL_RE: LazyLock<JsRegex> = LazyLock::new(|| clitic(&PLURAL_CLITICS));
static OBLIQUE_RE: LazyLock<JsRegex> = LazyLock::new(|| clitic(&OBLIQUE_CLITICS));

pub struct MalayalamNormalizer {
    def: &'static MalayalamManifest,
    symbols: SymbolNormalizer,
    ordinal_re: JsRegex,
}

/// The module's top-level state: the shared symbol tier over `symbolTier`, these seven fields only.
pub fn make_malayalam_normalizer() -> Result<MalayalamNormalizer, String> {
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
    let endings: Vec<&str> = def.ordinal_endings.iter().map(String::as_str).collect();
    Ok(MalayalamNormalizer {
        def,
        symbols,
        ordinal_re: clitic(&endings),
    })
}

/// The guarded numeral of a clitic match: a safe, non-zero integer.
fn numeral(m: &crate::core::js_regex::JsMatch, full: &JsString) -> Option<u64> {
    let n = js_number(&m.group(1, full).unwrap_or_default());
    (is_safe_integer(n) && n != 0.0).then_some(n as u64)
}

impl MalayalamNormalizer {
    /// `normalizeMalayalam(input)`.
    pub fn normalize(&self, input: &JsString) -> JsString {
        let numbers = &self.def.numbers;

        // Legacy chillu spellings (base + virama + ZWJ), then the remaining zero-width characters.
        let mut s = rewrite_with(
            input,
            js_re!(r"([ണനരലളക])്\u200d", "gu"),
            |m, full| {
                js(lookup(
                    &ZWJ_CHILLU,
                    &m.group(1, full).unwrap_or_default().to_string_lossy(),
                )
                .unwrap_or_default())
            },
        );
        s = rewrite(
            &s,
            js_re!(r"[\u200b\u200c\u200d\ufeff]", "gu"),
            &JsString::new(),
        );

        s = fold_native_digits(&s);

        // Digit de-grouping.
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?:,\d|[^\d]|$))", "gu"),
            &JsString::new(),
        );

        // Clitics welded onto a numeral: ordinal, plural, oblique.
        s = rewrite_with(&s, &self.ordinal_re, |m, full| {
            let whole = m.value(full);
            let Some(n) = numeral(m, full) else {
                return whole;
            };
            let end = m.group(2, full).unwrap_or_default();
            let ending = if end == js("ആം") {
                js("ാം")
            } else if end.starts_with(&js("ാ")) {
                end
            } else {
                js("ാ").concat(&end)
            };
            let w = ordinal_to_words(n, &ending, numbers);
            if w.is_empty() { whole } else { w }
        });
        s = rewrite_with(&s, &PLURAL_RE, |m, full| {
            let whole = m.value(full);
            let Some(n) = numeral(m, full) else {
                return whole;
            };
            let w = clitic_to_words(
                n,
                &m.group(2, full).unwrap_or_default(),
                plural_stem,
                numbers,
            );
            if w.is_empty() { whole } else { w }
        });
        s = rewrite_with(&s, &OBLIQUE_RE, |m, full| {
            let whole = m.value(full);
            let Some(n) = numeral(m, full) else {
                return whole;
            };
            let c = m.group(2, full).unwrap_or_default();
            let folded = lookup(&FOLD_CLITIC, &c.to_string_lossy())
                .map(js)
                .unwrap_or(c);
            let w = clitic_to_words(n, &folded, oblique_stem, numbers);
            if w.is_empty() { whole } else { w }
        });

        // The shared symbol tier.
        s = self.symbols.apply(&s);

        // Times.
        s = rewrite(
            &s,
            js_re!(r"(?<![\d:])([01]?\d|2[0-3]):\s?00(?![\d:.])", "gu"),
            &js("$1"),
        );
        s = rewrite(&s, js_re!(r"(?<=\d):\s?(?=\d)", "gu"), &js(" "));

        // A doubled percent word.
        s = rewrite(&s, js_re!(r"ശതമാനം(\s+ശതമാനം)+", "gu"), &js("ശതമാനം"));

        // Decimals.
        s = rewrite_with(
            &s,
            js_re!(r"(?<![\d.])(\d+)\.(\d+)(?![\d.])", "gu"),
            |m, full| {
                let frac = m.group(2, full).unwrap_or_default();
                m.group(1, full)
                    .unwrap_or_default()
                    .concat(&js(&format!(" {} ", numbers.decimal_word)))
                    .concat(&JsString::join(&frac.code_point_strings(), &js(" ")))
            },
        );

        // Signs.
        s = rewrite(&s, js_re!(r"±", "gu"), &js(" പ്ലസ് മൈനസ് "));
        s = rewrite_with(
            &s,
            js_re!(r"(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)", "gu"),
            |m, full| {
                if js_re!(r"\d\s*$", "u").test(&full.slice(0, Some(m.index() as isize))) {
                    m.value(full)
                } else {
                    js("മൈനസ് ")
                }
            },
        );
        s = rewrite(&s, js_re!(r"(\S)\+\s?(?=\d)", "gu"), &js("$1 പ്ലസ് "));
        s = rewrite(&s, js_re!(r"(^|\s)\+\s?(?=\d)", "gu"), &js("$1പ്ലസ് "));

        s = postposed_sign(&s, "<", &js("എക്കാൾ കുറവ്"));
        s = postposed_sign(&s, ">", &js("എക്കാൾ കൂടുതൽ"));
        s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" ഹരണം "));

        s = postposed_sign(&s, "=", &js("ന് തുല്യം"));

        // Degrees.
        s = rewrite(&s, js_re!(r"(\d)\s?°\s?", "gu"), &js("$1 ഡിഗ്രി "));

        s
    }
}
