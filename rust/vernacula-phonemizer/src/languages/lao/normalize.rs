//! Lao (lo) text normalization: the soft hyphen and entity cleanup, era markers, thousands grouping by group size,
//! negatives, degrees, a spent percent sign, the shared symbol tier, and the decimal point.
//! Ported from src/languages/lao/normalize.ts — see that file for the corpus evidence.

use std::sync::OnceLock;

use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, js};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::provenance::{rewrite, rewrite_with};
use crate::js_re;

/// normalize.ts's `makeSymbolNormalizer({…})` literal, evaluated from the source and `JSON.stringify`'d.
const SYMBOL_DATA: &str = r#"{"percent":["ຮ້ອຍລະ"],"percentPrefix":true,"currency":{"US$":["ໂດລາສະຫະລັດ"],"$":["ໂດລາ"],"€":["ເອີໂຣ"],"£":["ປອນ"]},"magnitudes":["ພັນ","ລ້ານ","ຕື້"],"units":{"km":["ກິໂລແມັດ"],"m":["ແມັດ"],"cm":["ຊັງຕີແມັດ"],"kg":["ກິໂລກຼາມ"]},"exponentWords":{"squared":["ຕາລາງ"],"cubed":["ກ້ອນ"],"position":{"squared":"compound","cubed":"suffix"}},"ampersand":"ແລະ","unspacedScript":true}"#;

pub fn try_symbols() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
        make_symbol_normalizer(&data)
    })
}

/// `normalizeLao(input)`. The steps are order-dependent, as in the TS.
/// The step-1 class holds literal format characters in the TS; here they are `\u{…}` escapes of the same code
/// points (clippy's `invisible_characters` denies the literal form).
pub fn normalize_lao(input: &JsString) -> JsString {
    let mut s = input.clone();

    // 1) The soft hyphen goes, the zero width space stays; `&nbsp;` and `Us$`.
    s = rewrite(
        &rewrite(&s, js_re!(r"&nbsp;", "gu"), &js(" ")),
        js_re!("[\u{00AD}\u{200C}\u{FEFF}]", "gu"),
        &JsString::new(),
    );
    s = rewrite(&s, js_re!(r"(?<![\p{L}])Us\$", "gu"), &js("US$"));

    // 2) Era markers, then the double-space collapse.
    s = rewrite(
        &s,
        js_re!(r"(?<![຀-໿])ຄ\s?\.\s?ສ\s?\.?(?![຀-໿])", "gu"),
        &js("ຄຣິດສັກກະລາດ "),
    );
    s = rewrite(
        &s,
        js_re!(r"(?<![຀-໿])ພ\s?\.\s?ສ\s?\.?(?![຀-໿])", "gu"),
        &js("ພຸດທະສັກກະລາດ "),
    );
    s = rewrite(&s, js_re!(r"  +", "gu"), &js(" "));

    // 3) Thousands separators, by group size: `m.replaceAll(sep, "")`.
    // A grouped number ending in a decimal in the OTHER mark (`1,234.5`): groups joined, decimal left for step 7
    // (#1589). See normalize.ts step 3.
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{Nd}.,])([1-9]\p{Nd}{0,2}(?:([.,])\p{Nd}{3})+)(?!\2)([.,]\p{Nd}+)(?![\p{Nd}.,])",
            "gu"
        ),
        |m, t| {
            let sep = m.group(2, t).unwrap_or_default();
            let int = JsString::join(
                &m.group(1, t).unwrap_or_default().split(&sep),
                &JsString::new(),
            );
            int.concat(&m.group(3, t).unwrap_or_default())
        },
    );
    s = rewrite_with(
        &s,
        js_re!(
            r"(?<![\p{Nd}.,])([1-9]\p{Nd}{0,2}(?:([.,])\p{Nd}{3})+)(?![\p{Nd}.,])",
            "gu"
        ),
        |m, t| {
            let sep = m.group(2, t).unwrap_or_default();
            JsString::join(&m.value(t).split(&sep), &JsString::new())
        },
    );

    // 4) Negative numbers.
    s = rewrite(&s, js_re!(r"−(?=\p{Nd})", "gu"), &js("ລົບ "));
    s = rewrite(
        &s,
        js_re!(r"(?<!\p{Nd}\s?)(?<![{_])-(?=\p{Nd})", "gu"),
        &js("ລົບ "),
    );

    // 5) Degrees, scale letter on either side.
    s = rewrite(
        &s,
        js_re!(
            r"(\p{Nd}+(?:[.,]\p{Nd}+)?)\s*(?:°\s*[CF]|[cf]\s*°)(?![\p{L}])",
            "giu"
        ),
        &js("$1 ອົງສາ"),
    );
    s = rewrite(
        &s,
        js_re!(r"(\p{Nd}+(?:[.,]\p{Nd}+)?)\s*°", "gu"),
        &js("$1 ອົງສາ"),
    );

    // 5b) A percent word already in the text spends the sign.
    s = rewrite(
        &s,
        js_re!(r"(ເປີເຊັນ|ຮ້ອຍລະ)(\s*\p{Nd}[\p{Nd}.,]*)\s*%", "gu"),
        &js("$1$2"),
    );
    s = rewrite(
        &s,
        js_re!(r"(ເປີເຊັນ|ຮ້ອຍລະ)\s*%(?=\s?\p{Nd})", "gu"),
        &js("$1"),
    );

    // 6) The shared tier, above the decimal rewrite.
    s = try_symbols().expect("checked by create_lao").apply(&s);

    // 7) The decimal point, fractional digits one at a time.
    rewrite_with(
        &s,
        js_re!(r"(?<![\p{Nd}.,])(\p{Nd}+)[.,](\p{Nd}+)(?![\p{Nd}.,])", "gu"),
        |m, t| {
            let whole = m.group(1, t).unwrap_or_default();
            let frac = m.group(2, t).unwrap_or_default();
            whole
                .concat(&js(" ຈຸດ "))
                .concat(&JsString::join(&frac.code_point_strings(), &js(" ")))
        },
    )
}
