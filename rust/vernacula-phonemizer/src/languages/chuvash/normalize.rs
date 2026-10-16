//! Chuvash (chv) text normalization: digit grouping (both sides of the decimal), magnitude and era abbreviations,
//! the numero sign, clocks, the пай fraction, ordinal ranges and the -мӗш ordinal, signs, degrees and ranges; the
//! attributive-numeral pass that runs after the symbol tier; plus `ordinalOf`, the initialism pass and the
//! phonotactic test. Ported from src/languages/chuvash/normalize.ts — see that file for the corpus evidence.

use std::sync::{Arc, LazyLock};

use super::numbers::number_to_words;
use crate::core::boundaries::NOT_LETTER_AFTER;
use crate::core::initialisms::{
    InitialismData, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `cardinal(n, attr)`: the number words in the series the slot calls for, space-joined.
fn cardinal(n: f64, attr: bool) -> JsString {
    js(&number_to_words(n, attr).join(" "))
}

/// `ordinalOf(n)`: the full numeral plus an invariant -мӗш.
pub(crate) fn ordinal_of(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || n < 0.0 {
        return None;
    }
    let mut words = cardinal(n, false).split(&js(" "));
    let last = words.last().cloned().filter(|l| !l.is_empty())?;
    *words.last_mut().unwrap() = last.concat(&js("мӗш"));
    Some(JsString::join(&words, &js(" ")))
}

/// `LETTER_NAME`. Generated from normalize.ts's object literal.
const LETTER_NAME: [(&str, &str); 35] = [
    ("а", "а"),
    ("ӑ", "ӑ"),
    ("б", "бэ"),
    ("в", "вэ"),
    ("г", "гэ"),
    ("д", "дэ"),
    ("е", "е"),
    ("ё", "ё"),
    ("ж", "жэ"),
    ("з", "зэ"),
    ("и", "и"),
    ("й", "кӗске и"),
    ("к", "ка"),
    ("л", "эль"),
    ("м", "эм"),
    ("н", "эн"),
    ("о", "о"),
    ("п", "пэ"),
    ("р", "эр"),
    ("с", "эс"),
    ("ҫ", "ҫе"),
    ("т", "тэ"),
    ("у", "у"),
    ("ӳ", "ӳ"),
    ("ф", "эф"),
    ("х", "ха"),
    ("ц", "цэ"),
    ("ч", "че"),
    ("ш", "ша"),
    ("щ", "ща"),
    ("ы", "ы"),
    ("э", "э"),
    ("ӗ", "ӗ"),
    ("ю", "ю"),
    ("я", "я"),
];

type WordTest = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

static IS_UNREADABLE: LazyLock<WordTest> = LazyLock::new(|| {
    let set = |v: &[&str]| v.iter().map(|s| js(s)).collect();
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(r"[аӑеёиоуӳыэӗюя]", "u").unwrap(),
        legal_onsets: set(&[
            "бл", "бр", "гр", "гл", "др", "кр", "кл", "пл", "пр", "ст", "сп", "ск", "тр", "шк",
            "шт",
        ]),
        legal_codas: set(&[
            "кт", "нт", "нк", "рт", "рд", "рс", "лт", "лк", "ст", "шт", "рш", "мп", "нч", "рч",
            "рм",
        ]),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableChuvash(word)`.
pub(crate) fn is_unreadable_chuvash(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

const ACRONYM_LETTERS: [&str; 9] = [
    "чр",
    "чнии",
    "асср",
    "рсфср",
    "ссср",
    "апш",
    "часср",
    "ссп",
    "ут",
];

/// `normalizeChuvashInitialisms(text)`. `LETTER_NAME[l]`: `l` is one lowercased code point, which no
/// `Object.prototype` member is.
pub(crate) fn normalize_chuvash_initialisms(text: &JsString) -> JsString {
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

/// The four Latin look-alikes ⟨ă ĕ ç ü⟩ are in both classes, and folded back by `to_cyrillic` (#1581).
const SFX: &str = "[а-яёӑӗҫӳăĕçü]";
const WORD: &str = "[а-яёӑӗҫӳА-ЯЁӐӖҪӲăĕçüĂĔÇÜ]";

/// A written suffix with its Latin look-alikes folded to the Chuvash Cyrillic letters.
fn to_cyrillic(sfx: &JsString) -> JsString {
    let s: String = sfx
        .to_string_lossy()
        .chars()
        .map(|c| match c {
            'ă' => 'ӑ',
            'ĕ' => 'ӗ',
            'ç' => 'ҫ',
            'ü' => 'ӳ',
            c => c,
        })
        .collect();
    js(&s)
}

fn g(m: &JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `attachOrdinal(whole, digits, rawSuffix)`: the ordinal spliced on its overlap with the written suffix.
fn attach_ordinal(whole: &JsString, digits: &JsString, raw_suffix: &JsString) -> JsString {
    let n = js_number(digits);
    if !is_safe_integer(n) {
        return whole.clone();
    }
    let Some(ord) = ordinal_of(n) else {
        return whole.clone();
    };
    let suffix = raw_suffix.to_lower_case();
    let mut k = ord.len().min(suffix.len());
    while k >= 2 {
        if ord.ends_with(&suffix.slice(0, Some(k as isize))) {
            return ord.concat(&suffix.slice(k as isize, None));
        }
        k -= 1;
    }
    whole.clone()
}

struct Built {
    mlrd: JsRegex,
    trln: JsRegex,
    mln: JsRegex,
    era: JsRegex,
    years: JsRegex,
    year: JsRegex,
    fraction: JsRegex,
    ordinal_range: JsRegex,
    ordinal: JsRegex,
    attributive: JsRegex,
}

/// The patterns normalize.ts builds with `new RegExp`, built once.
static BUILT: LazyLock<Built> = LazyLock::new(|| {
    let re = |p: String, f: &str| JsRegex::new(&p, f).unwrap();
    let a = NOT_LETTER_AFTER;
    Built {
        mlrd: re(format!(r"(?<![\p{{L}}\p{{M}}])млрд\.?{a}"), "giu"),
        trln: re(format!(r"(?<![\p{{L}}\p{{M}}])трлн\.?{a}"), "giu"),
        mln: re(format!(r"(?<![\p{{L}}\p{{M}}])млн\.?{a}"), "giu"),
        era: re(r"(?<![\p{L}\p{M}])п\.\s?эрч\.".to_string(), "giu"),
        years: re(r"(\d)\s?ҫҫ\.".to_string(), "gu"),
        year: re(r"(\d)\s?ҫ\.".to_string(), "gu"),
        fraction: re(
            format!(r"(?<![\d.,/])(\d{{1,2}})\s?/\s?(\d{{1,2}})(?=\s(?:пай|пая|пайĕ|пайӗ){WORD}*)"),
            "gu",
        ),
        ordinal_range: re(
            format!(r"(?<![\d.,])(\d+)\s?-\s?(\d+)\s?-\s?(м[ĕӗ]ш{SFX}{{0,8}}){a}"),
            "gu",
        ),
        ordinal: re(
            format!(r"(?<![\d.,/])(\d+)\s?-\s?(м[ĕӗ]ш{SFX}{{0,6}}){a}"),
            "gu",
        ),
        attributive: re(format!(r"(?<![\d.,:/-])(\d+)(\s)(?={WORD})"), "gu"),
    }
});

/// `normalizeChuvash(input)`. The steps are order-dependent, as in the TS.
pub(crate) fn normalize_chuvash(input: &JsString) -> JsString {
    let bt = &*BUILT;
    let mut s = input.clone();

    // 0) Digit grouping by any space, on the integer side and then the fraction side; every space variant to ASCII.
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
    s = rewrite_with(
        &s,
        js_re!(r"([.,]\d{3})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)", "gu"),
        |m, t| {
            g(m, t, 1).concat(
                &js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&g(m, t, 2), &JsString::new()),
            )
        },
    );
    s = rewrite(&s, js_re!(r"[ \u00a0\u202f\u2009]", "gu"), &js(" "));

    // 1) Magnitude abbreviations; 1b) the era marker and the year abbreviations.
    s = rewrite(&s, &bt.mlrd, &js("миллиард"));
    s = rewrite(&s, &bt.trln, &js("триллион"));
    s = rewrite(&s, &bt.mln, &js("миллион"));
    s = rewrite(&s, &bt.era, &js("пирӗн эраччен"));
    s = rewrite(&s, &bt.years, &js("$1 ҫулсем"));
    s = rewrite(&s, &bt.year, &js("$1 ҫул"));

    // 2) The numero sign.
    s = rewrite(&s, js_re!(r"№\s?(?=\d)", "gu"), &js("номер "));

    // 3) Clocks: three fields (the seconds reach 60), then two.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:.,])([01]?\d|2[0-3]|24(?=:00:00)):([0-5]\d):([0-5]\d|60)(?![\d:.,])",
            "gu"
        ),
        |m, t| {
            JsString::join(
                &[
                    cardinal(js_number(&g(m, t, 1)), false),
                    cardinal(js_number(&g(m, t, 2)), false),
                    cardinal(js_number(&g(m, t, 3)), false),
                ],
                &js(" "),
            )
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:.,])([01]?\d|2[0-3]|24(?=:\s?00(?![\d:.,]))):\s?([0-5]\d)(?![\d:.,])",
            "gu"
        ),
        |m, t| {
            let mv = js_number(&g(m, t, 2));
            let h = cardinal(js_number(&g(m, t, 1)), false);
            if mv == 0.0 {
                h
            } else {
                h.concat(&js(" ")).concat(&cardinal(mv, false))
            }
        },
    );

    // 4) The fraction, only where пай follows.
    s = rewrite_with(&s, &bt.fraction, |m, t| {
        let whole = m.value(t);
        let (nv, dv) = (js_number(&g(m, t, 1)), js_number(&g(m, t, 2)));
        if !(nv >= 1.0 && nv < dv && dv <= 12.0) {
            return whole;
        }
        match ordinal_of(dv) {
            None => whole,
            Some(ord) => cardinal(nv, false).concat(&js(" ")).concat(&ord),
        }
    });

    // 5) The ordinal range; 6) the ordinal suffix (a Latin ĕ in it folded to ӗ).
    s = rewrite_with(&s, &bt.ordinal_range, |m, t| {
        let whole = m.value(t);
        let sfx = to_cyrillic(&g(m, t, 3));
        let first = attach_ordinal(&whole, &g(m, t, 1), &sfx);
        let second = attach_ordinal(&whole, &g(m, t, 2), &sfx);
        if first == whole || second == whole {
            return whole;
        }
        first.concat(&js(", ")).concat(&second)
    });
    s = rewrite_with(&s, &bt.ordinal, |m, t| {
        attach_ordinal(&m.value(t), &g(m, t, 1), &to_cyrillic(&g(m, t, 2)))
    });

    // 7) Signs.
    s = rewrite(
        &s,
        js_re!(r"(^|(?<!\d)[\s(])[-−–](\d)", "gu"),
        &js("$1минус $2"),
    );
    s = rewrite(&s, js_re!(r"±", "gu"), &js(" плюс минус "));
    s = rewrite(&s, js_re!(r"(^|[\s(])\+\s?(\d)", "gu"), &js("$1плюс $2"));

    // 8) Degrees.
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?[CСс](?![\p{L}\p{M}])", "gui"),
        &js("$1 Цельси градусӗ"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?[FФф](?![\p{L}\p{M}])", "gui"),
        &js("$1 Фаренгейт градусӗ"),
    );
    s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 градус "));

    // 9) Ranges as a pause.
    s = rewrite(&s, js_re!(r"(\d)\s?[–—]\s?(?=\d)", "gu"), &js("$1, "));
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\s?-\s?(?=\d)", "gu"),
        &js("$1, "),
    );
    rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" "))
}

/// `spellAttributive(input)`: a figure immediately followed by a Chuvash word is spelt in the short series.
pub(crate) fn spell_attributive(input: &JsString) -> JsString {
    rewrite_with(input, &BUILT.attributive, |m, t| {
        let n = js_number(&g(m, t, 1));
        if !is_safe_integer(n) {
            return m.value(t);
        }
        cardinal(n, true).concat(&g(m, t, 2))
    })
}
