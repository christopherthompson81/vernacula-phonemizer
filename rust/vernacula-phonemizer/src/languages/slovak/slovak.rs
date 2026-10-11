//! Slovak (sk) phonemizer: the rule g2p with fixed FIRST-syllable stress (secondary on even non-final nuclei),
//! the count-form selector and the symbol tier (which normalize.ts calls mid-pipeline), and text() over Latin
//! words (a foreign name nativised), numbers and clause punctuation.
//! Ported from src/languages/slovak/slovak.ts — see that file for the corpus evidence.

use std::sync::{Arc, LazyLock};

use super::g2p::{Seg, to_segments};
use super::manifest::{MANIFEST, try_manifest};
use super::normalize::{
    Slot, is_unreadable_slovak, normalize_slovak, normalize_slovak_initialisms, ordinal_words,
};
use super::numbers::{number_to_words, read_digits};
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{LATIN_RUN, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::normalize_symbols::{SymbolData, SymbolNormalizer, make_symbol_normalizer};
use crate::registry::{Engine, PhonemizeError};

/// `phonemizeWord(word)`: primary stress on the first nucleus, secondary on every even, non-final one.
pub(crate) fn phonemize_word(word: &JsString) -> JsString {
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
    let mut vi: isize = -1;
    for s in &segs {
        if s.nucleus {
            vi += 1;
            if vi == 0 {
                out.push_str(&js("ˈ"));
            } else if vi >= 2 && (vi as usize).is_multiple_of(2) && vi as usize != last {
                out.push_str(&js("ˌ"));
            }
        }
        out.push_str(&s.ph);
    }
    out
}

/// `NATIVE_CLASS`: the language's own inventory.
const NATIVE_CLASS: &str = "[A-Za-zÁáÄäČčĎďÉéÍíĹĺĽľŇňÓóÔôŔŕŠšŤťÚúÝýŽž]";

type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
static NAT: LazyLock<Nativiser> = LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "u")));

static TOKEN: LazyLock<JsRegex> =
    LazyLock::new(|| JsRegex::new(&format!(r"({})|(\d+)|([.!?…,;:])", *LATIN_RUN), "gu").unwrap());

/// `skCountForm(n)`: 1 → 0, exactly 2/3/4 → 1, everything else → 2 (the whole numeral, not its last digits).
pub fn sk_count_form(n: f64) -> f64 {
    if n == 1.0 {
        0.0
    } else if n == 2.0 || n == 3.0 || n == 4.0 {
        1.0
    } else {
        2.0
    }
}

/// `SYMBOLS`'s argument, generated from the object literal in slovak.ts (key order preserved) by recording it
/// through the `symbols` dump and printing `JSON.stringify` of it. `countForm` is `skCountForm`.
const SYMBOL_DATA: &str = r#"{"multiply":{"times":"krát"},"percent":["percento","percentá","percent"],"currency":{"$":["dolár","doláre","dolárov"],"€":["euro","eurá","eur"],"£":["libra","libry","libier"],"¥":["jen","jeny","jenov"]},"units":{"km":["kilometer","kilometre","kilometrov"],"m":["meter","metre","metrov"],"cm":["centimeter","centimetre","centimetrov"],"mm":["milimeter","milimetre","milimetrov"],"kg":["kilogram","kilogramy","kilogramov"],"ghz":["gigahertz","gigahertze","gigahertzov"],"mhz":["megahertz","megahertze","megahertzov"]},"unitPer":{"h":"na","s":"za"},"rateDenominators":{"h":"hodinu","s":"sekundu"},"exponentWords":{"squared":["štvorcový","štvorcové","štvorcových"],"cubed":["kubický","kubické","kubických"],"position":"before"}}"#;

/// `SYMBOLS`: the shared symbol tier as Slovak builds it, or why it refused its data. normalize.rs applies it.
pub(crate) static SYMBOLS: LazyLock<Result<SymbolNormalizer, String>> = LazyLock::new(|| {
    let mut data: SymbolData = serde_json::from_str(SYMBOL_DATA).map_err(|e| e.to_string())?;
    data.count_form = Some(Arc::new(sk_count_form));
    make_symbol_normalizer(&data)
});

/// The Slovak engine (`createSlovak`).
pub struct SlovakPhonemizer;

/// The module functions, exposed through the engine: holding a `SlovakPhonemizer` proves the manifest and the
/// symbol tier loaded, so none of these can reach a load panic. (The per-module differentials call them.)
impl SlovakPhonemizer {
    /// `normalizeSlovak(text)` (the initialism pass and the symbol tier included).
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_slovak(text)
    }

    /// `normalizeSlovakInitialisms(text)`.
    pub fn normalize_initialisms(&self, text: &JsString) -> JsString {
        normalize_slovak_initialisms(text)
    }

    /// `isUnreadableSlovak(word)`.
    pub fn is_unreadable(&self, word: &JsString) -> bool {
        is_unreadable_slovak(word)
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
        read_digits(digits)
    }

    /// `ordinalWords(n, slot)` (normalize.ts), the slot by its TS name.
    pub fn ordinal_words(&self, n: f64, slot: &str) -> Option<JsString> {
        ordinal_words(n, Slot::parse(slot)?)
    }

    /// `skCountForm(n)`.
    pub fn count_form(&self, n: f64) -> f64 {
        sk_count_form(n)
    }

    /// `nat(word)`.
    pub fn nativise(&self, word: &JsString) -> JsString {
        NAT(word)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let m = &*MANIFEST;
        assemble_clauses(&normalize_slovak(input), &TOKEN, |mm, s, sink| {
            if let Some(w) = mm.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
            } else if let Some(num) = mm.group(2, s).filter(|n| !n.is_empty()) {
                let words = if num.len() <= 9 {
                    number_to_words(js_number(&num), Some(&num))
                } else {
                    read_digits(&num)
                };
                for wd in words.split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = mm.group(3, s).filter(|p| !p.is_empty())
                && let Some(mk) = m
                    .clause_punctuation
                    .get(&p.to_string_lossy())
                    .filter(|mk| !mk.is_empty())
            {
                sink.pause(&js(mk));
            }
        })
    }
}

impl Engine for SlovakPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(SlovakPhonemizer::text(self, input))
    }
}

/// `createSlovak()`. Errors when the manifest cannot be loaded or the symbol tier refuses its data.
pub fn create_slovak() -> Result<SlovakPhonemizer, String> {
    try_manifest()?;
    SYMBOLS.as_ref().map_err(|e| e.clone())?;
    Ok(SlovakPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // test/slovak.test.ts's literal `phonemizeWord`, `normalizeSlovak`, `ordinalWords` and `.text(…)` pins,
    // extracted from that file mechanically (each is a reading the TS suite asserts), so the two engines are held
    // to one list. `ENGINE_TEXT_PINS` go through `createSlovak().text` (no registry pre-pass), the registry ones
    // through `getPhonemizer("sk").text`; the bool says whether the TS trims the result.
    const WORD_PINS: &[(&str, &str)] = &[
        ("deň", "ɟˈeɲ"),
        ("deti", "ɟˈeci"),
        ("list", "ʎˈist"),
        ("milý", "mˈiliː"),
        ("ľúbiť", "ʎˈuːbic"),
        ("chlieb", "xʎˈɪ̯ep"),
        ("kôň", "kˈu̯ɔɲ"),
        ("mäso", "mˈæsɔ"),
        ("dievča", "ɟˈɪ̯evt͡ʃa"),
        ("vlk", "vˈl̩k"),
        ("krv", "kˈr̩v"),
        ("stĺp", "stˈl̩ːp"),
        ("vták", "ftˈaːk"),
        ("včera", "ft͡ʃˈera"),
        ("stav", "stˈav"),
        ("pravda", "prˈavda"),
        ("ch", "x"),
    ];
    const NORM_PINS: &[(&str, &str)] = &[
        (
            "V 16. storočí sa Paraguaj.",
            "V šestnástom storočí sa Paraguaj.",
        ),
        ("Do 17. septembra 1939", "Do sedemnásteho septembra 1939"),
        (
            "V 60. rokoch 20. storočia.",
            "V šesťdesiatych rokoch dvadsiateho storočia.",
        ),
        ("na 190. mieste", "na sto deväťdesiatom mieste"),
        ("búrka 4. kategórie", "búrka štvrtej kategórie"),
        ("jeho 60. gólom", "jeho šesťdesiatym gólom"),
        (
            "v 11., 12. a 13. storočí",
            "v jedenástom, dvanástom a trinástom storočí",
        ),
        (
            "z obdobia 19. a začiatku 20. storočia",
            "z obdobia devätnásteho a začiatku dvadsiateho storočia",
        ),
        ("5. ročník", "piaty ročník"),
        (
            "kráľovná Alžbeta 2. mala byť",
            "kráľovná Alžbeta druhá mala byť",
        ),
        ("kráľovnej Alžbety 2. mala", "kráľovnej Alžbety druhej mala"),
        (
            "náčelníka Lealofiho 3. viedol",
            "náčelníka Lealofiho tretieho viedol",
        ),
        ("stanice Fort Greely 9.", "stanice Fort Greely 9."),
        ("Charles Darwin v roku 1835.", "Charles Darwin v roku 1835."),
        ("v roku 2020.", "v roku 2020."),
        ("s počtom bodov 2 243.", "s počtom bodov 2243."),
        (
            "t.j. 0 alebo 1. Tieto čísla",
            "to jest 0 alebo 1. Tieto čísla",
        ),
        ("hladinou v roku 2005.“", "hladinou v roku 2005.“"),
        (
            "1 km a 2 km a 5 km a 22 km",
            "1 kilometer a 2 kilometre a 5 kilometrov a 22 kilometrov",
        ),
        ("1 % a 3 % a 21 %", "1 percento a 3 percentá a 21 percent"),
        ("1:15 ráno", "jedna hodina pätnásť minút ráno"),
        ("(15:00 univerzálneho", "(pätnásť hodín univerzálneho"),
        ("Presne o 8:46 ráno", "Presne o ôsmej štyridsaťšesť ráno"),
        (
            "Tesne po 11:00 demonštranti",
            "Tesne po jedenástej demonštranti",
        ),
        (
            "do 23:35 hod uhasili.",
            "do dvadsiatej tretej tridsaťpäť uhasili.",
        ),
        ("o 12.00 GMT", "o dvanástej gé em té"),
        (
            "odchádza medzi 06:30 a 07:30.",
            "odchádza medzi šiestou tridsať a siedmou tridsať.",
        ),
        (
            "oheň medzi 22:00 - 23:00 Horského",
            "oheň medzi dvadsiatou druhou a dvadsiatou treťou Horského",
        ),
        ("zvíťazila 26:00 nad Zambiou", "zvíťazila 26:00 nad Zambiou"),
        ("je 7:2.", "je 7:2."),
        (
            "získal 88 % čistých bodov",
            "získal 88 percent čistých bodov",
        ),
        (
            "od 11 000 $ do 22 500 $",
            "od 11000 dolárov do 22500 dolárov",
        ),
        ("teploty nad +30°C.", "teploty nad plus 30 stupňov Celzia."),
        ("-5 stupňov", "mínus 5 stupňov"),
        ("negatív má 36x24 mm", "negatív má 36 krát 24 milimetrov"),
        ("B&B súťažia", "bé a bé súťažia"),
        ("5 < 6", "5 menší ako 6"),
        ("7 > 3", "7 väčší ako 3"),
        ("x = y", "x rovná sa y"),
        ("8 ÷ 2", "8 delené 2"),
        ("19 500 km²", "19500 štvorcových kilometrov"),
        ("64 km/h", "64 kilometrov na hodinu"),
        ("40 míľ/h", "40 míľ za hodinu"),
        ("približne 4 800 km", "približne 4800 kilometrov"),
        ("2,4 GHz", "2 čiarka 4 gigahertzov"),
        (
            "často 160 – 320 km/h",
            "často 160 do 320 kilometrov na hodinu",
        ),
        ("stavu 6-6 vyžiadalo", "stavu 6-6 vyžiadalo"),
        ("typu Il-76.", "typu Il-76."),
        ("štandardu 802.11n", "štandardu 802 bodka 11n"),
        (
            "356 pred n.l. Išlo o akt",
            "356 pred naším letopočtom. Išlo o akt",
        ),
        (
            "okolo roku 400 n. l. a trvala",
            "okolo roku 400 nášho letopočtu a trvala",
        ),
        ("výšku 4892 m n. m.", "výšku 4892 metrov nad morom."),
        ("jedlá atď., obetovaných", "jedlá a tak ďalej, obetovaných"),
        ("tuniak atď.", "tuniak a tak ďalej."),
        ("Dr. Ehud Ur", "doktor Ehud Ur"),
        ("kozmonaut č. 11", "kozmonaut číslo 11"),
        ("3/4", "tri štvrtiny"),
        ("1/5", "jedna pätina"),
        ("2/3", "dve tretiny"),
        ("od roku 1995/96, ktorý", "od roku 1995/96, ktorý"),
        ("USA a OSN", "ú es á a ó es en"),
        ("MRI a FBI", "em er í a ef bé í"),
        ("HDP vzrástol", "há dé pé vzrástol"),
        ("cez VPN", "cez vé pé en"),
        ("PTWC vydalo", "pé té dvojité vé cé vydalo"),
        ("J. S. Bach", "jé es Bach"),
        ("SPRÁVA O STAVE KRAJINY", "SPRÁVA O STAVE KRAJINY"),
        ("v St. Louis v štáte", "v St Louis v štáte"),
        ("stanica st.", "stanica st."),
        ("UNESCO uviedla", "UNESCO uviedla"),
        ("NASA uviedla", "NASA uviedla"),
        ("OPEC uviedla", "OPEC uviedla"),
        ("SWAPO uviedla", "SWAPO uviedla"),
        ("FIFA uviedla", "FIFA uviedla"),
        ("PALM uviedla", "PALM uviedla"),
    ];
    const ENGINE_TEXT_PINS: &[(&str, &str, bool)] = &[
        ("0", "nˈula", true),
        ("15", "pˈætnaːsc", true),
        ("21", "dvˈatsacjˌeɟen", true),
        ("1000", "cˈisiːt͡s", true),
        ("2000", "dvˈa cˈisiːt͡se", true),
        ("5000", "pˈæc cˈisiːt͡s", true),
        ("21000", "dvˈatsacjˌeɟen cˈisiːt͡s", true),
        ("1000000", "mˈiʎiɔːn", true),
        ("2000000", "dvˈa mˈiʎiˌɔːni", true),
        (
            "1000000000",
            "jˈeɟen nˈula nˈula nˈula nˈula nˈula nˈula nˈula nˈula nˈula",
            true,
        ),
        ("Mesto je pekné.", "mˈestɔ jˈe pˈekneː .", false),
        ("V 16. storočí.", "v ʃˈestnaːstɔm stˈɔrɔt͡ʃiː .", true),
        ("88 %", "ˈɔsemɟˌesɪ̯atˌɔsem pˈert͡sent", true),
    ];
    const REGISTRY_TEXT_PINS: &[(&str, &str, bool)] = &[
        (
            "Alžbeta II. navštívila",
            "ˈalʒbeta drˈuɦaː nˈavʃciːvˌila",
            true,
        ),
        ("Ľudovít XIV. bol", "ʎˈudɔviːt ʃtˈr̩naːsti bˈɔl", true),
        ("Ľudovít XV. bol", "ʎˈudɔviːt pˈætnaːsti bˈɔl", true),
    ];
    const ORDINAL_PINS: &[(f64, &str, &str)] = &[
        (16.0, "n.loc", "šestnástom"),
        (3.0, "m.gen", "tretieho"),
        (3.0, "n.loc", "treťom"),
        (8.0, "m.gen", "ôsmeho"),
        (7.0, "m.instr", "siedmym"),
        (24.0, "m.gen", "dvadsiateho štvrtého"),
        (23.0, "m.gen", "dvadsiateho tretieho"),
        (37.0, "f.instr", "tridsiatou siedmou"),
        (190.0, "n.loc", "sto deväťdesiatom"),
        (100.0, "m.gen", "stého"),
        (1918.0, "m.gen", "tisíc deväťsto osemnásteho"),
    ];
    const ORDINAL_NONE_PINS: &[(f64, &str)] = &[(1000.0, "m.nom")];

    #[test]
    fn the_ts_suite_pins_hold() {
        let e = create_slovak().unwrap();
        let trim = |s: String, t: bool| if t { s.trim().to_string() } else { s };
        for (w, want) in WORD_PINS {
            assert_eq!(e.phonemize_word(&js(w)).to_string_lossy(), *want, "{w}");
        }
        for (t, want) in NORM_PINS {
            assert_eq!(e.normalize(&js(t)).to_string_lossy(), *want, "{t}");
        }
        for (t, want, trimmed) in ENGINE_TEXT_PINS {
            assert_eq!(
                trim(e.text(&js(t)).to_string_lossy(), *trimmed),
                *want,
                "{t}"
            );
        }
        for (t, want, trimmed) in REGISTRY_TEXT_PINS {
            assert_eq!(
                trim(crate::phonemize(t, "sk").unwrap(), *trimmed),
                *want,
                "{t}"
            );
        }
        for (n, slot, want) in ORDINAL_PINS {
            assert_eq!(
                e.ordinal_words(*n, slot).unwrap().to_string_lossy(),
                *want,
                "{n} {slot}"
            );
        }
        for (n, slot) in ORDINAL_NONE_PINS {
            assert!(e.ordinal_words(*n, slot).is_none(), "{n} {slot}");
        }
        // test/slovak.test.ts's one relational pin: the sentence-final pause survives.
        assert!(
            e.text(&js("v roku 1835."))
                .to_string_lossy()
                .trim()
                .ends_with('.')
        );
    }
}
