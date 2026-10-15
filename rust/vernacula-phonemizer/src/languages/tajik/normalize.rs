//! Tajik (tg) text normalization: soft hyphens and `&nbsp;`, digit grouping, the year / дигар / ғайра and magnitude
//! abbreviations, dotted dates, clocks, ordinals and case suffixes on figures, ranges, degrees, a per-km² rate, the
//! shared symbol tier, fractions, decimals and `=`; plus `tajikOrdinal`, the initialism pass and the phonotactic test.
//! Ported from src/languages/tajik/normalize.ts — see that file for the corpus evidence.

use std::sync::{Arc, LazyLock, OnceLock};

use super::manifest::MANIFEST;
use super::tajik::number_words;
use crate::core::data_source::load_once;
use crate::core::initialisms::{
    InitialismData, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{
    SymbolData, SymbolNormalizer, UnitPer, make_symbol_normalizer,
};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `ordinalEnding(word)`: -юм after a vowel, -ум after a consonant; сӣ → сиюм.
fn ordinal_ending(word: &JsString) -> JsString {
    if *word == js("сӣ") {
        return js("сиюм");
    }
    if js_re!(r"[аоеиуӯёюяӣэ]$", "u").test(word) {
        word.concat(&js("юм"))
    } else {
        word.concat(&js("ум"))
    }
}

/// `tajikOrdinal(n)`: 1 … 999,999, the ending on the last word of the cardinal.
pub(crate) fn tajik_ordinal(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.fract() == 0.0) || !(1.0..=999_999.0).contains(&n) {
        return None;
    }
    let mut parts = number_words(n).split(&js(" "));
    let last = parts.last().cloned().filter(|l| !l.is_empty())?;
    *parts.last_mut().unwrap() = ordinal_ending(&last);
    Some(JsString::join(&parts, &js(" ")))
}

/// `glueSuffix(words, suffix)`: the suffix on the last word.
fn glue_suffix(words: &JsString, suffix: &JsString) -> JsString {
    let mut parts = words.split(&js(" "));
    let last = parts.last_mut().unwrap();
    *last = last.concat(suffix);
    JsString::join(&parts, &js(" "))
}

const SUFFIX: &str = "ро|и|ест|аш|ат|ам|он|ҳо";

type WordTest = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

static IS_UNREADABLE: LazyLock<WordTest> = LazyLock::new(|| {
    let p = &MANIFEST.phonotactics;
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(&format!("[{}]", p.vowels), "u").unwrap(),
        legal_onsets: p.onsets.iter().map(|s| js(s)).collect(),
        legal_codas: p.codas.iter().map(|s| js(s)).collect(),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableTajik(word)`.
pub(crate) fn is_unreadable_tajik(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

/// `normalizeTajikInitialisms(text)`. `LETTER_NAME[l]`: `l` is one lowercased code point, which no
/// `Object.prototype` member is.
pub(crate) fn normalize_tajik_initialisms(text: &JsString) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: Arc::new(|l: &JsString| {
                MANIFEST
                    .letter_names
                    .get(&l.to_string_lossy())
                    .map(|n| js(n))
            }),
            lower: None,
            acronym_letters: Arc::new(|w: &JsString| {
                MANIFEST.acronym_letters.iter().any(|a| *w == js(a))
            }),
            is_recorded: |_: &JsString| false,
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(text)
}

/// `SYMBOLS`, built from the manifest's `symbolTier` in the TS field order.
pub(crate) fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let st = &super::manifest::try_manifest()?.symbol_tier;
        make_symbol_normalizer(&SymbolData {
            percent: Some(st.percent.clone()),
            currency: Some(st.currency.clone()),
            units: Some(st.units.clone()),
            magnitudes: Some(st.magnitudes.clone()),
            unit_per: Some(UnitPer::All(st.unit_per.clone())),
            rate_denominators: Some(st.rate_denominators.clone()),
            ampersand: Some(st.ampersand.clone()),
            ..Default::default()
        })
    })
}

static SYMBOLS: LazyLock<&'static SymbolNormalizer> =
    LazyLock::new(|| try_symbols().unwrap_or_else(|e| panic!("{e}")));

/// `SYMBOLS(text)`.
pub(crate) fn symbols(text: &JsString) -> JsString {
    SYMBOLS.apply(text)
}

fn g(m: &JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

struct Built {
    percent_suffix: JsRegex,
    case_suffix: JsRegex,
    celsius: JsRegex,
    degree: JsRegex,
}

/// The patterns normalize.ts builds with `new RegExp`, built once.
static BUILT: LazyLock<Built> = LazyLock::new(|| {
    let re = |p: String| JsRegex::new(&p, "gu").unwrap();
    Built {
        percent_suffix: re(format!(r"(\d[\d,]*)\s?%-({SUFFIX})(?![\p{{L}}\p{{M}}])")),
        case_suffix: re(format!(r"(?<![\d.,])(\d+)-({SUFFIX})(?![\p{{L}}\p{{M}}])")),
        celsius: re(format!(
            r"(\d)\s?°\s?[CСcс](?:-({SUFFIX}))?(?![\p{{L}}\p{{M}}])"
        )),
        degree: re(format!(r"(\d)\s?°(?:-({SUFFIX}))?")),
    }
});

/// `normalizeTajik(input)`. The steps are order-dependent, as in the TS.
pub(crate) fn normalize_tajik(input: &JsString) -> JsString {
    let bt = &*BUILT;
    let m = &*MANIFEST;
    let mut s = input.clone();

    // Soft hyphens, then `&nbsp;`.
    s = rewrite(
        &rewrite(&s, js_re!(r"\u00ad", "gu"), &JsString::new()),
        js_re!(r"&nbsp;?", "gu"),
        &js(" "),
    );

    // Digit grouping, three passes.
    for _ in 0..3 {
        s = rewrite(
            &s,
            js_re!(
                r"(?<=\d)(?<!(?<![\d\.,])0)[ \u00a0\u202f\u2009](?=\d{3}(?![\d]))",
                "gu"
            ),
            &JsString::new(),
        );
    }

    // The year, дигар and ғайра abbreviations; the magnitude abbreviations after a figure.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])[Сс]\.\s?(?=\d{3,4}(?![\d]))", "gu"),
        &js("соли "),
    );
    s = rewrite(&s, js_re!(r"(?<![\p{L}\p{M}])диг\.", "gu"), &js("дигар"));
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])ғ\.(?=\s|$|\))", "gu"),
        &js("ғайра"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d\s?)млрд\.(?=\s+[\p{Ll}\d])", "gu"),
        &js("миллиард"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d\s?)млн\.(?=\s+[\p{Ll}\d])", "gu"),
        &js("миллион"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d\s?)ҳаз\.(?=\s+[\p{Ll}\d])", "gu"),
        &js("ҳазор"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d\s?)млрд(?![\p{L}\p{M}])", "gu"),
        &js("миллиард"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d\s?)млн(?![\p{L}\p{M}])", "gu"),
        &js("миллион"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d\s?)ҳаз(?![\p{L}\p{M}])", "gu"),
        &js("ҳазор"),
    );

    // Dotted dates.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d{1,2})\.(\d{1,2})\.(\d{4})(?![\d.])", "gu"),
        |mm, t| {
            let (dv, mv) = (js_number(&g(mm, t, 1)), js_number(&g(mm, t, 2)));
            if !(1.0..=31.0).contains(&dv) || !(1.0..=12.0).contains(&mv) {
                return mm.value(t);
            }
            js(&format!(
                "{} {} соли {}",
                crate::core::js_string::js_number_to_string(dv),
                m.months[mv as usize - 1],
                g(mm, t, 3)
            ))
        },
    );

    // A colon between digits.
    s = rewrite(&s, js_re!(r"(?<=\d):(?=\d)", "gu"), &js(" "));

    // An ordinal with its tail, then a percent or a figure with a case suffix.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)-(ум|юм)([\p{L}\p{M}]*)", "gu"),
        |mm, t| match tajik_ordinal(js_number(&g(mm, t, 1))) {
            None => mm.value(t),
            Some(ord) => glue_suffix(&ord, &g(mm, t, 3)),
        },
    );
    s = rewrite_with(&s, &bt.percent_suffix, |mm, t| {
        g(mm, t, 1).concat(&js(" дарсад")).concat(&g(mm, t, 2))
    });
    s = rewrite_with(&s, &bt.case_suffix, |mm, t| {
        let w = number_words(js_number(&g(mm, t, 1)));
        if w.is_empty() {
            mm.value(t)
        } else {
            glue_suffix(&w, &g(mm, t, 2))
        }
    });

    // Ranges; a spaced dash as a pause.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(\d+)\s?[-–—]\s?(\d)", "gu"),
        &js("$1 то $2"),
    );
    s = rewrite(&s, js_re!(r"\s+[–—]\s+", "gu"), &js(" , "));

    // Degrees.
    s = rewrite_with(&s, &bt.celsius, |mm, t| {
        g(mm, t, 1)
            .concat(&js(" дараҷаи Селсий"))
            .concat(&g(mm, t, 2))
    });
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?F(?![\p{L}\p{M}])", "gui"),
        &js("$1 дараҷаи Фаренгейт"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d)\s?°\s?([NSEW])(?![\p{L}\p{M}])", "gu"),
        |mm, t| {
            let dir = match g(mm, t, 2).to_upper_case().to_string_lossy().as_str() {
                "N" => "шимолӣ",
                "S" => "ҷанубӣ",
                "E" => "шарқӣ",
                _ => "ғарбӣ",
            };
            g(mm, t, 1).concat(&js(" дараҷаи ")).concat(&js(dir))
        },
    );
    s = rewrite_with(&s, &bt.degree, |mm, t| {
        g(mm, t, 1).concat(&js(" дараҷа")).concat(&g(mm, t, 2))
    });

    // A rate per square kilometre.
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])([Ѐ-ӿ]{2,})\s?\/\s?км(²|2)(?![\p{L}\p{M}\d])",
            "gu"
        ),
        &js("$1 дар километри мураббаъ"),
    );

    // The shared symbol tier.
    s = symbols(&s);

    // Fractions (numerator below a denominator of at most ten).
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d./])(\d{1,2})\s?\/\s?(\d{1,2})(?![\d./])",
            "gu"
        ),
        |mm, t| {
            let (n, d) = (js_number(&g(mm, t, 1)), js_number(&g(mm, t, 2)));
            if !(n >= 1.0 && n < d && d <= 10.0) {
                return mm.value(t);
            }
            match tajik_ordinal(d) {
                None => mm.value(t),
                Some(den) => number_words(n).concat(&js(" ")).concat(&den),
            }
        },
    );

    // Decimals spent; `=` read.
    s = rewrite(&s, js_re!(r"(?<=\d),(?=\d)", "gu"), &js(" "));
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.])(\d+)\.(\d+)(?![\d.])", "gu"),
        &js("$1 $2"),
    );
    rewrite(
        &s,
        js_re!(r"([\dЀ-ӿ])\s*=\s*([\dЀ-ӿ])", "gu"),
        &js("$1 баробар аст ба $2"),
    )
}
