//! Xhosa (xh) phonemizer: the shared Nguni scan over Xhosa's rule table, penultimate stress with lengthening (tone
//! deferred), the shared loan lexicon and the English route for click-letter loans.
//! Ported from src/languages/xhosa/xhosa.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{MANIFEST, try_manifest};
use super::normalize::{MAGNITUDES, normalize_xhosa};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::foreign::ForeignPhonemizer;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::languages::zulu::g2p::{Rule, Seg, rules_of, to_segments};
use crate::languages::zulu::nguni_loans::{LoanReading, de_click, nguni_loan};
use crate::languages::zulu::zulu::{EnglishWordTest, is_foreign_nguni_word};
use crate::registry::{Engine, PhonemizeError};

/// `RULES`: the Xhosa table (Zulu's plus ⟨rh⟩).
static RULES: LazyLock<Vec<Rule>> = LazyLock::new(|| rules_of(&MANIFEST));

/// `phonemizeWord(word)`: shared Nguni segments + penultimate ˈ + ː.
pub fn phonemize_word(word: &JsString) -> JsString {
    let segs = to_segments(word, &RULES);
    let vowel_idx: Vec<usize> = (0..segs.len()).filter(|&i| segs[i].v).collect();
    if vowel_idx.is_empty() {
        let phs: Vec<JsString> = segs.iter().map(|s| s.ph.clone()).collect();
        return JsString::join(&phs, &JsString::new());
    }
    let stress_idx = if vowel_idx.len() >= 2 {
        vowel_idx[vowel_idx.len() - 2]
    } else {
        vowel_idx[0]
    };
    let mut out = JsString::new();
    for (i, s) in segs.iter().enumerate() {
        if s.v && i == stress_idx {
            out.push_str(&js("ˈ"));
            out.push_str(&s.ph);
            out.push_str(&js("ː"));
        } else {
            out.push_str(&s.ph);
        }
    }
    out
}

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: Xhosa's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser("[A-Za-z]", "u")));

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.!?…,;:])", *LATIN_RUN), "gu").unwrap());

/// `SYMBOLS`'s argument, generated from the object literal in xhosa.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it, except `magnitudes`, which is the
/// `MAGNITUDES` constant spread in. No `countForm`: the default selector.
static SYMBOL_DATA: LazyLock<String> = LazyLock::new(|| {
    let mags = serde_json::to_string(&MAGNITUDES).unwrap();
    format!(
        r#"{{"multiply":{{"times":"phindaphinda"}},"percent":["iipesenti"],"currency":{{"US$":["iidola zaseMelika"],"AUD$":["iidola"],"$":["iidola"],"£":["iiponti"],"¥":["iiyeni"]}},"units":{{"km":["iikhilomitha"],"m":["iimitha"],"cm":["iisentimitha"],"mm":["iimilimitha"],"mi":["iimayile"],"kg":["iikhilogram"]}},"magnitudes":{mags},"exponentWords":{{"squared":["isikwere","izikwere"],"position":"after"}}}}"#
    )
});

static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let data: SymbolData = serde_json::from_str(&SYMBOL_DATA).map_err(|e| e.to_string())?;
    make_symbol_normalizer(&data)
});

/// The Xhosa engine (`createXhosa`).
pub struct XhosaPhonemizer {
    foreign: Option<ForeignPhonemizer>,
    is_english_word: Option<EnglishWordTest>,
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding an `XhosaPhonemizer` proves the manifest and the
/// symbol tier loaded. (The per-module differentials call them.)
impl XhosaPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_xhosa(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    pub fn segments(&self, word: &JsString) -> Vec<Seg> {
        to_segments(word, &RULES)
    }

    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self.symbols.apply(&normalize_xhosa(input));
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                let lower = w.to_lower_case();
                let loan = nguni_loan(&lower);
                if let (Some(LoanReading::Foreign), Some(f)) = (loan, &self.foreign) {
                    sink.emit(&f(&w));
                } else if loan == Some(LoanReading::Declick) {
                    sink.emit(&phonemize_word(&NAT(&de_click(&lower))));
                } else if let (Some(f), Some(eng)) = (&self.foreign, &self.is_english_word)
                    && is_foreign_nguni_word(&lower, &**eng)
                {
                    sink.emit(&f(&w));
                } else {
                    sink.emit(&phonemize_word(&NAT(&w)));
                }
            } else if let Some(n) = m.group(2, s) {
                for wd in number_to_words(js_number(&n), Some(&n)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
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

impl Engine for XhosaPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(XhosaPhonemizer::text(self, input))
    }
}

/// `createXhosa(foreign?, isEnglishWord?)`: loads the manifest and the symbol tier, or says which failed.
pub fn create_xhosa(
    foreign: Option<ForeignPhonemizer>,
    is_english_word: Option<EnglishWordTest>,
) -> Result<XhosaPhonemizer, String> {
    try_manifest()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(XhosaPhonemizer {
        foreign,
        is_english_word,
        symbols,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/xhosa.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["xhosa"], Some("kǁʰˈɔːsa")),
    ("phonemizeWord", &["iqanda"], Some("ikǃˈaːnd̤a")),
    ("phonemizeWord", &["ukutya"], Some("ukʼˈuːcʼa")),
    ("phonemizeWord", &["rhoxa"], Some("xˈɔːkǁa")),
    ("phonemizeWord", &["irhafu"], Some("ixˈaːfu")),
    ("phonemizeWord", &["molo"], Some("mˈɔːlɔ")),
    ("phonemizeWord", &["amanzi"], Some("amˈaːnz̤i")),
    ("phonemizeWord", &["ndiyabulela"], Some("nd̤ijaɓulˈɛːla")),
    ("createXhosa().text", &["2"], Some("kʼuɓˈiːni")),
    ("createXhosa().text", &["6"], Some("isitʰand̤ˈaːtʰu")),
    ("createXhosa().text", &["10"], Some("iʃˈuːmi")),
    ("createXhosa().text", &["3"], Some("kʼutʰˈaːtʰu")),
    ("createXhosa().text", &["5"], Some("kʼuɬˈaːnu")),
    ("createXhosa().text", &["13"], Some("iʃˈuːmi nantʼˈaːtʰu")),
    ("createXhosa().text", &["15"], Some("iʃˈuːmi nanɬˈaːnu")),
    ("createXhosa().text", &["21"], Some("amaʃˈuːmi amaɓˈiːni nˈaːɲɛ")),
    ("createXhosa().text", &["555"], Some("amakʰˈuːlu amaɬˈaːnu amaʃˈuːmi amaɬˈaːnu nanɬˈaːnu")),
    ("createXhosa().text", &["2000"], Some("amawˈaːkʼa amaɓˈiːni")),
    ("createXhosa().text", &["1000000"], Some("isiɡ̤ˈiːd̤i")),
    ("normalizeXhosa", &["eziyi-3,850"], Some("eziyi-3850")),
    ("normalizeXhosa", &["ezingama-5,000,000"], Some("ezingama-5000000")),
    ("normalizeXhosa", &["ne-¥130,000, yaye"], Some("ne-¥130000, yaye")),
    ("normalizeXhosa", &["nayi-2,207."], Some("nayi-2207.")),
    ("normalizeXhosa", &["abangama-6 500."], Some("abangama-6500.")),
    ("normalizeXhosa", &["ne-10 000 BCE"], Some("ne-10000 bhi si i")),
    ("normalizeXhosa", &["Novemba 26,2008"], Some("Novemba 26,2008")),
    ("normalizeXhosa", &["1,234,5"], Some("1,234,5")),
    ("normalizeXhosa", &["nge 30 9"], Some("nge 30 9")),
    ("normalizeXhosa", &["ngo-11:00"], Some("ngo-ishumi nanye")),
    ("normalizeXhosa", &["8:08"], Some("isibhozo nesibhozo")),
    ("normalizeXhosa", &["ngo-07:19 a.m."], Some("ngo-isixhenxe neshumi nethoba kusasa")),
    ("normalizeXhosa", &["nge-8: 30 p.m."], Some("nge-isibhozo namashumi amathathu emva kwemini")),
    ("normalizeXhosa", &["ngo-11:20,amapolisa"], Some("ngo-ishumi nanye namashumi amabini,amapolisa")),
    ("normalizeXhosa", &["ngo-12.00 GMT"], Some("ngo-ishumi nambini ji emu thi")),
    ("normalizeXhosa", &["(15.00 UTC)"], Some("(ishumi nanhlanu yu thi si)")),
    ("normalizeXhosa", &["le-4: 41.30"], Some("le-4 41 3 0")),
    ("normalizeXhosa", &["eyi-1: 09.02"], Some("eyi-1 09 0 2")),
    ("normalizeXhosa", &["24:45"], Some("24 45")),
    ("normalizeXhosa", &["le-4: 41.30, 2: 11.60 imizuzu"], Some("le-4 41 3 0, 2 11 6 0 imizuzu")),
    ("normalizeXhosa", &["efumana 2:2 isidanga"], Some("efumana 2 2 isidanga")),
    ("phonemize", &["efumana 2:2 isidanga", "xh"], Some("ɛfumˈaːna kʼuɓˈiːni kʼuɓˈiːni isid̤ˈaːŋɡ̤a")),
    ("normalizeXhosa", &["Umzekelo: 5 abantu"], Some("Umzekelo: 5 abantu")),
    ("normalizeXhosa", &["ngo-2007: kwathi"], Some("ngo-2007: kwathi")),
    ("normalizeXhosa", &["ye 9:30 amaXhosa"], Some("ye ithoba namashumi amathathu amaXhosa")),
    ("normalizeXhosa", &["14:00 Amabini"], Some("ishumi nane Amabini")),
    ("normalizeXhosa", &["11:20 pha"], Some("ishumi nanye namashumi amabini pha")),
    ("normalizeXhosa", &["9:30 AM"], Some("ithoba namashumi amathathu kusasa")),
    ("normalizeXhosa", &["10:30p.m."], Some("ishumi namashumi amathathu emva kwemini")),
    ("normalizeXhosa", &["07:19 a.m. ixesha"], Some("isixhenxe neshumi nethoba kusasa ixesha")),
    ("phonemize", &["leUS$30", "xh"], Some("lˈɛː amaʃˈuːmi amatʰˈaːtʰu iid̤ˈɔːla z̤asɛmɛlˈiːkʼa")),
    ("phonemize", &["i$10", "xh"], Some("ˈiː iʃˈuːmi iid̤ˈɔːla")),
    ("phonemize", &["i-US $ 14.7 yezigidi", "xh"], Some("ˈiː iʃˈuːmi nˈaːnɛ isikǁʰˈɛːŋǁɛ jɛz̤iɡ̤ˈiːd̤i iid̤ˈɔːla z̤asɛmɛlˈiːkʼa")),
    ("normalizeXhosa", &["bungange-$2.3 bhiliyoni"], Some("bungange-2 3 bhiliyoni iidola")),
    ("normalizeXhosa", &["ne-¥7,000."], Some("ne-¥7000.")),
    ("phonemize", &["ne-¥7,000.", "xh"], Some("nˈɛː amawˈaːkʼa asikǁʰˈɛːŋǁɛ iijˈɛːni .")),
    ("phonemize", &["ye-£ 27 yezigidi", "xh"], Some("jˈɛː amaʃˈuːmi amaɓˈiːni nɛsikǁʰˈɛːŋǁɛ jɛz̤iɡ̤ˈiːd̤i iipʼˈɔːntʼi")),
    ("phonemize", &["i-5 mm", "xh"], Some("ˈiː kʼuɬˈaːnu iimilimˈiːtʰa")),
    ("phonemize", &["30 cm", "xh"], Some("amaʃˈuːmi amatʰˈaːtʰu iisɛntʼimˈiːtʰa")),
    ("phonemize", &["500 mi", "xh"], Some("amakʰˈuːlu amaɬˈaːnu iimajˈiːlɛ")),
    ("phonemize", &["3,850 km²", "xh"], Some("amawˈaːkʼa amatʰˈaːtʰu amakʰˈuːlu asib̤ˈɔːz̤ɔ amaʃˈuːmi amaɬˈaːnu iikʰilɔmˈiːtʰa iz̤ikʼwˈɛːrɛ")),
    ("normalizeXhosa", &["ezingange 3.50 m ububanzi"], Some("ezingange 3 5 0 iimitha ububanzi")),
    ("normalizeXhosa", &["kwi-480 km/h"], Some("kwi-480 iikhilomitha ngeyure")),
    ("normalizeXhosa", &["nge-160km/h."], Some("nge-160 iikhilomitha ngeyure.")),
    ("normalizeXhosa", &["kwi-83 km / h,"], Some("kwi-83 iikhilomitha ngeyure,")),
    ("normalizeXhosa", &["133 m/s;"], Some("133 iimitha ngomzuzwana;")),
    ("normalizeXhosa", &["300 mph"], Some("300 iimayile ngeyure")),
    ("normalizeXhosa", &["i-64 kph"], Some("i-64 iikhilomitha ngeyure")),
    ("normalizeXhosa", &["u-35-40 mph (56-64 km/h)"], Some("u-35 ukuya ku 40 iimayile ngeyure (56 ukuya ku 64 iikhilomitha ngeyure)")),
    ("normalizeXhosa", &["ibine-120-160"], Some("ibine-120 ukuya ku 160")),
    ("normalizeXhosa", &["(1644-1912)"], Some("(1644 ukuya ku 1912)")),
    ("normalizeXhosa", &["(1418 – 1450)"], Some("(1418 ukuya ku 1450)")),
    ("normalizeXhosa", &["ngu- 7-2."], Some("ngu- 7-2.")),
    ("normalizeXhosa", &["ka 1995-96,"], Some("ka 1995-96,")),
    ("normalizeXhosa", &["26 - 00."], Some("26 - 00.")),
    ("normalizeXhosa", &["kwi-4.2-3.9 yezigidi"], Some("kwi-4 2 ukuya ku 3 9 yezigidi")),
    ("normalizeXhosa", &["amaqondo angaphezulu kwe +30°C aqhelekile."], Some("amaqondo angaphezulu kwe plas 30 aqhelekile.")),
    ("normalizeXhosa", &["(-30°C)"], Some("(thabatha amaqondo 30)")),
    ("normalizeXhosa", &["kwi-30°C"], Some("kwi-amaqondo 30")),
    ("normalizeXhosa", &["kwimpuma 35°W."], Some("kwimpuma amaqondo 35 entshona.")),
    ("normalizeXhosa", &["nge-98°F"], Some("nge-amaqondo 98")),
    ("normalizeXhosa", &["kwi-40°N"], Some("kwi-amaqondo 40 emantla")),
    ("normalizeXhosa", &["kwi-45°"], Some("kwi-amaqondo 45")),
    ("normalizeXhosa", &["le-18th sentyhuri"], Some("le-18 sentyhuri")),
    ("normalizeXhosa", &["yango 17th-century"], Some("yango 17-century")),
    ("normalizeXhosa", &["yakhe ye 60th,"], Some("yakhe ye 60,")),
    ("normalizeXhosa", &["ye-21ST"], Some("ye-21")),
    ("normalizeXhosa", &["ye-1st ne-2nd ne-3rd"], Some("ye-1 ne-2 ne-3")),
    ("normalizeXhosa", &["yi-U.S.Geological Survey"], Some("yi-yu esi Geological Survey")),
    ("normalizeXhosa", &["ne-1000 B.C.E., ama-Asiriya"], Some("ne-1000 bhi si i, ama-Asiriya")),
    ("normalizeXhosa", &["yase U.S."], Some("yase yu esi.")),
    ("normalizeXhosa", &["yase U.S. Ngoko ke"], Some("yase yu esi. Ngoko ke")),
    ("normalizeXhosa", &["kwi-U.S House"], Some("kwi-yu esi House")),
    ("normalizeXhosa", &["uN.Wayne Hale Jr. uthe"], Some("uN Wayne Hale Jr uthe")),
    ("normalizeXhosa", &["UMnu. Costello uthe"], Some("UMnumzana Costello uthe")),
    ("normalizeXhosa", &["watsho uMnu Costello."], Some("watsho uMnumzana Costello.")),
    ("normalizeXhosa", &["Mnu. rudd sokutyikitya"], Some("Mnu. rudd sokutyikitya")),
    ("normalizeXhosa", &["umnu reid ubaleka"], Some("umnu reid ubaleka")),
    ("normalizeXhosa", &["eziyi-12.8 okanye"], Some("eziyi-12 8 okanye")),
    ("normalizeXhosa", &["ku 6.34 ye intshi"], Some("ku 6 3 4 ye intshi")),
    ("normalizeXhosa", &["eziyi-2,3 miliyoni"], Some("eziyi-2 3 miliyoni")),
    ("normalizeXhosa", &["eziyi-2,300 miliyoni"], Some("eziyi-2300 miliyoni")),
    ("normalizeXhosa", &["se-802.11n"], Some("se-802 1 1n")),
    ("normalizeXhosa", &["iFigure 1.1."], Some("iFigure 1 1.")),
    ("normalizeXhosa", &["x = y"], Some("x lilingana ne y")),
    ("normalizeXhosa", &["5 < 6"], Some("5 ngaphantsi kuna 6")),
    ("normalizeXhosa", &["23 > 19"], Some("23 ngaphezulu kuna 19")),
    ("normalizeXhosa", &["7 × 2"], Some("7 phindaphinda 2")),
    ("normalizeXhosa", &["8 ÷ 2"], Some("8 yahlula 2")),
    ("normalizeXhosa", &["+5"], Some("plas 5")),
    ("normalizeXhosa", &["-5"], Some("thabatha 5")),
    ("normalizeXhosa", &["lalapha( UTC+1) e"], Some("lalapha( yu thi si plas 1) e")),
    ("normalizeXhosa", &["ebhudla kangange -40 mph"], Some("ebhudla kangange -40 iimayile ngeyure")),
    ("normalizeXhosa", &["i-COVID-19 ne-Il-76"], Some("i-COVID-19 ne-Il-76")),
    ("normalizeXhosa", &["Arts & Sciences"], Some("Arts kunye Sciences")),
    ("normalizeXhosa", &["iiB&amp;B ezikhuphisana"], Some("iiB kunye B ezikhuphisana")),
    ("normalizeXhosa", &["leUS$30"], Some("le US$30")),
    ("normalizeXhosa", &["+30°C"], Some("plas amaqondo 30")),
    ("normalizeXhosa", &["9:30 a.m."], Some("ithoba namashumi amathathu kusasa")),
    ("phonemize", &["1000000000000000000001", "xh"], Some("kʼˈuːɲɛ ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a kʼˈuːɲɛ")),
    ("phonemize", &["1000000000000000000009", "xh"], Some("kʼˈuːɲɛ ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a ikǃˈaːnd̤a itʰˈɔːɓa")),
    ("numberToWords", &["1e+21", "1000000000000000000000"], Some("kunye iqanda iqanda iqanda iqanda iqanda iqanda iqanda iqanda iqanda iqanda iqanda iqanda iqanda iqanda iqanda iqanda iqanda iqanda iqanda iqanda iqanda")),
    ("numberToWords", &["1957"], Some("iwaka amakhulu athoba amashumi amahlanu nesixhenxe")),
    ("numberToWords", &["1957", "1957"], Some("iwaka amakhulu athoba amashumi amahlanu nesixhenxe")),
    ("phonemize", &["nge arctic yakhe", "xh"], Some("ŋɡ̤ˈɛː ˈɑːɹktɪk jˈaːkʰɛ")),
    ("phonemize", &["nge microsoft yakhe", "xh"], Some("ŋɡ̤ˈɛː mˌaᶦkɹoᶷsˈɔːft jˈaːkʰɛ")),
    ("phonemize", &["nge hurricane yakhe", "xh"], Some("ŋɡ̤ˈɛː hˈɝəkʰˌeᶦn jˈaːkʰɛ")),
    ("phonemize", &["nge district yakhe", "xh"], Some("ŋɡ̤ˈɛː dˈɪstɹɪkt jˈaːkʰɛ")),
    ("phonemize", &["nge electric yakhe", "xh"], Some("ŋɡ̤ˈɛː ɪlˈɛktɹɪk jˈaːkʰɛ")),
    ("phonemize", &["nge atlantic yakhe", "xh"], Some("ŋɡ̤ˈɛː ətlˈæntɪk jˈaːkʰɛ")),
    ("phonemize", &["nge cuba yakhe", "xh"], Some("ŋɡ̤ˈɛː kǀˈuːɓa jˈaːkʰɛ")),
    ("phonemize", &["nge cima yakhe", "xh"], Some("ŋɡ̤ˈɛː kǀˈiːma jˈaːkʰɛ")),
    ("phonemize", &["nge china yakhe", "xh"], Some("ŋɡ̤ˈɛː t͡ʃˈaᶦnə jˈaːkʰɛ")),
    ("phonemize", &["ukucula", "xh"], Some("ukʼukǀˈuːla")),
    ("phonemize", &["iqiniso", "xh"], Some("ikǃinˈiːsɔ")),
    ("phonemize", &["ixesha", "xh"], Some("ikǁˈɛːʃa")),
    ("phonemize", &["uma ngo ama kahle yonke kuba moya", "xh"], Some("ˈuːma ŋɡ̤ˈɔː ˈaːma kʼˈaːɬɛ jˈɔːŋkʼɛ kʼˈuːɓa mˈɔːja")),
    ("phonemize", &["cha", "xh"], Some("kǀʰˈaː")),
    ("phonemize", &["cela", "xh"], Some("kǀˈɛːla")),
    ("phonemize", &["caba", "xh"], Some("kǀˈaːɓa")),
    ("phonemize", &["cima", "xh"], Some("kǀˈiːma")),
    ("phonemize", &["coca", "xh"], Some("kǀˈɔːkǀa")),
    ("phonemize", &["xhosa", "xh"], Some("kǁʰˈɔːsa")),
    ("phonemize", &["canada", "xh"], Some("kʼanˈaːd̤a")),
    ("phonemize", &["congo", "xh"], Some("kʼˈɔːŋɡ̤ɔ")),
    ("phonemize", &["mexico", "xh"], Some("mɛkʼsˈiːkʼɔ")),
    ("phonemize", &["china", "xh"], Some("t͡ʃˈaᶦnə")),
    ("phonemize", &["carolina", "xh"], Some("kʰˌɛɹəlˈaᶦnə")),
    ("phonemize", &["chile", "xh"], Some("t͡ʃˈɪli")),
    ("phonemize", &["cuerden", "xh"], Some("kjˌuːˈɝd̬ən")),
    ("phonemize", &["cadwalder", "xh"], Some("kʰˈædwɔːɫdɚ")),
    ("phonemize", &["corniglia", "xh"], Some("kʰˌɔːɹniɡliʲˈɑː")),
    ("phonemize", &["choudhary", "xh"], Some("t͡ʃˌaᶷdˌɑːɹˈaᶦ")),
    ("phonemize", &["capuzzo", "xh"], Some("kɑːpʰˈuːzoᶷ")),
    ("phonemize", &["chhatrapati", "xh"], Some("t͡ʃhˌætɹəpʰˈeᶦʃə")),
    ("phonemize", &["cishe", "xh"], Some("kǀˈiːʃɛ")),
    ("phonemize", &["xesha", "xh"], Some("kǁˈɛːʃa")),
    ("phonemize", &["qiniseka", "xh"], Some("kǃinisˈɛːkʼa")),
    ("phonemize", &["cwaka", "xh"], Some("kǀwˈaːkʼa")),
    ("phonemize", &["ukucela", "xh"], Some("ukʼukǀˈɛːla")),
    ("phonemize", &["compyutha", "xh"], Some("kǀɔmpʼjˈuːtʰa")),
    ("phonemize", &["qho", "xh"], Some("kǃʰˈɔː")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_xhosa(None, None).unwrap();
        let mut count = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => e.phonemize_word(&js(args[0])).to_string_lossy(),
                "createXhosa().text" => e.text(&js(args[0])).to_string_lossy(),
                "numberToWords" => e
                    .number_to_words(
                        crate::core::js_string::js_number(&js(args[0])),
                        args.get(1).map(|r| js(r)).as_ref(),
                    )
                    .to_string_lossy(),
                "normalizeXhosa" => e.normalize(&js(args[0])).to_string_lossy(),
                "phonemize" => crate::phonemize(args[0], args[1]).unwrap(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            count += 1;
        }
        assert_eq!(count, 161);
    }
}

/// #1593, as test/sbantu-defects-1593.test.ts: `±` is read, not dropped. Relational, so no IPA is typed.
#[cfg(test)]
mod sbantu_defects_1593 {
    use crate::phonemize;

    #[test]
    fn plus_minus_is_read() {
        let p = |t: &str| phonemize(t, "xh").unwrap();
        assert_eq!(
            p("Ubushushu bu-±5 apha"),
            p("Ubushushu bu- plas o mayinas 5 apha")
        );
        assert_ne!(p("±5"), p("5"));
    }
}
