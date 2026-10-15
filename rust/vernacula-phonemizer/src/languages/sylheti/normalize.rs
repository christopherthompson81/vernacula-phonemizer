//! Sylheti (syl) text normalization: NFC, zero-width characters, stray Bengali-Assamese characters folded into Syloti
//! Nagri, dotted native abbreviations, digit de-grouping, ascending ranges, degrees, the decimal point, percent and
//! the taka sign rewritten into words before tokenizing. Pure text to text.
//! Ported from src/languages/sylheti/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{Form, renormalize, rewrite, rewrite_with};
use crate::js_re;

/// Syloti Nagri LETTERS and signs: U+A800–A827 plus U+A82C.
const SYL: &str = r"\u{A800}-\u{A827}\u{A82C}";
/// Bengali-Assamese letters and marks only: U+0980–09E5 plus ৰ ৱ.
const BN_LETTER: &str = r"\u0980-\u09E5\u09F0\u09F1";
const NUM: &str = r"\p{Nd}(?:[\p{Nd}.]*\p{Nd})?";
const BN_DIGITS: &str = "০১২৩৪৫৬৭৮৯";
const DECIMAL_WORD: &str = "ꠖꠡꠝꠤꠇ";
const PERCENT_WORD: &str = "ꠡꠔꠣꠋꠡ";
const CURRENCY_WORD: &str = "ꠐꠦꠈꠣ";
const DEGREE_WORD: &str = "ꠒꠤꠉ꠆ꠞꠤ";
const RANGE_WORD: &str = "ꠔꠘꠦ";

// Generated from the TS object literals (key order preserved).
const BN_TO_SYL: [(&str, &str); 62] = [
    ("়", ""),
    ("ঁ", ""),
    ("ঃ", ""),
    ("ং", "ꠋ"),
    ("্", "꠆"),
    ("ৎ", "ꠔ꠆"),
    ("ৃ", "ꠞꠤ"),
    ("ঋ", "ꠞꠤ"),
    ("া", "ꠣ"),
    ("ি", "ꠤ"),
    ("ী", "ꠤ"),
    ("ু", "ꠥ"),
    ("ূ", "ꠥ"),
    ("ে", "ꠦ"),
    ("ৈ", "ꠂ"),
    ("ো", "ꠧ"),
    ("ৌ", "ꠧ"),
    ("অ", "ꠅ"),
    ("আ", "ꠀ"),
    ("ই", "ꠁ"),
    ("ঈ", "ꠁ"),
    ("উ", "ꠃ"),
    ("ঊ", "ꠃ"),
    ("এ", "ꠄ"),
    ("ঐ", "ꠂ"),
    ("ও", "ꠅ"),
    ("ঔ", "ꠅ"),
    ("ক", "ꠇ"),
    ("খ", "ꠈ"),
    ("গ", "ꠉ"),
    ("ঘ", "ꠊ"),
    ("ঙ", "ꠋ"),
    ("চ", "ꠌ"),
    ("ছ", "ꠍ"),
    ("জ", "ꠎ"),
    ("ঝ", "ꠏ"),
    ("ঞ", "ꠘ"),
    ("ট", "ꠐ"),
    ("ঠ", "ꠑ"),
    ("ড", "ꠒ"),
    ("ঢ", "ꠓ"),
    ("ণ", "ꠘ"),
    ("ত", "ꠔ"),
    ("থ", "ꠕ"),
    ("দ", "ꠖ"),
    ("ধ", "ꠗ"),
    ("ন", "ꠘ"),
    ("প", "ꠙ"),
    ("ফ", "ꠚ"),
    ("ব", "ꠛ"),
    ("ভ", "ꠜ"),
    ("ম", "ꠝ"),
    ("য", "ꠎ"),
    ("র", "ꠞ"),
    ("ল", "ꠟ"),
    ("শ", "ꠡ"),
    ("ষ", "ꠡ"),
    ("স", "ꠡ"),
    ("হ", "ꠢ"),
    ("ড়", "ꠠ"),
    ("ঢ়", "ꠠ"),
    ("য়", "ꠄ"),
];
const INDEPENDENT: [(&str, &str); 6] = [
    ("ꠣ", "ꠀ"),
    ("ꠤ", "ꠁ"),
    ("ꠥ", "ꠃ"),
    ("ꠦ", "ꠄ"),
    ("ꠧ", "ꠅ"),
    ("", ""),
];
const SCALE: [(&str, &str); 2] = [("ꠍꠦ", "ꠍꠦꠟꠍꠤꠀꠍ"), ("ꠚꠣ", "ꠚꠣꠞꠦꠘꠢꠣꠁꠐ")];

fn lookup<'a>(table: &[(&'a str, &'a str)], k: &JsString) -> Option<&'a str> {
    table.iter().find(|(key, _)| js(key) == *k).map(|(_, v)| *v)
}

fn re(pattern: String, flags: &str) -> JsRegex {
    JsRegex::new(&pattern, flags).unwrap_or_else(|e| panic!("sylheti normalize pattern: {e}"))
}

static MIXED_RUN: LazyLock<JsRegex> = LazyLock::new(|| re(format!("[{SYL}{BN_LETTER}]+"), "gu"));
static HAS_SYL: LazyLock<JsRegex> = LazyLock::new(|| re(format!("[{SYL}]"), "u"));
static HAS_BN: LazyLock<JsRegex> = LazyLock::new(|| re(format!("[{BN_LETTER}]"), "u"));
static DOTTED: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"(?:[{SYL}]+\.)+[{SYL}]+\.?"), "gu"));
static RANGE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(r"(?<![\p{{Nd}}.,])({NUM})\s*[-–—]\s*({NUM})(?![\p{{Nd}}.,])"),
        "gu",
    )
});
static SCALE_RE: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"(\p{{Nd}})\s*°\s*(ꠍꠦ|ꠚꠣ)\.?(?![{SYL}])"), "gu"));

/// `numValue(s)`: Bengali digits to their values, then `Number`.
fn num_value(s: &JsString) -> f64 {
    let digits = js(BN_DIGITS);
    let mut out = JsString::new();
    for c in s.code_point_strings() {
        match digits.index_of(&c, 0) {
            Some(i) => out.push_str(&js(&i.to_string())),
            None => out.push_str(&c),
        }
    }
    js_number(&out)
}

/// `foldStrayBengali(s)`: a Bengali character is folded only inside a run that also has a Syloti Nagri one.
fn fold_stray_bengali(s: &JsString) -> JsString {
    rewrite_with(s, &MIXED_RUN, |m, full| {
        let run = m.value(full);
        if !(HAS_SYL.test(&run) && HAS_BN.test(&run)) {
            return run;
        }
        let run = js_re!(r"(?:ꠎ|\u09AF)\u09BC([ꠣꠤꠥꠦꠧ]?)", "gu").replace_with(&run, |m, s| {
            let v = m.group(1, s).unwrap_or_default();
            js(lookup(&INDEPENDENT, &v).unwrap_or_default())
        });
        let mut out = JsString::new();
        for c in run.code_point_strings() {
            match lookup(&BN_TO_SYL, &c) {
                Some(t) => out.push_str(&js(t)),
                None => out.push_str(&c),
            }
        }
        out
    })
}

/// `normalizeSylheti(input)`.
pub fn normalize_sylheti(input: &JsString) -> JsString {
    // 1. NFC.
    let mut s = renormalize(input, Form::Nfc);

    // 2. Zero-width formatting characters.
    s = rewrite(&s, js_re!(r"[​‌‍‎‏⁠﻿]", "gu"), &JsString::new());

    // 3. Stray Bengali-Assamese characters inside a Syloti word.
    s = fold_stray_bengali(&s);

    // 4. Dotted native abbreviations.
    s = rewrite_with(&s, &DOTTED, |m, full| {
        js_re!(r"\.", "gu").replace(&m.value(full), &JsString::new())
    });

    // 5. De-grouping, to a fixed point.
    loop {
        let prev = s.clone();
        s = rewrite(
            &s,
            js_re!(r"(\p{Nd})(?<!(?<!\p{Nd})0),(?=\p{Nd}{2,3}(?!\p{Nd}))", "gu"),
            &js("$1"),
        );
        if prev == s {
            break;
        }
    }

    // 6. Ascending ranges.
    s = rewrite_with(&s, &RANGE, |m, full| {
        let a = m.group(1, full).unwrap_or_default();
        let b = m.group(2, full).unwrap_or_default();
        if num_value(&b) > num_value(&a) {
            a.concat(&js(&format!(" {RANGE_WORD} "))).concat(&b)
        } else {
            m.value(full)
        }
    });

    // 7. Degrees: the Syloti scale abbreviations, the Latin scale letters, the bare sign.
    s = rewrite_with(&s, &SCALE_RE, |m, full| {
        let n = m.group(1, full).unwrap_or_default();
        let sc = m.group(2, full).unwrap_or_default().to_upper_case();
        let scale = lookup(&SCALE, &sc).unwrap_or_default();
        n.concat(&js(&format!(" {DEGREE_WORD} {scale}")))
    });
    s = rewrite_with(
        &s,
        js_re!(r"(\p{Nd})\s*°\s*([CF])(?![\p{L}\p{M}])", "gui"),
        |m, full| {
            let n = m.group(1, full).unwrap_or_default();
            let sc = m.group(2, full).unwrap_or_default().to_upper_case();
            let scale = if sc == js("C") {
                SCALE[0].1
            } else {
                SCALE[1].1
            };
            n.concat(&js(&format!(" {DEGREE_WORD} {scale}")))
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(\p{Nd})\s*°", "gu"),
        &js(&format!("$1 {DEGREE_WORD}")),
    );

    // 8. The decimal point, refusing a DOI/URL.
    s = rewrite(
        &s,
        js_re!(r"(?<!\.\p{Nd}*)(\p{Nd})\.(?=\p{Nd})(?!\p{Nd}*[./])", "gu"),
        &js(&format!("$1 {DECIMAL_WORD} ")),
    );

    // 9. Percent, postposed; a `%` with no operand still reads.
    s = rewrite(
        &s,
        js_re!(r"(\p{Nd})\s*%", "gu"),
        &js(&format!("$1 {PERCENT_WORD}")),
    );
    s = rewrite(&s, js_re!(r"%", "gu"), &js(&format!(" {PERCENT_WORD} ")));

    // 10. Taka: dropped where the word is already there.
    s = rewrite(
        &s,
        js_re!(r"৳\s*(\p{Nd}+)(?![^\p{Nd}]{0,3}ꠐꠦꠈꠣ)", "gu"),
        &js(&format!("$1 {CURRENCY_WORD}")),
    );
    s = rewrite(&s, js_re!(r"৳\s*(\p{Nd}+)", "gu"), &js("$1"));
    s = rewrite(
        &s,
        js_re!(r"৳(?![^\p{Nd}]{0,3}ꠐꠦꠈꠣ)", "gu"),
        &js(&format!(" {CURRENCY_WORD} ")),
    );
    s = rewrite(&s, js_re!(r"৳", "gu"), &JsString::new());

    s
}
