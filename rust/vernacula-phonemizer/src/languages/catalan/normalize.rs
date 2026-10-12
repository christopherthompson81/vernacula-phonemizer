//! Catalan (ca) text normalization: era markers, abbreviations, ordinals, decades, clock, version dots,
//! fractions, degrees, signs and initialisms rewritten into words before the tokenizer.
//! Ported from src/languages/catalan/normalize.ts — see that file for the corpus evidence and the ordering.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::numbers::number_to_words;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const ORD_MASC_1_10: [&str; 11] = [
    "", "primer", "segon", "tercer", "quart", "cinquè", "sisè", "setè", "vuitè", "novè", "desè",
];
const ORD_FEM_1_10: [&str; 11] = [
    "", "primera", "segona", "tercera", "quarta", "cinquena", "sisena", "setena", "vuitena",
    "novena", "desena",
];

/// `ordinalWords(n, fem)`: the masculine or feminine ordinal, n ≥ 1. ⚠ The two `rewrite` calls on the STEM and
/// the ordinal are not on the pipeline string; they stay `rewrite` because the TS calls `rewrite` there.
pub fn ordinal_words(n: f64, fem: bool) -> Option<JsString> {
    if !is_safe_integer(n) || n < 1.0 {
        return None;
    }
    let small = if fem { ORD_FEM_1_10 } else { ORD_MASC_1_10 };
    if n <= 10.0 {
        return Some(js(small[n as usize]));
    }
    let card = number_to_words(n, None);
    if card.is_empty() || js_re!(r"\d", "u").test(&card) {
        return None;
    }
    let mut words = card.split(&js(" "));
    let mut stem = words[words.len() - 1].clone();
    // One compositor for both ordinal paths (#1533): the suffixed cardinal, 21 → vint i unè. A plain replace:
    // `stem` is a word of a composed number, never the tracked text.
    stem = if stem.ends_with(&js("ó")) {
        stem.slice(0, Some(-1)).concat(&js("on"))
    } else if stem == "cents" {
        js("cent")
    } else if stem.ends_with(&js("cinc")) {
        stem.slice(0, Some(-1)).concat(&js("qu"))
    } else if stem.ends_with(&js("nou")) {
        stem.slice(0, Some(-1)).concat(&js("v"))
    } else if stem.ends_with(&js("deu")) {
        stem.slice(0, Some(-1)).concat(&js("s"))
    } else {
        js_re!("[ae]$", "u").replace(&stem, &JsString::new())
    };
    let last = words.len() - 1;
    words[last] = stem.concat(&js(if fem { "ena" } else { "è" }));
    Some(JsString::join(&words, &js(" ")))
}

/// `irregularCompound(n)`: the colloquial masculine compound with an irregular tail (21 → vint i primer … 24 →
/// vint i quart), for a digit ordinal whose written suffix (r/n/t) names that series.
fn irregular_compound(n: f64) -> Option<JsString> {
    let u = n % 10.0;
    if !is_safe_integer(n) || n <= 10.0 || n % 100.0 <= 10.0 || !(1.0..=4.0).contains(&u) {
        return None;
    }
    let u = u as usize;
    let card = number_to_words(n, None);
    let tail = js(["", "un", "dos", "tres", "quatre"][u]);
    if card.ends_with(&js(" ").concat(&tail)) {
        Some(
            card.slice(0, Some(-(tail.len() as isize)))
                .concat(&js(ORD_MASC_1_10[u])),
        )
    } else {
        None
    }
}

const MULTI_DOT: [(&str, &str); 2] = [("dC", "després de Crist"), ("aC", "abans de Crist")];

static MULTI_DOT_RE: LazyLock<Vec<(JsRegex, JsString)>> = LazyLock::new(|| {
    MULTI_DOT
        .iter()
        .map(|(body, word)| {
            (
                JsRegex::new(
                    &format!(r"(?<![\p{{L}}\p{{M}}]){body}(?![\p{{L}}\p{{M}}])"),
                    "giu",
                )
                .unwrap(),
                js(word),
            )
        })
        .collect()
});

/// `DOTTED_ABBREV[ab.toLowerCase()]`: own keys only (the key is a match of `dr|etc`, never a prototype name).
fn dotted_abbrev(ab: &JsString) -> Option<&'static str> {
    match ab.to_lower_case().to_string_lossy().as_str() {
        "dr" => Some("doctor"),
        "etc" => Some("etcètera"),
        _ => None,
    }
}

/// `LETTER_NAME` (insertion order is the TS object's).
const LETTER_NAME: [(&str, &str); 26] = [
    ("a", "a"),
    ("b", "be"),
    ("c", "ce"),
    ("d", "de"),
    ("e", "e"),
    ("f", "efa"),
    ("g", "ge"),
    ("h", "hac"),
    ("i", "i"),
    ("j", "jota"),
    ("k", "ca"),
    ("l", "ela"),
    ("m", "ema"),
    ("n", "ena"),
    ("o", "o"),
    ("p", "pe"),
    ("q", "cu"),
    ("r", "erra"),
    ("s", "essa"),
    ("t", "te"),
    ("u", "u"),
    ("v", "ve"),
    ("w", "ve doble"),
    ("x", "ics"),
    ("y", "i grega"),
    ("z", "zeta"),
];

fn letter_name(l: &JsString) -> Option<JsString> {
    LETTER_NAME
        .iter()
        .find(|(k, _)| *l == *k)
        .map(|(_, v)| js(v))
}

type WordTest = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

/// `isUnreadableCatalan`: the phonotactic test for core/initialisms.ts.
pub static IS_UNREADABLE: LazyLock<WordTest> = LazyLock::new(|| {
    let set = |xs: &[&str]| xs.iter().map(|x| js(x)).collect::<Vec<_>>();
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new("[aeiouàèéíòóú]", "u").unwrap(),
        legal_onsets: set(&[
            "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "ps", "sk", "sl",
            "sm", "sn", "sp", "st", "tr", "ts", "ll", "ny", "tx", "gn", "mn",
        ]),
        legal_codas: set(&[
            "b", "bs", "cc", "ck", "ct", "ds", "ft", "ks", "kt", "lc", "ld", "lf", "lg", "lk",
            "ll", "lm", "lp", "ls", "lt", "mp", "ms", "mt", "nc", "nd", "ng", "nk", "ns", "nt",
            "nz", "ps", "pt", "rc", "rd", "rf", "rg", "rk", "rl", "rm", "rn", "rp", "rs", "rt",
            "sc", "sk", "sp", "ss", "st", "ts", "tz", "xt", "ny", "ll", "l·l", "mb", "ys", "cs",
            "gs", "nx",
        ]),
        liquids: None,
        digraphs: Some(set(&[
            "ll", "ny", "qu", "gu", "tx", "ix", "ig", "rr", "ss", "tj", "tg", "tz",
        ])),
    }))
});

static WORD_ACRONYMS: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    [
        "onu", "nato", "covid", "fifa", "opec", "unesco", "aids", "laser",
    ]
    .iter()
    .map(|w| js(w))
    .collect()
});
static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    [
        "eua", "fbi", "nhk", "fic", "ns", "nsw", "irm", "rmn", "ocde", "bmt",
    ]
    .iter()
    .map(|w| js(w))
    .collect()
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

fn g(m: &crate::core::js_regex::JsMatch, i: usize, s: &JsString) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `normalizeCatalan(input)`. Steps are ORDER-DEPENDENT; see the TS for each one's coupling.
pub fn normalize_catalan(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1) era markers
    for (re, word) in MULTI_DOT_RE.iter() {
        s = rewrite(&s, re, word);
    }

    // 2) dotted capital runs → a bare all-caps run; a capital's dot before a capital word
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])\p{Lu}\.(?:[  ]?\p{Lu}\.)+", "gu"),
        |m, t| js_re!(r"[.\s]", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\p{Lu})\.(?=\s+\p{Lu})", "gu"),
        &JsString::new(),
    );

    // 3) single-dot abbreviations (the miss branch is reachable under the iu fold, #1122)
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(dr|etc)\.(\s+)(?=[\p{L}\d])", "giu"),
        |m, t| match dotted_abbrev(&g(m, 1, t)) {
            None => m.value(t),
            Some(w) => js(w).concat(&g(m, 2, t)),
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(dr|etc)\.(?=\s*(?:[.,;:!?»)]|$))", "giu"),
        |m, t| match dotted_abbrev(&g(m, 1, t)) {
            None => m.value(t),
            Some(w) => js(w).concat(&js(".")),
        },
    );

    // 4) ordinals
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)(è|a|r|n|ns|t)(?![\p{L}\p{M}])", "giu"),
        |m, t| {
            let m0 = m.value(t);
            let n = js_number(&g(m, 1, t));
            let sfx = g(m, 2, t).to_lower_case();
            // The suffix picks the series in a compound too (#1533): è / a the suffixed cardinal, r / n / t the
            // colloquial irregular tail.
            let ord = if sfx == "è" || sfx == "a" {
                ordinal_words(n, sfx == "a")
            } else {
                irregular_compound(n).or_else(|| ordinal_words(n, false))
            };
            let Some(ord) = ord else {
                return m0;
            };
            let parts = ord.split(&js(" "));
            let last = &parts[parts.len() - 1];
            if sfx == "r" && !(*last == "primer" || *last == "tercer") {
                return m0;
            }
            if (sfx == "n" || sfx == "ns") && *last != "segon" {
                return m0;
            }
            if sfx == "t" && *last != "quart" {
                return m0;
            }
            if sfx == "ns" {
                return rewrite(&ord, js_re!("segon$", "u"), &js("segons"));
            }
            ord
        },
    );

    // 4b) decades
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])((?:1\d|20)\d{2}|\d0)s(?![\p{L}\p{M}])", "giu"),
        &js("$1"),
    );

    // 5) clock, colon form
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:,])([01]?\d|2[0-3]):([0-5]\d)(?![:.\d])\s*(h)?\s*([Aa]\.?[Mm]\.?|[Pp]\.?[Mm]\.?)?",
            "giu"
        ),
        |m, t| {
            let (hv, mv) = (js_number(&g(m, 1, t)), js_number(&g(m, 2, t)));
            if hv > 23.0 || mv > 59.0 {
                return m.value(t);
            }
            let head = if mv == 0.0 {
                number_to_words(hv, None)
            } else {
                number_to_words(hv, None)
                    .concat(&js(" "))
                    .concat(&number_to_words(mv, None))
            };
            match m.group(4, t).filter(|ap| !ap.is_empty()) {
                Some(ap) => head.concat(&js(" ")).concat(
                    &js_re!(r"\.", "gu")
                        .replace(&ap, &JsString::new())
                        .to_upper_case(),
                ),
                None => head,
            }
        },
    );

    // 6) version dots and dot decimals
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d{1,2})(?![\d.])", "giu"),
        &js("$1 punt $2"),
    );

    // 7) fractions
    s = rewrite(&s, js_re!(r"(\d+)¾", "gu"), &js("$1 i tres quarts"));
    s = rewrite(&s, js_re!(r"(\d+)½", "gu"), &js("$1 i mig"));
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])", "gu"),
        |m, t| {
            let (num, den) = (js_number(&g(m, 1, t)), js_number(&g(m, 2, t)));
            if den == 2.0 {
                return if num == 1.0 {
                    js("mig")
                } else {
                    number_to_words(num, None).concat(&js(" mitjos"))
                };
            }
            let noun = if den == 3.0 {
                Some(js("terç"))
            } else if den == 4.0 {
                Some(js("quart"))
            } else {
                ordinal_words(den, false)
            };
            let Some(noun) = noun else {
                return m.value(t);
            };
            let plural = if den == 3.0 {
                js("terços")
            } else if den == 4.0 {
                js("quarts")
            } else {
                js_re!("è$", "u").replace(&noun, &js("ens"))
            };
            number_to_words(num, None)
                .concat(&js(" "))
                .concat(if num == 1.0 { &noun } else { &plural })
        },
    );

    // 8) degrees
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[°º]\s?C(?![\p{L}\p{M}])", "giu"),
        &js("$1 graus Celsius"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[°º]\s?F(?![\p{L}\p{M}])", "giu"),
        &js("$1 graus Fahrenheit"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d)\s?[°º]\s?([NSOE])(?![\p{L}\p{M}])", "giu"),
        |m, t| {
            // `({N, S, E, O})[c.toUpperCase()]!`: every match's capital is one of the four.
            let dir = match g(m, 2, t).to_upper_case().to_string_lossy().as_str() {
                "N" => "nord",
                "S" => "sud",
                "E" => "est",
                "O" => "oest",
                _ => "undefined",
            };
            g(m, 1, t).concat(&js(" graus ")).concat(&js(dir))
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[°º](?![\p{L}\p{M}])", "gu"),
        &js("$1 graus"),
    );

    // 9) gigahertz
    s = rewrite(
        &s,
        js_re!(r"(\d+(?: punt \d+)?)\s?Ghz?(?![\p{L}\p{M}])", "giu"),
        &js("$1 gigahercis"),
    );

    // 10) signs
    s = rewrite(&s, js_re!("±", "gu"), &js(" més menys "));
    s = rewrite(&s, js_re!(r"\+\s?(?=\d)", "gu"), &js(" més "));
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{Nd}])[-−](\d+)(?!\s*[-\d])", "gu"),
        &js("menys $1"),
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
                .concat(&js(" i "))
                .concat(&letter_name(&b.to_lower_case()).unwrap_or(b))
                .concat(&g(m, 3, t))
        },
    );
    s = rewrite(&s, js_re!(r"\s&\s", "gu"), &js(" i "));
    s = rewrite(
        &s,
        js_re!(r"(\S)\s*=\s*(\S)", "gu"),
        &js("$1 és igual a $2"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\S)\s*÷\s*(\S)", "gu"),
        &js("$1 dividit per $2"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*<\s*(\d)", "gu"),
        &js("$1 és menor que $2"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*>\s*(\d)", "gu"),
        &js("$1 és major que $2"),
    );
    s = rewrite(&s, js_re!(r"(\d)\s*×\s*(\d)", "gu"), &js("$1 per $2"));

    // 11) initialisms, last of the letter rules
    s = normalize_initialisms(&s);

    rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" "))
}
