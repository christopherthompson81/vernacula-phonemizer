//! Standard Malay (zsm) text normalization: the pre-pass in front of the inherited Indonesian layer, claiming
//! only the shapes where Malay's orthographic conventions differ (comma thousands, dot decimals, clocks with a
//! marker, ranges, rates, percent, degrees, the Malay abbreviations).
//! Ported from src/languages/malay/normalize.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use crate::core::boundaries::{NOT_LETTER_AFTER, NOT_LETTER_BEFORE};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_js_space, js, js_number, js_number_to_string};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// `DOTTED_ABBREV`. Generated from normalize.ts's object literal (key order preserved).
const DOTTED_ABBREV: [(&str, &str); 3] = [("dr", "doktor"), ("no", "nombor"), ("en", "Encik")];

/// `RATE_WORD`. Generated from normalize.ts's object literal (key order preserved).
const RATE_WORD: [(&str, &str); 10] = [
    ("km/j", "kilometer sejam"),
    ("km/jam", "kilometer sejam"),
    ("batu/jam", "batu sejam"),
    ("km/s", "kilometer sesaat"),
    ("m/s", "meter sesaat"),
    ("m/saat", "meter sesaat"),
    ("Mbit/s", "megabit sesaat"),
    ("kbit/s", "kilobit sesaat"),
    ("bsj", "batu sejam"),
    ("kmj", "kilometer sejam"),
];

/// `FREQ_WORD`. Generated from normalize.ts's object literal (key order preserved).
const FREQ_WORD: [(&str, &str); 4] = [
    ("ghz", "gigahertz"),
    ("mhz", "megahertz"),
    ("khz", "kilohertz"),
    ("hz", "hertz"),
];

/// `COMPASS`. Generated from normalize.ts's object literal (key order preserved).
const COMPASS: [(&str, &str); 4] = [
    ("n", "utara"),
    ("s", "selatan"),
    ("e", "timur"),
    ("w", "barat"),
];

/// `CURRENCY_WORD`. Generated from normalize.ts's object literal (key order preserved).
const CURRENCY_WORD: [(&str, &str); 4] =
    [("$", "dolar"), ("€", "euro"), ("£", "pound"), ("¥", "yen")];

/// `CUBED`. Generated from normalize.ts's object literal (key order preserved).
const CUBED: [(&str, &str); 3] = [
    ("km", "kilometer"),
    ("cm", "sentimeter"),
    ("mm", "milimeter"),
];

/// `RANGE_NOUN`, joined with `|`.
const RANGE_NOUN: [&str; 34] = [
    "minit",
    "jam",
    "saat",
    "hari",
    "malam",
    "petang",
    "pagi",
    "bulan",
    "minggu",
    "tahun",
    "abad",
    "km",
    "kilometer",
    "meter",
    "sentimeter",
    "milimeter",
    "batu",
    "ela",
    "inci",
    "kaki",
    "kg",
    "kilogram",
    "juta",
    "bilion",
    "ribu",
    "peratus",
    "darjah",
    "kali",
    "orang",
    "ekor",
    "pm",
    "GMT",
    "UTC",
    "MDT",
];

fn lookup(table: &[(&str, &'static str)], key: &JsString) -> Option<&'static str> {
    table.iter().find(|(k, _)| js(k) == *key).map(|(_, v)| *v)
}

/// `Object.keys(table).sort((a, b) => b.length - a.length).join("|")` (a stable sort).
fn alt(table: &[(&str, &str)]) -> String {
    let mut keys: Vec<&str> = table.iter().map(|(k, _)| *k).collect();
    keys.sort_by_key(|k| std::cmp::Reverse(k.encode_utf16().count()));
    keys.join("|")
}

const MERIDIEM: &str = r"a\.m\.|p\.m\.|pm";
const MAGNITUDE: &str = "ribu|juta|bilion|billion|trilion";
const CLOCK_BODY: &str = r"([01]?\d|2[0-3])[.:]\s?([0-5]\d)(?![\d]|\.\d)";
const NUM: &str = r"\d+(?:\.\d+)?";

fn clock_before() -> String {
    format!(r"(?<={NOT_LETTER_BEFORE}(?:pukul|jam){NOT_LETTER_AFTER}[^.!?]{{0,24}})")
}

fn clock_after() -> String {
    format!(
        r"(?=[^.!?]{{0,12}}?(?:{MERIDIEM}|pg|pagi|petang|malam|GMT|UTC|MDT|waktu){NOT_LETTER_AFTER})"
    )
}

fn re(pattern: String, flags: &str) -> JsRegex {
    JsRegex::new(&pattern, flags).unwrap()
}

static CURRENCY_CODE_PREFIX: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(r"({NOT_LETTER_BEFORE}(?:US|AS|HK|NZ|CAD?))\$(?=\d)"),
        "gu",
    )
});
static SIGN_BEFORE_CODE: LazyLock<JsRegex> = LazyLock::new(|| {
    let amount = format!(r"\d[\d.]*(?:\s+(?:{MAGNITUDE}))?");
    re(
        format!(
            r"[$€£¥]\s?(?={amount}\s+(?:AUD|USD|MYR|SGD|EUR|GBP|JPY|NZD|CAD|HKD){NOT_LETTER_AFTER})"
        ),
        "gu",
    )
});
static SIGN_MAGNITUDE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(r"([$€£¥])\s?(\d[\d.]*)(\s+(?:{MAGNITUDE})){NOT_LETTER_AFTER}"),
        "gu",
    )
});
static ERA: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"(\d)(\s*)SM{NOT_LETTER_AFTER}"), "gu"));
static ABBREV_CONTINUES: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(
            r"{NOT_LETTER_BEFORE}({})\.(\s+)(?=\p{{L}})",
            alt(&DOTTED_ABBREV)
        ),
        "giu",
    )
});
static ABBREV_ENDS: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(
            r"{NOT_LETTER_BEFORE}({})\.(?=\s*(?:[.,;:!?)]|$))",
            alt(&DOTTED_ABBREV)
        ),
        "giu",
    )
});
static NO_DIGIT: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"{NOT_LETTER_BEFORE}no\.\s?(?=\d)"), "giu"));
static RATE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(r"(\d)\s?({}){NOT_LETTER_AFTER}", alt(&RATE_WORD)),
        "gu",
    )
});
static KM2_GLUED: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"(?<=\d)km[²2]{NOT_LETTER_AFTER}"), "gu"));
static KM2: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(r"{NOT_LETTER_BEFORE}km[²2]{NOT_LETTER_AFTER}"),
        "gu",
    )
});
static CUBE_GLUED: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(r"(?<=\d)\s?({})[³3]{NOT_LETTER_AFTER}", alt(&CUBED)),
        "gu",
    )
});
static CUBE: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(
            r"{NOT_LETTER_BEFORE}({})[³3]{NOT_LETTER_AFTER}",
            alt(&CUBED)
        ),
        "gu",
    )
});
static FREQ: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(r"(\d)\s?(GHz|Ghz|gHz|ghz|MHz|Mhz|mhz|kHz|khz|Hz){NOT_LETTER_AFTER}"),
        "gu",
    )
});
static CLOCK_MARKED: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(
            r"(?<![\d.:]){CLOCK_BODY}\s?({MERIDIEM})(?![\p{{L}}\p{{M}}])(?!\s*(?:pagi|petang|malam|tengah))"
        ),
        "gu",
    )
});
static CLOCK_AFTER_WORD: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"{}(?<![\d.:]){CLOCK_BODY}", clock_before()), "gu"));
static CLOCK_BEFORE_MARK: LazyLock<JsRegex> =
    LazyLock::new(|| re(format!(r"(?<![\d.:]){CLOCK_BODY}{}", clock_after()), "gu"));
static BARE_HOUR: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(
            r"(?<![\d.:])(\d{{1,2}})\s?({MERIDIEM})(?![\p{{L}}\p{{M}}])(?!\s*(?:pagi|petang|malam|tengah))"
        ),
        "gu",
    )
});
static PG: LazyLock<JsRegex> = LazyLock::new(|| {
    re(
        format!(r"(?<=\d[^.!?]{{0,20}}){NOT_LETTER_BEFORE}pg\.?{NOT_LETTER_AFTER}"),
        "gu",
    )
});
static RANGE: LazyLock<JsRegex> = LazyLock::new(|| {
    let nouns = RANGE_NOUN.join("|");
    re(
        format!(r"(?<![\d.])({NUM})\s?[-–]\s?({NUM})(?=\s*(?:{nouns}){NOT_LETTER_AFTER})"),
        "gu",
    )
});

/// `meridiemWord(hour, mark)`: the Malay part of the day.
fn meridiem_word(hour: f64, mark: &JsString) -> &'static str {
    let pm = mark.to_lower_case().starts_with(&js("p"));
    if hour == 12.0 {
        return if pm { "tengah hari" } else { "tengah malam" };
    }
    if !pm {
        return "pagi";
    }
    if (1.0..=6.0).contains(&hour) {
        "petang"
    } else {
        "malam"
    }
}

/// `` `${Number(x)}` ``.
fn num_str(x: &JsString) -> JsString {
    js(&js_number_to_string(js_number(x)))
}

/// `clock(h, min, mark)`.
fn clock(h: &JsString, min: &JsString, mark: Option<&JsString>) -> JsString {
    let mv = js_number(min);
    let time = if mv == 0.0 {
        num_str(h)
    } else {
        num_str(h)
            .concat(&js(" "))
            .concat(&js(&js_number_to_string(mv)))
    };
    match mark {
        None => time,
        Some(mk) => time
            .concat(&js(" "))
            .concat(&js(meridiem_word(js_number(h), mk))),
    }
}

/// `String.prototype.trimStart`.
fn trim_start(s: &JsString) -> JsString {
    let skip = s.units().iter().take_while(|&&u| is_js_space(u)).count();
    JsString::from_units(&s.units()[skip..])
}

/// `cube(_m, u)`: `` ` ${CUBED[u.toLowerCase()]!} padu` `` (the group is one of the table's own keys).
fn cube(u: &JsString) -> JsString {
    let w = lookup(&CUBED, &u.to_lower_case()).expect("a CUBED key");
    js(&format!(" {w} padu"))
}

/// `normalizeMalay(input)`. The numbered steps are order-dependent, as in the TS.
pub(crate) fn normalize_malay(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1) ampersand, including the HTML entity.
    s = rewrite(&s, js_re!(r"\s*(?:&amp;|&(?!\w+;))\s*", "gu"), &js(" dan "));

    // 2) comma thousands.
    s = rewrite_with(
        &s,
        js_re!(r"(?<!\d)([1-9]\d{0,2}(?:,\d{3})+)(?!\d)", "gu"),
        |m, t| js_re!(r",", "gu").replace(&m.value(t), &JsString::new()),
    );

    // 3) `US$30`, a magnitude between the amount and its currency, and a bare decimal amount.
    s = rewrite(&s, &CURRENCY_CODE_PREFIX, &js("$1 $"));
    s = rewrite(&s, &SIGN_BEFORE_CODE, &JsString::new());
    s = rewrite_with(&s, &SIGN_MAGNITUDE, |m, t| {
        let word = lookup(&CURRENCY_WORD, &m.group(1, t).unwrap()).expect("a CURRENCY_WORD key");
        m.group(2, t)
            .unwrap()
            .concat(&m.group(3, t).unwrap())
            .concat(&js(" "))
            .concat(&js(word))
    });
    s = rewrite(&s, js_re!(r"([$€£¥])\s?(\d+\.\d+)", "gu"), &js("$2 $1"));

    // 4) percent; a sign beside the word is deleted.
    s = rewrite(&s, js_re!(r"(\d)\s?%(?=\s*peratus)", "gu"), &js("$1"));
    s = rewrite(&s, js_re!(r"(\d)\s?%", "gu"), &js("$1 peratus"));

    // 5) era marker.
    s = rewrite(&s, &ERA, &js("$1$2sebelum Masihi"));

    // 6a) multi-dot initialisms; the last dot stays at a clause end.
    let undot = |ab: &JsString| js_re!(r"\.", "gu").replace(ab, &JsString::new());
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}.])((?:[A-Z]\.){2,})(?=\s+\p{L})", "gu"),
        |m, t| undot(&m.group(1, t).unwrap()),
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}.])((?:[A-Z]\.){2,})(?=\s*(?:[,;:!?)]|$))",
            "gu"
        ),
        |m, t| undot(&m.group(1, t).unwrap()).concat(&js(".")),
    );
    // 6b) the Malay abbreviations. ⚠ The miss branch is reachable (#1122): the match then stays as written.
    s = rewrite_with(&s, &ABBREV_CONTINUES, |m, t| {
        match lookup(&DOTTED_ABBREV, &m.group(1, t).unwrap().to_lower_case()) {
            None => m.value(t),
            Some(w) => js(w).concat(&m.group(2, t).unwrap()),
        }
    });
    s = rewrite_with(&s, &ABBREV_ENDS, |m, t| {
        match lookup(&DOTTED_ABBREV, &m.group(1, t).unwrap().to_lower_case()) {
            None => m.value(t),
            Some(w) => js(w).concat(&js(".")),
        }
    });
    // 6c) `No.` before a digit.
    s = rewrite(&s, &NO_DIGIT, &js("nombor "));

    // 7) rates (no `i`: the group is one of the table's own keys).
    s = rewrite_with(&s, &RATE, |m, t| {
        let w = lookup(&RATE_WORD, &m.group(2, t).unwrap()).expect("a RATE_WORD key");
        m.group(1, t).unwrap().concat(&js(" ")).concat(&js(w))
    });

    // 8) exponents: squared, then cubed over every unit.
    s = rewrite(&s, &KM2_GLUED, &js(" kilometer persegi"));
    s = rewrite(&s, &KM2, &js("kilometer persegi"));
    s = rewrite(&s, js_re!(r"(\d\s?)m²", "gu"), &js("$1meter persegi"));
    s = rewrite_with(&s, &CUBE_GLUED, |m, t| cube(&m.group(1, t).unwrap()));
    s = rewrite_with(&s, &CUBE, |m, t| trim_start(&cube(&m.group(1, t).unwrap())));
    s = rewrite(&s, js_re!(r"(\d\s?)m³", "gu"), &js("$1meter padu"));

    // 9) frequency, before the decimal rule.
    s = rewrite_with(&s, &FREQ, |m, t| {
        let w =
            lookup(&FREQ_WORD, &m.group(2, t).unwrap().to_lower_case()).expect("a FREQ_WORD key");
        m.group(1, t).unwrap().concat(&js(" ")).concat(&js(w))
    });

    // 10) degrees, `darjah`; the compass class has no `i`, so its lookup cannot miss.
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?C(?![\p{L}\p{M}])", "gui"),
        &js("$1 darjah Celsius"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s?°\s?F(?![\p{L}\p{M}])", "gui"),
        &js("$1 darjah Fahrenheit"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d)\s?°\s?([NSEWnsew])(?![\p{L}\p{M}])", "gu"),
        |m, t| {
            let w =
                lookup(&COMPASS, &m.group(2, t).unwrap().to_lower_case()).expect("a COMPASS key");
            m.group(1, t)
                .unwrap()
                .concat(&js(" darjah "))
                .concat(&js(w))
        },
    );
    s = rewrite(&s, js_re!(r"(\d)\s?°", "gu"), &js("$1 darjah"));

    // 11) the clock, with a marker, repeated to a fixed point (at most four passes).
    for _ in 0..4 {
        let before = s.clone();
        s = rewrite_with(&s, &CLOCK_MARKED, |m, t| {
            clock(
                &m.group(1, t).unwrap(),
                &m.group(2, t).unwrap(),
                Some(&m.group(3, t).unwrap()),
            )
        });
        s = rewrite_with(&s, &CLOCK_AFTER_WORD, |m, t| {
            clock(&m.group(1, t).unwrap(), &m.group(2, t).unwrap(), None)
        });
        s = rewrite_with(&s, &CLOCK_BEFORE_MARK, |m, t| {
            clock(&m.group(1, t).unwrap(), &m.group(2, t).unwrap(), None)
        });
        if s == before {
            break;
        }
    }

    // 12) a bare hour with a meridiem, and `pg` after a number.
    s = rewrite_with(&s, &BARE_HOUR, |m, t| {
        let h = m.group(1, t).unwrap();
        let w = meridiem_word(js_number(&h), &m.group(2, t).unwrap());
        h.concat(&js(" ")).concat(&js(w))
    });
    s = rewrite(&s, &PG, &js("pagi"));

    // 13) a colon pair that is not a clock.
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.:])([01]?\d|2[0-3]):00(?![\d.:])", "gu"),
        &js("$1"),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.:])(\d{1,4}):(\d{1,4})(?!\d)", "gu"),
        &js("$1 $2"),
    );

    // 13b) arithmetic and comparison signs.
    s = rewrite(&s, js_re!(r"(\d)\s*×\s*(?=\d)", "gu"), &js("$1 kali "));
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*<\s*(?=\d)", "gu"),
        &js("$1 kurang daripada "),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*>\s*(?=\d)", "gu"),
        &js("$1 lebih daripada "),
    );
    s = rewrite(
        &s,
        js_re!(r"(\S)\s*=\s*(?=\S)", "gu"),
        &js("$1 sama dengan "),
    );

    // 14) ranges with `hingga`.
    s = rewrite(&s, &RANGE, &js("$1 hingga $2"));
    s = rewrite(
        &s,
        js_re!(r"(?<!\d)([12]\d{3})\s?[-–]\s?([12]\d{3})(?!\d)", "gu"),
        &js("$1 hingga $2"),
    );

    // 15) decimals, last: a version dot is `titik`, a decimal `perpuluhan` read digit by digit.
    s = rewrite(
        &s,
        js_re!(r"(?<![\d.])(\d+)\.(\d+)([a-z])(?![\p{L}\p{M}])", "gu"),
        &js("$1 titik $2-$3"),
    );
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\d.])(\d+)\.(\d+)(?![\d])", "gu"),
        |m, t| {
            let (int, frac) = (m.group(1, t).unwrap(), m.group(2, t).unwrap());
            if int.len() <= 3 && frac == js("000") {
                m.value(t)
            } else {
                let digits = JsString::join(&frac.code_point_strings(), &js(" "));
                int.concat(&js(" perpuluhan ")).concat(&digits)
            }
        },
    );

    s
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::languages::malay::malay::create_malay;

    // test/malay.test.ts's literal pins, extracted from that file mechanically (.probe/pins.mjs evaluates each
    // string literal; no reading was typed by hand), so the two engines are held to one list.
    const NORMALIZEMALAY_1_PINS: &[(&str, &str)] = &[
        ("Dari 1,400 orang", "Dari 1400 orang"),
        ("5,000,000 pelawat", "5000000 pelawat"),
        ("hampir 3.7 juta", "hampir 3 perpuluhan 7 juta"),
        ("selebar 3.50 m", "selebar 3 perpuluhan 5 0 m"),
        ("9.000 orang", "9.000 orang"),
        ("nilai 3.141", "nilai 3 perpuluhan 1 4 1"),
        ("membentuk 3% dari", "membentuk 3 peratus dari"),
        ("80% peratus", "80 peratus"),
        ("pukul 8:46 pagi", "pukul 8 46 pagi"),
        ("Sekitar pukul 11:00,", "Sekitar pukul 11,"),
        ("antara pukul 06.30 dan 07.30", "antara pukul 6 30 dan 7 30"),
        ("pukul 1.15 a.m. hari", "pukul 1 15 pagi hari"),
        ("pada 11:35 pm.", "pada 11 35 malam."),
        ("pukul 12.00 p.m.", "pukul 12 tengah hari"),
        ("pukul 12.00 a.m.", "pukul 12 tengah malam"),
        ("pukul 3.30 p.m.", "pukul 3 30 petang"),
        ("satu mata, 21:20, yang", "satu mata, 21 20, yang"),
        ("dikatakan 3:2.", "dikatakan 3 2."),
        ("masa 4:41.30 minit", "masa 4 41 perpuluhan 3 0 minit"),
        ("selama 2-5 hari", "selama 2 hingga 5 hari"),
        ("(10-60 minit)", "(10 hingga 60 minit)"),
        (
            "sejak 1995-1996, apabila",
            "sejak 1995 hingga 1996, apabila",
        ),
        (
            "dari 4.2-3.9 juta tahun",
            "dari 4 perpuluhan 2 hingga 3 perpuluhan 9 juta tahun",
        ),
        ("Washington 5-3 semasa", "Washington 5-3 semasa"),
        ("mencapai 6-6.", "mencapai 6-6."),
        (
            "melebihi 160km/j tujuh",
            "melebihi 160 kilometer sejam tujuh",
        ),
        (
            "(sering 100-200 batu/jam)",
            "(sering 100 hingga 200 batu sejam)",
        ),
        ("40 bsj (64 kmj)", "40 batu sejam (64 kilometer sejam)"),
        (
            "meliputi 19,500km² dan",
            "meliputi 19500 kilometer persegi dan",
        ),
        ("2.2 juta km2.", "2 perpuluhan 2 juta kilometer persegi."),
        ("frekuensi 2.4Ghz", "frekuensi 2 perpuluhan 4 gigahertz"),
        ("suhu panas 90°F.", "suhu panas 90 darjah Fahrenheit."),
        ("timur 35°W.", "timur 35 darjah barat."),
        ("suhu 25°C dan 40°", "suhu 25 darjah Celsius dan 40 darjah"),
        ("Dr. Ehud Ur,", "doktor Ehud Ur,"),
        ("angkasawan No. 11", "angkasawan nombor 11"),
        ("Keputusan En. Rudd untuk", "Keputusan Encik Rudd untuk"),
        ("Presiden A.S. mengatakan", "Presiden AS mengatakan"),
        ("berpusat di A.S.", "berpusat di AS."),
        ("pada 323 SM.", "pada 323 sebelum Masihi."),
        ("Seni &amp; Sains", "Seni dan Sains"),
        ("yuran sebanyak US$30,", "yuran sebanyak US $30,"),
        ("harga €1.50 sekilo", "harga 1 perpuluhan 5 0 € sekilo"),
        (
            "kekayaan $2.3 bilion.",
            "kekayaan 2 perpuluhan 3 bilion dolar.",
        ),
        ("kadar $1.5 trilion", "kadar 1 perpuluhan 5 trilion dolar"),
        (
            "tambahan berjumlah $45 juta AUD.",
            "tambahan berjumlah 45 juta AUD.",
        ),
        ("(US $14.7 billion)", "(US 14 perpuluhan 7 billion dolar)"),
        ("kos $1000 setahun", "kos $1000 setahun"),
        ("juadah dsb. yang", "juadah dsb. yang"),
    ];
    const PHONEMIZE_2_PINS: &[(&str, &str, &str)] = &[
        (
            "Dari 1,400 orang",
            "zsm",
            "dˈari sərˈibu əmpˈat rˈatus ˈoraŋ",
        ),
        ("5,000,000 pelawat", "zsm", "lˈima d͡ʒˈuta pəlˈawat"),
        (
            "hampir 3.7 juta",
            "zsm",
            "hˈampir tˈiɡa pərpulˈuhan tˈud͡ʒuh d͡ʒˈuta",
        ),
        ("9.000 orang", "zsm", "səmbˈilan rˈibu ˈoraŋ"),
        (
            "membentuk 3% dari",
            "zsm",
            "məmbəntˈuʔ tˈiɡa pərˈatus dˈari",
        ),
        (
            "Tepat pada pukul 8:46 pagi",
            "zsm",
            "təpˈat pˈada pˈukul dəlˈapan əmpˈat pˈuluh ənˈam pˈaɡi",
        ),
        ("dikatakan 3:2.", "zsm", "dikatˈakan tˈiɡa dˈua ."),
        (
            "suhu panas 90°F.",
            "zsm",
            "sˈuhu pˈanas səmbˈilan pˈuluh dˈard͡ʒah fahrənhəˈit .",
        ),
        (
            "Presiden A.S. mengatakan",
            "zsm",
            "presˈidɛn aɛs məŋatˈakan",
        ),
        (
            "Pada skala mewah, B&B dengan",
            "zsm",
            "pˈada skˈala mewˈah , b dˈan b dəŋˈan",
        ),
        (
            "harga €1.50 sekilo",
            "zsm",
            "hˈarɡa sˈatu pərpulˈuhan lˈima nˈol əˈuro səkˈilo",
        ),
        (
            "kekayaan $2.3 bilion.",
            "zsm",
            "kəkajˈaan dˈua pərpulˈuhan tˈiɡa bilˈion dˈolar .",
        ),
        (
            "berjumlah £ 27 juta.",
            "zsm",
            "bərd͡ʒˈumlah dˈua pˈuluh tˈud͡ʒuh d͡ʒˈuta pˈound .",
        ),
        ("kos $1000 setahun", "zsm", "kˈos sərˈibu dˈolar sətˈahun"),
        ("juadah dsb. yang", "zsm", "d͡ʒuˈadah dˈan səbaɡaˈiɲa jˈaŋ"),
        (
            "tempat ke-190 dalam",
            "zsm",
            "təmpˈat kˈə sərˈatus səmbˈilan pˈuluh dˈalam",
        ),
        (
            "pada 21 Mac 2010",
            "zsm",
            "pˈada dˈua pˈuluh sˈatu mˈat͡ʃ dˈua rˈibu səpˈuluh",
        ),
        ("denda $1000 setiap", "zsm", "dəndˈa sərˈibu dˈolar sətˈiap"),
        (
            "sebanyak 9.000 orang",
            "id",
            "səbˈaɲaʔ səmbˈilan rˈibu ˈoraŋ",
        ),
        (
            "sekitar 1,5 juta",
            "id",
            "səkˈitar sˈatu kˈoma lˈima d͡ʒˈuta",
        ),
        ("membentuk 3% dari", "id", "məmbəntˈuʔ tˈiɡa pərsˈɛn dˈari"),
        (
            "pukul 11.30 pagi",
            "id",
            "pˈukul səbəlˈas lewˈat tˈiɡa pˈuluh pˈaɡi",
        ),
        ("Dr. Damadian", "id", "dˈoʔtər damadˈian"),
        ("isi padu air", "zsm", "ˈisi pˈadu ˈair"),
    ];
    const CONTAINS_PINS: &[(&str, &str, &str)] = &[
        ("120 m³", "zsm", "mɛtˈər pˈadu"),
        ("120 m³", "id", "mɛtˈər"),
        ("5 km³", "zsm", "kilomətˈər pˈadu"),
        ("5 km3", "zsm", "kilomətˈər pˈadu"),
        ("3136 mm3", "zsm", "milimətˈər pˈadu"),
        ("M3 lebuhraya", "zsm", "m tˈiɡa"),
        ("BMW M3", "zsm", "m tˈiɡa"),
    ];
    const NOTCONTAINS_PINS: &[(&str, &str, &str)] =
        &[("120 m³", "id", "pˈadu"), ("1 M3", "zsm", "pˈadu")];

    #[test]
    fn the_ts_suite_pins_hold() {
        create_malay(None).unwrap();
        let say = |t: &str, l: &str| crate::phonemize(t, l).unwrap();
        for (t, want) in NORMALIZEMALAY_1_PINS {
            assert_eq!(normalize_malay(&js(t)).to_string_lossy(), *want, "{t}");
        }
        for (t, l, want) in PHONEMIZE_2_PINS {
            assert_eq!(say(t, l), *want, "{t}");
        }
        for (t, l, part) in CONTAINS_PINS {
            assert!(say(t, l).contains(part), "{t}");
        }
        for (t, l, part) in NOTCONTAINS_PINS {
            assert!(!say(t, l).contains(part), "{t}");
        }
    }

    // test/malay-alias.test.ts, through the registry's `getPhonemizer(…).text` (no Roman or fold pass, as there):
    // `zsm` routes to the Indonesian phonology, and `ms` is the same engine as `zsm`. Its literals via pins.mjs.
    #[test]
    fn the_alias_suite_holds() {
        let text = |l: &str, t: &str| crate::registry::phonemize_in(l, &js(t)).unwrap();
        for w in ["Malaysia", "bahasa", "selamat", "makan", "terima", "kasih"] {
            assert_eq!(text("zsm", w), text("id", w), "{w}");
        }
        assert_eq!(text("zsm", "selamat").to_string_lossy(), "səlˈamat");
        assert_eq!(text("ms", "selamat"), text("zsm", "selamat"));
        assert!(
            text("ms", "120 m³")
                .trim()
                .to_string_lossy()
                .contains("mɛtˈər pˈadu")
        );
    }
}
