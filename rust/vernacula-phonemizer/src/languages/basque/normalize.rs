//! Basque (eu) text normalization: the ordinal indicator, digit grouping, degrees, a unit or rate glued to a case
//! ending, the shared symbol tier (prefix percent), a leading minus, a number glued to its case ending, and the
//! comma decimal rewritten into words.
//! Ported from src/languages/basque/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::{Arc, LazyLock};

use super::basque::cardinal_words;
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const SQUARED: &str = "karratu";
const CUBED: &str = "kubiko";
/// `UNITS`, in the TS object's order.
const UNITS: [(&str, &str); 4] = [
    ("km", "kilometro"),
    ("m", "metro"),
    ("kg", "kilogramo"),
    ("mm", "milimetro"),
];
const RATE_DENOMINATORS: [(&str, &str); 2] = [("h", "orduko"), ("s", "segundoko")];
const DEGREE: &str = "gradu";
const DECIMAL_WORD: &str = "koma";
const CASE_ENDINGS: [&str; 12] = [
    "etik", "eko", "ean", "era", "koa", "tik", "an", "ko", "ra", "en", "a", "n",
];
const ZERO: &str = "zero";

fn unit_noun(u: &JsString) -> &'static str {
    UNITS.iter().find(|(k, _)| *u == *k).unwrap().1
}

/// `SYMBOLS`'s argument, generated from the object literal in normalize.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it; `countForm` is `() => 0`, set below.
const SYMBOL_DATA: &str = r#"{"percent":["ehuneko"],"percentPrefix":true,"currency":{"€":["euro"],"£":["libera"],"$":["dolar"]},"units":{"km":["kilometro"],"m":["metro"],"kg":["kilogramo"],"mm":["milimetro"]},"magnitudes":["mila milioi","milioi","mila"],"rateDenominators":{"h":"orduko","s":"segundoko"},"unitPer":"","exponentWords":{"squared":["karratu"],"cubed":["kubiko"],"position":"after"}}"#;

static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let mut data: SymbolData =
        crate::core::from_json::parse_json(SYMBOL_DATA).map_err(|e| e.to_string())?;
    data.count_form = Some(Arc::new(|_| 0.0));
    make_symbol_normalizer(&data)
});

/// The symbol tier, or why it could not be built.
pub fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    SYMBOLS.as_ref().map_err(|e| e.clone())
}

fn unit_alt() -> String {
    let mut keys: Vec<&str> = UNITS.iter().map(|(k, _)| *k).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(js(k).len()));
    keys.join("|")
}

fn denom_alt() -> String {
    RATE_DENOMINATORS
        .iter()
        .map(|(k, _)| *k)
        .collect::<Vec<_>>()
        .join("|")
}

static RATE_ENDING: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}\d])({})/({})-({})(?![\p{{L}}\p{{M}}])",
            unit_alt(),
            denom_alt(),
            CASE_ENDINGS.join("|")
        ),
        "gu",
    )
    .unwrap()
});
static UNIT_ENDING: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}\d])({})(?:(²|³)-?|-)({})(?![\p{{L}}\p{{M}}])",
            unit_alt(),
            CASE_ENDINGS.join("|")
        ),
        "gu",
    )
    .unwrap()
});
/// The bare degree sign — the angular `gradu`, with a glued case ending on it (#1585).
static DEGREE_BARE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(\d)[ \u00a0]?°-?({})?(?![\p{{L}}\p{{M}}])",
            CASE_ENDINGS.join("|")
        ),
        "gu",
    )
    .unwrap()
});
static NUMBER_ENDING: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\d.,\p{{L}}\p{{M}}])(\d+)(?:[,.](\d+))?(-?)({})(?![\p{{L}}\p{{M}}])",
            CASE_ENDINGS.join("|")
        ),
        "gu",
    )
    .unwrap()
});

fn g(m: &JsMatch, i: usize, s: &JsString) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `(leading zeros, the rest)` of a fraction's digits.
fn split_zeros(frac: &JsString) -> (usize, JsString) {
    let zeros = js_re!("^0*", "u").exec(frac).map_or(0, |m| m.end());
    (zeros, frac.slice(zeros as isize, None))
}

fn fraction_digits(frac: &JsString) -> JsString {
    let (zeros, rest) = split_zeros(frac);
    let lead = vec![ZERO; zeros].join(" ");
    if rest.is_empty() {
        js(&lead)
    } else if lead.is_empty() {
        rest
    } else {
        js(&lead).concat(&js(" ")).concat(&rest)
    }
}

fn glue_fraction(head: &str, frac: &JsString, ending: &JsString) -> Option<JsString> {
    let (zeros, rest) = split_zeros(frac);
    let mut parts: Vec<JsString> = vec![js(ZERO); zeros];
    if rest.is_empty() {
        parts.pop();
        parts.push(js(ZERO).concat(ending));
    } else {
        let f = js_number(&rest);
        if !is_safe_integer(f) || f >= 1e12 {
            return None;
        }
        parts.push(js(&cardinal_words(f as u64)).concat(ending));
    }
    Some(js(&format!("{head} {DECIMAL_WORD} ")).concat(&JsString::join(&parts, &js(" "))))
}

/// `normalizeBasque(input)`. Steps are ORDER-DEPENDENT; see the TS for each one's coupling.
pub fn normalize_basque(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1) the masculine ordinal indicator read as a degree sign
    s = rewrite(&s, js_re!(r"\u00BA", "gu"), &js("\u{B0}"));

    // 2) digit grouping, dot then the spaces
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2})(?:\.\d{3})+(?!\d)", "gu"),
        |m, t| js_re!(r"\.", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})(?:[ \u00a0\u202f\u2009]\d{3})+(?!\d)",
            "gu"
        ),
        |m, t| js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&m.value(t), &JsString::new()),
    );

    // 3) degrees
    s = rewrite_with(
        &s,
        js_re!(r"(\d)[ \u00a0]?°[ \u00a0]?([CF])(?![\p{L}\p{M}])", "gui"),
        |m, t| {
            let scale = if g(m, 2, t).to_upper_case() == "C" {
                "Celsius"
            } else {
                "Fahrenheit"
            };
            g(m, 1, t).concat(&js(&format!(" {DEGREE} {scale}")))
        },
    );
    // the bare sign: `gradu` IS the angular degree, which is what every bare sign in the corpus is (#1585)
    s = rewrite_with(&s, &DEGREE_BARE, |m, t| {
        g(m, 1, t)
            .concat(&js(&format!(" {DEGREE}")))
            .concat(&g(m, 2, t))
    });

    // 4) a rate, then a unit, glued to a case ending
    s = rewrite_with(&s, &RATE_ENDING, |m, t| {
        let denom = g(m, 2, t);
        let d = RATE_DENOMINATORS
            .iter()
            .find(|(k, _)| denom == *k)
            .unwrap()
            .1;
        let ending = g(m, 3, t);
        let tail = if ending == "ko" || ending == "koa" {
            ending
        } else {
            js("ko").concat(&ending)
        };
        js(unit_noun(&g(m, 1, t)))
            .concat(&js(" "))
            .concat(&js_re!("ko$", "u").replace(&js(d), &JsString::new()))
            .concat(&tail)
    });
    s = rewrite_with(&s, &UNIT_ENDING, |m, t| {
        let exp = m.group(2, t);
        let modifier = match exp.as_ref().map(|e| e.to_string_lossy()) {
            Some(e) if e == "²" => format!(" {SQUARED}"),
            Some(e) if e == "³" => format!(" {CUBED}"),
            _ => String::new(),
        };
        js(unit_noun(&g(m, 1, t)))
            .concat(&js(&modifier))
            .concat(&g(m, 3, t))
    });

    // 5) the shared symbol tier
    s = try_symbols().unwrap().apply(&s);

    // 6) a leading minus
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.]\s{0,3})(?<![\p{L}\p{M}.,])[−-](?=\d)", "gu"),
        &js("minus "),
    );

    // 7) a number glued to its case ending (a comma fraction included)
    s = rewrite_with(&s, &NUMBER_ENDING, |m, t| {
        let whole = m.value(t);
        let n = js_number(&g(m, 1, t));
        if !is_safe_integer(n) || n < 0.0 || n >= 1e12 {
            return whole;
        }
        let head = cardinal_words(n as u64);
        if head.is_empty() {
            return whole;
        }
        let ending = g(m, 4, t);
        // an `e`-initial ending already carries the linking vowel (#1585): `5-eko` is *bosteko*
        if !g(m, 3, t).is_empty()
            && !js_re!("[aeiou]$", "u").test(&js(&head))
            && !ending.to_string_lossy().starts_with('e')
        {
            return whole;
        }
        match m.group(2, t) {
            None => js(&head).concat(&ending),
            Some(frac) => glue_fraction(&head, &frac, &ending).unwrap_or(whole),
        }
    });

    // 8) the comma decimal
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d,])(\d+),(\d+)(?![\d,\p{L}\p{M}])", "gu"),
        |m, t| {
            g(m, 1, t)
                .concat(&js(&format!(" {DECIMAL_WORD} ")))
                .concat(&fraction_digits(&g(m, 2, t)))
        },
    );
    // …and the dot decimal (#1585): every three-digit dot block is already de-grouped, so a dot left between
    // digits is a decimal; a further `.digit` is a dotted citation
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?![\d,\p{L}\p{M}]|\.\d)", "gu"),
        |m, t| {
            g(m, 1, t)
                .concat(&js(&format!(" {DECIMAL_WORD} ")))
                .concat(&fraction_digits(&g(m, 2, t)))
        },
    );

    let s = rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" "));
    rewrite(&s, js_re!(r"^[^\S\n]+|[^\S\n]+$", "gu"), &JsString::new())
}

/// #1585, as test/west-defects-1585.test.ts: relational where a well-formed twin exists, so no IPA is typed.
#[cfg(test)]
mod defects_1585_tests {
    use super::*;

    fn say(text: &str, lang: &str) -> String {
        crate::phonemize(text, lang).unwrap().trim().to_string()
    }

    fn n(s: &str) -> String {
        normalize_basque(&js(s)).to_string_lossy()
    }

    #[test]
    fn bare_degree_dot_decimal_and_the_e_initial_ending() {
        assert_eq!(n("20°"), "20 gradu");
        assert_eq!(n("20º"), "20 gradu");
        assert_eq!(n("10°tik"), "10 gradutik");
        assert_eq!(n("26 °C"), "26 gradu Celsius");
        assert_eq!(say("2.5 km", "eu"), say("2,5 km", "eu"));
        assert_eq!(say("8.0ko", "eu"), say("8,0ko", "eu"));
        assert!(!n("Am 2.18.19-26").contains("koma"));
        assert_eq!(say("5-eko", "eu"), say("5eko", "eu"));
        assert_eq!(n("995-ko"), "995-ko");
    }
}
