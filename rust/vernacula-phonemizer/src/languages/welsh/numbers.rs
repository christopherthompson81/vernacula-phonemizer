//! Welsh cardinal numbers in the modern decimal system (un deg un, dau ddeg pump), with the soft/aspirate mutations
//! after dau/tri/chwe and the feminine counting forms before `mil`.
//! Ported from src/languages/welsh/numbers.ts — see that file for the sources.

use super::manifest::MANIFEST;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number_to_string};

fn one(i: usize) -> &'static str {
    &MANIFEST.numbers.ones[i]
}

fn clip(w: &str) -> &str {
    match w {
        "pump" => "pum",
        "chwech" => "chwe",
        _ => w,
    }
}

fn fem(w: &str) -> Option<&'static str> {
    match w {
        "dau" => Some("dwy"),
        "tri" => Some("tair"),
        "pedwar" => Some("pedair"),
        _ => None,
    }
}

fn soft(w: &str) -> &str {
    match w {
        "deg" => "ddeg",
        "cant" => "gant",
        "mil" => "fil",
        _ => w,
    }
}

fn aspirate(w: &str) -> &str {
    if w == "cant" { "chant" } else { w }
}

/// `counted(u, noun)`: the clipped unit and the mutated noun, honouring `mil`'s gender.
fn counted(u: usize, noun: &str) -> String {
    let mut w = clip(one(u));
    if noun == "mil"
        && let Some(f) = fem(w)
    {
        w = f;
    }
    if w == "dau" || w == "dwy" {
        return format!("{w} {}", soft(noun));
    }
    if w == "tri" || w == "tair" || w == "chwe" {
        return format!("{w} {}", aspirate(noun));
    }
    format!("{w} {noun}")
}

fn below100(n: usize) -> String {
    if n <= 10 {
        return one(n).to_string();
    }
    let (t, u) = (n / 10, n % 10);
    let tens = if t == 1 {
        "un deg".to_string()
    } else {
        counted(t, "deg")
    };
    if u == 0 {
        tens
    } else {
        format!("{tens} {}", one(u))
    }
}

fn below1000(n: usize) -> String {
    if n < 100 {
        return below100(n);
    }
    let (h, r) = (n / 100, n % 100);
    let head = if h == 1 {
        "cant".to_string()
    } else {
        counted(h, "cant")
    };
    if r == 0 {
        head
    } else {
        format!("{head} {}", below100(r))
    }
}

/// `numberToWords(n, raw?)`. Out of range or unsafe: the ASCII digits of each CODE POINT of `raw` (else
/// `String(Math.abs(n))`) by their digit words, everything else dropped.
pub fn number_to_words(n: f64, raw: Option<&JsString>) -> JsString {
    if !is_safe_integer(n) || n < 0.0 || n >= 1e9 {
        let digits = raw
            .cloned()
            .unwrap_or_else(|| js(&js_number_to_string(n.abs())));
        let words: Vec<JsString> = digits
            .code_point_strings()
            .into_iter()
            .filter(|c| c.len() == 1 && (u16::from(b'0')..=u16::from(b'9')).contains(&c.0[0]))
            .map(|d| js(one((d.0[0] - u16::from(b'0')) as usize)))
            .collect();
        return JsString::join(&words, &js(" "));
    }
    let n = n as usize;
    if n == 0 {
        return js(one(0));
    }
    if n < 1000 {
        return js(&below1000(n));
    }
    if n < 1_000_000 {
        let (th, r) = (n / 1000, n % 1000);
        let head = if th == 1 {
            "mil".to_string()
        } else if th <= 9 {
            counted(th, "mil")
        } else {
            format!("{} mil", below1000(th))
        };
        return js(&if r == 0 {
            head
        } else {
            format!("{head} {}", below1000(r))
        });
    }
    let (m, r) = (n / 1_000_000, n % 1_000_000);
    let head = if m == 1 {
        "miliwn".to_string()
    } else {
        format!("{} miliwn", below1000(m))
    };
    if r == 0 {
        js(&head)
    } else {
        js(&head)
            .concat(&js(" "))
            .concat(&number_to_words(r as f64, None))
    }
}
