//! Zulu (zu) phonemizer: the shared Nguni scan, penultimate stress with lengthening, a lexical tone overlay from
//! tone.tsv, the camelCase compound split, the loan lexicon and the English route for click-letter loans.
//! Ported from src/languages/zulu/zulu.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{Arc, LazyLock, OnceLock};

use indexmap::IndexMap;

use super::g2p::{RULES, Seg, to_segments};
use super::manifest::{DIR, MANIFEST, try_manifest};
use super::nguni_loans::{LoanReading, de_click, nguni_loan};
use super::normalize::normalize_zulu;
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::foreign::ForeignPhonemizer;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_map};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// The English-dictionary test the registry supplies (`knownWord(w) !== undefined`).
pub type EnglishWordTest = Arc<dyn Fn(&JsString) -> bool + Send + Sync>;

/// `toneLexicon()`: word → per-vowel tone codes (optional, values trimmed, no fold).
pub fn try_tone_lexicon() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static T: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&T, || {
        load_tsv_map(
            DIR,
            "tone.tsv",
            |v, _| Some(v.trim()),
            TsvOptions {
                optional: true,
                fold: None,
            },
        )
        .map_err(|e| e.to_string())
    })
}

fn tone_lexicon() -> &'static IndexMap<JsString, JsString> {
    try_tone_lexicon().unwrap_or_else(|e| panic!("{e}"))
}

/// `word.split(re)` for a pattern with no capture groups, cut at each match (zero-width ones included).
fn split_at_matches(word: &JsString, re: &JsRegex) -> Vec<JsString> {
    let mut parts = Vec::new();
    let mut from = 0;
    for m in re.match_all(word) {
        if m.end() == from && m.index() == from {
            continue;
        }
        parts.push(JsString::from_units(&word.0[from..m.index()]));
        from = m.end();
    }
    parts.push(JsString::from_units(&word.0[from..]));
    parts
}

/// `phonemizeCompound(word)`: split before an internal Titlecase run; a full-word tone entry is threaded across
/// the parts. The `SPLIT` pattern is run global to collect its cut points (`String.prototype.split`).
pub fn phonemize_compound(word: &JsString) -> Vec<JsString> {
    let parts = split_at_matches(word, js_re!(r"(?<=.)(?=[A-Z][a-z])", "gu"));
    if parts.len() == 1 {
        return vec![phonemize_word(word, None)];
    }
    let Some(codes) = tone_lexicon().get(&word.to_lower_case()) else {
        return parts
            .iter()
            .map(|p| phonemize_word(p, Some(&JsString::new())))
            .collect();
    };
    let mut out = Vec::new();
    let mut ci = 0;
    for p in &parts {
        let nv = to_segments(p, &RULES).iter().filter(|s| s.v).count();
        let slice = codes.slice(ci as isize, Some((ci + nv) as isize));
        out.push(phonemize_word(p, Some(&slice)));
        ci += nv;
    }
    out
}

/// `phonemizeWord(word, toneCodes?)`: segments, penultimate ˈ + ː, and the tone after each vowel.
pub fn phonemize_word(word: &JsString, tone_codes: Option<&JsString>) -> JsString {
    let segs: Vec<Seg> = to_segments(word, &RULES);
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
    let lex;
    let codes = match tone_codes {
        Some(c) => c,
        None => {
            lex = tone_lexicon()
                .get(&word.to_lower_case())
                .cloned()
                .unwrap_or_default();
            &lex
        }
    };
    let mut out = JsString::new();
    let mut vi = 0;
    for (i, s) in segs.iter().enumerate() {
        if s.v {
            if i == stress_idx {
                out.push_str(&js("ˈ"));
                out.push_str(&s.ph);
                out.push_str(&js("ː"));
            } else {
                out.push_str(&s.ph);
            }
            let code = codes.char_at(vi).to_string_lossy();
            if let Some(chao) = MANIFEST.tone_chao.get(&code) {
                out.push_str(&js(chao));
            }
            vi += 1;
        } else {
            out.push_str(&s.ph);
        }
    }
    out
}

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: Zulu's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser("[A-Za-z]", "u")));

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.!?…,;:])", *LATIN_RUN), "gu").unwrap());

/// `SYMBOLS`'s argument, generated from the object literal in zulu.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it. No `countForm`: the default selector.
const SYMBOL_DATA: &str = r#"{"multiply":{"times":"kuphindwe ngo-"},"percent":["amaphesenti"],"currency":{"US$":["amadola"],"AUD$":["amadola"],"$":["amadola"],"£":["amaphawundi"]},"units":{"km":["amakhilomitha"],"m":["amamitha"],"mm":["amamilimitha"],"cm":["amasentimitha"],"kg":["amakhilogremu"],"mi":["amamayela"],"ft":["amafidi"]},"exponentWords":{"squared":["skwele"],"position":"after"}}"#;

static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let data: SymbolData =
        crate::core::from_json::parse_json(SYMBOL_DATA).map_err(|e| e.to_string())?;
    make_symbol_normalizer(&data)
});

/// `NGUNI_ONSET`: the singles, digraphs and trigraphs `isNguniPossible` licenses.
static NGUNI_ONSET: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    let mut set: HashSet<JsString> = "bcdfghjklmnpqrstvwxyz"
        .chars()
        .map(|c| js(&c.to_string()))
        .collect();
    for o in [
        "bh", "ch", "dl", "dy", "fy", "gc", "gq", "gx", "hl", "kh", "kw", "gw", "hw", "mb", "mf",
        "mp", "mv", "nc", "nd", "ng", "nj", "nk", "nq", "nt", "nx", "ny", "nz", "ph", "qh", "sh",
        "th", "ts", "tsh", "tj", "ty", "xh", "zw", "sw", "shw", "bw", "ngc", "ngq", "ngx", "ntsh",
        "nkw", "ngw", "mbw", "ndw", "njw", "nyw", "hh", "dw", "tw", "kl", "pl", "qw", "cw", "xw",
    ] {
        set.insert(js(o));
    }
    set
});

fn is_nguni_possible(word: &JsString) -> bool {
    if !js_re!(r"[aeiou]$", "u").test(word) {
        return false;
    }
    split_at_matches(word, js_re!(r"[aeiou]+", "gu"))
        .iter()
        .filter(|r| !r.is_empty())
        .all(|r| NGUNI_ONSET.contains(r))
}

/// `isForeignNguniWord(word, isEnglishWord)`: a click letter, not Nguni-shaped, and a known English word. Xhosa's
/// module carries a byte-identical copy (onset set included), and its port calls this one.
pub fn is_foreign_nguni_word(word: &JsString, is_english_word: &dyn Fn(&JsString) -> bool) -> bool {
    js_re!(r"[cqx]", "u").test(word) && !is_nguni_possible(word) && is_english_word(word)
}

/// The Zulu engine (`createZulu`).
pub struct ZuluPhonemizer {
    foreign: Option<ForeignPhonemizer>,
    is_english_word: Option<EnglishWordTest>,
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `ZuluPhonemizer` proves the manifest, the tone
/// lexicon and the symbol tier loaded. (The per-module differentials call them.)
impl ZuluPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_zulu(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    pub fn phonemize_word(&self, word: &JsString, tone_codes: Option<&JsString>) -> JsString {
        phonemize_word(word, tone_codes)
    }

    pub fn phonemize_compound(&self, word: &JsString) -> Vec<JsString> {
        phonemize_compound(word)
    }

    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    pub fn segments(&self, word: &JsString) -> Vec<Seg> {
        to_segments(word, &RULES)
    }

    pub fn number_to_words(&self, n: f64) -> JsString {
        number_to_words(n)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self.symbols.apply(&normalize_zulu(input));
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                let lower = w.to_lower_case();
                let loan = nguni_loan(&lower);
                if let (Some(LoanReading::Foreign), Some(f)) = (loan, &self.foreign) {
                    sink.emit(&f(&w));
                } else if loan == Some(LoanReading::Declick) {
                    for part in phonemize_compound(&NAT(&de_click(&lower))) {
                        sink.emit(&part);
                    }
                } else if let (Some(f), Some(eng)) = (&self.foreign, &self.is_english_word)
                    && is_foreign_nguni_word(&lower, &**eng)
                {
                    sink.emit(&f(&w));
                } else {
                    for part in phonemize_compound(&NAT(&w)) {
                        sink.emit(&part);
                    }
                }
            } else if let Some(n) = m.group(2, s) {
                for wd in number_to_words(js_number(&n)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd, None));
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

impl Engine for ZuluPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(ZuluPhonemizer::text(self, input))
    }
}

/// `createZulu(foreign?, isEnglishWord?)`: loads the manifest, the tone lexicon and the symbol tier, or says
/// which failed.
pub fn create_zulu(
    foreign: Option<ForeignPhonemizer>,
    is_english_word: Option<EnglishWordTest>,
) -> Result<ZuluPhonemizer, String> {
    if try_manifest()?.ordinal_ye.is_none() {
        return Err("languages/zulu/zulu.jsonc: `ordinalYe` is missing".to_string());
    }
    try_tone_lexicon()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(ZuluPhonemizer {
        foreign,
        is_english_word,
        symbols,
    })
}

#[cfg(all(test, feature = "zu"))]
mod tests {
    use super::*;

    // Every call test/zulu.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["cela"], Some("kǀˈɛːla")),
    ("phonemizeWord", &["qala"], Some("kǃˈaːla")),
    ("phonemizeWord", &["xola"], Some("kǁˈɔːla")),
    ("phonemizeWord", &["chaza"], Some("kǀʰˈaːz̤a")),
    ("phonemizeWord", &["gcina"], Some("ɡ̤ǀˈiːna")),
    ("phonemizeWord", &["banga"], Some("ɓˈaːŋɡ̤a")),
    ("phonemizeWord", &["phuma"], Some("pʰˈuːma")),
    ("phonemizeWord", &["thanda"], Some("tʰˈaːnd̤a")),
    ("phonemizeWord", &["zonke"], Some("z̤ˈɔːŋkʼɛ")),
    ("phonemizeWord", &["hlala"], Some("ɬˈaːla")),
    ("phonemizeWord", &["dlala"], Some("ɮ̤ˈaː˥˩la˩")),
    ("phonemizeWord", &["klabe"], Some("k͡xʼˈaːɓɛ")),
    ("phonemizeWord", &["njani"], Some("ɲd͡ʒ̤ˈaːni")),
    ("phonemizeWord", &["abantu"], Some("a˩ɓˈaː˥ntʼu˩")),
    ("phonemizeWord", &["umuntu"], Some("u˩mˈuː˥ntʼu˩")),
    ("phonemizeWord", &["labantu"], Some("laɓˈaːntʼu")),
    ("phonemize", &["1", "zu"], Some("kʼˈuːɲɛ")),
    ("phonemize", &["10", "zu"], Some("i˥˩ʃˈuː˥˩mi˩")),
    ("phonemize", &["100", "zu"], Some("i˥˩kʰˈuː˥˩lu˩")),
    ("phonemize", &["21", "zu"], Some("amaʃˈuːmi amaɓˈiːli nˈaːɲɛ")),
    ("phonemize", &["3", "zu"], Some("kʼutʰˈaːtʰu")),
    ("phonemize", &["5", "zu"], Some("kʼuɬˈaːnu")),
    ("phonemize", &["13", "zu"], Some("i˥˩ʃˈuː˥˩mi˩ nantʼˈaːtʰu")),
    ("phonemize", &["15", "zu"], Some("i˥˩ʃˈuː˥˩mi˩ nanɬˈaːnu")),
    ("phonemize", &["555", "zu"], Some("amakʰˈuːlu amaɬˈaːnu amaʃˈuːmi amaɬˈaːnu nanɬˈaːnu")),
    ("phonemize", &["2000", "zu"], Some("iz̤iŋkʼuluŋɡ̤wˈaːnɛ amaɓˈiːli")),
    ("phonemize", &["1000000", "zu"], Some("i˩si˥ɡ̤ˈiː˩d̤i˩")),
    ("phonemize", &["isiNgisi", "zu"], Some("ˈiː˥si˩ ŋɡ̤ˈiː˥si˩")),
    ("phonemize", &["isiTsonga", "zu"], Some("ˈiːsi t͡sʼˈɔːŋɡ̤a")),
    ("normalizeZulu", &["angu-1,000"], Some("angu-1000")),
    ("normalizeZulu", &["u-755,688"], Some("u-755688")),
    ("normalizeZulu", &["ezi-5,000,000"], Some("ezi-5000000")),
    ("normalizeZulu", &["angu-1,000, futhi"], Some("angu-1000, futhi")),
    ("normalizeZulu", &["nangu-2,207."], Some("nangu-2207.")),
    ("normalizeZulu", &["ezingu-1,5 ziyahamba"], Some("ezingu-1 5 ziyahamba")),
    ("normalizeZulu", &["ngo-12,00 GMT"], Some("ngo-12 ji emu thi")),
    ("normalizeZulu", &["ku- 100 000 abantu"], Some("ku- 100000 abantu")),
    ("normalizeZulu", &["ye-6 ngo-6"], Some("ye-6 ngo-6")),
    ("normalizeZulu", &["6 × 6"], Some("6 kuphindwe ngo-6")),
    ("normalizeZulu", &["x = y"], Some("x kulingana no-y")),
    ("normalizeZulu", &["5 < 6"], Some("5 ngaphansi kuka-6")),
    ("normalizeZulu", &["6 > 5"], Some("6 ngaphezu kuka-5")),
    ("normalizeZulu", &["(UTC+1)"], Some("(yu thi si plas 1)")),
    ("normalizeZulu", &["-5"], Some("ukukhipha 5")),
    ("normalizeZulu", &["ngo-26 -00 kalula"], Some("ngo-26 -00 kalula")),
    ("normalizeZulu", &["wama-10 -11"], Some("wama-10 kuya ku-11")),
    ("normalizeZulu", &["angu-1.5"], Some("angu-1 5")),
    ("normalizeZulu", &["angu-6.34"], Some("angu-6 3 4")),
    ("normalizeZulu", &["engu-3.50 m"], Some("engu-3 5 amamitha")),
    ("normalizeZulu", &["u-1.05"], Some("u-1 0 5")),
    ("normalizeZulu", &["Umfanekiso 1.1."], Some("Umfanekiso 1 1.")),
    ("normalizeZulu", &["lika-802.11n"], Some("lika-802 1 1n")),
    ("normalizeZulu", &["1.1.1"], Some("1.1.1")),
    ("normalizeZulu", &["ku-$2.3 bhiliyoni"], Some("ku-2 3 amadola bhiliyoni")),
    ("normalizeZulu", &["u-$14.7 wamabhiliyoni"], Some("u-14 7 amadola wamabhiliyoni")),
    ("normalizeZulu", &["ngo-12.8 km"], Some("ngo-12 8 amakhilomitha")),
    ("normalizeZulu", &["ezingu-2.2 km2"], Some("ezingu-2 2 amakhilomitha skwele")),
    ("normalizeZulu", &["engu-2.2 km²"], Some("engu-2 2 amakhilomitha skwele")),
    ("normalizeZulu", &["Ngo-11:20"], Some("Ngo-11 nemizuzu engu-20")),
    ("normalizeZulu", &["ngo-10:00 ekuseni"], Some("ngo-10 ekuseni")),
    ("normalizeZulu", &["ngo-07:19"], Some("ngo-7 nemizuzu engu-19")),
    ("normalizeZulu", &["ngawo- 9: 30"], Some("ngawo- 9 nemizuzu engu-30")),
    ("normalizeZulu", &["ngo-1:15 a.m."], Some("ngo-1 nemizuzu engu-15 ekuseni")),
    ("normalizeZulu", &["ngo-8:30 p.m."], Some("ngo-8 nemizuzu engu-30 ntambama")),
    ("normalizeZulu", &["ngo-23:59"], Some("ngo-23 nemizuzu engu-59")),
    ("normalizeZulu", &["ngo-25:00"], Some("ngo-25:00")),
    ("normalizeZulu", &["esingu-4:41.30,"], Some("esingu-4 41 30,")),
    ("normalizeZulu", &["ngo-1:09.02"], Some("ngo-1 09 02")),
    ("normalizeZulu", &["(15.00 UTC)"], Some("(15 UTC)")),
    ("normalizeZulu", &["(0230 UTC)"], Some("(2 nemizuzu engu-30 yu thi si)")),
    ("normalizeZulu", &["angu-3-5"], Some("angu-3 kuya ku-5")),
    ("normalizeZulu", &["(1418 – 1450)"], Some("(1418 kuya ku-1450)")),
    ("normalizeZulu", &["ngo-26 -00"], Some("ngo-26 -00")),
    ("normalizeZulu", &["ngo-1995-96"], Some("ngo-1995-96")),
    ("normalizeZulu", &["5-3"], Some("5-3")),
    ("normalizeZulu", &["ezingu-4.2-3.9"], Some("ezingu-4 2 kuya ku-3 9")),
    ("normalizeZulu", &["ku-1,000-1,300"], Some("ku-1000 kuya ku-1300")),
    ("normalizeZulu", &["u-165 km/h"], Some("u-165 amakhilomitha ngehora")),
    ("normalizeZulu", &["133 m/s"], Some("133 amamitha ngomzuzwana")),
    ("normalizeZulu", &["kuka-160km/h"], Some("kuka-160 amakhilomitha ngehora")),
    ("normalizeZulu", &["480 km / h"], Some("480 amakhilomitha ngehora")),
    ("normalizeZulu", &["300 mph"], Some("300 amamayela ngehora")),
    ("normalizeZulu", &["64 kph"], Some("64 amakhilomitha ngehora")),
    ("normalizeZulu", &["sama-kph ayishumi nanye"], Some("sama-amakhilomitha ngehora ayishumi nanye")),
    ("normalizeZulu", &["angu-5 cm/s"], Some("angu-5 amasentimitha ngomzuzwana")),
    ("normalizeZulu", &["(300,948 sq mi)"], Some("(300948 amamayela skwele)")),
    ("normalizeZulu", &["ongama-1600 kma kusuka"], Some("ongama-1600 amakhilomitha kusuka")),
    ("normalizeZulu", &["engu-2.5 kma"], Some("engu-2 5 amakhilomitha")),
    ("normalizeZulu", &["ikma yakhe"], Some("ikma yakhe")),
    ("normalizeZulu", &["kuka-+30°C"], Some("kuka- plas amazinga angu-30")),
    ("normalizeZulu", &["angu-35°F"], Some("angu-amazinga angu-35 Fahrenheit")),
    ("normalizeZulu", &["kwe-35°W"], Some("kwe-amazinga angu-35 entshonalanga")),
    ("normalizeZulu", &["40°N"], Some("amazinga angu-40 enyakatho")),
    ("normalizeZulu", &["40°S"], Some("amazinga angu-40 eningizimu")),
    ("normalizeZulu", &["40°E"], Some("amazinga angu-40 empumalanga")),
    ("normalizeZulu", &["u-90°"], Some("u-amazinga angu-90")),
    ("normalizeZulu", &["ngawo-10,000 BCE."], Some("ngawo-10000 ngaphambi kukaKristu.")),
    ("normalizeZulu", &["ngo-1000 B.C., abase-Asiriya"], Some("ngo-1000 ngaphambi kukaKristu, abase-Asiriya")),
    ("normalizeZulu", &["ku-5000 BC!"], Some("ku-5000 ngaphambi kukaKristu!")),
    ("normalizeZulu", &["i-bhi si yaseCanada"], Some("i-bhi si yaseCanada")),
    ("normalizeZulu", &["kusukela ngo-1000 B.C. Abase-Asiriya"], Some("kusukela ngo-1000 ngaphambi kukaKristu. Abase-Asiriya")),
    ("normalizeZulu", &["e-U.S. ube ngowesibili"], Some("e-yu esi ube ngowesibili")),
    ("normalizeZulu", &["uJoji W. Hlathi"], Some("uJoji W Hlathi")),
    ("normalizeZulu", &["Arts & Sciences"], Some("Arts kanye ne-Sciences")),
    ("normalizeZulu", &["amaB&amp;B"], Some("amaB kanye ne-B")),
    ("normalizeZulu", &["(1/5 yintshi)"], Some("(ingxenye yesihlanu yintshi)")),
    ("normalizeZulu", &["1/4"], Some("ingxenye yesine")),
    ("normalizeZulu", &["1/10"], Some("ingxenye yeshumi")),
    ("normalizeZulu", &["3/5"], Some("3/5")),
    ("normalizeZulu", &["1/11"], Some("1/11")),
    ("normalizeZulu", &["ilunga - bona"], Some("ilunga, bona")),
    ("normalizeZulu", &["oyedwa – ubuJuda"], Some("oyedwa, ubuJuda")),
    ("normalizeZulu", &["ezilandelayo — ngokuvamile"], Some("ezilandelayo, ngokuvamile")),
    ("phonemize", &["ingu-36mm", "zu"], Some("ˈiːŋɡ̤u amaʃˈuːmi amatʰˈaːtʰu nɛsitʰˈuːpʰa amamilimˈiːtʰa")),
    ("phonemize", &["angu-90kg", "zu"], Some("ˈaːŋɡ̤u amaʃˈuːmi ajisiʃijaɡ̤alɔlˈuːɲɛ amakʰilɔɣ̤ˈɛːmu")),
    ("phonemize", &["angu-3,850 km²", "zu"], Some("ˈaːŋɡ̤u iz̤iŋkʼuluŋɡ̤wˈaːnɛ amatʰˈaːtʰu amakʰˈuːlu ajisiʃijaɡ̤alɔmbˈiːli amaʃˈuːmi amaɬˈaːnu amakʰilɔmˈiːtʰa skʼwˈɛːlɛ")),
    ("phonemize", &["ku-US$30", "zu"], Some("kʼˈuː amaʃˈuːmi amatʰˈaːtʰu amad̤ˈɔːla")),
    ("phonemize", &["engu-AUD$45", "zu"], Some("ˈɛːŋɡ̤u amaʃˈuːmi amˈaːnɛ nanɬˈaːnu amad̤ˈɔːla")),
    ("phonemize", &["ezingu-£27", "zu"], Some("ɛz̤ˈiːŋɡ̤u amaʃˈuːmi amaɓˈiːli nɛsikʰɔmbˈiːsa amapʰawˈuːnd̤i")),
    ("phonemize", &["abangu-93%", "zu"], Some("aɓˈaːŋɡ̤u amaʃˈuːmi ajisiʃijaɡ̤alɔlˈuːɲɛ nantʼˈaːtʰu amapʰɛsˈɛːntʼi")),
    ("normalizeZulu", &["amazinga okushisa angaphezu kuka-+30°C avamile"], Some("amazinga okushisa angaphezu kuka- plas 30 avamile")),
    ("normalizeZulu", &["kufinyelela ku-30°C namuhla"], Some("kufinyelela ku-amazinga angu-30 namuhla")),
    ("normalizeZulu", &["amazinga. Kufinyelela ku-30°C"], Some("amazinga. Kufinyelela ku-amazinga angu-30")),
    ("normalizeZulu", &["empumalanga kwe-35°W."], Some("empumalanga kwe-amazinga angu-35 entshonalanga.")),
    ("normalizeZulu", &["izinga elingu-35°F"], Some("izinga elingu-amazinga angu-35 Fahrenheit")),
    ("phonemize", &["zokuthutha njll kuzo", "zu"], Some("z̤ɔkʼutʰˈuːtʰa ɲd͡ʒ̤alɔɲd͡ʒ̤ˈaːlɔ kʼˈuːz̤ɔ")),
    ("phonemize", &["kwazulu natal udkt toni", "zu"], Some("kʼwaz̤ˈuːlu nˈaːtʼal u˩d̤ɔ˩kʼɔ˥tʼˈɛː˩la˩ tʼˈɔːni")),
    ("phonemize", &["canada", "zu"], Some("kʼanˈaːd̤a")),
    ("phonemize", &["congo", "zu"], Some("kʼˈɔːŋɡ̤ɔ")),
    ("phonemize", &["mexico", "zu"], Some("mɛkʼsˈiːkʼɔ")),
    ("phonemize", &["china", "zu"], Some("t͡ʃˈaᶦnə")),
    ("phonemize", &["carolina", "zu"], Some("kʰˌɛɹəlˈaᶦnə")),
    ("phonemize", &["chile", "zu"], Some("t͡ʃˈɪli")),
    ("phonemize", &["cuerden", "zu"], Some("kjˌuːˈɝd̬ən")),
    ("phonemize", &["cadwalder", "zu"], Some("kʰˈædwɔːɫdɚ")),
    ("phonemize", &["corniglia", "zu"], Some("kʰˌɔːɹniɡliʲˈɑː")),
    ("phonemize", &["choudhary", "zu"], Some("t͡ʃˌaᶷdˌɑːɹˈaᶦ")),
    ("phonemize", &["capuzzo", "zu"], Some("kɑːpʰˈuːzoᶷ")),
    ("phonemize", &["chhatrapati", "zu"], Some("t͡ʃhˌætɹəpʰˈeᶦʃə")),
    ("phonemize", &["cha", "zu"], Some("kǀʰˈaː˥")),
    ("phonemize", &["cela", "zu"], Some("kǀˈɛːla")),
    ("phonemize", &["caba", "zu"], Some("kǀˈaːɓa")),
    ("phonemize", &["cima", "zu"], Some("kǀˈiːma")),
    ("phonemize", &["coca", "zu"], Some("kǀˈɔːkǀa")),
    ("phonemize", &["xhosa", "zu"], Some("kǁʰˈɔːsa")),
    ("phonemize", &["cishe", "zu"], Some("kǀˈiːʃɛ")),
    ("phonemize", &["xesha", "zu"], Some("kǁˈɛːʃa")),
    ("phonemize", &["qiniseka", "zu"], Some("kǃinisˈɛːkʼa")),
    ("phonemize", &["cwaka", "zu"], Some("kǀwˈaːkʼa")),
    ("phonemize", &["ukucela", "zu"], Some("ukʼukǀˈɛːla")),
    ("phonemize", &["compyutha", "zu"], Some("kǀɔmpʼjˈuːtʰa")),
    ("phonemize", &["qho", "zu"], Some("kǃʰˈɔː")),
    ("normalizeZulu", &["+35°W"], Some(" plas amazinga angu-35 entshonalanga")),
    ("normalizeZulu", &["+ 35°W"], Some(" plas amazinga angu-35 entshonalanga")),
    ("normalizeZulu", &["+30°"], Some(" plas amazinga angu-30")),
    ("normalizeZulu", &["35°W"], Some("amazinga angu-35 entshonalanga")),
    ("normalizeZulu", &["±5°"], Some(" plas o mayinas amazinga angu-5")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_zulu(None, None).unwrap();
        let mut count = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => e
                    .phonemize_word(&js(args[0]), args.get(1).map(|c| js(c)).as_ref())
                    .to_string_lossy(),
                "normalizeZulu" => e.normalize(&js(args[0])).to_string_lossy(),
                "phonemize" => crate::phonemize(args[0], args[1]).unwrap(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            count += 1;
        }
        assert_eq!(count, 157);
    }
}
