//! Ukrainian (uk) text normalization: digit grouping, multi-dot and dotted abbreviations, the numeral+suffix
//! notation (an ordinal or an oblique cardinal), units, clock times as feminine ordinals, signs, fractions and
//! dot decimals rewritten into words, plus the separately-run initialism pass.
//! Ported from src/languages/ukrainian/normalize.ts — see that file for the corpus evidence and the ordering.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, LazyLock};

use super::manifest::MANIFEST;
use super::numbers::east_slavic_number_words;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{alternation, slavic_count_form, sorted_by_length_desc};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `cardinal(n)`: the cardinal's words, a gap as "", joined and trimmed.
fn cardinal(n: u64) -> JsString {
    let words: Vec<JsString> = east_slavic_number_words(n, &MANIFEST.numbers.east)
        .into_iter()
        .map(|w| js(&w.unwrap_or_default()))
        .collect();
    JsString::join(&words, &js(" ")).trim()
}

/// `counted(n, forms)`: the count form for an integer, the genitive singular (index 3) for a decimal.
fn counted(n: f64, forms: &[String]) -> JsString {
    if n.is_finite() && n.fract() == 0.0 {
        js(&forms[(slavic_count_form(n) as usize).min(2)])
    } else {
        js(&forms[3])
    }
}

/// `Number(n.replace(",", "."))`: the FIRST comma only (a string pattern).
fn decimal_number(n: &JsString) -> f64 {
    let mut u = n.0.clone();
    if let Some(i) = u.iter().position(|&c| c == b',' as u16) {
        u[i] = b'.' as u16;
    }
    js_number(&JsString::from_units(&u))
}

fn is_integer(n: f64) -> bool {
    n.is_finite() && n.fract() == 0.0
}

/// `ordinalBase(n)`: the masculine-nominative ordinal; only the last element inflects.
fn ordinal_base(n: f64) -> Option<JsString> {
    if !is_integer(n) || n < 1.0 {
        return None;
    }
    let ord = &MANIFEST.ordinals;
    if n < 20.0 {
        return Some(js(&ord.one_to_nineteen[n as usize]));
    }
    if n < 100.0 {
        let (t, u) = ((n / 10.0).floor() as usize, (n % 10.0) as usize);
        if u == 0 {
            return Some(js(&ord.tens[t]));
        }
        // `DEF.numbers.tens[String(t * 10)]!`: a miss would stringify `undefined`.
        let tens = MANIFEST
            .numbers
            .east
            .base
            .tens
            .get(&(t * 10).to_string())
            .map_or("undefined", |s| s.as_str());
        return Some(js(&format!("{tens} {}", ord.one_to_nineteen[u])));
    }
    if n < 1000.0 {
        let r = n % 100.0;
        if r == 0.0 {
            return Some(js(&ord.hundreds[(n / 100.0) as usize]));
        }
        return Some(
            cardinal((n - r) as u64)
                .concat(&js(" "))
                .concat(&ordinal_base(r).unwrap()),
        );
    }
    if n < 10_000.0 && n % 1000.0 == 0.0 {
        return Some(js(&ord.thousands[(n / 1000.0) as usize]));
    }
    if n < 1_000_000.0 {
        let r = n % 1000.0;
        if r == 0.0 {
            return None;
        }
        return Some(
            cardinal((n - r) as u64)
                .concat(&js(" "))
                .concat(&ordinal_base(r).unwrap()),
        );
    }
    None
}

/// `caseIndex(name)`, as `new Map(endings.map((e, i) => [e.case, i]))`: a repeated name keeps its LAST index.
fn case_index(name: &str) -> usize {
    MANIFEST
        .ordinals
        .endings
        .iter()
        .rposition(|e| e.case == name)
        .expect("validated")
}

/// `ordinalForms(n)`: every case form, in the manifest's preference order. Only the final word inflects.
fn ordinal_forms(n: f64) -> Vec<JsString> {
    let Some(base) = ordinal_base(n) else {
        return Vec::new();
    };
    let words = base.split(&js(" "));
    let last = words.last().unwrap();
    let soft = last.ends_with(&js("ій"));
    let stem = last.slice(0, Some(-2));
    let head = JsString::join(&words[..words.len() - 1], &js(" "));
    MANIFEST
        .ordinals
        .endings
        .iter()
        .map(|e| {
            let mut out = JsString::new();
            if !head.is_empty() {
                out.push_str(&head);
                out.push_str(&js(" "));
            }
            out.push_str(&stem);
            out.push_str(&js(if soft { &e.soft } else { &e.hard }));
            out
        })
        .collect()
}

/// `genitiveCardinal(n)`: both halves of a compound decline; 1 … 999 only.
fn genitive_cardinal(n: f64) -> Option<JsString> {
    if !is_integer(n) || !(1.0..1000.0).contains(&n) {
        return None;
    }
    let g = &MANIFEST.genitive_cardinals;
    if n < 20.0 {
        return Some(js(&g.one_to_nineteen[n as usize]));
    }
    if n < 100.0 {
        let (t, u) = ((n / 10.0).floor() as usize, (n % 10.0) as usize);
        return Some(if u == 0 {
            js(&g.tens[t])
        } else {
            js(&format!("{} {}", g.tens[t], g.one_to_nineteen[u]))
        });
    }
    let (h, r) = ((n / 100.0).floor() as usize, n % 100.0);
    Some(if r == 0.0 {
        js(&g.hundreds[h])
    } else {
        js(&g.hundreds[h])
            .concat(&js(" "))
            .concat(&genitive_cardinal(r).unwrap())
    })
}

type Predicate = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

/// `isUnreadableUkrainian`: the phonotactic test for core/initialisms.ts.
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

/// `isUnreadableUkrainian(word)`.
pub(crate) fn is_unreadable_ukrainian(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.acronym_letters.iter().map(|w| js(w)).collect());

/// `(l) => DEF.letterNames[l]`: `l` is one lowercased code point, which no `Object.prototype` member's name
/// is, so an own-key lookup is the same thing.
static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| {
    Arc::new(|l: &JsString| {
        MANIFEST
            .letter_names
            .get(&l.to_string_lossy())
            .map(|n| js(n))
    })
});

/// `normalizeUkrainianInitialisms`: nothing is "recorded" (there is no lexicon), so the acronym list and the
/// OOV rule decide alone.
pub(crate) fn normalize_ukrainian_initialisms(text: &JsString) -> JsString {
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

/// `HOUR_CASE`: preposition → the `ordinals.endings` index it governs. A `Map` in the TS since #1525, so a
/// word such as `constructor` is an ordinary miss.
static HOUR_CASE: LazyLock<HashMap<String, usize>> = LazyLock::new(|| {
    MANIFEST
        .clock
        .preposition_case
        .iter()
        .map(|(p, name)| (p.clone(), case_index(name)))
        .collect()
});
static FEM_NOM: LazyLock<usize> = LazyLock::new(|| case_index(&MANIFEST.clock.default_case));
/// `GEN_PL`: the genitive plural a fraction's denominator takes after a numerator not ending in 1 (#1525).
static GEN_PL: LazyLock<usize> = LazyLock::new(|| case_index("genPl"));
/// `PREPOSED_ABBREV`: the abbreviations whose following capital is their object, not a new sentence.
static PREPOSED_ABBREV: LazyLock<HashSet<String>> =
    LazyLock::new(|| MANIFEST.preposed_abbrev.iter().cloned().collect());

/// `ABBREV_ALT`: the dotted-abbreviation keys, longest first (stable), unescaped as in the TS.
static ABBREV_ALT: LazyLock<String> = LazyLock::new(|| {
    alternation(&sorted_by_length_desc(
        MANIFEST.dotted_abbrev.keys().map(|k| js(k)),
    ))
});

/// `MULTI_DOT`, compiled in manifest order; whitespace after a dot is optional, after a bare word required.
static MULTI_DOT: LazyLock<Vec<(JsRegex, JsString)>> = LazyLock::new(|| {
    MANIFEST
        .multi_dot_abbrev
        .iter()
        .map(|md| {
            let parts: Vec<&str> = md.written.split(' ').collect();
            let mut src = String::from(r"(?<![\p{L}\p{M}])");
            for (i, part) in parts.iter().enumerate() {
                if i > 0 {
                    src += if parts[i - 1].ends_with('.') {
                        r"\s?"
                    } else {
                        r"\s+"
                    };
                }
                src += &part.replace('.', r"\.");
            }
            (JsRegex::new(&src, "giu").unwrap(), js(&md.reading))
        })
        .collect()
});

static ORDINAL_SUFFIX_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        r"(?<![\d.,])(\d+)\s?-\s?([а-яіїєґ]{1,3})(?![\p{L}\p{M}'’ʼ])",
        "giu",
    )
    .unwrap()
});

/// A key shaped like an INITIAL (one letter, or that letter doubled: р, рр) expands only as written in lowercase
/// (#1551; Правопис 2019 §64). See src/languages/ukrainian/normalize.ts.
fn case_refused(written: &JsString, key: &JsString) -> bool {
    js_re!(r"^(\p{L})\1?$", "u").test(key) && written != key
}

static ABBREV_CONTINUES: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}])({})\.(\s+)(?=([\p{{L}}\d(]))",
            *ABBREV_ALT
        ),
        "giu",
    )
    .unwrap()
});
static ABBREV_BEFORE_PUNCT: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<![\p{{L}}\p{{M}}])({})\.(?=\s*[,;:])", *ABBREV_ALT),
        "giu",
    )
    .unwrap()
});
static ABBREV_ENDS: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}])({})\.(?=\s*(?:[.!?»)]|$))",
            *ABBREV_ALT
        ),
        "giu",
    )
    .unwrap()
});

static METRE_RE: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"(\d+(?:[.,]\d+)?)\s?м(?![\p{L}\p{M}'’ʼ²³/])", "gu").unwrap());

static FEM_ONE_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!("{}$", MANIFEST.numbers.east.base.units[1]), "u").unwrap()
});
static FEM_TWO_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(&format!("{}$", MANIFEST.numbers.east.base.units[2]), "u").unwrap()
});

/// `feminine(words)`: the last element agrees with a feminine noun (одна, дві), `$`-anchored.
fn feminine(words: &JsString) -> JsString {
    let fm = &MANIFEST.numbers.east.feminine;
    let w = FEM_ONE_RE.replace(words, &js(&fm.one));
    FEM_TWO_RE.replace(&w, &js(&fm.two))
}

/// `DOTTED_ABBREV[key]`; the key is a lowercased match, which the `iu` fold can widen past the table.
fn dotted_abbrev(key: &JsString) -> Option<&'static str> {
    MANIFEST
        .dotted_abbrev
        .get(&key.to_string_lossy())
        .map(|s| s.as_str())
}

/// `normalizeUkrainian(input)`.
pub(crate) fn normalize_ukrainian(input: &JsString) -> JsString {
    let m = &*MANIFEST;
    let st = &m.symbol_tier;
    let sign = &m.sign_words;
    let unit_per = &st.unit_per;
    let metre = &st.units["м"];
    let degree = &m.degree;
    let mut s = input.clone();

    // 0) digit de-grouping (two passes: the groups overlap on the shared digit).
    for _ in 0..2 {
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)[    ](?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
    }
    s = rewrite(
        &s,
        js_re!(r"(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?!\d))", "gu"),
        &JsString::new(),
    );
    s = rewrite(&s, js_re!(r"[    ]", "gu"), &js(" "));

    // 1) multi-dot abbreviations; the final dot is kept when the abbreviation ends the sentence.
    for (re, word) in MULTI_DOT.iter() {
        s = rewrite_with(&s, re, |mm, full| {
            let rest = full.slice(mm.end() as isize, None);
            if js_re!(r#"^\s*["»)']?\s*$"#, "u").test(&rest) {
                word.concat(&js("."))
            } else {
                word.clone()
            }
        });
    }

    // 2) номер.
    s = rewrite(
        &s,
        js_re!(r"№\s?(?=\d)", "gu"),
        &js(&format!("{} ", m.number_sign)),
    );

    // 3) кв. км → км², кв. миль → the gen.pl adjective.
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?кв\.\s?км(?![\p{L}\p{M}])", "gu"),
        &js("$1 км²"),
    );
    let square_gen_pl = &st.exponent_words.squared.as_ref().expect("validated")[2];
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?кв\.\s?миль(?![\p{L}\p{M}])", "gu"),
        &js(&format!("$1 {square_gen_pl} миль")),
    );

    // 4) numeral + written suffix: an ordinal or an oblique (genitive) cardinal, accepted only if it ENDS with
    //    the written letters.
    s = rewrite_with(&s, &ORDINAL_SUFFIX_RE, |mm, t| {
        let whole = mm.value(t);
        let n = js_number(&mm.group(1, t).unwrap());
        let suffix = mm.group(2, t).unwrap().to_lower_case();
        let is = |x: &str| suffix == js(x);
        let cardinal_first =
            is("ти") || is("ми") || ((is("х") || is("их")) && !(n >= 20.0 && n % 10.0 == 0.0));
        let genitive = genitive_cardinal(n);
        let gen_fits = || genitive.clone().filter(|g| g.ends_with(&suffix));
        if cardinal_first {
            return gen_fits().unwrap_or(whole);
        }
        if let Some(form) = ordinal_forms(n).into_iter().find(|f| f.ends_with(&suffix)) {
            return form;
        }
        gen_fits().unwrap_or(whole)
    });

    // 5) dotted abbreviations. ⚠ The miss branch is reachable (#1122): the `iu` fold widens the pattern past
    //    the table's keys, so every arm keeps the match on a miss (the middle arm too, since #1525). A capital
    //    after the dot also ends the sentence, so the dot is kept, unless the abbreviation is preposed.
    s = rewrite_with(&s, &ABBREV_CONTINUES, |mm, t| {
        let written = mm.group(1, t).unwrap();
        let key = written.to_lower_case();
        match dotted_abbrev(&key) {
            None => mm.value(t),
            Some(_) if case_refused(&written, &key) => mm.value(t),
            Some(w) => {
                let sp = mm.group(2, t).unwrap();
                let next = mm.group(3, t).unwrap();
                if !PREPOSED_ABBREV.contains(&key.to_string_lossy())
                    && js_re!(r"\p{Lu}", "u").test(&next)
                {
                    js(w).concat(&js(".")).concat(&sp)
                } else {
                    js(w).concat(&sp)
                }
            }
        }
    });
    s = rewrite_with(&s, &ABBREV_BEFORE_PUNCT, |mm, t| {
        let written = mm.group(1, t).unwrap();
        let key = written.to_lower_case();
        match dotted_abbrev(&key) {
            None => mm.value(t),
            Some(_) if case_refused(&written, &key) => mm.value(t),
            Some(w) => js(w),
        }
    });
    s = rewrite_with(&s, &ABBREV_ENDS, |mm, t| {
        let written = mm.group(1, t).unwrap();
        let key = written.to_lower_case();
        match dotted_abbrev(&key) {
            None => mm.value(t),
            Some(_) if case_refused(&written, &key) => mm.value(t),
            Some(w) => js(w).concat(&js(".")),
        }
    });

    // 6) units the shared tier cannot express.
    s = rewrite_with(
        &s,
        js_re!(r"(\d+(?:[.,]\d+)?)\s?м\/с(?![\p{L}\p{M}])", "gu"),
        |mm, t| {
            let n = mm.group(1, t).unwrap();
            js(&format!(
                "{} {} {unit_per} {}",
                n,
                counted(decimal_number(&n), metre),
                st.rate_denominators["с"]
            ))
        },
    );
    s = rewrite_with(&s, &METRE_RE, |mm, t| {
        let n = mm.group(1, t).unwrap();
        n.concat(&js(" "))
            .concat(&counted(decimal_number(&n), metre))
    });
    s = rewrite(
        &s,
        js_re!(r"(?<=[\p{L}\p{M}]{3})\s?\/\s?год(?![\p{L}\p{M}])", "gu"),
        &js(&format!(" {unit_per} {}", st.rate_denominators["год"])),
    );
    let scale = |key: &str| js(&m.temperature_scales[key]);
    s = rewrite_with(
        &s,
        js_re!(r"(\d+(?:[.,]\d+)?)\s?°\s?[CСc](?![\p{L}\p{M}])", "gui"),
        |mm, t| {
            let n = mm.group(1, t).unwrap();
            n.concat(&js(" "))
                .concat(&counted(decimal_number(&n), degree))
                .concat(&js(" "))
                .concat(&scale("C"))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d+(?:[.,]\d+)?)\s?°\s?[FФf](?![\p{L}\p{M}])", "gui"),
        |mm, t| {
            let n = mm.group(1, t).unwrap();
            n.concat(&js(" "))
                .concat(&counted(decimal_number(&n), degree))
                .concat(&js(" "))
                .concat(&scale("F"))
        },
    );
    s = rewrite_with(&s, js_re!(r"(\d+(?:[.,]\d+)?)\s?°", "gu"), |mm, t| {
        let n = mm.group(1, t).unwrap();
        n.concat(&js(" "))
            .concat(&counted(decimal_number(&n), degree))
    });

    // 7) clock: the hour as a feminine ordinal in the case the preceding preposition governs.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:]|[.,]\d)",
            "gu"
        ),
        |mm, full| {
            let whole = mm.value(full);
            let hv = js_number(&mm.group(1, full).unwrap());
            let mv = js_number(&mm.group(2, full).unwrap());
            if hv == 0.0 {
                return whole;
            }
            let before = full.slice(0, Some(mm.index() as isize));
            let prev = js_re!(r"([\p{L}\p{M}']+)\s+$", "u")
                .exec(&before)
                .and_then(|p| p.group(1, &before))
                .map(|p| p.to_lower_case().to_string_lossy());
            let idx = match prev.as_deref() {
                Some(p) => HOUR_CASE.get(p).copied().unwrap_or(*FEM_NOM),
                None => *FEM_NOM,
            };
            let forms = ordinal_forms(hv);
            let Some(head) = forms.get(idx) else {
                return whole;
            };
            // The minutes agree with the feminine хвилина (#1525), and a leading zero is read (#1551): 1:01 is
            // перша нуль одна. See the TS twin.
            if mv == 0.0 {
                head.clone()
            } else {
                let zero = mm.group(2, full).unwrap().starts_with(&js("0"));
                head.concat(&js(if zero { " нуль " } else { " " }))
                    .concat(&feminine(&cardinal(mv as u64)))
            }
        },
    );

    // 8) signs.
    s = rewrite(
        &s,
        js_re!(r"(^|[\s(])[-−–](\d)", "gu"),
        &js(&format!("$1{} $2", sign.minus)),
    );
    s = rewrite(
        &s,
        js_re!("±", "gu"),
        &js(&format!(" {} ", sign.plus_minus)),
    );
    s = rewrite(
        &s,
        js_re!(r"(^|[\s(])\+\s?(\d)", "gu"),
        &js(&format!("$1{} $2", sign.plus)),
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

    // 9) numeric ranges.
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?[–—-]\s?(?=\d)", "gu"),
        &js(&format!("$1 {} ", m.range_word)),
    );

    // 10) fractions, feminine (the elided частина). The two guards are mirrors (#1495). The denominator takes
    //     the numerator's count (#1525): одна п'ята, but дві третіх, п'ять восьмих.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d\p{L}/]|\d\.|(?<![\d/])\d+,)(\d{1,3})\/(\d{1,3})(?![\d/\p{L}]|\.\d|,\d+(?![\d/]))",
            "gu"
        ),
        |mm, t| {
            let num = js_number(&mm.group(1, t).unwrap());
            let den = js_number(&mm.group(2, t).unwrap());
            let idx = if slavic_count_form(num) == 0.0 {
                *FEM_NOM
            } else {
                *GEN_PL
            };
            let Some(den_word) = ordinal_forms(den).into_iter().nth(idx) else {
                return mm.value(t);
            };
            feminine(&cardinal(num as u64))
                .concat(&js(" "))
                .concat(&den_word)
        },
    );

    // 11) dot decimals → the comma form the number token reads (1–2 digits, one fractional digit).
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.])(\d{1,2})\.(\d)(?![\d.])", "gu"),
        &js("$1,$2"),
    );

    s
}
