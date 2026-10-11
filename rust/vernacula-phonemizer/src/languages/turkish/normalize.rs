//! Turkish (tr) text normalization: era markers, dotted abbreviations, clock times, `/` units, degrees, signs,
//! relational signs with their case morphology, and the initialism pass; plus the ordinal and suffix helpers the
//! tokenizer uses. Ported from src/languages/turkish/normalize.ts — see that file for the corpus evidence.

use std::sync::{Arc, LazyLock};

use super::g2p::tr_lower;
use super::manifest::MANIFEST;
use super::numbers::number_to_words;
use crate::core::initialisms::{
    InitialismData, LetterName, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `VOWEL = /[aeıioöuü]/u` tested on ONE code unit (`w[i]`), as every caller here does.
fn is_vowel_unit(u: u16) -> bool {
    "aeıioöuü".encode_utf16().any(|x| x == u)
}

/// `HIGH`, the four-way harmony table. Generated from normalize.ts's object literal (key order preserved).
const HIGH: [(&str, &str); 8] = [
    ("a", "ı"),
    ("ı", "ı"),
    ("e", "i"),
    ("i", "i"),
    ("o", "u"),
    ("u", "u"),
    ("ö", "ü"),
    ("ü", "ü"),
];

fn high(v: u16) -> &'static str {
    HIGH.iter()
        .find(|(k, _)| k.encode_utf16().eq([v]))
        .map(|(_, h)| *h)
        .expect("every VOWEL letter has a HIGH entry")
}

/// `lastVowelOf(w)`: the last code unit that is a vowel letter.
fn last_vowel_of(w: &JsString) -> Option<u16> {
    w.units().iter().rev().copied().find(|&u| is_vowel_unit(u))
}

/// `ordinalWords(n)`: the cardinal with -(I)ncI on its last word; `None` where no ordinal can be built.
pub(crate) fn ordinal_words(n: f64) -> Option<JsString> {
    if !is_safe_integer(n) || n < 0.0 {
        return None;
    }
    let card = number_to_words(n);
    if card.is_empty() || js_re!(r"\d", "u").test(&card) {
        return None;
    }
    let mut words = card.split(&js(" "));
    let mut stem = words.last().unwrap().clone();
    if stem == js("dört") {
        stem = js("dörd");
    }
    let v = last_vowel_of(&stem)?;
    let h = js(high(v));
    let ends_in_vowel = stem.units().last().is_some_and(|&u| is_vowel_unit(u));
    let last = if ends_in_vowel {
        stem.concat(&js("nc")).concat(&h)
    } else {
        stem.concat(&h).concat(&js("nc")).concat(&h)
    };
    *words.last_mut().unwrap() = last;
    Some(JsString::join(&words, &js(" ")))
}

/// `attachSuffix(words, suffix)`: glue an apostrophe suffix onto the last spoken word (dört → dörd- before a
/// vowel). ⚠ The vowel test is case-SENSITIVE, as in the TS: the tokenizer's `iu` lets `'Ü` through.
pub(crate) fn attach_suffix(words: &[JsString], suffix: &JsString) -> Vec<JsString> {
    if words.is_empty() {
        return vec![suffix.clone()];
    }
    let mut out = words.to_vec();
    let last = out.last().unwrap().clone();
    let stem = if last == js("dört") && suffix.units().first().is_some_and(|&u| is_vowel_unit(u)) {
        js("dörd")
    } else {
        last
    };
    *out.last_mut().unwrap() = stem.concat(suffix);
    out
}

/// `DOTTED_ABBREV`. Generated from normalize.ts's object literal (key order preserved).
const DOTTED_ABBREV: [(&str, &str); 4] = [
    ("vb", "ve benzeri"),
    ("vs", "ve saire"),
    ("dr", "Doktor"),
    ("no", "numara"),
];

fn dotted_abbrev(ab: &JsString) -> Option<JsString> {
    DOTTED_ABBREV
        .iter()
        .find(|(k, _)| js(k) == *ab)
        .map(|(_, w)| js(w))
}

/// `ABBREV_ALT`: the keys, longest first (a stable sort).
static ABBREV_ALT: LazyLock<String> = LazyLock::new(|| {
    let mut keys: Vec<&str> = DOTTED_ABBREV.iter().map(|(k, _)| *k).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.encode_utf16().count()));
    keys.join("|")
});
static ABBREV_CONTINUES: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"(?<![\p{{L}}\p{{M}}])({})\.(\s+)(?=\p{{L}})", *ABBREV_ALT),
        "giu",
    )
    .unwrap()
});
static ABBREV_ENDS: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"(?<![\p{{L}}\p{{M}}])({})\.(?=\s*(?:[.,;:!?»)]|$))",
            *ABBREV_ALT
        ),
        "giu",
    )
    .unwrap()
});

type WordTest = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

/// `isUnreadableTurkish`: the phonotactic test for core/initialisms.ts.
static IS_UNREADABLE: LazyLock<WordTest> = LazyLock::new(|| {
    let p = &MANIFEST.phonotactics;
    Arc::new(make_unreadable_test(PhonotacticsData {
        vowels: JsRegex::new(&format!("[{}]", p.vowels), "u").unwrap(),
        legal_onsets: p.onsets.iter().map(|o| js(o)).collect(),
        legal_codas: p.codas.iter().map(|c| js(c)).collect(),
        liquids: None,
        digraphs: None,
    }))
});

/// `(l) => MANIFEST.letterNames[l]`: `l` is one lowercased code point, which no `Object.prototype` member is.
static LETTER_NAME: LazyLock<LetterName> = LazyLock::new(|| {
    Arc::new(|l: &JsString| {
        MANIFEST
            .letter_names
            .get(&l.to_string_lossy())
            .map(|n| js(n))
    })
});

/// `isUnreadableTurkish(word)`.
pub(crate) fn is_unreadable_turkish(word: &JsString) -> bool {
    IS_UNREADABLE(word)
}

/// `normalizeInitialisms`, lowercasing with `trLower` (not the shared `toLowerCase`).
pub(crate) fn normalize_turkish_initialisms(text: &JsString) -> JsString {
    make_initialism_normalizer(
        InitialismData {
            letter_name: LETTER_NAME.clone(),
            lower: Some(Arc::new(tr_lower)),
            acronym_letters: Arc::new(|_: &JsString| false),
            is_recorded: |_: &JsString| false,
            is_unreadable: IS_UNREADABLE.clone(),
        },
        true,
    )(text)
}

/// `lowVowel(stem)`: a or e by the stem's last vowel.
fn low_vowel(stem: &JsString) -> &'static str {
    match last_vowel_of(stem) {
        Some(v) if "aıou".encode_utf16().any(|x| x == v) => "a",
        _ => "e",
    }
}

/// `ablative(w)`: -DEn on the last word. ⚠ An empty last word makes `stem[stem.length - 1]` undefined, and
/// `includes(undefined)` searches for "undefined": false, so `d`.
fn ablative(w: &JsString) -> JsString {
    let cut = w.last_index_of(&js(" ")).map_or(0, |i| i + 1);
    let head = w.slice(0, Some(cut as isize));
    let stem = w.slice(cut as isize, None);
    let voiceless = stem
        .units()
        .last()
        .is_some_and(|&u| "pçtkfhsş".encode_utf16().any(|x| x == u));
    let d = if voiceless { "t" } else { "d" };
    head.concat(&stem)
        .concat(&js(d))
        .concat(&js(low_vowel(&stem)))
        .concat(&js("n"))
}

/// `trWord(t)`: `numberToWords(Number(t)) || t`.
fn tr_word(t: &JsString) -> JsString {
    let w = number_to_words(js_number(t));
    if w.is_empty() { t.clone() } else { w }
}

static LESS: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&postposed_pattern("<"), "gu").unwrap());
static GREATER: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&postposed_pattern(">"), "gu").unwrap());

/// `` `(${OPERAND})\\s?${sign}\\s?(${OPERAND})` `` with `OPERAND = \d+`.
fn postposed_pattern(sign: &str) -> String {
    let operand = r"\d+";
    format!(r"({operand})\s?{sign}\s?({operand})")
}

fn postposed(s: &JsString, re: &JsRegex, verb: &str) -> JsString {
    rewrite_with(s, re, |m, t| {
        let (a, b) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
        tr_word(&a)
            .concat(&js(" "))
            .concat(&ablative(&tr_word(&b)))
            .concat(&js(" "))
            .concat(&js(verb))
    })
}

/// `normalizeTurkish(input)`. The numbered steps are order-dependent, as in the TS.
pub(crate) fn normalize_turkish(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1) era markers.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])M\.\s?Ö\.", "gu"),
        &js("milattan önce"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])M\.\s?S\.", "gu"),
        &js("milattan sonra"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])MÖ(?=\s+\d)", "gu"),
        &js("milattan önce"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])MS(?=\s+\d)", "gu"),
        &js("milattan sonra"),
    );

    // 2) dotted abbreviations. ⚠ The miss branch is reachable (#1122): the `iu` fold widens the pattern past
    //    the table's keys, and the match then stays as written.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])No\.['’]lu(?![\p{L}\p{M}])", "gu"),
        &js("numaralı"),
    );
    s = rewrite_with(&s, &ABBREV_CONTINUES, |m, t| {
        match dotted_abbrev(&m.group(1, t).unwrap().to_lower_case()) {
            None => m.value(t),
            Some(w) => w.concat(&m.group(2, t).unwrap()),
        }
    });
    s = rewrite_with(&s, &ABBREV_ENDS, |m, t| {
        match dotted_abbrev(&m.group(1, t).unwrap().to_lower_case()) {
            None => m.value(t),
            Some(w) => w.concat(&js(".")),
        }
    });

    // 3) clock: zero minutes dropped; output stays digits.
    let clock = |m: &crate::core::js_regex::JsMatch, t: &JsString| {
        let (h, min) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
        if js_number(&min) == 0.0 {
            h
        } else {
            h.concat(&js(" ")).concat(&min)
        }
    };
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,:])([01]?\d|2[0-3]):([0-5]\d)(?![\d:])", "gu"),
        clock,
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,:])([01]?\d|2[0-3])\.([0-5]\d)(?![\d'’])", "gu"),
        clock,
    );

    // 4) compound `/` units, reordered rate-first.
    s = rewrite(
        &s,
        js_re!(
            r"(\d+(?:[.,]\d+)?)\s?km\s?\/\s?(?:saat|sa|s)(?![\p{L}\p{M}])",
            "gu"
        ),
        &js("saatte $1 kilometre"),
    );
    s = rewrite(
        &s,
        js_re!(
            r"(\d+(?:[.,]\d+)?)\s?mil\s?\/\s?(?:saat|sa|s)(?![\p{L}\p{M}])",
            "gu"
        ),
        &js("saatte $1 mil"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d+(?:[.,]\d+)?)\s?m\s?\/\s?s(?![\p{L}\p{M}])", "gu"),
        &js("saniyede $1 metre"),
    );

    // 5) degree.
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?C(?![\p{L}\p{M}])", "gui"),
        &js("$1 derece"),
    );
    s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 derece"));

    // 6) signs.
    s = rewrite(&s, js_re!(r"±", "gu"), &js(" artı eksi "));
    s = rewrite(&s, js_re!(r"(\S)\+\s?(\d)", "gu"), &js("$1 artı $2"));
    s = rewrite(&s, js_re!(r"(^|\s)\+\s?(\d)", "gu"), &js("$1artı $2"));
    s = rewrite(&s, js_re!(r"(^|[\s(])[-−–](\d)", "gu"), &js("$1eksi $2"));

    // 6b) relational and division signs; the comparatives take the ablative on the second operand.
    s = postposed(&s, &LESS, "küçüktür");
    s = postposed(&s, &GREATER, "büyüktür");
    s = rewrite(&s, js_re!(r"\s?=\s?", "gu"), &js(" eşittir "));
    s = rewrite(&s, js_re!(r"\s?÷\s?", "gu"), &js(" bölü "));
    s = rewrite(&s, js_re!(r"\s?&\s?", "gu"), &js(" ve "));

    // 7) initialisms, last of the letter rules.
    normalize_turkish_initialisms(&s)
}
