//! Swahili (sw) text normalization: Latin diacritic folding, de-grouping, signs and degrees, ascending ranges as
//! `hadi`, decimals as `nukta`, era markers, spaced dashes and the relational signs. Pure text to text.
//! Ported from src/languages/swahili/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{Form, normalize, rewrite, rewrite_with};
use crate::js_re;

/// `expandDotted`'s two patterns for one body, built once (the TS builds them per call; same patterns).
struct Dotted {
    at_end: JsRegex,
    inline: JsRegex,
    word: String,
}

/// `DOTTED`, in the TS order; the bodies are the TS strings.
static DOTTED: LazyLock<Vec<Dotted>> = LazyLock::new(|| {
    let rows: [(&str, &str); 4] = [
        (r"B\.C\.E", MANIFEST.era_words.bce.as_str()),
        (r"A\.D", MANIFEST.era_words.ad.as_str()),
        (r"B\.C", MANIFEST.era_words.bce.as_str()),
        (r"n\.k", "na kadhalika"),
    ];
    rows.iter()
        .map(|(body, word)| Dotted {
            at_end: JsRegex::new(
                &format!("(?<![\\p{{L}}\\p{{M}}]){body}\\.(?=[ \u{a0}]*(?:$|\\p{{Lu}}))"),
                "gu",
            )
            .unwrap(),
            inline: JsRegex::new(&format!("(?<![\\p{{L}}\\p{{M}}]){body}\\."), "gu").unwrap(),
            word: word.to_string(),
        })
        .collect()
});

/// `expandDotted(s, body, word)`: the final dot is kept as a period at a sentence end, consumed inline.
fn expand_dotted(s: &JsString, d: &Dotted) -> JsString {
    let s = rewrite(s, &d.at_end, &js(&format!("{}.", d.word)));
    rewrite(&s, &d.inline, &js(&d.word))
}

/// `foldLatinDiacritics(s)`.
fn fold_latin_diacritics(s: &JsString) -> JsString {
    if !js_re!(r"[^\p{ASCII}]", "u").test(s) {
        return s.clone();
    }
    rewrite_with(s, js_re!(r"\p{Script=Latin}", "gu"), |m, t| {
        let ch = m.value(t);
        // `ch` is one character: off the seam.
        let base = js_re!(r"\p{Mn}+", "gu").replace(&normalize(&ch, Form::Nfd), &JsString::new());
        if base.is_empty() { ch } else { base }
    })
}

/// `normalizeSwahili(input)`. The numbered steps are order-dependent.
pub(crate) fn normalize_swahili(input: &JsString) -> JsString {
    let mut s = input.clone();

    s = fold_latin_diacritics(&s);

    s = rewrite(&s, js_re!(r"º", "gu"), &js("°"));

    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2})(,\d{3})+(?![\d]|,\d)", "gu"),
        |m, t| js_re!(r",", "gu").replace(&m.value(t), &JsString::new()),
    );

    s = rewrite(&s, js_re!(r"±", "gu"), &js(" plas hasi "));
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)", "gu"),
        |m, t| {
            if js_re!(r"\d\s*$", "u").test(&t.slice(0, Some(m.index() as isize))) {
                m.value(t)
            } else {
                js("hasi ")
            }
        },
    );
    s = rewrite(&s, js_re!(r"(\S)\+\s?(?=\d)", "gu"), &js("$1 plas "));
    s = rewrite(&s, js_re!(r"(^|\s)\+\s?(?=\d)", "gu"), &js("$1plas "));
    // A temperature range, claimed before the degree arms (#1595): see `normalize.ts`.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,\p{L}])(\d+(?:\.\d+)?)\s?[-–]\s?(\d+(?:\.\d+)?)\s?°\s?([CF])?(?![\p{L}\p{M}])",
            "gui"
        ),
        |m, t| {
            let (a, b) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
            if js_number(&a) < js_number(&b) {
                let name = match m.group(3, t) {
                    None => "",
                    Some(c) if c == js("C") || c == js("c") => " Selsiasi",
                    Some(_) => " Fahrenheit",
                };
                js("nyuzi joto ")
                    .concat(&a)
                    .concat(&js(" hadi "))
                    .concat(&b)
                    .concat(&js(name))
            } else {
                m.value(t)
            }
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(\d[\d.,]*)\s?°\s?C(?![\p{L}\p{M}])", "gui"),
        &js("nyuzi joto $1 Selsiasi"),
    );
    s = rewrite(
        &s,
        js_re!(r"([+-]?)(\d[\d.,]*)\s?°\s?F(?![\p{L}\p{M}])", "gui"),
        &js("nyuzi joto $2 Fahrenheit"),
    );
    s = rewrite(
        &s,
        js_re!(r"([+-]?)(\d[\d.,]*)\s?°", "gu"),
        &js("nyuzi joto $2"),
    );

    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,\p{L}])(\d+)\s?[-–]\s?(\d+)(?![\d.,\p{L}])", "gu"),
        |m, t| {
            let (a, b) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
            if js_number(&a) < js_number(&b) {
                a.concat(&js(" hadi ")).concat(&b)
            } else {
                m.value(t)
            }
        },
    );

    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?![\d\p{L}])", "gu"),
        |m, t| {
            let frac = JsString::join(&m.group(2, t).unwrap().code_point_strings(), &js(" "));
            m.group(1, t).unwrap().concat(&js(" nukta ")).concat(&frac)
        },
    );

    for d in DOTTED.iter() {
        s = expand_dotted(&s, d);
    }
    let bce = js(&MANIFEST.era_words.bce);
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])BCE(?![\p{L}\p{M}])", "gu"),
        &bce,
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d[ \u00a0])BC(?![\p{L}\p{M}])", "gu"),
        &bce,
    );

    s = rewrite(
        &s,
        js_re!(r"(?<![\d])\s+[-–—]+\s+(?![\d])", "gu"),
        &js(", "),
    );

    s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" sawa na "));
    s = rewrite(&s, js_re!(r"\s?<\s?", "gu"), &js(" chini ya "));
    s = rewrite(&s, js_re!(r"\s?>\s?", "gu"), &js(" zaidi ya "));
    s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" kugawanya kwa "));

    s
}
