//! Native Assamese phonemizer: the Bengali maker driven by `assamese.jsonc`, with the Assamese pre-pass before its
//! normalizer and a geminate collapse over the Assamese consonants the Bengali set does not cover.
//! Ported from src/languages/assamese/assamese.ts — see that file for the corpus evidence.

use std::sync::Arc;

use super::normalize::{normalize_assamese, try_def};
use crate::core::js_string::{JsString, js};
use crate::core::phonology::load_shared_phonology;
use crate::core::trace::note_rewrite;
use crate::js_re;
use crate::languages::bengali::bengali::{ForeignPhonemizer, NativeBengali, make_native_bengali};
use crate::registry::{Engine, PhonemizeError, read_as_english};

/// `collapseGeminates(ipa)`.
fn collapse_geminates(ipa: &JsString) -> JsString {
    let x = js_re!(r"(tʰ|dʱ|[tdszxpbkɡmnlŋ])\1", "gu").replace(ipa, &js("$1ː"));
    js_re!(r"ː([ʰʱ])", "gu").replace(&x, &js("$1ː"))
}

/// `wrap({ ...base, text: (i) => base.text(normalizeAssamese(i)) })`.
pub struct Assamese(NativeBengali);

impl Assamese {
    pub fn word(&self, w: &JsString) -> JsString {
        collapse_geminates(&self.0.word(w, None))
    }

    pub fn word_rules(&self, w: &JsString) -> JsString {
        collapse_geminates(&self.0.word_rules(w))
    }

    pub fn number(&self, d: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(collapse_geminates(&self.0.number(d, None)?))
    }

    pub fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        let pre = self.0.text(
            &normalize_assamese(input).map_err(PhonemizeError::Data)?,
            None,
        )?;
        let out = collapse_geminates(&pre);
        // ⚠ NOT positional (#1150): it deletes, so the trace withholds its output spans rather than shifting them.
        note_rewrite("collapse-geminates", &pre, &out, false);
        Ok(out)
    }
}

/// `createAssamese(foreign)`.
pub fn create_assamese(foreign: Option<ForeignPhonemizer>) -> Result<Assamese, String> {
    Ok(Assamese(make_native_bengali(
        try_def()?,
        load_shared_phonology()?,
        foreign,
    )?))
}

impl Engine for Assamese {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Assamese::text(self, input)
    }
}

/// The registry's `as` arm: `createAssamese(readAsEnglish)`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    let foreign: ForeignPhonemizer = Arc::new(read_as_english);
    Ok(Arc::new(
        create_assamese(Some(foreign)).map_err(PhonemizeError::Data)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/assamese.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["অসম"], Some("ɔxɔm")),
    ("phonemizeWord", &["সাত"], Some("xat")),
    ("phonemizeWord", &["দেশ"], Some("dex")),
    ("phonemizeWord", &["শিশু"], Some("xixu")),
    ("phonemizeWord", &["চাউল"], Some("saul")),
    ("phonemizeWord", &["জীৱন"], Some("ziwɔn")),
    ("phonemizeWord", &["ভাত"], Some("bʱat")),
    ("phonemizeWord", &["ৰাতি"], Some("ɹati")),
    ("phonemizeWord", &["আৰু"], Some("aɹu")),
    ("phonemizeWord", &["মানুহ"], Some("manuɦ")),
    ("phonemizeWord", &["গৰু"], Some("ɡɔɹu")),
    ("phonemizeWord", &["চকৰি"], Some("sɔkɔɹi")),
    ("getPhonemizer(\"as\").text", &["7"], Some("xat")),
    ("getPhonemizer(\"as\").text", &["100"], Some("ek ex")),
    ("normalizeAssamese", &["11শ শতিকা"], Some("একাদশ শতিকা")),
    ("normalizeAssamese", &["18শ শতিকাত"], Some("অষ্টাদশ শতিকাত")),
    ("normalizeAssamese", &["1শ শতাংশ"], Some("একশ শতাংশ")),
    ("getPhonemizer(\"as\").text", &["190 নং স্থান"], Some("ek ex nɔbːɔi nɔmbɔɹ xtʰan")),
    ("getPhonemizer(\"as\").text", &["60নং আছিল"], Some("xatʰi nɔmbɔɹ asil")),
    ("getPhonemizer(\"as\").text", &["1,000তম"], Some("ek ɦazaɹɔtɔm")),
    ("getPhonemizer(\"as\").text", &["ইউ.এছ.অ.চি ৰ"], Some("iu es ɔ si ɹɔ")),
    ("getPhonemizer(\"as\").text", &["George W. Bush"], Some("d͡ʒˈɔːɹd͡ʒ dˈʌbɫ̩juː bˈʊʃ")),
    ("getPhonemizer(\"as\").text", &["802.11এন মানদণ্ড"], Some("atʰ ex dui bindu eɡʱaɹ en manɔdɔndo")),
    ("getPhonemizer(\"as\").text", &["AUD$৪৫ মিলিয়ন"], Some("pãs sɔlːix milijɔn ɔxtɹelijan dɔlaɹ")),
    ("getPhonemizer(\"as\").text", &["US$30"], Some("tɹix ameɹikan dɔlaɹ")),
    ("getPhonemizer(\"as\").text", &["$১৪.৭ বিলিয়ন আমেৰিকান ডলাৰ"], Some("sɔidʱːo dɔxɔmik xat bilijɔn ameɹikan dɔlaɹ")),
    ("getPhonemizer(\"as\").text", &["B&B য়ে"], Some("bˈiː aɹu bˈiː je")),
    ("getPhonemizer(\"as\").text", &["II বিশ্ব যুদ্ধ"], Some("ditij bixːo zudʱːo")),
    ("getPhonemizer(\"as\").text", &["II বিশ্ব যুদ্ধৰ সময়ত"], Some("ditij bixːo zudʱːɔɹ xɔmɔjɔt")),
    ("getPhonemizer(\"as\").text", &["6.5km"], Some("sɔj dɔxɔmik pãs kilomitaɹ")),
    ("getPhonemizer(\"as\").text", &["NASA. Bush"], Some("nˈæsə . bˈʊʃ")),
    ("normalizeAssamese", &["৯০শত"], Some("৯০শত")),
    ("getPhonemizer(\"as\").text", &["৯০শত"], Some("nɔbːɔi xɔt")),
    ("getPhonemizer(\"as\").text", &["19,500 km²"], Some("unɔix ɦazaɹ pãs ex bɔɹɡo kilomitaɹ")),
    ("getPhonemizer(\"as\").text", &["5 cm"], Some("pãs sentimitaɹ")),
    ("getPhonemizer(\"as\").text", &["৩৫mm"], Some("pãs tɹix milimitaɹ")),
    ("getPhonemizer(\"as\").text", &["10 km"], Some("dɔɦ kilomitaɹ")),
    ("getPhonemizer(\"as\").text", &["5 kg"], Some("pãs kiloɡɹam")),
    ("getPhonemizer(\"as\").text", &["50 km/h"], Some("pɔnsax kilomitaɹ pɹɔti ɡʱɔnta")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_assamese(None).unwrap();
        let mut n = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => e.word(&js(args[0])).to_string_lossy(),
                "normalizeAssamese" => normalize_assamese(&js(args[0])).unwrap().to_string_lossy(),
                "getPhonemizer(\"as\").text" => crate::registry::phonemize_in("as", &js(args[0]))
                    .unwrap()
                    .to_string_lossy(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            n += 1;
        }
        assert_eq!(n, 39);
    }
}
