//! Luxembourgish (lb) text normalization: the four jobs of the period (grouping, clock, ordinal, neither), era
//! markers and abbreviations, licensed ordinals with the Eifeler Regel, sports times, fractions, decimals, ranges,
//! mph, degrees and signs.
//! Ported from src/languages/luxembourgish/normalize.ts — see that file for the corpus evidence and the ordering.

use std::collections::HashSet;
use std::sync::LazyLock;

use super::numbers::{apply_eifeler_regel, number_to_words};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, is_safe_integer, js, js_number, js_number_to_string};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const MONTHS: &str =
    "Januar|Februar|Mäerz|Abrëll|Mee|Juni|Juli|August|September|Oktober|November|Dezember";

static LICENSER: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    [
        "de", "den", "dem", "der", "dat", "déi", "d'", "d’", "am", "um", "vum", "zum", "nom",
        "beim", "an", "vun", "vu", "säi", "säin", "seng", "hir", "hire", "hiren", "hiert", "deem",
        "dësem", "dësen",
    ]
    .iter()
    .map(|s| js(s))
    .collect()
});

/// `SP`: space, NBSP, NNBSP, thin space — as escapes, as the TS writes them.
const SP: &str = r"[ \u00a0\u202f\u2009]";

/// `DOTTED_ABBREV`, in its insertion order.
const DOTTED_ABBREV: [(&str, &str); 4] = [
    ("asw", "an sou weider"),
    ("dr", "Dokter"),
    ("jr", "Junior"),
    ("nr", "Nummer"),
];

const CLOCK_MARKER: &str = "Auer|UTC|GMT|MDT|MST|MEZ|CET|CEST";

fn re(p: String, flags: &str) -> JsRegex {
    JsRegex::new(&p, flags).unwrap()
}

/// `ABBREV_ALT`: the keys, stably sorted longest first.
fn abbrev_alt() -> String {
    let mut keys: Vec<&str> = DOTTED_ABBREV.iter().map(|(k, _)| *k).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(js(k).len()));
    keys.join("|")
}

struct Res {
    era: Vec<(JsRegex, JsRegex, JsRegex, &'static str)>,
    multidot_zb: JsRegex,
    multidot_dh: JsRegex,
    abbrev_mid: JsRegex,
    abbrev_before_mark: JsRegex,
    abbrev_end: JsRegex,
    group_space: JsRegex,
    space_any: JsRegex,
    ord: JsRegex,
    ord_next: JsRegex,
    ord_noun: JsRegex,
    ordinal_list: JsRegex,
    clock: JsRegex,
    range: JsRegex,
    mph: JsRegex,
    deg_c: JsRegex,
    deg_f: JsRegex,
    deg_bare: JsRegex,
    plus_after_word: JsRegex,
    plus_initial: JsRegex,
}

static RES: LazyLock<Res> = LazyLock::new(|| {
    let alt = abbrev_alt();
    let era = |ab: &str| {
        (
            re(
                format!(r"(?<![\p{{L}}\p{{M}}]){ab}\.{SP}?Chr\b\.?(?={SP}+[\p{{L}}\d(])"),
                "gu",
            ),
            re(
                format!(r"(?<![\p{{L}}\p{{M}}]){ab}\.{SP}?Chr\b\.?(?={SP}*[»)\]!?,;:])"),
                "gu",
            ),
            re(format!(r"(?<![\p{{L}}\p{{M}}]){ab}\.{SP}?Chr\b\.?"), "gu"),
        )
    };
    let (v1, v2, v3) = era("v");
    let (n1, n2, n3) = era("n");
    Res {
        era: vec![(v1, v2, v3, "vir"), (n1, n2, n3, "no")],
        multidot_zb: re(format!(r"(?<![\p{{L}}\p{{M}}])z\.{SP}?B\."), "gu"),
        multidot_dh: re(format!(r"(?<![\p{{L}}\p{{M}}])d\.{SP}?h\."), "gu"),
        abbrev_mid: re(
            format!(r"(?<![\p{{L}}\p{{M}}])({alt})\.({SP}+)(?=[\p{{L}}\d])"),
            "giu",
        ),
        abbrev_before_mark: re(
            format!(r"(?<![\p{{L}}\p{{M}}])({alt})\.(?={SP}*[,;:!?»)\]])"),
            "giu",
        ),
        abbrev_end: re(
            format!(r"(?<![\p{{L}}\p{{M}}])({alt})\.(?={SP}*(?:\.|$))"),
            "giu",
        ),
        group_space: re(
            format!(r"(?<![\d.,])[1-9]\d{{0,2}}(?:{SP}\d{{3}}(?!\d))+"),
            "gu",
        ),
        space_any: re(SP.to_string(), "gu"),
        ord: re(
            format!(r"(?:([\p{{L}}'’-]+)({SP}+))?(?<![\d.,:])(\d{{1,4}})\.(?=[,;)]?{SP})"),
            "gu",
        ),
        ord_next: re(format!(r"^[,;)]?{SP}+([\p{{L}}'’-]+)"), "u"),
        ord_noun: re(
            format!("^(?:{MONTHS}|Joerhonnert|Joerhonnerts|Joerdausend)$"),
            "u",
        ),
        ordinal_list: re(
            format!(r"^(?:,|{SP}+(?:an|a|bis|oder))(?:{SP}+[\p{{L}}'’-]+){{0,2}}{SP}+\d{{1,4}}\."),
            "u",
        ),
        clock: re(
            format!(
                r"(?:([\p{{L}}'’]+)({SP}+))?(?<![\d.,:])([01]?\d|2[0-3])\.([0-5]\d)(?![\d,.:\p{{L}}])(?:({SP}+)({CLOCK_MARKER}))?"
            ),
            "gu",
        ),
        range: re(format!(r"(\d[\d.,]*\d|\d){SP}*[–—]{SP}*(?=\d)"), "gu"),
        mph: re(
            format!(r"(\d){SP}?(?:mph|Meilen?{SP}?/{SP}?h)(?![\p{{L}}\p{{M}}])"),
            "gu",
        ),
        deg_c: re(format!(r"(\d){SP}?°{SP}?C(?![\p{{L}}\p{{M}}])"), "gui"),
        deg_f: re(format!(r"(\d){SP}?°{SP}?F(?![\p{{L}}\p{{M}}])"), "gui"),
        deg_bare: re(format!(r"(\d){SP}?°{SP}?"), "gu"),
        plus_after_word: re(format!(r"(\S)\+{SP}?(\d)"), "gu"),
        plus_initial: re(format!(r"(^|\s)\+{SP}?(\d)"), "gu"),
    }
});

/// `ordinalStem(n)`.
pub fn ordinal_stem(n: f64) -> Option<JsString> {
    if !is_safe_integer(n) || n < 1.0 {
        return None;
    }
    if n == 1.0 {
        return Some(js("éischt"));
    }
    if n == 3.0 {
        return Some(js("drëtt"));
    }
    let card = number_to_words(n, None);
    if card.is_empty() || js_re!(r"\d", "u").test(&card) {
        return None;
    }
    let s = card.concat(&js(if n < 20.0 { "t" } else { "st" }));
    Some(js_re!(r"tt$", "u").replace(&s, &js("t")))
}

/// `fractionNoun(den)`.
fn fraction_noun(den: f64) -> Option<JsString> {
    if den == 4.0 {
        return Some(js("Véierel"));
    }
    let stem = ordinal_stem(den)?;
    // `stem.charAt(0).toUpperCase()`: one CODE UNIT.
    Some(
        stem.char_at(0)
            .to_upper_case()
            .concat(&stem.slice(1, None))
            .concat(&js("el")),
    )
}

/// `perDigit(frac)`: one CODE POINT at a time.
fn per_digit(frac: &JsString) -> JsString {
    JsString::join(&frac.code_point_strings(), &js(" "))
}

/// `normalizeLuxembourgish(input)`.
pub fn normalize_luxembourgish(input: &JsString) -> JsString {
    let g = |m: &JsMatch, s: &JsString, i: usize| m.group(i, s).unwrap_or_default();
    let r = &*RES;
    let mut s = input.clone();

    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])[1-9]\d{0,2}(?:\.\d{3})+(?!\d)", "gu"),
        |m, w| js_re!(r"\.", "gu").replace(&m.value(w), &JsString::new()),
    );
    s = rewrite_with(&s, &r.group_space, |m, w| {
        r.space_any.replace(&m.value(w), &JsString::new())
    });

    for (mid, before_mark, end, word) in &r.era {
        s = rewrite(&s, mid, &js(&format!("{word} Christus")));
        s = rewrite(&s, before_mark, &js(&format!("{word} Christus")));
        s = rewrite(&s, end, &js(&format!("{word} Christus.")));
    }

    s = rewrite(&s, &r.multidot_zb, &js("zum Beispill"));
    s = rewrite(&s, &r.multidot_dh, &js("dat heescht"));

    // `DOTTED_ABBREV[ab.toLowerCase()]!` with a miss STRINGIFIES `undefined`: under `iu` the pattern folds
    // (`aſw.` matches `asw`) while the lowercased key does not.
    let abbrev = |ab: &JsString| {
        let k = ab.to_lower_case();
        js(DOTTED_ABBREV
            .iter()
            .find(|(key, _)| k == *key)
            .map_or("undefined", |(_, v)| v))
    };
    s = rewrite_with(&s, &r.abbrev_mid, |m, w| {
        abbrev(&g(m, w, 1)).concat(&g(m, w, 2))
    });
    s = rewrite_with(&s, &r.abbrev_before_mark, |m, w| abbrev(&g(m, w, 1)));
    s = rewrite_with(&s, &r.abbrev_end, |m, w| {
        abbrev(&g(m, w, 1)).concat(&js("."))
    });

    s = rewrite_with(&s, &r.ord, |m, full| {
        let whole = m.value(full);
        let prev = m.group(1, full);
        let psp = m.group(2, full);
        let digits = g(m, full, 3);
        let rest = full.slice((m.index() + whole.len()) as isize, None);
        let next = r.ord_next.exec(&rest).and_then(|x| x.group(1, &rest));
        let licensed = next.as_ref().is_some_and(|n| r.ord_noun.test(n))
            || (prev
                .as_ref()
                .is_some_and(|p| LICENSER.contains(&p.to_lower_case()))
                && next.is_some())
            || r.ordinal_list.test(&rest);
        if !licensed {
            return whole;
        }
        let Some(stem) = ordinal_stem(js_number(&digits)) else {
            return whole;
        };
        let head = prev
            .clone()
            .unwrap_or_default()
            .concat(&psp.unwrap_or_default());
        if prev.as_ref().is_some_and(|p| p.to_lower_case() == "der") {
            return head.concat(&stem).concat(&js("er"));
        }
        let cue = if js_re!(r"^[,;)]", "u").test(&rest) {
            js("n")
        } else {
            next.unwrap_or_default()
        };
        head.concat(&apply_eifeler_regel(&stem.concat(&js("en")), &cue))
    });

    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,:])(\d{1,2})\.(\d{2}),(\d{1,2})(?!\d)", "gu"),
        |m, w| {
            g(m, w, 1)
                .concat(&js(" "))
                .concat(&g(m, w, 2))
                .concat(&js(" Komma "))
                .concat(&per_digit(&g(m, w, 3)))
        },
    );

    s = rewrite_with(&s, &r.clock, |m, w| {
        let whole = m.value(w);
        let prev = m.group(1, w);
        let marker = m.group(6, w);
        if marker.is_none()
            && !prev
                .as_ref()
                .is_some_and(|p| js_re!(r"^(?:um|ëm|géint|tëschent)$", "iu").test(p))
        {
            return whole;
        }
        let h = g(m, w, 3);
        let hour = if js_number(&h) == 1.0 { js("eng") } else { h };
        let tail = match &marker {
            None => JsString::new(),
            Some(mk) if *mk == "Auer" => JsString::new(),
            Some(mk) => m.group(5, w).unwrap_or_else(|| js(" ")).concat(mk),
        };
        let min = js_number(&g(m, w, 4));
        let mins = if min == 0.0 {
            JsString::new()
        } else {
            js(&format!(" {}", js_number_to_string(min)))
        };
        prev.unwrap_or_default()
            .concat(&m.group(2, w).unwrap_or_default())
            .concat(&hour)
            .concat(&js(" Auer"))
            .concat(&mins)
            .concat(&tail)
    });

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d/]|\d[.,:])(\d{1,3})\/(\d{1,3})(?![\d/]|[.,:]\d)",
            "gu"
        ),
        |m, w| {
            let (num, den) = (js_number(&g(m, w, 1)), js_number(&g(m, w, 2)));
            let one_before = |word: &JsString| apply_eifeler_regel(&js("een"), word);
            if den == 2.0 {
                let head = if num == 1.0 {
                    one_before(&js("hallef"))
                } else {
                    number_to_words(num, None)
                };
                return head.concat(&js(" hallef"));
            }
            let Some(noun) = fraction_noun(den) else {
                return m.value(w);
            };
            let head = if num == 1.0 {
                one_before(&noun)
            } else {
                number_to_words(num, None)
            };
            head.concat(&js(" ")).concat(&noun)
        },
    );

    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,:])(\d{1,2})\.(\d)(?![\d,.:\p{L}])", "gu"),
        |m, w| {
            g(m, w, 1)
                .concat(&js(" Komma "))
                .concat(&per_digit(&g(m, w, 2)))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,:])(\d+),(\d+)(?![\d.,])", "gu"),
        |m, w| {
            g(m, w, 1)
                .concat(&js(" Komma "))
                .concat(&per_digit(&g(m, w, 2)))
        },
    );

    s = rewrite_with(&s, &r.range, |m, w| {
        let left = g(m, w, 1);
        let words = if js_re!(r"^\d+$", "u").test(&left) {
            number_to_words(js_number(&left), None)
        } else {
            JsString::new()
        };
        if js_re!(r"en$", "u").test(&words) {
            apply_eifeler_regel(&words, &js("bis")).concat(&js(" bis "))
        } else {
            left.concat(&js(" bis "))
        }
    });

    s = rewrite(&s, &r.mph, &js("$1 Meilen an der Stonn"));

    s = rewrite(&s, &r.deg_c, &js("$1 Grad Celsius"));
    s = rewrite(&s, &r.deg_f, &js("$1 Grad Fahrenheit"));
    s = rewrite(&s, &r.deg_bare, &js("$1 Grad "));

    s = rewrite(&s, js_re!(r"(^|[\s(])[-−](\d)", "gu"), &js("$1minus $2"));
    s = rewrite(&s, js_re!(r"±", "gu"), &js(" plus minus "));
    s = rewrite(&s, &r.plus_after_word, &js("$1 plus $2"));
    s = rewrite(&s, &r.plus_initial, &js("$1plus $2"));

    s = rewrite(
        &s,
        js_re!(r"[ \u00a0]*[=≈][ \u00a0]*", "gu"),
        &js(" ass gläich "),
    );
    s = rewrite(
        &s,
        js_re!(r"[ \u00a0]*<[ \u00a0]*", "gu"),
        &js(" méi kleng ewéi "),
    );
    s = rewrite(
        &s,
        js_re!(r"[ \u00a0]*>[ \u00a0]*", "gu"),
        &js(" méi grouss ewéi "),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)[ \u00a0]*×[ \u00a0]*(?=\d)", "gu"),
        &js("$1 mol "),
    );
    s = rewrite(
        &s,
        js_re!(r"[ \u00a0]*÷[ \u00a0]*", "gu"),
        &js(" dividéiert duerch "),
    );
    rewrite(&s, js_re!(r"[ \u00a0]*[&＆][ \u00a0]*", "gu"), &js(" an "))
}
