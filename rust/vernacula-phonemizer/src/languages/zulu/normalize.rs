//! Zulu (zu) text normalization: entities and the ampersand, era markers, dotted capitals, digit grouping, sports
//! times and clocks, half-day markers, signs, degrees, ranges, rates, square miles, decimals, fractions and
//! initialisms rewritten into words, leaving every numeral as digits for the tokenizer.
//! Ported from src/languages/zulu/normalize.ts — see that file for the corpus evidence and the ordering.

use std::collections::HashSet;
use std::sync::LazyLock;

use super::manifest::MANIFEST;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `UNIT_WORD[k]`, stringified as JS does when the key is missing (a case-folded match the table lacks).
fn unit_word(k: &JsString) -> &'static str {
    match k.to_string_lossy().as_str() {
        "km" => "amakhilomitha",
        "m" => "amamitha",
        "mm" => "amamilimitha",
        "cm" => "amasentimitha",
        "kg" => "amakhilogremu",
        "mi" => "amamayela",
        "ft" => "amafidi",
        "kma" => "amakhilomitha",
        _ => "undefined",
    }
}

/// `PER[k]`, with the same JS stringification of a miss (`ſ` matches `s` under `iu`).
fn per(k: &JsString) -> &'static str {
    match k.to_string_lossy().as_str() {
        "h" => "ngehora",
        "s" => "ngomzuzwana",
        _ => "undefined",
    }
}

fn compass(c: &JsString) -> &'static str {
    match c.to_string_lossy().as_str() {
        "N" => "enyakatho",
        "S" => "eningizimu",
        "E" => "empumalanga",
        "W" => "entshonalanga",
        _ => "undefined",
    }
}

const BCE_WORD: &str = "ngaphambi kukaKristu";

/// `expandDotted`'s two patterns for one abbreviation body (without its final dot).
fn dotted(body: &str) -> (JsRegex, JsRegex) {
    let at_end = JsRegex::new(
        &format!("(?<![\\p{{L}}\\p{{M}}]){body}\\.(?=[ \u{a0}]*(?:$|\\p{{Lu}}))"),
        "gu",
    )
    .unwrap();
    let inline = JsRegex::new(&format!("(?<![\\p{{L}}\\p{{M}}]){body}\\."), "gu").unwrap();
    (at_end, inline)
}

static BCE_DOTTED: LazyLock<(JsRegex, JsRegex)> = LazyLock::new(|| dotted("B\\.C\\.E"));
static BC_DOTTED: LazyLock<(JsRegex, JsRegex)> = LazyLock::new(|| dotted("B\\.C"));

fn expand_dotted(s: &JsString, re: &(JsRegex, JsRegex), word: &str) -> JsString {
    rewrite(
        &rewrite(s, &re.0, &js(&format!("{word}."))),
        &re.1,
        &js(word),
    )
}

fn clock_body(h: &JsString, min: &JsString) -> JsString {
    let hv = js_number(h);
    let mv = js_number(min);
    if mv == 0.0 {
        js(&js_number_to_string(hv))
    } else {
        js(&format!(
            "{} nemizuzu engu-{}",
            js_number_to_string(hv),
            js_number_to_string(mv)
        ))
    }
}

fn half_day(marker: Option<&JsString>) -> &'static str {
    match marker {
        None => "",
        Some(m) if m.to_lower_case().starts_with(&js("p")) => " ntambama",
        Some(_) => " ekuseni",
    }
}

/// `NGUNI_LETTER_NAME[c] ?? c`.
fn letter_name(c: &str) -> &str {
    match c {
        "A" => "eyi",
        "B" => "bhi",
        "C" => "si",
        "D" => "di",
        "E" => "i",
        "F" => "efu",
        "G" => "ji",
        "H" => "eyitshi",
        "I" => "ayi",
        "J" => "jeyi",
        "K" => "kheyi",
        "L" => "eli",
        "M" => "emu",
        "N" => "eni",
        "O" => "o",
        "P" => "phi",
        "Q" => "khyu",
        "R" => "a",
        "S" => "esi",
        "T" => "thi",
        "U" => "yu",
        "V" => "vi",
        "W" => "dabhuliyu",
        "X" => "eksi",
        "Y" => "wayi",
        "Z" => "zedi",
        other => other,
    }
}

static WORD_ACRONYMS: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    [
        "covid", "nato", "fifa", "opec", "unesco", "unicef", "aids", "laser", "sars", "eskom",
        "sadc",
    ]
    .iter()
    .map(|w| js(w))
    .collect()
});

/// `spellNguniInitialisms`: all-caps runs → Nguni-spelled English letter names. Xhosa's normalize.ts carries a
/// byte-identical copy, and its port calls this one.
pub fn spell_nguni_initialisms(s: &JsString) -> JsString {
    if !js_re!(r"\p{Ll}", "u").test(s) && js_re!(r"\s", "u").test(&s.trim()) {
        return s.clone();
    }
    rewrite_with(
        s,
        js_re!(r"(?<![\p{Lu}\p{M}\d])[A-Z]{2,6}(?![\p{L}\p{M}\d$])", "gu"),
        |m, s| {
            let run = m.value(s);
            if WORD_ACRONYMS.contains(&run.to_lower_case()) {
                return run;
            }
            let names: Vec<JsString> = run
                .code_point_strings()
                .iter()
                .map(|c| js(letter_name(&c.to_string_lossy())))
                .collect();
            JsString::join(&names, &js(" "))
        },
    )
}

fn said_degrees(before: &JsString) -> bool {
    js_re!(r"amazinga[^.!?;]*$", "u").test(before)
}

fn deg(digits: &JsString, tail: &str, offset: usize, full: &JsString) -> JsString {
    let head = if said_degrees(&full.slice(0, Some(offset as isize))) {
        ""
    } else {
        "amazinga angu-"
    };
    js(head).concat(digits).concat(&js(tail))
}

fn strip_commas(s: &JsString) -> JsString {
    js_re!(",", "gu").replace(s, &JsString::new())
}

/// `dec(i, f)`: the integer and each fractional digit (trailing zeros dropped), space-separated.
fn dec(i: &JsString, f: &JsString) -> JsString {
    let f = js_re!("0+$", "u").replace(f, &JsString::new());
    let mut parts = vec![i.clone()];
    parts.extend(f.code_point_strings());
    let parts: Vec<JsString> = parts.into_iter().filter(|t| !t.is_empty()).collect();
    JsString::join(&parts, &js(" "))
}

/// `normalizeZulu(input)`.
pub fn normalize_zulu(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1–2
    s = rewrite(&s, js_re!(r"&amp;", "giu"), &js("&"));
    s = rewrite(&s, js_re!(r"\s*&\s*", "gu"), &js(" kanye ne-"));

    // 3
    s = expand_dotted(&s, &BCE_DOTTED, BCE_WORD);
    s = expand_dotted(&s, &BC_DOTTED, BCE_WORD);
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])BCE(?![\p{L}\p{M}])", "gu"),
        &js(BCE_WORD),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d[ \u00a0])BC(?![\p{L}\p{M}])", "gu"),
        &js(BCE_WORD),
    );

    // 4
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])\p{Lu}\.(?:[ \u00a0]?\p{Lu}\.)+", "gu"),
        |m, s| js_re!(r"[.\s]", "gu").replace(&m.value(s), &JsString::new()),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\p{L}[ \u00a0])(\p{Lu})\.(?=[ \u00a0]+\p{Lu})", "gu"),
        &js("$1"),
    );

    // 5
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2})(,\d{3})+(?!\d)", "gu"),
        |m, s| strip_commas(&m.value(s)),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})([ \u00a0\u202f\u2009]\d{3})+(?!\d)",
            "gu"
        ),
        |m, s| js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&m.value(s), &JsString::new()),
    );

    // 5b
    s = rewrite(
        &s,
        js_re!(r"(?<![\d:.,])(\d{1,2}):([0-5]\d)\.(\d{2})(?![\d.])", "gu"),
        &js("$1 $2 $3"),
    );

    // 6
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:.,])([01]?\d|2[0-3]):[ \u00a0]?([0-5]\d)(?![:.\d])(?:[ \u00a0]*([Aa]\.?[Mm]\.?|[Pp]\.?[Mm]\.?)(?![\p{L}\p{M}]))?",
            "gu"
        ),
        |m, s| {
            let ap = m.group(3, s);
            clock_body(&m.group(1, s).unwrap(), &m.group(2, s).unwrap())
                .concat(&js(half_day(ap.as_ref())))
        },
    );

    // 7
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d{1,2})[.,]([0-5]\d)(?=[ \u00a0]*(?:UTC|GMT)(?![\p{L}\p{M}]))",
            "gu"
        ),
        |m, s| clock_body(&m.group(1, s).unwrap(), &m.group(2, s).unwrap()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(0\d)([0-5]\d)(?=[ \u00a0]*(?:UTC|GMT)(?![\p{L}\p{M}]))",
            "gu"
        ),
        |m, s| clock_body(&m.group(1, s).unwrap(), &m.group(2, s).unwrap()),
    );

    // 8
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])([Aa]\.[Mm]|[Pp]\.[Mm])\.?(?![\p{L}\p{M}])",
            "gu"
        ),
        |m, s| js(half_day(Some(&m.value(s)))).trim(),
    );

    // 8c — the sign before the degree rule, which consumes its operand
    s = rewrite(&s, js_re!(r"±", "gu"), &js(" plas o mayinas "));
    s = rewrite(
        &s,
        js_re!(r"[ \u00a0]?\+[ \u00a0]?(?=\d)", "gu"),
        &js(" plas "),
    );

    // 9
    s = rewrite_with(
        &s,
        js_re!(
            r"(\d[\d.,]*)[ \u00a0]?[°º][ \u00a0]?C(?![\p{L}\p{M}])",
            "gui"
        ),
        |m, s| deg(&m.group(1, s).unwrap(), "", m.index(), s),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(\d[\d.,]*)[ \u00a0]?[°º][ \u00a0]?F(?![\p{L}\p{M}])",
            "gui"
        ),
        |m, s| deg(&m.group(1, s).unwrap(), " Fahrenheit", m.index(), s),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(\d[\d.,]*)[ \u00a0]?[°º][ \u00a0]?([NSEW])(?![\p{L}\p{M}])",
            "gu"
        ),
        |m, s| {
            let c = m.group(2, s).unwrap().to_upper_case();
            deg(
                &m.group(1, s).unwrap(),
                &format!(" {}", compass(&c)),
                m.index(),
                s,
            )
        },
    );
    s = rewrite_with(&s, js_re!(r"(\d[\d.,]*)[ \u00a0]?[°º]", "gu"), |m, s| {
        deg(&m.group(1, s).unwrap(), "", m.index(), s)
    });

    // 10
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+\.\d+)[ \u00a0]*[-–—][ \u00a0]*(\d+\.\d+)(?![\d.,])",
            "gu"
        ),
        &js("$1 kuya ku-$2"),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d[\d,]*\d|\d)[ \u00a0]*[-–—][ \u00a0]*(\d[\d,]*\d|\d)(?![\d.,])",
            "gu"
        ),
        |m, s| {
            let (a, b) = (m.group(1, s).unwrap(), m.group(2, s).unwrap());
            if js_number(&strip_commas(&a)) < js_number(&strip_commas(&b)) {
                a.concat(&js(" kuya ku-")).concat(&b)
            } else {
                m.value(s)
            }
        },
    );

    // 11
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<!\d)(\d[\d.,]*)[ \u00a0]?(km|mi|m|mm|cm|kg)[ \u00a0]*\/[ \u00a0]*([hs])(?![\p{L}\p{M}])",
            "giu"
        ),
        |m, s| {
            let u = m.group(2, s).unwrap().to_lower_case();
            let d = m.group(3, s).unwrap().to_lower_case();
            m.group(1, s)
                .unwrap()
                .concat(&js(&format!(" {} {}", unit_word(&u), per(&d))))
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])mph(?![\p{L}\p{M}])", "giu"),
        &js("amamayela ngehora"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])kph(?![\p{L}\p{M}])", "giu"),
        &js("amakhilomitha ngehora"),
    );

    // 12, 12b
    s = rewrite(
        &s,
        js_re!(
            r"(\d[\d.,]*)[ \u00a0]?sq[ \u00a0]?mi(?![\p{L}\p{M}])",
            "giu"
        ),
        &js("$1 amamayela skwele"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<!\d)(\d[\d.,]*)[ \u00a0]?kma(?![\p{L}\p{M}])", "giu"),
        &js("$1 amakhilomitha"),
    );

    // 13 — currency and unit arms first: this rewrite breaks number↔symbol adjacency
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(?:US\$|AUD\$|\$|£)[ \u00a0]?(\d+)\.(\d+)(?!\.?\d)",
            "gu"
        ),
        |m, s| dec(&m.group(1, s).unwrap(), &m.group(2, s).unwrap()).concat(&js(" amadola")),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+)\.(\d+)[ \u00a0]?(km|mi|mm|cm|kg|ft|m)([²2])?(?![\p{L}\p{M}'’])",
            "giu"
        ),
        |m, s| {
            let u = m.group(3, s).unwrap().to_lower_case();
            let exp = if m.group(4, s).is_none() {
                ""
            } else {
                " skwele"
            };
            dec(&m.group(1, s).unwrap(), &m.group(2, s).unwrap())
                .concat(&js(&format!(" {}{exp}", unit_word(&u))))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?!\.?\d)", "gu"),
        |m, s| dec(&m.group(1, s).unwrap(), &m.group(2, s).unwrap()),
    );

    // 13b
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+),(\d{1,2})(?![\d,])", "gu"),
        |m, s| dec(&m.group(1, s).unwrap(), &m.group(2, s).unwrap()),
    );

    // 14
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d/.,])1[ \u00a0]?\/[ \u00a0]?(\d{1,2})(?![\d/.,])",
            "gu"
        ),
        |m, s| {
            let key = js_number_to_string(js_number(&m.group(1, s).unwrap()));
            match MANIFEST.ordinal_ye.as_ref().unwrap().get(&key) {
                None => m.value(s),
                Some(ord) => js(&format!("ingxenye {ord}")),
            }
        },
    );

    // 14b
    s = rewrite(
        &s,
        js_re!(r"[ \u00a0]?×[ \u00a0]?", "gu"),
        &js(" kuphindwe ngo-"),
    );
    s = rewrite(
        &s,
        js_re!(r"[ \u00a0]?=[ \u00a0]?", "gu"),
        &js(" kulingana no-"),
    );
    s = rewrite(
        &s,
        js_re!(r"[ \u00a0]?<[ \u00a0]?", "gu"),
        &js(" ngaphansi kuka-"),
    );
    s = rewrite(
        &s,
        js_re!(r"[ \u00a0]?>[ \u00a0]?", "gu"),
        &js(" ngaphezu kuka-"),
    );
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{Nd}])(?<![\p{L}\p{Nd}][ \u00a0])[-−](?=\d)",
            "gu"
        ),
        &js("ukukhipha "),
    );

    // 15
    s = rewrite(
        &s,
        js_re!(r"(?<!\d)[ \u00a0]+[-–—]+[ \u00a0]+(?!\d)", "gu"),
        &js(", "),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])njll?\.?(?![\p{L}\p{M}])", "giu"),
        &js("njalonjalo"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])u?dkt\.?(?![\p{L}\p{M}])", "giu"),
        &js("udokotela"),
    );

    spell_nguni_initialisms(&s)
}
