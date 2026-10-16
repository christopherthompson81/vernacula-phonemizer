//! Bavarian (bar) text normalization: `&nbsp;`, `z. B.`, licensed ordinals (sourced stems only), dotted
//! abbreviations, the colon clock and clock ranges, dot- and space-grouped thousands, degrees, signs in the degree
//! slot, narrow fractions, ascending ranges, and the shared symbol tier.
//! Ported from src/languages/bavarian/normalize.ts — see that file for the corpus evidence and the refusals.

use std::collections::HashSet;
use std::sync::LazyLock;

use super::manifest::MANIFEST;
use super::numbers::number_to_words;
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const MONTHS: &str = "Jenna|Jänna|Jänner|Januar|Feba|Februar|Meaz|März|Aprui|Aprü|April|Mai|Juni|Julei|Juli|August|Septemba|September|Oktoba|Oktober|Novemba|November|Dezemba|Dezember";

const ORDINAL_NOUN: &str = r"Jo(?:a|ar|our)h+und(?:at|ad|eascht|ert)s?|Jh|Beziak|Person|Lebm?s?joar|Lebensjoar|Buachstob|Auflage";

fn set(words: &[&str]) -> HashSet<JsString> {
    words.iter().map(|w| js(w)).collect()
}

static LICENSER: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    set(&[
        "am", "om", "im", "vom", "zum", "beim", "ins", "seitm", "seit", "ausm", "aus", "bis",
        "nach", "noch", "vo", "von", "da", "dea", "de", "des", "dem", "den", "d", "ois", "as", "s",
    ])
});
static ARTICLE: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| set(&["da", "de", "dea", "des", "dem", "den", "d"]));
static WEAK_N: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    set(&[
        "am", "om", "im", "vom", "zum", "beim", "ins", "seitm", "seit", "ausm", "aus", "bis",
        "nach", "noch", "vo", "von", "dem", "den",
    ])
});
static GOVERNS_WEAK: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    set(&[
        "vo", "von", "in", "bei", "mid", "mit", "zu", "af", "auf", "an", "aus", "noch", "nach",
        "seit",
    ])
});

/// `DOTTED_ABBREV`, in its insertion order.
const DOTTED_ABBREV: [(&str, &str); 6] = [
    ("bzw", "beziehungsweise"),
    ("za", "zirka"),
    ("ca", "zirka"),
    ("eihw", "Eihwohna"),
    ("mrd", "Milliardn"),
    ("mio", "Millionen"),
];

/// `SYMBOLS`'s argument, generated from the object literal in normalize.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it. No `countForm`: the default selector.
const SYMBOL_DATA: &str = r#"{"percent":["Prozent"],"currency":{"€":["Eiro"],"US$":["Dollar"],"$":["Dollar"],"£":["Pfund"]},"units":{"km":["Kilometa"],"m":["Meta"],"cm":["Zantimeta"]},"exponentWords":{"squared":["Quadrat"],"cubed":["Kubik"],"position":"compound"},"magnitudes":["Millionan","Millionen","Milliona","Million","Mijona","Milliardn","Milliarde"]}"#;

pub(crate) static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let data: SymbolData =
        crate::core::from_json::parse_json(SYMBOL_DATA).map_err(|e| e.to_string())?;
    make_symbol_normalizer(&data)
});

const CLOCK: &str = r"(?<![\p{Nd}:])([01]?\d|2[0-3]):([0-5]\d)(?![:.]?\p{Nd})";
const NUM: &str = r"\p{Nd}[\p{Nd},.]*";
const JOINER: &str = "(?:bis|beziehungsweise|beziahungsweis)";

struct Res {
    ord: JsRegex,
    ord_head: JsRegex,
    abbrev_mid: JsRegex,
    abbrev_end: JsRegex,
    clock_range: JsRegex,
    clock: JsRegex,
    minus: JsRegex,
    plus: JsRegex,
}

static RES: LazyLock<Res> = LazyLock::new(|| {
    let re = |p: String, f: &str| JsRegex::new(&p, f).unwrap();
    let mut keys: Vec<&str> = DOTTED_ABBREV.iter().map(|(k, _)| *k).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(js(k).len()));
    let alt = keys.join("|");
    let degree_ahead = format!(r"(?=\s*{NUM}(?:\s+{JOINER}\s+[-−–+]?\s*{NUM})?\s+Grad)");
    Res {
        ord: re(
            r"(?:(\p{L}+)(\s+))?(?:(\p{L}+)(\s+))?(?<!\p{Nd})(\d{1,4})\.(?=\s+(\p{L}+))"
                .to_string(),
            "gu",
        ),
        ord_head: re(format!("^(?:{MONTHS}|{ORDINAL_NOUN})$"), "u"),
        abbrev_mid: re(
            format!(r"(?<![\p{{L}}\p{{M}}])({alt})\.(\s+)(?=[\p{{L}}\p{{Nd}}\p{{Sc}}])"),
            "giu",
        ),
        abbrev_end: re(
            format!(r"(?<![\p{{L}}\p{{M}}])({alt})\.(?=\s*(?:[.,;:!?»)]|$))"),
            "giu",
        ),
        clock_range: re(format!(r"{CLOCK}\s*[-–—]\s*{CLOCK}(\s*Uhr)?"), "gu"),
        clock: re(format!(r"{CLOCK}(\s*Uhr)?"), "gu"),
        minus: re(format!(r"(^|[\s(])[-−–]{degree_ahead}"), "gu"),
        plus: re(format!(r"(^|[\s(])\+{degree_ahead}"), "gu"),
    }
});

/// `ordinalWord(n, weak)`: `ORDINAL[n]` (a sourced stem, keyed by `String(n)`) plus the ending.
fn ordinal_word(n: f64, weak: bool) -> Option<JsString> {
    MANIFEST
        .ordinal_stems
        .get(&js_number_to_string(n))
        .map(|stem| js(stem).concat(&js(if weak { "n" } else { "e" })))
}

fn clock_words(h: &JsString, min: &JsString, uhr: &JsString) -> JsString {
    let head = number_to_words(js_number(h), None).concat(uhr);
    if js_number(min) == 0.0 {
        head
    } else {
        head.concat(&js(" "))
            .concat(&number_to_words(js_number(min), None))
    }
}

/// `normalizeBavarian(input)` (the symbol tier included, as its last step).
pub fn normalize_bavarian(symbols: &SymbolNormalizer, input: &JsString) -> JsString {
    let g = |m: &JsMatch, s: &JsString, i: usize| m.group(i, s).unwrap_or_default();
    let r = &*RES;
    let mut s = input.clone();

    // The third alternative is a LITERAL U+00A0 in the TS source, not an escape.
    s = rewrite(&s, js_re!(r"&nbsp;|&#160;| ", "gu"), &js(" "));

    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])z\.\s?B\.", "giu"),
        &js("zum Beispui"),
    );

    s = rewrite_with(&s, &r.ord, |m, w| {
        let whole = m.value(w);
        let (mut p2, mut s2) = (m.group(1, w), m.group(2, w));
        let (mut p1, mut s1) = (m.group(3, w), m.group(4, w));
        let digits = g(m, w, 5);
        let next = g(m, w, 6);
        if p1.is_none() {
            p1 = p2.take();
            s1 = s2.take();
        }
        let licensed = r.ord_head.test(&next)
            || (p1
                .as_ref()
                .is_some_and(|p| LICENSER.contains(&p.to_lower_case()))
                && js_re!(r"^\p{Lu}", "u").test(&next));
        if !licensed {
            return whole;
        }
        let low = p1.as_ref().map(|p| p.to_lower_case());
        let weak = low.as_ref().is_some_and(|l| {
            WEAK_N.contains(l)
                || (ARTICLE.contains(l)
                    && p2
                        .as_ref()
                        .is_some_and(|p| GOVERNS_WEAK.contains(&p.to_lower_case())))
        });
        match ordinal_word(js_number(&digits), weak) {
            None => whole,
            Some(word) => p2
                .unwrap_or_default()
                .concat(&s2.unwrap_or_default())
                .concat(&p1.unwrap_or_default())
                .concat(&s1.unwrap_or_default())
                .concat(&word),
        }
    });

    let abbrev = |ab: &JsString| {
        let k = ab.to_lower_case();
        DOTTED_ABBREV
            .iter()
            .find(|(key, _)| k == *key)
            .map(|(_, v)| js(v))
    };
    s = rewrite_with(&s, &r.abbrev_mid, |m, w| match abbrev(&g(m, w, 1)) {
        Some(word) => word.concat(&g(m, w, 2)),
        None => m.value(w),
    });
    s = rewrite_with(&s, &r.abbrev_end, |m, w| match abbrev(&g(m, w, 1)) {
        Some(word) => word.concat(&js(".")),
        None => m.value(w),
    });

    s = rewrite_with(&s, &r.clock_range, |m, w| {
        let uhr = m.group(5, w).unwrap_or_else(|| js(" Uhr"));
        clock_words(&g(m, w, 1), &g(m, w, 2), &JsString::new())
            .concat(&js(" bis "))
            .concat(&clock_words(&g(m, w, 3), &g(m, w, 4), &uhr))
    });
    s = rewrite_with(&s, &r.clock, |m, w| {
        let uhr = m.group(3, w).unwrap_or_else(|| js(" Uhr"));
        clock_words(&g(m, w, 1), &g(m, w, 2), &uhr)
    });

    s = rewrite(
        &s,
        js_re!(
            r"(?<=\p{Nd})(?<!(?<![\p{Nd}\.,])0)\.(?=\p{Nd}{3}(?!\p{Nd}))",
            "gu"
        ),
        &JsString::new(),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<!\p{Nd})([1-9]\p{Nd}{0,2})((?:[ \u00a0\u202f\u2009]\p{Nd}{3})+)(?!\p{Nd})",
            "gu"
        ),
        |m, w| {
            g(m, w, 1).concat(
                &js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&g(m, w, 2), &JsString::new()),
            )
        },
    );

    s = rewrite(
        &rewrite(&s, js_re!(r"℃", "gu"), &js("°C")),
        js_re!(r"℉", "gu"),
        &js("°F"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\p{Nd})\s*°\s*C(?![\p{L}\p{M}])", "gui"),
        &js("$1 Grad Celsius"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\p{Nd})\s*°\s*F(?![\p{L}\p{M}])", "gui"),
        &js("$1 Grad Fahrenheit"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\p{Nd})\s*°\s*[-–—](?=\p{L})", "gu"),
        &js("$1 Grad "),
    );
    s = rewrite(&s, js_re!(r"(\p{Nd})\s*°", "gu"), &js("$1 Grad"));

    s = rewrite(&s, &r.minus, &js("$1minus "));
    s = rewrite(&s, &r.plus, &js("$1plus "));
    s = rewrite(&s, js_re!(r"±", "gu"), &js(" plus minus "));

    s = rewrite_with(
        &s,
        js_re!(r"(?<!\p{Nd})(\p{Nd}{1,2})\/(\p{Nd})(?!\p{Nd})", "gu"),
        |m, w| {
            // `DENOM[Number(b)]`
            let noun = match js_number_to_string(js_number(&g(m, w, 2))).as_str() {
                "2" => "hoib",
                "3" => "Driddl",
                "4" => "Viadl",
                _ => return m.value(w),
            };
            let a = js_number(&g(m, w, 1));
            let head = if a == 1.0 {
                js("a")
            } else {
                number_to_words(a, None)
            };
            head.concat(&js(&format!(" {noun}")))
        },
    );

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![-–—\p{Nd}])(\p{Nd}{1,4})\s?[-–—]\s?(\p{Nd}{1,4})(?![-–—\p{Nd}])",
            "gu"
        ),
        |m, w| {
            let (a, b) = (g(m, w, 1), g(m, w, 2));
            if js_number(&b) > js_number(&a) {
                a.concat(&js(" bis ")).concat(&b)
            } else {
                m.value(w)
            }
        },
    );

    symbols.apply(&s)
}
