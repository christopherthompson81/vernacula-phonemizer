//! Assamese (as) pre-pass normalization, run BEFORE the Bengali maker's own normalizer: NFC, dotted runs, the `শ`
//! classical ordinals, the `নং` number marker, comma-grouped ordinals, version dots, currency codes and redundant
//! dollar signs, the ampersand, the regnal ordinal and the remaining signs. Pure text to text.
//! Ported from src/languages/assamese/normalize.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::data_source::load_once;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::numbers::NumbersDef;
use crate::core::provenance::{Form, renormalize, rewrite, rewrite_with};
use crate::js_re;
use crate::languages::bengali::manifest::{BengaliDef, load_bengali_def};
use crate::languages::bengali::normalize::{BengaliNormalizer, D, cardinal, to_ascii};

const MAGNITUDE: &str = "(?:মিলিয়ন|বিলিয়ন|ট্ৰিলিয়ন|হাজাৰ|লাখ|কোটি)";

// Generated from the TS object literals (key order preserved).
const ORDINAL_11_20: [(f64, &str); 10] = [
    (11.0, "একাদশ"),
    (12.0, "দ্বাদশ"),
    (13.0, "ত্রয়োদশ"),
    (14.0, "চতুর্দশ"),
    (15.0, "পঞ্চদশ"),
    (16.0, "ষোড়শ"),
    (17.0, "সপ্তদশ"),
    (18.0, "অষ্টাদশ"),
    (19.0, "ঊনবিংশ"),
    (20.0, "বিংশ"),
];
const ORDINAL_1_10: [&str; 10] = [
    "প্রথম",
    "দ্বিতীয়",
    "তৃতীয়",
    "চতুর্থ",
    "পঞ্চম",
    "ষষ্ঠ",
    "সপ্তম",
    "অষ্টম",
    "নবম",
    "দশম",
];
const CODE: [(&str, &str); 2] = [("US", "আমেৰিকান"), ("AUD", "অস্ট্রেলিয়ান")];

fn ordinal_11_20(n: f64) -> Option<&'static str> {
    ORDINAL_11_20.iter().find(|(k, _)| *k == n).map(|(_, v)| *v)
}

fn re(pattern: String) -> JsRegex {
    JsRegex::new(&pattern, "gu").unwrap_or_else(|e| panic!("assamese normalize pattern: {e}"))
}

/// `num`: a number with `.`/`,` groups.
fn num() -> String {
    format!(r"[{d}]+(?:[.,][{d}]+)*", d = *D)
}

static TEEN_ORDINAL: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"(?<![{d}])([{d}]{{2}})(শ)(?![{d}ত])", d = *D)));
static ONE_HUNDRED: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"(?<![{d}])([{d}])শ(?![{d}])", d = *D)));
static NUMBER_MARKER: LazyLock<JsRegex> = LazyLock::new(|| {
    re(format!(
        r"(?<![{d}])([{d}]+)\s?নং(?![\p{{L}}\p{{M}}])",
        d = *D
    ))
});
static GROUPED_ORDINAL: LazyLock<JsRegex> = LazyLock::new(|| {
    re(format!(
        r"([{d}]),([{d}]{{3}})(?=(?:তম|শে|ই|ম|য়|র্থ|ষ্ঠ|লা|রা|ঠা))",
        d = *D
    ))
});
static VERSION: LazyLock<JsRegex> = LazyLock::new(|| {
    re(format!(
        r"(?<![{d},.:])([{d}]{{3,}})\.([{d}]+)(?=(?:[a-zA-Z](?![a-zA-Z])|এন))",
        d = *D
    ))
});
static CURRENCY_CODE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(format!(
        r"(?<![\p{{L}}\p{{M}}])(US|AUD)\$[ ]?({})(\s+{MAGNITUDE})?",
        num()
    ))
});
static DOLLAR_SPELLED: LazyLock<JsRegex> = LazyLock::new(|| {
    re(format!(
        r"\$[ ]?({})(\s+{MAGNITUDE})?(?=\s+(?:আমেৰিকান\s+)?ডলা[ৰর])",
        num()
    ))
});
static DOLLAR_MAGNITUDE: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"\$[ ]?({})(\s+{MAGNITUDE})", num())));
static REGNAL: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"([{d}]{{1,2}})\s+বিশ্ব যুদ্ধ", d = *D)));

/// `makeAssameseNormalizer(numbers)`.
pub fn make_assamese_normalizer(numbers: &NumbersDef) -> BengaliNormalizer {
    let numbers = numbers.clone();
    Box::new(move |input: &JsString| -> JsString {
        let card = |n: f64| cardinal(n, &numbers);
        let mut s = renormalize(input, Form::Nfc);

        // 1) Dotted Latin runs, a lone capital initial, dotted Bengali runs.
        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\p{L}\p{M}])[A-Za-z]\.(?:[ \u00a0]?[A-Za-z]\.)+",
                "gu"
            ),
            |m, full| js_re!(r"[.\s]", "gu").replace(&m.value(full), &JsString::new()),
        );
        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}])([A-Z])\.(?=\s+[A-Z])", "gu"),
            &js("$1"),
        );
        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\p{L}\p{M}])[\p{Script=Bengali}\p{M}]+\.(?:[ \u00a0]?[\p{Script=Bengali}\p{M}]+\.)+",
                "gu"
            ),
            |m, full| {
                let x = js_re!(r"\.", "gu").replace(&m.value(full), &js(" "));
                js_re!(r"\s+", "gu").replace(&x, &js(" "))
            },
        );

        // 2) The `Nশ` classical ordinals (11–20), and `1শ` = একশ.
        s = rewrite_with(&s, &TEEN_ORDINAL, |m, full| {
            let n = js_number(&to_ascii(&m.group(1, full).unwrap_or_default()));
            match ordinal_11_20(n) {
                Some(w) => js(w),
                None if n == 10.0 => js("দশম"),
                None => m.value(full),
            }
        });
        s = rewrite_with(&s, &ONE_HUNDRED, |m, full| {
            if js_number(&to_ascii(&m.group(1, full).unwrap_or_default())) == 1.0 {
                js("একশ")
            } else {
                m.value(full)
            }
        });

        // 3) The `নং` number marker.
        s = rewrite_with(&s, &NUMBER_MARKER, |m, full| {
            let c = card(js_number(&to_ascii(&m.group(1, full).unwrap_or_default())));
            if c.split(' ').any(|w| w.is_empty()) {
                m.value(full)
            } else {
                js(&format!("{c} নম্বৰ"))
            }
        });

        // 4) Comma-grouped ordinals, two passes.
        for _ in 0..2 {
            s = rewrite(&s, &GROUPED_ORDINAL, &js("$1$2"));
        }

        // 5) Version dots.
        s = rewrite(&s, &VERSION, &js("$1 বিন্দু $2"));

        // 6) Currency codes, a redundant `$`, and a magnitude before the noun.
        s = rewrite_with(&s, &CURRENCY_CODE, |m, full| {
            let code = m.group(1, full).unwrap_or_default().to_string_lossy();
            let n = m.group(2, full).unwrap_or_default();
            let mag = m.group(3, full).unwrap_or_default();
            let noun = CODE
                .iter()
                .find(|(k, _)| *k == code)
                .map(|(_, v)| *v)
                .unwrap_or_default();
            n.concat(&mag).concat(&js(&format!(" {noun} ডলাৰ")))
        });
        s = rewrite(&s, &DOLLAR_SPELLED, &js("$1$2"));
        s = rewrite(&s, &DOLLAR_MAGNITUDE, &js("$1$2 ডলাৰ"));

        // 7) `&`.
        s = rewrite(&s, js_re!(r"\s&\s", "gu"), &js(" আৰু "));
        s = rewrite(&s, js_re!(r"(?<![A-Za-z])&(?![A-Za-z])", "gu"), &js(" আৰু "));
        s = rewrite(&s, js_re!(r"([A-Za-z])&([A-Za-z])", "gu"), &js("$1 আৰু $2"));

        // 8) The regnal ordinal before বিশ্ব যুদ্ধ, the noun put back.
        s = rewrite_with(&s, &REGNAL, |m, full| {
            let n = js_number(&to_ascii(&m.group(1, full).unwrap_or_default()));
            if !(1.0..=20.0).contains(&n) {
                return m.value(full);
            }
            let ord = if n <= 10.0 {
                ORDINAL_1_10[n as usize - 1]
            } else {
                ordinal_11_20(n).unwrap_or_default()
            };
            js(&format!("{ord} বিশ্ব যুদ্ধ"))
        });

        // 9) The remaining signs.
        s = rewrite(&s, js_re!(r"(\S)\s*=\s*(\S)", "gu"), &js("$1 সমান $2"));
        s = rewrite(&s, js_re!(r"(\d)\s*<\s*(\d)", "gu"), &js("$1 তকৈ সৰু $2"));
        s = rewrite(&s, js_re!(r"(\d)\s*>\s*(\d)", "gu"), &js("$1 তকৈ ডাঙৰ $2"));
        s = rewrite(&s, js_re!(r"(\d)\s*×\s*(\d)", "gu"), &js("$1 গুণ $2"));

        s
    })
}

/// `assamese.jsonc`, loaded once. Cached only on success.
pub fn try_def() -> Result<&'static BengaliDef, String> {
    static DEF: OnceLock<BengaliDef> = OnceLock::new();
    load_bengali_def(&DEF, "assamese")
}

/// `normalizeAssamese(input)`: the pre-pass with Assamese's own numbers.
pub fn normalize_assamese(input: &JsString) -> Result<JsString, String> {
    static NORM: OnceLock<BengaliNormalizer> = OnceLock::new();
    let norm = load_once(&NORM, || Ok(make_assamese_normalizer(&try_def()?.numbers)))?;
    Ok(norm(input))
}
