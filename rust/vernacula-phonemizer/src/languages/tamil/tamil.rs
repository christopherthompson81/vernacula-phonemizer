//! Tamil phonemizer: the shared abugida G2P (tamil.jsonc), then the Dravidian plosive voicing allophony over phoneme
//! units and the two-level (primary + secondary) stress; sandhi-fused cardinals and clause marks.
//! Ported from src/languages/tamil/tamil.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::Arc;

use super::manifest::{TamilManifest, try_manifest};
use super::normalize::{TamilNormalizer, make_tamil_normalizer};
use super::numbers::number_to_words;
use crate::core::abugida::{AbugidaG2p, make_abugida_g2p};
use crate::core::clauses::assemble_clauses;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::phonology::load_shared_phonology;
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

const TIE: &str = "͡";
/// Dental, nasalisation, superscript i/u.
const COMBINING: [&str; 4] = ["̪", "̃", "ᶦ", "ᶷ"];
const VOWELS: &str = "aɐɪiʊueo";

/// `isVowel(u)`: the unit's FIRST CODE UNIT is one of the vowel letters.
fn is_vowel(u: &JsString) -> bool {
    u.char_code_at(0)
        .is_some_and(|c| js(VOWELS).units().contains(&c))
}

/// `segment(ipa)`: split into phoneme units (a base character with its combining marks, tie and length).
fn segment(ipa: &JsString) -> Vec<JsString> {
    let ch = ipa.code_point_strings();
    let (tie, len) = (js(TIE), js("ː"));
    let combining: Vec<JsString> = COMBINING.iter().map(|c| js(c)).collect();
    let mut units = Vec::new();
    let mut i = 0;
    while i < ch.len() {
        let mut u = ch[i].clone();
        i += 1;
        loop {
            match ch.get(i) {
                Some(c) if *c == tie => {
                    u.push_str(c);
                    if let Some(n) = ch.get(i + 1) {
                        u.push_str(n);
                    }
                    i += 2;
                }
                Some(c) if combining.contains(c) || *c == len => {
                    u.push_str(c);
                    i += 1;
                }
                _ => break,
            }
        }
        units.push(u);
    }
    units
}

pub struct TamilPhonemizer {
    def: &'static TamilManifest,
    g2p: AbugidaG2p,
    normalizer: TamilNormalizer,
    nasal_units: HashSet<JsString>,
    voiceless_block: HashSet<JsString>,
    token_re: &'static JsRegex,
}

impl TamilPhonemizer {
    fn voice(&self, u: &JsString) -> Option<JsString> {
        self.def
            .voicing
            .voice
            .get(&u.to_string_lossy())
            .map(|v| js(v))
    }

    /// `allophony(units)`: the Dravidian plosive allophony over the base phoneme units.
    fn allophony(&self, units: &[JsString]) -> Vec<JsString> {
        let mut out = Vec::new();
        let mut i = 0;
        while i < units.len() {
            let mut u = units[i].clone();
            let prev = if i > 0 { units.get(i - 1) } else { None };
            let next = units.get(i + 1);
            if u == js("r") && next == Some(&js("t͡ɕ")) {
                out.push(js("t͡ɕː"));
                i += 2;
                continue;
            }
            if !is_vowel(&u) && next == Some(&u) {
                out.push(if u == js("r") {
                    js("ʈr")
                } else {
                    u.concat(&js("ː"))
                });
                i += 2;
                continue;
            }
            if u == js("ɾ") && next.is_none_or(|n| !is_vowel(n)) {
                u = js("r");
            }
            let prev_voiceless = prev.is_none_or(|p| self.voiceless_block.contains(p));
            let post_nasal = prev.is_some_and(|p| self.nasal_units.contains(p));
            let onset = next.is_some_and(is_vowel);
            if u == js("t͡ɕ") {
                if post_nasal {
                    u = js("d͡ʒ");
                }
            } else if let Some(v) = self.voice(&u)
                && !prev_voiceless
                && (onset || next.is_none() || u == js("ʈ"))
            {
                u = v;
            }
            out.push(u);
            i += 1;
        }
        out
    }

    /// `stress(units)`: ˈ on the first nucleus; ˌ on even nucleus indices ≥2 that are not the last.
    fn stress(units: &[JsString]) -> JsString {
        let last = units.iter().rposition(is_vowel);
        let mut ni: i64 = -1;
        let mut res = JsString::new();
        for (i, u) in units.iter().enumerate() {
            if is_vowel(u) {
                ni += 1;
                if ni == 0 {
                    res.push_str(&js("ˈ"));
                } else if ni >= 2 && ni % 2 == 0 && Some(i) != last {
                    res.push_str(&js("ˌ"));
                }
            }
            res.push_str(u);
        }
        res
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        Self::stress(&self.allophony(&segment(&self.g2p.g2p(word))))
    }

    /// `normalizeTamil(input)` alone (the per-module differential calls it).
    pub fn normalize(&self, input: &JsString) -> JsString {
        self.normalizer.normalize(input)
    }

    /// `text(input)`.
    pub fn text(&self, input: &JsString) -> JsString {
        let prepared = self.normalizer.normalize(input);
        assemble_clauses(&prepared, self.token_re, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                sink.emit(&self.phonemize_word(&w));
            } else if let Some(d) = m.group(2, s) {
                let words = number_to_words(js_number(&d), Some(&d), &self.def.numbers);
                for wd in words.split(&js(" ")) {
                    sink.emit(&self.phonemize_word(&wd));
                }
            } else if let Some(p) = m.group(3, s)
                && let Some(mk) = self.def.clause_punctuation.get(&p.to_string_lossy())
                && !mk.is_empty()
            {
                sink.pause(&js(mk));
            }
        })
    }
}

/// `createTamil()`.
pub fn create_tamil() -> Result<TamilPhonemizer, String> {
    let def = try_manifest()?;
    Ok(TamilPhonemizer {
        def,
        g2p: make_abugida_g2p(&def.abugida, load_shared_phonology()?),
        normalizer: make_tamil_normalizer()?,
        nasal_units: def.voicing.nasals.iter().map(|s| js(s)).collect(),
        voiceless_block: def.voicing.voiceless_block.iter().map(|s| js(s)).collect(),
        token_re: js_re!(r"([஀-௿]+)|(\d+)|([.!?…,;:])", "gu"),
    })
}

impl Engine for TamilPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(TamilPhonemizer::text(self, input))
    }
}

/// The registry's `ta` arm: `createTamil()`.
pub fn engine() -> Result<Arc<dyn Engine>, PhonemizeError> {
    Ok(Arc::new(create_tamil().map_err(PhonemizeError::Data)?))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::languages::tamil::numbers::ordinal_stem;

    // Every call test/tamil.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["தமிழ்"], Some("t̪ˈɐmɪɻ")),
    ("phonemizeWord", &["வணக்கம்"], Some("ʋˈɐɳɐkːɐm")),
    ("phonemizeWord", &["இரண்டு"], Some("ˈɪɾɐɳɖʊ")),
    ("phonemizeWord", &["நன்றி"], Some("n̪ˈɐnrɪ")),
    ("phonemizeWord", &["அது"], Some("ˈad̪ʊ")),
    ("phonemizeWord", &["மகன்"], Some("mˈɐɡɐn")),
    ("phonemizeWord", &["தம்பி"], Some("t̪ˈɐmbɪ")),
    ("phonemizeWord", &["பசி"], Some("pˈɐt͡ɕɪ")),
    ("phonemizeWord", &["பஞ்சு"], Some("pˈɐɲd͡ʒʊ")),
    ("phonemizeWord", &["கற்று"], Some("kˈɐʈrʊ")),
    ("phonemizeWord", &["அவர்"], Some("ˈaʋɐr")),
    ("phonemizeWord", &["அரசியல்"], Some("ˈaɾɐt͡ɕˌɪjɐl")),
    ("phonemize", &["5", "ta"], Some("ˈaᶦn̪d̪ʊ")),
    ("phonemize", &["10", "ta"], Some("pˈɐt̪ːʊ")),
    ("numberToWords", &["11"], Some("பதினொன்று")),
    ("numberToWords", &["12"], Some("பன்னிரண்டு")),
    ("numberToWords", &["19"], Some("பத்தொன்பது")),
    ("numberToWords", &["21"], Some("இருபத்தி ஒன்று")),
    ("numberToWords", &["20"], Some("இருபது")),
    ("numberToWords", &["99"], Some("தொண்ணூற்றி ஒன்பது")),
    ("numberToWords", &["200"], Some("இருநூறு")),
    ("numberToWords", &["300"], Some("முந்நூறு")),
    ("numberToWords", &["900"], Some("தொள்ளாயிரம்")),
    ("numberToWords", &["101"], Some("நூற்றி ஒன்று")),
    ("numberToWords", &["948"], Some("தொள்ளாயிரத்து நாற்பத்தி எட்டு")),
    ("numberToWords", &["1000"], Some("ஆயிரம்")),
    ("numberToWords", &["5000"], Some("ஐயாயிரம்")),
    ("numberToWords", &["10000"], Some("பத்தாயிரம்")),
    ("numberToWords", &["1995"], Some("ஆயிரத்து தொள்ளாயிரத்து தொண்ணூற்றி ஐந்து")),
    ("numberToWords", &["2243"], Some("இரண்டாயிரத்து இருநூற்றி நாற்பத்தி மூன்று")),
    ("numberToWords", &["100000"], Some("ஒரு லட்சம்")),
    ("numberToWords", &["5000000"], Some("ஐம்பது லட்சம்")),
    ("numberToWords", &["783562"], Some("ஏழு லட்சத்து எண்பத்தி மூவாயிரத்து ஐந்நூற்றி அறுபத்தி இரண்டு")),
    ("numberToWords", &["10000000"], Some("ஒரு கோடி")),
    ("ordinalStem", &["ஒன்று"], Some("ஒன்ற")),
    ("ordinalStem", &["நான்கு"], Some("நான்க")),
    ("ordinalStem", &["பத்து"], Some("பத்த")),
    ("ordinalStem", &["தொண்ணூறு"], Some("தொண்ணூற")),
    ("ordinalStem", &["ஆயிரம்"], Some("ஆயிரம")),
    ("ordinalStem", &["தொள்ளாயிரம்"], Some("தொள்ளாயிரம")),
    ("ordinalStem", &["கோடி"], Some("கோடிய")),
    ("normalizeTamil", &["2,243"], Some("2243")),
    ("normalizeTamil", &["5,000,000"], Some("5000000")),
    ("normalizeTamil", &["7,83,562"], Some("783562")),
    ("normalizeTamil", &["11, 12 வது"], Some("11, பன்னிரண்டாவது")),
    ("phonemize", &["2,243", "ta"], Some("ˈɪɾɐɳɖˌaːjɪɾˌɐt̪ːʊ ˈɪɾʊn̪ˌuːʈrɪ n̪ˈaːrpɐt̪ːɪ mˈuːnrʊ")),
    ("normalizeTamil", &["2019-ஆம் ஆண்டு"], Some("இரண்டாயிரத்து பத்தொன்பதாம் ஆண்டு")),
    ("normalizeTamil", &["5ஆம் நிலை"], Some("ஐந்தாம் நிலை")),
    ("normalizeTamil", &["16 ம் நூற்றாண்டு"], Some("பதினாறாம் நூற்றாண்டு")),
    ("normalizeTamil", &["60 வது கோல்"], Some("அறுபதாவது கோல்")),
    ("normalizeTamil", &["1000ஆவது"], Some("ஆயிரமாவது")),
    ("normalizeTamil", &["10:08 மணிக்கு"], Some("10 08 மணிக்கு")),
    ("normalizeTamil", &["11:00 மணிக்கு"], Some("11 மணிக்கு")),
    ("normalizeTamil", &["06:30 முதல் 07:30"], Some("06 30 முதல் 07 30")),
    ("normalizeTamil", &["(15.00 UTC)"], Some("(15 UTC)")),
    ("phonemize", &["10:08 மணிக்கு", "ta"], Some("pˈɐt̪ːʊ ˈeʈːʊ mˈɐɳɪkːʊ")),
    ("normalizeTamil", &["2.2 மில்லியன்"], Some("2 புள்ளி 2 மில்லியன்")),
    ("normalizeTamil", &["3.50 மீ"], Some("3 புள்ளி 5 0 மீ")),
    ("normalizeTamil", &["35 mm"], Some("35 மில்லிமீட்டர்")),
    ("normalizeTamil", &["3,850 km²"], Some("3850 சதுர கிலோமீட்டர்")),
    ("normalizeTamil", &["480 km/h"], Some("மணிக்கு 480 கிலோமீட்டர்")),
    ("normalizeTamil", &["133 m/s"], Some("வினாடிக்கு 133 மீட்டர்")),
    ("normalizeTamil", &["300 mph"], Some("மணிக்கு 300 மைல்")),
    ("normalizeTamil", &["மணிக்கு 480 km/h"], Some("மணிக்கு 480 கிலோமீட்டர்")),
    ("normalizeTamil", &["$10"], Some("10 டாலர்")),
    ("normalizeTamil", &["US$ 30"], Some("30 டாலர்")),
    ("normalizeTamil", &["$2.3 பில்லியன்"], Some("2 புள்ளி 3 பில்லியன் டாலர்")),
    ("normalizeTamil", &["93%"], Some("93 சதவீதம்")),
    ("normalizeTamil", &["கிமு 10,000"], Some("கிறிஸ்துவுக்கு முன் 10000")),
    ("normalizeTamil", &["கி.மு. 356"], Some("கிறிஸ்துவுக்கு முன் 356")),
    ("normalizeTamil", &["(கி.பி 1000)"], Some("(கிறிஸ்துவுக்கு பின் 1000)")),
    ("normalizeTamil", &["12 கிமீ"], Some("12 கிலோமீட்டர்")),
    ("normalizeTamil", &["1600 கி.மீ"], Some("1600 கிலோமீட்டர்")),
    ("normalizeTamil", &["12.8 கி மி"], Some("12 புள்ளி 8 கிலோமீட்டர்")),
    ("normalizeTamil", &["5 மிமீ"], Some("5 மில்லிமீட்டர்")),
    ("normalizeTamil", &["எஸ்கிமோ பழங்குடியினர்"], Some("எஸ்கிமோ பழங்குடியினர்")),
    ("normalizeTamil", &["சுருக்கி மிகவும்"], Some("சுருக்கி மிகவும்")),
    ("normalizeTamil", &["நுண்ணோக்கி மூலமாக"], Some("நுண்ணோக்கி மூலமாக")),
    ("normalizeTamil", &["எம்.ஆர்.ஐ துறையில்"], Some("எம் ஆர் ஐ துறையில்")),
    ("normalizeTamil", &["ஜி. டி. பி இன்"], Some("ஜி டி பி இன்")),
    ("normalizeTamil", &["ஐ.நா. முகாமில்"], Some("ஐ நா முகாமில்")),
    ("normalizeTamil", &["1 யு.எஸ்."], Some("1 யு எஸ்.")),
    ("normalizeTamil", &["கட்பேக், 21 ஆகியோர் ஆவர். கட்பேக்தான் வண்டி"], Some("கட்பேக், 21 ஆகியோர் ஆவர். கட்பேக்தான் வண்டி")),
    ("phonemize", &["எம்.ஆர்.ஐ துறையில்", "ta"], Some("ˈem ˈaːr ˈaᶦ t̪ˈʊraᶦjɪl")),
    ("normalizeTamil", &["29 3/4"], Some("29 முக்கால்")),
    ("normalizeTamil", &["24 1/2"], Some("24 அரை")),
    ("normalizeTamil", &["(1/5 அங்குல)"], Some("(ஐந்தில் ஒரு பங்கு அங்குல)")),
    ("normalizeTamil", &["35 ° W"], Some("35 டிகிரி W")),
    ("normalizeTamil", &["1444-ல்"], Some("1444 இல்")),
    ("normalizeTamil", &["1920ல்"], Some("1920 இல்")),
    ("normalizeTamil", &["ஸ்டைல் \u{200b}\u{200b}ஸ்கை"], Some("ஸ்டைல் ஸ்கை")),
    ("normalizeTamil", &["௧௨"], Some("12")),
    ("phonemize", &["௧௨", "ta"], Some("pˈɐnːɪɾˌɐɳɖʊ")),
    ("phonemize", &["12", "ta"], Some("pˈɐnːɪɾˌɐɳɖʊ")),
    ("normalizeTamil", &["UTC+1"], Some("UTC பிளஸ் 1")),
    ("normalizeTamil", &["+30 டிகிரி"], Some("பிளஸ் 30 டிகிரி")),
    ("normalizeTamil", &["சந்திரயான் -1"], Some("சந்திரயான் -1")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_tamil().unwrap();
        let d = &try_manifest().unwrap().numbers;
        let mut count = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => Some(e.phonemize_word(&js(args[0])).to_string_lossy()),
                "normalizeTamil" => Some(e.normalize(&js(args[0])).to_string_lossy()),
                "numberToWords" => {
                    let raw = args.get(1).map(|r| js(r));
                    Some(
                        number_to_words(js_number(&js(args[0])), raw.as_ref(), d).to_string_lossy(),
                    )
                }
                "ordinalStem" => ordinal_stem(&js(args[0])).map(|s| s.to_string_lossy()),
                "phonemize" => Some(crate::phonemize(args[0], args[1]).unwrap()),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(got.as_deref(), *want, "{f}({args:?})");
            count += 1;
        }
        assert_eq!(count, 97);
    }
}
