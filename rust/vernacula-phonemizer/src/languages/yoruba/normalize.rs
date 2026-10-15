//! Yoruba text normalization: grouping, the range dash, the U+2212 minus, the percent circumfix, squared units and
//! `sq`, the shared symbol tier, the bare metre, scaled degrees, `×`, and the decimal point.
//! Ported from src/languages/yoruba/normalize.ts — see that file for the corpus evidence.

use std::sync::OnceLock;

use super::manifest::{MANIFEST, try_manifest};
use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, js};
use crate::core::normalize_symbols::{
    ExponentPosition, ExponentWords, PositionDecl, SymbolData, SymbolNormalizer,
    make_symbol_normalizer,
};
use crate::core::provenance::{Form, normalize, rewrite, rewrite_with};
use crate::js_re;

/// `SYMBOLS`: the shared tier, built from the manifest's `symbolTier` and two `symbols` words.
pub fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let m = try_manifest()?;
        let t = &m.symbol_tier;
        make_symbol_normalizer(&SymbolData {
            ampersand: Some(m.symbols.and.clone()),
            exponent_words: Some(ExponentWords {
                squared: Some(vec![m.symbols.squared.clone()]),
                cubed: None,
                position: Some(PositionDecl::All(ExponentPosition::After)),
            }),
            currency: Some(t.currency.clone()),
            units: Some(t.units.clone()),
            unit_per: Some(t.unit_per.clone()),
            rate_denominators: Some(t.rate_denominators.clone()),
            ..Default::default()
        })
    })
}

/// `fold(x)`: NFD, marks removed, lowercased.
fn fold(x: &JsString) -> JsString {
    js_re!(r"\p{M}+", "gu")
        .replace(&normalize(x, Form::Nfd), &JsString::new())
        .to_lower_case()
}

fn unit_word(u: &JsString) -> Option<&'static str> {
    match u.to_string_lossy().as_str() {
        "km" => Some("kìlómítà"),
        "ha" => Some("hẹ́kítà"),
        _ => None,
    }
}

fn sq_unit(u: &JsString) -> Option<&'static str> {
    match u.to_string_lossy().as_str() {
        "mi" => Some("máìlì"),
        "ft" => Some("ẹsẹ̀ bàtà"),
        _ => None,
    }
}

/// `normalizeYoruba(text)`.
pub fn normalize_yoruba(text: &JsString) -> JsString {
    let sym = &MANIFEST.symbols;
    let mut s = text.clone();
    s = rewrite(
        &s,
        js_re!(r"(?<=\d)(?<!(?<![\d\.,])0),(?=\d{3}(?!\d))", "gu"),
        &JsString::new(),
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*[-–—]\s*(?=\d)", "gu"),
        &js(&format!("$1 {} ", sym.range)),
    );
    s = rewrite(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\p{Nd}])(?<!\p{Nd}\s)\u2212(?=\p{Nd})",
            "gu"
        ),
        &js(&format!("{} ", sym.negative)),
    );
    let said_after = js_re!(r"ninu\s+[oọ]g[oọ]run", "u");
    let said_before = js_re!(r"(?:[iì]da|[iì]pin)\s*$", "u");
    s = rewrite_with(
        &s,
        js_re!(r"\(\s*(\d+(?:\.\d+)?)\s*%\s*\)", "gu"),
        |m, whole| {
            let at = m.index() as isize;
            if said_after.test(&fold(&whole.slice((at - 60).max(0), Some(at)))) {
                JsString::new()
            } else {
                m.value(whole)
            }
        },
    );
    s = rewrite_with(&s, js_re!(r"(\d+(?:\.\d+)?)\s*%", "gu"), |m, whole| {
        let num = m.group(1, whole).unwrap();
        let at = m.index() as isize;
        if said_after.test(&fold(&whole.slice(at, Some(at + 40))))
            || said_before.test(&fold(&whole.slice((at - 20).max(0), Some(at))))
        {
            num
        } else {
            js(&format!(
                "{} {} {}",
                sym.percent_before,
                num.to_string_lossy(),
                sym.percent_after
            ))
        }
    });
    s = rewrite_with(
        &s,
        js_re!(r"(?<![\p{L}\p{M}])(km|ha)\s*²", "gu"),
        |m, whole| {
            let u = m.group(1, whole).unwrap();
            let w = unit_word(&u).map_or(u, js);
            js(&format!("{} {}", w.to_string_lossy(), sym.squared))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}])sq\.?\s*(km|ha|mi|ft)(?![\p{L}\p{M}\d])",
            "giu"
        ),
        |m, whole| {
            let u = m.group(1, whole).unwrap();
            let l = u.to_lower_case();
            let w = unit_word(&l).or_else(|| sq_unit(&l)).map_or(u, js);
            js(&format!(" {} {}", w.to_string_lossy(), sym.squared))
        },
    );
    s = try_symbols().expect("checked by create_yoruba").apply(&s);
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{L}\p{M}\d.,])(?<!\p{Nd}h[ \u00a0])(\d+(?:\.\d+)?)[ \u00a0]?m(?![\p{L}\p{M}'’\d])",
            "gu"
        ),
        |m, whole| {
            let num = m.group(1, whole).unwrap();
            js(&format!("{} {}", num.to_string_lossy(), sym.metre))
        },
    );
    s = rewrite_with(
        &s,
        js_re!(r"(\d+(?:\.\d+)?)\s*°\s*([CFK])(?![\p{L}\p{M}])", "gui"),
        |m, whole| {
            let num = m.group(1, whole).unwrap();
            let letter = m.group(2, whole).unwrap();
            let scale = sym
                .scales
                .get(&letter.to_upper_case().to_string_lossy())
                .map_or(letter, |w| js(w));
            js(&format!("{} ", sym.degree))
                .concat(&num)
                .concat(&js(" "))
                .concat(&scale)
        },
    );
    s = rewrite(
        &s,
        js_re!(r"(\d)\s*×\s*(?=\d)", "gu"),
        &js(&format!("$1 {} ", sym.times)),
    );
    s = rewrite_with(&s, js_re!(r"(\d)\.(\d+)", "gu"), |m, whole| {
        let int = m.group(1, whole).unwrap();
        let frac = m.group(2, whole).unwrap();
        let digits = JsString::join(&frac.code_point_strings(), &js(" "));
        int.concat(&js(&format!(" {} ", sym.decimal_word)))
            .concat(&digits)
    });
    rewrite(&s, js_re!(r"[ \t]{2,}", "gu"), &js(" "))
}
