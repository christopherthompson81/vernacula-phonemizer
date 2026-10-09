//! Spanish (es) Roman-numeral policy: the masculine ordinal (1 … 1000) for a numeral BEFORE an event or
//! edition noun; centuries and regnal names keep the shared pass's cardinal.
//! Ported from src/languages/spanish/romanOrdinals.ts — see that file for the RAE sources.

use super::manifest::{MANIFEST, try_manifest};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::roman::RomanPolicy;

/// `spanishOrdinal(n)`: the masculine ordinal, 1 … 1000; `None` otherwise (`Number.isInteger` included).
pub(crate) fn spanish_ordinal(n: f64) -> Option<JsString> {
    let o = &MANIFEST.ordinals;
    if !(n.is_finite() && n.trunc() == n) || n < 1.0 || n > 1000.0 {
        return None;
    }
    if n == 1000.0 {
        return Some(js(&o.thousandth));
    }
    // `ORD.units[n]` etc.: an index past the table is `undefined` in the TS; none is reachable in 1 … 999.
    let at = |t: &Vec<String>, i: f64| t.get(i as usize).map(|w| js(w));
    if n < 10.0 {
        return at(&o.units, n);
    }
    if n < 20.0 {
        return at(&o.teens, n - 10.0);
    }
    if n < 100.0 {
        let (t, u) = ((n / 10.0).floor(), n % 10.0);
        return if u == 0.0 {
            at(&o.tens, t)
        } else {
            Some(js(&format!(
                "{} {}",
                o.tens[t as usize], o.units[u as usize]
            )))
        };
    }
    let (h, r) = ((n / 100.0).floor(), n % 100.0);
    if r == 0.0 {
        at(&o.hundreds, h)
    } else {
        // `${ORD.hundreds[h]} ${spanishOrdinal(r)}`: r is 1 … 99, always defined.
        Some(
            js(&o.hundreds[h as usize])
                .concat(&js(" "))
                .concat(&spanish_ordinal(r).unwrap()),
        )
    }
}

/// `ROMAN_POLICY` (registry.ts's `romanEs`). It declares no `exclude`, so `ROMAN_EXCLUSIONS` is not consulted.
pub fn roman_policy() -> RomanPolicy {
    RomanPolicy {
        exclude: Vec::new(),
        // ⚠ CHECKED HERE, not by the engine: `registry::pre_pass` reaches this without building the engine. With
        // no manifest the ordinal is declined and the cardinal stands, instead of the MANIFEST panic.
        ordinal: Some(Box::new(|n| try_manifest().ok().and_then(|_| spanish_ordinal(n as f64)))),
        ordinal_before: None,
        ordinal_after: Some(
            JsRegex::new(
                "^(aniversario|centenario|congreso|encuentro|festival|campeonato|certamen|concurso|premio|salón|simposio|coloquio|seminario|torneo|foro|ciclo|volumen|capítulo|tomo|canto|acto|artículo|batallón|regimiento|gobierno)$",
                "iu",
            )
            .unwrap(),
        ),
    }
}
