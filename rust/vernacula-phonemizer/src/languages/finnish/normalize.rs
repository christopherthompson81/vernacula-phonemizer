//! Finnish (fi) text normalization: digit grouping, dotted abbreviations, dotted dates, the marked clock, the bare
//! `N.` ordinal and its range, the colon suffixes, the apostrophe genitive, the decimal comma, degrees, signs,
//! relational signs and the ampersand; and the initialism pass with the colon inflection on an initialism.
//! Ported from src/languages/finnish/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::{Arc, LazyLock};

use super::manifest::MANIFEST;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const ORD_FINAL: [&str; 10] = [
    "",
    "ensimmäinen",
    "toinen",
    "kolmas",
    "neljäs",
    "viides",
    "kuudes",
    "seitsemäs",
    "kahdeksas",
    "yhdeksäs",
];
const ORD_COMB: [&str; 10] = [
    "",
    "yhdes",
    "kahdes",
    "kolmas",
    "neljäs",
    "viides",
    "kuudes",
    "seitsemäs",
    "kahdeksas",
    "yhdeksäs",
];
const ORD_TEN: &str = "kymmenes";
const ORD_TEEN: &str = "toista";
const ORD_HUNDRED: &str = "sadas";

/// `ordinal(n)`: the ordinal for an integer 1 … 999, `None` outside it.
pub fn ordinal(n: f64) -> Option<String> {
    if !n.is_finite() || n.trunc() != n || !(1.0..=999.0).contains(&n) {
        return None;
    }
    if n < 10.0 {
        return Some(ORD_FINAL[n as usize].to_string());
    }
    if n == 10.0 {
        return Some(ORD_TEN.to_string());
    }
    if n < 20.0 {
        return Some(format!("{}{ORD_TEEN}", ORD_COMB[(n - 10.0) as usize]));
    }
    if n < 100.0 {
        let (t, o) = ((n / 10.0).floor() as usize, n % 10.0);
        let unit = if o != 0.0 { ORD_FINAL[o as usize] } else { "" };
        return Some(format!("{}{ORD_TEN}{unit}", ORD_COMB[t]));
    }
    let (h, r) = ((n / 100.0).floor() as usize, n % 100.0);
    let hundreds = if h == 1 {
        ORD_HUNDRED.to_string()
    } else {
        format!("{}{ORD_HUNDRED}", ORD_COMB[h])
    };
    let rest = if r != 0.0 {
        ordinal(r).unwrap()
    } else {
        String::new()
    };
    Some(hundreds + &rest)
}

const MONTHS: [&str; 13] = [
    "",
    "tammikuuta",
    "helmikuuta",
    "maaliskuuta",
    "huhtikuuta",
    "toukokuuta",
    "kesäkuuta",
    "heinäkuuta",
    "elokuuta",
    "syyskuuta",
    "lokakuuta",
    "marraskuuta",
    "joulukuuta",
];
const MONTH_LOOKAHEAD: &str = r"(?:tammi|helmi|maalis|huhti|touko|kesä|heinä|elo|syys|loka|marras|joulu)kuu\p{L}*|päivä\p{L}*";

const DECIMAL_WORD: &str = "pilkku";

/// `LETTER_NAME`, in the TS object's key order.
const LETTER_NAMES: [(&str, &str); 29] = [
    ("a", "aa"),
    ("b", "bee"),
    ("c", "see"),
    ("d", "dee"),
    ("e", "ee"),
    ("f", "äf"),
    ("g", "gee"),
    ("h", "hoo"),
    ("i", "ii"),
    ("j", "jii"),
    ("k", "koo"),
    ("l", "äl"),
    ("m", "äm"),
    ("n", "än"),
    ("o", "oo"),
    ("p", "pee"),
    ("q", "kuu"),
    ("r", "är"),
    ("s", "äs"),
    ("t", "tee"),
    ("u", "uu"),
    ("v", "vee"),
    ("w", "kaksoisvee"),
    ("x", "äks"),
    ("y", "yy"),
    ("z", "tseta"),
    ("å", "ruotsalainen oo"),
    ("ä", "ää"),
    ("ö", "öö"),
];
const LETTER_NAMES_LONG: [(&str, &str); 7] = [
    ("f", "äffä"),
    ("l", "ällä"),
    ("m", "ämmä"),
    ("n", "ännä"),
    ("r", "ärrä"),
    ("s", "ässä"),
    ("x", "äksä"),
];

/// `LETTER_NAME[l]` (`l` is one lowercased code point, which no `Object.prototype` member's name is).
fn letter_name(l: &JsString) -> Option<JsString> {
    LETTER_NAMES
        .iter()
        .find(|(k, _)| js(k) == *l)
        .map(|(_, v)| js(v))
}

/// `LETTER_NAME_LONG[l]`.
fn letter_name_long(l: &JsString) -> Option<JsString> {
    LETTER_NAMES_LONG
        .iter()
        .find(|(k, _)| js(k) == *l)
        .map(|(_, v)| js(v))
}

const LEGAL_ONSETS: [&str; 18] = [
    "bl", "br", "dr", "fl", "fr", "gl", "gr", "kl", "kr", "kv", "pl", "pr", "ps", "sk", "sp", "st",
    "tr", "tv",
];
const LEGAL_CODAS: [&str; 8] = ["ks", "ls", "ns", "nt", "rs", "rt", "st", "lt"];

type Predicate = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

static IS_UNREADABLE: LazyLock<Predicate> = LazyLock::new(|| {
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new("[aeiouyäöå]", "u").unwrap(),
        legal_onsets: LEGAL_ONSETS.iter().map(|o| js(o)).collect(),
        legal_codas: LEGAL_CODAS.iter().map(|c| js(c)).collect(),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableFinnish(word)`.
pub fn is_unreadable_finnish(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

const ACRONYM_LETTERS: [&str; 5] = ["eu", "yk", "cia", "em", "ep"];

fn is_acronym_letters(w: &JsString) -> bool {
    ACRONYM_LETTERS.iter().any(|a| js(a) == *w)
}

/// `ABBREV`: `[pattern, replacement, keepFinal]`, in order.
static ABBREV: LazyLock<Vec<(JsRegex, &'static str, bool)>> = LazyLock::new(|| {
    let table: [(&str, &str, bool); 28] = [
        (r"(?<![\p{L}\p{M}])o\.\s?s\.(?=\s)", "omaa sukua", false),
        (r"(?<![\p{L}\p{M}])eaa\.", "ennen ajanlaskun alkua", true),
        (r"(?<![\p{L}\p{M}])jaa\.", "jälkeen ajanlaskun alun", true),
        (r"(?<![\p{L}\p{M}])(?<!\d )s\.(?=\s+\d)", "syntynyt", false),
        (r"(?<![\p{L}\p{M}])(?<!\d )k\.(?=\s+\d)", "kuollut", false),
        (r"(?<![\p{L}\p{M}])(?<!\d )mm\.(?=\s)", "muun muassa", false),
        (r"(?<![\p{L}\p{M}\d:])n\.(?=\s)", "noin", false),
        (r"(?<![\p{L}\p{M}])[Vv]\.(?=\s+\d)", "vuonna", false),
        (r"(?<![\p{L}\p{M}])esim\.", "esimerkiksi", true),
        (r"(?<![\p{L}\p{M}])jne\.", "ja niin edelleen", true),
        (r"(?<![\p{L}\p{M}])väh\.", "vähintään", true),
        (r"(?<![\p{L}\p{M}])milj\.", "miljoonaa", true),
        (r"(?<![\p{L}\p{M}])lyh\.", "lyhenne", true),
        (r"(?<![\p{L}\p{M}])(?<=\d )as\.", "asukasta", true),
        (r"(?<![\p{L}\p{M}])engl\.", "englanniksi", false),
        (r"(?<![\p{L}\p{M}])ven\.", "venäjäksi", false),
        (r"(?<![\p{L}\p{M}])saks\.", "saksaksi", false),
        (r"(?<![\p{L}\p{M}])arab\.", "arabiaksi", false),
        (r"(?<![\p{L}\p{M}])jap\.", "japaniksi", false),
        (r"(?<![\p{L}\p{M}])kreik\.", "kreikaksi", false),
        (r"(?<![\p{L}\p{M}])ital\.", "italiaksi", false),
        (r"(?<![\p{L}\p{M}])kiin\.", "kiinaksi", false),
        (r"(?<![\p{L}\p{M}])kor\.", "koreaksi", false),
        (r"(?<![\p{L}\p{M}])ukr\.", "ukrainaksi", false),
        (r"(?<![\p{L}\p{M}])puol\.", "puolaksi", false),
        (r"(?<![\p{L}\p{M}])mong\.", "mongoliaksi", false),
        (r"(?<![\p{L}\p{M}])arm\.", "armeniaksi", false),
        (r"(?<![\p{L}\p{M}])esp\.", "espanjaksi", false),
    ];
    table
        .iter()
        .map(|&(p, w, k)| (JsRegex::new(p, "gu").unwrap(), w, k))
        .collect()
});

/// `isDay(Number(d)) && isMonth(Number(mo)) && ordinal(Number(d)) !== undefined`, then the ordinal.
fn date_day(d: &JsString, mo: &JsString) -> Option<(String, &'static str)> {
    let (d, mo) = (js_number(d), js_number(mo));
    if !((1.0..=31.0).contains(&d) && (1.0..=12.0).contains(&mo)) {
        return None;
    }
    ordinal(d).map(|o| (o, MONTHS[mo as usize]))
}

/// `minutes(mm)`: `00` and a leading zero keep the zero as a word.
fn minutes(mm: &JsString) -> JsString {
    let zero = &MANIFEST.numbers.zero;
    if *mm == js("00") {
        return js(&format!("{zero} {zero}"));
    }
    if mm.starts_with(&js("0")) {
        return js(&format!("{zero} ")).concat(&mm.slice(1, None));
    }
    mm.clone()
}

/// `clockBody(h, mm)`: `Number(h) < 24 && Number(mm) < 60`.
fn clock_body(h: &JsString, mm: &JsString) -> Option<JsString> {
    (js_number(h) < 24.0 && js_number(mm) < 60.0).then(|| h.concat(&js(" ")).concat(&minutes(mm)))
}

fn ord_tail() -> String {
    format!(r"(?=\s+(?:{MONTH_LOOKAHEAD}|\p{{Ll}}))")
}

static ORD_RANGE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\d.,:\p{{L}}])(\d{{1,3}})\.\s*[–—-]\s*(\d{{1,3}})\.{}",
            ord_tail()
        ),
        "gu",
    )
    .unwrap()
});
static ORD_SINGLE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<![\d.,:\p{{L}}])(\d{{1,3}})\.{}", ord_tail()),
        "gu",
    )
    .unwrap()
});

/// `normalizeFinnish(input)`.
pub fn normalize_finnish(input: &JsString) -> JsString {
    let mut t = input.clone();
    let g = |m: &JsMatch, s: &JsString, i: usize| m.group(i, s).unwrap_or_default();

    loop {
        let prev = t.clone();
        t = rewrite(
            &t,
            js_re!(
                r"(?<=\d)(?<!(?<![\d\.,])0)[ \u00a0\u202f\u2009](?=\d{3}(?!\d))",
                "gu"
            ),
            &JsString::new(),
        );
        if t == prev {
            break;
        }
    }

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
                js(&format!("{word}."))
            } else {
                js(word)
            }
        });
    }

    t = rewrite_with(
        &t,
        js_re!(r"(?<![\d.,:])(\d{1,2})\.(\d{1,2})\.(\d{4})(?!\d)", "gu"),
        |m, s| match date_day(&g(m, s, 1), &g(m, s, 2)) {
            Some((o, month)) => js(&format!("{o} {month} ")).concat(&g(m, s, 3)),
            None => m.value(s),
        },
    );
    t = rewrite_with(
        &t,
        js_re!(r"(?<![\d.,:])(\d{1,2})\.(\d{1,2})\.(?!\d)", "gu"),
        |m, s| match date_day(&g(m, s, 1), &g(m, s, 2)) {
            Some((o, month)) => js(&format!("{o} {month}")),
            None => m.value(s),
        },
    );

    t = rewrite_with(
        &t,
        js_re!(
            r"(?<=(?:kello|klo\.?)\s)(\d{1,2})[.:](\d{2})(\s+ja\s+|\s*[–—-]\s*)(\d{1,2})[.:](\d{2})(?![\d.,])",
            "giu"
        ),
        |m, s| {
            let a = clock_body(&g(m, s, 1), &g(m, s, 2));
            let b = clock_body(&g(m, s, 4), &g(m, s, 5));
            match (a, b) {
                (Some(a), Some(b)) => a.concat(&g(m, s, 3)).concat(&b),
                _ => m.value(s),
            }
        },
    );
    t = rewrite_with(
        &t,
        js_re!(
            r"(?<=(?:kello|klo\.?)\s)(\d{1,2})[.:](\d{2})(?![\d.,])",
            "giu"
        ),
        |m, s| clock_body(&g(m, s, 1), &g(m, s, 2)).unwrap_or_else(|| m.value(s)),
    );
    t = rewrite_with(
        &t,
        js_re!(
            r"(?<=\()(\d{1,2})[.:](\d{2})(?=\s+(?:UTC|GMT|EET|EEST|koordinoitua)(?![\p{L}\p{M}]))",
            "giu"
        ),
        |m, s| clock_body(&g(m, s, 1), &g(m, s, 2)).unwrap_or_else(|| m.value(s)),
    );

    t = rewrite_with(&t, &ORD_RANGE, |m, s| {
        let x = ordinal(js_number(&g(m, s, 1)));
        let y = ordinal(js_number(&g(m, s, 2)));
        match (x, y) {
            (Some(x), Some(y)) => js(&format!("{x} {y}")),
            _ => m.value(s),
        }
    });
    t = rewrite_with(&t, &ORD_SINGLE, |m, s| {
        ordinal(js_number(&g(m, s, 1))).map_or_else(|| m.value(s), |o| js(&o))
    });

    t = rewrite_with(
        &t,
        js_re!(r"(?<![\d.,:])(\d{1,3}):s(?![\p{L}\p{M}])", "gu"),
        |m, s| ordinal(js_number(&g(m, s, 1))).map_or_else(|| m.value(s), |o| js(&o)),
    );

    t = rewrite(
        &t,
        js_re!(r"(?<=\d)\s*:(?=[a-zåäö])", "gu"),
        &JsString::new(),
    );
    t = rewrite(
        &t,
        js_re!(r"(?<=[%²³]|°[CFcf])\s*:[a-zåäö]+(?![\p{L}\p{M}])", "gu"),
        &JsString::new(),
    );
    t = rewrite(
        &t,
        js_re!(
            r"(?<=\d\s?(?:kg|km|cm|mm|m))\s*:[a-zåäö]+(?![\p{L}\p{M}])",
            "gu"
        ),
        &JsString::new(),
    );

    t = rewrite(
        &t,
        js_re!(
            r"(?<=[bcdfghjklmnpqrstvwxz])['’](?=[a-zåäö]{1,4}(?![\p{L}\p{M}]))",
            "giu"
        ),
        &JsString::new(),
    );

    // A run with two or more commas is a list, not a decimal; a following `,ddd` group is not a list item (#1574).
    let decimal = js_re!(r"(?<!\d,\d*)(\d),(\d+)(?!\d)(?!,\d(?!\d\d(?!\d)))", "gu");
    t = rewrite_with(&t, decimal, |m, s| {
        let frac = JsString::join(&g(m, s, 2).code_point_strings(), &js(" "));
        g(m, s, 1)
            .concat(&js(&format!(" {DECIMAL_WORD} ")))
            .concat(&frac)
    });

    t = rewrite(
        &rewrite(&t, js_re!("℃", "gu"), &js("°C")),
        js_re!("℉", "gu"),
        &js("°F"),
    );
    t = rewrite(
        &t,
        js_re!(r"(\d)\s*°\s*C(?![\p{L}\p{M}])", "gui"),
        &js("$1 astetta"),
    );
    t = rewrite(
        &t,
        js_re!(r"(\d)\s*°\s*F(?![\p{L}\p{M}])", "gui"),
        &js("$1 astetta fahrenheitia"),
    );
    t = rewrite(&t, js_re!(r"(\d)\s*°", "gu"), &js("$1 astetta"));

    t = rewrite(
        &t,
        js_re!(r"(?<![\p{L}\p{M}\d])[-−–](?=\d)", "gu"),
        &js("miinus "),
    );
    t = rewrite(
        &t,
        js_re!(r"(?<![\p{L}\p{M}\d])\+(?=\d)", "gu"),
        &js("plus "),
    );
    t = rewrite(&t, js_re!(r"(?<=\d)\s*\+\s*(?=\d)", "gu"), &js(" plus "));

    t = rewrite(
        &rewrite(
            &rewrite(&t, js_re!("=", "gu"), &js(" yhtä suuri kuin ")),
            js_re!("<", "gu"),
            &js(" pienempi kuin "),
        ),
        js_re!(">", "gu"),
        &js(" suurempi kuin "),
    );

    t = rewrite(
        &rewrite(&t, js_re!("&amp;", "gu"), &js("&")),
        js_re!(r"\s*[&＆]\s*", "gu"),
        &js(" ja "),
    );

    rewrite(&t, js_re!(r"[ \t]{2,}", "gu"), &js(" "))
}

static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| Arc::new(letter_name));

/// `normalizeFinnishInitialisms(text)`: the colon inflection first, then the shared pass (nothing is recorded).
pub fn normalize_finnish_initialisms(text: &JsString) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: LETTER_NAME.clone(),
            lower: None,
            acronym_letters: Arc::new(is_acronym_letters),
            is_recorded: |_: &JsString| false,
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(&resolve_colon_inflection(text))
}

/// `resolveColonInflection(text)`: `CIA:n` → *see ii aan*; any other capitalised head just loses its colon.
fn resolve_colon_inflection(text: &JsString) -> JsString {
    rewrite_with(
        text,
        js_re!(
            r"(?<![\p{L}\p{M}])(\p{Lu}[\p{L}\p{M}\d]*):([a-zåäö]+)(?![\p{L}\p{M}])",
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
            if !is_acronym_letters(&lower) && !is_unreadable_finnish(&lower) {
                return glued;
            }
            let letters = lower.code_point_strings();
            let last = letters.len() - 1;
            let names: Option<Vec<JsString>> = letters
                .iter()
                .enumerate()
                .map(|(i, l)| {
                    if i == last {
                        letter_name_long(l).or_else(|| letter_name(l))
                    } else {
                        letter_name(l)
                    }
                })
                .collect();
            match names {
                Some(n) => JsString::join(&n, &js(" ")).concat(&suf),
                None => glued,
            }
        },
    )
}
