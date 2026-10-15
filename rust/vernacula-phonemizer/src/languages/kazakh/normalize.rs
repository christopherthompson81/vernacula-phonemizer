//! Kazakh (kk) text normalization: space thousands, dotted abbreviations, `N-ші` ordinals and `N-noun` forms, the
//! case suffix written after a digit (harmonised onto the spoken word), clocks, degrees, rates, ranges, the
//! symbol tier, fractions, decimals and signs. Ported from src/languages/kazakh/normalize.ts — see that file for
//! the corpus evidence.

use super::kazakh::symbols;
use super::roman_ordinals::kk_roman_ordinal;
use crate::core::js_regex::JsMatch;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const UNIT_CARD: [&str; 10] = [
    "",
    "бір",
    "екі",
    "үш",
    "төрт",
    "бес",
    "алты",
    "жеті",
    "сегіз",
    "тоғыз",
];
const ZERO_CARD: &str = "нөл";
const TENS_CARD: [&str; 10] = [
    "",
    "он",
    "жиырма",
    "отыз",
    "қырық",
    "елу",
    "алпыс",
    "жетпіс",
    "сексен",
    "тоқсан",
];
const HUNDRED_CARD: &str = "жүз";
const THOUSAND_CARD: &str = "мың";

/// `ordinalWord(n)`: the ordinal in orthography, 1 … 999,999 except a round thousand; else `None`.
pub(crate) fn ordinal_word(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || n < 1.0 || n >= 1_000_000.0 {
        return None;
    }
    if n >= 1000.0 {
        let (th, r) = ((n / 1000.0).floor(), n % 1000.0);
        if r == 0.0 {
            return None;
        }
        let head_num = if th == 1.0 {
            js(UNIT_CARD[1])
        } else {
            orthographic(th)
        };
        let tail = ordinal_word(r)?;
        return Some(
            head_num
                .concat(&js(&format!(" {THOUSAND_CARD} ")))
                .concat(&tail),
        );
    }
    if n <= 100.0 {
        return kk_roman_ordinal(n);
    }
    let (h, r) = ((n / 100.0).floor() as usize, n % 100.0);
    let head = if h == 1 {
        HUNDRED_CARD.to_string()
    } else {
        format!("{} {HUNDRED_CARD}", UNIT_CARD[h])
    };
    if r == 0.0 {
        // `.replace("іінші", "інші")`: first occurrence only.
        return Some(js(&format!("{head}інші").replacen("іінші", "інші", 1)));
    }
    // `${head} ${ordinalWord(r)}`: r is 1 … 99, which always has an ordinal.
    Some(js(&format!("{head} ")).concat(&ordinal_word(r)?))
}

/// `CASE_BY_SUFFIX[suffix]`. Generated from normalize.ts's object literal; a miss is `None`.
fn case_by_suffix(sfx: &JsString) -> Option<&'static str> {
    const T: [(&str, &str); 23] = [
        ("ге", "dat"),
        ("ға", "dat"),
        ("ке", "dat"),
        ("қа", "dat"),
        ("ден", "abl"),
        ("дан", "abl"),
        ("тен", "abl"),
        ("тан", "abl"),
        ("нен", "abl"),
        ("нан", "abl"),
        ("ның", "gen"),
        ("нің", "gen"),
        ("дың", "gen"),
        ("дің", "gen"),
        ("тың", "gen"),
        ("тің", "gen"),
        ("да", "loc"),
        ("де", "loc"),
        ("та", "loc"),
        ("те", "loc"),
        ("мен", "ins"),
        ("бен", "ins"),
        ("пен", "ins"),
    ];
    T.iter().find(|(k, _)| *sfx == **k).map(|(_, c)| *c)
}

/// `lastVowel(w)`: the last match of `/[аәеиоөұүыі]/gu`.
fn last_vowel(w: &JsString) -> Option<JsString> {
    js_re!(r"[аәеиоөұүыі]", "gu")
        .match_all(w)
        .last()
        .map(|m| m.value(w))
}

const BACK_VOWELS: &str = "аәоұы";

/// `BACK_VOWELS.includes(v)`: `v` is one vowel letter, never empty.
fn is_back(v: &JsString) -> bool {
    js(BACK_VOWELS).includes(v)
}

fn case_ending(case_name: &str, v: &JsString) -> &'static str {
    let back = is_back(v);
    match case_name {
        "dat" => {
            if back {
                "ға"
            } else {
                "ге"
            }
        }
        "abl" => {
            if back {
                "дан"
            } else {
                "ден"
            }
        }
        "gen" => {
            if back {
                "ның"
            } else {
                "нің"
            }
        }
        "loc" => {
            if back {
                "да"
            } else {
                "де"
            }
        }
        "ins" => "мен",
        _ => "",
    }
}

/// `ordinal_or_cardinal_tail(n, tail)`: the date possessive, -ы/-і on the cardinal's last word.
fn ordinal_or_cardinal_tail(n: f64) -> Option<JsString> {
    let base = orthographic(n);
    if base.is_empty() {
        return None;
    }
    let mut words = base.split(&js(" "));
    let last = words.last().unwrap().clone();
    let v = last_vowel(&last)?;
    *words.last_mut().unwrap() = last.concat(&js(if is_back(&v) { "ы" } else { "і" }));
    Some(JsString::join(&words, &js(" ")))
}

/// `withCase(numberWord, caseName)`: the case ending on the last word, by harmony, voicing and nasality.
fn with_case(number_word: &JsString, case_name: &str) -> JsString {
    let mut words = number_word.split(&js(" "));
    let last = words.last().unwrap().clone();
    let Some(v) = last_vowel(&last) else {
        return number_word.clone();
    };
    let back = is_back(&v);
    let voiceless = js_re!(r"[кқпсстфхцчшщ]$", "u").test(&last);
    let nasal = js_re!(r"[нмң]$", "u").test(&last);
    let mut e = case_ending(case_name, &v);
    if voiceless && case_name == "dat" {
        e = if back { "қа" } else { "ке" };
    }
    if voiceless && case_name == "loc" {
        e = if back { "та" } else { "те" };
    }
    if voiceless && case_name == "abl" {
        e = if back { "тан" } else { "тен" };
    }
    if nasal && case_name == "abl" {
        e = if back { "нан" } else { "нен" };
    }
    if voiceless && case_name == "ins" {
        e = "пен";
    }
    if js_re!(r"[жз]$", "u").test(&last) && case_name == "ins" {
        e = "бен";
    }
    *words.last_mut().unwrap() = last.concat(&js(e));
    JsString::join(&words, &js(" "))
}

/// `orthographic(n)`: the cardinal in orthography, 0 … 999,999; "" above.
pub(crate) fn orthographic(n: f64) -> JsString {
    if n == 0.0 {
        return js(ZERO_CARD);
    }
    if n < 10.0 {
        return js(UNIT_CARD[n as usize]);
    }
    if n < 100.0 {
        let (t, u) = ((n / 10.0).floor() as usize, (n % 10.0) as usize);
        return if u == 0 {
            js(TENS_CARD[t])
        } else {
            js(&format!("{} {}", TENS_CARD[t], UNIT_CARD[u]))
        };
    }
    if n < 1000.0 {
        let (h, r) = ((n / 100.0).floor() as usize, n % 100.0);
        let head = if h == 1 {
            js(HUNDRED_CARD)
        } else {
            js(&format!("{} {HUNDRED_CARD}", UNIT_CARD[h]))
        };
        return if r == 0.0 {
            head
        } else {
            head.concat(&js(" ")).concat(&orthographic(r))
        };
    }
    if n < 1_000_000.0 {
        let (th, r) = ((n / 1000.0).floor(), n % 1000.0);
        let head = if th == 1.0 {
            js(UNIT_CARD[1])
        } else {
            orthographic(th)
        }
        .concat(&js(&format!(" {THOUSAND_CARD}")));
        return if r == 0.0 {
            head
        } else {
            head.concat(&js(" ")).concat(&orthographic(r))
        };
    }
    JsString::new()
}

fn g(m: &JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `base` with the case the optional suffix group names, as each suffix-carrying rule does.
fn with_optional_case(base: JsString, sfx: Option<JsString>) -> JsString {
    match sfx
        .filter(|s| !s.is_empty())
        .and_then(|s| case_by_suffix(&s.to_lower_case()))
    {
        Some(case_name) => with_case(&base, case_name),
        None => base,
    }
}

/// `normalizeKazakh(input)`. The numbered steps are order-dependent, as in the TS.
pub(crate) fn normalize_kazakh(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 0) space-grouped thousands, twice.
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

    // 1) dotted abbreviations and era markers.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])б\.\s?д\.\s?д\.(\s+)(?=[\p{L}\d])", "giu"),
        &js("біздің дәуірге дейін$1"),
    );
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])б\.\s?д\.\s?д\.(?=\s*(?:[.,;:!?»)]|$))",
            "giu"
        ),
        &js("біздің дәуірге дейін."),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])т\.\s?б\.(\s+)(?=[\p{L}\d])", "giu"),
        &js("тағы басқа$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])т\.\s?б\.(?=\s*(?:[.,;:!?»)]|$))", "giu"),
        &js("тағы басқа."),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])т\.\s?с\.\s?с\.(\s+)(?=[\p{L}\d])", "giu"),
        &js("тағы сол сияқты$1"),
    );
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])т\.\s?с\.\s?с\.(?=\s*(?:[.,;:!?»)]|$))",
            "giu"
        ),
        &js("тағы сол сияқты."),
    );

    // 2) `N-ші` ordinals.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+)(?:-)?(ші|шы|нші|ншы)(?![\p{L}\p{M}])",
            "giu"
        ),
        |m, t| ordinal_word(js_number(&g(m, t, 1))).unwrap_or_else(|| m.value(t)),
    );

    // 2b) `N-noun`: an ordinal before a spelled noun; a 1–2 letter tail is the date possessive.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)-([а-яәғқңөұүһі]+)(?![\p{L}\p{M}])", "giu"),
        |m, t| {
            let n = js_number(&g(m, t, 1));
            let tail = g(m, t, 2);
            if case_by_suffix(&tail.to_lower_case()).is_some() {
                return m.value(t);
            }
            let Some(ord) = ordinal_word(n) else {
                return m.value(t);
            };
            if tail.len() <= 2 {
                return ordinal_or_cardinal_tail(n).unwrap_or_else(|| m.value(t));
            }
            ord.concat(&js(" ")).concat(&tail)
        },
    );

    // 2c) the numero sign.
    s = rewrite(&s, js_re!(r"№\s?(?=\d)", "gu"), &js("нөмір "));

    // 3) the colon clock, with an optional case suffix on its last word.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:.,])([01]?\d|2[0-3]):\s*([0-5]\d)(?![:.\d])(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан|ның|нің|да|де|та|те|мен|бен|пен)?",
            "giu"
        ),
        |m, t| {
            let (hv, mv) = (js_number(&g(m, t, 1)), js_number(&g(m, t, 2)));
            if hv > 23.0 || mv > 59.0 {
                return m.value(t);
            }
            let base = if mv == 0.0 {
                orthographic(hv)
            } else {
                orthographic(hv).concat(&js(" ")).concat(&orthographic(mv))
            };
            with_optional_case(base, m.group(3, t))
        },
    );

    // 3b) the dot clock before a timezone; zero minutes omitted.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d{1,2})\.(\d{2})\s*(UTC|GMT)", "giu"),
        |m, t| {
            let mv = js_number(&g(m, t, 2));
            let mut out = orthographic(js_number(&g(m, t, 1)));
            if mv != 0.0 {
                out = out.concat(&js(" ")).concat(&orthographic(mv));
            }
            out.concat(&js(" ")).concat(&g(m, t, 3))
        },
    );

    // 4) the case suffix after a bare number; the out-of-range guard leaves the digits.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+)(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан|ның|нің|да|де|та|те|мен|бен|пен)(?![\p{L}\p{M}])",
            "giu"
        ),
        |m, t| {
            let Some(case_name) = case_by_suffix(&g(m, t, 2).to_lower_case()) else {
                return m.value(t);
            };
            let o = orthographic(js_number(&g(m, t, 1)));
            if o.is_empty() {
                return m.value(t);
            }
            with_case(&o, case_name)
        },
    );

    // 5) degrees, signed first (the general sign rule runs after the number is consumed).
    s = rewrite_with(
        &s,
        js_re!(
            r"(^|[\s(])\+\s?(\d+)\s?°\s?C\s?(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?",
            "giu"
        ),
        |m, t| {
            let base = g(m, t, 1)
                .concat(&js("плюс "))
                .concat(&orthographic(js_number(&g(m, t, 2))))
                .concat(&js(" градус Цельсий"));
            with_optional_case(base, m.group(3, t))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(^|[\s(])[-−](\d+)\s?°\s?C\s?(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?",
            "giu"
        ),
        |m, t| {
            let base = g(m, t, 1)
                .concat(&js("минус "))
                .concat(&orthographic(js_number(&g(m, t, 2))))
                .concat(&js(" градус Цельсий"));
            with_optional_case(base, m.group(3, t))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(\d+)\s?°\s?C\s?(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?(?![\p{L}\p{M}])",
            "giu"
        ),
        |m, t| {
            let base = orthographic(js_number(&g(m, t, 1))).concat(&js(" градус Цельсий"));
            with_optional_case(base, m.group(2, t))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(\d+)\s?°\s?F\s?(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?(?![\p{L}\p{M}])",
            "giu"
        ),
        |m, t| {
            let base = orthographic(js_number(&g(m, t, 1))).concat(&js(" градус Фаренгейт"));
            with_optional_case(base, m.group(2, t))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?°\s?([NSEW])(?![\p{L}\p{M}])", "giu"),
        |m, t| {
            // `c.toUpperCase()`: under `iu` the class also takes the lower case and the long s, all of which
            // upper-case onto a key.
            let dir = match g(m, t, 2).to_upper_case().to_string_lossy().as_str() {
                "N" => "солтүстік",
                "S" => "оңтүстік",
                "E" => "шығыс",
                _ => "батыс",
            };
            orthographic(js_number(&g(m, t, 1))).concat(&js(&format!(" градус {dir}")))
        },
    );

    // 5b) rates, with an optional case suffix.
    s = rewrite_with(
        &s,
        js_re!(
            r"(\d[\d ]*)\s?(км)\s*\/\s*(сағ|сағат)(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?(?![\p{L}\p{M}])",
            "giu"
        ),
        |m, t| {
            let n = js_number(&js_re!(r" ", "gu").replace(&g(m, t, 1), &JsString::new()));
            let base = orthographic(n).concat(&js(" километр сағат"));
            with_optional_case(base, m.group(4, t))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(\d[\d ]*)\s?миля\s*\/\s*сағат(?:-)?(ге|ға|ке|қа|ден|дан|тен|тан|нен|нан)?(?![\p{L}\p{M}])",
            "giu"
        ),
        |m, t| {
            let n = js_number(&js_re!(r" ", "gu").replace(&g(m, t, 1), &JsString::new()));
            let base = orthographic(n).concat(&js(" миля сағат"));
            with_optional_case(base, m.group(2, t))
        },
    );

    // 6) numeric ranges.
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d.,])(\d[\d ]*)\s*[-–—]\s*(\d[\d ]*)(?![\d.-])",
            "gu"
        ),
        &js("$1–$2"),
    );

    // 7) the shared symbol tier, while the number is still adjacent to its unit.
    s = symbols().apply(&s);

    // 7z) fractions: the denominator in the ablative, then the numerator.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d{1,3})\s?\/\s?(\d{1,3})(?![\d.,])", "gu"),
        |m, t| {
            let num = orthographic(js_number(&g(m, t, 1)));
            let den = orthographic(js_number(&g(m, t, 2)));
            if num.is_empty() || den.is_empty() {
                return m.value(t);
            }
            with_case(&den, "abl").concat(&js(" ")).concat(&num)
        },
    );

    // 8) the decimal comma.
    s = rewrite(&s, js_re!(r"(?<=\d),(?=\d)", "gu"), &js(" бүтін "));

    // 8b) dot decimals / versions, the signed case first.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{Nd}])[-−](\d+)\.(\d+)(?![\d.])", "giu"),
        |m, t| {
            js("минус ")
                .concat(&orthographic(js_number(&g(m, t, 1))))
                .concat(&js(" нүкте "))
                .concat(&orthographic(js_number(&g(m, t, 2))))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?![\d.])", "giu"),
        |m, t| {
            orthographic(js_number(&g(m, t, 1)))
                .concat(&js(" нүкте "))
                .concat(&orthographic(js_number(&g(m, t, 2))))
        },
    );

    // 9) signs, division (the divisor in the dative), relations.
    s = rewrite(&s, js_re!(r"(^|[\s(])\+\s?(\d)", "gu"), &js("$1плюс $2"));
    s = rewrite_with(&s, js_re!(r"(\d+)\s?÷\s?(\d+)", "gu"), |m, t| {
        orthographic(js_number(&g(m, t, 1)))
            .concat(&js(" "))
            .concat(&with_case(&orthographic(js_number(&g(m, t, 2))), "dat"))
            .concat(&js(" бөлінеді"))
    });
    s = rewrite(&s, js_re!(r"±", "gu"), &js(" плюс минус "));
    s = rewrite(&s, js_re!(r"(?<=[A-Z])\s?\+\s?(\d)", "gu"), &js(" плюс $1"));
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{Nd}])[-−](\d+)(?!\s*[-\d])", "gu"),
        &js("минус $1"),
    );
    s = rewrite(&s, js_re!(r"(\d)\s*×\s*(\d)", "gu"), &js("$1 есе $2"));
    s = rewrite(&s, js_re!(r"(\S)\s*=\s*(\S)", "gu"), &js("$1 тең $2"));
    s = rewrite(&s, js_re!(r"(\d)\s*<\s*(\d)", "gu"), &js("$1 аз $2"));
    s = rewrite(&s, js_re!(r"(\d)\s*>\s*(\d)", "gu"), &js("$1 көп $2"));

    s
}
