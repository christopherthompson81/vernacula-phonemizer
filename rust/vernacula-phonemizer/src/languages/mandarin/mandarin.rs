//! Mandarin Chinese (cmn): Hanzi → pinyin (phrase + char dicts) → IPA with Chao tones and sandhi, or tone-digit
//! pinyin directly; numbers, normalization and the symbol tier ahead of a hand-rolled code-point scanner that
//! reports its own trace tokens. Ported from src/languages/mandarin/mandarin.ts — see that file for the corpus
//! evidence.

use std::collections::HashMap;

use super::manifest::{DIR, MANIFEST, try_manifest};
use super::normalize::{normalize_mandarin, spell_initialisms};
use super::numbers::{digits_to_chinese, integer_to_chinese};
use super::pinyin_to_ipa::{MandarinTables, PinyinToIpa, ThirdToneSandhi};
use super::segment::{PinyinTables, segment};
use super::yi_bu_sandhi::apply_yi_bu_sandhi;
use crate::core::clauses::ClauseSink;
use crate::core::foreign::{ForeignPhonemizer, read_foreign_run};
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::load_tsv::{TsvOptions, load_tsv_map, load_tsv_strings};
use crate::core::provenance::{Piece, rebuilt, tracing};
use crate::core::trace::{begin_token, end_token, enter_engine};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

fn is_han(s: &JsString) -> bool {
    js_re!(r"\p{Script=Han}", "u").test(s)
}
fn is_latin(s: &JsString) -> bool {
    js_re!(r"\p{Script=Latin}", "u").test(s)
}
fn is_latin_run(s: &JsString) -> bool {
    js_re!(r"[\p{Script=Latin}\p{M}]", "u").test(s)
}
fn is_foreign_char(s: &JsString) -> bool {
    js_re!(r"[\p{L}\p{M}]", "u").test(s)
}

pub struct MandarinPhonemizer {
    /// The shared symbol tier over `MANIFEST.symbolTier` (百分之 precedes the number; units follow).
    symbols: SymbolNormalizer,
    pinyin_to_ipa: PinyinToIpa,
    pinyin: PinyinTables,
    foreign: Option<ForeignPhonemizer>,
}

fn join(parts: &[JsString]) -> JsString {
    let mut out = JsString::new();
    for p in parts {
        out.push_str(p);
    }
    out
}

/// `Number.isSafeInteger(n)`.
fn is_safe_integer(n: f64) -> bool {
    n.is_finite() && n.fract() == 0.0 && n.abs() <= 9_007_199_254_740_991.0
}

impl MandarinPhonemizer {
    /// A Han run: segment → 一/不 sandhi → pinyin → IPA.
    fn han_run(&self, chars: &[JsString], exempt: &[bool]) -> JsString {
        let mut tokens = segment(chars, &self.pinyin, exempt);
        apply_yi_bu_sandhi(&mut tokens);
        let py: Vec<JsString> = tokens.into_iter().map(|t| t.py).collect();
        self.pinyin_to_ipa.convert(&JsString::join(&py, &js(" ")))
    }

    fn append_number(cp: &mut Vec<JsString>, exempt: &mut Vec<bool>, num: &JsString, after: Option<&JsString>) {
        let mut push = |text: &JsString, ex: bool| {
            for c in text.code_point_strings() {
                cp.push(c);
                exempt.push(ex);
            }
        };
        let m = &*MANIFEST;
        if js_re!(r"^\d{4}$").test(num) && after.is_some_and(|a| *a == "年") {
            push(&digits_to_chinese(num), true);
            return;
        }
        if *num == "2" && after.is_some_and(|a| js(&m.measure_words).includes(a)) {
            push(&js(&m.numbers.two), false);
            return;
        }
        let num = js_re!(",", "gu").replace(num, &JsString::new());
        let dot = num.index_of(&js("."), 0);
        let int_str = match dot {
            None => num.clone(),
            Some(d) => JsString::from_units(&num.0[..d]),
        };
        let int_n = js_number(&if int_str.is_empty() { js("0") } else { int_str.clone() });
        if is_safe_integer(int_n) {
            push(&integer_to_chinese(int_n), false);
        } else {
            push(&digits_to_chinese(&int_str), true);
        }
        if let Some(d) = dot {
            if d < num.len() - 1 {
                push(&js(&m.numbers.decimal_point), true);
                push(&digits_to_chinese(&JsString::from_units(&num.0[d + 1..])), true);
            }
        }
    }

    /// Arabic numbers → Chinese numeral characters, as code points with their sandhi-exempt mask; `pieces` only
    /// while a trace is recording.
    fn substitute_numbers(&self, input: &JsString) -> (Vec<JsString>, Vec<bool>, Vec<Piece>) {
        let mut cp: Vec<JsString> = Vec::new();
        let mut exempt: Vec<bool> = Vec::new();
        let rec = tracing();
        let mut pieces: Vec<Piece> = Vec::new();
        let copy = |from: usize, to: usize, cp: &mut Vec<JsString>, exempt: &mut Vec<bool>, pieces: &mut Vec<Piece>| {
            let mut at = from;
            for c in JsString::from_units(&input.0[from..to]).code_point_strings() {
                let n = c.len();
                if rec {
                    pieces.push((c.clone(), at, at + n));
                }
                cp.push(c);
                exempt.push(false);
                at += n;
            }
        };
        let mut last = 0;
        for m in js_re!(r"[1-9]\d{0,2}(?:,\d{3})+|\d+(?:\.\d+)?", "g").match_all(input) {
            if m.index() > last {
                copy(last, m.index(), &mut cp, &mut exempt, &mut pieces);
            }
            let rest = JsString::from_units(&input.0[m.end()..]);
            let after = js_re!(r"^\s*(\S)", "u").exec(&rest).and_then(|a| a.group(1, &rest));
            let before = cp.len();
            Self::append_number(&mut cp, &mut exempt, &m.value(input), after.as_ref());
            if rec {
                pieces.push((join(&cp[before..]), m.index(), m.end()));
            }
            last = m.end();
        }
        if last < input.len() {
            copy(last, input.len(), &mut cp, &mut exempt, &mut pieces);
        }
        (cp, exempt, pieces)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let input = spell_initialisms(&self.symbols.apply(&normalize_mandarin(input)));
        if !is_han(&input)
            && js_re!(r"[1-5]").test(&input)
            && js_re!(r"^[a-zü:]+[1-5]?(?:\s+[a-zü:]+[1-5]?)*$", "u").test(&input)
        {
            return self.pinyin_to_ipa.convert(&input);
        }
        let (cp, exempt, pieces) = self.substitute_numbers(&input);
        let mut sink = ClauseSink::new();
        // ⚠ Keyed on the pieces, not on a second `tracing()` call, as the TS.
        let trace_text = if !pieces.is_empty() { rebuilt(&input, &pieces) } else { join(&cp) };
        // Code-point index → UTF-16 offset into `normalized`.
        let mut off: Vec<usize> = vec![0];
        for c in &cp {
            off.push(off[off.len() - 1] + c.len());
        }
        enter_engine(&trace_text);
        let space = js(" ");
        let foreign_letter = |c: &JsString| is_foreign_char(c) && !is_han(c) && !is_latin(c);
        let mut i = 0;
        while i < cp.len() {
            let ch = &cp[i];
            if is_han(ch) {
                let mut j = i;
                while j < cp.len() && is_han(&cp[j]) {
                    j += 1;
                }
                begin_token((off[i], off[j]), &join(&cp[i..j]));
                sink.emit(&self.han_run(&cp[i..j], &exempt[i..j]));
                end_token();
                i = j;
            } else if is_latin(ch) {
                let mut j = i;
                while j < cp.len() && is_latin_run(&cp[j]) {
                    j += 1;
                }
                let run = join(&cp[i..j]);
                begin_token((off[i], off[j]), &run);
                sink.emit(&self.foreign.as_ref().map_or_else(JsString::new, |f| f(&run)));
                end_token();
                i = j;
            } else if is_foreign_char(ch) {
                // ⚠ The run spans a SINGLE interior space between two foreign letters (the TS's iteration-mark note).
                let mut j = i;
                while j < cp.len() {
                    if foreign_letter(&cp[j]) {
                        j += 1;
                        continue;
                    }
                    if cp[j] == space && cp.get(j + 1).is_some_and(|n| foreign_letter(n)) {
                        j += 2;
                        continue;
                    }
                    break;
                }
                let run = join(&cp[i..j]);
                begin_token((off[i], off[j]), &run);
                if let Some(routed) = read_foreign_run(&run) {
                    if !routed.is_empty() {
                        sink.emit(&routed);
                    }
                }
                end_token();
                i = j;
            } else {
                // `CLAUSE_MARK[ch]`: a one-code-point key cannot reach `Object.prototype`.
                if let Some(mk) = MANIFEST.clause_punctuation.get(&ch.to_string_lossy()) {
                    if !mk.is_empty() {
                        sink.pause(&js(mk));
                    }
                }
                i += 1;
            }
        }
        sink.finish()
    }
}

impl Engine for MandarinPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(MandarinPhonemizer::text(self, input))
    }
}

fn third_tone_sandhi() -> ThirdToneSandhi {
    let st = &MANIFEST.sandhi.third_third;
    ThirdToneSandhi {
        from: js_number(&js(&st.from)),
        before: js_number(&js(&st.before)),
        to: js_number(&js(&st.to)),
    }
}

/// The pinyin → IPA tables, as `createMandarin` builds them.
pub fn load_mandarin_tables() -> Result<MandarinTables, String> {
    try_manifest()?;
    let syllable_ipa = load_tsv_strings(DIR, "syllable-ipa.tsv", TsvOptions::default()).map_err(|e| e.to_string())?;
    Ok(MandarinTables {
        syllable_ipa,
        tones: MANIFEST.tones.clone(),
        third_tone_sandhi: third_tone_sandhi(),
    })
}

/// The Hanzi → pinyin tables (≈1.7 MB of TSV), loaded once per engine build.
pub fn load_pinyin_tables() -> Result<PinyinTables, String> {
    let chars = load_tsv_map(DIR, "chars.tsv", |v, _| Some(v.split(&js(","))), TsvOptions::default())
        .map_err(|e| e.to_string())?;
    let phrases = load_tsv_strings(DIR, "phrases.tsv", TsvOptions::default()).map_err(|e| e.to_string())?;
    let max_phrase = phrases.keys().fold(2, |m, k| m.max(k.code_points().count()));
    Ok(PinyinTables {
        chars: chars.into_iter().collect::<HashMap<_, _>>(),
        phrases: phrases.into_iter().collect::<HashMap<_, _>>(),
        max_phrase,
    })
}

/// `createPinyinPhonemizer()`: the bare syllable converter the referee eval uses.
pub fn create_pinyin_phonemizer() -> Result<PinyinToIpa, String> {
    Ok(PinyinToIpa::new(load_mandarin_tables()?))
}

/// `createMandarin(foreign)`.
pub fn create_mandarin(foreign: Option<ForeignPhonemizer>) -> Result<MandarinPhonemizer, String> {
    let tables = load_mandarin_tables()?; // checks the manifest first
    let tier: SymbolData =
        serde_json::from_value(MANIFEST.symbol_tier.clone()).map_err(|e| format!("cmn symbolTier: {e}"))?;
    Ok(MandarinPhonemizer {
        symbols: make_symbol_normalizer(&tier)?,
        pinyin_to_ipa: PinyinToIpa::new(tables),
        pinyin: load_pinyin_tables()?,
        foreign,
    })
}

#[cfg(test)]
mod tests {
    /// The Kokoro integration splits an all-Han token's `ipa_span` into one group per hanzi: a whole Han run
    /// is ONE token, its IPA span covers its reading, and that reading has one space-separated group per hanzi.
    #[test]
    fn a_han_run_is_one_token_with_one_group_per_hanzi() {
        let r = crate::phonemize_trace("我们的银行，很好。", "cmn").unwrap();
        assert!(r.trace.traced);
        let ipa: Vec<u16> = r.ipa.encode_utf16().collect();
        assert_eq!(r.trace.tokens.len(), 2);
        for (t, hanzi) in r.trace.tokens.iter().zip([5, 2]) {
            assert_eq!(t.surface.code_points().count(), hanzi);
            assert_eq!(t.input_span, Some(t.span));
            let (a, b) = t.ipa_span.expect("ipa span");
            let groups = String::from_utf16(&ipa[a..b]).unwrap();
            assert_eq!(groups.split(' ').count(), hanzi);
        }
    }
}
