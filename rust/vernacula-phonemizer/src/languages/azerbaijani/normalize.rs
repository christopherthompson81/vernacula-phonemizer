//! Azerbaijani (az) text normalization: era markers, dotted abbreviations, `N-ci` ordinals, space thousands,
//! suffixed clocks, version dots, rates, suffixed percents, degrees, signs, fractions, the regnal `II Dünya`
//! ordinal and the initialism pass. Ported from src/languages/azerbaijani/normalize.ts — see that file for the
//! corpus evidence.

use std::sync::{Arc, LazyLock};

use super::g2p::az_lower;
use super::numbers::number_to_words;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const VOWEL_LETTERS: &str = "aıeiəouöü";

/// `VOWEL.test(c)` on one code unit (`w[i]`), as every caller here does.
fn is_vowel_unit(u: u16) -> bool {
    VOWEL_LETTERS.encode_utf16().any(|x| x == u)
}

/// `HIGH`. Generated from normalize.ts's object literal (key order preserved).
const HIGH: [(&str, &str); 9] = [
    ("a", "ı"),
    ("ı", "ı"),
    ("e", "i"),
    ("ə", "i"),
    ("i", "i"),
    ("o", "u"),
    ("u", "u"),
    ("ö", "ü"),
    ("ü", "ü"),
];

/// `LOW`. Generated from normalize.ts's object literal (key order preserved).
const LOW: [(&str, &str); 9] = [
    ("a", "a"),
    ("ı", "a"),
    ("o", "a"),
    ("u", "a"),
    ("e", "ə"),
    ("ə", "ə"),
    ("i", "ə"),
    ("ö", "ə"),
    ("ü", "ə"),
];

fn lookup(table: &[(&'static str, &'static str)], v: u16) -> &'static str {
    table
        .iter()
        .find(|(k, _)| k.encode_utf16().eq([v]))
        .map(|(_, h)| *h)
        .expect("every VOWEL letter has an entry")
}

/// `lastVowelOf(w)`: the last code unit that is a vowel letter.
fn last_vowel_of(w: &JsString) -> Option<u16> {
    w.units().iter().rev().copied().find(|&u| is_vowel_unit(u))
}

fn ends_in_vowel(w: &JsString) -> bool {
    w.units().last().is_some_and(|&u| is_vowel_unit(u))
}

/// `harmoniseSuffix(stem, suffix)`: high vowels take the four-way class, low vowels the two-way one, and a
/// vowel-initial suffix after a vowel-final stem gets the buffer `y`.
fn harmonise_suffix(stem: &JsString, suffix: &JsString) -> JsString {
    let Some(v) = last_vowel_of(stem) else {
        return suffix.clone();
    };
    if suffix.is_empty() {
        return suffix.clone();
    }
    let (hi, lo) = (js(lookup(&HIGH, v)), js(lookup(&LOW, v)));
    let mut body = JsString::new();
    for c in suffix.code_point_strings() {
        if js_re!(r"[ıiuü]", "u").test(&c) {
            body.push_str(&hi);
        } else if js_re!(r"[aə]", "u").test(&c) {
            body.push_str(&lo);
        } else {
            body.push_str(&c);
        }
    }
    let buffer = ends_in_vowel(stem) && body.units().first().is_some_and(|&u| is_vowel_unit(u));
    if buffer { js("y").concat(&body) } else { body }
}

/// `ordinalWords(n)`: the cardinal with -(I)ncI on its last word; `None` where no ordinal can be built.
pub(crate) fn ordinal_words(n: f64) -> Option<JsString> {
    if !is_safe_integer(n) || n < 0.0 {
        return None;
    }
    let card = number_to_words(n);
    if card.is_empty() || js_re!(r"\d", "u").test(&card) {
        return None;
    }
    let mut words = card.split(&js(" "));
    let stem = words.last().unwrap().clone();
    let h = js(lookup(&HIGH, last_vowel_of(&stem)?));
    let last = if ends_in_vowel(&stem) {
        stem.concat(&js("nc")).concat(&h)
    } else {
        stem.concat(&h).concat(&js("nc")).concat(&h)
    };
    *words.last_mut().unwrap() = last;
    Some(JsString::join(&words, &js(" ")))
}

/// `MULTI_DOT`, verbatim and in order (`b.e.ə.` before its tail `e.ə.`).
const MULTI_DOT: [(&str, &str); 4] = [
    (r"b\.\s?e\.\s?ə\.", "eramızdan əvvəl"),
    (r"e\.\s?ə\.", "eramızdan əvvəl"),
    (r"E\.\s?ə\.", "eramızdan əvvəl"),
    (r"b\.\s?e\.", "bizim eramız"),
];

/// `BE_ERA`: not in the table, which is case-insensitive — a case-folded `BE` also took `be 5 il` (#1576).
static BE_ERA: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"(?<![\p{L}\p{M}])\bBE(?=\s+\d)", "gu").unwrap());

/// Each MULTI_DOT body as its two built regexes: at the end of the string, and anywhere.
static MULTI_DOT_RES: LazyLock<Vec<(JsRegex, JsRegex, &'static str)>> = LazyLock::new(|| {
    MULTI_DOT
        .iter()
        .map(|(body, word)| {
            (
                JsRegex::new(&format!(r"(?<![\p{{L}}\p{{M}}]){body}(?=\s*$)"), "giu").unwrap(),
                JsRegex::new(&format!(r"(?<![\p{{L}}\p{{M}}]){body}"), "giu").unwrap(),
                *word,
            )
        })
        .collect()
});

/// `DOTTED_ABBREV`. Generated from normalize.ts's object literal.
fn dotted_abbrev(ab: &JsString) -> Option<JsString> {
    [("dr", "Doktor"), ("prof", "Professor"), ("şək", "şəkil")]
        .iter()
        .find(|(k, _)| *ab == **k)
        .map(|(_, w)| js(w))
}

/// `LETTER_NAME`. Generated from normalize.ts's object literal.
const LETTER_NAME: [(&str, &str); 32] = [
    ("a", "a"),
    ("b", "be"),
    ("c", "ce"),
    ("ç", "çe"),
    ("d", "de"),
    ("e", "e"),
    ("ə", "ə"),
    ("f", "fe"),
    ("g", "ge"),
    ("ğ", "ğe"),
    ("h", "he"),
    ("x", "xı"),
    ("ı", "ı"),
    ("i", "i"),
    ("j", "je"),
    ("k", "ke"),
    ("q", "qe"),
    ("l", "el"),
    ("m", "em"),
    ("n", "en"),
    ("o", "o"),
    ("ö", "ö"),
    ("p", "pe"),
    ("r", "er"),
    ("s", "se"),
    ("ş", "şe"),
    ("t", "te"),
    ("u", "u"),
    ("ü", "ü"),
    ("v", "ve"),
    ("y", "ye"),
    ("z", "ze"),
];

/// `LETTER_NAME[azLower(l)]`: `l` is one code point, whose lowercase is no `Object.prototype` member.
fn letter_name(l: &JsString) -> Option<JsString> {
    let k = az_lower(l);
    LETTER_NAME
        .iter()
        .find(|(c, _)| k == **c)
        .map(|(_, n)| js(n))
}

type WordTest = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

static IS_UNREADABLE: LazyLock<WordTest> = LazyLock::new(|| {
    let set = |v: &[&str]| v.iter().map(|s| js(s)).collect();
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(r"[aıeiəouöü]", "u").unwrap(),
        legal_onsets: set(&[
            "bl", "br", "dr", "dv", "fl", "fr", "gl", "gr", "kl", "kr", "kv", "pl", "pr", "ps",
            "sk", "sl", "sm", "sn", "sp", "st", "sv", "tr", "ts", "tv", "xl", "xm", "xn", "xs",
        ]),
        legal_codas: set(&[
            "ft", "kt", "ks", "ld", "lf", "lk", "lm", "lp", "ls", "lt", "mp", "ms", "mt", "nd",
            "ng", "nk", "ns", "nt", "pt", "rd", "rf", "rk", "rl", "rm", "rn", "rp", "rs", "rt",
            "sk", "sp", "st", "ts", "xt",
        ]),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableAzerbaijani(word)`.
pub(crate) fn is_unreadable_azerbaijani(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

const WORD_ACRONYMS: [&str; 8] = [
    "abş", "nasa", "unesco", "aol", "covid", "fiba", "opec", "rem",
];
const ACRONYM_LETTERS: [&str; 14] = [
    "bmt", "gps", "ms", "knp", "cep", "mt", "mri", "dnt", "ftb", "cctv", "dvd", "pbs", "utc", "gmt",
];

/// `normalizeInitialisms`, lowercasing with `azLower`.
pub(crate) fn normalize_azerbaijani_initialisms(text: &JsString) -> JsString {
    let name: LetterName = Arc::new(letter_name);
    make_initialism_normalizer(
        InitialismData {
            letter_name: name,
            lower: Some(Arc::new(az_lower)),
            acronym_letters: Arc::new(|w: &JsString| ACRONYM_LETTERS.iter().any(|a| *w == **a)),
            is_recorded: |w: &JsString| WORD_ACRONYMS.iter().any(|a| *w == **a),
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(text)
}

fn g(m: &JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `normalizeAzerbaijani(input)`. The numbered steps are order-dependent, as in the TS.
pub(crate) fn normalize_azerbaijani(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1) era markers and multi-dot abbreviations; the end branch keeps the final dot as the period.
    for (at_end, anywhere, word) in MULTI_DOT_RES.iter() {
        s = rewrite(&s, at_end, &js(&format!("{word}.")));
        s = rewrite(&s, anywhere, &js(word));
    }
    s = rewrite(&s, &BE_ERA, &js("bizim eramız"));

    // 2) dotted capital runs → a bare all-caps run; an initial's dot before a capital is dropped.
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

    // 3) single-dot abbreviations. ⚠ The miss branch is reachable (#1122): the `iu` fold widens the pattern
    //    past the table's keys, and the match then stays as written.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(dr|prof|şək)\.(\s+)(?=[\p{L}\d])", "giu"),
        |m, t| match dotted_abbrev(&g(m, t, 1).to_lower_case()) {
            None => m.value(t),
            Some(w) => w.concat(&g(m, t, 2)),
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(dr|prof|şək)\.(?=\s*(?:[.,;:!?»)]|$))",
            "giu"
        ),
        |m, t| match dotted_abbrev(&g(m, t, 1).to_lower_case()) {
            None => m.value(t),
            Some(w) => w.concat(&js(".")),
        },
    );

    // 4) the `N-ci` ordinal, before the clock.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)-(cı|ci|cu|cü)(?![\p{L}\p{M}])", "giu"),
        |m, t| ordinal_words(js_number(&g(m, t, 1))).unwrap_or_else(|| m.value(t)),
    );

    // 5) space-grouped thousands, twice (the groups overlap on the shared digit).
    for _ in 0..2 {
        s = rewrite(
            &s,
            js_re!(
                r"(?<=\d)(?<!(?<![\d\.,])0)[ \u00a0\u202f\u2009](?=\d{3}(?!\d))",
                "gu"
            ),
            &JsString::new(),
        );
    }

    // 6) the colon clock, its case suffix glued to the last spoken word.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:]|\.\d)(?:-([a-zəçğıiöşü]{1,5}))?",
            "giu"
        ),
        |m, t| {
            let (hv, mv) = (js_number(&g(m, t, 1)), js_number(&g(m, t, 2)));
            if hv > 23.0 || mv > 59.0 {
                return m.value(t);
            }
            let head = if mv == 0.0 {
                number_to_words(hv)
            } else {
                number_to_words(hv)
                    .concat(&js(" "))
                    .concat(&number_to_words(mv))
            };
            let last = head.split(&js(" ")).pop().unwrap();
            match m.group(3, t) {
                None => head,
                Some(sfx) => head.concat(&harmonise_suffix(&last, &sfx)),
            }
        },
    );

    // 7) version dots.
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d.,:])(\d+)\.(\d{1,2})(?![\d])(?=\s*(?:[a-zA-Zçğəıiöşüx]|[)»]|$))",
            "giu"
        ),
        &js("$1 nöqtə $2"),
    );
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d.,:])(\d+)\.(\d{1,2})(?![\d])(\s?)(?=[a-zA-Zçğəıiöşüx]|GHz?)",
            "giu"
        ),
        &js("$1 nöqtə $2$3"),
    );

    // 8) rates, prefixed; gigahertz.
    s = rewrite(
        &s,
        js_re!(
            r"(\d+(?:,\d+)?)\s?km\s?\/\s?(?:saat|h|s)(?![\p{L}\p{M}])",
            "giu"
        ),
        &js("saatda $1 kilometr"),
    );
    s = rewrite(
        &s,
        js_re!(
            r"(\d+(?:,\d+)?)\s?mil\s?\/\s?(?:saat|h|s)(?![\p{L}\p{M}])",
            "giu"
        ),
        &js("saatda $1 mil"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+(?:,\d+)?)\s?m\s?\/\s?s(?![\p{L}\p{M}])", "giu"),
        &js("saniyədə $1 metr"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+(?:,\d+)?)\s?yard\s?\/\s?m(?![\p{L}\p{M}])", "giu"),
        &js("metrdə $1 yard"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+(?:,\d+)?)\s?Mbit\s?\/\s?s(?![\p{L}\p{M}])", "giu"),
        &js("saniyədə $1 meqabit"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+(?:,\d+)?)\s?Ghz?\b(?![\p{L}\p{M}])", "giu"),
        &js("$1 giqahers"),
    );

    // 9) a percent with a possessive suffix; an n-initial suffix takes the linking vowel.
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?%-?([a-zəçğıiöşün]{1,5})(?![\p{L}\p{M}])", "gu"),
        |m, t| {
            let sfx = g(m, t, 2);
            let link = if js_re!(r"^n", "u").test(&sfx) {
                harmonise_suffix(&js("faiz"), &js("i"))
            } else {
                JsString::new()
            };
            let stem = js("faiz").concat(&link);
            g(m, t, 1)
                .concat(&js(" "))
                .concat(&stem)
                .concat(&harmonise_suffix(&stem, &sfx))
        },
    );

    // 10) degrees.
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?C(?![\p{L}\p{M}])", "giu"),
        &js("$1 dərəcə selsi"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?F(?![\p{L}\p{M}])", "giu"),
        &js("$1 dərəcə farenheyt"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°(?![\p{L}\p{M}])", "gu"),
        &js("$1 dərəcə"),
    );

    // 11) signs.
    s = rewrite(&s, js_re!(r"\+\s?(?=\d)", "gu"), &js(" üstəgəl "));
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{Nd}])[-−](\d+)(?!\s*[-\d])", "gu"),
        &js("mənfi $1"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(\p{Lu})&(\p{Lu})(?![\p{L}\p{M}])", "gu"),
        |m, t| {
            let (a, b) = (g(m, t, 1), g(m, t, 2));
            letter_name(&a)
                .unwrap_or(a)
                .concat(&js(" və "))
                .concat(&letter_name(&b).unwrap_or(b))
        },
    );
    s = rewrite(&s, js_re!(r"\s&\s", "gu"), &js(" və "));
    s = rewrite(
        &s,
        js_re!(r"(\S)\s*=\s*(\S)", "gu"),
        &js("$1 bərabərdir $2"),
    );
    s = rewrite(&s, js_re!(r"(\d)\s*<\s*(\d)", "gu"), &js("$1 kiçikdir $2"));
    s = rewrite(&s, js_re!(r"(\d)\s*>\s*(\d)", "gu"), &js("$1 böyükdür $2"));
    s = rewrite(&s, js_re!(r"(\d)\s*×\s*(\d)", "gu"), &js("$1 vur $2"));

    // 12) fractions and division (the divisor takes the dative).
    s = rewrite(&s, js_re!(r"(\d+)½", "gu"), &js("$1 yarım"));
    s = rewrite(&s, js_re!(r"(\d+)¾", "gu"), &js("$1 dörddə üç"));
    s = rewrite_with(&s, js_re!(r"(\d+)\s?÷\s?(\d+)", "gu"), |m, t| {
        let x = number_to_words(js_number(&g(m, t, 1)));
        let y = number_to_words(js_number(&g(m, t, 2)));
        let cut = y.last_index_of(&js(" ")).map_or(0, |i| i + 1);
        let (head, stem) = (y.slice(0, Some(cut as isize)), y.slice(cut as isize, None));
        x.concat(&js(" "))
            .concat(&head)
            .concat(&stem)
            .concat(&harmonise_suffix(&stem, &js("ə")))
            .concat(&js(" bölünür"))
    });
    s = rewrite(&s, js_re!(r"(\d+)¼", "gu"), &js("$1 dörddə bir"));
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])", "gu"),
        |m, t| {
            let (num, den) = (js_number(&g(m, t, 1)), js_number(&g(m, t, 2)));
            if den == 2.0 {
                return if num == 1.0 {
                    js("yarım")
                } else {
                    number_to_words(num).concat(&js(" yarım"))
                };
            }
            let dw = number_to_words(den);
            if dw.is_empty() {
                return m.value(t);
            }
            dw.concat(&harmonise_suffix(&dw, &js("də")))
                .concat(&js(" "))
                .concat(&number_to_words(num))
        },
    );

    // 13) the regnal digit before Dünya Müharibəsi reads as an ordinal.
    s = rewrite_with(
        &s,
        js_re!(r"(\d{1,2})\s+Dünya Müharibəsi", "gu"),
        |m, t| match ordinal_words(js_number(&g(m, t, 1))) {
            None => m.value(t),
            Some(ord) => ord.concat(&js(" Dünya Müharibəsi")),
        },
    );

    // 14) initialisms, last of the letter rules.
    normalize_azerbaijani_initialisms(&s)
}
