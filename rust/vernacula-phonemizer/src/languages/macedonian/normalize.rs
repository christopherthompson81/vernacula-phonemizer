//! Macedonian (mk) text normalization: period and space de-grouping, era markers, the year abbreviation,
//! dotted/hyphenated abbreviations, version dots, ranges, the clock, am/pm, the ordinal suffix (gender and
//! definiteness), century, dates, regnal ordinals, rates, degrees, signs, pH/Ghz, fractions and lone letters;
//! plus the initialism pass.
//! Ported from src/languages/macedonian/normalize.ts — see that file for the corpus evidence and the ordering.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::macedonian::DEF;
use super::numbers::{mk_ordinal, number_to_text};
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `GROUP_SPACE`: the TS string holds the characters themselves (a plain string literal, not a regex source).
const GROUP_SPACE: &str = " \u{a0}\u{202f}\u{2009}";

/// `MONTHS`, in its Set's insertion order.
const MONTHS: [&str; 12] = [
    "јануари",
    "февруари",
    "март",
    "април",
    "мај",
    "јуни",
    "јули",
    "август",
    "септември",
    "октомври",
    "ноември",
    "декември",
];

/// `LETTER_NAME`, in the TS object's key order.
const LETTER_NAMES: [(&str, &str); 57] = [
    ("а", "а"),
    ("б", "бе"),
    ("в", "ве"),
    ("г", "ге"),
    ("д", "де"),
    ("ѓ", "ѓе"),
    ("е", "е"),
    ("ж", "же"),
    ("з", "зе"),
    ("ѕ", "ѕе"),
    ("и", "и"),
    ("ј", "је"),
    ("к", "ка"),
    ("л", "ел"),
    ("љ", "ље"),
    ("м", "ем"),
    ("н", "ен"),
    ("њ", "ње"),
    ("о", "о"),
    ("п", "пе"),
    ("р", "ер"),
    ("с", "ес"),
    ("т", "те"),
    ("ќ", "ќе"),
    ("у", "у"),
    ("ф", "еф"),
    ("х", "ха"),
    ("ц", "це"),
    ("ч", "че"),
    ("џ", "џе"),
    ("ш", "ша"),
    ("a", "а"),
    ("b", "бе"),
    ("c", "це"),
    ("d", "де"),
    ("e", "е"),
    ("f", "еф"),
    ("g", "ге"),
    ("h", "ха"),
    ("i", "и"),
    ("j", "је"),
    ("k", "ка"),
    ("l", "ел"),
    ("m", "ем"),
    ("n", "ен"),
    ("o", "о"),
    ("p", "пе"),
    ("q", "ку"),
    ("r", "ер"),
    ("s", "ес"),
    ("t", "те"),
    ("u", "у"),
    ("v", "ве"),
    ("w", "даблве"),
    ("x", "икс"),
    ("y", "ипсилон"),
    ("z", "зет"),
];

/// `LETTER_NAME[l]`.
fn letter_name(l: &JsString) -> Option<JsString> {
    LETTER_NAMES
        .iter()
        .find(|(k, _)| js(k) == *l)
        .map(|(_, v)| js(v))
}

const LEGAL_ONSETS: [&str; 97] = [
    "бл", "бр", "вл", "вр", "гл", "гр", "дв", "др", "жв", "жд", "зб", "зг", "зд", "зл", "зм", "зн",
    "зр", "кл", "кн", "кр", "мн", "мр", "пл", "пр", "пс", "пт", "ск", "сл", "см", "сн", "сп", "ст",
    "св", "тв", "тр", "фл", "фр", "хл", "хм", "хр", "цв", "цр", "шк", "шл", "шм", "шн", "шп", "шт",
    "шв", "bl", "br", "vl", "vr", "gl", "gr", "dv", "dr", "zd", "zl", "zm", "zn", "zr", "kl", "kn",
    "kr", "mn", "mr", "pl", "pr", "ps", "pt", "sk", "sl", "sm", "sn", "sp", "st", "sv", "tv", "tr",
    "fl", "fr", "xl", "xm", "xr", "ts", "tʃ", "ʃk", "ʃl", "ʃm", "ʃn", "ʃp", "ʃt", "ʃv", "st",
    "spr", "str",
];
const LEGAL_CODAS: [&str; 61] = [
    "ст", "ск", "зд", "зн", "зл", "зм", "шт", "жв", "жб", "рт", "рк", "рд", "рс", "рн", "рл", "рм",
    "рв", "лт", "лд", "лс", "лм", "нт", "нд", "нк", "нг", "мп", "цк", "цт", "чк", "чм", "пс", "st",
    "sk", "zd", "zn", "zl", "zm", "ʃt", "rt", "rk", "rd", "rs", "rn", "rl", "rm", "rv", "lt", "ld",
    "ls", "lm", "nt", "nd", "nk", "ng", "mp", "ts", "tʃ", "ps", "ks", "ŋ", "ndʒ",
];

type Predicate = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

/// `isUnreadableMacedonian`: the phonotactic test for core/initialisms.ts.
static IS_UNREADABLE: LazyLock<Predicate> = LazyLock::new(|| {
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new("[аеиоуaeiou]", "u").unwrap(),
        legal_onsets: LEGAL_ONSETS.iter().map(|o| js(o)).collect(),
        legal_codas: LEGAL_CODAS.iter().map(|c| js(c)).collect(),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableMacedonian(word)`.
pub(crate) fn is_unreadable_macedonian(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| DEF.acronym_letters.iter().map(|w| js(w)).collect());

/// `(l) => LETTER_NAME[l]`: `l` is one lowercased code point, never an `Object.prototype` member's name.
static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| Arc::new(letter_name));

/// `normalizeMacedonianInitialisms(text)`: nothing counts as recorded.
pub(crate) fn normalize_macedonian_initialisms(text: &JsString) -> JsString {
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

/// `mascDef(base)`: -от on the last word.
fn masc_def(base: &JsString) -> JsString {
    js_re!(r"(\S+)$", "u").replace(base, &js("$1от"))
}

/// `femIndef(base)`: the last word's -и → -а.
fn fem_indef(base: &JsString) -> JsString {
    js_re!(r"(\S+)и$", "u").replace(base, &js("$1а"))
}

/// `femDef(base)`: `femIndef`, then -та on the last word.
fn fem_def(base: &JsString) -> JsString {
    js_re!(r"(\S+)$", "u").replace(&fem_indef(base), &js("$1та"))
}

/// `pluralDef(words)`: -те on the last word.
fn plural_def(words: &JsString) -> JsString {
    js_re!(r"(\S+)$", "u").replace(words, &js("$1те"))
}

#[derive(PartialEq)]
enum SuffixKind {
    MascIndef,
    MascDef,
    FemIndef,
    FemDef,
    Count,
    Decade,
    Approx,
}

/// `suffixKind(suffix)`.
fn suffix_kind(suffix: &str) -> SuffixKind {
    match suffix {
        "тиот" | "миот" | "виот" | "риот" | "от" => SuffixKind::MascDef,
        "ма" => SuffixKind::FemIndef,
        "та" => SuffixKind::FemDef,
        "тите" | "ите" => SuffixKind::Decade,
        "тина" => SuffixKind::Approx,
        "те" => SuffixKind::Count,
        _ => SuffixKind::MascIndef,
    }
}

static PERIOD_GROUP: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"(?<=\d)(?<!(?<![\d\.,])0)\.(?=\d{3}(?!\d))", "gu").unwrap());
static SPACE_GROUP: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<=\d)(?<!(?<![\d\.,])0)[{GROUP_SPACE}](?=\d{{3}}(?!\d))"),
        "gu",
    )
    .unwrap()
});
static SUFFIX_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        r"(?<![\p{L}\p{M}\d])(\d+)\s*-?\s*(тите|тиот|миот|виот|риот|тина|ите|от|ти|ви|ми|ри|та|ма|те)(?!\p{L})",
        "gu",
    )
    .unwrap()
});
static MONTH_ALT: LazyLock<String> = LazyLock::new(|| MONTHS.join("|"));
static DATE_RANGE: LazyLock<JsRegex> = LazyLock::new(|| {
    let m = &*MONTH_ALT;
    JsRegex::new(
        &format!(r"(\d{{1,2}})\s+({m})\s*[-–—]\s*(\d{{1,2}})\s+({m})(?![\p{{L}}\p{{M}}])"),
        "giu",
    )
    .unwrap()
});
static DATE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(\d{{1,2}})(?:\.)?\s+({})(?![\p{{L}}\p{{M}}])", *MONTH_ALT),
        "giu",
    )
    .unwrap()
});

/// `numberToText(n)` as a `JsString`.
fn text_of(n: f64) -> JsString {
    js(&number_to_text(n, None))
}

/// `mkOrdinal(n)` as a `JsString`.
fn ordinal_of(n: f64) -> Option<JsString> {
    mk_ordinal(n).map(|o| js(&o))
}

/// `normalizeMacedonian(input)`.
pub(crate) fn normalize_macedonian(input: &JsString) -> JsString {
    let mut s = input.clone();
    let year = |m: &crate::core::js_regex::JsMatch, t: &JsString| {
        let n = m.group(1, t).unwrap();
        let w = if js_number(&n) >= 100.0 {
            " година"
        } else {
            " години"
        };
        n.concat(&js(w))
    };

    // 0) de-grouping: period then space separators (twice each: the groups overlap on the shared digit).
    for _ in 0..2 {
        s = rewrite(&s, &PERIOD_GROUP, &JsString::new());
    }
    for _ in 0..2 {
        s = rewrite(&s, &SPACE_GROUP, &JsString::new());
    }

    // 1) era markers.
    s = rewrite(
        &s,
        js_re!(r"пр\.\s*н\.\s*е\.", "giu"),
        &js("пред нашата ера"),
    );
    s = rewrite(
        &s,
        js_re!(r"п\.\s*н\.\s*е\.", "giu"),
        &js("пред нашата ера"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])н\.\s*е\.", "giu"),
        &js("од нашата ера"),
    );

    // 2) the year abbreviation.
    s = rewrite_with(&s, js_re!(r"(\d+)\s*год\.", "gu"), year);
    s = rewrite_with(&s, js_re!(r"(\d+)\s*г\.", "gu"), year);

    // 3) abbreviations.
    s = rewrite(
        &s,
        js_re!(r#"(?<![\p{L}\p{M}])итн\.(?=\s|$|[,.;:!?»"')])"#, "giu"),
        &js("и така натаму"),
    );
    s = rewrite(&s, js_re!(r"(?<![\p{L}\p{M}])т\.е\.", "giu"), &js("то ест"));
    s = rewrite(
        &s,
        js_re!(r"[Гг]-дин(?![\p{L}\p{M}])", "gu"),
        &js("господин"),
    );
    s = rewrite(&s, js_re!(r"[Дд]-р(?![\p{L}\p{M}])", "gu"), &js("доктор"));

    // 4) version / figure dots.
    s = rewrite(&s, js_re!(r"(\d)\.(\d+)(?!\d)", "gu"), &js("$1 точка $2"));

    // 5) ranges (a single digit before a multi-digit one is a designation).
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s*[-–—]\s*(\d+)(?!\d)", "gu"),
        |m, t| {
            let (a, b) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
            if a.len() == 1 && b.len() > 1 {
                return m.value(t);
            }
            a.concat(&js(" до ")).concat(&b)
        },
    );

    // 6) the clock, cardinal with и; a consumed `ч` becomes часот.
    s = rewrite_with(
        &s,
        js_re!(
            r"([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?!,\d)(\s*ч(?!\p{L})\.?)?",
            "gu"
        ),
        |m, t| {
            let hv = js_number(&m.group(1, t).unwrap());
            let mv = js_number(&m.group(2, t).unwrap());
            let body = if mv == 0.0 {
                text_of(hv)
            } else {
                text_of(hv).concat(&js(" и ")).concat(&text_of(mv))
            };
            if m.group(3, t).is_some() {
                body.concat(&js(" часот"))
            } else {
                body
            }
        },
    );
    s = rewrite(&s, js_re!(r"\bam\b", "giu"), &js("претпладне"));
    s = rewrite(&s, js_re!(r"\bpm\b", "giu"), &js("попладне"));

    // 7) the ordinal suffix.
    s = rewrite_with(&s, &SUFFIX_RE, |m, t| {
        let m0 = m.value(t);
        let n = js_number(&m.group(1, t).unwrap());
        let Some(base) = ordinal_of(n) else {
            return m0;
        };
        match suffix_kind(&m.group(2, t).unwrap().to_string_lossy()) {
            SuffixKind::Decade => plural_def(&base),
            SuffixKind::Approx => {
                if n % 10.0 != 0.0 {
                    m0
                } else {
                    text_of(n).concat(&js("ина"))
                }
            }
            SuffixKind::Count => {
                let rest = t.slice(m.end() as isize, None);
                if n >= 1000.0 && js_re!(r"^\s*години", "u").test(&rest) {
                    plural_def(&base)
                } else {
                    plural_def(&text_of(n))
                }
            }
            SuffixKind::MascDef => masc_def(&base),
            SuffixKind::FemIndef => fem_indef(&base),
            SuffixKind::FemDef => {
                if n % 1000.0 == 0.0 {
                    fem_indef(&base)
                } else {
                    fem_def(&base)
                }
            }
            SuffixKind::MascIndef => base,
        }
    });

    // 8) century.
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s+и\s+(\d+)\s*век(?![\p{L}\p{M}])", "gu"),
        |m, t| {
            let oa = ordinal_of(js_number(&m.group(1, t).unwrap()));
            let ob = ordinal_of(js_number(&m.group(2, t).unwrap()));
            match (oa, ob) {
                (Some(a), Some(b)) => a.concat(&js(" и ")).concat(&b).concat(&js(" век")),
                _ => m.value(t),
            }
        },
    );
    let century = |m: &crate::core::js_regex::JsMatch, t: &JsString| match ordinal_of(js_number(
        &m.group(1, t).unwrap(),
    )) {
        Some(o) => o.concat(&js(" век")),
        None => m.value(t),
    };
    s = rewrite_with(&s, js_re!(r"(\d+)\s*век(?![\p{L}\p{M}])", "gu"), century);
    s = rewrite_with(&s, js_re!(r"(\d+)\.\s*век(?![\p{L}\p{M}])", "gu"), century);

    // 9) dates: a range, then a single day.
    s = rewrite_with(&s, &DATE_RANGE, |m, t| {
        let oa = ordinal_of(js_number(&m.group(1, t).unwrap()));
        let ob = ordinal_of(js_number(&m.group(3, t).unwrap()));
        match (oa, ob) {
            (Some(a), Some(b)) => a
                .concat(&js(" "))
                .concat(&m.group(2, t).unwrap())
                .concat(&js(" до "))
                .concat(&b)
                .concat(&js(" "))
                .concat(&m.group(4, t).unwrap()),
            _ => m.value(t),
        }
    });
    s = rewrite_with(&s, &DATE, |m, t| {
        let dv = js_number(&m.group(1, t).unwrap());
        let o = if (1.0..=31.0).contains(&dv) {
            ordinal_of(dv)
        } else {
            None
        };
        match o {
            Some(o) => o.concat(&js(" ")).concat(&m.group(2, t).unwrap()),
            None => m.value(t),
        }
    });

    // 10) regnal ordinals after a capitalised name (2–39, before punctuation or the end).
    s = rewrite_with(
        &s,
        js_re!(
            r"(\p{Lu}\p{Ll}+\p{M}*)[  ](\d{1,2})(?![,\d])(?=\.?[.,;:!?]|$)",
            "gu"
        ),
        |m, t| {
            let name = m.group(1, t).unwrap();
            let n = js_number(&m.group(2, t).unwrap());
            match ordinal_of(n) {
                Some(o) if (2.0..=39.0).contains(&n) => {
                    let o = if name.ends_with(&js("а")) {
                        fem_indef(&o)
                    } else {
                        o
                    };
                    name.concat(&js(" ")).concat(&o)
                }
                _ => m.value(t),
            }
        },
    );

    // 11) rates and the Cyrillic squared units.
    s = rewrite(
        &s,
        js_re!(r"(\d+)\s*милји\s*\/\s*час(?![\p{L}\p{M}])", "giu"),
        &js("$1 милји на час"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+)\s*mph(?![\p{L}\p{M}])", "giu"),
        &js("$1 милји на час"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+)\s*kph(?![\p{L}\p{M}])", "giu"),
        &js("$1 километри на час"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+)\s*Mbit\/s(?![\p{L}\p{M}])", "giu"),
        &js("$1 мегабити на секунда"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+)\s*мм\s*[²2](?!\d)", "gu"),
        &js("$1 квадратни милиметри"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+)\s*км\s*[²2](?!\d)", "gu"),
        &js("$1 квадратни километри"),
    );

    // 12) degrees.
    s = rewrite(
        &s,
        js_re!(r"(\d+)\s*°\s*C(?![\p{L}\p{M}])", "gui"),
        &js("$1 степени по Целзиус"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+)\s*°\s*F(?![\p{L}\p{M}])", "gui"),
        &js("$1 степени по Фаренхајт"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+)\s*°\s*W(?![\p{L}\p{M}])", "gu"),
        &js("$1 степени запад"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+)\s*°\s*E(?![\p{L}\p{M}])", "gu"),
        &js("$1 степени исток"),
    );
    s = rewrite(&s, js_re!(r"(\d+)\s*°", "gu"), &js("$1 степени"));

    // 13) signs.
    s = rewrite(&s, js_re!(r"(^|[\s(])[-−]\s?(?=\d)", "gu"), &js("$1минус "));
    s = rewrite(&s, js_re!("±", "gu"), &js(" плус минус "));
    s = rewrite(&s, js_re!(r"(^|[\s(])\+\s?(?=\d)", "gu"), &js("$1плус "));
    s = rewrite(&s, js_re!(r"(\d)\s*×\s*(?=\d)", "gu"), &js("$1 пати "));
    s = rewrite(&s, js_re!(r"\s*÷\s*", "gu"), &js(" поделено со "));
    s = rewrite(&s, js_re!(r"\s*=\s*", "gu"), &js(" еднакво на "));
    s = rewrite(&s, js_re!(r"\s*<\s*", "gu"), &js(" помало од "));
    s = rewrite(&s, js_re!(r"\s*>\s*", "gu"), &js(" поголемо од "));
    s = rewrite(&s, js_re!(r"\s*[&＆]\s*", "gu"), &js(" и "));

    // 14) pH, Ghz.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])pH(?![\p{L}\p{M}])", "gu"),
        &js("пе ха"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])Ghz(?![\p{L}\p{M}])", "giu"),
        &js("гигахерци"),
    );

    // 14b) fractions: the vulgar three, then a unit fraction with a 2–6 denominator.
    s = rewrite(&s, js_re!(r"(\d+)¾", "gu"), &js("$1 и три четвртини"));
    s = rewrite(&s, js_re!(r"(\d+)½", "gu"), &js("$1 и половина"));
    s = rewrite(&s, js_re!(r"(\d+)¼", "gu"), &js("$1 и четвртина"));
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d{1,2})\/(\d{1,2})(?![\d.,])", "gu"),
        |m, t| {
            let denom = js_number(&m.group(2, t).unwrap());
            let suffix = match denom {
                2.0 => "половина",
                3.0 => "третина",
                4.0 => "четвртина",
                5.0 => "петтина",
                6.0 => "шестина",
                _ => return m.value(t),
            };
            if js_number(&m.group(1, t).unwrap()) != 1.0 {
                return m.value(t);
            }
            js("една ").concat(&js(suffix))
        },
    );

    // 15) a personal initial after a comma, and a lone Latin capital, by letter name.
    let by_name = |m: &crate::core::js_regex::JsMatch, t: &JsString| {
        let l = m.group(1, t).unwrap();
        letter_name(&l.to_lower_case()).unwrap_or(l)
    };
    s = rewrite_with(
        &s,
        js_re!(r"(?<=,\s)([А-ШЃЅЈЉЊЌЏ])\.(?=\s+[А-Ш]\p{Ll})", "gu"),
        by_name,
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])([A-Z])(?![\p{L}\p{M}])", "gu"),
        by_name,
    );

    s
}
