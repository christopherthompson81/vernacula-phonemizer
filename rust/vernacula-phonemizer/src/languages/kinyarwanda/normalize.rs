//! Kinyarwanda (rw) text normalization: dotted initialisms, de-grouping, pre-posed units, degrees, clocks,
//! ranges as `kugeza kuri`, the shared symbol tier, per-unit rates, exponents and decimals. Pure text to text.
//! Ported from src/languages/kinyarwanda/normalize.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::manifest::MANIFEST;
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::normalize_symbols::{
    ExponentPosition, ExponentWords, PositionDecl, SymbolData, SymbolNormalizer, UnitPer,
    make_symbol_normalizer,
};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const NB: &str = "\u{a0}";
const NNB: &str = "\u{202f}";
const THIN: &str = "\u{2009}";

/// `UNIT`. Generated from normalize.ts's object literal (key order preserved).
const UNIT: [(&str, &str); 11] = [
    ("km", "kilometero"),
    ("m", "metero"),
    ("cm", "santimetero"),
    ("mm", "milimetero"),
    ("kg", "kirogarama"),
    ("g", "garama"),
    ("gm", "garama"),
    ("gr", "garama"),
    ("ml", "mililitiro"),
    ("l", "litiro"),
    ("ha", "hegitari"),
];

/// `UNIT[key]`; a miss is the TS `undefined`, which a template literal writes as the word (#1122).
fn unit(key: &JsString) -> &'static str {
    UNIT.iter()
        .find(|(k, _)| js(k) == *key)
        .map_or("undefined", |(_, w)| *w)
}

const SQUARED: &str = "kare";
const CUBED: &str = "kibe";
const DEGREE: &str = "dogere";
const CELSIUS: &str = "selisiyusi";

/// `COMPASS`.
fn compass(c: &JsString) -> &'static str {
    match c.to_string_lossy().as_str() {
        "N" => "amajyaruguru",
        "S" => "amajyepfo",
        "E" => "iburasirazuba",
        _ => "uburengerazuba",
    }
}

const HOUR_MARKER: &str = "saa";
const MINUTES: &str = "iminota";
const HOURS: &str = "amasaha";
const SECONDS: &str = "amasegonda";
const TZ: &str = "UTC|GMT|CAT|EAT|WAT|CET|EST|BST";

/// `INSERTED`: the sentinel ahead of an inserted degree word, taken off the pipeline string after the degrees.
const INSERTED: &str = "\u{0}";

/// `SYMBOLS`, or why the tier refused its data.
pub(crate) fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<Result<SymbolNormalizer, String>> = OnceLock::new();
    S.get_or_init(|| {
        let money = |w: &str| vec![w.to_string()];
        let currency: IndexMap<String, Vec<String>> = [
            ("US$", "amadolari"),
            ("$", "amadolari"),
            ("FRw", "amafaranga y'u Rwanda"),
            ("Frw", "amafaranga y'u Rwanda"),
            ("RWF", "amafaranga y'u Rwanda"),
            ("Rwf", "amafaranga y'u Rwanda"),
        ]
        .iter()
        .map(|(k, w)| (k.to_string(), money(w)))
        .collect();
        make_symbol_normalizer(&SymbolData {
            percent: Some(vec!["ku ijana".to_string()]),
            currency: Some(currency),
            currency_prefix: Some(true),
            magnitudes: Some(
                ["miliyari", "miliyoni", "igihumbi", "ibihumbi"]
                    .iter()
                    .map(|s| s.to_string())
                    .collect(),
            ),
            magnitude_precedes: Some(true),
            units: Some(
                UNIT.iter()
                    .map(|(k, w)| (k.to_string(), vec![w.to_string()]))
                    .collect(),
            ),
            unit_prefix: Some(true),
            unit_per: Some(UnitPer::All("kuri".to_string())),
            exponent_words: Some(ExponentWords {
                squared: Some(vec![SQUARED.to_string()]),
                cubed: Some(vec![CUBED.to_string()]),
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

/// `full.replaceAll(INSERTED + word, "")`.
fn replace_all(s: &JsString, pat: &JsString) -> JsString {
    JsString::join(&s.split(pat), &JsString::new())
}

/// `saidNear(full, offset, end, word)`: the word is already written within 45 units, not counting an insertion.
fn said_near(full: &JsString, offset: usize, end: usize, word: &str) -> bool {
    let win = full.slice(
        offset.saturating_sub(45) as isize,
        Some((end + 45) as isize),
    );
    replace_all(&win, &js(&format!("{INSERTED}{word}"))).includes(&js(word))
}

/// `` `${Number(x)}` ``.
fn num_str(x: &JsString) -> JsString {
    js(&js_number_to_string(js_number(x)))
}

/// The ` kare` / ` kibe` modifier of an optional exponent group.
fn exp_mod(exp: Option<JsString>) -> String {
    match exp {
        None => String::new(),
        Some(e) if e == js("²") || e == js("2") => format!(" {SQUARED}"),
        Some(_) => format!(" {CUBED}"),
    }
}

/// `spellDec(n)`.
fn spell_dec(n: &JsString) -> JsString {
    match js_re!(r"^(\d+)[.,](\d+)$", "u").exec(n) {
        Some(m) => spell(&m.group(1, n).unwrap(), &m.group(2, n).unwrap()),
        None => n.clone(),
    }
}

/// `degreeBody(n, off, end, full, scale)`.
fn degree_body(n: &JsString, off: usize, end: usize, full: &JsString, scale: &str) -> JsString {
    let lead = if said_near(full, off, end, DEGREE) {
        String::new()
    } else {
        format!("{INSERTED}{DEGREE} ")
    };
    js(&format!("{lead}{scale}")).concat(&spell_dec(n))
}

/// `sc?.toUpperCase() === "C" ? `${CELSIUS} ` : ""`.
fn scale_of(sc: Option<JsString>) -> String {
    if sc.is_some_and(|c| c.to_upper_case() == js("C")) {
        format!("{CELSIUS} ")
    } else {
        String::new()
    }
}

/// `Object.keys(UNIT).filter(f).sort(length desc).join("|")` (a stable sort).
fn unit_alt(f: impl Fn(&str) -> bool) -> String {
    let mut keys: Vec<&str> = UNIT.iter().map(|(k, _)| *k).filter(|k| f(k)).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.len()));
    keys.join("|")
}

static ADD_RE: LazyLock<[JsRegex; 2]> = LazyLock::new(|| {
    let not_coord = format!("(?![ {NB}{NNB}{THIN}]?[°º])");
    [
        JsRegex::new(
            &format!(r"(?<![\d.,])[1-9]\d{{0,2}}(?:,\d{{3}})+(?!\d|[.,]\d){not_coord}"),
            "gu",
        )
        .unwrap(),
        JsRegex::new(
            &format!(r"(?<![\d.,])[1-9]\d{{0,2}}(?:\.\d{{3}})+(?!\d|[.,]\d){not_coord}"),
            "gu",
        )
        .unwrap(),
    ]
});

static PRE_UNIT_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let pre = unit_alt(|k| k.len() > 1 || k == "m");
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}\d])({pre})(²|³|(?<=[a-zA-Z])[23](?![\d\p{{L}}]))?(?=[ {NB}]\d)"
        ),
        "giu",
    )
    .unwrap()
});

static CLOCK_RE: LazyLock<[JsRegex; 2]> = LazyLock::new(|| {
    [
        JsRegex::new(
            &format!(
                r"(?<![\p{{L}}\p{{M}}\d])({HOUR_MARKER})[ {NB}]+([01]?\d|2[0-3]):[ {NB}]?([0-5]\d)(?![:.\d])"
            ),
            "giu",
        )
        .unwrap(),
        JsRegex::new(
            &format!(r"(?<![\d:])(\d{{1,2}}):(\d{{2}}):(\d{{2}})(?=[ {NB}]*(?:{TZ})(?![\p{{L}}\p{{M}}]))"),
            "gu",
        )
        .unwrap(),
    ]
});

static RANGE_UNIT_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let ru = unit_alt(|_| true);
    JsRegex::new(
        &format!(
            r"(?<![-\d.,\p{{L}}\p{{M}}])(\d+)[ {NB}]?[-–—][ {NB}]?(\d+)[ {NB}]?({ru})(²|³|(?<=[a-zA-Z])[23](?![\d\p{{L}}]))?(?![\p{{L}}\p{{M}}\d'’])"
        ),
        "gu",
    )
    .unwrap()
});

static DENOM_RE: LazyLock<[JsRegex; 2]> = LazyLock::new(|| {
    let du = unit_alt(|k| k.len() > 1);
    [
        JsRegex::new(
            &format!(
                r"/[ {NB}]?({du})(²|³|(?<=[a-zA-Z])[23](?![\d\p{{L}}]))?(?![\p{{L}}\p{{M}}\d'’])"
            ),
            "giu",
        )
        .unwrap(),
        JsRegex::new(
            &format!(r"(?<![\p{{L}}\p{{M}}\d])({du}|m)(²|³)(?![\p{{L}}\p{{M}}\d'’])"),
            "giu",
        )
        .unwrap(),
    ]
});

/// `(a, b) => Number(a) < Number(b) ? <ascending> : whole`.
fn ascending(m: &JsMatch, t: &JsString) -> Option<(JsString, JsString)> {
    let (a, b) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
    (js_number(&a) < js_number(&b)).then_some((a, b))
}

/// `normalizeKinyarwanda(input)`. The steps are order-dependent.
pub(crate) fn normalize_kinyarwanda(input: &JsString) -> JsString {
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

    s = rewrite_with(&s, &ADD_RE[0], |m, t| {
        js_re!(r",", "gu").replace(&m.value(t), &JsString::new())
    });
    s = rewrite_with(&s, &ADD_RE[1], |m, t| {
        js_re!(r"\.", "gu").replace(&m.value(t), &JsString::new())
    });
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])[1-9]\d{0,2}(?:[ \u00a0\u202f\u2009]\d{3})+(?!\d)",
            "gu"
        ),
        |m, t| js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&m.value(t), &JsString::new()),
    );

    s = rewrite_with(&s, &PRE_UNIT_RE, |m, t| {
        let noun = unit(&m.group(1, t).unwrap().to_lower_case());
        js(&format!("{noun}{}", exp_mod(m.group(2, t))))
    });

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d])[-−–][ \u00a0]?(\d+(?:[.,]\d+)?)[ \u00a0]?°[ \u00a0]?([CF])(?![\p{L}\p{M}])",
            "gui"
        ),
        |m, full| {
            let (off, end) = (m.index(), m.end());
            degree_body(
                &m.group(1, full).unwrap(),
                off,
                end,
                full,
                &scale_of(m.group(2, full)),
            )
            .concat(&js(&format!(" munsi ya {}", MANIFEST.numbers.units[0])))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d.,-])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)[ \u00a0]?°[ \u00a0]?([CF])?(?![\p{L}\p{M}])",
            "gui"
        ),
        |m, full| match ascending(m, full) {
            Some((a, b)) => degree_body(&a, m.index(), m.end(), full, &scale_of(m.group(3, full)))
                .concat(&js(" kugeza kuri "))
                .concat(&b),
            None => m.value(full),
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?°[ \u00a0]?([CF])(?![\p{L}\p{M}])",
            "gui"
        ),
        |m, full| {
            degree_body(
                &m.group(1, full).unwrap(),
                m.index(),
                m.end(),
                full,
                &scale_of(m.group(2, full)),
            )
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r#"(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?°((?:[ \u00a0]?\d+[′'][ \u00a0]?)?(?:\d+[″"][ \u00a0]?)?)[ \u00a0]?([NSEW])(?![\p{L}\p{M}])"#,
            "gu"
        ),
        |m, full| {
            degree_body(&m.group(1, full).unwrap(), m.index(), m.end(), full, "")
                .concat(&js(" "))
                .concat(&m.group(2, full).unwrap())
                .concat(&js(compass(&m.group(3, full).unwrap())))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?[°º](?![\p{L}\p{M}])",
            "gu"
        ),
        |m, full| degree_body(&m.group(1, full).unwrap(), m.index(), m.end(), full, ""),
    );
    s = rewrite(&s, js_re!(r"\u0000", "gu"), &JsString::new());

    s = rewrite_with(&s, &CLOCK_RE[0], |m, t| {
        let (mark, h, mi) = (
            m.group(1, t).unwrap(),
            m.group(2, t).unwrap(),
            m.group(3, t).unwrap(),
        );
        let head = mark.concat(&js(" ")).concat(&num_str(&h));
        if js_number(&mi) == 0.0 {
            head
        } else {
            head.concat(&js(&format!(" {} {MINUTES} ", MANIFEST.numbers.and)))
                .concat(&num_str(&mi))
        }
    });
    s = rewrite(&s, &CLOCK_RE[1], &js("$1 $2 $3"));
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:.])(\d{1,2}):[ \u00a0]?(\d{2}):[ \u00a0]?(\d{2})(?![:.\d])",
            "gu"
        ),
        |m, t| {
            js(&format!("{HOURS} "))
                .concat(&num_str(&m.group(1, t).unwrap()))
                .concat(&js(&format!(" {MINUTES} ")))
                .concat(&num_str(&m.group(2, t).unwrap()))
                .concat(&js(&format!(" {SECONDS} ")))
                .concat(&num_str(&m.group(3, t).unwrap()))
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\d:])(\d{1,2}):[ \u00a0]?(\d{2})(?![:\d])", "gu"),
        &js("$1 $2"),
    );

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+)[ \u00a0]?%[ \u00a0]?[-–—][ \u00a0]?(\d+)[ \u00a0]?%",
            "gu"
        ),
        |m, t| match ascending(m, t) {
            Some((a, b)) => a.concat(&js(" kugeza kuri ")).concat(&b).concat(&js("%")),
            None => m.value(t),
        },
    );
    s = rewrite_with(&s, &RANGE_UNIT_RE, |m, t| match ascending(m, t) {
        None => m.value(t),
        Some((a, b)) => {
            let noun = unit(&m.group(3, t).unwrap());
            js(&format!("{noun}{} ", exp_mod(m.group(4, t))))
                .concat(&a)
                .concat(&js(" kugeza kuri "))
                .concat(&b)
        }
    });
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![-\d.,\p{L}\p{M}])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-\d\p{L}\p{M}]|[.,]\d)",
            "gu"
        ),
        |m, t| match ascending(m, t) {
            Some((a, b)) => a.concat(&js(" kugeza kuri ")).concat(&b),
            None => m.value(t),
        },
    );

    s = try_symbols().unwrap_or_else(|e| panic!("{e}")).apply(&s);

    s = rewrite_with(&s, &DENOM_RE[0], |m, t| {
        let noun = unit(&m.group(1, t).unwrap().to_lower_case());
        js(&format!(" kuri {noun}{}", exp_mod(m.group(2, t))))
    });
    s = rewrite_with(&s, &DENOM_RE[1], |m, t| {
        let noun = unit(&m.group(1, t).unwrap().to_lower_case());
        let e = if m.group(2, t).unwrap() == js("²") {
            SQUARED
        } else {
            CUBED
        };
        js(&format!("{noun} {e}"))
    });

    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d{1,2})(?!\d|[.,]\d)", "gu"),
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
