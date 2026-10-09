//! Shared Unicode constants and the script-agnostic folds every normalizer reaches for.
//! Ported from src/core/unicode.ts — see that file for the corpus evidence behind each fold.

use std::sync::LazyLock;

use super::js_regex::JsRegex;
use super::js_string::{JsString, js};
use super::provenance::{Form, normalize, rewrite, rewrite_with};
use crate::js_re;

pub use super::ipa::IPA_VOWELS;

pub const COMBINING_DIACRITICS: &str = "̀-ͯ";
pub const TIE_BAR: &str = "͡";
pub const ATTACHING_MODIFIERS: &str = "ːˑʲʰʱʼ";
pub const STRESS_PRIMARY: &str = "ˈ";
pub const STRESS_SECONDARY: &str = "ˌ";
pub const DEVANAGARI_BLOCK: &str = "ऀ-ॿ";
pub const DEVANAGARI_WORD: &str = "ऀ-ॣॲ-ॿ";
pub const BENGALI_WORD: &str = "ঀ-ৣৰ-৾";
pub const GUJARATI_WORD: &str = "઀-૥૰-૿";

/// The ten digits of a block starting at `zero`, as the TS `Record<digit, "0".."9">`.
fn digit_table(zero: u16) -> Vec<(JsString, JsString)> {
    (0..10)
        .map(|d| (JsString(vec![zero + d]), js(&d.to_string())))
        .collect()
}

pub static DEVANAGARI_DIGITS: LazyLock<Vec<(JsString, JsString)>> =
    LazyLock::new(|| digit_table(0x0966));
pub static GUJARATI_DIGITS: LazyLock<Vec<(JsString, JsString)>> =
    LazyLock::new(|| digit_table(0x0AE6));
pub static BENGALI_DIGITS: LazyLock<Vec<(JsString, JsString)>> =
    LazyLock::new(|| digit_table(0x09E6));

fn latin_atomic(c: &JsString) -> Option<&'static str> {
    Some(match c.to_string_lossy().as_str() {
        "ø" => "o",
        "æ" => "ae",
        "œ" => "oe",
        "ß" => "ss",
        "ł" => "l",
        "đ" => "d",
        "ð" => "d",
        "þ" => "th",
        "ħ" => "h",
        "ı" => "i",
        "ŋ" => "ng",
        _ => return None,
    })
}

/// Strip combining marks after NFD, then fold the atomic letters NFD cannot decompose.
pub fn fold_latin_diacritics(s: &JsString) -> JsString {
    let stripped = js_re!(r"\p{M}+", "gu").replace(&normalize(s, Form::Nfd), &JsString::new());
    js_re!("[øæœßłđðþħıŋ]", "gu").replace_with(&stripped, |m, s| {
        let c = m.value(s);
        latin_atomic(&c).map_or(c, js)
    })
}

const NATIVE_DIGIT_BASES: [u32; 24] = [
    0x0660, 0x06f0, 0x07c0, 0x0966, 0x09e6, 0x0a66, 0x0ae6, 0x0b66, 0x0be6, 0x0c66, 0x0ce6, 0x0d66,
    0x0de6, 0x0e50, 0x0ed0, 0x0f20, 0x1040, 0x1090, 0x17e0, 0x1bb0, 0x1c50, 0xa9d0, 0x1e950,
    0xff10,
];

/// One native digit to ASCII; a block not carried is left alone rather than guessed.
pub fn fold_digit_char(ch: &JsString) -> JsString {
    let Some(cp) = ch.code_point_at(0) else {
        return ch.clone();
    };
    if cp < 0x80 {
        return ch.clone();
    }
    for base in NATIVE_DIGIT_BASES {
        if cp >= base && cp <= base + 9 {
            return js(&(cp - base).to_string());
        }
    }
    ch.clone()
}

/// ⚠ OFF the provenance seam, deliberately (a fold of a word, not of the pipeline string).
pub fn fold_digits_in(s: &JsString) -> JsString {
    js_re!(r"\p{Nd}", "gu").replace_with(s, |m, s| fold_digit_char(&m.value(s)))
}

pub fn fold_native_digits(s: &JsString) -> JsString {
    rewrite_with(s, js_re!(r"\p{Nd}", "gu"), |m, s| {
        fold_digit_char(&m.value(s))
    })
}

pub fn fold_subscript_digits(s: &JsString) -> JsString {
    rewrite_with(s, js_re!(r"[₀-₉]", "gu"), |m, s| {
        JsString(vec![m.value(s).0[0] - 0x2080 + 0x30])
    })
}

pub fn fold_spaced_dash(s: &JsString) -> JsString {
    rewrite(
        s,
        js_re!(
            r#"(?<=\S)(?<![.!?,;:…][)\]}"'»”’]*)[ \t ]+[-‐‑‒–—―]+[ \t ]+(?=[^\s\d.!?,;:…])"#,
            "gu"
        ),
        &js(", "),
    )
}

/// Insertion order is the TS object's: it builds the character class.
const LATIN_CONFUSABLE: [(&str, &str); 44] = [
    ("ϊ", "ï"),
    ("Α", "A"),
    ("Β", "B"),
    ("Ε", "E"),
    ("Η", "H"),
    ("Ι", "I"),
    ("Κ", "K"),
    ("Μ", "M"),
    ("Ν", "N"),
    ("Ο", "O"),
    ("Ρ", "P"),
    ("Τ", "T"),
    ("Υ", "Y"),
    ("Χ", "X"),
    ("α", "a"),
    ("ο", "o"),
    ("ρ", "p"),
    ("υ", "u"),
    ("β", "ß"),
    ("ν", "v"),
    ("κ", "k"),
    ("χ", "x"),
    ("ι", "i"),
    ("А", "A"),
    ("В", "B"),
    ("Е", "E"),
    ("К", "K"),
    ("М", "M"),
    ("Н", "H"),
    ("О", "O"),
    ("Р", "P"),
    ("С", "C"),
    ("Т", "T"),
    ("У", "Y"),
    ("Х", "X"),
    ("а", "a"),
    ("е", "e"),
    ("о", "o"),
    ("р", "p"),
    ("с", "c"),
    ("у", "y"),
    ("х", "x"),
    ("і", "i"),
    ("ё", "ë"),
];

fn table_lookup(table: &[(&str, &str)], c: &JsString) -> Option<JsString> {
    table.iter().find(|(k, _)| c == *k).map(|(_, v)| js(v))
}

fn keys_class(table: &[(&str, &str)]) -> String {
    table.iter().map(|(k, _)| *k).collect()
}

static CONFUSABLE_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<=\p{{Script=Latin}})([{}])(?![\p{{Script=Greek}}\p{{Script=Cyrillic}}])",
            keys_class(&LATIN_CONFUSABLE)
        ),
        "gu",
    )
    .unwrap()
});

pub fn fold_latin_confusables(s: &JsString) -> JsString {
    if !CONFUSABLE_RE.test(s) {
        return s.clone();
    }
    rewrite_with(s, &CONFUSABLE_RE, |m, s| {
        table_lookup(&LATIN_CONFUSABLE, &m.value(s)).unwrap()
    })
}

const CYRILLIC_CONFUSABLE: [(&str, &str); 25] = [
    ("a", "\u{0430}"),
    ("c", "\u{0441}"),
    ("e", "\u{0435}"),
    ("i", "\u{0456}"),
    ("j", "\u{0458}"),
    ("o", "\u{043e}"),
    ("p", "\u{0440}"),
    ("s", "\u{0455}"),
    ("x", "\u{0445}"),
    ("y", "\u{0443}"),
    ("A", "\u{0410}"),
    ("B", "\u{0412}"),
    ("C", "\u{0421}"),
    ("E", "\u{0415}"),
    ("H", "\u{041d}"),
    ("I", "\u{0406}"),
    ("J", "\u{0408}"),
    ("K", "\u{041a}"),
    ("M", "\u{041c}"),
    ("O", "\u{041e}"),
    ("P", "\u{0420}"),
    ("S", "\u{0405}"),
    ("T", "\u{0422}"),
    ("X", "\u{0425}"),
    ("Y", "\u{0423}"),
];

const CHUVASH_CONFUSABLE: [(&str, &str); 8] = [
    ("\u{0103}", "\u{04d1}"),
    ("\u{0115}", "\u{04d7}"),
    ("\u{00e7}", "\u{04ab}"),
    ("\u{00fc}", "\u{04f3}"),
    ("\u{0102}", "\u{04d0}"),
    ("\u{0114}", "\u{04d6}"),
    ("\u{00c7}", "\u{04aa}"),
    ("\u{00dc}", "\u{04f2}"),
];

static CHV_KEYS: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!("[{}]", keys_class(&CHUVASH_CONFUSABLE)), "gu").unwrap()
});
static CYR_KEYS: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!("[{}]", keys_class(&CYRILLIC_CONFUSABLE)), "gu").unwrap()
});

fn script_counts(w: &JsString) -> (usize, usize) {
    let (mut cyr, mut lat) = (0, 0);
    let cyrillic = js_re!(r"\p{Script=Cyrillic}", "u");
    let latin = js_re!(r"\p{Script=Latin}", "u");
    let mut i = 0;
    while i < w.len() {
        let cp = w.code_point_at(i).unwrap();
        let width = if cp > 0xFFFF { 2 } else { 1 };
        let ch = JsString::from_units(&w.0[i..i + width]);
        if cyrillic.test(&ch) {
            cyr += 1;
        } else if latin.test(&ch) {
            lat += 1;
        }
        i += width;
    }
    (cyr, lat)
}

pub fn fold_cyrillic_confusables(s: &JsString, host_is_cyrillic: bool) -> JsString {
    if !js_re!(r"\p{Script=Cyrillic}", "u").test(s) {
        return s.clone();
    }
    rewrite_with(s, js_re!(r"[\p{L}\p{M}\p{Nd}]+", "gu"), |m, s| {
        let w = m.value(s);
        let (cyr, lat) = script_counts(&w);
        if cyr == 0 || lat == 0 {
            return w;
        }
        let w = CHV_KEYS.replace_with(&w, |m, s| {
            table_lookup(&CHUVASH_CONFUSABLE, &m.value(s)).unwrap()
        });
        let (cyr, lat) = script_counts(&w);
        if lat == 0 || lat > cyr {
            return w;
        }
        if lat == cyr && !host_is_cyrillic {
            return w;
        }
        CYR_KEYS.replace_with(&w, |m, s| {
            table_lookup(&CYRILLIC_CONFUSABLE, &m.value(s)).unwrap()
        })
    })
}

pub fn fold_cyrillic_stress_marks(s: &JsString) -> JsString {
    if !js_re!(r"[̀́̀́]", "u").test(s) {
        return s.clone();
    }
    rewrite_with(
        s,
        js_re!(r"(\p{Script=Cyrillic})([̀́̀́]+)", "gu"),
        |m, s| {
            let base = m.group(1, s).unwrap();
            let composed = normalize(&base.concat(&m.group(2, s).unwrap()), Form::Nfc);
            if composed.code_points().count() == 1 {
                composed
            } else {
                base
            }
        },
    )
}

const CP1252_BACK: [(u32, u32); 27] = [
    (0x20ac, 0x80),
    (0x201a, 0x82),
    (0x0192, 0x83),
    (0x201e, 0x84),
    (0x2026, 0x85),
    (0x2020, 0x86),
    (0x2021, 0x87),
    (0x02c6, 0x88),
    (0x2030, 0x89),
    (0x0160, 0x8a),
    (0x2039, 0x8b),
    (0x0152, 0x8c),
    (0x017d, 0x8e),
    (0x2018, 0x91),
    (0x2019, 0x92),
    (0x201c, 0x93),
    (0x201d, 0x94),
    (0x2022, 0x95),
    (0x2013, 0x96),
    (0x2014, 0x97),
    (0x02dc, 0x98),
    (0x2122, 0x99),
    (0x0161, 0x9a),
    (0x203a, 0x9b),
    (0x0153, 0x9c),
    (0x017e, 0x9e),
    (0x0178, 0x9f),
];

/// The byte a CP1252-misread code unit stood for. `m[1]` in the TS is one code UNIT of the match.
fn source_byte(u: u16) -> Option<u32> {
    let o = u as u32;
    if let Some(&(_, b)) = CP1252_BACK.iter().find(|(c, _)| *c == o) {
        return Some(b);
    }
    (0x80..=0xff).contains(&o).then_some(o)
}

fn from_code_point(cp: u32) -> JsString {
    match char::from_u32(cp) {
        Some(c) => js(c.encode_utf8(&mut [0; 4])),
        None => JsString(vec![cp as u16]),
    }
}

pub fn repair_double_encoded(s: &JsString) -> JsString {
    if !js_re!(r"[Â-Åâã]", "u").test(s) {
        return s.clone();
    }
    let s = rewrite_with(s, js_re!(r"â[\s\S]{2}", "gu"), |m, s| {
        let v = m.value(s);
        let (b2, b3) = match (
            v.0.get(1).and_then(|&u| source_byte(u)),
            v.0.get(2).and_then(|&u| source_byte(u)),
        ) {
            (Some(b2), Some(b3)) => (b2, b3),
            _ => return v,
        };
        if !(0x80..=0xbf).contains(&b2) || !(0x80..=0xbf).contains(&b3) {
            return v;
        }
        from_code_point(((0xe2 & 0x0f) << 12) | ((b2 - 0x80) << 6) | (b3 - 0x80))
    });
    let s = rewrite(&s, js_re!(r"â€�", "gu"), &js("\u{201d}"));
    let s = rewrite(&s, js_re!(r"â€(?=[\p{L}\p{M}\s]|$)", "gu"), &js("\u{201c}"));
    rewrite_with(&s, js_re!(r"([Â-Åâã])([\u0080-¿])", "gu"), |m, s| {
        let lead = m.group(1, s).unwrap().code_point_at(0).unwrap();
        let c = m.group(2, s).unwrap().code_point_at(0).unwrap();
        from_code_point(((lead & 0x1f) << 6) | (c & 0x3f))
    })
}

fn caret_sup(c: u32) -> Option<char> {
    Some(match char::from_u32(c)? {
        '0' => '⁰',
        '1' => '¹',
        '2' => '²',
        '3' => '³',
        '4' => '⁴',
        '5' => '⁵',
        '6' => '⁶',
        '7' => '⁷',
        '8' => '⁸',
        '9' => '⁹',
        '-' => '⁻',
        '+' => '⁺',
        _ => return None,
    })
}

pub fn fold_caret_exponents(s: &JsString) -> JsString {
    if !s.includes(&js("^")) {
        return s.clone();
    }
    rewrite_with(
        s,
        js_re!(r"(?<=[\p{L}\p{Nd}])\^\{?([+-]?\d+)\}?", "gu"),
        |m, s| {
            let exp = m.group(1, s).unwrap();
            let mut out = JsString::new();
            for cp in exp.code_points() {
                match caret_sup(cp) {
                    Some(c) => out.push_str(&js(c.encode_utf8(&mut [0; 4]))),
                    None => out.push_str(&from_code_point(cp)),
                }
            }
            out
        },
    )
}

const VULGAR: [(&str, &str); 18] = [
    ("¼", "1/4"),
    ("½", "1/2"),
    ("¾", "3/4"),
    ("⅐", "1/7"),
    ("⅑", "1/9"),
    ("⅒", "1/10"),
    ("⅓", "1/3"),
    ("⅔", "2/3"),
    ("⅕", "1/5"),
    ("⅖", "2/5"),
    ("⅗", "3/5"),
    ("⅘", "4/5"),
    ("⅙", "1/6"),
    ("⅚", "5/6"),
    ("⅛", "1/8"),
    ("⅜", "3/8"),
    ("⅝", "5/8"),
    ("⅞", "7/8"),
];

static VULGAR_RE: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("[{}]", keys_class(&VULGAR)), "gu").unwrap());

pub fn fold_vulgar_fractions(s: &JsString) -> JsString {
    if !VULGAR_RE.test(s) {
        return s.clone();
    }
    rewrite_with(s, &VULGAR_RE, |m, full| {
        let off = m.index();
        let prev = if off == 0 {
            JsString::new()
        } else {
            full.char_at(off - 1)
        };
        let mut out = if js_re!(r"\d", "u").test(&prev) {
            js(" ")
        } else {
            JsString::new()
        };
        out.push_str(&table_lookup(&VULGAR, &m.value(full)).unwrap());
        out
    })
}

pub fn fold_squared_degrees(s: &JsString) -> JsString {
    let s = rewrite(s, js_re!("℃", "gu"), &js("\u{00b0}C"));
    rewrite(&s, js_re!("℉", "gu"), &js("\u{00b0}F"))
}

pub fn fold_fullwidth_latin(s: &JsString) -> JsString {
    let re = js_re!(r"[０-９Ａ-Ｚａ-ｚ]", "gu");
    if !re.test(s) {
        return s.clone();
    }
    rewrite_with(s, re, |m, s| JsString(vec![m.value(s).0[0] - 0xFEE0]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn latin_diacritics_fold() {
        // Only the lowercase atomics are in the table; NFD does not decompose Æ or Đ.
        assert_eq!(
            fold_latin_diacritics(&js("Ærøskøbing Đuro café")),
            "Æroskobing Đuro cafe"
        );
    }

    #[test]
    fn native_digits_fold() {
        assert_eq!(fold_digits_in(&js("৩৫ ٢")), "35 2");
    }

    #[test]
    fn vulgar_fraction_spacing() {
        assert_eq!(fold_vulgar_fractions(&js("2½ and ¼")), "2 1/2 and 1/4");
    }
}
