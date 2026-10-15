//! Luganda / Oluganda (lg) phonemizer: ⟨ng'⟩ ⟨ny⟩ ⟨n'⟩ first, then place-assimilated prenasalisation, ⟨Cw⟩ and
//! vowel-length digraphs, consonant gemination, singles, and the vowel lengthened before a prenasal; text().
//! Ported from src/languages/luganda/luganda.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{GRAPHEME_KEYS, MANIFEST, try_manifest};
use super::normalize::normalize_luganda;
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::js_re;
use crate::registry::{Engine, PhonemizeError};

const SPECIAL: [&str; 5] = ["nng'", "ng'", "nny", "ny", "n'"];

fn is_vowel_letter(c: &JsString) -> bool {
    MANIFEST.vowel_letters.iter().any(|v| js(v) == *c)
}

fn is_prenasal(c: &JsString) -> bool {
    MANIFEST.prenasalisable.iter().any(|v| js(v) == *c)
}

/// `G[k]`, with `undefined` / "" as `None` (the TS tests it for truthiness).
fn g(k: &JsString) -> Option<&'static String> {
    MANIFEST
        .graphemes
        .get(&k.to_string_lossy())
        .filter(|v| !v.is_empty())
}

/// `OTHER_DIGRAPHS`: two-unit keys whose second unit is `w`, or two vowel letters (GRAPHEME_KEYS order).
static OTHER_DIGRAPHS: LazyLock<Vec<JsString>> = LazyLock::new(|| {
    GRAPHEME_KEYS
        .iter()
        .filter(|k| {
            k.len() == 2
                && (k.char_at(1) == js("w")
                    || (is_vowel_letter(&k.char_at(0)) && is_vowel_letter(&k.char_at(1))))
        })
        .cloned()
        .collect()
});

/// `phonemizeWord(word)`: by UTF-16 code unit, as the TS indexes `w[i]`.
pub fn phonemize_word(word: &JsString) -> JsString {
    let w = word.to_lower_case();
    let u = w.units();
    let at = |i: usize| -> JsString {
        if i < u.len() {
            JsString::from_units(&u[i..i + 1])
        } else {
            JsString::new()
        }
    };
    let mut out = JsString::new();
    let mut i = 0;
    while i < u.len() {
        if let Some(sp) = SPECIAL.iter().find(|k| u[i..].starts_with(js(k).units())) {
            let sp = js(sp);
            match MANIFEST.graphemes.get(&sp.to_string_lossy()) {
                Some(v) => out.push_str(&js(v)),
                None => out.push_str(&js("ⁿ")),
            }
            i += sp.len();
            continue;
        }
        let c = at(i);
        let next = at(i + 1);
        if (c == js("n") || c == js("m") || c == js("ŋ")) && is_prenasal(&next) {
            out.push_str(&js(if js("bpfv").includes(&next) {
                "ᵐ"
            } else if js("kg").includes(&next) {
                "ᵑ"
            } else {
                "ⁿ"
            }));
            i += 1;
            continue;
        }
        if let Some(dg) = OTHER_DIGRAPHS
            .iter()
            .find(|k| u[i..].starts_with(k.units()))
        {
            out.push_str(&js(&MANIFEST.graphemes[&dg.to_string_lossy()]));
            i += 2;
            continue;
        }
        if !is_vowel_letter(&c)
            && next == c
            && let Some(p) = g(&c)
        {
            out.push_str(&js(p));
            out.push_str(&js("ː"));
            i += 2;
            continue;
        }
        if let Some(p) = g(&c) {
            out.push_str(&js(p));
        }
        i += 1;
    }
    js_re!(r"([aeiou])(?=[ᵐⁿᵑ])", "g").replace(&out, &js("$1ː"))
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"({})|(\d+)|([.!?…,;:])",
            host_word_run(&["Latin"], "'’", "").unwrap()
        ),
        "giu",
    )
    .unwrap()
});

const NATIVE_CLASS: &str = "[a-zŋ'’]";
type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: a foreign letter folded onto the Latin base the g2p reads.
pub static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "iu")));

/// The Luganda engine (`createLuganda`).
pub struct LugandaPhonemizer;

impl LugandaPhonemizer {
    /// `normalizeLuganda(text)` (normalize.ts).
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_luganda(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        assemble_clauses(&normalize_luganda(input), &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                let w = js_re!(r"’", "gu").replace(&NAT(&w), &js("'"));
                sink.emit(&phonemize_word(&w));
            } else if let Some(d) = m.group(2, s).filter(|d| !d.is_empty()) {
                for wd in number_to_words(js_number(&d), Some(&d)).split(&js(" ")) {
                    sink.emit(&phonemize_word(&wd));
                }
            } else if let Some(p) = m.group(3, s).filter(|p| !p.is_empty())
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

impl Engine for LugandaPhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(LugandaPhonemizer::text(self, input))
    }
}

/// `createLuganda()`. Loads the manifest up front.
pub fn create_luganda() -> Result<LugandaPhonemizer, String> {
    try_manifest()?;
    Ok(LugandaPhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/luganda.test.ts makes into the engine, with the value the TS returned, extracted
    // MECHANICALLY (the suite run under a recording vitest shim that also checked every matcher: all green), so each
    // of the suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("luganda.phonemizeWord", &["nga"], Some("ᵑɡa")),
        ("luganda.phonemizeWord", &["buganda"], Some("buɡaːⁿda")),
        ("luganda.phonemizeWord", &["omuntu"], Some("omuːⁿtu")),
        ("luganda.phonemizeWord", &["enkima"], Some("eːᵑkima")),
        ("luganda.phonemizeWord", &["ng'"], Some("ŋ")),
        ("luganda.phonemizeWord", &["nng'"], Some("ŋː")),
        ("luganda.phonemizeWord", &["nnyo"], Some("ɲːo")),
        ("luganda.phonemizeWord", &["ŋ"], Some("ŋ")),
        ("luganda.phonemizeWord", &["ŋŋ"], Some("ŋː")),
        ("phonemize", &["ŋŋamba", "lg"], Some("ŋːaːᵐba")),
        ("phonemize", &["nng'amba", "lg"], Some("ŋːaːᵐba")),
        ("phonemize", &["ŋabo", "lg"], Some("ŋabo")),
        ("phonemize", &["ng'abo", "lg"], Some("ŋabo")),
        ("phonemize", &["ziseŋŋendo", "lg"], Some("ziseŋːeːⁿdo")),
        ("luganda.phonemizeWord", &["ŋŋamba"], Some("ŋːaːᵐba")),
        (
            "luganda.phonemizeWord",
            &["ziseŋŋendo"],
            Some("ziseŋːeːⁿdo"),
        ),
        ("luganda.phonemizeWord", &["ŋabo"], Some("ŋabo")),
        ("phonemize", &["Łódź", "lg"], Some("lodz")),
        ("phonemize", &["nɡa", "lg"], Some("ᵑɡa")),
        ("phonemize", &["nga", "lg"], Some("ᵑɡa")),
        ("phonemize", &["anɡ", "lg"], Some("aːᵑɡ")),
        ("phonemize", &["ang", "lg"], Some("aːᵑɡ")),
        ("phonemize", &["mɡa", "lg"], Some("ᵑɡa")),
        ("phonemize", &["mga", "lg"], Some("ᵑɡa")),
        ("phonemize", &["luɡanda", "lg"], Some("luɡaːⁿda")),
        ("phonemize", &["luganda", "lg"], Some("luɡaːⁿda")),
        ("phonemize", &["Buɡanda", "lg"], Some("buɡaːⁿda")),
        ("phonemize", &["Buganda", "lg"], Some("buɡaːⁿda")),
        ("phonemize", &["ɡa", "lg"], Some("ɡa")),
        ("phonemize", &["ga", "lg"], Some("ɡa")),
        ("luganda.phonemizeWord", &["amba"], Some("aːᵐba")),
        ("luganda.phonemizeWord", &["ampa"], Some("aːᵐpa")),
        ("luganda.phonemizeWord", &["amfa"], Some("aːᵐfa")),
        ("luganda.phonemizeWord", &["amva"], Some("aːᵐva")),
        ("luganda.phonemizeWord", &["anfa"], Some("aːᵐfa")),
        ("luganda.phonemizeWord", &["anva"], Some("aːᵐva")),
        ("luganda.phonemizeWord", &["anda"], Some("aːⁿda")),
        ("luganda.phonemizeWord", &["anta"], Some("aːⁿta")),
        ("luganda.phonemizeWord", &["anca"], Some("aːⁿca")),
        ("luganda.phonemizeWord", &["anja"], Some("aːⁿɟa")),
        ("luganda.phonemizeWord", &["anka"], Some("aːᵑka")),
        ("luganda.phonemizeWord", &["anga"], Some("aːᵑɡa")),
        ("luganda.phonemizeWord", &["ndwadde"], Some("ⁿdʷadːe")),
        ("phonemize", &["ŋka", "lg"], Some("ᵑka")),
        ("phonemize", &["nka", "lg"], Some("ᵑka")),
        ("phonemize", &["ŋga", "lg"], Some("ᵑɡa")),
        ("phonemize", &["ŋkuŋŋaana", "lg"], Some("ᵑkuŋːaːna")),
        ("phonemize", &["nkuŋŋaana", "lg"], Some("ᵑkuŋːaːna")),
        ("luganda.phonemizeWord", &["bbiri"], Some("bːiɾi")),
        ("luganda.phonemizeWord", &["kitto"], Some("kitːo")),
        ("luganda.phonemizeWord", &["mwana"], Some("mʷana")),
        ("luganda.phonemizeWord", &["luganda"], Some("luɡaːⁿda")),
        ("luganda.phonemizeWord", &["era"], Some("eɾa")),
        ("luganda.numberToWords", &["7"], Some("musanvu")),
        ("luganda.numberToWords", &["10"], Some("kkumi")),
        ("luganda.numberToWords", &["11"], Some("kkumi n'emu")),
        ("luganda.numberToWords", &["12"], Some("kkumi na bbiri")),
        ("luganda.numberToWords", &["20"], Some("amakumi abiri")),
        ("luganda.numberToWords", &["50"], Some("amakumi ataano")),
        ("luganda.numberToWords", &["60"], Some("nkaaga")),
        ("luganda.numberToWords", &["90"], Some("kyenda")),
        (
            "luganda.numberToWords",
            &["21"],
            Some("amakumi abiri mu emu"),
        ),
        ("luganda.numberToWords", &["100"], Some("kikumi")),
        (
            "luganda.numberToWords",
            &["122"],
            Some("kikumi mu amakumi abiri mu bbiri"),
        ),
        (
            "luganda.numberToWords",
            &["222"],
            Some("bikumi bibiri mu amakumi abiri mu bbiri"),
        ),
        ("luganda.numberToWords", &["1000"], Some("lukumi")),
        ("luganda.numberToWords", &["2000"], Some("nkumi bbiri")),
        ("luganda.numberToWords", &["1000000"], Some("kakadde kamu")),
        (
            "luganda.numberToWords",
            &["1000000000"],
            Some("akawumbi kamu"),
        ),
        ("phonemize", &["2", "lg"], Some("bːiɾi")),
        ("phonemize", &["60", "lg"], Some("ᵑkaːɡa")),
        (
            "phonemize",
            &["122", "lg"],
            Some("kikumi mu amakumi abiɾi mu bːiɾi"),
        ),
        (
            "luganda.normalizeLuganda",
            &["abantu 1,208,544 era"],
            Some("abantu 1208544 era"),
        ),
        (
            "luganda.normalizeLuganda",
            &["Obugazi: 1 244.7 km²"],
            Some("Obugazi: kiromita eza kyebiriga 1244 7"),
        ),
        (
            "luganda.normalizeLuganda",
            &["Helsinki esulwaamu abantu 570 074."],
            Some("Helsinki esulwaamu abantu 570074."),
        ),
        (
            "luganda.normalizeLuganda",
            &["200.000 Mitwalo abiri"],
            Some("200000 Mitwalo abiri"),
        ),
        (
            "luganda.normalizeLuganda",
            &["HDI ya 0.628 (omutono)"],
            Some("HDI ya 0 6 2 8 (omutono)"),
        ),
        (
            "luganda.normalizeLuganda",
            &["digito satu (0,1, ne 2)"],
            Some("digito satu (0,1, ne 2)"),
        ),
        (
            "luganda.normalizeLuganda",
            &["olwa 1775–1783"],
            Some("olwa 1775 okutuuka mu 1783"),
        ),
        (
            "luganda.normalizeLuganda",
            &["Kilo 10-12"],
            Some("Kilo 10 okutuuka ku 12"),
        ),
        (
            "luganda.normalizeLuganda",
            &["wakati wa 25–31 °C"],
            Some("wakati wa 25 okutuuka ku 31 °C"),
        ),
        (
            "luganda.normalizeLuganda",
            &["bawangula Aizawl F.C. 4-1"],
            Some("bawangula Aizawl F.C. 4-1"),
        ),
        (
            "luganda.normalizeLuganda",
            &["mu 2008–09"],
            Some("mu 2008–09"),
        ),
        (
            "luganda.normalizeLuganda",
            &["(15. o'gwomunaana 1769-5. o'gwoogutaanu 1821)"],
            Some("(15. o'gwomunaana 1769-5. o'gwoogutaanu 1821)"),
        ),
        (
            "luganda.normalizeLuganda",
            &["doi:10.1186/1742-4690-3-72"],
            Some("doi:10 1 1 8 6/1742-4690-3-72"),
        ),
        (
            "luganda.normalizeLuganda",
            &["ISBN 978-0-7817-6299-1"],
            Some("ISBN 978-0-7817-6299-1"),
        ),
        (
            "luganda.normalizeLuganda",
            &["byaweebwa ebitundu 4.8%"],
            Some("byaweebwa ebitundu 4 8 ku kikumi"),
        ),
        (
            "luganda.normalizeLuganda",
            &["abantu nga 54.4% baali"],
            Some("abantu nga 54 4 ku kikumi baali"),
        ),
        (
            "luganda.normalizeLuganda",
            &["ebitundu 20–25%"],
            Some("ebitundu 20 okutuuka ku 25 ku kikumi"),
        ),
        (
            "luganda.normalizeLuganda",
            &["Abantu 75% ku kikumi"],
            Some("Abantu 75 ku kikumi"),
        ),
        (
            "luganda.normalizeLuganda",
            &["ebitundu 8 ku buli kikumi"],
            Some("ebitundu 8 ku buli kikumi"),
        ),
        (
            "luganda.normalizeLuganda",
            &["ezitasukka $2.15 buli lunaku"],
            Some("ezitasukka ddoola 2 1 5 buli lunaku"),
        ),
        (
            "luganda.normalizeLuganda",
            &["ssente US$50,000 mu"],
            Some("ssente ddoola 50000 mu"),
        ),
        (
            "luganda.normalizeLuganda",
            &["($178k oba €134k)"],
            Some("(ddoola 178k oba euro 134k)"),
        ),
        (
            "luganda.normalizeLuganda",
            &["obukadde bwa ddoola US$29"],
            Some("obukadde bwa ddoola 29"),
        ),
        (
            "luganda.normalizeLuganda",
            &["n'asasulwa pawundi £30 buli wiiki"],
            Some("n'asasulwa pawundi 30 buli wiiki"),
        ),
        (
            "luganda.normalizeLuganda",
            &["obuwumbi bwa Uganda USh35"],
            Some("obuwumbi bwa Uganda USh35"),
        ),
        (
            "luganda.normalizeLuganda",
            &["obugulumivu bwa 10 cm"],
            Some("obugulumivu bwa sentimita 10"),
        ),
        (
            "luganda.normalizeLuganda",
            &["ekinnya sima 30cm"],
            Some("ekinnya sima sentimita 30"),
        ),
        (
            "luganda.normalizeLuganda",
            &["obwagagavu bwa 449 964 km²"],
            Some("obwagagavu bwa kiromita eza kyebiriga 449964"),
        ),
        (
            "luganda.normalizeLuganda",
            &["Ku 580,367 km2 (224,081 sq mi)"],
            Some("Ku kiromita eza kyebiriga 580367 (224081 sq mi)"),
        ),
        ("luganda.normalizeLuganda", &["(1.5kg)"], Some("(kilo 1 5)")),
        (
            "luganda.normalizeLuganda",
            &["ku buwanvu bwa 3,540 feet (1,079 m)"],
            Some("ku buwanvu bwa 3540 feet (mmita 1079)"),
        ),
        (
            "luganda.normalizeLuganda",
            &["ebiwerera ddala akakadde kamu n'ekitundu (1.5m)"],
            Some("ebiwerera ddala akakadde kamu n'ekitundu (1.5m)"),
        ),
        ("luganda.normalizeLuganda", &["802.11m"], Some("802.11m")),
        (
            "luganda.normalizeLuganda",
            &["ku misinde egya 299,792 km/s"],
            Some("ku misinde egya 299792 km/s"),
        ),
        (
            "luganda.normalizeLuganda",
            &["ogwa 4.2/10"],
            Some("ogwa 4 2/10"),
        ),
        (
            "luganda.normalizeLuganda",
            &["Obugazi: 600.2 km²."],
            Some("Obugazi: kiromita eza kyebiriga 600 2."),
        ),
        (
            "luganda.normalizeLuganda",
            &["Anastacia (Chicago, 17.09.1968)"],
            Some("Anastacia (Chicago, 17.09.1968)"),
        ),
        ("phonemize", &["2.15", "lg"], Some("bːiɾi emu tːaːno")),
        (
            "luganda.normalizeLuganda",
            &["medicine (4th ed.)"],
            Some("medicine (4 ed.)"),
        ),
        (
            "luganda.normalizeLuganda",
            &["omulundi ogwokusatu"],
            Some("omulundi ogwokusatu"),
        ),
        (
            "phonemize",
            &["25%", "lg"],
            Some("amakumi abiɾi mu tːaːno ku kikumi"),
        ),
        (
            "phonemize",
            &["5 km²", "lg"],
            Some("kiɾomita eza kjebiɾiɡa tːaːno"),
        ),
        ("phonemize", &["20 °C", "lg"], Some("amakumi abiɾi c")),
        (
            "luganda.normalizeLuganda",
            &["kilometers 333 ne 5kg"],
            Some("kilometers 333 ne kilo 5"),
        ),
        (
            "luganda.normalizeLuganda",
            &["Kilo 10 ne 5kg"],
            Some("Kilo 10 ne 5"),
        ),
        (
            "luganda.normalizeLuganda",
            &["Kiromita zaayo 1300 km"],
            Some("Kiromita zaayo 1300"),
        ),
        (
            "luganda.normalizeLuganda",
            &["Euro 134 oba €134"],
            Some("Euro 134 oba 134"),
        ),
        (
            "luganda.normalizeLuganda",
            &["kiromiita 20 ne 30 km"],
            Some("kiromiita 20 ne 30"),
        ),
        (
            "luganda.normalizeLuganda",
            &["abantu kikumi mu ataano ne 25%"],
            Some("abantu kikumi mu ataano ne 25 ku kikumi"),
        ),
        (
            "luganda.normalizeLuganda",
            &["misinde egya 800 m."],
            Some("misinde egya mmita 800."),
        ),
        (
            "luganda.normalizeLuganda",
            &["yadduka 100 m, era"],
            Some("yadduka mmita 100, era"),
        ),
        ("luganda.normalizeLuganda", &["(1.5m)"], Some("(1.5m)")),
        (
            "luganda.normalizeLuganda",
            &["wakati wa 0–1."],
            Some("wakati wa 0 okutuuka ku 1."),
        ),
        (
            "luganda.normalizeLuganda",
            &["olwa 1775–1783."],
            Some("olwa 1775 okutuuka mu 1783."),
        ),
        (
            "luganda.normalizeLuganda",
            &["olwa 1775–1783, era"],
            Some("olwa 1775–1783, era"),
        ),
        (
            "luganda.normalizeLuganda",
            &["0.1–0.4 ha"],
            Some("0 1–0 4 ha"),
        ),
        (
            "luganda.normalizeLuganda",
            &["5–13.7 ha"],
            Some("5 okutuuka ku 13 7 ha"),
        ),
        (
            "luganda.normalizeLuganda",
            &["abantu 1,000-2,000 mu kibuga"],
            Some("abantu 1000 okutuuka ku 2000 mu kibuga"),
        ),
        (
            "luganda.normalizeLuganda",
            &["1,500–2,000 mmita"],
            Some("1500 okutuuka ku 2000 mmita"),
        ),
        (
            "luganda.normalizeLuganda",
            &["Awo kusaawa 11:29, okwekalakaasa"],
            Some("Awo kusaawa 11 29, okwekalakaasa"),
        ),
        (
            "luganda.normalizeLuganda",
            &["ku ssaawa 11:00, abeekalakaasi"],
            Some("ku ssaawa 11 00, abeekalakaasi"),
        ),
        (
            "luganda.normalizeLuganda",
            &["ku saawa 8:46 am zenyini"],
            Some("ku saawa 8 46 am zenyini"),
        ),
        (
            "luganda.normalizeLuganda",
            &["saawa 12.00 GMT"],
            Some("saawa 12 00 GMT"),
        ),
        (
            "luganda.normalizeLuganda",
            &["1:15 ezekiro kulwomukaag"],
            Some("1 15 ezekiro kulwomukaag"),
        ),
        (
            "luganda.normalizeLuganda",
            &["07:19 ez’okumakya"],
            Some("07 19 ez’okumakya"),
        ),
        (
            "luganda.normalizeLuganda",
            &["bwa 3.50 m."],
            Some("bwa 3 5 0 m."),
        ),
        (
            "luganda.normalizeLuganda",
            &["akebanga 4:41.30"],
            Some("akebanga 4:41 3 0"),
        ),
        (
            "luganda.normalizeLuganda",
            &["ne 802.11a"],
            Some("ne 802.11a"),
        ),
        (
            "luganda.normalizeLuganda",
            &["wa 06:30 ne 07:30."],
            Some("wa 06:30 ne 07:30."),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let call = |f: &str, args: &[&str]| -> Option<JsString> {
            let a = |i: usize| js(args[i]);
            match f {
                "luganda.phonemizeWord" => Some(phonemize_word(&a(0))),
                "luganda.normalizeLuganda" => Some(normalize_luganda(&a(0))),
                "luganda.numberToWords" => Some(number_to_words(
                    js_number(&a(0)),
                    (args.len() > 1).then(|| a(1)).as_ref(),
                )),
                "phonemize" => Some(js(&crate::phonemize(args[0], args[1]).unwrap())),
                _ => panic!("no replay for {f}"),
            }
        };
        for (f, args, want) in TS_SUITE_CALLS {
            let got: Option<String> = call(f, args).map(|s| s.to_string_lossy());
            assert_eq!(got.as_deref(), *want, "{f}{args:?}");
        }
    }

    /// Every `rewrite` is on the pipeline string: no probe or golden line poisons the mapping (the TS
    /// `tools/provenance-poison.mts lg` reports 0 sites as well).
    #[test]
    fn luganda_rewrites_never_poison_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes =
            std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/lg.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/lg.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "lg").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 200);
        assert_eq!(hits.get(), 0);
    }
}
