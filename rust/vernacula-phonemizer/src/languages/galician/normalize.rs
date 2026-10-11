//! Galician (gl) text normalization: digit grouping, era markers, número, abbreviations, ordinal indicators,
//! decimals, currencies, degrees, clocks, signs, fractions, ranges and initialisms rewritten into words.
//! Ported from src/languages/galician/normalize.ts — see that file for the corpus evidence and the ordering.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::manifest::MANIFEST;
use super::numbers::number_to_words;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const ORD_UNITS: [&str; 10] = [
    "", "primeiro", "segundo", "terceiro", "cuarto", "quinto", "sexto", "sétimo", "oitavo",
    "noveno",
];
const ORD_TENS: [&str; 10] = [
    "",
    "décimo",
    "vixésimo",
    "trixésimo",
    "cuadraxésimo",
    "quincuaxésimo",
    "sexaxésimo",
    "septuaxésimo",
    "octoxésimo",
    "nonaxésimo",
];

/// `galicianOrdinal(n)`: the masculine ordinal, 1 … 100.
pub fn galician_ordinal(n: f64) -> Option<JsString> {
    if !(n.is_finite() && n.trunc() == n) || !(1.0..=100.0).contains(&n) {
        return None;
    }
    if n == 100.0 {
        return Some(js("centésimo"));
    }
    if n < 10.0 {
        return Some(js(ORD_UNITS[n as usize]));
    }
    let (t, u) = ((n / 10.0).floor() as usize, (n % 10.0) as usize);
    Some(js(&if u == 0 {
        ORD_TENS[t].to_string()
    } else {
        format!("{} {}", ORD_TENS[t], ORD_UNITS[u])
    }))
}

/// `feminineOrdinal(masc)`: a composed word, not the pipeline string.
fn feminine_ordinal(masc: &JsString) -> JsString {
    js_re!(r"o(?=\s|$)", "gu").replace(masc, &js("a"))
}

/// The TS object's key order: `Object.keys(DOTTED_ABBREV).join("|")` builds the alternation.
const DOTTED_ABBREV: [(&str, &str); 9] = [
    ("etc", "etcétera"),
    ("dr", "doutor"),
    ("dra", "doutora"),
    ("sr", "señor"),
    ("sra", "señora"),
    ("prof", "profesor"),
    ("vol", "volume"),
    ("páx", "páxina"),
    ("séc", "século"),
];

/// `DOTTED_ABBREV[ab.toLowerCase()]`: own keys only (a match of the alternation is never a prototype name).
fn dotted_abbrev(ab: &JsString) -> Option<&'static str> {
    let l = ab.to_lower_case();
    DOTTED_ABBREV.iter().find(|(k, _)| l == *k).map(|(_, v)| *v)
}

fn abbrev_alt() -> String {
    DOTTED_ABBREV
        .iter()
        .map(|(k, _)| *k)
        .collect::<Vec<_>>()
        .join("|")
}

static ABBREV_CONTINUES: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}])({})\.(\s+)(?=[\p{{L}}\d])",
            abbrev_alt()
        ),
        "giu",
    )
    .unwrap()
});
static ABBREV_ENDS: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}])({})\.(?=\s*(?:[.,;:!?»)]|$))",
            abbrev_alt()
        ),
        "giu",
    )
    .unwrap()
});

/// `LETTER_NAME` (insertion order is the TS object's).
const LETTER_NAME: [(&str, &str); 27] = [
    ("a", "a"),
    ("b", "be"),
    ("c", "ce"),
    ("d", "de"),
    ("e", "e"),
    ("f", "efe"),
    ("g", "gue"),
    ("h", "hache"),
    ("i", "i"),
    ("j", "iota"),
    ("k", "ka"),
    ("l", "ele"),
    ("m", "eme"),
    ("n", "ene"),
    ("ñ", "eñe"),
    ("o", "o"),
    ("p", "pe"),
    ("q", "cu"),
    ("r", "erre"),
    ("s", "ese"),
    ("t", "te"),
    ("u", "u"),
    ("v", "uve"),
    ("w", "uve dobre"),
    ("x", "xis"),
    ("y", "i grego"),
    ("z", "zeta"),
];

type WordTest = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

/// `isUnreadableGalician`: the phonotactic test for core/initialisms.ts.
pub static IS_UNREADABLE: LazyLock<WordTest> = LazyLock::new(|| {
    let set = |xs: &[&str]| xs.iter().map(|x| js(x)).collect::<Vec<_>>();
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new("[aeiouáéíóúü]", "u").unwrap(),
        legal_onsets: set(&[
            "bl", "br", "cl", "cr", "dr", "fl", "fr", "gl", "gr", "pl", "pr", "tr", "ch", "ll",
            "rr", "nh", "qu", "gu",
        ]),
        legal_codas: set(&[
            "b", "c", "d", "l", "n", "r", "s", "x", "z", "ls", "ns", "rs", "is", "us", "ct", "cc",
            "st", "sc", "lt", "rt", "nt", "sk", "mp", "mb", "ks", "lc", "rc", "rd", "rn", "rm",
            "rl", "lg", "nd",
        ]),
        liquids: None,
        digraphs: None,
    }))
});

fn word_set(xs: &[&str]) -> HashSet<JsString> {
    xs.iter().map(|w| js(w)).collect()
}
static WORD_ACRONYMS: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    word_set(&[
        "onu", "otan", "unesco", "covid", "sida", "ovni", "láser", "radar",
    ])
});
static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    word_set(&[
        "isbn", "pib", "iso", "si", "eeuu", "ue", "cd", "dvd", "utc", "gmt", "pdf", "url",
    ])
});

fn normalize_initialisms(s: &JsString) -> JsString {
    let ln: LetterName = Arc::new(|l: &JsString| {
        let l = l.to_lower_case();
        LETTER_NAME
            .iter()
            .find(|(k, _)| l == *k)
            .map(|(_, v)| js(v))
    });
    make_initialism_normalizer(
        InitialismData {
            letter_name: ln,
            lower: None,
            acronym_letters: Arc::new(|w: &JsString| ACRONYM_LETTERS.contains(w)),
            is_recorded: |w: &JsString| WORD_ACRONYMS.contains(w),
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(s)
}

/// `GROUP_SPACE`: space, NBSP, thin space, NNBSP — the TS literal's characters, in its order.
const GROUP_SPACE: &str = " \u{a0}\u{2009}\u{202f}";

static GROUP_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<=\d)(?<!(?<![\d\.,])0)[{GROUP_SPACE}](?=\d{{3}}(?!\d))"),
        "gu",
    )
    .unwrap()
});
static GROUP_FOLD: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("[{GROUP_SPACE}]"), "gu").unwrap());

fn g(m: &JsMatch, i: usize, s: &JsString) -> JsString {
    m.group(i, s).unwrap_or_default()
}

fn clock_words(h: f64, min: f64) -> JsString {
    if min == 0.0 {
        number_to_words(h, None)
    } else {
        number_to_words(h, None)
            .concat(&js(" e "))
            .concat(&number_to_words(min, None))
    }
}

/// `normalizeGalician(input)`. Steps are ORDER-DEPENDENT; see the TS for each one's coupling.
pub fn normalize_galician(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 0) digit grouping (twice: a match consumes the lookbehind digit of the next), then the leftover spaces
    s = rewrite(&s, &GROUP_RE, &JsString::new());
    s = rewrite(&s, &GROUP_RE, &JsString::new());
    s = rewrite(&s, &GROUP_FOLD, &js(" "));

    // 1) era markers
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])a\.\s?e\.\s?c\.(?![\p{L}\p{M}])", "giu"),
        &js("antes da Era común"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])a\.\s?C\.(?![\p{L}\p{M}])", "gu"),
        &js("antes de Cristo"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])d\.\s?C\.(?![\p{L}\p{M}])", "gu"),
        &js("despois de Cristo"),
    );

    // 2) número
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(?:n\.º|nº|n°|núm\.)\s?(?=\d)", "giu"),
        &js("número "),
    );

    // 3) dotted capital runs; a capital's dot before a capital word
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])\p{Lu}\.(?:[  ]?\p{Lu}\.)+", "gu"),
        |m, t| js_re!(r"[.\s]", "gu").replace(&m.value(t), &JsString::new()),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\p{Lu})\.(?=\s+\p{Lu})", "gu"),
        &JsString::new(),
    );

    // 4) abbreviations (the miss branch is reachable under the iu fold, #1122)
    s = rewrite_with(&s, &ABBREV_CONTINUES, |m, t| {
        match dotted_abbrev(&g(m, 1, t)) {
            None => m.value(t),
            Some(w) => js(w).concat(&g(m, 2, t)),
        }
    });
    s = rewrite_with(&s, &ABBREV_ENDS, |m, t| match dotted_abbrev(&g(m, 1, t)) {
        None => m.value(t),
        Some(w) => js(w).concat(&js(".")),
    });

    // 5) ordinal indicators
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])([1-9]\d{0,2}(?:\.\d{3})+|\d+)\.?(º|ª)(?![\p{L}\p{M}])",
            "gu"
        ),
        |m, t| {
            let digits = g(m, 1, t);
            let n = js_number(&js_re!(r"\.", "gu").replace(&digits, &JsString::new()));
            let masc = if n <= 100.0 {
                galician_ordinal(n)
            } else {
                None
            };
            match masc {
                None => digits,
                Some(masc) if g(m, 2, t) == "ª" => feminine_ordinal(&masc),
                Some(masc) => masc,
            }
        },
    );

    // 6) dot decimals
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d{1,2})(?![\d.])", "gu"),
        &js(&format!("$1 {} $2", MANIFEST.numbers.decimal_connector)),
    );

    // 7) currencies the tier does not carry
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(?:US|AUD|CAD)\$(?=[  ]?\d)", "gu"),
        &js("$"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])R\$\s?(\d[\d.,]*)", "gu"),
        &js("$1 reais"),
    );

    // 8) degrees
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?C(?![\p{L}\p{M}])", "gui"),
        &js("$1 graos Celsius"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?F(?![\p{L}\p{M}])", "gui"),
        &js("$1 graos Fahrenheit"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d)\s?°\s?([NSEO])(?![\p{L}\p{M}])", "gu"),
        |m, t| {
            let dir = match g(m, 2, t).to_string_lossy().as_str() {
                "N" => "norte",
                "S" => "sur",
                "E" => "leste",
                _ => "oeste",
            };
            g(m, 1, t).concat(&js(" graos ")).concat(&js(dir))
        },
    );
    s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 graos"));

    // 9) clocks: h:mm:ss read as three numbers, then h:mm
    s = rewrite(
        &s,
        js_re!(r"(?<![\d:])(\d{1,2}):([0-5]\d):([0-5]\d)(?![:\d])", "gu"),
        &js("$1 $2 $3"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d:,])([01]?\d|2[0-3]):([0-5]\d)(?![:.\d])", "gu"),
        |m, t| clock_words(js_number(&g(m, 1, t)), js_number(&g(m, 2, t))),
    );

    // 10) signs
    s = rewrite(&s, js_re!("±", "gu"), &js(" máis menos "));
    s = rewrite(
        &s,
        js_re!(r"(^|[\s(])[-−–](\d+(?:[.,]\d+)?)(?!\d*[-–])", "gu"),
        &js("$1menos $2"),
    );
    s = rewrite(&s, js_re!(r"(\S)\+\s?(?=\d)", "gu"), &js("$1 máis "));
    s = rewrite(&s, js_re!(r"(^|\s)\+\s?(?=\d)", "gu"), &js("$1máis "));
    s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" igual a "));
    s = rewrite(
        &s,
        js_re!(r"(?<=[\p{L}\p{Nd}])\s?<\s?(?=[\p{L}\p{Nd}])", "gu"),
        &js(" menor que "),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=[\p{L}\p{Nd}])\s?>\s?(?=[\p{L}\p{Nd}])", "gu"),
        &js(" maior que "),
    );
    s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" dividido por "));

    // 11) fractions (a letter glued after the denominator is split off)
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d/.,])(\d{1,2})\/(\d{1,2})(?![\d/.,])(\p{L})?", "gu"),
        |m, t| {
            let (num, den) = (js_number(&g(m, 1, t)), js_number(&g(m, 2, t)));
            if !(2.0..=12.0).contains(&den) || num < 1.0 || num > den {
                return m.value(t);
            }
            let sep = match m.group(3, t) {
                None => JsString::new(),
                Some(tail) => js(" ").concat(&tail),
            };
            if den == 2.0 {
                let head = if num == 1.0 {
                    js("medio")
                } else {
                    number_to_words(num, None).concat(&js(" medios"))
                };
                return head.concat(&sep);
            }
            let noun = if den == 3.0 {
                Some(js("terzo"))
            } else {
                galician_ordinal(den)
            };
            let Some(noun) = noun else {
                return m.value(t);
            };
            let noun = if num == 1.0 {
                noun
            } else {
                noun.concat(&js("s"))
            };
            number_to_words(num, None)
                .concat(&js(" "))
                .concat(&noun)
                .concat(&sep)
        },
    );

    // 12) numeric ranges
    s = rewrite(&s, js_re!(r"(?<=\d)\s?[-–—]\s?(?=\d)", "gu"), &js(" a "));

    // 13) the ditto mark
    s = rewrite(&s, js_re!("〃", "gu"), &js(" ídem "));

    // 14) initialisms
    s = normalize_initialisms(&s);

    rewrite(&s, js_re!(r"[^\S\n]{2,}", "gu"), &js(" "))
}
