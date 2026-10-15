//! Setswana (tn) phonemizer: a greedy longest-match scan over the grapheme table (a missed letter read through the
//! shared Latin phones), and text() over the two-pass normalizer around the shared symbol tier.
//! Ported from src/languages/setswana/setswana.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{GRAPHEME_KEYS, MANIFEST, try_manifest};
use super::normalize::{normalize_setswana_post, normalize_setswana_pre};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::registry::{Engine, PhonemizeError};

/// `phonemizeWord(word)`: segmental IPA; a letter with no grapheme rule goes through `latinPhone`.
pub fn phonemize_word(word: &JsString) -> JsString {
    let w = word.to_lower_case();
    let mut out = JsString::new();
    let mut i = 0;
    while i < w.len() {
        if let Some((key, ipa)) = GRAPHEME_KEYS
            .iter()
            .find(|(k, _)| w.0[i..].starts_with(&k.0))
        {
            out.push_str(ipa);
            i += key.len();
        } else {
            let opts = PhoneOpts {
                initial: i == 0,
                include_h: true,
            };
            if let Some(p) = latin_phone(&w.char_at(i), opts) {
                out.push_str(&p);
            }
            i += 1;
        }
    }
    out
}

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.!?…,;:])", *LATIN_RUN), "giu").unwrap());

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: Setswana's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser("[a-zšêô]", "iu")));

/// `SYMBOLS`'s argument, generated from the object literal in setswana.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it, except `ampersand`, which is the
/// manifest's `numbers.and`. No `countForm`: the default selector.
static SYMBOL_DATA: LazyLock<String> = LazyLock::new(|| {
    let and = serde_json::to_string(&MANIFEST.numbers.and).unwrap();
    format!(
        r#"{{"percent":["mo lekgolong"],"currency":{{"US$":["didolara","didolara di le"],"$":["didolara","didolara di le"],"£":["diponto","diponto di le"],"P":["dipula","dipula di le"]}},"units":{{"m³":["dikhubikimitara","dikhubikimitara di le"],"m3":["dikhubikimitara","dikhubikimitara di le"],"km":["dikilometara","dikilometara di le"],"mm":["dimilimetara","dimilimetara di le"],"cm":["disentimetara","disentimetara di le"],"kg":["dikilogerama","dikilogerama di le"],"ha":["diheketara","diheketara di le"],"mi":["dimaele","dimaele di le"],"m":["dimetara","dimetara di le"]}},"unitPer":"ka","rateDenominators":{{"h":"ura","s":"motsotswana"}},"exponentWords":{{"squared":["sekwere sa"],"position":"before"}},"unitPrefix":true,"currencyPrefix":true,"ampersand":{and}}}"#
    )
});

static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let data: SymbolData = serde_json::from_str(&SYMBOL_DATA).map_err(|e| e.to_string())?;
    make_symbol_normalizer(&data)
});

/// The Setswana engine (`createSetswana`).
pub struct SetswanaPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `SetswanaPhonemizer` proves the manifest and the
/// symbol tier loaded. (The per-module differentials call them.)
impl SetswanaPhonemizer {
    pub fn normalize_pre(&self, text: &JsString) -> JsString {
        normalize_setswana_pre(text)
    }

    pub fn normalize_post(&self, text: &JsString) -> JsString {
        normalize_setswana_post(text)
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

    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized =
            normalize_setswana_post(&self.symbols.apply(&normalize_setswana_pre(input)));
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                sink.emit(&phonemize_word(&NAT(&w)));
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

impl Engine for SetswanaPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(SetswanaPhonemizer::text(self, input))
    }
}

/// `createSetswana()`: loads the manifest and the symbol tier, or says which failed.
pub fn create_setswana() -> Result<SetswanaPhonemizer, String> {
    try_manifest()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(SetswanaPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/setswana.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("phonemizeWord", &["kgomo"], Some("k͡χʰʊmʊ")),
    ("phonemizeWord", &["kgosi"], Some("k͡χʰʊsi")),
    ("phonemizeWord", &["tlhogo"], Some("t͡ɬʰʊχʊ")),
    ("phonemizeWord", &["tshaba"], Some("t͡sʰaba")),
    ("phonemizeWord", &["batswana"], Some("bat͡swana")),
    ("phonemizeWord", &["motho"], Some("mʊtʰʊ")),
    ("phonemizeWord", &["dijo"], Some("did͡ʒʊ")),
    ("phonemizeWord", &["legodimo"], Some("lɪχʊdimʊ")),
    ("phonemizeWord", &["segolo"], Some("sɪχʊlʊ")),
    ("phonemizeWord", &["nyaga"], Some("ɲaχa")),
    ("phonemizeWord", &["ngwana"], Some("ŋwana")),
    ("phonemizeWord", &["senya"], Some("sɪɲa")),
    ("phonemizeWord", &["dumela"], Some("dumɪla")),
    ("phonemizeWord", &["tsela"], Some("t͡sɪla")),
    ("phonemizeWord", &["bola"], Some("bʊla")),
    ("phonemizeWord", &["bôla"], Some("bɔla")),
    ("phonemizeWord", &["mmele"], Some("mmɪlɪ")),
    ("phonemizeWord", &["ntlha"], Some("nt͡ɬʰa")),
    ("createSetswana().text", &["1"], Some("bʊŋwɪ")),
    ("createSetswana().text", &["8"], Some("bʊfɪra bʊbɪdi")),
    ("createSetswana().text", &["10"], Some("lɪsʊmɪ")),
    ("createSetswana().text", &["15"], Some("lɪsʊmɪ lɪ bʊt͡ɬʰanʊ")),
    ("createSetswana().text", &["20"], Some("masʊmɪ a mabɪdi")),
    ("createSetswana().text", &["21"], Some("masʊmɪ a mabɪdi lɪ bʊŋwɪ")),
    ("createSetswana().text", &["100"], Some("lɪk͡χʰʊlʊ")),
    ("createSetswana().text", &["1000"], Some("sɪkɪtɪ")),
    ("createSetswana().text", &["2025"], Some("dikɪtɪ t͡sɪ pɪdi lɪ masʊmɪ a mabɪdi lɪ bʊt͡ɬʰanʊ")),
    ("createSetswana().text", &["77%"], Some("masʊmɪ a supaŋ lɪ bʊsupa mʊ lɪk͡χʰʊlʊŋ")),
    ("createSetswana().text", &["2%"], Some("bʊbɪdi mʊ lɪk͡χʰʊlʊŋ")),
    ("createSetswana().text", &["88.5%"], Some("masʊmɪ a fɪraŋ bʊbɪdi lɪ bʊfɪra bʊbɪdi nt͡ɬʰa bʊt͡ɬʰanʊ mʊ lɪk͡χʰʊlʊŋ")),
    ("createSetswana().text", &["$5"], Some("didʊlara di lɪ bʊt͡ɬʰanʊ")),
    ("createSetswana().text", &["US$5"], Some("didʊlara di lɪ bʊt͡ɬʰanʊ")),
    ("createSetswana().text", &["£6"], Some("dipʊntʊ di lɪ bʊratarʊ")),
    ("createSetswana().text", &["P10"], Some("dipula di lɪ lɪsʊmɪ")),
    ("createSetswana().text", &["R1 billion"], Some("diranta di lɪ bʊŋwɪ billiʊn")),
    ("createSetswana().text", &["R268.26"], Some("diranta di lɪ mak͡χʰʊlʊ a mabɪdi lɪ masʊmɪ a maratarʊ lɪ bʊfɪra bʊbɪdi nt͡ɬʰa bʊbɪdi bʊratarʊ")),
    ("createSetswana().text", &["tsela ya R59"], Some("t͡sɪla ja r masʊmɪ a mat͡ɬʰanʊ lɪ bʊfɪra bʊŋwɪ")),
    ("createSetswana().text", &["€10"], Some("lɪsʊmɪ")),
    ("createSetswana().text", &["15 km"], Some("dikilʊmɪtara di lɪ lɪsʊmɪ lɪ bʊt͡ɬʰanʊ")),
    ("createSetswana().text", &["650 mm"], Some("dimilimɪtara di lɪ mak͡χʰʊlʊ a maratarʊ lɪ masʊmɪ a mat͡ɬʰanʊ")),
    ("createSetswana().text", &["100 m"], Some("dimɪtara di lɪ lɪk͡χʰʊlʊ")),
    ("createSetswana().text", &["50 kg"], Some("dikilʊχɪrama di lɪ masʊmɪ a mat͡ɬʰanʊ")),
    ("createSetswana().text", &["200km"], Some("dikilʊmɪtara di lɪ mak͡χʰʊlʊ a mabɪdi")),
    ("createSetswana().text", &["km"], Some("dikilʊmɪtara")),
    ("createSetswana().text", &["802.11m"], Some("mak͡χʰʊlʊ a fɪraŋ bʊbɪdi lɪ bʊbɪdi nt͡ɬʰa bʊŋwɪ bʊŋwɪ m")),
    ("createSetswana().text", &["6.5m"], Some("dimɪtara di lɪ bʊratarʊ nt͡ɬʰa bʊt͡ɬʰanʊ")),
    ("createSetswana().text", &["604 km2"], Some("sɪkwɪrɪ sa dikilʊmɪtara di lɪ mak͡χʰʊlʊ a maratarʊ lɪ bʊnɪ")),
    ("createSetswana().text", &["1400 km²"], Some("sɪkwɪrɪ sa dikilʊmɪtara di lɪ sɪkɪtɪ lɪ mak͡χʰʊlʊ a manɪ")),
    ("createSetswana().text", &["13 m3"], Some("dikʰubikimitara di lɪ lɪsʊmɪ lɪ bʊrarʊ")),
    ("createSetswana().text", &["13 m³"], Some("dikʰubikimitara di lɪ lɪsʊmɪ lɪ bʊrarʊ")),
    ("createSetswana().text", &["97 km/h"], Some("dikilʊmɪtara di lɪ masʊmɪ a fɪraŋ bʊŋwɪ lɪ bʊsupa ka ura")),
    ("createSetswana().text", &["5 m/s"], Some("dimɪtara di lɪ bʊt͡ɬʰanʊ ka mʊt͡sʊt͡swana")),
    ("createSetswana().text", &["76s"], Some("masʊmɪ a supaŋ lɪ bʊratarʊ s")),
    ("createSetswana().text", &["40 °C"], Some("dikirii t͡sa kɪlkius di lɪ masʊmɪ a manɪ")),
    ("createSetswana().text", &["5 °F"], Some("dikirii t͡sa fahrɪnhɪit di lɪ bʊt͡ɬʰanʊ")),
    ("createSetswana().text", &["26°"], Some("dikirii di lɪ masʊmɪ a mabɪdi lɪ bʊratarʊ")),
    ("createSetswana().text", &["−6 °C"], Some("dikirii t͡sa kɪlkius t͡sɪ di kwa t͡ɬasɪ χa lɪfɪla di lɪ bʊratarʊ")),
    ("createSetswana().text", &["-6°C"], Some("dikirii t͡sa kɪlkius t͡sɪ di kwa t͡ɬasɪ χa lɪfɪla di lɪ bʊratarʊ")),
    ("createSetswana().text", &["10-15 °C"], Some("lɪsʊmɪ dikirii t͡sa kɪlkius di lɪ lɪsʊmɪ lɪ bʊt͡ɬʰanʊ")),
    ("createSetswana().text", &["231,626"], Some("dikɪtɪ t͡sɪ mak͡χʰʊlʊ a mabɪdi lɪ masʊmɪ a mararʊ lɪ bʊŋwɪ lɪ mak͡χʰʊlʊ a maratarʊ lɪ masʊmɪ a mabɪdi lɪ bʊratarʊ")),
    ("normalizeSetswanaPost", &["1.766"], Some("1766")),
    ("normalizeSetswanaPost", &["18 443"], Some("18443")),
    ("normalizeSetswanaPost", &["604.3"], Some("604 ntlha 3")),
    ("normalizeSetswanaPost", &["3,4"], Some("3 ntlha 4")),
    ("normalizeSetswanaPost", &["0.001"], Some("0 ntlha 0 0 1")),
    ("normalizeSetswanaPost", &["9.75"], Some("9 ntlha 7 5")),
    ("createSetswana().text", &["15–49"], Some("lɪsʊmɪ lɪ bʊt͡ɬʰanʊ χʊ ja χʊ masʊmɪ a manɪ lɪ bʊfɪra bʊŋwɪ")),
    ("normalizeSetswanaPost", &["457 - 474"], Some("457 go ya go 474")),
    ("normalizeSetswanaPost", &["2016-17"], Some("2016-17")),
    ("normalizeSetswanaPost", &["40-0"], Some("40-0")),
    ("normalizeSetswanaPost", &["ISBN 1-58479-341-4"], Some("ISBN 1-58479-341-4")),
    ("normalizeSetswanaPost", &["486–501."], Some("486 go ya go 501.")),
    ("normalizeSetswanaPost", &["2005-2006."], Some("2005 go ya go 2006.")),
    ("normalizeSetswanaPost", &["1940-1947?"], Some("1940 go ya go 1947?")),
    ("normalizeSetswanaPost", &["5-13.7"], Some("5-13 ntlha 7")),
    ("normalizeSetswanaPost", &["doi:10.1080/1469-8219.00039"], Some("doi:10.1080/1469-8219.00039")),
    ("normalizeSetswanaPost", &["5-13,7"], Some("5-13 ntlha 7")),
    ("normalizeSetswanaPost", &["7:00 p.m."], Some("diura di le 7 thapama")),
    ("normalizeSetswanaPost", &["6:19 p.m."], Some("diura di le 6 le metsotso e le 19 thapama")),
    ("normalizeSetswanaPost", &["7:00 a.m."], Some("diura di le 7 mo mosong")),
    ("normalizeSetswanaPost", &["1:30 mo mosong"], Some("diura di le 1 le metsotso e le 30 mo mosong")),
    ("normalizeSetswanaPost", &["11:51"], Some("11:51")),
    ("normalizeSetswanaPost", &["2:54.47"], Some("2:54 ntlha 4 7")),
    ("normalizeSetswanaPost", &["01:04:02"], Some("01:04:02")),
    ("normalizeSetswanaPost", &["UTC+02:00"], Some("UTC+02:00")),
    ("createSetswana().text", &["1400&nbsp;km²"], Some("sɪkwɪrɪ sa dikilʊmɪtara di lɪ sɪkɪtɪ lɪ mak͡χʰʊlʊ a manɪ")),
    ("normalizeSetswanaPre", &["A&nbsp;B"], Some("A B")),
    ("createSetswana().text", &["Food & Agriculture"], Some("fʊʊd lɪ aχrikulturɪ")),
    ("normalizeSetswanaPost", &["B&B"], Some("B&B")),
    ("createSetswana().text", &["20th"], Some("masʊmɪ a mabɪdi")),
    ("normalizeSetswanaPost", &["3rd"], Some("3")),
    ("normalizeSetswanaPost", &["11De"], Some("11De")),
    ("normalizeSetswanaPre", &["Lefatshe la Botswana le kwa borwa jwa Aforika, ke lefatshe le le dikaganyeditsweng."], Some("Lefatshe la Botswana le kwa borwa jwa Aforika, ke lefatshe le le dikaganyeditsweng.")),
    ("normalizeSetswanaPost", &["Lefatshe la Botswana le kwa borwa jwa Aforika, ke lefatshe le le dikaganyeditsweng."], Some("Lefatshe la Botswana le kwa borwa jwa Aforika, ke lefatshe le le dikaganyeditsweng.")),
    ("createSetswana().text", &["Ke motse. Ke motse."], Some("kɪ mʊt͡sɪ . kɪ mʊt͡sɪ .")),
    ("phonemize", &["bokete jwa 4 -5 kg", "tn"], Some("bʊkɪtɪ d͡ʒwa dikilʊχɪrama di lɪ bʊnɪ χʊ ja χʊ bʊt͡ɬʰanʊ")),
    ("phonemize", &["5-10 km", "tn"], Some("dikilʊmɪtara di lɪ bʊt͡ɬʰanʊ χʊ ja χʊ lɪsʊmɪ")),
    ("phonemize", &["ke 12-13 m3 ka motsotswana", "tn"], Some("kɪ dikʰubikimitara di lɪ lɪsʊmɪ lɪ bʊbɪdi χʊ ja χʊ lɪsʊmɪ lɪ bʊrarʊ ka mʊt͡sʊt͡swana")),
    ("phonemize", &["10-5 km", "tn"], Some("lɪsʊmɪ dikilʊmɪtara di lɪ bʊt͡ɬʰanʊ")),
    ("phonemize", &["bokete jwa 4-5", "tn"], Some("bʊkɪtɪ d͡ʒwa bʊnɪ χʊ ja χʊ bʊt͡ɬʰanʊ")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_setswana().unwrap();
        let mut count = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => e.phonemize_word(&js(args[0])).to_string_lossy(),
                "createSetswana().text" => e.text(&js(args[0])).to_string_lossy(),
                "normalizeSetswanaPre" => e.normalize_pre(&js(args[0])).to_string_lossy(),
                "normalizeSetswanaPost" => e.normalize_post(&js(args[0])).to_string_lossy(),
                "phonemize" => crate::phonemize(args[0], args[1]).unwrap(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            count += 1;
        }
        assert_eq!(count, 100);
    }
}
