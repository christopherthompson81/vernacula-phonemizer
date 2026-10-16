//! Irish (ga) phonemizer: the Connacht lexicon, else the broad/slender g2p with nasal assimilation, svarabhakti, the
//! i-offglide, first-syllable stress and unstressed reduction, and text() over words, numbers and punctuation.
//! Ported from src/languages/irish/irish.ts — see that file for the corpus evidence.

use std::collections::HashSet;
use std::sync::{LazyLock, OnceLock};

use indexmap::IndexMap;

use super::g2p::{Seg, to_segments};
use super::manifest::{DIR, MANIFEST, try_manifest};
use super::normalize::{normalize_irish, ordinal_words};
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

/// `lexicon()`: the Connacht pronunciation lexicon (required, no fold).
pub fn try_lexicon() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static L: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&L, || {
        load_tsv_strings(DIR, "lexicon.tsv", TsvOptions::default()).map_err(|e| e.to_string())
    })
}

fn lexicon() -> &'static IndexMap<JsString, JsString> {
    try_lexicon().unwrap_or_else(|e| panic!("{e}"))
}

fn set(xs: &[&str]) -> HashSet<JsString> {
    xs.iter().map(|x| js(x)).collect()
}
static SHORT: LazyLock<HashSet<JsString>> = LazyLock::new(|| set(&["a", "ɛ", "ɪ", "ɔ", "ʊ"]));
static BACK_V: LazyLock<HashSet<JsString>> = LazyLock::new(|| set(&["ɑː", "oː"]));
static LIQUID: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.liquids.iter().map(|x| js(x)).collect());
static SVARABHAKTI_NEXT: LazyLock<HashSet<JsString>> =
    LazyLock::new(|| MANIFEST.svarabhakti_next.iter().map(|x| js(x)).collect());

fn is_slender_c(ph: &JsString) -> bool {
    ph.ends_with(&js("ʲ")) || *ph == "c" || *ph == "ɟ" || *ph == "ʃ" || *ph == "ç"
}

fn plain(ph: &str) -> Seg {
    Seg {
        ph: js(ph),
        nucleus: false,
        no_glide: false,
    }
}

/// `offglide(segs)`: ⁱ between a long back vowel and a following slender consonant.
fn offglide(segs: &mut Vec<Seg>) {
    let mut i = segs.len().saturating_sub(1);
    while i >= 1 {
        let (c, prev) = (&segs[i], &segs[i - 1]);
        if !c.nucleus
            && prev.nucleus
            && is_slender_c(&c.ph)
            && BACK_V.contains(&prev.ph)
            && !prev.no_glide
        {
            segs.insert(i, plain("ⁱ"));
        }
        i -= 1;
    }
}

/// `epenthesis(segs)`: svarabhakti schwa between /r l/ and a following labial/velar/palatal coda.
fn epenthesis(segs: &mut Vec<Seg>) {
    let mut i = segs.len() as isize - 2;
    while i >= 0 {
        let u = i as usize;
        let coda = u + 2 >= segs.len() || !segs[u + 2].nucleus;
        if coda && LIQUID.contains(&segs[u].ph) && SVARABHAKTI_NEXT.contains(&segs[u + 1].ph) {
            segs.insert(u + 1, plain("ə"));
        }
        i -= 1;
    }
}

/// `nasalAssim(segs)`: n̪ˠ/nʲ before ɡ → ŋ, and a word-final ɡ after it absorbed.
fn nasal_assim(segs: &mut Vec<Seg>) {
    for i in 0..segs.len().saturating_sub(1) {
        if (segs[i].ph == "n̪ˠ" || segs[i].ph == "nʲ") && segs[i + 1].ph == "ɡ" {
            segs[i].ph = js("ŋ");
        }
    }
    let l = segs.len();
    if l >= 2 && segs[l - 1].ph == "ɡ" && segs[l - 2].ph == "ŋ" {
        segs.pop();
    }
}

/// `phonemizeWord(word)`: the lexicon (keyed lowercase), else `g2pWord`.
pub fn phonemize_word(word: &JsString) -> JsString {
    match lexicon().get(&word.to_lower_case()) {
        Some(hit) => hit.clone(),
        None => g2p_word(word),
    }
}

/// `g2pWord(word)`: the rule path.
pub fn g2p_word(word: &JsString) -> JsString {
    let mut segs = to_segments(&js_re!(r"['’\-]", "g").replace(word, &JsString::new()));
    if segs.is_empty() {
        return JsString::new();
    }
    nasal_assim(&mut segs);
    epenthesis(&mut segs);
    offglide(&mut segs);
    let nuclei: Vec<usize> = (0..segs.len()).filter(|&i| segs[i].nucleus).collect();
    if nuclei.is_empty() {
        let phs: Vec<JsString> = segs.iter().map(|s| s.ph.clone()).collect();
        return JsString::join(&phs, &JsString::new());
    }
    let stress = nuclei[0];
    for &idx in &nuclei {
        if idx != stress && SHORT.contains(&segs[idx].ph) {
            segs[idx].ph = js("ə");
        }
    }
    let mut out = JsString::new();
    for (i, s) in segs.iter().enumerate() {
        if i == stress {
            out.push_str(&js("ˈ"));
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
/// `nat`: Irish's own inventory; a token outside it is a foreign name and is folded.
static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser("[a-záéíóúA-ZÁÉÍÓÚ]", "u")));

/// `SYMBOLS`'s argument, generated from the object literal in irish.ts (key order preserved) by recording it
/// through the fn-diff symbols hook and printing `JSON.stringify` of it. No `countForm`: the default selector.
const SYMBOL_DATA: &str = r#"{"multiply":{"times":"faoi"},"percent":["faoin gcéad"],"currency":{"€":["euro"],"$":["dollar","dollair"],"£":["punt"],"¥":["yen"]},"units":{"km":["ciliméadar"],"cm":["ceintiméadar"],"mm":["milliméadar"],"kg":["cileagram"],"m":["méadar"]},"exponentWords":{"squared":["cearnach"],"cubed":["ciúbach"],"position":"after"}}"#;

static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let data: SymbolData =
        crate::core::from_json::parse_json(SYMBOL_DATA).map_err(|e| e.to_string())?;
    make_symbol_normalizer(&data)
});

/// The Irish engine (`createIrish`).
pub struct IrishPhonemizer {
    symbols: &'static SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding an `IrishPhonemizer` proves the manifest, the
/// lexicon and the symbol tier loaded. (The per-module differentials call them.)
impl IrishPhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_irish(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    pub fn g2p_word(&self, word: &JsString) -> JsString {
        g2p_word(word)
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

    pub fn ordinal_words(&self, n: f64, noun: &JsString) -> Option<JsString> {
        ordinal_words(n, noun)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let normalized = self.symbols.apply(&normalize_irish(input));
        assemble_clauses(&normalized, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(n) = m.group(2, s) {
                let digits = js_re!(",", "gu").replace(&n, &JsString::new());
                for wd in number_to_words(js_number(&digits), Some(&digits)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = m.group(3, s)
                && let Some(mk) = MANIFEST
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for IrishPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(IrishPhonemizer::text(self, input))
    }
}

/// `createIrish()`: loads the manifest, the lexicon and the symbol tier, or says which failed.
pub fn create_irish() -> Result<IrishPhonemizer, String> {
    try_manifest()?;
    try_lexicon()?;
    let symbols = SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(IrishPhonemizer { symbols })
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/irish.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["mór"], Some("mˠˈoːɾˠ")),
        ("phonemizeWord", &["cat"], Some("kˈat̪ˠ")),
        ("phonemizeWord", &["madra"], Some("mˠˈad̪ˠɾˠə")),
        ("phonemizeWord", &["lá"], Some("l̪ˠˈɑː")),
        ("phonemizeWord", &["carr"], Some("kˈaɾˠ")),
        ("phonemizeWord", &["focal"], Some("fˠˈɔkəl̪ˠ")),
        ("phonemizeWord", &["bí"], Some("bʲˈiː")),
        ("phonemizeWord", &["fir"], Some("fʲˈɪɾʲ")),
        ("phonemizeWord", &["tír"], Some("tʲˈiːɾʲ")),
        ("phonemizeWord", &["teach"], Some("tʲˈax")),
        ("phonemizeWord", &["súil"], Some("sˠˈuːlʲ")),
        ("phonemizeWord", &["duine"], Some("d̪ˠˈɪnʲə")),
        ("phonemizeWord", &["fear"], Some("fʲˈaɾˠ")),
        ("phonemizeWord", &["bean"], Some("bʲˈan̪ˠ")),
        ("phonemizeWord", &["rí"], Some("ɾˠˈiː")),
        ("phonemizeWord", &["baile"], Some("bˠˈalʲə")),
        ("phonemizeWord", &["bhí"], Some("vʲˈiː")),
        ("phonemizeWord", &["oíche"], Some("ˈiːçə")),
        ("phonemizeWord", &["deoch"], Some("dʲˈɔx")),
        ("phonemizeWord", &["chéadaigh"], Some("çˈeːd̪ˠə")),
        ("phonemizeWord", &["airigh"], Some("ˈaɾʲə")),
        ("phonemizeWord", &["gcat"], Some("ɡˈat̪ˠ")),
        ("phonemizeWord", &["mbád"], Some("mˠˈɑːd̪ˠ")),
        ("phonemizeWord", &["ngaeilge"], Some("ŋˈeːəlʲɟə")),
        ("phonemizeWord", &["bhfuil"], Some("wˈɪlʲ")),
        ("phonemizeWord", &["spéir"], Some("sˠpʲˈeːɾʲ")),
        ("phonemizeWord", &["ainm"], Some("ˈanʲmˠ")),
        ("phonemizeWord", &["long"], Some("l̪ˠˈɔŋ")),
        ("phonemizeWord", &["scoil"], Some("sˠkˈɔlʲ")),
        ("phonemizeWord", &["áit"], Some("ˈɑːⁱtʲ")),
        ("phonemizeWord", &["cóir"], Some("kˈoːⁱɾʲ")),
        ("phonemizeWord", &["gorm"], Some("ɡˈɔɾˠəmˠ")),
        ("phonemizeWord", &["bolg"], Some("bˠˈɔl̪ˠəɡ")),
        ("phonemizeWord", &["gairm"], Some("ɡˈaɾʲəmˠ")),
        ("phonemizeWord", &["iad"], Some("ˈiəd̪ˠ")),
        ("phonemizeWord", &["ciall"], Some("cˈiəl̪ˠ")),
        ("phonemizeWord", &["nuair"], Some("n̪ˠˈuəɾʲ")),
        ("phonemizeWord", &["áirithe"], Some("ˈɑːⁱɾʲəhə")),
        ("phonemizeWord", &["ceoil"], Some("cˈoːlʲ")),
        ("phonemizeWord", &["féidir"], Some("fʲˈeːdʲəɾʲ")),
        ("phonemizeWord", &["bó"], Some("bˠˈoː")),
        ("phonemizeWord", &["fada"], Some("fˠˈad̪ˠə")),
        ("phonemizeWord", &["cara"], Some("kˈaɾˠə")),
        ("phonemizeWord", &["obair"], Some("ˈɔbˠəɾʲ")),
        ("numberToWords", &["0"], Some("náid")),
        ("numberToWords", &["1"], Some("a haon")),
        ("numberToWords", &["4"], Some("a ceathair")),
        ("numberToWords", &["8"], Some("a hocht")),
        ("numberToWords", &["11"], Some("a haon déag")),
        ("numberToWords", &["12"], Some("a dó dhéag")),
        ("numberToWords", &["13"], Some("a trí déag")),
        ("numberToWords", &["20"], Some("fiche")),
        ("numberToWords", &["25"], Some("fiche a cúig")),
        ("numberToWords", &["40"], Some("daichead")),
        ("numberToWords", &["98"], Some("nócha a hocht")),
        ("numberToWords", &["100"], Some("céad")),
        ("numberToWords", &["101"], Some("céad a haon")),
        ("numberToWords", &["200"], Some("dhá chéad")),
        ("numberToWords", &["400"], Some("ceithre chéad")),
        ("numberToWords", &["700"], Some("seacht gcéad")),
        ("numberToWords", &["1000"], Some("míle")),
        ("numberToWords", &["2000"], Some("dhá mhíle")),
        ("numberToWords", &["7000"], Some("seacht míle")),
        (
            "numberToWords",
            &["1998"],
            Some("míle naoi gcéad nócha a hocht"),
        ),
        (
            "numberToWords",
            &["999999"],
            Some("naoi gcéad nócha a naoi míle naoi gcéad nócha a naoi"),
        ),
        ("phonemize", &["25", "ga"], Some("fʲˈɪçə ˈa kˈuːɟ")),
        (
            "phonemize",
            &["1998", "ga"],
            Some("mʲˈiːlʲə n̪ˠˈiː ɟˈeːd̪ˠ n̪ˠˈoːxə ˈa hˈɔxt̪ˠ"),
        ),
        ("normalizeIrish", &["15ú"], Some("cúigiú déag")),
        (
            "normalizeIrish",
            &["an 15ú haois"],
            Some("an cúigiú haois déag"),
        ),
        (
            "normalizeIrish",
            &["sa 10ú haois"],
            Some("sa deichiú haois"),
        ),
        (
            "normalizeIrish",
            &["an 37ú tír"],
            Some("an seachtú tír is tríocha"),
        ),
        (
            "normalizeIrish",
            &["an 190ú áit"],
            Some("an céad nóchadú áit"),
        ),
        ("normalizeIrish", &["an 8ú lá"], Some("an t-ochtú lá")),
        ("ordinalWords", &["11"], Some("aonú déag")),
        ("normalizeIrish", &["18ú"], Some("ochtú déag")),
        ("normalizeIrish", &["20ú"], Some("fichiú")),
        ("phonemize", &["7ú", "ga"], Some("ʃˈaxt̪ˠuː")),
        ("phonemize", &["190ú", "ga"], Some("cˈeːd̪ˠ n̪ˠˈoːxəd̪ˠuː")),
        (
            "phonemize",
            &["1,400", "ga"],
            Some("mʲˈiːlʲə cˈɛhɾʲə çˈeːd̪ˠ"),
        ),
        (
            "phonemize",
            &["400,000", "ga"],
            Some("cˈɛhɾʲə çˈeːd̪ˠ mʲˈiːlʲə"),
        ),
        (
            "phonemize",
            &["1.5 million", "ga"],
            Some("ˈa hˈeːn̪ˠ pˠˈɔnʲtʲə ˈa kˈuːɟ mʲˈɪlʲən̪ˠ"),
        ),
        (
            "phonemize",
            &["12.8 km", "ga"],
            Some("ˈa d̪ˠˈoː jˈeːɡ pˠˈɔnʲtʲə ˈa hˈɔxt̪ˠ cˈɪlʲəmʲeːd̪ˠəɾˠ"),
        ),
        ("phonemize", &["21ú", "ga"], Some("ˈeːn̪ˠuː ˈɪʃ fʲˈɪçə")),
        (
            "phonemize",
            &["3.5%", "ga"],
            Some("ˈa tʲɾʲˈiː pˠˈɔnʲtʲə ˈa kˈuːɟ fˠˈiːnʲ ɟˈeːd̪ˠ"),
        ),
        (
            "phonemize",
            &["11:35 i.n.", "ga"],
            Some("ˈa hˈeːn̪ˠ dʲˈeːɡ tʲɾʲˈiːxə ˈa kˈuːɟ ˈiəɾˠn̪ˠoːⁱnʲ"),
        ),
        (
            "phonemize",
            &["8:30 p.m.", "ga"],
            Some("ˈa hˈɔxt̪ˠ tʲɾʲˈiːxə ˈiəɾˠn̪ˠoːⁱnʲ"),
        ),
        (
            "phonemize",
            &["1:15 r.n.", "ga"],
            Some("ˈa hˈeːn̪ˠ ˈa kˈuːɟ dʲˈeːɡ ɾˠˈeːwn̪ˠoːⁱnʲ"),
        ),
        (
            "phonemize",
            &["400 A.D.", "ga"],
            Some("cˈɛhɾʲə çˈeːd̪ˠ t̪ˠˈaɾˠ ˈeːʃ çɾʲˈiːsˠt̪ˠ"),
        ),
        (
            "phonemize",
            &["1000 R.C.", "ga"],
            Some("mʲˈiːlʲə ɾˠˈɪvʲ çɾʲˈiːsˠt̪ˠ"),
        ),
        (
            "phonemize",
            &["35-40 msu", "ga"],
            Some("tʲɾʲˈiːxə ˈa kˈuːɟ ɡˈɔ dʲˈiː d̪ˠˈaçəd̪ˠ mʲˈiːlʲə sˠˈan̪ˠ ˈuəɾʲ"),
        ),
        (
            "phonemize",
            &["160km/h", "ga"],
            Some("cˈeːd̪ˠ ʃˈasˠkə cˈɪlʲəmʲeːd̪ˠəɾˠ sˠˈan̪ˠ ˈuəɾʲ"),
        ),
        (
            "phonemize",
            &["30°C", "ga"],
            Some("tʲɾʲˈiːxə cˈeːmʲ cˈɛlʲʃʊsˠ"),
        ),
        (
            "phonemize",
            &["35°W", "ga"],
            Some("tʲɾʲˈiːxə ˈa kˈuːɟ cˈeːmʲ ʃˈiəɾˠ"),
        ),
        (
            "phonemize",
            &["1/5 orlach", "ga"],
            Some("ˈan̪ˠ kˈuːɟuː ˈɔɾˠl̪ˠəx"),
        ),
        (
            "phonemize",
            &["B&Banna", "ga"],
            Some("bʲˈeː ˈaɡəsˠ bʲˈeːn̪ˠə"),
        ),
        (
            "phonemize",
            &["US$14.7", "ga"],
            Some("d̪ˠˈɔl̪ˠəɾˠ n̪ˠˈə sˠt̪ˠˈɑːt̪ˠ ˈeːn̪ˠt̪ˠəhə ˈa cˈahəɾʲ dʲˈeːɡ pˠˈɔnʲtʲə ˈa ʃˈaxt̪ˠ"),
        ),
        ("phonemize", &["S.A.", "ga"], Some("sˠt̪ˠˈɑːⁱtʲ ˈeːn̪ˠt̪ˠəhə")),
        (
            "phonemize",
            &["N.A.", "ga"],
            Some("n̪ˠˈɑːⁱʃuːənʲ ˈeːn̪ˠt̪ˠəhə"),
        ),
        (
            "phonemize",
            &["H5N1", "ga"],
            Some("hˈeːʃ ˈa kˈuːɟ ˈɛnʲ ˈa hˈeːn̪ˠ"),
        ),
        (
            "phonemize",
            &["120 m³", "ga"],
            Some("cˈeːd̪ˠ fʲˈɪçə mʲˈeːd̪ˠəɾˠ cˈuːbˠəx"),
        ),
        (
            "phonemize",
            &["100m agus 200m", "ga"],
            Some("cˈeːd̪ˠ mʲˈeːd̪ˠəɾˠ ˈaɡəsˠ ɣˈɑː çˈeːd̪ˠ mʲˈeːd̪ˠəɾˠ"),
        ),
        (
            "phonemize",
            &["iompar ar thalamh srl", "ga"],
            Some("ˈɪmˠpˠəɾˠ ˈaɾˠ hˈal̪ˠəw ˈaɡəsˠ əɾˠˈalʲə"),
        ),
        (
            "phonemize",
            &["iompar ar thalamh, srl.", "ga"],
            Some("ˈɪmˠpˠəɾˠ ˈaɾˠ hˈal̪ˠəw , ˈaɡəsˠ əɾˠˈalʲə"),
        ),
        (
            "normalizeIrish",
            &["1.5 msu"],
            Some("1 pointe a cúig míle san uair"),
        ),
        ("normalizeIrish", &["1.5 mſu"], Some("1 pointe a cúig mſu")),
        (
            "normalizeIrish",
            &["12.8 km/u"],
            Some("12 pointe a hocht km/u"),
        ),
        (
            "normalizeIrish",
            &["1.5 km/h"],
            Some("1 pointe a cúig km/h"),
        ),
        ("normalizeIrish", &["1.5 m/s"], Some("1 pointe a cúig m/s")),
        (
            "normalizeIrish",
            &["12.8km/u"],
            Some("12 pointe a hocht km/u"),
        ),
        (
            "normalizeIrish",
            &["12.8 km"],
            Some("12 pointe a hocht ciliméadar"),
        ),
        (
            "normalizeIrish",
            &["12.8 msu"],
            Some("12 pointe a hocht míle san uair"),
        ),
        (
            "normalizeIrish",
            &["160km/u"],
            Some("céad seasca ciliméadar san uair"),
        ),
        (
            "normalizeIrish",
            &["70km/h"],
            Some("seachtó ciliméadar san uair"),
        ),
        (
            "phonemize",
            &["1, -2", "ga"],
            Some("ˈa hˈeːn̪ˠ , l̪ˠˈuːdʲə ˈa d̪ˠˈoː"),
        ),
        (
            "phonemize",
            &["1-2", "ga"],
            Some("ˈa hˈeːn̪ˠ ɡˈɔ dʲˈiː ˈa d̪ˠˈoː"),
        ),
        (
            "phonemize",
            &["1,234-5,678", "ga"],
            Some(
                "mʲˈiːlʲə ɣˈɑː çˈeːd̪ˠ tʲɾʲˈiːxə ˈa cˈahəɾʲ ɡˈɔ dʲˈiː kˈuːɟ vʲˈiːlʲə ʃˈeː çˈeːd̪ˠ ʃaxt̪ˠˈoː ˈa hˈɔxt̪ˠ",
            ),
        ),
        (
            "phonemize",
            &["mae'r amser yn GMT-00:43 heddiw", "ga"],
            Some("mˠˈeːɾʲ ˈamˠʃəɾʲ jn̪ˠ ɟˈeː ˈɛmʲ tʲˈeː n̪ˠˈɑːⁱdʲ d̪ˠˈaçəd̪ˠ ˈa tʲɾʲˈiː hˈɛdʲəw"),
        ),
        (
            "phonemize",
            &["mae'r amser yn GMT -00:43 heddiw", "ga"],
            Some("mˠˈeːɾʲ ˈamˠʃəɾʲ jn̪ˠ ɟˈeː ˈɛmʲ tʲˈeː n̪ˠˈɑːⁱdʲ d̪ˠˈaçəd̪ˠ ˈa tʲɾʲˈiː hˈɛdʲəw"),
        ),
        (
            "phonemize",
            &["mae'r amser yn UTC-08:00 heddiw", "ga"],
            Some("mˠˈeːɾʲ ˈamˠʃəɾʲ jn̪ˠ ˈuː tʲˈeː cˈeː ˈa hˈɔxt̪ˠ hˈɛdʲəw"),
        ),
        (
            "phonemize",
            &["mae'r amser yn GMT-5 heddiw", "ga"],
            Some("mˠˈeːɾʲ ˈamˠʃəɾʲ jn̪ˠ ɟˈeː ˈɛmʲ tʲˈeː ˈa kˈuːɟ hˈɛdʲəw"),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let e = create_irish().unwrap();
        let call = |f: &str, a: &dyn Fn(usize) -> JsString, n: usize| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(e.phonemize_word(&a(0))),
                "normalizeIrish" => Some(e.normalize(&a(0))),
                "ordinalWords" => e.ordinal_words(
                    js_number(&a(0)),
                    &(if n > 1 { a(1) } else { JsString::new() }),
                ),
                "numberToWords" => Some(e.number_to_words(js_number(&a(0)), None)),
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
            let got: Option<String> = call(f, &a, args.len()).map(|s| s.to_string_lossy());
            assert_eq!(got.as_deref(), *want, "{f}{args:?}");
        }
    }
}
