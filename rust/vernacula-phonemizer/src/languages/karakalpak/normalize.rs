//! Karakalpak (kaa) text normalization: the percent sign with its suffix, the magnitude abbreviations and the
//! two-token square measures, the shared symbol tier, de-grouping, decimals, the era marker, the year and
//! hyphen-cut abbreviations, the clock, signs, degrees and ranges.
//! Ported from src/languages/karakalpak/normalize.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::boundaries::{NOT_LETTER_AFTER, NOT_LETTER_BEFORE};
use crate::core::data_source::load_once;
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// normalize.ts's `makeSymbolNormalizer({…})` literal, evaluated from the source and `JSON.stringify`'d.
const SYMBOL_DATA: &str = r#"{"percent":["procent"],"currency":{"US$":["dollar"],"$":["dollar"],"€":["evro"],"£":["funt"]},"units":{"km":["kilometr"],"m":["metr"],"sm":["santimetr"],"mm":["millimetr"],"kg":["kilogramm"],"t":["tonna"],"ga":["gektar"],"kvt":["kilovatt"]},"exponentWords":{"squared":["kvadrat"],"cubed":["kub"],"position":"before"},"ampersand":"hám","magnitudes":["mıń","million","milliard"]}"#;

pub(crate) fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
        make_symbol_normalizer(&data)
    })
}

/// `SYMBOLS`, for code reached only through a checked path (`createKarakalpak` builds it first).
static SYMBOLS: LazyLock<&'static SymbolNormalizer> =
    LazyLock::new(|| try_symbols().unwrap_or_else(|e| panic!("{e}")));

/// `SYMBOLS(text)`.
pub(crate) fn symbols(text: &JsString) -> JsString {
    SYMBOLS.apply(text)
}

fn g(m: &JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

const MAG_NEXT: &str = r"(?!\s?(?:mıń|million|milliard))";

struct Built {
    abbrevs: Vec<(JsRegex, &'static str)>,
    comma_group: JsRegex,
    era: JsRegex,
    year: JsRegex,
    t_ra: JsRegex,
}

/// The patterns normalize.ts builds with `new RegExp`, built once.
static BUILT: LazyLock<Built> = LazyLock::new(|| {
    let re = |p: String, f: &str| JsRegex::new(&p, f).unwrap();
    let (b, a) = (NOT_LETTER_BEFORE, NOT_LETTER_AFTER);
    let abbrevs = vec![
        (re(format!(r"{b}mln\s?\.\s?"), "gu"), "million "),
        (re(format!(r"{b}mlrd\s?\.\s?"), "gu"), "milliard "),
        (re(format!("{b}mln{a}"), "gu"), "million"),
        (re(format!("{b}mlrd{a}"), "gu"), "milliard"),
        (re(format!(r"{b}m\s?\.\s?kv\s?\."), "gu"), "kvadrat metr"),
        (
            re(format!(r"{b}km\s?\.?\s?kv\s?\."), "gu"),
            "kvadrat kilometr",
        ),
        (re(format!(r"{b}km\s+kv{a}"), "gu"), "kvadrat kilometr"),
        (re(format!(r"{b}kvt\s?[/\-]\s?saat"), "gu"), "kilovatt saat"),
    ];
    Built {
        abbrevs,
        comma_group: re(
            format!(r"(?<!\d)(?<![\d][.,])([1-9]\d{{0,2}})((?:,\d{{3}})+)(?!\d){MAG_NEXT}"),
            "gu",
        ),
        era: re(format!(r"{b}b\s?\.\s?e\s?\.\s?sh\s?\."), "giu"),
        year: re(r"(\d)-j\s?\.".to_string(), "gu"),
        t_ra: re(format!("{b}t-r(ası|a){a}"), "gu"),
    }
});

/// `normalizeKarakalpak(input)`. The steps are order-dependent, as in the TS.
pub(crate) fn normalize_karakalpak(input: &JsString) -> JsString {
    let bt = &*BUILT;
    let mut s = input.clone();

    // 1) The percent sign and its case suffix.
    s = rewrite(
        &s,
        js_re!(
            r"(\d)\s?%\s?(k[ei]|[td][ae]n|t[ıi]|[ıi]n?)(?![\p{L}\p{M}])",
            "gu"
        ),
        &js("$1 procent$2"),
    );

    // 2) The magnitude abbreviations, the two-token square measures and the energy unit, before the tier.
    for (re, word) in bt.abbrevs.iter() {
        s = rewrite(&s, re, &js(word));
    }

    // 3) The shared symbol tier.
    s = symbols(&s);

    // 4) De-grouping: the comma (not before a magnitude word), then the space.
    s = rewrite_with(&s, &bt.comma_group, |m, t| {
        g(m, t, 1).concat(&js_re!(r",", "gu").replace(&g(m, t, 2), &JsString::new()))
    });
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

    // 5) Decimal separators spent (a dot only when the run carries exactly one).
    s = rewrite(&s, js_re!(r"(\d),(?=\d)", "gu"), &js("$1 "));
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.])(\d+)\.(\d+)(?![\d.])", "gu"),
        &js("$1 $2"),
    );

    // 6) The era marker; the final dot is kept as the period when nothing but closing punctuation follows.
    s = rewrite_with(&s, &bt.era, |m, t| {
        let rest = t.slice(m.end() as isize, None);
        if js_re!(r#"^\s*["»)']?\s*$"#, "u").test(&rest) {
            js("biziń eramızǵa shekem.")
        } else {
            js("biziń eramızǵa shekem")
        }
    });

    // 7) The year abbreviation and the hyphen-cut `t-ra`.
    s = rewrite(&s, &bt.year, &js("$1 jıl"));
    s = rewrite(&s, &bt.t_ra, &js("temperatur$1"));

    // 8) The clock: the colons spent, the figures kept.
    s = rewrite_with(
        &s,
        js_re!(
            // `24:00`, ISO 8601's end of day, is a clock too (#1581).
            r"(?<![\d:.,])([01]?\d|2[0-3]|24(?=:00(?!:))):([0-5]\d)(?::([0-5]\d))?(?![\d:.,])",
            "gu"
        ),
        |m, t| {
            let hm = g(m, t, 1).concat(&js(" ")).concat(&g(m, t, 2));
            match m.group(3, t) {
                None => hm,
                Some(se) => hm.concat(&js(" ")).concat(&se),
            }
        },
    );

    // 9) Signs, then the paired second sign before a degree.
    s = rewrite(
        &s,
        js_re!(r"(^|(?<!\d)[\s(])\+\s?(?=\d)", "gu"),
        &js("$1plyus "),
    );
    s = rewrite(
        &s,
        js_re!(r"(^|(?<!\d)[\s(])[-−–]\s?(?=\d)", "gu"),
        &js("$1minus "),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d)\+(?=\d{1,3}\s?(?:°|gradus))", "gu"),
        &js(" plyus "),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d)-(?=\d{1,2}\s?(?:°|gradus))", "gu"),
        &js(" minus "),
    );

    // 10) Degrees, the word not doubled where the writer glossed the sign.
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?[CС](?![\p{L}\p{M}])(?!\s*gradus)", "gui"),
        &js("$1 gradus"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?[CС](?![\p{L}\p{M}])", "gui"),
        &js("$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°(?!\s*gradus)", "gu"),
        &js("$1 gradus "),
    );
    s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1"));

    // 11) Ranges as a pause.
    s = rewrite(&s, js_re!(r"(\d)\s?[–—]\s?(?=\d)", "gu"), &js("$1, "));
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d.,\-\/])(\d+)\s?-\s?(\d+)(?![\d\/])(?!\s?-\s?\d)",
            "gu"
        ),
        &js("$1, $2"),
    );
    rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" "))
}
