//! Portuguese (pt / pt-BR) text normalization: digit grouping, era markers, número, dotted abbreviations,
//! ordinal indicators, R$ and the dollar codes, degrees, clock, signs, fractions and the BP first-of-month,
//! plus the separately-run initialism pass. Ported from src/languages/portuguese/normalize.ts — see that file
//! for the corpus evidence and the reason for every rule's position in the order.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::g2p::Dialect;
use super::manifest::MANIFEST;
use super::numbers::number_to_words;
use super::roman_ordinals::portuguese_ordinal;
use crate::core::initialisms::{InitialismData, PhonotacticsData, make_initialism_normalizer, make_unreadable_test};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const GROUP_SPACE: &str = " \u{a0}\u{202f}\u{2009}";

fn g(m: &JsMatch, i: usize, s: &JsString) -> JsString {
    m.group(i, s).expect("participating group")
}

fn degree_word(n: &JsString) -> &'static str {
    // `n.replace(",", ".")`: the first comma only.
    let mut t = n.clone();
    if let Some(i) = t.index_of(&js(","), 0) {
        t.0[i] = '.' as u16;
    }
    let d = &MANIFEST.degree;
    if js_number(&t) == 1.0 { &d.singular } else { &d.plural }
}

/// `Object.keys(t).sort((a, b) => b.length - a.length).join("|")`: STABLE, equal lengths keep table order.
fn abbrev_alt() -> String {
    let mut v: Vec<&str> = MANIFEST.dotted_abbrev.keys().map(String::as_str).collect();
    v.sort_by_key(|k| std::cmp::Reverse(k.encode_utf16().count()));
    v.join("|")
}

struct Res {
    group_space: JsRegex,
    abbrev_continue: JsRegex,
    abbrev_end: JsRegex,
    dollar_codes: JsRegex,
    date_first: JsRegex,
    feminine_one: JsRegex,
}

static R: LazyLock<Res> = LazyLock::new(|| {
    let m = &*MANIFEST;
    let alt = abbrev_alt();
    Res {
        group_space: JsRegex::new(&format!(r"(?<=\d)(?<!(?<![\d\.,])0)[{GROUP_SPACE}](?=\d{{3}}(?!\d))"), "gu").unwrap(),
        abbrev_continue: JsRegex::new(&format!(r"\b({alt})\.(\s+)(?=\p{{L}})"), "giu").unwrap(),
        abbrev_end: JsRegex::new(&format!(r"\b({alt})\.(?=\s*(?:[.,;:!?»)]|$))"), "giu").unwrap(),
        dollar_codes: JsRegex::new(
            &format!("(?<![\\p{{L}}\\p{{M}}])(?:{})\\$(?=[ \u{a0}]?\\d)", m.dollar_codes.join("|")),
            "gu",
        )
        .unwrap(),
        date_first: JsRegex::new(&format!(r"\b1\s+de\s+({})\b", m.months.join("|")), "giu").unwrap(),
        feminine_one: JsRegex::new(&format!("{}$", m.numbers.small[1]), "u").unwrap(),
    }
});

/// `isUnreadablePortuguese`: the OOV rule for core/initialisms.ts.
pub static IS_UNREADABLE_PORTUGUESE: LazyLock<Arc<dyn Fn(&JsString) -> bool + Send + Sync>> = LazyLock::new(|| {
    let p = &MANIFEST.phonotactics;
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(&format!("[{}]", p.vowels), "u").unwrap(),
        legal_onsets: p.onsets.iter().map(|s| js(s)).collect(),
        legal_codas: p.codas.iter().map(|s| js(s)).collect(),
        liquids: None,
        digraphs: None,
    }))
});

type Normalizer = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;

static INITIALISMS: LazyLock<Normalizer> = LazyLock::new(|| {
    let acronyms: HashSet<JsString> = MANIFEST.acronym_letters.iter().map(|s| js(s)).collect();
    let unreadable = IS_UNREADABLE_PORTUGUESE.clone();
    Box::new(make_initialism_normalizer(
        InitialismData {
            letter_name: Arc::new(|l: &JsString| MANIFEST.letter_names.get(&l.to_string_lossy()).map(|s| js(s))),
            lower: None,
            acronym_letters: Arc::new(move |w: &JsString| acronyms.contains(w)),
            is_recorded: |_: &JsString| false,
            is_unreadable: Arc::new(move |w: &JsString| unreadable(w)),
        },
        true,
    ))
});

/// `normalizePortugueseInitialisms(text)`: no lexicon serves as the "is this recorded" test.
pub fn normalize_portuguese_initialisms(text: &JsString) -> JsString {
    INITIALISMS(text)
}

fn feminine_ordinal(masc: &JsString) -> JsString {
    let parts: Vec<JsString> =
        masc.split(&js(" ")).iter().map(|w| js_re!("o$", "u").replace(w, &js("a"))).collect();
    JsString::join(&parts, &js(" "))
}

fn feminine_cardinal(n: f64) -> JsString {
    // ⚠ The TS passes no dialect, so this is the EUROPEAN reading in pt-BR too (dezasseis horas).
    R.feminine_one.replace(&number_to_words(n, Dialect::Ep, None), &js(&MANIFEST.feminine_one))
}

/// `String(den)` for an integer `den` (always 0 … 999 here).
fn int_string(n: f64) -> String {
    format!("{}", n as i64)
}

fn fraction_words(num: f64, den: f64) -> Option<JsString> {
    if den < 2.0 || num < 1.0 {
        return None;
    }
    let base = match MANIFEST.fractions.denominators.get(&int_string(den)) {
        Some(b) => js(b),
        None => portuguese_ordinal(den)?,
    };
    let mut out = number_to_words(num, Dialect::Ep, None);
    out.push_str(&js(" "));
    out.push_str(&base);
    if num > 1.0 {
        out.push_str(&js("s"));
    }
    Some(out)
}

fn clock_words(h: f64, min: Option<f64>) -> JsString {
    let c = &MANIFEST.clock;
    let mut head = feminine_cardinal(h);
    head.push_str(&js(&format!(" {}", if h == 1.0 { &c.hour } else { &c.hours })));
    match min {
        None => head,
        Some(m) if m == 0.0 => head,
        Some(m) => {
            head.push_str(&js(&format!(" {} ", c.connector)));
            head.push_str(&feminine_cardinal(m));
            head
        }
    }
}

/// `normalizePortuguese(input, brazilian)`.
pub fn normalize_portuguese(input: &JsString, brazilian: bool) -> JsString {
    let m = &*MANIFEST;
    let sign = &m.sign_words;
    let deg = &m.degree;
    let mut s = input.clone();

    // 0) Digit grouping with a space (twice, as the TS does).
    s = rewrite(&s, &R.group_space, &JsString::new());
    s = rewrite(&s, &R.group_space, &JsString::new());
    s = rewrite(&s, js_re!(r"[ \u00a0\u202f\u2009]", "gu"), &js(" "));

    // 1) Era markers.
    s = rewrite(&s, js_re!(r"\ba\.\s?C\.", "giu"), &js(&m.era_markers.before_christ));
    s = rewrite(&s, js_re!(r"\bd\.\s?C\.", "giu"), &js(&m.era_markers.after_christ));

    // 2) Número, only before a digit.
    s = rewrite(&s, js_re!(r"\b(?:n\.º|nº|n°|no|núm\.)\s?(?=\d)", "giu"), &js(&format!("{} ", m.number_sign)));

    // 3) Dotted abbreviations. ⚠ The miss branch is reachable (#1122): the `i`+`u` fold widens the
    //    alternation past the table's keys.
    s = rewrite_with(&s, &R.abbrev_continue, |mm, s| {
        let (ab, sp) = (g(mm, 1, s), g(mm, 2, s));
        match m.dotted_abbrev.get(&ab.to_lower_case().to_string_lossy()) {
            None => mm.value(s),
            Some(w) => js(w).concat(&sp),
        }
    });
    s = rewrite_with(&s, &R.abbrev_end, |mm, s| {
        let ab = g(mm, 1, s);
        match m.dotted_abbrev.get(&ab.to_lower_case().to_string_lossy()) {
            None => mm.value(s),
            Some(w) => js(&format!("{w}.")),
        }
    });

    // 4) Ordinal indicators.
    s = rewrite_with(&s, js_re!(r"\b([1-9]\d{0,2}(?:\.\d{3})+|\d+)\.?(?:º|ª)", "gu"), |mm, s| {
        let (whole, digits) = (mm.value(s), g(mm, 1, s));
        let n = js_number(&js_re!(r"\.", "gu").replace(&digits, &JsString::new()));
        match portuguese_ordinal(n) {
            None => digits,
            Some(masc) => {
                if js_re!("ª", "u").test(&whole) {
                    feminine_ordinal(&masc)
                } else {
                    masc
                }
            }
        }
    });

    // 5) R$, and 5b) the dollar codes folded onto the bare sign.
    s = rewrite(&s, js_re!(r"R\$\s?(\d[\d.,]*)", "gu"), &js(&format!("$1 {}", m.real_word)));
    s = rewrite(&s, &R.dollar_codes, &js("$"));

    // 6) Degrees.
    s = rewrite_with(&s, js_re!(r"(\d+(?:[.,]\d+)?)\s?°\s?C(?![\p{L}\p{M}])", "giu"), |mm, s| {
        let n = g(mm, 1, s);
        n.concat(&js(&format!(" {} {}", degree_word(&n), deg.celsius)))
    });
    s = rewrite_with(&s, js_re!(r"(\d+(?:[.,]\d+)?)\s?°\s?F(?![\p{L}\p{M}])", "giu"), |mm, s| {
        let n = g(mm, 1, s);
        n.concat(&js(&format!(" {} {}", degree_word(&n), deg.fahrenheit)))
    });
    s = rewrite_with(&s, js_re!(r"(\d+(?:[.,]\d+)?)\s?°", "gu"), |mm, s| {
        let n = g(mm, 1, s);
        n.concat(&js(&format!(" {}", degree_word(&n))))
    });

    // 7) Clock.
    s = rewrite_with(&s, js_re!(r"\b([01]?\d|2[0-3])\s?h\s?([0-5]\d)?(?![\p{L}\p{M}\d])", "gu"), |mm, s| {
        clock_words(js_number(&g(mm, 1, s)), mm.group(2, s).map(|x| js_number(&x)))
    });
    s = rewrite_with(&s, js_re!(r"\b([01]?\d|2[0-3]):([0-5]\d)(?![\d:])", "gu"), |mm, s| {
        clock_words(js_number(&g(mm, 1, s)), Some(js_number(&g(mm, 2, s))))
    });

    // 8) Signs.
    s = rewrite(&s, js_re!(r"(^|[\s(])[-−–](\d)", "gu"), &js(&format!("$1{} $2", sign.minus)));
    s = rewrite(&s, js_re!("±", "gu"), &js(&format!(" {} ", sign.plus_minus)));
    s = rewrite(&s, js_re!(r"(\S)\+\s?(\d)", "gu"), &js(&format!("$1 {} $2", sign.plus)));
    s = rewrite(&s, js_re!(r"(^|\s)\+\s?(\d)", "gu"), &js(&format!("$1{} $2", sign.plus)));

    // 8b) Relational and division signs.
    s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(&format!(" {} ", sign.equals)));
    s = rewrite(&s, js_re!(r"\s?<\s?", "gu"), &js(&format!(" {} ", sign.less_than)));
    s = rewrite(&s, js_re!(r"\s?>\s?", "gu"), &js(&format!(" {} ", sign.greater_than)));
    s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(&format!(" {} ", sign.divided_by)));

    // 9) Fractions.
    s = rewrite_with(&s, js_re!(r"\b(\d{1,3})\/(\d{1,3})\b(?!\s*[/\d])", "gu"), |mm, s| {
        fraction_words(js_number(&g(mm, 1, s)), js_number(&g(mm, 2, s))).unwrap_or_else(|| mm.value(s))
    });

    // 10) Dates: the BP first of the month.
    if brazilian {
        let first = &m.ordinals.units[1];
        s = rewrite_with(&s, &R.date_first, |mm, s| js(&format!("{first} de ")).concat(&g(mm, 1, s)));
    }
    s
}
