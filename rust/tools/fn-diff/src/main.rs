//! Replay a TypeScript function dump (tools/fn-diff/dump.mts) through the Rust port and diff.
//!
//!   npx tsx rust/tools/fn-diff/dump.mts arpabet > .probe/rust/arpabet.jsonl
//!   cargo run --release -p fn-diff -- arpabet ../.probe/rust/arpabet.jsonl
use indexmap::IndexMap;
use serde_json::Value;
use vernacula_phonemizer::core::js_string::{JsString, js_number};
use vernacula_phonemizer::core::load_tsv::{TsvOptions, load_tsv_map};
use vernacula_phonemizer::languages::english::english_arpabet::make_arpabet_to_ipa;
use vernacula_phonemizer::core::load_manifest::load_json;
use vernacula_phonemizer::languages::english::manifest::{DIR, MANIFEST};
use vernacula_phonemizer::languages::english::english::create_english;
use vernacula_phonemizer::languages::english_gb::english_gb::{SETS, rp_word_transform, to_rp};
use vernacula_phonemizer::languages::english::english_g2p::{EnglishG2p, EnglishG2pModel, G2pClasses};
use vernacula_phonemizer::core::load_tsv::load_lines;
use vernacula_phonemizer::languages::english::normalize::{normalize_english, normalize_english_initialisms};
use vernacula_phonemizer::languages::english::numbers::{BigNat, number_to_words, ordinal_to_words};
use vernacula_phonemizer::languages::english::pos_tagger::{PosModel, PosTagger};
use vernacula_phonemizer::languages::english::spelling_variants::american_spelling;

fn units(v: &Value) -> JsString {
    JsString(v.as_array().unwrap().iter().map(|u| u.as_u64().unwrap() as u16).collect())
}

fn slots(v: &JsString, _: &JsString) -> Option<Vec<usize>> {
    Some(
        v.split(&JsString::from(","))
            .iter()
            .map(js_number)
            .filter(|n| n.fract() == 0.0 && n.is_finite())
            .map(|n| n as usize)
            .collect(),
    )
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let (name, path) = (args.get(1).expect("name"), args.get(2).expect("jsonl"));
    let text = std::fs::read_to_string(path).expect("dump");
    if name == "log" {
        // Lines of `<x bits hex> <Math.log(x) bits hex>`; compare the fdlibm port and f64::ln.
        let (mut port_ok, mut port_bad, mut ln_bad, mut ngram_ln_bad) = (0, 0, 0, 0);
        for (i, line) in text.lines().enumerate() {
            let mut it = line.split(' ');
            let x = f64::from_bits(u64::from_str_radix(it.next().unwrap(), 16).unwrap());
            let want = u64::from_str_radix(it.next().unwrap(), 16).unwrap();
            if vernacula_phonemizer::core::js_math::log(x).to_bits() == want { port_ok += 1 } else {
                port_bad += 1;
                if port_bad <= 5 { println!("  port differs at x={x:e}"); }
            }
            if x.ln().to_bits() != want {
                ln_bad += 1;
                if i >= 4_000_000 { ngram_ln_bad += 1; }
            }
        }
        println!("log: fdlibm port {port_ok} identical, {port_bad} DIFFER; f64::ln differs on {ln_bad} ({ngram_ln_bad} of them n-gram ratios)");
        std::process::exit(if port_bad == 0 { 0 } else { 1 });
    }
    let run: Box<dyn Fn(&Value) -> JsString> = match name.as_str() {
        "arpabet" => {
            let syllabic = load_tsv_map(DIR, "en-syllabic.tsv", slots, TsvOptions::default()).unwrap();
            let nasal = load_tsv_map(DIR, "en-nasal-seam.tsv", slots, TsvOptions::default()).unwrap();
            let conv = make_arpabet_to_ipa(&MANIFEST.arpabet, syllabic, nasal);
            let bare = make_arpabet_to_ipa(&MANIFEST.arpabet, IndexMap::new(), IndexMap::new());
            Box::new(move |input| {
                let phones: Vec<String> =
                    input["phones"].as_array().unwrap().iter().map(|p| p.as_str().unwrap().to_string()).collect();
                let word = units(&input["word"]);
                if input.get("bare").is_some() { bare.convert(&phones, &word) } else { conv.convert(&phones, &word) }
            })
        }
        "pos" => {
            let tagger = PosTagger::new(load_json::<PosModel>(DIR, "pos-model.json").unwrap());
            Box::new(move |input| {
                let words: Vec<JsString> = input["words"].as_array().unwrap().iter().map(units).collect();
                JsString::from(tagger.tag(&words).join(" "))
            })
        }
        "spelling" => {
            let dict = load_tsv_map(DIR, "g2p-dict.tsv", |v, _| Some(v.clone()), TsvOptions::default()).unwrap();
            Box::new(move |input| {
                let known = |w: &JsString| dict.contains_key(w);
                american_spelling(&units(&input["word"]), &known).unwrap_or_else(|| JsString::from("\u{0}none"))
            })
        }
        "g2p" => {
            let syllabic = load_tsv_map(DIR, "en-syllabic.tsv", slots, TsvOptions::default()).unwrap();
            let nasal = load_tsv_map(DIR, "en-nasal-seam.tsv", slots, TsvOptions::default()).unwrap();
            let conv = make_arpabet_to_ipa(&MANIFEST.arpabet, syllabic, nasal);
            let dict = load_tsv_map(
                DIR,
                "g2p-dict.tsv",
                |v, _| Some(v.split(&JsString::from(" ")).iter().map(|p| p.to_string_lossy()).collect::<Vec<String>>()),
                TsvOptions::default(),
            )
            .unwrap();
            let common = load_lines(DIR, "g2p-common.txt", false).unwrap().into_iter().collect();
            let m = &*MANIFEST;
            let classes = G2pClasses {
                vowel_letters: m.g2p_classes.vowel_letters.clone(),
                vowels: m.arpabet.vowels.clone(),
                voiceless: m.g2p_classes.voiceless.clone(),
                sibilants: m.g2p_classes.sibilants.clone(),
                stop_pieces: m.g2p_classes.stop_pieces.clone(),
                stem_stress_prefixes: m.g2p_classes.stem_stress_prefixes.clone(),
                letter_name_exceptions: m.letter_name_exceptions.clone(),
            };
            let g2p = EnglishG2p::new(load_json::<EnglishG2pModel>(DIR, "g2p-model.json").unwrap(), dict, common, conv, classes);
            Box::new(move |input| g2p.g2p(&units(&input["word"])))
        }
        "english-pre" => {
            let e = create_english();
            Box::new(move |input| e.text_full(&units(&input["normalized"]), None, None, true))
        }
        "english-gb-pre" => {
            let e = create_english();
            Box::new(move |input| e.text_full(&units(&input["normalized"]), Some(&rp_word_transform), None, true))
        }
        "torp" => Box::new(|input| {
            let (w, ipa) = (units(&input["word"]), units(&input["ipa"]));
            if input.get("bare").is_some() { to_rp(&ipa, &w, None) } else { to_rp(&ipa, &w, Some(&SETS)) }
        }),
        "phonemize-sync" => Box::new(|input| {
            let text = units(&input["text"]).to_string_lossy();
            JsString::from(vernacula_phonemizer::phonemize(&text, input["lang"].as_str().unwrap()).unwrap())
        }),
        "phonemize-best" => Box::new(|input| {
            let text = units(&input["text"]).to_string_lossy();
            JsString::from(vernacula_phonemizer::phonemize_best(&text, input["lang"].as_str().unwrap()).unwrap())
        }),
        "numbers" => Box::new(|input| {
            let n = BigNat::parse(input["n"].as_str().unwrap()).unwrap();
            let words = if input["ordinal"].as_bool().unwrap() { ordinal_to_words(&n) } else { number_to_words(&n) };
            JsString::from(words.join(" "))
        }),
        "normalize" => Box::new(|input| normalize_english(&units(&input["text"]))),
        "initialisms" => {
            let lexicon = load_tsv_map(
                DIR,
                "accent-lexicon.tsv",
                |rest, _| {
                    let fields = rest.split(&JsString::from("\t"));
                    let ipa = fields.get(1).map(|f| f.trim());
                    (fields.len() >= 2).then_some(()).and(ipa.filter(|i| !i.is_empty()))
                },
                TsvOptions::default(),
            )
            .unwrap();
            Box::new(move |input| {
                let is_recorded = |w: &JsString| lexicon.contains_key(w);
                normalize_english_initialisms(&normalize_english(&units(&input["text"])), &is_recorded)
            })
        }
        _ => panic!("unknown function {name}"),
    };
    let (mut same, mut differ) = (0, 0);
    // Per `input.src` (when the dump tags one): [identical, differ].
    let mut by_src: IndexMap<String, [usize; 2]> = IndexMap::new();
    for line in text.lines() {
        let row: Value = serde_json::from_str(line).unwrap();
        let want = units(&row["output"]);
        let got = run(&row["input"]);
        let tally = row["input"]["src"].as_str().map(|s| by_src.entry(s.to_string()).or_default());
        if got == want {
            same += 1;
            if let Some(t) = tally { t[0] += 1 }
        } else {
            differ += 1;
            if let Some(t) = tally { t[1] += 1 }
            if differ <= 15 {
                let shown = match row["input"].get("text") { Some(t) => format!("{:?}", units(t)), None => row["input"].to_string() };
                println!("  {shown}\n    ts   {want}\n    rust {got}");
            }
        }
    }
    for (src, [s, d]) in &by_src {
        println!("  {src}: {s} identical, {d} DIFFER");
    }
    println!("{name}: {same} identical, {differ} DIFFER");
    std::process::exit(if differ == 0 { 0 } else { 1 });
}
