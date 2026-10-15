//! Separator hygiene: the vocabulary-free part of normalization for languages with no corpus — the space group,
//! multi-group grouping marks, short decimals, dotted dates / versions and an en / em dash span. Emits no word.
//! Ported from src/core/separatorHygiene.ts — see that file for the evidence and the refusals.

use std::sync::LazyLock;

use crate::core::js_regex::JsRegex;
use crate::core::js_string::JsString;
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `SP`: ASCII space, NBSP, NNBSP, thin space, written as escapes as the TS writes them.
const SP: &str = r"[ \u00a0\u202f\u2009]";

/// `SPACE_GROUP`.
static SPACE_GROUP: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<=\d)(?<!(?<![\d.,])0){SP}(?=\d{{3}}(?!\d))"),
        "gu",
    )
    .unwrap()
});

fn g(m: &crate::core::js_regex::JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `separatorHygiene(input)`. Pure text to text; the four rules in the TS order.
pub fn separator_hygiene(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 0) The space group, iterated to a fixed point (`for (let prev = ""; prev !== s; )`).
    let mut prev = JsString::new();
    while prev != s {
        prev = s.clone();
        s = rewrite(&s, &SPACE_GROUP, &JsString::new());
    }

    // 1) Two or more three-digit groups.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})((?:[.,]\d{3}){2,})(?!\d)(?![.,]\d)",
            "gu"
        ),
        |m, t| g(m, t, 1).concat(&js_re!(r"[.,]", "gu").replace(&g(m, t, 2), &JsString::new())),
    );

    // 2) A mark with one or two digits after it.
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+)[.,](\d{1,2})(?!\d)(?![.,]\d)", "gu"),
        &JsString::from("$1 $2"),
    );

    // 3) Three or more dot-joined digit runs.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.])(\d{1,4})((?:\.\d{1,4}){2,})(?!\d)(?!\.\d)",
            "gu"
        ),
        |m, t| g(m, t, 1).concat(&js_re!(r"\.", "gu").replace(&g(m, t, 2), &JsString::from(" "))),
    );

    // 4) An en or em dash between digits.
    rewrite(
        &s,
        js_re!(r"(\d)\s?[–—]\s?(?=\d)", "gu"),
        &JsString::from("$1, "),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    // The calls test/separator-hygiene.test.ts makes into src/ (every separatorHygiene call, and the phonemize
    // calls of the ported languages), with the value the TS returned, extracted MECHANICALLY (the suite run
    // under a recording vitest shim that also checked every matcher: all green). `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("separatorHygiene", &["1.234.567"], Some("1234567")),
        ("separatorHygiene", &["1,234,567"], Some("1234567")),
        ("separatorHygiene", &["1.234.567."], Some("1234567.")),
        ("separatorHygiene", &["1 000"], Some("1000")),
        ("separatorHygiene", &["1 000 000"], Some("1000000")),
        ("separatorHygiene", &["12 345 678"], Some("12345678")),
        ("separatorHygiene", &["1 385 000 000"], Some("1385000000")),
        ("separatorHygiene", &["1 000,5"], Some("1000 5")),
        ("separatorHygiene", &["1.234"], Some("1.234")),
        ("separatorHygiene", &["21 2001"], Some("21 2001")),
        ("separatorHygiene", &["1 0000"], Some("1 0000")),
        ("separatorHygiene", &["1 00"], Some("1 00")),
        ("separatorHygiene", &["0 000"], Some("0 000")),
        ("separatorHygiene", &["3,5"], Some("3 5")),
        ("separatorHygiene", &["19.95"], Some("19 95")),
        ("separatorHygiene", &["26.02.1994"], Some("26 02 1994")),
        ("separatorHygiene", &["198.51.100.0"], Some("198 51 100 0")),
        ("separatorHygiene", &["v2.1.3"], Some("v2 1 3")),
        ("separatorHygiene", &["1990–1995"], Some("1990, 1995")),
        ("separatorHygiene", &["1990—1995"], Some("1990, 1995")),
        ("separatorHygiene", &["1,234"], Some("1,234")),
        ("separatorHygiene", &["3.141"], Some("3.141")),
        ("separatorHygiene", &["1990-1995"], Some("1990-1995")),
        ("separatorHygiene", &["COVID-19"], Some("COVID-19")),
        ("separatorHygiene", &["14:30"], Some("14:30")),
        ("separatorHygiene", &["8:10-12"], Some("8:10-12")),
        (
            "separatorHygiene",
            &["Chapter 1. 5 things"],
            Some("Chapter 1. 5 things"),
        ),
        ("separatorHygiene", &["1. maja"], Some("1. maja")),
        ("separatorHygiene", &["50%"], Some("50%")),
        ("separatorHygiene", &["$100"], Some("$100")),
        ("separatorHygiene", &["25 °C"], Some("25 °C")),
        (
            "phonemize",
            &["1.234.567", "nog"],
            Some("ˈbir milliˈon eˈki ˈjuz oˈtɯz ˈdørt ˈmɯŋ ˈbes ˈjuz alˈpɯs jeˈti"),
        ),
        (
            "phonemize",
            &["26.02.1994", "nog"],
            Some("jɯrˈma alˈtɯ eˈki ˈmɯŋ toˈɡɯz ˈjuz tokˈsan ˈdørt"),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        use crate::core::js_string::js;
        // test/separator-hygiene.test.ts also pins `phonemize` in seven languages not yet ported (quc naq rup kl mto
        // smj grc); only its separatorHygiene calls and the ported `nog` rows are replayed here.
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "separatorHygiene" => Some(separator_hygiene(&a(0))),
                "phonemize" => Some(js(&crate::phonemize(
                    &a(0).to_string_lossy(),
                    &a(1).to_string_lossy(),
                )
                .unwrap())),
                _ => panic!("no replay for {f}"),
            }
        };
        for (f, args, want) in TS_SUITE_CALLS {
            let a = |i: usize| js(args[i]);
            let got: Option<String> = call(f, &a).map(|s| s.to_string_lossy());
            assert_eq!(got.as_deref(), *want, "{f}{args:?}");
        }
    }
}
