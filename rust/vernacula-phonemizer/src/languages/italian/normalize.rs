//! Italian text normalization: de-grouping, era markers, abbreviations, the three senses of the degree
//! sign, ordinal indicators, the clock, signs, fractions, preposed currency, and the decimal comma (last).
//! Ported from src/languages/italian/normalize.ts — see that file for the corpus evidence and the ordering.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, LazyLock};

use crate::core::boundaries::NOT_LETTER_BEFORE;
use crate::core::initialisms::{InitialismData, PhonotacticsData, make_initialism_normalizer, make_unreadable_test};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::core::roman::roman_to_int;
use crate::js_re;

use super::manifest::MANIFEST;
use super::roman_ordinals::italian_ordinal;

/// `DOTTED_ABBREV`, keyed for the callback's `ab.toLowerCase()` lookup (a miss is reachable, #1122).
static DOTTED_ABBREV: LazyLock<HashMap<JsString, JsString>> =
    LazyLock::new(|| MANIFEST.dotted_abbrev.iter().map(|(k, v)| (js(k), js(v))).collect());

/// Longest key first; the sort is stable, so equal lengths keep the manifest's order.
static ABBREV_ALT: LazyLock<String> = LazyLock::new(|| {
    let mut keys: Vec<&String> = MANIFEST.dotted_abbrev.keys().collect();
    keys.sort_by(|a, b| js(b).len().cmp(&js(a).len()));
    keys.iter().map(|k| k.as_str()).collect::<Vec<_>>().join("|")
});

type Pred = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

pub static IS_UNREADABLE_ITALIAN: LazyLock<Pred> = LazyLock::new(|| {
    let p = &MANIFEST.phonotactics;
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(&format!("[{}]", p.vowels), "u").unwrap(),
        legal_onsets: p.onsets.iter().map(|s| js(s)).collect(),
        legal_codas: p.codas.iter().map(|s| js(s)).collect(),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableItalian`.
pub fn is_unreadable_italian(w: &JsString) -> bool {
    IS_UNREADABLE_ITALIAN(w)
}

fn is_roman_numeral(lower: &JsString) -> bool {
    lower.len() >= 2 && roman_to_int(lower).is_some()
}

type Normalizer = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;

static INITIALISMS: LazyLock<Normalizer> = LazyLock::new(|| {
    let names: HashMap<JsString, JsString> =
        MANIFEST.letter_names.iter().map(|(k, v)| (js(k), js(v))).collect();
    let acronyms: HashSet<JsString> = MANIFEST.acronym_letters.iter().map(|s| js(s)).collect();
    let unreadable = IS_UNREADABLE_ITALIAN.clone();
    Box::new(make_initialism_normalizer(
        InitialismData {
            letter_name: Arc::new(move |l| names.get(l).cloned()),
            lower: None,
            acronym_letters: Arc::new(move |l| acronyms.contains(l)),
            is_recorded: is_roman_numeral as fn(&JsString) -> bool,
            is_unreadable: Arc::new(move |w| unreadable(w)),
        },
        true,
    ))
});

pub fn normalize_italian_initialisms(text: &JsString) -> JsString {
    INITIALISMS(text)
}

fn ordinal(n: f64) -> Option<JsString> {
    italian_ordinal(n)
}

fn feminine(masc: &JsString) -> JsString {
    js_re!("o$", "u").replace(masc, &js("a"))
}

/// `String(num)` for an integer below 1000.
fn int_str(n: f64) -> String {
    format!("{}", n as u64)
}

fn fraction_words(num: f64, den: f64) -> Option<JsString> {
    if den < 2.0 || num < 1.0 {
        return None;
    }
    let base = match MANIFEST.fractions.denominators.get(&int_str(den)) {
        Some(b) => js(b),
        None => ordinal(den)?,
    };
    let head = if num == 1.0 { js(&MANIFEST.apocopated_one) } else { js(&int_str(num)) };
    let noun = if num > 1.0 { js_re!("o$", "u").replace(&base, &js("i")) } else { base };
    Some(head.concat(&js(" ")).concat(&noun))
}

fn degrees(n: &JsString) -> JsString {
    let first_comma = js_re!(",", "").replace(n, &js("."));
    if js_number(&first_comma) == 1.0 {
        js(&format!("{} {}", MANIFEST.apocopated_one, MANIFEST.degree.singular))
    } else {
        n.concat(&js(&format!(" {}", MANIFEST.degree.plural)))
    }
}

static CURRENCY_WORD: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"^\s*(?:di\s+)?(?:{})", MANIFEST.symbol_tier.currency_stems.join("|")),
        "iu",
    )
    .unwrap()
});

/// `CURRENCY` (normalize.ts's own table, not the manifest's): singular, plural.
pub const CURRENCY: [(&str, [&str; 2]); 4] = [
    ("€", ["euro", "euro"]),
    ("$", ["dollaro", "dollari"]),
    ("£", ["sterlina", "sterline"]),
    ("¥", ["yen", "yen"]),
];

static ERA_BC: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"{NOT_LETTER_BEFORE}a\.\s?C\."), "gu").unwrap());
static ERA_AD: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"{NOT_LETTER_BEFORE}d\.\s?C\."), "gu").unwrap());
static NUMERO: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!(r"{NOT_LETTER_BEFORE}(?:n\.º|n\.|nr\.|nº)\s?(?=\d)"), "giu").unwrap()
});
static ABBREV_CONT: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!(r"{NOT_LETTER_BEFORE}({})\.(\s+)(?=[\p{{L}}\p{{N}}])", *ABBREV_ALT), "giu").unwrap()
});
static ABBREV_END: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!(r"{NOT_LETTER_BEFORE}({})\.(?=\s*(?:[.,;:!?»)\]]|$))", *ABBREV_ALT), "giu").unwrap()
});

/// Normalize one Italian input string (before the shared symbol tier; the decimal comma is separate).
pub fn normalize_italian(input: &JsString) -> JsString {
    let m = &*MANIFEST;
    let sign = &m.sign_words;
    let mut s = input.clone();

    // 1) digit de-grouping, twice.
    s = rewrite(&s, js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)\.(?=\d{3}(?!\d))", "gu"), &JsString::new());
    s = rewrite(&s, js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)\.(?=\d{3}(?!\d))", "gu"), &JsString::new());

    // 2) era markers.
    s = rewrite(&s, &ERA_BC, &js(&m.era_markers.before_christ));
    s = rewrite(&s, &ERA_AD, &js(&m.era_markers.after_christ));

    // 3) numero, before a digit only.
    s = rewrite(&s, &NUMERO, &js(&format!("{} ", m.number_sign)));

    // 4) dotted abbreviations.
    s = rewrite_with(&s, &ABBREV_CONT, |mt, s| {
        let ab = mt.group(1, s).unwrap();
        let sp = mt.group(2, s).unwrap();
        match DOTTED_ABBREV.get(&ab.to_lower_case()) {
            None => mt.value(s),
            Some(w) => w.concat(&sp),
        }
    });
    s = rewrite_with(&s, &ABBREV_END, |mt, s| {
        let ab = mt.group(1, s).unwrap();
        match DOTTED_ABBREV.get(&ab.to_lower_case()) {
            None => mt.value(s),
            Some(w) => w.concat(&js(".")),
        }
    });

    // 5) the degree sign: temperature, then coordinate.
    s = rewrite_with(&s, js_re!(r"(\d+(?:[.,]\d+)?)\s?°\s?C(?![\p{L}\p{M}])", "gui"), |mt, s| {
        degrees(&mt.group(1, s).unwrap()).concat(&js(&format!(" {}", m.degree.celsius)))
    });
    s = rewrite_with(&s, js_re!(r"(\d+(?:[.,]\d+)?)\s?°\s?F(?![\p{L}\p{M}])", "gui"), |mt, s| {
        degrees(&mt.group(1, s).unwrap()).concat(&js(&format!(" {}", m.degree.fahrenheit)))
    });
    s = rewrite_with(
        &s,
        js_re!(r"(\d+(?:[.,]\d+)?)\s?°(?:([nsewNSEW])|\s+([NSEW]))(?![\p{L}\p{M}])", "gu"),
        |mt, s| {
            let letter = mt.group(2, s).or_else(|| mt.group(3, s)).unwrap();
            let point = &m.compass[&letter.to_lower_case().to_string_lossy()];
            degrees(&mt.group(1, s).unwrap()).concat(&js(&format!(" {point}")))
        },
    );

    // 6) ordinal indicators.
    s = rewrite_with(&s, js_re!(r"(\d+)\.?(?:º|ª|°)", "gu"), |mt, s| {
        let whole = mt.value(s);
        let Some(masc) = ordinal(js_number(&mt.group(1, s).unwrap())) else {
            return whole;
        };
        if js_re!("ª", "u").test(&whole) { feminine(&masc) } else { masc }
    });

    // 7) the clock: colon, then period after an hour cue.
    s = rewrite_with(&s, js_re!(r"(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])", "gu"), |mt, s| {
        let (h, min) = (mt.group(1, s).unwrap(), mt.group(2, s).unwrap());
        if js_number(&min) == 0.0 { h } else { h.concat(&js(" e ")).concat(&min) }
    });
    s = rewrite_with(
        &s,
        js_re!(r"((?:all[e'’]|alle ore|ore|dalle|verso le|le)\s?)([01]?\d|2[0-3])\.([0-5]\d)(?![\d.])", "giu"),
        |mt, s| {
            let (cue, h, min) = (mt.group(1, s).unwrap(), mt.group(2, s).unwrap(), mt.group(3, s).unwrap());
            let time = if js_number(&min) == 0.0 { h } else { h.concat(&js(" e ")).concat(&min) };
            cue.concat(&time)
        },
    );

    // 8) signs.
    s = rewrite(&s, js_re!("±", "gu"), &js(&format!(" {} ", sign.plus_minus)));
    s = rewrite(&s, js_re!(r"(\S)\+\s?(\d)", "gu"), &js(&format!("$1 {} $2", sign.plus)));
    s = rewrite(&s, js_re!(r"(^|\s)\+\s?(\d)", "gu"), &js(&format!("$1{} $2", sign.plus)));
    s = rewrite(&s, js_re!(r"(^|[\s(])[-−–](\d)", "gu"), &js(&format!("$1{} $2", sign.minus)));

    // 8b) relational and division signs.
    s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(&format!(" {} ", sign.equals)));
    s = rewrite(&s, js_re!(r"\s?<\s?", "gu"), &js(&format!(" {} ", sign.less_than)));
    s = rewrite(&s, js_re!(r"\s?>\s?", "gu"), &js(&format!(" {} ", sign.greater_than)));
    s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(&format!(" {} ", sign.divided_by)));

    // 9) fractions.
    s = rewrite_with(&s, js_re!(r"(?<!\d)(\d{1,3})\/(\d{1,3})(?![\d/])", "gu"), |mt, s| {
        fraction_words(js_number(&mt.group(1, s).unwrap()), js_number(&mt.group(2, s).unwrap()))
            .unwrap_or_else(|| mt.value(s))
    });

    // 9b) the plus as a word-joiner.
    s = rewrite(&s, js_re!(r"(?<=[\p{L}\p{M}])\+(?=[\p{L}\p{M}])", "gu"), &js(&format!(" {} ", sign.plus)));

    // 10) currency written before the amount.
    s = rewrite_with(
        &s,
        js_re!(r"([€$£¥])\s?(\d[\d.,]*)(\s+(?:miliardi|miliardo|milioni|milione|mila))?", "gu"),
        |mt, whole| {
            let sign = mt.group(1, whole).unwrap();
            let num = mt.group(2, whole).unwrap();
            let mag = mt.group(3, whole);
            let after = whole.slice(mt.end() as isize, None);
            let mag_s = mag.clone().unwrap_or_default();
            if CURRENCY_WORD.test(&after) {
                return num.concat(&mag_s);
            }
            let forms = CURRENCY.iter().find(|(k, _)| sign == js(k)).unwrap().1;
            let plural = mag.is_some()
                || js_number(&js_re!("[.,]", "gu").replace(&num, &JsString::new())) != 1.0;
            let word = if plural { forms[1] } else { forms[0] };
            let tail = if js_re!(r"^[\p{L}\p{M}]", "u").test(&after) { " " } else { "" };
            let di = if mag.is_none() { "" } else { "di " };
            num.concat(&mag_s).concat(&js(&format!(" {di}{word}{tail}")))
        },
    );

    s
}

/// The decimal comma, applied AFTER the symbol tier (italian.ts's order).
pub fn normalize_italian_decimals(input: &JsString) -> JsString {
    rewrite(input, js_re!(r"(\d),(\d)", "gu"), &js(&format!("$1 {} $2", MANIFEST.decimal_word)))
}
