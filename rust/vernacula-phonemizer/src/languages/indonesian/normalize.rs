//! Indonesian (id) text normalization: the clock, the dollar code, rupiah, dotted abbreviations, slash units,
//! degrees, signs, relational signs and fractions, emitting digits for the engine's number path.
//! Ported from src/languages/indonesian/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `DOTTED_ABBREV`. Generated from normalize.ts's object literal (key order preserved).
const DOTTED_ABBREV: [(&str, &str); 14] = [
    ("dr", "dokter"),
    ("prof", "profesor"),
    ("ir", "insinyur"),
    ("hj", "hajjah"),
    ("dll", "dan lain lain"),
    ("dsb", "dan sebagainya"),
    ("dkk", "dan kawan kawan"),
    ("tsb", "tersebut"),
    ("no", "nomor"),
    ("hlm", "halaman"),
    ("jl", "jalan"),
    ("yg", "yang"),
    ("tgl", "tanggal"),
    ("pt", "perseroan terbatas"),
];

/// `UNIT_WORD`. Generated from normalize.ts's object literal (key order preserved).
const UNIT_WORD: [(&str, &str); 3] = [
    ("km/jam", "kilometer per jam"),
    ("m/detik", "meter per detik"),
    ("km/j", "kilometer per jam"),
];

/// `COMPASS`. Generated from normalize.ts's object literal (key order preserved).
const COMPASS: [(&str, &str); 4] = [
    ("n", "utara"),
    ("s", "selatan"),
    ("e", "timur"),
    ("w", "barat"),
];

fn lookup(table: &[(&str, &'static str)], key: &JsString) -> Option<&'static str> {
    table.iter().find(|(k, _)| js(k) == *key).map(|(_, v)| *v)
}

/// `Object.keys(table).sort((a, b) => b.length - a.length).join("|")` (a stable sort).
fn alt(table: &[(&str, &str)]) -> String {
    let mut keys: Vec<&str> = table.iter().map(|(k, _)| *k).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.encode_utf16().count()));
    keys.join("|")
}

const WORD_START: &str = r"(?<![\p{L}\p{M}\d_])";

static ABBREV_CONTINUES: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"{WORD_START}({})\.(\s+)(?=\p{{L}})", alt(&DOTTED_ABBREV)),
        "giu",
    )
    .unwrap()
});
static ABBREV_ENDS: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"{WORD_START}({})\.(?=\s*(?:[.,;:!?)]|$))",
            alt(&DOTTED_ABBREV)
        ),
        "giu",
    )
    .unwrap()
});
static SLASH_UNIT: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!(r"(\d)\s?({})(?![\p{{L}}])", alt(&UNIT_WORD)), "gu").unwrap()
});

/// `` `${Number(x)}` ``.
fn num_str(x: &JsString) -> JsString {
    js(&js_number_to_string(js_number(x)))
}

/// `normalizeIndonesian(input)`. The numbered steps are order-dependent, as in the TS.
pub(crate) fn normalize_indonesian(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1) clock: two digits after the separator is a time; a colon pair needs a marker (#1534).
    let clock = |m: &JsMatch, t: &JsString| {
        let (h, min) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
        let mv = js_number(&min);
        if mv == 0.0 {
            num_str(&h)
        } else {
            num_str(&h)
                .concat(&js(" lewat "))
                .concat(&js(&js_number_to_string(mv)))
        }
    };
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.:])([01]?\d|2[0-3])\.([0-5]\d)\b(?!\.?\d)", "gu"),
        clock,
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<=(?<![\p{L}\p{M}\d_])(?:pukul|jam)(?![\p{L}\p{M}\d_])[^.!?]{0,24})(?<![\d.:])([01]?\d|2[0-3]):([0-5]\d)\b(?!\.?\d)",
            "giu"
        ),
        clock,
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.:])([01]?\d|2[0-3]):([0-5]\d)\b(?!\.?\d)(?=\s?(?:WIB|WITA|WIT|GMT|UTC|waktu|pagi|siang|sore|malam)(?![\p{L}\p{M}\d_]))",
            "gu"
        ),
        clock,
    );

    // 1b) the dollar code → the bare sign.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(?:US|AUD)\$(?=[  ]?\d)", "gu"),
        &js("$"),
    );

    // 2) rupiah, moved after the amount.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d_])Rp\.?\s?(\d[\d.,]*)", "gu"),
        &js("$1 rupiah"),
    );

    // 2b) `No.` before a digit.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d_])no\.\s?(?=\d)", "giu"),
        &js("nomor "),
    );

    // 3) dotted abbreviations. ⚠ The miss branch is reachable (#1122): the match then stays as written.
    s = rewrite_with(&s, &ABBREV_CONTINUES, |m, t| {
        match lookup(&DOTTED_ABBREV, &m.group(1, t).unwrap().to_lower_case()) {
            None => m.value(t),
            Some(w) => js(w).concat(&m.group(2, t).unwrap()),
        }
    });
    s = rewrite_with(&s, &ABBREV_ENDS, |m, t| {
        match lookup(&DOTTED_ABBREV, &m.group(1, t).unwrap().to_lower_case()) {
            None => m.value(t),
            Some(w) => js(w).concat(&js(".")),
        }
    });

    // 4) slash units. The group is one of the table's own keys (no `i`), so the lookup cannot miss.
    s = rewrite_with(&s, &SLASH_UNIT, |m, t| {
        let w = lookup(&UNIT_WORD, &m.group(2, t).unwrap()).expect("a UNIT_WORD key");
        m.group(1, t).unwrap().concat(&js(" ")).concat(&js(w))
    });

    // 5) degrees, then coordinates (an unknown direction refuses the whole match, #1122), then the bare sign.
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?C(?![\p{L}\p{M}])", "giu"),
        &js("$1 derajat Celsius"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?F(?![\p{L}\p{M}])", "giu"),
        &js("$1 derajat Fahrenheit"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d)\s?°\s?([NSEW])(?![\p{L}\p{M}])", "giu"),
        |m: &JsMatch, t| match lookup(&COMPASS, &m.group(2, t).unwrap().to_lower_case()) {
            None => m.value(t),
            Some(word) => m
                .group(1, t)
                .unwrap()
                .concat(&js(" derajat "))
                .concat(&js(word)),
        },
    );
    s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 derajat"));

    // 6) signs.
    s = rewrite(&s, js_re!(r"(^|[\s(])[-−–](\d)", "gu"), &js("$1minus $2"));
    s = rewrite(&s, js_re!(r"±", "gu"), &js(" plus minus "));
    s = rewrite(&s, js_re!(r"(\S)\+\s?(\d)", "gu"), &js("$1 plus $2"));
    s = rewrite(&s, js_re!(r"(^|\s)\+\s?(\d)", "gu"), &js("$1plus $2"));

    // 6b) relational and division signs.
    s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" sama dengan "));
    s = rewrite(&s, js_re!(r"\s?<\s?", "gu"), &js(" lebih kecil dari "));
    s = rewrite(&s, js_re!(r"\s?>\s?", "gu"), &js(" lebih besar dari "));
    s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" dibagi "));

    // 7) fractions, as "numerator per denominator"; ½ is setengah.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d/]|\d\.|(?<![\d/])\d+,)\b(\d{1,3})\/(\d{1,3})\b(?!\s*[/\d]|\.\d|,\d+(?![\d/]))",
            "gu"
        ),
        |m, t| {
            let (a, b) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
            if js_number(&a) == 1.0 && js_number(&b) == 2.0 {
                js("setengah")
            } else {
                a.concat(&js(" per ")).concat(&b)
            }
        },
    );

    s
}
