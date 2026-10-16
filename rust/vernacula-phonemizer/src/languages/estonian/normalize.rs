//! Estonian (et) text normalization: the marked clock, digit grouping, era markers, dotless abbreviations, the
//! ordinal coordination / range / bare `N.` ordinal inflected to the head noun's case, the hyphen case suffix on
//! digits, ranges with `kuni`, the decimal comma, degrees, signs; and the initialism pass with the hyphen
//! inflection on an initialism. Plus the ordinal and genitive-cardinal morphology.
//! Ported from src/languages/estonian/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::{Arc, LazyLock};

use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const GEN_UNIT: [&str; 10] = [
    "nulli", "ühe", "kahe", "kolme", "nelja", "viie", "kuue", "seitsme", "kaheksa", "üheksa",
];
const ORD_NOM_UNIT: [&str; 10] = [
    "", "esimene", "teine", "kolmas", "neljas", "viies", "kuues", "seitsmes", "kaheksas", "üheksas",
];
const ORD_STEM_UNIT: [&str; 10] = [
    "",
    "esimese",
    "teise",
    "kolmanda",
    "neljanda",
    "viienda",
    "kuuenda",
    "seitsmenda",
    "kaheksanda",
    "üheksanda",
];
const TEN_NOM: &str = "kümnes";
const TEN_STEM: &str = "kümnenda";
const TEN_GEN: &str = "kümne";
const TEEN_NOM: &str = "teistkümnes";
const TEEN_STEM: &str = "teistkümnenda";
const TEEN_GEN: &str = "teistkümne";
const HUN_NOM: &str = "sajas";
const HUN_STEM: &str = "sajanda";
const HUN_GEN: &str = "saja";
const THO_NOM: &str = "tuhandes";
const THO_STEM: &str = "tuhandenda";
const THO_GEN: &str = "tuhande";

/// `genCardinal(n)`, 0 ≤ n ≤ 9999 (an integer).
fn gen_cardinal(n: i64) -> String {
    let g = |i: i64| GEN_UNIT[i as usize];
    if n < 10 {
        return g(n).to_string();
    }
    if n == 10 {
        return TEN_GEN.to_string();
    }
    if n < 20 {
        return format!("{}{TEEN_GEN}", g(n - 10));
    }
    if n < 100 {
        let (t, u) = (n / 10, n % 10);
        return if u == 0 {
            format!("{}{TEN_GEN}", g(t))
        } else {
            format!("{}{TEN_GEN} {}", g(t), g(u))
        };
    }
    if n < 1000 {
        let (h, r) = (n / 100, n % 100);
        let head = format!("{}{HUN_GEN}", if h == 1 { "" } else { g(h) });
        return if r == 0 {
            head
        } else {
            format!("{head} {}", gen_cardinal(r))
        };
    }
    let (th, r) = (n / 1000, n % 1000);
    let head = if th == 1 {
        THO_GEN.to_string()
    } else {
        format!("{} {THO_GEN}", gen_cardinal(th))
    };
    if r == 0 {
        head
    } else {
        format!("{head} {}", gen_cardinal(r))
    }
}

const PLURAL_ENDINGS: [&str; 4] = ["te", "tel", "test", "il"];

/// `NOMINATIVE`: a sentinel that can never be a case ending.
pub const NOMINATIVE: &str = "\u{0}nom";

/// `ordinal(n, ending)`: the ordinal for an integer 1 … 9999 in the case `ending` (appended to the genitive
/// stem; `NOMINATIVE` for the `-s`/`-ne` form), or `None` outside that range or for a plural ending on a
/// numeral whose last component is 1 or 2.
pub fn ordinal(n: f64, ending: &str) -> Option<String> {
    if !n.is_finite() || n.trunc() != n || !(1.0..=9999.0).contains(&n) {
        return None;
    }
    let n = n as i64;
    let nom = ending == NOMINATIVE;
    let plural = PLURAL_ENDINGS.contains(&ending);
    if plural && (n % 100 == 1 || n % 100 == 2) {
        return None;
    }
    let put = |nom_form: String, stem: String| -> Option<String> {
        Some(if nom { nom_form } else { stem + ending })
    };
    let compose =
        |head: String, rest: i64| ordinal(rest as f64, ending).map(|tail| format!("{head} {tail}"));
    let g = |i: i64| GEN_UNIT[i as usize];
    if n < 10 {
        return put(
            ORD_NOM_UNIT[n as usize].to_string(),
            ORD_STEM_UNIT[n as usize].to_string(),
        );
    }
    if n == 10 {
        return put(TEN_NOM.to_string(), TEN_STEM.to_string());
    }
    if n < 20 {
        return put(
            format!("{}{TEEN_NOM}", g(n - 10)),
            format!("{}{TEEN_STEM}", g(n - 10)),
        );
    }
    if n < 100 {
        let (t, u) = (n / 10, n % 10);
        if u != 0 {
            return compose(format!("{}{TEN_GEN}", g(t)), u);
        }
        return put(format!("{}{TEN_NOM}", g(t)), format!("{}{TEN_STEM}", g(t)));
    }
    if n < 1000 {
        let (h, r) = (n / 100, n % 100);
        let gh = if h == 1 { "" } else { g(h) };
        if r != 0 {
            return compose(format!("{gh}{HUN_GEN}"), r);
        }
        return put(format!("{gh}{HUN_NOM}"), format!("{gh}{HUN_STEM}"));
    }
    let (th, r) = (n / 1000, n % 1000);
    let gt = if th == 1 {
        String::new()
    } else {
        format!("{} ", gen_cardinal(th))
    };
    if r != 0 {
        return compose(format!("{gt}{THO_GEN}"), r);
    }
    put(format!("{gt}{THO_NOM}"), format!("{gt}{THO_STEM}"))
}

const NOUN_STEMS: [&str; 19] = [
    "aastatuhande",
    "sünniaastapäeva",
    "eluaasta",
    "aasta",
    "sajandi",
    "koha",
    "järgu",
    "jaanuari",
    "veebruari",
    "märtsi",
    "aprilli",
    "mai",
    "juuni",
    "juuli",
    "augusti",
    "septembri",
    "oktoobri",
    "novembri",
    "detsembri",
];
const NOUN_ENDINGS: [&str; 10] = ["", "l", "st", "ks", "t", "ni", "te", "tel", "test", "il"];
const GENITIVE_ATTRIBUTE: [&str; 4] = ["ni", "na", "ta", "ga"];
const NOUN_NOMINATIVE: [&str; 17] = [
    "jaanuar",
    "veebruar",
    "märts",
    "aprill",
    "mai",
    "juuni",
    "juuli",
    "august",
    "september",
    "oktoober",
    "november",
    "detsember",
    "sajand",
    "koht",
    "trükk",
    "ametlik",
    "valitsus",
];

/// `caseOf(word)`: the ATTRIBUTE's ending for a recognised head noun (the genitive `""` before a
/// `GENITIVE_ATTRIBUTE` head ending), or `None`.
fn case_of(word: &JsString) -> Option<String> {
    if NOUN_NOMINATIVE.iter().any(|w| js(w) == *word) {
        return Some(NOMINATIVE.to_string());
    }
    for stem in NOUN_STEMS {
        let stem = js(stem);
        if !word.starts_with(&stem) {
            continue;
        }
        let rest = word.slice(stem.len() as isize, None).to_string_lossy();
        if NOUN_ENDINGS.contains(&rest.as_str()) {
            return Some(if GENITIVE_ATTRIBUTE.contains(&rest.as_str()) {
                String::new()
            } else {
                rest
            });
        }
    }
    None
}

const HEAD_WORD: &str = "[a-zõäöüšž]+";
const DECIMAL_WORD: &str = "koma";
const RANGE_JOINER: &str = "kuni";
const DEGREE_WORD: &str = "kraadi";

static ERA: LazyLock<Vec<(JsRegex, &'static str)>> = LazyLock::new(|| {
    [
        (
            r"(?<![\p{L}\p{M}])e\.\s?m\.\s?a\.?(?![\p{L}\p{M}])",
            "enne meie aja arvamist",
        ),
        (
            r"(?<![\p{L}\p{M}])m\.\s?a\.\s?j\.?(?![\p{L}\p{M}])",
            "meie aja arvamise järgi",
        ),
        (r"(?<![\p{L}\p{M}])eKr(?![\p{L}\p{M}])", "enne Kristust"),
        (r"(?<![\p{L}\p{M}])pKr(?![\p{L}\p{M}])", "pärast Kristust"),
    ]
    .iter()
    .map(|&(p, w)| (JsRegex::new(p, "gu").unwrap(), w))
    .collect()
});

const ABBREV_DOT: &str = r"(?:\.(?!\s+\p{Lu}|\s*$))?";

static ABBREV: LazyLock<Vec<(JsRegex, &'static str)>> = LazyLock::new(|| {
    let abbrev = |form: &str, phrase: &'static str| {
        (
            JsRegex::new(
                &format!(r"(?<![\p{{L}}\p{{M}}]){form}{ABBREV_DOT}(?![\p{{L}}\p{{M}}])"),
                "gu",
            )
            .unwrap(),
            phrase,
        )
    };
    vec![
        abbrev("jms", "ja muu selline"),
        abbrev("jmt", "ja muud teised"),
        abbrev("ptk", "peatükk"),
        abbrev("tlk", "tõlkinud"),
        abbrev("nt", "näiteks"),
        abbrev("nr", "number"),
        abbrev("nn", "nii nimetatud"),
        abbrev("sh", "sealhulgas"),
        abbrev("jm", "ja muud"),
        abbrev("jt", "ja teised"),
        abbrev("vt", "vaata"),
        (
            JsRegex::new(r"(?<![\p{L}\p{M}])u\.?(?=\s+\d)", "gu").unwrap(),
            "umbes",
        ),
    ]
});

/// `saidNear(full, start, end, "kraad")`: the needle as a whole word (any ending, any case) in the clause window.
fn said_near_kraad(full: &JsString, start: usize, end: usize) -> bool {
    static RE: LazyLock<JsRegex> = LazyLock::new(|| {
        let alt = ["kraad"]
            .iter()
            .map(|n| format!(r"{n}\p{{L}}*"))
            .collect::<Vec<_>>()
            .join("|");
        JsRegex::new(
            &format!(r"(?<![\p{{L}}\p{{M}}])(?:{alt})(?![\p{{L}}\p{{M}}])"),
            "iu",
        )
        .unwrap()
    });
    RE.test(&clause_window(full, start, end))
}

/// `clauseWindow(full, start, end)`: ±45 code units, truncated at the nearest `[.!?…]` on each side.
fn clause_window(full: &JsString, start: usize, end: usize) -> JsString {
    let left = full.slice(start.saturating_sub(45) as isize, Some(start as isize));
    let right = full.slice(end as isize, Some((end + 45) as isize));
    let cut = js_re!(r"[.!?…][^.!?…]*$", "u")
        .exec(&left)
        .map(|m| m.index());
    let stop = js_re!(r"[.!?…]", "u").exec(&right).map(|m| m.index());
    let l = match cut {
        None => left.clone(),
        Some(c) => left.slice((c + 1) as isize, None),
    };
    let r = match stop {
        None => right.clone(),
        Some(s) => right.slice(0, Some(s as isize)),
    };
    l.concat(&full.slice(start as isize, Some(end as isize)))
        .concat(&r)
}

fn ord_regex(body: &str) -> JsRegex {
    JsRegex::new(&format!(r"{body}(?=\s+({HEAD_WORD}))"), "gu").unwrap()
}

static ORD_COORD: LazyLock<JsRegex> =
    LazyLock::new(|| ord_regex(r"(?<![\d.,:\p{L}\p{M}])(\d{1,4})\.\s+(ja|või)\s+(\d{1,4})\."));
static ORD_RANGE: LazyLock<JsRegex> =
    LazyLock::new(|| ord_regex(r"(?<![\d.,:\p{L}\p{M}])(\d{1,4})\.\s*[–—-]\s*(\d{1,4})\."));
static ORD_SINGLE: LazyLock<JsRegex> =
    LazyLock::new(|| ord_regex(r"(?<![\d.,:\p{L}\p{M}])(\d{1,4})\."));
static RANGE: LazyLock<JsRegex> = LazyLock::new(|| {
    let num = r"\d+";
    JsRegex::new(
        &format!(r"(?<![-+−–—/\d.,:\p{{L}}\p{{M}}])({num})[ ]?[-–—][ ]?({num})(?![-+−/\d:\p{{L}}\p{{M}}]|,\d)"),
        "gu",
    )
    .unwrap()
});

/// `clockMinutes`: the minutes keep their zero (#1574), `08` → *null 8*, `00` → *null null*.
fn clock_minutes(mm: &str) -> String {
    if mm == "00" {
        "null null".to_string()
    } else if let Some(rest) = mm.strip_prefix('0') {
        format!("null {rest}")
    } else {
        mm.to_string()
    }
}

/// `normalizeEstonian(input)`.
pub fn normalize_estonian(input: &JsString) -> JsString {
    let g = |m: &JsMatch, s: &JsString, i: usize| m.group(i, s).unwrap_or_default();
    let input = rewrite_with(
        input,
        js_re!(
            r"(?<=\bkell[ao]?\s)([01]?\d|2[0-3])[.:]([0-5]\d)(?![\d]|[.,:]\d)",
            "giu"
        ),
        |m, s| {
            js(&format!(
                "{} {}",
                g(m, s, 1).to_string_lossy(),
                clock_minutes(&g(m, s, 2).to_string_lossy())
            ))
        },
    );
    let mut t = input;

    t = rewrite_with(
        &t,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)",
            "gu"
        ),
        |m, s| {
            g(m, s, 1).concat(
                &js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&g(m, s, 2), &JsString::new()),
            )
        },
    );

    for (re, phrase) in ERA.iter() {
        t = rewrite(&t, re, &js(phrase));
    }
    for (re, word) in ABBREV.iter() {
        t = rewrite(&t, re, &js(word));
    }

    t = rewrite_with(&t, &ORD_COORD, |m, s| {
        let Some(e) = case_of(&g(m, s, 4)) else {
            return m.value(s);
        };
        let x = ordinal(js_number(&g(m, s, 1)), &e);
        let y = ordinal(js_number(&g(m, s, 3)), &e);
        match (x, y) {
            (Some(x), Some(y)) => js(&format!("{x} {} {y}", g(m, s, 2))),
            _ => m.value(s),
        }
    });
    t = rewrite_with(&t, &ORD_RANGE, |m, s| {
        let Some(e) = case_of(&g(m, s, 3)) else {
            return m.value(s);
        };
        let x = ordinal(js_number(&g(m, s, 1)), &e);
        let y = ordinal(js_number(&g(m, s, 2)), &e);
        match (x, y) {
            (Some(x), Some(y)) => js(&format!("{x} {y}")),
            _ => m.value(s),
        }
    });
    t = rewrite_with(&t, &ORD_SINGLE, |m, s| match case_of(&g(m, s, 2)) {
        None => m.value(s),
        Some(e) => ordinal(js_number(&g(m, s, 1)), &e).map_or_else(|| m.value(s), |o| js(&o)),
    });

    t = rewrite_with(
        &t,
        js_re!(r"(?<![\d.,\p{Sc}])(\d{1,4})-(le|ni)(?![\p{L}\p{M}])", "gu"),
        |m, s| {
            let v = js_number(&g(m, s, 1));
            if (1.0..=9999.0).contains(&v) {
                js(&gen_cardinal(v as i64)).concat(&g(m, s, 2))
            } else {
                m.value(s)
            }
        },
    );

    t = rewrite_with(&t, &RANGE, |m, s| {
        let (a, b) = (g(m, s, 1), g(m, s, 2));
        if js_number(&a) < js_number(&b) {
            a.concat(&js(&format!(" {RANGE_JOINER} "))).concat(&b)
        } else {
            m.value(s)
        }
    });
    t = rewrite(
        &t,
        js_re!(r"(?<![\d.,])(\d+)\s*\.\.\.\s*(\d+)(?![\d.,])", "gu"),
        &js(&format!("$1 {RANGE_JOINER} $2")),
    );

    t = rewrite_with(
        &t,
        js_re!(r"(?<![\d.,])(\d+),(\d+)(?![\d,])", "gu"),
        |m, s| {
            let frac = JsString::join(&g(m, s, 2).code_point_strings(), &js(" "));
            g(m, s, 1)
                .concat(&js(&format!(" {DECIMAL_WORD} ")))
                .concat(&frac)
        },
    );

    let degree = |m: &JsMatch, s: &JsString| -> JsString {
        let n = g(m, s, 1);
        if said_near_kraad(s, m.index(), m.end()) {
            n
        } else {
            n.concat(&js(&format!(" {DEGREE_WORD}")))
        }
    };
    t = rewrite_with(
        &t,
        js_re!(r"(\d)\s*°\s*[CF](?![\p{L}\p{M}])", "gui"),
        degree,
    );
    t = rewrite_with(&t, js_re!(r"(\d)\s*°(?!\s*\d+\s*['’′])", "gu"), degree);

    t = rewrite(
        &t,
        js_re!(r"(?<![\p{L}\p{M}\d.,–—-])[-−–](?=\d)", "gu"),
        &js("miinus "),
    );
    t = rewrite(
        &t,
        js_re!(r"(?<![\p{L}\p{M}\d])\+\s?(?=\d)", "gu"),
        &js("pluss "),
    );
    t = rewrite(
        &t,
        js_re!(
            r"(?<=[\p{L}\p{M}\d)\p{Sc}])\s*\+\s*(?=[\p{L}\p{M}\d(\p{Sc}])",
            "gu"
        ),
        &js(" pluss "),
    );

    rewrite(
        &rewrite(&t, js_re!(r"[^\S\n]{2,}", "gu"), &js(" ")),
        js_re!(r"^[^\S\n]+|[^\S\n]+$", "gu"),
        &JsString::new(),
    )
}

/// `LETTER_NAME`, in the TS object's key order.
const LETTER_NAMES: [(&str, &str); 32] = [
    ("a", "aa"),
    ("b", "bee"),
    ("c", "tsee"),
    ("d", "dee"),
    ("e", "ee"),
    ("f", "eff"),
    ("g", "gee"),
    ("h", "haa"),
    ("i", "ii"),
    ("j", "jott"),
    ("k", "kaa"),
    ("l", "ell"),
    ("m", "emm"),
    ("n", "enn"),
    ("o", "oo"),
    ("p", "pee"),
    ("q", "kuu"),
    ("r", "err"),
    ("s", "ess"),
    ("t", "tee"),
    ("u", "uu"),
    ("v", "vee"),
    ("w", "kaksisvee"),
    ("x", "iks"),
    ("y", "igrek"),
    ("z", "tsett"),
    ("ä", "ää"),
    ("ö", "öö"),
    ("õ", "õõ"),
    ("ü", "üü"),
    ("š", "šaa"),
    ("ž", "žee"),
];

/// `LETTER_NAME[l]` (`l` is one lowercased code point, which no `Object.prototype` member's name is).
fn letter_name(l: &JsString) -> Option<JsString> {
    LETTER_NAMES
        .iter()
        .find(|(k, _)| js(k) == *l)
        .map(|(_, v)| js(v))
}

const LEGAL_ONSETS: [&str; 22] = [
    "bl", "br", "dr", "fl", "fr", "gl", "gr", "kl", "kr", "kv", "pl", "pr", "ps", "sk", "sl", "sn",
    "sp", "st", "sv", "tr", "ts", "tv",
];
const LEGAL_CODAS: [&str; 23] = [
    "kk", "ks", "ld", "ll", "ls", "lt", "mm", "nd", "ng", "nk", "nn", "ns", "nt", "pp", "rd", "rr",
    "rs", "rt", "ss", "st", "tt", "hk", "ht",
];

type Predicate = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

static IS_UNREADABLE: LazyLock<Predicate> = LazyLock::new(|| {
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new("[aeiouyõäöü]", "u").unwrap(),
        legal_onsets: LEGAL_ONSETS.iter().map(|o| js(o)).collect(),
        legal_codas: LEGAL_CODAS.iter().map(|c| js(c)).collect(),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableEstonian(word)`.
pub fn is_unreadable_estonian(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

fn is_acronym_letters(w: &JsString) -> bool {
    *w == js("usa")
}

static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| Arc::new(letter_name));

/// `normalizeEstonianInitialisms(text)`: the hyphen inflection first, then the shared pass (nothing recorded).
pub fn normalize_estonian_initialisms(text: &JsString) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: LETTER_NAME.clone(),
            lower: None,
            acronym_letters: Arc::new(is_acronym_letters),
            is_recorded: |_: &JsString| false,
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(&resolve_hyphen_inflection(text))
}

/// `resolveHyphenInflection(text)`: `SKP-st` → *ess kaa peest*; a readable head keeps its hyphen and word.
fn resolve_hyphen_inflection(text: &JsString) -> JsString {
    rewrite_with(
        text,
        js_re!(
            r"(?<![\p{L}\p{M}])(\p{Lu}{2,})-([a-zõäöüšž]{1,3})(?![\p{L}\p{M}])",
            "gu"
        ),
        |m, s| {
            let head = m.group(1, s).unwrap();
            let suf = m.group(2, s).unwrap();
            let lower = head.to_lower_case();
            if !is_acronym_letters(&lower) && !is_unreadable_estonian(&lower) {
                return m.value(s);
            }
            let names: Option<Vec<JsString>> =
                lower.code_point_strings().iter().map(letter_name).collect();
            match names {
                Some(n) => {
                    let (last, init) = n.split_last().unwrap();
                    JsString::join(init, &js(" "))
                        .concat(&js(" "))
                        .concat(last)
                        .concat(&suf)
                        .trim()
                }
                None => m.value(s),
            }
        },
    )
}
