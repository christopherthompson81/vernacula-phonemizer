//! Native Bengali phonemizer: the generic abugida G2P plus Bengali's own phonology (orthographic rewrites, phôla
//! gemination, height harmony, final and medial inherent-vowel deletion), a whole-word lexicon, numbers, clause
//! marks, the symbol tier and embedded Latin runs. The maker is shared by as and bpy.
//! Ported from src/languages/bengali/bengali.ts — see that file for the corpus evidence.

use std::collections::HashMap;
use std::sync::{Arc, LazyLock, OnceLock};

use indexmap::IndexMap;

use super::manifest::{BengaliDef, try_manifest};
use super::normalize::{BengaliNormalizer, make_bengali_normalizer};
use crate::core::abugida::{AbugidaG2p, Ipa, make_abugida_g2p};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::LATIN_RUN;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_map};
use crate::core::markers::PUA_SENTINEL_2;
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::core::numbers::{indic_number_words, render_number, spell_digits};
use crate::core::phonology::{Phonology, load_shared_phonology};
use crate::core::provenance::{Form, normalize};
use crate::core::schwa::delete_medial_schwa;
use crate::core::unicode::{BENGALI_DIGITS, BENGALI_WORD, IPA_VOWELS};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError, read_as_english};

/// Foreign-run phonemizer (embedded Latin → e.g. en), injected by the registry.
pub type ForeignPhonemizer = Arc<dyn Fn(&JsString) -> JsString + Send + Sync>;

/// `OovResolver`: word → IPA, or `None` to defer to the rule engine (the neural path's per-call override).
pub type OovResolver<'a> = &'a dyn Fn(&JsString) -> Option<JsString>;

/// The symbol tier's unit nouns, in BENGALI: the default a reusing language overrides with `unitWords`.
/// Generated from the TS object literal (key order preserved).
const BENGALI_UNITS: [(&str, &str); 7] = [
    ("km", "কিলোমিটার"),
    ("cm", "সেন্টিমিটার"),
    ("mm", "মিলিমিটার"),
    ("kg", "কিলোগ্রাম"),
    ("m", "মিটার"),
    ("g", "গ্রাম"),
    ("km/h", "কিলোমিটার প্রতি ঘন্টা"),
];

static VOWEL_G: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!("[{IPA_VOWELS}]"), "g").unwrap());

/// `lexicon()`: `bengali-lexicon.tsv`, keys NFC-normalized on load. Optional, as the TS load is.
pub fn try_lexicon() -> Result<&'static HashMap<JsString, JsString>, String> {
    static LEXICON: OnceLock<HashMap<JsString, JsString>> = OnceLock::new();
    load_once(&LEXICON, || {
        let rows = load_tsv_map(
            super::manifest::DIR,
            "bengali-lexicon.tsv",
            |v, _| Some(v.clone()),
            TsvOptions {
                optional: true,
                ..Default::default()
            },
        )
        .map_err(|e| e.to_string())?;
        let mut m = HashMap::new();
        for (k, v) in rows {
            m.insert(normalize(&k, Form::Nfc), v);
        }
        Ok(m)
    })
}

/// `bengaliLexicon()`.
pub fn bengali_lexicon() -> &'static HashMap<JsString, JsString> {
    try_lexicon().unwrap_or_else(|e| panic!("{e}"))
}

pub struct NativeBengali {
    def: BengaliDef,
    g2p: AbugidaG2p,
    symbols_tier: SymbolNormalizer,
    normalize: BengaliNormalizer,
    token_re: JsRegex,
    foreign: Option<ForeignPhonemizer>,
    symbols: HashMap<JsString, JsString>,
    strip: JsString,
}

/// `makeNativeBengali(def, phon, foreign)`. The TS registers the [æ] sentinel on the def it is given; this takes
/// a clone and registers it there.
pub fn make_native_bengali(
    def: &BengaliDef,
    phon: &Phonology,
    foreign: Option<ForeignPhonemizer>,
) -> Result<NativeBengali, String> {
    let mut def = def.clone();
    let ae = Ipa { ipa: "æ".into() };
    def.abugida
        .vowel_signs
        .insert(PUA_SENTINEL_2.into(), ae.clone());
    def.abugida
        .independent_vowels
        .insert(PUA_SENTINEL_2.into(), ae);
    let g2p = make_abugida_g2p(&def.abugida, phon);

    let tier = try_manifest()?
        .symbol_tier
        .as_ref()
        .ok_or("bengali.jsonc declares no `symbolTier`")?;
    let units: IndexMap<String, Vec<String>> = match &def.unit_words {
        Some(u) => u.clone(),
        None => BENGALI_UNITS
            .iter()
            .map(|(k, v)| (k.to_string(), vec![v.to_string()]))
            .collect(),
    };
    let symbols_tier = make_symbol_normalizer(&SymbolData {
        units: Some(units),
        percent: tier.percent.clone(),
        currency: tier.currency.clone(),
        exponent_words: tier.exponent_words.clone(),
        ampersand: tier.ampersand.clone(),
        multiply: tier.multiply.clone(),
        ..Default::default()
    })?;
    let normalize = make_bengali_normalizer(&def.numbers)?;

    let symbol_map = def.symbols.clone().unwrap_or_default();
    let strip = def.strip_symbols.clone().unwrap_or_default();
    let symbol_class: String = symbol_map
        .keys()
        .map(String::as_str)
        .chain(std::iter::once(strip.as_str()))
        .collect();
    let dc: String = std::iter::once("0-9".to_string())
        .chain(BENGALI_DIGITS.iter().map(|(k, _)| k.to_string_lossy()))
        .collect();
    let pattern = format!(
        r"([{BENGALI_WORD}]+)|({latin})|([{dc}]+(?:(?<!(?<![{dc}])0),[{dc}]+)*(?:\.[{dc}]+)?)|([।॥.?!,;:]){sym}",
        latin = *LATIN_RUN,
        sym = if symbol_class.is_empty() {
            String::new()
        } else {
            format!("|([{symbol_class}])")
        },
    );
    let token_re = JsRegex::new(&pattern, "gu").map_err(|e| format!("token pattern: {e}"))?;

    Ok(NativeBengali {
        symbols: symbol_map.iter().map(|(k, v)| (js(k), js(v))).collect(),
        strip: js(&strip),
        def,
        g2p,
        symbols_tier,
        normalize,
        token_re,
        foreign,
    })
}

impl NativeBengali {
    /// `harmony(ipa)`: ɔ→o before a high vowel and e→æ before a, in an open syllable; right to left.
    fn harmony(&self, ipa: &JsString) -> JsString {
        let vowels = VOWEL_G.match_all(ipa);
        if vowels.len() < 2 {
            return ipa.clone();
        }
        let mut out = ipa.clone();
        for k in (0..vowels.len() - 1).rev() {
            let idx = vowels[k].index();
            let cur = out.char_at(idx);
            if cur != js("ɔ") && cur != js("e") {
                continue;
            }
            let next_idx = vowels[k + 1].index();
            let next_v = out.char_at(next_idx);
            let between = js_re!(r"[ʰʱ̪̃͡ːʲ]", "gu").replace(
                &out.slice(idx as isize + 1, Some(next_idx as isize)),
                &JsString::new(),
            );
            let n_between = between.code_points().count();
            let set = |out: &JsString, to: &str| {
                out.slice(0, Some(idx as isize))
                    .concat(&js(to))
                    .concat(&out.slice(idx as isize + 1, None))
            };
            if n_between == 0 {
                if cur == js("ɔ") && (next_v == js("i") || next_v == js("u")) {
                    out = set(&out, "o");
                }
                continue;
            }
            if n_between != 1 {
                continue;
            }
            let to = if cur == js("ɔ") && js_re!(r"[iu]").test(&next_v) {
                "o"
            } else if cur == js("e") && next_v == js("a") {
                "æ"
            } else {
                ""
            };
            if !to.is_empty() {
                out = set(&out, to);
            }
        }
        out
    }

    /// `deleteFinalInherent(ipa)`: drop a word-final ɔ after one light coda consonant, keep it as [o] after a
    /// heavy coda.
    fn delete_final_inherent(&self, ipa: &JsString) -> JsString {
        if !ipa.ends_with(&js("ɔ")) {
            return ipa.clone();
        }
        let body = ipa.slice(0, Some(-1));
        let Some(last_v) = VOWEL_G.match_all(&body).pop() else {
            return body;
        };
        let coda = body.slice(last_v.index() as isize + 1, None);
        let coda_bases = js_re!(r"t͡ʃ|d͡ʒ", "gu").replace(&coda, &js("C"));
        let coda_bases = js_re!(r"[ʰʱ̪͡ː̃]", "gu").replace(&coda_bases, &JsString::new());
        if coda.includes(&js("ː")) || coda_bases.len() >= 2 {
            body.concat(&js("o"))
        } else {
            body
        }
    }

    /// `wordRules(w)`: the rule engine alone, no lexicon.
    pub fn word_rules(&self, w: &JsString) -> JsString {
        let mut norm = normalize(w, Form::Nfc);
        norm = js_re!(r"ং", "gu").replace(&norm, &js("ঙ্"));
        norm = js_re!(r"ৎ", "gu").replace(&norm, &js("ত্"));
        norm = js_re!(r"ওয়া", "gu").replace(&norm, &js("ওআ"));
        norm = js_re!(r"^অ্যা", "u").replace(&norm, &js(PUA_SENTINEL_2));
        norm = js_re!(r"^(\S)্যা", "u").replace(&norm, &js(&format!("$1{PUA_SENTINEL_2}")));
        norm = js_re!(r"ক্ষ", "gu").replace(&norm, &js("ক্খ"));
        norm = js_re!(r"জ্ঞ", "gu").replace(&norm, &js("গ্গ"));
        norm = js_re!(r"([ক-হড়-য়])্([যবম])", "gu").replace_with(&norm, |m, s| {
            let c = m.group(1, s).unwrap_or_default();
            let p2 = m.group(2, s).unwrap_or_default();
            if c == js("র") || (p2 == js("ব") && js("ঙঞণনম").includes(&c)) {
                m.value(s)
            } else if m.index() == 0 {
                c
            } else {
                c.concat(&js("্")).concat(&c)
            }
        });
        let mut x = self.g2p.g2p(&norm);
        x = js_re!(
            r"(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ɡʱ|kʰ|t̪|d̪|[kɡpbmnlʃɾɽŋjɦ])\1(?!͡)",
            "gu"
        )
        .replace(&x, &js("$1ː"));
        x = js_re!(r"ː([ʰʱ])", "gu").replace(&x, &js("$1ː"));
        if self.def.height_harmony != Some(false) {
            x = self.harmony(&x);
        }
        if VOWEL_G.match_all(&x).len() >= 2 {
            x = self.delete_final_inherent(&x);
        }
        if self.def.medial_schwa_deletion != Some(false) {
            x = delete_medial_schwa(&x, Some(&js("ɔ")));
        }
        normalize(&x, Form::Nfc)
    }

    /// `word(w, oov)`: the lexicon (unless `skipLexicon`), then the per-call override, then the rule engine.
    pub fn word(&self, w: &JsString, oov: Option<OovResolver>) -> JsString {
        if self.def.skip_lexicon != Some(true)
            && let Some(hit) = bengali_lexicon().get(&normalize(w, Form::Nfc))
        {
            return hit.clone();
        }
        if let Some(o) = oov.and_then(|f| f(w)) {
            return o;
        }
        self.word_rules(w)
    }

    /// `number(digits, oov)`. ⚠ A `units` table without the digit is an error: the TS reads `units[d]!` as
    /// `undefined` and the g2p then throws on it.
    pub fn number(
        &self,
        digits: &JsString,
        oov: Option<OovResolver>,
    ) -> Result<JsString, PhonemizeError> {
        let mut ascii = JsString::new();
        for d in digits.code_point_strings() {
            if d == js(",") {
                continue;
            }
            match BENGALI_DIGITS.iter().find(|(k, _)| *k == d) {
                Some((_, a)) => ascii.push_str(a),
                None => ascii.push_str(&d),
            }
        }
        let numbers = &self.def.numbers;
        let word = |w: &str| self.word(&js(w), oov).to_string_lossy();
        let dot = ascii.index_of(&js("."), 0);
        if let (Some(dot), Some(decimal_word)) = (dot, numbers.decimal_word.as_ref()) {
            let int_part = ascii.slice(0, Some(dot as isize));
            let int_n = if int_part.is_empty() {
                js_number(&js("0"))
            } else {
                js_number(&int_part)
            };
            let head = if is_safe_integer(int_n) {
                render_number(int_n as u64, numbers, &word, indic_number_words)
            } else {
                spell_digits(&int_part.to_string_lossy(), numbers, &word)
            };
            let mut parts = vec![head, word(decimal_word)];
            for d in ascii.slice(dot as isize + 1, None).code_point_strings() {
                let i = js_number(&d);
                let unit = (i.fract() == 0.0 && i >= 0.0)
                    .then(|| numbers.units.get(i as usize))
                    .flatten();
                let Some(unit) = unit else {
                    return Err(PhonemizeError::Data(format!(
                        "numbers.units has no word for digit {d}"
                    )));
                };
                parts.push(word(unit));
            }
            return Ok(js(&parts.join(" ")));
        }
        let n = js_number(&ascii);
        if !is_safe_integer(n) {
            return Ok(js(&spell_digits(&ascii.to_string_lossy(), numbers, &word)));
        }
        Ok(js(&render_number(
            n as u64,
            numbers,
            &word,
            indic_number_words,
        )))
    }

    /// `normalize(input)`, the Bengali pre-tokenizer pass alone (the per-module differential calls it).
    pub fn normalize(&self, input: &JsString) -> JsString {
        (self.normalize)(input)
    }

    /// `text(input, oovOverride)`.
    pub fn text(
        &self,
        input: &JsString,
        oov: Option<OovResolver>,
    ) -> Result<JsString, PhonemizeError> {
        let prepared = self.symbols_tier.apply(&(self.normalize)(input));
        // The TS throws out of the token callback; the first error is carried out of it here.
        let mut failed: Option<PhonemizeError> = None;
        let out = assemble_clauses(&prepared, &self.token_re, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                sink.emit(&self.word(&w, oov));
            } else if let Some(latin) = m.group(2, s) {
                if let Some(f) = &self.foreign {
                    sink.emit(&f(&latin));
                }
            } else if let Some(d) = m.group(3, s) {
                match self.number(&d, oov) {
                    Ok(ipa) => sink.emit(&ipa),
                    Err(e) => {
                        failed.get_or_insert(e);
                    }
                }
            } else if let Some(p) = m.group(4, s) {
                if let Some(mk) = self.def.clause_punctuation.get(&p.to_string_lossy())
                    && !mk.is_empty()
                {
                    sink.pause(&js(mk));
                }
            } else if let Some(sym) = m.group(5, s)
                && !self.strip.includes(&sym)
                && let Some(w) = self.symbols.get(&sym).filter(|w| !w.is_empty())
            {
                sink.emit(&self.word(w, oov));
            }
        });
        match failed {
            Some(e) => Err(e),
            None => Ok(out),
        }
    }
}

/// `createBengali(foreign)`.
pub fn create_bengali(foreign: Option<ForeignPhonemizer>) -> Result<NativeBengali, String> {
    try_lexicon()?;
    make_native_bengali(try_manifest()?, load_shared_phonology()?, foreign)
}

/// The registry's `bn` engine: the sync engine, plus the neural best path.
pub struct BengaliEngine(pub NativeBengali);

impl Engine for BengaliEngine {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        self.0.text(input, None)
    }

    fn neural(&self, pre_passed: &JsString) -> Option<Result<JsString, PhonemizeError>> {
        use super::{bengali_neural::phonemize_bn_neural, bengali_tagger::bengali_tagger};
        Some(phonemize_bn_neural(bengali_tagger(), pre_passed))
    }

    fn has_neural(&self) -> bool {
        true
    }
}

/// The registry's `bn` arm: `createBengali(readAsEnglish)`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    let foreign: ForeignPhonemizer = Arc::new(read_as_english);
    Ok(Arc::new(BengaliEngine(
        create_bengali(Some(foreign)).map_err(PhonemizeError::Data)?,
    )))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::phonemize;

    // Every call test/bengali.test.ts and test/bengaliNeural.test.ts make into the engine, with the value the TS
    // returned, extracted MECHANICALLY (the suites run under a recording vitest shim that also checked every
    // matcher: all green), so each of the suites' expectations holds here exactly when the Rust returns the same
    // value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["বাংলাদেশ"], Some("baŋlad̪eʃ")),
    ("phonemizeWord", &["মানুষ"], Some("manuʃ")),
    ("phonemizeWord", &["দেশ"], Some("d̪eʃ")),
    ("phonemizeWord", &["নাম"], Some("nam")),
    ("phonemizeWord", &["ভালো"], Some("bʱalo")),
    ("phonemizeWord", &["করি"], Some("koɾi")),
    ("phonemizeWord", &["কর"], Some("kɔɾ")),
    ("phonemizeWord", &["জল"], Some("d͡ʒɔl")),
    ("phonemizeWord", &["অংশ"], Some("ɔŋʃo")),
    ("phonemizeWord", &["কলি"], Some("koli")),
    ("phonemizeWord", &["ঘরে"], Some("ɡʱɔɾe")),
    ("phonemizeWord", &["অকলুষ"], Some("ɔkoluʃ")),
    ("phonemizeWord", &["বিদ্যা"], Some("bid̪ːa")),
    ("phonemizeWord", &["যুদ্ধ"], Some("d͡ʒud̪ʱːo")),
    ("phonemizeWord", &["পদ্ম"], Some("pɔd̪ːo")),
    ("phonemizeWord", &["আপনার"], Some("apnaɾ")),
    ("phonemizeWord", &["অক্ষর"], Some("ɔkʰːɔɾ")),
    ("phonemizeWord", &["বিজ্ঞান"], Some("biɡːan")),
    ("phonemizeWord", &["গ্যাস"], Some("ɡæʃ")),
    ("phonemizeWord", &["ক্যান্ডি"], Some("kænɖi")),
    ("phonemizeWord", &["ন্যায়"], Some("næj")),
    ("phonemizeWord", &["অ্যাসিড"], Some("æʃiɖ")),
    ("phonemizeWord", &["অকাট্য"], Some("ɔkaʈʈo")),
    ("phonemizeWord", &["বই"], Some("boi")),
    ("phonemizeWord", &["অই"], Some("oi")),
    ("phonemizeWord", &["খাওয়া"], Some("kʰaoa")),
    ("phonemizeWord", &["দেওয়া"], Some("d̪eoa")),
    ("phonemizeWord", &["যাওয়া"], Some("d͡ʒaoa")),
    ("phonemizeWord", &["মেয়ে"], Some("meje")),
    ("phonemizeWord", &["মন"], Some("mon")),
    ("phonemizeWord", &["কলম"], Some("kɔlom")),
    ("phonemizeWord", &["এক"], Some("æk")),
    ("phonemizeWord", &["করে"], Some("koɾe")),
    ("phonemizeWord", &["ঘোষণা"], Some("ɡʱoʃona")),
    ("phonemizeWord", &["বলে"], Some("bole")),
    ("phonemizeWord", &["কম"], Some("kɔm")),
    ("phonemizeWord", &["জীবন"], Some("d͡ʒibon")),
    ("phonemizeWordRules", &["মন"], Some("mɔn")),
    ("phonemizeWordRules", &["কলম"], Some("kɔlɔm")),
    ("phonemize", &["আমি বাংলা বলি।", "bn"], Some("ami baŋla boli .")),
    ("phonemize", &["21", "bn"], Some("ekuʃ")),
    ("phonemize", &["24", "bn"], Some("t͡ʃobːiʃ")),
    ("phonemize", &["39", "bn"], Some("unt͡ʃolːiʃ")),
    ("phonemize", &["66", "bn"], Some("t͡ʃʰeʃɔʈʈi")),
    ("phonemize", &["99", "bn"], Some("niɾanɔbːoi")),
    ("phonemize", &["100", "bn"], Some("æk ʃɔt̪")),
    ("phonemize", &["1956", "bn"], Some("æk ɦad͡ʒaɾ nɔj ʃɔt̪ t͡ʃʰapːanːo")),
    ("phonemize", &["১৮১৯", "bn"], Some("æk ɦad͡ʒaɾ aʈ ʃɔt̪ uniʃ")),
    ("phonemize", &["এটি বাক্য। দুই।", "bn"], Some("eʈi bakːo . d̪ui .")),
    ("phonemize", &["৮ম", "bn"], Some("ɔʃʈɔm")),
    ("phonemize", &["২ ম", "bn"], Some("d̪it̪ij")),
    ("phonemize", &["৪র্থ", "bn"], Some("t͡ʃot̪uɾt̪ʰo")),
    ("phonemize", &["১৭তম", "bn"], Some("ʃɔt̪eɾot̪ɔm")),
    ("phonemize", &["২৬ শে নভেম্বর", "bn"], Some("t͡ʃʰabːiʃʃe nɔbʱembɔɾ")),
    ("phonemize", &["৮ই জুলাই", "bn"], Some("aʈoi d͡ʒulai")),
    ("phonemize", &["১লা জানুয়ারি", "bn"], Some("pɔɦela d͡ʒanujaɾi")),
    ("phonemize", &["3%", "bn"], Some("t̪in ʃɔt̪aŋʃo")),
    ("phonemize", &["৮%", "bn"], Some("aʈ ʃɔt̪aŋʃo")),
    ("phonemize", &["৳৫০০", "bn"], Some("pãt͡ʃ ʃɔt̪ ʈaka")),
    ("phonemize", &["৫ কিমি", "bn"], Some("pãt͡ʃ kilomiʈaɾ")),
    ("phonemize", &["5 mm", "bn"], Some("pãt͡ʃ milimiʈaɾ")),
    ("phonemize", &["20 °C", "bn"], Some("biʃ ɖiɡɾi ʃeloʃijaʃ")),
    ("phonemize", &["ডঃ শর্মা", "bn"], Some("ɖɔkʈɔɾ ʃɔɾma")),
    ("phonemize", &["ড. শর্মা", "bn"], Some("ɖɔkʈɔɾ ʃɔɾma")),
    ("phonemize", &["১১:২০", "bn"], Some("æɡaɾoʈa biʃ miniʈ")),
    ("phonemize", &["11:00", "bn"], Some("æɡaɾoʈa")),
    ("phonemize", &["-5 ডিগ্রি", "bn"], Some("ɾinat̪ːɔk pãt͡ʃ ɖiɡɾi")),
    ("phonemize", &["+3 ডিগ্রি", "bn"], Some("d͡ʒoɡ t̪in ɖiɡɾi")),
    ("phonemize", &["১/৫", "bn"], Some("pãt͡ʃ bʱaɡeɾ æk")),
    ("phonemize", &["1/2", "bn"], Some("ɔɾd̪ʱek")),
    ("phonemize", &["19,500 km²", "bn"], Some("uniʃ ɦad͡ʒaɾ pãt͡ʃ ʃɔt̪ bɔɾɡo kilomiʈaɾ")),
    ("phonemize", &["120 m³", "bn"], Some("æk ʃɔt̪ biʃ kiubik miʈaɾ")),
    ("phonemize", &["টিকিটের দাম ¥2,500 থেকে ¥130,000 এর মধ্যে।", "bn"], Some("ʈikiʈeɾ d̪am d̪ui ɦad͡ʒaɾ pãt͡ʃ ʃɔt̪ ijen t̪ʰeke æk lakʰ t̪ɾiʃ ɦad͡ʒaɾ ijen eɾ mɔd̪ʱːe .")),
    ("phonemize", &["টিকিটের দাম 2,500 থেকে 130,000 এর মধ্যে।", "bn"], Some("ʈikiʈeɾ d̪am d̪ui ɦad͡ʒaɾ pãt͡ʃ ʃɔt̪ t̪ʰeke æk lakʰ t̪ɾiʃ ɦad͡ʒaɾ eɾ mɔd̪ʱːe .")),
    ("phonemizeBnNeural", &["আমি বলি। তুমি কর।"], Some("ami boli . t̪umi kɔɾ .")),
    ("phonemize", &["আমি বলি। তুমি কর।", "bn"], Some("ami boli . t̪umi kɔɾ .")),
    ("phonemizeBnNeural", &["বই ও কলম।"], Some("boi o kɔlom .")),
    ("phonemize", &["বই ও কলম।", "bn"], Some("boi o kɔlom .")),
    ("phonemizeBnNeural", &["১৯৯৯ সালে।"], Some("æk ɦad͡ʒaɾ nɔj ʃɔt̪ niɾanɔbːoi ʃale .")),
    ("phonemize", &["১৯৯৯ সালে।", "bn"], Some("æk ɦad͡ʒaɾ nɔj ʃɔt̪ niɾanɔbːoi ʃale .")),
    ("phonemizeBnNeural", &["আমি Google করি।"], Some("ami ɡˈuːɡɫ̩ koɾi .")),
    ("phonemize", &["আমি Google করি।", "bn"], Some("ami ɡˈuːɡɫ̩ koɾi .")),
    ("phonemizeBnNeural", &["বক্তরা নামকরা।"], Some("bɔkt̪oɾa namokɾa .")),
    ("phonemize", &["বক্তরা নামকরা।", "bn"], Some("bɔkt̪ɔɾa namɔkɾa .")),
    ("phonemizeBnNeural", &["১৯৯৯ সালে বক্তরা।"], Some("æk ɦad͡ʒaɾ nɔj ʃɔt̪ niɾanɔbːoi ʃale bɔkt̪oɾa .")),
    ("phonemizeBnNeural", &["ঽমন।"], Some("mɔn .")),
    ("phonemize", &["ঽমন।", "bn"], Some("mɔn .")),
    ];

    #[test]
    fn the_typescript_suites_hold() {
        let bn = create_bengali(None).unwrap();
        let mut n = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => bn.word(&js(args[0]), None).to_string_lossy(),
                "phonemizeWordRules" => bn.word_rules(&js(args[0])).to_string_lossy(),
                "phonemize" => phonemize(args[0], args[1]).unwrap(),
                "phonemizeBnNeural" => super::super::bengali_neural::phonemize_bn_neural(
                    super::super::bengali_tagger::bengali_tagger(),
                    &js(args[0]),
                )
                .unwrap()
                .to_string_lossy(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            n += 1;
        }
        assert_eq!(n, 87);
    }
}
