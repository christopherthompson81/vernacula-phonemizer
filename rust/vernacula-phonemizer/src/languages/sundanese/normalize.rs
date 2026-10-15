//! Sundanese (su) text normalization: TeX superscripts, digit grouping, clocks, unit rates, the shared symbol tier,
//! decimals, era markers, ranges, school years and fractions, degrees and compass points, and the signs.
//! Ported from src/languages/sundanese/normalize.ts — see that file for the corpus evidence.

use std::sync::OnceLock;

use crate::core::data_source::load_once;
use crate::core::js_regex::JsMatch;
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// normalize.ts's `makeSymbolNormalizer({…})` literal, evaluated from the source and `JSON.stringify`'d.
const SYMBOL_DATA: &str = r#"{"percent":["persén"],"currency":{"US$":["dolar Amérika"],"AS$":["dolar Amérika"],"$":["dolar"],"Rp":["rupiah"],"€":["euro"],"£":["poundstérling"]},"magnitudes":["rébu","rebu","juta","yuta","milyar","miliar","triliun"],"units":{"km":["kilométer"],"m":["méter"],"cm":["séntiméter"],"mm":["miliméter"],"kg":["kilogram"],"g":["gram"],"gr":["gram"],"mg":["miligram"],"pm":["pikométer"],"ha":["héktar"],"l":["liter"]},"rateDenominators":{"jam":"jam","detik":"detik","h":"jam","s":"detik"},"unitPer":"per","exponentWords":{"squared":["pasagi"],"cubed":["kubik"]},"bareExponent":{"squared":"{n} pasagi","cubed":"{n} kubik","power":"{n} pangkat {e}","negative":"kurang"},"ampersand":"jeung","multiply":{"times":"kali"}}"#;

pub fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
        make_symbol_normalizer(&data)
    })
}

// Generated from normalize.ts's object literals (key order preserved).
const UNIT_WORD: [(&str, &str); 9] = [
    ("km", "kilométer"),
    ("m", "méter"),
    ("cm", "séntiméter"),
    ("mm", "miliméter"),
    ("kg", "kilogram"),
    ("g", "gram"),
    ("ha", "héktar"),
    ("l", "liter"),
    ("c", "c"),
];
const EXP_WORD: [(&str, &str); 3] = [("", ""), ("²", " pasagi"), ("³", " kubik")];
const EXP_ASCII: [(&str, &str); 2] = [("2", "²"), ("3", "³")];
const COMPASS: [(&str, &str); 4] = [
    ("n", "kalér"),
    ("s", "kidul"),
    ("e", "wétan"),
    ("w", "kulon"),
];

fn lookup(table: &[(&'static str, &'static str)], key: &str) -> Option<&'static str> {
    table.iter().find(|(k, _)| *k == key).map(|(_, v)| *v)
}

fn g(m: &JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `String(Number(s))`.
fn num_str(s: &JsString) -> String {
    js_number_to_string(js_number(s))
}

/// `EXP_WORD[EXP_ASCII[exp ?? ""] ?? exp ?? ""] ?? ""`.
fn exp_word(exp: Option<JsString>) -> &'static str {
    let e = exp.map(|e| e.to_string_lossy()).unwrap_or_default();
    let key = lookup(&EXP_ASCII, &e).map_or(e.clone(), |a| a.to_string());
    lookup(&EXP_WORD, &key).unwrap_or("")
}

/// `normalizeSundanese(input)`. The steps are order-dependent, as in the TS.
pub fn normalize_sundanese(input: &JsString) -> JsString {
    let mut s = input.clone();

    // TeX `$…$` around a superscript.
    s = rewrite(
        &s,
        js_re!(r"\$([^$]*[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻]+[^$]*)\$", "gu"),
        &js("$1"),
    );

    // Digit grouping: dot, comma, then the space variants.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2}(?:\.\d{3})+)(?!\d)", "gu"),
        |m, t| JsString::join(&m.value(t).split(&js(".")), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2}(?:,\d{3})+)(?!\d)", "gu"),
        |m, t| JsString::join(&m.value(t).split(&js(",")), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2}(?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)",
            "gu"
        ),
        |m, t| js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&m.value(t), &JsString::new()),
    );

    // Clocks: after a clock word, then bare `H:MM`.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.:])\b(jam|tabuh|pukul)\s?([01]?\d|2[0-3])[.:]([0-5]\d)\b(?!\.?\d)",
            "giu"
        ),
        |m, t| {
            let (w, h, min) = (g(m, t, 1), g(m, t, 2), g(m, t, 3));
            let w = w.to_string_lossy();
            if js_number(&min) == 0.0 {
                js(&format!("{w} {}", num_str(&h)))
            } else {
                js(&format!("{w} {} liwat {}", num_str(&h), num_str(&min)))
            }
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.:])([01]?\d|2[0-3]):([0-5]\d)\b(?!\.?\d)", "gu"),
        |m, t| {
            let (h, min) = (g(m, t, 1), g(m, t, 2));
            if js_number(&min) == 0.0 {
                js(&format!("jam {}", num_str(&h)))
            } else {
                js(&format!("jam {} liwat {}", num_str(&h), num_str(&min)))
            }
        },
    );

    // Unit rates written with `/` or with `per`.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<=[\p{L}\p{M}])\/(km|m|cm|mm|kg|g|ha|l|c)(²|³|2|3)?(?![\p{L}\p{M}\d])",
            "giu"
        ),
        |m, t| {
            let u = g(m, t, 1);
            let word = lookup(&UNIT_WORD, &u.to_lower_case().to_string_lossy())
                .map_or_else(|| u.clone(), js);
            js(" per ")
                .concat(&word)
                .concat(&js(exp_word(m.group(2, t))))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"\bper\s+(km|m|cm|mm|kg|g|ha|l)(²|³|2|3)?(?![\p{L}\p{M}\d])",
            "giu"
        ),
        |m, t| {
            // `UNIT_WORD[u.toLowerCase()]!` in a template: a miss would print "undefined".
            let u = g(m, t, 1).to_lower_case().to_string_lossy();
            let word = lookup(&UNIT_WORD, &u).unwrap_or("undefined");
            js(&format!("per {word}{}", exp_word(m.group(2, t))))
        },
    );

    // The shared tier.
    s = try_symbols()
        .expect("checked by create_sundanese")
        .apply(&s);

    // Decimals, fractional digits one at a time.
    s = rewrite_with(&s, js_re!(r"(\d)[.,](\d{1,2})(?![\d.,])", "gu"), |m, t| {
        g(m, t, 1)
            .concat(&js(" koma "))
            .concat(&JsString::join(&g(m, t, 2).code_point_strings(), &js(" ")))
    });

    // Era markers.
    s = rewrite(
        &s,
        js_re!(r"(\d+(?:-an)?)\s*SM\b(?![\p{L}\p{M}])", "gu"),
        &js("$1 saméméh Maséhi"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+(?:-an)?)\s*M\b(?![\p{L}\p{M}]|\.\p{L})", "gu"),
        &js("$1 Maséhi"),
    );

    // Number ranges.
    s = rewrite(
        &s,
        js_re!(
            r"(?<!\b(?:nepi ka|tepi ka|dugi ka|ti|antara)\s)(?<![\d.,\p{L}-])(\d+)\s?[-–]\s?(\d+)(?![\d,-])",
            "gu"
        ),
        &js("$1 nepi ka $2"),
    );

    // A school year `YYYY/YYYY`, then fractions.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d/])(\d{4})\/(\d{4})(?![\d/])", "gu"),
        |m, t| {
            let (a, b) = (g(m, t, 1), g(m, t, 2));
            if js_number(&b) == js_number(&a) + 1.0 {
                a.concat(&js(" nepi ka ")).concat(&b)
            } else {
                m.value(t)
            }
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])", "gu"),
        |m, t| {
            let (a, b) = (g(m, t, 1), g(m, t, 2));
            if js_number(&a) == 1.0 && js_number(&b) == 2.0 {
                js("satengah")
            } else {
                a.concat(&js(" per ")).concat(&b)
            }
        },
    );

    // Degrees: the scales, the compass points, then a bare sign.
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?C(?![\p{L}\p{M}])", "giu"),
        &js("$1 darajat Celsius"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?F(?![\p{L}\p{M}])", "giu"),
        &js("$1 darajat Fahrenheit"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d)\s?°\s?([NSEW])(?![\p{L}\p{M}])", "giu"),
        |m, t| {
            // `ſ` matches `S` under `iu` and lowercases to itself, which is no key: the match is kept.
            match lookup(&COMPASS, &g(m, t, 2).to_lower_case().to_string_lossy()) {
                None => m.value(t),
                Some(word) => g(m, t, 1).concat(&js(" darajat ")).concat(&js(word)),
            }
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°(?=[\p{L}\p{M}])", "gu"),
        &js("$1 darajat "),
    );
    s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 darajat"));

    // The signs.
    s = rewrite(&s, js_re!(r"±", "gu"), &js(" tambah kurang "));
    s = rewrite(
        &s,
        js_re!(r"(\S)\+\s?(\(?\s?[-−]?\d)", "gu"),
        &js("$1 tambah $2"),
    );
    s = rewrite(
        &s,
        js_re!(r"(^|\s)\+\s?(\(?\s?[-−]?\d)", "gu"),
        &js("$1tambah $2"),
    );
    s = rewrite(&s, js_re!(r"(^|[\s(])[-−–](\d)", "gu"), &js("$1kurang $2"));
    s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" sarua jeung "));
    s = rewrite(&s, js_re!(r"\s?<\s?", "gu"), &js(" leuwih leutik ti "));
    s = rewrite(&s, js_re!(r"\s?>\s?", "gu"), &js(" leuwih gedé ti "));
    s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" dibagi "));

    s
}
