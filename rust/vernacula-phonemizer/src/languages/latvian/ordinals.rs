//! Latvian ordinals for the dotted-number rule: the masculine definite-adjective endings, the 1–9 stems, the
//! teens and round tens as stems, and the head nouns whose written case selects the ending.
//! Ported from src/languages/latvian/ordinals.ts — see that file for the attestation and the refusals.

use std::sync::LazyLock;

use indexmap::IndexMap;

use super::numbers::number_to_words;
use crate::core::js_string::{JsString, is_object_prototype_key, js};
use crate::js_re;

/// `ENDING[c]`.
fn ending(c: &str) -> Option<&'static str> {
    Some(match c {
        "nomSg" => "ais",
        "genSg" => "ā",
        "datSg" => "ajam",
        "accSg" => "o",
        "locSg" => "ajā",
        "nomPl" => "ie",
        "datPl" => "ajiem",
        "accPl" => "os",
        "locPl" => "ajos",
        _ => return None,
    })
}

const STEM: [&str; 10] = [
    "", "pirm", "otr", "treš", "ceturt", "piekt", "sest", "septīt", "astot", "devīt",
];
const TEEN: [&str; 10] = [
    "desmit",
    "vienpadsmit",
    "divpadsmit",
    "trīspadsmit",
    "četrpadsmit",
    "piecpadsmit",
    "sešpadsmit",
    "septiņpadsmit",
    "astoņpadsmit",
    "deviņpadsmit",
];
const TEN: [&str; 10] = [
    "",
    "",
    "divdesmit",
    "trīsdesmit",
    "četrdesmit",
    "piecdesmit",
    "sešdesmit",
    "septiņdesmit",
    "astoņdesmit",
    "deviņdesmit",
];

fn decline(
    m: &mut IndexMap<String, &'static str>,
    stem: &str,
    second: bool,
    genitive: Option<&str>,
) {
    let gen_form = genitive.map_or_else(|| format!("{stem}a"), str::to_string);
    let forms = [
        (
            format!("{stem}{}", if second { "is" } else { "s" }),
            "nomSg",
        ),
        (gen_form, "genSg"),
        (
            format!("{stem}{}", if second { "im" } else { "am" }),
            "datSg",
        ),
        (format!("{stem}{}", if second { "i" } else { "u" }), "accSg"),
        (format!("{stem}{}", if second { "ī" } else { "ā" }), "locSg"),
    ];
    // Object-literal and spread semantics: a repeated key keeps its first position and takes the last value.
    for (k, c) in forms {
        m.insert(k, c);
    }
}

fn decline_with_plural(m: &mut IndexMap<String, &'static str>, stem: &str) {
    decline(m, stem, false, None);
    for (suffix, c) in [
        ("i", "nomPl"),
        ("iem", "datPl"),
        ("us", "accPl"),
        ("os", "locPl"),
    ] {
        m.insert(format!("{stem}{suffix}"), c);
    }
}

/// `HEAD_NOUN`: noun form → the case it names, in the TS object's key order.
pub static HEAD_NOUN: LazyLock<IndexMap<String, &'static str>> = LazyLock::new(|| {
    let mut m = IndexMap::new();
    decline_with_plural(&mut m, "gad");
    decline_with_plural(&mut m, "gadsimt");
    decline(&mut m, "janvār", true, None);
    decline(&mut m, "februār", true, None);
    decline(&mut m, "mart", false, None);
    decline(&mut m, "aprīl", true, Some("aprīļa"));
    decline(&mut m, "maij", false, None);
    decline(&mut m, "jūnij", false, None);
    decline(&mut m, "jūlij", false, None);
    decline(&mut m, "august", false, None);
    decline(&mut m, "septembr", true, None);
    decline(&mut m, "oktobr", true, None);
    decline(&mut m, "novembr", true, None);
    decline(&mut m, "decembr", true, None);
    m
});

/// `HEAD_NOUN[key]` on a plain object: an own case, an inherited `Object.prototype` member (a function, which
/// `ENDING` then misses), or nothing.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum HeadCase {
    Own(&'static str),
    Proto,
}

pub fn head_noun(key: &JsString) -> Option<HeadCase> {
    let k = key.to_string_lossy();
    match HEAD_NOUN.get(&k) {
        Some(c) => Some(HeadCase::Own(c)),
        None if is_object_prototype_key(&k) => Some(HeadCase::Proto),
        None => None,
    }
}

/// `ordinalWords(n, c)`: `None` for a non-integer, out of 1–9999, or a round hundred/thousand. ⚠ A case
/// `ENDING` lacks (a prototype read) appends the literal `undefined`, as the TS template does.
pub fn ordinal_words(n: f64, c: HeadCase) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || !(1.0..=9999.0).contains(&n) {
        return None;
    }
    let end = match c {
        HeadCase::Own(c) => ending(c).unwrap_or("undefined"),
        HeadCase::Proto => "undefined",
    };
    let n = n as u64;
    let within100 = n % 100;
    let (atom, head) = if (10..=19).contains(&within100) {
        (TEEN[(within100 - 10) as usize], n - within100)
    } else if !n.is_multiple_of(10) {
        (STEM[(n % 10) as usize], n - n % 10)
    } else if within100 != 0 {
        (TEN[(within100 / 10) as usize], n - within100)
    } else {
        return None;
    };
    if head == 0 {
        return Some(js(&format!("{atom}{end}")));
    }
    let head_words =
        js_re!(r"^tūkstotis\b", "u").replace(&number_to_words(head as f64, None), &js("tūkstoš"));
    Some(head_words.concat(&js(&format!(" {atom}{end}"))))
}
