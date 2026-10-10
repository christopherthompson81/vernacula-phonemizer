//! Spanish (es / es-419) text normalization: abbreviations, era markers, ordinal indicators, signs, fractions,
//! times and dates rewritten into words before the tokenizer, plus the separately-run initialism pass.
//! Ported from src/languages/spanish/normalize.ts — see that file for the corpus evidence and the ordering.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::manifest::MANIFEST;
use super::numbers::{multiplier, number_to_words};
use super::roman_ordinals::spanish_ordinal;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number, js_number_to_string};
use crate::core::normalize_symbols::{alternation, sorted_by_length_desc};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `GROUP_SPACE`: space, NBSP, NNBSP, thin space, as the CHARACTERS (the TS literal holds them raw).
const GROUP_SPACE: &str = " \u{a0}\u{202f}\u{2009}";

fn alt_by_length_desc<'a>(keys: impl Iterator<Item = &'a String>) -> String {
    alternation(&sorted_by_length_desc(keys.map(|k| js(k))))
}

static GROUP_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<=\d)(?<!(?<![\d\.,])0)[{GROUP_SPACE}](?=\d{{3}}(?!\d))"),
        "gu",
    )
    .unwrap()
});
static ABBREV_CONTINUES: LazyLock<JsRegex> = LazyLock::new(|| {
    let alt = alt_by_length_desc(MANIFEST.dotted_abbrev.keys());
    JsRegex::new(
        &format!(r"(?<![\p{{L}}\p{{M}}\d_])({alt})\.(\s+)(?=\p{{L}})"),
        "giu",
    )
    .unwrap()
});
static ABBREV_ENDS: LazyLock<JsRegex> = LazyLock::new(|| {
    let alt = alt_by_length_desc(MANIFEST.dotted_abbrev.keys());
    JsRegex::new(
        &format!(r"(?<![\p{{L}}\p{{M}}\d_])({alt})\.(?=\s*(?:[.,;:!?»)]|$))"),
        "giu",
    )
    .unwrap()
});
static DATE_FIRST: LazyLock<JsRegex> = LazyLock::new(|| {
    let months = MANIFEST.months.join("|");
    JsRegex::new(&format!(r"\b1\.?º?\s+de\s+({months})\b"), "giu").unwrap()
});
/// `ordinals.apocopating` (checked against `units` at load), the ordinals the `er` indicator shortens.
static APOCOPATING_ORDINALS: LazyLock<Vec<JsString>> = LazyLock::new(|| {
    MANIFEST
        .ordinals
        .apocopating
        .iter()
        .map(|o| js(o))
        .collect()
});

static FEMININE_ONE_END: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("{}$", MANIFEST.numbers.ones[1]), "u").unwrap());

/// `isUnreadableSpanish`: the phonotactic test for core/initialisms.ts.
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

static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.acronym_letters.iter().map(|w| js(w)).collect());

/// `(l) => MANIFEST.letterNames[l]`. A plain-object read, but `l` is one lowercased code point, which no
/// `Object.prototype` member is, so own-key lookup is the same thing here.
static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| {
    Arc::new(|l: &JsString| {
        MANIFEST
            .letter_names
            .get(&l.to_string_lossy())
            .map(|n| js(n))
    })
});

/// `normalizeSpanishInitialisms`: nothing is "recorded" (no lexicon), so the acronym list and the OOV rule
/// decide alone.
pub(crate) fn normalize_spanish_initialisms(text: &JsString) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: LETTER_NAME.clone(),
            lower: None,
            acronym_letters: Arc::new(|w: &JsString| ACRONYM_LETTERS.contains(w)),
            is_recorded: |_: &JsString| false,
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(text)
}

/// `feminineOrdinal`: every element of a compound inflects (vigésimo primero → vigésima primera).
fn feminine_ordinal(masc: &JsString) -> JsString {
    let parts: Vec<JsString> = masc
        .split(&js(" "))
        .iter()
        .map(|w| js_re!("o$", "u").replace(w, &js("a")))
        .collect();
    JsString::join(&parts, &js(" "))
}

/// `feminineCardinal`: the words with the final *uno* feminized (la una, las veintiuna).
fn feminine_cardinal(n: f64) -> JsString {
    FEMININE_ONE_END.replace(&number_to_words(n, None), &js(&MANIFEST.feminine_one))
}

fn time_words(h: f64, min: f64) -> JsString {
    let head = feminine_cardinal(h);
    if min == 0.0 {
        head
    } else {
        head.concat(&js(" ")).concat(&feminine_cardinal(min))
    }
}

/// `String(n)` for the small non-negative integers a 1–3 digit capture gives.
fn int_string(n: f64) -> String {
    format!("{}", n as u64)
}

fn fraction_words(num: f64, den: f64) -> Option<JsString> {
    if den < 2.0 || num < 1.0 {
        return None;
    }
    let base = MANIFEST
        .fractions
        .denominators
        .get(&int_string(den))
        .map(|b| js(b))
        .or_else(|| spanish_ordinal(den))?;
    let head = multiplier(number_to_words(num, None));
    let noun = if num > 1.0 {
        base.concat(&js("s"))
    } else {
        base
    };
    Some(head.concat(&js(" ")).concat(&noun))
}

/// `normalizeSpanish(input, { americas })`. `americas` (es-419) reads the first of the month as an ordinal.
pub(crate) fn normalize_spanish(input: &JsString, americas: bool) -> JsString {
    let m = &*MANIFEST;
    let sw = &m.sign_words;
    let mut s = input.clone();

    // 0) digit grouping with a space (twice, as the TS does), then the separators to a plain space.
    s = rewrite(&s, &GROUP_RE, &JsString::new());
    s = rewrite(&s, &GROUP_RE, &JsString::new());
    s = rewrite(&s, js_re!(r"[    ]", "gu"), &js(" "));

    // 0b) a dot with one or two digits after it is a DECIMAL.
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\d.,:])(?<!:\d\d)(\d+)\.(\d{1,2})(?![\d.,\p{L}])",
            "gu"
        ),
        &js("$1,$2"),
    );

    // 1) era markers, before the generic abbreviation rule.
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d_])a\.\s?de\s?C\.|(?<![\p{L}\p{M}\d_])a\.\s?C\.",
            "giu"
        ),
        &js(&m.era_markers.before_christ),
    );
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d_])d\.\s?de\s?C\.|(?<![\p{L}\p{M}\d_])d\.\s?C\.",
            "giu"
        ),
        &js(&m.era_markers.after_christ),
    );

    // 2) EE. UU.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d_])EE\.\s?UU\.?", "gu"),
        &js(&m.united_states),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d_])ee\.\s?uu\.?", "gu"),
        &js(&m.united_states),
    );

    // 2b) a. m. / p. m., as the letter names.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d_])([ap])\.\s?m\.", "giu"),
        |mm, t| {
            let ap = mm.group(1, t).unwrap().to_lower_case();
            js(&format!(
                "{} {}",
                m.letter_names[&ap.to_string_lossy()],
                m.letter_names["m"]
            ))
        },
    );

    // 3) número, only before a digit.
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d_])(?:n\.º|nº|n°|n\.|no\.)\s?(?=\d)",
            "giu"
        ),
        &js(&format!("{} ", m.number_sign)),
    );

    // 4) dotted abbreviations. ⚠ The miss branch is reachable (#1122): the `iu` fold widens the pattern past
    //    the table's keys (`ſr.`), and the match then stays as written.
    s = rewrite_with(&s, &ABBREV_CONTINUES, |mm, t| {
        let ab = mm.group(1, t).unwrap();
        match m.dotted_abbrev.get(&ab.to_lower_case().to_string_lossy()) {
            None => mm.value(t),
            Some(w) => js(w).concat(&mm.group(2, t).unwrap()),
        }
    });
    s = rewrite_with(&s, &ABBREV_ENDS, |mm, t| {
        let ab = mm.group(1, t).unwrap();
        match m.dotted_abbrev.get(&ab.to_lower_case().to_string_lossy()) {
            None => mm.value(t),
            Some(w) => js(w).concat(&js(".")),
        }
    });

    // 5) ordinal indicators.
    s = rewrite_with(&s, js_re!(r"\b(\d+)\.?(?:er\b|º|ª)", "gu"), |mm, t| {
        let whole = mm.value(t);
        let digits = js_re!(r"\d+").exec(&whole).unwrap().value(&whole);
        let n = js_number(&digits);
        let Some(masc) = spanish_ordinal(n) else {
            // Past 1000 there is no ordinal: a declined `er` still drops its marker; º and ª keep theirs.
            return if js_re!("er$", "u").test(&whole) {
                js(&js_number_to_string(n))
            } else {
                whole
            };
        };
        if js_re!("ª", "u").test(&whole) {
            return feminine_ordinal(&masc);
        }
        if js_re!("er$", "u").test(&whole) {
            // `er` is the apocope of primero and tercero only (and the compounds ending in them). A declined
            // marker is dropped whole and the cardinal stands: the `.` of `2.er` would be a phrase break.
            return if APOCOPATING_ORDINALS.iter().any(|o| masc.ends_with(o)) {
                js_re!("o$", "u").replace(&masc, &JsString::new())
            } else {
                js(&js_number_to_string(n))
            };
        }
        masc
    });

    // 6) signs.
    s = rewrite(&s, js_re!("±", "gu"), &js(&format!(" {} ", sw.plus_minus)));
    s = rewrite(
        &s,
        js_re!(r"(\S)\+\s?(\d)", "gu"),
        &js(&format!("$1 {} $2", sw.plus)),
    );
    s = rewrite(
        &s,
        js_re!(r"(^|\s)\+\s?(\d)", "gu"),
        &js(&format!("$1{} $2", sw.plus)),
    );
    s = rewrite(
        &s,
        js_re!(r"(^|[\s(])[-−–](\d)", "gu"),
        &js(&format!("$1{} $2", sw.minus)),
    );

    // 6b) relational and division signs.
    s = rewrite(
        &s,
        js_re!(r"\s?=\s?", "gu"),
        &js(&format!(" {} ", sw.equals)),
    );
    s = rewrite(
        &s,
        js_re!(r"\s?<\s?", "gu"),
        &js(&format!(" {} ", sw.less_than)),
    );
    s = rewrite(
        &s,
        js_re!(r"\s?>\s?", "gu"),
        &js(&format!(" {} ", sw.greater_than)),
    );
    s = rewrite(
        &s,
        js_re!(r"\s?÷\s?", "gu"),
        &js(&format!(" {} ", sw.divided_by)),
    );

    // 7) fractions.
    s = rewrite_with(
        &s,
        js_re!(r"\b(\d{1,3})\/(\d{1,3})\b(?!\s*[/\d])", "gu"),
        |mm, t| {
            let (a, b) = (
                js_number(&mm.group(1, t).unwrap()),
                js_number(&mm.group(2, t).unwrap()),
            );
            fraction_words(a, b).unwrap_or_else(|| mm.value(t))
        },
    );

    // 8) times.
    s = rewrite_with(
        &s,
        js_re!(r"\b([01]?\d|2[0-3]):([0-5]\d)(?![\d:])", "gu"),
        |mm, t| {
            time_words(
                js_number(&mm.group(1, t).unwrap()),
                js_number(&mm.group(2, t).unwrap()),
            )
        },
    );

    // 9) dates: the first of the month.
    s = rewrite_with(&s, &DATE_FIRST, |mm, t| {
        if americas {
            js(&format!("{} de ", m.ordinals.units[1])).concat(&mm.group(1, t).unwrap())
        } else {
            js_re!(r"1\.?º?", "u").replace(&mm.value(t), &js(&m.numbers.ones[1]))
        }
    });

    s
}

/// The dotted-abbreviation rules start at a Unicode word edge, not an ASCII `\b` (#1480's shape). Each pair:
/// the abbreviation alone (the rule fires) and glued after a non-ASCII letter (it declines). Ported from
/// test/abbrev-word-edge.test.ts; every word is synthetic.
#[cfg(test)]
mod word_edge {
    use super::*;

    #[test]
    fn an_abbreviation_glued_after_a_non_ascii_letter_is_not_one() {
        let n = |s: &str| normalize_spanish(&js(s), false).to_string_lossy();
        for (fires, declines) in [
            ("Es la sta. María.", "Es un taoísta. María."),
            ("Vino la sta.", "Era un taoísta."),
            ("En 300 a. C. hubo", "En 300 Ña. C. hubo"),
            ("En 300 d. C. hubo", "En 300 Ñd. C. hubo"),
            ("Los EE. UU. ganan", "Los ÑEE. UU. ganan"),
            ("los ee. uu. ganan", "los ñee. uu. ganan"),
            ("a las 10 p. m. hoy", "a las 10 Ñp. m. hoy"),
            ("el n.º 5 gana", "el Ñn.º 5 gana"),
        ] {
            assert_ne!(n(fires), fires, "{fires}");
            assert_eq!(n(declines), declines, "{declines}");
        }
    }
}
