//! Crimean Tatar (crh) text normalization: the percent sign with its suffix, the author's square measure and the
//! Russian magnitude abbreviations, the shared symbol tier, de-grouping, decimals, the era marker, coordinate
//! abbreviations, ranges (before signs), the minus and degrees.
//! Ported from src/languages/crimeantatar/normalize.ts — see that file for the corpus evidence.

use std::sync::{LazyLock, OnceLock};

use crate::core::boundaries::{NOT_LETTER_AFTER, NOT_LETTER_BEFORE};
use crate::core::data_source::load_once;
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// normalize.ts's `makeSymbolNormalizer({…})` literal, evaluated from the source and `JSON.stringify`'d.
const SYMBOL_DATA: &str = r#"{"percent":["faiz"],"currency":{"US$":["dollar"],"$":["dollar"]},"units":{"km":["kilometr"],"m":["metr"],"sm":["santimetr"],"mm":["millimetr"],"kg":["kilogramm"],"sn":["saniye"]},"exponentWords":{"squared":["kvadrat"],"cubed":["kub"],"position":"before"},"ampersand":"ve","magnitudes":["biñ","million","milliard"]}"#;

pub(crate) fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
        make_symbol_normalizer(&data)
    })
}

/// `SYMBOLS`, for code reached only through a checked path (`createCrimeanTatar` builds it first).
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
    kvadrat_km: JsRegex,
    mln_dot: JsRegex,
    mlrd_dot: JsRegex,
    mln: JsRegex,
    mlrd: JsRegex,
    era: JsRegex,
    coords: Vec<(JsRegex, &'static str, &'static str)>,
}

/// The patterns normalize.ts builds with `new RegExp`, built once.
static BUILT: LazyLock<Built> = LazyLock::new(|| {
    let re = |p: String| JsRegex::new(&p, "gu").unwrap();
    let (b, a) = (NOT_LETTER_BEFORE, NOT_LETTER_AFTER);
    let coords = [
        (r"ş\s?\.\s?e\s?\.", "şimaliy", "enlik"),
        (r"c\s?\.\s?e\s?\.", "cenübiy", "enlik"),
        (r"ş\s?\.\s?b\s?\.", "şarqiy", "boyluq"),
        (r"ğ\s?\.\s?b\s?\.", "ğarbiy", "boyluq"),
    ]
    .iter()
    .map(|(pat, adj, noun)| (re(format!(r"{b}{pat}(\s*)({noun}\p{{L}}*)?")), *adj, *noun))
    .collect();
    Built {
        kvadrat_km: re(format!(r"{b}kvadrat(\s+)km{a}")),
        mln_dot: re(format!(r"{b}mln\s?\.\s?")),
        mlrd_dot: re(format!(r"{b}mlrd\s?\.\s?")),
        mln: re(format!("{b}mln{a}")),
        mlrd: re(format!("{b}mlrd{a}")),
        era: re(format!(r"{b}m\s?\.\s?e\s?\.")),
        coords,
    }
});

/// `normalizeCrimeanTatar(input)`. The steps are order-dependent, as in the TS.
pub(crate) fn normalize_crimean_tatar(input: &JsString) -> JsString {
    let bt = &*BUILT;
    let mut s = input.clone();

    // 1) The percent sign and its case suffix.
    s = rewrite(
        &s,
        // A space only around the hyphen: `50% ve` is not *faizve* (#1581).
        js_re!(r"(\d)\s?%(?:\s?-\s?)?(\p{Ll}{1,4})(?![\p{L}\p{M}])", "gu"),
        &js("$1 faiz$2"),
    );

    // 2) The author's square measure, and the Russian magnitude abbreviations.
    s = rewrite(&s, &bt.kvadrat_km, &js("kvadrat$1kilometr"));
    s = rewrite(&s, &bt.mln_dot, &js("million "));
    s = rewrite(&s, &bt.mlrd_dot, &js("milliard "));
    s = rewrite(&s, &bt.mln, &js("million"));
    s = rewrite(&s, &bt.mlrd, &js("milliard"));

    // 3) The shared symbol tier.
    s = symbols(&s);

    // 4) De-grouping by space, comma and dot.
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
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:,\d{3})+)(?!\d)",
            "gu"
        ),
        |m, t| g(m, t, 1).concat(&js_re!(r",", "gu").replace(&g(m, t, 2), &JsString::new())),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<!\d)(?<![\d][.,])([1-9]\d{0,2})((?:\.\d{3})+)(?!\d)",
            "gu"
        ),
        |m, t| g(m, t, 1).concat(&js_re!(r"\.", "gu").replace(&g(m, t, 2), &JsString::new())),
    );

    // 5) Decimal separators spent.
    s = rewrite(&s, js_re!(r"(\d)[.,](?=\d)", "gu"), &js("$1 "));

    // 6) The era marker; the final dot is kept as the period when nothing but closing punctuation follows.
    s = rewrite_with(&s, &bt.era, |m, t| {
        let rest = t.slice(m.end() as isize, None);
        if js_re!(r#"^\s*["»)']?\s*$"#, "u").test(&rest) {
            js("milâttan evel.")
        } else {
            js("milâttan evel")
        }
    });

    // 7) Coordinate abbreviations; the head noun only when the writer has not written it.
    for (re, adj, noun) in bt.coords.iter() {
        s = rewrite_with(&s, re, |m, t| {
            let gap = g(m, t, 1);
            match m.group(2, t) {
                None => js(&format!("{adj} {noun}")).concat(&gap),
                Some(head) => js(adj).concat(&gap).concat(&head),
            }
        });
    }

    // 8) Ranges, before the signs.
    s = rewrite(&s, js_re!(r"(\d)\s?[–—]\s?(?=[+-]?\d)", "gu"), &js("$1, "));
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d.,\-\/])(\d+)\s?-\s?(\d+)(?![\d\/])(?!\s?-\s?\d)",
            "gu"
        ),
        &js("$1, $2"),
    );

    // 9) The minus.
    s = rewrite(
        &s,
        // The sign is tight against its figure (#1581).
        js_re!(r"(^|(?<!\d)[\s(])[-−–](\d)", "gu"),
        &js("$1minus $2"),
    );

    // 10) Degrees.
    s = rewrite(
        &s,
        js_re!(
            r"(\d)\s?°\s?[CСcс]\s?-\s?(\p{Ll}{1,4})(?![\p{L}\p{M}])",
            "gu"
        ),
        &js("$1 derece$2"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?[CСcс](?![\p{L}\p{M}])", "gu"),
        &js("$1 derece"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?-\s?(\p{Ll}{1,4})(?![\p{L}\p{M}])", "gu"),
        &js("$1 derece$2"),
    );
    s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 derece "));

    // ⚠ A plain `s.replace`, not `rewrite`, in the TS: off the provenance seam.
    js_re!(r"[^\S\n]{2,}", "gu").replace(&s, &js(" "))
}
