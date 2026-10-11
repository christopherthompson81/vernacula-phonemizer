//! Serbian (sr) text normalization: digit de-grouping, the era markers, the dot clock, dotted abbreviations,
//! signs, degrees, the numeral+suffix and licensed `N.` ordinals, rates, ranges, the colon clock, the shared
//! symbol tier, the decimal comma and the initialism pass. Both scripts are accepted through a Cyrillic→Latin
//! fold. Also the pieces Croatian and Bosnian share (the decimal comma, the initialism pass, the ordinal
//! paradigm). Ported from src/languages/serbian/normalize.ts — see that file for the corpus evidence.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, LazyLock};

use indexmap::IndexMap;

use super::manifest::{MANIFEST, SlavicNumbers};
use super::numbers::{compose_slavic_number, number_to_words};
use crate::core::boundaries::NOT_LETTER_AFTER;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_object_prototype_key, js, js_number};
use crate::core::normalize_symbols::{
    ExponentPosition, ExponentWords, Multiply, PositionDecl, SymbolData, SymbolNormalizer, UnitPer,
    make_symbol_normalizer, slavic_count_form,
};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

// ── SCRIPT ──────────────────────────────────────────────────────────────────────────────────────────

/// Cyrillic → Gaj's Latin (the bijection; Bosnian's table is the same).
const CYR2LAT: [(&str, &str); 30] = [
    ("а", "a"),
    ("б", "b"),
    ("в", "v"),
    ("г", "g"),
    ("д", "d"),
    ("ђ", "đ"),
    ("е", "e"),
    ("ж", "ž"),
    ("з", "z"),
    ("и", "i"),
    ("ј", "j"),
    ("к", "k"),
    ("л", "l"),
    ("љ", "lj"),
    ("м", "m"),
    ("н", "n"),
    ("њ", "nj"),
    ("о", "o"),
    ("п", "p"),
    ("р", "r"),
    ("с", "s"),
    ("т", "t"),
    ("ћ", "ć"),
    ("у", "u"),
    ("ф", "f"),
    ("х", "h"),
    ("ц", "c"),
    ("ч", "č"),
    ("џ", "dž"),
    ("ш", "š"),
];

/// `lat(word)`: lowercase, then each code point through CYR2LAT.
pub(crate) fn lat(word: &JsString) -> JsString {
    let mut out = JsString::new();
    for ch in word.to_lower_case().code_point_strings() {
        let k = ch.to_string_lossy();
        match CYR2LAT.iter().find(|(c, _)| *c == k) {
            Some((_, l)) => out.push_str(&js(l)),
            None => out.push_str(&ch),
        }
    }
    out
}

/// `cyr(word)`: each code point through LAT2CYR (the single-letter inverse of CYR2LAT).
pub(crate) fn cyr(word: &str) -> String {
    word.chars()
        .map(|ch| {
            let s = ch.to_string();
            CYR2LAT
                .iter()
                .find(|(_, l)| *l == s)
                .map_or(s, |(c, _)| c.to_string())
        })
        .collect()
}

// ── ORDINALS (the paradigm the three standards share; each supplies its own cells) ──────────────────

const ORD_1_19: [&str; 20] = [
    "",
    "prvi",
    "drugi",
    "treći",
    "četvrti",
    "peti",
    "šesti",
    "sedmi",
    "osmi",
    "deveti",
    "deseti",
    "jedanaesti",
    "dvanaesti",
    "trinaesti",
    "četrnaesti",
    "petnaesti",
    "šesnaesti",
    "sedamnaesti",
    "osamnaesti",
    "devetnaesti",
];
const ORD_TENS: [&str; 10] = [
    "",
    "deseti",
    "dvadeseti",
    "trideseti",
    "četrdeseti",
    "pedeseti",
    "šezdeseti",
    "sedamdeseti",
    "osamdeseti",
    "devedeseti",
];

/// A licensing table's lookup, as a plain-object index: an own key, an inherited `Object.prototype` member
/// (whose value is a function, so `ENDINGS[slot]` then misses), or nothing.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub(crate) enum Slot {
    Own(&'static str),
    Proto,
    Miss,
}

/// `TABLE[key]` over a record literal.
pub(crate) fn slot_of(table: &[(&str, &'static str)], key: &JsString) -> Slot {
    let k = key.to_string_lossy();
    match table.iter().find(|(w, _)| *w == k) {
        Some((_, s)) => Slot::Own(s),
        None if is_object_prototype_key(&k) => Slot::Proto,
        None => Slot::Miss,
    }
}

/// One standard's ordinal cells: the hundreds row, the word for 1000, the ENDINGS record (key order is the
/// TS object's: `ordinalForms` iterates it) and the cardinal table the compound head is read with.
pub(crate) struct SlavicOrdinals {
    pub hundreds: [&'static str; 10],
    pub thousandth: &'static str,
    pub endings: &'static [(&'static str, &'static str, &'static str)],
    pub numbers: fn() -> &'static SlavicNumbers,
}

fn is_integer(n: f64) -> bool {
    n.is_finite() && n.fract() == 0.0
}

impl SlavicOrdinals {
    fn words(&self, n: f64) -> JsString {
        compose_slavic_number(n, (self.numbers)(), None)
    }

    /// `ordinalBase(n)`: the masculine-nominative ordinal; `None` for a round thousand other than 1000.
    pub fn ordinal_base(&self, n: f64) -> Option<JsString> {
        if !is_integer(n) || !(1.0..1_000_000.0).contains(&n) {
            return None;
        }
        if n < 20.0 {
            return Some(js(ORD_1_19[n as usize]));
        }
        if n < 100.0 {
            let (t, u) = ((n / 10.0).floor() as usize, (n % 10.0) as usize);
            return Some(if u == 0 {
                js(ORD_TENS[t])
            } else {
                js(&format!("{} {}", (self.numbers)().tens[t], ORD_1_19[u]))
            });
        }
        if n < 1000.0 {
            let r = n % 100.0;
            return Some(if r == 0.0 {
                js(self.hundreds[(n / 100.0) as usize])
            } else {
                self.words(n - r)
                    .concat(&js(" "))
                    .concat(&self.ordinal_base(r).unwrap())
            });
        }
        if n == 1000.0 {
            return Some(js(self.thousandth));
        }
        let r = n % 1000.0;
        if r == 0.0 {
            return None;
        }
        Some(
            self.words(n - r)
                .concat(&js(" "))
                .concat(&self.ordinal_base(r).unwrap()),
        )
    }

    /// `inflect(base, slot)`: only the final word takes the ending; `None` for a slot ENDINGS lacks.
    pub fn inflect(&self, base: &JsString, slot: Slot) -> Option<JsString> {
        let Slot::Own(key) = slot else {
            return None;
        };
        let (_, hard, soft) = self.endings.iter().find(|(k, _, _)| *k == key)?;
        let mut words = base.split(&js(" "));
        let last = words.pop().unwrap();
        let ending = if last.ends_with(&js("ći")) {
            soft
        } else {
            hard
        };
        words.push(last.slice(0, Some(-1)).concat(&js(ending)));
        Some(JsString::join(&words, &js(" ")))
    }

    /// `inflect(base, slot)!` in a template: a miss stringifies as `undefined`.
    pub fn inflect_or_undefined(&self, base: &JsString, slot: Slot) -> JsString {
        self.inflect(base, slot).unwrap_or_else(|| js("undefined"))
    }

    /// `ordinalForms(n)`: every slot's form, in ENDINGS order.
    pub fn ordinal_forms(&self, n: f64) -> Vec<JsString> {
        let Some(base) = self.ordinal_base(n) else {
            return Vec::new();
        };
        self.endings
            .iter()
            .map(|(k, _, _)| self.inflect(&base, Slot::Own(k)).unwrap())
            .collect()
    }
}

const ENDINGS: [(&str, &str, &str); 9] = [
    ("m.nom", "i", "i"),
    ("m.gen", "og", "eg"),
    ("m.loc", "om", "em"),
    ("n.nom", "o", "e"),
    ("f.nom", "a", "a"),
    ("f.gen", "e", "e"),
    ("f.dat", "oj", "oj"),
    ("f.acc", "u", "u"),
    ("pl.gen", "ih", "ih"),
];

static ORD: SlavicOrdinals = SlavicOrdinals {
    hundreds: [
        "",
        "stoti",
        "dvestoti",
        "tristoti",
        "četiristoti",
        "petstoti",
        "šeststoti",
        "sedamstoti",
        "osamstoti",
        "devetstoti",
    ],
    thousandth: "hiljaditi",
    endings: &ENDINGS,
    numbers: || &MANIFEST.numbers,
};

const LICENSOR: [(&str, &str); 21] = [
    ("godine", "f.gen"),
    ("godini", "f.dat"),
    ("godinu", "f.acc"),
    ("godina", "f.nom"),
    ("veka", "m.gen"),
    ("veku", "m.loc"),
    ("vek", "m.nom"),
    ("vijeka", "m.gen"),
    ("vijeku", "m.loc"),
    ("januara", "m.gen"),
    ("februara", "m.gen"),
    ("marta", "m.gen"),
    ("aprila", "m.gen"),
    ("maja", "m.gen"),
    ("juna", "m.gen"),
    ("jula", "m.gen"),
    ("avgusta", "m.gen"),
    ("septembra", "m.gen"),
    ("oktobra", "m.gen"),
    ("novembra", "m.gen"),
    ("decembra", "m.gen"),
];

// ── COUNTED NOUNS ───────────────────────────────────────────────────────────────────────────────────

/// `counted(n, forms)`: [nom.sg, gen.sg (2–4), gen.pl] by the Slavic count form.
pub(crate) fn counted(n: f64, forms: [&str; 3]) -> JsString {
    js(forms[slavic_count_form(n).min(2.0) as usize])
}
const SAT: [&str; 3] = ["sat", "sata", "sati"];
const MINUT: [&str; 3] = ["minut", "minuta", "minuta"];
const STEPEN: [&str; 3] = ["stepen", "stepena", "stepeni"];
const METAR: [&str; 3] = ["metar", "metra", "metara"];
const MEGABIT: [&str; 3] = ["megabit", "megabita", "megabita"];

const DOTTED: [(&str, &str); 3] = [
    ("itd", "i tako dalje"),
    ("npr", "na primer"),
    ("tzv", "takozvani"),
];

/// `DOTTED_ALT`: each key in both scripts, longest first (stable).
pub(crate) fn both_scripts_alt(keys: &[&str]) -> String {
    let mut all: Vec<String> = keys.iter().flat_map(|k| [k.to_string(), cyr(k)]).collect();
    // `sort((a, b) => b.length - a.length)`: stable, by UTF-16 length.
    all.sort_by_key(|k| std::cmp::Reverse(k.encode_utf16().count()));
    all.join("|")
}

fn dotted(table: &[(&str, &'static str)], ab: &JsString) -> Option<&'static str> {
    match slot_of(table, &lat(ab)) {
        Slot::Own(w) => Some(w),
        _ => None,
    }
}

static DOTTED_ALT: LazyLock<String> = LazyLock::new(|| both_scripts_alt(&DOTTED.map(|(k, _)| k)));

fn forms(f: &[&str]) -> Vec<String> {
    f.iter().map(|s| s.to_string()).collect()
}

/// The shared symbol tier (serbian/normalize.ts `SYMBOLS`).
static SYMBOLS: LazyLock<SymbolNormalizer> = LazyLock::new(|| {
    let mut currency = IndexMap::new();
    currency.insert("$".to_string(), forms(&["dolar", "dolara", "dolara"]));
    currency.insert("¥".to_string(), forms(&["jen", "jena", "jena"]));
    let mut units = IndexMap::new();
    for (k, f) in [
        ("km", ["kilometar", "kilometra", "kilometara"]),
        ("m", ["metar", "metra", "metara"]),
        ("mm", ["milimetar", "milimetra", "milimetara"]),
        ("cm", ["centimetar", "centimetra", "centimetara"]),
        ("mi", ["milja", "milje", "milja"]),
        ("ghz", ["gigaherc", "gigaherca", "gigaherca"]),
    ] {
        units.insert(k.to_string(), forms(&f));
    }
    let mut rate = IndexMap::new();
    rate.insert("h".to_string(), "sat".to_string());
    make_symbol_normalizer(&SymbolData {
        ampersand: Some("и".into()),
        multiply: Some(Multiply {
            times: "puta".into(),
            by: None,
        }),
        percent: Some(forms(&["posto"])),
        currency: Some(currency),
        units: Some(units),
        unit_per: Some(UnitPer::All("na".into())),
        rate_denominators: Some(rate),
        exponent_words: Some(ExponentWords {
            squared: Some(forms(&["kvadratni", "kvadratna", "kvadratnih"])),
            cubed: Some(forms(&["kubni", "kubna", "kubnih"])),
            position: Some(PositionDecl::All(ExponentPosition::Before)),
        }),
        count_form: Some(Arc::new(slavic_count_form)),
        ..Default::default()
    })
    .expect("serbian SYMBOLS")
});

/// The symbol tier on its own (for the differential).
pub(crate) fn serbian_symbols(s: &JsString) -> JsString {
    SYMBOLS.apply(s)
}

// ── THE RULES ───────────────────────────────────────────────────────────────────────────────────────

/// `intOf(n)`: the integer part of a written number ("3,50" → 3); off the seam, as in the TS.
fn int_of(n: &JsString) -> f64 {
    let a = js_re!(r"\.", "gu").replace(n, &JsString::new());
    let b = js_re!(",", "").replace(&a, &js("."));
    js_number(&b).trunc()
}

/// `whole.slice(0, off)` ends in a digit (and optional spaces): the spaced-range / score guard of the minus.
pub(crate) fn digit_before(full: &JsString, off: usize) -> bool {
    js_re!(r"\d\s*$", "u").test(&full.slice(0, Some(off as isize)))
}

/// `normalizeSerbian(input)`.
pub(crate) fn normalize_serbian(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 0) digit de-grouping (two passes).
    for _ in 0..2 {
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)\.(?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
    }

    // 1) the era marker; a year before it is an ordinal with `godina` elided.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d{1,4})\.\s+(?=(?:[пp]\.\s?)?[нn]\.\s?[еe](?![\p{L}\p{M}]))",
            "gu"
        ),
        |mm, t| match ORD.ordinal_base(js_number(&mm.group(1, t).unwrap())) {
            None => mm.value(t),
            Some(base) => ORD
                .inflect_or_undefined(&base, Slot::Own("f.gen"))
                .concat(&js(" ")),
        },
    );
    for (pat, words) in ERA_ARMS.iter() {
        s = rewrite_with(&s, &pat.0, replace_era(words));
        s = rewrite(&s, &pat.1, &js(words));
    }

    // 2) the dot-written clock, only before a written hour noun.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d{1,2})\.(\d{2})(?=\s*(?:сати|часова|sati|časova))",
            "gu"
        ),
        |mm, t| {
            let h = mm.group(1, t).unwrap();
            let min = js_number(&mm.group(2, t).unwrap());
            if min == 0.0 {
                h
            } else {
                js(&format!("{} i {}", h, min as u64))
            }
        },
    );

    // 3) dotted abbreviations. ⚠ The miss branch is reachable (#1122); the middle arm's `!` stringifies it.
    s = rewrite_with(&s, &ABBREV.0, |mm, t| {
        match dotted(&DOTTED, &mm.group(1, t).unwrap()) {
            None => mm.value(t),
            Some(w) => js(w).concat(&mm.group(2, t).unwrap()),
        }
    });
    s = rewrite_with(&s, &ABBREV.1, |mm, t| {
        js(dotted(&DOTTED, &mm.group(1, t).unwrap()).unwrap_or("undefined"))
    });
    s = rewrite_with(&s, &ABBREV.2, |mm, t| {
        match dotted(&DOTTED, &mm.group(1, t).unwrap()) {
            None => mm.value(t),
            Some(w) => js(w).concat(&js(".")),
        }
    });

    // 3b) signs; ± before the + arms.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\p{Nd}])[-−–](?=\d)", "gu"),
        |mm, full| {
            if digit_before(full, mm.index()) {
                mm.value(full)
            } else {
                js("минус ")
            }
        },
    );
    s = rewrite(&s, js_re!("±", "gu"), &js(" плус минус "));
    s = rewrite(&s, js_re!(r"(\S)\+\s?(?=\d)", "gu"), &js("$1 плус "));
    s = rewrite(&s, js_re!(r"(^|\s)\+\s?(?=\d)", "gu"), &js("$1плус "));

    // 3c) relational and division signs.
    s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" једнако "));
    s = rewrite(&s, js_re!(r"\s?<\s?", "gu"), &js(" мање од "));
    s = rewrite(&s, js_re!(r"\s?>\s?", "gu"), &js(" веће од "));
    s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" подељено са "));

    // 4) degrees: the scale arm (the Cyrillic scale letter attached only), then the bare degree.
    s = rewrite_with(
        &s,
        js_re!(
            r"(\d+)\s?°(?:\s?([CFcf])|([СЦФсцф]))(?![\p{L}\p{M}])(\s*(?:степен[аи]|stepen[ai]))?",
            "gui"
        ),
        |mm, t| {
            let n = mm.group(1, t).unwrap();
            let scale = mm
                .group(2, t)
                .or_else(|| mm.group(3, t))
                .unwrap_or_default();
            let word = if js_re!("[FfФф]", "u").test(&scale) {
                "Farenhajta"
            } else {
                "Celzijusa"
            };
            n.concat(&js(" "))
                .concat(&counted(js_number(&n), STEPEN))
                .concat(&js(" "))
                .concat(&js(word))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(\d+)\s?°(?:(?:\s?[NEWJZSIXYQnewjzxyqЈЗСИјз]|[siси])(?![\p{L}\p{M}]))?(\s*(?:степен[аи]|stepen[ai]))?",
            "gu"
        ),
        |mm, t| {
            let n = mm.group(1, t).unwrap();
            n.concat(&js(" "))
                .concat(&counted(js_number(&n), STEPEN))
                .concat(&js(" "))
        },
    );

    // 5) numeral + hyphen + case suffix: the case form that ends with the written letters.
    s = rewrite_with(&s, &SUFFIX_RE, |mm, t| {
        let suffix = lat(&mm.group(2, t).unwrap());
        ORD.ordinal_forms(js_number(&mm.group(1, t).unwrap()))
            .into_iter()
            .find(|f| f.ends_with(&suffix))
            .unwrap_or_else(|| mm.value(t))
    });

    // 6) the `/s` rates ("u sekundi").
    s = rewrite_with(
        &s,
        js_re!(r"(\d+(?:[.,]\d+)?)\s?Mbit\s?\/\s?s(?![\p{L}\p{M}])", "gu"),
        |mm, t| {
            let n = mm.group(1, t).unwrap();
            n.concat(&js(" "))
                .concat(&counted(int_of(&n), MEGABIT))
                .concat(&js(" u sekundi"))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d+(?:[.,]\d+)?)\s?m\s?\/\s?s(?![\p{L}\p{M}])", "gu"),
        |mm, t| {
            let n = mm.group(1, t).unwrap();
            n.concat(&js(" "))
                .concat(&counted(int_of(&n), METAR))
                .concat(&js(" u sekundi"))
        },
    );

    // 6b) numeric ranges.
    s = rewrite(&s, js_re!(r"(\d)\s?[-–—]\s?(?=\d)", "gu"), &js("$1 do "));

    // 7) the licensed `N.` ordinal.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d{1,4})\.\s+(\p{Ll}[\p{L}\p{M}]*)", "gu"),
        |mm, t| {
            let word = mm.group(2, t).unwrap();
            let slot = slot_of(&LICENSOR, &lat(&word));
            if slot == Slot::Miss {
                return mm.value(t);
            }
            let Some(base) = ORD.ordinal_base(js_number(&mm.group(1, t).unwrap())) else {
                return mm.value(t);
            };
            ORD.inflect_or_undefined(&base, slot)
                .concat(&js(" "))
                .concat(&word)
        },
    );

    // 8) the colon clock: a cardinal hour with the counted noun.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:.,])", "gu"),
        |mm, t| {
            let hv = js_number(&mm.group(1, t).unwrap());
            let mv = js_number(&mm.group(2, t).unwrap());
            clock_words(hv, mv, &|n| number_to_words(n, None))
        },
    );

    // 9) the shared symbol tier, while numbers are still adjacent to their units.
    s = SYMBOLS.apply(&s);

    // 10) the decimal comma.
    s = read_decimal_comma(&s);

    // 11) × between digits, and the + sign.
    s = rewrite(&s, js_re!(r"(?<=\d)\s?[x×]\s?(?=\d)", "gu"), &js(" puta "));
    s = rewrite(&s, js_re!(r"(^|[\s(])\+\s?(\d)", "gu"), &js("$1plus $2"));

    // 12) initialisms, last.
    normalize_serbian_initialisms(&s)
}

/// The clock's reading: `<hour words> <sat>` and, for non-zero minutes, `i <minute words> <minut>`.
pub(crate) fn clock_words(hv: f64, mv: f64, words: &dyn Fn(f64) -> JsString) -> JsString {
    let head = words(hv).concat(&js(" ")).concat(&counted(hv, SAT));
    if mv == 0.0 {
        head
    } else {
        head.concat(&js(" i "))
            .concat(&words(mv))
            .concat(&js(" "))
            .concat(&counted(mv, MINUT))
    }
}

/// The three dotted-abbreviation arms: before a following word, before `,;:`, at a sentence end.
static ABBREV: LazyLock<(JsRegex, JsRegex, JsRegex)> = LazyLock::new(|| dotted_arms(&DOTTED_ALT));

pub(crate) fn dotted_arms(alt: &str) -> (JsRegex, JsRegex, JsRegex) {
    (
        JsRegex::new(
            &format!(r"(?<![\p{{L}}\p{{M}}])({alt})\.(\s+)(?=[\p{{L}}\d(])"),
            "giu",
        )
        .unwrap(),
        JsRegex::new(
            &format!(r"(?<![\p{{L}}\p{{M}}])({alt})\.(?=\s*[,;:])"),
            "giu",
        )
        .unwrap(),
        JsRegex::new(
            &format!(r#"(?<![\p{{L}}\p{{M}}])({alt})\.(?=\s*(?:[.!?”"»)\]]|$))"#),
            "giu",
        )
        .unwrap(),
    )
}

pub(crate) static SUFFIX_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<![\d.,])(\d+)\s?-\s?(\p{{Ll}}{{1,2}}){NOT_LETTER_AFTER}"),
        "gu",
    )
    .unwrap()
});

/// The era arms, each pattern twice: with its final dot (and what follows it), and dotless.
type EraArm = ((JsRegex, JsRegex), &'static str);
static ERA_ARMS: LazyLock<Vec<EraArm>> = LazyLock::new(|| {
    [
        (r"п\.\s?н\.\s?е", "pre nove ere"),
        (r"p\.\s?n\.\s?e", "pre nove ere"),
        (r"н\.\s?е", "nove ere"),
        (r"n\.\s?e", "nove ere"),
    ]
    .into_iter()
    .map(|(pat, words)| (era_pair(pat, "gu"), words))
    .collect()
});

/// The era marker's two regexes for `pat` (`flags`: Serbian lowercase-only `gu`, Bosnian `giu`).
pub(crate) fn era_pair(pat: &str, flags: &str) -> (JsRegex, JsRegex) {
    (
        JsRegex::new(&format!(r"(?<![\p{{L}}\p{{M}}]){pat}\.(\s*)(\S?)"), flags).unwrap(),
        JsRegex::new(
            &format!(r"(?<![\p{{L}}\p{{M}}]){pat}(?![\p{{L}}\p{{M}}.])"),
            flags,
        )
        .unwrap(),
    )
}

/// `replaceEra(words)`: keep the final dot only where it was also the sentence end.
pub(crate) fn replace_era(
    words: &str,
) -> impl FnMut(&crate::core::js_regex::JsMatch, &JsString) -> JsString + '_ {
    move |mm, t| {
        let sp = mm.group(1, t).unwrap_or_default();
        let next = mm.group(2, t).unwrap_or_default();
        let w = js(words);
        if next.is_empty() {
            return w.concat(&js("."));
        }
        if js_re!(r#"[,;:!?)»”"]"#, "u").test(&next) {
            return w.concat(&sp).concat(&next);
        }
        if js_re!(r"\p{Lu}", "u").test(&next) {
            return w.concat(&js(".")).concat(&sp).concat(&next);
        }
        w.concat(&sp).concat(&next)
    }
}

/// `readDecimalComma(s)`: the comma → *zarez*, the fraction's leading zeros spelled as digits (shared by
/// sr, hr and bs).
pub(crate) fn read_decimal_comma(s: &JsString) -> JsString {
    rewrite_with(s, js_re!(r"(?<=\d),(\d+)", "gu"), |mm, t| {
        let frac = mm.group(1, t).unwrap();
        let zeros = frac.0.iter().take_while(|&&c| c == b'0' as u16).count();
        if zeros == 0 {
            js(" zarez ").concat(&frac)
        } else {
            js(&format!(" zarez {}", "0 ".repeat(zeros))).concat(&frac.slice(zeros as isize, None))
        }
    })
}

// ── INITIALISMS ─────────────────────────────────────────────────────────────────────────────────────

const LETTER_NAMES: [(&str, &str); 58] = [
    ("a", "a"),
    ("b", "be"),
    ("c", "ce"),
    ("č", "če"),
    ("ć", "će"),
    ("d", "de"),
    ("đ", "đe"),
    ("e", "e"),
    ("f", "ef"),
    ("g", "ge"),
    ("h", "ha"),
    ("i", "i"),
    ("j", "je"),
    ("k", "ka"),
    ("l", "el"),
    ("m", "em"),
    ("n", "en"),
    ("o", "o"),
    ("p", "pe"),
    ("r", "er"),
    ("s", "es"),
    ("š", "eš"),
    ("t", "te"),
    ("u", "u"),
    ("v", "ve"),
    ("z", "ze"),
    ("ž", "že"),
    ("q", "ku"),
    ("w", "dublve"),
    ("x", "iks"),
    ("y", "ipsilon"),
    ("а", "a"),
    ("б", "be"),
    ("ц", "ce"),
    ("ч", "če"),
    ("ћ", "će"),
    ("д", "de"),
    ("ђ", "đe"),
    ("е", "e"),
    ("ф", "ef"),
    ("г", "ge"),
    ("х", "ha"),
    ("и", "i"),
    ("ј", "je"),
    ("к", "ka"),
    ("л", "el"),
    ("м", "em"),
    ("н", "en"),
    ("о", "o"),
    ("п", "pe"),
    ("р", "er"),
    ("с", "es"),
    ("ш", "eš"),
    ("т", "te"),
    ("у", "u"),
    ("в", "ve"),
    ("з", "ze"),
    ("ж", "že"),
];

static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| {
    let names: HashMap<String, &'static str> = LETTER_NAMES
        .iter()
        .map(|(l, n)| (l.to_string(), *n))
        .collect();
    // `LETTER_NAME[l]`: `l` is one lowercased letter, which no Object.prototype member's name is.
    Arc::new(move |l: &JsString| names.get(&l.to_string_lossy()).map(|n| js(n)))
});

type Predicate = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

static IS_UNREADABLE: LazyLock<Predicate> = LazyLock::new(|| {
    let set = |xs: &[&str]| xs.iter().map(|x| js(x)).collect();
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new("[aeiouаеиоу]", "u").unwrap(),
        legal_onsets: set(&[
            "bl", "br", "cr", "cv", "čl", "čr", "čv", "dj", "dr", "dv", "fl", "fr", "gl", "gn",
            "gr", "hl", "hr", "hv", "jd", "kl", "kn", "kr", "kt", "kv", "ml", "mn", "mr", "pč",
            "pl", "pn", "pr", "ps", "pš", "pt", "sf", "sk", "sl", "sm", "sn", "sp", "sr", "st",
            "sv", "šć", "šk", "šl", "šm", "šn", "šp", "št", "šv", "tk", "tl", "tr", "tv", "vl",
            "vr", "zb", "zd", "zg", "zl", "zm", "zn", "zr", "zv", "žd", "žl", "žm", "žv",
        ]),
        legal_codas: set(&[
            "jd", "jn", "jt", "kt", "lj", "ls", "lt", "mp", "nc", "nd", "ng", "nj", "nk", "ns",
            "nt", "rc", "rd", "rf", "rk", "rn", "rs", "rt", "rv", "rz", "sk", "sl", "sm", "sn",
            "sp", "st", "šć", "št", "zd", "zm", "zn",
        ]),
        liquids: None,
        digraphs: Some(set(&["dž", "lj", "nj"])),
    }))
});

/// `isUnreadableSerbian(word)`.
pub(crate) fn is_unreadable_serbian(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.acronym_letters.iter().map(|w| js(w)).collect());

/// `normalizeSerbianInitialisms(text)`: shared by sr, hr and bs.
pub(crate) fn normalize_serbian_initialisms(text: &JsString) -> JsString {
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
