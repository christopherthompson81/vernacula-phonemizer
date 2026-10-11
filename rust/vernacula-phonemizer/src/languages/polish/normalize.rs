//! Polish (pl) text normalization: digit grouping, multi-dot and dotted abbreviations, rate units, `godz.`,
//! `r.`/`w.`/`nr`, the `N.` ordinal (decades inflected), clock times, ranges, signs and fractions rewritten into
//! words, plus the separately-run initialism pass and the Polish count-form selector.
//! Ported from src/languages/polish/normalize.ts — see that file for the corpus evidence and the ordering.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::manifest::MANIFEST;
use super::roman_ordinals::ordinal;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{alternation, sorted_by_length_desc};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `GROUP_SPACE`: ASCII space, NBSP, NNBSP and thin space (the TS writes the last three as escapes).
const GROUP_SPACE: &str = " \u{a0}\u{202f}\u{2009}";

/// `plCountForm(n)`: 0 = nominative singular (EXACTLY 1), 1 = paucal, 2 = genitive plural, 3 = genitive
/// singular for a non-integer count.
pub fn pl_count_form(n: f64) -> f64 {
    if n == 1.0 {
        return 0.0;
    }
    if !(n.is_finite() && n.fract() == 0.0) {
        return 3.0;
    }
    let m100 = n.abs() % 100.0;
    if (12.0..=14.0).contains(&m100) {
        return 2.0;
    }
    let m10 = m100 % 10.0;
    if (2.0..=4.0).contains(&m10) { 1.0 } else { 2.0 }
}

/// `counted(n, forms)`: `forms[Math.min(plCountForm(n), forms.length - 1)]`.
fn counted(n: f64, forms: &[&'static str]) -> &'static str {
    forms[(pl_count_form(n) as usize).min(forms.len() - 1)]
}

#[derive(Clone, Copy)]
enum OrdCase {
    Fem,
    FemObl,
    FemInstr,
    PlGen,
    PlNom,
}

/// `inflectOrdinal(masc, c)`: every element of the masculine-nominative ordinal takes the case ending.
fn inflect_ordinal(masc: &JsString, c: OrdCase) -> JsString {
    let words: Vec<JsString> = masc
        .split(&js(" "))
        .into_iter()
        .map(|w| {
            let pick = |t: [&str; 5]| {
                js(t[match c {
                    OrdCase::Fem => 0,
                    OrdCase::FemObl => 1,
                    OrdCase::FemInstr => 2,
                    OrdCase::PlGen => 3,
                    OrdCase::PlNom => 4,
                }])
            };
            if w.ends_with(&js("gi")) || w.ends_with(&js("ki")) {
                return w
                    .slice(0, Some(-1))
                    .concat(&pick(["a", "iej", "ą", "ich", "ie"]));
            }
            if w.ends_with(&js("ci")) {
                return w
                    .slice(0, Some(-1))
                    .concat(&pick(["ia", "iej", "ią", "ich", "ie"]));
            }
            let stem = js_re!("y$", "u").replace(&w, &JsString::new());
            stem.concat(&pick(["a", "ej", "ą", "ych", "e"]))
        })
        .collect();
    JsString::join(&words, &js(" "))
}

type Predicate = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

/// `isUnreadablePolish`: the phonotactic test for core/initialisms.ts.
static IS_UNREADABLE: LazyLock<Predicate> = LazyLock::new(|| {
    let p = &MANIFEST.phonotactics;
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(&format!("[{}]", p.vowels), "u").unwrap(),
        legal_onsets: p.onsets.iter().map(|o| js(o)).collect(),
        legal_codas: p.codas.iter().map(|c| js(c)).collect(),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadablePolish(word)`.
pub(crate) fn is_unreadable_polish(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.acronym_letters.iter().map(|w| js(w)).collect());

/// `CURRENCY_CODES`: the currency table's keys, lowercased.
static CURRENCY_CODES: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    MANIFEST
        .symbol_tier
        .currency
        .keys()
        .map(|k| js(k).to_lower_case())
        .collect()
});

/// `(l) => MANIFEST.letterNames[l]`: `l` is one lowercased code point, which no `Object.prototype` member's
/// name is, so an own-key lookup is the same thing.
static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| {
    Arc::new(|l: &JsString| {
        MANIFEST
            .letter_names
            .get(&l.to_string_lossy())
            .map(|n| js(n))
    })
});

/// `normalizePolishInitialisms(text)`: a currency code the symbol table names counts as recorded.
pub(crate) fn normalize_polish_initialisms(text: &JsString) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: LETTER_NAME.clone(),
            lower: None,
            acronym_letters: Arc::new(|w: &JsString| ACRONYM_LETTERS.contains(w)),
            is_recorded: |low: &JsString| CURRENCY_CODES.contains(low),
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(text)
}

/// `DOTTED`, in the TS object's key order (generated from normalize.ts).
const DOTTED: [(&str, &str); 11] = [
    ("np", "na przykład"),
    ("ok", "około"),
    ("tzn", "to znaczy"),
    ("tzw", "tak zwany"),
    ("itp", "i tym podobne"),
    ("itd", "i tak dalej"),
    ("ds", "do spraw"),
    ("zob", "zobacz"),
    ("im", "imienia"),
    ("ang", "angielski"),
    ("jr", "junior"),
];

/// `DOTTED[key]`; the key is a lowercased match, which the `iu` fold can widen past the table (#1122).
fn dotted(key: &JsString) -> Option<&'static str> {
    DOTTED.iter().find(|(k, _)| js(k) == *key).map(|(_, v)| *v)
}

static DOTTED_ALT: LazyLock<String> =
    LazyLock::new(|| alternation(&sorted_by_length_desc(DOTTED.iter().map(|(k, _)| js(k)))));

const DEGREE: [&str; 3] = ["stopień", "stopnie", "stopni"];
const KMH: [&str; 4] = ["kilometr", "kilometry", "kilometrów", "kilometra"];
const MILE: [&str; 4] = ["mila", "mile", "mil", "mili"];

const PREP_ALT: &str = "o|po|przy|około|do|z|od|przed|między|nad|pod";

/// `HOUR_ORD(h)`: hour 0 declines.
fn hour_ord(h: f64) -> Option<JsString> {
    if h == 0.0 { None } else { ordinal(h) }
}

/// `clockCase(prep)`: godzina's form and the ordinal's case, from the governing preposition.
fn clock_case(prep: Option<&JsString>) -> (&'static str, OrdCase) {
    let p = prep.map(|p| p.to_lower_case()).unwrap_or_default();
    let is = |xs: &[&str]| xs.iter().any(|x| p == js(x));
    if is(&["o", "po", "przy"]) {
        return ("godzinie", OrdCase::FemObl);
    }
    if is(&["około", "do", "z", "od"]) {
        return ("godziny", OrdCase::FemObl);
    }
    if is(&["przed", "między", "nad", "pod"]) {
        return ("godziną", OrdCase::FemInstr);
    }
    ("godzina", OrdCase::Fem)
}

/// `keepFinal(expansion, matched, …offset, whole)`: re-attach the sentence period an abbreviation's dot was
/// also doing.
fn keep_final(expansion: JsString, m: &JsMatch, whole: &JsString) -> JsString {
    if js_re!(r#"^[\s»)”"']*$"#, "u").test(&whole.slice(m.end() as isize, None)) {
        expansion.concat(&js("."))
    } else {
        expansion
    }
}

static GROUP_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<=\d)(?<!(?<![\d\.,])0)[{GROUP_SPACE}](?=\d{{3}}(?!\d))"),
        "gu",
    )
    .unwrap()
});
static GROUP_SPACE_RE: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("[{GROUP_SPACE}]"), "gu").unwrap());

/// `MULTI_DOT`, claimed first.
static MULTI_DOT: LazyLock<[(JsRegex, &str); 3]> = LazyLock::new(|| {
    [
        (
            JsRegex::new(r"(?<![\p{L}\p{M}])p\.\s?n\.\s?e\.", "giu").unwrap(),
            "przed naszą erą",
        ),
        (
            JsRegex::new(r"(?<![\p{L}\p{M}])n\.\s?e\.", "giu").unwrap(),
            "naszej ery",
        ),
        (
            JsRegex::new(r"(?<![\p{L}\p{M}])m\.\s?in\.", "giu").unwrap(),
            "między innymi",
        ),
    ]
});

static GODZ_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<![\p{{L}}\p{{M}}])(?:({PREP_ALT})\s+)?godz\."),
        "giu",
    )
    .unwrap()
});

static DOTTED_CONTINUES: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r#"(?<![\p{{L}}\p{{M}}.])({})\.(\s+)(?=[\p{{L}}\d(„"])"#,
            *DOTTED_ALT
        ),
        "giu",
    )
    .unwrap()
});

static DOTTED_ENDS: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}.])({})\.(?=\s*(?:[,;:!?»)”]|$))",
            *DOTTED_ALT
        ),
        "giu",
    )
    .unwrap()
});

static CLOCK_PREP: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?:^|[\s(])({PREP_ALT})\s+(?:godzin\p{{L}}*\s+)?$"),
        "iu",
    )
    .unwrap()
});

/// `normalizePolish(input)`.
pub(crate) fn normalize_polish(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 0) digit de-grouping (twice: the groups overlap on the shared digit), then the separators to a space.
    for _ in 0..2 {
        s = rewrite(&s, &GROUP_RE, &JsString::new());
    }
    s = rewrite(&s, &GROUP_SPACE_RE, &js(" "));

    // 1) multi-dot abbreviations.
    for (re, w) in MULTI_DOT.iter() {
        s = rewrite_with(&s, re, |m, t| keep_final(js(w), m, t));
    }

    // 2) compound rate units.
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?km\s?\/\s?(?:h|godz\.?)(?![\p{L}\p{M}])", "giu"),
        |m, t| {
            let n = m.group(1, t).unwrap();
            let e = n
                .concat(&js(" "))
                .concat(&js(counted(js_number(&n), &KMH)))
                .concat(&js(" na godzinę"));
            keep_final(e, m, t)
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])km\s?\/\s?(?:h|godz\.?)(?![\p{L}\p{M}])",
            "giu"
        ),
        |m, t| keep_final(js("kilometrów na godzinę"), m, t),
    );
    s = rewrite_with(&s, js_re!(r"(\d+)\s?mph(?![\p{L}\p{M}])", "giu"), |m, t| {
        let n = m.group(1, t).unwrap();
        n.concat(&js(" "))
            .concat(&js(counted(js_number(&n), &MILE)))
            .concat(&js(" na godzinę"))
    });
    s = rewrite(
        &s,
        js_re!(r"(\d+)\s?Mb\s?\/\s?s(?![\p{L}\p{M}])", "gu"),
        &js("$1 megabitów na sekundę"),
    );

    // 3) `godz.` in the case the preceding preposition governs.
    s = rewrite_with(&s, &GODZ_RE, |m, t| {
        let prep = m.group(1, t);
        let head = match &prep {
            Some(p) if !p.is_empty() => p.concat(&js(" ")),
            _ => JsString::new(),
        };
        head.concat(&js(clock_case(prep.as_ref()).0))
    });

    // 4) `r.` / `w.` after a number (w. takes the ordinal), `s.` between numbers, and `nr`.
    s = rewrite_with(&s, js_re!(r"(\d+)(\s+)r\.", "gu"), |m, t| {
        let e = m
            .group(1, t)
            .unwrap()
            .concat(&m.group(2, t).unwrap())
            .concat(&js("roku"));
        keep_final(e, m, t)
    });
    s = rewrite_with(&s, js_re!(r"(\d+)(\s+)w\.", "gu"), |m, t| {
        let n = m.group(1, t).unwrap();
        let e = ordinal(js_number(&n))
            .unwrap_or(n)
            .concat(&m.group(2, t).unwrap())
            .concat(&js("wieku"));
        keep_final(e, m, t)
    });
    s = rewrite(&s, js_re!(r"(\d)\s?s\.\s?(?=\d)", "gu"), &js("$1 strona "));
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])nr\.?(?=\s+[\d\p{Lu}])", "gu"),
        &js("numer"),
    );

    // 5) single-dot abbreviations. ⚠ The miss branch is reachable (#1122): the `iu` fold widens the pattern
    //    past the table's keys, and the match then stays as written.
    s = rewrite_with(&s, &DOTTED_CONTINUES, |m, t| {
        match dotted(&m.group(1, t).unwrap().to_lower_case()) {
            None => m.value(t),
            Some(w) => js(w).concat(&m.group(2, t).unwrap()),
        }
    });
    s = rewrite_with(&s, &DOTTED_ENDS, |m, t| {
        match dotted(&m.group(1, t).unwrap().to_lower_case()) {
            None => m.value(t),
            Some(w) => js(w).concat(&js(".")),
        }
    });

    // 6) version / figure dots between digits.
    s = rewrite(&s, js_re!(r"(\d)\.(?=\d)", "gu"), &js("$1 kropka "));

    // 7) the `N.` ordinal: decades after lat/lata/latach inflect, any other lowercase follower reads the
    //    masculine nominative. The head may be capitalised (`Lata 90.`; #1522): `[Ll]`, not the `i` flag, under
    //    which `\p{Ll}` in the lookahead would match uppercase too.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d.,])([Ll]at|[Ll]ata|[Ll]atach)(\s+)(\d+)\.(?=\s*[,\p{Ll}])",
            "gu"
        ),
        |m, t| {
            let head = m.group(1, t).unwrap();
            let n = js_number(&m.group(3, t).unwrap());
            match ordinal(n) {
                Some(masc) if n % 10.0 == 0.0 => {
                    let c = if head.to_lower_case() == js("lata") {
                        OrdCase::PlNom
                    } else {
                        OrdCase::PlGen
                    };
                    head.concat(&m.group(2, t).unwrap())
                        .concat(&inflect_ordinal(&masc, c))
                }
                _ => m.value(t),
            }
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d.,])(\d+)\.(?=\s*[,\p{Ll}])", "gu"),
        |m, t| ordinal(js_number(&m.group(1, t).unwrap())).unwrap_or_else(|| m.value(t)),
    );

    // 8) clock: the hour a feminine ordinal in the case of the preposition before the match; `:00` drops.
    //    The left guard mirrors the right (#1522), or `123:45` read `23:45` out of its tail.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])(?!,\d)",
            "gu"
        ),
        |m, t| {
            let Some(masc) = hour_ord(js_number(&m.group(1, t).unwrap())) else {
                return m.value(t);
            };
            let before = t.slice(0, Some(m.index() as isize));
            let prep = CLOCK_PREP.exec(&before).and_then(|pm| pm.group(1, &before));
            let head = inflect_ordinal(&masc, clock_case(prep.as_ref()).1);
            let min = m.group(2, t).unwrap();
            if js_number(&min) == 0.0 {
                head
            } else {
                head.concat(&js(" ")).concat(&min)
            }
        },
    );

    // 9) numeric ranges.
    s = rewrite(&s, js_re!(r"(\d)\s?[–—-]\s?(?=\d)", "gu"), &js("$1 do "));

    // 10) signs.
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?°\s?C(?![\p{L}\p{M}])", "gui"),
        |m, t| {
            let n = m.group(1, t).unwrap();
            n.concat(&js(" "))
                .concat(&js(counted(js_number(&n), &DEGREE)))
                .concat(&js(" Celsjusza"))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?°\s?F(?![\p{L}\p{M}])", "gui"),
        |m, t| {
            let n = m.group(1, t).unwrap();
            n.concat(&js(" "))
                .concat(&js(counted(js_number(&n), &DEGREE)))
                .concat(&js(" Fahrenheita"))
        },
    );
    s = rewrite_with(&s, js_re!(r"(\d+)\s?°", "gu"), |m, t| {
        let n = m.group(1, t).unwrap();
        n.concat(&js(" "))
            .concat(&js(counted(js_number(&n), &DEGREE)))
    });
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)", "gu"),
        |m, t| {
            if js_re!(r"\d\s*$", "u").test(&t.slice(0, Some(m.index() as isize))) {
                m.value(t)
            } else {
                js("minus ")
            }
        },
    );
    s = rewrite(&s, js_re!("±", "gu"), &js(" plus minus "));
    s = rewrite(&s, js_re!(r"(^|[\s(])\+\s?(?=\d)", "gu"), &js("$1plus "));

    // 10b) relational and division signs.
    s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" równa się "));
    s = rewrite(&s, js_re!(r"\s?<\s?", "gu"), &js(" mniejsze niż "));
    s = rewrite(&s, js_re!(r"\s?>\s?", "gu"), &js(" większe niż "));
    s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" podzielić przez "));

    // 11) fractions with numerator 1, feminine. The guards are mirrors (#1522; as ru/uk, #1495): a `,` or `.`
    //     is refused only with a digit beyond it, so `1/2.` and `1/2, a` read.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d/]|\d\.|(?<![\d/])\d+,)(\d{1,3})\/(\d{1,3})(?![\d/]|\.\d|,\d+(?![\d/]))",
            "gu"
        ),
        |m, t| {
            let den = ordinal(js_number(&m.group(2, t).unwrap()));
            match den {
                Some(d) if js_number(&m.group(1, t).unwrap()) == 1.0 => {
                    js("jedna ").concat(&inflect_ordinal(&d, OrdCase::Fem))
                }
                _ => m.value(t),
            }
        },
    );

    s
}
