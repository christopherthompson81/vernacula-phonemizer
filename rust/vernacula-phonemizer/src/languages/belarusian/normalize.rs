//! Belarusian (be) text normalization: digit grouping, multi-dot and dotted abbreviations, №, the year and
//! magnitude abbreviations, the numeral + written-suffix notation (ordinal or oblique cardinal), `м` and `м/с`,
//! degrees, the clock, signs, relational signs, fractions, ranges and dot decimals; plus the initialism pass.
//! Ported from src/languages/belarusian/normalize.ts — see that file for the corpus evidence and the ordering.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::belarusian::DEF;
use crate::core::boundaries::NOT_LETTER_BEFORE;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{alternation, slavic_count_form, sorted_by_length_desc};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;
use crate::languages::ukrainian::numbers::east_slavic_number_words;

/// `cardinal(n)`: the East-Slavic composer's words, a gap as "", joined and trimmed.
fn cardinal(n: f64) -> JsString {
    let words: Vec<String> = east_slavic_number_words(n as u64, &DEF.numbers.east)
        .into_iter()
        .map(|w| w.unwrap_or_default())
        .collect();
    js(&words.join(" ")).trim()
}

/// `counted(n, forms)`: `forms[Math.min(slavicCountForm(n), 2)]`.
fn counted(n: f64, forms: &[&'static str; 3]) -> &'static str {
    forms[(slavic_count_form(n) as usize).min(2)]
}

const ORD_1_19: [&str; 20] = [
    "",
    "першы",
    "другі",
    "трэці",
    "чацвёрты",
    "пяты",
    "шосты",
    "сёмы",
    "восьмы",
    "дзявяты",
    "дзясяты",
    "адзінаццаты",
    "дванаццаты",
    "трынаццаты",
    "чатырнаццаты",
    "пятнаццаты",
    "шаснаццаты",
    "сямнаццаты",
    "васямнаццаты",
    "дзевятнаццаты",
];
const ORD_TENS: [&str; 10] = [
    "",
    "дзясяты",
    "дваццаты",
    "трыццаты",
    "саракавы",
    "пяцідзясяты",
    "шасцідзясяты",
    "сямідзясяты",
    "васьмідзясяты",
    "дзевяносты",
];
const ORD_HUNDREDS: [&str; 10] = [
    "",
    "соты",
    "двухсоты",
    "трохсоты",
    "чатырохсоты",
    "пяцісоты",
    "шасцісоты",
    "сямісоты",
    "васьмісоты",
    "дзевяцісоты",
];
const ORD_THOUSANDS: [&str; 10] = [
    "",
    "тысячны",
    "двухтысячны",
    "трохтысячны",
    "чатырохтысячны",
    "пяцітысячны",
    "шасцітысячны",
    "сямітысячны",
    "васьмітысячны",
    "дзевяцітысячны",
];

/// `ordinalBase(n)`: the masculine-nominative ordinal (cardinal head + the ordinal of the last part), or
/// `None` (below 1, a non-integer, a round ten-thousand, 10⁶ and above).
fn ordinal_base(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || n < 1.0 {
        return None;
    }
    if n < 20.0 {
        return Some(js(ORD_1_19[n as usize]));
    }
    if n < 100.0 {
        let (t, u) = ((n / 10.0).floor() as usize, (n % 10.0) as usize);
        if u == 0 {
            return Some(js(ORD_TENS[t]));
        }
        let tens = DEF.numbers.east.base.tens[&(t * 10).to_string()].clone();
        return Some(js(&format!("{tens} {}", ORD_1_19[u])));
    }
    if n < 1000.0 {
        let r = n % 100.0;
        if r == 0.0 {
            return Some(js(ORD_HUNDREDS[(n / 100.0) as usize]));
        }
        return Some(
            cardinal(n - r)
                .concat(&js(" "))
                .concat(&ordinal_base(r).unwrap()),
        );
    }
    if n < 10_000.0 && n % 1000.0 == 0.0 {
        return Some(js(ORD_THOUSANDS[(n / 1000.0) as usize]));
    }
    if n < 1_000_000.0 {
        let r = n % 1000.0;
        if r == 0.0 {
            return None;
        }
        return Some(
            cardinal(n - r)
                .concat(&js(" "))
                .concat(&ordinal_base(r).unwrap()),
        );
    }
    None
}

const END_HARD: [&str; 10] = ["ы", "ага", "аму", "ым", "ае", "ыя", "ых", "ая", "ай", "ымі"];
const END_VELAR: [&str; 10] = ["і", "ога", "ому", "ім", "ое", "ія", "іх", "ая", "ой", "імі"];
const END_SOFT: [&str; 10] = ["і", "яга", "яму", "ім", "яе", "ія", "іх", "яя", "яй", "імі"];
const END_STRESSED: [&str; 10] = ["ы", "ога", "ому", "ым", "ое", "ыя", "ых", "ая", "ой", "ымі"];

/// `ordinalForms(n)`: every case form of the ordinal, in preference order; only the final word inflects.
fn ordinal_forms(n: f64) -> Vec<JsString> {
    let Some(base) = ordinal_base(n) else {
        return Vec::new();
    };
    let words = base.split(&js(" "));
    let last = words.last().unwrap();
    let stem = last.slice(0, Some(-1));
    let endings = if *last == js("саракавы") {
        &END_STRESSED
    } else if js_re!("[гкх]і$", "u").test(last) {
        &END_VELAR
    } else if last.ends_with(&js("і")) {
        &END_SOFT
    } else {
        &END_HARD
    };
    let head = JsString::join(&words[..words.len() - 1], &js(" "));
    endings
        .iter()
        .map(|e| {
            let mut f = JsString::new();
            if !head.is_empty() {
                f.push_str(&head);
                f.push_str(&js(" "));
            }
            f.concat(&stem).concat(&js(e))
        })
        .collect()
}

const GEN_1_19: [&str; 20] = [
    "",
    "аднаго",
    "двух",
    "трох",
    "чатырох",
    "пяці",
    "шасці",
    "сямі",
    "васьмі",
    "дзевяці",
    "дзесяці",
    "адзінаццаці",
    "дванаццаці",
    "трынаццаці",
    "чатырнаццаці",
    "пятнаццаці",
    "шаснаццаці",
    "сямнаццаці",
    "васямнаццаці",
    "дзевятнаццаці",
];
const GEN_TENS: [&str; 10] = [
    "",
    "дзесяці",
    "дваццаці",
    "трыццаці",
    "сарака",
    "пяцідзесяці",
    "шасцідзесяці",
    "сямідзесяці",
    "васьмідзесяці",
    "дзевяноста",
];

/// `genitiveCardinal(n)`, 1 … 99.
fn genitive_cardinal(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || !(1.0..100.0).contains(&n) {
        return None;
    }
    let n = n as usize;
    if n < 20 {
        return Some(js(GEN_1_19[n]));
    }
    let (t, u) = (n / 10, n % 10);
    Some(js(&if u == 0 {
        GEN_TENS[t].to_string()
    } else {
        format!("{} {}", GEN_TENS[t], GEN_1_19[u])
    }))
}

/// `LETTER_NAME`, in the TS object's key order.
const LETTER_NAMES: [(&str, &str); 33] = [
    ("а", "а"),
    ("б", "бэ"),
    ("в", "вэ"),
    ("г", "гэ"),
    ("ґ", "гэ"),
    ("д", "дэ"),
    ("е", "е"),
    ("ё", "ё"),
    ("ж", "жэ"),
    ("з", "зэ"),
    ("і", "і"),
    ("й", "і кароткае"),
    ("к", "ка"),
    ("л", "эль"),
    ("м", "эм"),
    ("н", "эн"),
    ("о", "о"),
    ("п", "пэ"),
    ("р", "эр"),
    ("с", "эс"),
    ("т", "тэ"),
    ("у", "у"),
    ("ў", "у нескладовае"),
    ("ф", "эф"),
    ("х", "ха"),
    ("ц", "цэ"),
    ("ч", "чэ"),
    ("ш", "ша"),
    ("ы", "ы"),
    ("ь", "мяккі знак"),
    ("э", "э"),
    ("ю", "ю"),
    ("я", "я"),
];

const LEGAL_ONSETS: [&str; 44] = [
    "бл", "бр", "вл", "вр", "гл", "гр", "гн", "дв", "др", "дн", "дз", "дж", "жд", "зв", "зд", "зл",
    "зм", "зн", "зр", "кл", "кн", "кр", "кв", "мн", "пл", "пр", "сл", "см", "сн", "сп", "ст", "св",
    "тр", "тв", "фл", "фр", "хл", "хр", "цв", "шк", "шл", "шп", "шт", "шч",
];
const LEGAL_CODAS: [&str; 34] = [
    "ст", "нт", "нд", "нс", "рт", "рд", "рс", "рн", "рм", "лт", "лд", "лс", "кт", "кс", "пт", "фт",
    "зд", "зн", "сн", "см", "нк", "нг", "лм", "лк", "рк", "рг", "рх", "нь", "сь", "ць", "ў", "йк",
    "ск", "шч",
];

type Predicate = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

/// `isUnreadableBelarusian`: the phonotactic test for core/initialisms.ts.
static IS_UNREADABLE: LazyLock<Predicate> = LazyLock::new(|| {
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new("[аеёіоуыэюя]", "u").unwrap(),
        legal_onsets: LEGAL_ONSETS.iter().map(|o| js(o)).collect(),
        legal_codas: LEGAL_CODAS.iter().map(|c| js(c)).collect(),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableBelarusian(word)`.
pub(crate) fn is_unreadable_belarusian(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

const ACRONYM_LETTERS: [&str; 11] = [
    "вуп", "ааэ", "аан", "снд", "пар", "бнр", "уп", "сп", "ес", "зша", "ссср",
];
static ACRONYMS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| ACRONYM_LETTERS.iter().map(|a| js(a)).collect());

/// `(l) => LETTER_NAME[l]`: `l` is one lowercased code point, never an `Object.prototype` member's name.
static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| {
    Arc::new(|l: &JsString| {
        LETTER_NAMES
            .iter()
            .find(|(k, _)| js(k) == *l)
            .map(|(_, v)| js(v))
    })
});

/// `normalizeBelarusianInitialisms(text)`: nothing counts as recorded.
pub(crate) fn normalize_belarusian_initialisms(text: &JsString) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: LETTER_NAME.clone(),
            lower: None,
            acronym_letters: Arc::new(|w: &JsString| ACRONYMS.contains(w)),
            is_recorded: |_: &JsString| false,
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(text)
}

const METRE: [&str; 3] = ["метр", "метры", "метраў"];
const DEGREE: [&str; 3] = ["градус", "градусы", "градусаў"];

/// `MAGNITUDE_ABBREV`, in order.
const MAGNITUDE_ABBREV: [(&str, [&str; 4]); 4] = [
    ("млрд", ["мільярд", "мільярды", "мільярдаў", "мільярда"]),
    ("трлн", ["трыльён", "трыльёны", "трыльёнаў", "трыльёна"]),
    ("млн", ["мільён", "мільёны", "мільёнаў", "мільёна"]),
    ("тыс", ["тысяча", "тысячы", "тысяч", "тысячы"]),
];

/// `magnitudeForm(written, forms)`: a decimal takes the genitive singular (the fourth form).
fn magnitude_form(written: &JsString, forms: &[&'static str; 4]) -> &'static str {
    if js_re!("[.,]", "u").test(written) {
        return forms[3];
    }
    forms[(slavic_count_form(js_number(written)) as usize).min(2)]
}

/// `DOTTED_ABBREV`, in the TS object's key order.
const DOTTED_ABBREV: [(&str, &str); 11] = [
    ("гг", "гадоў"),
    ("ст", "стагоддзя"),
    ("стст", "стагоддзяў"),
    ("нар", "нарадзіўся"),
    ("пам", "памёр"),
    ("інш", "іншае"),
    ("тыс", "тысяч"),
    ("напр", "напрыклад"),
    ("гл", "глядзі"),
    ("вул", "вуліца"),
    ("дол", "долараў"),
];

/// `DOTTED_ABBREV[key]`. ⚠ THE MISS IS REACHABLE (#1122): the `iu` alternation matches a Cyrillic Extended-C
/// letter whose fold is one of the keys' letters (`ᲃт.` for `ст.`); the match then stays as written (#1535).
fn dotted(key: &JsString) -> Option<&'static str> {
    DOTTED_ABBREV
        .iter()
        .find(|(k, _)| js(k) == *key)
        .map(|(_, v)| *v)
}

/// `CLOSING_ABBREV`: the keys that close a list, so a capital after their dot is a new sentence (#1535).
const CLOSING_ABBREV: [&str; 1] = ["інш"];

static ABBREV_ALT: LazyLock<String> = LazyLock::new(|| {
    alternation(&sorted_by_length_desc(
        DOTTED_ABBREV.iter().map(|(k, _)| js(k)),
    ))
});

/// `NOT_LETTER`, verbatim.
const NOT_LETTER: &str = r"(?![\p{L}\p{M}'’ʼ])";

/// The multi-dot abbreviations; the flag marks the one that closes a list (#1535).
static MULTI: LazyLock<[(JsRegex, &str, bool); 4]> = LazyLock::new(|| {
    let re = |p: &str| JsRegex::new(&format!("{NOT_LETTER_BEFORE}{p}"), "giu").unwrap();
    [
        (re(r"да\s+н\.\s?э\."), "да нашай эры", false),
        (re(r"н\.\s?э\."), "нашай эры", false),
        (re(r"і\s+г\.\s?д\."), "і гэтак далей", true),
        (re(r"т\.\s?зв\."), "так званы", false),
    ]
});

static YEAR_G: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"(\d)\s?г\.{NOT_LETTER}"), "gu").unwrap());
static YEAR_GG: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"(\d)\s?гг\.{NOT_LETTER}"), "gu").unwrap());
static MAGNITUDE_RES: LazyLock<Vec<JsRegex>> = LazyLock::new(|| {
    MAGNITUDE_ABBREV
        .iter()
        .map(|(abbr, _)| {
            JsRegex::new(&format!(r"(\d+(?:[.,]\d+)?)\s?{abbr}\.?{NOT_LETTER}"), "gu").unwrap()
        })
        .collect()
});
static ABBREV_CONTINUES: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"{NOT_LETTER_BEFORE}({})\.(\s+)(?=([\p{{L}}\d(]))",
            *ABBREV_ALT
        ),
        "giu",
    )
    .unwrap()
});
static ABBREV_BEFORE_MARK: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"{NOT_LETTER_BEFORE}({})\.(?=\s*[,;:])", *ABBREV_ALT),
        "giu",
    )
    .unwrap()
});
static ABBREV_ENDS: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"{NOT_LETTER_BEFORE}({})\.(?=\s*(?:[.!?»)]|$))",
            *ABBREV_ALT
        ),
        "giu",
    )
    .unwrap()
});
static SUFFIX_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<![\d.,])(\d+)\s?-\s?([а-яёіў]{{1,3}}){NOT_LETTER}"),
        "giu",
    )
    .unwrap()
});
static METRE_RE: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"(\d+(?:[.,]\d+)?)\s?м(?![\p{L}\p{M}'’ʼ²³/])", "gu").unwrap());

/// `Math.trunc(Number(n.replace(",", ".")))`.
fn trunc_decimal(n: &JsString) -> f64 {
    js_number(&js_re!(",", "").replace(n, &js("."))).trunc()
}

/// `normalizeBelarusian(input)`.
pub(crate) fn normalize_belarusian(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 0) digit de-grouping (twice: the groups overlap on the shared digit), then the separators to a space.
    for _ in 0..2 {
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)[    ](?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
    }
    s = rewrite(&s, js_re!(r"[    ]", "gu"), &js(" "));

    // 1) multi-dot abbreviations; the final dot kept at the utterance end, and before a capital after the one
    //    that closes a list (#1535).
    for (re, word, closes) in MULTI.iter() {
        s = rewrite_with(&s, re, |m, full| {
            let rest = full.slice(m.end() as isize, None);
            let w = js(word);
            if js_re!(r#"^\s*["»)']?\s*$"#, "u").test(&rest) {
                return w.concat(&js("."));
            }
            if *closes && js_re!(r"^\s+\p{Lu}", "u").test(&rest) {
                w.concat(&js("."))
            } else {
                w
            }
        });
    }

    // 2) №.
    s = rewrite(&s, js_re!(r"№\s?(?=\d)", "gu"), &js("нумар "));

    // 3) the rate first, then the digit-anchored year abbreviations.
    s = rewrite(
        &s,
        js_re!(
            r"(\d)\s?(?:км\s?\/\s?(?:гадз|год|г)|км\/ч)(?![\p{L}\p{M}])",
            "giu"
        ),
        &js("$1 кіламетраў на гадзіну"),
    );
    s = rewrite(&s, &YEAR_G, &js("$1 года"));
    s = rewrite(&s, &YEAR_GG, &js("$1 гадоў"));

    // 3b) the magnitude abbreviations, with the count agreement the numeral governs.
    for ((_, forms), re) in MAGNITUDE_ABBREV.iter().zip(MAGNITUDE_RES.iter()) {
        s = rewrite_with(&s, re, |m, t| {
            let n = m.group(1, t).unwrap();
            n.concat(&js(" ")).concat(&js(magnitude_form(&n, forms)))
        });
    }

    // 4) dotted abbreviations: before a word, before a mark, at a sentence end.
    //    A miss stays as written in all three (#1122, #1535); a closing abbreviation before a capital keeps its dot.
    s = rewrite_with(&s, &ABBREV_CONTINUES, |m, t| {
        let key = m.group(1, t).unwrap().to_lower_case();
        let Some(w) = dotted(&key) else {
            return m.value(t);
        };
        let sp = m.group(2, t).unwrap();
        if CLOSING_ABBREV.iter().any(|k| js(k) == key)
            && js_re!(r"\p{Lu}", "u").test(&m.group(3, t).unwrap())
        {
            js(w).concat(&js(".")).concat(&sp)
        } else {
            js(w).concat(&sp)
        }
    });
    s = rewrite_with(&s, &ABBREV_BEFORE_MARK, |m, t| {
        dotted(&m.group(1, t).unwrap().to_lower_case()).map_or_else(|| m.value(t), js)
    });
    s = rewrite_with(&s, &ABBREV_ENDS, |m, t| {
        match dotted(&m.group(1, t).unwrap().to_lower_case()) {
            Some(w) => js(w).concat(&js(".")),
            None => m.value(t),
        }
    });

    // 5) numeral + written suffix: the form (ordinal, else oblique cardinal) that ends with the typed letters.
    s = rewrite_with(&s, &SUFFIX_RE, |m, t| {
        let whole = m.value(t);
        let n = js_number(&m.group(1, t).unwrap());
        let suffix = m.group(2, t).unwrap().to_lower_case();
        let cardinal_first = suffix == js("мі") || suffix == js("ці");
        let genitive = genitive_cardinal(n).filter(|g| g.ends_with(&suffix));
        if cardinal_first {
            return genitive.unwrap_or(whole);
        }
        if let Some(form) = ordinal_forms(n).into_iter().find(|f| f.ends_with(&suffix)) {
            return form;
        }
        genitive.unwrap_or(whole)
    });

    // 6) `м/с` and the guarded bare `м`.
    s = rewrite_with(
        &s,
        js_re!(r"(\d+(?:[.,]\d+)?)\s?м\/с(?![\p{L}\p{M}])", "gu"),
        |m, t| {
            let n = m.group(1, t).unwrap();
            n.concat(&js(" "))
                .concat(&js(counted(trunc_decimal(&n), &METRE)))
                .concat(&js(" на секунду"))
        },
    );
    s = rewrite_with(&s, &METRE_RE, |m, t| {
        let n = m.group(1, t).unwrap();
        n.concat(&js(" "))
            .concat(&js(counted(trunc_decimal(&n), &METRE)))
    });

    // 7) degrees (the letter Cyrillic or Latin).
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?[CС](?![\p{L}\p{M}])", "gui"),
        &js("$1 градусаў Цэльсія"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?[FФ](?![\p{L}\p{M}])", "gui"),
        &js("$1 градусаў Фарэнгейта"),
    );
    s = rewrite_with(&s, js_re!(r"(\d+)\s?°", "gu"), |m, t| {
        let n = m.group(1, t).unwrap();
        n.concat(&js(" "))
            .concat(&js(counted(js_number(&n), &DEGREE)))
    });

    // 8) the clock: a timestamp's colons become spaces; HH:MM reads cardinally, `:00` dropped.
    s = rewrite(
        &s,
        js_re!(r"(?<![\d:])(\d{1,2}):([0-5]\d):([0-5]\d)(?![:\d])", "gu"),
        &js("$1 $2 $3"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.,])", "gu"),
        |m, t| {
            let hv = js_number(&m.group(1, t).unwrap());
            let mv = js_number(&m.group(2, t).unwrap());
            let head = cardinal(hv);
            if head.is_empty() {
                return m.value(t);
            }
            if mv == 0.0 {
                head
            } else {
                head.concat(&js(" ")).concat(&cardinal(mv))
            }
        },
    );

    // 9) signs.
    s = rewrite(&s, js_re!(r"(^|[\s(])[-−–](\d)", "gu"), &js("$1мінус $2"));
    s = rewrite(&s, js_re!("±", "gu"), &js(" плюс-мінус "));
    s = rewrite(&s, js_re!(r"(^|[\s(])\+\s?(\d)", "gu"), &js("$1плюс $2"));

    // 10) relational and division signs (`=` needs a digit on one side).
    s = rewrite(&s, js_re!(r"(\d)\s?=\s?", "gu"), &js("$1 ёсць "));
    s = rewrite(&s, js_re!(r"\s?=\s?(?=\d)", "gu"), &js(" ёсць "));
    s = rewrite(&s, js_re!(r"(\d)\s?<\s?(?=\d)", "gu"), &js("$1 менш за "));
    s = rewrite(&s, js_re!(r"(\d)\s?>\s?(?=\d)", "gu"), &js("$1 больш за "));
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?÷\s?(?=\d)", "gu"),
        &js("$1 падзяліць на "),
    );

    // 11) fractions with a denominator 2–10, the ordinal agreeing with the numerator.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d\p{L}/.,])(\d{1,2})\/(\d{1,2})(?![\d/\p{L}]|[.,]\d)",
            "gu"
        ),
        |m: &JsMatch, t| {
            let num = js_number(&m.group(1, t).unwrap());
            let den = js_number(&m.group(2, t).unwrap());
            if !(2.0..=10.0).contains(&den) || num < 1.0 || num >= den {
                return m.value(t);
            }
            let slot = [7, 5, 6][(slavic_count_form(num) as usize).min(2)];
            let Some(den_word) = ordinal_forms(den).into_iter().nth(slot) else {
                return m.value(t);
            };
            let a = js_re!("адзін$", "u").replace(&cardinal(num), &js("адна"));
            let num_word = js_re!("два$", "u").replace(&a, &js("дзве"));
            num_word.concat(&js(" ")).concat(&den_word)
        },
    );

    // 12) numeric ranges.
    s = rewrite(&s, js_re!(r"(\d)\s?[–—-]\s?(?=\d)", "gu"), &js("$1 да "));

    // 13) dot decimals → the comma form.
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d{1,2})(?![\d.\p{L}])", "gu"),
        &js("$1,$2"),
    );

    rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" "))
}
