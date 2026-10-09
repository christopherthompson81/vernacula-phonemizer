//! Japanese text normalization: width folds, ruby, grouped thousands, fractions, clock, decimals, ranges,
//! degrees, signs, relational signs, and Latin initialisms → katakana letter names. Pure text → text.
//! Ported from src/languages/japanese/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::kanji::apply_readings;
use super::manifest::T;
use super::{first_unit, from_code_point, to_hiragana, to_katakana};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::numbers::digit_index;
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `[zero, ...ones.slice(1)].map(toKatakana)`.
static DIGIT_KANA: LazyLock<Vec<JsString>> = LazyLock::new(|| {
    std::iter::once(&T.zero)
        .chain(T.ones.iter().skip(1))
        .map(to_katakana)
        .collect()
});

const LETTER_KANA: [(&str, &str); 26] = [
    ("A", "エー"), ("B", "ビー"), ("C", "シー"), ("D", "ディー"), ("E", "イー"), ("F", "エフ"), ("G", "ジー"),
    ("H", "エイチ"), ("I", "アイ"), ("J", "ジェー"), ("K", "ケー"), ("L", "エル"), ("M", "エム"), ("N", "エヌ"),
    ("O", "オー"), ("P", "ピー"), ("Q", "キュー"), ("R", "アール"), ("S", "エス"), ("T", "ティー"), ("U", "ユー"),
    ("V", "ブイ"), ("W", "ダブリュー"), ("X", "エックス"), ("Y", "ワイ"), ("Z", "ゼット"),
];

/// In the TS object's key order (the mixed-case pass iterates it).
const WORD_ACRONYM: [(&str, &str); 11] = [
    ("NASA", "ナサ"), ("NATO", "ナトー"), ("UNESCO", "ユネスコ"), ("UNICEF", "ユニセフ"), ("ASEAN", "アセアン"),
    ("OPEC", "オペック"), ("JAXA", "ジャクサ"), ("JICA", "ジャイカ"), ("AIDS", "エイズ"), ("FIFA", "フィファ"),
    ("pH", "ピーエイチ"),
];

const RUBY: &str = r"[\p{Script=Hiragana}\p{Script=Katakana}ー]+";

static DECLARED_RUBY: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"￹(\p{{Script=Han}}+)￺({RUBY})￻|｜(\p{{Script=Han}}+)《({RUBY})》"),
        "gu",
    )
    .unwrap()
});

static PARENTHESISED_RUBY: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!(r"(\p{{Script=Han}}+)(?:（({RUBY})）|\(({RUBY})\))"), "gu").unwrap()
});

fn shift(m: &crate::core::js_regex::JsMatch, s: &JsString) -> JsString {
    from_code_point(m.value(s).code_point_at(0).unwrap() - 0xfee0)
}

/// `String(Number(x))` for a digit string of at most a few digits (an integer).
fn num_str(x: &JsString) -> String {
    format!("{}", js_number(x) as i64)
}

/// Normalize one Japanese input string.
pub fn normalize_japanese(input: &JsString) -> JsString {
    let mut s = rewrite_with(input, js_re!(r"[０-９]", "gu"), shift);
    s = rewrite_with(&s, js_re!(r"[Ａ-Ｚａ-ｚ]", "gu"), shift);

    s = rewrite_with(&s, &DECLARED_RUBY, |m, s| {
        m.group(2, s).or_else(|| m.group(4, s)).or_else(|| m.group(1, s)).unwrap_or_default()
    });

    s = rewrite_with(&s, &PARENTHESISED_RUBY, |m, s| {
        let base = m.group(1, s).unwrap_or_default();
        let ruby = m.group(2, s).or_else(|| m.group(3, s)).unwrap_or_default();
        if to_hiragana(&ruby) == apply_readings(&base) { base } else { m.value(s) }
    });

    let mut prev = JsString::new();
    while prev != s {
        prev = s.clone();
        s = rewrite(&s, js_re!(r"(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?!\d))", "gu"), &JsString::new());
    }

    s = rewrite(&s, js_re!(r"(\d)分の(?=\d)", "gu"), &js("$1ブンノ"));
    s = rewrite(&s, js_re!(r"(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])", "gu"), &js("$2ブンノ$1"));

    s = rewrite_with(&s, js_re!(r"(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])", "gu"), |m, s| {
        let (h, min) = (m.group(1, s).unwrap(), m.group(2, s).unwrap());
        if js_number(&min) == 0.0 {
            js(&format!("{}時", num_str(&h)))
        } else {
            js(&format!("{}時{}分", num_str(&h), num_str(&min)))
        }
    });

    s = rewrite_with(&s, js_re!(r"(?<![\d.])(\d+)\.(\d+)(?![\d.])", "gu"), |m, s| {
        let (int, frac) = (m.group(1, s).unwrap(), m.group(2, s).unwrap());
        let mut out = int.concat(&js("点"));
        // `digitIndex(d)` takes one ASCII digit, a single code unit here (`\d` is ASCII).
        for &d in &frac.0 {
            out.push_str(&DIGIT_KANA[digit_index(d) as usize]);
        }
        out
    });

    s = rewrite(&s, js_re!(r"(?<=[\d\p{Script=Han}\p{sc=Katakana}])[〜～~](?=\d)", "gu"), &js("から"));

    s = rewrite(&s, js_re!(r"(\d)\s?(?:℃|°\s?C)(?![\p{sc=Latn}])", "gui"), &js("$1度"));
    s = rewrite(&s, js_re!(r"(\d)\s?(?:℉|°\s?F)(?![\p{sc=Latn}])", "gui"), &js("華氏$1度"));
    s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1度"));

    s = rewrite(&s, js_re!(r"(^|[\s(（])[-−–](\d)", "gu"), &js("$1マイナス$2"));
    s = rewrite(&s, js_re!(r"±", "gu"), &js(" プラスマイナス "));
    s = rewrite(&s, js_re!(r"(^|[\s(（])\+\s?(\d)", "gu"), &js("$1プラス$2"));
    s = rewrite(&s, js_re!(r"(\S)\+\s?(\d)", "gu"), &js("$1プラス$2"));

    s = rewrite(&s, js_re!(r"(\d)\s?<\s?(\d)", "gu"), &js("$1は$2より小さい"));
    s = rewrite(&s, js_re!(r"(\d)\s?>\s?(\d)", "gu"), &js("$1は$2より大きい"));
    s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js("イコール"));
    s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js("わる"));

    // Unreachable through `phonemize`: the symbol tier's `multiply` (run first) claims every digit×digit.
    s = rewrite(&s, js_re!(r"(\d)\s*×\s*(?=\d)", "gu"), &js("$1かける"));

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{Script=Latin}\p{M}])[A-Z][A-Z-]*[A-Z](?![\p{Script=Latin}\p{M}])|(?<![\p{Script=Latin}\p{M}])[A-Z](?![\p{Script=Latin}\p{M}])",
            "gu"
        ),
        |m, s| spell(&m.value(s)),
    );
    // ⚠ `replaceAll`, NOT the provenance seam, exactly as the TS: a `pH` hit desyncs the mapping.
    for (k, v) in WORD_ACRONYM {
        if js_re!(r"[a-z]", "u").test(&js(k)) {
            s = replace_all(&s, &js(k), &js(v));
        }
    }
    s
}

/// `s.replaceAll(lit, rep)` with a `$`-free replacement: every non-overlapping occurrence, left to right.
fn replace_all(s: &JsString, lit: &JsString, rep: &JsString) -> JsString {
    let mut out = JsString::new();
    let mut at = 0;
    while let Some(i) = s.index_of(lit, at) {
        out.push_units(&s.0[at..i]);
        out.push_str(rep);
        at = i + lit.len();
    }
    out.push_units(&s.0[at..]);
    out
}

/// The five vowels, longest first (stable, so ties keep key order).
static VOWEL_IPA: LazyLock<Vec<JsString>> = LazyLock::new(|| {
    let mut v = T.vowel_values.clone();
    v.sort_by(|a, b| b.len().cmp(&a.len()));
    v
});

fn final_vowel(name: &JsString) -> Option<JsString> {
    let stripped = js_re!(r"ー+$", "u").replace(&to_hiragana(name), &JsString::new());
    let last = stripped.code_point_strings().pop()?;
    let mora = T.mora.get(&last)?;
    VOWEL_IPA.iter().find(|v| mora.ends_with(v)).cloned()
}

fn initial_vowel(name: &JsString) -> Option<JsString> {
    // `toHiragana(name)[0] ?? ""`: the first code unit.
    let head = first_unit(&to_hiragana(name)).unwrap_or_default();
    T.vowel_kana.get(&head).cloned()
}

/// One all-caps Latin run → katakana: its listed word reading, else its letter names, padded with spaces.
fn spell(run: &JsString) -> JsString {
    if let Some((_, w)) = WORD_ACRONYM.iter().find(|(k, _)| *run == *k) {
        return js(" ").concat(&js(w)).concat(&js(" "));
    }
    let mut out = JsString::new();
    for ch in run.code_point_strings() {
        let Some((_, kana)) = LETTER_KANA.iter().find(|(k, _)| ch == *k) else { continue };
        let kana = js(kana);
        let prev = final_vowel(&out);
        if !out.is_empty() && prev.is_some() && initial_vowel(&kana) == prev {
            out.push_str(&js(" "));
        }
        out.push_str(&kana);
    }
    if out.is_empty() { run.clone() } else { js(" ").concat(&out).concat(&js(" ")) }
}
