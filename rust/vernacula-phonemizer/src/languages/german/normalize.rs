//! German (de) text normalization: era and dotted abbreviations, the `N.` ordinal and its two endings, clock
//! times, units, signs and fractions rewritten to words; the initialism pass; and the year pass, run last.
//! Ported from src/languages/german/normalize.ts — see that file for the corpus evidence and the ordering.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::manifest::MANIFEST;
use super::numbers::number_to_words;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number, js_number_to_string};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const WORD_START: &str = r"(?<![\p{L}\p{M}\d_])";

static MONTHS: LazyLock<String> = LazyLock::new(|| MANIFEST.months.join("|"));

static ORDINAL_NOUN_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let mut alts = vec![MONTHS.clone()];
    alts.extend(MANIFEST.ordinal_nouns.iter().cloned());
    JsRegex::new(&format!("^(?:{})$", alts.join("|")), "iu").unwrap()
});

static WEAK_EN: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.weak_en.iter().map(|w| js(w)).collect());
static LICENSER: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    MANIFEST
        .weak_en
        .iter()
        .chain(MANIFEST.ordinal_licensers_extra.iter())
        .map(|w| js(w))
        .collect()
});

/// `ordinalStem(n)`: the cardinal plus -t below 20, -st from 20, or one of the suppletive stems.
fn ordinal_stem(n: f64) -> Option<JsString> {
    if !is_safe_integer(n) || n < 1.0 {
        return None;
    }
    if let Some(irr) = MANIFEST
        .ordinals
        .irregular_stems
        .get(&js_number_to_string(n))
    {
        return Some(js(irr));
    }
    let card = number_to_words(n, None);
    if card.is_empty() || js_re!(r"\d", "u").test(&card) {
        return None;
    }
    let suffix = if n < 20.0 {
        &MANIFEST.ordinals.suffix_below20
    } else {
        &MANIFEST.ordinals.suffix_from20
    };
    Some(card.concat(&js(suffix)))
}

/// `ABBREV_ALT`: the table's keys, longest first (a stable sort, so equal lengths keep the table's order).
static ABBREV_ALT: LazyLock<String> = LazyLock::new(|| {
    let mut keys: Vec<&String> = MANIFEST.dotted_abbrev.keys().collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.encode_utf16().count()));
    keys.iter()
        .map(|k| k.as_str())
        .collect::<Vec<_>>()
        .join("|")
});
/// `ABBREV_ONE_ALT`: `dottedAbbrevOne`'s keys, longest first (stable, as `ABBREV_ALT`).
static ABBREV_ONE_ALT: LazyLock<String> = LazyLock::new(|| {
    let mut keys: Vec<&String> = MANIFEST.dotted_abbrev_one.keys().collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.encode_utf16().count()));
    keys.iter()
        .map(|k| k.as_str())
        .collect::<Vec<_>>()
        .join("|")
});
/// Step 2c: a bare `1` before a scale abbreviation (#1514).
static ABBREV_ONE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            "(?<![\\p{{L}}\\p{{M}}\\d_.,/+\\-\u{2212}\u{2013}\u{b1}])1\\s+({})\\.(?=(\\s+[\\p{{L}}\\d])|\\s*(?:[.,;:!?»)]|$))",
            *ABBREV_ONE_ALT
        ),
        "giu",
    )
    .unwrap()
});
static ABBREV_CONTINUES: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            "(?<!\\p{{Lu}}\\.[ \u{a0}]){WORD_START}({})\\.(\\s+)(?=[\\p{{L}}\\d])",
            *ABBREV_ALT
        ),
        "giu",
    )
    .unwrap()
});
static ABBREV_ENDS: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!("{WORD_START}({})\\.(?=\\s*(?:[.,;:!?»)]|$))", *ABBREV_ALT),
        "giu",
    )
    .unwrap()
});
static ORD: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"(?:(\p{L}+)(\s+))?(\d{1,4})\.(?=\s+(\p{L}+))", "gu").unwrap());
static BARE_DAY: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?:(\p{{L}}+)(\s+))?(\d{{1,2}})(\s+)(?=(?:{})(?![\p{{L}}\p{{M}}]))",
            *MONTHS
        ),
        "giu",
    )
    .unwrap()
});

type WordTest = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

/// `isUnreadableGerman`: the phonotactic test for core/initialisms.ts.
static IS_UNREADABLE: LazyLock<WordTest> = LazyLock::new(|| {
    let p = &MANIFEST.phonotactics;
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(&format!("[{}]", p.vowels), "u").unwrap(),
        legal_onsets: p.onsets.iter().map(|o| js(o)).collect(),
        legal_codas: p.codas.iter().map(|c| js(c)).collect(),
        liquids: None,
        digraphs: Some(p.digraphs.iter().map(|d| js(d)).collect()),
    }))
});

static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.acronym_letters.iter().map(|w| js(w)).collect());

/// `(l) => LETTER_NAME[l]`: `l` is one lowercased code point, which no `Object.prototype` member is.
static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| {
    Arc::new(|l: &JsString| {
        MANIFEST
            .letter_names
            .get(&l.to_string_lossy())
            .map(|n| js(n))
    })
});

/// `isUnreadableGerman(word)`.
pub(crate) fn is_unreadable_german(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

/// `normalizeGermanInitialisms`: nothing is "recorded", so the acronym list and the OOV rule decide.
pub(crate) fn normalize_german_initialisms(text: &JsString) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: LETTER_NAME.clone(),
            lower: None,
            acronym_letters: Arc::new(|w: &JsString| ACRONYM_LETTERS.contains(w)),
            is_recorded: |_: &JsString| false,
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(text)
}

static YEAR_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let not_a_year = format!(r"(?!\s*(?:{})\p{{L}}*)", MANIFEST.measure_stems.join("|"));
    JsRegex::new(
        &format!(r"(?<![\d.,€$£¥₽₴])(1[1-9]\d\d)(?![.,]?\d)(?![\p{{L}}\p{{M}}]){not_a_year}"),
        "giu",
    )
    .unwrap()
});

fn year_words(y: f64) -> JsString {
    let (hi, lo) = ((y / 100.0).floor(), y % 100.0);
    let tail = if lo == 0.0 {
        JsString::new()
    } else {
        number_to_words(lo, None)
    };
    number_to_words(hi, None)
        .concat(&js("hundert"))
        .concat(&tail)
}

/// `normalizeGermanYears`: the decade form (`1980er`) first, then a bare 1100–1999 year.
pub(crate) fn normalize_german_years(input: &JsString) -> JsString {
    let s = rewrite_with(
        input,
        js_re!(r"(?<![\d.,])(1[1-9]\d\d)(ern?)(?![\p{L}\p{M}])", "gu"),
        |m, t| year_words(js_number(&m.group(1, t).unwrap())).concat(&m.group(2, t).unwrap()),
    );
    rewrite_with(&s, &YEAR_RE, |m, t| {
        year_words(js_number(&m.group(1, t).unwrap()))
    })
}

/// `normalizeGerman(input)`.
pub(crate) fn normalize_german(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1) era and the multi-dot abbreviations.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d_])v\.\s?Chr\.", "giu"),
        &js("vor Christus"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d_])n\.\s?Chr\.", "giu"),
        &js("nach Christus"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d_])z\.\s?B\.", "giu"),
        &js("zum Beispiel"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d_])d\.\s?h\.", "gu"),
        &js("das heißt"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d_])u\.\s?a\.", "gu"),
        &js("unter anderem"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d_])u\.\s?Ä\.", "giu"),
        &js("und Ähnliches"),
    );

    // 2) ordinals: licensed by the following noun (≤ 31) or by a preceding licenser plus a capital noun.
    s = rewrite_with(&s, &ORD, |m, t| {
        let whole = m.value(t);
        let prev = m.group(1, t);
        let sp = m.group(2, t);
        let digits = m.group(3, t).unwrap();
        let next = m.group(4, t).unwrap();
        let day = js_number(&digits);
        let licensed = (day <= 31.0 && ORDINAL_NOUN_RE.test(&next))
            || (prev
                .as_ref()
                .is_some_and(|p| LICENSER.contains(&p.to_lower_case()))
                && js_re!(r"^\p{Lu}", "u").test(&next));
        if !licensed {
            return whole;
        }
        let Some(stem) = ordinal_stem(js_number(&digits)) else {
            return whole;
        };
        let ending = if prev
            .as_ref()
            .is_some_and(|p| WEAK_EN.contains(&p.to_lower_case()))
        {
            "en"
        } else {
            "e"
        };
        prev.unwrap_or_default()
            .concat(&sp.unwrap_or_default())
            .concat(&stem)
            .concat(&js(ending))
    });

    // 2b) a bare number before a month is a date ordinal too.
    s = rewrite_with(&s, &BARE_DAY, |m, t| {
        let whole = m.value(t);
        let prev = m.group(1, t);
        let sp = m.group(2, t);
        let digits = m.group(3, t).unwrap();
        let sp2 = m.group(4, t).unwrap();
        let Some(stem) = ordinal_stem(js_number(&digits)) else {
            return whole;
        };
        let ending = if prev
            .as_ref()
            .is_some_and(|p| WEAK_EN.contains(&p.to_lower_case()))
        {
            "en"
        } else {
            "e"
        };
        prev.unwrap_or_default()
            .concat(&sp.unwrap_or_default())
            .concat(&stem)
            .concat(&js(ending))
            .concat(&sp2)
    });

    // 2c) `1 Mio.` / `1 Mrd.` → the singular with its article, replacing the numeral (#1514). The dot is
    //     consumed when the sentence continues and kept at a phrase end, as in step 3.
    s = rewrite_with(&s, &ABBREV_ONE, |m, t| {
        let ab = m.group(1, t).unwrap();
        match MANIFEST
            .dotted_abbrev_one
            .get(&ab.to_lower_case().to_string_lossy())
        {
            None => m.value(t),
            Some(w) if m.group(2, t).is_some() => js(w),
            Some(w) => js(w).concat(&js(".")),
        }
    });

    // 3) dotted abbreviations. ⚠ The miss branch is reachable (#1122): the `iu` fold widens the pattern past
    //    the table's keys, and the match then stays as written.
    s = rewrite_with(&s, &ABBREV_CONTINUES, |m, t| {
        let ab = m.group(1, t).unwrap();
        match MANIFEST
            .dotted_abbrev
            .get(&ab.to_lower_case().to_string_lossy())
        {
            None => m.value(t),
            Some(w) => js(w).concat(&m.group(2, t).unwrap()),
        }
    });
    s = rewrite_with(&s, &ABBREV_ENDS, |m, t| {
        let ab = m.group(1, t).unwrap();
        match MANIFEST
            .dotted_abbrev
            .get(&ab.to_lower_case().to_string_lossy())
        {
            None => m.value(t),
            Some(w) => js(w).concat(&js(".")),
        }
    });

    // 4) clock times; the `Uhr` is re-emitted, not echoed.
    s = rewrite_with(
        &s,
        js_re!(
            r"\b([01]?\d|2[0-3])[:.]([0-5]\d)\b(?!\.?\d)(\s*Uhr)?",
            "giu"
        ),
        |m, t| {
            let (h, min) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
            let head = number_to_words(js_number(&h), Some(&h)).concat(&js(" Uhr"));
            if js_number(&min) == 0.0 {
                head
            } else {
                head.concat(&js(" "))
                    .concat(&number_to_words(js_number(&min), Some(&min)))
            }
        },
    );

    // 5) units the shared tier cannot express, and the degree signs.
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?km\/h\b", "gu"),
        &js("$1 Kilometer pro Stunde"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?m\/s\b", "gu"),
        &js("$1 Meter pro Sekunde"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?C(?![\p{L}\p{M}])", "giu"),
        &js("$1 Grad Celsius"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?F(?![\p{L}\p{M}])", "giu"),
        &js("$1 Grad Fahrenheit"),
    );
    s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 Grad"));

    // 6) signs.
    s = rewrite(&s, js_re!(r"(^|[\s(])[-−–](\d)", "gu"), &js("$1minus $2"));
    s = rewrite(&s, js_re!("±", "gu"), &js(" plus minus "));
    s = rewrite(&s, js_re!(r"(\S)\+\s?(\d)", "gu"), &js("$1 plus $2"));
    s = rewrite(&s, js_re!(r"(^|\s)\+\s?(\d)", "gu"), &js("$1plus $2"));

    // 6b) relational and division signs.
    s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" gleich "));
    s = rewrite(&s, js_re!(r"\s?<\s?", "gu"), &js(" kleiner als "));
    s = rewrite(&s, js_re!(r"\s?>\s?", "gu"), &js(" größer als "));
    s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" geteilt durch "));

    // 7) fractions: ½ is "ein halb"; the rest are the ordinal stem plus -el. The guards are mirrors (#1495).
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d/]|\d\.|(?<![\d/])\d+,)\b(\d{1,3})\/(\d{1,3})\b(?!\s*[/\d]|\.\d|,\d+(?![\d/]))",
            "gu"
        ),
        |m, t| {
            let num = js_number(&m.group(1, t).unwrap());
            let den = js_number(&m.group(2, t).unwrap());
            if den < 2.0 {
                return m.value(t); // not a fraction word (#1514)
            }
            if den == 2.0 {
                return if num == 1.0 {
                    js("ein halb")
                } else {
                    number_to_words(num, None).concat(&js(" halbe"))
                };
            }
            match ordinal_stem(den) {
                None => m.value(t),
                Some(stem) => {
                    let head = if num == 1.0 {
                        js("ein")
                    } else {
                        number_to_words(num, None)
                    };
                    head.concat(&js(" ")).concat(&stem).concat(&js("el"))
                }
            }
        },
    );

    s
}
