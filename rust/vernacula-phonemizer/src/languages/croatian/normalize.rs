//! Croatian (hr) text normalization: zero-width removal, digit de-grouping, the era markers (with the elided
//! `godine` ordinal), `itd.`, dotted capitals, `Dr.`, `SAD`, prenominal Roman ordinals, degrees, the
//! numeral+suffix and licensed `N.` ordinals, the elided-year ordinal, the `h` clock, ranges, the mile rate, the
//! symbol tier, the decimal comma, fractions, signs and the shared initialism pass.
//! Ported from src/languages/croatian/normalize.ts — see that file for the corpus evidence.

use super::croatian::SYMBOLS;
use super::manifest::MANIFEST;
use super::numbers::number_to_words;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;
use crate::languages::serbian::normalize::{
    SUFFIX_RE, SlavicOrdinals, Slot, clock_words, counted, int_of, normalize_serbian_initialisms,
    read_decimal_comma, slot_of,
};

const ENDINGS: [(&str, &str, &str); 11] = [
    ("m.nom", "i", "i"),
    ("m.gen", "og", "eg"),
    ("m.loc", "om", "em"),
    ("n.nom", "o", "e"),
    ("n.gen", "og", "eg"),
    ("n.loc", "om", "em"),
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
        "dvjestoti",
        "tristoti",
        "četiristoti",
        "petstoti",
        "šeststoti",
        "sedamstoti",
        "osamstoti",
        "devetstoti",
    ],
    thousandth: "tisućiti",
    endings: &ENDINGS,
    numbers: || &MANIFEST.numbers,
};

const LICENSOR: [(&str, &str); 39] = [
    ("godine", "f.gen"),
    ("godini", "f.dat"),
    ("godinu", "f.acc"),
    ("godina", "f.nom"),
    ("stoljeća", "n.gen"),
    ("stoljeću", "m.loc"),
    ("stoljeće", "m.nom"),
    ("vijeka", "m.gen"),
    ("vijeku", "m.loc"),
    ("marka", "f.gen"),
    ("marku", "f.acc"),
    ("najvećim", "m.loc"),
    ("mjesto", "n.nom"),
    ("mjestu", "n.loc"),
    ("najveća", "f.nom"),
    ("najveći", "m.nom"),
    ("najveće", "n.nom"),
    ("kategorije", "f.gen"),
    ("pakistanskog", "m.gen"),
    ("pukovnija", "f.nom"),
    ("husarska", "f.nom"),
    ("kolovoza", "m.gen"),
    ("rujna", "m.gen"),
    ("listopada", "m.gen"),
    ("srpnja", "m.gen"),
    ("travnja", "m.gen"),
    ("svibnja", "m.gen"),
    ("lipnja", "m.gen"),
    ("siječnja", "m.gen"),
    ("veljače", "m.gen"),
    ("ožujka", "m.gen"),
    ("studenoga", "m.gen"),
    ("prosinca", "m.gen"),
    ("svjetskog", "m.gen"),
    ("svjetskom", "m.loc"),
    ("svjetski", "m.nom"),
    ("svjetskoga", "m.gen"),
    ("reda", "m.gen"),
    ("redu", "m.loc"),
];

const STUPANJ: [&str; 3] = ["stupanj", "stupnja", "stupnjeva"];
const MILJA: [&str; 3] = ["milja", "milje", "milja"];

/// `ROMAN_ORD[rom.toUpperCase()]`.
fn roman_ord(rom: &JsString) -> Option<&'static str> {
    match rom.to_upper_case().to_string_lossy().as_str() {
        "I" => Some("prvi"),
        "II" => Some("drugi"),
        "III" => Some("treći"),
        "IV" => Some("četvrti"),
        "V" => Some("peti"),
        _ => None,
    }
}

/// The compass word of `({ N, S, E, W })[letter.toUpperCase()]!`.
fn compass(letter: &JsString) -> &'static str {
    match letter.to_upper_case().to_string_lossy().as_str() {
        "N" => "sjeverno",
        "S" => "južno",
        "E" => "istočno",
        "W" => "zapadno",
        _ => "undefined",
    }
}

/// `normalizeCroatian(input)`.
pub(crate) fn normalize_croatian(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 0) zero-width characters.
    s = rewrite(
        &s,
        js_re!("[\\u200B\\u200C\\u200D\\uFEFF]", "gu"),
        &JsString::new(),
    );

    // 1) digit de-grouping (two passes), then the dash range between two dotted era years.
    for _ in 0..2 {
        s = rewrite(
            &s,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)\.(?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
    }
    s = rewrite(
        &s,
        js_re!(
            r"(\d{1,4})\.\s*[-–—]\s*(\d{1,4})\.(?=\s*(?:n\.\s?e\.|p\.\s?n\.\s?e\.))",
            "gu"
        ),
        &js("$1 do $2"),
    );

    // 2) the era markers (lowercase-only); the year before one is an ordinal with `godine` elided.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d.,])(\d{1,4})\.\s+(?:g\.\s+)?(?=(?:n\.\s?e|p\.\s?n\.\s?e|pr\.\s?Kr\.)(?![\p{L}\p{M}]))",
            "gu"
        ),
        |mm, t| match ORD.ordinal_base(js_number(&mm.group(1, t).unwrap())) {
            None => mm.value(t),
            Some(base) => ORD
                .inflect_or_undefined(&base, Slot::Own("f.gen"))
                .concat(&js(" ")),
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])p\.\s?n\.\s?e\.(?=[.!?]|$)", "gu"),
        &js("prije nove ere."),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])p\.\s?n\.\s?e\.(\s)", "gu"),
        &js("prije nove ere$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])n\.\s?e\.(?=[.!?]|$)", "gu"),
        &js("nove ere."),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])n\.\s?e\.(\s)", "gu"),
        &js("nove ere$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])pr\.\s?Kr\.(?=[.!?]|$)", "gu"),
        &js("prije Krista."),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])pr\.\s?Kr\.(\s)", "gu"),
        &js("prije Krista$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\d)\s+g\.\s+(?=(?:n\.\s?e\.|pr\.\s?Kr\.))", "gu"),
        &js(" "),
    );

    // 3) `itd.`
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])itd\.(\s+)(?=[\p{L}\d(])", "giu"),
        &js("i tako dalje$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])itd\.(?=\s*[,;:])", "giu"),
        &js("i tako dalje"),
    );
    s = rewrite(
        &s,
        js_re!(r#"(?<![\p{L}\p{M}])itd\.(?=\s*(?:[.!?”"»)\]])|$)"#, "giu"),
        &js("i tako dalje."),
    );

    // 4) dotted capital runs, the lone initial, `Dr.`, `SAD-`.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])\p{Lu}\.(?:[  ]?\p{Lu}\.)+", "gu"),
        |mm, t| js_re!(r"[.\s]", "gu").replace(&mm.value(t), &JsString::new()),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<=\p{Lu}\p{L}*\s)(\p{Lu})\.(?=\s+\p{Lu}\p{Ll})", "gu"),
        &js("$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])Dr\.(\s+)(?=[\p{L}\d])", "giu"),
        &js("Doktor$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])Dr\.(?=\s*(?:[.,;:!?»)]|$))", "giu"),
        &js("Doktor."),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![-\p{L}\p{M}])SAD(?=-)", "gu"),
        &js("Sjedinjene Američke Države"),
    );

    // 4b) prenominal Roman ordinals, the slot read off the following word's ending.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])([IVXL]+)\.\s+(\p{Ll}[\p{L}\p{M}]*)",
            "gu"
        ),
        |mm, t| {
            let word = mm.group(2, t).unwrap();
            let Some(base) = roman_ord(&mm.group(1, t).unwrap()) else {
                return mm.value(t);
            };
            let ends = |x: &str| word.ends_with(&js(x));
            // A licensor's own slot first (#1532: `I. stoljeću` read *prvi*).
            let slot = if let Slot::Own(licensed) = slot_of(&LICENSOR, &word) {
                licensed
            } else if ends("og") {
                "m.gen"
            } else if ends("om") {
                "m.loc"
            } else if ends("e") || ends("a") {
                "m.gen"
            } else {
                "m.nom"
            };
            match ORD.inflect(&js(base), Slot::Own(slot)) {
                None => mm.value(t),
                Some(o) => o.concat(&js(" ")).concat(&word),
            }
        },
    );

    // 5) degrees: the scale, the compass bearing (lowercase ⟨s⟩ only attached), then the bare degree.
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?°\s?([CFcf])(?![\p{L}\p{M}])", "gui"),
        |mm, t| {
            let word = if js_re!("[Ff]", "u").test(&mm.group(2, t).unwrap()) {
                "stupnjeva Farenhajta"
            } else {
                "stupnjeva Celzija"
            };
            mm.group(1, t).unwrap().concat(&js(" ")).concat(&js(word))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?°(?:\s?([NEWSnew])|([s]))(?![\p{L}\p{M}])", "gu"),
        |mm, t| {
            let letter = mm.group(2, t).or_else(|| mm.group(3, t)).unwrap();
            mm.group(1, t)
                .unwrap()
                .concat(&js(" stupnjeva "))
                .concat(&js(compass(&letter)))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d+)\s?°(?:\s?[QXYqxy](?![\p{L}\p{M}]))?", "gu"),
        |mm, t| {
            let n = mm.group(1, t).unwrap();
            n.concat(&js(" "))
                .concat(&counted(int_of(&n), STUPANJ))
                .concat(&js(" "))
        },
    );

    // 6) numeral + hyphen + case suffix.
    s = rewrite_with(&s, &SUFFIX_RE, |mm, t| {
        let suffix = mm.group(2, t).unwrap().to_lower_case();
        ORD.ordinal_forms(js_number(&mm.group(1, t).unwrap()))
            .into_iter()
            .find(|f| f.ends_with(&suffix))
            .unwrap_or_else(|| mm.value(t))
    });

    // 7) the licensed `N.` ordinal. ⚠ `LICENSOR[word]` is not lowercased, so every `Object.prototype` name
    //    that starts with a lowercase letter reads the inherited member (`undefined <word>`).
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,])(\d{1,4})\.\s+(\p{Ll}[\p{L}\p{M}]*)", "gu"),
        |mm, t| {
            let word = mm.group(2, t).unwrap();
            let slot = slot_of(&LICENSOR, &word);
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

    // 7b) a year with `godine` elided; the period kept only where it is also a sentence end.
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.,\-]|\d\/)(1\d{3}|20\d{2}|2100)\.(?!\d)", "gu"),
        |mm, all| elided_year(&ORD, mm, all),
    );

    // 8) the colon clock with the optional `h`.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\d:.,])([01]?\d|2[0-3]):([0-5]\d)(?![\d:]|[.,]\d)(?:\s*h)?",
            "giu"
        ),
        |mm, t| {
            let hv = js_number(&mm.group(1, t).unwrap());
            let mv = js_number(&mm.group(2, t).unwrap());
            if hv > 23.0 || mv > 59.0 {
                return mm.value(t);
            }
            clock_words(hv, mv, &|n| number_to_words(n, None))
        },
    );

    // 9) numeric ranges; 9b) the spelled-out mile rate.
    s = rewrite(&s, js_re!(r"(\d)\s?[-–—]\s?(?=\d)", "gu"), &js("$1 do "));
    s = rewrite_with(
        &s,
        js_re!(
            r"(\d+(?:,\d+)?)\s?milja\s*\/\s*(?:sat|h)(?![\p{L}\p{M}])",
            "giu"
        ),
        |mm, t| {
            let n = mm.group(1, t).unwrap();
            n.concat(&js(" "))
                .concat(&counted(int_of(&n), MILJA))
                .concat(&js(" na sat"))
        },
    );

    // 10) the symbol tier; 11) the decimal comma.
    s = SYMBOLS.apply(&s);
    s = read_decimal_comma(&s);

    // 12) fractions.
    s = rewrite(&s, js_re!(r"(\d+)¾", "gu"), &js("$1 i tri četvrtine"));
    s = rewrite(&s, js_re!(r"(\d+)½", "gu"), &js("$1 i pol"));
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d/])(\d{1,3})\/(\d{1,3})(?![\d/])", "gu"),
        |mm, t| match ORD.ordinal_base(js_number(&mm.group(2, t).unwrap())) {
            None => mm.value(t),
            Some(ord) => number_to_words(js_number(&mm.group(1, t).unwrap()), None)
                .concat(&js(" "))
                .concat(&ord),
        },
    );

    // 13) signs.
    s = rewrite(
        &s,
        js_re!(r"(?<!\p{L}\p{M})(\p{Lu})&(\p{Lu})(?![^\p{L}\p{M}])", "gu"),
        &js("$1 i $2"),
    );
    s = rewrite(&s, js_re!(r"\s&\s", "gu"), &js(" i "));
    s = rewrite(&s, js_re!(r"(?<=\d)\s?[x×]\s?(?=\d)", "gu"), &js(" puta "));
    s = rewrite(&s, js_re!("±", "gu"), &js(" plus minus "));
    s = rewrite(&s, js_re!(r"(^|[\s(])\+\s?(\d)", "gu"), &js("$1plus $2"));
    s = rewrite(&s, js_re!(r"(?<=[A-Z])\+(\d)", "gu"), &js(" plus $1"));
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{Nd}])[−-](\d+)(?!\s*[-–—\d])", "gu"),
        &js("minus $1"),
    );
    s = rewrite(&s, js_re!(r"(\S)\s*=\s*(\S)", "gu"), &js("$1 jednako $2"));
    s = rewrite(&s, js_re!(r"(\d)\s*<\s*(\d)", "gu"), &js("$1 manje od $2"));
    s = rewrite(&s, js_re!(r"(\d)\s*>\s*(\d)", "gu"), &js("$1 veće od $2"));
    // 13b) the division sign.
    s = rewrite(
        &s,
        js_re!(r"(\S)\s*÷\s*(\S)", "gu"),
        &js("$1 podijeljeno s $2"),
    );

    normalize_serbian_initialisms(&s)
}

/// Croatian's step 7b (Bosnian's step 11): the year as a feminine-genitive ordinal, its period kept only at a
/// sentence end (the end of the utterance, or a capital after any closing punctuation and space).
pub(crate) fn elided_year(
    ord: &SlavicOrdinals,
    mm: &crate::core::js_regex::JsMatch,
    all: &JsString,
) -> JsString {
    let whole = mm.value(all);
    let Some(base) = ord.ordinal_base(js_number(&mm.group(1, all).unwrap())) else {
        return whole;
    };
    let Some(year) = ord.inflect(&base, Slot::Own("f.gen")) else {
        return whole;
    };
    let after = all.slice((mm.index() + whole.len()) as isize, None);
    let rest = js_re!(r#"^[\s)»"'\]]+"#, "u").replace(&after, &JsString::new());
    let sentence_end = rest.is_empty() || js_re!(r"^[\p{Lu}]", "u").test(&rest);
    if sentence_end {
        year.concat(&js("."))
    } else {
        year
    }
}
