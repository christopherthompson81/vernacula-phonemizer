//! Romanian (ro) text normalization: digit grouping, decimals, clocks, percent, degrees, units, ranges,
//! currencies, signs and relational symbols rewritten into words before the tokenizer.
//! Ported from src/languages/romanian/normalize.ts — see that file for the corpus evidence and the ordering.

use std::sync::LazyLock;

use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::normalize_symbols::{esc, make_bare_unit_normalizer};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `UNITS`: each pattern's SOURCE, verbatim, and its word. The flags (`giu`) are not used by the TS: the digit
/// rule rebuilds each source with `gu`, and the bare pass reads only the key out of it.
const UNITS: [(&str, &str); 6] = [
    (r"\bkm\b", "kilometri"),
    (r"\bkg\b", "kilograme"),
    (r"\bcm\b", "centimetri"),
    (
        r"(?<!\d[.,]\d{1,4})(?<!802[.,]11[a-z]{0,3})\bmm\b",
        "milimetri",
    ),
    (r"(?<!\d[.,]\d{1,4})(?<!802[.,]11[a-z]{0,3})\bm\b", "metri"),
    (r"(?<!\d[.,]\d{1,4})(?<!802[.,]11[a-z]{0,3})\bg\b", "grame"),
];

type TextPass = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;

/// `BARE_UNITS`: the key is `/\\b([a-z]+)\\b$/u.exec(re.source)?.[1] ?? ""`, read out of each source.
static BARE_UNITS: LazyLock<TextPass> = LazyLock::new(|| {
    let readings: Vec<(JsString, JsString)> = UNITS
        .iter()
        .map(|(src, word)| {
            let src = js(src);
            let key = js_re!(r"\\b([a-z]+)\\b$", "u")
                .exec(&src)
                .and_then(|m| m.group(1, &src))
                .unwrap_or_default();
            (key, js(word))
        })
        .collect();
    Box::new(make_bare_unit_normalizer(readings))
});

/// The digit + unit rules: `(\d)\s*(?:<source with \b removed>)(?![\p{L}\d²³/])`, flags `gu`.
static UNIT_RULES: LazyLock<Vec<(JsRegex, JsString)>> = LazyLock::new(|| {
    UNITS
        .iter()
        .map(|(src, word)| {
            let bare = js_re!(r"\\b", "gu").replace(&js(src), &JsString::new());
            (
                JsRegex::new(
                    &format!(r"(\d)\s*(?:{})(?![\p{{L}}\d²³/])", bare.to_string_lossy()),
                    "gu",
                )
                .unwrap(),
                js(&format!("$1 {word}")),
            )
        })
        .collect()
});

/// `CURRENCY` in `Object.entries` order; `lei` is skipped by the loop (it starts with a letter).
const CURRENCY: [(&str, &str); 5] = [
    ("$", "dolari"),
    ("€", "euro"),
    ("£", "lire"),
    ("¥", "yeni"),
    ("lei", "lei"),
];

static CURRENCY_RULES: LazyLock<Vec<(JsRegex, JsRegex, JsString)>> = LazyLock::new(|| {
    CURRENCY
        .iter()
        .filter(|(sign, _)| js_re!(r"^[^\p{L}]", "u").test(&js(sign)))
        .map(|(sign, word)| {
            let e = esc(&js(sign)).to_string_lossy();
            (
                JsRegex::new(&format!(r"{e}\s*(\d+)"), "gu").unwrap(),
                JsRegex::new(&format!(r"(\d+)\s*{e}"), "gu").unwrap(),
                js(&format!("$1 {word}")),
            )
        })
        .collect()
});

/// `normalizeRomanian(input)`. Steps are ORDER-DEPENDENT; see the TS for each one's coupling.
pub fn normalize_romanian(input: &JsString) -> JsString {
    let mut t = input.clone();

    // 1) dot-grouped thousands, to a fixed point
    loop {
        let prev = t.clone();
        t = rewrite(
            &t,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)\.(?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
        if t == prev {
            break;
        }
    }
    // 2) space-grouped thousands (space, NBSP, NNBSP, thin space), to a fixed point
    loop {
        let prev = t.clone();
        t = rewrite(
            &t,
            js_re!(r"(?<=\d)(?<!(?<![\d\.,])0)[    ](?=\d{3}(?!\d))", "gu"),
            &JsString::new(),
        );
        if t == prev {
            break;
        }
    }

    // 3) decimal comma: the fraction digit by digit
    t = rewrite_with(&t, js_re!(r"(\d+),(\d+)", "gu"), |m, s| {
        let frac = m.group(2, s).unwrap().code_point_strings();
        m.group(1, s)
            .unwrap()
            .concat(&js(" virgulă "))
            .concat(&JsString::join(&frac, &js(" ")))
    });

    // 4) clock
    t = rewrite(&t, js_re!(r"(\d{1,2}):(\d{2})(?!\d)", "gu"), &js("$1 $2"));

    // 5) percent
    t = rewrite(&t, js_re!(r"(\d+)\s*%", "gu"), &js("$1 la sută"));

    // 6) degrees
    t = rewrite(
        &rewrite(&t, js_re!("℃", "gu"), &js("°C")),
        js_re!("℉", "gu"),
        &js("°F"),
    );
    t = rewrite(
        &t,
        js_re!(r"(\d)\s*°\s*C(?![\p{L}])", "giu"),
        &js("$1 grade Celsius"),
    );
    t = rewrite(
        &t,
        js_re!(r"(\d)\s*°\s*F(?![\p{L}])", "giu"),
        &js("$1 grade Fahrenheit"),
    );
    t = rewrite(&t, js_re!(r"(\d)\s*°", "gu"), &js("$1 grade"));

    // 7) squared / cubed units
    t = rewrite(&t, js_re!(r"\bkm\s*²", "giu"), &js("kilometri pătrați"));
    t = rewrite(&t, js_re!(r"\bm\s*²", "giu"), &js("metri pătrați"));
    t = rewrite(&t, js_re!(r"\bcm\s*²", "giu"), &js("centimetri pătrați"));
    t = rewrite(&t, js_re!(r"\bm\s*³", "giu"), &js("metri cubi"));

    // 8) rates
    t = rewrite(
        &t,
        js_re!(r"km\s*\/\s*(?:h|or[ăa])(?!\p{L})", "giu"),
        &js("kilometri pe oră"),
    );
    t = rewrite(
        &t,
        js_re!(r"(?<!\p{L})m\s*\/\s*s(?!\p{L})", "giu"),
        &js("metri pe secundă"),
    );

    // 9) a unit after a digit, then the bare vowel-less units
    for (re, word) in UNIT_RULES.iter() {
        t = rewrite(&t, re, word);
    }
    t = BARE_UNITS(&t);

    // 10) numeric ranges
    t = rewrite(
        &t,
        js_re!(
            r"(?<![-–—])(\d+)\s*[-–—]\s*(\d+)(?!\d)(?!\s*[-–—]\s*\d)",
            "gu"
        ),
        &js("$1 până la $2"),
    );

    // 11) currency signs, before and after the number
    for (before, after, word) in CURRENCY_RULES.iter() {
        t = rewrite(&t, before, word);
        t = rewrite(&t, after, word);
    }

    // 12) a sign glued to a number
    t = rewrite_with(&t, js_re!(r"(?<![\p{L}\d])([-−+])(\d+)", "gu"), |m, s| {
        let word = if m.group(1, s).unwrap() == "+" {
            "plus"
        } else {
            "minus"
        };
        js(word).concat(&js(" ")).concat(&m.group(2, s).unwrap())
    });

    // 13) plus between numbers, then the relational signs
    t = rewrite(&t, js_re!(r"(\d)\s*\+\s*(\d)", "gu"), &js("$1 plus $2"));
    t = rewrite(&t, js_re!("±", "gu"), &js(" plus minus "));
    t = rewrite(&t, js_re!("≈", "gu"), &js(" aproximativ egal cu "));
    t = rewrite(&t, js_re!("≤", "gu"), &js(" mai mic sau egal cu "));
    t = rewrite(&t, js_re!("≥", "gu"), &js(" mai mare sau egal cu "));
    t = rewrite(&t, js_re!("=", "gu"), &js(" egal cu "));
    t = rewrite(&t, js_re!("<", "gu"), &js(" mai mic decât "));
    t = rewrite(&t, js_re!(">", "gu"), &js(" mai mare decât "));
    t = rewrite(
        &t,
        js_re!(r"×|(?<=\p{Nd})[ \t]?x[ \t]?(?=\p{Nd})", "gu"),
        &js(" ori "),
    );
    t = rewrite(&t, js_re!("÷", "gu"), &js(" împărțit la "));

    // 14) ampersand
    t = rewrite(&t, js_re!(r"\s*[&＆]\s*", "gu"), &js(" și "));

    rewrite(&t, js_re!(r"[ \t]{2,}", "gu"), &js(" "))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::js_string::js;
    use crate::languages::romanian::roman_ordinals::{roman_policy, romanian_ordinal};

    // test/romanian.test.ts's pins, extracted from that file mechanically (each is a reading the TS suite asserts),
    // so the two engines are held to one list. `RO_PINS` are its `ro(s)` = `phonemize(s, "ro").trim()`.
    const WORD_PINS: &[(&str, &str)] = &[
        ("examen", "eˈɡzamen"),
        ("exact", "eˈɡzakt"),
        ("xilofon", "ksiloˈfon"),
        ("taxi", "ˈtaksʲ"),
        ("qatar", "kaˈtar"),
        ("quartz", "ˈkwartz"),
        ("și", "ˈʃi"),
        ("este", "ˈjeste"),
        ("zece", "ˈzet͡ʃe"),
        ("cinci", "ˈt͡ʃint͡ʃʲ"),
        ("geografie", "d͡ʒeoɡraˈfie"),
        ("gheață", "ˈɡe̯at͡sə"),
        ("ceai", "ˈt͡ʃe̯aj"),
        ("floare", "ˈflo̯are"),
        ("seară", "ˈse̯arə"),
        ("câine", "ˈkɨjne"),
        ("viață", "ˈvjat͡sə"),
        ("școală", "ˈʃko̯alə"),
        ("lupi", "ˈlupʲ"),
        ("pâine", "ˈpɨjne"),
    ];
    const RO_PINS: &[(&str, &str)] = &[
        ("1000", "ˈo ˈmie"),
        ("2000", "ˈdowə ˈmij"),
        ("5000", "ˈt͡ʃint͡ʃʲ ˈmij"),
        ("21000", "dowəˈzet͡ʃʲ ˈʃi ˈuna ˈde ˈmij"),
        ("100000", "ˈo ˈsutə ˈde ˈmij"),
        ("1000000", "ˈun miˈljon"),
        ("2000000", "ˈdowə miˈljo̯ane"),
        ("21000000", "dowəˈzet͡ʃʲ ˈʃi ˈunu ˈde miˈljo̯ane"),
        ("100", "ˈo ˈsutə"),
        ("200", "ˈdowə ˈsute"),
        ("1000000000", "ˈun miˈljard"),
        ("1", "ˈunu"),
        ("2", "ˈdoj"),
    ];
    const TEXT_PINS: &[(&str, &str)] = &[
        (
            "secolul al nouăsprezecelea",
            "sekoˈlul ˈal ˈnowəsprezet͡ʃele̯a",
        ),
        (
            "al cincizecilea aniversar",
            "ˈal t͡ʃint͡ʃizet͡ʃiˈle̯a aniveˈrsar",
        ),
        ("secolul 19", "sekoˈlul ˈnowəsprezet͡ʃe"),
    ];
    const NORMALIZE_PINS: &[(&str, &str)] = &[
        ("1.400", "1400"),
        ("1 400", "1400"),
        ("802.11n", "802.11n"),
        ("12,5", "12 virgulă 5"),
        ("22:00", "22 00"),
        ("20 °C", "20 grade Celsius"),
        ("25 %", "25 la sută"),
        ("km²", "kilometri pătrați"),
        ("160 km/h", "160 kilometri pe oră"),
        ("160 km/oră", "160 kilometri pe oră"),
        ("Este 1990. El a venit", "Este 1990. El a venit"),
        ("3. mai", "3. mai"),
        ("1990-1995", "1990 până la 1995"),
        ("$2500", "2500 dolari"),
        ("EX = dispărut", "EX egal cu dispărut"),
        ("A&B", "A și B"),
        ("Româna este o limbă.", "Româna este o limbă."),
    ];
    const ORDINAL_PINS: &[(&str, &str)] = &[
        ("19", "al nouăsprezecelea"),
        ("18", "al optsprezecelea"),
        ("2", "al doilea"),
        ("8", "al optulea"),
        ("28", "al douăzeci și optulea"),
        ("1", "întâi"),
        ("40", "al patruzecilea"),
        ("50", "al cincizecilea"),
        ("60", "al șaizecilea"),
        ("100", "al sutălea"),
    ];

    #[test]
    fn ts_word_and_text_pins() {
        super::super::romanian::create_romanian().unwrap();
        for (w, want) in WORD_PINS {
            assert_eq!(
                super::super::romanian::phonemize_word(&js(w)).to_string_lossy(),
                *want,
                "{w}"
            );
        }
        for (t, want) in RO_PINS {
            assert_eq!(crate::phonemize(t, "ro").unwrap().trim(), *want, "{t}");
        }
        for (t, want) in TEXT_PINS {
            assert_eq!(crate::phonemize(t, "ro").unwrap(), *want, "{t}");
        }
    }

    #[test]
    fn ts_normalize_and_roman_pins() {
        for (t, want) in NORMALIZE_PINS {
            assert_eq!(normalize_romanian(&js(t)).to_string_lossy(), *want, "{t}");
        }
        super::super::romanian::create_romanian().unwrap();
        for (n, want) in ORDINAL_PINS {
            assert_eq!(
                romanian_ordinal(n.parse().unwrap())
                    .unwrap()
                    .to_string_lossy(),
                *want,
                "{n}"
            );
        }
        let p = roman_policy();
        let before = p.ordinal_before.as_ref().unwrap();
        for w in ["secolul", "secolele", "secolelor", "carol"] {
            assert!(before.test(&js(w)), "{w}");
        }
        for w in ["al", "a", "în"] {
            assert!(!before.test(&js(w)), "{w}");
        }
        assert_eq!(p.exclude, vec![js("vii")]);
    }
}
