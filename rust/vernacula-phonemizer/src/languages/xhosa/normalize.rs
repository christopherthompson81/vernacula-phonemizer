//! Xhosa (xh) text normalization: entities and the ampersand, dotted capitals and abbreviations, digit grouping,
//! the currency sign prised off its concord, decimals with a sign or unit, ranges, clocks (the one rule that
//! makes words), rates, degrees, ordinal suffixes, signs, decimals and initialisms.
//! Ported from src/languages/xhosa/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::LazyLock;

use super::manifest::MANIFEST;
use super::numbers::number_to_words;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{alternation, sorted_by_length_desc};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;
use crate::languages::zulu::normalize::spell_nguni_initialisms;

fn unit_word(k: &JsString) -> Option<&'static str> {
    Some(match k.to_string_lossy().as_str() {
        "km" => "iikhilomitha",
        "m" => "iimitha",
        "cm" => "iisentimitha",
        "mm" => "iimilimitha",
        "mi" => "iimayile",
        "kg" => "iikhilogram",
        _ => return None,
    })
}

fn per(k: &JsString) -> Option<&'static str> {
    Some(match k.to_string_lossy().as_str() {
        "h" | "u" => "ngeyure",
        "s" => "ngomzuzwana",
        _ => return None,
    })
}

fn cur_word(k: &JsString) -> &'static str {
    match k.to_string_lossy().as_str() {
        "US$" => "iidola zaseMelika",
        "AUD$" | "$" => "iidola",
        "£" => "iiponti",
        "¥" => "iiyeni",
        _ => "",
    }
}

fn compass(c: &JsString) -> &'static str {
    match c.to_string_lossy().as_str() {
        "N" => "emantla",
        "S" => "emazantsi",
        "E" => "empuma",
        "W" => "entshona",
        _ => "undefined",
    }
}

/// `MAGNITUDES`: shared with xhosa.rs's symbol tier.
pub const MAGNITUDES: [&str; 6] = [
    "yezigidi",
    "zezigidi",
    "izigidi",
    "bhiliyoni",
    "miliyoni",
    "million",
];

const AM: &str = "kusasa";
const PM: &str = "emva kwemini";

/// `connective(n)`: `na-` + the numeral's words, with the vowel coalescence; 1–9 from the manifest's `na` series.
fn connective(n: f64) -> JsString {
    if n < 10.0 {
        return match MANIFEST.numbers.na.get(n as usize) {
            Some(w) => js(w),
            None => number_to_words(n, None),
        };
    }
    let mut parts = number_to_words(n, None).split(&js(" "));
    let head = parts[0].clone();
    let first = head.char_at(0).to_lower_case().to_string_lossy();
    let v = match first.as_str() {
        "a" => Some("a"),
        "e" | "i" => Some("e"),
        "o" | "u" => Some("o"),
        _ => None,
    };
    parts[0] = match v {
        None => js("na ").concat(&head),
        Some(v) => js(&format!("n{v}")).concat(&head.slice(1, None)),
    };
    JsString::join(&parts, &js(" "))
}

fn clock_words(h: f64, m: f64) -> JsString {
    if m == 0.0 {
        number_to_words(h, None)
    } else {
        number_to_words(h, None)
            .concat(&js(" "))
            .concat(&connective(m))
    }
}

/// `spell(int, frac)`: the integer, then each fractional digit.
fn spell(int: &JsString, frac: &JsString) -> JsString {
    let digits = JsString::join(&frac.code_point_strings(), &js(" "));
    int.concat(&js(" ")).concat(&digits)
}

fn said_before(full: &JsString, offset: usize, word: &str) -> bool {
    full.slice(offset.saturating_sub(40) as isize, Some(offset as isize))
        .includes(&js(word))
}

fn degree_body(n: &JsString, offset: usize, full: &JsString) -> JsString {
    if said_before(full, offset, "maqondo") {
        n.clone()
    } else {
        js("amaqondo ").concat(n)
    }
}

static CURRENCY_DECIMAL: LazyLock<JsRegex> = LazyLock::new(|| {
    let mags = sorted_by_length_desc(MAGNITUDES.iter().map(|m| js(m)));
    JsRegex::new(
        &format!(
            "(?<![\\p{{L}}\\p{{M}}])(US\\$|AUD\\$|[$£¥])[ \u{a0}]?(\\d+)([.,])(\\d+)((?:[ \u{a0}](?:{}))?)",
            alternation(&mags)
        ),
        "gu",
    )
    .unwrap()
});

fn is_decimal(sep: &JsString, frac: &JsString) -> bool {
    *sep == "." || frac.len() <= 2
}

/// `normalizeXhosa(input)`.
pub fn normalize_xhosa(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1
    s = rewrite(
        &rewrite(&s, js_re!(r"&amp;", "giu"), &js("&")),
        js_re!(r"&", "gu"),
        &js(" kunye "),
    );

    // 2
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(?:\p{Lu}\.){2,}", "gu"),
        |m, full| {
            let run = m.value(full);
            let letters = js_re!(r"\.", "gu").replace(&run, &JsString::new());
            let rest = full.slice(m.end() as isize, None);
            if js_re!(r"^[\p{L}\p{M}]", "u").test(&rest) {
                return letters.concat(&js(" "));
            }
            if rest.is_empty() || js_re!(r"^[ \u00a0]+\p{Lu}", "u").test(&rest) {
                letters.concat(&js("."))
            } else {
                letters
            }
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(\p{Lu})\.(\p{Lu})(?![\p{L}\p{M}])", "gu"),
        &js("$1$2"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{Lu}\p{M}])(\p{Lu})\.(?=\p{Lu}\p{Ll})", "gu"),
        &js("$1 "),
    );

    // 3
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])([uU]?)Mnu\.?(?=[ \u00a0]\p{Lu})", "gu"),
        &js("$1Mnumzana"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])Jr\.(?=[ \u00a0]\p{Ll})", "gu"),
        &js("Jr"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])njll?\.?(?![\p{L}\p{M}])", "giu"),
        &js("njalonjalo"),
    );

    // 4
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2})(?:,\d{3})+(?![\d]|,\d)", "gu"),
        |m, s| js_re!(",", "gu").replace(&m.value(s), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?![\d])",
            "gu"
        ),
        |m, s| js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&m.value(s), &JsString::new()),
    );

    // 5 — the split before the join
    s = rewrite(
        &s,
        js_re!(r"(?<=[\p{L}\p{M}])(?=(?:US|AUD)?[$£¥€][ \u00a0]?\d)", "gu"),
        &js(" "),
    );
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(US|AUD)[ \u00a0]+(?=[$£¥€][ \u00a0]?\d)",
            "gu"
        ),
        &js("$1"),
    );

    // 6
    s = rewrite_with(&s, &CURRENCY_DECIMAL, |m, s| {
        let (sym, int, sep, frac) = (
            m.group(1, s).unwrap(),
            m.group(2, s).unwrap(),
            m.group(3, s).unwrap(),
            m.group(4, s).unwrap(),
        );
        if !is_decimal(&sep, &frac) {
            return m.value(s);
        }
        let mag = m.group(5, s).unwrap();
        let out = spell(&int, &frac)
            .concat(&mag)
            .concat(&js(" "))
            .concat(&js(cur_word(&sym)));
        js_re!(r"[ \u00a0]+$", "u").replace(&out, &JsString::new())
    });
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+)([.,])(\d+)[ \u00a0]?(km|mm|cm|kg|mi|m)(?![\p{L}\p{M}'’ʼ])",
            "gu"
        ),
        |m, s| {
            let (int, sep, frac) = (
                m.group(1, s).unwrap(),
                m.group(2, s).unwrap(),
                m.group(3, s).unwrap(),
            );
            if !is_decimal(&sep, &frac) {
                return m.value(s);
            }
            let u = unit_word(&m.group(4, s).unwrap()).unwrap_or("undefined");
            spell(&int, &frac).concat(&js(&format!(" {u}")))
        },
    );

    // 7
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+\.\d+)[ \u00a0]?[-–][ \u00a0]?(\d+\.\d+)(?![\d.])",
            "gu"
        ),
        &js("$1 ukuya ku $2"),
    );

    // 8
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:.,])([01]?\d|2[0-3]):[ \u00a0]?([0-5]\d)(?![:.\d])(?:[ \u00a0]*([AaPp])\.?[Mm]\.?(?![\p{L}\p{M}]))?",
            "gu"
        ),
        |m, s| {
            let hv = js_number(&m.group(1, s).unwrap());
            let mv = js_number(&m.group(2, s).unwrap());
            if hv > 23.0 || mv > 59.0 {
                return m.value(s);
            }
            let marker = match m.group(3, s) {
                None => String::new(),
                Some(ap) if ap.to_lower_case() == "p" => format!(" {PM}"),
                Some(_) => format!(" {AM}"),
            };
            clock_words(hv, mv).concat(&js(&marker))
        },
    );

    // 9
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d{1,2})\.([0-5]\d)(?![.\d])[ \u00a0]*(UTC|GMT)",
            "gu"
        ),
        |m, s| {
            let hv = js_number(&m.group(1, s).unwrap());
            if hv > 23.0 {
                return m.value(s);
            }
            clock_words(hv, js_number(&m.group(2, s).unwrap()))
                .concat(&js(" "))
                .concat(&m.group(3, s).unwrap())
        },
    );

    // 9b
    s = rewrite(
        &s,
        js_re!(r"(\d)[ \u00a0]?:[ \u00a0]?(?=\d)", "gu"),
        &js("$1 "),
    );

    // 10
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+)[ \u00a0]?[-–][ \u00a0]?(\d+)(?![\d.,])",
            "gu"
        ),
        |m, s| {
            let (a, b) = (m.group(1, s).unwrap(), m.group(2, s).unwrap());
            if js_number(&a) < js_number(&b) {
                a.concat(&js(" ukuya ku ")).concat(&b)
            } else {
                m.value(s)
            }
        },
    );

    // 11
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+)[ \u00a0]?(km|mi|m)[ \u00a0]*\/[ \u00a0]*(h|u|s)(?![\p{L}\p{M}])",
            "giu"
        ),
        |m, s| {
            let head = unit_word(&m.group(2, s).unwrap().to_lower_case());
            let p = per(&m.group(3, s).unwrap().to_lower_case());
            match (head, p) {
                (Some(h), Some(p)) => m.group(1, s).unwrap().concat(&js(&format!(" {h} {p}"))),
                _ => m.value(s),
            }
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+)[ \u00a0]?(mph|kph)(?![\p{L}\p{M}])",
            "giu"
        ),
        |m, s| {
            let head = if m.group(2, s).unwrap().to_lower_case() == "kph" {
                "iikhilomitha"
            } else {
                "iimayile"
            };
            m.group(1, s)
                .unwrap()
                .concat(&js(&format!(" {head} ngeyure")))
        },
    );

    // 12
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d])([+-])?(\d+)[ \u00a0]?°[ \u00a0]?[CF](?![\p{L}\p{M}])",
            "gui"
        ),
        |m, s| {
            let body = degree_body(&m.group(2, s).unwrap(), m.index(), s);
            match m.group(1, s) {
                Some(sign) if sign == "+" => js("plas ").concat(&body),
                Some(sign) if sign == "-" => js("thabatha ").concat(&body),
                _ => body,
            }
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)[ \u00a0]?°[ \u00a0]?([NSEW])(?![\p{L}\p{M}])", "gu"),
        |m, s| {
            degree_body(&m.group(1, s).unwrap(), m.index(), s)
                .concat(&js(&format!(" {}", compass(&m.group(2, s).unwrap()))))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)[ \u00a0]?[°º](?![\p{L}\p{M}])", "gu"),
        |m, s| degree_body(&m.group(1, s).unwrap(), m.index(), s),
    );

    // 13
    s = rewrite(
        &s,
        js_re!(r"(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])", "giu"),
        &js("$1"),
    );

    // 14
    s = rewrite(
        &s,
        js_re!(r"[ \u00a0]*[=≈][ \u00a0]*", "gu"),
        &js(" lilingana ne "),
    );
    s = rewrite(
        &s,
        js_re!(r"[ \u00a0]*<[ \u00a0]*", "gu"),
        &js(" ngaphantsi kuna "),
    );
    s = rewrite(
        &s,
        js_re!(r"[ \u00a0]*>[ \u00a0]*", "gu"),
        &js(" ngaphezulu kuna "),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)[ \u00a0]*×[ \u00a0]*(?=\d)", "gu"),
        &js("$1 phindaphinda "),
    );
    s = rewrite(&s, js_re!(r"[ \u00a0]*÷[ \u00a0]*", "gu"), &js(" yahlula "));
    s = rewrite(&s, js_re!(r"(?<=[\p{L}\d])\+(?=\d)", "gu"), &js(" plas "));
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d])\+[ \u00a0]?(?=\d)", "gu"),
        &js("plas "),
    );
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d])(?<![\p{L}\p{M}][ \u00a0])[-−](?=\d)",
            "gu"
        ),
        &js("thabatha "),
    );

    // 15
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?![\d])", "gu"),
        |m, s| spell(&m.group(1, s).unwrap(), &m.group(2, s).unwrap()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+),(\d{1,2})(?![\d,])", "gu"),
        |m, s| spell(&m.group(1, s).unwrap(), &m.group(2, s).unwrap()),
    );

    s = spell_nguni_initialisms(&s);

    rewrite(
        &rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" ")),
        js_re!(r"^[^\S\n]+|[^\S\n]+$", "gu"),
        &JsString::new(),
    )
}
