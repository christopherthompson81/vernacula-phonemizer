//! Nepali (ne) text normalization: ZW joiners, native digits, visarga colons, abbreviations, ordinals in -औं,
//! clock times and ranges, signs, degrees, currency, units, rates, numeric ranges and fractions rewritten into
//! words before tokenizing. Pure text to text.
//! Ported from src/languages/nepali/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::numbers::{NumbersDef, indic_number_words_js};
use crate::core::postposed_sign::postposed_sign;
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;
use crate::languages::hindi::normalize::TextFn;

// Generated from the TS object literals (key order preserved).
const IRREGULAR: [(f64, &str); 6] = [
    (1.0, "पहिलो"),
    (2.0, "दोस्रो"),
    (3.0, "तेस्रो"),
    (4.0, "चौथो"),
    (6.0, "छैठौं"),
    (9.0, "नवौं"),
];
const UNIT_WORD: [(&str, &str); 4] = [
    ("किमी", "किलोमिटर"),
    ("मिमी", "मिलिमिटर"),
    ("सेमी", "सेन्टिमिटर"),
    ("किग्रा", "किलोग्राम"),
];
const RATE_NUM: &str = "किलोमिटर|मिलिमिटर|सेन्टिमिटर|मिटर|माइल|किमी|मिमी|गज";
const RATE_DEN: &str = "घण्टा|सेकेण्ड|सेकेन्ड|मिनेट";
const CURRENCY: [(&str, &str); 4] = [("$", "डलर"), ("£", "पाउन्ड"), ("€", "युरो"), ("¥", "येन")];
const NUM: &str = r"\d+(?:[.,]\d+)*(?![\d]|[.,]\d)";
const MAGNITUDE_ALT: &str = "मिलियन|बिलियन|ट्रिलियन|खरब|अर्ब|करोड|लाख|हजार";
const SUFFIX_MATRA: [(&str, &str); 2] = [("औं", "ौं"), ("औँ", "ौँ")];
const VISARGA_WORD_ALT: [&str; 7] = ["प्राय", "पुन", "अन्तत", "मुख्यत", "विशेषत", "सामान्यत", "स्वत"];

fn lookup<'a>(table: &[(&'a str, &'a str)], k: &str) -> Option<&'a str> {
    table.iter().find(|(key, _)| *key == k).map(|(_, v)| *v)
}

/// `Object.keys(UNIT_WORD).sort((a, b) => b.length - a.length).join("|")`: UTF-16 length, stable.
fn unit_alt() -> String {
    let mut k: Vec<&str> = UNIT_WORD.iter().map(|(k, _)| *k).collect();
    k.sort_by_key(|a| std::cmp::Reverse(js(a).len()));
    k.join("|")
}

/// `CUR_ALT`: the signs with `$` escaped; `NOUN_ALT`: the distinct nouns.
fn cur_alt() -> String {
    CURRENCY
        .iter()
        .map(|(c, _)| c.replace('$', "\\$"))
        .collect::<Vec<_>>()
        .join("|")
}

fn noun_alt() -> String {
    let mut seen: Vec<&str> = Vec::new();
    for (_, v) in CURRENCY {
        if !seen.contains(&v) {
            seen.push(v);
        }
    }
    seen.join("|")
}

fn mag_tail() -> String {
    format!(r"(\s*(?:{MAGNITUDE_ALT})(?![\p{{L}}\p{{M}}]))?")
}

fn noun_tail() -> String {
    format!(r"(\s*(?:{})(?![\p{{L}}\p{{M}}]))?", noun_alt())
}

static VISARGA_WORD: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}])({}):(?![\p{{L}}\p{{M}}])",
            VISARGA_WORD_ALT.join("|")
        ),
        "gu",
    )
    .unwrap()
});
static CUR_BEFORE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"({})\s?({NUM}){}{}", cur_alt(), mag_tail(), noun_tail()),
        "gu",
    )
    .unwrap()
});
static CUR_AFTER: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"({NUM}){}\s?({}){}", mag_tail(), cur_alt(), noun_tail()),
        "gu",
    )
    .unwrap()
});
static UNIT_SQUARED: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(\d)\s?({})(?:\s?²|2)(?![\p{{L}}\p{{M}}\d])", unit_alt()),
        "gu",
    )
    .unwrap()
});
static UNIT: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(\d)\s?({})(?![\p{{L}}\p{{M}}])", unit_alt()),
        "gu",
    )
    .unwrap()
});
static RATE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<![\p{{L}}\p{{M}}])({RATE_NUM})\s*/\s*({RATE_DEN})(?![\p{{L}}\p{{M}}])"),
        "gu",
    )
    .unwrap()
});

fn cardinal(n: f64, d: &NumbersDef) -> Vec<String> {
    indic_number_words_js(n, d)
        .into_iter()
        .map(|w| w.unwrap_or_default())
        .collect()
}

/// `makeNepaliNormalizer(numbers)`.
pub fn make_nepali_normalizer(numbers: &NumbersDef) -> TextFn {
    let numbers = numbers.clone();
    Box::new(move |input: &JsString| {
        let d = &numbers;
        let cardinal_text = |n: f64| cardinal(n, d).join(" ");
        let ordinal = |n: f64, suffix: &str| -> Option<String> {
            if let Some((_, irr)) = IRREGULAR.iter().find(|(k, _)| *k == n) {
                return Some(irr.to_string());
            }
            let mut words = cardinal(n, d);
            if words.is_empty() || words.iter().any(|w| w.is_empty()) {
                return None;
            }
            let last = words.len() - 1;
            let join = if js_re!(r"[\u0915-\u0939\u0958-\u095f]$", "u").test(&js(&words[last])) {
                lookup(&SUFFIX_MATRA, suffix).unwrap_or(suffix)
            } else {
                suffix
            };
            words[last] = format!("{}{join}", words[last]);
            Some(words.join(" "))
        };
        let clock = |h: f64, min: f64| -> String {
            if min == 0.0 {
                cardinal_text(h)
            } else {
                format!("{} बजेर {} मिनेट", cardinal_text(h), cardinal_text(min))
            }
        };

        let mut s = input.clone();
        s = rewrite(&s, js_re!("[\u{200C}\u{200D}]", "gu"), &JsString::new());
        s = rewrite_with(&s, js_re!("[०-९]", "gu"), |m, full| {
            let d = m.value(full).char_code_at(0).unwrap_or_default();
            js(&(d - 0x0966).to_string())
        });

        s = rewrite(&s, js_re!("(?<=[ऀ-ॣॲ-ॿ]):(?=[ऀ-ॣॲ-ॿ])", "gu"), &js("ः"));
        s = rewrite(&s, &VISARGA_WORD, &js("$1ः"));

        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}])कि\.\s?मी\.?", "gu"),
            &js("किलोमिटर"),
        );
        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}])यु\.\s?एस\.?", "gu"),
            &js("यु एस"),
        );
        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}])(डब्ल्यु|डब्ल्यू)\.(?=\s)", "gu"),
            &js("$1"),
        );

        s = rewrite(
            &s,
            js_re!(r"(?<![\p{L}\p{M}])डा\.(\s+)(?=[\p{L}])", "gu"),
            &js("डाक्टर$1"),
        );

        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\d.,:])([1-9]\d{0,2}(?:,\d{3})+|\d+)\s?(औं|औँ)(?![\p{L}\p{M}])",
                "gu"
            ),
            |m, full| {
                let digits = m.group(1, full).unwrap_or_default().to_string_lossy();
                let suffix = m.group(2, full).unwrap_or_default().to_string_lossy();
                let n = js_number(&js(&digits.replace(',', "")));
                if !is_safe_integer(n) {
                    return m.value(full);
                }
                ordinal(n, &suffix).map_or_else(|| m.value(full), |o| js(&o))
            },
        );

        s = rewrite(
            &s,
            js_re!(r"(?<![\d.,:])(\d{1,2}):(\d{2}\.\d{1,2})(?![\d:])", "gu"),
            &js("$1 $2"),
        );
        s = rewrite(
            &s,
            js_re!(
                r"(?<![\d.,:])((?:[01]?\d|2[0-3]):[0-5]\d)\s?[-–—]\s?((?:[01]?\d|2[0-3]):[0-5]\d)(?![\d:.])",
                "gu"
            ),
            &js("$1 देखि $2"),
        );
        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\d:.])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.])(\s*बजे(?![\p{L}\p{M}]))?",
                "gu"
            ),
            |m, full| {
                let h = js_number(&m.group(1, full).unwrap_or_default());
                let min = js_number(&m.group(2, full).unwrap_or_default());
                let body = clock(h, min);
                if min != 0.0 {
                    return js(&body);
                }
                let rest = full.slice(m.end() as isize, None);
                if m.group(3, full).is_some() || !js_re!(r"^\s*बज", "u").test(&rest) {
                    js(&format!("{body} बजे"))
                } else {
                    js(&body)
                }
            },
        );

        s = rewrite(&s, js_re!("±", "gu"), &js(" प्लस माइनस "));
        s = rewrite_with(
            &s,
            js_re!(r"(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)", "gu"),
            |m, full| {
                let before = full.slice(0, Some(m.index() as isize));
                if js_re!(r"\d\s*$", "u").test(&before) {
                    m.value(full)
                } else {
                    js("माइनस ")
                }
            },
        );
        s = rewrite(&s, js_re!(r"(\S)\+\s?(?=\d)", "gu"), &js("$1 प्लस "));
        s = rewrite(&s, js_re!(r"(^|\s)\+\s?(?=\d)", "gu"), &js("$1प्लस "));

        s = postposed_sign(&s, "<", &js("भन्दा कम"));
        s = postposed_sign(&s, ">", &js("भन्दा बढी"));
        s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" बराबर "));
        s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" विभाजन "));

        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?C(?![A-Za-z])", "gui"),
            &js("$1 डिग्री सेल्सियस "),
        );
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?F(?![A-Za-z])", "gui"),
            &js("$1 डिग्री फरेनहाइट "),
        );
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?N(?![A-Za-z])", "gu"),
            &js("$1 डिग्री उत्तर "),
        );
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?S(?![A-Za-z])", "gu"),
            &js("$1 डिग्री दक्षिण "),
        );
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?E(?![A-Za-z])", "gu"),
            &js("$1 डिग्री पूर्व "),
        );
        s = rewrite(
            &s,
            js_re!(r"(\d)\s?°\s?W(?![A-Za-z])", "gu"),
            &js("$1 डिग्री पश्चिम "),
        );
        s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 डिग्री "));

        // `${n}${mag ?? ""}${noun ?? ` ${CURRENCY[sign]}`}`; the sign is one of the table's own keys.
        let money = |n: JsString, mag: Option<JsString>, sign: &str, noun: Option<JsString>| {
            let mut out = n.concat(&mag.unwrap_or_default());
            out.push_str(&noun.unwrap_or_else(|| {
                js(&format!(" {}", lookup(&CURRENCY, sign).unwrap_or_default()))
            }));
            out
        };
        s = rewrite_with(&s, &CUR_BEFORE, |m, full| {
            let sign = m.group(1, full).unwrap_or_default().to_string_lossy();
            money(
                m.group(2, full).unwrap_or_default(),
                m.group(3, full),
                &sign,
                m.group(4, full),
            )
        });
        s = rewrite_with(&s, &CUR_AFTER, |m, full| {
            let sign = m.group(3, full).unwrap_or_default().to_string_lossy();
            money(
                m.group(1, full).unwrap_or_default(),
                m.group(2, full),
                &sign,
                m.group(4, full),
            )
        });

        s = rewrite_with(&s, &UNIT_SQUARED, |m, full| {
            let u = m.group(2, full).unwrap_or_default().to_string_lossy();
            m.group(1, full).unwrap_or_default().concat(&js(&format!(
                " वर्ग {}",
                lookup(&UNIT_WORD, &u).unwrap_or_default()
            )))
        });
        s = rewrite_with(&s, &UNIT, |m, full| {
            let u = m.group(2, full).unwrap_or_default().to_string_lossy();
            m.group(1, full).unwrap_or_default().concat(&js(&format!(
                " {}",
                lookup(&UNIT_WORD, &u).unwrap_or_default()
            )))
        });
        s = rewrite_with(&s, &RATE, |m, full| {
            let num = m.group(1, full).unwrap_or_default().to_string_lossy();
            let den = m.group(2, full).unwrap_or_default().to_string_lossy();
            js(&format!(
                "{} प्रति {den}",
                lookup(&UNIT_WORD, &num).unwrap_or(&num)
            ))
        });

        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\d.,:])(\d+(?:\.\d+)?)\s?[-–—]\s?(\d+(?:\.\d+)?)(?![\d.,:])(?!\s*देखि(?![\p{L}\p{M}]))",
                "gu"
            ),
            |m, full| {
                let a = m.group(1, full).unwrap_or_default();
                let b = m.group(2, full).unwrap_or_default();
                if js_number(&b) > js_number(&a) {
                    a.concat(&js(" देखि ")).concat(&b)
                } else {
                    m.value(full)
                }
            },
        );

        s = rewrite_with(
            &s,
            js_re!(
                r"(?<![\d/]|\d\.|\d,(?=\d{3}\/))(\d{1,3})\/(\d{1,3})(?![\d/]|\.\d|,(?:\d{3}(?!\d)|\d{2},\d))",
                "gu"
            ),
            |m, full| {
                let nw = cardinal_text(js_number(&m.group(1, full).unwrap_or_default()));
                let dw = cardinal_text(js_number(&m.group(2, full).unwrap_or_default()));
                if nw.is_empty() || dw.is_empty() {
                    m.value(full)
                } else {
                    js(&format!("{nw} बटा {dw}"))
                }
            },
        );

        s = rewrite(&s, js_re!(r"~\s?(?=\d)", "gu"), &js("लगभग "));
        s = rewrite(&s, js_re!(r" {2,}", "gu"), &js(" "));
        Ok(s)
    })
}
