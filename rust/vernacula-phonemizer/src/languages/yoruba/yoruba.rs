//! Yoruba (yo) phonemizer: a segment scan over the NFD word (dotted vowels, the labial-velars, coda-n nasalisation,
//! syllabic nasals, three level tones as Chao letters), and text() over the normalizer and the number compositor.
//! Ported from src/languages/yoruba/yoruba.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{MANIFEST, try_manifest};
use super::normalize::{normalize_yoruba, try_symbols};
use super::numbers::yoruba_number;
use crate::core::clauses::assemble_clauses;
use crate::core::foreign::ForeignPhonemizer;
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::provenance::{Form, normalize};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

const DOT_BELOW: &str = "̣";
const ACUTE: &str = "́";
const GRAVE: &str = "̀";
const MACRON: &str = "̄";

fn is_tone_mark(c: &JsString) -> bool {
    *c == ACUTE || *c == GRAVE || *c == MACRON
}

/// ⚠ `"aeiou".includes("")` is TRUE in JS; the TS guards the empty string, so only a single vowel letter counts.
fn is_vowel_letter(c: Option<&JsString>) -> bool {
    c.is_some_and(|c| !c.is_empty() && js("aeiou").includes(c))
}

struct Seg {
    ph: JsString,
    tone: Option<JsString>,
    nasal: bool,
}

fn nucleus_tone(nx: &JsString) -> JsString {
    let t = &MANIFEST.tones;
    js(if *nx == ACUTE {
        &t.high
    } else if *nx == GRAVE {
        &t.low
    } else {
        &t.mid
    })
}

/// `phonemizeWord(word)`: one Yoruba word → canonical IPA (segments + level tones).
pub fn phonemize_word(word: &JsString) -> JsString {
    let def = &*MANIFEST;
    let s = normalize(&word.to_lower_case(), Form::Nfd).code_point_strings();
    let n = s.len();
    let mut segs: Vec<Seg> = Vec::new();
    let plain = |ph: JsString| Seg {
        ph,
        tone: None,
        nasal: false,
    };
    let mut i = 0;
    while i < n {
        let c = &s[i];
        let cs = c.to_string_lossy();
        if is_vowel_letter(Some(c)) {
            let mut ipa = js(&def.vowels[&cs]);
            let mut tone = js(&def.tones.mid);
            let mut dot = false;
            i += 1;
            while i < n && (s[i] == DOT_BELOW || is_tone_mark(&s[i])) {
                if s[i] == DOT_BELOW {
                    dot = true;
                } else if s[i] == ACUTE {
                    tone = js(&def.tones.high);
                } else if s[i] == GRAVE {
                    tone = js(&def.tones.low);
                }
                i += 1;
            }
            if dot {
                ipa = match cs.as_str() {
                    "e" => js("ɛ"),
                    "o" => js("ɔ"),
                    _ => ipa,
                };
            }
            segs.push(Seg {
                ph: ipa,
                tone: Some(tone),
                nasal: false,
            });
            continue;
        }
        if cs == "n" {
            let nx = s.get(i + 1);
            if let Some(nx) = nx.filter(|x| is_tone_mark(x)) {
                segs.push(Seg {
                    ph: js("n̩"),
                    tone: Some(nucleus_tone(nx)),
                    nasal: false,
                });
                i += 2;
            } else if is_vowel_letter(nx) {
                segs.push(plain(js("n")));
                i += 1;
            } else {
                if let Some(v) = segs.iter_mut().rev().find(|g| g.tone.is_some()) {
                    v.nasal = true;
                }
                i += 1;
            }
            continue;
        }
        if cs == "m" {
            if let Some(nx) = s.get(i + 1).filter(|x| is_tone_mark(x)) {
                segs.push(Seg {
                    ph: js("m̩"),
                    tone: Some(nucleus_tone(nx)),
                    nasal: false,
                });
                i += 2;
            } else {
                segs.push(plain(js("m")));
                i += 1;
            }
            continue;
        }
        let next_is = |t: &str| s.get(i + 1).is_some_and(|x| *x == t);
        if cs == "g" && next_is("b") {
            segs.push(plain(js(&def.consonants["gb"])));
            i += 2;
            continue;
        }
        if cs == "g" && next_is("h") {
            segs.push(plain(js("ɣ")));
            i += 2;
            continue;
        }
        if cs == "w"
            && segs.last().is_some_and(|g| g.tone.is_none())
            && is_vowel_letter(s.get(i + 1))
        {
            segs.last_mut().unwrap().ph.push_str(&js("ʷ"));
            i += 1;
            continue;
        }
        if cs == "s" {
            if next_is(DOT_BELOW) {
                segs.push(plain(js("ʃ")));
                i += 2;
            } else {
                segs.push(plain(js("s")));
                i += 1;
            }
            continue;
        }
        if let Some(p) = def.consonants.get(&cs) {
            segs.push(plain(js(p)));
            i += 1;
            continue;
        }
        if let Some(p) = latin_phone(
            c,
            PhoneOpts {
                initial: i == 0,
                include_h: false,
            },
        ) {
            segs.push(plain(p));
        }
        i += 1;
    }
    let mut out = JsString::new();
    for sg in &segs {
        out.push_str(&sg.ph);
        if let Some(t) = &sg.tone {
            if sg.nasal {
                out.push_str(&js("̃"));
            }
            out.push_str(t);
        }
    }
    normalize(&out, Form::Nfc)
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(r"([A-Za-zÀ-ɏḀ-ỿ̀-ͯ]+)|(\d+)|([.?!,;:])", "gu").unwrap());

/// `s.split(/[\s-]+/u)`: the pieces between the separator runs (a leading or trailing run leaves an empty piece).
fn split_words(s: &JsString) -> Vec<JsString> {
    let mut out = Vec::new();
    let mut cursor = 0;
    for m in js_re!(r"[\s-]+", "gu").match_all(s) {
        out.push(JsString::from_units(&s.0[cursor..m.index()]));
        cursor = m.end();
    }
    out.push(JsString::from_units(&s.0[cursor..]));
    out
}

/// The Yoruba engine (`createYoruba(foreign)`). The reader is stored and, as in the TS, never read.
pub struct YorubaPhonemizer {
    _foreign: Option<ForeignPhonemizer>,
}

impl YorubaPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_yoruba(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        try_symbols().expect("checked by create_yoruba").apply(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        assemble_clauses(&normalize_yoruba(input), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&w));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                for w in split_words(&yoruba_number(&d)) {
                    if !w.is_empty() {
                        sink.emit(&phonemize_word(&w));
                    }
                }
            } else if let Some(p) = m.group(3, s)
                && let Some(mk) = MANIFEST
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|v| !v.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for YorubaPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(YorubaPhonemizer::text(self, input))
    }
}

/// `createYoruba(foreign)`: loads the manifest and the symbol tier, or says which failed.
pub fn create_yoruba(foreign: Option<ForeignPhonemizer>) -> Result<YorubaPhonemizer, String> {
    try_manifest()?;
    try_symbols()?;
    Ok(YorubaPhonemizer { _foreign: foreign })
}

#[cfg(test)]
mod tests {
    use super::super::numbers::{yoruba_cardinal, yoruba_number};
    use super::*;

    // Every call test/yoruba.test.ts, test/yorubaNormalize.test.ts and test/yorubaNumbers.test.ts make into the
    // engine, with the value the TS returned, extracted MECHANICALLY (each suite run under a recording vitest shim that
    // also checked every matcher: all green), so each of the suites' expectations holds here exactly when the Rust
    // returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["bá"], Some("ba˥")),
    ("phonemizeWord", &["ba"], Some("ba˧")),
    ("phonemizeWord", &["bà"], Some("ba˩")),
    ("phonemizeWord", &["Yorùbá"], Some("jo˧ɾu˩ba˥")),
    ("phonemizeWord", &["gbogbo"], Some("ɡ͡bo˧ɡ͡bo˧")),
    ("phonemizeWord", &["ọmọ"], Some("ɔ˧mɔ˧")),
    ("phonemizeWord", &["ẹni"], Some("ɛ˧ni˧")),
    ("phonemizeWord", &["ọdún"], Some("ɔ˧dũ˥")),
    ("phonemizeWord", &["ṣé"], Some("ʃe˥")),
    ("phonemizeWord", &["ilé"], Some("i˧le˥")),
    ("phonemizeWord", &["omi"], Some("o˧mi˧")),
    ("phonemize", &["ọmọ dára", "yo"], Some("ɔ˧mɔ˧ da˥ɾa˧")),
    ("normalizeYoruba", &["60%"], Some("ìdá 60 nínú ọgọ́rùn-ún")),
    ("phonemize", &["60%", "yo"], Some("i˩da˥ ɔ˧ɡɔ˥ta˧ ni˥nu˥ ɔ˧ɡɔ˥ɾũ˩ ũ˥")),
    ("normalizeYoruba", &["ìpín ọgọ́ta nínú ọgọ́rùn-ún (60%)"], Some("ìpín ọgọ́ta nínú ọgọ́rùn-ún ")),
    ("normalizeYoruba", &["ipin ogota ninu ogorun-un (60%)"], Some("ipin ogota ninu ogorun-un ")),
    ("normalizeYoruba", &["1967-1970"], Some("1967 sí 1970")),
    ("normalizeYoruba", &["200-600"], Some("200 sí 600")),
    ("normalizeYoruba", &["1990–2000"], Some("1990 sí 2000")),
    ("normalizeYoruba", &["2,500"], Some("2500")),
    ("normalizeYoruba", &["1,234,567"], Some("1234567")),
    ("phonemize", &["2,500", "yo"], Some("ɛ˧ɡ͡bɛ˩ɾũ˥ me˥d͡ʒi˩ o˥ le˥ ɛ˩ɛ˥dɛ˥ɡ͡bɛ˩ta˧")),
    ("normalizeYoruba", &["3.5"], Some("3 àti dásímà 5")),
    ("normalizeYoruba", &["4.14"], Some("4 àti dásímà 1 4")),
    ("phonemize", &["3.5", "yo"], Some("mɛ˥ta˧ a˩ti˧ da˥si˥ma˩ ma˥ɾũ˩ ũ˥")),
    ("normalizeYoruba", &["8.3%"], Some("ìdá 8 àti dásímà 3 nínú ọgọ́rùn-ún")),
    ("normalizeYoruba", &["₦500"], Some("500 náírà")),
    ("normalizeYoruba", &["$20"], Some("20 dọ́là")),
    ("normalizeYoruba", &["38°C"], Some("ìwọ̀n 38 Celsius")),
    ("normalizeYoruba", &["2 °C"], Some("ìwọ̀n 2 Celsius")),
    ("normalizeYoruba", &["79.63 °F"], Some("ìwọ̀n 79 àti dásímà 6 3 Fahrenheit")),
    ("normalizeYoruba", &["38°C (100.4°F)"], Some("ìwọ̀n 38 Celsius (ìwọ̀n 100 àti dásímà 4 Fahrenheit)")),
    ("normalizeYoruba", &["7°30′S 3°21′E"], Some("7°30′S 3°21′E")),
    ("normalizeYoruba", &["4 × 100 mítà"], Some("4 lọ́nà 100 mítà")),
    ("normalizeYoruba", &["1920 × 1080"], Some("1920 lọ́nà 1080")),
    ("normalizeYoruba", &["8×8"], Some("8 lọ́nà 8")),
    ("normalizeYoruba", &["250 km²"], Some("250 kìlómítà onígun mẹ́rin")),
    ("normalizeYoruba", &["9.83 million km²"], Some("9 àti dásímà 8 3 million kìlómítà onígun mẹ́rin")),
    ("normalizeYoruba", &["12.76 km"], Some("12 àti dásímà 7 6 kìlómítà")),
    ("normalizeYoruba", &["80km/w"], Some("80 kìlómítà ni wákàtí kan")),
    ("normalizeYoruba", &["126km/h"], Some("126 kìlómítà ni wákàtí kan")),
    ("normalizeYoruba", &["Il-76s"], Some("Il-76s")),
    ("normalizeYoruba", &["A & B"], Some("A àti B")),
    ("normalizeYoruba", &["ìdá 60 nínú ọgọ́rùn-ún (60%) jẹ́ púpọ̀"], Some("ìdá 60 nínú ọgọ́rùn-ún jẹ́ púpọ̀")),
    ("normalizeYoruba", &["Ọdún 2020. Ó dára."], Some("Ọdún 2020. Ó dára.")),
    ("phonemize", &["1945", "yo"], Some("ɛ˧ɡ͡bɛ˩ɾũ˥ kã˧ o˥ le˥ ɛ˩ɛ˥dɛ˥ɡ͡bɛ˩ɾũ˥ o˥ le˥ ma˥ɾũ˩dĩ˥la˥a˩dɔ˥ta˧")),
    ("phonemize", &["₦500", "yo"], Some("ɛ˩ɛ˥dɛ˥ɡ͡bɛ˩ta˧ na˥i˥ɾa˩")),
    ("phonemize", &["1967-1970", "yo"], Some("ɛ˧ɡ͡bɛ˩ɾũ˥ kã˧ o˥ le˥ ɛ˩ɛ˥dɛ˥ɡ͡bɛ˩ɾũ˥ o˥ le˥ mɛ˥ta˩dĩ˥la˥a˩dɔ˥ɾĩ˧ si˥ ɛ˧ɡ͡bɛ˩ɾũ˥ kã˧ o˥ le˥ ɛ˩ɛ˥dɛ˥ɡ͡bɛ˩ɾũ˥ o˥ le˥ a˩a˥dɔ˥ɾĩ˧")),
    ("normalizeYoruba", &["10 mm"], Some("10 mílímítà")),
    ("normalizeYoruba", &["10 l"], Some("10 lítà")),
    ("normalizeYoruba", &["10 L"], Some("10 lítà")),
    ("normalizeYoruba", &["ọdún 1975 lẹ́yìn"], Some("ọdún 1975 lẹ́yìn")),
    ("normalizeYoruba", &["30,000 lábẹ́"], Some("30000 lábẹ́")),
    ("normalizeYoruba", &["2419 m (7936 ft)"], Some("2419 mítà (7936 ẹsẹ̀ bàtà)")),
    ("normalizeYoruba", &["(75 ft)"], Some("(75 ẹsẹ̀ bàtà)")),
    ("normalizeYoruba", &["705.78sq km"], Some("705 àti dásímà 7 8 kìlómítà onígun mẹ́rin")),
    ("normalizeYoruba", &["500 sq mi"], Some("500 máìlì onígun mẹ́rin")),
    ("normalizeYoruba", &["430 sq yd"], Some("430 sq yd")),
    ("normalizeYoruba", &["2419 m"], Some("2419 mítà")),
    ("normalizeYoruba", &["10 m"], Some("10 mítà")),
    ("normalizeYoruba", &["8.62 m"], Some("8 àti dásímà 6 2 mítà")),
    ("normalizeYoruba", &["9h 50m 30.0s"], Some("9h 50m 30 àti dásímà 0s")),
    ("yorubaCardinal", &["2"], Some("méjì")),
    ("yorubaCardinal", &["12"], Some("méjìlá")),
    ("yorubaCardinal", &["13"], Some("mẹ́tàlá")),
    ("yorubaCardinal", &["14"], Some("mẹ́rìnlá")),
    ("yorubaCardinal", &["22"], Some("méjìlélógún")),
    ("yorubaCardinal", &["24"], Some("mẹ́rìnlélógún")),
    ("yorubaCardinal", &["26"], Some("mẹ́rìndínlọ́gbọ̀n")),
    ("yorubaCardinal", &["35"], Some("márùndínlógójì")),
    ("yorubaCardinal", &["36"], Some("mẹ́rìndínlógójì")),
    ("yorubaCardinal", &["37"], Some("mẹ́tàdínlógójì")),
    ("yorubaCardinal", &["15"], Some("mẹ́ẹ̀ẹ́dógún")),
    ("yorubaCardinal", &["25"], Some("mẹ́ẹ̀ẹ́dọ́gbọ̀n")),
    ("yorubaCardinal", &["1"], Some("ọ̀kan")),
    ("yorubaCardinal", &["11"], Some("mọ́kànlá")),
    ("yorubaCardinal", &["39"], Some("mọ́kàndínlógójì")),
    ("yorubaCardinal", &["59"], Some("mọ́kàndínlọ́gọ́ta")),
    ("yorubaCardinal", &["45"], Some("márùndínláàdọ́ta")),
    ("yorubaCardinal", &["52"], Some("méjìléláàdọ́ta")),
    ("yorubaCardinal", &["88"], Some("méjìdínláàdọ́rùn")),
    ("yorubaCardinal", &["92"], Some("méjìléláàdọ́rùn")),
    ("yorubaCardinal", &["20"], Some("ogún")),
    ("yorubaCardinal", &["50"], Some("àádọ́ta")),
    ("yorubaCardinal", &["70"], Some("àádọ́rin")),
    ("yorubaCardinal", &["90"], Some("àádọ́rùn-ún")),
    ("yorubaCardinal", &["100"], Some("ọgọ́rùn-ún")),
    ("yorubaCardinal", &["200"], Some("igba")),
    ("yorubaCardinal", &["400"], Some("irinwó")),
    ("yorubaCardinal", &["500"], Some("ẹ̀ẹ́dẹ́gbẹ̀ta")),
    ("yorubaCardinal", &["600"], Some("ẹgbẹ̀ta")),
    ("yorubaCardinal", &["900"], Some("ẹ̀ẹ́dẹ́gbẹ̀rún")),
    ("yorubaCardinal", &["120"], Some("ọgọ́fà")),
    ("yorubaCardinal", &["130"], Some("àádọ́je")),
    ("yorubaCardinal", &["140"], Some("ogóje")),
    ("yorubaCardinal", &["150"], Some("àádọ́jọ")),
    ("yorubaCardinal", &["160"], Some("ọgọ́jọ")),
    ("yorubaCardinal", &["180"], Some("ọgọ́sàn-án")),
    ("yorubaCardinal", &["137"], Some("mẹ́tàdínlógóje")),
    ("yorubaCardinal", &["175"], Some("márùndínlọ́gọ́sàn")),
    ("yorubaCardinal", &["115"], Some("márùndínlógófà")),
    ("yorubaCardinal", &["125"], Some("márùndínláàdóje")),
    ("yorubaCardinal", &["139"], Some("mọ́kàndínlógóje")),
    ("yorubaCardinal", &["195"], Some("márùndínnígba")),
    ("yorubaCardinal", &["199"], Some("mọ́kàndínnígba")),
    ("yorubaCardinal", &["165"], Some("márùndínláàdósàn")),
    ("yorubaCardinal", &["280"], Some("igba ó lé ọgọ́rin")),
    ("yorubaCardinal", &["450"], Some("irinwó ó lé àádọ́ta")),
    ("yorubaCardinal", &["480"], Some("irinwó ó lé ọgọ́rin")),
    ("yorubaCardinal", &["1000"], Some("ẹgbẹ̀rún kan")),
    ("yorubaCardinal", &["1000000"], Some("mílíọ̀nù kan")),
    ("yorubaCardinal", &["2000"], Some("ẹgbẹ̀rún méjì")),
    ("yorubaCardinal", &["10000"], Some("ẹgbẹ̀rún mẹ́wàá")),
    ("yorubaCardinal", &["15000"], Some("ẹgbẹ̀rún lọ́nà mẹ́ẹ̀ẹ́dógún")),
    ("yorubaCardinal", &["20000"], Some("ẹgbẹ̀rún lọ́nà ogún")),
    ("yorubaCardinal", &["100000"], Some("ẹgbẹ̀rún lọ́nà ọgọ́rùn-ún")),
    ("yorubaCardinal", &["32812"], Some("ẹgbẹ̀rún lọ́nà méjìlélọ́gbọ̀n ó lé ẹgbẹ̀rin ó lé méjìlá")),
    ("phonemize", &["1945", "yo"], Some("ɛ˧ɡ͡bɛ˩ɾũ˥ kã˧ o˥ le˥ ɛ˩ɛ˥dɛ˥ɡ͡bɛ˩ɾũ˥ o˥ le˥ ma˥ɾũ˩dĩ˥la˥a˩dɔ˥ta˧")),
    ("yorubaCardinal", &["1000000000000000"], Some("ọ̀kan òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo")),
    ("yorubaNumber", &["123456789012345678901234"], Some("ọ̀kan méjì mẹ́ta mẹ́rin márùn-ún mẹ́fà méje mẹ́jọ mẹ́sàn-án òdo ọ̀kan méjì mẹ́ta mẹ́rin márùn-ún mẹ́fà méje mẹ́jọ mẹ́sàn-án òdo ọ̀kan méjì mẹ́ta mẹ́rin")),
    ("yorubaNumber", &["1000000000000000000000"], Some("ọ̀kan òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo òdo")),
    ("phonemize", &["123456789012345678901234", "yo"], Some("ɔ˩kã˧ me˥d͡ʒi˩ mɛ˥ta˧ mɛ˥ɾĩ˧ ma˥ɾũ˩ ũ˥ mɛ˥fa˩ me˥d͡ʒe˧ mɛ˥d͡ʒɔ˧ mɛ˥sã˩ ã˥ o˩do˧ ɔ˩kã˧ me˥d͡ʒi˩ mɛ˥ta˧ mɛ˥ɾĩ˧ ma˥ɾũ˩ ũ˥ mɛ˥fa˩ me˥d͡ʒe˧ mɛ˥d͡ʒɔ˧ mɛ˥sã˩ ã˥ o˩do˧ ɔ˩kã˧ me˥d͡ʒi˩ mɛ˥ta˧ mɛ˥ɾĩ˧")),
    ("phonemize", &["100", "yo"], Some("ɔ˧ɡɔ˥ɾũ˩ ũ˥")),
    ("phonemize", &["ọgọ́rùn-ún", "yo"], Some("ɔ˧ɡɔ˥ɾũ˩ ũ˥")),
    ("phonemize", &["5", "yo"], Some("ma˥ɾũ˩ ũ˥")),
    ("phonemize", &["márùn-ún", "yo"], Some("ma˥ɾũ˩ ũ˥")),
    ("phonemize", &["9", "yo"], Some("mɛ˥sã˩ ã˥")),
    ("phonemize", &["mẹ́sàn-án", "yo"], Some("mɛ˥sã˩ ã˥")),
    ("yorubaCardinal", &["0"], Some("òdo")),
    ("yorubaCardinal", &["1100"], Some("ẹgbẹ̀rún kan ó lé ọgọ́rùn-ún")),
    ("yorubaCardinal", &["250"], Some("igba ó lé àádọ́ta")),
    ("yorubaCardinal", &["300"], Some("ọ̀ọ́dúnrún")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        create_yoruba(None).unwrap();
        let mut count = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => phonemize_word(&js(args[0])).to_string_lossy(),
                "normalizeYoruba" => normalize_yoruba(&js(args[0])).to_string_lossy(),
                "yorubaNumber" => yoruba_number(&js(args[0])).to_string_lossy(),
                "yorubaCardinal" => {
                    yoruba_cardinal(crate::core::js_string::js_number(&js(args[0])))
                        .to_string_lossy()
                }
                "phonemize" => crate::phonemize(args[0], args[1]).unwrap(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            count += 1;
        }
        assert_eq!(count, 132);
    }
}
