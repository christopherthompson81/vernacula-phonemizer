//! Ilocano (ilo) text normalization: thousands de-grouping, the U+2212 minus, licensed clocks, h/m/s durations,
//! the per-unit noun after `tunggal`, the shared symbol tier, ranges as `aginggana iti`, decimals as `punto`,
//! degrees, dotted abbreviations and `c.` (circa). Ported from src/languages/ilocano/normalize.ts — see that file
//! for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// normalize.ts's `makeSymbolNormalizer({…})` literal, evaluated from the source and `JSON.stringify`'d.
const SYMBOL_DATA: &str = r#"{"percent":["porsiento"],"currency":{"US$":["doliar ti Estados Unidos"],"$":["doliar"],"€":["euro"],"₱":["pisos"],"£":["libra esterlina"]},"magnitudes":["ribo","riwriw","milion","bilion","trilion"],"units":{"km":["kilometro"],"m":["metro"],"cm":["sentimetro"],"mm":["milimetro"],"kg":["kilogramo"],"mi":["milia"],"ml":["mililitro"],"ft":["pie"],"mph":["milia kada oras"]},"exponentWords":{"squared":["kuadrado"],"cubed":["kubiko"],"position":"before"},"unitPer":"kada","rateDenominators":{"h":"oras","s":"segundo"},"ampersand":"ken"}"#;

/// `SYMBOLS`, or why the tier refused its data. Built once; the engine's constructor checks it.
pub(crate) fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<Result<SymbolNormalizer, String>> = OnceLock::new();
    S.get_or_init(|| {
        let data: SymbolData =
            crate::core::from_json::parse_json(SYMBOL_DATA).map_err(|e| e.to_string())?;
        make_symbol_normalizer(&data)
    })
    .as_ref()
    .map_err(|e| e.clone())
}

/// `PER_UNIT`. Generated from normalize.ts's object literal (key order preserved).
const PER_UNIT: [(&str, &str); 4] = [
    ("km²", "kuadrado kilometro"),
    ("m²", "kuadrado metro"),
    ("km", "kilometro"),
    ("m", "metro"),
];

/// `DOTTED_ABBREV`. Generated from normalize.ts's object literal (key order preserved).
const DOTTED_ABBREV: [(&str, &str); 5] = [
    ("blng", "Bilang"),
    ("dr", "Doktor"),
    ("jr", "Junior"),
    ("sr", "Senior"),
    ("st", "Santo"),
];

/// `COMPASS`. Generated from normalize.ts's object literal (key order preserved).
const COMPASS: [(&str, &str); 4] = [
    ("N", "amianan"),
    ("S", "abagatan"),
    ("E", "daya"),
    ("W", "laud"),
];

/// `Object.keys(table).sort((a, b) => b.length - a.length).join("|")` (a stable sort).
fn alt(table: &[(&str, &str)]) -> String {
    let mut keys: Vec<&str> = table.iter().map(|(k, _)| *k).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.encode_utf16().count()));
    keys.join("|")
}

const HOUR: &str = r"(?<![\d.:+\-−])([01]?\d|2[0-3]):([0-5]\d)(?!\d)";

fn re(pattern: String, flags: &str) -> JsRegex {
    JsRegex::new(&pattern, flags).unwrap()
}

static CLOCK_MARKED: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(r"{HOUR}(?=\s*(?:[ap]\.?\s?m\.?(?![\p{{L}}])|GMT|UTC))"),
        "giu",
    )
});
static CLOCK_PART_OF_DAY: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(r"{HOUR}(?=\s*(?:ti|iti)\s+(?:agsapa|bigat|malem|rabii|sardam|aldaw))"),
        "giu",
    )
});
static CLOCK_ORAS: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"(?<=oras\s+(?:a|ti|nga)\s+){HOUR}"), "giu"));
static PER: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(
            r"(?<=tunggal\s(?:maysa\s(?:a|nga)\s)?)({})(?![\p{{L}}\p{{M}}²³])",
            alt(&PER_UNIT)
        ),
        "gu",
    )
});
static ABBREV: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(r"(?<![\p{{L}}\p{{M}}])({})\.", alt(&DOTTED_ABBREV)),
        "giu",
    )
});

/// `` `${Number(x)}` ``.
fn num_str(x: &JsString) -> JsString {
    js(&js_number_to_string(js_number(x)))
}

/// `clock(_m, h, min)`: the hour, then `ket` and the minutes unless they are zero.
fn clock(m: &JsMatch, t: &JsString) -> JsString {
    let (h, min) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
    if js_number(&min) == 0.0 {
        num_str(&h)
    } else {
        num_str(&h).concat(&js(" ket ")).concat(&num_str(&min))
    }
}

/// `normalizeIlocano(input)`. The steps are order-dependent, as in the TS.
pub(crate) fn normalize_ilocano(input: &JsString) -> JsString {
    let mut s = input.clone();

    // de-group thousands.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2}(?:,\d{3})+)(?!\d)", "gu"),
        |m, t| js_re!(r",", "g").replace(&m.value(t), &JsString::new()),
    );

    // U+2212 MINUS before a number.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\p{Nd}])(?<!\p{Nd}\s)−(?=\p{Nd})", "gu"),
        &js("negatibo "),
    );

    // clocks, each licensed by what surrounds it.
    s = rewrite_with(&s, &CLOCK_MARKED, clock);
    s = rewrite_with(&s, &CLOCK_PART_OF_DAY, clock);
    s = rewrite_with(&s, &CLOCK_ORAS, clock);

    // h/m/s durations.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\p{Nd}])(\d{1,2})\s?h\s?(\d{1,2})\s?m(?:\s?(\d{1,2}(?:\.\d+)?)\s?s)?(?![\p{L}\p{M}\p{Nd}])",
            "gu"
        ),
        |m, t| {
            let mut out = m
                .group(1, t)
                .unwrap()
                .concat(&js(" oras "))
                .concat(&m.group(2, t).unwrap())
                .concat(&js(" minuto"));
            if let Some(sec) = m.group(3, t) {
                out = out.concat(&js(" ")).concat(&sec).concat(&js(" segundo"));
            }
            out
        },
    );

    // the per-unit noun after `tunggal` (no `i`: the group is one of the table's own keys), then the tier.
    s = rewrite_with(&s, &PER, |m, t| {
        let u = m.group(1, t).unwrap();
        js(PER_UNIT
            .iter()
            .find(|(k, _)| js(k) == u)
            .map(|(_, w)| *w)
            .expect("a PER_UNIT key"))
    });
    s = try_symbols().unwrap_or_else(|e| panic!("{e}")).apply(&s);

    // ranges → `aginggana iti`.
    s = rewrite(
        &s,
        js_re!(
            r"(?<!\b(?:aginggana|agingga|inggana|manipud|manipud iti|manipud idi)\s(?:iti\s|ti\s)?)(?<![\d.,\p{L}-])(\d[\d,]*(?:\.\d+)?)\s?[-–]\s?(\d[\d,]*(?:\.\d+)?)(?![\d,-]|\.\d)",
            "gu"
        ),
        &js("$1 aginggana iti $2"),
    );

    // decimals → `punto`, the fraction digit by digit.
    s = rewrite_with(&s, js_re!(r"(\d)\.(\d+)(?![\d.,])", "gu"), |m, t| {
        let digits = JsString::join(&m.group(2, t).unwrap().code_point_strings(), &js(" "));
        m.group(1, t)
            .unwrap()
            .concat(&js(" punto "))
            .concat(&digits)
    });

    // degrees.
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?C(?![\p{L}\p{M}])", "gui"),
        &js("$1 grado Celsius"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?F(?![\p{L}\p{M}])", "gui"),
        &js("$1 grado Fahrenheit"),
    );
    // A compass letter after the sign is the direction, in the corpus's own words (#1534).
    s = rewrite_with(
        &s,
        js_re!(r"(\d)\s?°\s?([NSEW])(?![\p{L}\p{M}])", "gu"),
        |m, t| {
            let dir = m.group(2, t).unwrap().to_string_lossy();
            let word = COMPASS.iter().find(|(k, _)| *k == dir).unwrap().1;
            m.group(1, t)
                .unwrap()
                .concat(&js(" grado "))
                .concat(&js(word))
        },
    );
    s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 grado "));

    // dotted abbreviations (the dot is consumed). ⚠ The miss branch is reachable (#1122).
    s = rewrite_with(&s, &ABBREV, |m, t| {
        let ab = m.group(1, t).unwrap().to_lower_case();
        match DOTTED_ABBREV.iter().find(|(k, _)| js(k) == ab) {
            None => m.value(t),
            Some((_, w)) => js(w),
        }
    });

    // `c.` / `ca.` before a number → `agarup a`.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}.])c(?:a)?\.\s*(?=\d)", "giu"),
        &js("agarup a "),
    );

    s
}
