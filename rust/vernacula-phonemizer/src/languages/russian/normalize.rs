//! Russian (ru) text normalization: digit grouping, multi-dot and dotted abbreviations, the case-inflected
//! ordinal notation (`5-е`, `1970-х`), units, clock times, signs and fractions rewritten into words, plus the
//! separately-run initialism pass. Ported from src/languages/russian/normalize.ts — see that file for the
//! corpus evidence and the ordering.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::manifest::MANIFEST;
use super::numbers::number_to_words;
use super::roman_ordinals::russian_ordinal;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{alternation, slavic_count_form, sorted_by_length_desc};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `GROUP_SPACE`: space, NBSP, NNBSP, thin space, as the CHARACTERS (the TS literal holds them raw; its
/// comment names only the last three).
const GROUP_SPACE: &str = " \u{a0}\u{202f}\u{2009}";

/// `CASE_ENDING`, in the TS object's key order (generated from normalize.ts): written ending → the full
/// ending for a hard-stem ordinal and for третий.
const CASE_ENDING: [(&str, (&str, &str)); 21] = [
    ("й", ("", "ий")),
    ("е", ("ое", "ье")),
    ("ое", ("ое", "ье")),
    ("я", ("ая", "ья")),
    ("ая", ("ая", "ья")),
    ("го", ("ого", "ьего")),
    ("ого", ("ого", "ьего")),
    ("м", ("ом", "ьем")),
    ("ом", ("ом", "ьем")),
    ("му", ("ому", "ьему")),
    ("ому", ("ому", "ьему")),
    ("х", ("ых", "ьих")),
    ("ых", ("ых", "ьих")),
    ("ю", ("ую", "ью")),
    ("ую", ("ую", "ью")),
    ("ой", ("ой", "ьей")),
    ("ей", ("ой", "ьей")),
    ("ые", ("ые", "ьи")),
    ("ие", ("ые", "ьи")),
    ("ым", ("ым", "ьим")),
    ("ыми", ("ыми", "ьими")),
];

/// `DOTTED_ABBREV`, in the TS object's key order (generated from normalize.ts).
const DOTTED_ABBREV: [(&str, &str); 13] = [
    ("г", "года"),
    ("гг", "годов"),
    ("в", "века"),
    ("вв", "веков"),
    ("ул", "улица"),
    ("им", "имени"),
    ("стр", "страница"),
    ("проф", "профессор"),
    ("акад", "академик"),
    ("руб", "рублей"),
    ("тыс", "тысяч"),
    ("млн", "миллионов"),
    ("млрд", "миллиардов"),
];

const HOUR: [&str; 3] = ["час", "часа", "часов"];
const MINUTE: [&str; 3] = ["минута", "минуты", "минут"];

/// `MULTI_DOT` (generated from normalize.ts): pattern fragment, words. Longer forms first, as listed.
const MULTI_DOT: [(&str, &str); 5] = [
    (r"до\s+н\.\s?э", "до нашей эры"),
    (r"н\.\s?э", "нашей эры"),
    (r"т\.\s?е", "то есть"),
    (r"т\.\s?д", "так далее"),
    (r"т\.\s?п", "тому подобное"),
];

/// `Object.keys(table).sort((a, b) => b.length - a.length).join("|")`, unescaped as in the TS.
fn alt_by_length_desc<'a>(keys: impl Iterator<Item = &'a str>) -> String {
    alternation(&sorted_by_length_desc(keys.map(js)))
}

static GROUP_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<=\d)(?<!(?<![\d\.,])0)[{GROUP_SPACE}](?=\d{{3}}(?!\d))"),
        "gu",
    )
    .unwrap()
});

static MULTI_DOT_RE: LazyLock<Vec<(JsRegex, &'static str)>> = LazyLock::new(|| {
    MULTI_DOT
        .iter()
        .map(|(pat, words)| {
            (
                JsRegex::new(&format!(r"(?<![\p{{L}}\p{{M}}]){pat}\.(\s*)(\S?)"), "giu").unwrap(),
                *words,
            )
        })
        .collect()
});

static ORDINAL_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let alt = alt_by_length_desc(CASE_ENDING.iter().map(|(k, _)| *k));
    JsRegex::new(&format!(r"\b(\d+)\s?-\s?({alt})(?![а-яё])"), "giu").unwrap()
});

static ABBREV_CONTINUES: LazyLock<JsRegex> = LazyLock::new(|| {
    let alt = alt_by_length_desc(DOTTED_ABBREV.iter().map(|(k, _)| *k));
    JsRegex::new(
        &format!(r"(?<![\p{{L}}\p{{M}}])({alt})\.(\s+)(?=\p{{L}})"),
        "giu",
    )
    .unwrap()
});

static ABBREV_ENDS: LazyLock<JsRegex> = LazyLock::new(|| {
    let alt = alt_by_length_desc(DOTTED_ABBREV.iter().map(|(k, _)| *k));
    JsRegex::new(
        &format!(r"(?<![\p{{L}}\p{{M}}])({alt})\.(?=\s*(?:[.,;:!?»)]|$))"),
        "giu",
    )
    .unwrap()
});

/// `DOTTED_ABBREV[key]`; the key is a lowercased match, which the `iu` fold can widen past the table.
fn dotted_abbrev(key: &JsString) -> Option<&'static str> {
    DOTTED_ABBREV
        .iter()
        .find(|(k, _)| js(k) == *key)
        .map(|(_, v)| *v)
}

/// `CASE_ENDING[written]`. `written` is a lowercased match of the table's own alternation (the fold can widen
/// it past the table, and the miss then declines the whole rewrite).
fn case_ending(written: &JsString) -> Option<(&'static str, &'static str)> {
    CASE_ENDING
        .iter()
        .find(|(k, _)| js(k) == *written)
        .map(|(_, f)| *f)
}

/// `ordinalBase(n)`: the masculine-nominative ordinal past `russianOrdinal`'s 1–100: the cardinal head plus
/// the ordinal of the final ≤ 100 part. `None` for a round hundred or thousand.
fn ordinal_base(n: f64) -> Option<JsString> {
    if let Some(direct) = russian_ordinal(n) {
        return Some(direct);
    }
    let rest = n % 100.0;
    if rest == 0.0 {
        return None;
    }
    let tail = russian_ordinal(rest)?;
    Some(
        number_to_words(n - rest, None)
            .concat(&js(" "))
            .concat(&tail),
    )
}

/// `inflectOrdinal(base, written)`: the last word takes the case the written suffix marks.
fn inflect_ordinal(base: &JsString, written: &JsString) -> Option<JsString> {
    let (hard, soft_form) = case_ending(written)?;
    let mut words = base.split(&js(" "));
    let last = words.last().unwrap().clone();
    let soft = last.ends_with(&js("ий"));
    let stem = js_re!("(ый|ой|ий)$", "u").replace(&last, &JsString::new());
    let ending = if soft {
        js(soft_form)
    } else if !hard.is_empty() {
        js(hard)
    } else {
        last.slice(stem.len() as isize, None)
    };
    *words.last_mut().unwrap() = stem.concat(&ending);
    Some(JsString::join(&words, &js(" ")))
}

type Predicate = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

/// `isUnreadableRussian`: the phonotactic test for core/initialisms.ts.
static IS_UNREADABLE: LazyLock<Predicate> = LazyLock::new(|| {
    let p = &MANIFEST.phonotactics;
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(&format!("[{}]", p.vowels), "u").unwrap(),
        legal_onsets: p.onsets.iter().map(|o| js(o)).collect(),
        legal_codas: p.codas.iter().map(|c| js(c)).collect(),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableRussian(word)`.
pub(crate) fn is_unreadable_russian(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.acronym_letters.iter().map(|w| js(w)).collect());

/// `(l) => MANIFEST.letterNames[l]`: `l` is one lowercased code point, which no `Object.prototype` member's
/// name is, so an own-key lookup is the same thing.
static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| {
    Arc::new(|l: &JsString| {
        MANIFEST
            .letter_names
            .get(&l.to_string_lossy())
            .map(|n| js(n))
    })
});

/// `normalizeRussianInitialisms`: nothing is "recorded" (the lexicon is a stress dictionary), so the acronym
/// list and the OOV rule decide alone.
pub(crate) fn normalize_russian_initialisms(text: &JsString) -> JsString {
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

/// `counted(n, forms)`: Slavic count agreement, `forms[Math.min(slavicCountForm(n), 2)]` (a clock's integer
/// gives 0, 1 or 2).
fn counted(n: f64, forms: &[&'static str; 3]) -> &'static str {
    forms[slavic_count_form(n).min(2.0) as usize]
}

/// `normalizeRussian(input)`.
pub(crate) fn normalize_russian(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 0) digit grouping with a space (twice, as the TS does), then the separators to a plain space.
    s = rewrite(&s, &GROUP_RE, &JsString::new());
    s = rewrite(&s, &GROUP_RE, &JsString::new());
    s = rewrite(&s, js_re!(r"[    ]", "gu"), &js(" "));

    // 1) multi-dot abbreviations; the trailing dot is kept only where it also ends the sentence.
    for (re, words) in MULTI_DOT_RE.iter() {
        s = rewrite_with(&s, re, |m, t| {
            let sp = m.group(1, t).unwrap_or_default();
            let next = m.group(2, t).unwrap_or_default();
            let w = js(words);
            if next.is_empty() {
                return w.concat(&js("."));
            }
            if js_re!(r"[,;:!?)»]", "u").test(&next) {
                return w.concat(&sp).concat(&next);
            }
            if js_re!(r"\p{Lu}", "u").test(&next) {
                return w.concat(&js(".")).concat(&sp).concat(&next);
            }
            w.concat(&sp).concat(&next)
        });
    }

    // 2) номер.
    s = rewrite(&s, js_re!(r"№\s?(?=\d)", "gu"), &js("номер "));

    // 3) ordinal notation: the suffix is the case ending.
    s = rewrite_with(&s, &ORDINAL_RE, |m, t| {
        let whole = m.value(t);
        let digits = m.group(1, t).unwrap();
        let written = m.group(2, t).unwrap();
        let Some(base) = ordinal_base(js_number(&digits)) else {
            return whole;
        };
        inflect_ordinal(&base, &written.to_lower_case()).unwrap_or(whole)
    });

    // 3b) `г.` after в/во and a year is году.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(в|во)\s+(\d+)\s*г\.", "giu"),
        &js("$1 $2 году"),
    );

    // 4) dotted abbreviations. ⚠ The miss branch is reachable (#1122): the `iu` fold widens the pattern past
    //    the table's keys, and the match then stays as written.
    s = rewrite_with(&s, &ABBREV_CONTINUES, |m, t| {
        match dotted_abbrev(&m.group(1, t).unwrap().to_lower_case()) {
            None => m.value(t),
            Some(w) => js(w).concat(&m.group(2, t).unwrap()),
        }
    });
    s = rewrite_with(&s, &ABBREV_ENDS, |m, t| {
        match dotted_abbrev(&m.group(1, t).unwrap().to_lower_case()) {
            None => m.value(t),
            Some(w) => js(w).concat(&js(".")),
        }
    });

    // 5) units the shared tier cannot express.
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?км\/ч(?![а-яё])", "giu"),
        &js("$1 километров в час"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?м\/с(?![а-яё])", "giu"),
        &js("$1 метров в секунду"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?[CСcс](?![а-яё])", "gu"),
        &js("$1 градусов Цельсия"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?[FФfф](?![а-яё])", "gu"),
        &js("$1 градусов Фаренгейта"),
    );
    s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 градусов"));

    // 6) clock, with Slavic count agreement; a comma-plus-digit after the minutes is a sports time.
    s = rewrite_with(
        &s,
        js_re!(r"\b([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?!,\d)", "gu"),
        |m, t| {
            let hv = js_number(&m.group(1, t).unwrap());
            let mv = js_number(&m.group(2, t).unwrap());
            let head = number_to_words(hv, None)
                .concat(&js(" "))
                .concat(&js(counted(hv, &HOUR)));
            if mv == 0.0 {
                head
            } else {
                head.concat(&js(" "))
                    .concat(&number_to_words(mv, None))
                    .concat(&js(" "))
                    .concat(&js(counted(mv, &MINUTE)))
            }
        },
    );

    // 7) signs.
    s = rewrite(&s, js_re!(r"(^|[\s(])[-−–](\d)", "gu"), &js("$1минус $2"));
    s = rewrite(&s, js_re!("±", "gu"), &js(" плюс минус "));
    s = rewrite(&s, js_re!(r"(\S)\+\s?(\d)", "gu"), &js("$1 плюс $2"));
    s = rewrite(&s, js_re!(r"(^|\s)\+\s?(\d)", "gu"), &js("$1плюс $2"));

    // 7b) relational and division signs.
    s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" равно "));
    s = rewrite(&s, js_re!(r"\s?<\s?", "gu"), &js(" меньше чем "));
    s = rewrite(&s, js_re!(r"\s?>\s?", "gu"), &js(" больше чем "));
    s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" разделить на "));

    // 8) fractions, feminine (the elided часть). The two guards are mirrors (#1495).
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d/]|\d\.|(?<![\d/])\d+,)\b(\d{1,3})\/(\d{1,3})\b(?!\s*[/\d]|\.\d|,\d+(?![\d/]))",
            "gu"
        ),
        |m, t| {
            let m0 = m.value(t);
            let num = js_number(&m.group(1, t).unwrap());
            let den = js_number(&m.group(2, t).unwrap());
            if num == 1.0 && den == 2.0 {
                return js("одна вторая");
            }
            let Some(base) = ordinal_base(den) else {
                return m0;
            };
            let fem = inflect_ordinal(&base, &js("я"));
            let num_word = js_re!("один$", "u").replace(&number_to_words(num, None), &js("одна"));
            let num_word = js_re!("два$", "u").replace(&num_word, &js("две"));
            match fem {
                None => m0,
                Some(f) => num_word.concat(&js(" ")).concat(&f),
            }
        },
    );

    s
}
