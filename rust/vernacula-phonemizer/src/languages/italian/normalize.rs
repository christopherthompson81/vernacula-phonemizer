//! Italian text normalization: de-grouping, era markers, abbreviations, the three senses of the degree
//! sign, ordinal indicators, the clock, signs, fractions, preposed currency, and the decimal comma (last).
//! Ported from src/languages/italian/normalize.ts — see that file for the corpus evidence and the ordering.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, LazyLock, OnceLock};

use crate::core::boundaries::NOT_LETTER_BEFORE;
use crate::core::data_source::load_once;
use crate::core::initialisms::{
    InitialismData, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::normalize_symbols::{alternation, sorted_by_length_desc};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::core::roman::roman_to_int;
use crate::js_re;

use super::manifest::{ItalianManifest, try_manifest};
use super::roman_ordinals::ordinal_with;

type Pred = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;
type Normalizer = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;

/// Everything normalize.ts builds from the manifest at module load, built and validated once, so that a bad
/// manifest is an error at `create_italian` and no normalizer call can panic.
pub(crate) struct NormalizeData {
    m: &'static ItalianManifest,
    /// `DOTTED_ABBREV`, keyed for the callback's `ab.toLowerCase()` lookup (a miss is reachable, #1122).
    abbrev: HashMap<JsString, JsString>,
    abbrev_cont: JsRegex,
    abbrev_end: JsRegex,
    currency_word: JsRegex,
    unreadable: Pred,
    initialisms: Normalizer,
}

pub(crate) fn normalize_data() -> Result<&'static NormalizeData, String> {
    static D: OnceLock<NormalizeData> = OnceLock::new();
    let m = try_manifest()?;
    load_once(&D, || build(m))
}

fn build(m: &'static ItalianManifest) -> Result<NormalizeData, String> {
    let re = |pattern: String, flags: &str| {
        JsRegex::new(&pattern, flags).map_err(|e| format!("italian.jsonc: pattern {pattern}: {e}"))
    };
    // `Object.keys(DOTTED_ABBREV).sort((a, b) => b.length - a.length).join("|")`, unescaped as in the TS.
    let alt = alternation(&sorted_by_length_desc(
        m.dotted_abbrev.keys().map(|k| js(k)),
    ));
    let p = &m.phonotactics;
    let unreadable: Pred = Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: re(format!("[{}]", p.vowels), "u")?,
        legal_onsets: p.onsets.iter().map(|s| js(s)).collect(),
        legal_codas: p.codas.iter().map(|s| js(s)).collect(),
        liquids: None,
        digraphs: None,
    }));
    let names: HashMap<JsString, JsString> =
        m.letter_names.iter().map(|(k, v)| (js(k), js(v))).collect();
    let acronyms: HashSet<JsString> = m.acronym_letters.iter().map(|s| js(s)).collect();
    let u = unreadable.clone();
    let initialisms: Normalizer = Box::new(make_initialism_normalizer(
        InitialismData {
            letter_name: Arc::new(move |l| names.get(l).cloned()),
            lower: None,
            acronym_letters: Arc::new(move |l| acronyms.contains(l)),
            is_recorded: is_roman_numeral as fn(&JsString) -> bool,
            is_unreadable: Arc::new(move |w| u(w)),
        },
        true,
    ));
    Ok(NormalizeData {
        m,
        abbrev: m
            .dotted_abbrev
            .iter()
            .map(|(k, v)| (js(k), js(v)))
            .collect(),
        abbrev_cont: re(
            format!(r"{NOT_LETTER_BEFORE}({alt})\.(\s+)(?=[\p{{L}}\p{{N}}])"),
            "giu",
        )?,
        abbrev_end: re(
            format!(r"{NOT_LETTER_BEFORE}({alt})\.(?=\s*(?:[.,;:!?»)\]]|$))"),
            "giu",
        )?,
        // `CURRENCY_WORD`: the stems joined unescaped, as the TS joins them.
        currency_word: re(
            format!(
                r"^\s*(?:di\s+)?(?:{})",
                m.symbol_tier.currency_stems.join("|")
            ),
            "iu",
        )?,
        unreadable,
        initialisms,
    })
}

/// `isUnreadableItalian`. Errs only if the manifest cannot be loaded.
pub fn is_unreadable_italian(w: &JsString) -> Result<bool, String> {
    Ok((normalize_data()?.unreadable)(w))
}

fn is_roman_numeral(lower: &JsString) -> bool {
    lower.len() >= 2 && roman_to_int(lower).is_some()
}

/// `normalizeItalianInitialisms`. Errs only if the manifest cannot be loaded.
pub fn normalize_italian_initialisms(text: &JsString) -> Result<JsString, String> {
    Ok(normalize_data()?.initialisms(text))
}

/// `normalizeItalian`. Errs only if the manifest cannot be loaded.
pub fn normalize_italian(input: &JsString) -> Result<JsString, String> {
    Ok(normalize_data()?.normalize(input))
}

/// `normalizeItalianDecimals`. Errs only if the manifest cannot be loaded.
pub fn normalize_italian_decimals(input: &JsString) -> Result<JsString, String> {
    Ok(normalize_data()?.decimals(input))
}

fn feminine(masc: &JsString) -> JsString {
    js_re!("o$", "u").replace(masc, &js("a"))
}

/// `CURRENCY`: singular, plural. ⚠ HARD-CODED IN THE TS TOO (normalize.ts `CURRENCY`, beside the manifest's
/// `symbolTier.currency`), as is step 10's magnitude alternation; the port keeps both literal.
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
    JsRegex::new(
        &format!(r"{NOT_LETTER_BEFORE}(?:n\.º|n\.|nr\.|nº)\s?(?=\d)"),
        "giu",
    )
    .unwrap()
});

impl NormalizeData {
    fn ordinal(&self, n: f64) -> Option<JsString> {
        ordinal_with(self.m, n)
    }

    fn fraction_words(&self, num: f64, den: f64) -> Option<JsString> {
        if den < 2.0 || num < 1.0 {
            return None;
        }
        let base = match self.m.fractions.denominators.get(&js_number_to_string(den)) {
            Some(b) => js(b),
            None => self.ordinal(den)?,
        };
        let head = if num == 1.0 {
            js(&self.m.apocopated_one)
        } else {
            js(&js_number_to_string(num))
        };
        let noun = if num > 1.0 {
            js_re!("o$", "u").replace(&base, &js("i"))
        } else {
            base
        };
        Some(head.concat(&js(" ")).concat(&noun))
    }

    fn degrees(&self, n: &JsString) -> JsString {
        let first_comma = js_re!(",", "").replace(n, &js("."));
        if js_number(&first_comma) == 1.0 {
            js(&format!(
                "{} {}",
                self.m.apocopated_one, self.m.degree.singular
            ))
        } else {
            n.concat(&js(&format!(" {}", self.m.degree.plural)))
        }
    }

    pub(crate) fn initialisms(&self, text: &JsString) -> JsString {
        (self.initialisms)(text)
    }

    /// The decimal comma, applied AFTER the symbol tier (italian.ts's order).
    pub(crate) fn decimals(&self, input: &JsString) -> JsString {
        rewrite(
            input,
            js_re!(r"(\d),(\d)", "gu"),
            &js(&format!("$1 {} $2", self.m.decimal_word)),
        )
    }

    /// Normalize one Italian input string (before the shared symbol tier; the decimal comma is separate).
    pub(crate) fn normalize(&self, input: &JsString) -> JsString {
        let m = self.m;
        let sign = &m.sign_words;
        let mut s = input.clone();

        // 1) digit de-grouping, twice.
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)\.(?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)\.(?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );

        // 2) era markers.
        s = rewrite(&s, &ERA_BC, &js(&m.era_markers.before_christ));
        s = rewrite(&s, &ERA_AD, &js(&m.era_markers.after_christ));

        // 3) numero, before a digit only.
        s = rewrite(&s, &NUMERO, &js(&format!("{} ", m.number_sign)));

        // 4) dotted abbreviations.
        s = rewrite_with(&s, &self.abbrev_cont, |mt, s| {
            let ab = mt.group(1, s).unwrap();
            let sp = mt.group(2, s).unwrap();
            match self.abbrev.get(&ab.to_lower_case()) {
                None => mt.value(s),
                Some(w) => w.concat(&sp),
            }
        });
        s = rewrite_with(&s, &self.abbrev_end, |mt, s| {
            let ab = mt.group(1, s).unwrap();
            match self.abbrev.get(&ab.to_lower_case()) {
                None => mt.value(s),
                Some(w) => w.concat(&js(".")),
            }
        });

        // 5) the degree sign: temperature, then coordinate.
        s = rewrite_with(
            &s,
            js_re!(r"(\d+(?:[.,]\d+)?)\s?°\s?C(?![\p{L}\p{M}])", "gui"),
            |mt, s| {
                self.degrees(&mt.group(1, s).unwrap())
                    .concat(&js(&format!(" {}", m.degree.celsius)))
            },
        );
        s = rewrite_with(
            &s,
            js_re!(r"(\d+(?:[.,]\d+)?)\s?°\s?F(?![\p{L}\p{M}])", "gui"),
            |mt, s| {
                self.degrees(&mt.group(1, s).unwrap())
                    .concat(&js(&format!(" {}", m.degree.fahrenheit)))
            },
        );
        s = rewrite_with(
            &s,
            js_re!(
                r"(\d+(?:[.,]\d+)?)\s?°(?:([nsewNSEW])|\s+([NSEW]))(?![\p{L}\p{M}])",
                "gu"
            ),
            |mt, s| {
                let letter = mt.group(2, s).or_else(|| mt.group(3, s)).unwrap();
                // `try_manifest` checked that `n s e w` are all present.
                let point = m
                    .compass
                    .get(&letter.to_lower_case().to_string_lossy())
                    .map_or("", String::as_str);
                self.degrees(&mt.group(1, s).unwrap())
                    .concat(&js(&format!(" {point}")))
            },
        );

        // 6) ordinal indicators.
        s = rewrite_with(&s, js_re!(r"(\d+)\.?(?:º|ª|°)", "gu"), |mt, s| {
            let whole = mt.value(s);
            let Some(masc) = self.ordinal(js_number(&mt.group(1, s).unwrap())) else {
                return whole;
            };
            if js_re!("ª", "u").test(&whole) {
                feminine(&masc)
            } else {
                masc
            }
        });

        // 7) the clock: colon, then period after an hour cue.
        s = rewrite_with(
            &s,
            js_re!(r"(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])", "gu"),
            |mt, s| {
                let (h, min) = (mt.group(1, s).unwrap(), mt.group(2, s).unwrap());
                if js_number(&min) == 0.0 {
                    h
                } else {
                    h.concat(&js(" e ")).concat(&min)
                }
            },
        );
        s = rewrite_with(
            &s,
            js_re!(
                r"((?:all[e'’]|alle ore|ore|dalle|verso le|le)\s?)([01]?\d|2[0-3])\.([0-5]\d)(?![\d.])",
                "giu"
            ),
            |mt, s| {
                let (cue, h, min) = (
                    mt.group(1, s).unwrap(),
                    mt.group(2, s).unwrap(),
                    mt.group(3, s).unwrap(),
                );
                let time = if js_number(&min) == 0.0 {
                    h
                } else {
                    h.concat(&js(" e ")).concat(&min)
                };
                cue.concat(&time)
            },
        );

        // 8) signs.
        s = rewrite(
            &s,
            js_re!("±", "gu"),
            &js(&format!(" {} ", sign.plus_minus)),
        );
        s = rewrite(
            &s,
            js_re!(r"(\S)\+\s?(\d)", "gu"),
            &js(&format!("$1 {} $2", sign.plus)),
        );
        s = rewrite(
            &s,
            js_re!(r"(^|\s)\+\s?(\d)", "gu"),
            &js(&format!("$1{} $2", sign.plus)),
        );
        s = rewrite(
            &s,
            js_re!(r"(^|[\s(])[-−–](\d)", "gu"),
            &js(&format!("$1{} $2", sign.minus)),
        );

        // 8b) relational and division signs.
        s = rewrite(
            &s,
            js_re!(r"\s?=\s?", "gu"),
            &js(&format!(" {} ", sign.equals)),
        );
        s = rewrite(
            &s,
            js_re!(r"\s?<\s?", "gu"),
            &js(&format!(" {} ", sign.less_than)),
        );
        s = rewrite(
            &s,
            js_re!(r"\s?>\s?", "gu"),
            &js(&format!(" {} ", sign.greater_than)),
        );
        s = rewrite(
            &s,
            js_re!(r"\s?÷\s?", "gu"),
            &js(&format!(" {} ", sign.divided_by)),
        );

        // 9) fractions.
        s = rewrite_with(
            &s,
            js_re!(r"(?<!\d)(\d{1,3})\/(\d{1,3})(?![\d/])", "gu"),
            |mt, s| {
                self.fraction_words(
                    js_number(&mt.group(1, s).unwrap()),
                    js_number(&mt.group(2, s).unwrap()),
                )
                .unwrap_or_else(|| mt.value(s))
            },
        );

        // 9b) the plus as a word-joiner.
        s = rewrite(
            &s,
            js_re!(r"(?<=[\p{L}\p{M}])\+(?=[\p{L}\p{M}])", "gu"),
            &js(&format!(" {} ", sign.plus)),
        );

        // 10) currency written before the amount.
        s = rewrite_with(
            &s,
            js_re!(
                r"([€$£¥])\s?(\d[\d.,]*)(\s+(?:miliardi|miliardo|milioni|milione|mila))?",
                "gu"
            ),
            |mt, whole| {
                let sign = mt.group(1, whole).unwrap();
                let num = mt.group(2, whole).unwrap();
                let mag = mt.group(3, whole);
                let after = whole.slice(mt.end() as isize, None);
                let mag_s = mag.clone().unwrap_or_default();
                if self.currency_word.test(&after) {
                    return num.concat(&mag_s);
                }
                let Some(&(_, forms)) = CURRENCY.iter().find(|(k, _)| sign == js(k)) else {
                    return mt.value(whole);
                };
                let plural = mag.is_some()
                    || js_number(&js_re!("[.,]", "gu").replace(&num, &JsString::new())) != 1.0;
                let word = if plural { forms[1] } else { forms[0] };
                let tail = if js_re!(r"^[\p{L}\p{M}]", "u").test(&after) {
                    " "
                } else {
                    ""
                };
                let di = if mag.is_none() { "" } else { "di " };
                num.concat(&mag_s)
                    .concat(&js(&format!(" {di}{word}{tail}")))
            },
        );

        s
    }
}
