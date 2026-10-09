//! French text normalization: the pre-tokenizer pass that rewrites what is not yet a pronounceable word
//! (digit groups, era markers, abbreviations, money, signs, fractions, times, dates), and the separately-run
//! initialism pass. Ported from src/languages/french/normalize.ts — see that file for why the order is
//! load-bearing.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::manifest::MANIFEST;
use super::numbers::number_to_words_loaded;
use super::ordinals::ordinal_loaded;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{alternation, sorted_by_length_desc};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const GROUP_SPACE: &str = " \u{a0}\u{202f}\u{2009}";

fn currency_words(sym: &JsString) -> (&'static str, &'static str) {
    match sym.to_string_lossy().as_str() {
        "€" => ("euro", "euros"),
        "$" => ("dollar", "dollars"),
        "£" => ("livre", "livres"),
        "¥" => ("yen", "yens"),
        // The capture is one of exactly these four signs.
        other => unreachable!("currency sign {other}"),
    }
}

const MONTHS: &str =
    "janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre";

/// `DOTTED_ABBREV`, in the object literal's key order.
const DOTTED_ABBREV: [(&str, &str); 26] = [
    ("m", "monsieur"),
    ("mm", "messieurs"),
    ("mme", "madame"),
    ("mmes", "mesdames"),
    ("mlle", "mademoiselle"),
    ("mlles", "mesdemoiselles"),
    ("dr", "docteur"),
    ("pr", "professeur"),
    ("st", "saint"),
    ("ste", "sainte"),
    ("sts", "saints"),
    ("stes", "saintes"),
    ("cf", "confer"),
    ("ex", "exemple"),
    ("env", "environ"),
    ("p", "page"),
    ("pp", "pages"),
    ("art", "article"),
    ("vol", "volume"),
    ("chap", "chapitre"),
    ("éd", "édition"),
    ("av", "avenue"),
    ("bd", "boulevard"),
    ("bld", "boulevard"),
    ("jr", "junior"),
    ("tél", "téléphone"),
];

const DOT_ONLY: [&str; 5] = ["etc", "mme", "mmes", "mlle", "mlles"];

fn dotted(key: &JsString) -> Option<&'static str> {
    DOTTED_ABBREV
        .iter()
        .find(|(k, _)| key == *k)
        .map(|(_, v)| *v)
}

fn dot_only(key: &JsString) -> bool {
    DOT_ONLY.iter().any(|k| key == *k)
}

fn undotted(key: &JsString) -> Option<&'static str> {
    match key.to_string_lossy().as_str() {
        "dr" => Some("docteur"),
        "pr" => Some("professeur"),
        _ => None,
    }
}

static IS_UNREADABLE: LazyLock<Arc<dyn Fn(&JsString) -> bool + Send + Sync>> =
    LazyLock::new(|| {
        let p = &MANIFEST.phonotactics;
        Arc::new(make_unreadable_test(PhonotacticsData {
            vowels: JsRegex::new(&format!("[{}]", p.vowels), "u").unwrap(),
            legal_onsets: p.onsets.iter().map(|o| js(o)).collect(),
            legal_codas: p.codas.iter().map(|c| js(c)).collect(),
            liquids: None,
            digraphs: None,
        }))
    });

/// `isUnreadableFrench`: the phonotactic test the initialism pass consults.
pub(crate) fn is_unreadable_french_loaded(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.acronym_letters.iter().map(|w| js(w)).collect());

fn feminine_words(n: f64) -> JsString {
    js_re!(r"(^|[-\s])un$", "u").replace(&number_to_words_loaded(n, None), &js("$1une"))
}

fn time_words(h: f64, min: Option<f64>) -> JsString {
    let hour_word = if h == 1.0 { "heure" } else { "heures" };
    let head = feminine_words(h).concat(&js(&format!(" {hour_word}")));
    match min {
        None => head,
        Some(m) if m == 0.0 => head,
        Some(m) => head.concat(&js(" ")).concat(&feminine_words(m)),
    }
}

fn fraction_words(num: f64, den: f64) -> Option<JsString> {
    let suppletive = match den {
        2.0 => Some(js("demi")),
        3.0 => Some(js("tiers")),
        4.0 => Some(js("quart")),
        _ => None,
    };
    let base = suppletive.or_else(|| ordinal_loaded(den, false, false))?;
    if den < 2.0 {
        return None;
    }
    let plural = if num > 1.0 && !base.ends_with(&js("s")) {
        base.concat(&js("s"))
    } else {
        base
    };
    Some(
        number_to_words_loaded(num, None)
            .concat(&js(" "))
            .concat(&plural),
    )
}

/// `[...Object.keys(DOTTED_ABBREV), ...DOT_ONLY].sort((a, b) => b.length - a.length).join("|")`.
static ABBREV_ALT: LazyLock<String> = LazyLock::new(|| {
    alternation(&sorted_by_length_desc(
        DOTTED_ABBREV
            .iter()
            .map(|(k, _)| js(k))
            .chain(DOT_ONLY.iter().map(|k| js(k))),
    ))
});

static DIGIT_GROUP: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<=\d)(?<!(?<![\d\.,])0)[{GROUP_SPACE}](?=\d{{3}}(?!\d))"),
        "gu",
    )
    .unwrap()
});
static ABBREV_CONTINUED: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!(r"\b({})\.(\s+)(?=\p{{L}})", *ABBREV_ALT), "giu").unwrap()
});
static ABBREV_FINAL: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"\b({})\.(?=\s*(?:[.,;:!?»)]|$))", *ABBREV_ALT),
        "giu",
    )
    .unwrap()
});
static NUMERIC_DATE: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b", "gu").unwrap());
static FIRST_OF_MONTH: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"\b1\s+({MONTHS})\b",), "giu").unwrap());

fn g(m: &JsMatch, i: usize, s: &JsString) -> JsString {
    m.group(i, s).expect("participating group")
}

/// `String(Number(x))` for a short digit capture.
fn num_str(x: &JsString) -> String {
    format!("{}", js_number(x) as u64)
}

fn money(int: &JsString, cents: &JsString, sym: &JsString) -> JsString {
    let (sg, pl) = currency_words(sym);
    let unit = if *int == "1" { sg } else { pl };
    if *cents == "00" {
        int.concat(&js(&format!(" {unit}")))
    } else {
        int.concat(&js(&format!(" {unit} {}", num_str(cents))))
    }
}

/// `normalizeFrench(input, isWord)`. Pure text→text.
///
/// `_is_word` mirrors the TS signature and is UNUSED there too (its docstring describes a decision that moved to
/// `normalizeFrenchInitialisms`); kept until the TS drops it, reported in rust_fr_port_investigation.md.
pub(crate) fn normalize_french_loaded(
    input: &JsString,
    _is_word: &dyn Fn(&JsString) -> bool,
) -> JsString {
    let mut s = input.clone();

    // 0) digit grouping (twice: millions), then the remaining no-break spaces.
    s = rewrite(&s, &DIGIT_GROUP, &JsString::new());
    s = rewrite(&s, &DIGIT_GROUP, &JsString::new());
    s = rewrite(&s, js_re!(r"[   ]", "gu"), &js(" "));

    // 1) era markers.
    s = rewrite(
        &s,
        js_re!(r"\bav(?:ant)?\.?\s*j\.?\s*-?\s*c\.?", "giu"),
        &js("avant Jésus-Christ"),
    );
    s = rewrite(
        &s,
        js_re!(r"\bapr(?:ès)?\.?\s*j\.?\s*-?\s*c\.?", "giu"),
        &js("après Jésus-Christ"),
    );

    // 1b) the spaced degree sign.
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*°\s*(?=[CF](?![\p{L}\p{M}]))", "gui"),
        &js("$1°"),
    );

    // 2) numéro.
    s = rewrite(&s, js_re!(r"\bn[°º]\s*(?=\d)", "giu"), &js("numéro "));

    // 3) dotted abbreviations.
    s = rewrite_with(&s, &ABBREV_CONTINUED, |m, x| {
        let (ab, sp) = (g(m, 1, x), g(m, 2, x));
        let key = ab.to_lower_case();
        if dot_only(&key) {
            return ab.concat(&sp);
        }
        // ⚠ reachable miss (#1122): `ſt.` matches the alternation under `iu` and keeps its long s.
        match dotted(&key) {
            None => m.value(x),
            Some(w0) => js(w0).concat(&sp),
        }
    });
    s = rewrite_with(&s, &ABBREV_FINAL, |m, x| {
        let ab = g(m, 1, x);
        let key = ab.to_lower_case();
        if dot_only(&key) {
            return m.value(x);
        }
        match dotted(&key) {
            None => m.value(x),
            Some(w0) => js(&format!("{w0}.")),
        }
    });

    // 3b) undotted abbreviations.
    s = rewrite_with(&s, js_re!(r"\b(dr|pr)\b\.?(?=\s+\p{L})", "giu"), |m, x| {
        undotted(&g(m, 1, x).to_lower_case()).map_or_else(|| m.value(x), js)
    });

    // 4) name initials.
    s = rewrite_with(
        &s,
        js_re!(r"\b([a-zà-ÿ])\.(\s+)(?=[\p{L}])", "giu"),
        |m, x| {
            let (ltr, sp) = (g(m, 1, x), g(m, 2, x));
            match MANIFEST
                .letter_names
                .get(&ltr.to_lower_case().to_string_lossy())
            {
                None => m.value(x),
                Some(name) => js(name).concat(&sp),
            }
        },
    );

    // 4b) money with centimes, both orders.
    s = rewrite_with(&s, js_re!(r"(\d+),(\d{2})\s?([€$£¥])", "gu"), |m, x| {
        money(&g(m, 1, x), &g(m, 2, x), &g(m, 3, x))
    });
    s = rewrite_with(&s, js_re!(r"([€$£¥])\s?(\d+),(\d{2})", "gu"), |m, x| {
        money(&g(m, 2, x), &g(m, 3, x), &g(m, 1, x))
    });

    // 4c) plus, ±.
    s = rewrite(&s, js_re!(r"±", "gu"), &js(" plus moins "));
    s = rewrite(&s, js_re!(r"(\S)\+\s?(\d)", "gu"), &js("$1 plus $2"));
    s = rewrite(&s, js_re!(r"(^|\s)\+\s?(\d)", "gu"), &js("$1plus $2"));

    // 5) negatives.
    s = rewrite(&s, js_re!(r"(^|[\s(])[-−–](\d)", "gu"), &js("$1moins $2"));

    // 5b) relational and division signs.
    s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" est égal à "));
    s = rewrite(&s, js_re!(r"\s?<\s?", "gu"), &js(" est inférieur à "));
    s = rewrite(&s, js_re!(r"\s?>\s?", "gu"), &js(" est supérieur à "));
    s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" divisé par "));

    // 6) fractions.
    s = rewrite_with(
        &s,
        js_re!(r"\b(\d{1,3})\/(\d{1,3})\b(?!\s*\/?\d)", "gu"),
        |m, x| {
            fraction_words(js_number(&g(m, 1, x)), js_number(&g(m, 2, x)))
                .unwrap_or_else(|| m.value(x))
        },
    );

    // 7) times: the `h` form, then the colon form (declining a fractional part).
    s = rewrite_with(
        &s,
        js_re!(
            r"\b([01]?\d|2[0-3])\s*[hH]\s*([0-5]\d)?(?![\p{L}\p{M}\d])",
            "gu"
        ),
        |m, x| time_words(js_number(&g(m, 1, x)), m.group(2, x).map(|v| js_number(&v))),
    );
    s = rewrite_with(
        &s,
        js_re!(r"\b([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?!\.\d)", "gu"),
        |m, x| time_words(js_number(&g(m, 1, x)), Some(js_number(&g(m, 2, x)))),
    );

    // 8) dates: numeric day-first, then the 1st before a month name.
    s = rewrite_with(&s, &NUMERIC_DATE, |m, x| {
        let (d, mo, y) = (g(m, 1, x), g(m, 2, x), g(m, 3, x));
        let mi = js_number(&mo) - 1.0;
        let month = if mi >= 0.0 {
            MONTHS.split('|').nth(mi as usize)
        } else {
            None
        };
        let dn = js_number(&d);
        let Some(month) = month.filter(|_| (1.0..=31.0).contains(&dn)) else {
            return m.value(x);
        };
        let day = if dn == 1.0 {
            ordinal_loaded(1.0, false, false).unwrap()
        } else {
            d
        };
        day.concat(&js(&format!(" {month} "))).concat(&y)
    });
    s = rewrite_with(&s, &FIRST_OF_MONTH, |m, x| {
        ordinal_loaded(1.0, false, false)
            .unwrap()
            .concat(&js(" "))
            .concat(&g(m, 1, x))
    });

    s
}

static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| {
    Arc::new(|l: &JsString| {
        MANIFEST
            .letter_names
            .get(&l.to_string_lossy())
            .map(|n| js(n))
    })
});

/// `normalizeFrenchInitialisms(text, isRecorded)`: runs after the numeral passes, claiming only what they
/// declined.
pub(crate) fn normalize_french_initialisms_loaded(
    text: &JsString,
    is_recorded: &dyn Fn(&JsString) -> bool,
) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: LETTER_NAME.clone(),
            lower: None,
            acronym_letters: Arc::new(|w: &JsString| ACRONYM_LETTERS.contains(w)),
            is_recorded,
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(text)
}

/// `normalizeFrench(input, isWord)`, or why the manifest is unavailable.
pub fn normalize_french(
    input: &JsString,
    is_word: &dyn Fn(&JsString) -> bool,
) -> Result<JsString, String> {
    super::manifest::try_manifest()?;
    Ok(normalize_french_loaded(input, is_word))
}

/// `normalizeFrenchInitialisms(text, isRecorded)`, or why the manifest is unavailable.
pub fn normalize_french_initialisms(
    text: &JsString,
    is_recorded: &dyn Fn(&JsString) -> bool,
) -> Result<JsString, String> {
    super::manifest::try_manifest()?;
    Ok(normalize_french_initialisms_loaded(text, is_recorded))
}

/// `isUnreadableFrench(word)`, or why the manifest is unavailable.
pub fn is_unreadable_french(word: &JsString) -> Result<bool, String> {
    super::manifest::try_manifest()?;
    Ok(is_unreadable_french_loaded(word))
}
