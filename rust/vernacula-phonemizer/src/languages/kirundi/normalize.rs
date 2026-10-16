//! Kirundi (rn) text normalization: dotted initialisms, dotted dates, pre-posed units, de-grouping, ranges (years
//! as `kuva … gushika`, degree spans with `na`), degrees, the percent word, the shared symbol tier, per-unit
//! rates, clocks and decimals. Pure text to text.
//! Ported from src/languages/kirundi/normalize.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::manifest::MANIFEST;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{
    ExponentPosition, ExponentWords, PositionDecl, SymbolData, SymbolNormalizer,
    make_symbol_normalizer,
};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const NB: &str = "\u{a0}";
const NNB: &str = "\u{202f}";
const THIN: &str = "\u{2009}";

/// `UNIT` and `UNIT_SG`. Generated from normalize.ts's object literals (key order preserved).
const UNIT: [(&str, &str); 2] = [("km", "ibirometero"), ("mm", "milimetero")];
const UNIT_SG: [(&str, &str); 2] = [("km", "kirometero"), ("mm", "milimetero")];

/// `table[key]`; a miss is the TS `undefined`, which a template literal writes as the word (#1122).
fn lookup(table: &[(&str, &'static str)], key: &JsString) -> &'static str {
    table
        .iter()
        .find(|(k, _)| js(k) == *key)
        .map_or("undefined", |(_, w)| *w)
}

const SQUARED: &str = "kwadarato";
const DEGREE: &str = "dogere";
const DOLLAR: &str = "amadorari";
const FROM: &str = "kuva";
const UNTIL: &str = "gushika";
const UNTIL_AT: &str = "gushika kuri";
const PER: &str = "kuri";

/// `exponentPhrase(noun, exp)`.
fn exponent_phrase(noun: &str, exp: Option<JsString>) -> JsString {
    match exp {
        None => js(noun),
        Some(e) if e == js("³") || e == js("3") => js(&format!("{noun}³")),
        Some(_) => js(&format!("{noun} {SQUARED}")),
    }
}

/// `SYMBOLS`, or why the tier refused its data.
pub(crate) fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<Result<SymbolNormalizer, String>> = OnceLock::new();
    S.get_or_init(|| {
        let currency: IndexMap<String, Vec<String>> = ["US$", "$"]
            .iter()
            .map(|k| (k.to_string(), vec![DOLLAR.to_string()]))
            .collect();
        make_symbol_normalizer(&SymbolData {
            percent: Some(vec!["kw'ijana".to_string()]),
            currency: Some(currency),
            currency_prefix: Some(true),
            units: Some(
                UNIT.iter()
                    .map(|(k, w)| (k.to_string(), vec![w.to_string()]))
                    .collect(),
            ),
            unit_prefix: Some(true),
            exponent_words: Some(ExponentWords {
                squared: Some(vec![SQUARED.to_string()]),
                cubed: None,
                position: Some(PositionDecl::All(ExponentPosition::After)),
            }),
            ampersand: Some(MANIFEST.numbers.and.clone()),
            ..Default::default()
        })
    })
    .as_ref()
    .map_err(|e| e.clone())
}

/// `spell(int, frac)`: the fraction digit by digit.
fn spell(int: &JsString, frac: &JsString) -> JsString {
    int.concat(&js(" "))
        .concat(&JsString::join(&frac.code_point_strings(), &js(" ")))
}

/// `saidNear(full, offset, end, word)`.
fn said_near(full: &JsString, offset: usize, end: usize, word: &str) -> bool {
    full.slice(
        offset.saturating_sub(45) as isize,
        Some((end + 45) as isize),
    )
    .includes(&js(word))
}

/// `Object.keys(table).sort(length desc).join("|")` (a stable sort).
fn alt(table: &[(&str, &str)]) -> String {
    let mut keys: Vec<&str> = table.iter().map(|(k, _)| *k).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.len()));
    keys.join("|")
}

static PRE_UNIT_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let pre = alt(&UNIT);
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}\d])({pre})(²|³|(?<=[a-zA-Z])[23](?![\d\p{{L}}]))?(?=[ {NB}{NNB}{THIN}]\d)"
        ),
        "giu",
    )
    .unwrap()
});

static AFTER_DEGREE_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<={DEGREE}[ {NB}])(\d+)[ {NB}]?[-–—/][ {NB}]?(\d+)(?![\d.,:/])"),
        "giu",
    )
    .unwrap()
});

static DENOM_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let du = alt(&UNIT_SG);
    JsRegex::new(
        &format!(r"/[ {NB}]?({du})(²|³|(?<=[a-zA-Z])[23](?![\d\p{{L}}]))?(?![\p{{L}}\p{{M}}\d'’])"),
        "giu",
    )
    .unwrap()
});

/// `isYear(a, b)`.
fn is_year(a: &JsString, b: &JsString) -> bool {
    js_re!(r"^\d{4}$", "u").test(a) && js_re!(r"^\d{4}$", "u").test(b)
}

/// `join(a, b, full, off, dash)`.
fn join(a: &JsString, b: &JsString, full: &JsString, off: usize, dash: bool) -> JsString {
    if dash && is_year(a, b) {
        let before = full.slice(off.saturating_sub(14) as isize, Some(off as isize));
        let from = if js_re!(r"(?:kuva|guhera)\s\S{0,10}\s*$", "iu").test(&before) {
            String::new()
        } else {
            format!("{FROM} ")
        };
        js(&from)
            .concat(a)
            .concat(&js(&format!(" {UNTIL} ")))
            .concat(b)
    } else {
        a.concat(&js(&format!(" {UNTIL_AT} "))).concat(b)
    }
}

/// `spanDeg(a, b)`.
fn span_deg(a: &JsString, b: &JsString) -> JsString {
    a.concat(&js(&format!(" {} ", MANIFEST.numbers.and)))
        .concat(b)
}

/// `spellDec(n)`.
fn spell_dec(n: &JsString) -> JsString {
    match js_re!(r"^(\d+)[.,](\d+)$", "u").exec(n) {
        Some(m) => spell(&m.group(1, n).unwrap(), &m.group(2, n).unwrap()),
        None => n.clone(),
    }
}

/// `degreeBody(sign, n, off, end, full)`.
fn degree_body(sign: &JsString, n: &JsString, off: usize, end: usize, full: &JsString) -> JsString {
    let lead = if said_near(full, off, end, DEGREE) {
        String::new()
    } else {
        format!("{DEGREE} ")
    };
    js(&lead).concat(sign).concat(&spell_dec(n))
}

/// `normalizeKirundi(input)`. The steps are order-dependent.
pub(crate) fn normalize_kirundi(input: &JsString) -> JsString {
    let mut s = input.clone();

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(?:\p{Lu}\.[ \u00a0]?){2,}(?:\p{Lu}(?![\p{L}\p{M}]))?",
            "gu"
        ),
        |m, full| {
            let run = m.value(full);
            let letters = js_re!(r"[. \u00a0]", "gu").replace(&run, &JsString::new());
            let rest = full.slice((m.index() + run.len()) as isize, None);
            if js_re!(r"^[\p{L}\p{M}]", "u").test(&rest) {
                return letters.concat(&js(" "));
            }
            if !run.ends_with(&js(".")) {
                return letters;
            }
            if rest.is_empty() || js_re!(r"^[ \u00a0]+\p{Lu}", "u").test(&rest) {
                letters.concat(&js("."))
            } else {
                letters
            }
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d{1,2})\.(\d{1,2})\.(\d{4})(?![\d.,])", "gu"),
        &js("$1 $2 $3"),
    );
    s = rewrite_with(&s, &PRE_UNIT_RE, |m, t| {
        exponent_phrase(
            lookup(&UNIT, &m.group(1, t).unwrap().to_lower_case()),
            m.group(2, t),
        )
    });
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])[1-9]\d{0,2}(?:,\d{3})+(?!\d|,\d)", "gu"),
        |m, t| js_re!(r",", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])[1-9]\d{0,2}(?:\.\d{3})+(?!\d|[.,]\d)", "gu"),
        |m, t| js_re!(r"\.", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])[1-9]\d{0,2}(?:[ \u00a0\u202f\u2009]\d{3})+(?!\d)",
            "gu"
        ),
        |m, t| js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&m.value(t), &JsString::new()),
    );

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d.,:/-])(\d+)[ \u00a0]?[-–—/][ \u00a0]?(\d+)[ \u00a0]?°[ \u00a0]?[CF]?(?![\p{L}\p{M}])",
            "gui"
        ),
        |m, full| {
            let (a, b) = (m.group(1, full).unwrap(), m.group(2, full).unwrap());
            if js_number(&a) < js_number(&b) {
                let lead = if said_near(full, m.index(), m.end(), DEGREE) {
                    String::new()
                } else {
                    format!("{DEGREE} ")
                };
                js(&lead).concat(&span_deg(&a, &b))
            } else {
                m.value(full)
            }
        },
    );
    s = rewrite_with(&s, &AFTER_DEGREE_RE, |m, t| {
        let (a, b) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
        if js_number(&a) < js_number(&b) {
            span_deg(&a, &b)
        } else {
            m.value(t)
        }
    });
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,:/])(\d+)[ \u00a0]?\/[ \u00a0]?(\d+)(?![\d.,]*[/:])",
            "gu"
        ),
        |m, full| {
            let (a, b) = (m.group(1, full).unwrap(), m.group(2, full).unwrap());
            if js_number(&a) < js_number(&b) {
                join(&a, &b, full, m.index(), false)
            } else {
                m.value(full)
            }
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![-\d.,\p{L}\p{M}])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-\d\p{L}\p{M}]|[.,]\d)",
            "gu"
        ),
        |m, full| {
            let (a, b) = (m.group(1, full).unwrap(), m.group(2, full).unwrap());
            if js_number(&a) < js_number(&b) {
                join(&a, &b, full, m.index(), true)
            } else {
                m.value(full)
            }
        },
    );

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d])([-−–]?)(\d+(?:[.,]\d+)?)[ \u00a0]?°[ \u00a0]?[CF](?![\p{L}\p{M}])",
            "gui"
        ),
        |m, full| {
            degree_body(
                &m.group(1, full).unwrap(),
                &m.group(2, full).unwrap(),
                m.index(),
                m.end(),
                full,
            )
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d])([-−–]?)(\d+(?:[.,]\d+)?)[ \u00a0]?°(?=[ \u00a0]?\d+[′'])",
            "gu"
        ),
        |m, full| {
            degree_body(
                &m.group(1, full).unwrap(),
                &m.group(2, full).unwrap(),
                m.index(),
                m.end(),
                full,
            )
            .concat(&js(" "))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d])([-−–]?)(\d+(?:[.,]\d+)?)[ \u00a0]?[°º](?![\p{L}\p{M}])",
            "gu"
        ),
        |m, full| {
            degree_body(
                &m.group(1, full).unwrap(),
                &m.group(2, full).unwrap(),
                m.index(),
                m.end(),
                full,
            )
        },
    );
    s = rewrite_with(&s, js_re!(r"(\d)[ \u00a0]?%", "gu"), |m, full| {
        let win = full.slice(
            m.index().saturating_sub(45) as isize,
            Some((m.end() + 45) as isize),
        );
        if js_re!(r"kw['’]ijana", "iu").test(&win) {
            m.group(1, full).unwrap()
        } else {
            m.value(full)
        }
    });

    s = try_symbols().unwrap_or_else(|e| panic!("{e}")).apply(&s);

    s = rewrite_with(&s, &DENOM_RE, |m, t| {
        js(&format!(" {PER} ")).concat(&exponent_phrase(
            lookup(&UNIT_SG, &m.group(1, t).unwrap().to_lower_case()),
            m.group(2, t),
        ))
    });
    s = rewrite(
        &s,
        js_re!(r"(?<![\d:])(\d{1,2}):[ \u00a0]?(\d{2})(?![:\d])", "gu"),
        &js("$1 $2"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?!\d|[.,]\d)", "gu"), // any tail (#1595)
        |m, t| spell(&m.group(1, t).unwrap(), &m.group(2, t).unwrap()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+),(\d{1,2})(?!\d|[.,]\d)", "gu"),
        |m, t| spell(&m.group(1, t).unwrap(), &m.group(2, t).unwrap()),
    );

    let s = rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" "));
    rewrite(&s, js_re!(r"^[^\S\n]+|[^\S\n]+$", "gu"), &JsString::new())
}
