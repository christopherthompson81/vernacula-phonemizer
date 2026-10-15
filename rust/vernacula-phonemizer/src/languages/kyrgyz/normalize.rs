//! Kyrgyz (ky) text normalization: invisible characters, digit grouping, abbreviations, `N-noun` ordinals, case
//! suffixes after a numeral / percent / unit / acronym (harmonised onto the spoken word), signed and suffixed
//! degrees, the symbol tier, equations, fractions, decimals and the initialism pass. Ported from
//! src/languages/kyrgyz/normalize.ts — see that file for the corpus evidence.

use std::sync::{Arc, LazyLock, OnceLock};

use indexmap::IndexMap;

use super::kyrgyz::number_words;
use super::manifest::MANIFEST;
use crate::core::data_source::load_once;
use crate::core::initialisms::{
    InitialismData, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, is_js_space, js, js_number};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{escape, rewrite, rewrite_with};
use crate::js_re;

/// `HARMONY`: last vowel → (high, low) suffix vowel. Generated from normalize.ts's object literal.
fn harmony(c: u16) -> Option<(&'static str, &'static str)> {
    const T: [(&str, &str, &str); 9] = [
        ("а", "ы", "а"),
        ("ы", "ы", "а"),
        ("о", "у", "о"),
        ("у", "у", "а"),
        ("е", "и", "е"),
        ("и", "и", "е"),
        ("э", "и", "е"),
        ("ө", "ү", "ө"),
        ("ү", "ү", "ө"),
    ];
    T.iter()
        .find(|(k, _, _)| k.encode_utf16().eq([c]))
        .map(|(_, hi, lo)| (*hi, *lo))
}

const VOWELS: &str = "аоуыеэиөүяюё";
const VOICELESS: &str = "пфктсшчхцщ";

/// `harmonyOf(word)`: by the last code unit with an entry; back-unrounded when none has.
fn harmony_of(word: &JsString) -> (&'static str, &'static str) {
    word.units()
        .iter()
        .rev()
        .find_map(|&u| harmony(u))
        .unwrap_or(("ы", "а"))
}

fn ends_in(w: &JsString, set: &str) -> bool {
    w.units()
        .last()
        .is_some_and(|&u| set.encode_utf16().any(|x| x == u))
}

#[derive(Clone, Copy, PartialEq, Debug)]
pub(crate) enum Case {
    Abl,
    Dat,
    Loc,
    Acc,
    Gen,
    Equ,
    Poss,
    PossAcc,
    PossDat,
}

/// `suffix(stem, kind)`: the case ending, by the stem's harmony, final vowel and final voicing.
fn suffix(stem: &JsString, kind: Case) -> JsString {
    let (hi, lo) = harmony_of(stem);
    let vowel = ends_in(stem, VOWELS);
    let voiceless = ends_in(stem, VOICELESS);
    let d = if voiceless { "т" } else { "д" };
    let poss = if vowel {
        format!("с{hi}")
    } else {
        hi.to_string()
    };
    js(&match kind {
        Case::Abl => format!("{d}{lo}н"),
        Case::Dat => format!("{}{lo}", if voiceless { "к" } else { "г" }),
        Case::Loc => format!("{d}{lo}"),
        Case::Acc => format!("{}{hi}", if vowel { "н" } else { d }),
        Case::Gen => format!("{}{hi}н", if vowel { "н" } else { d }),
        Case::Equ => format!("{d}{lo}й"),
        Case::Poss => poss,
        Case::PossAcc => format!("{poss}н"),
        Case::PossDat => format!("{poss}н{lo}"),
    })
}

/// `SUFFIX_TABLE`, in order: the first pattern that matches the whole tail names its case.
fn suffix_kind(tail: &JsString) -> Option<Case> {
    let table: [(&JsRegex, Case); 9] = [
        (js_re!(r"^(?:[дтн][ыиуү]н)$", "u"), Case::Gen),
        (js_re!(r"^(?:[дт][аеоө]н)$", "u"), Case::Abl),
        (js_re!(r"^(?:[дт][аеоө]й)$", "u"), Case::Equ),
        (js_re!(r"^(?:[ыиуү]|с[ыиуү])н[аеоө]$", "u"), Case::PossDat),
        (js_re!(r"^(?:[ыиуү]|с[ыиуү])н$", "u"), Case::PossAcc),
        (js_re!(r"^(?:[гк][аеоө])$", "u"), Case::Dat),
        (js_re!(r"^(?:[дт][аеоө])$", "u"), Case::Loc),
        (js_re!(r"^(?:[дтн][ыиуү])$", "u"), Case::Acc),
        (js_re!(r"^(?:[ыиуү]|с[ыиуү])$", "u"), Case::Poss),
    ];
    table.iter().find(|(re, _)| re.test(tail)).map(|(_, k)| *k)
}

const SUFFIX_RE: &str = r"(?:[дтн][ыиуү]н|[дт][аеоө][нй]|(?:с?[ыиуү])н[аеоө]|(?:с?[ыиуү])н|[гк][аеоө]|[дт][аеоө]|[дтн][ыиуү]|с?[ыиуү])";
const NOT_WORD: &str = r"(?![\p{L}\p{M}])";
const NOT_WORD_BEFORE: &str = r"(?<![\p{L}\p{M}])";
const CYR: &str = r"\p{Script=Cyrillic}";

/// `glue(words, kind)`: the case ending on the last word.
fn glue(words: &JsString, kind: Case) -> JsString {
    let mut parts = words.split(&js(" "));
    let last = parts.last().unwrap().clone();
    *parts.last_mut().unwrap() = last.concat(&suffix(&last, kind));
    JsString::join(&parts, &js(" "))
}

/// `kyrgyzOrdinal(n)`: -(ы)нчы by four-way harmony on the cardinal's last word.
pub(crate) fn kyrgyz_ordinal(n: f64) -> Option<JsString> {
    let words = number_words(n).filter(|w| !w.is_empty())?;
    let mut parts = words.split(&js(" "));
    let last = parts.last().unwrap().clone();
    let (hi, _) = harmony_of(&last);
    let tail = if ends_in(&last, VOWELS) {
        format!("нч{hi}")
    } else {
        format!("{hi}нч{hi}")
    };
    *parts.last_mut().unwrap() = last.concat(&js(&tail));
    Some(JsString::join(&parts, &js(" ")))
}

type WordTest = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

static IS_UNREADABLE: LazyLock<WordTest> = LazyLock::new(|| {
    let set = |v: &[&str]| v.iter().map(|s| js(s)).collect();
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(r"[аеёиоөуүыэюя]", "u").unwrap(),
        legal_onsets: set(&[
            "бл", "бр", "гл", "гр", "др", "кл", "кр", "пл", "пр", "сл", "см", "сп", "ст", "тр",
            "фл", "фр", "хл", "хр", "зв", "св", "тв", "дв", "сн", "шт",
        ]),
        legal_codas: set(&[
            "рт", "рк", "рд", "рм", "рн", "рс", "рп", "рг", "рз", "рш", "рч", "нт", "нд", "нч",
            "нң", "нс", "нк", "лт", "лк", "лд", "лп", "лм", "ст", "шт", "фт", "кт", "пт", "йт",
            "йл", "йн", "йм", "йк",
        ]),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableKyrgyz(word)`.
pub(crate) fn is_unreadable_kyrgyz(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

/// `normalizeKyrgyzInitialisms(text, onPipeline)`. `LETTER_NAME[l]`: `l` is one lowercased code point, which
/// no `Object.prototype` member is.
pub(crate) fn normalize_kyrgyz_initialisms(text: &JsString, on_pipeline: bool) -> JsString {
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
                MANIFEST.acronym_letters.iter().any(|a| *w == **a)
            }),
            is_recorded: |_: &JsString| false,
            is_unreadable: IS_UNREADABLE.clone(),
        },
        on_pipeline,
    )(text)
}

/// `UNIT_WORD`. Generated from normalize.ts's object literal by `.probe/turkic/literal.mjs` (key order
/// preserved; no key is integer-like).
const UNIT_WORD: [(&str, &str); 34] = [
    ("км²", "чарчы километр"),
    ("м²", "чарчы метр"),
    ("см²", "чарчы сантиметр"),
    ("мм²", "чарчы миллиметр"),
    ("км2", "чарчы километр"),
    ("м2", "чарчы метр"),
    ("см2", "чарчы сантиметр"),
    ("км³", "куб километр"),
    ("м³", "куб метр"),
    ("см³", "куб сантиметр"),
    ("дм³", "куб дециметр"),
    ("км3", "куб километр"),
    ("м3", "куб метр"),
    ("см3", "куб сантиметр"),
    ("дм3", "куб дециметр"),
    ("км", "километр"),
    ("мм", "миллиметр"),
    ("см", "сантиметр"),
    ("дм", "дециметр"),
    ("м", "метр"),
    ("кг", "килограмм"),
    ("мг", "миллиграмм"),
    ("мкг", "микрограмм"),
    ("га", "гектар"),
    ("мл", "миллилитр"),
    ("л", "литр"),
    ("km²", "чарчы километр"),
    ("km2", "чарчы километр"),
    ("km", "километр"),
    ("cm", "сантиметр"),
    ("mm", "миллиметр"),
    ("kg", "килограмм"),
    ("mg", "миллиграмм"),
    ("ha", "гектар"),
];

/// `SYMBOLS`, built once.
pub(crate) fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let words = |w: &[&str]| w.iter().map(|x| x.to_string()).collect::<Vec<_>>();
        let units: IndexMap<String, Vec<String>> = UNIT_WORD
            .iter()
            .map(|(k, w)| (k.to_string(), vec![w.to_string()]))
            .collect();
        let currency: IndexMap<String, Vec<String>> = [("$", "доллар"), ("€", "евро")]
            .iter()
            .map(|(k, w)| (k.to_string(), vec![w.to_string()]))
            .collect();
        make_symbol_normalizer(&SymbolData {
            percent: Some(words(&["пайыз"])),
            currency: Some(currency),
            units: Some(units),
            magnitudes: Some(words(&["миллиард", "миллион", "триллион", "миң"])),
            ampersand: Some("жана".into()),
            ..Default::default()
        })
    })
}

fn g(m: &JsMatch, s: &JsString, i: usize) -> JsString {
    m.group(i, s).unwrap_or_default()
}

/// `s.trimEnd()`.
fn trim_end(s: &JsString) -> JsString {
    let v = s.units();
    let end = v
        .iter()
        .rposition(|&u| !is_js_space(u))
        .map_or(0, |e| e + 1);
    JsString::from_units(&v[..end])
}

struct Built {
    ordinal_head: JsRegex,
    ordinal_noun: JsRegex,
    numeral_suffix: JsRegex,
    percent_suffix: JsRegex,
    minus_range: JsRegex,
    minus_degree: JsRegex,
    degree_scale: JsRegex,
    degree_bare: JsRegex,
    unit_suffix: JsRegex,
    acronym_suffix: JsRegex,
}

/// The patterns normalize.ts builds with `new RegExp` at call time, built once.
static BUILT: LazyLock<Built> = LazyLock::new(|| {
    let re = |p: String, f: &str| JsRegex::new(&p, f).unwrap();
    // NO_SIGN_LEFT: the TS template holds a literal ′ and a `′` escape, both U+2032 in the pattern.
    let no_sign_left = "(?<![\\d°\u{2032}'\u{2032}\\p{L}\\p{M}])";
    let suffix_arm = format!("(?:-?({SUFFIX_RE}))?{NOT_WORD}");
    // `Object.keys(UNIT_WORD).sort((a, b) => b.length - a.length)` (stable), each escaped.
    let mut keys: Vec<&str> = UNIT_WORD.iter().map(|(k, _)| *k).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.encode_utf16().count()));
    let unit_alt = keys.iter().map(|k| escape(k)).collect::<Vec<_>>().join("|");
    Built {
        ordinal_head: re(
            format!(r"(?<![\d.,])(\d{{1,12}})-(\d{{1,12}})-({CYR}+)"),
            "giu",
        ),
        ordinal_noun: re(format!(r"(?<![\d.,])(\d{{1,12}})-({CYR}+)"), "giu"),
        numeral_suffix: re(
            format!(r"(?<![\d.,\p{{L}}\p{{M}}])(\d{{1,12}})-?({SUFFIX_RE}){NOT_WORD}"),
            "gu",
        ),
        percent_suffix: re(format!(r"(\d)\s?%\s?-?({SUFFIX_RE}){NOT_WORD}"), "gu"),
        minus_range: re(
            format!(r"{no_sign_left}[-−–—]\s?(\d+(?:,\d+)?)(?=\s?[.…]{{2,3}}\s?[-−–—]\s?\d+\s?°)"),
            "gui",
        ),
        minus_degree: re(
            format!(r"{no_sign_left}[-−–—]\s?(\d+(?:,\d+)?)(?=\s?°)"),
            "gui",
        ),
        degree_scale: re(format!(r"(\d)\s?°\s?[CСFcсf]{suffix_arm}"), "gu"),
        degree_bare: re(format!(r"(\d)\s?°{suffix_arm}"), "gu"),
        unit_suffix: re(
            format!(r"(?<![\d.,])(\d[\d.,]*\d|\d)\s?({unit_alt})({SUFFIX_RE}){NOT_WORD}"),
            "gu",
        ),
        acronym_suffix: re(
            format!(r"{NOT_WORD_BEFORE}(\p{{Lu}}{{2,}})({SUFFIX_RE}){NOT_WORD}"),
            "gu",
        ),
    }
});

/// `UNIT_WORD[key]`: `key` came from the alternation of its own keys, matched exactly.
fn unit_word(key: &JsString) -> Option<&'static str> {
    UNIT_WORD.iter().find(|(k, _)| *key == **k).map(|(_, w)| *w)
}

/// The degree arms' replacement: `${d} градус` plus the suffix's case (locative when unrecognised).
fn degree(m: &JsMatch, t: &JsString) -> JsString {
    let base = g(m, t, 1).concat(&js(" градус"));
    match m.group(2, t) {
        None => base,
        Some(tail) => {
            let kind = suffix_kind(&tail).unwrap_or(Case::Loc);
            base.concat(&suffix(&js("градус"), kind))
        }
    }
}

/// `normalizeKyrgyz(input)`. The steps are order-dependent, as in the TS.
pub(crate) fn normalize_kyrgyz(input: &JsString) -> JsString {
    let b = &*BUILT;
    let mut s = input.clone();

    // Invisible characters, and a literal `&nbsp;`.
    s = rewrite(
        &s,
        js_re!("[\u{ad}\u{200b}-\u{200f}\u{feff}]", "gu"),
        &JsString::new(),
    );
    s = rewrite(&s, js_re!(r"&nbsp;?", "gu"), &js(" "));

    // Digit grouping: space groups (four passes), then comma groups of three or more.
    for _ in 0..4 {
        s = rewrite(
            &s,
            js_re!(
                r"(?<=\d)(?<!(?<![\d\.,])0)[ \u00a0\u202f\u2009](?=\d{3}(?![\d]))",
                "gu"
            ),
            &JsString::new(),
        );
    }
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])([1-9]\d{0,2})(?:,\d{3}){2,}(?![\d.,])", "gu"),
        |m, t| js_re!(r",", "gu").replace(&m.value(t), &JsString::new()),
    );

    // Abbreviations and magnitude abbreviations.
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])б\.\s?[зэ]\.\s?ч\.?(?![\p{L}\p{M}])",
            "giu"
        ),
        &js("биздин заманга чейин"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])ж\.\s?б\.", "gu"),
        &js("жана башка"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])б\.\s?а\.", "gu"),
        &js("башкача айтканда"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d\s?)млрд\.?(?![\p{L}\p{M}])", "gu"),
        &js("миллиард"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d\s?)трлн\.?(?![\p{L}\p{M}])", "gu"),
        &js("триллион"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d\s?)млн\.?(?![\p{L}\p{M}])", "gu"),
        &js("миллион"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d)-жж\.?(?![\p{L}\p{M}])", "gu"),
        &js("-жылдары"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d)-ж\.?(?![\p{L}\p{M}])", "gu"),
        &js("-жылы"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d)-к\.?(?![\p{L}\p{M}])", "gu"),
        &js("-кылым"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d)-б\.?(?![\p{L}\p{M}])", "gu"),
        &js("-бет"),
    );

    // `N-N-noun` and `N-noun`: ordinals before a head that is not itself a case suffix.
    s = rewrite_with(&s, &b.ordinal_head, |m, t| {
        let head = g(m, t, 3);
        if suffix_kind(&head.to_lower_case()).is_some() {
            return m.value(t);
        }
        let oa = kyrgyz_ordinal(js_number(&g(m, t, 1)));
        let ob = kyrgyz_ordinal(js_number(&g(m, t, 2)));
        match (oa, ob) {
            (Some(a), Some(o)) => a.concat(&js(" ")).concat(&o).concat(&js(" ")).concat(&head),
            _ => m.value(t),
        }
    });
    s = rewrite_with(&s, &b.ordinal_noun, |m, t| {
        let head = g(m, t, 2);
        if suffix_kind(&head.to_lower_case()).is_some() {
            return m.value(t);
        }
        match kyrgyz_ordinal(js_number(&g(m, t, 1))) {
            Some(ord) => ord.concat(&js(" ")).concat(&head),
            None => m.value(t),
        }
    });
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d{1,4})\s+(кылым[\p{Script=Cyrillic}]*)",
            "giu"
        ),
        |m, t| match kyrgyz_ordinal(js_number(&g(m, t, 1))) {
            Some(ord) => ord.concat(&js(" ")).concat(&g(m, t, 2)),
            None => m.value(t),
        },
    );

    // A case suffix after a numeral, then after a percent.
    s = rewrite_with(&s, &b.numeral_suffix, |m, t| {
        let kind = suffix_kind(&g(m, t, 2));
        match (kind, number_words(js_number(&g(m, t, 1)))) {
            (Some(k), Some(w)) => glue(&w, k),
            _ => m.value(t),
        }
    });
    s = rewrite_with(&s, &b.percent_suffix, |m, t| {
        match suffix_kind(&g(m, t, 2)) {
            None => m.value(t),
            Some(k) => g(m, t, 1)
                .concat(&js(" пайыз"))
                .concat(&suffix(&js("пайыз"), k)),
        }
    });

    // Signed degrees (a range of two first), then the degree arms.
    s = rewrite(&s, &b.minus_range, &js("минус $1"));
    s = rewrite(&s, &b.minus_degree, &js("минус $1"));
    s = rewrite_with(&s, &b.degree_scale, degree);
    s = rewrite_with(
        &s,
        js_re!(
            r#"(\d)\s?°\s?(\d{1,2})\s?[′'](?:\s?(\d{1,2})\s?[″"])?"#,
            "gu"
        ),
        |m, t| {
            let mut out = g(m, t, 1)
                .concat(&js(" градус "))
                .concat(&g(m, t, 2))
                .concat(&js(" минут"));
            if let Some(se) = m.group(3, t) {
                out = out.concat(&js(" ")).concat(&se).concat(&js(" секунд"));
            }
            out
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)о\s?[CС](?![\p{L}\p{M}])", "gu"),
        &js("$1 градус"),
    );
    s = rewrite_with(&s, &b.degree_bare, degree);

    // A clock / score colon between digits.
    s = rewrite(&s, js_re!(r"(?<=\d):(?=\d)", "gu"), &js(" "));

    // A case suffix after a unit.
    s = rewrite_with(&s, &b.unit_suffix, |m, t| {
        let kind = suffix_kind(&g(m, t, 3));
        let word = unit_word(&g(m, t, 2));
        let (Some(kind), Some(word)) = (kind, word) else {
            return m.value(t);
        };
        let mut parts = js(word).split(&js(" "));
        let last = parts.last().unwrap().clone();
        *parts.last_mut().unwrap() = last.concat(&suffix(&last, kind));
        g(m, t, 1)
            .concat(&js(" "))
            .concat(&JsString::join(&parts, &js(" ")))
    });

    // The shared symbol tier.
    s = try_symbols().unwrap_or_else(|e| panic!("{e}")).apply(&s);

    // Equations, the numero sign, fractions, decimals.
    s = rewrite_with(
        &s,
        js_re!(
            r"([\d\p{Script=Cyrillic}])\s*=\s*([\d\p{Script=Cyrillic}][^=.,;:!?()]{0,40})",
            "gu"
        ),
        |m, t| {
            g(m, t, 1)
                .concat(&js(" "))
                .concat(&trim_end(&g(m, t, 2)))
                .concat(&js(" барабар"))
        },
    );
    s = rewrite(&s, js_re!(r"№\s?(?=\d)", "gu"), &js("номер "));
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d./,])(\d{1,2})\s?\/\s?(\d{1,2})(?![\d./,])",
            "gu"
        ),
        |m, t| {
            let (n, den) = (js_number(&g(m, t, 1)), js_number(&g(m, t, 2)));
            if !(n >= 1.0 && n < den && den <= 12.0) {
                return m.value(t);
            }
            match (number_words(den), number_words(n)) {
                (Some(dw), Some(nw)) => glue(&dw, Case::Abl).concat(&js(" ")).concat(&nw),
                _ => m.value(t),
            }
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+),(\d{1,2})(?![\d.,])", "gu"),
        |m, t| {
            let frac = g(m, t, 2);
            let w = number_words(js_number(&g(m, t, 1)));
            let f = number_words(js_number(&frac));
            let den = number_words(if frac.len() == 1 { 10.0 } else { 100.0 });
            match (w, f, den) {
                (Some(w), Some(f), Some(den)) => w
                    .concat(&js(" бүтүн "))
                    .concat(&glue(&den, Case::Abl))
                    .concat(&js(" "))
                    .concat(&f),
                _ => m.value(t),
            }
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\.(\d+)(?![\d.,])", "gu"),
        &js("$1 $2"),
    );

    // A case suffix after an acronym, spelled by the initialism pass off the pipeline.
    s = rewrite_with(&s, &b.acronym_suffix, |m, t| {
        let run = g(m, t, 1);
        let spelled = normalize_kyrgyz_initialisms(&run, false);
        match suffix_kind(&g(m, t, 2)) {
            Some(k) if spelled != run => glue(&spelled, k),
            _ => m.value(t),
        }
    });

    normalize_kyrgyz_initialisms(&s, true)
}
