//! Portuguese masculine ordinals (1 … 1000) and the Roman-numeral policy: a prenominal ordinal before an
//! event/edition noun, the shared cardinal pass everywhere else. Ported from
//! src/languages/portuguese/romanOrdinals.ts — see that file for the sources behind the convention.

use super::manifest::MANIFEST;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::roman::RomanPolicy;

/// `portugueseOrdinal(n)`: `None` unless `n` is an integer in 1 … 1000.
pub fn portuguese_ordinal(n: f64) -> Option<JsString> {
    if !n.is_finite() || n.fract() != 0.0 || n < 1.0 || n > 1000.0 {
        return None;
    }
    let ord = &MANIFEST.ordinals;
    let n = n as usize;
    if n == 1000 {
        return Some(js(&ord.thousandth));
    }
    if n < 10 {
        return Some(js(&ord.units[n]));
    }
    if n < 100 {
        let (t, u) = (n / 10, n % 10);
        return Some(js(&if u == 0 {
            ord.tens[t].clone()
        } else {
            format!("{} {}", ord.tens[t], ord.units[u])
        }));
    }
    let (h, r) = (n / 100, n % 100);
    if r == 0 {
        return Some(js(&ord.hundreds[h]));
    }
    let rest = portuguese_ordinal(r as f64)?;
    Some(js(&format!("{} ", ord.hundreds[h])).concat(&rest))
}

/// `ROMAN_POLICY`.
pub fn roman_policy() -> RomanPolicy {
    RomanPolicy {
        exclude: Vec::new(),
        ordinal: Some(Box::new(|n| portuguese_ordinal(n as f64))),
        ordinal_before: None,
        ordinal_after: Some(
            JsRegex::new(
                r"^(aniversário|centenário|congresso|encontro|festival|campeonato|certame|concurso|prémio|premio|salão|simpósio|colóquio|seminário|torneio|fórum|ciclo|volume|capítulo|tomo|canto|ato|acto|artigo|batalhão|regimento|governo)$",
                "iu",
            )
            .unwrap(),
        ),
    }
}
