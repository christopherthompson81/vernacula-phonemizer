//! Hausa text normalization: entities, era markers, dotted capitals, `US$`, ranges, colon and timezone clocks,
//! decimals and versions, fractions, degrees, rates, a preposed unit symbol, signs, and the initialism pass.
//! Ported from src/languages/hausa/normalize.ts — see that file for the corpus evidence.

use std::sync::{Arc, LazyLock};

use super::manifest::MANIFEST;
use super::numbers::number_to_words as hausa_number;
use crate::core::initialisms::{
    InitialismData, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

type Test = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

/// `isUnreadableHausa`: the shared phonotactic test over the manifest's inventory.
pub static IS_UNREADABLE: LazyLock<Test> = LazyLock::new(|| {
    let p = &MANIFEST.phonotactics;
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(&format!("[{}]", p.vowels), "u").unwrap(),
        legal_onsets: p.onsets.iter().map(|o| js(o)).collect(),
        legal_codas: p.codas.iter().map(|c| js(c)).collect(),
        liquids: None,
        digraphs: None,
    }))
});

const WORD_ACRONYMS: [&str; 6] = ["opec", "un", "nasa", "aids", "laser", "covid"];
const ACRONYM_LETTERS: [&str; 31] = [
    "aol", "au", "pstn", "a1gp", "gps", "npws", "oha", "unaids", "ungu", "nc", "nsw", "xdr-tb",
    "h5n1", "dna", "hiv", "dvd", "cd", "tv", "pc", "pdf", "fbi", "cia", "nsa", "faa", "bbc", "cnn",
    "cbs", "nbc", "itv", "mri", "ms",
];

fn in_set(set: &[&str], w: &JsString) -> bool {
    set.iter().any(|a| *w == js(a))
}

fn letter_name(l: &JsString) -> Option<JsString> {
    MANIFEST
        .letter_names
        .get(&l.to_lower_case().to_string_lossy())
        .map(|n| js(n))
}

fn normalize_initialisms(text: &JsString) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: Arc::new(letter_name),
            lower: None,
            acronym_letters: Arc::new(|w: &JsString| in_set(&ACRONYM_LETTERS, w)),
            is_recorded: |w: &JsString| in_set(&WORD_ACRONYMS, w),
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(text)
}

fn g(m: &JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `hausaNumber(Number(x))`.
fn num(x: &JsString) -> JsString {
    hausa_number(js_number(x))
}

/// `[...f].map((d) => hausaNumber(Number(d))).join(" ")`.
fn digit_words(f: &JsString) -> JsString {
    let parts: Vec<JsString> = f.code_point_strings().iter().map(num).collect();
    JsString::join(&parts, &js(" "))
}

/// A record lookup that, like the TS template's `table[key]!`, stringifies a miss as `undefined`.
fn or_undefined(v: Option<&str>) -> JsString {
    js(v.unwrap_or("undefined"))
}

fn decimal_unit(u: &JsString) -> Option<&'static str> {
    Some(match u.to_string_lossy().as_str() {
        "km" => "kilomita",
        "m" => "mita",
        "kg" => "kilogram",
        "mm" => "milimita",
        "cm" => "santimita",
        "km/h" => "kilomita a awa",
        "km/u" => "kilomita a awa",
        "m/s" => "mita a daƙiƙa",
        "mph" => "mil a awa",
        "mil/awa" => "mil a awa",
        _ => return None,
    })
}

fn rate_unit(u: &JsString) -> Option<&'static str> {
    Some(match u.to_string_lossy().as_str() {
        "km" => "kilomita",
        "m" => "mita",
        "kg" => "kilogram",
        "mm" => "milimita",
        "cm" => "santimita",
        _ => return None,
    })
}

fn preposed_unit(u: &JsString) -> Option<&'static str> {
    Some(match u.to_string_lossy().as_str() {
        "km" => "kilomita",
        "kg" => "kilogram",
        "mm" => "milimita",
        "cm" => "santimita",
        _ => return None,
    })
}

fn compass(c: &JsString) -> Option<&'static str> {
    Some(match c.to_string_lossy().as_str() {
        "N" => "arewa",
        "S" => "kudu",
        "E" => "gabas",
        "W" => "yamma",
        _ => return None,
    })
}

fn cat(parts: &[&JsString]) -> JsString {
    let mut out = JsString::new();
    for p in parts {
        out.push_str(p);
    }
    out
}

/// The clock head: `hausaNumber(h)`, or `hausaNumber(h) da hausaNumber(min)` when the minutes are not 0.
fn clock_head(hv: f64, mv: f64) -> JsString {
    if mv == 0.0 {
        hausa_number(hv)
    } else {
        cat(&[&hausa_number(hv), &js(" da "), &hausa_number(mv)])
    }
}

/// `normalizeHausa(input)`.
pub fn normalize_hausa(input: &JsString) -> JsString {
    let mut s = input.clone();
    s = rewrite(&s, js_re!(r"&amp;", "giu"), &js(" da "));
    s = rewrite(&s, js_re!(r"B\.?C\.?(?=\.?kafin)", "giu"), &JsString::new());
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])B\.?C\.?E?\.?(?![\p{L}\p{M}])", "giu"),
        &js("kafin haihuwar Yesu"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])\p{Lu}\.(?:[ \u00a0]?\p{Lu}\.)+", "gu"),
        |m, t| js_re!(r"[.\s]", "gu").replace(&m.value(t), &JsString::new()),
    );
    // A LONE capital before the dot (#1597): `(?<=\p{Lu})` alone also took the last letter of an acronym.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(\p{Lu})\.(?=\s+\p{Lu})", "gu"),
        &js("$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\p{L})\s+v\.\s+(?=[A-Z])", "gu"),
        &js(" da "),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(?:US|uS)\s?\$\s?(?=\d)", "giu"),
        &js("dala "),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+\.\d+)\s*[-–]\s*(\d+\.\d+)(?![\d.])", "gu"),
        &js("$1 zuwa $2"),
    );
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d.,])(\d(?:[\d,]*\d)?)\s*[-–]\s*(\d(?:[\d,]*\d)?)(?![\d.])",
            "gu"
        ),
        &js("$1 zuwa $2"),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:,])([01]?\d|2[0-3]):([0-5]\d)(?![:.\d])(?:\s*([Aa]\.?[Mm]\.?|[Pp]\.?[Mm]\.?))?",
            "giu"
        ),
        |m, t| {
            let hv = js_number(&g(m, t, 1));
            let mv = js_number(&g(m, t, 2));
            if hv > 23.0 || mv > 59.0 {
                return m.value(t);
            }
            let head = clock_head(hv, mv);
            let ap = g(m, t, 3).to_lower_case();
            let suffix = if ap.starts_with(&js("p")) {
                " na yamma"
            } else if ap.starts_with(&js("a")) {
                " na safe"
            } else {
                ""
            };
            head.concat(&js(suffix))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d{1,2})\.(\d{2})\s*(UTC|GMT)", "giu"),
        |m, t| {
            let head = clock_head(js_number(&g(m, t, 1)), js_number(&g(m, t, 2)));
            cat(&[&head, &js(" "), &g(m, t, 3)])
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+\.\d+)\s?Ghz?(?![\p{L}\p{M}])", "giu"),
        &js("$1 gigahertz"),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+)\.(\d+)\s?(km\/h|m\/s|km\/u|mph|mil\/awa|km|m|kg|mm|cm)(?![\p{L}\p{M}])",
            "giu"
        ),
        |m, t| {
            let unit = or_undefined(decimal_unit(&g(m, t, 3).to_lower_case()));
            cat(&[
                &g(m, t, 1),
                &js(" maki "),
                &digit_words(&g(m, t, 2)),
                &js(" "),
                &unit,
            ])
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?=[a-z](?![\p{L}\p{M}]))", "giu"),
        |m, t| {
            cat(&[
                &g(m, t, 1),
                &js(" maki "),
                &digit_words(&g(m, t, 2)),
                &js(" "),
            ])
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?![\d.])", "giu"),
        |m, t| cat(&[&g(m, t, 1), &js(" maki "), &digit_words(&g(m, t, 2))]),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+),(\d{1,2})(?![\d,])", "gu"),
        |m, t| cat(&[&g(m, t, 1), &js(" maki "), &digit_words(&g(m, t, 2))]),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])", "gu"),
        |m, t| cat(&[&num(&g(m, t, 1)), &js(" bisa "), &num(&g(m, t, 2))]),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[°º]\s?C(?![\p{L}\p{M}])", "giu"),
        &js("$1 digiri Celsius"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[°º]\s?F(?![\p{L}\p{M}])", "giu"),
        &js("$1 digiri Fahrenheit"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d)\s?[°º]\s?([NSEW])(?![\p{L}\p{M}])", "giu"),
        |m, t| {
            let word = or_undefined(compass(&g(m, t, 2).to_upper_case()));
            cat(&[&g(m, t, 1), &js(" digiri "), &word])
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[°º](?![\p{L}\p{M}])", "gu"),
        &js("$1 digiri"),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<!\d)(\d+)\s?(km|m|kg|mm|cm)\s*\/\s*(h|s|u)(?![\p{L}\p{M}])",
            "giu"
        ),
        |m, t| {
            let unit = or_undefined(rate_unit(&g(m, t, 2).to_lower_case()));
            let d = g(m, t, 3).to_lower_case();
            let per = if d == "h" || d == "u" {
                "awa"
            } else {
                "daƙiƙa"
            };
            cat(&[&num(&g(m, t, 1)), &js(" "), &unit, &js(" a "), &js(per)])
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<!\d)(\d+)\s?(mph|kph|mil\/awa)(?![\p{L}\p{M}])", "giu"),
        |m, t| {
            let w = if g(m, t, 2).to_lower_case() == "kph" {
                "kilomita"
            } else {
                "mil"
            };
            cat(&[&num(&g(m, t, 1)), &js(" "), &js(w), &js(" a awa")])
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<!\d)(\d+)\s?Mbit\/s(?![\p{L}\p{M}])", "giu"),
        |m, t| num(&g(m, t, 1)).concat(&js(" megabit a daƙiƙa")),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\p{Nd}])(km|kg|mm|cm)(?=\s\p{Nd})", "gu"),
        |m, t| or_undefined(preposed_unit(&g(m, t, 1))),
    );
    s = rewrite(&s, js_re!(r"\+\s?(?=\d)", "gu"), &js(" ƙari "));
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{Nd}])[-−](\d+)(?!\s*[-\d])", "gu"),
        &js("rashin $1"),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(s?)(?![\p{L}\p{M}])",
            "gu"
        ),
        |m, t| {
            let (a, b) = (g(m, t, 1), g(m, t, 2));
            let na = letter_name(&a).unwrap_or(a);
            let nb = letter_name(&b).unwrap_or(b);
            cat(&[&na, &js(" da "), &nb, &g(m, t, 3)])
        },
    );
    s = rewrite(&s, js_re!(r"\s&\s", "gu"), &js(" da "));
    s = rewrite(&s, js_re!(r"(\S)\s*=\s*(\S)", "gu"), &js("$1 daidai $2"));
    s = rewrite(&s, js_re!(r"(\d)\s*<\s*(\d)", "gu"), &js("$1 kasa da $2"));
    s = rewrite(&s, js_re!(r"(\d)\s*>\s*(\d)", "gu"), &js("$1 fiye da $2"));
    s = rewrite(&s, js_re!(r"(\d)\s*×\s*(\d)", "gu"), &js("$1 sau $2"));
    s = rewrite(
        &s,
        js_re!(
            r"(?<![kK]ashi\s+)([\p{L}\p{M}\d]+ maki [\p{L}\p{M} ]+?)\s*%\s*(?![\p{L}\p{M}])",
            "gu"
        ),
        &js("kashi $1"),
    );
    s = normalize_initialisms(&s);
    rewrite(
        &rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" ")),
        js_re!(r"^[^\S\n]+|[^\S\n]+$", "gu"),
        &JsString::new(),
    )
}
