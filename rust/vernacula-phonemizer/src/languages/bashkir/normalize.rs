//! Bashkir (ba) text normalization: digit grouping, era markers, the numero sign, the year abbreviation, clocks
//! with a case suffix, a numeral's ordinal or case suffix, degrees (the suffix on the sign), the gram, signs and
//! ranges; plus `ordinalOf`, the initialism pass and the phonotactic test.
//! Ported from src/languages/bashkir/normalize.ts — see that file for the corpus evidence.

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

const STEM_VOWELS: &str = "аәоөуүыиэе";
const SUFFIX_VOWELS: &str = "аәоөуүыиэеёюя";
const ROUNDING: &str = "өо";
const BACK: &str = "аыу";

/// `STEM_VOWELS.includes(s.at(-1)!)`: the last code unit (every vowel here is one; the callers' strings are
/// never empty).
fn ends_in_vowel(s: &JsString) -> bool {
    s.units()
        .last()
        .is_some_and(|&u| STEM_VOWELS.encode_utf16().any(|v| v == u))
}

/// `ordinalOf(n)`: -(ы)нсы / -(е)нсе / -(ө)нсө / -(о)нсо on the cardinal's last word, by its last vowel.
pub(crate) fn ordinal_of(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || n < 0.0 {
        return None;
    }
    let mut words = cardinal(n).split(&js(" "));
    let last = words.last().cloned().filter(|l| !l.is_empty())?;
    let v = last
        .to_string_lossy()
        .chars()
        .rev()
        .find(|c| STEM_VOWELS.contains(*c))?;
    let ends_vowel = ends_in_vowel(&last);
    let suffix = if ROUNDING.contains(v) {
        match (v == 'ө', ends_vowel) {
            (true, true) => "нсө",
            (true, false) => "өнсө",
            (false, true) => "нсо",
            (false, false) => "онсо",
        }
    } else if BACK.contains(v) {
        if ends_vowel { "нсы" } else { "ынсы" }
    } else if ends_vowel {
        "нсе"
    } else {
        "енсе"
    };
    *words.last_mut().unwrap() = last.concat(&js(suffix));
    Some(JsString::join(&words, &js(" ")))
}

/// `LETTER_NAME`. Generated from normalize.ts's object literal.
const LETTER_NAME: [(&str, &str); 40] = [
    ("а", "а"),
    ("б", "бэ"),
    ("в", "вэ"),
    ("г", "гэ"),
    ("ғ", "ғы"),
    ("д", "дэ"),
    ("ҙ", "ҙы"),
    ("е", "е"),
    ("ё", "ё"),
    ("ж", "жэ"),
    ("з", "зэ"),
    ("и", "и"),
    ("й", "ҡыҫҡа и"),
    ("к", "ка"),
    ("ҡ", "ҡы"),
    ("л", "эль"),
    ("м", "эм"),
    ("н", "эн"),
    ("ң", "ңы"),
    ("о", "о"),
    ("ө", "ө"),
    ("п", "пэ"),
    ("р", "эр"),
    ("с", "эс"),
    ("ҫ", "ҫы"),
    ("т", "тэ"),
    ("у", "у"),
    ("ү", "ү"),
    ("ф", "эф"),
    ("х", "ха"),
    ("һ", "һы"),
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
            "бл", "бр", "гр", "гл", "др", "ҡр", "кр", "кл", "пл", "пр", "ст", "сп", "ск", "тр",
            "шк", "шт",
        ]),
        legal_codas: set(&[
            "ҡт", "кт", "нд", "нт", "ңҡ", "рт", "рҙ", "рҫ", "лт", "лд", "ст", "шт", "рш", "рҡ",
            "лҡ", "мб", "нс", "рс", "йҙ", "ҫт",
        ]),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableBashkir(word)`.
pub(crate) fn is_unreadable_bashkir(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

const ACRONYM_LETTERS: [&str; 12] = [
    "аҡш", "ссср", "асср", "ран", "анк", "этп", "тэц", "тэс", "грэс", "нгду", "аск", "ссо",
];

/// `normalizeBashkirInitialisms(text)`. `LETTER_NAME[l]`: `l` is one lowercased code point, which no
/// `Object.prototype` member is.
pub(crate) fn normalize_bashkir_initialisms(text: &JsString) -> JsString {
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

const SFX: &str = "[а-яёәөүҙҫңғҡһ]";

fn g(m: &JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// Step 5's callback: the ordinal when the written suffix continues one, else the cardinal with the suffix glued.
fn attach(whole: &JsString, digits: &JsString, raw_suffix: &JsString) -> JsString {
    let n = js_number(digits);
    if !is_safe_integer(n) {
        return whole.clone();
    }
    let suffix = raw_suffix.to_lower_case();
    if suffix == js("е") || suffix == js("й") {
        return whole.clone();
    }
    if suffix.len() >= 2
        && let Some(ord) = ordinal_of(n)
    {
        let mut k = ord.len().min(suffix.len());
        while k >= 2 {
            if ord.ends_with(&suffix.slice(0, Some(k as isize))) {
                return ord.concat(&suffix.slice(k as isize, None));
            }
            k -= 1;
        }
    }
    let card = cardinal(n);
    if card.is_empty() {
        return whole.clone();
    }
    let has_vowel = suffix
        .to_string_lossy()
        .chars()
        .any(|c| SUFFIX_VOWELS.contains(c));
    if !has_vowel && !ends_in_vowel(&card) {
        return whole.clone();
    }
    card.concat(&suffix)
}

struct Built {
    multi: Vec<(JsRegex, &'static str)>,
    year: JsRegex,
    clock: JsRegex,
    suffix: JsRegex,
    degree_scale_suffix: JsRegex,
    degree_suffix: JsRegex,
    scale_degree_suffix: JsRegex,
    gram_suffix: JsRegex,
}

/// The patterns normalize.ts builds with `new RegExp`, built once.
static BUILT: LazyLock<Built> = LazyLock::new(|| {
    let re = |p: String, f: &str| JsRegex::new(&p, f).unwrap();
    let (b, a) = (NOT_LETTER_BEFORE, NOT_LETTER_AFTER);
    let multi = [
        (r"б\.\s?э\.\s?т\.", "беҙҙең эраға тиклем"),
        (r"б\.\s?э\.", "беҙҙең эра"),
        (r"һ\.\s?б\.", "һәм башҡалар"),
    ]
    .iter()
    .map(|(body, word)| (re(format!("{b}{body}"), "giu"), *word))
    .collect();
    Built {
        multi,
        year: re(format!(r"(\d)\s?й\.{a}"), "gu"),
        clock: re(
            format!(
                r"(?<![\d:.,])([01]?\d|2[0-4]):([0-5]\d)(?![\d:.,])(?:\s?-\s?({SFX}{{1,4}}){a})?"
            ),
            "gu",
        ),
        suffix: re(format!(r"(?<![\d.,/])(\d+)\s?-\s?({SFX}{{1,5}}){a}"), "gu"),
        degree_scale_suffix: re(format!(r"(\d)\s?°\s?[CСcс]\s?-\s?({SFX}{{1,4}}){a}"), "gu"),
        degree_suffix: re(format!(r"(\d)\s?°\s?-\s?({SFX}{{1,4}}){a}"), "gu"),
        scale_degree_suffix: re(format!(r"(\d)\s?[CСcс]\s?°\s?-\s?({SFX}{{1,4}}){a}"), "gu"),
        gram_suffix: re(format!(r"(\d+(?:,\d+)?)\s?г-({SFX}{{1,4}}){a}"), "gu"),
    }
});

/// `normalizeBashkir(input)`. The steps are order-dependent, as in the TS.
pub(crate) fn normalize_bashkir(input: &JsString) -> JsString {
    let bt = &*BUILT;
    let mut s = input.clone();

    // 0) Digit grouping by any space, then every space variant to ASCII.
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

    // 1) Era markers; the final dot is kept as the period when nothing but closing punctuation follows.
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

    // 2) The numero sign; 3) the year abbreviation.
    s = rewrite(&s, js_re!(r"№\s?(?=\d)", "gu"), &js("номер "));
    s = rewrite(&s, &bt.year, &js("$1 йыл"));

    // 4) Clocks, a case suffix glued to the spoken minute.
    s = rewrite_with(&s, &bt.clock, |m, t| {
        let hv = js_number(&g(m, t, 1));
        let mv = js_number(&g(m, t, 2));
        if hv > 24.0 {
            return m.value(t);
        }
        let head = cardinal(hv);
        let body = if mv == 0.0 {
            head
        } else {
            head.concat(&js(" ")).concat(&cardinal(mv))
        };
        match m.group(3, t) {
            None => body,
            Some(sfx) => body.concat(&sfx),
        }
    });

    // 5) A numeral with an ordinal or case suffix.
    s = rewrite_with(&s, &bt.suffix, |m, t| {
        attach(&m.value(t), &g(m, t, 1), &g(m, t, 2))
    });

    // 6) Degrees: the suffix on the sign first, then the scales, then the bare sign.
    s = rewrite(&s, &bt.degree_scale_suffix, &js("$1 градус$2"));
    s = rewrite(&s, &bt.degree_suffix, &js("$1 градус$2"));
    s = rewrite(&s, &bt.scale_degree_suffix, &js("$1 градус$2"));
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[CС]\s?°(?![\p{L}\p{M}])", "gui"),
        &js("$1 Цельсий градусы"),
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

    // 7) The gram (a dot after it is the Russian year); a case suffix on the sign glued to the word (#1581).
    s = rewrite(&s, &bt.gram_suffix, &js("$1 грамм$2"));
    s = rewrite(
        &s,
        js_re!(r"(\d+(?:,\d+)?)\s?г(?![\p{L}\p{M}.])", "gu"),
        &js("$1 грамм"),
    );

    // 8) Signs.
    // Not after a number and a space: `1990 -1995` is a range (#1581).
    s = rewrite(
        &s,
        js_re!(r"(^|\(|(?<![\d.,])\s)[-−–](\d)", "gu"),
        &js("$1минус $2"),
    );
    s = rewrite(&s, js_re!(r"±", "gu"), &js(" плюс минус "));
    s = rewrite(&s, js_re!(r"(^|[\s(])\+\s?(\d)", "gu"), &js("$1плюс $2"));
    s = rewrite(&s, js_re!(r"(\d)\s?=\s?(?=\d)", "gu"), &js("$1 тигеҙ "));
    s = rewrite(&s, js_re!(r"(\d)\s?×\s?(?=\d)", "gu"), &js("$1 тапҡыр "));

    // 9) Ranges as a pause.
    s = rewrite(&s, js_re!(r"(\d)\s?[–—]\s?(?=\d)", "gu"), &js("$1, "));
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\s?-\s?(?=\d)", "gu"),
        &js("$1, "),
    );
    rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" "))
}
