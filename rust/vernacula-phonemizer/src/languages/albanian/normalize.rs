//! Albanian (sq) text normalization: ASCII km exponents, digit grouping, ranges, per mille, the shared symbol
//! tier, degrees, signs and the decimal (`presja`) rewritten into words.
//! Ported from src/languages/albanian/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::{Arc, LazyLock};

use crate::core::js_regex::JsMatch;
use crate::core::js_string::{JsString, js};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const DEGREE: &str = "gradë";
const DECIMAL_WORD: &str = "presja";

/// `countForm`: n === 1 → 0, else 1.
fn count_form(n: f64) -> f64 {
    if n == 1.0 { 0.0 } else { 1.0 }
}

/// `SYMBOLS`'s argument, generated from the object literal in normalize.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it; `countForm` is set below.
const SYMBOL_DATA: &str = r#"{"percent":["për qind","për qind"],"currency":{"US$":["dollar amerikan","dollarë amerikanë"],"$":["dollar","dollarë"],"€":["euro","euro"],"£":["paund","paundë"]},"units":{"km":["kilometër","kilometra"],"m":["metër","metra"],"cm":["centimetër","centimetra"],"mm":["milimetër","milimetra"],"kg":["kilogram","kilogramë"],"mb":["megabajt","megabajt"],"mhz":["megaherc","megaherc"]},"magnitudes":["miliardë","miliard","milionë","milion","mijë"],"rateDenominators":{"h":"orë","s":"sekonda"},"unitPer":"në","exponentWords":{"squared":["katrorë"],"cubed":["kubikë"],"position":"after"},"multiply":{"times":"herë"},"ampersand":"dhe"}"#;

static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let mut data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
    data.count_form = Some(Arc::new(count_form));
    make_symbol_normalizer(&data)
});

/// The symbol tier, or why it could not be built.
pub fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    SYMBOLS.as_ref().map_err(|e| e.clone())
}

fn g(m: &JsMatch, i: usize, s: &JsString) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `degrees(text)`: the figure, the degree word (with its named scale unless the text already says it), and a
/// space when a letter follows. `rest` is `full.slice(offset + whole.length)`.
fn degrees(text: &JsString) -> JsString {
    rewrite_with(
        text,
        js_re!(
            r"(\d+(?:[.,]\d+)?)\s*°(?:\s*([CF])(?![\p{L}\p{M}]))?",
            "gui"
        ),
        |m, full| {
            let rest = full.slice(m.end() as isize, None);
            let named = m.group(2, full).map(|sc| {
                if sc.to_upper_case() == "C" {
                    "Celsius"
                } else {
                    "Fahrenheit"
                }
            });
            let already_said = js_re!(r"^\s*(?:Celsius|Fahrenheit)\b", "iu").test(&rest);
            let word = match named {
                Some(nm) if !already_said => format!("{DEGREE} {nm}"),
                _ => DEGREE.to_string(),
            };
            let fuses = js_re!(r"^[\p{L}\p{M}]", "u").test(&rest);
            g(m, 1, full)
                .concat(&js(&format!(" {word}")))
                .concat(&js(if fuses { " " } else { "" }))
        },
    )
}

fn signs(text: &JsString) -> JsString {
    let s = rewrite(
        text,
        js_re!(r"(?<![\d\p{L}])\+\s?(?=\d)", "gu"),
        &js("plus "),
    );
    let s = rewrite(
        &s,
        js_re!(r"(?<![\d\p{L}])[−–-](?=\d)", "gu"),
        &js("minus "),
    );
    let s = rewrite(
        &s,
        js_re!(
            r"(?<![=!<>])(?<=[\d\p{L}\p{M})])\s*=\s*(?=[\d\p{L}(])(?![=<>])",
            "gu"
        ),
        &js(" barabart "),
    );
    let s = rewrite(
        &s,
        js_re!(
            r"(?<![=!<>])(?<=[\d\p{L}])\s*<\s*(?=[\d\p{L}])(?![=<>])",
            "gu"
        ),
        &js(" më e vogël "),
    );
    let s = rewrite(
        &s,
        js_re!(
            r"(?<![=!<>])(?<=[\d\p{L}])\s*>\s*(?=[\d\p{L}])(?![=<>])",
            "gu"
        ),
        &js(" më e madhe "),
    );
    rewrite(&s, js_re!(r"(?<=\d)\s*÷\s*(?=\d)", "gu"), &js(" pjesëtim "))
}

/// `normalizeAlbanian(input)`. Steps are ORDER-DEPENDENT; see the TS for each one's coupling.
pub fn normalize_albanian(input: &JsString) -> JsString {
    // 0) ASCII exponents on km
    let mut s = rewrite_with(
        input,
        js_re!(r"\bkm([23])(?![\p{L}\p{M}\d])", "gu"),
        |m, t| {
            js(if g(m, 1, t) == "2" {
                "km\u{B2}"
            } else {
                "km\u{B3}"
            })
        },
    );

    // 1) digit grouping
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})((?:[.,\u00a0\u202f\u2009 ]\d{3})+)(?!\d)",
            "gu"
        ),
        |m, t| {
            g(m, 1, t).concat(
                &js_re!(r"[.,\u00a0\u202f\u2009 ]", "gu").replace(&g(m, 2, t), &JsString::new()),
            )
        },
    );

    // 3) ranges, before a dash can be claimed as a minus
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d.,\p{L}-])(\d+(?:[.,]\d+)?)\s*[-–—]\s*(\d+(?:[.,]\d+)?)(?!\d|[.,]\d|-)",
            "gu"
        ),
        &js("$1 deri $2"),
    );

    // 2b) per mille, before the tier
    s = rewrite(&s, js_re!(r"(\d)\s*‰", "gu"), &js("$1 për mijë"));

    // 2) the shared symbol tier
    s = try_symbols().unwrap().apply(&s);

    // 4) degrees, 5) signs
    s = degrees(&s);
    s = signs(&s);

    // 6) the decimal, leading zeros of the fraction read as `zero`
    rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)[.,](\d+)(?![\d.,])", "gu"),
        |m, t| {
            let frac = g(m, 2, t);
            let zeros = js_re!("^0*", "u").exec(&frac).map_or(0, |z| z.end());
            let rest = frac.slice(zeros as isize, None);
            let mut parts: Vec<JsString> = vec![js("zero"); zeros];
            if !rest.is_empty() {
                parts.push(rest);
            }
            g(m, 1, t)
                .concat(&js(&format!(" {DECIMAL_WORD} ")))
                .concat(&JsString::join(&parts, &js(" ")))
        },
    )
}
