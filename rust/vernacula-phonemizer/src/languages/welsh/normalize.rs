//! Welsh (cy) text normalization: era markers, currency prefixes, abbreviations, vigesimal ordinals, decades,
//! ranges and scores with the soft mutation after `i`, clocks, version dots and decimals, fractions, degrees,
//! rates, signs and initialisms rewritten into words.
//! Ported from src/languages/welsh/normalize.ts — see that file for the corpus evidence and the ordering.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::numbers::number_to_words;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::JsMatch;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `LETTER_NAME`, in the TS object's order.
const LETTER_NAME: [(&str, &str); 26] = [
    ("a", "a"),
    ("b", "bi"),
    ("c", "ec"),
    ("d", "edi"),
    ("e", "e"),
    ("f", "ef"),
    ("g", "eg"),
    ("h", "aitsh"),
    ("i", "i"),
    ("j", "je"),
    ("k", "ec"),
    ("l", "el"),
    ("m", "em"),
    ("n", "en"),
    ("o", "o"),
    ("p", "pi"),
    ("q", "fi"),
    ("r", "er"),
    ("s", "es"),
    ("t", "ti"),
    ("u", "u"),
    ("v", "fi"),
    ("w", "u ddybl"),
    ("x", "ecs"),
    ("y", "y"),
    ("z", "zed"),
];

fn letter_name(l: &JsString) -> Option<JsString> {
    LETTER_NAME
        .iter()
        .find(|(k, _)| *l == *k)
        .map(|(_, v)| js(v))
}

type WordTest = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

fn strs(xs: &[&str]) -> Vec<JsString> {
    xs.iter().map(|x| js(x)).collect()
}

/// `isUnreadableWelsh`: the phonotactic test for core/initialisms.ts.
pub static IS_UNREADABLE: LazyLock<WordTest> = LazyLock::new(|| {
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new("[aeiouwyâêîôûŵŷàèìòùïëöäü]", "u").unwrap(),
        legal_onsets: strs(&[
            "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "gw", "pl", "pr", "sb", "sc",
            "sg", "sk", "sl", "sm", "sn", "sp", "st", "sw", "tr", "tw", "ch", "dd", "ff", "ll",
            "ph", "rh", "th",
        ]),
        legal_codas: strs(&[
            "b", "d", "f", "g", "l", "m", "n", "p", "r", "s", "t", "v", "w", "y", "x", "ch", "dd",
            "ff", "ll", "ng", "ph", "th", "nt", "st", "nt", "mb", "nd", "rd", "ld", "mp", "nc",
            "ng", "bl", "ml", "dl", "fl", "gl", "tl", "fn", "lt", "sg", "rn", "sb", "tr", "str",
        ]),
        liquids: None,
        digraphs: Some(strs(&[
            "ch", "dd", "ff", "ng", "ll", "ph", "rh", "th", "si", "nh", "mh", "ngh",
        ])),
    }))
});

fn word_set(xs: &[&str]) -> HashSet<JsString> {
    xs.iter().map(|w| js(w)).collect()
}
static WORD_ACRONYMS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| word_set(&["nato", "covid", "fifa", "opec", "unesco", "aids", "laser"]));
static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    word_set(&[
        "usoc", "usgs", "usaf", "usda", "upa", "faa", "nsa", "usc", "cbs", "cctv", "cnn", "bbc",
        "itv", "s4c", "csi", "qvc", "aol", "add", "mri", "acpa", "mip", "aclu", "afc", "nfl",
        "nba", "nhl", "mlb", "mls", "cep", "oha", "acta", "meti", "fic", "knu", "knp", "nsw",
        "npws", "aub", "us", "ucla", "pa", "xdr-tb", "as", "afo", "awc",
    ])
});

fn normalize_initialisms(s: &JsString) -> JsString {
    let ln: LetterName = Arc::new(|l: &JsString| letter_name(&l.to_lower_case()));
    make_initialism_normalizer(
        InitialismData {
            letter_name: ln,
            lower: None,
            acronym_letters: Arc::new(|w: &JsString| ACRONYM_LETTERS.contains(w)),
            is_recorded: |w: &JsString| WORD_ACRONYMS.contains(w),
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(s)
}

const ORD_1_19: [&str; 20] = [
    "",
    "cyntaf",
    "ail",
    "trydydd",
    "pedwerydd",
    "pumed",
    "chweched",
    "seithfed",
    "wythfed",
    "nawfed",
    "degfed",
    "unfed ar ddeg",
    "deuddegfed",
    "trydydd ar ddeg",
    "pedwerydd ar ddeg",
    "pymthegfed",
    "unfed ar bymtheg",
    "ail ar bymtheg",
    "deunawfed",
    "pedwerydd ar bymtheg",
];

/// `ORD_COMPOUND`: `ORD_1_19` with 1 as *unfed*.
fn ord_compound(i: usize) -> &'static str {
    if i == 1 { "unfed" } else { ORD_1_19[i] }
}

fn round_tens(n: f64) -> Option<&'static str> {
    Some(match n as i64 {
        _ if n.fract() != 0.0 => return None,
        20 => "ugeinfed",
        30 => "degfed ar hugain",
        40 => "deugainfed",
        50 => "degfed ar ddeugain",
        60 => "trigainfed",
        70 => "degfed ar trigain",
        80 => "pedwar ugeinfed",
        90 => "degfed a phedwar ugain",
        _ => return None,
    })
}

/// `ordinalWords(n)`: the vigesimal ordinal, attested forms only.
pub fn ordinal_words(n: f64) -> Option<JsString> {
    if !is_safe_integer(n) || n < 0.0 {
        return None;
    }
    if n <= 19.0 {
        return Some(js(if n == 0.0 {
            "dimfed"
        } else {
            ORD_1_19[n as usize]
        }));
    }
    if n == 20.0 {
        return round_tens(20.0).map(js);
    }
    if n < 40.0 {
        let low = n - 20.0;
        if !(1.0..=19.0).contains(&low) {
            return None;
        }
        return Some(js(&format!("{} ar hugain", ord_compound(low as usize))));
    }
    if n < 100.0 {
        return round_tens(n).map(js);
    }
    Some(js(match n as i64 {
        100 => "canfed",
        200 => "dau ganfed",
        190 => "degfed a naw ugain",
        1000 => "milfed",
        _ => return None,
    }))
}

/// `soften(text)`: the soft mutation of the initial consonant (the digraphs first).
pub fn soften(text: &JsString) -> JsString {
    let two = text.slice(0, Some(2)).to_lower_case();
    let rest = text.slice(2, None);
    if two == "ll" {
        return js("l").concat(&rest);
    }
    if two == "rh" {
        return js("r").concat(&rest);
    }
    if ["ch", "dd", "ff", "ng", "ph", "th"]
        .iter()
        .any(|d| two == *d)
    {
        return text.clone();
    }
    let first = text.char_at(0).to_lower_case();
    let soft = [
        ("p", "b"),
        ("t", "d"),
        ("c", "g"),
        ("b", "f"),
        ("d", "dd"),
        ("g", ""),
        ("m", "f"),
    ]
    .iter()
    .find(|(k, _)| first == *k)
    .map(|(_, v)| *v);
    match soft {
        None => text.clone(),
        Some(s) => js(s).concat(&text.slice(1, None)),
    }
}

/// `UNIT_WORD`, which the decimal rule shares. `km` is the tier's `cilomedr` (#1585).
fn unit_word(u: &JsString) -> JsString {
    js(match u.to_string_lossy().as_str() {
        "km" => "cilomedr",
        "kg" => "cilogram",
        "mm" => "milimetr",
        "cm" => "centimetr",
        _ => "metr",
    })
}

fn g(m: &JsMatch, i: usize, s: &JsString) -> JsString {
    m.group(i, s).unwrap_or_default()
}

fn words(n: f64) -> JsString {
    number_to_words(n, None)
}

fn clock_words(h: &JsString, min: &JsString) -> JsString {
    if js_number(min) == 0.0 {
        words(js_number(h))
    } else {
        words(js_number(h))
            .concat(&js(" "))
            .concat(&words(js_number(min)))
    }
}

/// `[...f].map((d) => numberToWordsWelsh(Number(d))).join(" ")`.
fn digit_words(f: &JsString) -> JsString {
    let ws: Vec<JsString> = f
        .code_point_strings()
        .iter()
        .map(|d| words(js_number(d)))
        .collect();
    JsString::join(&ws, &js(" "))
}

fn pwynt(i: &JsString, f: &JsString) -> JsString {
    i.concat(&js(" pwynt ")).concat(&digit_words(f))
}

/// `normalizeWelsh(input)`. Steps are ORDER-DEPENDENT; see the TS for each one's coupling.
pub fn normalize_welsh(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1) era markers
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])O\.C\.(?![\p{L}\p{M}])", "giu"),
        &js("Oed Crist"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])C\.C\.(?![\p{L}\p{M}])", "giu"),
        &js("Cyn Crist"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])OC(?=\s*(?:\d+)\s*[–-]\s*\d+)", "giu"),
        &js("Oed Crist"),
    );

    // 1b) currency prefixes and the bare UD
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])AUD\$?(?=\s?\d)", "giu"),
        &js("doler Awstralia "),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])US\$?(?=\s?\d)", "giu"),
        &js("doler yr Unol Daleithiau "),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])U\.D\.(?![\p{L}\p{M}])", "giu"),
        &js("Unol Daleithiau"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])UD(?=[\s,.]|$)(?![\p{L}\p{M}])", "giu"),
        &js("Unol Daleithiau"),
    );

    // 1c) abbreviations with standard expansions (case-sensitive)
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])DU(?=[\s,.]|$)(?![\p{L}\p{M}])", "gu"),
        &js("Deyrnas Unedig"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])UDA(?=[\s,.]|$)(?![\p{L}\p{M}])", "gu"),
        &js("Unol Daleithiau America"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])AS(?=[\s,.]|$)(?![\p{L}\p{M}])", "gu"),
        &js("Aelod Seneddol"),
    );

    // 2) dotted capital runs; a capital's dot before a capital word
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])\p{Lu}\.(?:[ \u00a0]?\p{Lu}\.)+", "gu"),
        |m, t| js_re!(r"[.\s]", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\p{Lu})\.(?=\s+\p{Lu})", "gu"),
        &JsString::new(),
    );

    // 3) single-dot abbreviations
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])ayb\.(\s+)(?=[\p{L}\d])", "giu"),
        &js("ac yn y blaen$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])ayb\.(?=\s*(?:[.,;:!?»)]|$))", "giu"),
        &js("ac yn y blaen."),
    );

    // 4) ordinals
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d[\d,]*)(fed|ed|af|eg|ydd|ain)(?![\p{L}\p{M}])",
            "giu"
        ),
        |m, t| {
            let n = js_number(&js_re!(",", "gu").replace(&g(m, 1, t), &JsString::new()));
            if !n.is_finite() || n < 0.0 || n >= 100000.0 {
                return m.value(t);
            }
            ordinal_words(n).unwrap_or_else(|| m.value(t))
        },
    );

    // 5) decades
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d])(\d[\d,]*)(au)(?![\p{L}\p{M}])", "giu"),
        &js("$1"),
    );

    // 5a) the timezone-offset hyphen
    s = rewrite(&s, js_re!(r"(?<=\p{L})[-–](?=\d)", "gu"), &js(" "));

    // 5b) ranges and scores: the clock range, then the number range (second operand softened)
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:,])([01]?\d|2[0-3]):([0-5]\d)\s*[-–]\s*([01]?\d|2[0-3]):([0-5]\d)(?![:.\d])",
            "gu"
        ),
        |m, t| {
            let (h1, m1, h2, m2) = (g(m, 1, t), g(m, 2, t), g(m, 3, t), g(m, 4, t));
            if js_number(&m1) > 59.0 || js_number(&m2) > 59.0 {
                return m.value(t);
            }
            clock_words(&h1, &m1)
                .concat(&js(" i "))
                .concat(&soften(&clock_words(&h2, &m2)))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d(?:[\d,]*\d)?)\s*[-–]\s*(\d(?:[\d,]*\d)?)(?![\d]|\.\d)(\s?(?:km|kg|mm|cm|m)(?![\p{L}\p{M}]))?(?![%\p{Sc}])",
            "gu"
        ),
        |m, t| {
            let n = js_number(&js_re!(",", "gu").replace(&g(m, 2, t), &JsString::new()));
            if !is_safe_integer(n) {
                return m.value(t);
            }
            let ws = words(n);
            if ws.is_empty() || js_re!(r"\d", "u").test(&ws) {
                return m.value(t);
            }
            let u = match m.group(3, t) {
                None => JsString::new(),
                Some(unit) => js(" ").concat(&unit_word(&unit.trim().to_lower_case())),
            };
            g(m, 1, t)
                .concat(&js(" i "))
                .concat(&soften(&ws))
                .concat(&u)
        },
    );

    // 6) clock, colon form, with the p.m./a.m. marker
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:,])([01]?\d|2[0-3]):([0-5]\d)(?![:.\d])(?:\s*(p\.?m\.?|a\.?m\.?)(?![\p{L}\p{M}]))?",
            "giu"
        ),
        |m, t| {
            let (h, min) = (g(m, 1, t), g(m, 2, t));
            let (hv, mv) = (js_number(&h), js_number(&min));
            if hv > 23.0 || mv > 59.0 {
                return m.value(t);
            }
            let head = if mv == 0.0 {
                words(hv)
            } else {
                words(hv).concat(&js(" ")).concat(&words(mv))
            };
            let ap = g(m, 3, t).to_lower_case();
            let suffix = if ap.starts_with(&js("p")) {
                " y prynhawn"
            } else if ap.starts_with(&js("a")) {
                " y bore"
            } else {
                ""
            };
            head.concat(&js(suffix))
        },
    );

    // 6b) clock, dot form before a timezone
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([01]?\d|2[0-3])\.([0-5]\d)\s*(UTC|GMT)", "giu"),
        |m, t| {
            let (hv, mv) = (js_number(&g(m, 1, t)), js_number(&g(m, 2, t)));
            let head = if mv == 0.0 {
                words(hv)
            } else {
                words(hv).concat(&js(" ")).concat(&words(mv))
            };
            head.concat(&js(" ")).concat(&g(m, 3, t))
        },
    );

    // 7) version dots and dot decimals
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+\.\d+)\s*[-–]\s*(\d+\.\d+)(?![\d.])", "gu"),
        &js("$1 i $2"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+\.\d+)\s?Ghz?(?![\p{L}\p{M}])", "giu"),
        &js("$1 gigahertz"),
    );
    // The decimal-unit rule runs BEFORE the version letter (#1585): a glued metre is the version letter's
    // shape, so `4.5m` read the letter. The corpus's version letters are `a b g n`, never `m`.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+)\.(\d+)\s?(km|m|kg|mm|cm)(?![\p{L}\p{M}])",
            "giu"
        ),
        |m, t| {
            pwynt(&g(m, 1, t), &g(m, 2, t))
                .concat(&js(" "))
                .concat(&unit_word(&g(m, 3, t).to_lower_case()))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?=[a-z](?![\p{L}\p{M}]))", "giu"),
        |m, t| pwynt(&g(m, 1, t), &g(m, 2, t)).concat(&js(" ")),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?![\d.])", "giu"),
        |m, t| pwynt(&g(m, 1, t), &g(m, 2, t)),
    );

    // 7b) comma decimals
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+),(\d{1,2})(?![\d,])", "gu"),
        |m, t| pwynt(&g(m, 1, t), &g(m, 2, t)),
    );

    // 8) fractions
    s = rewrite(&s, js_re!(r"(\d+)¾", "gu"), &js("$1 a thri chwarter"));
    s = rewrite(&s, js_re!(r"(\d+)½", "gu"), &js("$1 a hanner"));
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])", "gu"),
        |m, t| {
            let (num, den) = (js_number(&g(m, 1, t)), js_number(&g(m, 2, t)));
            // A denominator below 2 names no fraction noun (#1585): `1/0` read *un dimfed*.
            if den < 2.0 {
                return m.value(t);
            }
            if den == 2.0 {
                return if num == 1.0 {
                    js("hanner")
                } else {
                    words(num).concat(&js(" hanner"))
                };
            }
            let noun = if den == 3.0 {
                Some(js("traean"))
            } else if den == 4.0 {
                Some(js("chwarter"))
            } else {
                ordinal_words(den)
            };
            match noun {
                None => m.value(t),
                Some(noun) => words(num).concat(&js(" ")).concat(&noun),
            }
        },
    );

    // 9) degrees
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[°º]\s?C(?![\p{L}\p{M}])", "giu"),
        &js("$1 gradd Celsius"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[°º]\s?F(?![\p{L}\p{M}])", "giu"),
        &js("$1 gradd Ffahrenheit"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[°º](?![\p{L}\p{M}])", "gu"),
        &js("$1 gradd"),
    );

    // 10) rates
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])cilomedr\/awr(?![\p{L}\p{M}])", "giu"),
        &js("cilomedr yr awr"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])llath\/metr(?![\p{L}\p{M}])", "giu"),
        &js("llath neu fetr"),
    );

    // 11) signs
    s = rewrite(&s, js_re!("±", "gu"), &js(" plws minws "));
    s = rewrite(&s, js_re!(r"\+\s?(?=\d)", "gu"), &js(" plws "));
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{Nd}])[-−](\d+)(?!\s*[-\d])", "gu"),
        &js("minws $1"),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(s?)(?![\p{L}\p{M}])",
            "gu"
        ),
        |m, t| {
            let (a, b) = (g(m, 1, t), g(m, 2, t));
            letter_name(&a.to_lower_case())
                .unwrap_or(a)
                .concat(&js(" a "))
                .concat(&letter_name(&b.to_lower_case()).unwrap_or(b))
                .concat(&g(m, 3, t))
        },
    );
    s = rewrite(&s, js_re!(r"\s&\s", "gu"), &js(" a "));
    s = rewrite(
        &s,
        js_re!(r"(\S)\s*=\s*(\S)", "gu"),
        &js("$1 yn hafal i $2"),
    );
    s = rewrite(&s, js_re!(r"(\S)\s*÷\s*(\S)", "gu"), &js("$1 rhannu â $2"));
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*<\s*(\d)", "gu"),
        &js("$1 yn llai na $2"),
    );
    s = rewrite(&s, js_re!(r"(\d)\s*>\s*(\d)", "gu"), &js("$1 yn fwy na $2"));
    s = rewrite(&s, js_re!(r"(\d)\s*×\s*(\d)", "gu"), &js("$1 gwaith $2"));

    // 12) initialisms
    s = normalize_initialisms(&s);

    let s = rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" "));
    rewrite(&s, js_re!(r"^[^\S\n]+|[^\S\n]+$", "gu"), &JsString::new())
}

/// #1585, as test/west-defects-1585.test.ts: relational where a well-formed twin exists, so no IPA is typed.
#[cfg(test)]
mod defects_1585_tests {
    use super::*;

    fn say(text: &str, lang: &str) -> String {
        crate::phonemize(text, lang).unwrap().trim().to_string()
    }

    fn n(s: &str) -> String {
        normalize_welsh(&js(s)).to_string_lossy()
    }

    #[test]
    fn glued_metre_km_word_and_the_zero_denominator() {
        assert_eq!(say("4.5m", "cy"), say("4.5 m", "cy"));
        assert_ne!(say("802.11n", "cy"), say("802.11 metr", "cy"));
        let last = |s: String| s.rsplit(' ').next().unwrap().to_string();
        let km = last(say("5 km", "cy"));
        assert_eq!(last(say("2.5 km", "cy")), km);
        assert_eq!(last(say("1-2 km", "cy")), km);
        assert!(n("1-2 km").contains("cilomedr"));
        assert_eq!(n("1/0"), "1/0");
        assert_eq!(n("1/1"), "1/1");
        assert_eq!(n("1/2"), "hanner");
    }
}
