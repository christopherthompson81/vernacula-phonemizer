//! Turkmen (tk) text normalization: the ñ/ÿ tilde fold, digit grouping, magnitude and era abbreviations, suffixed
//! percents and years, the numero sign, the written `N-nji` ordinal, fractions, signs, degrees, ranges; plus
//! `ordinalOf`, the initialism pass and the phonotactic test. Ported from src/languages/turkmen/normalize.ts —
//! see that file for the corpus evidence.

use std::sync::{Arc, LazyLock};

use super::numbers::number_to_words;
use crate::core::boundaries::{NOT_LETTER_AFTER, NOT_LETTER_BEFORE};
use crate::core::initialisms::{
    InitialismData, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `cardinal(n)`: the number words, space-joined.
fn cardinal(n: f64) -> JsString {
    js(&number_to_words(n).join(" "))
}

const FRONT: &str = "äeiöü";
const ROUNDED: &str = "oöuü";
const VOWELS: &str = "aäeioöuüy";

fn in_set(set: &str, c: &str) -> bool {
    // `SET.includes(c)` on one code point (never empty here).
    set.contains(c)
}

/// `[...w].filter((c) => VOWELS.includes(c))`, last.
fn last_vowel(w: &str) -> Option<String> {
    w.chars()
        .rev()
        .map(|c| c.to_string())
        .find(|c| in_set(VOWELS, c))
}

/// `ordinalOf(n, front)`: the cardinal with -(I)nji / -(I)njy on its last word; `None` where none is built.
pub(crate) fn ordinal_of(n: f64, front: bool) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || n < 0.0 {
        return None;
    }
    let mut words: Vec<String> = cardinal(n)
        .split(&js(" "))
        .iter()
        .map(|w| w.to_string_lossy())
        .collect();
    let mut last = words.last().cloned().filter(|l| !l.is_empty())?;
    let suffix = if front { "nji" } else { "njy" };
    // `VOWELS.includes(last.at(-1))`: the last code unit (every vowel here is one).
    let ends_in_vowel = js(&last)
        .units()
        .last()
        .is_some_and(|&u| VOWELS.encode_utf16().any(|v| v == u));
    if ends_in_vowel {
        *words.last_mut().unwrap() = format!("{last}{suffix}");
        return Some(js(&words.join(" ")));
    }
    if last == "dört" {
        last = "dörd".into();
    }
    let vowels: Vec<char> = last.chars().filter(|c| VOWELS.contains(*c)).collect();
    let v = *vowels.last()?;
    let round = ROUNDED.contains(v) && vowels.len() == 1;
    let link = if FRONT.contains(v) {
        if round { "ü" } else { "i" }
    } else if round {
        "u"
    } else {
        "y"
    };
    *words.last_mut().unwrap() = format!("{last}{link}{suffix}");
    Some(js(&words.join(" ")))
}

/// `LETTER_NAME`. Generated from normalize.ts's object literal.
const LETTER_NAME: [(&str, &str); 30] = [
    ("a", "a"),
    ("b", "be"),
    ("ç", "çe"),
    ("d", "de"),
    ("e", "e"),
    ("ä", "ä"),
    ("f", "fe"),
    ("g", "ge"),
    ("h", "he"),
    ("i", "i"),
    ("j", "je"),
    ("ž", "že"),
    ("k", "ka"),
    ("l", "el"),
    ("m", "em"),
    ("n", "en"),
    ("ň", "eň"),
    ("o", "o"),
    ("ö", "ö"),
    ("p", "pe"),
    ("r", "er"),
    ("s", "es"),
    ("ş", "şe"),
    ("t", "te"),
    ("u", "u"),
    ("ü", "ü"),
    ("w", "we"),
    ("y", "y"),
    ("ý", "ýe"),
    ("z", "ze"),
];

type WordTest = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

static IS_UNREADABLE: LazyLock<WordTest> = LazyLock::new(|| {
    let set = |v: &[&str]| v.iter().map(|s| js(s)).collect();
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(r"[aäeiouöüyý]", "u").unwrap(),
        legal_onsets: set(&[
            "br", "bl", "gr", "gl", "dr", "kr", "kl", "pl", "pr", "st", "sp", "sk", "tr",
        ]),
        legal_codas: set(&[
            "rk", "rt", "rd", "lt", "ld", "st", "şt", "nt", "nd", "ňk", "rs", "lk", "çt",
        ]),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableTurkmen(word)`.
pub(crate) fn is_unreadable_turkmen(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

const ACRONYM_LETTERS: [&str; 9] = [
    "abş", "bmg", "sssr", "tdng", "msz", "gar", "tmg", "htu", "httu",
];

/// `normalizeTurkmenInitialisms(text)`. `LETTER_NAME[l]`: `l` is one lowercased code point, which no
/// `Object.prototype` member is.
pub(crate) fn normalize_turkmen_initialisms(text: &JsString) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: Arc::new(|l: &JsString| {
                LETTER_NAME
                    .iter()
                    .find(|(c, _)| *l == **c)
                    .map(|(_, n)| js(n))
            }),
            lower: None,
            acronym_letters: Arc::new(|w: &JsString| ACRONYM_LETTERS.iter().any(|a| *w == **a)),
            is_recorded: |_: &JsString| false,
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(text)
}

const SFX: &str = "[a-zäçžňöşüý]";

/// `foldTurkmenTildes(input)`: ñ → ň and ÿ → ý inside a word made only of Turkmen letters (plus the tildes).
pub(crate) fn fold_turkmen_tildes(input: &JsString) -> JsString {
    if !js_re!(r"[ñÿÑŸ]", "u").test(input) {
        return input.clone();
    }
    rewrite_with(input, js_re!(r"[\p{L}\p{M}]+", "gu"), |m, t| {
        let w = m.value(t);
        if !js_re!(r"^[a-zäçžňöşüýñÿ]+$", "iu").test(&w) {
            return w;
        }
        let w = js_re!(r"ñ", "gu").replace(&w, &js("ň"));
        let w = js_re!(r"Ñ", "gu").replace(&w, &js("Ň"));
        let w = js_re!(r"ÿ", "gu").replace(&w, &js("ý"));
        js_re!(r"Ÿ", "gu").replace(&w, &js("Ý"))
    })
}

/// `attachOrdinal(whole, digits, rawSuffix)`: the spoken ordinal, keeping whatever case the written suffix
/// carries past the ordinal ending.
fn attach_ordinal(whole: &JsString, digits: &JsString, raw_suffix: &JsString) -> JsString {
    let n = js_number(digits);
    if !is_safe_integer(n) {
        return whole.clone();
    }
    let suffix = raw_suffix.to_lower_case();
    let front = [js("nji"), js("inji"), js("ünji")]
        .iter()
        .any(|p| suffix.starts_with(p));
    let Some(ord) = ordinal_of(n, front) else {
        return whole.clone();
    };
    let mut k = ord.len().min(suffix.len());
    while k >= 3 {
        if ord.ends_with(&suffix.slice(0, Some(k as isize))) {
            return ord.concat(&suffix.slice(k as isize, None));
        }
        k -= 1;
    }
    whole.clone()
}

fn g(m: &JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

struct Built {
    mlrd: JsRegex,
    mln: JsRegex,
    multi: [(JsRegex, &'static str); 3],
    percent_suffix: JsRegex,
    year: JsRegex,
    ordinal: JsRegex,
    celsius_suffix: JsRegex,
}

/// The patterns normalize.ts builds with `new RegExp`, built once.
static BUILT: LazyLock<Built> = LazyLock::new(|| {
    let re = |p: String, f: &str| JsRegex::new(&p, f).unwrap();
    let (b, a) = (NOT_LETTER_BEFORE, NOT_LETTER_AFTER);
    Built {
        mlrd: re(format!(r"{b}mlrd\.?{a}"), "giu"),
        mln: re(format!(r"{b}mln\.?{a}"), "giu"),
        multi: [
            (
                re(format!(r"{b}b\.\s?e\.\s?ö\.()"), "giu"),
                "biziň eramyzdan öň",
            ),
            (
                re(format!(r"{b}b\.\s?e\.\s?öň(ki)?{a}"), "giu"),
                "biziň eramyzdan öň",
            ),
            (
                re(format!(r"{b}b\.\s?e\.()(?=\s|$)"), "giu"),
                "biziň eramyz",
            ),
        ],
        percent_suffix: re(format!(r"(\d+)\s?%\s?-\s?({SFX}{{1,5}}){a}"), "gu"),
        year: re(format!(r"(\d)\s?ý\.?{a}"), "gu"),
        ordinal: re(
            format!(r"(?<![\d.,])(\d+)\s?-\s?((?:[yiuü])?nj[yi]{SFX}{{0,6}}){a}"),
            "giu",
        ),
        celsius_suffix: re(format!(r"(\d)\s?°\s?[Cc]\s?-\s?({SFX}{{1,4}}){a}"), "gu"),
    }
});

/// `normalizeTurkmen(input)`. The steps are order-dependent, as in the TS.
pub(crate) fn normalize_turkmen(input: &JsString) -> JsString {
    let bt = &*BUILT;
    let mut s = fold_turkmen_tildes(input);

    // Digit grouping by any space, then every space variant to ASCII.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:[ \u00a0\u202f\u2009]\d{3})+)(?!\d)",
            "gu"
        ),
        |m, t| {
            g(m, t, 1).concat(
                &js_re!(r"[ \u00a0\u202f\u2009]", "gu").replace(&g(m, t, 2), &JsString::new()),
            )
        },
    );
    s = rewrite(&s, js_re!(r"[ \u00a0\u202f\u2009]", "gu"), &js(" "));

    // Magnitude abbreviations.
    s = rewrite(&s, &bt.mlrd, &js("milliard"));
    s = rewrite(&s, &bt.mln, &js("million"));

    // Era markers; the final dot is kept as the period when nothing but closing punctuation follows.
    for (re, word) in bt.multi.iter() {
        s = rewrite_with(&s, re, |m, t| {
            let out = js(word).concat(&m.group(1, t).unwrap_or_default());
            let rest = t.slice(m.end() as isize, None);
            if js_re!(r#"^\s*["»)']?\s*$"#, "u").test(&rest) {
                out.concat(&js("."))
            } else {
                out
            }
        });
    }

    // A percent with a case suffix; the year abbreviation; the numero sign.
    s = rewrite(&s, &bt.percent_suffix, &js("$1 göterim$2"));
    s = rewrite(&s, &bt.year, &js("$1 ýyl"));
    s = rewrite(&s, js_re!(r"№\s?(?=\d)", "gu"), &js("belgi "));

    // The written ordinal `N-nji…`.
    s = rewrite_with(&s, &bt.ordinal, |m, t| {
        attach_ordinal(&m.value(t), &g(m, t, 1), &g(m, t, 2))
    });

    // Fractions: the denominator in the ablative, then the numerator.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,/])(\d{1,2})\s?\/\s?(\d{1,2})(?![\d.,/])", "gu"),
        |m, t| {
            let (nv, dv) = (js_number(&g(m, t, 1)), js_number(&g(m, t, 2)));
            if !(nv >= 1.0 && nv < dv && dv <= 12.0) {
                return m.value(t);
            }
            let dw = cardinal(dv);
            let Some(v) = last_vowel(&dw.to_string_lossy()) else {
                return m.value(t);
            };
            dw.concat(&js(if in_set(FRONT, &v) { "den " } else { "dan " }))
                .concat(&cardinal(nv))
        },
    );

    // Signs.
    s = rewrite(
        &s,
        // the en dash is a sign only when it touches the digit; spaced, it is punctuation (#1576)
        js_re!(r"(^|(?<!\d)[\s(])(?:[-−]\s?|–)(\d)", "gu"),
        &js("$1minus $2"),
    );
    s = rewrite(&s, js_re!(r"±", "gu"), &js(" plýus minus "));
    s = rewrite(&s, js_re!(r"(^|[\s(])\+\s?(\d)", "gu"), &js("$1plýus $2"));

    // Degrees.
    s = rewrite(
        &s,
        js_re!(r#"(\d)\s?°\s?(\d+)\s?[′']\s?(\d+)\s?[″"]"#, "gu"),
        &js("$1 gradus $2 minut $3 sekunt "),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?(\d+)\s?[′']", "gu"),
        &js("$1 gradus $2 minut "),
    );
    s = rewrite(&s, &bt.celsius_suffix, &js("$1 gradus Selsi$2"));
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?C(?![\p{L}\p{M}])", "gui"),
        &js("$1 gradus Selsi"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?F(?![\p{L}\p{M}])", "gui"),
        &js("$1 gradus Farengeýt"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?(dan|den)(?![\p{L}\p{M}])", "gu"),
        &js("$1 gradus$2"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°(?!\s*gradus)", "gu"),
        &js("$1 gradus "),
    );
    s = rewrite(&s, js_re!(r"(\d)\s?°(?=\s*gradus)", "gu"), &js("$1 "));

    // Ranges and slashes between numbers read as a pause.
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\s?\/\s?(?=\d)", "gu"),
        &js("$1, "),
    );
    s = rewrite(&s, js_re!(r"(\d)\s?[–—]\s?(?=\d)", "gu"), &js("$1, "));
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\s?-\s?(?=\d)", "gu"),
        &js("$1, "),
    );
    rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" "))
}
