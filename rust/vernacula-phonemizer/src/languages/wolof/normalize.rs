//! Wolof text normalization: marked clocks, entities and format characters, degrees with the said-after test, dotted
//! lowercase abbreviations, the shared symbol tier, digit grouping, ranges, ordinal tails and decimals.
//! Ported from src/languages/wolof/normalize.ts — see that file for the corpus evidence.

use std::sync::OnceLock;

use crate::core::data_source::load_once;
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{Form, renormalize, rewrite, rewrite_with};
use crate::js_re;

/// `SYMBOLS`'s argument, generated from the object literal in normalize.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it. No `countForm`: the default selector.
const SYMBOL_DATA: &str = r#"{"percent":["ci téeméer"],"currency":{"US$":["dolaar"],"$":["dolaar"]},"magnitudes":["junni-junni","junni","miliyaar","milyaar","bilyoŋ","miliyoŋ","milyioŋ","milyoŋ","milioŋ","milyong","miliari","tamñareet"],"magnitudeConnective":"ciy","units":{"km":["kilomet"],"cm":["sàntimet"],"mm":["milimet"],"kg":["kilogaraam"]},"exponentWords":{"squared":["kaare"],"position":"after"},"ampersand":"ak"}"#;

/// `SYMBOLS`: the shared tier.
pub fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
        make_symbol_normalizer(&data)
    })
}

const DEGREE: &str = "aj";
const SPAN: &str = "ba";

/// `ENTITY[key] ?? e`.
fn entity(key: &JsString) -> Option<&'static str> {
    Some(match key.to_string_lossy().as_str() {
        "&sup2" => "²",
        "&sup3" => "³",
        "&nbsp" => " ",
        "&alpha" => "alpha",
        _ => return None,
    })
}

/// `spell(int, frac)`: the integer, then each fraction digit.
fn spell(int: &JsString, frac: &JsString) -> JsString {
    int.concat(&js(" "))
        .concat(&JsString::join(&frac.code_point_strings(), &js(" ")))
}

/// `saidAfter(full, end, word)`: the word follows within 45 code units, and before the next sign or clause
/// mark (#1597).
fn said_after(full: &JsString, end: usize, word: &str) -> bool {
    let window = full.slice(end as isize, Some(end as isize + 45));
    let window = match js_re!(r"[°º,;]|[.!?](?=\s|$)", "u").exec(&window) {
        Some(m) => window.slice(0, Some(m.index() as isize)),
        None => window,
    };
    JsRegex::new(
        &format!(r"(?<![\p{{L}}\p{{M}}]){word}(?![\p{{L}}\p{{M}}])"),
        "u",
    )
    .unwrap()
    .test(&window)
}

fn g(m: &JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `degree(n, off, len, full)`.
fn degree(m: &JsMatch, full: &JsString) -> JsString {
    let n = g(m, full, 1);
    if said_after(full, m.end(), DEGREE) {
        n
    } else {
        n.concat(&js(&format!(" {DEGREE}")))
    }
}

/// `normalizeWolof(input)`.
pub fn normalize_wolof(input: &JsString) -> JsString {
    let mut s = input.clone();
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![:.\d])(?=[ \u00a0]*(?:ci[ \u00a0]+(?:suba|ngoon)|GMT)(?![\p{L}\p{M}]))",
            "giu"
        ),
        &js("$1 $2"),
    );
    s = renormalize(&s, Form::Nfc);
    s = rewrite(&s, js_re!(r"&amp;", "giu"), &js("&"));
    s = rewrite_with(&s, js_re!(r"&(?:sup2|sup3|nbsp|alpha);?", "giu"), |m, t| {
        let e = m.value(t);
        let key = js("&").concat(
            &js_re!(";", "")
                .replace(&e.slice(1, None), &JsString::new())
                .to_lower_case(),
        );
        entity(&key).map_or(e, js)
    });
    s = rewrite(&s, js_re!(r"\p{Cf}", "gu"), &JsString::new());
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(\d+)[ \u00a0]?°[ \u00a0]?(?=\d)", "gu"),
        |m, t| degree(m, t).concat(&js(" ")),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\d+)[ \u00a0]?[°º](?![\d\p{L}\p{M}])",
            "gu"
        ),
        degree,
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}.])[a-z](?:\.[a-zA-Z]){1,3}\.?(?![\p{L}\p{M}])",
            "gu"
        ),
        |m, full| {
            let run = m.value(full);
            let letters = JsString::join(
                &js_re!(r"\.", "gu")
                    .replace(&run, &JsString::new())
                    .code_point_strings(),
                &js(" "),
            );
            let rest = full.slice(m.end() as isize, None);
            if rest.is_empty()
                || js_re!(r"^[ \u00a0]*$", "u").test(&rest)
                || js_re!(r"^[ \u00a0]+\p{Lu}", "u").test(&rest)
            {
                letters.concat(&js("."))
            } else {
                letters
            }
        },
    );
    s = try_symbols().expect("checked by create_wolof").apply(&s);
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])[1-9]\d{0,2}(?:,\d{3})+(?![\d]|[.,]\d)", "gu"),
        |m, t| js_re!(",", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])[1-9]\d{0,2}(?:\.\d{3})+(?![\d]|[.,]\d)", "gu"),
        |m, t| js_re!(r"\.", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])[1-9]\d{0,2}(?:[ \u00a0\u202f\u2009]\d{3})+(?![\d])",
            "gu"
        ),
        |m, t| js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![-:\d.,\p{L}\p{M}])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-:\d\p{L}\p{M}]|,\d)",
            "gu"
        ),
        |m, full| {
            let (a, b) = (g(m, full, 1), g(m, full, 2));
            let off = m.index() as isize;
            let before = full.slice((off - 3).max(0), Some(off));
            if js_number(&a) < js_number(&b) && !js_re!(r"[·∙×][ \u00a0]*$", "u").test(&before)
            {
                js(&format!(
                    "{} {SPAN} {}",
                    a.to_string_lossy(),
                    b.to_string_lossy()
                ))
            } else {
                m.value(full)
            }
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])", "giu"),
        &js("$1"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,:])0[.,](\d+)(?![\d.,])", "gu"),
        |m, t| spell(&js("0"), &g(m, t, 1)),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,:])(\d+)\.(\d{1,2})(?![\d.,])", "gu"),
        |m, t| spell(&g(m, t, 1), &g(m, t, 2)),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,:])(\d+),(\d{1,2})(?![\d.,])", "gu"),
        |m, t| spell(&g(m, t, 1), &g(m, t, 2)),
    );
    rewrite(
        &rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" ")),
        js_re!(r"^[^\S\n]+|[^\S\n]+$", "gu"),
        &JsString::new(),
    )
}
