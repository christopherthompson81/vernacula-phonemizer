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
        "numbers" => Box::new(|input| {
            let n = BigNat::parse(input["n"].as_str().unwrap()).unwrap();
            let words = if input["ordinal"].as_bool().unwrap() { ordinal_to_words(&n) } else { number_to_words(&n) };
            JsString::from(words.join(" "))
        }),
        _ => panic!("unknown function {name}"),
    };
    let (mut same, mut differ) = (0, 0);
    for line in text.lines() {
        let row: Value = serde_json::from_str(line).unwrap();
        let want = units(&row["output"]);
        let got = run(&row["input"]);
        if got == want {
            same += 1;
        } else {
            differ += 1;
            if differ <= 15 {
                println!("  {}\n    ts   {want}\n    rust {got}", row["input"]);
            }
        }
    }
    println!("{name}: {same} identical, {differ} DIFFER");
    std::process::exit(if differ == 0 { 0 } else { 1 });
}
