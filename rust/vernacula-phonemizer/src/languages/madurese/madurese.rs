//! Madurese (mad) phonemizer: a longest-match tokenizer with geminates, hiatus epenthesis, the vowel-register
//! harmony, final devoicing, the number words, and text().
//! Ported from src/languages/madurese/madurese.ts — see that file for the corpus evidence.

use std::sync::LazyLock;

use super::manifest::{CONS, CONS_KEYS, MANIFEST, Reg, VOWEL_KEYS, try_manifest};
use super::normalize::{normalize_madurese, try_symbols};
use super::numbers::number_to_words;
use crate::core::clauses::assemble_clauses;
use crate::core::host_word::{host_word_run, make_nativiser};
use crate::core::js_regex::JsRegex;
use crate::core::js_string::{JsString, js, js_number};
use crate::core::latin_phones::{PhoneOpts, latin_phone};
use crate::registry::{Engine, PhonemizeError};

#[derive(Debug, Clone)]
enum Seg {
    C { ipa: JsString, reg: Reg },
    V { low: JsString, high: JsString },
}

/// `isConsLetter(ch)`: `ch` is one UTF-16 code unit, as `w[i]` is in the TS.
fn is_cons_letter(ch: &JsString) -> bool {
    CONS.contains_key(ch) || *ch == js("h")
}

/// `HEIGHT[v] ?? 0`.
fn height(v: &JsString) -> u8 {
    match v.to_string_lossy().as_str() {
        "ɛ" | "ə" | "ɔ" | "e" => 1,
        "i" | "u" => 2,
        _ => 0,
    }
}

fn is_front(u: &JsString) -> bool {
    *u == js("i") || *u == js("ɛ") || *u == js("e")
}

/// `w.startsWith(key, i)`, by code unit.
fn starts_with_at(w: &JsString, key: &JsString, i: usize) -> bool {
    w.units()
        .get(i..)
        .is_some_and(|rest| rest.starts_with(key.units()))
}

/// `tokenize(w)`: longest match over the consonant then vowel keys, by UTF-16 code unit as the TS indexes.
fn tokenize(w: &JsString) -> Vec<Seg> {
    let u = w.units();
    let unit = |i: usize| JsString::from_units(&u[i..i + 1]);
    let mut segs = Vec::new();
    let mut i = 0;
    let mut geminate = false;
    while i < u.len() {
        if i + 1 < u.len() && u[i] == u[i + 1] && is_cons_letter(&unit(i)) {
            geminate = true;
            i += 1;
            continue;
        }
        if let Some(key) = CONS_KEYS.iter().find(|k| starts_with_at(w, k, i)) {
            let c = &CONS[key];
            let mut ipa = c.ipa.clone();
            if geminate {
                if c.ipa != js("l") && c.ipa != js("ɾ") {
                    ipa.push_str(&js("ː"));
                }
                geminate = false;
            }
            segs.push(Seg::C { ipa, reg: c.reg });
            i += key.len();
            continue;
        }
        if let Some(key) = VOWEL_KEYS.iter().find(|k| starts_with_at(w, k, i)) {
            let (low, high) = &MANIFEST.vowel_spec[&key.to_string_lossy()];
            segs.push(Seg::V {
                low: js(low),
                high: js(high),
            });
            i += key.len();
            continue;
        }
        geminate = false;
        if let Some(ph) = latin_phone(
            &unit(i),
            PhoneOpts {
                initial: i == 0,
                include_h: true,
            },
        ) {
            segs.push(Seg::C {
                ipa: ph,
                reg: Reg::Low,
            });
        }
        i += 1;
    }
    segs
}

/// `epenthesize(segs)`: ʔ between identical vowels, a glide between non-rising ones.
fn epenthesize(segs: Vec<Seg>) -> Vec<Seg> {
    let mut out = Vec::with_capacity(segs.len());
    for k in 0..segs.len() {
        out.push(segs[k].clone());
        if let (Seg::V { low: a, .. }, Some(Seg::V { low: b, .. })) = (&segs[k], segs.get(k + 1)) {
            if a == b {
                out.push(Seg::C {
                    ipa: js("ʔ"),
                    reg: Reg::Low,
                });
            } else if height(b) <= height(a) {
                out.push(Seg::C {
                    ipa: js(if is_front(a) { "j" } else { "w" }),
                    reg: Reg::Transp,
                });
            }
        }
    }
    out
}

/// `phonemizeWord(word)`: register harmony + epenthesis + devoicing + gemination.
pub fn phonemize_word(word: &JsString) -> JsString {
    let segs = epenthesize(tokenize(&word.to_lower_case()));
    let mut prev_raise = false;
    let mut prev_is_c = false;
    let mut ipa: Vec<JsString> = Vec::new();
    let mut last_c: Option<usize> = None;
    for s in &segs {
        match s {
            Seg::C { ipa: p, reg } => {
                match reg {
                    Reg::Raise => prev_raise = true,
                    Reg::Low => prev_raise = false,
                    Reg::Transp if !prev_is_c => prev_raise = false,
                    Reg::Transp => {}
                }
                ipa.push(p.clone());
                last_c = Some(ipa.len() - 1);
                prev_is_c = true;
            }
            Seg::V { low, high } => {
                ipa.push(if prev_raise {
                    high.clone()
                } else {
                    low.clone()
                });
                last_c = None;
                prev_is_c = false;
            }
        }
    }
    if let Some(lc) = last_c
        && lc + 1 == ipa.len()
    {
        let seg = &ipa[lc];
        let long = seg.ends_with(&js("ː"));
        let base = if long {
            seg.slice(0, Some(-1))
        } else {
            seg.clone()
        };
        if let Some(d) = MANIFEST
            .final_devoice
            .get(&base.to_string_lossy())
            .filter(|d| !d.is_empty())
        {
            ipa[lc] = if long { js(d).concat(&js("ː")) } else { js(d) };
        }
    }
    JsString::join(&ipa, &JsString::new())
}

static TOKEN: LazyLock<JsRegex> = LazyLock::new(|| {
    JsRegex::new(
        &format!(
            r"({})|(\d+)|([.!?…,;:])",
            host_word_run(&["Latin"], "'", "").unwrap()
        ),
        "giu",
    )
    .unwrap()
});

const NATIVE_CLASS: &str = "[a-zâèéòḍṭ']";
type Nativiser = Box<dyn Fn(&JsString) -> JsString + Send + Sync>;
/// `nat`: a foreign letter folded onto the Latin base the g2p reads.
pub static NAT: LazyLock<Nativiser> =
    LazyLock::new(|| Box::new(make_nativiser(NATIVE_CLASS, "iu")));

pub struct MaduresePhonemizer;

impl MaduresePhonemizer {
    pub fn normalize(&self, text: &JsString) -> JsString {
        normalize_madurese(text)
    }

    pub fn symbols(&self, text: &JsString) -> JsString {
        try_symbols()
            .expect("checked by create_madurese")
            .apply(text)
    }

    pub fn text(&self, input: &JsString) -> JsString {
        let s = normalize_madurese(input);
        assemble_clauses(&s, &TOKEN, |m, s, sink| {
            if let Some(w) = m.group(1, s).filter(|w| !w.is_empty()) {
                sink.emit(&phonemize_word(&NAT(&w)));
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

impl Engine for MaduresePhonemizer {
    fn text(&self, input: &JsString) -> Result<JsString, PhonemizeError> {
        Ok(MaduresePhonemizer::text(self, input))
    }
}

/// `createMadurese()`. Loads the manifest and the symbol tier up front.
pub fn create_madurese() -> Result<MaduresePhonemizer, String> {
    try_manifest()?;
    try_symbols()?;
    Ok(MaduresePhonemizer)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Every call test/madurese.test.ts makes into the engine, with the value the TS returned, extracted MECHANICALLY
    // (the suite run under a recording vitest shim that also checked every matcher: all green), so each of the
    // suite's expectations holds here exactly when the Rust returns the same value. `None` is `undefined`.
    const TS_SUITE_CALLS: &[(&str, &[&str], Option<&str>)] = &[
        ("phonemizeWord", &["Madhurâ"], Some("matʰuɾɤ")),
        ("phonemizeWord", &["bân"], Some("bɤn")),
        ("phonemizeWord", &["polo"], Some("pɔlɔ")),
        (
            "phonemize",
            &["5.168 km²", "mad"],
            Some("lɛmaʔ ɛbu bɤn atɔs bɤn ənːəm pɔlɔ bɤn bɤluʔ kilɔmɛtəɾ pəɾsəɡi"),
        ),
        (
            "phonemize",
            &["676,578 km²", "mad"],
            Some(
                "ənːəm atɔs bɤn pətːɔʔ pɔlɔ bɤn ənːəm ɛbu bɤn lɛmaʔ atɔs bɤn pətːɔʔ pɔlɔ bɤn bɤluʔ kilɔmɛtəɾ pəɾsəɡi",
            ),
        ),
        (
            "phonemize",
            &["1,6%", "mad"],
            Some("sətːɔŋ kɔma ənːəm pəɾsən"),
        ),
        (
            "phonemize",
            &["39.33%", "mad"],
            Some("təlɔ pɔlɔ bɤn saŋaʔ kɔma təlɔ təlɔ pəɾsən"),
        ),
        (
            "phonemize",
            &["2.093,45 km²", "mad"],
            Some("duwɤ ɛbu bɤn saŋaʔ pɔlɔ bɤn təlɔ kɔma əmpaʔ lɛmaʔ kilɔmɛtəɾ pəɾsəɡi"),
        ),
        (
            "normalizeMadurese",
            &["0,001%"],
            Some("0 koma 0 0 1 persen"),
        ),
        (
            "normalizeMadurese",
            &["1.857,530 km²"],
            Some("1857 koma 5 3 0 kilomèter persegi"),
        ),
        (
            "phonemize",
            &["pokol 14.00", "mad"],
            Some("pɔkɔl sapɔlɔ bɤn əmpaʔ"),
        ),
        (
            "phonemize",
            &["kol 17:00 WIB", "mad"],
            Some("kɔl sapɔlɔ bɤn pətːɔʔ wip"),
        ),
        ("phonemize", &["2:00", "mad"], Some("duwɤ")),
        (
            "phonemize",
            &["pokol 18:45", "mad"],
            Some("pɔkɔl sapɔlɔ bɤn bɤluʔ , əmpaʔ pɔlɔ bɤn lɛmaʔ"),
        ),
        (
            "phonemize",
            &["Rp 16.31 milyad", "mad"],
            Some("sapɔlɔ bɤn ənːəm kɔma təlɔ sətːɔŋ miljat ɾupijah"),
        ),
        (
            "phonemize",
            &["36°C", "mad"],
            Some("təlɔ pɔlɔ bɤn ənːəm dɨɾaɟɤt cəlcijus"),
        ),
        (
            "phonemize",
            &["40 °C", "mad"],
            Some("əmpaʔ pɔlɔ dɨɾaɟɤt cəlcijus"),
        ),
        (
            "phonemize",
            &["77°-100 °F", "mad"],
            Some("pətːɔʔ pɔlɔ bɤn pətːɔʔ dɨɾaɟɤt sampɛʔ atɔs dɨɾaɟɤt fahɾənhəit"),
        ),
        (
            "phonemize",
            &["112º–113º", "mad"],
            Some("atɔs bɤn sapɔlɔ bɤn duwɤ dɨɾaɟɤt sampɛʔ atɔs bɤn sapɔlɔ bɤn təlɔ dɨɾaɟɤt"),
        ),
        (
            "normalizeMadurese",
            &["7°53’-8°34’"],
            Some("7 derajat 53’ sampè' 8 derajat 34’"),
        ),
        (
            "normalizeMadurese",
            &["6º51’54’’-7º23’6’’"],
            Some("6 derajat 51’54’’ sampè' 7 derajat 23’6’’"),
        ),
        (
            "phonemize",
            &["940 M", "mad"],
            Some("saŋaʔ atɔs bɤn əmpaʔ pɔlɔ masɛhi"),
        ),
        (
            "phonemize",
            &["12 SM", "mad"],
            Some("sapɔlɔ bɤn duwɤ sabɨlunːa masɛhi"),
        ),
        ("normalizeMadurese", &["875 M."], Some("875 Masèhi.")),
        (
            "normalizeMadurese",
            &["Prof. Dr. M. Hatta"],
            Some("Prof. Dr. M. Hatta"),
        ),
        (
            "phonemize",
            &["70-90%", "mad"],
            Some("pətːɔʔ pɔlɔ sampɛʔ saŋaʔ pɔlɔ pəɾsən"),
        ),
        (
            "phonemize",
            &["27 - 36°C", "mad"],
            Some("duwɤ pɔlɔ bɤn pətːɔʔ sampɛʔ təlɔ pɔlɔ bɤn ənːəm dɨɾaɟɤt cəlcijus"),
        ),
        (
            "normalizeMadurese",
            &["(0,3-2,7%)"],
            Some("(0 koma 3 sampè' 2 koma 7 persen)"),
        ),
        (
            "normalizeMadurese",
            &["10/01/2007 – 18/03/08"],
            Some("10/01/2007 – 18/03/08"),
        ),
        (
            "normalizeMadurese",
            &["(1998/1999-2008/2009)"],
            Some("(1998/1999-2008/2009)"),
        ),
        ("normalizeMadurese", &["0-07-115221"], Some("0-07-115221")),
        (
            "normalizeMadurese",
            &["1953 -1955."],
            Some("1953 sampè' 1955."),
        ),
        ("normalizeMadurese", &["05-15."], Some("05 sampè' 15.")),
        ("normalizeMadurese", &["04-20."], Some("04 sampè' 20.")),
        ("normalizeMadurese", &["04-20,"], Some("04 sampè' 20,")),
        (
            "normalizeMadurese",
            &["1-1,7 mèter"],
            Some("1 sampè' 1 koma 7 mèter"),
        ),
        (
            "phonemize",
            &["±3.78%", "mad"],
            Some("kɔɾaŋ ləbːi təlɔ kɔma pətːɔʔ bɤluʔ pəɾsən"),
        ),
        (
            "normalizeMadurese",
            &["korang lebbi ±1.752,21 km²"],
            Some("korang lebbi 1752 koma 2 1 kilomèter persegi"),
        ),
        (
            "normalizeMadurese",
            &["ra-kèra ±335,28 km²"],
            Some("ra-kèra 335 koma 2 8 kilomèter persegi"),
        ),
        ("phonemize", &["30kg", "mad"], Some("təlɔ pɔlɔ kilɔɡɾɤm")),
        ("phonemize", &["40m", "mad"], Some("əmpaʔ pɔlɔ mɛtəɾ")),
        (
            "phonemize",
            &["15-60cm", "mad"],
            Some("sapɔlɔ bɤn lɛmaʔ sampɛʔ ənːəm pɔlɔ sɛntimɛtəɾ"),
        ),
        (
            "phonemize",
            &["84 orèng per km²", "mad"],
            Some("bɤluʔ pɔlɔ bɤn əmpaʔ ɔɾɛŋ pəɾ kilɔmɛtəɾ pəɾsəɡi"),
        ),
        (
            "phonemize",
            &["jiwa/km²", "mad"],
            Some("ɟiwa pəɾ kilɔmɛtəɾ pəɾsəɡi"),
        ),
        (
            "phonemize",
            &["2000–3000 mm/taon", "mad"],
            Some("duwɤ ɛbu sampɛʔ təlɔ ɛbu milimətəɾ pəɾ taɔn"),
        ),
        ("normalizeMadurese", &["bân/otabâ"], Some("bân/otabâ")),
        (
            "normalizeMadurese",
            &["daging/ajam/tempe"],
            Some("daging/ajam/tempe"),
        ),
        (
            "phonemize",
            &["US$550 juta", "mad"],
            Some("lɛmaʔ atɔs bɤn lɛmaʔ pɔlɔ ɟuta dulaɾ amɛɾika"),
        ),
        (
            "phonemize",
            &["Rp 729 jutah", "mad"],
            Some("pətːɔʔ atɔs bɤn duwɤ pɔlɔ bɤn saŋaʔ ɟutah ɾupijah"),
        ),
        (
            "phonemize",
            &["€1,3 triliun", "mad"],
            Some("sətːɔŋ kɔma təlɔ tɾilijun əuɾɔ"),
        ),
        (
            "phonemize",
            &["Woman & Violence", "mad"],
            Some("wɔman bɤn vijɔləncə"),
        ),
        (
            "phonemize",
            &["96x100cm", "mad"],
            Some("saŋaʔ pɔlɔ bɤn ənːəm kalɛ atɔs sɛntimɛtəɾ"),
        ),
        ("normalizeMadurese", &["-5"], Some("-5")),
        (
            "normalizeMadurese",
            &["Kode telepon: +31"],
            Some("Kode telepon: +31"),
        ),
        (
            "normalizeMadurese",
            &["\"dahana\" = apoy"],
            Some("\"dahana\" = apoy"),
        ),
        ("normalizeMadurese", &["PBB"], Some("PBB")),
        (
            "normalizeMadurese",
            &["277 m (909 ft)"],
            Some("277 mèter (909 ft)"),
        ),
        (
            "normalizeMadurese",
            &["sirkana 8 mèter dpl bit"],
            Some("sirkana 8 mèter è attas tasè' bit"),
        ),
        (
            "normalizeMadurese",
            &["eyantara 12 – 74 meter dpl."],
            Some("eyantara 12 sampè' 74 meter è attas tasè'."),
        ),
        (
            "normalizeMadurese",
            &["8 m dpl"],
            Some("8 mèter è attas tasè'"),
        ),
        (
            "normalizeMadurese",
            &["mèter è attas parmuka'an tasè' (dpl)"],
            Some("mèter è attas parmuka'an tasè' (dpl)"),
        ),
        (
            "phonemize",
            &["sirkana 8 mèter dpl", "mad"],
            Some("siɾkana bɤluʔ mɛtəɾ ɛ atːas tasɛʔ"),
        ),
        ("normalizeMadurese", &["8 mèter dplè"], Some("8 mèter dplè")),
        ("normalizeMadurese", &["8 mèter dpl2"], Some("8 mèter dpl2")),
        (
            "normalizeMadurese",
            &["40mèter dpl"],
            Some("40mèter è attas tasè'"),
        ),
        (
            "normalizeMadurese",
            &["8 kilomèter dpl"],
            Some("8 kilomèter dpl"),
        ),
        (
            "phonemize",
            &["abad ka-20", "mad"],
            Some("abɤt ka duwɤ pɔlɔ"),
        ),
        ("phonemize", &["ka -8", "mad"], Some("ka bɤluʔ")),
        (
            "phonemize",
            &["Olimpiade XXIX", "mad"],
            Some("ɔlimpijadɨ duwɤ pɔlɔ bɤn saŋaʔ"),
        ),
        (
            "normalizeMadurese",
            &["Madhurâ iyâ arèya polo sè bâḍâ è tèmor tasè' polo Jhâbâ."],
            Some("Madhurâ iyâ arèya polo sè bâḍâ è tèmor tasè' polo Jhâbâ."),
        ),
        ("normalizeMadurese", &["Taon 2008."], Some("Taon 2008.")),
        (
            "numberToWords",
            &["1508070"],
            Some("juta bân lèma' atos bân ballu' èbu bân petto' polo"),
        ),
        (
            "numberToWords",
            &["752425214"],
            Some(
                "petto' atos bân lèma' polo bân duwâ juta bân empa' atos bân duwâ polo bân lèma' èbu bân duwâ atos bân sapolo bân empa'",
            ),
        ),
        ("numberToWords", &["1000000000"], Some("miliar")),
        ("numberToWords", &["1000000000000"], Some("triliun")),
        ("numberToWords", &["1000000"], Some("juta")),
        (
            "phonemize",
            &["2.150.000 km²", "mad"],
            Some("duwɤ ɟuta bɤn atɔs bɤn lɛmaʔ pɔlɔ ɛbu kilɔmɛtəɾ pəɾsəɡi"),
        ),
        (
            "phonemize",
            &["1000000000000000", "mad"],
            Some(
                "sətːɔŋ nɔla nɔla nɔla nɔla nɔla nɔla nɔla nɔla nɔla nɔla nɔla nɔla nɔla nɔla nɔla",
            ),
        ),
        (
            "phonemize",
            &["1000000000000001", "mad"],
            Some(
                "sətːɔŋ nɔla nɔla nɔla nɔla nɔla nɔla nɔla nɔla nɔla nɔla nɔla nɔla nɔla nɔla sətːɔŋ",
            ),
        ),
        (
            "phonemize",
            &["999000000000000", "mad"],
            Some("saŋaʔ atɔs bɤn saŋaʔ pɔlɔ bɤn saŋaʔ tɾilijun"),
        ),
    ];

    #[test]
    fn the_ts_suite_calls_return_the_ts_values() {
        let call = |f: &str, a: &dyn Fn(usize) -> JsString| -> Option<JsString> {
            match f {
                "phonemizeWord" => Some(phonemize_word(&a(0))),
                "normalizeMadurese" => Some(normalize_madurese(&a(0))),
                "numberToWords" => Some(number_to_words(js_number(&a(0)), None)),
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

    /// Every `rewrite` is on the pipeline string: no probe or golden line poisons the mapping (the TS
    /// `tools/provenance-poison.mts mad` reports 0 sites as well).
    #[test]
    fn madurese_rewrites_never_poison_the_mapping() {
        use std::{cell::Cell, rc::Rc};
        let hits = Rc::new(Cell::new(0));
        let h = hits.clone();
        crate::core::provenance::on_poison(Some(Box::new(move |_, _| h.set(h.get() + 1))));
        let root = concat!(env!("CARGO_MANIFEST_DIR"), "/../..");
        let probes =
            std::fs::read_to_string(format!("{root}/rust/tools/fn-diff/probes/mad.txt")).unwrap();
        let golden = std::fs::read_to_string(format!("{root}/csharp/goldens/mad.tsv")).unwrap();
        let lines = probes
            .lines()
            .filter(|l| !l.is_empty() && !l.starts_with('#'))
            .chain(golden.lines().filter_map(|r| r.split('\t').next()));
        let mut n = 0;
        for l in lines {
            crate::phonemize_trace(l, "mad").unwrap();
            n += 1;
        }
        crate::core::provenance::on_poison(None);
        assert!(n > 200);
        assert_eq!(hits.get(), 0);
    }
}
