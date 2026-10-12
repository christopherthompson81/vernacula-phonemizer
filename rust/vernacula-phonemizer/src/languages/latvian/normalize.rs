//! Latvian (lv) text normalization: de-grouping, the dotted abbreviations (`lpp.`, `nr.`, `№`, the era and
//! list abbreviations, with the sentence period restored), the ordinal period read from its head noun, ranges,
//! the symbol tier, degrees, signs and the decimal comma.
//! Ported from src/languages/latvian/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::{Arc, LazyLock};

use indexmap::IndexMap;

use super::numbers::number_to_words;
use super::ordinals::{head_noun, ordinal_words};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::normalize_symbols::{
    BareExponent, ExponentPosition, ExponentWords, Multiply, PositionDecl, SymbolData,
    SymbolNormalizer, UnitPer, make_symbol_normalizer,
};
use crate::core::provenance::{escape, rewrite, rewrite_with};
use crate::js_re;

/// `countForm(n)`: 0 after …1 but not …11, else 1 (JS `%` on a number).
pub fn count_form(n: f64) -> f64 {
    if n % 10.0 == 1.0 && n % 100.0 != 11.0 {
        0.0
    } else {
        1.0
    }
}

fn pair(one: &str, many: &str) -> Vec<String> {
    vec![one.to_string(), many.to_string()]
}

/// The shared symbol tier (normalize.ts `SYMBOLS`).
static SYMBOLS: LazyLock<SymbolNormalizer> = LazyLock::new(|| {
    let mut currency = IndexMap::new();
    currency.insert("$".to_string(), pair("dolārs", "dolāri"));
    currency.insert("€".to_string(), pair("eiro", "eiro"));
    currency.insert("£".to_string(), pair("mārciņa", "mārciņas"));
    let mut units = IndexMap::new();
    for (k, a, b) in [
        ("km", "kilometrs", "kilometri"),
        ("m", "metrs", "metri"),
        ("cm", "centimetrs", "centimetri"),
        ("mm", "milimetrs", "milimetri"),
        ("kg", "kilograms", "kilogrami"),
        ("g", "grams", "grami"),
        ("ha", "hektārs", "hektāri"),
        ("nm", "nanometrs", "nanometri"),
        ("t", "tonna", "tonnas"),
    ] {
        units.insert(k.to_string(), pair(a, b));
    }
    let mut rate = IndexMap::new();
    for (k, v) in [("h", "stundā"), ("s", "sekundē"), ("sek", "sekundē")] {
        rate.insert(k.to_string(), v.to_string());
    }
    let words = |xs: &[&str]| xs.iter().map(|s| s.to_string()).collect::<Vec<_>>();
    make_symbol_normalizer(&SymbolData {
        percent: Some(pair("procents", "procenti")),
        currency: Some(currency),
        units: Some(units),
        magnitudes: Some(words(&[
            "miljardiem",
            "miljardus",
            "miljardi",
            "miljardu",
            "miljards",
            "miljoniem",
            "miljonus",
            "miljoni",
            "miljonu",
            "miljons",
            "tūkstošiem",
            "tūkstošus",
            "tūkstoši",
            "tūkstošu",
            "tūkstotis",
        ])),
        rate_denominators: Some(rate),
        unit_per: Some(UnitPer::All(String::new())),
        exponent_words: Some(ExponentWords {
            squared: Some(words(&["kvadrāt"])),
            cubed: Some(words(&["kubik"])),
            position: Some(PositionDecl::All(ExponentPosition::Compound)),
        }),
        bare_exponent: Some(BareExponent {
            squared: Some("{n} kvadrātā".into()),
            cubed: Some("{n} kubā".into()),
            power: Some("{n} pakāpē {e}".into()),
            negative: Some("mīnuss".into()),
        }),
        multiply: Some(Multiply {
            times: "reiz".into(),
            by: None,
        }),
        ampersand: Some("un".into()),
        count_form: Some(Arc::new(count_form)),
        ..Default::default()
    })
    .expect("latvian SYMBOLS")
});

/// The symbol tier on its own (for the differential).
pub(crate) fn latvian_symbols(s: &JsString) -> JsString {
    SYMBOLS.apply(s)
}

const ABBREVIATION: [(&str, &str); 10] = [
    ("p.m.ē.", "pirms mūsu ēras"),
    ("m.ē.", "mūsu ēras"),
    ("u.tml.", "un tamlīdzīgi"),
    ("u.t.t.", "un tā tālāk"),
    ("t.sk.", "tai skaitā"),
    ("utt.", "un tā tālāk"),
    ("u.c.", "un citi"),
    ("t.i.", "tas ir"),
    ("piem.", "piemēram"),
    ("plkst.", "pulksten"),
];

static ABBREVIATION_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let mut keys: Vec<&str> = ABBREVIATION.iter().map(|(k, _)| *k).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.encode_utf16().count()));
    let alt: Vec<String> = keys.iter().map(|k| escape(k)).collect();
    JsRegex::new(
        &format!(r"(?<![\p{{L}}\p{{M}}.])(?:{})", alt.join("|")),
        "gu",
    )
    .unwrap()
});

const PAGE: [&str; 2] = ["lappuse", "lappuses"];
const NUMBER_ABBREV: &str = "numurs";

/// `gap || " "`.
fn gap_or_space(g: Option<JsString>) -> JsString {
    g.filter(|g| !g.is_empty()).unwrap_or_else(|| js(" "))
}

/// `abbreviations(text)`: `lpp.`, `nr.`, `№`, then the dotted abbreviations.
fn abbreviations(text: &JsString) -> JsString {
    let mut s = rewrite_with(
        text,
        js_re!(r"(?<![\p{L}\p{M}])(\d+)(\s*)lpp\.?(?![\p{L}\p{M}])", "giu"),
        |mm, t| {
            let fig = mm.group(1, t).unwrap();
            fig.concat(&gap_or_space(mm.group(2, t)))
                .concat(&js(PAGE[count_form(js_number(&fig)) as usize]))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}.])nr\.(\s*)(?=\d)", "giu"),
        |mm, t| js(NUMBER_ABBREV).concat(&gap_or_space(mm.group(1, t))),
    );
    s = rewrite_with(&s, js_re!(r"№(\s*)(?=\d)", "gu"), |mm, t| {
        js(NUMBER_ABBREV).concat(&gap_or_space(mm.group(1, t)))
    });
    rewrite_with(&s, &ABBREVIATION_RE, |mm, full| {
        let m = mm.value(full);
        let k = m.to_string_lossy();
        let Some((_, word)) = ABBREVIATION.iter().find(|(a, _)| *a == k) else {
            return m;
        };
        let rest = full.slice(mm.end() as isize, None);
        let ends = rest.is_empty() || js_re!(r"^\s+\p{Lu}", "u").test(&rest);
        if m.ends_with(&js(".")) && ends {
            js(word).concat(&js("."))
        } else {
            js(word)
        }
    })
}

/// `ordinalRange(text)`: `N.–M.` before a head noun, both ordinal or both left cardinal (periods dropped).
fn ordinal_range(text: &JsString) -> JsString {
    rewrite_with(
        text,
        js_re!(
            r"(?<![\d.,\p{L}])(\d{1,4})\.\s*[-–—]\s*(\d{1,4})\.(\s+)(\p{Ll}[\p{L}\p{M}]*)",
            "gu"
        ),
        |mm, t| {
            let (a, b) = (mm.group(1, t).unwrap(), mm.group(2, t).unwrap());
            let (gap, next) = (mm.group(3, t).unwrap(), mm.group(4, t).unwrap());
            let c = head_noun(&next.to_lower_case());
            let first = c.and_then(|c| ordinal_words(js_number(&a), c));
            let second = c.and_then(|c| ordinal_words(js_number(&b), c));
            let (x, y) = match (first, second) {
                (Some(x), Some(y)) => (x, y),
                _ => (a, b),
            };
            x.concat(&js(" līdz "))
                .concat(&y)
                .concat(&gap)
                .concat(&next)
        },
    )
}

/// `ordinalPeriod(text)`: `N.` before a lowercase word loses its period; before a head noun it is ordinal.
fn ordinal_period(text: &JsString) -> JsString {
    rewrite_with(
        text,
        js_re!(r"(?<![\d.,])(\d{1,4})\.(\s+)(\p{Ll}[\p{L}\p{M}]*)", "gu"),
        |mm, t| {
            let fig = mm.group(1, t).unwrap();
            let (gap, next) = (mm.group(2, t).unwrap(), mm.group(3, t).unwrap());
            let words =
                head_noun(&next.to_lower_case()).and_then(|c| ordinal_words(js_number(&fig), c));
            words.unwrap_or(fig).concat(&gap).concat(&next)
        },
    )
}

/// `degrees(text)`: the figure, the agreeing degree noun (a fraction takes the plural), a space if a letter
/// would otherwise fuse onto it.
fn degrees(text: &JsString) -> JsString {
    rewrite_with(
        text,
        js_re!(r"(\d+(?:,\d+)?)\s*°(?:\s*([CF])(?![\p{L}\p{M}]))?", "gui"),
        |mm, full| {
            let fig = mm.group(1, full).unwrap();
            let forms: [&str; 2] = match mm
                .group(2, full)
                .filter(|s| !s.is_empty())
                .map(|s| s.to_upper_case().to_string_lossy())
                .as_deref()
            {
                Some("C") => ["Celsija grāds", "Celsija grādi"],
                Some("F") => ["Fārenheita grāds", "Fārenheita grādi"],
                Some(_) => unreachable!("[CF] under i, uppercased"),
                None => ["grāds", "grādi"],
            };
            let idx = if fig.includes(&js(",")) {
                1
            } else {
                count_form(js_number(&fig)) as usize
            };
            let fuses = js_re!(r"^[\p{L}\p{M}]", "u").test(&full.slice(mm.end() as isize, None));
            fig.concat(&js(&format!(
                " {}{}",
                forms[idx],
                if fuses { " " } else { "" }
            )))
        },
    )
}

/// `signs(text)`.
fn signs(text: &JsString) -> JsString {
    let mut s = rewrite(text, js_re!(r"≈\s*(?=[+−–-]?\d)", "gu"), &js("aptuveni "));
    s = rewrite(
        &s,
        js_re!(r"(?<![\d\p{L}])±(?=\s?\d)", "gu"),
        &js("plusmīnuss "),
    );
    s = rewrite(&s, js_re!(r"(?<![\d\p{L}])\+(?=\s?\d)", "gu"), &js("plus "));
    s = rewrite(
        &s,
        js_re!(r"(?<![\d\p{L}])[−–-](?=\s?\d)", "gu"),
        &js("mīnuss "),
    );
    s = rewrite(&s, js_re!(r"(?<=\d)\s*÷\s*(?=\d)", "gu"), &js(" dalīts "));
    s = rewrite(
        &s,
        js_re!(
            r"(?<![=!<>])(?<=[\d\p{L}\p{M})²³])\s*=\s*(?=[\d\p{L}(])(?![=<>])",
            "gu"
        ),
        &js(" vienāds "),
    );
    s = rewrite(
        &s,
        js_re!(
            r"(?<![=!<>])(?<=[\d\p{L}])\s*<\s*(?=[\d\p{L}])(?![=<>])",
            "gu"
        ),
        &js(" mazāks par "),
    );
    rewrite(
        &s,
        js_re!(
            r"(?<![=!<>])(?<=[\d\p{L}])\s*>\s*(?=[\d\p{L}])(?![=<>])",
            "gu"
        ),
        &js(" lielāks par "),
    )
}

/// `decimalComma(text)`: `<head> komats <each leading zero> <the rest>`, for parts of at most 15 digits.
fn decimal_comma(text: &JsString) -> JsString {
    rewrite_with(
        text,
        js_re!(r"(?<![\d,.])(\d+),(\d+)(?![\d,.])", "gu"),
        |mm, t| {
            let (head, frac) = (mm.group(1, t).unwrap(), mm.group(2, t).unwrap());
            if head.len() > 15 || frac.len() > 15 {
                return mm.value(t);
            }
            let zeros = frac.0.iter().take_while(|&&c| c == b'0' as u16).count();
            let rest = frac.slice(zeros as isize, None);
            let mut spoken: Vec<JsString> =
                (0..zeros).map(|_| number_to_words(0.0, None)).collect();
            if !rest.is_empty() {
                spoken.push(number_to_words(js_number(&rest), Some(&rest)));
            }
            let out = number_to_words(js_number(&head), Some(&head))
                .concat(&js(" komats "))
                .concat(&JsString::join(&spoken, &js(" ")));
            js_re!(r"\s+$", "").replace(&out, &JsString::new())
        },
    )
}

/// `normalizeLatvian(input)`.
/// 5. ranges; a non-ascending pair of 1–2 digit whole numbers is a score and loses its dash (#1532).
fn range(text: &JsString) -> JsString {
    rewrite_with(
        text,
        js_re!(
            r"(?<![\d,.\p{L}-])(\d+(?:,\d+)?)\s*[-–—]\s*(\d+(?:,\d+)?)(?!\d|[,.]\d|-)",
            "gu"
        ),
        |mm, t| {
            let (a, b) = (mm.group(1, t).unwrap(), mm.group(2, t).unwrap());
            let small = |x: &JsString| js_re!(r"^\d{1,2}$", "u").test(x);
            let joiner = if small(&a) && small(&b) && js_number(&b) <= js_number(&a) {
                " "
            } else {
                " līdz "
            };
            a.concat(&js(joiner)).concat(&b)
        },
    )
}

/// 2b. the clock (#1532): a span between two clocks takes `līdz` first, then `HH:MM` → the two figures
/// (`:00` dropped, a leading minute zero spoken).
fn clock(text: &JsString) -> JsString {
    let s = rewrite(
        text,
        js_re!(r"(\d{1,2}:\d{2})\s?[-–—]\s?(?=\d{1,2}:\d{2})", "gu"),
        &js("$1 līdz "),
    );
    rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:]|[.,]\d)",
            "gu"
        ),
        |mm, t| {
            let hour = js(&js_number_to_string(js_number(&mm.group(1, t).unwrap())));
            let min = mm.group(2, t).unwrap();
            if min == js("00") {
                hour
            } else if min.starts_with(&js("0")) {
                hour.concat(&js(" 0 ")).concat(&min.slice(1, None))
            } else {
                hour.concat(&js(" ")).concat(&min)
            }
        },
    )
}

pub(crate) fn normalize_latvian(input: &JsString) -> JsString {
    let mut s = rewrite(
        input,
        js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)[    ](?=\d{3}(?!\d))", "gu"),
        &JsString::new(),
    );
    s = abbreviations(&s);
    s = clock(&s);
    s = ordinal_range(&s);
    s = ordinal_period(&s);
    s = range(&s);
    s = SYMBOLS.apply(&s);
    s = degrees(&s);
    s = signs(&s);
    decimal_comma(&s)
}
