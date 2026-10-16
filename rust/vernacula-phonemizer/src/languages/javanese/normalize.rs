//! Javanese (jv) text normalization: clock hours, `Rp.`, digit grouping, decimals, the three fractions, ranges,
//! degrees, ±, population density, the shared symbol tier, number ranges and the initialism pass.
//! Ported from src/languages/javanese/normalize.ts — see that file for the corpus evidence.

use std::sync::{Arc, LazyLock, OnceLock};

use super::manifest::{MANIFEST, try_manifest};
use crate::core::data_source::load_once;
use crate::core::initialisms::{
    InitialismData, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::normalize_symbols::{
    ExponentWords, SymbolData, SymbolNormalizer, make_symbol_normalizer,
};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const L: &str = r"[\p{L}\p{M}]";

/// `SYMBOLS`: the shared tier over the nine `symbolTier` fields normalize.ts passes.
pub fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let t = &try_manifest()?.symbol_tier;
        make_symbol_normalizer(&SymbolData {
            percent: Some(t.percent.clone()),
            currency: Some(t.currency.clone()),
            units: Some(t.units.clone()),
            magnitudes: Some(t.magnitudes.clone()),
            unit_per: Some(t.unit_per.clone()),
            rate_denominators: Some(t.rate_denominators.clone()),
            exponent_words: Some(ExponentWords {
                squared: t.exponent_words.squared.clone(),
                cubed: t.exponent_words.cubed.clone(),
                position: t.exponent_words.position.clone(),
            }),
            multiply: Some(t.multiply.clone()),
            ampersand: Some(t.ampersand.clone()),
            ..Default::default()
        })
    })
}

type Test = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

/// `isUnreadableJavanese`: the shared phonotactic test over the manifest's inventory.
pub static IS_UNREADABLE: LazyLock<Test> = LazyLock::new(|| {
    let p = &MANIFEST.phonotactics;
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(&format!("[{}]", p.vowels), "u").unwrap(),
        legal_onsets: p.onsets.iter().map(|o| js(o)).collect(),
        legal_codas: p.codas.iter().map(|c| js(c)).collect(),
        liquids: None,
        digraphs: None,
    }))
});

const ACRONYM_LETTERS: [&str; 9] = ["as", "us", "sa", "ri", "lu", "pc", "kb", "md", "pip"];
const WORD_ACRONYMS: [&str; 6] = ["wib", "wita", "wit", "unesco", "nasa", "asean"];

fn in_set(set: &[&str], w: &JsString) -> bool {
    set.iter().any(|a| *w == js(a))
}

/// `normalizeInitialisms(text)`.
fn normalize_initialisms(text: &JsString) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: Arc::new(|l: &JsString| {
                MANIFEST
                    .letter_names
                    .get(&l.to_lower_case().to_string_lossy())
                    .map(|n| js(n))
            }),
            lower: None,
            acronym_letters: Arc::new(|w: &JsString| in_set(&ACRONYM_LETTERS, w)),
            is_recorded: |w: &JsString| in_set(&WORD_ACRONYMS, w),
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(text)
}

fn g(m: &crate::core::js_regex::JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `String(Number(s))`.
fn num_str(s: &JsString) -> JsString {
    js(&js_number_to_string(js_number(s)))
}

/// `decimal(int, frac)`: the fraction read digit at a time.
fn decimal(int: &JsString, frac: &JsString) -> JsString {
    int.concat(&js(" koma "))
        .concat(&JsString::join(&frac.code_point_strings(), &js(" ")))
}

/// The three fraction rules normalize.ts builds with `new RegExp`.
static FRACTIONS: LazyLock<[(JsRegex, JsString); 3]> = LazyLock::new(|| {
    let re =
        |frac: &str| JsRegex::new(&format!(r"(?<!{L}|[\d/]){frac}(?!{L}|[\d/])"), "gu").unwrap();
    [
        (re("1/2"), js("setengah")),
        (re("1/3"), js("sapratelon")),
        (re("1/4"), js("saprapat")),
    ]
});

/// `normalizeJavanese(input)`. The steps are order-dependent, as in the TS.
pub fn normalize_javanese(input: &JsString) -> JsString {
    let mut s = input.clone();

    // Clock hours: an `HH.00–HH.00` span, and `jam HH.00`.
    s = rewrite_with(
        &s,
        js_re!(r"(\d{1,2})\.00\s*([-–])\s*(\d{1,2})\.00(?!\d)", "gu"),
        |m, t| {
            num_str(&g(m, t, 1))
                .concat(&js(" nganti "))
                .concat(&num_str(&g(m, t, 3)))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<=jam\s)(\d{1,2})\.00(?!\d)", "gu"),
        |m, t| num_str(&g(m, t, 1)),
    );
    // A clock with real minutes after `jam`: the hour then the minutes, no connective (#1589). See normalize.ts.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<=(?<![\p{L}\p{M}])jam\s)([01]?\d|2[0-4])[.:]([0-5]\d)(?!\d)(?![.:]\d)",
            "giu"
        ),
        |m, t| {
            num_str(&g(m, t, 1))
                .concat(&js(" "))
                .concat(&num_str(&g(m, t, 2)))
        },
    );

    // `Rp.` before an amount.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])Rp\.(?=\s*\d)", "gu"),
        &js("Rp"),
    );

    // Digit grouping, dot then comma.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])[1-9]\d{0,2}(?:\.\d{3})+(?![\d.])", "gu"),
        |m, t| js_re!(r"\.", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])[1-9]\d{0,2}(?:,\d{3})+(?![\d,])", "gu"),
        |m, t| js_re!(r",", "gu").replace(&m.value(t), &JsString::new()),
    );

    // Decimals, comma then dot (a dot after `jam`, or `.00`, is a clock and is kept).
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+),(\d{1,2})(?![\d,])", "gu"),
        |m, t| decimal(&g(m, t, 1), &g(m, t, 2)),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d{1,2})(?![\d,])(?!\.\d)", "gu"),
        |m, t| {
            let f = g(m, t, 2);
            let before = t.slice(0, Some(m.index() as isize));
            if f == js("00") || js_re!(r"(?<![\p{L}\p{M}])jam\s*$", "u").test(&before) {
                m.value(t)
            } else {
                decimal(&g(m, t, 1), &f)
            }
        },
    );

    // The three common fractions.
    for (re, word) in FRACTIONS.iter() {
        s = rewrite(&s, re, word);
    }

    // Ranges after a percent or a quote/degree mark.
    s = rewrite(
        &s,
        js_re!(r"(\d+)\s*%\s*[-–]\s*(?=\d)", "gu"),
        &js("$1% nganti "),
    );
    s = rewrite(
        &s,
        js_re!(r#"(['’"”′″°])\s*[-–]\s*(?=\d)"#, "gu"),
        &js("$1 nganti "),
    );

    // Degrees.
    s = rewrite(
        &s,
        js_re!(r"(\d+)\s*°\s*C(?![\p{L}])", "gui"),
        &js("$1 drajat celsius"),
    );
    s = rewrite(&s, js_re!(r"(\d+)\s*°\s*", "gu"), &js("$1 drajat "));

    // ± and +/-.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(?:±|\+\/-)\s*(?=\d)", "gu"),
        &js("kurang luwih "),
    );

    // Population density.
    s = rewrite(
        &s,
        js_re!(r"(\d[\d.,]*)\s*jiwa\s*\/\s*km\s*(?:²|2)(?![\p{L}\d])", "gu"),
        &js("$1 jiwa per kilomèter persegi"),
    );

    // The shared tier.
    s = try_symbols().expect("checked by create_javanese").apply(&s);

    // Number ranges, refused inside a DOI.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,/-])(\d+)\s*[-–]\s*(\d+)(?![\d,/-]|\.\d)(?!\s*doi)",
            "giu"
        ),
        |m, t| {
            let off = m.index();
            let window = t.slice(off.saturating_sub(40) as isize, Some(off as isize));
            if js_re!(r"doi:?\s*\S*$", "iu").test(&window) {
                m.value(t)
            } else {
                g(m, t, 1).concat(&js(" nganti ")).concat(&g(m, t, 2))
            }
        },
    );

    normalize_initialisms(&s)
}
