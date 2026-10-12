//! Slovak (sk) text normalization: digit grouping, era / multi-dot and dotted abbreviations, the governed clock
//! and clock range, version dots, ranges, the licensed and general (regnal) ordinals in their case slots, the
//! mile rate, signs, the shared symbol tier, the decimal comma, fractions, relational signs, the ampersand and
//! the initialism pass, plus the ordinal paradigm.
//! Ported from src/languages/slovak/normalize.ts — see that file for the corpus evidence and the ordering.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::manifest::MANIFEST;
use super::numbers::number_to_words;
use super::slovak::{SYMBOLS, sk_count_form};
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{alternation, sorted_by_length_desc};
use crate::core::provenance::{Form, renormalize, rewrite, rewrite_with};
use crate::js_re;

/// `LETTER_NAME`, in the TS object's key order.
const LETTER_NAMES: [(&str, &str); 43] = [
    ("a", "á"),
    ("á", "dlhé á"),
    ("ä", "á prehlasované"),
    ("b", "bé"),
    ("c", "cé"),
    ("č", "čé"),
    ("d", "dé"),
    ("ď", "ďé"),
    ("e", "é"),
    ("é", "dlhé é"),
    ("f", "ef"),
    ("g", "gé"),
    ("h", "há"),
    ("i", "í"),
    ("í", "dlhé í"),
    ("j", "jé"),
    ("k", "ká"),
    ("l", "el"),
    ("ĺ", "dlhé el"),
    ("ľ", "eľ"),
    ("m", "em"),
    ("n", "en"),
    ("ň", "eň"),
    ("o", "ó"),
    ("ó", "dlhé ó"),
    ("ô", "ó so vokáňom"),
    ("p", "pé"),
    ("q", "kvé"),
    ("r", "er"),
    ("ŕ", "dlhé er"),
    ("s", "es"),
    ("š", "eš"),
    ("t", "té"),
    ("ť", "ťé"),
    ("u", "ú"),
    ("ú", "dlhé ú"),
    ("v", "vé"),
    ("w", "dvojité vé"),
    ("x", "iks"),
    ("y", "ypsilon"),
    ("ý", "dlhé ypsilon"),
    ("z", "zet"),
    ("ž", "žet"),
];

/// `LETTER_NAME[l]`.
fn letter_name(l: &JsString) -> Option<JsString> {
    LETTER_NAMES
        .iter()
        .find(|(k, _)| js(k) == *l)
        .map(|(_, v)| js(v))
}

const LEGAL_ONSETS: [&str; 59] = [
    "bl", "br", "bz", "čl", "čm", "čn", "čr", "čv", "dl", "dr", "dv", "dž", "gl", "gn", "gr", "hl",
    "hm", "hn", "hr", "hv", "kl", "kn", "kr", "kv", "ml", "mn", "mr", "pl", "pn", "pr", "ps", "pt",
    "sk", "sl", "sm", "sn", "sp", "st", "sv", "sw", "šk", "šl", "šm", "šn", "šp", "št", "šv", "tl",
    "tr", "tv", "vl", "vn", "vr", "vz", "zl", "zn", "zv", "žl", "žn",
];
const LEGAL_CODAS: [&str; 24] = [
    "ck", "ct", "čt", "dn", "lm", "rb", "rd", "rk", "rl", "rm", "rn", "rs", "rt", "rv", "rž", "sk",
    "st", "šť", "št", "tn", "zd", "zl", "zm", "zn",
];

type Predicate = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

/// `isUnreadableSlovak`: the phonotactic test for core/initialisms.ts.
static IS_UNREADABLE: LazyLock<Predicate> = LazyLock::new(|| {
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new("[aeiouyáäéíóôúý]", "u").unwrap(),
        legal_onsets: LEGAL_ONSETS.iter().map(|o| js(o)).collect(),
        legal_codas: LEGAL_CODAS.iter().map(|c| js(c)).collect(),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableSlovak(word)`.
pub(crate) fn is_unreadable_slovak(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.acronym_letters.iter().map(|w| js(w)).collect());

/// `(l) => LETTER_NAME[l]`: `l` is one lowercased code point, which no `Object.prototype` member's name is.
static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| Arc::new(letter_name));

/// `normalizeSlovakInitialisms(text)`: nothing counts as recorded.
pub(crate) fn normalize_slovak_initialisms(text: &JsString) -> JsString {
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

/// `GROUP_SPACE`, verbatim: the regex escapes for space, NBSP, NNBSP and thin space.
const GROUP_SPACE: &str = r"    ";

/// `counted(n, forms)`: `forms[Math.min(skCountForm(n), 2)]`.
fn counted(n: f64, forms: &[&'static str; 3]) -> &'static str {
    forms[(sk_count_form(n) as usize).min(2)]
}

const HODINA: [&str; 3] = ["hodina", "hodiny", "hodín"];
const MINUTA: [&str; 3] = ["minúta", "minúty", "minút"];
const STUPEN: [&str; 3] = ["stupeň", "stupne", "stupňov"];
const MILA: [&str; 3] = ["míľa", "míle", "míľ"];

/// `feminine(words)`: a final jeden → jedna, a final dva → dve. Off the provenance seam.
fn feminine(words: &JsString) -> JsString {
    let a = js_re!("jeden$", "u").replace(words, &js("jedna"));
    js_re!("dva$", "u").replace(&a, &js("dve"))
}

const ORD_1_19: [&str; 20] = [
    "",
    "prvý",
    "druhý",
    "tretí",
    "štvrtý",
    "piaty",
    "šiesty",
    "siedmy",
    "ôsmy",
    "deviaty",
    "desiaty",
    "jedenásty",
    "dvanásty",
    "trinásty",
    "štrnásty",
    "pätnásty",
    "šestnásty",
    "sedemnásty",
    "osemnásty",
    "devätnásty",
];
const ORD_TENS: [&str; 10] = [
    "",
    "desiaty",
    "dvadsiaty",
    "tridsiaty",
    "štyridsiaty",
    "päťdesiaty",
    "šesťdesiaty",
    "sedemdesiaty",
    "osemdesiaty",
    "deväťdesiaty",
];
const ORD_HUNDREDS: [&str; 10] = [
    "",
    "stý",
    "dvojstý",
    "trojstý",
    "štvorstý",
    "päťstý",
    "šesťstý",
    "sedemstý",
    "osemstý",
    "deväťstý",
];

/// `Slot`: the case slots the ordinal layer distinguishes, in the TS union's order.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Slot {
    MNom,
    MGen,
    MDat,
    MLoc,
    MInstr,
    FNom,
    FGen,
    FAcc,
    FInstr,
    NNom,
    NGen,
    NLoc,
    NInstr,
    PlNom,
    PlGen,
}

impl Slot {
    /// The TS slot name (`"m.nom"` …).
    pub fn parse(s: &str) -> Option<Slot> {
        const NAMES: [&str; 15] = [
            "m.nom", "m.gen", "m.dat", "m.loc", "m.instr", "f.nom", "f.gen", "f.acc", "f.instr",
            "n.nom", "n.gen", "n.loc", "n.instr", "pl.nom", "pl.gen",
        ];
        NAMES.iter().position(|n| *n == s).map(|i| Slot::ALL[i])
    }

    const ALL: [Slot; 15] = [
        Slot::MNom,
        Slot::MGen,
        Slot::MDat,
        Slot::MLoc,
        Slot::MInstr,
        Slot::FNom,
        Slot::FGen,
        Slot::FAcc,
        Slot::FInstr,
        Slot::NNom,
        Slot::NGen,
        Slot::NLoc,
        Slot::NInstr,
        Slot::PlNom,
        Slot::PlGen,
    ];

    /// `HARD[slot]`: [long, short].
    fn hard(self) -> [&'static str; 2] {
        match self {
            Slot::MNom => ["ý", "y"],
            Slot::MGen => ["ého", "eho"],
            Slot::MDat => ["ému", "emu"],
            Slot::MLoc => ["om", "om"],
            Slot::MInstr => ["ým", "ym"],
            Slot::FNom => ["á", "a"],
            Slot::FGen => ["ej", "ej"],
            Slot::FAcc => ["ú", "u"],
            Slot::FInstr => ["ou", "ou"],
            Slot::NNom => ["é", "e"],
            Slot::NGen => ["ého", "eho"],
            Slot::NLoc => ["om", "om"],
            Slot::NInstr => ["ým", "ym"],
            Slot::PlNom => ["é", "e"],
            Slot::PlGen => ["ých", "ych"],
        }
    }

    /// `TRETI[slot]`.
    fn treti(self) -> &'static str {
        match self {
            Slot::MNom => "tretí",
            Slot::MGen => "tretieho",
            Slot::MDat => "tretiemu",
            Slot::MLoc => "treťom",
            Slot::MInstr => "tretím",
            Slot::FNom => "tretia",
            Slot::FGen => "tretej",
            Slot::FAcc => "tretiu",
            Slot::FInstr => "treťou",
            Slot::NNom => "tretie",
            Slot::NGen => "tretieho",
            Slot::NLoc => "treťom",
            Slot::NInstr => "tretím",
            Slot::PlNom => "tretie",
            Slot::PlGen => "tretích",
        }
    }
}

/// `inflectWord(w, slot)`.
fn inflect_word(w: &str, slot: Slot) -> JsString {
    if w == "tretí" {
        return js(slot.treti());
    }
    let long = w.ends_with('ý');
    js(w)
        .slice(0, Some(-1))
        .concat(&js(slot.hard()[if long { 0 } else { 1 }]))
}

/// `ordinalParts(n)`: the cardinal prefix (uninflected) and the ordinal words, or `None` (out of 1–999,999, or
/// an exact thousand).
fn ordinal_parts(n: f64) -> Option<(JsString, Vec<&'static str>)> {
    if !(n.is_finite() && n.fract() == 0.0) || !(1.0..1_000_000.0).contains(&n) {
        return None;
    }
    let k = n as usize;
    if k < 20 {
        return Some((JsString::new(), vec![ORD_1_19[k]]));
    }
    if k < 100 {
        let (t, u) = (k / 10, k % 10);
        return Some((
            JsString::new(),
            if u == 0 {
                vec![ORD_TENS[t]]
            } else {
                vec![ORD_TENS[t], ORD_1_19[u]]
            },
        ));
    }
    if k < 1000 {
        let (h, r) = (k / 100, k % 100);
        if r == 0 {
            return Some((JsString::new(), vec![ORD_HUNDREDS[h]]));
        }
        return Some((
            number_to_words((h * 100) as f64, None),
            ordinal_parts(r as f64).unwrap().1,
        ));
    }
    let r = k % 1000;
    if r == 0 {
        return None;
    }
    let (tail_pre, tail_ord) = ordinal_parts(r as f64).unwrap();
    let mut pre = number_to_words((k - r) as f64, None);
    if !tail_pre.is_empty() {
        pre = pre.concat(&js(" ")).concat(&tail_pre);
    }
    Some((pre, tail_ord))
}

/// `ordinalWords(n, slot)`.
pub fn ordinal_words(n: f64, slot: Slot) -> Option<JsString> {
    let (pre, ord) = ordinal_parts(n)?;
    let words: Vec<JsString> = ord.iter().map(|w| inflect_word(w, slot)).collect();
    let words = JsString::join(&words, &js(" "));
    Some(if pre.is_empty() {
        words
    } else {
        pre.concat(&js(" ")).concat(&words)
    })
}

/// `LICENSOR`, in the TS object's key order.
const LICENSOR: [(&str, Slot); 41] = [
    ("storočia", Slot::NGen),
    ("storočí", Slot::NLoc),
    ("storočím", Slot::NInstr),
    ("storočie", Slot::NNom),
    ("storočiu", Slot::NLoc),
    ("januára", Slot::MGen),
    ("februára", Slot::MGen),
    ("marca", Slot::MGen),
    ("apríla", Slot::MGen),
    ("mája", Slot::MGen),
    ("júna", Slot::MGen),
    ("júla", Slot::MGen),
    ("augusta", Slot::MGen),
    ("septembra", Slot::MGen),
    ("októbra", Slot::MGen),
    ("novembra", Slot::MGen),
    ("decembra", Slot::MGen),
    ("rokoch", Slot::PlGen),
    ("rokov", Slot::PlGen),
    ("roky", Slot::PlNom),
    ("mieste", Slot::NLoc),
    ("miesto", Slot::NNom),
    ("miesta", Slot::NGen),
    ("kategórie", Slot::FGen),
    ("kategória", Slot::FNom),
    ("kategórii", Slot::FGen),
    ("gólom", Slot::MInstr),
    ("gól", Slot::MNom),
    ("gólu", Slot::MGen),
    ("najväčším", Slot::MInstr),
    ("najväčšou", Slot::FInstr),
    ("najväčšia", Slot::FNom),
    ("najväčší", Slot::MNom),
    ("najväčšie", Slot::NNom),
    ("svetovej", Slot::FGen),
    ("svetová", Slot::FNom),
    ("svetovú", Slot::FAcc),
    ("svetovou", Slot::FInstr),
    ("typu", Slot::MGen),
    ("typ", Slot::MNom),
    ("typom", Slot::MInstr),
];

fn licensor(head: &JsString) -> Option<Slot> {
    LICENSOR
        .iter()
        .find(|(k, _)| js(k) == *head)
        .map(|(_, s)| *s)
}

static LICENSOR_ALT: LazyLock<String> =
    LazyLock::new(|| alternation(&sorted_by_length_desc(LICENSOR.iter().map(|(k, _)| js(k)))));

/// `keepFinal`: the sentence period an abbreviation's dot was also doing, re-attached at the utterance end or
/// before a new (capitalised) sentence.
fn keep_final(expansion: &str, m: &JsMatch, whole: &JsString) -> JsString {
    let e = js(expansion);
    let after = whole.slice(m.end() as isize, None);
    if js_re!(r#"^[\s»)”"'\]]*$"#, "u").test(&after) || js_re!(r"^\s+\p{Lu}", "u").test(&after) {
        e.concat(&js("."))
    } else {
        e
    }
}

static MULTI_DOT: LazyLock<[(JsRegex, &str); 5]> = LazyLock::new(|| {
    [
        (
            JsRegex::new(r"(?<![\p{L}\p{M}])p\.\s?n\.\s?l\.?(?![\p{L}\p{M}])", "giu").unwrap(),
            "pred naším letopočtom",
        ),
        (
            JsRegex::new(r"(?<![\p{L}\p{M}])pred\s+n\.\s?l\.?(?![\p{L}\p{M}])", "giu").unwrap(),
            "pred naším letopočtom",
        ),
        (
            JsRegex::new(r"(?<![\p{L}\p{M}])n\.\s?l\.?(?![\p{L}\p{M}])", "giu").unwrap(),
            "nášho letopočtu",
        ),
        (
            JsRegex::new(r"(?<![\p{L}\p{M}])n\.\s?m\.?(?![\p{L}\p{M}])", "giu").unwrap(),
            "nad morom",
        ),
        (
            JsRegex::new(r"(?<![\p{L}\p{M}])t\.\s?j\.?(?![\p{L}\p{M}])", "giu").unwrap(),
            "to jest",
        ),
    ]
});

/// `DOTTED`, in the TS object's key order.
const DOTTED: [(&str, &str); 6] = [
    ("tzv", "takzvaný"),
    ("atď", "a tak ďalej"),
    ("napr", "napríklad"),
    ("č", "číslo"),
    ("dr", "doktor"),
    ("jr", "junior"),
];

/// `` `${DOTTED[key]!}` ``: a key the `iu` fold widened past the table would stringify as `undefined` (no fold
/// of these keys' letters exists today, so the branch is unreachable; kept as the TS has it).
fn dotted(key: &JsString) -> &'static str {
    DOTTED
        .iter()
        .find(|(k, _)| js(k) == *key)
        .map_or("undefined", |(_, v)| *v)
}

/// `CLOSING`: the DOTTED keys that close a list or a name, so a capital after their dot is a new sentence
/// (#1535).
const CLOSING: [&str; 2] = ["atď", "jr"];

static DOTTED_ALT: LazyLock<String> =
    LazyLock::new(|| alternation(&sorted_by_length_desc(DOTTED.iter().map(|(k, _)| js(k)))));

/// `DENOMINATOR[n]`, 2–10.
fn denominator(n: f64) -> Option<[&'static str; 3]> {
    Some(match n {
        2.0 => ["polovica", "polovice", "polovíc"],
        3.0 => ["tretina", "tretiny", "tretín"],
        4.0 => ["štvrtina", "štvrtiny", "štvrtín"],
        5.0 => ["pätina", "pätiny", "pätín"],
        6.0 => ["šestina", "šestiny", "šestín"],
        7.0 => ["sedmina", "sedminy", "sedmín"],
        8.0 => ["osmina", "osminy", "osmín"],
        9.0 => ["devätina", "devätiny", "devätín"],
        10.0 => ["desatina", "desatiny", "desatín"],
        _ => return None,
    })
}

/// `neutralClock(hv, mv)`: cardinal + counted noun.
fn neutral_clock(hv: f64, mv: f64) -> JsString {
    let head = feminine(&number_to_words(hv, None))
        .concat(&js(" "))
        .concat(&js(counted(hv, &HODINA)));
    if mv == 0.0 {
        head
    } else {
        head.concat(&js(" "))
            .concat(&feminine(&number_to_words(mv, None)))
            .concat(&js(" "))
            .concat(&js(counted(mv, &MINUTA)))
    }
}

/// `clock(hv, mv, slot)`: a governed clock is the feminine ordinal hour (hour 0 falls back to the neutral
/// reading) plus the bare cardinal minutes.
fn clock(hv: f64, mv: f64, slot: Option<Slot>) -> JsString {
    let Some(slot) = slot else {
        return neutral_clock(hv, mv);
    };
    let head = if hv == 0.0 {
        None
    } else {
        ordinal_words(hv, slot)
    };
    let Some(head) = head else {
        return neutral_clock(hv, mv);
    };
    if mv == 0.0 {
        head
    } else {
        head.concat(&js(" ")).concat(&number_to_words(mv, None))
    }
}

const CLOCK_BODY: &str = r"([01]?\d|2[0-3])[:.]([0-5]\d)";
const CLOCK_TAIL: &str = r"(?![\d:])(?!\.\d)(?!,\d)";

static GROUP_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<=\d)(?<!(?<![\d\.,])0)[{GROUP_SPACE}](?=\d{{3}}(?!\d))"),
        "gu",
    )
    .unwrap()
});
static GROUP_SPACE_RE: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("[{GROUP_SPACE}]"), "gu").unwrap());
static DOTTED_CONTINUES: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r#"(?<![\p{{L}}\p{{M}}.])({})\.(\s+)(?=([\p{{L}}\d(„"]))"#,
            *DOTTED_ALT
        ),
        "giu",
    )
    .unwrap()
});
static DOTTED_ENDS: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}.])({})\.(?=\s*(?:[»)”\]]\s*)*$)",
            *DOTTED_ALT
        ),
        "giu",
    )
    .unwrap()
});
static DOTTED_ELSE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}.])({})\.(?![\p{{L}}\p{{M}}])",
            *DOTTED_ALT
        ),
        "giu",
    )
    .unwrap()
});
static CLOCK_RANGE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}])(medzi\s+){CLOCK_BODY}\s*(?:[-–—]|a)\s*{CLOCK_BODY}{CLOCK_TAIL}"
        ),
        "giu",
    )
    .unwrap()
});
static CLOCK_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<![\d:.,]){CLOCK_BODY}{CLOCK_TAIL}(?:\s+(?:hod|h)(?![\p{{L}}\p{{M}}]))?"),
        "gu",
    )
    .unwrap()
});
static LICENSED: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}\d.,])((?:\d{{1,4}}\.,?\s+(?:a\s+(?:[\p{{Ll}}\p{{M}}]+\s+)?)?)*)(\d{{1,4}})\.\s+({})(?![\p{{L}}\p{{M}}])",
            *LICENSOR_ALT
        ),
        "gu",
    )
    .unwrap()
});

/// `normalizeSlovak(input)`.
pub(crate) fn normalize_slovak(input: &JsString) -> JsString {
    // Composed first (#1535): a decomposed caron reached the g2p as a bare letter and a skipped mark.
    let mut s = renormalize(input, Form::Nfc);
    let num = |m: &JsMatch, t: &JsString, i: usize| js_number(&m.group(i, t).unwrap());

    // 0) digit de-grouping (twice: the groups overlap on the shared digit), then the separators to a space.
    for _ in 0..2 {
        s = rewrite(&s, &GROUP_RE, &JsString::new());
    }
    s = rewrite(&s, &GROUP_SPACE_RE, &js(" "));

    // 1) multi-dot abbreviations, the sentence period re-attached where the dot was doing that duty too.
    for (re, w) in MULTI_DOT.iter() {
        s = rewrite_with(&s, re, |m, t| keep_final(w, m, t));
    }

    // 2) single-dot abbreviations: before a word, at the utterance end (the period kept), elsewhere.
    //    A closing abbreviation before a capital keeps its dot as the sentence end (#1535).
    s = rewrite_with(&s, &DOTTED_CONTINUES, |m, t| {
        let key = m.group(1, t).unwrap().to_lower_case();
        let w = js(dotted(&key));
        let sp = m.group(2, t).unwrap();
        if CLOSING.iter().any(|k| js(k) == key)
            && js_re!(r"\p{Lu}", "u").test(&m.group(3, t).unwrap())
        {
            w.concat(&js(".")).concat(&sp)
        } else {
            w.concat(&sp)
        }
    });
    s = rewrite_with(&s, &DOTTED_ENDS, |m, t| {
        js(dotted(&m.group(1, t).unwrap().to_lower_case())).concat(&js("."))
    });
    s = rewrite_with(&s, &DOTTED_ELSE, |m, t| {
        js(dotted(&m.group(1, t).unwrap().to_lower_case()))
    });
    //    `St.` before a capitalised word: the dot only.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}.])(St)\.(?=\s+\p{Lu})", "gu"),
        &js("$1"),
    );

    // 3) the clock range after `medzi`: both halves instrumental.
    s = rewrite_with(&s, &CLOCK_RANGE, |m, t| {
        m.group(1, t)
            .unwrap()
            .concat(&clock(num(m, t, 2), num(m, t, 3), Some(Slot::FInstr)))
            .concat(&js(" a "))
            .concat(&clock(num(m, t, 4), num(m, t, 5), Some(Slot::FInstr)))
    });

    // 4) the clock, its case from the governing preposition.
    s = rewrite_with(&s, &CLOCK_RE, |m, t| {
        let before = t.slice(0, Some(m.index() as isize));
        let governed =
            js_re!(r"(?<![\p{L}\p{M}])(?:o|do|po|od|pred|okolo)\s+$", "iu").test(&before);
        clock(
            num(m, t, 1),
            num(m, t, 2),
            if governed { Some(Slot::FGen) } else { None },
        )
    });

    // 5) version / figure dots between digits.
    s = rewrite(&s, js_re!(r"(\d)\.(?=\d)", "gu"), &js("$1 bodka "));

    // 6) numeric ranges; equal endpoints (a score) declined.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d+)\s?[–—-]\s?(\d+)(?![\d.,])", "gu"),
        |m, t| {
            let (a, b) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
            if a == b {
                m.value(t)
            } else {
                a.concat(&js(" do ")).concat(&b)
            }
        },
    );

    // 7) licensed ordinals: the list takes the head noun's case.
    s = rewrite_with(&s, &LICENSED, |m, t| {
        let head = m.group(3, t).unwrap();
        let slot = licensor(&head).unwrap();
        let Some(tail) = ordinal_words(num(m, t, 2), slot) else {
            return m.value(t);
        };
        let list = m.group(1, t).unwrap_or_default();
        // A declined item keeps its digits and dot, then the comma once (#1535).
        let pre = js_re!(r"(\d{1,4})\.(,?)", "gu").replace_with(&list, |im, l| {
            let n = im.group(1, l).unwrap();
            ordinal_words(js_number(&n), slot)
                .unwrap_or_else(|| n.concat(&js(".")))
                .concat(&im.group(2, l).unwrap_or_default())
        });
        pre.concat(&tail).concat(&js(" ")).concat(&head)
    });

    // 8) the general ordinal (lowercase word or comma follows); after a capitalised name ≤ 39, the name's ending
    //    picks gender and case.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d.,])(\d{1,4})\.(?=\s*[,\p{Ll}])", "gu"),
        |m, t| {
            let n = num(m, t, 1);
            let before = t.slice(0, Some(m.index() as isize));
            let name = js_re!(r"(?<![\p{L}\p{M}])(\p{Lu}[\p{L}\p{M}]+)\s+$", "u")
                .exec(&before)
                .and_then(|nm| nm.group(1, &before));
            let slot = match name {
                Some(name) if n <= 39.0 => {
                    if name.ends_with(&js("ho")) {
                        Slot::MGen
                    } else if name.ends_with(&js("a")) {
                        Slot::FNom
                    } else if name.ends_with(&js("y")) {
                        Slot::FGen
                    } else {
                        Slot::MNom
                    }
                }
                _ => Slot::MNom,
            };
            ordinal_words(n, slot).unwrap_or_else(|| m.value(t))
        },
    );

    // 9) the mile rate, spelled and abbreviated.
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?míľ\s?\/\s?h(?![\p{L}\p{M}])", "giu"),
        |m, t| m.group(1, t).unwrap().concat(&js(" míľ za hodinu")),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?mi\s?\/\s?h(?![\p{L}\p{M}])", "giu"),
        |m, t| {
            let n = m.group(1, t).unwrap();
            n.concat(&js(" "))
                .concat(&js(counted(js_number(&n), &MILA)))
                .concat(&js(" za hodinu"))
        },
    );

    // 10) signs read before the shared tier.
    let degrees = |m: &JsMatch, t: &JsString, tail: &str| {
        let n = m.group(1, t).unwrap();
        n.concat(&js(" "))
            .concat(&js(counted(js_number(&n), &STUPEN)))
            .concat(&js(tail))
    };
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?°\s?C(?![\p{L}\p{M}])", "gui"),
        |m, t| degrees(m, t, " Celzia"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?°\s?F(?![\p{L}\p{M}])", "gui"),
        |m, t| degrees(m, t, " Fahrenheita"),
    );
    s = rewrite_with(&s, js_re!(r"(\d+)\s?°", "gu"), |m, t| degrees(m, t, ""));
    s = rewrite(&s, js_re!(r"(?<=\d)\s?[x×]\s?(?=\d)", "gu"), &js(" krát "));
    s = rewrite(&s, js_re!("±", "gu"), &js(" plus mínus "));
    s = rewrite(&s, js_re!(r"(^|[\s(])\+\s?(?=\d)", "gu"), &js("$1plus "));
    s = rewrite(&s, js_re!(r"(^|[\s(])[-−]\s?(?=\d)", "gu"), &js("$1mínus "));

    // 11) the shared symbol tier, while the number is still beside its unit and its decimal comma.
    s = SYMBOLS
        .as_ref()
        .expect("checked by create_slovak")
        .apply(&s);

    // 12) the decimal comma → the word.
    s = rewrite(&s, js_re!(r"(?<=\d),(?=\d)", "gu"), &js(" čiarka "));

    // 13) fractions: the vulgar three, then a/b with a 2–10 denominator.
    s = rewrite(&s, js_re!(r"(\d+)¾", "gu"), &js("$1 a tri štvrtiny"));
    s = rewrite(&s, js_re!(r"(\d+)½", "gu"), &js("$1 a pol"));
    s = rewrite(&s, js_re!(r"(\d+)¼", "gu"), &js("$1 a štvrtina"));
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d/.,])(\d{1,3})\/(\d{1,2})(?![\d/.,])", "gu"),
        |m, t| {
            let Some(forms) = denominator(num(m, t, 2)) else {
                return m.value(t);
            };
            let a = m.group(1, t).unwrap();
            let an = js_number(&a);
            feminine(&number_to_words(an, Some(&a)))
                .concat(&js(" "))
                .concat(&js(counted(an, &forms)))
        },
    );

    // 14) relational signs and the ampersand (two lone capitals around it are spelled).
    s = rewrite(&s, js_re!(r"\s*≈\s*", "gu"), &js(" približne sa rovná "));
    s = rewrite(&s, js_re!(r"\s*=\s*", "gu"), &js(" rovná sa "));
    s = rewrite(&s, js_re!(r"\s*<\s*", "gu"), &js(" menší ako "));
    s = rewrite(&s, js_re!(r"\s*>\s*", "gu"), &js(" väčší ako "));
    s = rewrite(&s, js_re!(r"\s*÷\s*", "gu"), &js(" delené "));
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\p{Lu})\s*[&＆]\s*(\p{Lu})(?![\p{L}\p{M}])",
            "gu"
        ),
        |m, t| {
            let x = letter_name(&m.group(1, t).unwrap().to_lower_case());
            let y = letter_name(&m.group(2, t).unwrap().to_lower_case());
            match (x, y) {
                (Some(x), Some(y)) => x.concat(&js(" a ")).concat(&y),
                _ => m.value(t),
            }
        },
    );
    s = rewrite(&s, js_re!(r"\s*[&＆]\s*", "gu"), &js(" a "));

    // 15) initialisms, last.
    normalize_slovak_initialisms(&s)
}
