//! Macedonian cardinal and ordinal words: `и` before the final component, the feminine две before илјади, the
//! digit fallback from 10⁹; the masculine-indefinite ordinal ordinalizes only the last element.
//! Ported from src/languages/macedonian/numbers.ts — see that file for the sources.

use super::macedonian::DEF;

/// `numberToText(n, raw)`: "" for a negative or non-integer `n`; digit by digit over `raw ?? String(n)` from 10⁹.
pub fn number_to_text(n: f64, raw: Option<&str>) -> String {
    let num = &DEF.numbers;
    if n < 0.0 || !(n.is_finite() && n.fract() == 0.0) {
        return String::new();
    }
    if n < 10.0 {
        return num.units[n as usize].clone();
    }
    if n == 10.0 {
        return num.ten.clone();
    }
    if n < 20.0 {
        return num.teens[(n - 11.0) as usize].clone();
    }
    let and = &num.and_word;
    let connect = |r: f64, cond: bool| {
        let lead = if cond {
            format!("{and} ")
        } else {
            String::new()
        };
        format!("{lead}{}", number_to_text(r, None))
    };
    if n < 100.0 {
        let t = &num.tens[&(((n / 10.0).floor() * 10.0) as u64).to_string()];
        let u = (n % 10.0) as usize;
        return if u != 0 {
            format!("{t} {and} {}", num.units[u])
        } else {
            t.clone()
        };
    }
    if n < 1000.0 {
        let h = &num.hundreds[&((n / 100.0).floor() as u64).to_string()];
        let r = n % 100.0;
        if r == 0.0 {
            return h.clone();
        }
        return format!("{h} {}", connect(r, r < 20.0 || r % 10.0 == 0.0));
    }
    if n < 1_000_000.0 {
        let (th, r) = ((n / 1000.0).floor(), n % 1000.0);
        let th_count = number_to_text(th, None)
            .split(' ')
            .map(|x| if x == num.units[2] { "две" } else { x })
            .collect::<Vec<_>>()
            .join(" ");
        let th_word = if th == 1.0 {
            num.thousand.clone()
        } else {
            format!("{th_count} {}", num.thousands)
        };
        if r == 0.0 {
            return th_word;
        }
        return format!("{th_word} {}", connect(r, r < 100.0 || r % 100.0 == 0.0));
    }
    if n < 1_000_000_000.0 {
        let (mil, r) = ((n / 1e6).floor(), n % 1e6);
        let mil_word = if mil == 1.0 {
            num.million.clone()
        } else {
            format!("{} {}", number_to_text(mil, None), num.millions)
        };
        return if r != 0.0 {
            format!("{mil_word} {}", number_to_text(r, None))
        } else {
            mil_word
        };
    }
    // `[...(raw ?? String(n))].filter(c in "0".."9")`: a code point is a digit only if it is one ASCII digit.
    let digits = match raw {
        Some(r) => r.to_string(),
        None => crate::core::js_string::js_number_to_string(n),
    };
    digits
        .chars()
        .filter(|c| c.is_ascii_digit())
        .map(|d| num.units[d as usize - '0' as usize].clone())
        .collect::<Vec<_>>()
        .join(" ")
}

const ORD: [&str; 20] = [
    "",
    "први",
    "втори",
    "трети",
    "четврти",
    "петти",
    "шести",
    "седми",
    "осми",
    "деветти",
    "десетти",
    "единаесетти",
    "дванаесетти",
    "тринаесетти",
    "четиринаесетти",
    "петнаесетти",
    "шеснаесетти",
    "седумнаесетти",
    "осумнаесетти",
    "деветнаесетти",
];

/// `ORD_TENS[t]`, t a multiple of ten 20–90.
fn ord_tens(t: u64) -> &'static str {
    match t {
        20 => "дваесетти",
        30 => "триесетти",
        40 => "четириесетти",
        50 => "педесетти",
        60 => "шеесетти",
        70 => "седумдесетти",
        80 => "осумдесетти",
        _ => "деведесетти",
    }
}

/// `HUND_ORD[h]`, 1–9.
const HUND_ORD: [&str; 10] = [
    "",
    "стоти",
    "двестоти",
    "тристоти",
    "четиристоти",
    "петстоти",
    "шестоти",
    "седумстоти",
    "осумстоти",
    "деветстоти",
];

/// `mkOrdinal(n)`: the masculine-indefinite nominative ordinal, 1–9999, or `None`.
pub fn mk_ordinal(n: f64) -> Option<String> {
    if !(n.is_finite() && n.fract() == 0.0) || !(1.0..=9999.0).contains(&n) {
        return None;
    }
    let num = &DEF.numbers;
    let and = &num.and_word;
    let k = n as u64;
    if k < 20 {
        return Some(ORD[k as usize].to_string());
    }
    if k < 100 {
        let (t, u) = (k / 10 * 10, k % 10);
        return Some(if u != 0 {
            format!("{} {and} {}", num.tens[&t.to_string()], ORD[u as usize])
        } else {
            ord_tens(t).to_string()
        });
    }
    let lead = |cond: bool| {
        if cond {
            format!("{and} ")
        } else {
            String::new()
        }
    };
    if k < 1000 {
        let (h, r) = (k / 100, k % 100);
        if r == 0 {
            return Some(HUND_ORD[h as usize].to_string());
        }
        return Some(format!(
            "{} {}{}",
            num.hundreds[&h.to_string()],
            lead(r < 20 || r % 10 == 0),
            mk_ordinal(r as f64).unwrap()
        ));
    }
    let (th, r) = (k / 1000, k % 1000);
    if r == 0 {
        return Some(if th == 1 {
            "илјадити".to_string()
        } else {
            format!("{} илјадити", number_to_text(th as f64, None))
        });
    }
    let th_word = if th == 1 {
        num.thousand.clone()
    } else {
        format!("{} {}", number_to_text(th as f64, None), num.thousands)
    };
    Some(format!(
        "{th_word} {}{}",
        lead(r < 100 || r % 100 == 0),
        mk_ordinal(r as f64).unwrap()
    ))
}
