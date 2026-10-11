//! Czech (cs) phonemizer: the loanword lexicon or the rule g2p with fixed FIRST-syllable stress (secondary on
//! even non-final nuclei), and text() over Latin words (a foreign name nativised), numbers with their decimal
//! comma or 3-digit grouping comma, and clause punctuation.
//! Ported from src/languages/czech/czech.ts — see that file for the corpus evidence.

use std::sync::{Arc, LazyLock, OnceLock};

use indexmap::IndexMap;

use super::g2p::{Seg, to_segments};
use super::manifest::{DIR, MANIFEST, try_manifest};
use super::normalize::{
    cs_count_form, is_unreadable_czech, normalize_czech, normalize_czech_initialisms,
};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::data_source::load_once;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::load_tsv::{TsvOptions, load_tsv_strings};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::registry::{Engine, PhonemizeError};

/// `loanwords.tsv` (optional: a missing file is an empty lexicon, as in the TS).
pub fn try_lexicon() -> Result<&'static IndexMap<JsString, JsString>, String> {
    static L: OnceLock<IndexMap<JsString, JsString>> = OnceLock::new();
    load_once(&L, || {
        load_tsv_strings(
            DIR,
            "loanwords.tsv",
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

/// `phonemizeWord(word)`: the lexicon (as written, then lowercased), else the segments with primary stress on
/// the first nucleus and secondary on every even, non-final one. Not NFC-normalized.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
    if let Some(ipa) = lexicon()
        .get(word)
        .or_else(|| lexicon().get(&word.to_lower_case()))
    {
        return ipa.clone();
    }
    let segs = to_segments(word);
    let nuclei = segs.iter().filter(|s| s.nucleus).count();
    let mut out = JsString::new();
    if nuclei == 0 {
        for s in &segs {
            out.push_str(&s.ph);
        }
        return out;
    }
    let last = nuclei - 1;
    let mut vi: usize = 0;
    let mut seen = false;
    for s in &segs {
        if s.nucleus {
            if seen {
                vi += 1;
            }
            seen = true;
            if vi == 0 {
                out.push_str(&js("ˈ"));
            } else if vi >= 2 && vi.is_multiple_of(2) && vi != last {
                out.push_str(&js("ˌ"));
            }
        }
        out.push_str(&s.ph);
    }
    out
}

/// `NATIVE_CLASS`: the language's own inventory.
const NATIVE_CLASS: &str = "[A-Za-zÁáČčĎďÉéĚěÍíŇňÓóŘřŠšŤťÚúŮůÝýŽž]";

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "u")));

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(r"({})|(\d+(?:,\d+)?)|([.!?…,;:])", *LATIN_RUN),
        "gu",
    )
    .unwrap()
});

/// `SYMBOLS`'s argument, generated from the object literal in czech.ts (key order preserved) by recording it
/// through the `symbols` dump and printing `JSON.stringify` of it. `countForm` is `csCountForm`.
const SYMBOL_DATA: &str = r#"{"multiply":{"times":"krát"},"percent":["procento","procenta","procent"],"currency":{"€":["euro","eura","eur"],"$":["dolar","dolary","dolarů"],"£":["libra","libry","liber"]},"units":{"km":["kilometr","kilometry","kilometrů"],"m":["metr","metry","metrů"],"cm":["centimetr","centimetry","centimetrů"],"mm":["milimetr","milimetry","milimetrů"],"kg":["kilogram","kilogramy","kilogramů"]},"exponentWords":{"squared":["čtvereční","čtvereční","čtverečních"],"cubed":["krychlový","krychlové","krychlových"],"position":"before"},"unitPer":"za","rateDenominators":{"h":"hodinu","s":"sekundu"}}"#;

/// The Czech engine (`createCzech`).
pub struct CzechPhonemizer {
    symbols: SymbolNormalizer,
}

/// The module functions, exposed through the engine: holding a `CzechPhonemizer` proves the manifest and the
/// lexicon loaded, so none of these can reach a load panic. (The per-module differentials call them.)
impl CzechPhonemizer {
    /// `normalizeCzech(text)`; `Err` where the TS throws.
    pub fn normalize(&self, text: &JsString) -> Result<JsString, String> {
        normalize_czech(text)
    }

    /// `normalizeCzechInitialisms(text)`.
    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_czech_initialisms(text)
    }

    /// The shared symbol tier, as Czech builds it.
    pub fn symbols(&self, text: &JsString) -> JsString {
        self.symbols.apply(text)
    }

    /// `isUnreadableCzech(word)`.
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_czech(word)
    }

    /// `phonemizeWord(word)`.
    pub fn phonemize_word(&self, word: &JsString) -> JsString {
        phonemize_word(word)
    }

    /// `toSegments(word)` (g2p.ts).
    pub fn segments(&self, word: &JsString) -> Vec<Seg> {
        to_segments(word)
    }

    /// `numberToWords(n, raw)` (numbers.ts).
    pub fn number_to_words(&self, n: f64, raw: Option<&JsString>) -> JsString {
        number_to_words(n, raw)
    }

    /// `readDigits(digits)` (numbers.ts).
    pub fn read_digits(&self, digits: &JsString) -> JsString {
        super::numbers::read_digits(digits)
    }

    /// `ordinal(n)` (normalize.ts).
    pub fn ordinal(&self, n: f64) -> Option<JsString> {
        super::normalize::ordinal(n)
    }

    /// `csCountForm(n)` (normalize.ts).
    pub fn count_form(&self, n: f64) -> f64 {
        cs_count_form(n)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    /// `text(input)`; `Err` where the TS throws (the normalizer's ordinal steps).
    pub fn text(&self, input: &JsString) -> Result<JsString, String> {
        let normalized = self
            .symbols
            .apply(&normalize_czech_initialisms(&normalize_czech(input)?));
        let m = &*MANIFEST;
        let emit_number =
            |sink: &mut crate::core::clauses::ClauseSink, n: f64, raw: Option<&JsString>| {
                for wd in number_to_words(n, raw).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            };
        Ok(assemble_clauses(&normalized, &TOKEN, |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(num) = mm.group(2, s).filter(|n| !n.is_empty()) {
                // `m[2].split(",")`: the token holds at most one comma.
                let parts = num.split(&js(","));
                let int_part = &parts[0];
                match parts.get(1) {
                    // A 3-digit block after the comma is grouping — unless the integer part is a lone `0`.
                    Some(frac) if frac.len() == 3 && *int_part != js("0") => {
                        let joined = int_part.concat(frac);
                        emit_number(sink, js_number(&joined), Some(&joined));
                    }
                    frac => {
                        emit_number(sink, js_number(int_part), Some(int_part));
                        if let Some(frac) = frac {
                            sink.emit(&phonemize_word(&js("čárka")));
                            for d in frac.code_point_strings() {
                                emit_number(sink, js_number(&d), None);
                            }
                        }
                    }
                }
            } else if let Some(p) = mm.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) = m
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        }))
    }
}

impl Engine for CzechPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        CzechPhonemizer::text(self, input).map_err(PhonemizeError::Input)
    }
}

/// `createCzech()`. Errors when the manifest or the lexicon cannot be loaded, or the symbol tier refuses its
/// data.
pub fn create_czech() -> Result<CzechPhonemizer, String> {
    try_manifest()?;
    try_lexicon()?;
    let mut data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
    data.count_form = Some(Arc::new(cs_count_form));
    Ok(CzechPhonemizer {
        symbols: make_symbol_normalizer(&data)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    // test/czech.test.ts's literal `phonemizeWord`, `normalizeCzech` and `phonemize(…, "cs")` pins, extracted from
    // that file mechanically (each is a reading the TS suite asserts), so the two engines are held to one list.
    const WORD_PINS: &[(&str, &str)] = &[
        ("divadlo", "ɟˈɪvadlo"),
        ("děti", "ɟˈɛcɪ"),
        ("běh", "bjˈɛx"),
        ("měl", "mɲˈɛl"),
        ("policie", "pˈolɪt͡sˌɪjɛ"),
        ("venku", "vˈɛŋku"),
        ("led", "lˈɛt"),
        ("kde", "ɡdˈɛ"),
        ("prosba", "prˈozba"),
        ("vstup", "fstˈup"),
        ("sníh", "sɲˈiːx"),
        ("rozhodně", "rˈosɦodɲɛ"),
        ("tři", "tr̝̊ˈɪ"),
        ("při", "pr̝̊ˈɪ"),
        ("tvář", "tvˈaːr̝̊"),
        ("krk", "kˈr̩k"),
        ("vlk", "vˈl̩k"),
        ("republika", "rˈɛpublˌɪka"),
        ("vyšší", "vˈɪʃʃiː"),
        ("činnost", "t͡ʃˈɪnost"),
    ];
    const NORM_PINS: &[(&str, &str)] = &[
        ("21. století", "dvacátého prvního století"),
        ("ve 21. století", "ve dvacátém prvním století"),
        ("3. května", "třetího května"),
        ("v 90. letech", "v devadesátých letech"),
        ("Bylo to v roce 1990. Přišel", "Bylo to v roce 1990. Přišel"),
        ("14:30", "čtrnáct hodin třicet minut"),
        ("1 234", "1234"),
        ("1990-1995", "1990 do 1995"),
        ("21:00", "dvacetjedna hodin"),
        ("5:00", "pět hodin"),
        ("2:00", "dvě hodiny"),
        ("1:15", "jedna hodina patnáct minut"),
        ("22:00", "dvacetdvě hodiny"),
        ("-5", "mínus 5"),
        ("−5", "mínus 5"),
        ("A&B", "A a B"),
        ("x = y", "x rovná se y"),
        ("Praha-východ", "Praha-východ"),
        ("Čeština je jazyk.", "Čeština je jazyk."),
        ("viz s. 109", "viz strana 109"),
        ("J. S. Bach", "J. S. Bach"),
        ("A. S. Puškin napsal", "A. S. Puškin napsal"),
    ];
    const TEXT_PINS: &[(&str, &str)] = &[
        ("5", "pjˈɛt"),
        ("10", "dˈɛsɛt"),
        ("100", "stˈo"),
        ("1000", "cˈɪsiːt͡s"),
    ];
    const CONTAINS_PINS: &[(&str, &str)] = &[
        ("20 °C", "stˈupɲuː"),
        ("12,5", "t͡ʃˈaːrka"),
        ("3 850 km²", "t͡ʃtvˈɛrɛt͡ʃɲiːx"),
        ("100 km/h", "zˈa ɦˈoɟɪnu"),
    ];

    #[test]
    fn the_ts_suite_pins_hold() {
        let e = create_czech().unwrap();
        for (w, want) in WORD_PINS {
            assert_eq!(e.phonemize_word(&js(w)).to_string_lossy(), *want, "{w}");
        }
        for (t, want) in NORM_PINS {
            assert_eq!(e.normalize(&js(t)).unwrap().to_string_lossy(), *want, "{t}");
        }
        for (t, want) in TEXT_PINS {
            assert_eq!(crate::phonemize(t, "cs").unwrap(), *want, "{t}");
        }
        for (t, part) in CONTAINS_PINS {
            assert!(crate::phonemize(t, "cs").unwrap().contains(part), "{t}");
        }
    }

    /// test/czech.test.ts's relational large-numeral pin (#1059): a 22-digit run keeps its own digits.
    #[test]
    fn a_22_digit_run_keeps_its_own_digits() {
        let a = crate::phonemize("1000000000000000000001", "cs").unwrap();
        let b = crate::phonemize("1000000000000000000009", "cs").unwrap();
        assert_ne!(a, b);
        assert!(a.ends_with("jˈɛdɛn") && b.ends_with("dˈɛvjɛt"));
        assert_eq!(a.split(' ').count(), 22);
    }

    /// The TS throws on an ordinal step's number outside 1–999 (reported in the port log); so does the port.
    #[test]
    fn an_out_of_range_inflected_ordinal_is_an_input_error() {
        assert!(matches!(
            crate::phonemize("Ve 1000. století.", "cs"),
            Err(PhonemizeError::Input(_))
        ));
    }
}
