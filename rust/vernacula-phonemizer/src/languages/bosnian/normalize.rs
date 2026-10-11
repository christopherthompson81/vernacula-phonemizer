//! Bosnian (bs) text normalization: digit de-grouping, the BCE era marker (both scripts), dotted
//! abbreviations, the lone initial, `Dr.`, `SAD-a`, degrees with the S J I Z bearings, the numeral+suffix,
//! rates, the clock span and clock, the licensed year span and coordinated ordinal pair, the licensed and
//! elided-year ordinals, ranges, the symbol tier, the decimal comma, vulgar fractions, signs and the shared
//! initialism pass. Ported from src/languages/bosnian/normalize.ts — see that file for the corpus evidence.

use std::sync::{Arc, LazyLock};

use indexmap::IndexMap;

use super::manifest::MANIFEST;
use super::numbers::number_to_words;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{
    ExponentPosition, ExponentWords, Multiply, PositionDecl, SymbolData, SymbolNormalizer, UnitPer,
    make_symbol_normalizer, slavic_count_form,
};
use crate::core::provenance::{rewrite, rewrite_lit, rewrite_with};
use crate::js_re;
use crate::languages::croatian::normalize::elided_year;
use crate::languages::serbian::normalize::{
    SUFFIX_RE, SlavicOrdinals, Slot, both_scripts_alt, clock_words, counted, digit_before,
    dotted_arms, era_pair, lat, normalize_serbian_initialisms, read_decimal_comma, replace_era,
    slot_of,
};

const ENDINGS: [(&str, &str, &str); 12] = [
    ("m.nom", "i", "i"),
    ("m.gen", "og", "eg"),
    ("m.loc", "om", "em"),
    ("m.ins", "im", "im"),
    ("n.nom", "o", "e"),
    ("n.gen", "og", "eg"),
    ("n.loc", "om", "em"),
    ("f.nom", "a", "a"),
    ("f.gen", "e", "e"),
    ("f.dat", "oj", "oj"),
    ("f.acc", "u", "u"),
    ("pl.gen", "ih", "ih"),
];

static ORD: SlavicOrdinals = SlavicOrdinals {
    hundreds: [
        "",
        "stoti",
        "dvjestoti",
        "tristoti",
        "četiristoti",
        "petstoti",
        "šeststoti",
        "sedamstoti",
        "osamstoti",
        "devetstoti",
    ],
    thousandth: "hiljaditi",
    endings: &ENDINGS,
    numbers: || &MANIFEST.numbers,
};

const LICENSOR: [(&str, &str); 32] = [
    ("godine", "f.gen"),
    ("godini", "f.dat"),
    ("godinu", "f.acc"),
    ("godina", "f.nom"),
    ("stoljeća", "n.gen"),
    ("stoljeću", "n.loc"),
    ("stoljeće", "n.nom"),
    ("vijeka", "m.gen"),
    ("vijeku", "m.loc"),
    ("vijek", "m.nom"),
    ("januara", "m.gen"),
    ("februara", "m.gen"),
    ("marta", "m.gen"),
    ("aprila", "m.gen"),
    ("maja", "m.gen"),
    ("juna", "m.gen"),
    ("jula", "m.gen"),
    ("avgusta", "m.gen"),
    ("septembra", "m.gen"),
    ("oktobra", "m.gen"),
    ("novembra", "m.gen"),
    ("decembra", "m.gen"),
    ("mjesto", "n.nom"),
    ("mjestu", "n.loc"),
    ("dana", "m.gen"),
    ("kategorije", "f.gen"),
    ("najvećim", "m.ins"),
    ("husarska", "f.nom"),
    ("pukovnija", "f.nom"),
    ("pukovniju", "f.acc"),
    ("zemlja", "f.nom"),
    ("gol", "m.nom"),
];

const STEPEN: [&str; 3] = ["stepen", "stepena", "stepeni"];
const METAR: [&str; 3] = ["metar", "metra", "metara"];
const MILJA: [&str; 3] = ["milja", "milje", "milja"];
const MEGABIT: [&str; 3] = ["megabit", "megabita", "megabita"];

const DOTTED: [(&str, &str); 5] = [
    ("itd", "i tako dalje"),
    ("npr", "naprimjer"),
    ("tj", "to jest"),
    ("str", "strana"),
    ("br", "broj"),
];

static CONNECTIVE_ALT: LazyLock<String> = LazyLock::new(|| both_scripts_alt(&["i", "ili", "do"]));
static DOTTED_ALT: LazyLock<String> = LazyLock::new(|| both_scripts_alt(&DOTTED.map(|(k, _)| k)));
static ABBREV: LazyLock<(JsRegex, JsRegex, JsRegex)> = LazyLock::new(|| dotted_arms(&DOTTED_ALT));

/// The era marker in both scripts (case-insensitive, unlike Serbian's).
static ERA: LazyLock<Vec<(JsRegex, JsRegex)>> = LazyLock::new(|| {
    [r"p\.\s?n\.\s?e", r"п\.\s?н\.\s?е"]
        .into_iter()
        .map(|m| era_pair(m, "giu"))
        .collect()
});

static PAIR_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\d.,])(\d{{1,4}})\.\s+({})\s+(\d{{1,4}})\.\s+(\p{{Ll}}[\p{{L}}\p{{M}}]*)",
            *CONNECTIVE_ALT
        ),
        "gu",
    )
    .unwrap()
});

fn forms(f: &[&str]) -> Vec<String> {
    f.iter().map(|s| s.to_string()).collect()
}

/// The shared symbol tier (bosnian/normalize.ts `SYMBOLS`).
static SYMBOLS: LazyLock<SymbolNormalizer> = LazyLock::new(|| {
    let mut currency = IndexMap::new();
    currency.insert(
        "AUD$".to_string(),
        forms(&[
            "australijski dolar",
            "australijska dolara",
            "australijskih dolara",
        ]),
    );
    currency.insert("$".to_string(), forms(&["dolar", "dolara", "dolara"]));
    let mut units = IndexMap::new();
    for (k, f) in [
        ("km", ["kilometar", "kilometra", "kilometara"]),
        ("m", ["metar", "metra", "metara"]),
        ("mm", ["milimetar", "milimetra", "milimetara"]),
        ("cm", ["centimetar", "centimetra", "centimetara"]),
        ("kg", ["kilogram", "kilograma", "kilograma"]),
        ("mi", ["milja", "milje", "milja"]),
        ("ghz", ["gigaherc", "gigaherca", "gigaherca"]),
    ] {
        units.insert(k.to_string(), forms(&f));
    }
    let mut rate = IndexMap::new();
    rate.insert("h".to_string(), "sat".to_string());
    make_symbol_normalizer(&SymbolData {
        ampersand: Some("i".into()),
        multiply: Some(Multiply {
            times: "puta".into(),
            by: Some("sa".into()),
        }),
        percent: Some(forms(&["posto"])),
        currency: Some(currency),
        magnitudes: Some(forms(&[
            "hiljada",
            "miliona",
            "milion",
            "milijarde",
            "milijardi",
            "milijarda",
            "biliona",
        ])),
        units: Some(units),
        unit_per: Some(UnitPer::All("na".into())),
        rate_denominators: Some(rate),
        exponent_words: Some(ExponentWords {
            squared: Some(forms(&["kvadratni", "kvadratna", "kvadratnih"])),
            cubed: None,
            position: Some(PositionDecl::All(ExponentPosition::Before)),
        }),
        count_form: Some(Arc::new(slavic_count_form)),
        ..Default::default()
    })
    .expect("bosnian SYMBOLS")
});

/// The symbol tier on its own (for the differential).
pub(crate) fn bosnian_symbols(s: &JsString) -> JsString {
    SYMBOLS.apply(s)
}

/// `intOf(n)`. ⚠ Through `rewrite`, i.e. ON THE PROVENANCE SEAM although `n` is a numeral string, not the
/// pipeline text: the TS does this, and under tracing it poisons the mapping exactly as the TS does.
fn int_of(n: &JsString) -> f64 {
    let a = rewrite(n, js_re!(r"\.", "gu"), &JsString::new());
    js_number(&rewrite_lit(&a, ",", &js("."))).trunc()
}

/// `({ S, J, I, Z, N, E, W })[letter.toUpperCase()]!`.
fn bearing(letter: &JsString) -> &'static str {
    match letter.to_upper_case().to_string_lossy().as_str() {
        "S" | "N" => "sjeverno",
        "J" => "južno",
        "I" | "E" => "istočno",
        "Z" | "W" => "zapadno",
        _ => "undefined",
    }
}

fn dotted(ab: &JsString) -> Option<&'static str> {
    match slot_of(&DOTTED, &lat(ab)) {
        Slot::Own(w) => Some(w),
        _ => None,
    }
}

fn rate(n: &JsString, f: [&str; 3], tail: &str) -> JsString {
    n.concat(&js(" "))
        .concat(&counted(int_of(n), f))
        .concat(&js(tail))
}

/// `normalizeBosnian(input)`.
pub(crate) fn normalize_bosnian(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 0) digit de-grouping (two passes).
    for _ in 0..2 {
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)\.(?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
    }

    // 1) the era marker, both scripts.
    for (dotted_re, dotless) in ERA.iter() {
        s = rewrite_with(&s, dotted_re, replace_era("prije nove ere"));
        s = rewrite(&s, dotless, &js("prije nove ere"));
    }

    // 2) dotted abbreviations; before a capital the dot is kept (tested in the callback, not the pattern).
    s = rewrite_with(&s, &ABBREV.0, |mm, all| {
        let m0 = mm.value(all);
        let Some(w) = dotted(&mm.group(1, all).unwrap()) else {
            return m0;
        };
        let at = mm.index() + m0.len();
        let next = all.slice(at as isize, Some(at as isize + 1));
        let dot = if js_re!(r"\p{Lu}", "u").test(&next) {
            "."
        } else {
            ""
        };
        js(w).concat(&js(dot)).concat(&mm.group(2, all).unwrap())
    });
    s = rewrite_with(&s, &ABBREV.1, |mm, t| {
        dotted(&mm.group(1, t).unwrap()).map_or_else(|| mm.value(t), js)
    });
    s = rewrite_with(&s, &ABBREV.2, |mm, t| {
        match dotted(&mm.group(1, t).unwrap()) {
            None => mm.value(t),
            Some(w) => js(w).concat(&js(".")),
        }
    });

    // 3) the lone initial in a name, and `Dr.` (case-sensitive).
    s = rewrite(
        &s,
        js_re!(r"(?<=\p{Lu}\p{L}*\s)(\p{Lu})\.(?=\s+\p{Lu}\p{Ll})", "gu"),
        &js("$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])Dr\.(\s+)(?=[\p{L}\d])", "gu"),
        &js("doktor$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])Dr\.(?=\s*(?:[.,;:!?»)]|$))", "gu"),
        &js("doktor."),
    );

    // 4) `SAD-a`.
    s = rewrite(
        &s,
        js_re!(r"(?<![-\p{L}\p{M}])SAD-a(?![\p{L}\p{M}])", "gu"),
        &js("Sjedinjenih Američkih Država"),
    );

    // 5) degrees: the scale, the bearing (lowercase ⟨s i⟩ only attached), the bare degree.
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?°\s?([CFСcf])(?![\p{L}\p{M}])", "gui"),
        |mm, t| {
            let n = mm.group(1, t).unwrap();
            let word = if js_re!("[Ff]", "u").test(&mm.group(2, t).unwrap()) {
                "Farenhajta"
            } else {
                "Celzijusa"
            };
            n.concat(&js(" "))
                .concat(&counted(js_number(&n), STEPEN))
                .concat(&js(" "))
                .concat(&js(word))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(\d+)\s?°(?:\s?([JZNEWSIjznew])|([si]))(?![\p{L}\p{M}])",
            "gu"
        ),
        |mm, t| {
            let n = mm.group(1, t).unwrap();
            let letter = mm.group(2, t).or_else(|| mm.group(3, t)).unwrap();
            n.concat(&js(" "))
                .concat(&counted(js_number(&n), STEPEN))
                .concat(&js(" "))
                .concat(&js(bearing(&letter)))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?°(?:\s?[XYQxyq](?![\p{L}\p{M}]))?", "gu"),
        |mm, t| {
            let n = mm.group(1, t).unwrap();
            n.concat(&js(" "))
                .concat(&counted(js_number(&n), STEPEN))
                .concat(&js(" "))
        },
    );

    // 6) numeral + hyphen + case suffix.
    s = rewrite_with(&s, &SUFFIX_RE, |mm, t| {
        let suffix = lat(&mm.group(2, t).unwrap());
        ORD.ordinal_forms(js_number(&mm.group(1, t).unwrap()))
            .into_iter()
            .find(|f| f.ends_with(&suffix))
            .unwrap_or_else(|| mm.value(t))
    });

    // 7) the `/s` rates, 7b) the spelled-out mile rate, 7c) a span between two clocks.
    s = rewrite_with(
        &s,
        js_re!(r"(\d+(?:[.,]\d+)?)\s?Mbit\s?\/\s?s(?![\p{L}\p{M}])", "gu"),
        |mm, t| rate(&mm.group(1, t).unwrap(), MEGABIT, " u sekundi"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d+(?:[.,]\d+)?)\s?m\s?\/\s?s(?![\p{L}\p{M}])", "gu"),
        |mm, t| rate(&mm.group(1, t).unwrap(), METAR, " u sekundi"),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(\d+(?:,\d+)?)\s?milja\s*\/\s*(?:sat|h)(?![\p{L}\p{M}])",
            "giu"
        ),
        |mm, t| rate(&mm.group(1, t).unwrap(), MILJA, " na sat"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d{1,2}:\d{2})\s?[-–—]\s?(?=\d{1,2}:\d{2})", "gu"),
        &js("$1 do "),
    );

    // 8) the colon clock, consuming a written hour noun.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.,])(\s*(?:sati|sata|časova|sahati|sahata))?",
            "giu"
        ),
        |mm, t| {
            let hv = js_number(&mm.group(1, t).unwrap());
            let mv = js_number(&mm.group(2, t).unwrap());
            clock_words(hv, mv, &|n| number_to_words(n, None))
        },
    );

    // 9) a licensed year–year span: both endpoints ordinal.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(1\d{3}|20\d{2}|2100)\s?[-–—]\s?(1\d{3}|20\d{2}|2100)\.(?=\s+\p{Ll})",
            "gu"
        ),
        |mm, t| {
            let a = ORD.ordinal_base(js_number(&mm.group(1, t).unwrap()));
            let b = ORD.ordinal_base(js_number(&mm.group(2, t).unwrap()));
            let (Some(a), Some(b)) = (a, b) else {
                return mm.value(t);
            };
            ORD.inflect_or_undefined(&a, Slot::Own("f.gen"))
                .concat(&js(" do "))
                .concat(&ORD.inflect_or_undefined(&b, Slot::Own("f.gen")))
        },
    );

    // 9b) a coordinated ordinal pair, both in the written licensor's slot.
    s = rewrite_with(&s, &PAIR_RE, |mm, t| {
        let word = mm.group(4, t).unwrap();
        let slot = slot_of(&LICENSOR, &lat(&word));
        if slot == Slot::Miss {
            return mm.value(t);
        }
        let a = ORD.ordinal_base(js_number(&mm.group(1, t).unwrap()));
        let b = ORD.ordinal_base(js_number(&mm.group(3, t).unwrap()));
        let (Some(a), Some(b)) = (a, b) else {
            return mm.value(t);
        };
        ORD.inflect_or_undefined(&a, slot)
            .concat(&js(" "))
            .concat(&mm.group(2, t).unwrap())
            .concat(&js(" "))
            .concat(&ORD.inflect_or_undefined(&b, slot))
            .concat(&js(" "))
            .concat(&word)
    });

    // 10) the licensed `N.` ordinal.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d{1,4})\.\s+(\p{Ll}[\p{L}\p{M}]*)", "gu"),
        |mm, t| {
            let word = mm.group(2, t).unwrap();
            let slot = slot_of(&LICENSOR, &lat(&word));
            if slot == Slot::Miss {
                return mm.value(t);
            }
            let Some(base) = ORD.ordinal_base(js_number(&mm.group(1, t).unwrap())) else {
                return mm.value(t);
            };
            ORD.inflect_or_undefined(&base, slot)
                .concat(&js(" "))
                .concat(&word)
        },
    );

    // 11) a year with `godine` elided.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,\-–—])(1\d{3}|20\d{2}|2100)\.(?!\d)", "gu"),
        |mm, all| elided_year(&ORD, mm, all),
    );

    // 11b) numeric ranges.
    s = rewrite(&s, js_re!(r"(\d)\s?[-–—]\s?(?=\d)", "gu"), &js("$1 do "));

    // 12) the symbol tier; 13) the decimal comma.
    s = SYMBOLS.apply(&s);
    s = read_decimal_comma(&s);

    // 14) vulgar fractions.
    s = rewrite(&s, js_re!(r"(\d+)¾", "gu"), &js("$1 i tri četvrtine"));
    s = rewrite(&s, js_re!(r"(\d+)½", "gu"), &js("$1 i po"));

    // 15) the plus, and the minus with Serbian's three guards.
    s = rewrite(&s, js_re!(r"(^|[\s(])\+\s?(\d)", "gu"), &js("$1plus $2"));
    s = rewrite(&s, js_re!(r"(?<=\p{Lu})\+(?=\d)", "gu"), &js(" plus "));
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)", "gu"),
        |mm, full| {
            if digit_before(full, mm.index()) {
                mm.value(full)
            } else {
                js("minus ")
            }
        },
    );

    normalize_serbian_initialisms(&s)
}
