//! Thai phonemizer: the symbol tier, then normalize.ts, then a tokenizer over Thai runs, digit runs and clause
//! marks; Thai runs go through the segmenting g2p and digit runs through a Thai-word cardinal compositor.
//! Ported from src/languages/thai/thai.ts — see that file for the corpus evidence.

use std::sync::OnceLock;

use super::g2p::{phonemize_word, try_dict};
use super::manifest::try_manifest;
use super::normalize::{THAI_DIGIT_WORDS, normalize_thai};
use super::segment::try_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number, js_number_to_string};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

// Generated from the TS literal by .probe/th/gen_tables.mts.
const TH_MAG: [(f64, &str); 5] = [
    (1000000.0, "ล้าน"),
    (100000.0, "แสน"),
    (10000.0, "หมื่น"),
    (1000.0, "พัน"),
    (100.0, "ร้อย"),
];

/// `numberToThaiWords(n, raw)`: Thai-script words for a cardinal; an unsafe or negative `n` is spelled digit
/// by digit from `raw`.
pub fn number_to_thai_words(n: f64, raw: Option<&JsString>) -> Vec<&'static str> {
    if !is_safe_integer(n) || n < 0.0 {
        let digits = match raw {
            Some(r) => r.clone(),
            None => js(&js_number_to_string(n.abs())),
        };
        return digits
            .code_points()
            .filter(|c| (0x30..=0x39).contains(c))
            .map(|c| THAI_DIGIT_WORDS[(c - 0x30) as usize])
            .collect();
    }
    if n == 0.0 {
        return vec![THAI_DIGIT_WORDS[0]];
    }
    let mut out = Vec::new();
    let mut r = n;
    for (v, w) in TH_MAG {
        if r >= v {
            let q = (r / v).floor();
            out.extend(number_to_thai_words(q, None));
            out.push(w);
            r %= v;
        }
    }
    if r >= 10.0 {
        let t = (r / 10.0).floor();
        if t == 2.0 {
            out.push("ยี่สิบ");
        } else if t == 1.0 {
            out.push("สิบ");
        } else {
            out.push(THAI_DIGIT_WORDS[t as usize]);
            out.push("สิบ");
        }
        r %= 10.0;
    }
    // A final 1 in any compound >= 11 is เอ็ด, after a magnitude as well as after a ten (101, 1001).
    if r == 1.0 && n > 10.0 {
        out.push("เอ็ด");
    } else if r > 0.0 {
        out.push(THAI_DIGIT_WORDS[r as usize]);
    }
    out
}

/// `SYMBOLS`: the shared tier over the seven `symbolTier` fields thai.ts passes.
fn symbol_tier() -> Result<&'static SymbolNormalizer, String> {
    static S: OnceLock<SymbolNormalizer> = OnceLock::new();
    load_once(&S, || {
        let t = &try_manifest()?.symbol_tier;
        make_symbol_normalizer(&SymbolData {
            percent: Some(t.percent.clone()),
            currency: Some(t.currency.clone()),
            units: Some(t.units.clone()),
            exponent_words: Some(t.exponent_words.to_shared()),
            unspaced_script: Some(t.unspaced_script),
            ampersand: Some(t.ampersand.clone()),
            multiply: Some(t.multiply.clone()),
            ..Default::default()
        })
    })
}

pub struct ThaiPhonemizer {
    symbols: &'static SymbolNormalizer,
}

impl ThaiPhonemizer {
    /// `text(input)`.
    pub fn text(&self, input: &JsString) -> JsString {
        let clause_mark = &try_manifest()
            .expect("checked by create_thai")
            .clause_punctuation;
        let s = normalize_thai(&self.symbols.apply(input));
        assemble_clauses(
            &s,
            js_re!(r"([฀-๿]+)|(\d+)|([.!?…,;:])", "gu"),
            |m, s, sink| {
                if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                    sink.emit(&phonemize_word(&w));
                } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                    for wd in number_to_thai_words(js_number(&d), Some(&d)) {
                        sink.emit(&phonemize_word(&js(wd)));
                    }
                } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty())
                    && let Some(mk) = clause_mark.get(&p.to_string_lossy())
                {
                    sink.pause(&js(mk));
                }
            },
        )
    }
}

impl Engine for ThaiPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(ThaiPhonemizer::text(self, input))
    }
}

/// `createThai()`. Loads the manifest, the seg-words set and the dictionary up front, so a data error surfaces
/// here rather than mid-utterance.
pub fn create_thai() -> Result<ThaiPhonemizer, String> {
    try_manifest()?;
    try_words()?;
    try_dict()?;
    Ok(ThaiPhonemizer {
        symbols: symbol_tier()?,
    })
}

#[cfg(test)]
mod tests {
    use crate::phonemize;

    /// Relational, each checked against the TS engine: a rewrite reads exactly as the text it rewrites to.
    #[test]
    fn rewrites_read_as_their_expansions() {
        let th = |s: &str| phonemize(s, "th").unwrap();
        assert_eq!(th("ต่าง ๆ"), th("ต่าง ต่าง"));
        assert_eq!(th("สหรัฐฯ"), th("สหรัฐ"));
        assert_eq!(th("21"), th("ยี่สิบ เอ็ด"));
        // #1512: a final 1 after a magnitude is เอ็ด too (was หนึ่ง ร้อย หนึ่ง).
        assert_eq!(th("101"), th("หนึ่ง ร้อย เอ็ด"));
        assert_eq!(th("1001"), th("หนึ่ง พัน เอ็ด"));
        assert_eq!(th("111"), th("หนึ่ง ร้อย สิบ เอ็ด"));
        assert_eq!(th("1000000"), th("หนึ่ง ล้าน"));
        assert_eq!(th("1"), th("หนึ่ง"));
        assert_eq!(th("๒๑"), th("21"));
        assert_eq!(th("1,234"), th("1234"));
        // #1512: a unit after a decimal, the clock guard, the baht sign and °F.
        assert_eq!(th("ยาว 3.5 กม."), th("ยาว 3 จุด ห้า กิโลเมตร"));
        assert_eq!(th("2.5 กก."), th("2 จุด ห้า กิโลกรัม"));
        assert_eq!(th("123.45 น."), th("123 จุด สี่ ห้า น."));
        assert_eq!(th("2024 น."), th("2024 น."));
        assert_ne!(th("2024 น."), th("2024 นาฬิกา"));
        assert_eq!(th("09.30 น."), th("9 นาฬิกา 30 นาที"));
        assert_eq!(th("ราคา ฿100"), th("ราคา 100 บาท"));
        assert_eq!(th("10°F"), th("10 องศาฟาเรนไฮต์"));
        assert_eq!(
            th("9007199254740993"),
            th("เก้า ศูนย์ ศูนย์ เจ็ด หนึ่ง เก้า เก้า สอง ห้า สี่ เจ็ด สี่ ศูนย์ เก้า เก้า สาม")
        );
    }

    /// Every `rewrite` is on the pipeline string: no probe or golden line poisons the mapping (the TS
    /// `tools/provenance-poison.mts th` reports 0 sites as well).
    #[test]
    fn thai_rewrites_never_poison_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes =
            std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/th.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/th.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "th").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 250);
        assert_eq!(hits.get(), 0);
    }
}
