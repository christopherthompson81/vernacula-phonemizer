//! Slovenian (sl) text normalization: digit de-grouping, the multi-dot era markers, dotted abbreviations and
//! honorifics, the clock as a feminine ordinal in the governed case, the decimal point, scores and ranges, regnal
//! and licensed `N.` ordinals, decades, degrees, signs, the symbol tier with the gender repair of 1–4, the
//! decimal comma, fractions, relational signs, letter names and the initialism pass.
//! Ported from src/languages/slovenian/normalize.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::manifest::MANIFEST;
use super::numbers::number_to_words;
use super::slovenian::{COUNTED, SYMBOLS, counted_forms, sl_count_form};
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::provenance::{escape, rewrite, rewrite_with};
use crate::js_re;

const LETTER_NAMES: [(&str, &str); 31] = [
    ("a", "a"),
    ("b", "be"),
    ("c", "ce"),
    ("č", "če"),
    ("d", "de"),
    ("e", "e"),
    ("f", "fe"),
    ("g", "ge"),
    ("h", "he"),
    ("i", "i"),
    ("j", "je"),
    ("k", "ke"),
    ("l", "le"),
    ("m", "me"),
    ("n", "ne"),
    ("o", "o"),
    ("p", "pe"),
    ("r", "re"),
    ("s", "se"),
    ("š", "še"),
    ("t", "te"),
    ("u", "u"),
    ("v", "ve"),
    ("z", "ze"),
    ("ž", "že"),
    ("q", "ku"),
    ("w", "dvojni ve"),
    ("x", "iks"),
    ("y", "ipsilon"),
    ("ć", "mehki če"),
    ("đ", "dže"),
];

/// `LETTER_NAME[l]`: `l` is one lowercased letter, which no Object.prototype member's name is.
fn letter_name(l: &JsString) -> Option<&'static str> {
    let k = l.to_string_lossy();
    LETTER_NAMES.iter().find(|(c, _)| *c == k).map(|(_, n)| *n)
}

type Predicate = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

static IS_UNREADABLE: LazyLock<Predicate> = LazyLock::new(|| {
    let set = |xs: &[&str]| xs.iter().map(|x| js(x)).collect();
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new("[aeiouy]", "u").unwrap(),
        legal_onsets: set(&[
            "bl", "br", "cv", "čl", "čr", "čv", "dl", "dr", "dv", "dž", "gl", "gn", "gr", "hl",
            "hm", "hr", "hv", "kl", "kn", "kr", "kv", "ml", "mn", "mr", "pl", "pn", "pr", "ps",
            "pt", "sk", "sl", "sm", "sn", "sp", "sr", "st", "sv", "sw", "šk", "šl", "šm", "šp",
            "št", "šv", "tl", "tr", "tv", "vl", "vn", "vr", "vz", "zb", "zd", "zg", "zl", "zm",
            "zn", "zr", "zv", "žl", "žr",
        ]),
        legal_codas: set(&[
            "ck", "čn", "dn", "jn", "jt", "lc", "lk", "lm", "ln", "ls", "lt", "mp", "nc", "nd",
            "nk", "nt", "rd", "rk", "rn", "rs", "rt", "rž", "sk", "sm", "sn", "st", "šk", "št",
            "zd", "zm", "zn",
        ]),
        liquids: None,
        digraphs: None,
    }))
});

/// `isUnreadableSlovenian(word)`.
pub(crate) fn is_unreadable_slovenian(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

static ACRONYM_LETTERS: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.acronym_letters.iter().map(|w| js(w)).collect());

static LETTER_NAME: LazyLock<LetterName> =
    LazyLock::new(|| Arc::new(|l: &JsString| letter_name(l).map(js)));

/// `normalizeSlovenianInitialisms(text)`.
pub(crate) fn normalize_slovenian_initialisms(text: &JsString) -> JsString {
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

/// `counted(n, forms)`: the `slCountForm` slot, clamped to the table.
fn counted(n: f64, forms: &[&str]) -> JsString {
    js(forms[(sl_count_form(n) as usize).min(forms.len() - 1)])
}

const ORD_1_19: [&str; 20] = [
    "",
    "prvi",
    "drugi",
    "tretji",
    "četrti",
    "peti",
    "šesti",
    "sedmi",
    "osmi",
    "deveti",
    "deseti",
    "enajsti",
    "dvanajsti",
    "trinajsti",
    "štirinajsti",
    "petnajsti",
    "šestnajsti",
    "sedemnajsti",
    "osemnajsti",
    "devetnajsti",
];
const ORD_TENS: [&str; 10] = [
    "",
    "deseti",
    "dvajseti",
    "trideseti",
    "štirideseti",
    "petdeseti",
    "šestdeseti",
    "sedemdeseti",
    "osemdeseti",
    "devetdeseti",
];
const ORD_HUNDREDS: [&str; 10] = [
    "",
    "stoti",
    "dvestoti",
    "tristoti",
    "štiristoti",
    "petstoti",
    "šeststoti",
    "sedemstoti",
    "osemstoti",
    "devetstoti",
];

const ENDINGS: [(&str, &str, &str); 15] = [
    ("m.nom", "i", "i"),
    ("m.gen", "ega", "ega"),
    ("m.dat", "emu", "emu"),
    ("m.loc", "em", "em"),
    ("m.instr", "im", "im"),
    ("f.nom", "a", "a"),
    ("f.gen", "e", "e"),
    ("f.dat", "i", "i"),
    ("f.acc", "o", "o"),
    ("n.nom", "o", "e"),
    ("n.gen", "ega", "ega"),
    ("n.loc", "em", "em"),
    ("n.instr", "im", "im"),
    ("pl.nom", "i", "i"),
    ("pl.gen", "ih", "ih"),
];

fn is_integer(n: f64) -> bool {
    n.is_finite() && n.fract() == 0.0
}

/// `ordinalBase(n)`: the masculine-nominative ordinal; only the last element inflects.
pub(crate) fn ordinal_base(n: f64) -> Option<JsString> {
    if !is_integer(n) || !(1.0..1_000_000.0).contains(&n) {
        return None;
    }
    let t = &MANIFEST.numbers;
    if n < 20.0 {
        return Some(js(ORD_1_19[n as usize]));
    }
    if n < 100.0 {
        let (tn, u) = ((n / 10.0).floor() as usize, (n % 10.0) as usize);
        return Some(if u == 0 {
            js(ORD_TENS[tn])
        } else {
            js(&format!("{}{}{}", t.units[u], t.and, ORD_TENS[tn]))
        });
    }
    if n < 1000.0 {
        let r = n % 100.0;
        return Some(if r == 0.0 {
            js(ORD_HUNDREDS[(n / 100.0) as usize])
        } else {
            js(&t.hundreds[(n / 100.0).floor() as usize])
                .concat(&js(" "))
                .concat(&ordinal_base(r).unwrap())
        });
    }
    let r = n % 1000.0;
    if r == 0.0 {
        let th = n / 1000.0;
        return Some(if th == 1.0 {
            js("tisoči")
        } else {
            number_to_words(th, None).concat(&js(" tisoči"))
        });
    }
    Some(
        number_to_words(n - r, None)
            .concat(&js(" "))
            .concat(&ordinal_base(r).unwrap()),
    )
}

/// `inflect(base, slot)`: the last word's final letter replaced by the slot's ending (the soft one after a
/// palatal stem). `None` for a slot ENDINGS does not have.
fn inflect(base: &JsString, slot: &str) -> Option<JsString> {
    let (_, hard, soft) = ENDINGS.iter().find(|(k, _, _)| *k == slot)?;
    let mut words = base.split(&js(" "));
    let last = words.pop().unwrap();
    let stem = last.slice(0, Some(-1));
    let e = if js_re!("[jčžšc]$", "u").test(&stem) {
        soft
    } else {
        hard
    };
    words.push(stem.concat(&js(e)));
    Some(JsString::join(&words, &js(" ")))
}

/// `ordinalWords(n, slot)`.
pub(crate) fn ordinal_words(n: f64, slot: &str) -> Option<JsString> {
    inflect(&ordinal_base(n)?, slot)
}

const LICENSOR: [(&str, &str); 95] = [
    ("stoletja", "n.gen"),
    ("stoletju", "n.loc"),
    ("stoletje", "n.nom"),
    ("stoletjem", "n.instr"),
    ("stoletij", "pl.gen"),
    ("letih", "pl.gen"),
    ("let", "pl.gen"),
    ("leta", "pl.nom"),
    ("leti", "pl.gen"),
    ("januarja", "m.gen"),
    ("februarja", "m.gen"),
    ("marca", "m.gen"),
    ("aprila", "m.gen"),
    ("maja", "m.gen"),
    ("junija", "m.gen"),
    ("julija", "m.gen"),
    ("avgusta", "m.gen"),
    ("septembra", "m.gen"),
    ("oktobra", "m.gen"),
    ("novembra", "m.gen"),
    ("decembra", "m.gen"),
    ("januar", "m.nom"),
    ("februar", "m.nom"),
    ("marec", "m.nom"),
    ("april", "m.nom"),
    ("maj", "m.nom"),
    ("junij", "m.nom"),
    ("julij", "m.nom"),
    ("avgust", "m.nom"),
    ("september", "m.nom"),
    ("oktober", "m.nom"),
    ("november", "m.nom"),
    ("december", "m.nom"),
    ("januarjem", "m.instr"),
    ("februarjem", "m.instr"),
    ("marcem", "m.instr"),
    ("aprilom", "m.instr"),
    ("majem", "m.instr"),
    ("junijem", "m.instr"),
    ("julijem", "m.instr"),
    ("avgustom", "m.instr"),
    ("septembrom", "m.instr"),
    ("oktobrom", "m.instr"),
    ("novembrom", "m.instr"),
    ("decembrom", "m.instr"),
    ("januarju", "m.loc"),
    ("februarju", "m.loc"),
    ("marcu", "m.loc"),
    ("aprilu", "m.loc"),
    ("maju", "m.loc"),
    ("juniju", "m.loc"),
    ("juliju", "m.loc"),
    ("avgustu", "m.loc"),
    ("septembru", "m.loc"),
    ("oktobru", "m.loc"),
    ("novembru", "m.loc"),
    ("decembru", "m.loc"),
    ("uri", "f.dat"),
    ("uro", "f.acc"),
    ("ure", "f.gen"),
    ("ura", "f.nom"),
    ("mesto", "n.nom"),
    ("mestu", "n.loc"),
    ("mesta", "n.gen"),
    ("mestom", "n.instr"),
    ("kategorije", "f.gen"),
    ("kategorija", "f.nom"),
    ("kategoriji", "f.dat"),
    ("kategorijo", "f.acc"),
    ("členom", "m.instr"),
    ("člen", "m.nom"),
    ("člena", "m.gen"),
    ("členu", "m.loc"),
    ("svetovno", "f.acc"),
    ("svetovni", "f.dat"),
    ("svetovna", "f.nom"),
    ("svetovne", "f.gen"),
    ("največja", "f.nom"),
    ("največji", "m.nom"),
    ("največje", "n.nom"),
    ("največjega", "m.gen"),
    ("znamka", "f.nom"),
    ("znamke", "f.gen"),
    ("znamko", "f.acc"),
    ("dne", "m.gen"),
    ("dan", "m.nom"),
    ("dneva", "m.gen"),
    ("dnevu", "m.loc"),
    ("vojske", "f.gen"),
    ("vojska", "f.nom"),
    ("vojski", "f.dat"),
    ("vojsko", "f.acc"),
    ("polk", "m.nom"),
    ("polka", "m.gen"),
    ("polku", "m.loc"),
];

static LICENSOR_ALT: LazyLock<String> = LazyLock::new(|| {
    let mut keys: Vec<&str> = LICENSOR.iter().map(|(k, _)| *k).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.encode_utf16().count()));
    keys.join("|")
});

fn licensor(head: &JsString) -> &'static str {
    let k = head.to_string_lossy();
    LICENSOR
        .iter()
        .find(|(w, _)| *w == k)
        .map(|(_, s)| *s)
        .expect("matched from the alternation")
}

/// `slotFromEnding(word)`.
fn slot_from_ending(word: &JsString) -> &'static str {
    if word.ends_with(&js("ega")) {
        "m.gen"
    } else if word.ends_with(&js("ih")) {
        "pl.gen"
    } else {
        "m.nom"
    }
}

/// `keepFinal(expansion, matched, rest)`: the consumed dot comes back where it was also the sentence end.
fn keep_final(expansion: &JsString, mm: &JsMatch, whole: &JsString) -> JsString {
    let after = whole.slice((mm.index() + mm.value(whole).len()) as isize, None);
    if js_re!(r#"^[\s»)”"'\]]*$"#, "u").test(&after) || js_re!(r"^\s+\p{Lu}", "u").test(&after) {
        expansion.concat(&js("."))
    } else {
        expansion.clone()
    }
}

const DOTTED: [(&str, &str); 6] = [
    ("itd", "in tako dalje"),
    ("npr", "na primer"),
    ("oz", "oziroma"),
    ("idr", "in drugo"),
    ("št", "številka"),
    ("ml", "mlajši"),
];

/// `DOTTED[ab.toLowerCase()]!`: a fold-widened miss would stringify `undefined`.
fn dotted(ab: &JsString) -> &'static str {
    let k = ab.to_lower_case().to_string_lossy();
    DOTTED
        .iter()
        .find(|(w, _)| *w == k)
        .map_or("undefined", |(_, e)| *e)
}

static DOTTED_ALT: LazyLock<String> = LazyLock::new(|| {
    let mut keys: Vec<&str> = DOTTED.iter().map(|(k, _)| *k).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.encode_utf16().count()));
    keys.join("|")
});

static DOTTED_ARMS: LazyLock<[JsRegex; 3]> = LazyLock::new(|| {
    let alt = &*DOTTED_ALT;
    [
        JsRegex::new(
            &format!(r#"(?<![\p{{L}}\p{{M}}.])({alt})\.(\s+)(?=[\p{{L}}\d(„"»])"#),
            "giu",
        )
        .unwrap(),
        JsRegex::new(
            &format!(r"(?<![\p{{L}}\p{{M}}.])({alt})\.(?=\s*(?:[»)”\]]\s*)*$)"),
            "giu",
        )
        .unwrap(),
        JsRegex::new(
            &format!(r"(?<![\p{{L}}\p{{M}}.])({alt})\.(?![\p{{L}}\p{{M}}])"),
            "giu",
        )
        .unwrap(),
    ]
});

/// `DENOMINATOR[b]`.
fn denominator(b: f64) -> Option<[&'static str; 5]> {
    Some(match b as i64 {
        _ if b.fract() != 0.0 => return None,
        2 => ["polovica", "polovici", "polovice", "polovic", "polovice"],
        3 => ["tretjina", "tretjini", "tretjine", "tretjin", "tretjine"],
        4 => ["četrtina", "četrtini", "četrtine", "četrtin", "četrtine"],
        5 => ["petina", "petini", "petine", "petin", "petine"],
        6 => ["šestina", "šestini", "šestine", "šestin", "šestine"],
        7 => ["sedmina", "sedmini", "sedmine", "sedmin", "sedmine"],
        8 => ["osmina", "osmini", "osmine", "osmin", "osmine"],
        9 => ["devetina", "devetini", "devetine", "devetin", "devetine"],
        10 => ["desetina", "desetini", "desetine", "desetin", "desetine"],
        _ => return None,
    })
}

/// `feminineNumeral(n)`: `N.countForms.f[String(n)] ?? numberToWords(n)`.
fn feminine_numeral(n: f64) -> JsString {
    let key = crate::core::js_string::js_number_to_string(n);
    match MANIFEST.numbers.count_forms.f.get(&key) {
        Some(w) => js(w),
        None => number_to_words(n, None),
    }
}

/// `URA[slot]`.
fn ura(slot: &str) -> Option<&'static str> {
    match slot {
        "f.nom" => Some("ura"),
        "f.gen" => Some("ure"),
        "f.dat" => Some("uri"),
        "f.acc" => Some("uro"),
        _ => None,
    }
}

/// `clock(hv, mv, slot)`: the hour as an ordinal agreeing with *ura*, else plain cardinals.
fn clock(hv: f64, mv: f64, slot: &str) -> JsString {
    let noun = ura(slot);
    let ord = if hv == 0.0 {
        None
    } else {
        ordinal_words(hv, slot)
    };
    let (Some(ord), Some(noun)) = (ord, noun) else {
        return if mv == 0.0 {
            number_to_words(hv, None)
        } else {
            number_to_words(hv, None)
                .concat(&js(" "))
                .concat(&number_to_words(mv, None))
        };
    };
    let head = ord.concat(&js(" ")).concat(&js(noun));
    if mv == 0.0 {
        head
    } else {
        head.concat(&js(" ")).concat(&number_to_words(mv, None))
    }
}

/// `GOV_SLOT[gov]`.
fn gov_slot(gov: &str) -> Option<&'static str> {
    match gov {
        "ob" | "po" => Some("f.dat"),
        "okoli" | "okrog" | "od" | "do" => Some("f.gen"),
        "med" | "pred" => Some("f.acc"),
        _ => None,
    }
}

/// The governing preposition before a clock at `off` (`CLOCK_GOV`), as a slot; `f.nom` without one.
fn clock_slot(whole: &JsString, off: usize) -> &'static str {
    let before = whole.slice(0, Some(off as isize));
    js_re!(
        r"(?<![\p{L}\p{M}])(ob|po|okoli|okrog|od|do|med|pred)\s+(?:[\p{Ll}\p{M}]+\s+)?$",
        "iu"
    )
    .exec(&before)
    .and_then(|m| m.group(1, &before))
    .map(|g| g.to_lower_case().to_string_lossy())
    .and_then(|g| gov_slot(&g))
    .unwrap_or("f.nom")
}

const CLOCK_BODY: &str = r"([01]?\d|2[0-3])[:.]([0-5]\d)";
const CLOCK_TAIL: &str = r"(?![\d:])(?!\.\d)(?!,\d)";

static CLOCK_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\d.,]){CLOCK_BODY}{CLOCK_TAIL}(?:\s+(?:ure|uri|uro|ura)(?![\p{{L}}\p{{M}}]))?"
        ),
        "gu",
    )
    .unwrap()
});

static LICENSED_RE: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}\d.,])((?:\d{{1,4}}\.,?\s+(?:in\s+)?)*)(\d{{1,4}})\.\s+((?:[\p{{Ll}}\p{{M}}]+\s+)?)({})(?![\p{{L}}\p{{M}}])",
            *LICENSOR_ALT
        ),
        "gu",
    )
    .unwrap()
});

/// The gender repair's regexes, per COUNTED entry in order: (pattern, replacement).
static GENDER_REPAIR: LazyLock<Vec<(JsRegex, &'static str)>> = LazyLock::new(|| {
    let mut out = Vec::new();
    for (_, c) in COUNTED.iter() {
        let [sg, dual, paucal, _, _] = c.forms;
        let re = |p: String| JsRegex::new(&p, "gu").unwrap();
        if c.g == "m" {
            out.push((
                re(format!(
                    r"(?<![\d.,])1 (?={}(?![\p{{L}}\p{{M}}]))",
                    escape(sg)
                )),
                "en ",
            ));
            out.push((
                re(format!(
                    r"(?<![\d.,])(?<!do )3 (?={}(?![\p{{L}}\p{{M}}]))",
                    escape(paucal)
                )),
                "trije ",
            ));
            out.push((
                re(format!(
                    r"(?<![\d.,])(?<!do )4 (?={}(?![\p{{L}}\p{{M}}]))",
                    escape(paucal)
                )),
                "štirje ",
            ));
        } else {
            out.push((
                re(format!(
                    r"(?<![\d.,])2 (?={}(?![\p{{L}}\p{{M}}]))",
                    escape(dual)
                )),
                "dve ",
            ));
        }
    }
    out
});

/// `numOf(n)`: `Number(n.replace(",", "."))`, the first comma only.
fn num_of(n: &JsString) -> f64 {
    js_number(&js_re!(",", "").replace(n, &js(".")))
}

fn stopinja() -> &'static [&'static str; 5] {
    counted_forms("deg")
}

/// `normalizeSlovenian(input)`.
pub(crate) fn normalize_slovenian(input: &JsString) -> JsString {
    let mut s = input.clone();
    let n_tab = &MANIFEST.numbers;

    // 0) digit de-grouping: the period, then the space family; the remaining space family → a space.
    for _ in 0..2 {
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)\.(?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
    }
    for _ in 0..2 {
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)[    ](?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
    }
    s = rewrite(&s, js_re!(r"[    ]", "gu"), &js(" "));

    // 1) the multi-dot era markers; the final dot kept where it was the sentence end.
    for (re, w) in [
        (
            js_re!(
                r"(?<![\p{L}\p{M}])pr\.\s?n\.\s?(?:št|š)\.?(?![\p{L}\p{M}])",
                "gu"
            ),
            "pred našim štetjem",
        ),
        (
            js_re!(r"(?<![\p{L}\p{M}])n\.\s?(?:št|š)\.?(?![\p{L}\p{M}])", "gu"),
            "našega štetja",
        ),
    ] {
        s = rewrite_with(&s, re, |mm, t| keep_final(&js(w), mm, t));
    }

    // 2) dotted abbreviations, three arms; honorifics before a capital; `St.`, `Inc.`, `et al.`
    let arms = &*DOTTED_ARMS;
    s = rewrite_with(&s, &arms[0], |mm, t| {
        js(dotted(&mm.group(1, t).unwrap())).concat(&mm.group(2, t).unwrap())
    });
    s = rewrite_with(&s, &arms[1], |mm, t| {
        js(dotted(&mm.group(1, t).unwrap())).concat(&js("."))
    });
    s = rewrite_with(&s, &arms[2], |mm, t| js(dotted(&mm.group(1, t).unwrap())));
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}.])([Dd]r|[Gg]a|[Gg])\.(\s+)(?=\p{Lu})",
            "gu"
        ),
        |mm, t| {
            let w = match mm
                .group(1, t)
                .unwrap()
                .to_lower_case()
                .to_string_lossy()
                .as_str()
            {
                "dr" => "doktor",
                "ga" => "gospa",
                _ => "gospod",
            };
            js(w).concat(&mm.group(2, t).unwrap())
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}.])(St)\.(?=\s+\p{Lu})", "gu"),
        &js("$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}.])(Inc)\.(?=\s+\p{Ll})", "gu"),
        &js("$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=(?:et|Et)\s)(al)\.(?![\p{L}\p{M}])", "gu"),
        &js("$1"),
    );

    // 3) the clock, then the four-digit clock before a time zone.
    s = rewrite_with(&s, &CLOCK_RE, |mm, t| {
        clock(
            js_number(&mm.group(1, t).unwrap()),
            js_number(&mm.group(2, t).unwrap()),
            clock_slot(t, mm.index()),
        )
    });
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,:])([01]\d|2[0-3])([0-5]\d)(?![\d.,:])(?=\s*\)?\s*(?:po\s+)?(?:UTC|GMT|CET|CEST)(?![\p{L}\p{M}]))",
            "gu"
        ),
        |mm, t| {
            clock(
                js_number(&mm.group(1, t).unwrap()),
                js_number(&mm.group(2, t).unwrap()),
                clock_slot(t, mm.index()),
            )
        },
    );

    // 4) the decimal point.
    s = rewrite(&s, js_re!(r"(\d)\.(?=\d)", "gu"), &js("$1 pika "));

    // 5) scores (a colon, or a non-ascending dash pair), then ranges.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,:–—-])(\d{1,2})([:–—-])(\d{1,2})(?![\d:])(?!\.\d)(?!,\d)",
            "gu"
        ),
        |mm, t| {
            let (a, mark, b) = (
                mm.group(1, t).unwrap(),
                mm.group(2, t).unwrap(),
                mm.group(3, t).unwrap(),
            );
            if mark != js(":") && js_number(&b) > js_number(&a) {
                return mm.value(t);
            }
            let after = t.slice(mm.end() as isize, None);
            let said = js_re!(r"^\s*proti(?![\p{L}\p{M}])", "u").test(&after);
            if said {
                a.concat(&js(" ")).concat(&b)
            } else {
                a.concat(&js(" proti ")).concat(&b)
            }
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d+(?:,\d+)*)\s?[–—-]\s?(\d+(?:,\d+)*)(?![\d.,])",
            "gu"
        ),
        |mm, t| {
            let (a, b) = (mm.group(1, t).unwrap(), mm.group(2, t).unwrap());
            if a.len() == 4 && b.len() <= 2 {
                mm.value(t)
            } else {
                a.concat(&js(" do ")).concat(&b)
            }
        },
    );

    // 6) regnal ordinals after a title and up to three capitalised names.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])([Kk]ralj[\p{L}\p{M}]*|[Cc]esar[\p{L}\p{M}]*|[Pp]apež[\p{L}\p{M}]*|[Pp]oglavar[\p{L}\p{M}]*)(\s+(?:\p{Lu}[\p{L}\p{M}]*\s+){1,3})(\d{1,2})(\.?)(?![\p{L}\p{M}\d,])",
            "gu"
        ),
        |mm, t| {
            let title = mm.group(1, t).unwrap();
            let tl = title.to_lower_case();
            let ends = |x: &str| tl.ends_with(&js(x));
            let slot = if ends("ica") {
                "f.nom"
            } else if ends("ice") {
                "f.gen"
            } else if ends("ico") {
                "f.acc"
            } else if ends("ici") {
                "f.dat"
            } else if ends("a") {
                "m.gen"
            } else if ends("u") {
                "m.loc"
            } else {
                "m.nom"
            };
            let Some(ord) = ordinal_words(js_number(&mm.group(3, t).unwrap()), slot) else {
                return mm.value(t);
            };
            let body = title.concat(&mm.group(2, t).unwrap()).concat(&ord);
            if mm.group(4, t).unwrap_or_default().is_empty() {
                body
            } else {
                keep_final(&body, mm, t)
            }
        },
    );

    // 7) licensed `N.` ordinals (with a coordinated list before them), then a bare `N.` before a lowercase word.
    s = rewrite_with(&s, &LICENSED_RE, |mm, t| {
        let head = mm.group(4, t).unwrap();
        let slot = licensor(&head);
        let Some(tail) = ordinal_words(js_number(&mm.group(2, t).unwrap()), slot) else {
            return mm.value(t);
        };
        let list = mm.group(1, t).unwrap_or_default();
        let pre = js_re!(r"(\d{1,4})\.(,?)", "gu").replace_with(&list, |m2, l| {
            ordinal_words(js_number(&m2.group(1, l).unwrap()), slot)
                .unwrap_or_else(|| m2.value(l))
                .concat(&m2.group(2, l).unwrap_or_default())
        });
        pre.concat(&tail)
            .concat(&js(" "))
            .concat(&mm.group(3, t).unwrap_or_default())
            .concat(&head)
    });
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d.,])(\d{1,4})\.(?=\s*[,]|\s+[\p{Ll}\p{M}])",
            "gu"
        ),
        |mm, t| {
            let after = t.slice(mm.end() as isize, None);
            let word = js_re!(r"^\s+([\p{Ll}\p{M}]+)", "u")
                .exec(&after)
                .and_then(|m| m.group(1, &after));
            let slot = word.as_ref().map_or("m.nom", slot_from_ending);
            ordinal_words(js_number(&mm.group(1, t).unwrap()), slot).unwrap_or_else(|| mm.value(t))
        },
    );

    // 8) decades (`-ih`), and a hyphen between a number and a unit.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,\p{L}\p{M}])(\d{1,4})\s?-\s?ih(?![\p{L}\p{M}])",
            "gu"
        ),
        |mm, t| {
            let digits = mm.group(1, t).unwrap();
            let words = number_to_words(js_number(&digits), Some(&digits));
            if js_re!("[aeiou]$", "u").test(&words) {
                mm.value(t)
            } else {
                words.concat(&js("ih"))
            }
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)-(?=(?:km|mm|cm|kg|m)(?![\p{L}\p{M}]))", "gu"),
        &js("$1 "),
    );

    // 9) degrees.
    s = rewrite_with(
        &s,
        js_re!(r"(\d+(?:,\d+)?)\s?°\s?C(?![\p{L}\p{M}])", "gui"),
        |mm, t| {
            let n = mm.group(1, t).unwrap();
            n.concat(&js(" "))
                .concat(&counted(num_of(&n), stopinja()))
                .concat(&js(" Celzija"))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d+(?:,\d+)?)\s?°\s?F(?![\p{L}\p{M}])", "gui"),
        |mm, t| {
            let n = mm.group(1, t).unwrap();
            n.concat(&js(" "))
                .concat(&counted(num_of(&n), stopinja()))
                .concat(&js(" Fahrenheita"))
        },
    );
    s = rewrite_with(&s, js_re!(r"(\d+(?:,\d+)?)\s?°", "gu"), |mm, t| {
        let n = mm.group(1, t).unwrap();
        n.concat(&js(" ")).concat(&counted(num_of(&n), stopinja()))
    });

    // 10) × and the signs.
    s = rewrite(&s, js_re!(r"(?<=\d)\s?[x×]\s?(?=\d)", "gu"), &js(" krat "));
    s = rewrite(&s, js_re!("±", "gu"), &js(" plus minus "));
    s = rewrite(&s, js_re!(r"(^|[\s(])\+\s?(?=\d)", "gu"), &js("$1plus "));
    s = rewrite(&s, js_re!(r"(^|[\s(])[-−](?=\d)", "gu"), &js("$1minus "));
    s = rewrite(&s, js_re!(r"(?<=\p{Lu})\+(?=\d)", "gu"), &js(" plus "));

    // 11) a number hyphenated to a word: the last number word fused with it.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,-])(\d+)-(\p{Ll}{4,})", "gu"),
        |mm, t| {
            let v = js_number(&mm.group(1, t).unwrap());
            if !is_safe_integer(v) {
                return mm.value(t);
            }
            let tail = mm.group(2, t).unwrap();
            let words = number_to_words(v, None);
            match words.last_index_of(&js(" ")) {
                None => words.concat(&tail),
                Some(cut) => words
                    .slice(0, Some(cut as isize))
                    .concat(&js(" "))
                    .concat(&words.slice(cut as isize + 1, None))
                    .concat(&tail),
            }
        },
    );

    // 12) the spelled-out mile rate.
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])milj\s?\/\s?(?:uro|h)(?![\p{L}\p{M}])",
            "giu"
        ),
        &js("milj na uro"),
    );

    // 14) the symbol tier; 15) the gender repair of 1–4.
    s = SYMBOLS.apply(&s);
    for (re, w) in GENDER_REPAIR.iter() {
        s = rewrite(&s, re, &js(w));
    }

    // 16) the decimal comma.
    s = rewrite_with(&s, js_re!(r"(?<=\d),(\d+)", "gu"), |mm, t| {
        let frac = mm.group(1, t).unwrap();
        let zeros = frac.0.iter().take_while(|&&c| c == b'0' as u16).count();
        let word = &n_tab.decimal_word;
        if zeros == 0 {
            js(&format!(" {word} ")).concat(&frac)
        } else {
            js(&format!(" {word} {}", "0 ".repeat(zeros))).concat(&frac.slice(zeros as isize, None))
        }
    });

    // 17) fractions: a mixed number, then a bare one; the vulgar fractions.
    let frac = |a: &JsString, b: &JsString| -> Option<JsString> {
        let forms = denominator(js_number(b))?;
        let (an, bn) = (js_number(a), js_number(b));
        if an == 1.0 && bn == 2.0 {
            return Some(js("pol"));
        }
        Some(
            feminine_numeral(an)
                .concat(&js(" "))
                .concat(&counted(an, &forms)),
        )
    };
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,\/])(\d+)\s+(\d{1,3})\/(\d{1,2})(?![\d.,\/])",
            "gu"
        ),
        |mm, t| match frac(&mm.group(2, t).unwrap(), &mm.group(3, t).unwrap()) {
            None => mm.value(t),
            Some(f) => mm.group(1, t).unwrap().concat(&js(" in ")).concat(&f),
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,\/])(\d{1,3})\/(\d{1,2})(?![\d.,\/])", "gu"),
        |mm, t| {
            frac(&mm.group(1, t).unwrap(), &mm.group(2, t).unwrap()).unwrap_or_else(|| mm.value(t))
        },
    );
    s = rewrite(&s, js_re!(r"(\d+)¾", "gu"), &js("$1 in tri četrtine"));
    s = rewrite(&s, js_re!(r"(\d+)½", "gu"), &js("$1 in pol"));
    s = rewrite(&s, js_re!(r"(\d+)¼", "gu"), &js("$1 in ena četrtina"));

    // 18) relational signs, letter-pair ampersands, division, the ampersand, a letter after a digit.
    s = rewrite(&s, js_re!(r"\s*=\s*", "gu"), &js(" enako "));
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*<\s*(?=\d)", "gu"),
        &js("$1 je manjše od "),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*>\s*(?=\d)", "gu"),
        &js("$1 je večje od "),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])(\p{Lu})\s*[&＆]\s*(\p{Lu})(?![\p{L}\p{M}])",
            "gu"
        ),
        |mm, t| {
            let x = letter_name(&mm.group(1, t).unwrap().to_lower_case());
            let y = letter_name(&mm.group(2, t).unwrap().to_lower_case());
            match (x, y) {
                (Some(x), Some(y)) => js(&format!("{x} in {y}")),
                _ => mm.value(t),
            }
        },
    );
    s = rewrite_with(&s, js_re!(r"(\d+)\s?÷\s?(\d+)", "gu"), |mm, t| {
        let (a, b) = (mm.group(1, t).unwrap(), mm.group(2, t).unwrap());
        let y = number_to_words(js_number(&b), Some(&b));
        let with = if js_re!("^[ptksšcčfh]", "u").test(&y) {
            "s"
        } else {
            "z"
        };
        number_to_words(js_number(&a), Some(&a))
            .concat(&js(&format!(" deljeno {with} ")))
            .concat(&y)
    });
    s = rewrite(&s, js_re!(r"\s*[&＆]\s*", "gu"), &js(" in "));
    s = rewrite_with(
        &s,
        js_re!(r"(?<=\d)(\p{L})(?![\p{L}\p{M}])", "gu"),
        |mm, t| match letter_name(&mm.group(1, t).unwrap().to_lower_case()) {
            None => mm.value(t),
            Some(name) => js(&format!(" {name}")),
        },
    );

    normalize_slovenian_initialisms(&s)
}
