//! Native Sylheti phonemizer (Syloti Nagri): the generic abugida G2P with geminate length and Bengali-style final and
//! medial inherent-vowel deletion, Indic cardinals and clause marks, driven by `sylheti.jsonc`.
//! Ported from src/languages/sylheti/sylheti.ts — see that file for the corpus evidence.

use std::sync::{Arc, OnceLock};

use indexmap::IndexMap;
use serde::Deserialize;

use super::normalize::normalize_sylheti;
use crate::core::abugida::{AbugidaDef, AbugidaG2p, make_abugida_g2p};
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::load_manifest::load_manifest;
use crate::core::numbers::{NumbersDef, indic_number_words, render_number, spell_digits};
use crate::core::phonology::load_shared_phonology;
use crate::core::provenance::{Form, normalize};
use crate::core::schwa::delete_medial_schwa;
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SylhetiDef {
    #[serde(flatten)]
    pub abugida: AbugidaDef,
    pub numbers: NumbersDef,
    pub clause_punctuation: IndexMap<String, String>,
}

/// `sylheti.jsonc`, loaded once. Cached only on success.
pub fn try_def() -> Result<&'static SylhetiDef, String> {
    static DEF: OnceLock<SylhetiDef> = OnceLock::new();
    load_once(&DEF, || {
        load_manifest("languages/sylheti", "sylheti.jsonc").map_err(|e| e.to_string())
    })
}

pub struct Sylheti {
    def: &'static SylhetiDef,
    g2p: AbugidaG2p,
}

impl Sylheti {
    /// `deleteFinalInherent(ipa)`.
    fn delete_final_inherent(ipa: &JsString) -> JsString {
        if !ipa.ends_with(&js("ɔ")) {
            return ipa.clone();
        }
        let body = ipa.slice(0, Some(-1));
        let Some(last_v) = js_re!(r"[aeiouɔ]", "gu").match_all(&body).pop() else {
            return body;
        };
        let tail = body.slice(last_v.index() as isize + 1, None);
        let coda = js_re!(r"[ʰʱ̪͡ː̃]", "gu").replace(&tail, &JsString::new());
        if tail.includes(&js("ː")) || coda.len() >= 2 {
            body.concat(&js("o"))
        } else {
            body
        }
    }

    /// `phonemizeWord(word)`: rules only (tone deferred).
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        let mut x = self.g2p.g2p(&normalize(word, Form::Nfc));
        x = js_re!(r"(t̪|d̪|ʈ|ɖ|[xszʃɸfbɡmnlɾɽjɦ])\1(?!͡)", "gu").replace(&x, &js("$1ː"));
        x = js_re!(r"ː([ʰʱ])", "gu").replace(&x, &js("$1ː"));
        if js_re!(r"[aeiouɔ]", "gu").match_all(&x).len() >= 2 {
            x = Self::delete_final_inherent(&x);
        }
        x = delete_medial_schwa(&x, Some(&js("ɔ")));
        normalize(&x, Form::Nfc)
    }

    /// `number(digits)`: an ASCII digit run (the registry has folded the Bengali ones).
    pub fn number(&self, digits: &JsString) -> JsString {
        let word = |w: &str| self.phonemize_word(&js(w)).to_string_lossy();
        let n = js_number(digits);
        if !is_safe_integer(n) {
            return js(&spell_digits(
                &digits.to_string_lossy(),
                &self.def.numbers,
                &word,
            ));
        }
        js(&render_number(
            n as u64,
            &self.def.numbers,
            &word,
            indic_number_words,
        ))
    }

    /// `text(input)`.
    pub fn text(&self, input: &JsString) -> JsString {
        assemble_clauses(
            &normalize_sylheti(input),
            js_re!(r"([ꠀ-ꠧ꠬]+)|(\d+)|([꠨꠩꠪꠫।॥৷⁕.?!,])", "gu"),
            |m, s, sink| {
                if let Some(w) = m.group(1, s) {
                    sink.emit(&self.phonemize_word(&w));
                } else if let Some(d) = m.group(2, s) {
                    sink.emit(&self.number(&d));
                } else if let Some(p) = m.group(3, s)
                    && let Some(mk) = self.def.clause_punctuation.get(&p.to_string_lossy())
                    && !mk.is_empty()
                {
                    sink.pause(&js(mk));
                }
            },
        )
    }
}

/// `createSylheti()`.
pub fn create_sylheti() -> Result<Sylheti, String> {
    let def = try_def()?;
    Ok(Sylheti {
        def,
        g2p: make_abugida_g2p(&def.abugida, load_shared_phonology()?),
    })
}

impl Engine for Sylheti {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(Sylheti::text(self, input))
    }
}

/// The registry's `syl` arm: `createSylheti()`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    Ok(Arc::new(create_sylheti().map_err(PhonemizeError::Data)?))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/sylheti.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["ꠀꠇꠟ"], Some("axɔl")),
    ("phonemizeWord", &["ꠀꠇꠔꠣ"], Some("axt̪a")),
    ("phonemizeWord", &["ꠀꠍꠦ"], Some("ase")),
    ("phonemizeWord", &["ꠀꠁꠎ"], Some("aiz")),
    ("phonemizeWord", &["ꠀꠉꠘ"], Some("aɡɔn")),
    ("phonemizeWord", &["ꠉꠞꠝ"], Some("ɡɔɾɔm")),
    ("phonemizeWord", &["ꠀꠋꠉꠥꠞ"], Some("aŋɡuɾ")),
    ("phonemizeWord", &["ꠝꠣꠛꠥꠖ"], Some("mabud̪")),
    ("phonemize", &["ꠉꠞꠝ ⁕ ꠙꠣꠘꠤ", "syl"], Some("ɡɔɾɔm . ɸani")),
    ("phonemize", &["ꠈꠟꠦꠎ ॥ ꠡꠛ", "syl"], Some("xɔlez . ʃɔb")),
    ("phonemize", &["ꠀꠍꠤꠟ꠫ ꠙ꠆ꠞꠝꠣꠘ", "syl"], Some("asil . ɸɾɔman")),
    ("phonemize", &["ꠘꠎꠞꠈꠣꠞꠣ ꠨ ꠜꠣꠃꠀꠁꠟ", "syl"], Some("nɔzɔɾxaɾa , bauail")),
    ("phonemize", &["ꠀꠋꠞꠦꠎꠤ ꠪ ꠐꠦꠈꠣ", "syl"], Some("aŋɾezi , ʈexa")),
    ("phonemize", &["ꠔꠣꠘ ꠙꠄꠖꠣ ꠅꠄ৷ ꠔꠣꠘ ꠛꠠ", "syl"], Some("t̪an ɸɔed̪a ɔe . t̪an bɔɽ")),
    ("phonemize", &["ꠔꠣꠘ ꠙꠄꠖꠣ ꠅꠄ⁕ ꠔꠣꠘ ꠛꠠ", "syl"], Some("t̪an ɸɔed̪a ɔe . t̪an bɔɽ")),
    ("phonemize", &["ꠈꠦꠁꠞ ꠅꠁꠛꠅ. ꠀꠝꠞ", "syl"], Some("xeiɾ ɔibɔ . amɔɾ")),
    ("normalizeSylheti", &["১,০০,০০০"], Some("১০০০০০")),
    ("normalizeSylheti", &["২২,২২৪,২৮২"], Some("২২২২৪২৮২")),
    ("phonemize", &["১,০০,০০০ ꠢꠦꠇ꠆ꠐꠞ", "syl"], Some("ex lax ɦexʈɔɾ")),
    ("normalizeSylheti", &["ꠛꠍꠞ ৫, ꠀꠞ"], Some("ꠛꠍꠞ ৫, ꠀꠞ")),
    ("phonemize", &["১২.৫", "syl"], Some("baɾɔ d̪ɔʃmix ɸas")),
    ("normalizeSylheti", &["doi=10.1016/j.langsci.2018.06.010"], Some("doi=10.1016/j.langsci.2018.06.010")),
    ("normalizeSylheti", &["১০-১৪ ꠍꠦ.ꠝꠤ."], Some("১০ ꠔꠘꠦ ১৪ ꠍꠦꠝꠤ")),
    ("normalizeSylheti", &["১৯,৬০০-২০,০০০"], Some("১৯৬০০ ꠔꠘꠦ ২০০০০")),
    ("normalizeSylheti", &["3-3 ꠉꠂꠟꠦ"], Some("3-3 ꠉꠂꠟꠦ")),
    ("normalizeSylheti", &["4-2 ꠛꠦꠛꠗꠣꠘꠦ"], Some("4-2 ꠛꠦꠛꠗꠣꠘꠦ")),
    ("normalizeSylheti", &["১৯৭০-ꠞ ꠖꠡꠇ"], Some("১৯৭০-ꠞ ꠖꠡꠇ")),
    ("phonemize", &["১০০%", "syl"], Some("ex ʃɔ ʃɔt̪aŋɔʃ")),
    ("normalizeSylheti", &["১৮°ꠍꠦ."], Some("১৮ ꠒꠤꠉ꠆ꠞꠤ ꠍꠦꠟꠍꠤꠀꠍ")),
    ("normalizeSylheti", &["৬৪.৪° ꠚꠣ."], Some("৬৪ ꠖꠡꠝꠤꠇ ৪ ꠒꠤꠉ꠆ꠞꠤ ꠚꠣꠞꠦꠘꠢꠣꠁꠐ")),
    ("normalizeSylheti", &["২০°C"], Some("২০ ꠒꠤꠉ꠆ꠞꠤ ꠍꠦꠟꠍꠤꠀꠍ")),
    ("normalizeSylheti", &["২০℃"], Some("২০℃")),
    ("phonemize", &["৳৫", "syl"], Some("ɸas ʈexa")),
    ("normalizeSylheti", &["৳১ ꠨ ৳২ ꠀꠞ ৳৫ ꠐꠦꠈꠣꠞ ꠘꠧꠐ"], Some("১ ꠐꠦꠈꠣ ꠨ ২ ꠐꠦꠈꠣ ꠀꠞ ৫ ꠐꠦꠈꠣꠞ ꠘꠧꠐ")),
    ("normalizeSylheti", &["-২৭৩.১৫° ꠍꠦ."], Some("-২৭৩ ꠖꠡꠝꠤꠇ ১৫ ꠒꠤꠉ꠆ꠞꠤ ꠍꠦꠟꠍꠤꠀꠍ")),
    ("normalizeSylheti", &["ꠝূꠟ꠆ꠎꠝꠣꠘ"], Some("ꠝꠥꠟ꠆ꠎꠝꠣꠘ")),
    ("normalizeSylheti", &["ꠙꠞꠤꠝꠣণꠦ"], Some("ꠙꠞꠤꠝꠣꠘꠦ")),
    ("normalizeSylheti", &["ꠃৎꠙꠣꠖꠘ"], Some("ꠃꠔ꠆ꠙꠣꠖꠘ")),
    ("normalizeSylheti", &["ꠡꠧꠒꠤꠎ়ꠣꠝ"], Some("ꠡꠧꠒꠤꠀꠝ")),
    ("phonemize", &["ꠝূꠟ꠆ꠎꠝꠣꠘ", "syl"], Some("mulzɔman")),
    ("normalizeSylheti", &["ꠙ꠆ꠞꠜৃꠔꠤ"], Some("ꠙ꠆ꠞꠜꠞꠤꠔꠤ")),
    ("phonemize", &["ꠙ꠆ꠞꠜৃꠔꠤ", "syl"], Some("ɸɾɔbɾit̪i")),
    ("phonemize", &["ꠙ꠆ꠞꠜꠞꠤꠔꠤ", "syl"], Some("ɸɾɔbɾit̪i")),
    ("normalizeSylheti", &["ꠛ꠆ꠎꠛꠢৃꠔ"], Some("ꠛ꠆ꠎꠛꠢꠞꠤꠔ")),
    ("normalizeSylheti", &["ꠛꠦꠋꠉꠟꠤ ꠝꠣꠔꠖꠤ ꠪ বাংলাদেশ"], Some("ꠛꠦꠋꠉꠟꠤ ꠝꠣꠔꠖꠤ ꠪ বাংলাদেশ")),
    ("phonemize", &["২৫ ꠝꠤ.ꠉ꠆ꠞꠣ.", "syl"], Some("ɸɔsiʃ miɡɾa")),
    ("normalizeSylheti", &["ꠛꠣꠢꠣꠖꠥꠞ ꠒꠣ. ꠝꠃꠟꠧꠜꠤ"], Some("ꠛꠣꠢꠣꠖꠥꠞ ꠒꠣ. ꠝꠃꠟꠧꠜꠤ")),
    ("normalizeSylheti", &["ꠖꠇ꠆\u{200c}ꠈꠤꠘ"], Some("ꠖꠇ꠆ꠈꠤꠘ")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_sylheti().unwrap();
        let mut n = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => e.phonemize_word(&js(args[0])).to_string_lossy(),
                "normalizeSylheti" => normalize_sylheti(&js(args[0])).to_string_lossy(),
                "phonemize" => crate::phonemize(args[0], args[1]).unwrap(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            n += 1;
        }
        assert_eq!(n, 48);
    }

    /// An Arabic-script or Hebrew run inside Sylheti is read by the `ar` / `he` engine in the TS. Until those are
    /// ported the run is dropped and recorded as port-pending (the syl golden's five differing rows: four Arabic or
    /// Persian glosses, one Hebrew); this flips when each lands.
    #[test]
    fn arabic_and_hebrew_runs_are_pending_until_ported() {
        crate::phonemize("ꠀꠞꠛꠤ: بيت ꠀꠍꠦ", "syl").unwrap();
        crate::phonemize("ꠢꠣꠅꠀ (Hebrew: חַוָּה)", "syl").unwrap();
        let pending = crate::registry::port_pending();
        for target in ["ar", "he"] {
            assert_eq!(
                pending.iter().any(|p| p == target),
                !crate::LANGUAGES.contains(&target),
                "{target}: {pending:?}"
            );
        }
    }
}
