//! Korean (ko) text normalization: grouped thousands, speed units, units, degrees, signs, the relational and
//! division signs, ranges, decimals, native-series counters, digit runs joined to their counter and Latin
//! initialisms, all rewritten into Hangul the engine reads. Pure text→text.
//! Ported from src/languages/korean/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{MANIFEST, list};
use super::numbers::{number_to_words, spell_digits};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::numbers::digit_index;
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

// Generated from the TS object literals by .probe/ko/gen_tables.mts (key order preserved).
const UNIT_HANGUL: &[(&str, &str)] = &[
    ("km", "킬로미터"),
    ("cm", "센티미터"),
    ("mm", "밀리미터"),
    ("nm", "나노미터"),
    ("m", "미터"),
    ("kg", "킬로그램"),
    ("mg", "밀리그램"),
    ("ha", "헥타르"),
    ("ml", "밀리리터"),
    ("mi", "마일"),
    ("ft", "피트"),
];
const LETTER_HANGUL: &[(&str, &str)] = &[
    ("A", "에이"),
    ("B", "비"),
    ("C", "씨"),
    ("D", "디"),
    ("E", "이"),
    ("F", "에프"),
    ("G", "지"),
    ("H", "에이치"),
    ("I", "아이"),
    ("J", "제이"),
    ("K", "케이"),
    ("L", "엘"),
    ("M", "엠"),
    ("N", "엔"),
    ("O", "오"),
    ("P", "피"),
    ("Q", "큐"),
    ("R", "알"),
    ("S", "에스"),
    ("T", "티"),
    ("U", "유"),
    ("V", "브이"),
    ("W", "더블유"),
    ("X", "엑스"),
    ("Y", "와이"),
    ("Z", "제트"),
];
const WORD_ACRONYM: &[(&str, &str)] = &[
    ("UN", "유엔"),
    ("NATO", "나토"),
    ("NASA", "나사"),
    ("UNESCO", "유네스코"),
    ("UNICEF", "유니세프"),
    ("ASEAN", "아세안"),
    ("OPEC", "오펙"),
    ("AIDS", "에이즈"),
    ("FIFA", "피파"),
    ("COVID", "코비드"),
];
/// `UNIT_ALT`: the keys longest first (a stable sort).
const UNIT_ALT: &str = "km|cm|mm|nm|kg|mg|ha|ml|mi|ft|m";

fn lookup(t: &[(&str, &str)], k: &JsString) -> Option<JsString> {
    t.iter().find(|(key, _)| js(key) == *k).map(|(_, v)| js(v))
}

struct Native {
    ones: Vec<JsString>,
    tens: Vec<JsString>,
    twenty: JsString,
}

static NATIVE: LazyLock<Native> = LazyLock::new(|| {
    let n = &MANIFEST.numbers.native;
    Native {
        ones: list(&n.ones),
        tens: list(&n.tens),
        twenty: js(&n.twenty),
    }
});

static ONES: LazyLock<Vec<JsString>> = LazyLock::new(|| list(&MANIFEST.numbers.ones));

/// A native-Korean numeral 1–99 in its prenominal form.
fn native_numeral(n: f64) -> JsString {
    let (t, u) = ((n / 10.0).floor(), n % 10.0);
    if t == 2.0 && u == 0.0 {
        return NATIVE.twenty.clone();
    }
    let at = |v: &[JsString], i: f64| v.get(i as usize).cloned().unwrap_or_default();
    at(&NATIVE.tens, t).concat(&at(&NATIVE.ones, u))
}

const SPAN: &str = r"\d[\d.]*(?:\s?[-–—~〜～]\s?\d[\d.]*)?";

/// The three speed rules, built once: (regex, `${prefix} $1${word}`).
static SPEED: LazyLock<Vec<(JsRegex, JsString)>> = LazyLock::new(|| {
    [
        ("mph", "시속", "마일"),
        ("kph|km/h", "시속", "킬로미터"),
        ("m/s", "초속", "미터"),
    ]
    .iter()
    .map(|(unit, prefix, word)| {
        let re = JsRegex::new(
            &format!(r"(?<![\d.])(?:{prefix}\s?)?({SPAN})\s?(?:{unit})(?![A-Za-z\d])"),
            "gu",
        )
        .unwrap();
        (re, js(&format!("{prefix} $1{word}")))
    })
    .collect()
});

static UNIT_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<=\d)\s?({UNIT_ALT})([²³2-3])?(?![A-Za-z\d])"),
        "gu",
    )
    .unwrap()
});

/// ⚠ An operand is a whole eojeol (#1511): a number carries the Hangul glued to it, and a lone Latin letter
/// is bounded by all of Latin. See normalize.ts.
const OPERAND: &str = r"\d+[가-힣]*|[가-힣]+|(?<![\p{sc=Latn}\p{M}])[A-Za-z](?![\p{sc=Latn}\p{M}])";

/// The relational rules `=`, `<`, `>`, built once.
static RELATIONAL: LazyLock<Vec<(JsRegex, &'static str)>> = LazyLock::new(|| {
    ["=", "<", ">"]
        .iter()
        .map(|sign| {
            (
                JsRegex::new(&format!(r"({OPERAND})\s?{sign}\s?({OPERAND})"), "gu").unwrap(),
                *sign,
            )
        })
        .collect()
});

/// One operand → its Hangul word (a number spelled Sino, a lone Latin letter by its name).
fn k_word(t: &JsString) -> JsString {
    if js_re!(r"^\d+$", "u").test(t) {
        let w = number_to_words(js_number(t));
        if w.is_empty() { t.clone() } else { w }
    } else {
        lookup(LETTER_HANGUL, &t.to_upper_case()).unwrap_or_else(|| t.clone())
    }
}

/// Does this word end in a closed syllable? `w.codePointAt(w.length - 1) ?? 0`, a CODE UNIT position.
fn k_closed(w: &JsString) -> bool {
    let c = if w.is_empty() {
        0
    } else {
        w.code_point_at(w.len() - 1).unwrap_or(0)
    };
    (0xac00..=0xd7a3).contains(&c) && (c - 0xac00) % 28 != 0
}

fn k_topic(w: &JsString) -> JsString {
    w.concat(&js(if k_closed(w) { "은" } else { "는" }))
}

/// One all-caps Latin run → Hangul: the listed word reading, else its letter names joined.
fn spell(run: &JsString) -> JsString {
    if let Some(word) = lookup(WORD_ACRONYM, run) {
        return word;
    }
    let mut out = JsString::new();
    for ch in run.code_point_strings() {
        if let Some(name) = lookup(LETTER_HANGUL, &ch) {
            out.push_str(&name);
        }
    }
    if out.is_empty() { run.clone() } else { out }
}

/// Normalize one Korean input string.
pub fn normalize_korean(input: &JsString) -> JsString {
    // 1) comma-grouped thousands, looped.
    let mut s = input.clone();
    let mut prev = JsString::new();
    while prev != s {
        prev = s.clone();
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
    }

    // 2) speed units.
    for (re, rep) in SPEED.iter() {
        s = rewrite(&s, re, rep);
    }

    // 3) units, joined to the number.
    s = rewrite_with(&s, &UNIT_RE, |m, s| {
        let unit = m.group(1, s).unwrap();
        let pre = match m.group(2, s) {
            None => "",
            Some(e) if e == js("³") || e == js("3") => "세제곱",
            Some(_) => "제곱",
        };
        js(pre).concat(&lookup(UNIT_HANGUL, &unit).unwrap())
    });

    // 4) degrees, then the additive signs.
    s = rewrite(
        &s,
        js_re!(r"([-−–±]?)(\d+)\s?°\s?C(?![\p{sc=Latn}\p{M}])", "gui"),
        &js("섭씨 $1$2도"),
    );
    s = rewrite(
        &s,
        js_re!(r"([-−–±]?)(\d+)\s?°\s?F(?![\p{sc=Latn}\p{M}])", "gui"),
        &js("화씨 $1$2도"),
    );
    s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1도"));
    s = rewrite(&s, js_re!(r"±", "gu"), &js(" 플러스 마이너스 "));
    s = rewrite(&s, js_re!(r"(\d)\s?\+\s?(?=\d)", "gu"), &js("$1 더하기 "));
    s = rewrite(&s, js_re!(r"(^|[\s(])\+\s?(?=\d)", "gu"), &js("$1플러스 "));
    s = rewrite(
        &s,
        js_re!(r"(^|[\s(])[-−–](?=\d)", "gu"),
        &js("$1마이너스 "),
    );

    // 4b) relational and division signs.
    for (re, sign) in RELATIONAL.iter() {
        s = rewrite_with(&s, re, |m, s| {
            let a = k_word(&m.group(1, s).unwrap());
            let y = k_word(&m.group(2, s).unwrap());
            let tail = match *sign {
                "=" => y.concat(&js(if k_closed(&y) {
                    "과 같다"
                } else {
                    "와 같다"
                })),
                "<" => y.concat(&js("보다 작다")),
                _ => y.concat(&js("보다 크다")),
            };
            k_topic(&a).concat(&js(" ")).concat(&tail)
        });
    }
    s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" 나누기 "));
    s = rewrite(&s, js_re!(r"\s?&\s?", "gu"), &js(" 앤드 "));

    // 5) ranges.
    s = rewrite(
        &s,
        js_re!(r"(?<=\d)\s?[~〜～–—]\s?(?=\d)", "gu"),
        &js("에서 "),
    );

    // 6) decimals: 점, then the fractional digits one by one.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.])(\d+)\.(\d+)(?![\d.])", "gu"),
        |m, s| {
            let int = m.group(1, s).unwrap();
            let frac = m.group(2, s).unwrap();
            // ⚠ Past 2^53 number_to_words is "", which deleted the integer part (#1511): spell the digits.
            let w = number_to_words(js_number(&int));
            let w = if w.is_empty() { spell_digits(&int) } else { w };
            let mut out = w.concat(&js("점"));
            for d in frac.0.iter() {
                let i = digit_index(*d);
                if i >= 0
                    && let Some(w) = ONES.get(i as usize)
                {
                    out.push_str(w);
                }
            }
            out
        },
    );

    // 7) native-series counters, 1–99.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d{1,2})\s?(명|번째|번|시간|시(?![간드속])|개(?![월국])|마리|살|가지|척|사람)",
            "gu"
        ),
        |m, s| {
            let n = js_number(&m.group(1, s).unwrap());
            let counter = m.group(2, s).unwrap();
            if (1.0..=99.0).contains(&n) {
                native_numeral(n).concat(&counter)
            } else {
                m.value(s)
            }
        },
    );

    // 8) the month irregulars, then a digit run before Hangul → Sino words, joined.
    s = rewrite(&s, js_re!(r"(?<!\d)6월", "gu"), &js("유월"));
    s = rewrite(&s, js_re!(r"(?<!\d)10월", "gu"), &js("시월"));
    s = rewrite_with(&s, js_re!(r"(\d+)(?=[가-힣])", "gu"), |m, s| {
        let w = number_to_words(js_number(&m.group(1, s).unwrap()));
        if w.is_empty() { m.value(s) } else { w }
    });

    // 9) Latin initialisms → Hangul letter names.
    rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{Script=Latin}\p{M}])[A-Z][A-Z-]*[A-Z](?![\p{Script=Latin}\p{M}])|(?<![\p{Script=Latin}\p{M}])[A-Z](?![\p{Script=Latin}\p{M}])",
            "gu"
        ),
        |m, s| spell(&m.value(s)),
    )
}
