//! Irish (ga) text normalization: zero-width characters, era markers, abbreviations, the `Nú` ordinal with its
//! enclosed noun and t-prothesis, ranges, clocks, version dots and decimals, fractions, degrees, rates, signs and
//! initialisms rewritten into words.
//! Ported from src/languages/irish/normalize.ts — see that file for the corpus evidence and the ordering.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::numbers::number_to_words;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `LETTER_NAME`, in the TS object's order.
const LETTER_NAME: [(&str, &str); 26] = [
    ("a", "a"),
    ("b", "bé"),
    ("c", "cé"),
    ("d", "dé"),
    ("e", "e"),
    ("f", "eif"),
    ("g", "gé"),
    ("h", "héis"),
    ("i", "í"),
    ("j", "jé"),
    ("k", "cá"),
    ("l", "eil"),
    ("m", "eim"),
    ("n", "ein"),
    ("o", "ó"),
    ("p", "pé"),
    ("q", "cú"),
    ("r", "ear"),
    ("s", "eas"),
    ("t", "té"),
    ("u", "ú"),
    ("v", "vé"),
    ("w", "wae"),
    ("x", "eics"),
    ("y", "yé"),
    ("z", "zae"),
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

/// `isUnreadableIrish`: the phonotactic test for core/initialisms.ts.
pub static IS_UNREADABLE: LazyLock<WordTest> = LazyLock::new(|| {
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new("[aeiouáéíóú]", "u").unwrap(),
        legal_onsets: strs(&[
            "bh", "ch", "dh", "fh", "gh", "mh", "ph", "sh", "th", "bhf", "gc", "bp", "dt", "nd",
            "mb", "ng", "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "sc",
            "sk", "sl", "sm", "sn", "sp", "st", "tr", "ts", "cn", "gn", "sr", "dl",
        ]),
        legal_codas: strs(&[
            "b", "d", "f", "g", "l", "m", "n", "p", "r", "s", "t", "v", "x", "bh", "ch", "dh",
            "fh", "gh", "mh", "ph", "sh", "th", "cht", "rt", "rd", "st", "nd", "nc", "nt", "mp",
            "mb", "ng", "lth", "rth", "nn", "ll", "rr", "nn", "ht", "sc", "lt", "rb", "rm", "rp",
            "nm", "ns", "rc", "rg", "sk",
        ]),
        liquids: None,
        digraphs: Some(strs(&[
            "bh", "ch", "dh", "fh", "gh", "mh", "ph", "sh", "th", "bhf", "dt", "gc", "nd", "mb",
            "ng", "ts",
        ])),
    }))
});

fn word_set(xs: &[&str]) -> HashSet<JsString> {
    xs.iter().map(|w| js(w)).collect()
}
static WORD_ACRONYMS: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    word_set(&[
        "nato", "covid", "fifa", "opec", "unesco", "aids", "laser", "gaa", "rte", "ira", "nasa",
    ])
});
static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    word_set(&[
        "bbc", "cnn", "cbs", "nbc", "rté", "itv", "csi", "fbi", "cia", "nsa", "faa", "nhk",
        "xdr-tb", "h5n1", "a1gp", "pstn", "dna", "hiv", "dvd", "cd", "tv", "pc", "pdf", "gps",
        "mri", "ms", "ir",
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

const ORD_1_10: [&str; 11] = [
    "", "chéad", "dara", "tríú", "ceathrú", "cúigiú", "séú", "seachtú", "ochtú", "naoú", "deichiú",
];

/// `ORD_UNIT_IN_COMPOUND`: `ORD_1_10` with 1 and 2 as *aonú* and *dóú*.
fn ord_unit_in_compound(i: usize) -> &'static str {
    match i {
        1 => "aonú",
        2 => "dóú",
        _ => ORD_1_10[i],
    }
}

static NOT_A_NOUN: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    word_set(&[
        "agus", "is", "nó", "ná", "ach", "mar", "féin", "seo", "sin", "siúd", "a", "an", "na",
        "ag", "ar", "as", "chun", "de", "do", "faoi", "go", "i", "in", "le", "ó", "roimh", "sa",
        "san", "sna", "tar", "thar", "um",
    ])
});

fn unit_ord(w: &JsString) -> Option<&'static str> {
    [
        ("aon", "aonú"),
        ("haon", "aonú"),
        ("dó", "dara"),
        ("trí", "tríú"),
        ("ceathair", "ceathrú"),
        ("cúig", "cúigiú"),
        ("sé", "séú"),
        ("seacht", "seachtú"),
        ("ocht", "ochtú"),
        ("hocht", "ochtú"),
        ("naoi", "naoú"),
        ("deich", "deichiú"),
    ]
    .iter()
    .find(|(k, _)| *w == *k)
    .map(|(_, v)| *v)
}

fn tens_ord(w: &JsString) -> Option<&'static str> {
    [
        ("fiche", "fichiú"),
        ("tríocha", "tríochadú"),
        ("daichead", "daicheadú"),
        ("caoga", "caogadú"),
        ("seasca", "seascadú"),
        ("seachtó", "seachtódú"),
        ("ochtó", "ochtódú"),
        ("nócha", "nóchadú"),
        ("céad", "céadú"),
        ("chéad", "chéadú"),
        ("míle", "míliú"),
        ("milliún", "milliúna"),
        ("billiún", "billiúna"),
    ]
    .iter()
    .find(|(k, _)| *w == *k)
    .map(|(_, v)| *v)
}

/// `ordinalWords(n, noun = "")`: the ordinal, with `noun` enclosed where Irish puts it inside the numeral.
pub fn ordinal_words(n: f64, noun: &JsString) -> Option<JsString> {
    if !is_safe_integer(n) || n < 1.0 || n >= 1e12 {
        return None;
    }
    if n <= 10.0 {
        return Some(js(ORD_1_10[n as usize]));
    }
    let tail = if noun.is_empty() {
        JsString::new()
    } else {
        noun.concat(&js(" "))
    };
    if n < 20.0 {
        return Some(
            js(ord_unit_in_compound(n as usize - 10))
                .concat(&js(" "))
                .concat(&tail)
                .concat(&js("déag"))
                .trim(),
        );
    }
    let card = number_to_words(n, None);
    if card.is_empty() || js_re!(r"\d", "u").test(&card) {
        return None;
    }
    let words: Vec<JsString> = card
        .split(&js(" "))
        .into_iter()
        .filter(|w| *w != "a")
        .collect();
    let spaced_noun = if noun.is_empty() {
        JsString::new()
    } else {
        js(" ").concat(noun)
    };
    if words.len() == 1 {
        let ord = tens_ord(&words[0]).or_else(|| unit_ord(&words[0]))?;
        return Some(js(ord).concat(&spaced_noun));
    }
    let last = &words[words.len() - 1];
    if let Some(t) = tens_ord(last) {
        let mut head: Vec<JsString> = words[..words.len() - 1].to_vec();
        head.push(js(t));
        return Some(JsString::join(&head, &js(" ")).concat(&spaced_noun));
    }
    let unit = unit_ord(last);
    let tens = JsString::join(&words[..words.len() - 1], &js(" "));
    let unit = unit?;
    if tens.is_empty() {
        return None;
    }
    Some(
        js_re!(r"\s+", "gu")
            .replace(
                &js(unit)
                    .concat(&js(" "))
                    .concat(&tail)
                    .concat(&js("is "))
                    .concat(&tens),
                &js(" "),
            )
            .trim(),
    )
}

fn g(m: &JsMatch, i: usize, s: &JsString) -> JsString {
    m.group(i, s).unwrap_or_default()
}

fn words(n: f64) -> JsString {
    number_to_words(n, None)
}

/// `[...f].map((d) => irishNumber(Number(d))).join(" ")`.
fn digit_words(f: &JsString) -> JsString {
    let ws: Vec<JsString> = f
        .code_point_strings()
        .iter()
        .map(|d| words(js_number(d)))
        .collect();
    JsString::join(&ws, &js(" "))
}

fn pointe(i: &JsString, f: &JsString) -> JsString {
    i.concat(&js(" pointe ")).concat(&digit_words(f))
}

/// The decimal rule's `DECIMAL_UNIT` and the rate rule's literal (the rate has no `msu`).
fn unit_word(u: &JsString, with_msu: bool) -> Option<&'static str> {
    Some(match u.to_string_lossy().as_str() {
        "km" => "ciliméadar",
        "m" => "méadar",
        "kg" => "cileagram",
        "mm" => "milliméadar",
        "cm" => "ceintiméadar",
        "msu" if with_msu => "míle san uair",
        _ => return None,
    })
}

fn starts_vowel(s: &JsString) -> bool {
    js_re!("^[aeiouáéíóú]", "u").test(s)
}

/// `normalizeIrish(input)`. Steps are ORDER-DEPENDENT; see the TS for each one's coupling.
pub fn normalize_irish(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 0) zero-width characters
    s = rewrite(
        &s,
        js_re!(r"[\u200B\u200C\u200D\uFEFF]", "gu"),
        &JsString::new(),
    );

    // 1) era markers, N.A./S.A., srl
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])A\.D\.(?![\p{L}\p{M}])", "giu"),
        &js("tar éis Chríost"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])R\.C\.(?![\p{L}\p{M}])", "giu"),
        &js("roimh Chríost"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])AD(?=\s*\d+)", "giu"),
        &js("tar éis Chríost"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])\d[\d,]*\s+AD(?![\p{L}\p{M}])", "giu"),
        |m, t| js_re!("AD", "giu").replace(&m.value(t), &js("tar éis Chríost")),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])BC(?=\s*\d+)", "giu"),
        &js("roimh Chríost"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])\d[\d,]*\s+BC(?![\p{L}\p{M}])", "giu"),
        |m, t| js_re!("BC", "giu").replace(&m.value(t), &js("roimh Chríost")),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])N\.A\.(?![\p{L}\p{M}])", "giu"),
        &js("Náisiúin Aontaithe"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])S\.A\.(?![\p{L}\p{M}])", "giu"),
        &js("Stáit Aontaithe"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])srl\.?(?![\p{L}\p{M}])", "giu"),
        &js("agus araile"),
    );

    // 1b) the US dollar prefix
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(?:US|uS)\$(?=\s?\d)", "giu"),
        &js("dollar na Stát Aontaithe "),
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
        js_re!(r"(?<![\p{L}\p{M}])Dr\.(\s+)(?=[\p{L}\d])", "giu"),
        &js("Dochtúir$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])Dr\.(?=\s*(?:[.,;:!?»)]|$))", "giu"),
        &js("Dochtúir."),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])etc\.(\s+)(?=[\p{L}\d])", "giu"),
        &js("srl$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])etc\.(?=\s*(?:[.,;:!?»)]|$))", "giu"),
        &js("srl."),
    );

    // 4) ordinals: `Nú`, the noun enclosed for the compound forms, t-prothesis after `an`
    s = rewrite_with(
        &s,
        js_re!(
            r"(\ban )?(?<![\d.,])(\d[\d,]*)ú(?![\p{L}\p{M}])([ \u00a0]+([\p{L}\p{M}]+))?",
            "giu"
        ),
        |m, t| {
            let (art, d, spaced, noun) = (m.group(1, t), g(m, 2, t), m.group(3, t), m.group(4, t));
            let n = js_number(&js_re!(",", "gu").replace(&d, &JsString::new()));
            if !n.is_finite() || n < 1.0 {
                return m.value(t);
            }
            let encloses = n > 10.0
                && (n < 20.0 || n % 10.0 != 0.0)
                && noun
                    .as_ref()
                    .is_none_or(|w| !NOT_A_NOUN.contains(&w.to_lower_case()));
            let enclosed = if encloses {
                noun.clone().unwrap_or_default()
            } else {
                JsString::new()
            };
            let Some(ord) = ordinal_words(n, &enclosed) else {
                return m.value(t);
            };
            let t_prefix = if art.is_some() && starts_vowel(&ord) {
                "t-"
            } else {
                ""
            };
            let head = art
                .clone()
                .unwrap_or_default()
                .concat(&js(t_prefix))
                .concat(&ord);
            if encloses && noun.is_some() {
                head
            } else {
                head.concat(&spaced.unwrap_or_default())
            }
        },
    );

    // 5) the timezone-offset hyphen, then ranges
    s = rewrite(&s, js_re!(r"(?<=\p{L})[-–](?=\d)", "gu"), &js(" "));
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d.,])(\d(?:[\d,]*\d)?)\s*[-–]\s*(\d(?:[\d,]*\d)?)(?![\d.])",
            "gu"
        ),
        &js("$1 go dtí $2"),
    );

    // 6) clock, colon form, with the i.n./r.n./a.m./p.m. marker
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:,])([01]?\d|2[0-3]):([0-5]\d)(?![:.\d])(?:\s*(i\.?n\.?|r\.?n\.?|[Aa]\.?[Mm]\.?|[Pp]\.?[Mm]\.?))?",
            "giu"
        ),
        |m, t| {
            let (hv, mv) = (js_number(&g(m, 1, t)), js_number(&g(m, 2, t)));
            if hv > 23.0 || mv > 59.0 {
                return m.value(t);
            }
            let head = if mv == 0.0 {
                words(hv)
            } else {
                words(hv).concat(&js(" ")).concat(&words(mv))
            };
            let ap = g(m, 3, t).to_lower_case();
            let suffix = if js_re!("^i").test(&ap) {
                " iarnóin"
            } else if js_re!("^r").test(&ap) {
                " réamhnóin"
            } else if js_re!("^p").test(&ap) {
                " iarnóin"
            } else if js_re!("^a").test(&ap) {
                " réamhnóin"
            } else {
                ""
            };
            head.concat(&js(suffix))
        },
    );

    // 7) gigahertz, version letters, decimals with a unit, decimals
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+\.\d+)\s?Ghz?(?![\p{L}\p{M}])", "giu"),
        &js("$1 gigahertz"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?=[a-z](?![\p{L}\p{M}]))", "giu"),
        |m, t| pointe(&g(m, 1, t), &g(m, 2, t)).concat(&js(" ")),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+)\.(\d+)\s?(km|m|kg|mm|cm|msu)(?![\p{L}\p{M}])(\s*\/)?",
            "giu"
        ),
        |m, t| {
            let u = g(m, 3, t);
            let Some(w) = unit_word(&u.to_lower_case(), true) else {
                return m.value(t);
            };
            let num = pointe(&g(m, 1, t), &g(m, 2, t));
            match m.group(4, t) {
                None => num.concat(&js(" ")).concat(&js(w)),
                Some(slash) => num.concat(&js(" ")).concat(&u).concat(&slash),
            }
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?![\d.])", "giu"),
        |m, t| pointe(&g(m, 1, t), &g(m, 2, t)),
    );

    // 7b) comma decimals
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+),(\d{1,2})(?![\d,])", "gu"),
        |m, t| pointe(&g(m, 1, t), &g(m, 2, t)),
    );

    // 8) fractions
    s = rewrite(&s, js_re!(r"(\d+)¾", "gu"), &js("$1 agus trí cheathrú"));
    s = rewrite(&s, js_re!(r"(\d+)½", "gu"), &js("$1 agus leath"));
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])", "gu"),
        |m, t| {
            let Some(ord) = ordinal_words(js_number(&g(m, 2, t)), &JsString::new()) else {
                return m.value(t);
            };
            let article = if starts_vowel(&ord) { "an t-" } else { "an " };
            let a = js_number(&g(m, 1, t));
            if a == 1.0 {
                js(article).concat(&ord)
            } else {
                words(a).concat(&js(" ")).concat(&ord)
            }
        },
    );

    // 9) degrees
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[°º]\s?C(?![\p{L}\p{M}])", "giu"),
        &js("$1 céim Celsius"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[°º]\s?F(?![\p{L}\p{M}])", "giu"),
        &js("$1 céim Fahrenheit"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d)\s?[°º]\s?([NSEW])(?![\p{L}\p{M}])", "giu"),
        |m, t| {
            let dir = match g(m, 2, t).to_upper_case().to_string_lossy().as_str() {
                "N" => "ó thuaidh",
                "S" => "ó dheas",
                "E" => "soir",
                _ => "siar",
            };
            g(m, 1, t).concat(&js(" céim ")).concat(&js(dir))
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[°º](?![\p{L}\p{M}])", "gu"),
        &js("$1 céim"),
    );

    // 10) rates
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<!\d)(\d+)\s?(km|m|kg|mm|cm)\s*\/\s*(h|u)(?![\p{L}\p{M}])",
            "giu"
        ),
        |m, t| {
            let u = unit_word(&g(m, 2, t).to_lower_case(), false).unwrap_or("undefined");
            words(js_number(&g(m, 1, t)))
                .concat(&js(" "))
                .concat(&js(u))
                .concat(&js(" san uair"))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<!\d)(\d+)\s?msu(?![\p{L}\p{M}])", "giu"),
        |m, t| words(js_number(&g(m, 1, t))).concat(&js(" míle san uair")),
    );

    // 11) signs
    s = rewrite(&s, js_re!("±", "gu"), &js(" móide nó lúide "));
    s = rewrite(&s, js_re!(r"\+\s?(?=\d)", "gu"), &js(" móide "));
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{Nd}])[-−](\d+)(?!\s*[-\d])", "gu"),
        &js("lúide $1"),
    );
    let pair = |m: &JsMatch, t: &JsString| {
        let (a, b) = (g(m, 1, t), g(m, 2, t));
        letter_name(&a.to_lower_case())
            .unwrap_or(a)
            .concat(&js(" agus "))
            .concat(&letter_name(&b.to_lower_case()).unwrap_or(b))
            .concat(&g(m, 3, t))
    };
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(s?)(?![\p{L}\p{M}])",
            "gu"
        ),
        pair,
    );
    s = rewrite(&s, js_re!(r"\s&\s", "gu"), &js(" agus "));
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(\p{Ll}+)(?![\p{L}\p{M}])",
            "gu"
        ),
        pair,
    );
    s = rewrite(&s, js_re!(r"(\S)\s*=\s*(\S)", "gu"), &js("$1 ionann is $2"));
    s = rewrite(&s, js_re!(r"(\S)\s*÷\s*(\S)", "gu"), &js("$1 roinnt ar $2"));
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*<\s*(\d)", "gu"),
        &js("$1 níos lú ná $2"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*>\s*(\d)", "gu"),
        &js("$1 níos mó ná $2"),
    );
    s = rewrite(&s, js_re!(r"(\d)\s*×\s*(\d)", "gu"), &js("$1 faoi $2"));
    s = rewrite(
        &s,
        js_re!(
            r"([\p{L}\p{M}\d]+ pointe [\p{L}\p{M} ]+?)\s*%\s*(?![\p{L}\p{M}])",
            "gu"
        ),
        &js("$1 faoin gcéad"),
    );

    // 12) initialisms
    normalize_initialisms(&s)
}
