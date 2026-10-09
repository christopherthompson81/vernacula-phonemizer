//! Native Hindi phonemizer: the generic abugida G2P, schwa deletion and weight stress, driven by
//! `hindi.jsonc`, plus numbers, clause marks, symbols and embedded Latin runs (through the injected reader).
//! The maker is shared by the Hindi family (mr, gu, bho, mai, …). Ported from src/languages/hindi/hindi.ts —
//! see that file for the corpus evidence.

use std::collections::HashMap;
use std::sync::{Arc, LazyLock};

use super::manifest::{HindiDef, try_manifest};
use super::normalize::{OwnOrdinals, TextFn, make_hindi_normalizer};
use crate::core::abugida::{AbugidaG2p, make_abugida_g2p};
use crate::core::clauses::assemble_clauses;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{SymbolData, make_symbol_normalizer};
use crate::core::numbers::{indic_number_words, render_number, spell_digits};
use crate::core::phonology::{Phonology, load_shared_phonology};
use crate::core::provenance::{Form, normalize};
use crate::core::schwa::delete_medial_schwa;
use crate::core::unicode::{DEVANAGARI_DIGITS, DEVANAGARI_WORD, IPA_VOWELS};
use crate::core::weight_stress::apply_weight_stress;
use crate::js_re;
use crate::registry::{Engine, PhonemizeError, read_as_english};

/// Foreign-run phonemizer (embedded Latin → e.g. en), injected by the registry.
pub type ForeignPhonemizer = Arc<dyn Fn(&JsString) -> JsString + Send + Sync>;

static VOWEL_G: LazyLock<JsRegex> = LazyLock::new(|| JsRegex::new(&format!("[{IPA_VOWELS}]"), "g").unwrap());
static LONG_CONSONANT_END: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("[^{IPA_VOWELS}]ː$"), "").unwrap());

const MAX_SAFE: f64 = 9_007_199_254_740_991.0;

fn is_safe_integer(n: f64) -> bool {
    n.is_finite() && n.fract() == 0.0 && n.abs() <= MAX_SAFE
}

/// `heavyFinalCoda(body)`: does the coda (final schwa already removed) end in a cluster or a geminate?
pub fn heavy_final_coda(body: &JsString) -> bool {
    if LONG_CONSONANT_END.test(body) {
        return true;
    }
    let collapsed = js_re!("t͡ʃ|d͡ʒ|t͡s|d͡z", "g").replace(body, &js("Ç"));
    let collapsed = js_re!("[̀-ͯʰ-ʱːˈˌ]", "g").replace(&normalize(&collapsed, Form::Nfd), &JsString::new());
    let vowels = js(IPA_VOWELS);
    let mut n = 0;
    for c in collapsed.code_point_strings().iter().rev() {
        if vowels.includes(c) {
            break;
        }
        if !c.trim().is_empty() {
            n += 1;
        }
    }
    n >= 2
}

/// The script's word-run class, digit map and avagraha sign. Defaults to Devanagari.
#[derive(Clone)]
pub struct AbugidaScript {
    pub word: String,
    /// Native digit → ASCII digit, in the TS object's key order.
    pub digits: Vec<(JsString, JsString)>,
    pub avagraha: Option<JsString>,
}

impl Default for AbugidaScript {
    fn default() -> Self {
        AbugidaScript {
            word: DEVANAGARI_WORD.to_string(),
            digits: DEVANAGARI_DIGITS.clone(),
            avagraha: Some(js("\u{093D}")),
        }
    }
}

/// Per-language overrides of Hindi's normalizer and symbol tier.
#[derive(Default)]
pub struct Overrides {
    pub normalize: Option<TextFn>,
    pub symbols: Option<TextFn>,
}

struct Rule {
    re: JsRegex,
    to: JsString,
}

pub struct NativeHindi {
    def: &'static HindiDef,
    g2p: AbugidaG2p,
    script: AbugidaScript,
    foreign: Option<ForeignPhonemizer>,
    lexicon: Option<HashMap<JsString, JsString>>,
    post: Vec<Rule>,
    fin: Vec<Rule>,
    symbols: HashMap<JsString, JsString>,
    strip: JsString,
    token_re: JsRegex,
    retain_on_avagraha: bool,
    normalize: TextFn,
    symbol_tier: TextFn,
}

fn rules(rs: &[super::manifest::Rule]) -> Result<Vec<Rule>, String> {
    rs.iter()
        .map(|r| {
            Ok(Rule {
                re: JsRegex::new(&r.from, "gu").map_err(|e| format!("rule {}: {e}", r.from))?,
                to: js(&r.to),
            })
        })
        .collect()
}

/// `makeNativeHindi(def, phon, foreign, script, lexicon, overrides)`.
pub fn make_native_hindi(
    def: &'static HindiDef,
    phon: &Phonology,
    foreign: Option<ForeignPhonemizer>,
    script: AbugidaScript,
    lexicon: Option<HashMap<JsString, JsString>>,
    overrides: Overrides,
) -> Result<NativeHindi, String> {
    let g2p = make_abugida_g2p(&def.abugida, phon);
    let digit_class: String =
        std::iter::once("0-9".to_string()).chain(script.digits.iter().map(|(k, _)| k.to_string_lossy())).collect();
    let post = rules(&def.post_rules)?;
    let fin = rules(&def.final_rules)?;
    let symbol_map = def.symbols.clone().unwrap_or_default();
    let strip = def.strip_symbols.clone().unwrap_or_default();
    let symbol_class: String = symbol_map.keys().map(String::as_str).chain(std::iter::once(strip.as_str())).collect();
    let dc = &digit_class;
    let pattern = format!(
        r"([{}]+)|(\p{{Script=Latin}}[\p{{Script=Latin}}\p{{M}}]*)|([{dc}]+(?:(?<!(?<![{dc}])0),[{dc}]+)*(?:\.[{dc}]+)?)|([।॥.?!,;:]){}",
        script.word,
        if symbol_class.is_empty() { String::new() } else { format!("|([{symbol_class}])") },
    );
    let token_re = JsRegex::new(&pattern, "gu").map_err(|e| format!("token pattern: {e}"))?;

    let retain_on_avagraha = def.schwa_deletion.retain_on_avagraha == Some(true);
    if retain_on_avagraha && script.avagraha.is_none() {
        return Err("schwaDeletion.retainOnAvagraha is set but this script declares no `avagraha` sign".into());
    }

    let normalize = match overrides.normalize {
        Some(f) => f,
        None => make_hindi_normalizer(
            &def.numbers,
            OwnOrdinals {
                irregular_ordinals: def.irregular_ordinals.as_ref(),
                ordinal_suffixes: def.ordinal_suffixes.as_ref(),
            },
        )?,
    };
    let manifest = try_manifest()?;
    let own_tier = match (&def.symbol_tier, &manifest.symbol_tier) {
        (Some(a), Some(b)) => std::ptr::eq(a, b),
        _ => false,
    };
    if def.symbol_tier.is_some() && overrides.symbols.is_none() && !own_tier {
        return Err("makeNativeHindi: this manifest declares its own `symbolTier`, but no `overrides.symbols` was \
                    passed — the block would be silently ignored and Hindi's symbol words used instead. Build a \
                    normalizer from it with makeSymbolNormalizer and pass it as `overrides.symbols` (see \
                    src/languages/gujarati/gujarati.ts), or remove the block."
            .into());
    }
    let symbol_tier = match overrides.symbols {
        Some(f) => f,
        None => hindi_symbols()?,
    };

    Ok(NativeHindi {
        def,
        g2p,
        script,
        foreign,
        lexicon,
        post,
        fin,
        symbols: symbol_map.iter().map(|(k, v)| (js(k), js(v))).collect(),
        strip: js(&strip),
        token_re,
        retain_on_avagraha,
        normalize,
        symbol_tier,
    })
}

/// `SYMBOLS`: `makeSymbolNormalizer` over Hindi's `symbolTier`.
///
/// Built from HINDI's manifest whatever `def` is, as the TS module-level constant is; only these six fields.
fn hindi_symbols() -> Result<TextFn, String> {
    let sym = try_manifest()?.symbol_tier.as_ref().ok_or("hindi.jsonc declares no `symbolTier`")?;
    let d = SymbolData {
        percent: sym.percent.clone(),
        currency: sym.currency.clone(),
        units: sym.units.clone(),
        exponent_words: sym.exponent_words.clone(),
        bare_exponent: sym.bare_exponent.clone(),
        multiply: sym.multiply.clone(),
        ..Default::default()
    };
    let tier = make_symbol_normalizer(&d)?;
    Ok(Box::new(move |s: &JsString| tier.apply(s)))
}

impl NativeHindi {
    /// `wordRules(w)`: the rule engine alone, no lexicon.
    pub fn word_rules(&self, w: &JsString) -> JsString {
        let sd = &self.def.schwa_deletion;
        let mut x = self.g2p.g2p(w);
        let avagraha = self.retain_on_avagraha && w.ends_with(self.script.avagraha.as_ref().unwrap());
        for r in &self.post {
            x = r.re.replace(&x, &r.to);
        }
        let syls = VOWEL_G.match_all(&x).len();
        if sd.delete_word_final == Some(true)
            && !avagraha
            && !(sd.retain_in_monosyllable == Some(true) && syls <= 1)
            && !(sd.retain_final_after_cluster == Some(true)
                && js_re!("ə$").test(&x)
                && heavy_final_coda(&x.slice(0, Some(-1))))
        {
            x = js_re!("ə$").replace(&x, &JsString::new());
        }
        x = delete_medial_schwa(&x, None);
        for r in &self.fin {
            x = r.re.replace(&x, &r.to);
        }
        normalize(&apply_weight_stress(&x), Form::Nfc)
    }

    /// `word(w)`: the whole-word lexicon, then the rule engine.
    pub fn word(&self, w: &JsString) -> JsString {
        if let Some(hit) = self.lexicon.as_ref().and_then(|l| l.get(&normalize(w, Form::Nfc))) {
            return hit.clone();
        }
        self.word_rules(w)
    }

    fn word_str(&self, w: &str) -> String {
        self.word(&js(w)).to_string_lossy()
    }

    /// `number(digits)`.
    pub fn number(&self, digits: &JsString) -> JsString {
        let mut ascii = JsString::new();
        for d in digits.code_point_strings() {
            if d == js(",") {
                continue;
            }
            match self.script.digits.iter().find(|(k, _)| *k == d) {
                Some((_, a)) => ascii.push_str(a),
                None => ascii.push_str(&d),
            }
        }
        let numbers = &self.def.numbers;
        let word = |w: &str| self.word_str(w);
        let dot = ascii.index_of(&js("."), 0);
        if let (Some(dot), Some(decimal_word)) = (dot, numbers.decimal_word.as_ref()) {
            let int_part = ascii.slice(0, Some(dot as isize));
            let int_n = if int_part.is_empty() { js_number(&js("0")) } else { js_number(&int_part) };
            let head = if is_safe_integer(int_n) {
                render_number(int_n as u64, numbers, &word, indic_number_words)
            } else {
                spell_digits(&int_part.to_string_lossy(), numbers, &word)
            };
            let mut parts = vec![head, word(decimal_word)];
            for d in ascii.slice(dot as isize + 1, None).code_point_strings() {
                let i = js_number(&d) as usize;
                parts.push(word(&numbers.units[i]));
            }
            return js(&parts.join(" "));
        }
        let n = js_number(&ascii);
        if !is_safe_integer(n) {
            return js(&spell_digits(&ascii.to_string_lossy(), numbers, &word));
        }
        js(&render_number(n as u64, numbers, &word, indic_number_words))
    }

    /// `text(input)`.
    pub fn text(&self, input: &JsString) -> JsString {
        let prepared = (self.symbol_tier)(&(self.normalize)(input));
        assemble_clauses(&prepared, &self.token_re, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                sink.emit(&self.word(&w));
            } else if let Some(latin) = m.group(2, s) {
                if let Some(f) = &self.foreign {
                    sink.emit(&f(&latin));
                }
            } else if let Some(d) = m.group(3, s) {
                sink.emit(&self.number(&d));
            } else if let Some(p) = m.group(4, s) {
                if let Some(mk) = self.def.clause_punctuation.get(&p.to_string_lossy()) {
                    if !mk.is_empty() {
                        sink.pause(&js(mk));
                    }
                }
            } else if let Some(sym) = m.group(5, s) {
                if !self.strip.includes(&sym) {
                    if let Some(w) = self.symbols.get(&sym).filter(|w| !w.is_empty()) {
                        sink.emit(&self.word(w));
                    }
                }
            }
        })
    }
}

/// `createHindi(foreign)`.
pub fn create_hindi(foreign: Option<ForeignPhonemizer>) -> Result<NativeHindi, String> {
    let def = try_manifest()?;
    make_native_hindi(def, load_shared_phonology()?, foreign, AbugidaScript::default(), None, Overrides::default())
}

impl Engine for NativeHindi {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(NativeHindi::text(self, input))
    }
}

/// The registry's `hi` arm: `createHindi(readAsEnglish)`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    let foreign: ForeignPhonemizer = Arc::new(read_as_english);
    Ok(Arc::new(create_hindi(Some(foreign)).map_err(PhonemizeError::Data)?))
}

#[cfg(test)]
mod tests {
    use crate::phonemize;

    /// Expectations are the TypeScript engine's output for the same text, not hand-written IPA.
    #[test]
    fn hindi_end_to_end_matches_the_typescript() {
        assert_eq!(phonemize("भारत", "hi").unwrap(), "bʱˈaːɾət̪");
        assert_eq!(
            phonemize("16वीं सदी, 10:30 बजे", "hi").unwrap(),
            "soːlˈəɦʋiː̃ sˈəd̪iː , d̪ˈəs bˈəd͡ʒkəɾ t̪ˈiːs mˈɪnəʈ"
        );
        assert_eq!(phonemize("São Paulo में", "hi").unwrap(), "sˈaᶷ pʰˈɔːloᶷ mˈeː̃");
    }

    /// Every `rewrite` is on the pipeline string: no probe or golden line poisons the mapping (the TS
    /// `tools/provenance-poison.mts hi` reports 0 sites as well).
    #[test]
    fn hindi_rewrites_never_poison_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes = std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/hi.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/hi.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "hi").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 300);
        assert_eq!(hits.get(), 0);
    }

    /// A Devanagari run inside English reaches this engine through the script reader.
    #[test]
    fn devanagari_inside_english_is_read_by_hindi() {
        assert_eq!(phonemize("I said नमस्ते to them", "en").unwrap(), "aᶦ sˈɛd nəmˈəst̪eː tʰuː ðˈɛm");
        assert!(crate::registry::port_pending().iter().all(|p| p != "hi"));
    }
}
