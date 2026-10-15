//! Swedish (sv) text normalization: digit grouping, sports/clock/score colons, dotted abbreviations, the colon
//! ordinal, `NNNN-tal`, ranges, the hundreds-reading year, degrees, signs; plus the colon inflection and the
//! initialism pass. Ported from src/languages/swedish/normalize.ts — see that file for the corpus evidence and
//! the ordering.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::manifest::MANIFEST;
use super::numbers::number_to_words;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const ORD_1_19: [&str; 20] = [
    "",
    "första",
    "andra",
    "tredje",
    "fjärde",
    "femte",
    "sjätte",
    "sjunde",
    "åttonde",
    "nionde",
    "tionde",
    "elfte",
    "tolfte",
    "trettonde",
    "fjortonde",
    "femtonde",
    "sextonde",
    "sjuttonde",
    "artonde",
    "nittonde",
];

/// `ordinal(n)`: 1 … 100, or `None`.
pub(crate) fn ordinal(n: f64) -> Option<JsString> {
    if n < 1.0 || !(n.is_finite() && n.trunc() == n) {
        return None;
    }
    if n < 20.0 {
        return Some(js(ORD_1_19[n as usize]));
    }
    if n == 100.0 {
        return Some(js(&format!("{}de", MANIFEST.numbers.hundred)));
    }
    if n > 99.0 {
        return None;
    }
    let tens = &MANIFEST.numbers.tens[(n / 10.0).floor() as usize];
    let unit = (n % 10.0) as usize;
    Some(js(&if unit == 0 {
        format!("{tens}nde")
    } else {
        format!("{tens}{}", ORD_1_19[unit])
    }))
}

/// `hundredsYear(n)`: the hundreds reading as one compound word, for 100 … 1999; `None` otherwise.
pub(crate) fn hundreds_year(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.trunc() == n) {
        return None;
    }
    if (100.0..1000.0).contains(&n) {
        return Some(number_to_words(n, None));
    }
    let rest = n % 100.0;
    let tail = if rest != 0.0 {
        number_to_words(rest, None)
    } else {
        JsString::new()
    };
    if (1000.0..1100.0).contains(&n) {
        return Some(js(&MANIFEST.numbers.thousand).concat(&tail));
    }
    if (1100.0..2000.0).contains(&n) {
        return Some(
            number_to_words((n / 100.0).floor(), None)
                .concat(&js(&MANIFEST.numbers.hundred))
                .concat(&tail),
        );
    }
    None
}

/// `centuryYear(n)`: the stem of a `-tal` compound — `hundredsYear`, extended to 2000 … 9999 (#1526). The
/// N000–N099 block takes the thousands word (2000 → tvåtusen, 2010 → tvåtusentio); above it the hundreds
/// reading resumes (2100 → tjugoetthundra).
pub(crate) fn century_year(n: f64) -> Option<JsString> {
    let below = hundreds_year(n);
    if below.is_some() || !(n.is_finite() && n.trunc() == n) || n < 2000.0 || n >= 10000.0 {
        return below;
    }
    let rest = n % 100.0;
    let tail = if rest != 0.0 {
        number_to_words(rest, None)
    } else {
        JsString::new()
    };
    if n % 1000.0 < 100.0 {
        return Some(number_to_words(n - rest, None).concat(&tail));
    }
    Some(
        number_to_words((n / 100.0).floor(), None)
            .concat(&js(&MANIFEST.numbers.hundred))
            .concat(&tail),
    )
}

/// `ABBREV`: (pattern, expansion, keepFinal = terminal).
static ABBREV: LazyLock<Vec<(JsRegex, &'static str, bool)>> = LazyLock::new(|| {
    let r = |p: &str, f: &str| JsRegex::new(p, f).unwrap();
    vec![
        (
            r(r"(?<![\p{L}\p{M}])f\.v\.t\.", "giu"),
            "före vår tidräkning",
            true,
        ),
        (
            r(r"(?<![\p{L}\p{M}])t\.o\.m\.", "giu"),
            "till och med",
            false,
        ),
        (
            r(r"(?<![\p{L}\p{M}])f\.\s?Kr\.", "giu"),
            "före Kristus",
            true,
        ),
        (
            r(r"(?<![\p{L}\p{M}])e\.\s?Kr\.", "giu"),
            "efter Kristus",
            true,
        ),
        (
            r(r"(?<![\p{L}\p{M}])t\.\s?ex\.", "giu"),
            "till exempel",
            false,
        ),
        (r(r"(?<![\p{L}\p{M}])s\.\s?k\.", "giu"), "så kallad", false),
        (
            r(r"(?<![\p{L}\p{M}])dvs(?![\p{L}\p{M}])\.?", "giu"),
            "det vill säga",
            false,
        ),
        (
            r(r"(?<![\p{L}\p{M}])osv(?![\p{L}\p{M}])\.?", "giu"),
            "och så vidare",
            true,
        ),
        (r(r"(?<![\p{L}\p{M}])etc\.", "giu"), "etcetera", true),
        (
            r(r"(?<![\p{L}\p{M}])fvt(?![\p{L}\p{M}])", "gu"),
            "före vår tidräkning",
            false,
        ),
        (r(r"(?<![\p{L}\p{M}])kl\.\s*", "giu"), "klockan ", false),
        (r(r"(?<![\p{L}\p{M}])Jr\.", "gu"), "junior", false),
        (
            r(r"(?<![\p{L}\p{M}])St\.(?=\s+\p{Lu})", "gu"),
            "Sankt",
            false,
        ),
    ]
});

static RELATIONAL: LazyLock<Vec<(JsRegex, &'static str)>> = LazyLock::new(|| {
    let r = |p: &str| JsRegex::new(p, "gu").unwrap();
    vec![
        (r("±"), " plus minus "),
        (r("≈"), " cirka lika med "),
        (r("≤"), " mindre än eller lika med "),
        (r("≥"), " större än eller lika med "),
        (r("="), " lika med "),
        (r("<"), " mindre än "),
        (r(">"), " större än "),
        (r("×"), " gånger "),
        (r("÷"), " delat med "),
    ]
});

const LETTER_NAMES: [(&str, &str); 29] = [
    ("a", "a"),
    ("b", "be"),
    ("c", "se"),
    ("d", "de"),
    ("e", "e"),
    ("f", "eff"),
    ("g", "gé"),
    ("h", "hå"),
    ("i", "i"),
    ("j", "ji"),
    ("k", "kå"),
    ("l", "ell"),
    ("m", "emm"),
    ("n", "enn"),
    ("o", "o"),
    ("p", "pe"),
    ("q", "ku"),
    ("r", "err"),
    ("s", "ess"),
    ("t", "te"),
    ("u", "u"),
    ("v", "ve"),
    ("w", "dubbel ve"),
    ("x", "eks"),
    ("y", "y"),
    ("z", "säta"),
    ("å", "å"),
    ("ä", "ä"),
    ("ö", "ö"),
];

/// `LETTER_NAME[l]`: `l` is one lowercased code point, which no `Object.prototype` member is.
fn letter_name(l: &JsString) -> Option<JsString> {
    LETTER_NAMES
        .iter()
        .find(|(k, _)| l == *k)
        .map(|(_, v)| js(v))
}

type WordTest = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

static IS_UNREADABLE: LazyLock<WordTest> = LazyLock::new(|| {
    let set = |xs: &[&str]| xs.iter().map(|x| js(x)).collect::<Vec<_>>();
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new("[aeiouyåäöé]", "u").unwrap(),
        legal_onsets: set(&[
            "bj", "bl", "br", "dj", "dr", "dv", "fj", "fl", "fr", "gj", "gl", "gn", "gr", "hj",
            "kj", "kl", "kn", "kr", "kv", "lj", "mj", "nj", "pl", "pr", "ps", "sc", "sf", "sj",
            "sk", "sl", "sm", "sn", "sp", "st", "sv", "tj", "tr", "tv", "vr",
        ]),
        legal_codas: set(&[
            "bb", "ck", "dd", "ff", "ft", "gg", "gn", "ht", "kk", "ks", "kt", "ld", "lf", "lg",
            "lk", "ll", "lm", "lp", "ls", "lt", "lv", "mm", "mp", "ms", "mt", "nd", "ng", "nk",
            "nn", "ns", "nt", "pp", "ps", "pt", "rd", "rg", "rk", "rl", "rm", "rn", "rp", "rr",
            "rs", "rt", "rv", "sk", "sp", "ss", "st", "tt", "ts", "gt", "bt", "mn", "vs", "sm",
            "ln", "ds", "gs", "lj", "ch", "vt",
        ]),
        liquids: None,
        digraphs: Some(set(&[
            "sj", "sk", "stj", "skj", "tj", "kj", "ng", "ch", "sh", "rs",
        ])),
    }))
});

static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| ["usa", "os", "ai", "usoc"].iter().map(|w| js(w)).collect());

/// `isUnreadableSwedish(word)`.
pub(crate) fn is_unreadable_swedish(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

/// `normalizeSwedishInitialisms(text)`: the colon inflection first, then the shared pass.
pub(crate) fn normalize_swedish_initialisms(text: &JsString) -> JsString {
    let letter: LetterName = Arc::new(letter_name);
    make_initialism_normalizer(
        InitialismData {
            letter_name: letter,
            lower: None,
            acronym_letters: Arc::new(|w: &JsString| ACRONYM_LETTERS.contains(w)),
            is_recorded: |_: &JsString| false,
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(&resolve_colon_inflection(text))
}

/// `resolveColonInflection(text)`.
fn resolve_colon_inflection(text: &JsString) -> JsString {
    rewrite_with(
        text,
        js_re!(
            r"(?<![\p{L}\p{M}])(\p{L}[\p{L}\p{M}]*):(s|n)(?![\p{L}\p{M}])",
            "gu"
        ),
        |m, s| {
            let head = m.group(1, s).unwrap();
            let suf = m.group(2, s).unwrap();
            let glued = head.concat(&suf);
            if !js_re!(r"^\p{Lu}{2,}$", "u").test(&head) {
                return glued;
            }
            let lower = head.to_lower_case();
            if !ACRONYM_LETTERS.contains(&lower) && !is_unreadable_swedish(&lower) {
                return glued;
            }
            let names: Option<Vec<JsString>> =
                lower.code_point_strings().iter().map(letter_name).collect();
            match names {
                Some(n) => JsString::join(&n, &js(" ")).concat(&suf),
                None => glued,
            }
        },
    )
}

/// `minutes(mm)`: `00` is spoken as two zeros.
fn minutes(mm: &JsString) -> JsString {
    if *mm == "00" { js("0 0") } else { mm.clone() }
}

/// `isClock(h, mm)`.
fn is_clock(h: &JsString, mm: &JsString) -> bool {
    js_number(h) < 24.0 && js_number(mm) < 60.0
}

/// `normalizeSwedish(input)`.
pub(crate) fn normalize_swedish(input: &JsString) -> JsString {
    let mut t = input.clone();

    // 1) space-grouped thousands, to a fixed point.
    loop {
        let prev = t.clone();
        t = rewrite(
            &t,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)[    ](?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
        if t == prev {
            break;
        }
    }

    // 2) English comma grouping, to a fixed point.
    loop {
        let prev = t.clone();
        t = rewrite(
            &t,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)[,](?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
        if t == prev {
            break;
        }
    }

    // 3) sports / duration time.
    t = rewrite(
        &t,
        js_re!(r"(?<![\d:,])(\d{1,2}):(\d{2})[.,](\d{1,2})(?!\d)", "gu"),
        &js("$1 $2,$3"),
    );

    // 4) clock, period form: the range first, then a single time.
    t = rewrite_with(
        &t,
        js_re!(
            r"(?<![\d:,])(?<!\.\d)(\d{1,2})\.(\d{2})\s*[-–—]\s*(\d{1,2})\.(\d{2})(?!\d)",
            "gu"
        ),
        |m, s| {
            let g = |i| m.group(i, s).unwrap();
            let (h1, m1, h2, m2) = (g(1), g(2), g(3), g(4));
            if is_clock(&h1, &m1) && is_clock(&h2, &m2) {
                h1.concat(&js(" "))
                    .concat(&minutes(&m1))
                    .concat(&js(" till "))
                    .concat(&h2)
                    .concat(&js(" "))
                    .concat(&minutes(&m2))
            } else {
                m.value(s)
            }
        },
    );
    t = rewrite_with(
        &t,
        js_re!(
            r"(?<![\d:,])(?<!\.\d)(\d{1,2})\.(\d{2})(?!\d)(?!\.\d)",
            "gu"
        ),
        clock,
    );

    // 5) clock, colon form.
    t = rewrite_with(
        &t,
        js_re!(r"(?<![\d:,])(\d{1,2}):(\d{2})(?!\d|,\d)(?!\.\d)", "gu"),
        clock,
    );

    // 6) score.
    t = rewrite(
        &t,
        js_re!(r"(?<![\d:.,])(\d{1,2}):(\d{1,2})(?![\d\p{L}])", "gu"),
        &js("$1 $2"),
    );

    // 7) dotted abbreviations; a terminal one keeps its dot where it is also the sentence period.
    for (re, word, keep_final) in ABBREV.iter() {
        t = rewrite_with(&t, re, |m, whole| {
            let v = m.value(whole);
            if !keep_final || !v.ends_with(&js(".")) {
                return js(word);
            }
            let after = js_re!(r#"^["”'’)\]]+"#, "u").replace(
                &whole.slice((m.index() + v.len()) as isize, None),
                &JsString::new(),
            );
            if after.trim().is_empty() || js_re!(r#"^\s+["“(]?\p{Lu}"#, "u").test(&after) {
                js(word).concat(&js("."))
            } else {
                js(word)
            }
        });
    }

    // 8) ordinal colon and the two other suffixes.
    t = rewrite_with(
        &t,
        js_re!(r"(?<![\d:.,])(\d{1,3}):(a|e|s|or)(?![\p{L}\p{M}])", "gu"),
        |m, s| {
            let n = m.group(1, s).unwrap();
            let suf = m.group(2, s).unwrap();
            if suf == "or" {
                return number_to_words(js_number(&n), Some(&n)).concat(&js("or"));
            }
            match ordinal(js_number(&n)) {
                None => m.value(s),
                Some(o) if suf == "s" => o.concat(&js("s")),
                Some(o) => o,
            }
        },
    );

    // 9) century / decade: the range first, then a single `NNNN-tal…`.
    t = rewrite_with(
        &t,
        js_re!(r"(?<![\d.,:])(\d{3,4})-(\d{3,4})-(tal\p{L}*)", "gu"),
        |m, s| {
            let g = |i| m.group(i, s).unwrap();
            match (
                century_year(js_number(&g(1))),
                century_year(js_number(&g(2))),
            ) {
                (Some(a), Some(b)) => a.concat(&js(" till ")).concat(&b).concat(&g(3)),
                _ => m.value(s),
            }
        },
    );
    t = rewrite_with(
        &t,
        js_re!(r"(?<![\d.,:])(\d{3,4})-(tal\p{L}*)", "gu"),
        |m, s| match century_year(js_number(&m.group(1, s).unwrap())) {
            None => m.value(s),
            Some(w) => w.concat(&m.group(2, s).unwrap()),
        },
    );

    // 10) ranges.
    t = rewrite(
        &t,
        js_re!(
            r"(?<![-–—\d])(\d[\d,]*\d|\d)\s*[-–—]\s*(\d[\d,]*\d|\d)(?![\d\-–—.,])",
            "gu"
        ),
        &js("$1 till $2"),
    );

    // 11) bare four-digit 1100–1999 → the hundreds reading, unless a tier-claimed unit follows.
    t = rewrite_with(
        &t,
        js_re!(
            r"(?<![\d.,:\p{L}])(1[1-9]\d\d)(?![\d,:])(?!\.\d)(?!\p{L})(?!\s*(?:%|[$€£°²³]|(?:km|cm|mm|kg|[Gg][Hh][Zz]|[Mm][Bb][Ii][Tt]|m)(?![\p{L}\p{M}])))",
            "gu"
        ),
        |m, s| hundreds_year(js_number(&m.group(1, s).unwrap())).unwrap_or_else(|| m.value(s)),
    );

    // 12) degrees.
    t = rewrite(
        &rewrite(&t, js_re!("℃", "gu"), &js("°C")),
        js_re!("℉", "gu"),
        &js("°F"),
    );
    t = rewrite(
        &t,
        js_re!(r"(\d)\s*°\s*C(?![\p{L}\p{M}])", "gui"),
        &js("$1 grader celsius"),
    );
    t = rewrite(
        &t,
        js_re!(r"(\d)\s*°\s*F(?![\p{L}\p{M}])", "gui"),
        &js("$1 grader fahrenheit"),
    );
    t = rewrite(
        &t,
        js_re!(r"(\d)\s*°\s*V(?![\p{L}\p{M}])", "gu"),
        &js("$1 grader väst"),
    );
    t = rewrite(&t, js_re!(r"(\d)\s*°", "gu"), &js("$1 grader"));

    // 13) `x` as multiplication.
    t = rewrite(
        &t,
        js_re!(r"(?<=[\d\p{L}])\s+x\s+(?=\d)", "gu"),
        &js(" gånger "),
    );

    // 14) signed numbers.
    t = rewrite_with(
        &t,
        js_re!(r"(?<![\p{L}\p{M}\d])([-−+])(\d)", "gu"),
        |m, s| {
            let sign = m.group(1, s).unwrap();
            js(if sign == "+" { "plus " } else { "minus " }).concat(&m.group(2, s).unwrap())
        },
    );
    t = rewrite(
        &t,
        js_re!(r"(?<=[\p{L}\p{M}])\+(?=\d)", "gu"),
        &js(" plus "),
    );
    t = rewrite(&t, js_re!(r"(\d)\s*\+\s*(\d)", "gu"), &js("$1 plus $2"));

    // 15) relational and operator signs.
    for (re, word) in RELATIONAL.iter() {
        t = rewrite(&t, re, &js(word));
    }

    // 16) ampersand.
    t = rewrite(&t, js_re!(r"\s*[&＆]\s*", "gu"), &js(" och "));

    rewrite(&t, js_re!(r"[ \t]{2,}", "gu"), &js(" "))
}

/// The single-clock callback (steps 4 and 5): `isClock(h, mm) ? `${h} ${minutes(mm)}` : m`.
fn clock(m: &crate::core::js_regex::JsMatch, s: &JsString) -> JsString {
    let (h, mm) = (m.group(1, s).unwrap(), m.group(2, s).unwrap());
    if is_clock(&h, &mm) {
        h.concat(&js(" ")).concat(&minutes(&mm))
    } else {
        m.value(s)
    }
}
