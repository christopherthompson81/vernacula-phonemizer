//! Hungarian (hu) text normalization: multiplication, era and dotted abbreviations, digit de-grouping, the
//! clock, units / percent / degrees with a hyphen suffix, the shared symbol tier, signs, relational signs and
//! division, decimals, the year/date/general ordinals, the numeral + hyphen suffix, and the acronyms (hyphen
//! suffix, lexical overrides, the shared initialism pass).
//! Ported from src/languages/hungarian/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::{Arc, LazyLock};

use super::manifest::MANIFEST;
use super::numbers::{multiplicative_words, number_to_words, ordinal_words, stem_for_suffix};
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::normalize_symbols::{
    SymbolData, SymbolNormalizer, UnitPer, make_symbol_normalizer,
};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const LOWER: &str = "a-záéíóöőúüű";

const MONTH: &str = "(?:janu[áa]r|febru[áa]r|m[áa]rcius|[áa]prilis|m[áa]jus|j[úu]nius|j[úu]lius|augusztus|szeptember|okt[óo]ber|november|december)";

/// `DOTTED_ABBREV`, in the TS object's key order.
const DOTTED_ABBREV: [(&str, &str); 5] = [
    ("pl", "például"),
    ("kb", "körülbelül"),
    ("stb", "satöbbi"),
    ("ld", "lásd"),
    ("dr", "doktor"),
];

/// `DOTTED_ABBREV[key]`; a miss (a key the `i` fold widened, e.g. a long s) stringifies `undefined`, as the
/// TS template does.
fn dotted_abbrev(key: &JsString) -> JsString {
    DOTTED_ABBREV
        .iter()
        .find(|(k, _)| js(k) == *key)
        .map_or_else(|| js("undefined"), |(_, v)| js(v))
}

fn longest_first_alt(keys: &[&str]) -> String {
    let mut ks: Vec<&str> = keys.to_vec();
    ks.sort_by_key(|k| std::cmp::Reverse(js(k).len()));
    ks.join("|")
}

static ABBREV_ALT: LazyLock<String> =
    LazyLock::new(|| longest_first_alt(&DOTTED_ABBREV.iter().map(|(k, _)| *k).collect::<Vec<_>>()));

const DIGRAPH_FOLD: [(&str, &str); 9] = [
    ("dzs", "z"),
    ("sz", "s"),
    ("zs", "z"),
    ("cs", "c"),
    ("gy", "g"),
    ("ny", "n"),
    ("ty", "t"),
    ("ly", "j"),
    ("dz", "z"),
];

/// `fold(w)`: each Hungarian digraph to its stand-in letter.
fn fold(w: &JsString) -> JsString {
    js_re!("dzs|sz|zs|cs|gy|ny|ty|ly|dz", "gu").replace_with(w, |m, s| {
        let d = m.value(s);
        js(DIGRAPH_FOLD.iter().find(|(k, _)| js(k) == d).unwrap().1)
    })
}

type Predicate = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

static UNREADABLE_FOLDED: LazyLock<Predicate> = LazyLock::new(|| {
    let p = &MANIFEST.phonotactics;
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(&format!("[{}]", p.vowels), "u").unwrap(),
        legal_onsets: p.onsets.iter().map(|o| js(o)).collect(),
        legal_codas: p.codas.iter().map(|c| js(c)).collect(),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableHungarian(word)`: the phonotactic test on the digraph-folded lowercase word.
pub fn is_unreadable_hungarian(word: &JsString) -> bool {
    UNREADABLE_FOLDED(&fold(&word.to_lower_case()))
}

/// `MANIFEST.letterNames[l]` (`l` is one lowercased code point, which no `Object.prototype` member's name is).
fn letter_name(l: &JsString) -> Option<JsString> {
    MANIFEST
        .letter_names
        .get(&l.to_string_lossy())
        .map(|v| js(v))
}

/// `spellOut(acr)`: letter by letter, or `None` if any code point has no name.
fn spell_out(acr: &JsString) -> Option<JsString> {
    let names: Option<Vec<JsString>> = acr
        .to_lower_case()
        .code_point_strings()
        .iter()
        .map(letter_name)
        .collect();
    names.map(|n| JsString::join(&n, &js(" ")))
}

const ACRONYM_WORD: [(&str, &str); 1] = [("WC", "vécé")];

static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| Arc::new(letter_name));

/// `normalizeInitialisms`: nothing recorded, no lexical acronym letters.
fn normalize_initialisms(text: &JsString) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: LETTER_NAME.clone(),
            lower: None,
            acronym_letters: Arc::new(|_: &JsString| false),
            is_recorded: |_: &JsString| false,
            is_unreadable: Arc::new(is_unreadable_hungarian),
        },
        true,
    )(text)
}

/// `normalizeSymbols`: the shared tier over the manifest's `symbolTier` (default count form).
static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let t = &MANIFEST.symbol_tier;
    make_symbol_normalizer(&SymbolData {
        percent: Some(t.percent.clone()),
        currency: Some(t.currency.clone()),
        units: Some(t.units.clone()),
        rate_denominators: Some(t.rate_denominators.clone()),
        unit_per: Some(UnitPer::All(t.unit_per.clone())),
        exponent_words: Some(t.exponent_words.clone()),
        ampersand: Some(t.ampersand.clone()),
        ..Default::default()
    })
});

/// The symbol tier, or why it refused its data (checked by `createHungarian`).
pub(crate) fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    SYMBOLS.as_ref().map_err(|e| e.clone())
}

/// `SUFFIXABLE_UNIT`, in the TS object's key order.
const SUFFIXABLE_UNIT: [(&str, &str); 5] = [
    ("km", "kilométer"),
    ("mm", "milliméter"),
    ("cm", "centiméter"),
    ("kg", "kilogramm"),
    ("mérföld", "mérföld"),
];

/// `attachSuffix(words, suffix)`: the suffix on the last word, stem-shortened before a vowel.
fn attach_suffix(words: &JsString, suffix: &JsString) -> JsString {
    let mut parts = words.split(&js(" "));
    let last = parts.last_mut().unwrap();
    *last = stem_for_suffix(last, suffix).concat(suffix);
    JsString::join(&parts, &js(" "))
}

/// `dateStem(n)`: *elsej* for 1, else the ordinal.
fn date_stem(n: f64) -> Option<JsString> {
    if n == 1.0 {
        return Some(js("elsej"));
    }
    ordinal_words(n)
}

/// `dateNominative(n)`: the stem plus the linking vowel chosen by the vowel before `-dik`.
fn date_nominative(n: f64) -> Option<JsString> {
    let stem = date_stem(n)?;
    if n == 1.0 {
        return Some(js("elseje"));
    }
    let before = stem.slice(0, Some(-3)).slice(-1, None);
    let link = if js_re!("[aáoóuú]", "u").test(&before) {
        "a"
    } else {
        "e"
    };
    Some(stem.concat(&js(link)))
}

/// `huLinkVowel(stem)`: the last vowel decides harmony (`harminc` excepted).
fn hu_link_vowel(stem: &JsString) -> &'static str {
    if stem.ends_with(&js("harminc")) {
        return "a";
    }
    let last = stem
        .code_point_strings()
        .into_iter()
        .rfind(|c| js_re!("[aáeéiíoóöőuúüű]", "u").test(c));
    match last {
        Some(v) if js_re!("[aáoóuú]", "u").test(&v) => "a",
        _ => "e",
    }
}

const HU_DIGRAPH: [&str; 8] = ["gy", "sz", "cs", "ny", "ly", "ty", "zs", "dz"];

/// `huInstrumental(w)`: -val/-vel on the last word, with harmony and digraph-aware doubling.
fn hu_instrumental(w: &JsString) -> JsString {
    let cut = w.last_index_of(&js(" ")).map_or(0, |i| i + 1);
    let (head, stem) = (w.slice(0, Some(cut as isize)), w.slice(cut as isize, None));
    let v = hu_link_vowel(&stem);
    if js_re!("[aáeéiíoóöőuúüű]$", "u").test(&stem) {
        return head.concat(&stem).concat(&js(&format!("v{v}l")));
    }
    let doubled = match HU_DIGRAPH.iter().find(|d| stem.ends_with(&js(d))) {
        Some(dg) => {
            let dg = js(dg);
            stem.slice(0, Some(-(dg.len() as isize)))
                .concat(&dg.slice(0, Some(1)))
                .concat(&dg)
        }
        None => stem.concat(&stem.slice(-1, None)),
    };
    head.concat(&doubled).concat(&js(&format!("{v}l")))
}

static ABBREV_CONT: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}])({})\.(\s+)(?=[\p{{L}}\d])",
            *ABBREV_ALT
        ),
        "giu",
    )
    .unwrap()
});
static ABBREV_END: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}])({})\.(?=\s*(?:[.,;:!?»)\]]|$))",
            *ABBREV_ALT
        ),
        "giu",
    )
    .unwrap()
});
static UNIT_SUFFIX: LazyLock<JsRegex> = LazyLock::new(|| {
    let alt = longest_first_alt(&SUFFIXABLE_UNIT.iter().map(|(k, _)| *k).collect::<Vec<_>>());
    JsRegex::new(
        &format!(r"(?<![\p{{L}}\p{{M}}])({alt})([²³23])?-([{LOWER}]+)"),
        "giu",
    )
    .unwrap()
});
static METRE_SUFFIX: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"(\d)\s?m([²³23])?-([{LOWER}]+)"), "gu").unwrap());
static PERCENT_SUFFIX: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"(\d)\s?[%٪％]-([{LOWER}]+)"), "gu").unwrap());
static DEGREE_SUFFIX: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"(\d)\s?°\s?([CFcf])?-([{LOWER}]+)"), "gu").unwrap());
static YEAR_MONTH: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!(r"(?<![\d.,])(\d{{1,4}})\.(\s+)(?={MONTH})"), "giu").unwrap()
});
static MONTH_DAY: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"({MONTH}\p{{L}}*\s+)(\d{{1,2}})\.(?=\s+[{LOWER}])"),
        "giu",
    )
    .unwrap()
});
static GENERAL_ORDINAL: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<![\d.,])(\d{{1,4}})\.(?=\s+[{LOWER}]|,)"),
        "gu",
    )
    .unwrap()
});
static ORDINAL_PERIOD: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"(?<=dik|első)\.(?=\s+[{LOWER}])"), "gu").unwrap());
static DATE_SUFFIX_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<={MONTH}\p{{L}}*\s)(\d{{1,2}})-([{LOWER}]+)(?![\p{{L}}\p{{M}}])"),
        "giu",
    )
    .unwrap()
});
static NUMERAL_SUFFIX: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<![\p{{L}}\p{{M}}\d])(\d+)-([{LOWER}]+)(?![\p{{L}}\p{{M}}])"),
        "gu",
    )
    .unwrap()
});
static ACRONYM_SUFFIX: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<![\p{{L}}\p{{M}}])(\p{{Lu}}{{2,}})-([{LOWER}]+)"),
        "gu",
    )
    .unwrap()
});
static ACRONYM_WORD_RES: LazyLock<Vec<(JsRegex, &'static str)>> = LazyLock::new(|| {
    ACRONYM_WORD
        .iter()
        .map(|&(acr, word)| {
            (
                JsRegex::new(
                    &format!(r"(?<![\p{{L}}\p{{M}}]){acr}(?![\p{{L}}\p{{M}}])"),
                    "gu",
                )
                .unwrap(),
                word,
            )
        })
        .collect()
});

/// The exponent prefix for an optional `²³23` capture.
fn exponent_prefix(exp: &Option<JsString>) -> &'static str {
    match exp {
        None => "",
        Some(e) if *e == js("³") || *e == js("3") => "köb",
        Some(_) => "négyzet",
    }
}

/// `normalizeHungarian(input)`.
pub fn normalize_hungarian(input: &JsString) -> JsString {
    let g = |m: &JsMatch, s: &JsString, i: usize| m.group(i, s).unwrap_or_default();
    let mut s = input.clone();

    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,\-])(?<!\d[ .,])(\d{1,6})\s?[x×]\s?(?=\d)", "gu"),
        |m, w| match multiplicative_words(js_number(&g(m, w, 1))) {
            None => m.value(w),
            Some(x) => x.concat(&js(" ")),
        },
    );

    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])Kr\.\s?e\.", "giu"),
        &js("Krisztus előtt"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])Kr\.\s?u\.", "giu"),
        &js("Krisztus után"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])i\.\s?sz\.", "giu"),
        &js("időszámításunk szerint"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])i\.\s?e\.", "giu"),
        &js("időszámításunk előtt"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])d\.\s?e\.", "giu"),
        &js("délelőtt"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])d\.\s?u\.", "giu"),
        &js("délután"),
    );
    s = rewrite_with(&s, &ABBREV_CONT, |m, w| {
        dotted_abbrev(&g(m, w, 1).to_lower_case()).concat(&g(m, w, 2))
    });
    s = rewrite_with(&s, &ABBREV_END, |m, w| {
        dotted_abbrev(&g(m, w, 1).to_lower_case()).concat(&js("."))
    });

    for _ in 0..3 {
        s = rewrite(
            &s,
            js_re!(
                r"(?<=\d)(?<!(?<![\d\.,])0)[.\u00a0\u202f\u2009 ](?=\d{3}(?![\d]|,\d))",
                "gu"
            ),
            &JsString::new(),
        );
        s = rewrite(
            &s,
            js_re!(
                r"(?<=\d)(?<!(?<![\d\.,])0)\.[ \u00a0\u202f\u2009](?=\d{3}(?![\d]|,\d))",
                "gu"
            ),
            &JsString::new(),
        );
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?![\d]|,\d))", "gu"),
            &JsString::new(),
        );
    }

    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,:])([01]?\d|2[0-3]):[ \u00a0]?([0-5]\d)(?![\d:])",
            "gu"
        ),
        |m, w| {
            let (h, min) = (g(m, w, 1), g(m, w, 2));
            if js_number(&min) == 0.0 {
                h
            } else {
                h.concat(&js(" ")).concat(&min)
            }
        },
    );

    s = rewrite_with(&s, &UNIT_SUFFIX, |m, w| {
        let u = g(m, w, 1).to_lower_case();
        let Some((_, head)) = SUFFIXABLE_UNIT.iter().find(|(k, _)| js(k) == u) else {
            return m.value(w);
        };
        js(exponent_prefix(&m.group(2, w)))
            .concat(&js(head))
            .concat(&g(m, w, 3))
    });
    s = rewrite_with(&s, &METRE_SUFFIX, |m, w| {
        g(m, w, 1)
            .concat(&js(&format!(" {}méter", exponent_prefix(&m.group(2, w)))))
            .concat(&g(m, w, 3))
    });

    s = rewrite(&s, &PERCENT_SUFFIX, &js("$1 százalék$2"));

    s = symbols().apply(&s);

    s = rewrite_with(&s, &DEGREE_SUFFIX, |m, w| {
        let scale = m.group(2, w).map(|c| c.to_upper_case());
        let name = match scale {
            Some(c) if c == js("C") => "Celsius-",
            Some(c) if c == js("F") => "Fahrenheit-",
            _ => "",
        };
        g(m, w, 1)
            .concat(&js(&format!(" {name}fok")))
            .concat(&g(m, w, 3))
    });
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?C(?![\p{L}\p{M}])", "gui"),
        &js("$1 Celsius-fok"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?F(?![\p{L}\p{M}])", "gui"),
        &js("$1 Fahrenheit-fok"),
    );
    s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 fok"));
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)", "gu"),
        |m, w| {
            if js_re!(r"\d\s*$", "u").test(&w.slice(0, Some(m.index() as isize))) {
                m.value(w)
            } else {
                js("mínusz ")
            }
        },
    );
    s = rewrite(&s, js_re!("±", "gu"), &js(" plusz mínusz "));
    s = rewrite(&s, js_re!(r"(\S)\+\s?(\d)", "gu"), &js("$1 plusz $2"));
    s = rewrite(&s, js_re!(r"(^|\s)\+\s?(\d)", "gu"), &js("$1plusz $2"));

    s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" egyenlő "));
    s = rewrite(&s, js_re!(r"\s?<\s?", "gu"), &js(" kisebb mint "));
    s = rewrite(&s, js_re!(r"\s?>\s?", "gu"), &js(" nagyobb mint "));
    s = rewrite_with(&s, js_re!(r"(\d+)\s?÷\s?(\d+)", "gu"), |m, w| {
        let (a, b) = (g(m, w, 1), g(m, w, 2));
        number_to_words(js_number(&a), Some(&a))
            .concat(&js(" "))
            .concat(&hu_instrumental(&number_to_words(js_number(&b), Some(&b))))
            .concat(&js(" osztva"))
    });

    s = rewrite(&s, js_re!(r"(\d),(?=\d)", "gu"), &js("$1 egész "));

    s = rewrite(&s, &YEAR_MONTH, &js("$1$2"));
    s = rewrite_with(&s, &MONTH_DAY, |m, w| {
        match date_nominative(js_number(&g(m, w, 2))) {
            None => m.value(w),
            Some(d) => g(m, w, 1).concat(&d),
        }
    });
    s = rewrite_with(&s, &GENERAL_ORDINAL, |m, w| {
        ordinal_words(js_number(&g(m, w, 1))).unwrap_or_else(|| m.value(w))
    });
    s = rewrite(&s, &ORDINAL_PERIOD, &JsString::new());

    s = rewrite_with(&s, &DATE_SUFFIX_RE, |m, w| {
        let (d, suf) = (g(m, w, 1), g(m, w, 2));
        if !js_re!("^(j?[áé]n|je|jei|ei|e|i)$", "u").test(&suf) {
            return m.value(w);
        }
        let n = js_number(&d);
        let Some(stem) = date_stem(n) else {
            return m.value(w);
        };
        let suf = if n == 1.0 {
            js_re!("^j", "u").replace(&suf, &JsString::new())
        } else {
            suf
        };
        stem.concat(&suf)
    });
    s = rewrite_with(&s, &NUMERAL_SUFFIX, |m, w| {
        let n = js_number(&g(m, w, 1));
        if !is_safe_integer(n) {
            return m.value(w);
        }
        let words = number_to_words(n, None);
        if js_re!(r"\d", "u").test(&words) {
            m.value(w)
        } else {
            attach_suffix(&words, &g(m, w, 2))
        }
    });

    s = rewrite_with(&s, &ACRONYM_SUFFIX, |m, w| {
        let (acr, suf) = (g(m, w, 1), g(m, w, 2));
        if let Some((_, lexical)) = ACRONYM_WORD.iter().find(|(k, _)| js(k) == acr) {
            return js(lexical).concat(&suf);
        }
        if !is_unreadable_hungarian(&acr) {
            return acr.to_lower_case().concat(&suf);
        }
        match spell_out(&acr) {
            None => m.value(w),
            Some(sp) => sp.concat(&suf),
        }
    });
    for (re, word) in ACRONYM_WORD_RES.iter() {
        s = rewrite(&s, re, &js(word));
    }
    normalize_initialisms(&s)
}

/// The symbol tier for a caller that came through a checked path (`createHungarian` verified it).
fn symbols() -> &'static SymbolNormalizer {
    try_symbols().unwrap_or_else(|e| panic!("{e}"))
}
