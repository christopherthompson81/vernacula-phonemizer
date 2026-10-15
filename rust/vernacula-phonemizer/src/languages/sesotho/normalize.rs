//! Sesotho (st) text normalization: entities and the ampersand, dotted capitals, dotted dates, digit grouping, the
//! currency-glued magnitude letter, a percent already written, ranges and ordinal suffixes BEFORE the shared symbol
//! tier (which this pass owns and calls), then the concord repair and the decimals after it.
//! Ported from src/languages/sesotho/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::LazyLock;

use super::numbers::N;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{
    SymbolData, SymbolNormalizer, alternation, make_symbol_normalizer, sorted_by_length_desc,
};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const MAGNITUDES: [&str; 10] = [
    "dimilione",
    "dimiliyone",
    "limilione",
    "milione",
    "miliyone",
    "dibilione",
    "dibiliyone",
    "libilione",
    "bilione",
    "biliyone",
];

const SPAN: &str = "ho isa ho";

/// `spell(int, frac)`: the integer, then each fractional digit.
fn spell(int: &JsString, frac: &JsString) -> JsString {
    let digits = JsString::join(&frac.code_point_strings(), &js(" "));
    int.concat(&js(" ")).concat(&digits)
}

/// `SYMBOLS`'s argument, generated from the object literal in normalize.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it, except `magnitudes`, which is the
/// `MAGNITUDES` constant. No `countForm`: the default selector.
static SYMBOL_DATA: LazyLock<String> = LazyLock::new(|| {
    let mags = serde_json::to_string(&MAGNITUDES).unwrap();
    format!(
        r#"{{"percent":["diperesente","diperesente tse"],"percentPrefix":true,"currency":{{"US$":["didolara tsa Amerika","didolara tsa Amerika tse"],"$":["didolara","didolara tse"],"R":["diranta","diranta tse"],"£":["diponto","diponto tse"]}},"currencyPrefix":true,"magnitudes":{mags},"units":{{"km":["dikhilomithara","dikhilomithara tse"],"m":["dimithara","dimithara tse"],"kg":["dikhilograma","dikhilograma tse"]}},"unitPrefix":true,"unitPer":"ka","rateDenominators":{{"h":"hora"}},"exponentWords":{{"squared":["disekwere"],"position":"before"}}}}"#
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

static CONCORD_REPAIR: LazyLock<JsRegex> = LazyLock::new(|| {
    let mags = sorted_by_length_desc(MAGNITUDES.iter().map(|m| js(m)));
    JsRegex::new(
        &format!("(tse[ \u{a0}]+(?:{}))[ \u{a0}]+(?=\\d)", alternation(&mags)),
        "gu",
    )
    .unwrap()
});

/// `normalizeSesotho(input)`.
pub fn normalize_sesotho(input: &JsString) -> JsString {
    let symbols = try_symbols().unwrap_or_else(|e| panic!("{e}"));
    let mut s = input.clone();

    // 1
    s = rewrite(&s, js_re!(r"&nbsp;", "giu"), &js(" "));
    s = rewrite(&s, js_re!(r"&#0*39;|&#x0*27;|&apos;", "giu"), &js("’"));
    s = rewrite(&s, js_re!(r"&#x0*5B;", "giu"), &js("["));
    s = rewrite(&s, js_re!(r"&#x0*5D;", "giu"), &js("]"));
    s = rewrite(&s, js_re!(r"&amp;", "giu"), &js("&"));

    // 2
    s = rewrite(
        &s,
        js_re!(r"[ \t]*&[ \t]*", "gu"),
        &js(&format!(" {} ", N.and)),
    );

    // 3
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(?:\p{Lu}\.[ \u00a0]?){2,}(?:\p{Lu}(?![\p{L}\p{M}]))?",
            "gu"
        ),
        |m, full| {
            let run = m.value(full);
            let letters = js_re!(r"[. \u00a0]", "gu").replace(&run, &JsString::new());
            let rest = full.slice(m.end() as isize, None);
            if js_re!(r"^[\p{L}\p{M}]", "u").test(&rest) {
                return letters.concat(&js(" "));
            }
            if rest.is_empty() || js_re!(r"^[ \u00a0]+\p{Lu}", "u").test(&rest) {
                letters.concat(&js("."))
            } else {
                letters
            }
        },
    );

    // 3b
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d{1,2})\.(\d{1,2})\.(\d{4})(?![\d.,])", "gu"),
        &js("$1 $2 $3"),
    );

    // 4
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2})(?:,\d{3})+(?![\d]|[.,]\d)", "gu"),
        |m, s| js_re!(",", "gu").replace(&m.value(s), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})(?:\.\d{3})+(?![\d]|[.,]\d)",
            "gu"
        ),
        |m, s| js_re!(r"\.", "gu").replace(&m.value(s), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})(?:[ \u00a0\u202f\u2009]\d{3})+(?![\d])",
            "gu"
        ),
        |m, s| js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&m.value(s), &JsString::new()),
    );

    // 5
    s = rewrite_with(
        &s,
        js_re!(
            r"((?:US[ \u00a0]?)?[$£€R])([ \u00a0]?\d[\d.,]*)(m|bn)(?![\p{L}\p{M}\d])",
            "gu"
        ),
        |m, s| {
            let mag = if m.group(3, s).unwrap() == "m" {
                "dimilione"
            } else {
                "dibilione"
            };
            m.group(1, s)
                .unwrap()
                .concat(&m.group(2, s).unwrap())
                .concat(&js(&format!(" {mag}")))
        },
    );

    // 6, 6b
    s = rewrite(
        &s,
        js_re!(
            r"((?<![\p{L}\p{M}])[dl]i(?:peresente|poresente|phesente)[ \u00a0]+(?:tse[ \u00a0]+)?)(\d[\d.,]*)[ \u00a0]?%",
            "giu"
        ),
        &js("$1$2"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=[\p{L}\p{M}])(?=\d[\d.,]*[ \u00a0]?%)", "gu"),
        &js(" "),
    );

    // 7
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![-\d.,\p{L}\p{M}])(\d+)[ \u00a0]?[-–—][ \u00a0]?(\d+)(?![-\d\p{L}\p{M}]|[.,]\d)",
            "gu"
        ),
        |m, s| {
            let (a, b) = (m.group(1, s).unwrap(), m.group(2, s).unwrap());
            if js_number(&a) < js_number(&b) {
                a.concat(&js(&format!(" {SPAN} "))).concat(&b)
            } else {
                m.value(s)
            }
        },
    );

    // 8
    s = rewrite(
        &s,
        js_re!(r"(\d+)(?:st|nd|rd|th)(?![\p{L}\p{M}])", "giu"),
        &js("$1"),
    );

    // 9 — the shared tier, mid-pass
    s = symbols.apply(&s);

    // 10
    s = rewrite(&s, &CONCORD_REPAIR, &js("$1 tse "));

    // 11
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,:])(\d+)\.(\d{1,2})(?![\d]|\.\d)", "gu"),
        |m, s| spell(&m.group(1, s).unwrap(), &m.group(2, s).unwrap()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,:])(\d+),(\d{1,2})(?![\d,])", "gu"),
        |m, s| spell(&m.group(1, s).unwrap(), &m.group(2, s).unwrap()),
    );

    rewrite(
        &rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" ")),
        js_re!(r"^[^\S\n]+|[^\S\n]+$", "gu"),
        &JsString::new(),
    )
}
