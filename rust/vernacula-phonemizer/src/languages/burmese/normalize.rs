//! Burmese (my) text normalization: invisible characters, digit grouping, rates, clocks, decimals, percent,
//! degrees, currency, fractions, ranges, squared/cubed and bare units, signs, `&` and dotted initialisms, into
//! Burmese words. Ported from src/languages/burmese/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::provenance::{escape, rewrite, rewrite_with};
use crate::js_re;

/// `D`: ASCII and Myanmar digits, as a class body.
const D: &str = "0-9၀-၉";
const DASH: &str = "[-‐-―−]";

/// The value of a run of ASCII or Burmese digits (U+1040–1049).
fn digit_value(s: &JsString) -> u64 {
    s.0.iter().fold(0, |acc, &c| {
        let v = if (0x1040..=0x1049).contains(&c) {
            c - 0x1040
        } else {
            c - u16::from(b'0')
        };
        acc * 10 + u64::from(v)
    })
}

/// `d(n)`: one digit, optionally quantified.
fn d(n: Option<u32>) -> String {
    match n {
        None => format!("[{D}]"),
        Some(n) => format!("[{D}]{{{n}}}"),
    }
}

/// `UNITS`, longest first: each regex's `.source` and its word. Generated from normalize.ts's array literal.
const UNITS: [(&str, &str); 8] = [
    ("km", "ကီလိုမီတာ"),
    ("kg", "ကီလိုဂရမ်"),
    ("cm", "စင်တီမီတာ"),
    ("mm", "မီလီမီတာ"),
    ("mg", "မီလီဂရမ်"),
    (r"[uµμ]g", "မိုက်ခရိုဂရမ်"),
    (r"\bm\b", "မီတာ"),
    (r"\bg\b", "ဂရမ်"),
];

/// `RATE_DENOMINATORS`: each regex's `.source` and its word.
const RATE_DENOMINATORS: [(&str, &str); 3] =
    [("kg", "ကီလိုဂရမ်"), (r"h(?:rs?)?", "နာရီ"), (r"d(?:ay)?", "ရက်")];

/// `Object.entries(CURRENCY)`, in key order.
const CURRENCY: [(&str, &str); 5] = [
    ("$", "ဒေါ်လာ"),
    ("€", "ယူရို"),
    ("£", "ပေါင်"),
    ("¥", "ယန်း"),
    ("₹", "ရူပီး"),
];

const EXP: [(&str, &str); 2] = [("²", "စတုရန်း"), ("³", "ကုဗ")];

struct Built {
    group: JsRegex,
    rates: Vec<(JsRegex, JsString)>,
    clock: JsRegex,
    decimal: JsRegex,
    percent: JsRegex,
    celsius: JsRegex,
    fahrenheit: JsRegex,
    degree: JsRegex,
    currency: Vec<(JsRegex, JsString)>,
    fraction: JsRegex,
    range: JsRegex,
    exponents: Vec<(JsRegex, JsString)>,
    units: Vec<(JsRegex, JsString)>,
    plus_infix: JsRegex,
    plus_prefix: JsRegex,
}

/// The patterns normalize.ts builds with `new RegExp`, built once.
static BUILT: LazyLock<Built> = LazyLock::new(|| {
    let re = |p: String, f: &str| JsRegex::new(&p, f).unwrap_or_else(|e| panic!("{p}: {e}"));
    let (d0, d2, d3) = (d(None), d(Some(2)), d(Some(3)));
    let mut rates = Vec::new();
    for (nre, nword) in UNITS {
        for (dre, dword) in RATE_DENOMINATORS {
            rates.push((
                re(
                    format!(
                        r"({d0}+(?:[.,]{d0}+)?(?:\s*[-‐-―−]\s*{d0}+(?:[.,]{d0}+)?)?)\s*(?:{nre})\s*/\s*(?:{dre})(?![\p{{L}}{D}])"
                    ),
                    "giu",
                ),
                js(&format!("တစ်{dword}လျှင် $1 {nword}")),
            ));
        }
    }
    let mut exponents = Vec::new();
    for (sup, modifier) in EXP {
        for (u, word) in UNITS {
            exponents.push((
                re(format!(r"({d0})\s*(?:{u})\s*{sup}"), "gu"),
                js(&format!("$1 {modifier}{word}")),
            ));
        }
    }
    Built {
        group: re(
            format!(r"(?<={d0})(?<!(?<!{d0})0)[,٬](?={d3}(?!{d0}))"),
            "gu",
        ),
        rates,
        clock: re(
            format!(r"(?<![{D}])({d0}{{1,2}}):({d2})(?!{d0})(\s*နာရီ(?=([\p{{L}}\p{{M}}]?)))?"),
            "gu",
        ),
        decimal: re(format!(r"({d0}+)\.({d0}+)"), "gu"),
        percent: re(format!(r"({d0}+)\s*[%％]"), "gu"),
        celsius: re(format!(r"({d0})\s*°\s*C(?![\p{{L}}])"), "giu"),
        fahrenheit: re(format!(r"({d0})\s*°\s*F(?![\p{{L}}])"), "giu"),
        degree: re(format!(r"({d0})\s*°"), "gu"),
        currency: CURRENCY
            .iter()
            .map(|&(sign, word)| {
                (
                    re(format!(r"{}\s*({d0}+)", escape(sign)), "gu"),
                    js(&format!("$1 {word}")),
                )
            })
            .collect(),
        fraction: re(format!(r"(?<!{d0})({d0}+)\s*/\s*({d0}+)(?!{d0})"), "gu"),
        range: re(
            format!(
                r"(?<!{DASH}\s*)(?<![{D}])(?<![×xX]\s{{0,2}})({d0}+)\s*{DASH}\s*({d0}+)(?!{d0})(?!\s*(?:{DASH}|အထိ|ထိ))"
            ),
            "gu",
        ),
        exponents,
        units: UNITS
            .iter()
            .map(|&(u, word)| {
                (
                    re(format!(r"({d0})\s*(?:{u})(?![\p{{L}}])"), "gu"),
                    js(&format!("$1 {word}")),
                )
            })
            .collect(),
        plus_infix: re(format!(r"({d0})\s*\+\s*({d0})"), "gu"),
        plus_prefix: re(format!(r"(?<![{D}])\+\s*(?={d0})"), "gu"),
    }
});

/// `normalizeBurmese(input)`. The steps are order-dependent, as in the TS.
/// The step-1 class holds literal format characters in the TS; here they are `\u{…}` escapes of the same code
/// points (clippy's `invisible_characters` denies the literal form).
pub fn normalize_burmese(input: &JsString) -> JsString {
    let bt = &*BUILT;
    let mut t = input.clone();

    // 1) Invisible characters; 2) digit grouping; 2b) rates (before the clock, decimal and range rules).
    t = rewrite(
        &t,
        js_re!("[\u{200B}-\u{200D}\u{2060}\u{FEFF}]", "gu"),
        &JsString::new(),
    );
    t = rewrite(&t, &bt.group, &JsString::new());
    for (r, rep) in &bt.rates {
        t = rewrite(&t, r, rep);
    }

    // 3) Clock, 4) decimal, 5) percent.
    // The clock guards (#1589): a following နာရီ is consumed, `:00` is the hour alone, and hour ≤ 24, minute ≤ 59
    // behind a left digit guard. See normalize.ts step 3.
    t = rewrite_with(&t, &bt.clock, |m, s| {
        let h = m.group(1, s).unwrap_or_default();
        let mm = m.group(2, s).unwrap_or_default();
        if digit_value(&h) > 24 || digit_value(&mm) > 59 {
            return m.value(s);
        }
        let mut read = if digit_value(&mm) == 0 {
            format!("{} နာရီ", h.to_string_lossy())
        } else {
            format!("{} နာရီ {} မိနစ်", h.to_string_lossy(), mm.to_string_lossy())
        };
        let glued = m.group(4, s).is_some_and(|g| !g.is_empty());
        if m.group(3, s).is_some() && glued {
            read.push(' ');
        }
        js(&read)
    });
    t = rewrite_with(&t, &bt.decimal, |m, s| {
        let whole = m.group(1, s).unwrap_or_default();
        let frac = m.group(2, s).unwrap_or_default();
        whole
            .concat(&js(" ဒသမ "))
            .concat(&JsString::join(&frac.code_point_strings(), &js(" ")))
    });
    t = rewrite(&t, &bt.percent, &js("$1 ရာခိုင်နှုန်း"));

    // 6) Degrees.
    t = rewrite(
        &rewrite(&t, js_re!(r"℃", "gu"), &js("°C")),
        js_re!(r"℉", "gu"),
        &js("°F"),
    );
    t = rewrite(&t, &bt.celsius, &js("$1 ဒီဂရီ စင်တီဂရိတ်"));
    t = rewrite(&t, &bt.fahrenheit, &js("$1 ဒီဂရီ ဖာရင်ဟိုက်"));
    t = rewrite(&t, &bt.degree, &js("$1 ဒီဂရီ"));

    // 7) Currency, 8) fractions, 9) ranges.
    for (r, rep) in &bt.currency {
        t = rewrite(&t, r, rep);
    }
    t = rewrite(&t, &bt.fraction, &js("$2 ပုံ $1 ပုံ"));
    t = rewrite(&t, &bt.range, &js("$1 မှ $2 အထိ"));

    // 10) Squared/cubed units, then 11) bare units.
    for (r, rep) in &bt.exponents {
        t = rewrite(&t, r, rep);
    }
    for (r, rep) in &bt.units {
        t = rewrite(&t, r, rep);
    }

    // 12) Relational and arithmetic signs.
    t = rewrite(&t, &bt.plus_infix, &js("$1 အပေါင်း $2"));
    t = rewrite(&t, &bt.plus_prefix, &js("အပေါင်း "));
    t = rewrite(&t, js_re!(r"[=≈]", "gu"), &js(" ညီမျှ "));
    t = rewrite(&t, js_re!(r"<", "gu"), &js(" ထက်ငယ် "));
    t = rewrite(&t, js_re!(r">", "gu"), &js(" ထက်ကြီး "));
    t = rewrite(
        &t,
        js_re!(r"×|(?<=\p{Nd})[ \t]?x[ \t]?(?=\p{Nd})", "gu"),
        &js(" မြှောက် "),
    );
    t = rewrite(&t, js_re!(r"÷", "gu"), &js(" စား "));
    t = rewrite(&t, js_re!(r"[ \t]{2,}", "gu"), &js(" "));

    // 13) The ampersand; 14) dotted initialisms lose their dots.
    t = rewrite(&t, js_re!(r"\s*[&＆]\s*", "gu"), &js(" နှင့် "));
    rewrite_with(
        &t,
        js_re!(r"(?<![\p{L}\p{M}])(?:\p{L}\.){2,}", "gu"),
        |m, s| js_re!(r"\.", "gu").replace(&m.value(s), &JsString::new()),
    )
}
