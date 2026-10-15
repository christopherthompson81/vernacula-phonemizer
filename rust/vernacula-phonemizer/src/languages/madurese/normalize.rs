//! Madurese (mad) text normalization: whole-hour clocks, digit grouping, mark ranges, degrees, ±, era markers, unit
//! rates, the shared symbol tier, `dpl`, number ranges and decimals.
//! Ported from src/languages/madurese/normalize.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use super::manifest::MANIFEST;
use crate::core::data_source::load_once;
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// normalize.ts's `makeSymbolNormalizer({…})` literal, evaluated from the source and `JSON.stringify`'d.
const SYMBOL_DATA: &str = r#"{"percent":["persen"],"currency":{"US$":["dolar Amèrika"],"AS$":["dolar Amèrika"],"$":["dolar"],"Rp":["rupiah"],"€":["euro"]},"magnitudes":["èbu","ebu","juta","jutah","miliar","milyad","milyar","triliun","triliyun"],"units":{"km":["kilomèter"],"m":["mèter"],"cm":["sèntimèter"],"mm":["milimeter"],"kg":["kilogram"],"ha":["hèktar"]},"unitPer":"per","rateDenominators":{"taon":"taon","detik":"detik","s":"detik"},"exponentWords":{"squared":["persegi"],"cubed":["kubik"]},"ampersand":"bân","multiply":{"times":"kalè"}}"#;

pub fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
        make_symbol_normalizer(&data)
    })
}

// Generated from normalize.ts's object literals (key order as JS iterates them).
const UNIT_WORD: [(&str, &str); 6] = [
    ("km", "kilomèter"),
    ("m", "mèter"),
    ("cm", "sèntimèter"),
    ("mm", "milimeter"),
    ("kg", "kilogram"),
    ("ha", "hèktar"),
];
const EXP_WORD: [(&str, &str); 5] = [
    ("2", " persegi"),
    ("3", " kubik"),
    ("", ""),
    ("²", " persegi"),
    ("³", " kubik"),
];

const L: &str = r"[\p{L}\p{M}]";
const HOUR_WORD: &str = "(?:pokol|kol|jhâm|jam)";
const CLOCK_MARK: &str = "(?:WIB|WITA|WIT|PM|AM|malem|bâkto)";
const RATE_UNIT: &str = "(km|cm|mm|kg|ha|m)";

fn lookup(table: &[(&'static str, &'static str)], key: &str) -> Option<&'static str> {
    table.iter().find(|(k, _)| *k == key).map(|(_, v)| *v)
}

fn g(m: &JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `String(Number(s))`.
fn num_str(s: &JsString) -> JsString {
    js(&js_number_to_string(js_number(s)))
}

struct Built {
    hour_word_clock: JsRegex,
    marked_clock: JsRegex,
    slash_rate: JsRegex,
    per_rate: JsRegex,
    hour_word_before: JsRegex,
}

/// The patterns normalize.ts builds with `new RegExp`, built once.
static BUILT: LazyLock<Built> = LazyLock::new(|| {
    let re = |p: String, f: &str| JsRegex::new(&p, f).unwrap_or_else(|e| panic!("{p}: {e}"));
    Built {
        hour_word_clock: re(
            format!(r"(?<![\p{{L}}\p{{M}}])({HOUR_WORD})(\s*)(\d{{1,2}})[.:]00(?![\d.:])"),
            "giu",
        ),
        marked_clock: re(
            format!(r"(?<![\d.:,])(\d{{1,2}})[.:]00(?![\d.:])(?=\s*{CLOCK_MARK}(?!{L}))"),
            "gu",
        ),
        slash_rate: re(
            format!(r"(?<={L})\s?/\s?{RATE_UNIT}(²|³|2|3)?(?![\p{{L}}\p{{M}}\d])"),
            "giu",
        ),
        per_rate: re(
            format!(r"(?<![\p{{L}}\p{{M}}])per\s+{RATE_UNIT}(²|³|2|3)?(?![\p{{L}}\p{{M}}\d])"),
            "giu",
        ),
        hour_word_before: re(format!(r"(?<![\p{{L}}\p{{M}}]){HOUR_WORD}\s*$"), "iu"),
    }
});

/// ` per <unit word><exponent word>` for a rate match (`UNIT_WORD[u.toLowerCase()]!` in a template: a miss would
/// print "undefined").
fn rate(m: &JsMatch, t: &JsString) -> String {
    let u = g(m, t, 1).to_lower_case().to_string_lossy();
    let exp = m
        .group(2, t)
        .map(|e| e.to_string_lossy())
        .unwrap_or_default();
    format!(
        "per {}{}",
        lookup(&UNIT_WORD, &u).unwrap_or("undefined"),
        lookup(&EXP_WORD, &exp).unwrap_or("")
    )
}

/// `decimal(int, frac)`: the fraction read digit at a time.
fn decimal(int: &JsString, frac: &JsString) -> JsString {
    int.concat(&js(&format!(" {} ", MANIFEST.numbers.decimal_word)))
        .concat(&JsString::join(&frac.code_point_strings(), &js(" ")))
}

/// `normalizeMadurese(input)`. The steps are order-dependent, as in the TS.
pub fn normalize_madurese(input: &JsString) -> JsString {
    let bt = &*BUILT;
    let mut s = input.clone();

    // Whole-hour clocks: after an hour word, before a clock mark, and a bare `HH:00`.
    s = rewrite_with(&s, &bt.hour_word_clock, |m, t| {
        g(m, t, 1).concat(&g(m, t, 2)).concat(&num_str(&g(m, t, 3)))
    });
    s = rewrite_with(&s, &bt.marked_clock, |m, t| num_str(&g(m, t, 1)));
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.:,])([01]?\d|2[0-3]):00(?![\d.:])", "gu"),
        |m, t| num_str(&g(m, t, 1)),
    );

    // Digit grouping, dot then comma (never after a lone `0,`).
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])[1-9]\d{0,2}(?:\.\d{3})+(?![\d.])", "gu"),
        |m, t| JsString::join(&m.value(t).split(&js(".")), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(?!0,)[1-9]\d{0,2}(?:,\d{3})+(?![\d,])", "gu"),
        |m, t| JsString::join(&m.value(t).split(&js(",")), &JsString::new()),
    );

    // A range after a quote or degree mark.
    s = rewrite(
        &s,
        js_re!(r#"(?<=\d)(['’′″"”º°]+)\s*[-–—]\s*(?=\d)"#, "gu"),
        &js("$1 sampè' "),
    );

    // Degrees.
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[°º]\s?C(?![\p{L}\p{M}])", "gui"),
        &js("$1 derajat celcius"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[°º]\s?F(?![\p{L}\p{M}])", "gui"),
        &js("$1 derajat fahrenheit"),
    );
    s = rewrite(&s, js_re!(r"(\d)\s?[°º]\s?", "gu"), &js("$1 derajat "));

    // ±, unless an approximation word already says it.
    s = rewrite(
        &s,
        js_re!(
            r"(?<!(?:korang lebbi|ra-kèra|sakètar|kèra-kèra)\s?)(?<![\p{L}\p{M}])±\s*(?=\d)",
            "gu"
        ),
        &js("korang lebbi "),
    );
    s = rewrite(
        &s,
        js_re!(
            r"((?:korang lebbi|ra-kèra|sakètar|kèra-kèra)\s?)±\s*(?=\d)",
            "gu"
        ),
        &js("$1"),
    );

    // Era markers.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d])(\d+)\s?SM(?![\p{L}\p{M}\d])", "gu"),
        &js("$1 sabellunna Masèhi"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d])(\d+)\s?M(?![\p{L}\p{M}\d])", "gu"),
        &js("$1 Masèhi"),
    );

    // Unit rates, written with `/` or with `per`.
    s = rewrite_with(&s, &bt.slash_rate, |m, t| js(&format!(" {}", rate(m, t))));
    s = rewrite_with(&s, &bt.per_rate, |m, t| js(&rate(m, t)));

    // The shared tier.
    s = try_symbols().expect("checked by create_madurese").apply(&s);

    // `m dpl` (above sea level).
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(m[èe]t[èe]r)\s+dpl(?![\p{L}\p{M}\d])",
            "giu"
        ),
        &js("$1 è attas tasè'"),
    );

    // Number ranges.
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d.,\p{L}\p{M}/-])(\d+(?:[.,]\d+)?)\s?[-–—]\s?(\d+(?:[.,]\d+)?)(?![\d\p{L}\p{M}/-]|[.,]\d)",
            "gu"
        ),
        &js("$1 sampè' $2"),
    );

    // Decimals, comma then dot (a dot after an hour word is a clock and is kept).
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+),(\d{1,3})(?![\d,])", "gu"),
        |m, t| decimal(&g(m, t, 1), &g(m, t, 2)),
    );
    rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d{1,3})(?![\d,])(?!\.\d)", "gu"),
        |m, t| {
            let before = t.slice(0, Some(m.index() as isize));
            if bt.hour_word_before.test(&before) {
                m.value(t)
            } else {
                decimal(&g(m, t, 1), &g(m, t, 2))
            }
        },
    )
}
