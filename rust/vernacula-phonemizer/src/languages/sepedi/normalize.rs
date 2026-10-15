//! Sepedi (nso) text normalization: the shared symbol tier FIRST, then the digit-colon run, dotted capitals, digit
//! grouping, ordinal suffixes, the rand amount, measure units (noun-first, with rates and squares), bare units,
//! degrees, ranges and decimals.
//! Ported from src/languages/sepedi/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::LazyLock;

use super::numbers::N;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{
    SymbolData, SymbolNormalizer, alternation, make_bare_unit_normalizer, make_symbol_normalizer,
    sorted_by_length_desc,
};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `UNIT`, in the TS object's order: key → (citation, counted form).
static UNIT: LazyLock<Vec<(&'static str, String, String)>> = LazyLock::new(|| {
    let tse = &N.class8_concord;
    vec![
        (
            "km",
            "dikhilomithara".to_string(),
            format!("dikhilomithara {tse}"),
        ),
        ("m", "dimithara".to_string(), format!("dimithara {tse}")),
        ("cm", "senthimetara".to_string(), "senthimetara".to_string()),
        (
            "mm",
            "dimilimithara".to_string(),
            format!("dimilimithara {tse}"),
        ),
        (
            "kg",
            "dikhilograma".to_string(),
            format!("dikhilograma {tse}"),
        ),
    ]
});

fn unit(k: &JsString) -> Option<&'static (&'static str, String, String)> {
    UNIT.iter().find(|(key, _, _)| *k == *key)
}

fn squared(k: &JsString) -> Option<String> {
    let tse = &N.class8_concord;
    match k.to_string_lossy().as_str() {
        "km" => Some(format!("disekwere-khilomithara {tse}")),
        "m" => Some(format!("disekwere-mithara {tse}")),
        _ => None,
    }
}

const DENOM: [(&str, &str); 2] = [("h", "iri"), ("s", "motsotswana")];
const PER: &str = "ka";
const CELSIUS: &str = "Celsius";
const UNTIL: &str = "go ya go";

fn compass(c: &JsString) -> &'static str {
    match c.to_string_lossy().as_str() {
        "N" => "leboa",
        "S" => "borwa",
        "E" => "bohlabela",
        "W" => "bodikela",
        _ => "undefined",
    }
}

/// `spell(int, frac)`: the integer, then each fractional digit.
fn spell(int: &JsString, frac: &JsString) -> JsString {
    let digits = JsString::join(&frac.code_point_strings(), &js(" "));
    int.concat(&js(" ")).concat(&digits)
}

fn said_near(full: &JsString, offset: usize, end: usize, word: &str) -> bool {
    full.slice(
        offset.saturating_sub(45) as isize,
        Some((end + 45) as isize),
    )
    .includes(&js(word))
}

/// `SYMBOLS`'s argument: the object literal in normalize.ts, recorded through the fn-diff symbols hook, with the
/// manifest-derived words (`TSE`, `AND`) taken from the manifest rather than hard-coded. No `countForm`.
static SYMBOL_DATA: LazyLock<String> = LazyLock::new(|| {
    let q = |s: &str| serde_json::to_string(s).unwrap();
    let tse = &N.class8_concord;
    let dollar = q(&format!("ditolara {tse}"));
    format!(
        r#"{{"percent":["peresente ye",{}],"percentPrefix":true,"currency":{{"US$":[{dollar}],"$":[{dollar}]}},"currencyPrefix":true,"magnitudes":["dimilione","milione","dibilione","bilione","dipilione","pilione"],"ampersand":{}}}"#,
        q(&format!("diperesente {tse}")),
        q(&N.and)
    )
});

static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let data: SymbolData = serde_json::from_str(&SYMBOL_DATA).map_err(|e| e.to_string())?;
    make_symbol_normalizer(&data)
});

/// The symbol tier, or why it could not be built.
pub fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    SYMBOLS.as_ref().map_err(|e| e.clone())
}

type TextPass = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `BARE_UNIT`: each unit key with its citation form, in the object's order.
static BARE_UNIT: LazyLock<TextPass> = LazyLock::new(|| {
    Box::new(make_bare_unit_normalizer(
        UNIT.iter().map(|(k, cite, _)| (js(k), js(cite))).collect(),
    ))
});

const NOT_VERSION: &str = r"(?<![\d.,])(?!802[.,]11[a-zA-Z](?![a-zA-Z\d]))";
const MAG: &str = "dimilione|milione|dibilione|bilione|dipilione|pilione";

/// The two rand patterns are `String.raw` templates, so their `\u00a0` stays an escape in the pattern.
static RAND_DECIMAL: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}\d])R[ \u00a0]?(\d+\.\d+|\d{{4,}})([ \u00a0](?:{MAG}))?(?![\p{{L}}\p{{M}}\d])"
        ),
        "giu",
    )
    .unwrap()
});
static RAND_MAGNITUDE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}\d])R[ \u00a0]?(\d+)([ \u00a0](?:{MAG}))(?![\p{{L}}\p{{M}}\d])"
        ),
        "giu",
    )
    .unwrap()
});

/// The measure-unit pattern: a cooked template, so its NBSP / NNBSP / thin space are literal characters.
static UNIT_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let unit_alt = alternation(&sorted_by_length_desc(UNIT.iter().map(|(k, _, _)| js(k))));
    let denom_alt = alternation(&sorted_by_length_desc(
        UNIT.iter()
            .map(|(k, _, _)| js(k))
            .chain(DENOM.iter().map(|(k, _)| js(k))),
    ));
    JsRegex::new(
        &format!(
            "{NOT_VERSION}(\\d+(?:[ \u{a0}\u{202f}\u{2009}]\\d{{3}}(?!\\d)|[.,]\\d+)*)(?![\\d.,])[ \u{a0}\u{202f}\u{2009}]?({unit_alt})(?:[ \u{a0}\u{202f}\u{2009}]?/[ \u{a0}\u{202f}\u{2009}]?({denom_alt})|[ \u{a0}\u{202f}\u{2009}]?(²|³|(?<=[a-zA-Z])[23](?![\\d\\p{{L}}])))?(?![\\p{{L}}\\p{{M}}\\d'’ʼ])"
        ),
        "giu",
    )
    .unwrap()
});

/// `normalizeSepedi(input)`.
pub fn normalize_sepedi(input: &JsString) -> JsString {
    let symbols = try_symbols().unwrap_or_else(|e| panic!("{e}"));
    let mut s = symbols.apply(input);
    let tse = &N.class8_concord;
    let rand = format!("diranta {tse}");

    // 0
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d:])(\d{1,2})((?::\d{2})+)(?![\d])", "gu"),
        |m, s| {
            let rest = js_re!(":", "gu").replace(&m.group(2, s).unwrap(), &js(" "));
            m.group(1, s).unwrap().concat(&rest)
        },
    );

    // 1
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(?:\p{Lu}\.[ \u00a0]?){2,}(?:\p{Lu}(?![\p{L}\p{M}]))?",
            "gu"
        ),
        |m, full| {
            let run = m.value(full);
            let bare = js_re!(r"[. \u00a0]", "gu").replace(&run, &JsString::new());
            let letters = JsString::join(&bare.code_point_strings(), &js("-"));
            let rest = full.slice(m.end() as isize, None);
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

    // 2
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])[1-9]\d{0,2}(?:,\d{3}){1,4}(?!\d|[.,]\d)", "gu"),
        |m, s| js_re!(",", "gu").replace(&m.value(s), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])[1-9]\d{0,2}(?:\.\d{3}){1,4}(?!\d|[.,]\d)",
            "gu"
        ),
        |m, s| js_re!(r"\.", "gu").replace(&m.value(s), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])[1-9]\d{0,2}(?:[ \u00a0\u202f\u2009]\d{3}){1,4}(?!\d)",
            "gu"
        ),
        |m, s| js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&m.value(s), &JsString::new()),
    );

    // 3
    s = rewrite(
        &s,
        js_re!(r"(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])", "giu"),
        &js("$1"),
    );

    // 4
    s = rewrite_with(&s, &RAND_DECIMAL, |m, s| {
        js(&rand)
            .concat(&m.group(2, s).unwrap_or_default())
            .concat(&js(" "))
            .concat(&m.group(1, s).unwrap())
    });
    s = rewrite_with(&s, &RAND_MAGNITUDE, |m, s| {
        js(&rand)
            .concat(&m.group(2, s).unwrap())
            .concat(&js(" "))
            .concat(&m.group(1, s).unwrap())
    });

    // 5
    s = rewrite_with(&s, &UNIT_RE, |m, s| {
        let num = m.group(1, s).unwrap();
        let k = m.group(2, s).unwrap().to_lower_case();
        let Some((_, cite, counted)) = unit(&k) else {
            return m.value(s);
        };
        let head = if js_number(&num) == 1.0 {
            cite
        } else {
            counted
        };
        if let Some(denom) = m.group(3, s) {
            let dl = denom.to_lower_case();
            let d_word = DENOM
                .iter()
                .find(|(k, _)| dl == *k)
                .map(|(_, w)| w.to_string())
                .or_else(|| unit(&dl).map(|(_, c, _)| c.clone()));
            return match d_word {
                None => m.value(s),
                Some(w) => js(&format!("{head} "))
                    .concat(&num)
                    .concat(&js(&format!(" {PER} {w}"))),
            };
        }
        if let Some(exp) = m.group(4, s) {
            if exp == "³" || exp == "3" {
                return m.value(s);
            }
            return match squared(&k) {
                None => m.value(s),
                Some(sq) => js(&format!("{sq} ")).concat(&num),
            };
        }
        js(&format!("{head} ")).concat(&num)
    });

    // 6
    s = BARE_UNIT(&s);

    // 7
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?[°º][ \u00a0]?C(?![\p{L}\p{M}])",
            "gui"
        ),
        |m, s| {
            let n = m.group(1, s).unwrap();
            if said_near(s, m.index(), m.end(), CELSIUS) {
                n
            } else {
                n.concat(&js(&format!(" {CELSIUS}")))
            }
        },
    );
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?[°º][ \u00a0]?F(?![\p{L}\p{M}])",
            "gui"
        ),
        &js("$1"),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?[°º][ \u00a0]?([NSEW])(?![\p{L}\p{M}])",
            "gu"
        ),
        |m, s| {
            m.group(1, s)
                .unwrap()
                .concat(&js(&format!(" {}", compass(&m.group(2, s).unwrap()))))
        },
    );
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\d+(?:[.,]\d+)?)[ \u00a0]?[°º](?![\p{L}\p{M}])",
            "gu"
        ),
        &js("$1"),
    );

    // 8
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![-–—\d.,\p{L}\p{M}])(?<![-–—][ \u00a0])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-–—\d\p{L}\p{M}]|[.,]\d)(?![ \u00a0][-–—])",
            "gu"
        ),
        |m, s| {
            let (a, b) = (m.group(1, s).unwrap(), m.group(2, s).unwrap());
            if a.len().abs_diff(b.len()) >= 2 {
                m.value(s)
            } else {
                a.concat(&js(&format!(" {UNTIL} "))).concat(&b)
            }
        },
    );

    // 9
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d{1,2})(?![\d])", "gu"),
        |m, s| spell(&m.group(1, s).unwrap(), &m.group(2, s).unwrap()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+),(\d{1,2})(?![\d,])", "gu"),
        |m, s| spell(&m.group(1, s).unwrap(), &m.group(2, s).unwrap()),
    );

    rewrite(
        &rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" ")),
        js_re!(r"^[^\S\n]+|[^\S\n]+$", "gu"),
        &JsString::new(),
    )
}
