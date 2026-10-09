//! English text normalization: units, money, dates, times, abbreviations, signs and the rest rewritten into
//! speakable words BEFORE the tokenizer, plus the separately-run initialism pass.
//! Ported from src/languages/english/normalize.ts — see that file for the corpus evidence and the reason
//! for every rule's position in the order.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use indexmap::IndexMap;

use super::manifest::MANIFEST;
use crate::core::initialisms::{
    InitialismData, LATIN_MARK, LetterName, PhonotacticsData, make_initialism_normalizer,
    make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::resolve_unit_symbol;
use crate::core::provenance::{rewrite, rewrite_with};
use crate::core::roman::{COLLISIONS as ROMAN_COLLISIONS, roman_to_int};
use crate::js_re;

// ── String assembly ─────────────────────────────────────────────────────────────────────────────────
// Captured text stays `JsString` (it may hold a lone surrogate); literals append as UTF-16.
trait Piece {
    fn put(&self, out: &mut JsString);
}
impl Piece for JsString {
    fn put(&self, out: &mut JsString) {
        out.push_str(self);
    }
}
impl Piece for str {
    fn put(&self, out: &mut JsString) {
        out.0.extend(self.encode_utf16());
    }
}
impl Piece for String {
    fn put(&self, out: &mut JsString) {
        self.as_str().put(out);
    }
}
impl<T: Piece + ?Sized> Piece for &T {
    fn put(&self, out: &mut JsString) {
        (**self).put(out);
    }
}
macro_rules! jcat {
    ($($p:expr),* $(,)?) => {{
        let mut out = JsString::new();
        $( Piece::put(&$p, &mut out); )*
        out
    }};
}

fn g(m: &JsMatch, i: usize, s: &JsString) -> JsString {
    m.group(i, s).expect("participating group")
}

/// `Object.keys(t).sort((a, b) => b.length - a.length).join("|")`: STABLE, so equal lengths keep table order.
fn longest_first<'a>(keys: impl Iterator<Item = &'a str>) -> String {
    let mut v: Vec<&str> = keys.collect();
    v.sort_by_key(|k| std::cmp::Reverse(k.encode_utf16().count()));
    v.join("|")
}

// ── Roman numerals ──────────────────────────────────────────────────────────────────────────────────
const ROMAN: [(&str, u32); 15] = [
    ("ii", 2),
    ("iii", 3),
    ("iv", 4),
    ("vii", 7),
    ("viii", 8),
    ("ix", 9),
    ("xii", 12),
    ("xiii", 13),
    ("xiv", 14),
    ("xv", 15),
    ("xvi", 16),
    ("xvii", 17),
    ("xviii", 18),
    ("xix", 19),
    ("xx", 20),
];
fn roman_cardinal_ctx() -> &'static JsRegex {
    js_re!(
        r"\b(war|chapter|part|act|section|volume|book|phase|stage|grade|class|type|level|apollo|rocky|bowl|wrestlemania|olympiad|super)$",
        "i"
    )
}

// ── Units and symbols ───────────────────────────────────────────────────────────────────────────────
/// `UNITS`, in declaration order (78 keys; none integer-like, so JS key order is this order).
const UNITS_SRC: [(&str, &str, &str); 78] = [
    ("km", "kilometer", "kilometers"),
    ("cm", "centimeter", "centimeters"),
    ("mm", "millimeter", "millimeters"),
    ("kg", "kilogram", "kilograms"),
    ("mg", "milligram", "milligrams"),
    ("lb", "pound", "pounds"),
    ("lbs", "pounds", "pounds"),
    ("oz", "ounce", "ounces"),
    ("ft", "foot", "feet"),
    ("mi", "mile", "miles"),
    ("mph", "miles per hour", "miles per hour"),
    ("kph", "kilometers per hour", "kilometers per hour"),
    ("km/h", "kilometer per hour", "kilometers per hour"),
    ("m/s", "meter per second", "meters per second"),
    ("miles/hour", "mile per hour", "miles per hour"),
    ("mbit/s", "megabit per second", "megabits per second"),
    ("yards/meters", "yard per meter", "yards per meters"),
    ("btu", "b t u", "b t u"),
    ("btu/hr", "b t u per hour", "b t u per hour"),
    ("btu/sf", "b t u per square foot", "b t u per square foot"),
    (
        "btu/hr/sf",
        "b t u per hour, per square foot",
        "b t u per hour, per square foot",
    ),
    ("\u{b0}c", "degree Celsius", "degrees Celsius"),
    ("\u{b0}f", "degree Fahrenheit", "degrees Fahrenheit"),
    ("\u{2103}", "degree Celsius", "degrees Celsius"),
    ("\u{2109}", "degree Fahrenheit", "degrees Fahrenheit"),
    ("\u{b0}", "degree", "degrees"),
    ("\u{3a9}", "ohm", "ohms"),
    ("\u{2126}", "ohm", "ohms"),
    ("k\u{3a9}", "kilo ohm", "kilo ohms"),
    ("M\u{3a9}", "mega ohm", "mega ohms"),
    ("m\u{3a9}", "milli ohm", "milli ohms"),
    ("k\u{2126}", "kilo ohm", "kilo ohms"),
    ("M\u{2126}", "mega ohm", "mega ohms"),
    ("m\u{2126}", "milli ohm", "milli ohms"),
    ("k\u{3c9}", "kilo ohm", "kilo ohms"),
    ("M\u{3c9}", "mega ohm", "mega ohms"),
    ("m\u{3c9}", "milli ohm", "milli ohms"),
    ("\u{b5}g", "microgram", "micrograms"),
    ("\u{3bc}g", "microgram", "micrograms"),
    ("\u{b5}s", "microsecond", "microseconds"),
    ("\u{3bc}s", "microsecond", "microseconds"),
    ("\u{b5}mol", "micromole", "micromoles"),
    ("\u{3bc}mol", "micromole", "micromoles"),
    ("\u{b5}m", "micro meter", "micro meters"),
    ("\u{3bc}m", "micro meter", "micro meters"),
    ("\u{b5}l", "micro liter", "micro liters"),
    ("\u{3bc}l", "micro liter", "micro liters"),
    ("\u{b5}in", "microinch", "microinches"),
    ("\u{3bc}in", "microinch", "microinches"),
    ("\u{2032}", "foot", "feet"),
    ("\u{2033}", "inch", "inches"),
    ("\u{b5}M", "micromolar", "micromolar"),
    ("\u{3bc}M", "micromolar", "micromolar"),
    ("\u{b5}S", "microsiemens", "microsiemens"),
    ("\u{3bc}S", "microsiemens", "microsiemens"),
    ("\u{b5}g/g", "microgram per gram", "micrograms per gram"),
    ("\u{3bc}g/g", "microgram per gram", "micrograms per gram"),
    (
        "\u{b5}g/ml",
        "microgram per milliliter",
        "micrograms per milliliter",
    ),
    (
        "\u{3bc}g/ml",
        "microgram per milliliter",
        "micrograms per milliliter",
    ),
    ("\u{b5}mol/l", "micromole per liter", "micromoles per liter"),
    (
        "\u{3bc}mol/l",
        "micromole per liter",
        "micromoles per liter",
    ),
    ("m", "meter", "meters"),
    ("l", "liter", "liters"),
    ("L", "liter", "liters"),
    ("ml", "milliliter", "milliliters"),
    ("g", "gram", "grams"),
    ("t", "ton", "tons"),
    ("W", "watt", "watts"),
    ("ha", "hectare", "hectares"),
    ("hz", "hertz", "hertz"),
    ("khz", "kilohertz", "kilohertz"),
    ("mhz", "megahertz", "megahertz"),
    ("ghz", "gigahertz", "gigahertz"),
    ("kb", "kilobyte", "kilobytes"),
    ("mb", "megabyte", "megabytes"),
    ("gb", "gigabyte", "gigabytes"),
    ("tb", "terabyte", "terabytes"),
    ("kw", "kilowatt", "kilowatts"),
];

type Forms = (JsString, JsString);
static UNITS: LazyLock<IndexMap<JsString, Forms>> = LazyLock::new(|| {
    UNITS_SRC
        .iter()
        .map(|(k, sg, pl)| (js(k), (js(sg), js(pl))))
        .collect()
});
/// The FIRST-declared key keeps a folded slot, and a slot whose declared keys disagree (µm/µM, µs/µS,
/// mΩ/MΩ) is left out: only an undeclared case variant reaches the fold, and it has no case to decide by.
static UNITS_FOLDED: LazyLock<IndexMap<JsString, Forms>> = LazyLock::new(|| {
    let mut out: IndexMap<JsString, Forms> = IndexMap::new();
    let mut ambiguous = Vec::new();
    for (k, v) in UNITS.iter() {
        let lk = k.to_lower_case();
        match out.get(&lk) {
            None => {
                out.insert(lk, v.clone());
            }
            Some(have) if have != v => ambiguous.push(lk),
            Some(_) => {}
        }
    }
    for lk in ambiguous {
        out.shift_remove(&lk);
    }
    out
});

fn unit_forms(written: &JsString) -> Option<&'static Forms> {
    resolve_unit_symbol(Some(&*UNITS), &UNITS_FOLDED, written, false)
}

const CURRENCY: [(&str, &str, &str); 4] = [
    ("$", "dollar", "dollars"),
    ("\u{a3}", "pound", "pounds"),
    ("\u{20ac}", "euro", "euros"),
    ("\u{a5}", "yen", "yen"),
];
const SUBUNIT: [(&str, &str, &str); 3] = [
    ("$", "cent", "cents"),
    ("\u{20ac}", "cent", "cents"),
    ("\u{a3}", "penny", "pence"),
];
fn lookup3(
    t: &[(&'static str, &'static str, &'static str)],
    k: &JsString,
) -> Option<(&'static str, &'static str)> {
    t.iter()
        .find(|(key, _, _)| *k == *key)
        .map(|(_, a, b)| (*a, *b))
}

const MONEY_MAGNITUDE: [(&str, &str); 8] = [
    ("m", "million"),
    ("M", "million"),
    ("bn", "billion"),
    ("BN", "billion"),
    ("Bn", "billion"),
    ("B", "billion"),
    ("k", "thousand"),
    ("K", "thousand"),
];

const MONTH_ALT: &str =
    "january|february|march|april|may|june|july|august|september|october|november|december";
static MONTH_ALT_NO_MAY: LazyLock<String> = LazyLock::new(|| {
    MONTH_ALT
        .split('|')
        .filter(|m| *m != "may")
        .collect::<Vec<_>>()
        .join("|")
});

const MONTH_ABBREV: [(&str, &str); 12] = [
    ("jan", "january"),
    ("feb", "february"),
    ("mar", "march"),
    ("apr", "april"),
    ("jun", "june"),
    ("jul", "july"),
    ("aug", "august"),
    ("sep", "september"),
    ("sept", "september"),
    ("oct", "october"),
    ("nov", "november"),
    ("dec", "december"),
];
static MONTH_ABBREV_ALT: LazyLock<String> =
    LazyLock::new(|| longest_first(MONTH_ABBREV.iter().map(|(k, _)| *k)));

const WEEKDAY_ABBREV: [(&str, &str); 11] = [
    ("mon", "monday"),
    ("tue", "tuesday"),
    ("tues", "tuesday"),
    ("wed", "wednesday"),
    ("weds", "wednesday"),
    ("thu", "thursday"),
    ("thur", "thursday"),
    ("thurs", "thursday"),
    ("fri", "friday"),
    ("sat", "saturday"),
    ("sun", "sunday"),
];
static WEEKDAY_ABBREV_ALT: LazyLock<String> =
    LazyLock::new(|| longest_first(WEEKDAY_ABBREV.iter().map(|(k, _)| *k)));

fn lookup2(t: &[(&'static str, &'static str)], k: &JsString) -> Option<&'static str> {
    t.iter().find(|(key, _)| *k == *key).map(|(_, v)| *v)
}

// ── Title/place abbreviations ───────────────────────────────────────────────────────────────────────
fn abbrev_function_next() -> &'static JsRegex {
    js_re!(
        r"^(?:in|on|at|and|or|but|the|a|an|is|was|were|are|to|for|with|of|from|by|near|that|this|it|he|she|they|we|you|i|as|his|her|its|their|there|then|when|where|which|who|had|has|have)$",
        "i"
    )
}
fn is_name(next: &JsString) -> bool {
    js_re!(r"^\p{Lu}", "u").test(next)
}
/// `DOTTED_ABBREV[key]!(next)`; the key is always one of the five (the pattern is legacy `/i`, ASCII only).
fn dotted_abbrev(key: &JsString, next: &JsString) -> &'static str {
    let function_next = || !is_name(next) && abbrev_function_next().test(next);
    match key.to_string_lossy().as_str() {
        "st" => {
            if function_next() {
                "street"
            } else {
                "saint"
            }
        }
        "dr" => {
            if function_next() {
                "drive"
            } else {
                "doctor"
            }
        }
        "mt" => "mount",
        "mr" => "mister",
        "mrs" => "missus",
        k => panic!("DOTTED_ABBREV[{k:?}] is not a function"),
    }
}

const NOT_VERSION: &str = "(?<![\\d.,])(?!802[.,]11\\w)(?!\\d+[.,]\\d+[a-zA-Z](?![a-zA-Z\\d]))";
static UNIT_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let pattern = [
        NOT_VERSION,
        "(\\d[\\d,]*(?:\\.\\d+)?)(\\s+(?:hundred|thousand|million|billion|trillion))?\\s?(?!(?<=(?<![\\p{L}\\d])\\p{L}\\d)\\p{L}(?!\\p{L}))(",
        &longest_first(UNITS_SRC.iter().map(|(k, _, _)| *k)),
        ")([²³23])?(?![\\p{L}\\p{M}])(?!(?<=(?<!\\p{L})\\p{L})\\d)",
    ]
    .concat();
    JsRegex::new(&pattern, "giu").unwrap()
});

fn ascii_exponent_is_code_digit(unit: &JsString, exponent: Option<&JsString>) -> bool {
    if !exponent.is_some_and(|e| *e == "2" || *e == "3") {
        return false;
    }
    js_re!("^[A-Za-z]$", "u").test(unit) && unit.to_lower_case() != "m"
}

fn ascii_exponent_is_compound_part(unit: &JsString, exponent: Option<&JsString>) -> bool {
    exponent.is_some_and(|e| *e == "2" || *e == "3") && COMPOUND_MEASURE.iter().any(|c| *unit == *c)
}

const COMPOUND_MEASURE: [&str; 3] = ["\u{b0}", "\u{2032}", "\u{2033}"];

const RELATIONAL: [(&str, &str); 5] = [
    ("\u{2265}", "greater than or equal to"),
    ("\u{2264}", "less than or equal to"),
    ("\u{2260}", "not equal to"),
    ("\u{b1}", "plus or minus"),
    ("\u{2248}", "approximately"),
];
static RELATIONAL_RE: LazyLock<Vec<JsRegex>> = LazyLock::new(|| {
    RELATIONAL
        .iter()
        .map(|(sign, _)| JsRegex::new(&["[ \\t]*", sign, "[ \\t]*"].concat(), "gu").unwrap())
        .collect()
});

static BARE_MICRO_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let micro = js_re!("^[\\u00b5\\u03bc].", "u");
    let keys = longest_first(
        UNITS_SRC
            .iter()
            .map(|(k, _, _)| *k)
            .filter(|k| micro.test(&js(k))),
    );
    JsRegex::new(
        &["(?<![\\p{L}\\d/])(", &keys, ")(?![\\p{L}\\d/])"].concat(),
        "giu",
    )
    .unwrap()
});

static BARE_RATE_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let keys = longest_first(
        UNITS_SRC
            .iter()
            .map(|(k, _, _)| *k)
            .filter(|k| k.contains('/')),
    );
    JsRegex::new(
        &["(?<![\\p{L}\\d])(", &keys, ")(?![\\p{L}\\d])"].concat(),
        "giu",
    )
    .unwrap()
});

static UNIT_WORDS: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    UNITS_SRC
        .iter()
        .flat_map(|(_, sg, pl)| [*sg, *pl])
        .filter(|w| !w.contains(' '))
        .map(js)
        .collect()
});

const TIME_PERIOD: &[(&str, &str)] = &[
    ("s", "second"),
    ("sec", "second"),
    ("secs", "seconds"),
    ("second", "second"),
    ("seconds", "seconds"),
    ("min", "minute"),
    ("mins", "minutes"),
    ("minute", "minute"),
    ("minutes", "minutes"),
    ("h", "hour"),
    ("hr", "hour"),
    ("hrs", "hours"),
    ("hour", "hour"),
    ("hours", "hours"),
    ("d", "day"),
    ("day", "day"),
    ("days", "days"),
    ("wk", "week"),
    ("wks", "weeks"),
    ("week", "week"),
    ("weeks", "weeks"),
    ("mo", "month"),
    ("month", "month"),
    ("months", "months"),
    ("yr", "year"),
    ("yrs", "years"),
    ("year", "year"),
    ("years", "years"),
    ("annum", "annum"),
    ("capita", "capita"),
];
/// `TIME_PERIOD[k]` for a LOWERCASED `k`.
fn time_period(k: &JsString) -> Option<JsString> {
    lookup2(TIME_PERIOD, k).map(js)
}

const SLASH_ELIDED: [&str; 7] = [
    "and/or",
    "he/she",
    "she/he",
    "his/her",
    "her/his",
    "s/he",
    "either/or",
];

const SLASH_ABBREV: &[(&str, &str)] = &[
    ("w/o", "without"),
    ("c/o", "care of"),
    ("n/a", "not applicable"),
    ("w/out", "without"),
    ("a/d", "analog to digital"),
    ("d/a", "digital to analog"),
    ("y/n", "yes no"),
    ("r/w", "read write"),
];

const FORMULA_READING: &[(&str, &str)] = &[
    ("CoCr", "cobalt chromium"),
    ("CoCrMo", "cobalt chromium molybdenum"),
    ("CoCr-Mo", "cobalt chromium molybdenum"),
    ("Co-Cr-Mo", "cobalt chromium molybdenum"),
    ("Co-Cr", "cobalt chromium"),
];
static FORMULA_TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let keys = longest_first(FORMULA_READING.iter().map(|(k, _)| *k));
    let p = [
        "(?<![\\p{L}",
        LATIN_MARK,
        "\\d])(",
        &keys,
        ")",
        "(?![\\p{L}",
        LATIN_MARK,
        "\\d])(?!-\\p{Lu})",
    ]
    .concat();
    JsRegex::new(&p, "gu").unwrap()
});

const DESIGNATION_READING: &[(&str, &str)] =
    &[("316L", "three sixteen L"), ("Ti64", "titanium sixty-four")];
static DESIGNATION_TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let keys = longest_first(DESIGNATION_READING.iter().map(|(k, _)| *k));
    let p = [
        "(?<![\\p{L}",
        LATIN_MARK,
        "\\d])(",
        &keys,
        ")",
        "(?![\\p{L}",
        LATIN_MARK,
        "\\d])",
    ]
    .concat();
    JsRegex::new(&p, "gu").unwrap()
});

const MIXED_CASE_ABBREV: &[(&str, &str)] = &[("DoE", "design of experiments")];
static MIXED_CASE_TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let keys = longest_first(MIXED_CASE_ABBREV.iter().map(|(k, _)| *k));
    let p = [
        "(?<![\\p{L}",
        LATIN_MARK,
        "\\d])(",
        &keys,
        ")",
        "(?![\\p{L}",
        LATIN_MARK,
        "\\d])",
    ]
    .concat();
    JsRegex::new(&p, "gu").unwrap()
});

const PLAIN_ABBREV: &[(&str, &str)] = &[
    ("jr", "junior"),
    ("sr", "senior"),
    ("prof", "professor"),
    ("rev", "reverend"),
    ("sgt", "sergeant"),
    ("cpl", "corporal"),
    ("lt", "lieutenant"),
    ("col", "colonel"),
    ("gen", "general"),
    ("gov", "governor"),
    ("sen", "senator"),
    ("rep", "representative"),
    ("no", "number"),
    ("nos", "numbers"),
    ("ave", "avenue"),
    ("blvd", "boulevard"),
    ("rd", "road"),
    ("ln", "lane"),
    ("dept", "department"),
    ("est", "established"),
    ("approx", "approximately"),
    ("vs", "versus"),
    ("vol", "volume"),
    ("ch", "chapter"),
    ("fig", "figure"),
    ("pp", "pages"),
    ("ed", "edition"),
    ("eds", "editors"),
    ("inc", "incorporated"),
    ("ltd", "limited"),
    ("corp", "corporation"),
    ("univ", "university"),
    ("etc", "etc"),
    ("ibid", "ibid"),
    ("cf", "compare"),
    ("viz", "namely"),
];
static PLAIN_ABBREV_ALT: LazyLock<String> =
    LazyLock::new(|| longest_first(PLAIN_ABBREV.iter().map(|(k, _)| *k)));
static BARE_ABBREV_ALT: LazyLock<String> =
    LazyLock::new(|| longest_first(["vs", "approx", "dept", "univ", "blvd"].into_iter()));

const REGION_CODE: &[(&str, &str)] = &[
    ("ab", "Alberta"),
    ("bc", "British Columbia"),
    ("mb", "Manitoba"),
    ("nb", "New Brunswick"),
    ("nl", "Newfoundland and Labrador"),
    ("ns", "Nova Scotia"),
    ("nt", "Northwest Territories"),
    ("nu", "Nunavut"),
    ("on", "Ontario"),
    ("pe", "Prince Edward Island"),
    ("qc", "Quebec"),
    ("sk", "Saskatchewan"),
    ("yt", "Yukon"),
    ("al", "Alabama"),
    ("ak", "Alaska"),
    ("az", "Arizona"),
    ("ar", "Arkansas"),
    ("ca", "California"),
    ("co", "Colorado"),
    ("ct", "Connecticut"),
    ("de", "Delaware"),
    ("fl", "Florida"),
    ("ga", "Georgia"),
    ("hi", "Hawaii"),
    ("ia", "Iowa"),
    ("id", "Idaho"),
    ("il", "Illinois"),
    ("in", "Indiana"),
    ("ks", "Kansas"),
    ("ky", "Kentucky"),
    ("la", "Louisiana"),
    ("ma", "Massachusetts"),
    ("md", "Maryland"),
    ("me", "Maine"),
    ("mi", "Michigan"),
    ("mn", "Minnesota"),
    ("mo", "Missouri"),
    ("ms", "Mississippi"),
    ("mt", "Montana"),
    ("nc", "North Carolina"),
    ("nd", "North Dakota"),
    ("ne", "Nebraska"),
    ("nh", "New Hampshire"),
    ("nj", "New Jersey"),
    ("nm", "New Mexico"),
    ("nv", "Nevada"),
    ("ny", "New York"),
    ("oh", "Ohio"),
    ("ok", "Oklahoma"),
    ("or", "Oregon"),
    ("pa", "Pennsylvania"),
    ("ri", "Rhode Island"),
    ("sc", "South Carolina"),
    ("sd", "South Dakota"),
    ("tn", "Tennessee"),
    ("tx", "Texas"),
    ("ut", "Utah"),
    ("va", "Virginia"),
    ("vt", "Vermont"),
    ("wa", "Washington"),
    ("wi", "Wisconsin"),
    ("wv", "West Virginia"),
    ("wy", "Wyoming"),
    ("dc", "District of Columbia"),
];

const POSTCODE: &str = "(?:[A-Z]\\d[A-Z][ \u{a0}]?\\d[A-Z]\\d|\\d{5}(?:-\\d{4})?)(?![\\w-])";
const CREDENTIAL_CODE: [&str; 3] = ["MD", "PA", "DC"];

static ADDRESS_CODE: LazyLock<JsRegex> = LazyLock::new(|| {
    let alt = REGION_CODE
        .iter()
        .map(|(k, _)| *k)
        .collect::<Vec<_>>()
        .join("|")
        .to_uppercase();
    let p = [
        "(?<=\\p{Lu}\\p{L}*)(,[ \u{a0}]*)(",
        &alt,
        ")",
        "(?=[ \u{a0}]*",
        POSTCODE,
        "|[ \u{a0}]*(?:[.,;:!?\\n]|$))",
    ]
    .concat();
    JsRegex::new(&p, "gu").unwrap()
});
static FOLLOWED_BY_POSTCODE: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&["^[ \u{a0}]*", POSTCODE].concat(), "u").unwrap());

static ADDRESS_ZIP: LazyLock<JsRegex> = LazyLock::new(|| {
    let mut names: Vec<&str> = Vec::new();
    for (_, n) in REGION_CODE {
        if !names.contains(n) {
            names.push(n);
        }
    }
    let alt = longest_first(names.into_iter());
    JsRegex::new(
        &[
            "(?<=\\b(?:",
            &alt,
            ")[ \u{a0}])(\\d{5})(-(\\d{4}))?(?![\\w-])",
        ]
        .concat(),
        "gu",
    )
    .unwrap()
});

fn denominator(den: u32) -> Option<&'static str> {
    Some(match den {
        2 => "half",
        3 => "third",
        4 => "quarter",
        5 => "fifth",
        6 => "sixth",
        7 => "seventh",
        8 => "eighth",
        9 => "ninth",
        10 => "tenth",
        11 => "eleventh",
        12 => "twelfth",
        16 => "sixteenth",
        20 => "twentieth",
        _ => return None,
    })
}
fn fraction_words(num: u32, den: u32) -> Option<JsString> {
    if den < 2 || num < 1 {
        return None;
    }
    let base = denominator(den)?;
    let plural = if num > 1 {
        if base == "half" {
            "halves".to_string()
        } else {
            format!("{base}s")
        }
    } else {
        base.to_string()
    };
    Some(js(&format!("{num} {plural}")))
}

const MONTHS: [&str; 12] = [
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
];

const WEEKDAYS: &str = "monday|tuesday|wednesday|thursday|friday|saturday|sunday";
static CALENDAR_RANGE: LazyLock<JsRegex> = LazyLock::new(|| {
    let name = [MONTH_ALT, "|", WEEKDAYS].concat();
    let p = [
        "\\b(",
        &name,
        ")[ \\t\\u00a0]*[-\\u2010\\u2011\\u2012\\u2013\\u2014\\u2015][ \\t\\u00a0]*(",
        &name,
        ")\\b",
    ]
    .concat();
    JsRegex::new(&p, "giu").unwrap()
});

fn ordinal_suffix(n: u32) -> &'static str {
    let (mod10, mod100) = (n % 10, n % 100);
    if mod10 == 1 && mod100 != 11 {
        return "st";
    }
    if mod10 == 2 && mod100 != 12 {
        return "nd";
    }
    if mod10 == 3 && mod100 != 13 {
        return "rd";
    }
    "th"
}

/// Days in `month` (1-12) of `year`, Gregorian.
fn days_in_month(year: u32, month: u32) -> u32 {
    match month {
        2 if (year % 4 == 0 && year % 100 != 0) || year % 400 == 0 => 29,
        2 => 28,
        4 | 6 | 9 | 11 => 30,
        _ => 31,
    }
}

fn iso_date(year: u32, month: u32, day: u32) -> Option<JsString> {
    if !(1..=12).contains(&month) || day < 1 || day > days_in_month(year, month) {
        return None;
    }
    Some(js(&format!(
        "{} {day}{} {year}",
        MONTHS[(month - 1) as usize],
        ordinal_suffix(day)
    )))
}

fn year_words(y: u32) -> String {
    let (hi, lo) = (y / 100, y % 100);
    if (2000..2010).contains(&y) {
        return if lo == 0 {
            "2 thousand".into()
        } else {
            format!("2 thousand {lo}")
        };
    }
    if lo == 0 {
        return format!("{hi} hundred");
    }
    if lo < 10 {
        return format!("{hi} oh {lo}");
    }
    format!("{hi} {lo}")
}

fn superscript_digit(c: u16) -> u16 {
    match c {
        0x207B => b'-' as u16,
        0x2070 => b'0' as u16,
        0x00B9 => b'1' as u16,
        0x00B2 => b'2' as u16,
        0x00B3 => b'3' as u16,
        0x2074..=0x2079 => b'4' as u16 + (c - 0x2074),
        _ => panic!("SUPERSCRIPT_DIGIT[{c:#x}] is undefined"),
    }
}
/// `[...sup].map((c) => SUPERSCRIPT_DIGIT[c]!).join("")` — every unit of `sup` is one of the table's BMP keys.
fn superscript_digits(sup: &JsString) -> JsString {
    JsString(sup.0.iter().map(|&c| superscript_digit(c)).collect())
}

/// `Number(x)` for a digit field bounded at four digits by its pattern, so provably a small integer.
fn int(s: &JsString) -> u32 {
    js_number(s) as u32
}

// ── Patterns built at module load in the TS, or per call there and hoisted here ─────────────────────
static PLAIN_DOT_NEXT: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &["\\b(", &PLAIN_ABBREV_ALT, ")\\.(\\s+)(?=\\p{L})"].concat(),
        "giu",
    )
    .unwrap()
});
static BARE_ABBREV: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &[
            "(?<![\\p{L}\\p{M}.])(",
            &BARE_ABBREV_ALT,
            ")(?![\\p{L}\\p{M}.])",
        ]
        .concat(),
        "giu",
    )
    .unwrap()
});
static PLAIN_DOT_END: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &["\\b(", &PLAIN_ABBREV_ALT, ")\\.(?=\\s*(?:[.,;:!?)]|$))"].concat(),
        "giu",
    )
    .unwrap()
});
static MONTH_ABBREV_RANGE: LazyLock<JsRegex> = LazyLock::new(|| {
    let (a, m) = (MONTH_ABBREV_ALT.as_str(), MONTH_ALT);
    let p = [
        "\\b(",
        a,
        "|",
        m,
        ")\\b\\.?[ \\t\u{a0}]*([-\u{2010}-\u{2015}])[ \\t\u{a0}]*",
        "(",
        a,
        "|",
        m,
        ")\\b\\.?",
    ]
    .concat();
    JsRegex::new(&p, "giu").unwrap()
});
static MONTH_ABBREV_BEFORE_DIGIT: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &["\\b(", &MONTH_ABBREV_ALT, ")\\b\\.?(?=[ \u{a0}]+\\d)"].concat(),
        "giu",
    )
    .unwrap()
});
static MONTH_ABBREV_AFTER_DAY: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &["(?<=\\b\\d{1,2}[ \u{a0}])(", &MONTH_ABBREV_ALT, ")\\b\\.?"].concat(),
        "giu",
    )
    .unwrap()
});
static WEEKDAY_BEFORE_MONTH: LazyLock<JsRegex> = LazyLock::new(|| {
    let p = [
        "\\b(",
        &WEEKDAY_ABBREV_ALT,
        ")\\b\\.?(?=,?[ \u{a0}]+(?:\\d{1,2}[ \u{a0}]+)?(?:",
        &MONTH_ALT_NO_MAY,
        ")\\b)",
    ]
    .concat();
    JsRegex::new(&p, "giu").unwrap()
});
static SPACE_GROUP: LazyLock<JsRegex> = LazyLock::new(|| {
    let p = [
        "(?<!(?:", MONTH_ALT, ")[ \u{a0}\u{202f}\u{2009}])(?<![\\d.,])[1-9]\\d{0,2}(?:[ \u{a0}\u{202f}\u{2009}]\\d{3})+(?![\\d])",
    ]
    .concat();
    JsRegex::new(&p, "giu").unwrap()
});

const CLOCK: &str = "\\d{1,2}:[0-5]\\d";
static CLOCK_SEC: LazyLock<String> = LazyLock::new(|| [CLOCK, ":[0-5]\\d"].concat());
const SIGN: &str = "([+\\-\u{2212}])";
static OFFSET_COMPACT_SEC: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &[
            "(?<=",
            &CLOCK_SEC,
            ")[ \u{a0}]*",
            SIGN,
            "(\\d{2})(\\d{2})\\b",
        ]
        .concat(),
        "gu",
    )
    .unwrap()
});
static OFFSET_COMPACT_SPACED: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &["(?<=", CLOCK, ")[ \u{a0}]+", SIGN, "(\\d{2})(\\d{2})\\b"].concat(),
        "gu",
    )
    .unwrap()
});
static OFFSET_COLON: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &[
            "(?<=",
            &CLOCK_SEC,
            ")[ \u{a0}]*",
            SIGN,
            "(\\d{2}):(\\d{2})\\b",
        ]
        .concat(),
        "gu",
    )
    .unwrap()
});
static OFFSET_ZULU: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&["(?<=", CLOCK, "(?::[0-5]\\d)?)Z\\b"].concat(), "gu").unwrap());

static CURRENCY_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    let alt = longest_first(MONEY_MAGNITUDE.iter().map(|(k, _)| *k));
    let p = [
        "([$£€¥])\\s?(\\d[\\d,]*(?:\\.\\d+)?)(?:(\\s+(?:million|billion|trillion|thousand))|(",
        &alt,
        ")(?![\\p{L}\\p{M}\\d]))?",
    ]
    .concat();
    JsRegex::new(&p, "gu").unwrap()
});
static YEAR_AFTER_MONTH: LazyLock<JsRegex> = LazyLock::new(|| {
    let p = [
        "\\b(",
        MONTH_ALT,
        ")((?:\\s+\\d{1,2}(?:st|nd|rd|th))?,?)\\s+(1[1-9]\\d\\d|20\\d\\d)\\b(?![.,]?\\d)",
    ]
    .concat();
    JsRegex::new(&p, "gi").unwrap()
});

fn offset_words(m: &JsMatch, s: &JsString) -> JsString {
    let (sign, h, mm) = (g(m, 1, s), int(&g(m, 2, s)), int(&g(m, 3, s)));
    if h > 14 || mm > 59 {
        return m.value(s);
    }
    if h == 0 && mm == 0 {
        return js(" UTC");
    }
    let word = if sign == "+" { "plus" } else { "minus" };
    let hours = if h == 0 {
        String::new()
    } else {
        format!(" {h} {}", if h == 1 { "hour" } else { "hours" })
    };
    let mins = if mm == 0 {
        String::new()
    } else {
        format!(" {mm} {}", if mm == 1 { "minute" } else { "minutes" })
    };
    js(&format!(" {word}{hours}{mins}"))
}

fn is_one(n: &JsString) -> bool {
    js_re!(r"^0*1(?:\.0+)?$").test(&js_re!(",", "gu").replace(n, &JsString::new()))
}
fn counted(n: &JsString, sg: &str, pl: &str) -> JsString {
    jcat!(n, " ", if is_one(n) { sg } else { pl })
}

const HEMISPHERE: &[(&str, &str)] = &[
    ("N", "north"),
    ("S", "south"),
    ("E", "east"),
    ("W", "west"),
    ("NE", "northeast"),
    ("NW", "northwest"),
    ("SE", "southeast"),
    ("SW", "southwest"),
];

fn re_prefix() -> &'static JsRegex {
    js_re!(
        r"(?<![\p{L}\p{M}\d])(?<!\b(?:do|re|mi|fa|sol|la|ti|si|ut)-)([Rr])([Ee])(?=-\p{L})",
        "giu"
    )
}

static LEADING_DECIMAL_POINT: LazyLock<JsRegex> = LazyLock::new(|| {
    let p = [
        "(?<![\\d\\p{L}\\p{M}.])(?<!\\b(?:batting|hitting|slugging|averaging)[ \\t\\u00a0])",
        "\\.(?=\\d)(?!\\d+[ \\t\\u00a0-]*(?:cal|calibre|caliber|acp|magnum|mag|special|spl|auto",
        "|lr|win|winchester|rem|remington|luger|s&w)\\b)",
    ]
    .concat();
    JsRegex::new(&p, "giu").unwrap()
});

fn list_marker() -> &'static JsRegex {
    js_re!(
        r"(?<=^|\n)([ \t]*)[([]?([A-Za-z]|\d{1,2})[)\]](?=[ \t]+\S)",
        "gu"
    )
}
fn bracketed_letter() -> &'static JsRegex {
    js_re!(r"(?<=[([{])([A-Za-z])(?=[)\]}])", "gu")
}
fn dms_coordinate() -> &'static JsRegex {
    // ⚠ The three `[ \t ]` classes hold a LITERAL U+00A0, as the TS source does.
    js_re!(
        "(\\d+(?:\\.\\d+)?)°[ \\t\u{a0}]?(\\d+(?:\\.\\d+)?)[′'](?!s)(?:[ \\t\u{a0}]?(\\d+(?:\\.\\d+)?)(?:[″\"]|''))?(?:[ \\t\u{a0}]?((?:[NS][EW]|[NSEW]))(?![\\p{L}\\p{M}]))?",
        "gu"
    )
}
fn feet_inches() -> &'static JsRegex {
    js_re!(
        r#"(\d+(?:\.\d+)?)[′'][ \t\u00a0]?(\d+(?:\.\d+)?)(?:[″"]|'')"#,
        "gu"
    )
}
fn inch_decimal_ascii() -> &'static JsRegex {
    js_re!(r#"(\d+\.\d+)"(?!\p{L})"#, "gu")
}

fn every_quote_is_an_inch(t: &JsString) -> bool {
    let mut any = false;
    for i in 0..t.len() {
        if t.0[i] != b'"' as u16 {
            continue;
        }
        any = true;
        if !js_re!(r"\d\.\d+$", "u").test(&t.slice(0, Some(i as isize))) {
            return false;
        }
    }
    any
}

/// `LETTER_NAME`: a lowercase ASCII letter's name (the manifest's exceptions, else the letter).
fn letter_name(l: &JsString) -> Option<JsString> {
    if !js_re!("^[a-z]$", "u").test(l) {
        return None;
    }
    Some(
        MANIFEST
            .letter_name_exceptions
            .get(l.to_string_lossy().as_str())
            .map_or_else(|| l.clone(), |n| js(n)),
    )
}

fn say_letter(l: &JsString) -> JsString {
    let Some(name) = MANIFEST
        .letter_name_exceptions
        .get(l.to_lower_case().to_string_lossy().as_str())
    else {
        return l.clone();
    };
    let name = js(name);
    if *l == l.to_upper_case() {
        name.to_upper_case()
    } else {
        name
    }
}

/// `[...run.toLowerCase()].map((l) => LETTER_NAME(l) ?? l).join(" ")`; `run` is `[A-Z]{1,3}`.
fn spell_letters(run: &JsString) -> JsString {
    let parts: Vec<JsString> = run
        .to_lower_case()
        .0
        .iter()
        .map(|&u| {
            let l = JsString(vec![u]);
            letter_name(&l).unwrap_or(l)
        })
        .collect();
    JsString::join(&parts, &js(" "))
}

const GREEK_NAME: &[(&str, &str)] = &[
    ("α", "alpha"),
    ("β", "beta"),
    ("γ", "gamma"),
    ("δ", "delta"),
    ("ε", "epsilon"),
    ("ζ", "zeta"),
    ("η", "eta"),
    ("θ", "theta"),
    ("ι", "iota"),
    ("κ", "kappa"),
    ("λ", "lambda"),
    ("μ", "mu"),
    ("ν", "nu"),
    ("ξ", "zye"),
    ("ο", "omicron"),
    ("π", "pi"),
    ("ρ", "rho"),
    ("σ", "sigma"),
    ("ς", "sigma"),
    ("τ", "tau"),
    ("υ", "upsilon"),
    ("φ", "phi"),
    ("χ", "chi"),
    ("ψ", "psi"),
    ("ω", "omega"),
    ("Α", "alpha"),
    ("Β", "beta"),
    ("Γ", "gamma"),
    ("Δ", "delta"),
    ("Ε", "epsilon"),
    ("Ζ", "zeta"),
    ("Η", "eta"),
    ("Θ", "theta"),
    ("Ι", "iota"),
    ("Κ", "kappa"),
    ("Λ", "lambda"),
    ("Μ", "mu"),
    ("Ν", "nu"),
    ("Ξ", "zye"),
    ("Ο", "omicron"),
    ("Π", "pi"),
    ("Ρ", "rho"),
    ("Σ", "sigma"),
    ("Τ", "tau"),
    ("Υ", "upsilon"),
    ("Φ", "phi"),
    ("Χ", "chi"),
    ("Ψ", "psi"),
    ("Ω", "omega"),
    ("\u{2126}", "omega"),
];
fn greek_letter() -> &'static JsRegex {
    js_re!(
        r"([\p{L}\p{Nd}])?(?<![\p{Script=Greek}\p{M}²³])(\p{Script=Greek})([²³])?(?![\p{Script=Greek}\p{M}²³])([\p{L}\p{Nd}])?",
        "gu"
    )
}
fn greek_exponent(e: &JsString) -> &'static str {
    if *e == "²" {
        " squared"
    } else if *e == "³" {
        " cubed"
    } else {
        panic!("GREEK_EXPONENT[{e:?}]")
    }
}

static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.acronym_letters.iter().map(|w| js(w)).collect());

static IS_UNREADABLE: LazyLock<Box<dyn Fn(&JsString) -> bool + Send + Sync>> =
    LazyLock::new(|| {
        let p = &MANIFEST.phonotactics;
        Box::new(make_unreadable_test(PhonotacticsData {
            vowels: JsRegex::new(&format!("[{}]", p.vowels), "u").unwrap(),
            legal_onsets: p.onsets.iter().map(|o| js(o)).collect(),
            legal_codas: p.codas.iter().map(|c| js(c)).collect(),
            liquids: None,
            digraphs: None,
        }))
    });

/// English phonotactics for the initialism pass's fail-safe guard (the TS `isUnreadableEnglish`).
pub fn is_unreadable_english(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

/// Normalize one English input string. Pure text→text; no IPA.
pub fn normalize_english(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 0) Abbreviations.
    s = rewrite_with(
        &s,
        js_re!(r"\b(st|dr|mt|mr|mrs)\.\s+([a-zà-ÿ']+)", "gi"),
        |m, w| {
            let (abbr, next) = (g(m, 1, w), g(m, 2, w));
            jcat!(dotted_abbrev(&abbr.to_lower_case(), &next), " ", next)
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"\b(st|dr|mt)\.(?=\s*(?:[.,;:!?]|$))", "gi"),
        |m, w| {
            let abbr = g(m, 1, w).to_lower_case();
            js(
                lookup2(&[("st", "street"), ("dr", "drive"), ("mt", "mount")], &abbr)
                    .expect("st|dr|mt"),
            )
        },
    );
    s = rewrite_with(&s, js_re!(r"\bst\s+([a-z']+)", "gi"), |m, w| {
        let next = g(m, 1, w);
        if abbrev_function_next().test(&next) {
            m.value(w)
        } else {
            jcat!("saint ", next)
        }
    });

    // 0a2) `Rev.` before a designator.
    s = rewrite(
        &s,
        js_re!(r"\b[Rr][Ee][Vv]\.?\s+(?=(?:[A-Z](?![a-z.])|\d))", "gu"),
        &js("revision "),
    );

    // 0b) More dotted abbreviations. ⚠ The miss branches are reachable (an `iu` fold widens the keys).
    s = rewrite_with(&s, &PLAIN_DOT_NEXT, |m, w| {
        let (ab, sp) = (g(m, 1, w), g(m, 2, w));
        match lookup2(PLAIN_ABBREV, &ab.to_lower_case()) {
            None => m.value(w),
            Some(x) => jcat!(x, sp),
        }
    });
    s = rewrite_with(&s, &BARE_ABBREV, |m, w| {
        lookup2(PLAIN_ABBREV, &g(m, 1, w).to_lower_case()).map_or_else(|| m.value(w), js)
    });
    s = rewrite_with(&s, &PLAIN_DOT_END, |m, w| {
        match lookup2(PLAIN_ABBREV, &g(m, 1, w).to_lower_case()) {
            None => m.value(w),
            Some(x) => jcat!(x, "."),
        }
    });
    s = rewrite(&s, js_re!(r"\bTY\s?(\d{4})\b", "gu"), &js("Tax Year $1"));
    s = rewrite(&s, js_re!(r"\bIR\b", "gu"), &js("infrared"));
    s = rewrite(
        &s,
        js_re!(r"\bmax\.(\s+)(?=[\p{L}\p{N}])", "gu"),
        &js("maximum$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"\bmax\b(?!\.?\s+(?:\w+\s+)?out\b)", "gu"),
        &js("maximum"),
    );
    s = rewrite(
        &s,
        js_re!(r"\bet\s+al\.(\s+)(?=\p{L})", "giu"),
        &js("et al$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"\bet\s+al\.(?=\s*(?:[.,;:!?)]|$))", "giu"),
        &js("et al."),
    );
    s = rewrite(
        &s,
        js_re!(r"\bca?\.\s*(?=\d{3,4}(?!\d))", "gi"),
        &js("circa "),
    );
    s = rewrite(&s, js_re!(r"\bnos?\.\s*(?=\d)", "gi"), &js("number "));
    s = rewrite(
        &s,
        js_re!(r"\be\.\s?g\.(\s+)(?=[\p{L}\d])", "giu"),
        &js("for example$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"\be\.\s?g\.(?=\s*(?:[,;:!?)]|$))", "giu"),
        &js("for example."),
    );
    s = rewrite(
        &s,
        js_re!(r"\bi\.\s?e\.(\s+)(?=[\p{L}\d])", "giu"),
        &js("that is$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"\bi\.\s?e\.(?=\s*(?:[,;:!?)]|$))", "giu"),
        &js("that is."),
    );
    s = rewrite_with(&s, js_re!(r"\b([ap])\.\s?m\.", "gi"), |m, w| {
        js(if g(m, 1, w).to_lower_case() == "a" {
            "ay em"
        } else {
            "pee em"
        })
    });
    s = rewrite_with(
        &s,
        js_re!(r"\b([A-Za-z](?:\.[A-Za-z]){1,4})\.(?!\w)", "g"),
        |m, w| {
            js_re!(r"\.", "g")
                .replace(&m.value(w), &JsString::new())
                .to_upper_case()
        },
    );

    // 0b2) Month and weekday abbreviations.
    s = rewrite_with(&s, &MONTH_ABBREV_RANGE, |m, w| {
        let (a, dash, b) = (g(m, 1, w), g(m, 2, w), g(m, 3, w));
        let a2 = lookup2(&MONTH_ABBREV, &a.to_lower_case()).map_or(a, js);
        let b2 = lookup2(&MONTH_ABBREV, &b.to_lower_case()).map_or(b, js);
        jcat!(a2, dash, b2)
    });
    s = rewrite_with(&s, &MONTH_ABBREV_BEFORE_DIGIT, |m, w| {
        lookup2(&MONTH_ABBREV, &g(m, 1, w).to_lower_case()).map_or_else(|| m.value(w), js)
    });
    s = rewrite_with(&s, &MONTH_ABBREV_AFTER_DAY, |m, w| {
        lookup2(&MONTH_ABBREV, &g(m, 1, w).to_lower_case()).map_or_else(|| m.value(w), js)
    });
    s = rewrite_with(&s, &WEEKDAY_BEFORE_MONTH, |m, w| {
        lookup2(&WEEKDAY_ABBREV, &g(m, 1, w).to_lower_case()).map_or_else(|| m.value(w), js)
    });

    // 0b3) A section number's dot is "point"; 0b4) `Re:`; 0b4a) a hyphenated `re-`, echoing its case.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}.])(\p{L})\.(?=\d)", "gu"),
        &js("$1 point "),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])[Rr][Ee]:[ \t]*", "gu"),
        &js("regarding "),
    );
    s = rewrite_with(&s, re_prefix(), |m, w| {
        let (r, e) = (g(m, 1, w), g(m, 2, w));
        let tail = if e == e.to_upper_case() { "E" } else { "e" };
        jcat!(r, e, tail)
    });

    // 0b5) A province or state code in an address, then the ZIP after the name it produced.
    s = rewrite_with(&s, &ADDRESS_CODE, |m, whole| {
        let (comma, code) = (g(m, 1, whole), g(m, 2, whole));
        if CREDENTIAL_CODE.iter().any(|c| code == *c)
            && !FOLLOWED_BY_POSTCODE.test(&whole.slice(m.end() as isize, None))
        {
            return m.value(whole);
        }
        jcat!(
            comma,
            lookup2(REGION_CODE, &code.to_lower_case()).map_or(code, js)
        )
    });
    s = rewrite_with(&s, &ADDRESS_ZIP, |m, w| {
        let spaced = |d: &JsString| {
            let parts: Vec<JsString> = d.0.iter().map(|&u| JsString(vec![u])).collect();
            JsString::join(&parts, &js(" "))
        };
        let zip = spaced(&g(m, 1, w));
        match m.group(3, w) {
            None => zip,
            Some(p4) => jcat!(zip, " ", spaced(&p4)),
        }
    });

    // 0b6–0b6c) Listed formulae, designations and mixed-case abbreviations (case-sensitive).
    s = rewrite_with(&s, &FORMULA_TOKEN, |m, w| {
        let tok = m.value(w);
        lookup2(FORMULA_READING, &tok).map_or(tok, js)
    });
    s = rewrite_with(&s, &DESIGNATION_TOKEN, |m, w| {
        let tok = m.value(w);
        lookup2(DESIGNATION_READING, &tok).map_or(tok, js)
    });
    s = rewrite_with(&s, &MIXED_CASE_TOKEN, |m, w| {
        let tok = m.value(w);
        lookup2(MIXED_CASE_ABBREV, &tok).map_or(tok, js)
    });

    // 0b7) An enumerated list lead-in; 0b8) a lone bracketed letter.
    s = rewrite_with(&s, list_marker(), |m, w| {
        let (indent, mark) = (g(m, 1, w), g(m, 2, w));
        let said = if js_re!(r"^\d+$", "u").test(&mark) {
            mark
        } else {
            say_letter(&mark)
        };
        jcat!(indent, said, ",")
    });
    s = rewrite_with(&s, bracketed_letter(), |m, w| say_letter(&m.value(w)));

    // 0c) Era markers.
    s = rewrite_with(&s, js_re!(r"\b(BCE|BC|CE|AD)\b", "g"), |m, w| {
        let m0 = m.value(w);
        lookup2(
            &[
                ("BCE", "bee see ee"),
                ("BC", "bee see"),
                ("CE", "see ee"),
                ("AD", "ay dee"),
            ],
            &m0,
        )
        .map_or(m0, js)
    });

    // 0d) SI digit grouping, as one whole run.
    s = rewrite_with(&s, &SPACE_GROUP, |m, w| {
        js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&m.value(w), &JsString::new())
    });

    // 0d2) A leading-point decimal gets its zero.
    s = rewrite(&s, &LEADING_DECIMAL_POINT, &js("0."));

    // 0e) Scientific notation's `× 10` exponent.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<=[×x·]\s?)(10)\s?(\u207b?[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]+|-\d+)",
            "gu"
        ),
        |m, w| {
            let (ten, sup) = (g(m, 1, w), g(m, 2, w));
            let digits = if sup.starts_with(&js("-")) {
                sup
            } else {
                superscript_digits(&sup)
            };
            let power = if digits.starts_with(&js("-")) {
                jcat!("negative ", digits.slice(1, None))
            } else {
                digits
            };
            jcat!(ten, " to the power of ", power)
        },
    );

    // 0e2) A timezone offset on a printed timestamp.
    s = rewrite_with(&s, &OFFSET_COMPACT_SEC, offset_words);
    s = rewrite_with(&s, &OFFSET_COMPACT_SPACED, offset_words);
    s = rewrite_with(&s, &OFFSET_COLON, offset_words);
    s = rewrite(&s, &OFFSET_ZULU, &js(" UTC"));

    // 0f) Negatives, and ±.
    s = rewrite(
        &s,
        js_re!(r"(^|[\s(])[-−–](\d)", "gu"),
        &js("$1negative $2"),
    );
    s = rewrite(
        &s,
        js_re!(r"(^|[\s(])±\s?(\d)", "gu"),
        &js("$1plus or minus $2"),
    );

    // 0f0) Numeric dates.
    s = rewrite_with(
        &s,
        js_re!(
            r"\b(\d{4})-(\d{2})-(\d{2})(?:T(?=\d{1,2}:)|(?![\p{L}\d-]))",
            "gu"
        ),
        |m, w| {
            let m0 = m.value(w);
            match iso_date(int(&g(m, 1, w)), int(&g(m, 2, w)), int(&g(m, 3, w))) {
                None => m0,
                Some(date) => {
                    if m0.ends_with(&js("T")) {
                        jcat!(date, " ")
                    } else {
                        date
                    }
                }
            }
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b", "g"),
        |m, w| {
            iso_date(int(&g(m, 3, w)), int(&g(m, 1, w)), int(&g(m, 2, w)))
                .unwrap_or_else(|| m.value(w))
        },
    );

    // 0f1) Money with cents.
    s = rewrite_with(
        &s,
        js_re!(
            r"([$£€¥])\s?(\d[\d,]*)\.(\d{2})(?![\p{L}\p{M}\d])(?!\s+(?:million|billion|trillion|thousand))",
            "gu"
        ),
        |m, w| {
            let (sym, int_part, cents) = (g(m, 1, w), g(m, 2, w), g(m, 3, w));
            let Some((sub_sg, sub_pl)) = lookup3(&SUBUNIT, &sym) else {
                return m.value(w);
            };
            let (sg, pl) = lookup3(&CURRENCY, &sym).expect("CURRENCY[sym]");
            let whole = js_re!(",", "g").replace(&int_part, &JsString::new());
            let unit = if js_re!("^1$").test(&whole) { sg } else { pl };
            let n = int(&cents);
            if n == 0 {
                return jcat!(int_part, " ", unit);
            }
            let frac = js(&format!("{n} {}", if n == 1 { sub_sg } else { sub_pl }));
            if js_re!("^0+$").test(&whole) {
                frac
            } else {
                jcat!(int_part, " ", unit, " ", frac)
            }
        },
    );

    // 0f2) Plus: infix, prefix, postfix runs, and between non-digit operands.
    s = rewrite(&s, js_re!(r"(\S)\+\s?(\d)", "gu"), &js("$1 plus $2"));
    s = rewrite(&s, js_re!(r"(^|\s)\+\s?(\d)", "gu"), &js("$1plus $2"));
    s = rewrite_with(
        &s,
        js_re!(r"([\p{L}\d])(\++)(?![ \t\u00a0]?\d)", "gu"),
        |m, w| {
            let (head, signs) = (g(m, 1, w), g(m, 2, w));
            jcat!(head, " plus".repeat(signs.len()))
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\S)[ \t\u00a0]\+[ \t\u00a0](?=\S)", "gu"),
        &js(" plus "),
    );

    // 0g) `24/7`, then fractions.
    s = rewrite(&s, js_re!(r"(?<![\d/])24\/7(?![\d/])", "gu"), &js("24 7"));
    s = rewrite_with(
        &s,
        js_re!(r"\b(\d{1,3})\/(\d{1,3})\b(?!\s*[\/\d])", "gu"),
        |m, w| fraction_words(int(&g(m, 1, w)), int(&g(m, 2, w))).unwrap_or_else(|| m.value(w)),
    );

    // 1) Currency, with a spelled or glued magnitude hopping with the sign.
    s = rewrite_with(&s, &CURRENCY_RE, |m, w| {
        let (sym, num) = (g(m, 1, w), g(m, 2, w));
        let (sg, pl) = lookup3(&CURRENCY, &sym).expect("CURRENCY[sym]");
        let mag = m.group(3, w).or_else(|| {
            m.group(4, w).map(|a| {
                jcat!(
                    " ",
                    lookup2(&MONEY_MAGNITUDE, &a).expect("MONEY_MAGNITUDE[abbrev]")
                )
            })
        });
        let one = js_re!(r"^1(?:\.0+)?$").test(&js_re!(",", "g").replace(&num, &JsString::new()));
        let noun = if one && mag.is_none() { sg } else { pl };
        jcat!(num, mag.unwrap_or_default(), " ", noun)
    });

    // 2) Percent.
    s = rewrite(&s, js_re!(r"(\d)\s?%", "gu"), &js("$1 percent"));

    // 3) Times.
    s = rewrite_with(
        &s,
        js_re!(r"\b(\d{1,2}):([0-5]\d)(?::([0-5]\d))?\b(\s*[ap]m\b)?", "gu"),
        |m, w| {
            let (h, mm, ss, ap) = (g(m, 1, w), g(m, 2, w), m.group(3, w), m.group(4, w));
            let suffix = ap.unwrap_or_default();
            let n = ss.as_ref().map_or(0, int);
            let secs = match &ss {
                Some(x) if *x != "00" => js(&format!(
                    " and {n} {}",
                    if n == 1 { "second" } else { "seconds" }
                )),
                _ => JsString::new(),
            };
            let body = if mm == "00" {
                if !suffix.is_empty() || !secs.is_empty() {
                    h
                } else {
                    jcat!(h, " o'clock")
                }
            } else if mm.starts_with(&js("0")) {
                jcat!(h, " oh ", int(&mm).to_string())
            } else {
                jcat!(h, " ", mm)
            };
            jcat!(body, secs, suffix)
        },
    );

    // 4) Dates: month + bare day → ordinal suffix.
    s = rewrite_with(
        &s,
        js_re!(
            r"\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?!\d|\s*(?:st|nd|rd|th|percent))\b",
            "gi"
        ),
        |m, w| {
            let (mon, d) = (g(m, 1, w), g(m, 2, w));
            let n = int(&d);
            if !(1..=31).contains(&n) {
                return m.value(w);
            }
            let ends = |c: &str| d.ends_with(&js(c));
            let suf = if ends("1") && n != 11 {
                "st"
            } else if ends("2") && n != 12 {
                "nd"
            } else if ends("3") && n != 13 {
                "rd"
            } else {
                "th"
            };
            jcat!(mon, " ", d, suf)
        },
    );

    // 5) Years: dashed ranges, then context words, then after a month.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<!\b(?:pp|p|pages?|nos?|no|rooms?|chapters?|verses?|lines?|sections?|parts?|models?|items?|figs?|figures?|tables?|suites?|apt|ext)\.?\s)\b(1[1-9]\d\d|20\d\d)(\s*[-–—]\s*)(1[1-9]\d\d|20\d\d)\b(?![.,]?\d)(?!\s*(?:percent|kilometers?|meters?|km|kg|miles?|feet|ft|dollars?|usd|euros?))",
            "gi"
        ),
        |m, w| {
            let (a, dash, b) = (int(&g(m, 1, w)), g(m, 2, w), int(&g(m, 3, w)));
            if b >= a {
                jcat!(year_words(a), dash, year_words(b))
            } else {
                m.value(w)
            }
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"\b(in|of|since|from|until|till|by|before|after|around|circa|year|late|early|mid)(\s+(?:the|a|an))?\s+(1[1-9]\d\d|20\d\d)\b(?![.,]?\d)(?!\s*(?:percent|kilometers?|meters?))",
            "gi"
        ),
        |m, w| {
            let (ctx, det, y) = (g(m, 1, w), m.group(2, w), int(&g(m, 3, w)));
            if det.is_some() && y >= 2010 {
                return m.value(w);
            }
            jcat!(ctx, det.unwrap_or_default(), " ", year_words(y))
        },
    );
    s = rewrite_with(&s, &YEAR_AFTER_MONTH, |m, w| {
        jcat!(g(m, 1, w), g(m, 2, w), " ", year_words(int(&g(m, 3, w))))
    });

    // 5b) A DMS coordinate, before the unit rule.
    s = rewrite_with(&s, dms_coordinate(), |m, whole| {
        let (deg, min, sec, dir) = (
            g(m, 1, whole),
            g(m, 2, whole),
            m.group(3, whole),
            m.group(4, whole),
        );
        let mut out = jcat!(
            counted(&deg, "degree", "degrees"),
            " ",
            counted(&min, "minute", "minutes")
        );
        if let Some(sec) = sec {
            out.push_str(&jcat!(" ", counted(&sec, "second", "seconds")));
        }
        if let Some(dir) = dir {
            out.push_str(&jcat!(
                " ",
                lookup2(HEMISPHERE, &dir).expect("HEMISPHERE[dir]")
            ));
        }
        if js_re!(r"^[\p{L}\p{M}]", "u").test(&whole.slice(m.end() as isize, None)) {
            out.push_str(&js(" "));
        }
        out
    });

    // 5c) Feet and inches written tight; 5c2) a decimal inch, only when every `"` is one.
    s = rewrite_with(&s, feet_inches(), |m, w| {
        jcat!(
            counted(&g(m, 1, w), "foot", "feet"),
            " ",
            counted(&g(m, 2, w), "inch", "inches")
        )
    });
    if every_quote_is_an_inch(&s) {
        s = rewrite_with(&s, inch_decimal_ascii(), |m, w| {
            counted(&g(m, 1, w), "inch", "inches")
        });
    }

    // 6) Units: number + known abbreviation, with count agreement.
    s = rewrite_with(&s, &UNIT_RE, |m, w| {
        let (num, mag, u, exp) = (g(m, 1, w), m.group(2, w), g(m, 3, w), m.group(4, w));
        let Some((sg, pl)) = unit_forms(&u) else {
            return m.value(w);
        };
        if ascii_exponent_is_code_digit(&u, exp.as_ref()) {
            return m.value(w);
        }
        let minutes = ascii_exponent_is_compound_part(&u, exp.as_ref());
        let measure = match &exp {
            _ if minutes => "",
            Some(e) if *e == "²" || *e == "2" => "square ",
            Some(e) if *e == "³" || *e == "3" => "cubic ",
            _ => "",
        };
        let one = mag.is_none()
            && js_re!(r"^1(?:\.0+)?$").test(&js_re!(",", "g").replace(&num, &JsString::new()));
        let tail = if minutes {
            jcat!(" ", exp.clone().unwrap())
        } else {
            JsString::new()
        };
        jcat!(
            num,
            mag.unwrap_or_default(),
            " ",
            measure,
            if one { sg } else { pl },
            tail
        )
    });

    // 6a2) A slashed rate standing alone; 6a4) a micro-prefixed unit standing alone.
    s = rewrite_with(&s, &BARE_RATE_RE, |m, w| {
        let m0 = m.value(w);
        unit_forms(&m0).map_or(m0, |f| f.0.clone())
    });
    s = rewrite_with(&s, &BARE_MICRO_RE, |m, w| {
        let m0 = m.value(w);
        unit_forms(&m0).map_or(m0, |f| f.0.clone())
    });

    // `w/` with nothing after it.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d/])w\/(?![\p{L}\d])", "giu"),
        &js("with"),
    );

    // 6a3) A slash the table cannot enumerate: a rate, an elided pair, a label, or left alone.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\d/])(\p{L}[\p{L}\u00b2\u00b3]*)[ \t]*\/[ \t]*(\p{L}[\p{L}\u00b2\u00b3]*)(?![\p{L}\d/])",
            "giu"
        ),
        |m, w| {
            let (m0, left, right) = (m.value(w), g(m, 1, w), g(m, 2, w));
            let key = js_re!(r"[ \t]", "gu").replace(&m0.to_lower_case(), &JsString::new());
            if let Some(x) = lookup2(SLASH_ABBREV, &key) {
                return js(x);
            }
            if SLASH_ELIDED.iter().any(|e| key == *e) {
                return jcat!(left, " ", right);
            }
            if left.len() < 2 && right.len() < 2 {
                return m0;
            }
            let num = unit_forms(&left);
            let den = unit_forms(&right);
            let period = time_period(&right.to_lower_case());
            let rate = period.is_some()
                || num.is_some()
                || den.is_some()
                || UNIT_WORDS.contains(&left.to_lower_case())
                || UNIT_WORDS.contains(&right.to_lower_case());
            if rate {
                // `num?.[1] ?? left` / `period ?? den?.[0] ?? right`.
                let n = num.map_or(left, |f| f.1.clone());
                let d = period.unwrap_or_else(|| den.map_or(right, |f| f.0.clone()));
                return jcat!(n, " per ", d);
            }
            let label = left == left.to_upper_case() && right == right.to_upper_case();
            if label {
                jcat!(left, " slash ", right)
            } else {
                m0
            }
        },
    );

    // 6b) A bare exponent: space off a following letter, then read the power.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?:\d[\d.,]*|(?<![A-Za-z])[A-Za-z]{1,3})(?:\u207b?[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]+)(?=[\p{L}\p{M}])",
            "gu"
        ),
        |m, w| jcat!(m.value(w), " "),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(\d[\d.,]*|(?<![A-Za-z])[A-Za-z]{1,3})\s?(\u207b?[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]+)",
            "gu"
        ),
        |m, all| {
            let (whole, base, sup, at) = (m.value(all), g(m, 1, all), g(m, 2, all), m.index());
            if js_re!("^[⁰¹]$", "u").test(&sup) {
                return whole;
            }
            if js_re!("^¹+$", "u").test(&sup)
                && js_re!(r"\d+⁰\d+¹$", "u")
                    .test(&all.slice(at.saturating_sub(24) as isize, Some(at as isize)))
            {
                return whole;
            }
            if js_re!(r"\s", "u").test(&whole)
                && js_re!(r"^[\p{L}\p{M}]", "u").test(&all.slice((at + whole.len()) as isize, None))
            {
                return whole;
            }
            let digits = superscript_digits(&sup);
            let neg = digits.starts_with(&js("-"));
            let mag = if neg { digits.slice(1, None) } else { digits };
            if mag == "2" && !neg {
                return jcat!(base, " squared");
            }
            if mag == "3" && !neg {
                return jcat!(base, " cubed");
            }
            let power = if neg { jcat!("negative ", mag) } else { mag };
            jcat!(base, " to the power of ", power)
        },
    );

    // 7a) All-caps romans of any value, when the text distinguishes case.
    if js_re!("[a-z]").test(&s) {
        s = rewrite_with(
            &s,
            js_re!(r"\b([A-Za-z][A-Za-z']*)\s+([IVXLCDM]{2,})\b", "g"),
            |m, w| {
                let (prev, rom) = (g(m, 1, w), g(m, 2, w));
                let Some(n) = roman_to_int(&rom) else {
                    return m.value(w);
                };
                let named = roman_cardinal_ctx().test(&prev);
                let evidence = named || js_re!("^[A-Z]").test(&prev);
                if !evidence {
                    return m.value(w);
                }
                if !named && ROMAN_COLLISIONS.iter().any(|c| rom.to_lower_case() == *c) {
                    return m.value(w);
                }
                if named {
                    return jcat!(prev, " ", n.to_string());
                }
                let suf = if n % 10 == 1 && n % 100 != 11 {
                    "st"
                } else if n % 10 == 2 && n % 100 != 12 {
                    "nd"
                } else if n % 10 == 3 && n % 100 != 13 {
                    "rd"
                } else {
                    "th"
                };
                jcat!(prev, " the ", n.to_string(), suf)
            },
        );
    }

    // 7b) The closed lowercase 2–20 set.
    s = rewrite_with(
        &s,
        js_re!(
            r"\b([a-z']+)\s+(ii|iii|iv|vii|viii|ix|xii|xiii|xiv|xv|xvi|xvii|xviii|xix|xx)\b",
            "gi"
        ),
        |m, w| {
            let (prev, rom) = (g(m, 1, w), g(m, 2, w));
            let low = rom.to_lower_case();
            let n = ROMAN.iter().find(|(k, _)| low == *k).expect("ROMAN[rom]").1;
            if roman_cardinal_ctx().test(&prev) {
                return jcat!(prev, " ", n.to_string());
            }
            let suf = if n % 10 == 1 && n != 11 {
                "st"
            } else if n % 10 == 2 && n != 12 {
                "nd"
            } else if n % 10 == 3 && n != 13 {
                "rd"
            } else {
                "th"
            };
            jcat!(prev, " the ", n.to_string(), suf)
        },
    );

    // 7c) A lone Greek letter is a symbol, named in English.
    s = rewrite_with(&s, greek_letter(), |m, w| {
        let (lead, ch, exp, tail) = (m.group(1, w), g(m, 2, w), m.group(3, w), m.group(4, w));
        let Some(name) = lookup2(GREEK_NAME, &ch) else {
            return m.value(w);
        };
        let body = jcat!(name, exp.map_or("", |e| greek_exponent(&e)));
        let lead = lead.map_or_else(JsString::new, |l| jcat!(l, " "));
        let tail = tail.map_or_else(JsString::new, |t| jcat!(" ", t));
        jcat!(lead, body, tail)
    });

    // 8) The ampersand and the sign classes, last.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])([A-Z]{1,3})&(?:[aA][mM][pP];)?([A-Z]{1,3})(?![\p{L}\p{M}])",
            "gu"
        ),
        |m, w| {
            let (a, b) = (g(m, 1, w), g(m, 2, w));
            let is_initialism = |half: &JsString| {
                let low = half.to_lower_case();
                is_unreadable_english(&low) || ACRONYM_LETTERS.contains(&low)
            };
            if is_initialism(&a) || is_initialism(&b) {
                jcat!(spell_letters(&a), " and ", spell_letters(&b))
            } else {
                m.value(w)
            }
        },
    );
    s = rewrite(&s, js_re!(r"\s*&amp;\s*", "giu"), &js(" and "));
    s = rewrite(&s, js_re!(r"\s*&\s*", "gu"), &js(" and "));
    s = rewrite_with(&s, js_re!(r"(\d)\s*(×|x)\s*(?=\d)", "gu"), |m, full| {
        let (whole, left, sign) = (m.value(full), g(m, 1, full), g(m, 2, full));
        let tail = full.slice(m.end() as isize, None);
        let has_unit = js_re!(r"^\d[\d.,]*\s?[A-Za-z]", "u").test(&tail);
        let unspaced_ascii = sign == "x" && !js_re!(r"\s", "u").test(&whole);
        jcat!(
            left,
            " ",
            if has_unit || unspaced_ascii {
                "by"
            } else {
                "times"
            },
            " "
        )
    });
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*÷\s*(?=\d)", "gu"),
        &js("$1 divided by "),
    );
    s = rewrite(&s, js_re!(r"(\S)\s*=\s*(\S)", "gu"), &js("$1 equals $2"));
    s = rewrite(&s, js_re!(r"(\d)\s*<\s*(?=\d)", "gu"), &js("$1 less than "));
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*>\s*(?=\d)", "gu"),
        &js("$1 greater than "),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)[\u2012\u2013\u2014](?=\d)", "gu"),
        &js("$1 to "),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)[ \t]*\u2192[ \t]*(?=\d)", "gu"),
        &js("$1 to "),
    );
    s = rewrite(&s, &CALENDAR_RANGE, &js("$1 to $2"));
    s = rewrite(
        &s,
        js_re!(
            r"(?<=[^\s\d])[ \t\u00a0]+[-\u2010\u2011\u2012\u2013\u2014\u2015]+[ \t\u00a0]+(?=\S)",
            "gu"
        ),
        &js(", "),
    );
    s = rewrite(
        &s,
        js_re!(
            r"(?<=\d)[ \t\u00a0]+[-\u2010\u2011\u2012\u2013\u2014\u2015]+[ \t\u00a0]+(?=[^\s\d])",
            "gu"
        ),
        &js(", "),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=[^\s\d])\u2014+(?=[^\s\d])", "gu"),
        &js(", "),
    );

    for (re, (_, word)) in RELATIONAL_RE.iter().zip(RELATIONAL.iter()) {
        s = rewrite(&s, re, &jcat!(" ", word, " "));
    }

    s
}

// ── Initialisms ─────────────────────────────────────────────────────────────────────────────────────
static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| Arc::new(letter_name));
static ACRONYM_FN: LazyLock<Arc<dyn Fn(&JsString) -> bool + Send + Sync>> =
    LazyLock::new(|| Arc::new(|w: &JsString| ACRONYM_LETTERS.contains(w)));
static UNREADABLE_FN: LazyLock<Arc<dyn Fn(&JsString) -> bool + Send + Sync>> =
    LazyLock::new(|| Arc::new(is_unreadable_english));

/// The initialism pass, run AFTER `normalize_english` (the roman rules get first refusal).
pub fn normalize_english_initialisms(
    text: &JsString,
    is_recorded: &dyn Fn(&JsString) -> bool,
) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: LETTER_NAME.clone(),
            lower: None,
            acronym_letters: ACRONYM_FN.clone(),
            is_recorded,
            is_unreadable: UNREADABLE_FN.clone(),
        },
        true,
    )(text)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn n(t: &str) -> String {
        normalize_english(&js(t)).to_string_lossy()
    }

    #[test]
    fn every_pattern_compiles() {
        n("x");
        for re in [
            &*UNIT_RE,
            &*BARE_MICRO_RE,
            &*BARE_RATE_RE,
            &*FORMULA_TOKEN,
            &*DESIGNATION_TOKEN,
            &*MIXED_CASE_TOKEN,
            &*ADDRESS_CODE,
            &*FOLLOWED_BY_POSTCODE,
            &*ADDRESS_ZIP,
            &*CALENDAR_RANGE,
            &*LEADING_DECIMAL_POINT,
        ] {
            re.test(&js(""));
        }
        assert_eq!(UNITS.len(), 78);
        // 65 folded keys, minus the 5 whose declared spellings disagree (mω, µs, μs, µm, μm).
        assert_eq!(UNITS_FOLDED.len(), 60);
    }

    #[test]
    fn representative_arms() {
        assert_eq!(n("40 km/h"), "40 kilometers per hour");
        assert_eq!(
            n("$3.14 and $1.5m"),
            "3 dollars 14 cents and 1.5 million dollars"
        );
        assert_eq!(n("Austin, TX 78701"), "Austin, Texas 7 8 7 0 1");
    }

    #[test]
    fn slash_rule_does_not_read_the_prototype() {
        // This pinned the TS defect (`TIME_PERIOD["constructor"]` is `Object`) while the engines agreed on it.
        // The TS now reads own keys only, so neither side is a rate and the plain prose slash stays as written.
        assert_eq!(n("litres/constructor"), "litres/constructor");
        assert_eq!(n("toString/apples"), "toString/apples");
    }

    #[test]
    fn initialisms_take_a_borrowed_predicate() {
        let lexicon: HashSet<JsString> = [js("nasa")].into_iter().collect();
        let rec = |w: &JsString| lexicon.contains(w);
        assert!(is_unreadable_english(&js("nhs")));
        assert!(!is_unreadable_english(&js("nasa")));
        let out = normalize_english_initialisms(&js("the NHS and NASA"), &rec);
        assert_eq!(out.to_string_lossy(), "the n h s and NASA");
    }
}

/// Twins of test/rust-port-findings.test.ts (#1463).
#[cfg(test)]
mod port_findings {
    use super::*;

    fn n(s: &str) -> String {
        normalize_english(&js(s)).to_string_lossy()
    }

    #[test]
    fn slash_rate_ignores_inherited_members() {
        assert!(!n("litres/constructor").contains("function"));
        assert!(!n("toString/apples").contains(" per "));
        assert_eq!(n("litres/day"), "litres per day");
    }

    #[test]
    fn ambiguous_micro_fold_declines() {
        assert!(!n("25 \u{39c}M").contains("micro meter"));
        assert!(!n("5 \u{39c}S").contains("microsecond"));
        assert_eq!(n("25 µM"), "25 micromolar");
        assert_eq!(n("4 µm"), "4 micro meters");
        assert_eq!(n("3 \u{39c}G"), "3 micrograms");
        assert_eq!(n("10 MΩ and 10 mΩ"), "10 mega ohms and 10 milli ohms");
    }

    #[test]
    fn impossible_dates_are_not_dates() {
        for (t, month) in [
            ("2024-02-31", "february"),
            ("2/30/2024", "february"),
            ("2024-04-31", "april"),
            ("2023-02-29", "february"),
            ("1900-02-29", "february"),
        ] {
            assert!(!n(t).contains(month), "{t}");
        }
        for (t, want) in [
            ("2024-02-29", "february 29th"),
            ("2000-02-29", "february 29th"),
            ("2024-12-31", "december 31st"),
        ] {
            assert!(n(t).contains(want), "{t}");
        }
    }

    #[test]
    fn entity_named_like_a_prototype_member_stays_literal() {
        use crate::core::markup::strip_markup;
        assert_eq!(strip_markup(&js("a &constructor; b")), "a &constructor; b");
        assert_eq!(strip_markup(&js("a &amp; b")), "a & b");
    }
}
