//! Uzbek (uz) text normalization: digit de-grouping, era markers and abbreviations, clocks, version dots, the
//! `N-word` ordinal, regnal ordinals, fractions, degrees, signs, suffixed percents, prefixed rates, lone initials
//! and the initialism pass. Ported from src/languages/uzbek/normalize.ts — see that file for the corpus evidence.

use std::sync::{Arc, LazyLock};

use super::numbers::{number_to_words, ordinal_words};
use crate::core::initialisms::{
    InitialismData, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `WORD`: a word character, the modifier-letter apostrophes included (U+02BB ' U+2019 U+2018 ` U+02BC U+2032).
const WORD: &str = "[A-Za-z\u{2bb}'\u{2019}\u{2018}`\u{2bc}\u{2032}]";
const DIGITS: &str = r"(\d+(?:,\d+)?)";

/// `LETTER_NAME`. Generated from normalize.ts's object literal.
const LETTER_NAME: [(&str, &str); 26] = [
    ("a", "a"),
    ("b", "be"),
    ("c", "se"),
    ("d", "de"),
    ("e", "e"),
    ("f", "ef"),
    ("g", "ge"),
    ("h", "ha"),
    ("i", "i"),
    ("j", "je"),
    ("k", "ka"),
    ("l", "el"),
    ("m", "em"),
    ("n", "en"),
    ("o", "o"),
    ("p", "pe"),
    ("q", "qa"),
    ("r", "er"),
    ("s", "es"),
    ("t", "te"),
    ("u", "u"),
    ("v", "ve"),
    ("w", "ve"),
    ("x", "xa"),
    ("y", "ye"),
    ("z", "ze"),
];

/// `LETTER_NAME[l.toLowerCase()]`: `l` is one code point, whose lowercase is no `Object.prototype` member.
fn letter_name(l: &JsString) -> Option<JsString> {
    let k = l.to_lower_case();
    LETTER_NAME
        .iter()
        .find(|(c, _)| k == **c)
        .map(|(_, n)| js(n))
}

type WordTest = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

static IS_UNREADABLE: LazyLock<WordTest> = LazyLock::new(|| {
    let set = |v: &[&str]| v.iter().map(|s| js(s)).collect();
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(r"[aeiou]", "u").unwrap(),
        legal_onsets: set(&[
            "bl", "br", "by", "dr", "dy", "fl", "fr", "gl", "gr", "kl", "kr", "kv", "ky", "pl",
            "pr", "ps", "py", "sk", "sl", "sm", "sn", "sp", "st", "sv", "sy", "tr", "ts", "vy",
        ]),
        legal_codas: set(&[
            "ft", "kt", "ks", "lm", "lt", "nd", "ng", "nk", "nt", "pt", "rd", "rf", "rk", "rl",
            "rm", "rn", "rp", "rs", "rt", "sk", "st", "ts", "yk",
        ]),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableUzbek(word)` (module-private in the TS; exposed for the differential).
pub(crate) fn is_unreadable_uzbek(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

const WORD_ACRONYMS: [&str; 6] = ["aqsh", "nasa", "asus", "opec", "rem", "covid"];
const ACRONYM_LETTERS: [&str; 4] = ["pa", "to", "oha", "aol"];

/// `normalizeInitialisms` (module-private in the TS).
pub(crate) fn normalize_uzbek_initialisms(text: &JsString) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: Arc::new(letter_name),
            lower: None,
            acronym_letters: Arc::new(|w: &JsString| ACRONYM_LETTERS.iter().any(|a| *w == **a)),
            is_recorded: |w: &JsString| WORD_ACRONYMS.iter().any(|a| *w == **a),
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(text)
}

fn g(m: &JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

struct Built {
    version: JsRegex,
    ordinal: JsRegex,
    rate_km_range: JsRegex,
    rate_mil_range: JsRegex,
    rate_km: JsRegex,
    rate_mil: JsRegex,
    rate_milya: JsRegex,
    rate_ms: JsRegex,
}

/// The patterns normalize.ts builds with `new RegExp`, built once.
static BUILT: LazyLock<Built> = LazyLock::new(|| {
    let re = |p: String, f: &str| JsRegex::new(&p, f).unwrap();
    let rate_suffix = r"(?:\s?(ga|gacha|dan|da))?";
    Built {
        version: re(
            format!(r"(?<![\d.,])(\d+)\.(\d+)(?:-({WORD}+))?(?!{WORD})"),
            "gu",
        ),
        ordinal: re(format!(r"{DIGITS}-({WORD}+)(?!{WORD})"), "gu"),
        rate_km_range: re(
            r"(\d+(?:,\d+)?)[–-](\d+(?:,\d+)?)\s?km\s?\/\s?(?:soat|s|h)(?![\p{L}\p{M}])".into(),
            "giu",
        ),
        rate_mil_range: re(
            r"(\d+(?:,\d+)?)[–-](\d+(?:,\d+)?)\s?mil\s?\/\s?(?:soat|s|h)(?![\p{L}\p{M}])".into(),
            "giu",
        ),
        rate_km: re(
            format!(r"(\d+(?:,\d+)?)\s?km\s?\/\s?(?:soat|s|h){rate_suffix}(?![\p{{L}}\p{{M}}])"),
            "giu",
        ),
        rate_mil: re(
            format!(r"(\d+(?:,\d+)?)\s?mil\s?\/\s?(?:soat|s|h){rate_suffix}(?![\p{{L}}\p{{M}}])"),
            "giu",
        ),
        rate_milya: re(
            format!(r"(\d+(?:,\d+)?)\s?milya\s?\/\s?soat{rate_suffix}(?![\p{{L}}\p{{M}}])"),
            "giu",
        ),
        rate_ms: re(
            format!(r"(\d+(?:,\d+)?)\s?m\s?\/\s?s{rate_suffix}(?![\p{{L}}\p{{M}}])"),
            "giu",
        ),
    }
});

/// `d.replace(",", ".")`: the FIRST comma only.
fn first_comma_to_dot(d: &JsString) -> JsString {
    js(&d.to_string_lossy().replacen(',', ".", 1))
}

/// A rate's replacement: `${prefix} ${n} ${unit}${sfx ?? ""}`.
fn rate(s: &JsString, re: &JsRegex, prefix: &str, unit: &str) -> JsString {
    rewrite_with(s, re, |m, t| {
        js(&format!("{prefix} "))
            .concat(&g(m, t, 1))
            .concat(&js(&format!(" {unit}")))
            .concat(&g(m, t, 2))
    })
}

/// `normalizeUzbek(input)`. The numbered steps are order-dependent, as in the TS.
pub(crate) fn normalize_uzbek(input: &JsString) -> JsString {
    let b = &*BUILT;
    let mut s = input.clone();

    // 0) digit de-grouping, twice; then every grouping space becomes an ASCII space.
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
    s = rewrite(&s, js_re!(r"[ \u00a0\u202f\u2009]", "gu"), &js(" "));

    // 1) era markers.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])m\.a\.(?=\s*(?:\d|milodiy|avval))", "giu"),
        &js("miloddan avval"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])m\.a\.(?![\p{L}\p{M}])", "giu"),
        &js("miloddan avval"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])m\.(?=\s*\d)", "giu"),
        &js("milodiy"),
    );

    // 2) dotted abbreviations.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])h\.k\.(?=\s+\p{L})", "giu"),
        &js("hokazo"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])h\.k\.(?=\s*(?:[.,;:!?»)]|$))", "giu"),
        &js("hokazo."),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])mln\.(?=\s+\p{L})", "giu"),
        &js("million"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])mln\.(?=\s*(?:[.,;:!?»)]|$))", "giu"),
        &js("million."),
    );

    // 3) the clock: zero minutes dropped; output stays digits.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])", "gu"),
        |m, t| {
            let (h, min) = (g(m, t, 1), g(m, t, 2));
            if js_number(&min) == 0.0 {
                h
            } else {
                h.concat(&js(" ")).concat(&min)
            }
        },
    );

    // 4) version dots, consuming a following hyphen-word.
    s = rewrite_with(&s, &b.version, |m, t| {
        let head = g(m, t, 1).concat(&js(" nuqta ")).concat(&g(m, t, 2));
        match m.group(3, t) {
            None => head,
            Some(w) => head.concat(&js(" ")).concat(&w),
        }
    });

    // 5) the `N-word` ordinal (two cardinal exceptions).
    s = rewrite_with(&s, &b.ordinal, |m, t| {
        let (d, w) = (g(m, t, 1), g(m, t, 2));
        let wl = w.to_lower_case();
        let n = js_number(&first_comma_to_dot(&d));
        if wl.starts_with(&js("regbi")) || wl.starts_with(&js("moliviy")) {
            // A numeral past 2⁵³ stays digits, for the engine's digit-at-a-time reading (#1576).
            let card = number_to_words(n);
            return if card.is_empty() { d } else { card }
                .concat(&js(" "))
                .concat(&w);
        }
        match ordinal_words(n) {
            None => d.concat(&js(" ")).concat(&w),
            Some(ord) => ord.concat(&js(" ")).concat(&w),
        }
    });

    // 6) regnal ordinals, before a genitive.
    s = rewrite_with(
        &s,
        js_re!(
            r"(\p{Lu}\p{Ll}+\p{M}*)[ \u00a0](\d{1,2})(?![,\d])(?=[ \u00a0](?:ning|hukmron))",
            "gu"
        ),
        |m, t| {
            let n = js_number(&g(m, t, 2));
            match ordinal_words(n) {
                Some(ord) if (2.0..=39.0).contains(&n) => g(m, t, 1).concat(&js(" ")).concat(&ord),
                _ => m.value(t),
            }
        },
    );

    // 7) fractions.
    s = rewrite(&s, js_re!(r"(\d+)¾", "gu"), &js("$1 va uch chorak"));
    s = rewrite(&s, js_re!(r"(\d+)½", "gu"), &js("$1 va yarim"));
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,/])(\d{1,2})\/(\d{1,2})(?![\d.,/])", "gu"),
        |m, t| {
            let (num, denom) = (js_number(&g(m, t, 1)), js_number(&g(m, t, 2)));
            if denom < 2.0 || num < 1.0 || num >= denom {
                return m.value(t);
            }
            if num == 1.0 && denom == 2.0 {
                return js("yarim");
            }
            if num == 1.0 && denom == 4.0 {
                return js("chorak");
            }
            number_to_words(denom)
                .concat(&js("dan "))
                .concat(&number_to_words(num))
        },
    );

    // 8) degrees.
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?C(?![\p{L}\p{M}])", "giu"),
        &js("$1 daraja"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?F(?![\p{L}\p{M}])", "giu"),
        &js("$1 daraja farengeyt"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°(?![\p{L}\p{M}])", "gu"),
        &js("$1 daraja"),
    );

    // 9) signs; infix + before postposed.
    s = rewrite(&s, js_re!(r"±", "gu"), &js(" plyus minus "));
    s = rewrite(&s, js_re!(r"(\S)\+\s?(\d)", "gu"), &js("$1 plyus $2"));
    s = rewrite(&s, js_re!(r"(\d)\s?\+", "gu"), &js("$1 plyus"));
    s = rewrite(&s, js_re!(r"(^|\s)\+\s?(\d)", "gu"), &js("$1plyus $2"));
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{Nd}])[-−](?=\d)", "gu"),
        &js("minus "),
    );
    s = rewrite_with(&s, js_re!(r"([A-Za-z])&([A-Za-z])", "g"), |m, t| {
        let (a, bb) = (g(m, t, 1), g(m, t, 2));
        letter_name(&a)
            .unwrap_or(a)
            .concat(&js(" va "))
            .concat(&letter_name(&bb).unwrap_or(bb))
    });
    s = rewrite(&s, js_re!(r"&", "gu"), &js(" va "));
    s = rewrite(&s, js_re!(r"(\S)\s*=\s*(\S)", "gu"), &js("$1 teng $2"));
    s = rewrite(&s, js_re!(r"(\d)\s*<\s*(\d)", "gu"), &js("$1 kichik $2"));
    s = rewrite(&s, js_re!(r"(\d)\s*>\s*(\d)", "gu"), &js("$1 katta $2"));
    s = rewrite(&s, js_re!(r"(\d)\s*×\s*(\d)", "gu"), &js("$1 karra $2"));
    s = rewrite(&s, js_re!(r"(\d)\s*÷\s*(\d)", "gu"), &js("$1 boʻlish $2"));

    // 9b) a percent with the possessive suffix.
    s = rewrite(
        &s,
        js_re!(r"(\d+)%i(?![\p{L}\p{M}])", "gu"),
        &js("$1 foizi"),
    );

    // 10) rates, prefixed; a case suffix travels with the unit.
    s = rewrite(&s, &b.rate_km_range, &js("soatiga $1 dan $2 kilometr"));
    s = rewrite(&s, &b.rate_mil_range, &js("soatiga $1 dan $2 mil"));
    s = rate(&s, &b.rate_km, "soatiga", "kilometr");
    s = rate(&s, &b.rate_mil, "soatiga", "mil");
    s = rate(&s, &b.rate_milya, "soatiga", "milya");
    s = rate(&s, &b.rate_ms, "soniyasiga", "metr");
    s = rewrite(
        &s,
        js_re!(r"(\d+(?:,\d+)?)\s?Gs\b(?![\p{L}\p{M}])", "giu"),
        &js("$1 gigagerts"),
    );

    // 10b) a lone personal initial before a word.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])([A-Z])\.(?=[ \u00a0]+[A-Za-z])", "gu"),
        |m, t| {
            let l = g(m, t, 1);
            letter_name(&l).unwrap_or(l)
        },
    );

    // 11) initialisms, last of the letter rules.
    normalize_uzbek_initialisms(&s)
}
