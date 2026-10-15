//! Tatar (tt) text normalization: digit grouping, era markers and abbreviations, the numero sign, clocks with a
//! case suffix, a numeral's ordinal or case suffix (harmonised), signs, degrees, ranges; plus `ordinalOf`, the
//! initialism pass and the phonotactic test. Ported from src/languages/tatar/normalize.ts — see that file for
//! the corpus evidence.

use std::sync::{Arc, LazyLock};

use super::numbers::number_to_words;
use crate::core::boundaries::{NOT_LETTER_AFTER, NOT_LETTER_BEFORE};
use crate::core::initialisms::{
    InitialismData, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `cardinal(n)`: the number words, space-joined.
fn cardinal(n: f64) -> JsString {
    js(&number_to_words(n).join(" "))
}

const VOWELS: &str = "аәоөуүыиэеёюя";
const FRONT: &str = "әөүеиэ";

/// `VOWELS.includes(s.at(-1))`: the last code unit (every vowel here is one; `includes("")` cannot arise, the
/// callers' strings are never empty).
fn ends_in_vowel(s: &JsString) -> bool {
    s.units()
        .last()
        .is_some_and(|&u| VOWELS.encode_utf16().any(|v| v == u))
}

/// `[...s].some((c) => VOWELS.includes(c))`.
fn has_vowel(s: &JsString) -> bool {
    s.to_string_lossy().chars().any(|c| VOWELS.contains(c))
}

/// `ordinalOf(n)`: -(ы)нчы / -(е)нче on the cardinal's last word (к → г before the suffix).
pub(crate) fn ordinal_of(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || n < 0.0 {
        return None;
    }
    let mut words = cardinal(n).split(&js(" "));
    let mut last = words.last().cloned().filter(|l| !l.is_empty())?;
    let v = last
        .to_string_lossy()
        .chars()
        .rev()
        .find(|c| VOWELS.contains(*c))?;
    let front = FRONT.contains(v);
    let ends_vowel = ends_in_vowel(&last);
    if !ends_vowel && last.ends_with(&js("к")) {
        last = last.slice(0, Some(-1)).concat(&js("г"));
    }
    let suffix = match (ends_vowel, front) {
        (true, true) => "нче",
        (true, false) => "нчы",
        (false, true) => "енче",
        (false, false) => "ынчы",
    };
    *words.last_mut().unwrap() = last.concat(&js(suffix));
    Some(JsString::join(&words, &js(" ")))
}

/// `CASE_SUFFIX`. Generated from normalize.ts's literal.
const CASE_SUFFIX: [&str; 46] = [
    "ның",
    "нең",
    "га",
    "гә",
    "ка",
    "кә",
    "на",
    "нә",
    "ны",
    "не",
    "н",
    "да",
    "дә",
    "та",
    "тә",
    "нда",
    "ндә",
    "дан",
    "дән",
    "тан",
    "тән",
    "ннан",
    "ннән",
    "лар",
    "ләр",
    "ларда",
    "ләрдә",
    "лардан",
    "ләрдән",
    "ларны",
    "ләрне",
    "ларның",
    "ләрнең",
    "ы",
    "сы",
    "се",
    "ын",
    "ен",
    "ына",
    "енә",
    "ында",
    "ендә",
    "ыннан",
    "еннән",
    "ының",
    "енең",
];

fn is_case_suffix(s: &JsString) -> bool {
    CASE_SUFFIX.iter().any(|c| *s == **c)
}

const ORD_SUFFIX: &str = "(?:ынчы|енче|нчы|нче)";

/// `LETTER_NAME`. Generated from normalize.ts's object literal.
const LETTER_NAME: [(&str, &str); 37] = [
    ("а", "а"),
    ("б", "бэ"),
    ("в", "вэ"),
    ("г", "гэ"),
    ("д", "дэ"),
    ("е", "е"),
    ("ё", "ё"),
    ("ж", "жэ"),
    ("җ", "җэ"),
    ("з", "зэ"),
    ("и", "и"),
    ("й", "кыска и"),
    ("к", "ка"),
    ("л", "эль"),
    ("м", "эм"),
    ("н", "эн"),
    ("ң", "эң"),
    ("о", "о"),
    ("ө", "ө"),
    ("п", "пэ"),
    ("р", "эр"),
    ("с", "эс"),
    ("т", "тэ"),
    ("у", "у"),
    ("ү", "ү"),
    ("ф", "эф"),
    ("х", "ха"),
    ("һ", "һэ"),
    ("ц", "цэ"),
    ("ч", "че"),
    ("ш", "ша"),
    ("щ", "ща"),
    ("ы", "ы"),
    ("э", "э"),
    ("ә", "ә"),
    ("ю", "ю"),
    ("я", "я"),
];

type WordTest = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

static IS_UNREADABLE: LazyLock<WordTest> = LazyLock::new(|| {
    let set = |v: &[&str]| v.iter().map(|s| js(s)).collect();
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(r"[аәеёиоөуүыэюя]", "u").unwrap(),
        legal_onsets: set(&[
            "бл", "бр", "гр", "гл", "др", "кр", "кл", "пл", "пр", "ст", "сп", "ск", "тр", "шк",
            "шт",
        ]),
        legal_codas: set(&[
            "кт", "нд", "нт", "нк", "рт", "рд", "рс", "лт", "лд", "ст", "шт", "рш", "рк", "лк",
            "мб", "нч", "рч", "йд", "нз",
        ]),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableTatar(word)`.
pub(crate) fn is_unreadable_tatar(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

const ACRONYM_LETTERS: [&str; 11] = [
    "акш",
    "ссср",
    "асср",
    "басср",
    "рсфср",
    "сср",
    "тр",
    "рф",
    "ао",
    "мтс",
    "тэп",
];

/// `normalizeTatarInitialisms(text)`. `LETTER_NAME[l]`: `l` is one lowercased code point, which no
/// `Object.prototype` member is.
pub(crate) fn normalize_tatar_initialisms(text: &JsString) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: Arc::new(|l: &JsString| {
                LETTER_NAME
                    .iter()
                    .find(|(c, _)| *l == **c)
                    .map(|(_, n)| js(n))
            }),
            lower: None,
            acronym_letters: Arc::new(|w: &JsString| ACRONYM_LETTERS.iter().any(|a| *w == **a)),
            is_recorded: |_: &JsString| false,
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(text)
}

const SFX: &str = "[а-яёәөүҗңһ]";

/// `attach(whole, digits, rawSuffix)`: the ordinal when the suffix continues one, else the cardinal with a case
/// suffix it can carry.
fn attach(whole: &JsString, digits: &JsString, raw_suffix: &JsString) -> JsString {
    let n = js_number(digits);
    if !is_safe_integer(n) {
        return whole.clone();
    }
    let suffix = raw_suffix.to_lower_case();
    if let Some(ord) = ordinal_of(n) {
        let mut k = ord.len().min(suffix.len());
        while k >= 2 {
            if ord.ends_with(&suffix.slice(0, Some(k as isize))) {
                return ord.concat(&suffix.slice(k as isize, None));
            }
            k -= 1;
        }
    }
    if !is_case_suffix(&suffix) {
        return whole.clone();
    }
    let card = cardinal(n);
    if card.is_empty() {
        return whole.clone();
    }
    if !has_vowel(&suffix) && !ends_in_vowel(&card) {
        return whole.clone();
    }
    card.concat(&suffix)
}

/// `attachToWords(whole, words, rawSuffix)`: a case suffix glued onto spoken words.
fn attach_to_words(whole: &JsString, words: &JsString, raw_suffix: &JsString) -> JsString {
    let suffix = raw_suffix.to_lower_case();
    if !is_case_suffix(&suffix) {
        return whole.clone();
    }
    if !has_vowel(&suffix) && !ends_in_vowel(words) {
        return whole.clone();
    }
    words.concat(&suffix)
}

fn g(m: &JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

struct Built {
    multi: Vec<(JsRegex, &'static str)>,
    clock_hms: JsRegex,
    clock_hm: JsRegex,
    hyphen_suffix: JsRegex,
    glued_suffix: JsRegex,
    dm_suffix: JsRegex,
    spaced_ordinal: JsRegex,
}

/// The patterns normalize.ts builds with `new RegExp`, built once.
static BUILT: LazyLock<Built> = LazyLock::new(|| {
    let re = |p: String, f: &str| JsRegex::new(&p, f).unwrap();
    let (b, a) = (NOT_LETTER_BEFORE, NOT_LETTER_AFTER);
    let time_suffix = format!(r"(?:\s?-\s?|)({SFX}{{1,5}}){a}");
    let multi = [
        (r"б\s?\.\s?э\s?\.?\s?к\s?\.?", "безнең эрага кадәр"),
        (r"я\s?\.\s?э\s?\.?\s?к\s?\.?", "яңа эрага кадәр"),
        (r"б\s?\.\s?э\s?\.", "безнең эра"),
        (r"я\s?\.\s?э\s?\.", "яңа эра"),
        (r"һ\s?\.\s?б\s?\.", "һәм башкалар"),
        (r"ш\s?\.\s?и\s?\.", "шул исәптән"),
        (r"млрд\s?\.", "миллиард"),
        (r"млн\s?\.", "миллион"),
    ]
    .iter()
    .map(|(body, word)| (re(format!("{b}{body}"), "giu"), *word))
    .collect();
    Built {
        multi,
        clock_hms: re(
            format!(
                r"(?<![\d:.,])([01]?\d|2[0-4]):([0-5]\d):([0-5]\d)(?![\d:.,])(?:{time_suffix})?"
            ),
            "gu",
        ),
        clock_hm: re(
            format!(r"(?<![\d:.,])([01]?\d|2[0-4]):\s?([0-5]\d)(?![\d:.,])(?:{time_suffix})?"),
            "gu",
        ),
        hyphen_suffix: re(format!(r"(?<![\d.,/])(\d+)\s?-\s?({SFX}{{1,6}}){a}"), "gu"),
        glued_suffix: re(format!(r"(?<![\d.,/])(\d+)({SFX}{{1,6}}){a}"), "gu"),
        dm_suffix: re(
            format!(r"(\d)\s?°\s?(\d+)\s?[′']\s?({SFX}{{1,5}}){a}"),
            "gu",
        ),
        spaced_ordinal: re(format!(r"(?<![\d.,])(\d+)\s({ORD_SUFFIX}){a}"), "gu"),
    }
});

/// `normalizeTatar(input)`. The steps are order-dependent, as in the TS.
pub(crate) fn normalize_tatar(input: &JsString) -> JsString {
    let bt = &*BUILT;
    let mut s = input.clone();

    // Digit grouping by any space, then every space variant to ASCII.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)",
            "gu"
        ),
        |m, t| {
            g(m, t, 1).concat(
                &js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&g(m, t, 2), &JsString::new()),
            )
        },
    );
    s = rewrite(&s, js_re!(r"[ \u00a0\u202f\u2009]", "gu"), &js(" "));

    // Era markers and abbreviations; the final dot is kept as the period when nothing but closing punctuation
    // follows.
    for (re, word) in bt.multi.iter() {
        s = rewrite_with(&s, re, |m, t| {
            let rest = t.slice(m.end() as isize, None);
            if js_re!(r#"^\s*["»)']?\s*$"#, "u").test(&rest) {
                js(&format!("{word}."))
            } else {
                js(word)
            }
        });
    }

    s = rewrite(&s, js_re!(r"№\s?(?=\d)", "gu"), &js("номер "));

    // Clocks, with an optional case suffix glued to the last spoken word.
    s = rewrite_with(&s, &bt.clock_hms, |m, t| {
        let words = JsString::join(
            &[
                cardinal(js_number(&g(m, t, 1))),
                cardinal(js_number(&g(m, t, 2))),
                cardinal(js_number(&g(m, t, 3))),
            ],
            &js(" "),
        );
        match m.group(4, t) {
            None => words,
            Some(sfx) => attach_to_words(&m.value(t), &words, &sfx),
        }
    });
    s = rewrite_with(&s, &bt.clock_hm, |m, t| {
        let mv = js_number(&g(m, t, 2));
        let h = cardinal(js_number(&g(m, t, 1)));
        let words = if mv == 0.0 {
            h
        } else {
            h.concat(&js(" ")).concat(&cardinal(mv))
        };
        match m.group(3, t) {
            None => words,
            Some(sfx) => attach_to_words(&m.value(t), &words, &sfx),
        }
    });

    // A numeral with an ordinal or case suffix, hyphenated and glued.
    s = rewrite_with(&s, &bt.hyphen_suffix, |m, t| {
        attach(&m.value(t), &g(m, t, 1), &g(m, t, 2))
    });
    s = rewrite_with(&s, &bt.glued_suffix, |m, t| {
        attach(&m.value(t), &g(m, t, 1), &g(m, t, 2))
    });

    // Signs.
    s = rewrite(
        &s,
        js_re!(r"(^|(?<!\d)[\s(])[-−–](\d)", "gu"),
        &js("$1минус $2"),
    );
    s = rewrite(&s, js_re!(r"±", "gu"), &js(" плюс минус "));
    s = rewrite(&s, js_re!(r"(^|[\s(])\+\s?(\d)", "gu"), &js("$1плюс $2"));
    s = rewrite(&s, js_re!(r"(\d)\s?=\s?(?=\d)", "gu"), &js("$1 тигез "));
    s = rewrite(&s, js_re!(r"(\d)\s?×\s?(?=\d)", "gu"), &js("$1 тапкыр "));

    // Degrees (angular), a suffix on the minutes glued when it is a case suffix.
    s = rewrite_with(&s, &bt.dm_suffix, |m, t| {
        let whole = m.value(t);
        let (deg, min, sfx) = (g(m, t, 1), g(m, t, 2), g(m, t, 3));
        let words = deg
            .concat(&js(" градус "))
            .concat(&min)
            .concat(&js(" минут"));
        let glued = attach_to_words(&whole, &words, &sfx);
        if glued == whole {
            words.concat(&js(" ")).concat(&sfx)
        } else {
            glued.concat(&js(" "))
        }
    });
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?(\d+)\s?[′']", "gu"),
        &js("$1 градус $2 минут "),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?[CС](?![\p{L}\p{M}])", "gui"),
        &js("$1 Цельсий градусы"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?[FФ](?![\p{L}\p{M}])", "gui"),
        &js("$1 Фаренгейт градусы"),
    );
    s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 градус "));

    // A spaced ordinal suffix, then ranges as a pause.
    s = rewrite_with(&s, &bt.spaced_ordinal, |m, t| {
        attach(&m.value(t), &g(m, t, 1), &g(m, t, 2))
    });
    s = rewrite(&s, js_re!(r"(\d)\s?[–—]\s?(?=\d)", "gu"), &js("$1, "));
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\s?-\s?(?=\d)", "gu"),
        &js("$1, "),
    );
    rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" "))
}
