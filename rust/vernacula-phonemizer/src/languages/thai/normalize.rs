//! Thai text normalization: the ordered pre-tokenizer pass that rewrites digits, repetition and abbreviation
//! marks, numbers, clocks, decimals, abbreviations, signs and initialisms into Thai-script words.
//! Ported from src/languages/thai/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::MANIFEST;
use super::segment::segment;
use crate::core::boundaries::NOT_LETTER_BEFORE;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::numbers::digit_index;
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

// Generated from the TS literals by .probe/th/gen_tables.mts (key order preserved).
pub const THAI_DIGIT_WORDS: [&str; 10] = [
    "ศูนย์",
    "หนึ่ง",
    "สอง",
    "สาม",
    "สี่",
    "ห้า",
    "หก",
    "เจ็ด",
    "แปด",
    "เก้า",
];
const ABBREV: [(&str, &str, bool); 15] = [
    ("กม./ชม.", "กิโลเมตร ต่อ ชั่วโมง", true),
    ("ไมล์/ชม.", "ไมล์ ต่อ ชั่วโมง", true),
    ("ตร.กม.", "ตาราง กิโลเมตร", true),
    ("ตร.มม.", "ตาราง มิลลิเมตร", true),
    ("กม.", "กิโลเมตร", true),
    ("มม.", "มิลลิเมตร", true),
    ("ซม.", "เซนติเมตร", true),
    ("กก.", "กิโลกรัม", true),
    ("ชม.", "ชั่วโมง", true),
    ("ม.", "เมตร", true),
    ("ค.ศ.", "คริสต์ศักราช", false),
    ("พ.ศ.", "พุทธศักราช", false),
    ("พ.ย.", "พฤศจิกายน", false),
    ("ก.พ.", "กุมภาพันธ์", false),
    ("ดร.", "ดอกเตอร์", false),
];

/// `esc(s)`: `s.replace(/[.$*+?^{}()|[\]\\/]/gu, "\\$&")`.
fn esc(s: &JsString) -> JsString {
    js_re!(r"[.$*+?^{}()|[\]\\/]", "gu").replace(s, &js(r"\$&"))
}

struct AbbrevRule {
    re: JsRegex,
    to: JsString,
    unit_only: bool,
}

/// `ABBREV_RULES`, longest key first as `ABBREV` is ordered.
static ABBREV_RULES: LazyLock<Vec<AbbrevRule>> = LazyLock::new(|| {
    ABBREV
        .iter()
        .map(|&(from, to, unit_only)| {
            let lead = if unit_only {
                r"(?<=\d\s?)"
            } else {
                NOT_LETTER_BEFORE
            };
            let pattern = format!("{lead}{}", esc(&js(from)).to_string_lossy());
            AbbrevRule {
                re: JsRegex::new(&pattern, "gu").unwrap_or_else(|e| panic!("{pattern}: {e}")),
                to: js(to),
                unit_only,
            }
        })
        .collect()
});

/// `spellDigits(ds)`: each digit by its Thai word, space-joined.
fn spell_digits(ds: &JsString) -> JsString {
    let parts: Vec<JsString> = ds
        .code_point_strings()
        .into_iter()
        .map(|d| {
            let i = if d.len() == 1 {
                digit_index(d.0[0])
            } else {
                -1
            };
            if i >= 0 {
                js(THAI_DIGIT_WORDS[i as usize])
            } else {
                d
            }
        })
        .collect();
    JsString::join(&parts, &js(" "))
}

/// `String(Number(digits))`.
fn number_str(digits: &JsString) -> String {
    js_number_to_string(js_number(digits))
}

/// `clock(hh, mm)`: `H นาฬิกา M นาที`, zero minutes dropped.
fn clock(hh: &JsString, mm: &JsString) -> JsString {
    let mut out = format!("{} นาฬิกา", number_str(hh));
    if js_number(mm) != 0.0 {
        out.push_str(&format!(" {} นาที", number_str(mm)));
    }
    js(&out)
}

fn group(m: &crate::core::js_regex::JsMatch, i: usize, s: &JsString) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `normalizeThai(input)`: the ordered pass.
pub fn normalize_thai(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1. Thai digits
    s = rewrite_with(&s, js_re!("[๐-๙]", "gu"), |m, s| {
        let c = m.value(s).0[0] as u32;
        js(&(c - 0x0E50).to_string())
    });

    // 2. ฯลฯ
    s = rewrite(&s, js_re!("ฯลฯ", "gu"), &js("และอื่น ๆ"));

    // 3. ๆ repeats the last segmented word of its Thai antecedent
    s = rewrite_with(&s, js_re!(r"([ก-ๅ็-๎]*)\s*ๆ", "gu"), |m, s| {
        let run = group(m, 1, s);
        if run.is_empty() {
            return JsString::new();
        }
        let seg = segment(&run);
        let mut out = run.clone();
        out.push_str(&js(" "));
        // `seg[seg.length - 1]!`: a non-empty run always segments to at least one word.
        out.push_str(seg.last().expect("non-empty run"));
        out
    });

    // 4. ฯ
    s = rewrite(&s, js_re!("ฯ", "gu"), &JsString::new());

    // 5. de-group thousands
    s = rewrite(
        &s,
        js_re!(r"(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?!\d))", "gu"),
        &JsString::new(),
    );

    // 6. clock: range, then HH.MM น., then H น. (each hour refuses the tail of a longer number)
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.])(\d{1,2})[.:](\d{2})\s*[-–—]\s*(\d{1,2})[.:](\d{2})\s*น\.",
            "gu"
        ),
        |m, s| {
            let mut out = clock(&group(m, 1, s), &group(m, 2, s));
            out.push_str(&js(" ถึง "));
            out.push_str(&clock(&group(m, 3, s), &group(m, 4, s)));
            out
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.])(\d{1,2})[.:](\d{2})\s*น\.", "gu"),
        |m, s| clock(&group(m, 1, s), &group(m, 2, s)),
    );
    s = rewrite_with(&s, js_re!(r"(?<![\d.])(\d{1,2})\s*น\.", "gu"), |m, s| {
        js(&format!("{} นาฬิกา", number_str(&group(m, 1, s))))
    });

    // 6b. Thai unit abbreviations, BEFORE the decimals: `3.5 กม.` must still see its digit
    for r in ABBREV_RULES.iter().filter(|r| r.unit_only) {
        s = rewrite(&s, &r.re, &r.to);
    }

    // 7. decimals
    s = rewrite_with(&s, js_re!(r"(\d)\.(\d+)", "gu"), |m, s| {
        let mut out = group(m, 1, s);
        out.push_str(&js(" จุด "));
        out.push_str(&spell_digits(&group(m, 2, s)));
        out
    });

    // 8. Thai abbreviations (eras, titles)
    for r in ABBREV_RULES.iter().filter(|r| !r.unit_only) {
        s = rewrite(&s, &r.re, &r.to);
    }

    // 8b. plus
    s = rewrite(&s, js_re!(r"\s*\+\s*(?=\d)", "gu"), &js(" บวก "));

    // 8b2. ± and the minus (declined after a number: a range, not a negative)
    s = rewrite(&s, js_re!("±", "gu"), &js(" บวก ลบ "));
    s = rewrite_with(&s, js_re!(r"(^|[\s(])[-−–](?=\d)", "gu"), |m, whole| {
        if js_re!(r"\d\s*$", "u").test(&whole.slice(0, Some(m.index() as isize))) {
            return m.value(whole);
        }
        let mut out = group(m, 1, whole);
        out.push_str(&js("ลบ "));
        out
    });

    // 8bb. relational and division signs
    s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" เท่ากับ "));
    s = rewrite(&s, js_re!(r"\s?<\s?", "gu"), &js(" น้อยกว่า "));
    s = rewrite(&s, js_re!(r"\s?>\s?", "gu"), &js(" มากกว่า "));
    s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" หารด้วย "));

    // 8c. ×
    s = rewrite(&s, js_re!(r"\s*[×]\s*(?=\d)", "gu"), &js(" คูณ "));

    // 9. degree sign
    s = rewrite(
        &s,
        js_re!(r"\s*°\s*C(?![A-Za-z])", "gui"),
        &js(" องศาเซลเซียส"),
    );
    s = rewrite(
        &s,
        js_re!(r"\s*°\s*F(?![A-Za-z])", "gui"),
        &js(" องศาฟาเรนไฮต์"),
    );
    s = rewrite(&s, js_re!(r"\s*°", "gu"), &js(" องศา"));

    // 10. all-caps initialisms → Thai letter names
    s = rewrite_with(
        &s,
        js_re!(r"(?<![A-Za-z0-9])[A-Z]{2,6}(?![A-Za-z0-9])", "gu"),
        |m, s| {
            let parts: Vec<JsString> = m
                .value(s)
                .code_point_strings()
                .iter()
                .map(|c| {
                    // `letterNames[c]!`: a miss would stringify as "undefined".
                    MANIFEST
                        .letter_names
                        .get(&c.to_string_lossy())
                        .map_or_else(|| js("undefined"), |w| js(w))
                })
                .collect();
            JsString::join(&parts, &js(" "))
        },
    );

    s
}
