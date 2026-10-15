//! Scottish Gaelic (gd) text normalization: digit grouping, dotted abbreviations, àireamh, decades, the `Nmh`
//! ordinal with its noun (and `deug` for the teens), decimals and a leading minus rewritten into words.
//! Ported from src/languages/scottishgaelic/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::LazyLock;

use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const ORD_1_20: [&str; 21] = [
    "",
    "chiad",
    "dàrna",
    "treas",
    "ceathramh",
    "còigeamh",
    "siathamh",
    "seachdamh",
    "ochdamh",
    "naoidheamh",
    "deicheamh",
    "aonamh",
    "dàrna",
    "treas",
    "ceathramh",
    "còigeamh",
    "siathamh",
    "seachdamh",
    "ochdamh",
    "naoidheamh",
    "ficheadamh",
];

/// `DOTTED_ABBREV`, in the TS object's order (which is also its length-sorted alternation: srl|td|bh).
const DOTTED_ABBREV: [(&str, &str); 3] = [
    ("srl", "agus mar sin air adhart"),
    ("td", "taobh-duilleige"),
    ("bh", "bheachd"),
];

fn dotted_abbrev(ab: &JsString) -> Option<&'static str> {
    let l = ab.to_lower_case();
    DOTTED_ABBREV.iter().find(|(k, _)| l == *k).map(|(_, v)| *v)
}

/// `ABBREV_ALT`: the keys sorted by length, longest first (stable).
fn abbrev_alt() -> String {
    let mut keys: Vec<&str> = DOTTED_ABBREV.iter().map(|(k, _)| *k).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(js(k).len()));
    keys.join("|")
}

const NOT_LETTER: &str = r"(?![\p{L}\p{M}'’])";
const NOT_BEFORE: &str = r"(?<![\p{L}\p{M}'’])";
const WORD: &str = "[a-zàèìòùáéíóú][a-zàèìòùáéíóú'’-]*";

static ABBREV_CONTINUES: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"{NOT_BEFORE}({})\.(\s+)(?=[\p{{L}}\d(])", abbrev_alt()),
        "giu",
    )
    .unwrap()
});
static ABBREV_ENDS: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"{NOT_BEFORE}({})\.(?=\s*(?:[.,;:!?»)]|$))", abbrev_alt()),
        "giu",
    )
    .unwrap()
});
static ORDINAL: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<![\d.,])(\d{{1,2}})-?(mh|na|s|d)(?:(\s+)({WORD}))?{NOT_LETTER}"),
        "giu",
    )
    .unwrap()
});

fn g(m: &JsMatch, i: usize, s: &JsString) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `normalizeScottishGaelic(input)`. Steps are ORDER-DEPENDENT; see the TS for each one's coupling.
pub fn normalize_scottish_gaelic(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1) digit grouping: comma and dot three times, then the spaces twice
    for _ in 0..3 {
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)\.(?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
    }
    for _ in 0..2 {
        s = rewrite(
            &s,
            js_re!(
                r"(?<=\d)(?<!(?<![\d\.,])0)[ \u00a0\u202f\u2009](?=\d{3}(?!\d))",
                "gu"
            ),
            &JsString::new(),
        );
    }

    // 2) dotted abbreviations (the miss branch is reachable under the iu fold, #1122)
    s = rewrite_with(&s, &ABBREV_CONTINUES, |m, t| {
        match dotted_abbrev(&g(m, 1, t)) {
            None => m.value(t),
            Some(w) => js(w).concat(&g(m, 2, t)),
        }
    });
    s = rewrite_with(&s, &ABBREV_ENDS, |m, t| match dotted_abbrev(&g(m, 1, t)) {
        None => m.value(t),
        Some(w) => js(w).concat(&js(".")),
    });

    // 3) àireamh
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(?:no|àir)\.\s?(?=\d)", "giu"),
        &js("àireamh "),
    );
    s = rewrite(&s, js_re!(r"№\s?(?=\d)", "gu"), &js("àireamh "));

    // 4) decades
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])((?:1\d|20)\d0)s(?![\p{L}\p{M}])", "gu"),
        &js("$1"),
    );

    // 5) ordinals, the noun inside the teens' `deug`
    s = rewrite_with(&s, &ORDINAL, |m, t| {
        let n = js_number(&g(m, 1, t));
        let head = if (1.0..=20.0).contains(&n) {
            Some(ORD_1_20[n as usize])
        } else {
            None
        };
        let Some(head) = head.filter(|h| js(h).ends_with(&g(m, 2, t).to_lower_case())) else {
            return m.value(t);
        };
        let tail = match m.group(4, t) {
            None => JsString::new(),
            Some(noun) => g(m, 3, t).concat(&noun),
        };
        let out = js(head).concat(&tail);
        if (11.0..=19.0).contains(&n) {
            out.concat(&js(" deug"))
        } else {
            out
        }
    });

    // 6) decimals, the fraction read digit by digit
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d{1,2})(?![\d.\p{L}])", "gu"),
        |m, t| {
            let digits = g(m, 2, t).code_point_strings();
            g(m, 1, t)
                .concat(&js(" puing "))
                .concat(&JsString::join(&digits, &js(" ")))
        },
    );

    // 7) a leading minus
    s = rewrite(
        &s,
        js_re!(r"(^|(?<!\d)[\s(])[-−–](\d)", "gu"),
        &js("$1minus $2"),
    );

    rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" "))
}
