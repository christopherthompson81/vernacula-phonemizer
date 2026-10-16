//! Welsh (cy) phonemizer: the kaikki lexicon, else the g2p scan with penultimate stress and the vowel-length rule,
//! and text() over words, comma-grouped numbers and clause punctuation.
//! Ported from src/languages/welsh/welsh.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::g2p::{Seg, to_segments};
use super::manifest::{DIR, MANIFEST, try_manifest};
use super::normalize::{normalize_welsh, ordinal_words, soften};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

/// `lexicon()`: the kaikki NW lexicon (optional, no fold).
pub fn try_lexicon() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static L: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&L, || {
        load_tsv_strings(
            DIR,
            "lexicon.tsv",
            TsvOptions {
                optional: true,
                fold: None,
            },
        )
        .map_err(|e| e.to_string())
    })
}

fn lexicon() -> &'static IndexMap<JsString, JsString> {
    try_lexicon().unwrap_or_else(|e| panic!("{e}"))
}

/// `LENGTHENS`: the code points of `lengthenBefore`.
static LENGTHENS: LazyLock<HashSet<JsString>> = LazyLock::new(|| {
    js(&MANIFEST.lengthen_before)
        .code_point_strings()
        .into_iter()
        .collect()
});

/// A truthy manifest lookup.
fn look<'a>(t: &'a IndexMap<String, String>, k: &JsString) -> Option<&'a String> {
    t.get(&k.to_string_lossy()).filter(|v| !v.is_empty())
}

/// `applyLength(segs, stress, isFinal)`: full length only in a final syllable, in a long context.
fn apply_length(segs: &mut [Seg], stress: usize, is_final: bool) {
    if segs[stress].long || segs[stress].ph == "ə" {
        return;
    }
    let (mut coda, mut single) = (0, JsString::new());
    let mut j = stress + 1;
    while j < segs.len() && !segs[j].nucleus {
        coda += 1;
        single = segs[j].ph.clone();
        j += 1;
    }
    let long_context = coda == 0 || (coda == 1 && LENGTHENS.contains(&single));
    if !long_context {
        return;
    }
    if is_final {
        let v = &mut segs[stress];
        if let Some(l) = MANIFEST.long_vowel.get(&v.ph.to_string_lossy()) {
            v.ph = js(l);
        }
    }
}

fn strip_apostrophes(w: &JsString) -> JsString {
    js_re!(r"['’]", "g").replace(w, &JsString::new())
}

/// `phonemizeWord(word)`: one Welsh word to canonical IPA.
pub fn phonemize_word(word: &JsString) -> JsString {
    let lw = word.to_lower_case();
    if let Some(exc) = MANIFEST
        .exceptions
        .get(&strip_apostrophes(&lw).to_string_lossy())
    {
        return js(exc);
    }
    if let Some(lex) = lexicon().get(word).or_else(|| lexicon().get(&lw)) {
        return lex.clone();
    }
    if let Some(m) = js_re!(r"^(.+)['’]([a-z]+)$").exec(&lw)
        && let Some(enc) = look(&MANIFEST.enclitics, &m.group(2, &lw).unwrap())
    {
        return phonemize_word(&m.group(1, &lw).unwrap()).concat(&js(enc));
    }
    let mut segs = to_segments(&strip_apostrophes(word));
    if segs.is_empty() {
        return JsString::new();
    }
    let nuclei: Vec<usize> = (0..segs.len()).filter(|&i| segs[i].nucleus).collect();
    if nuclei.is_empty() {
        let phs: Vec<JsString> = segs.iter().map(|s| s.ph.clone()).collect();
        return JsString::join(&phs, &JsString::new());
    }
    let stress_n = if nuclei.len() >= 2 {
        nuclei.len() - 2
    } else {
        0
    };
    let stress = nuclei[stress_n];
    apply_length(&mut segs, stress, stress_n == nuclei.len() - 1);
    let secondary = if stress_n >= 2 { Some(nuclei[0]) } else { None };
    let mut out = JsString::new();
    for i in 0..segs.len() {
        if i == stress {
            out.push_str(&js("ˈ"));
        } else if Some(i) == secondary {
            out.push_str(&js("ˌ"));
        }
        let s = &segs[i];
        if i > 0 && !s.nucleus && !segs[i - 1].nucleus && s.ph == segs[i - 1].ph {
            continue;
        }
        out.push_str(&s.ph);
    }
    out
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    let run = host_word_run(&["Latin"], "", "'’-").unwrap();
    JsRegex::new(
        &format!(r"({run})|([1-9]\d{{0,2}}(?:,\d{{3}})+(?:\.\d+)?|\d+\.\d+|\d+)|([.!?…,;:])"),
        "gu",
    )
    .unwrap()
});

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: Welsh's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> = LazyLock::new(|| {
    Box::new(make_nativiser(
        "[a-zâêîôûŵŷàèìòùïëöäüA-ZÂÊÎÔÛŴŶÀÈÌÒÙÏËÖÄÜ]",
        "u",
    ))
});

/// `SYMBOLS`'s argument, generated from the object literal in welsh.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it. No `countForm`: the default selector.
const SYMBOL_DATA: &str = r#"{"multiply":{"times":"gwaith"},"percent":["y cant"],"currency":{"$":["doler"],"£":["punt"],"¥":["yen"]},"units":{"km":["cilomedr"],"kg":["cilogram"],"mm":["milimetr"],"cm":["centimetr"],"m":["metr"]},"exponentWords":{"squared":["sgwâr"],"cubed":["ciwbig"],"position":"after"}}"#;

static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let data: SymbolData =
        crate::core::from_json::parse_json(SYMBOL_DATA).map_err(|e| e.to_string())?;
    make_symbol_normalizer(&data)
});

/// The Welsh engine (`createWelsh`).
pub struct WelshPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `WelshPhonemizer` proves the manifest, the lexicon
/// and the symbol tier loaded. (The per-module differentials call them.)
impl WelshPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_welsh(text)
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
        to_segments(word)
    }

    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    pub fn ordinal_words(&self, n: f64) -> Option<JsString> {
        ordinal_words(n)
    }

    pub fn soften(&self, text: &JsString) -> JsString {
        soften(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self.symbols.apply(&normalize_welsh(input));
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(n) = m.group(2, s) {
                let digits = js_re!(",", "gu").replace(&n, &JsString::new());
                for wd in number_to_words(js_number(&digits), Some(&digits)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = m.group(3, s)
                && let Some(mk) = look(&MANIFEST.clause_punctuation, &p)
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for WelshPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(WelshPhonemizer::text(self, input))
    }
}

/// `createWelsh()`: loads the manifest, the lexicon and the symbol tier, or says which failed.
pub fn create_welsh() -> Result<WelshPhonemizer, String> {
    try_manifest()?;
    try_lexicon()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(WelshPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/welsh.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["chwech"], Some("χwˈeːχ")),
        ("phonemizeWord", &["oedd"], Some("ˈoːᶤð")),
        ("phonemizeWord", &["llaw"], Some("ɬˈaːᶷ")),
        ("phonemizeWord", &["rhaid"], Some("r̥ˈaᶦd")),
        ("phonemizeWord", &["traeth"], Some("trˈaːᶤθ")),
        ("phonemizeWord", &["gwlad"], Some("ɡwlˈaːd")),
        ("phonemizeWord", &["gwaith"], Some("ɡwˈaᶦθ")),
        ("phonemizeWord", &["mewn"], Some("mˈɛᶷn")),
        ("phonemizeWord", &["eglwys"], Some("ˈɛɡlʊᶤs")),
        ("phonemizeWord", &["cymdeithas"], Some("kəmdˈeᶦθas")),
        ("phonemizeWord", &["cymru"], Some("kˈəmrɨ")),
        ("phonemizeWord", &["ysgol"], Some("ˈəsɡɔl")),
        ("phonemizeWord", &["blwyddyn"], Some("blˈʊᶤðɨn")),
        ("phonemizeWord", &["lladin"], Some("ɬˈadin")),
        ("phonemizeWord", &["dim"], Some("dˈɪm")),
        ("phonemizeWord", &["dinas"], Some("dˈɪnas")),
        ("phonemizeWord", &["prifysgol"], Some("privˈəsɡɔl")),
        ("phonemizeWord", &["gorffennaf"], Some("ɡɔrfˈɛnav")),
        ("phonemizeWord", &["llywodraeth"], Some("ɬəwˈɔdraᶤθ")),
        ("phonemizeWord", &["mis"], Some("mˈiːs")),
        ("phonemizeWord", &["tad"], Some("tˈaːd")),
        ("phonemizeWord", &["nos"], Some("nˈoːs")),
        ("phonemizeWord", &["braf"], Some("brˈaːv")),
        ("phonemizeWord", &["nesaf"], Some("nˈɛsav")),
        ("phonemizeWord", &["pobol"], Some("pˈɔbɔl")),
        ("phonemizeWord", &["bore"], Some("bˈɔrɛ")),
        ("phonemizeWord", &["papur"], Some("pˈapɨr")),
        ("phonemizeWord", &["nhw"], Some("n̥ˈuː")),
        ("phonemizeWord", &["nghymru"], Some("ŋ̥ˈəmrɨ")),
        ("phonemizeWord", &["enghraifft"], Some("ˈɛŋ̊raᶦfd")),
        ("phonemizeWord", &["dechrau"], Some("dˈɛχra")),
        ("phonemizeWord", &["i"], Some("ˈiː")),
        ("phonemizeWord", &["bod"], Some("bˈɔd")),
        ("phonemizeWord", &["heb"], Some("hˈɛb")),
        ("phonemizeWord", &["un"], Some("ˈɨːn")),
        ("phonemizeWord", &["o'r"], Some("ˈoːr")),
        ("phonemizeWord", &["hi'n"], Some("hˈiːn")),
        ("phonemizeWord", &["wal"], Some("wˈal")),
        ("phonemizeWord", &["teithio"], Some("tˈeᶦθjɔ")),
        ("phonemizeWord", &["bara"], Some("bˈara")),
        ("normalizeWelsh", &["7fed"], Some("seithfed")),
        ("normalizeWelsh", &["6ed"], Some("chweched")),
        ("normalizeWelsh", &["1af"], Some("cyntaf")),
        (
            "normalizeWelsh",
            &["37fed"],
            Some("ail ar bymtheg ar hugain"),
        ),
        (
            "phonemize",
            &["37fed", "cy"],
            Some("ˈaᶦl ˈar bˈəmθɛɡ ˈar hˈɪɡaᶦn"),
        ),
        ("normalizeWelsh", &["60fed"], Some("trigainfed")),
        ("normalizeWelsh", &["190fed"], Some("degfed a naw ugain")),
        ("normalizeWelsh", &["1,000fed"], Some("milfed")),
        (
            "phonemize",
            &["1,400 o bobl", "cy"],
            Some("mˈiːl pˈɛdwar kˈant ˈoː bˈɔbl"),
        ),
        ("phonemize", &["400,000", "cy"], Some("pˈɛdwar kˈant mˈiːl")),
        (
            "phonemize",
            &["2.4Ghz", "cy"],
            Some("dˈaᶤ pˈuːᶤnt pˈɛdwar ɡiɡˈahɛrtz"),
        ),
        (
            "phonemize",
            &["1.5 miliwn", "cy"],
            Some("ˈɨːn pˈuːᶤnt pˈɨmp mˈɪljʊn"),
        ),
        (
            "phonemize",
            &["802.11n", "cy"],
            Some("ˈuːᶤθ kˈant dˈaᶤ pˈuːᶤnt ˈɨːn ˈɨːn n"),
        ),
        (
            "phonemize",
            &["1.234", "cy"],
            Some("ˈɨːn pˈuːᶤnt dˈaᶤ trˈiː pˈɛdwar"),
        ),
        (
            "phonemize",
            &["12,5", "cy"],
            Some("ˈɨːn dˈeːɡ dˈaᶤ pˈuːᶤnt pˈɨmp"),
        ),
        ("phonemize", &["1,400", "cy"], Some("mˈiːl pˈɛdwar kˈant")),
        ("normalizeWelsh", &["11:00 amser"], Some("un deg un amser")),
        ("normalizeWelsh", &["10:00am"], Some("deg y bore")),
        (
            "normalizeWelsh",
            &["07:19 a.m."],
            Some("saith un deg naw y bore"),
        ),
        ("ordinalWords", &["20"], Some("ugeinfed")),
        ("phonemize", &["6-6", "cy"], Some("χwˈeːχ ˈiː χwˈeːχ")),
        (
            "phonemize",
            &["1894-1895", "cy"],
            Some("mˈiːl ˈuːᶤθ kˈant nˈaːᶷ dˈeːɡ pˈɛdwar ˈiː vˈiːl ˈuːᶤθ kˈant nˈaːᶷ dˈeːɡ pˈɨmp"),
        ),
        (
            "phonemize",
            &["5-3 Washington", "cy"],
            Some("pˈɨmp ˈiː drˈiː washˈiŋtɔn"),
        ),
        (
            "phonemize",
            &["100-200 milltir", "cy"],
            Some("kˈant ˈiː ðˈaᶤ ɡˈant mˈiɬtir"),
        ),
        (
            "phonemize",
            &["2-3 km o iâ", "cy"],
            Some("dˈaᶤ ˈiː drˈiː kilˈɔmɛdr ˈoː jˈaː"),
        ),
        ("soften", &["chwech"], Some("chwech")),
        ("soften", &["llath"], Some("lath")),
        (
            "normalizeWelsh",
            &["ers 1995-96, pan gyrhaeddodd"],
            Some("ers 1995 i naw deg chwech, pan gyrhaeddodd"),
        ),
        (
            "normalizeWelsh",
            &["1,400-1,500 o bobl"],
            Some("1,400 i fil pum cant o bobl"),
        ),
        (
            "phonemize",
            &["10:00-11:00 yr hwyr", "cy"],
            Some("dˈeːɡ ˈiː ˈɨːn dˈeːɡ ˈɨːn ˈər hˈuːᶤr"),
        ),
        (
            "phonemize",
            &["-5 gradd", "cy"],
            Some("mˈinʊs pˈɨmp ɡrˈaːð"),
        ),
        (
            "phonemize",
            &["11:35 p.m.", "cy"],
            Some("ˈɨːn dˈeːɡ ˈɨːn trˈiː dˈeːɡ pˈɨmp ˈə prˈənhaᶷn"),
        ),
        (
            "phonemize",
            &["07:19 a.m.", "cy"],
            Some("sˈaᶦθ ˈɨːn dˈeːɡ nˈaːᶷ ˈə bˈɔrɛ"),
        ),
        (
            "phonemize",
            &["15.00 UTC", "cy"],
            Some("ˈɨːn dˈeːɡ pˈɨmp ˈɨː tˈiː ˈɛk"),
        ),
        (
            "phonemize",
            &["400 O.C.", "cy"],
            Some("pˈɛdwar kˈant ˈoːᶤd krˈist"),
        ),
        ("phonemize", &["1000 C.C.", "cy"], Some("mˈiːl kˈɨn krˈist")),
        (
            "phonemize",
            &["1970au", "cy"],
            Some("mˈiːl nˈaːᶷ kˈant sˈaᶦθ dˈeːɡ"),
        ),
        (
            "phonemize",
            &["1/5 modfedd", "cy"],
            Some("ˈɨːn pˈɨmɛd mˈɔdvɛð"),
        ),
        ("phonemize", &["2/3", "cy"], Some("dˈaᶤ trˈeᶤan")),
        ("phonemize", &["3/4", "cy"], Some("trˈiː χwˈartar")),
        (
            "phonemize",
            &["8:30 p.m. amser", "cy"],
            Some("ˈuːᶤθ trˈiː dˈeːɡ ˈə prˈənhaᶷn ˈamsar"),
        ),
        (
            "phonemize",
            &["480 cilomedr/awr", "cy"],
            Some("pˈɛdwar kˈant ˈuːᶤθ dˈeːɡ kilˈɔmɛdr ˈər ˈaᶷr"),
        ),
        (
            "phonemize",
            &["100 llath/metr", "cy"],
            Some("kˈant ɬˈaːθ nˈeᶤ vˈɛtr"),
        ),
        (
            "phonemize",
            &["4892 m", "cy"],
            Some("pˈɛdaᶦr mˈiːl ˈuːᶤθ kˈant nˈaːᶷ dˈeːɡ dˈaᶤ mˈɛtr"),
        ),
        (
            "phonemize",
            &["+30°C", "cy"],
            Some("plˈuːs trˈiː dˈeːɡ ɡrˈaːð kˈɛlʃɨs"),
        ),
        (
            "phonemize",
            &["AUD$45 miliwn", "cy"],
            Some("dˈɔlɛr aᶷstrˈalja pˈɛdwar dˈeːɡ pˈɨmp mˈɪljʊn"),
        ),
        (
            "phonemize",
            &["US$11,000", "cy"],
            Some("dˈɔlɛr ˈər ˈɨnɔl dalˈeᶦθja ˈɨːn dˈeːɡ ˈɨːn mˈiːl"),
        ),
        ("phonemize", &["y DU", "cy"], Some("ˈə dˈeᶤrnas ɨnˈɛdɪɡ")),
        ("phonemize", &["y Môr Du", "cy"], Some("ˈə mˈoːr dˈɨː")),
        ("phonemize", &["ayb.", "cy"], Some("ˈak ˈən ˈə blˈaːᶤn .")),
        (
            "phonemize",
            &["George W. Bush", "cy"],
            Some("ɡɛˈɔrɡɛ ˈuː bˈɨsh"),
        ),
        ("phonemize", &["NHK", "cy"], Some("ˈɛn ˈaᶦtsh ˈɛk")),
        ("phonemize", &["UCLA", "cy"], Some("ˈɨː ˈɛk ˈɛl ˈa")),
        ("phonemize", &["5 km", "cy"], Some("pˈɨmp kilˈɔmɛdr")),
        (
            "phonemize",
            &["5 km²", "cy"],
            Some("pˈɨmp kilˈɔmɛdr sɡwˈaːr"),
        ),
        ("phonemize", &["5 m", "cy"], Some("pˈɨmp mˈɛtr")),
        ("phonemize", &["6-6.", "cy"], Some("χwˈeːχ ˈiː χwˈeːχ .")),
        ("phonemize", &["7-2.", "cy"], Some("sˈaᶦθ ˈiː ðˈaᶤ .")),
        ("phonemize", &["5-3", "cy"], Some("pˈɨmp ˈiː drˈiː")),
        (
            "phonemize",
            &["5-3.5", "cy"],
            Some("pˈɨmp trˈiː pˈuːᶤnt pˈɨmp"),
        ),
        (
            "phonemize",
            &["mae'r amser yn GMT-00:43 heddiw", "cy"],
            Some("mˈaᶤr ˈamsar ˈən ˈeːɡ ˈɛm tˈiː dˈɪm pˈɛdwar dˈeːɡ trˈiː hˈɛðɪᶷ"),
        ),
        (
            "phonemize",
            &["mae'r amser yn GMT -00:43 heddiw", "cy"],
            Some("mˈaᶤr ˈamsar ˈən ˈeːɡ ˈɛm tˈiː dˈɪm pˈɛdwar dˈeːɡ trˈiː hˈɛðɪᶷ"),
        ),
        (
            "phonemize",
            &["mae'r amser yn UTC-08:00 heddiw", "cy"],
            Some("mˈaᶤr ˈamsar ˈən ˈɨː tˈiː ˈɛk ˈuːᶤθ hˈɛðɪᶷ"),
        ),
        (
            "phonemize",
            &["mae'r amser yn GMT-5 heddiw", "cy"],
            Some("mˈaᶤr ˈamsar ˈən ˈeːɡ ˈɛm tˈiː pˈɨmp hˈɛðɪᶷ"),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_welsh().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeWelsh" => Some(e.normalize(&a(0))),
                "ordinalWords" => e.ordinal_words(js_number(&a(0))),
                "soften" => Some(e.soften(&a(0))),
                "phonemize" => Some(js(&crate::phonemize(
                    &a(0).to_string_lossy(),
                    &a(1).to_string_lossy(),
                )
                .unwrap())),
                _ => panic!("no replay for {f}"),
            }
        };
        for (f, args, want) in TS_SUITE_CALLS {
            let a = |i: usize| js(args[i]);
            let got: Option<String> = call(f, &a).map(|s| s.to_string_lossy());
            assert_eq!(got.as_deref(), *want, "{f}{args:?}");
        }
    }
}
