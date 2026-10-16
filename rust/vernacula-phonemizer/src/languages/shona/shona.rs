//! Shona (sn) phonemizer: a greedy longest-match scan over the grapheme table (a missed letter read through the
//! shared Latin phones), and text() over the two-pass normalizer around the shared symbol tier.
//! Ported from src/languages/shona/shona.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{GRAPHEME_KEYS, MANIFEST, try_manifest};
use super::normalize::{normalize_shona_post, normalize_shona_pre};
use super::numbers::{number_to_words, with_class6_concord};
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// `phonemizeWord(word)`: segmental IPA; a letter with no grapheme rule goes through `latinPhone`.
pub fn phonemize_word(word: &JsString) -> JsString {
    let w = js_re!("’", "gu").replace(&word.to_lower_case(), &js("'"));
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

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let run = host_word_run(&["Latin"], "'’", "").unwrap();
    JsRegex::new(&format!(r"({run})|(\d+)|([.!?…,;:])"), "giu").unwrap()
});

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: Shona's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser("[a-z'’]", "iu")));

/// `SYMBOLS`'s argument, generated from the object literal in shona.ts (key order preserved) by recording it through
/// the fn-diff symbols hook and printing `JSON.stringify` of it. No `countForm`: the default selector.
const SYMBOL_DATA: &str = r#"{"percent":["pazana"],"currency":{"US$":["madhora"],"$":["madhora"]},"currencyPrefix":true,"units":{"km":["makiromita"],"m":["mamita"],"cm":["masendimita"],"mm":["mamirimita"],"kg":["makirogiramu"],"t":["matani"],"ha":["hekita"],"l":["rita"],"L":["rita"]},"unitPrefix":true,"unitPer":"pa","rateDenominators":{"h":"awa","hr":"awa","hrs":"awa","s":"sekondi","min":"mineti"},"exponentWords":{"squared":["maskweya"],"position":"before"},"multiply":{"times":"kuwanzana ne"}}"#;

static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
    make_symbol_normalizer(&data)
});

/// The Shona engine (`createShona`).
pub struct ShonaPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `ShonaPhonemizer` proves the manifest and the
/// symbol tier loaded. (The per-module differentials call them.)
impl ShonaPhonemizer {
    pub fn normalize_pre(&self, text: &JsString) -> JsString {
        normalize_shona_pre(text)
    }

    pub fn normalize_post(&self, text: &JsString) -> JsString {
        normalize_shona_post(text)
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

    pub fn with_class6_concord(&self, words: &JsString) -> JsString {
        with_class6_concord(words)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = normalize_shona_post(&self.symbols.apply(&normalize_shona_pre(input)));
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

impl Engine for ShonaPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(ShonaPhonemizer::text(self, input))
    }
}

/// `createShona()`: loads the manifest and the symbol tier, or says which failed.
pub fn create_shona() -> Result<ShonaPhonemizer, String> {
    try_manifest()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(ShonaPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/shona.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    #[rustfmt::skip]
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
    ("numberToWords", &["1"], Some("motsi")),
    ("numberToWords", &["9"], Some("pfumbamwe")),
    ("numberToWords", &["10"], Some("gumi")),
    ("numberToWords", &["12"], Some("gumi ne piri")),
    ("phonemize", &["9", "sn"], Some("p͡fuᵐbamwe")),
    ("numberToWords", &["20"], Some("makumi maviri")),
    ("numberToWords", &["98"], Some("makumi mapfumbamwe ne sere")),
    ("numberToWords", &["100"], Some("zana")),
    ("numberToWords", &["200"], Some("mazana maviri")),
    ("numberToWords", &["305"], Some("mazana matatu ne shanu")),
    ("numberToWords", &["431"], Some("mazana mana ne makumi matatu ne motsi")),
    ("numberToWords", &["1000"], Some("chiuru")),
    ("numberToWords", &["2000"], Some("zviuru zviviri")),
    ("numberToWords", &["8000"], Some("zviuru zvisere")),
    ("numberToWords", &["3540"], Some("zviuru zvitatu ne mazana mashanu ne makumi mana")),
    ("numberToWords", &["10000"], Some("zviuru gumi")),
    ("numberToWords", &["100000"], Some("zviuru zana")),
    ("numberToWords", &["1000000"], Some("miriyoni")),
    ("numberToWords", &["1606000"], Some("miriyoni ne zviuru mazana matanhatu ne tanhatu")),
    ("numberToWords", &["431257698"], Some("mamiriyoni mazana mana ne makumi matatu ne motsi ne zviuru mazana maviri ne makumi mashanu ne nomwe ne mazana matanhatu ne makumi mapfumbamwe ne sere")),
    ("numberToWords", &["2000000000"], Some("mabhiriyoni maviri")),
    ("numberToWords", &["1000000000000"], Some("motsi zero zero zero zero zero zero zero zero zero zero zero zero")),
    ("withClass6Concord", &["piri"], Some("maviri")),
    ("withClass6Concord", &["makumi maviri ne piri"], Some("makumi maviri ne maviri")),
    ("withClass6Concord", &["zana ne shanu"], Some("zana ne mashanu")),
    ("withClass6Concord", &["motsi"], Some("motsi")),
    ("withClass6Concord", &["makumi matatu"], Some("makumi matatu")),
    ("phonemize", &["85%", "sn"], Some("makumi masere ne ʃanu pazana")),
    ("phonemize", &["$60", "sn"], Some("mad̤ora makumi matan̤atu")),
    ("phonemize", &["US$28,000", "sn"], Some("mad̤ora ɀiuru makumi maʋiri ne masere")),
    ("phonemize", &["ye$150", "sn"], Some("je mad̤ora zana ne makumi maʃanu")),
    ("phonemize", &["$2", "sn"], Some("mad̤ora maʋiri")),
    ("phonemize", &["3m", "sn"], Some("mamita matatu")),
    ("phonemize", &["105 kg", "sn"], Some("makiroɡiramu zana ne maʃanu")),
    ("phonemize", &["120 km/hr", "sn"], Some("makiromita zana ne makumi maʋiri pa awa")),
    ("phonemize", &["2 km", "sn"], Some("makiromita maʋiri")),
    ("phonemize", &["1m²", "sn"], Some("maskweja mamita mot͡si")),
    ("phonemize", &["0,5m²", "sn"], Some("maskweja mamita zero koma ʃanu")),
    ("phonemize", &["1.5m", "sn"], Some("mamita mot͡si pojiⁿdi ʃanu")),
    ("phonemize", &["60 x 6", "sn"], Some("makumi matan̤atu kuwaⁿzana ne tan̤atu")),
    ("phonemize", &["1,606,000", "sn"], Some("mirijoni ne ɀiuru mazana matan̤atu ne tan̤atu")),
    ("normalizeShonaPre", &["US$7 000"], Some("US$7000")),
    ("normalizeShonaPost", &["3,4,6,7,8,9,10,4,11,2,1,4"], Some("3,4,6,7,8,9,10,4,11,2,1,4")),
    ("normalizeShonaPost", &["273,15K"], Some("273 koma 1 5K")),
    ("phonemize", &["makore 25-30", "sn"], Some("makore makumi maʋiri ne ʃanu kuȿika makumi matatu")),
    ("phonemize", &["0-100 km/hr", "sn"], Some("zero kuȿika makiromita zana pa awa")),
    ("normalizeShonaPre", &["59 - 32 = 27"], Some("59 - 32 = 27")),
    ("normalizeShonaPre", &["Brazilians 3-0 mu Stade"], Some("Brazilians 3-0 mu Stade")),
    ("normalizeShonaPre", &["imbwa 13-16million"], Some("imbwa 13-16million")),
    ("phonemize", &["32 ° C", "sn"], Some("mad̤iɡiriji makumi matatu ne maʋiri kelsius")),
    ("phonemize", &["ne180 °", "sn"], Some("nemad̤iɡiriji zana ne makumi masere")),
    ("phonemize", &["0 o C", "sn"], Some("mad̤iɡiriji zero kelsius")),
    ("normalizeShonaPost", &["masendimita 5.5"], Some("masendimita 5 poyindi 5")),
    ("normalizeShonaPost", &["madhora 25.5"], Some("madhora 25 poyindi 5")),
    ("normalizeShonaPost", &["makiromita 12,5"], Some("makiromita 12 koma 5")),
    ("normalizeShonaPost", &["madhora 25"], Some("madhora makumi maviri ne mashanu")),
    ("phonemize", &["12.9cm", "sn"], Some("maseⁿdimita ɡumi ne piri pojiⁿdi p͡fuᵐbamwe")),
    ("normalizeShonaPost", &["1.25"], Some("1 poyindi 2 5")),
    ("phonemize", &["46–76&nbsp;kg", "sn"], Some("makumi mana ne tan̤atu kuȿika makiroɡiramu makumi manomwe ne matan̤atu")),
    ("normalizeShonaPre", &["muna 3000 B.C. ne kutengeza"], Some("muna 3000 BC ne kutengeza")),
    ("normalizeShonaPre", &["Zimbabwe state (1000 C.E. - 1830)"], Some("Zimbabwe state (1000 CE - 1830)")),
    ("normalizeShonaPre", &["yakabva kuU.S."], Some("yakabva kuU.S.")),
    ("normalizeShonaPre", &["mwaka wechizana 19 - (19th Century)"], Some("mwaka wechizana 19 - (19 Century)")),
    ("phonemize", &["gore ra1923", "sn"], Some("ɡore ra t͡ʃiuru ne mazana map͡fuᵐbamwe ne makumi maʋiri ne tatu")),
    ("phonemize", &["gore ra 1923", "sn"], Some("ɡore ra t͡ʃiuru ne mazana map͡fuᵐbamwe ne makumi maʋiri ne tatu")),
    ("normalizeShonaPre", &[" makore 25-30 "], Some("makore 25 kusvika 30")),
    ("normalizeShonaPost", &[" 12.9 "], Some("12 poyindi 9")),
    ("normalizeShonaPost", &["iri pa 06:00hrs"], Some("iri pa 06:00hrs")),
    ("normalizeShonaPre", &["Genesis 30:13"], Some("Genesis 30:13")),
    ("normalizeShonaPre", &["zvibodzwa 3:2"], Some("zvibodzwa 3:2")),
    ("normalizeShonaPost", &["Basa = Fosi"], Some("Basa = Fosi")),
    ("normalizeShonaPost", &["chikwereti -$100"], Some("chikwereti -$100")),
    ("normalizeShonaPost", &["longitude +30 o E"], Some("longitude +madhigiriyi makumi matatu E")),
    ("normalizeShonaPre", &["Ndabaningi Sithole (31/07/1920"], Some("Ndabaningi Sithole (31/07/1920")),
    ("normalizeShonaPost", &["kuyenzana na (22/7)"], Some("kuyenzana na (22/7)")),
    ("normalizeShonaPre", &["Dzinoreba 2.1-3.4m"], Some("Dzinoreba 2.1-3.4m")),
    ("normalizeShonaPre", &["makore 25-30."], Some("makore 25 kusvika 30.")),
    ("normalizeShonaPre", &["March 20-21, 2019"], Some("March 20 kusvika 21, 2019")),
    ("normalizeShonaPre", &["50-70."], Some("50 kusvika 70.")),
    ("normalizeShonaPre", &["Vhoriyamu 1984-5."], Some("Vhoriyamu 1984-5.")),
    ("phonemize", &["10 mm", "sn"], Some("mamirimita ɡumi")),
    ("phonemize", &["10 ha", "sn"], Some("hekita ɡumi")),
    ("phonemize", &["10 l", "sn"], Some("rita ɡumi")),
    ("phonemize", &["10 L", "sn"], Some("rita ɡumi")),
    ("phonemize", &["2 mm", "sn"], Some("mamirimita maʋiri")),
    ("phonemize", &["10 km/l", "sn"], Some("makiromita ɡumi pa rita")),
    ("phonemize", &["8hr", "sn"], Some("maawa masere")),
    ("phonemize", &["8hrs", "sn"], Some("maawa masere")),
    ("phonemize", &["2 hrs", "sn"], Some("maawa maʋiri")),
    ("phonemize", &["06:00hrs", "sn"], Some("tan̤atu , zero hrs")),
    ];

    #[test]
    fn the_typescript_suite_holds() {
        let e = create_shona().unwrap();
        let mut count = 0;
        for (f, args, want) in TS_SUITE_CALLS {
            let got = match *f {
                "phonemizeWord" => e.phonemize_word(&js(args[0])).to_string_lossy(),
                "withClass6Concord" => e.with_class6_concord(&js(args[0])).to_string_lossy(),
                "numberToWords" => e
                    .number_to_words(
                        crate::core::js_string::js_number(&js(args[0])),
                        args.get(1).map(|r| js(r)).as_ref(),
                    )
                    .to_string_lossy(),
                "normalizeShonaPre" => e.normalize_pre(&js(args[0])).to_string_lossy(),
                "normalizeShonaPost" => e.normalize_post(&js(args[0])).to_string_lossy(),
                "phonemize" => crate::phonemize(args[0], args[1]).unwrap(),
                other => panic!("unpinned fn {other}"),
            };
            assert_eq!(Some(got.as_str()), *want, "{f}({args:?})");
            count += 1;
        }
        assert_eq!(count, 90);
    }
}

/// #1593, as test/sbantu-defects-1593.test.ts: `bn` reads as its word, with or without a currency sign.
/// Relational, so no IPA is typed.
#[cfg(test)]
mod sbantu_defects_1593 {
    use crate::phonemize;

    #[test]
    fn bn_reads_as_its_word() {
        let p = |t: &str| phonemize(t, "sn").unwrap();
        assert_eq!(p("Ne 1.5bn zvakare"), p("Ne 1.5 bhiriyoni zvakare"));
        assert_eq!(p("Ne $1.5bn zvakare"), p("Ne $1.5 bhiriyoni zvakare"));
    }
}
