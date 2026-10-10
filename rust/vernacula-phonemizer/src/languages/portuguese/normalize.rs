//! Portuguese (pt / pt-BR) text normalization: digit grouping, era markers, número, dotted abbreviations,
//! ordinal indicators, R$ and the dollar codes, degrees, clock, signs, fractions and the BP first-of-month,
//! plus the separately-run initialism pass. Ported from src/languages/portuguese/normalize.ts — see that file
//! for the corpus evidence and the reason for every rule's position in the order.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock};

use super::manifest::MANIFEST;
use super::numbers::{Dialect, NUMBER_TOKEN, number_to_words, split_number_token};
use super::roman_ordinals::portuguese_ordinal;
use crate::core::initialisms::{
    InitialismData, PhonotacticsData, make_initialism_normalizer, make_unreadable_test,
};
use crate::core::js_regex::{JsMatch, JsRegex};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{alternation, sorted_by_length_desc};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

const GROUP_SPACE: &str = " \u{a0}\u{202f}\u{2009}";

fn g(m: &JsMatch, i: usize, s: &JsString) -> JsString {
    m.group(i, s).expect("participating group")
}

fn degree_word(n: &JsString) -> &'static str {
    // `n` is a whole number token; a spoken decimal part takes the plural (`1,0 °C` is *graus*), and so does
    // a spoken dot (`1.5 °C`, #1490).
    let (int_digits, dotted, frac) = split_number_token(n);
    let d = &MANIFEST.degree;
    if frac.is_none() && dotted.is_empty() && js_number(&int_digits) == 1.0 {
        &d.singular
    } else {
        &d.plural
    }
}

struct Res {
    group_space: JsRegex,
    abbrev_continue: JsRegex,
    abbrev_end: JsRegex,
    dollar_codes: JsRegex,
    date_first: JsRegex,
    feminine_one: JsRegex,
}

static R: LazyLock<Res> = LazyLock::new(|| {
    let m = &*MANIFEST;
    // `Object.keys(t).sort((a, b) => b.length - a.length).join("|")`: unescaped, as the TS builds it.
    let alt = alternation(&sorted_by_length_desc(
        m.dotted_abbrev.keys().map(|k| js(k)),
    ));
    Res {
        group_space: JsRegex::new(
            &format!(r"(?<=\d)(?<!(?<![\d\.,])0)[{GROUP_SPACE}](?=\d{{3}}(?!\d))"),
            "gu",
        )
        .unwrap(),
        abbrev_continue: JsRegex::new(&format!(r"(?<![\p{{L}}\p{{M}}\d_])({alt})\.(\s+)(?=\p{{L}})"), "giu").unwrap(),
        abbrev_end: JsRegex::new(&format!(r"(?<![\p{{L}}\p{{M}}\d_])({alt})\.(?=\s*(?:[.,;:!?»)]|$))"), "giu").unwrap(),
        dollar_codes: JsRegex::new(
            &format!(
                "(?<![\\p{{L}}\\p{{M}}])(?:{})\\$(?=[ \u{a0}]?\\d)",
                m.dollar_codes.join("|")
            ),
            "gu",
        )
        .unwrap(),
        date_first: JsRegex::new(&format!(r"(?<![\p{{L}}\p{{M}}\d_])1\s+de\s+({})(?![\p{{L}}\p{{M}}\d_])", m.months.join("|")), "giu")
            .unwrap(),
        feminine_one: JsRegex::new(&format!("{}$", m.numbers.small[1]), "u").unwrap(),
    }
});

/// `isUnreadablePortuguese`: the OOV rule for core/initialisms.ts.
pub static IS_UNREADABLE_PORTUGUESE: LazyLock<Arc<dyn Fn(&JsString) -> bool + Send + Sync>> =
    LazyLock::new(|| {
        let p = &MANIFEST.phonotactics;
        Arc::new(make_unreadable_test(PhonotacticsData {
            vowels: JsRegex::new(&format!("[{}]", p.vowels), "u").unwrap(),
            legal_onsets: p.onsets.iter().map(|s| js(s)).collect(),
            legal_codas: p.codas.iter().map(|s| js(s)).collect(),
            liquids: None,
            digraphs: None,
        }))
    });

type Normalizer = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;

static INITIALISMS: LazyLock<Normalizer> = LazyLock::new(|| {
    let acronyms: HashSet<JsString> = MANIFEST.acronym_letters.iter().map(|s| js(s)).collect();
    let unreadable = IS_UNREADABLE_PORTUGUESE.clone();
    Box::new(make_initialism_normalizer(
        InitialismData {
            letter_name: Arc::new(|l: &JsString| {
                MANIFEST
                    .letter_names
                    .get(&l.to_string_lossy())
                    .map(|s| js(s))
            }),
            lower: None,
            acronym_letters: Arc::new(move |w: &JsString| acronyms.contains(w)),
            is_recorded: |_: &JsString| false,
            is_unreadable: Arc::new(move |w: &JsString| unreadable(w)),
        },
        true,
    ))
});

/// `normalizePortugueseInitialisms(text)`: no lexicon serves as the "is this recorded" test.
pub fn normalize_portuguese_initialisms(text: &JsString) -> JsString {
    INITIALISMS(text)
}

fn feminine_ordinal(masc: &JsString) -> JsString {
    let parts: Vec<JsString> = masc
        .split(&js(" "))
        .iter()
        .map(|w| js_re!("o$", "u").replace(w, &js("a")))
        .collect();
    JsString::join(&parts, &js(" "))
}

fn feminine_cardinal(n: f64, dialect: Dialect) -> JsString {
    R.feminine_one.replace(
        &number_to_words(n, dialect, None),
        &js(&MANIFEST.feminine_one),
    )
}

/// `String(den)` for an integer `den` (always 0 … 999 here).
fn int_string(n: f64) -> String {
    format!("{}", n as i64)
}

fn fraction_words(num: f64, den: f64, dialect: Dialect) -> Option<JsString> {
    if den < 2.0 || num < 1.0 {
        return None;
    }
    let base = match MANIFEST.fractions.denominators.get(&int_string(den)) {
        Some(b) => js(b),
        None => portuguese_ordinal(den)?,
    };
    let mut out = number_to_words(num, dialect, None);
    out.push_str(&js(" "));
    if num > 1.0 {
        // Every word of a compound ordinal takes the plural: décimos nonos.
        let words: Vec<JsString> = base
            .split(&js(" "))
            .iter()
            .map(|w| w.concat(&js("s")))
            .collect();
        out.push_str(&JsString::join(&words, &js(" ")));
    } else {
        out.push_str(&base);
    }
    Some(out)
}

fn clock_words(h: f64, min: Option<f64>, dialect: Dialect) -> JsString {
    let c = &MANIFEST.clock;
    let mut head = feminine_cardinal(h, dialect);
    head.push_str(&js(&format!(
        " {}",
        if h == 1.0 { &c.hour } else { &c.hours }
    )));
    match min {
        None => head,
        Some(m) if m == 0.0 => head,
        Some(m) => {
            head.push_str(&js(&format!(" {} ", c.connector)));
            head.push_str(&feminine_cardinal(m, dialect));
            head
        }
    }
}

/// `normalizePortuguese(input, brazilian)`.
pub fn normalize_portuguese(input: &JsString, brazilian: bool) -> JsString {
    let dialect = if brazilian { Dialect::Bp } else { Dialect::Ep };
    let m = &*MANIFEST;
    let sign = &m.sign_words;
    let deg = &m.degree;
    let mut s = input.clone();

    // 0) Digit grouping with a space (twice, as the TS does).
    s = rewrite(&s, &R.group_space, &JsString::new());
    s = rewrite(&s, &R.group_space, &JsString::new());
    s = rewrite(&s, js_re!(r"[ \u00a0\u202f\u2009]", "gu"), &js(" "));

    // 1) Era markers.
    s = rewrite(
        &s,
        // ⚠ `(?<![\p{L}\p{M}\d_])`, not JS's ASCII-only `\b` (`Grécia.` read *Grécompanhia*); see
        // normalize.ts WORD_START.
        js_re!(r"(?<![\p{L}\p{M}\d_])a\.\s?C\.", "giu"),
        &js(&m.era_markers.before_christ),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d_])d\.\s?C\.", "giu"),
        &js(&m.era_markers.after_christ),
    );

    // 2) Número, only before a digit.
    s = rewrite(
        &s,
        js_re!(r"(?<![\p{L}\p{M}\d_])(?:n\.º|nº|n°|no|núm\.)\s?(?=\d)", "giu"),
        &js(&format!("{} ", m.number_sign)),
    );

    // 3) Dotted abbreviations. ⚠ The miss branch is reachable (#1122): the `i`+`u` fold widens the
    //    alternation past the table's keys.
    s = rewrite_with(&s, &R.abbrev_continue, |mm, s| {
        let (ab, sp) = (g(mm, 1, s), g(mm, 2, s));
        match m.dotted_abbrev.get(&ab.to_lower_case().to_string_lossy()) {
            None => mm.value(s),
            Some(w) => js(w).concat(&sp),
        }
    });
    s = rewrite_with(&s, &R.abbrev_end, |mm, s| {
        let ab = g(mm, 1, s);
        match m.dotted_abbrev.get(&ab.to_lower_case().to_string_lossy()) {
            None => mm.value(s),
            Some(w) => js(&format!("{w}.")),
        }
    });

    // 4) Ordinal indicators. The digits are the tokenizer's whole NUMBER_TOKEN, classified by its own
    //    `split_number_token` (#1490): only a whole number has an ordinal. After a spoken dot or a decimal
    //    comma the indicator cannot be one and reads as its base letter's name (`802.11ª` reads as
    //    `802.11a`, `1.5º` as *um ponto cinco ó*; see normalize.ts step 4 for the measurement).
    s = rewrite_with(
        &s,
        js_re!(&format!(r"\b({NUMBER_TOKEN})\.?(º|ª)"), "gu"),
        |mm, s| {
            let (whole, digits) = (mm.value(s), g(mm, 1, s));
            let (int_digits, dotted, frac) = split_number_token(&digits);
            if !dotted.is_empty() || frac.is_some() {
                let letter = if g(mm, 2, s) == js("ª") { "a" } else { "o" };
                let mut out = digits;
                out.push_str(&js(&format!(" {}", MANIFEST.letter_names[letter])));
                return out;
            }
            let n = js_number(&int_digits);
            match portuguese_ordinal(n) {
                None => digits,
                Some(masc) => {
                    if js_re!("ª", "u").test(&whole) {
                        feminine_ordinal(&masc)
                    } else {
                        masc
                    }
                }
            }
        },
    );

    // 5) R$, and 5b) the dollar codes folded onto the bare sign.
    s = rewrite(
        &s,
        js_re!(r"R\$\s?(\d[\d.,]*)", "gu"),
        &js(&format!("$1 {}", m.real_word)),
    );
    s = rewrite(&s, &R.dollar_codes, &js("$"));

    // 6) Degrees.
    s = rewrite_with(
        &s,
        js_re!(
            &format!(r"({NUMBER_TOKEN})\s?°\s?C(?![\p{{L}}\p{{M}}])"),
            "giu"
        ),
        |mm, s| {
            let n = g(mm, 1, s);
            n.concat(&js(&format!(" {} {}", degree_word(&n), deg.celsius)))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            &format!(r"({NUMBER_TOKEN})\s?°\s?F(?![\p{{L}}\p{{M}}])"),
            "giu"
        ),
        |mm, s| {
            let n = g(mm, 1, s);
            n.concat(&js(&format!(" {} {}", degree_word(&n), deg.fahrenheit)))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(&format!(r"({NUMBER_TOKEN})\s?°"), "gu"),
        |mm, s| {
            let n = g(mm, 1, s);
            n.concat(&js(&format!(" {}", degree_word(&n))))
        },
    );

    // 7) Clock.
    s = rewrite_with(
        &s,
        js_re!(
            r"\b([01]?\d|2[0-3])\s?h\s?([0-5]\d)?(?![\p{L}\p{M}\d])",
            "gu"
        ),
        |mm, s| {
            clock_words(
                js_number(&g(mm, 1, s)),
                mm.group(2, s).map(|x| js_number(&x)),
                dialect,
            )
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"\b([01]?\d|2[0-3]):([0-5]\d)(?![\d:])", "gu"),
        |mm, s| {
            clock_words(
                js_number(&g(mm, 1, s)),
                Some(js_number(&g(mm, 2, s))),
                dialect,
            )
        },
    );

    // 8) Signs.
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
        js_re!(r"(\S)\+\s?(\d)", "gu"),
        &js(&format!("$1 {} $2", sign.plus)),
    );
    s = rewrite(
        &s,
        js_re!(r"(^|\s)\+\s?(\d)", "gu"),
        &js(&format!("$1{} $2", sign.plus)),
    );

    // 8b) Relational and division signs.
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

    // 9) Fractions.
    s = rewrite_with(
        &s,
        js_re!(r"\b(\d{1,3})\/(\d{1,3})\b(?!\s*[/\d])", "gu"),
        |mm, s| {
            fraction_words(js_number(&g(mm, 1, s)), js_number(&g(mm, 2, s)), dialect)
                .unwrap_or_else(|| mm.value(s))
        },
    );

    // 10) Dates: the BP first of the month.
    if brazilian {
        let first = &m.ordinals.units[1];
        s = rewrite_with(&s, &R.date_first, |mm, s| {
            js(&format!("{first} de ")).concat(&g(mm, 1, s))
        });
    }
    s
}

#[cfg(test)]
mod port_findings {
    use super::*;

    fn n(s: &str, br: bool) -> String {
        normalize_portuguese(&js(s), br).to_string_lossy()
    }

    #[test]
    fn clock_and_fractions_read_the_dialect_teens() {
        assert_eq!(
            n("Às 16h17 em ponto", true),
            "Às dezesseis horas e dezessete em ponto"
        );
        assert_eq!(n("Às 19:16", true), "Às dezenove horas e dezesseis");
        assert_eq!(n("Às 16h", true), "Às dezesseis horas");
        assert_eq!(n("Às 16h", false), "Às dezasseis horas");
        assert_eq!(
            n("Às 16h17 em ponto", false),
            "Às dezasseis horas e dezassete em ponto"
        );
        assert_eq!(
            n("Comeu 16/17 do bolo", true),
            "Comeu dezesseis décimos sétimos do bolo"
        );
    }

    #[test]
    fn plural_compound_ordinal_inflects_every_word() {
        assert_eq!(
            n("Comeu 17/19 do bolo", false),
            "Comeu dezassete décimos nonos do bolo"
        );
        assert_eq!(
            n("Comeu 2/21 do bolo", false),
            "Comeu dois vigésimos primeiros do bolo"
        );
        assert_eq!(
            n("Comeu 1/19 do bolo", false),
            "Comeu um décimo nono do bolo"
        );
    }

    #[test]
    fn degree_counts_dot_grouped_thousands() {
        assert_eq!(n("Mediu 1.000 °C", false), "Mediu 1.000 graus Celsius");
        assert_eq!(n("Mediu 1.000°", false), "Mediu 1.000 graus");
        assert_eq!(n("Mediu 1 °C", false), "Mediu 1 grau Celsius");
        assert_eq!(n("Mediu 1,5 °C", false), "Mediu 1,5 graus Celsius");
        assert_eq!(n("Mediu 0.5 °C", false), "Mediu 0.5 graus Celsius");
    }

    #[test]
    fn multi_group_count_is_whole_not_its_tail() {
        assert_eq!(n("Mediu 2.000.001°", false), "Mediu 2.000.001 graus");
        assert_eq!(
            n("Mediu 1.000.001 °C", false),
            "Mediu 1.000.001 graus Celsius"
        );
        assert_eq!(n("Mediu 1.001 °F", false), "Mediu 1.001 graus Fahrenheit");
        // `0.1` is *zero ponto um*, and a spoken dot is plural (#1490).
        assert_eq!(n("Mediu 0.1 °C", false), "Mediu 0.1 graus Celsius");
        assert_eq!(n("Mediu 1.5 °C", false), "Mediu 1.5 graus Celsius");
        assert_eq!(n("Mediu 21.1 °C", false), "Mediu 21.1 graus Celsius");
    }

    #[test]
    fn spoken_decimal_part_takes_the_plural() {
        assert_eq!(n("Mediu 1,0 °C", false), "Mediu 1,0 graus Celsius");
        assert_eq!(n("Mediu 1,000 °C", false), "Mediu 1,000 graus Celsius");
    }

    /// #1490: the ordinal indicator reads the tokenizer's whole token; only a whole number has an ordinal.
    #[test]
    fn ordinal_indicator_reads_the_whole_token() {
        assert_eq!(n("o 1.5º lugar", false), "o 1.5 ó lugar");
        assert_eq!(n("o 1,5º lugar", false), "o 1,5 ó lugar");
        assert_eq!(n("a 1.5ª vez", false), "a 1.5 a vez");
        assert_eq!(n("o 1.000º selo", false), "o milésimo selo");
        assert_eq!(n("o 2.500º selo", false), "o 2.500 selo");
    }

    /// #1490: a dot is a thousands separator only in the thousands shape; any other dot is spoken.
    #[test]
    fn non_grouping_dot_is_spoken() {
        let p = |s: &str, l: &str| crate::phonemize(s, l).unwrap();
        assert_eq!(p("O padrão 802.11n", "pt-BR"), "o padɾˈɐ̃w̃ ojtosˈẽtus e dˈojs pˈõtu ˈõzi n");
        assert_eq!(p("a 2.4 GHz", "pt-BR"), "a dˈojs pˈõtu kwˈatɾu ɡs");
        assert_eq!(p("a 5.0 GHz", "pt"), "a sˈĩku pˈõtu zˈɛɾu ɡʃ");
        assert_eq!(p("ver Figura 1.1.", "pt-BR"), "vˈeɾ fiɡˈuɾɐ ũ pˈõtu ũ .");
        assert_eq!(p("2.05", "pt"), "dˈojʃ pˈõtu zˈɛɾu sˈĩku");
        assert_eq!(p("1.0000", "pt"), "ũ pˈõtu zˈɛɾu zˈɛɾu zˈɛɾu zˈɛɾu");
        assert_eq!(p("0.500", "pt"), "zˈɛɾu pˈõtu sˈĩku zˈɛɾu zˈɛɾu");
        assert_eq!(p("17.000 ilhas", "pt-BR"), "dezesˈɛt͡ʃi mˈiw ˈiʎɐs");
        assert_eq!(p("5.000.000 visitantes", "pt-BR"), "sˈĩku miʎˈõj̃s vizitˈɐ̃t͡ʃis");
        assert_eq!(p("o 1.5º lugar", "pt"), "o ũ pˈõtu sˈĩku ˈɔ luɡˈaɾ");
        assert_eq!(p("o 802.11ª", "pt-BR"), p("o 802.11a", "pt-BR"));
        assert_eq!(p("o 802.11ª", "pt-BR"), "o ojtosˈẽtus e dˈojs pˈõtu ˈõzi a");
        assert_eq!(p("Mediu 1.5 °C", "pt-BR"), "med͡ʒˈiw ũ pˈõtu sˈĩku ɡɾˈaws sewsˈiws");
    }

    /// JS `\b` is ASCII-only: `Grécia.` matched `cia.` and read *Grécompanhia*. Synthetic sentences.
    #[test]
    fn abbreviations_use_a_unicode_word_edge() {
        assert_eq!(n("Visitou a Grécia.", false), "Visitou a Grécia.");
        assert_eq!(n("Visitou a Escócia.", false), "Visitou a Escócia.");
        assert_eq!(n("Ficou na Grécia. Depois", false), "Ficou na Grécia. Depois");
        assert_eq!(n("A Cia. Ltda. abriu", false), "A companhia limitada abriu");
        assert_eq!(n("Visitou a Grécia, etc.", false), "Visitou a Grécia, etcétera.");
        assert_eq!(n("Fundada em 300 a.C. por", false), "Fundada em 300 antes de Cristo por");
        assert_eq!(n("Em 1 de julho", true), "Em primeiro de julho");
    }
}
