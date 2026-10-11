//! Czech (cs) text normalization: digit grouping, era and dotted abbreviations, the clock, `N. N.` dates,
//! version dots, ordinal ranges, the case-inflected century / decade / month / place / hour ordinals, the general
//! and regnal ordinals, ranges, `mil/h`, signs, fractions and `pH`/`Ghz` rewritten into words, plus the
//! separately-run initialism pass and the Czech count-form selector.
//! Ported from src/languages/czech/normalize.ts — see that file for the corpus evidence and the ordering.

use std::cell::Cell;
use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::manifest::MANIFEST;
use super::numbers::number_to_words;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{alternation, sorted_by_length_desc};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `GROUP_SPACE`, verbatim: the regex escapes for space, NBSP, NNBSP and thin space.
const GROUP_SPACE: &str = r"    ";

/// `csCountForm(n)`: 1 → 0 (sg), …2–4 but not …12–14 → 1 (paucal), else 2 (genitive plural).
pub fn cs_count_form(n: f64) -> f64 {
    if n == 1.0 {
        return 0.0;
    }
    let m100 = n.abs() % 100.0;
    if (12.0..=14.0).contains(&m100) {
        return 2.0;
    }
    let m10 = m100 % 10.0;
    if (2.0..=4.0).contains(&m10) { 1.0 } else { 2.0 }
}

/// `counted(n, forms)`: `forms[Math.min(csCountForm(n), forms.length - 1)]`.
fn counted(n: f64, forms: &[&'static str]) -> &'static str {
    forms[(cs_count_form(n) as usize).min(forms.len() - 1)]
}

#[derive(Clone, Copy)]
enum OrdCase {
    Gen,
    Loc,
    PlGen,
    NeutNom,
    Fem,
    Dat,
}

/// `inflectOrdinal(masc, c)`: every element of the masculine-nominative ordinal takes the case ending.
fn inflect_ordinal(masc: &JsString, c: OrdCase) -> JsString {
    let idx = match c {
        OrdCase::Gen => 0,
        OrdCase::Loc => 1,
        OrdCase::PlGen => 2,
        OrdCase::NeutNom => 3,
        OrdCase::Fem => 4,
        OrdCase::Dat => 5,
    };
    let words: Vec<JsString> = masc
        .split(&js(" "))
        .into_iter()
        .map(|w| {
            if w.ends_with(&js("í")) {
                let soft = ["ího", "ím", "ích", "í", "í", "ímu"];
                return w.slice(0, Some(-1)).concat(&js(soft[idx]));
            }
            let hard = ["ého", "ém", "ých", "é", "á", "ému"];
            js_re!("ý$", "u")
                .replace(&w, &JsString::new())
                .concat(&js(hard[idx]))
        })
        .collect();
    JsString::join(&words, &js(" "))
}

/// `LETTER_NAME`, in the TS object's key order.
const LETTER_NAMES: [(&str, &str); 30] = [
    ("a", "á"),
    ("b", "bé"),
    ("c", "cé"),
    ("č", "čé"),
    ("d", "dé"),
    ("e", "é"),
    ("f", "ef"),
    ("g", "gé"),
    ("h", "há"),
    ("i", "í"),
    ("j", "jé"),
    ("k", "ká"),
    ("l", "el"),
    ("m", "em"),
    ("n", "en"),
    ("o", "ó"),
    ("p", "pé"),
    ("q", "kvé"),
    ("r", "er"),
    ("ř", "eř"),
    ("s", "es"),
    ("š", "eš"),
    ("t", "té"),
    ("u", "ú"),
    ("v", "vé"),
    ("w", "dvojité vé"),
    ("x", "iks"),
    ("y", "ypsilon"),
    ("z", "zet"),
    ("ž", "žet"),
];

const LEGAL_ONSETS: [&str; 70] = [
    "bl", "br", "bz", "čt", "čv", "čl", "čm", "čn", "čr", "dl", "dr", "dv", "gl", "gr", "gn", "kl",
    "kn", "kr", "kv", "ml", "mn", "mr", "pl", "pn", "pr", "ps", "pt", "rv", "sk", "sl", "sm", "sn",
    "sp", "st", "sv", "sw", "šk", "šl", "šm", "šn", "šp", "št", "šv", "tl", "tr", "tv", "vz", "vl",
    "vn", "vr", "zl", "zn", "zv", "žl", "žn", "js", "kd", "zd", "dn", "hr", "lz", "kt", "zh", "jd",
    "hm", "zb", "zk", "hl", "tm", "km",
];
const LEGAL_CODAS: [&str; 30] = [
    "rk", "rt", "rd", "rb", "rs", "rn", "rl", "rm", "rv", "rž", "št", "st", "sk", "zd", "zl", "zn",
    "zm", "čt", "ck", "ct", "dn", "tn", "ch", "dl", "tl", "ng", "ns", "sm", "dm", "kt",
];

type Predicate = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

/// `isUnreadableCzech`: the phonotactic test for core/initialisms.ts.
static IS_UNREADABLE: LazyLock<Predicate> = LazyLock::new(|| {
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new("[aeiouyáéíóúůýrl]", "u").unwrap(),
        legal_onsets: LEGAL_ONSETS.iter().map(|o| js(o)).collect(),
        legal_codas: LEGAL_CODAS.iter().map(|c| js(c)).collect(),
        liquids: None,
        digraphs: Some(["ch", "dž", "dz", "ct"].iter().map(|d| js(d)).collect()),
    }))
});

/// `isUnreadableCzech(word)`.
pub(crate) fn is_unreadable_czech(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.acronym_letters.iter().map(|w| js(w)).collect());

/// `(l) => LETTER_NAME[l]`: `l` is one lowercased code point, which no `Object.prototype` member's name is, so
/// an own-key lookup is the same thing.
static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| {
    Arc::new(|l: &JsString| {
        LETTER_NAMES
            .iter()
            .find(|(k, _)| js(k) == *l)
            .map(|(_, v)| js(v))
    })
});

/// `normalizeCzechInitialisms(text)`: nothing counts as recorded.
pub(crate) fn normalize_czech_initialisms(text: &JsString) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: LETTER_NAME.clone(),
            lower: None,
            acronym_letters: Arc::new(|w: &JsString| ACRONYM_LETTERS.contains(w)),
            is_recorded: |_: &JsString| false,
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(text)
}

/// `MULTI_DOT`, claimed first.
static MULTI_DOT: LazyLock<[(JsRegex, &str); 2]> = LazyLock::new(|| {
    [
        (
            JsRegex::new(r"(?<![\p{L}\p{M}])př\.\s?n\.\s?l\.?(?!\p{L})", "giu").unwrap(),
            "před naším letopočtem",
        ),
        (
            JsRegex::new(r"(?<![\p{L}\p{M}])n\.\s?l\.?(?!\p{L})", "giu").unwrap(),
            "našeho letopočtu",
        ),
    ]
});

/// `DOTTED`, in the TS object's key order (generated from normalize.ts).
const DOTTED: [(&str, &str); 16] = [
    ("tzv", "takzvaný"),
    ("např", "například"),
    ("atd", "a tak dále"),
    ("apod", "a podobně"),
    ("aj", "a jiné"),
    ("tzn", "to znamená"),
    ("tj", "to jest"),
    ("dr", "doktor"),
    ("jr", "junior"),
    ("sv", "svatý"),
    ("st", "svatý"),
    ("co", "společnost"),
    ("inc", "společnost"),
    ("mil", "milionů"),
    ("s", "strana"),
    ("cca", "cirka"),
];

/// `DOTTED[key]`; the key is a lowercased match, which the `iu` fold can widen past the table (#1122).
fn dotted(key: &JsString) -> Option<&'static str> {
    DOTTED.iter().find(|(k, _)| js(k) == *key).map(|(_, v)| *v)
}

/// `DOTTED_ALT`: every key but `s`, longest first (a stable sort).
static DOTTED_ALT: LazyLock<String> = LazyLock::new(|| {
    alternation(&sorted_by_length_desc(
        DOTTED.iter().filter(|(k, _)| *k != "s").map(|(k, _)| js(k)),
    ))
});

const HOUR: [&str; 3] = ["hodina", "hodiny", "hodin"];
const MINUTE: [&str; 3] = ["minuta", "minuty", "minut"];
const DEGREE: [&str; 3] = ["stupeň", "stupně", "stupňů"];

/// `feminine(words)`: a final jeden → jedna, a final dva → dvě.
fn feminine(words: &JsString) -> JsString {
    let a = js_re!("jeden$", "u").replace(words, &js("jedna"));
    js_re!("dva$", "u").replace(&a, &js("dvě"))
}

/// `keepFinal(expansion, matched, …offset, whole)`: re-attach the sentence period an abbreviation's dot was
/// also doing.
fn keep_final(expansion: &str, m: &JsMatch, whole: &JsString) -> JsString {
    let e = js(expansion);
    if js_re!(r#"^[\s»)”"']*$"#, "u").test(&whole.slice(m.end() as isize, None)) {
        e.concat(&js("."))
    } else {
        e
    }
}

const ORD_1_19: [&str; 20] = [
    "",
    "první",
    "druhý",
    "třetí",
    "čtvrtý",
    "pátý",
    "šestý",
    "sedmý",
    "osmý",
    "devátý",
    "desátý",
    "jedenáctý",
    "dvanáctý",
    "třináctý",
    "čtrnáctý",
    "patnáctý",
    "šestnáctý",
    "sedmnáctý",
    "osmnáctý",
    "devatenáctý",
];
const ORD_TENS: [&str; 10] = [
    "",
    "",
    "dvacátý",
    "třicátý",
    "čtyřicátý",
    "padesátý",
    "šedesátý",
    "sedmdesátý",
    "osmdesátý",
    "devadesátý",
];
const ORD_HUNDREDS: [&str; 10] = [
    "",
    "stý",
    "dvoustý",
    "třístý",
    "čtyřstý",
    "pětistý",
    "šestistý",
    "sedmistý",
    "osmistý",
    "devítistý",
];

/// `ordinal(n)`: the masculine-nominative ordinal for an integer 1–999, else `None`.
pub(crate) fn ordinal(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || !(1.0..=999.0).contains(&n) {
        return None;
    }
    let n = n as usize;
    if n < 20 {
        return Some(js(ORD_1_19[n]));
    }
    if n < 100 {
        let (t, u) = (n / 10, n % 10);
        let mut s = js(ORD_TENS[t]);
        if u != 0 {
            s.push_str(&js(" "));
            s.push_str(&js(ORD_1_19[u]));
        }
        return Some(s);
    }
    let (h, r) = (n / 100, n % 100);
    let mut s = js(ORD_HUNDREDS[h]);
    if r != 0 {
        s.push_str(&js(" "));
        s.push_str(&ordinal(r as f64).unwrap());
    }
    Some(s)
}

/// `MONTH_RULE`, in the TS object's key order.
const MONTH_RULE: [(&str, OrdCase); 13] = [
    ("ledna", OrdCase::Gen),
    ("února", OrdCase::Gen),
    ("března", OrdCase::Gen),
    ("dubna", OrdCase::Gen),
    ("května", OrdCase::Gen),
    ("června", OrdCase::Gen),
    ("července", OrdCase::Gen),
    ("srpna", OrdCase::Gen),
    ("září", OrdCase::Gen),
    ("října", OrdCase::Gen),
    ("listopadu", OrdCase::Gen),
    ("prosince", OrdCase::Gen),
    ("červenci", OrdCase::Dat),
];

static MONTH_ALT: LazyLock<String> = LazyLock::new(|| {
    alternation(&sorted_by_length_desc(
        MONTH_RULE.iter().map(|(k, _)| js(k)),
    ))
});

static GROUP_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<=\d)(?<!(?<![\d\.,])0)[{GROUP_SPACE}](?=\d{{3}}(?!\d))"),
        "gu",
    )
    .unwrap()
});
static GROUP_SPACE_RE: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("[{GROUP_SPACE}]"), "gu").unwrap());
static DOTTED_CONTINUES: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r#"(?<![\p{{L}}\p{{M}}.])({})\.(\s+)(?=[\p{{L}}\d(„"])"#,
            *DOTTED_ALT
        ),
        "giu",
    )
    .unwrap()
});
static DOTTED_ENDS: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}.])({})\.(?=\s*(?:[,;:!?»)”]|$))",
            *DOTTED_ALT
        ),
        "giu",
    )
    .unwrap()
});
static MONTH_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}\d.,])(\d+)\.\s+({})(?!\p{{L}})",
            *MONTH_ALT
        ),
        "gu",
    )
    .unwrap()
});

/// The TS throws (`inflectOrdinal(undefined)` reads `.split` of undefined) where steps 7–10 take the ordinal of
/// a number outside 1–999.
const THROW: &str = "TypeError: Cannot read properties of undefined (reading 'split')";

/// `normalizeCzech(input)`. `Err` exactly where the TS throws (see `THROW`).
pub(crate) fn normalize_czech(input: &JsString) -> Result<JsString, String> {
    let mut s = input.clone();
    let threw = Cell::new(false);
    // `inflectOrdinal(ordinal(n)!, c)`: a miss marks the call as thrown; the rewrite's output is then discarded.
    let inflect_n = |n: &JsString, c: OrdCase| -> JsString {
        match ordinal(js_number(n)) {
            Some(o) => inflect_ordinal(&o, c),
            None => {
                threw.set(true);
                JsString::new()
            }
        }
    };
    let check = || {
        if threw.get() {
            Err(THROW.to_string())
        } else {
            Ok(())
        }
    };

    // 0) digit de-grouping (twice: the groups overlap on the shared digit), then the separators to a space.
    for _ in 0..2 {
        s = rewrite(&s, &GROUP_RE, &JsString::new());
    }
    s = rewrite(&s, &GROUP_SPACE_RE, &js(" "));

    // 1) multi-dot abbreviations, the sentence period re-attached where the dot was doing that duty too.
    for (re, w) in MULTI_DOT.iter() {
        s = rewrite_with(&s, re, |m, t| keep_final(w, m, t));
    }

    // 2) single-dot abbreviations. ⚠ The miss branch is reachable (#1122): the `iu` fold widens the pattern
    //    past the table's keys, and the match then stays as written.
    s = rewrite_with(&s, &DOTTED_CONTINUES, |m, t| {
        match dotted(&m.group(1, t).unwrap().to_lower_case()) {
            None => m.value(t),
            Some(w) => js(w).concat(&m.group(2, t).unwrap()),
        }
    });
    s = rewrite_with(&s, &DOTTED_ENDS, |m, t| {
        match dotted(&m.group(1, t).unwrap().to_lower_case()) {
            None => m.value(t),
            Some(w) => js(w).concat(&js(".")),
        }
    });
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}.])s\.(\s+)(?=\d)", "giu"),
        |m, t| js("strana").concat(&m.group(1, t).unwrap()),
    );

    // 3) clock, read cardinally with its counted nouns (both feminine); `:00` drops the minutes.
    s = rewrite_with(
        &s,
        js_re!(
            r"([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?!,\d)(?:\s+(?:h|hodin)(?![\p{L}\p{M}]))?",
            "gu"
        ),
        |m, t| {
            let hv = js_number(&m.group(1, t).unwrap());
            let mv = js_number(&m.group(2, t).unwrap());
            let head = feminine(&number_to_words(hv, None))
                .concat(&js(" "))
                .concat(&js(counted(hv, &HOUR)));
            if mv == 0.0 {
                head
            } else {
                head.concat(&js(" "))
                    .concat(&feminine(&number_to_words(mv, None)))
                    .concat(&js(" "))
                    .concat(&js(counted(mv, &MINUTE)))
            }
        },
    );

    // 4) the `N. N.` date, both halves genitive ordinals.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d])(\d{1,2})\.\s+(\d{1,2})\.(?=\s*(?:do\b|\d{4}|[.,\p{Ll}]|$))",
            "gu"
        ),
        |m, t| {
            let dv = js_number(&m.group(1, t).unwrap());
            let mv = js_number(&m.group(2, t).unwrap());
            if !(1.0..=31.0).contains(&dv) || !(1.0..=12.0).contains(&mv) {
                return m.value(t);
            }
            inflect_ordinal(&ordinal(dv).unwrap(), OrdCase::Gen)
                .concat(&js(" "))
                .concat(&inflect_ordinal(&ordinal(mv).unwrap(), OrdCase::Gen))
                .concat(&js(" "))
        },
    );

    // 5) version / figure dots between digits.
    s = rewrite(&s, js_re!(r"(\d)\.(?=\d)", "gu"), &js("$1 tečka "));

    // 6) ordinal range.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d.])(\d+)\.\s*[–—-]\s*(\d+)\.(?![\d])",
            "gu"
        ),
        |m, t| {
            let oa = ordinal(js_number(&m.group(1, t).unwrap()));
            let ob = ordinal(js_number(&m.group(2, t).unwrap()));
            match (oa, ob) {
                (Some(a), Some(b)) => a.concat(&js(" až ")).concat(&b),
                _ => m.value(t),
            }
        },
    );

    // 7) century: locative after an adjacent v/ve, else genitive.
    s = rewrite_with(
        &s,
        js_re!(
            r"((?:\d+\.\s*)(?:,\s*\d+\.\s*)*(?:\s+a\s+\d+\.\s*)?)století(?![\p{L}\p{M}])",
            "gu"
        ),
        |m, t| {
            let loc = js_re!(r"(?:v|ve)\s+$", "iu").test(&t.slice(0, Some(m.index() as isize)));
            let c = if loc { OrdCase::Loc } else { OrdCase::Gen };
            let list = m.group(1, t).unwrap();
            js_re!(r"(\d+)\.", "gu")
                .replace_with(&list, |nm, l| inflect_n(&nm.group(1, l).unwrap(), c))
                .concat(&js("století"))
        },
    );
    check()?;

    // 8) decade: genitive/locative plural.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d.,])(\d+)\.\s+(let|letech)(?!\p{L})",
            "gu"
        ),
        |m, t| {
            inflect_n(&m.group(1, t).unwrap(), OrdCase::PlGen)
                .concat(&js(" "))
                .concat(&m.group(2, t).unwrap())
        },
    );
    check()?;

    // 9) date months: the month name is the case cue.
    s = rewrite_with(&s, &MONTH_RE, |m, t| {
        let month = m.group(2, t).unwrap();
        let c = MONTH_RULE
            .iter()
            .find(|(k, _)| js(k) == month)
            .map(|(_, c)| *c)
            .unwrap();
        inflect_n(&m.group(1, t).unwrap(), c)
            .concat(&js(" "))
            .concat(&month)
    });
    check()?;

    // 10) place (compound first, locative, neuter accusative) and the written-out hour ordinal.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d.,])(\d+)\.\s+a\s+(\d+)\.\s+místě", "gu"),
        |m, t| {
            let a = inflect_n(&m.group(1, t).unwrap(), OrdCase::Loc);
            if threw.get() {
                return JsString::new();
            }
            a.concat(&js(" a "))
                .concat(&inflect_n(&m.group(2, t).unwrap(), OrdCase::Loc))
                .concat(&js(" místě"))
        },
    );
    check()?;
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d.,])(\d+)\.\s+místě(?!\p{L})", "gu"),
        |m, t| inflect_n(&m.group(1, t).unwrap(), OrdCase::Loc).concat(&js(" místě")),
    );
    check()?;
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d.,])(\d+)\.\s+místo(?!\p{L})", "gu"),
        |m, t| inflect_n(&m.group(1, t).unwrap(), OrdCase::NeutNom).concat(&js(" místo")),
    );
    check()?;
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d.,])(\d+)\.\s+(hodin\p{L}*)(?!\p{L})",
            "gu"
        ),
        |m, t| {
            inflect_n(&m.group(1, t).unwrap(), OrdCase::NeutNom)
                .concat(&js(" "))
                .concat(&m.group(2, t).unwrap())
        },
    );
    check()?;

    // 11) the general ordinal: followed by a lowercase word or a comma.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d.,])(\d+)\.(?=\s*[,\p{Ll}])", "gu"),
        |m, t| ordinal(js_number(&m.group(1, t).unwrap())).unwrap_or_else(|| m.value(t)),
    );

    // 12) regnal ordinals after a capitalised name, up to 39.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<=\p{Lu}\p{Ll}+\p{M}*[  ])(\d{1,2})\.?(?=[\s.,;:!?]|$)",
            "gu"
        ),
        |m, t| {
            let n = js_number(&m.group(1, t).unwrap());
            match ordinal(n) {
                Some(o) if n <= 39.0 => o,
                _ => m.value(t),
            }
        },
    );

    // 13) numeric ranges.
    s = rewrite(&s, js_re!(r"(\d)\s?[–—-]\s?(?=\d)", "gu"), &js("$1 do "));

    // 14) `mil/h`.
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?mil\s?\/\s?h(?![\p{L}\p{M}])", "giu"),
        |m, t| m.group(1, t).unwrap().concat(&js(" mil za hodinu")),
    );

    // 15) signs.
    let degrees = |m: &JsMatch, t: &JsString, tail: &str| {
        let n = m.group(1, t).unwrap();
        n.concat(&js(" "))
            .concat(&js(counted(js_number(&n), &DEGREE)))
            .concat(&js(tail))
    };
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?°\s?C(?![\p{L}\p{M}])", "gui"),
        |m, t| degrees(m, t, " Celsia"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?°\s?F(?![\p{L}\p{M}])", "gui"),
        |m, t| degrees(m, t, " Fahrenheita"),
    );
    s = rewrite_with(&s, js_re!(r"(\d+)\s?°", "gu"), |m, t| degrees(m, t, ""));
    s = rewrite(&s, js_re!("±", "gu"), &js(" plus mínus "));
    s = rewrite(&s, js_re!(r"(^|[\s(])\+\s?(?=\d)", "gu"), &js("$1plus "));
    s = rewrite(&s, js_re!(r"(\d)\s*×\s*(?=\d)", "gu"), &js("$1 krát "));
    s = rewrite(&s, js_re!(r"(^|[\s(])[-−]\s?(?=\d)", "gu"), &js("$1mínus "));
    s = rewrite(&s, js_re!(r"\s*[=≈]\s*", "gu"), &js(" rovná se "));
    s = rewrite(&s, js_re!(r"\s*<\s*", "gu"), &js(" menší než "));
    s = rewrite(&s, js_re!(r"\s*>\s*", "gu"), &js(" větší než "));
    s = rewrite(&s, js_re!(r"\s*÷\s*", "gu"), &js(" děleno "));
    s = rewrite(&s, js_re!(r"\s*[&＆]\s*", "gu"), &js(" a "));

    // 16) fractions with numerator 1, feminine.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d{1,3})\/(\d{1,3})(?![\d.,])", "gu"),
        |m, t| {
            let den = ordinal(js_number(&m.group(2, t).unwrap()));
            match den {
                Some(d) if js_number(&m.group(1, t).unwrap()) == 1.0 => {
                    js("jedna ").concat(&inflect_ordinal(&d, OrdCase::Fem))
                }
                _ => m.value(t),
            }
        },
    );

    // 17) pH and Ghz.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])pH(?![\p{L}\p{M}])", "gu"),
        &js("pé há"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])Ghz(?![\p{L}\p{M}])", "giu"),
        &js("gigahertz"),
    );

    Ok(s)
}
