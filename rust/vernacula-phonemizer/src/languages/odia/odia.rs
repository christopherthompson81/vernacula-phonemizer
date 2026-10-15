//! Native Odia phonemizer: the generic abugida G2P with no inherent-vowel deletion, geminate length, ଳ୍ଳ → [ɭː] and
//! first-syllable stress, Indic cardinals, clause marks and embedded Latin runs, driven by `odia.jsonc`.
//! Ported from src/languages/odia/odia.ts — see that file for the corpus evidence.

use std::sync::{Arc, OnceLock};

use super::manifest::{OdiaManifest, try_manifest};
use super::normalize::{OdiaNormalizer, make_odia_normalizer};
use crate::core::abugida::{AbugidaG2p, make_abugida_g2p};
use crate::core::clauses::assemble_clauses;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, is_safe_integer, js, js_number};
use crate::core::numbers::{indic_number_words, render_number, spell_digits};
use crate::core::phonology::load_shared_phonology;
use crate::core::provenance::{Form, normalize};
use crate::core::unicode::fold_native_digits;
use crate::js_re;
use crate::registry::{Engine, PhonemizeError, read_as_english};

/// Odia block EXCLUDING the digits ୦-୯ (matched by the digit branch).
const ODIA_WORD: &str = "଀-୥୰-୷";
// Generated from the TS object literal (key order preserved).
const ODIA_DIGITS: [(&str, &str); 10] = [
    ("୦", "0"),
    ("୧", "1"),
    ("୨", "2"),
    ("୩", "3"),
    ("୪", "4"),
    ("୫", "5"),
    ("୬", "6"),
    ("୭", "7"),
    ("୮", "8"),
    ("୯", "9"),
];
const VOWEL: &str = "aeiouɔɾ";

/// Foreign-run phonemizer (embedded Latin → e.g. en), injected by the registry.
pub type ForeignPhonemizer = Arc<dyn Fn(&JsString) -> JsString + Send + Sync>;

pub struct OdiaPhonemizer {
    def: &'static OdiaManifest,
    g2p: AbugidaG2p,
    normalize: OdiaNormalizer,
    token_re: JsRegex,
    foreign: Option<ForeignPhonemizer>,
}

fn to_ascii(d: &JsString) -> JsString {
    let mut out = JsString::new();
    for c in d.code_point_strings() {
        match ODIA_DIGITS.iter().find(|(k, _)| js(k) == c) {
            Some((_, a)) => out.push_str(&js(a)),
            None => out.push_str(&c),
        }
    }
    out
}

impl OdiaPhonemizer {
    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        let norm = normalize(word, Form::Nfc);
        let mut x = self.g2p.g2p(&norm);
        x = js_re!(
            r"(t͡ʃʰ|d͡ʒʱ|t͡ʃ|d͡ʒ|t̪ʰ|d̪ʱ|ʈʰ|ɖʱ|ɡʱ|kʰ|t̪|d̪|n̪|[kɡpbmnlʃʂsʈɖɳɭɲŋjɦhʋwɾr])\1(?!͡)",
            "gu"
        )
        .replace(&x, &js("$1ː"));
        x = js_re!(r"ː([ʰʱ])", "gu").replace(&x, &js("$1ː"));
        x = js_re!(r"ɭl", "gu").replace(&x, &js("ɭː"));
        static FIRST_VOWEL: OnceLock<JsRegex> = OnceLock::new();
        let first = FIRST_VOWEL.get_or_init(|| JsRegex::new(&format!("[{VOWEL}]"), "u").unwrap());
        if let Some(m) = first.exec(&x) {
            let at = m.index() as isize;
            x = x
                .slice(0, Some(at))
                .concat(&js("ˈ"))
                .concat(&x.slice(at, None));
        }
        normalize(&x, Form::Nfc)
    }

    /// `number(digits)`.
    pub fn number(&self, digits: &JsString) -> JsString {
        let word = |w: &str| self.phonemize_word(&js(w)).to_string_lossy();
        let ascii = to_ascii(digits);
        let n = js_number(&ascii);
        if !is_safe_integer(n) {
            return js(&spell_digits(
                &ascii.to_string_lossy(),
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

    /// `normalize(input)`, the pre-tokenizer pass alone (the per-module differential calls it).
    pub fn normalize(&self, input: &JsString) -> JsString {
        (self.normalize)(input)
    }

    /// `text(input)`.
    pub fn text(&self, input: &JsString) -> JsString {
        let prepared = (self.normalize)(&fold_native_digits(input));
        assemble_clauses(&prepared, &self.token_re, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                sink.emit(&self.phonemize_word(&w));
            } else if let Some(latin) = m.group(2, s) {
                if let Some(f) = &self.foreign {
                    sink.emit(&f(&latin));
                }
            } else if let Some(d) = m.group(3, s) {
                sink.emit(&self.number(&d));
            } else if let Some(p) = m.group(4, s)
                && let Some(mk) = self.def.clause_punctuation.get(&p.to_string_lossy())
                && !mk.is_empty()
            {
                sink.pause(&js(mk));
            }
        })
    }
}

/// `createOdia(foreign)`.
pub fn create_odia(foreign: Option<ForeignPhonemizer>) -> Result<OdiaPhonemizer, String> {
    let def = try_manifest()?;
    let digit_class: String = std::iter::once("0-9")
        .chain(ODIA_DIGITS.iter().map(|(k, _)| *k))
        .collect();
    let token_re = JsRegex::new(
        &format!(
            r"([{ODIA_WORD}]+)|(\p{{Script=Latin}}[\p{{Script=Latin}}\p{{M}}]*)|([{digit_class}]+)|([।॥.?!,;:])"
        ),
        "gu",
    )
    .map_err(|e| format!("odia token pattern: {e}"))?;
    Ok(OdiaPhonemizer {
        def,
        g2p: make_abugida_g2p(&def.abugida, load_shared_phonology()?),
        normalize: make_odia_normalizer(&def.numbers)?,
        token_re,
        foreign,
    })
}

impl Engine for OdiaPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(OdiaPhonemizer::text(self, input))
    }
}

/// The registry's `or` arm: `createOdia(readAsEnglish)`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    let foreign: ForeignPhonemizer = Arc::new(read_as_english);
    Ok(Arc::new(
        create_odia(Some(foreign)).map_err(PhonemizeError::Data)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/odia.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["ଓଡ଼ିଆ"], Some("ˈoɽia")),
    ("phonemizeWord", &["ଘର"], Some("ɡʱˈɔɾɔ")),
    ("phonemizeWord", &["ଭାରତ"], Some("bʱˈaɾɔt̪ɔ")),
    ("phonemizeWord", &["ଭାଷା"], Some("bʱˈasa")),
    ("phonemizeWord", &["କଳିଙ୍ଗ"], Some("kˈɔɭiŋɡɔ")),
    ("phonemizeWord", &["ନୂତନ"], Some("n̪ˈut̪ɔn̪ɔ")),
    ("phonemizeWord", &["ମୁଁ"], Some("mˈũ")),
    ("phonemizeWord", &["ପାଞ୍ଚ"], Some("pˈaɲt͡ʃɔ")),
    ("phonemizeWord", &["ଏବଂ"], Some("ˈebɔ̃")),
    ("getPhonemizer(\"or\").text", &["3"], Some("t̪ˈin̪i")),
    ("getPhonemizer(\"or\").text", &["୩"], Some("t̪ˈin̪i")),
    ("getPhonemizer(\"or\").text", &["100"], Some("ˈekɔ sˈɔɦɔ")),
    ("getPhonemizer(\"or\").text", &["21"], Some("ˈekoisɔ")),
    ("getPhonemizer(\"or\").text", &["56"], Some("t͡ʃʰˈɔpɔn̪ɔ")),
    ("getPhonemizer(\"or\").text", &["1947"], Some("ˈekɔ ɦˈɔd͡ʒaɾɔ n̪ˈɔɔ sˈɔɦɔ sˈɔt̪ɔt͡ʃaɭisɔ")),
    ("getPhonemizer(\"or\").text", &["93"], Some("t̪ˈejan̪ɔbe")),
    ("getPhonemizer(\"or\").text", &["68"], Some("ˈaʈʰɔ sˈaʈʰie")),
    ("getPhonemizer(\"or\").text", &["ନାହିଁ I"], Some("n̪ˈaɦĩ .")),
    ("getPhonemizer(\"or\").text", &["ହୋଇଛିI"], Some("ɦˈoit͡ʃʰi .")),
    ("getPhonemizer(\"or\").text", &["7,000"], Some("sˈat̪ɔ ɦˈɔd͡ʒaɾɔ")),
    ("getPhonemizer(\"or\").text", &["1.2"], Some("ˈekɔ d̪ˈui")),
    ("getPhonemizer(\"or\").text", &["11:29"], Some("ˈeɡaɾɔ ˈɔɳɔt̪iɾisɔ")),
    ("getPhonemizer(\"or\").text", &["10:00ଟା"], Some("d̪ˈɔsɔ ʈˈa")),
    ("getPhonemizer(\"or\").text", &["୩:୨"], Some("t̪ˈin̪i , d̪ˈui")),
    ("getPhonemizer(\"or\").text", &["18ଶ ଶତାବ୍ଦୀ"], Some("ˈɔʈʰɔɾɔsɔ sˈɔt̪abd̪i")),
    ("getPhonemizer(\"or\").text", &["1000ତମ"], Some("ˈekɔ ɦˈɔd͡ʒaɾɔt̪ɔmɔ")),
    ("getPhonemizer(\"or\").text", &["18ଶହ ଶତାବ୍ଦୀ"], Some("ˈɔʈʰɔɾɔ sˈɔɦɔ sˈɔt̪abd̪i")),
    ("getPhonemizer(\"or\").text", &["93%"], Some("t̪ˈejan̪ɔbe pˈɾɔt̪isɔt̪ɔ")),
    ("getPhonemizer(\"or\").text", &["$5"], Some("pˈaɲt͡ʃɔ ɖˈɔlaɾɔ")),
    ("getPhonemizer(\"or\").text", &["US$14.7 ବିଲିଅନ୍"], Some("t͡ʃˈɔud̪ɔ sˈat̪ɔ bˈiliɔn̪ ɖˈɔlaɾɔ")),
    ("getPhonemizer(\"or\").text", &["70km/h"], Some("sˈɔt̪uɾi kˈilomiʈɔɾɔ pˈɾɔt̪i ɡʱˈɔɳʈa")),
    ("getPhonemizer(\"or\").text", &["3136 mm2"], Some("t̪ˈin̪i ɦˈɔd͡ʒaɾɔ ˈekɔ sˈɔɦɔ t͡ʃʰˈɔt̪isɔ bˈɔɾɡɔ mˈilimiʈɔɾɔ")),
    ("getPhonemizer(\"or\").text", &["1600 କି.ମି."], Some("ˈekɔ ɦˈɔd͡ʒaɾɔ t͡ʃʰˈɔɔ sˈɔɦɔ kˈilomiʈɔɾɔ")),
    ("getPhonemizer(\"or\").text", &["160କିମି/ଘଣ୍ଟା"], Some("ˈekɔ sˈɔɦɔ sˈaʈʰie kˈilomiʈɔɾɔ pˈɾɔt̪i ɡʱˈɔɳʈa")),
    ("getPhonemizer(\"or\").text", &["ଡଃ. ଏହୁଦ୍"], Some("ɖˈakt̪ɔɾɔ ˈeɦud̪")),
    ("getPhonemizer(\"or\").text", &["ଏବଂ/କିମ୍ବା"], Some("ˈebɔ̃ kˈimba")),
    ("getPhonemizer(\"or\").text", &["ମୂଲ୍ୟ ପ୍ରାୟ ¥7,000 ହେବା ସହିତ।"], Some("mˈuljɔ pˈɾajɔ sˈat̪ɔ ɦˈɔd͡ʒaɾɔ jˈen̪ɔ ɦˈeba sˈɔɦit̪ɔ .")),
    ("getPhonemizer(\"or\").text", &["ପାଲମେରାସରୁ £27 ନିୟୁତ ଦେୟ ସହିତ।"], Some("pˈalɔmeɾasɔɾu sˈɔt̪aisɔ n̪ˈijut̪ɔ pˈauɳɖɔ d̪ˈejɔ sˈɔɦit̪ɔ .")),
    ("getPhonemizer(\"or\").text", &["ସମୟ ପ୍ରାୟ 11:00 (UTC+1)ରେ"], Some("sˈɔmɔjɔ pˈɾajɔ ˈeɡaɾɔ jˈuː tʰˈiː sˈiː plˈɔs ˈekɔ ˈɾe")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_odia(None).unwrap();
        let mut n = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => e.phonemize_word(&js(args[0])).to_string_lossy(),
                "getPhonemizer(\"or\").text" => crate::registry::phonemize_in("or", &js(args[0]))
                    .unwrap()
                    .to_string_lossy(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            n += 1;
        }
        assert_eq!(n, 39);
    }

    /// A Bengali, Odia or Syloti Nagri run inside another host reaches its engine through the script reader (the
    /// router targets bn, or and syl). Readings are the TS engine's, printed by running it, not typed.
    #[test]
    fn group_scripts_inside_other_hosts_are_read_by_their_engines() {
        #[rustfmt::skip]
        let rows: &[(&str, &str, &str)] = &[
        ("I said আমি ভালো to them", "en", "aᶦ sˈɛd ami bʱalo tʰuː ðˈɛm"),
        ("I said ଓଡ଼ିଆ ଭାଷା to them", "en", "aᶦ sˈɛd ˈoɽia bʱˈasa tʰuː ðˈɛm"),
        ("I said ꠍꠤꠟꠐꠤ to them", "en", "aᶦ sˈɛd silʈi tʰuː ðˈɛm"),
        ("मैं আমি ভালো कहता हूँ", "hi", "mˈɛː̃ ami bʱalo kˈəɦt̪aː ɦˈuː̃"),
        ];
        for (text, lang, want) in rows {
            assert_eq!(crate::phonemize(text, lang).unwrap(), *want, "{text}");
        }
        let pending = crate::registry::port_pending();
        assert!(
            ["bn", "or", "syl"]
                .iter()
                .all(|l| !pending.iter().any(|p| p == l)),
            "{pending:?}"
        );
    }
}
