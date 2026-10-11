//! Lithuanian (lt) text normalization: the marked clock, the abbreviations (eras, coordinates, `tūkst.`),
//! de-grouping, ranges, signs, and every counted quantity (percent, degrees, units, currency, magnitudes, years,
//! days, centuries, hours) in the Baltic three-way concord, the decimal comma and the ampersand; plus the
//! separately-run initialism pass. Ported from src/languages/lithuanian/normalize.ts — see that file for the
//! corpus evidence and the ordering.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::manifest::{Agreement, MANIFEST};
use super::numbers::{agree, number_to_words};
use crate::core::boundaries::{NOT_LETTER_AFTER, NOT_LETTER_BEFORE};
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{Form, renormalize, rewrite, rewrite_with};
use crate::js_re;

const SP: &str = "[ \\u00a0\\u202f\\u2009]";
const NUM: &str = r"(?<![\d.,:])(\d+(?:,\d+)?)(?!\d|[.,]\d|:)";

fn w(key: &str) -> &'static str {
    &MANIFEST.normalization.words[key]
}

fn noun(key: &str) -> &'static Agreement {
    &MANIFEST.normalization.counted_nouns[key]
}

fn re(p: &str, flags: &str) -> JsRegex {
    JsRegex::new(p, flags).unwrap()
}

/// `split(",")` into the integer part and the optional fraction (the NUM token holds at most one comma).
fn split_num(raw: &JsString) -> (JsString, Option<JsString>) {
    let mut parts = raw.split(&js(",")).into_iter();
    let int = parts.next().unwrap_or_default();
    (int, parts.next())
}

/// `feminise(words)`: the last word, if a masculine unit, → its feminine form.
fn feminise(words: &JsString) -> JsString {
    let mut parts = words.split(&js(" "));
    let last = parts.last().cloned().unwrap_or_default();
    let units = &MANIFEST.numbers.units;
    let Some(i) = units.iter().position(|u| js(u) == last) else {
        return words.clone();
    };
    *parts.last_mut().unwrap() = js(&MANIFEST.numbers.units_fem[i]);
    JsString::join(&parts, &js(" "))
}

/// `bare(raw)`: the number's words, a fraction read digit by digit after the decimal-point word.
fn bare(raw: &JsString) -> JsString {
    let (int, frac) = split_num(raw);
    let n = js_number(&int);
    if !n.is_finite() {
        return raw.clone();
    }
    match frac {
        None => number_to_words(n, None),
        Some(f) => {
            let digits: Vec<JsString> =
                f.0.iter()
                    .map(|&u| number_to_words(js_number(&JsString::from_units(&[u])), None))
                    .collect();
            number_to_words(n, None)
                .concat(&js(&format!(" {} ", w("decimalPoint"))))
                .concat(&JsString::join(&digits, &js(" ")))
        }
    }
}

/// `quantity(raw, forms)`: the number's words (feminised for a feminine noun) and the agreeing noun.
fn quantity(raw: &JsString, forms: &Agreement) -> JsString {
    let (int, frac) = split_num(raw);
    let n = js_number(&int);
    if !n.is_finite() {
        return raw.clone();
    }
    let noun = if frac.is_none() {
        agree(n, forms)
    } else {
        &forms.gen_pl
    };
    let num = bare(raw);
    let num = if forms.fem == Some(true) {
        feminise(&num)
    } else {
        num
    };
    num.concat(&js(" ")).concat(&js(noun))
}

/// `MAGS`: the magnitude abbreviations and their nouns, in order.
fn mags() -> [(&'static JsRegex, &'static Agreement); 3] {
    let m = &MANIFEST.numbers.magnitudes;
    [
        (js_re!("mlrd", "u"), &m.billion),
        (js_re!("mln", "u"), &m.million),
        (js_re!("tūkst", "u"), &m.thousand),
    ]
}
const MAG_SOURCES: [&str; 3] = ["mlrd", "mln", "tūkst"];

/// `magWords(num, mag)`: " <the magnitude noun>" for an abbreviated magnitude, else "".
fn mag_words(num: &JsString, mag: Option<&JsString>) -> JsString {
    let Some(mag) = mag else {
        return JsString::new();
    };
    let Some((_, forms)) = mags().into_iter().find(|(r, _)| r.test(mag)) else {
        return JsString::new();
    };
    let noun = if num.includes(&js(",")) {
        &forms.gen_pl
    } else {
        agree(js_number(&split_num(num).0), forms)
    };
    js(&format!(" {noun}"))
}

/// `saidNear(text, forms)`: one of the forms appears as a whole word.
fn said_near(text: &JsString, forms: &[&str]) -> bool {
    forms
        .iter()
        .any(|f| re(&format!("{NOT_LETTER_BEFORE}{f}{NOT_LETTER_AFTER}"), "iu").test(text))
}

/// `nextWords(after, n)`: up to `n` words of `after`, with what precedes each.
fn next_words(after: &JsString, n: usize) -> JsString {
    re(
        &format!(r"^(?:[^\p{{L}}\p{{M}}]*[\p{{L}}\p{{M}}]+){{0,{n}}}"),
        "u",
    )
    .exec(after)
    .map_or_else(JsString::new, |m| m.value(after))
}

const DOLLAR_FORMS: [&str; 6] = [
    "doleris", "dolerio", "doleriai", "dolerių", "dolerius", "dolerį",
];
const EURO_FORMS: [&str; 6] = ["euras", "euro", "eurai", "eurų", "eurus", "eurą"];
const POUND_FORMS: [&str; 6] = ["svaras", "svaro", "svarai", "svarų", "svarus", "svarą"];
const LITAS_FORMS: [&str; 6] = ["litas", "lito", "litai", "litų", "litus", "litą"];

static ERA_HEAD: LazyLock<JsRegex> = LazyLock::new(|| {
    let heads: Vec<&str> = [w("eraBefore"), w("eraOur")]
        .iter()
        .map(|x| x.split(' ').next().unwrap())
        .collect();
    re(
        &format!("^{SP}*(?:{}){NOT_LETTER_AFTER}", heads.join("|")),
        "u",
    )
});

/// The fixed abbreviation arms (step 1), compiled once.
static ABBREVS: LazyLock<Vec<(JsRegex, JsString)>> = LazyLock::new(|| {
    let b = NOT_LETTER_BEFORE;
    [
        (
            format!(r"{b}p(?:r)?\.{SP}*m\.{SP}*e\."),
            format!(" {} ", w("eraBefore")),
        ),
        (format!(r"{b}m\.{SP}*e\."), format!(" {} ", w("eraOur"))),
        (format!(r"{b}t\.{SP}*y\."), format!(" {} ", w("thatIs"))),
        (format!(r"{b}p\.{SP}*pl\."), " pietų platumos ".to_string()),
        (
            format!(r"{b}š\.{SP}*pl\."),
            " šiaurės platumos ".to_string(),
        ),
        (format!(r"{b}v\.{SP}*ilg\."), " vakarų ilgumos ".to_string()),
        (format!(r"{b}r\.{SP}*ilg\."), " rytų ilgumos ".to_string()),
        (
            format!(r"{b}t{SP}*-{SP}*(?=me[tč])"),
            "tūkstant".to_string(),
        ),
    ]
    .into_iter()
    .map(|(p, r)| (re(&p, "gu"), js(&r)))
    .collect()
});

static DEGROUP: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        &format!(r"(?<=\d)(?<!(?<![\d\.,])0){SP}(?=\d{{3}}(?!\d))"),
        "gu",
    )
});
static TIMES: LazyLock<JsRegex> = LazyLock::new(|| re(&format!(r"(?<=\d){SP}*x{SP}*(?=\d)"), "gu"));
static SCORE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        &format!("{NOT_LETTER_BEFORE}(?:rezultat|pergal|pralaimėj|lygus)"),
        "iu",
    )
});
static RANGE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        &format!(
            r"(?<![\d.,:/\p{{L}}\p{{M}}–—-])(\d+(?:,\d+)?){SP}*[–—-]{SP}*(\d+(?:,\d+)?)(?!\d|[.,]\d|:|[–—-])"
        ),
        "gu",
    )
});
static RANGE_NUO: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        &format!("{NOT_LETTER_BEFORE}(?:nuo|iki|apie|prieš|per|tarp){NOT_LETTER_AFTER}{SP}*$"),
        "iu",
    )
});
static RANGE_IKI: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        &format!("{NOT_LETTER_BEFORE}iki{NOT_LETTER_AFTER}{SP}*$"),
        "iu",
    )
});
static RANGE_TEMPORAL: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        &format!(r"^{SP}*(m\.|d\.|a\.|met|dien|amž|tūkstantme)"),
        "u",
    )
});
static RANGE_FEM: LazyLock<JsRegex> =
    LazyLock::new(|| re(&format!(r"^{SP}*(?:val\.|min\.|t{NOT_LETTER_AFTER})"), "u"));

const MAG_MID: &str = "(?:[ \\u00a0\\u202f\\u2009]*(mlrd|mln|tūkst)\\.?)?";

/// A counted-unit arm: the squared form (when squarable), then the plain one.
struct UnitArm {
    squared: Option<JsRegex>,
    plain: JsRegex,
    noun: &'static str,
}

static UNIT_ARMS: LazyLock<Vec<UnitArm>> = LazyLock::new(|| {
    let mut out = Vec::new();
    for (key, n, squarable) in [
        ("km", "kilometre", true),
        ("mm", "millimetre", true),
        ("cm", "centimetre", true),
        ("kg", "kilogram", true),
        ("ha", "hectare", true),
        ("mg", "milligram", false),
    ] {
        out.push(UnitArm {
            squared: squarable.then(|| {
                re(
                    &format!(r"(?<![/\p{{L}}]){NUM}{MAG_MID}{SP}*{key}{SP}*[²2]{NOT_LETTER_AFTER}"),
                    "gu",
                )
            }),
            plain: re(
                &format!(r"(?<![/\p{{L}}]){NUM}{MAG_MID}{SP}*{key}{NOT_LETTER_AFTER}(?!/)"),
                "gu",
            ),
            noun: n,
        });
    }
    for (key, n, extra) in [
        ("m", "metre", String::new()),
        ("t", "tonne", format!("|{SP}*[-–—]")),
        ("g", "gram", String::new()),
    ] {
        out.push(UnitArm {
            squared: None,
            plain: re(
                &format!(
                    r"(?<![/\p{{L}}]){NUM}{MAG_MID}{SP}{key}{NOT_LETTER_AFTER}(?![/.]{extra})"
                ),
                "gu",
            ),
            noun: n,
        });
    }
    out
});

const MAG_SPELLED: &str = r"milijon\p{L}*|milijard\p{L}*|tūkstan\p{L}*";

/// The currency arms: sign before the number, then after it.
struct CurrencyArm {
    before: JsRegex,
    after: JsRegex,
    noun: &'static str,
    spelled: &'static [&'static str],
}

static CURRENCY_ARMS: LazyLock<Vec<CurrencyArm>> = LazyLock::new(|| {
    [
        ("€", "euro", &EURO_FORMS),
        (r"\$", "dollar", &DOLLAR_FORMS),
        ("£", "pound", &POUND_FORMS),
        ("Lt", "litas", &LITAS_FORMS),
    ]
    .into_iter()
    .map(|(sign, n, spelled)| {
        let mag = format!(r"({SP}*(?:(?:mlrd|mln|tūkst)\.?|{MAG_SPELLED}){NOT_LETTER_AFTER})?");
        CurrencyArm {
            before: re(&format!("{sign}{SP}*{NUM}{mag}"), "gu"),
            after: re(&format!("{NUM}{mag}{SP}*{sign}{NOT_LETTER_AFTER}"), "gu"),
            noun: n,
            spelled: spelled.as_slice(),
        }
    })
    .collect()
});

static SIGN_ONLY: LazyLock<Vec<(JsRegex, &'static str)>> = LazyLock::new(|| {
    [("€", "euro"), (r"\$", "dollar"), ("£", "pound")]
        .into_iter()
        .map(|(s, n)| (re(s, "gu"), n))
        .collect()
});

static MAG_ARMS: LazyLock<Vec<(JsRegex, JsRegex)>> = LazyLock::new(|| {
    MAG_SOURCES
        .iter()
        .map(|src| {
            (
                re(&format!(r"{NUM}{SP}*({src}){NOT_LETTER_AFTER}\.?"), "gu"),
                re(
                    &format!(r"{NOT_LETTER_BEFORE}(?:{src}){NOT_LETTER_AFTER}\.?"),
                    "gu",
                ),
            )
        })
        .collect()
});

static GOVERNS: LazyLock<JsRegex> = LazyLock::new(|| re(&format!(r"^{SP}*\p{{L}}"), "u"));

static YEAR_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let months = MANIFEST.normalization.months_gen.join("|");
    re(
        &format!(r"{NUM}{SP}*m\.({SP}*(?:{months}){NOT_LETTER_AFTER})?"),
        "gu",
    )
});

static SIMPLE: LazyLock<Vec<(JsRegex, JsString)>> = LazyLock::new(|| {
    let b = NOT_LETTER_BEFORE;
    let a = NOT_LETTER_AFTER;
    [
        (
            r"(?<![/\p{L}\p{M}])val\.".to_string(),
            "gu",
            format!(" {} ", noun("hour").gen_pl),
        ),
        (
            r"(?<![/\p{L}\p{M}])min\.".to_string(),
            "gu",
            format!(" {} ", noun("minute").gen_pl),
        ),
        (format!(r"{b}[Mm]ėn\."), "gu", format!(" {} ", w("month"))),
        (
            format!(r"{b}[Pp]vz\."),
            "gu",
            format!(" {} ", w("forExample")),
        ),
        (
            format!(r"{b}ir{SP}+kt\."),
            "giu",
            format!(" {} ", w("etCetera")),
        ),
        (format!(r"{b}[Nn]r\."), "gu", format!(" {} ", w("number"))),
        (
            format!(r"{b}[Pp]sl{a}\.?"),
            "gu",
            format!(" {} ", w("page")),
        ),
        (
            format!(r"{b}[Gg]yv\."),
            "gu",
            format!(" {} ", w("inhabitants")),
        ),
    ]
    .into_iter()
    .map(|(p, f, r)| (re(&p, f), js(&r)))
    .collect()
});

fn numbered(pattern: &str) -> JsRegex {
    re(&format!("{NUM}{pattern}"), "gu")
}
static PCT: LazyLock<JsRegex> = LazyLock::new(|| numbered(&format!("{SP}*%")));
static PROC: LazyLock<JsRegex> =
    LazyLock::new(|| numbered(&format!(r"{SP}*proc{NOT_LETTER_AFTER}\.?")));
static DEG_C: LazyLock<JsRegex> =
    LazyLock::new(|| re(&format!("{NUM}{SP}*°{SP}*C{NOT_LETTER_AFTER}"), "gui"));
static DEG_F: LazyLock<JsRegex> =
    LazyLock::new(|| re(&format!("{NUM}{SP}*°{SP}*F{NOT_LETTER_AFTER}"), "gui"));
static DAY: LazyLock<JsRegex> = LazyLock::new(|| numbered(&format!(r"{SP}*d\.")));
static CENTURY: LazyLock<JsRegex> = LazyLock::new(|| numbered(&format!(r"{SP}*a\.")));
static HOURS: LazyLock<JsRegex> = LazyLock::new(|| numbered(&format!(r"{SP}*val\.")));
static MINUTES: LazyLock<JsRegex> = LazyLock::new(|| numbered(&format!(r"{SP}*min\.")));

/// `money(num, mag, tail)` for one currency.
fn money(arm: &CurrencyArm, num: &JsString, mag: Option<&JsString>, tail: &JsString) -> JsString {
    let abbrev = mag.is_some_and(|m| js_re!("^[\\s\\u00a0]*(?:mlrd|mln|tūkst)", "u").test(m));
    let n = js_number(&split_num(num).0);
    let num_words = bare(num);
    let mag_part = match mag {
        None => JsString::new(),
        Some(_) if abbrev => mag_words(num, mag),
        Some(m) => js(" ").concat(&m.trim()),
    };
    if said_near(tail, arm.spelled) {
        return num_words.concat(&mag_part).concat(&js(" "));
    }
    let forms = noun(arm.noun);
    let noun = if mag.is_some() || num.includes(&js(",")) {
        &forms.gen_pl
    } else {
        agree(n, forms)
    };
    num_words
        .concat(&mag_part)
        .concat(&js(&format!(" {noun} ")))
}

/// `normalizeLithuanian(input)`.
pub(crate) fn normalize_lithuanian(input: &JsString) -> JsString {
    let mut t = renormalize(input, Form::Nfc);

    // 0) the marked clock.
    t = rewrite(
        &t,
        js_re!(
            r"(?<![\d.,:])([01]?\d|2[0-3])[.:]([0-5]\d)(?![\d]|[.,:]\d)(?=\s*val\b)",
            "gu"
        ),
        &js("$1 $2"),
    );

    // 1) the abbreviations.
    for (r, rep) in ABBREVS.iter() {
        t = rewrite(&t, r, rep);
    }

    // 2) de-grouping, to a fixed point; `x` between digits.
    loop {
        let prev = t.clone();
        t = rewrite(&t, &DEGROUP, &JsString::new());
        if t == prev {
            break;
        }
    }
    t = rewrite(&t, &TIMES, &js(" "));

    // 3) ranges (not scores, not after `iki`).
    t = rewrite_with(&t, &RANGE, |mm, whole| {
        let m = mm.value(whole);
        let off = mm.index();
        let back = |k: usize| whole.slice(off.saturating_sub(k) as isize, Some(off as isize));
        if SCORE.test(&back(50)) {
            return m;
        }
        let before = back(14);
        let has_nuo = RANGE_NUO.test(&before);
        if RANGE_IKI.test(&before) {
            return m;
        }
        let end = off + m.len();
        let after = whole.slice(end as isize, Some(end as isize + 10));
        let temporal = RANGE_TEMPORAL.test(&after);
        let from = if has_nuo || temporal {
            String::new()
        } else {
            format!("{} ", w("rangeFrom"))
        };
        let a = mm.group(1, whole).unwrap();
        let a = if RANGE_FEM.test(&after) {
            feminise(&bare(&a))
        } else {
            a
        };
        js(&from)
            .concat(&a)
            .concat(&js(&format!(" {} ", w("rangeTo"))))
            .concat(&mm.group(2, whole).unwrap())
    });

    // 4) signs.
    t = rewrite(
        &t,
        js_re!(r"(^|[\s(\[])[-−–](?=\d)", "gu"),
        &js(&format!("$1{} ", w("minus"))),
    );
    t = rewrite(
        &t,
        js_re!(r"(^|[\s(\[])\+(?=\d)", "gu"),
        &js(&format!("$1{} ", w("plus"))),
    );

    // 5) percent, degrees.
    let num = |mm: &crate::core::js_regex::JsMatch, s: &JsString| mm.group(1, s).unwrap();
    t = rewrite_with(&t, &PCT, |mm, s| quantity(&num(mm, s), noun("percent")));
    t = rewrite_with(&t, &PROC, |mm, s| quantity(&num(mm, s), noun("percent")));
    t = rewrite_with(&t, &DEG_C, |mm, s| {
        quantity(&num(mm, s), noun("degree")).concat(&js(&format!(" {}", w("celsius"))))
    });
    t = rewrite_with(&t, &DEG_F, |mm, s| {
        quantity(&num(mm, s), noun("degree")).concat(&js(&format!(" {}", w("fahrenheit"))))
    });

    // 6) units (squared first), magnitude abbreviations between number and unit.
    for arm in UNIT_ARMS.iter() {
        let forms = noun(arm.noun);
        if let Some(sq) = &arm.squared {
            t = rewrite_with(&t, sq, |mm, s| {
                let n = num(mm, s);
                let mag = mm.group(2, s);
                let forced = mag.is_some() || n.includes(&js(","));
                let q = if forced {
                    bare(&n)
                        .concat(&mag_words(&n, mag.as_ref()))
                        .concat(&js(&format!(" {}", forms.gen_pl)))
                } else {
                    quantity(&n, forms)
                };
                let squared = noun("squared");
                let sqw = if forced {
                    &squared.gen_pl
                } else {
                    agree(js_number(&split_num(&n).0), squared)
                };
                let mut words = q.split(&js(" "));
                let last = words.pop().unwrap_or_default();
                JsString::join(&words, &js(" "))
                    .concat(&js(&format!(" {sqw} ")))
                    .concat(&last)
            });
        }
        t = rewrite_with(&t, &arm.plain, |mm, s| {
            let n = num(mm, s);
            match mm.group(2, s) {
                None => quantity(&n, forms),
                Some(mag) => bare(&n)
                    .concat(&mag_words(&n, Some(&mag)))
                    .concat(&js(&format!(" {}", forms.gen_pl))),
            }
        });
    }

    // 7) currency, either side of the number; a sign left alone reads its genitive.
    for arm in CURRENCY_ARMS.iter() {
        for r in [&arm.before, &arm.after] {
            t = rewrite_with(&t, r, |mm, whole| {
                let tail = next_words(&whole.slice(mm.end() as isize, None), 2);
                money(arm, &num(mm, whole), mm.group(2, whole).as_ref(), &tail)
            });
        }
    }
    for (r, n) in SIGN_ONLY.iter() {
        t = rewrite(&t, r, &js(&format!(" {} ", noun(n).gen_pl)));
    }

    // 8) magnitude abbreviations after a number, then alone.
    for ((r, _), (_, forms)) in MAG_ARMS.iter().zip(mags()) {
        t = rewrite_with(&t, r, |mm, whole| {
            let n = num(mm, whole);
            let end = mm.end();
            let tail = whole.slice(end as isize, Some(end as isize + 8));
            let governs = GOVERNS.test(&tail) && !ERA_HEAD.test(&tail);
            let noun = if n.includes(&js(",")) || governs {
                &forms.gen_pl
            } else {
                agree(js_number(&split_num(&n).0), forms)
            };
            bare(&n).concat(&js(&format!(" {noun} ")))
        });
    }
    for ((_, r), (_, forms)) in MAG_ARMS.iter().zip(mags()) {
        t = rewrite(&t, r, &js(&format!(" {} ", forms.gen_pl)));
    }

    // 9) years (`m.`, with or without a month), days, centuries, hours, minutes.
    t = rewrite_with(&t, &YEAR_RE, |mm, s| {
        let n = num(mm, s);
        let month = mm.group(2, s);
        let small = !n.includes(&js(",")) && n.len() <= 2;
        let noun = if month.is_some() || n.includes(&js(",")) || small {
            w("yearGen")
        } else {
            w("yearInstr")
        };
        bare(&n)
            .concat(&js(&format!(" {noun}")))
            .concat(&month.unwrap_or_default())
            .concat(&js(" "))
    });
    t = rewrite_with(&t, &DAY, |mm, s| {
        feminise(&bare(&num(mm, s))).concat(&js(&format!(" {} ", w("day"))))
    });
    t = rewrite_with(&t, &CENTURY, |mm, s| {
        bare(&num(mm, s)).concat(&js(&format!(" {} ", w("centuryGen"))))
    });
    t = rewrite_with(&t, &HOURS, |mm, s| quantity(&num(mm, s), noun("hour")));
    t = rewrite_with(&t, &MINUTES, |mm, s| quantity(&num(mm, s), noun("minute")));
    for (r, rep) in SIMPLE.iter() {
        t = rewrite(&t, r, rep);
    }

    // 10) the decimal comma, digit by digit.
    t = rewrite_with(
        &t,
        js_re!(r"(?<![\d.,])(\d+),(\d+)(?![\d.,])", "gu"),
        |mm, s| {
            let b = mm.group(2, s).unwrap();
            let digits: Vec<JsString> = b.0.iter().map(|&u| JsString::from_units(&[u])).collect();
            mm.group(1, s)
                .unwrap()
                .concat(&js(&format!(" {} ", w("decimalPoint"))))
                .concat(&JsString::join(&digits, &js(" ")))
        },
    );

    // 11) the ampersand; runs of spaces.
    t = rewrite(&t, js_re!("&amp;", "gu"), &js("&"));
    t = rewrite(
        &t,
        js_re!(r"\s*&\s*", "gu"),
        &js(&format!(" {} ", w("and"))),
    );
    rewrite(&t, js_re!(r"[ \t]{2,}", "gu"), &js(" "))
}

type Predicate = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

static IS_UNREADABLE: LazyLock<Predicate> = LazyLock::new(|| {
    let set = |xs: &[&str]| xs.iter().map(|x| js(x)).collect();
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new("[aeiouyąęėįųū]", "u").unwrap(),
        legal_onsets: set(&[
            "pr", "br", "tr", "dr", "kr", "gr", "pl", "bl", "kl", "gl", "sl", "sm", "sn", "sp",
            "st", "sk", "sv", "kv", "gv", "dv", "tv", "šv", "šm", "šn", "šp", "št", "šk", "žm",
            "žv", "žl", "zn", "kn", "gn", "mn", "vl", "vr", "ml", "mr", "ps", "pt", "kt", "cv",
            "čr",
        ]),
        legal_codas: set(&[
            "rs", "rt", "rd", "rk", "rg", "rn", "rm", "rb", "ls", "lt", "ld", "lk", "lg", "lb",
            "ns", "nt", "nd", "nk", "ng", "st", "sk", "ts", "ms", "mt", "mb", "ks", "ps", "pt",
            "št", "žt", "kt", "nč",
        ]),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableLithuanian(word)`.
pub(crate) fn is_unreadable_lithuanian(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    MANIFEST
        .normalization
        .acronym_letters
        .iter()
        .map(|w| js(w))
        .collect()
});

/// `NRM.letterNames[l]`: `l` is one lowercased letter, which no Object.prototype member's name is.
static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| {
    Arc::new(|l: &JsString| {
        MANIFEST
            .normalization
            .letter_names
            .get(&l.to_string_lossy())
            .map(|n| js(n))
    })
});

/// `normalizeLithuanianInitialisms(text)`.
pub(crate) fn normalize_lithuanian_initialisms(text: &JsString) -> JsString {
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
