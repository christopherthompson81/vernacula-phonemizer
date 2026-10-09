//! Replay a TypeScript function dump (tools/fn-diff/dump.mts) through the Rust port and diff.
//!
//!   npx tsx rust/tools/fn-diff/dump.mts arpabet > .probe/rust/arpabet.jsonl
//!   cargo run --release -p fn-diff -- arpabet ../.probe/rust/arpabet.jsonl
use indexmap::IndexMap;
use serde_json::Value;
use vernacula_phonemizer::core::js_string::{JsString, js_number};
use vernacula_phonemizer::core::load_manifest::load_json;
use vernacula_phonemizer::core::load_tsv::load_lines;
use vernacula_phonemizer::core::load_tsv::{TsvOptions, load_tsv_map};
use vernacula_phonemizer::languages::english::english::create_english;
use vernacula_phonemizer::languages::english::english_arpabet::make_arpabet_to_ipa;
use vernacula_phonemizer::languages::english::english_g2p::{
    EnglishG2p, EnglishG2pModel, G2pClasses,
};
use vernacula_phonemizer::languages::english::manifest::{DIR, MANIFEST};
use vernacula_phonemizer::languages::english::normalize::{
    normalize_english, normalize_english_initialisms,
};
use vernacula_phonemizer::languages::english::numbers::{
    BigNat, number_to_words, ordinal_to_words,
};
use vernacula_phonemizer::languages::english::pos_tagger::{PosModel, PosTagger};
use vernacula_phonemizer::languages::english::spelling_variants::american_spelling;
use vernacula_phonemizer::languages::english_gb::english_gb::{SETS, rp_word_transform, to_rp};

fn units(v: &Value) -> JsString {
    JsString(
        v.as_array()
            .unwrap()
            .iter()
            .map(|u| u.as_u64().unwrap() as u16)
            .collect(),
    )
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
            if vernacula_phonemizer::core::js_math::log(x).to_bits() == want {
                port_ok += 1
            } else {
                port_bad += 1;
                if port_bad <= 5 {
                    println!("  port differs at x={x:e}");
                }
            }
            if x.ln().to_bits() != want {
                ln_bad += 1;
                if i >= 4_000_000 {
                    ngram_ln_bad += 1;
                }
            }
        }
        println!(
            "log: fdlibm port {port_ok} identical, {port_bad} DIFFER; f64::ln differs on {ln_bad} ({ngram_ln_bad} of them n-gram ratios)"
        );
        std::process::exit(if port_bad == 0 { 0 } else { 1 });
    }
    let run: Box<dyn Fn(&Value) -> JsString> = match name.as_str() {
        "arpabet" => {
            let syllabic =
                load_tsv_map(DIR, "en-syllabic.tsv", slots, TsvOptions::default()).unwrap();
            let nasal =
                load_tsv_map(DIR, "en-nasal-seam.tsv", slots, TsvOptions::default()).unwrap();
            let conv = make_arpabet_to_ipa(&MANIFEST.arpabet, syllabic, nasal);
            let bare = make_arpabet_to_ipa(&MANIFEST.arpabet, IndexMap::new(), IndexMap::new());
            Box::new(move |input| {
                let phones: Vec<String> = input["phones"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(|p| p.as_str().unwrap().to_string())
                    .collect();
                let word = units(&input["word"]);
                if input.get("bare").is_some() {
                    bare.convert(&phones, &word)
                } else {
                    conv.convert(&phones, &word)
                }
            })
        }
        "pos" => {
            let tagger = PosTagger::new(load_json::<PosModel>(DIR, "pos-model.json").unwrap());
            Box::new(move |input| {
                let words: Vec<JsString> = input["words"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(units)
                    .collect();
                JsString::from(tagger.tag(&words).join(" "))
            })
        }
        "spelling" => {
            let dict = load_tsv_map(
                DIR,
                "g2p-dict.tsv",
                |v, _| Some(v.clone()),
                TsvOptions::default(),
            )
            .unwrap();
            Box::new(move |input| {
                let known = |w: &JsString| dict.contains_key(w);
                american_spelling(&units(&input["word"]), &known)
                    .unwrap_or_else(|| JsString::from("\u{0}none"))
            })
        }
        "g2p" => {
            let syllabic =
                load_tsv_map(DIR, "en-syllabic.tsv", slots, TsvOptions::default()).unwrap();
            let nasal =
                load_tsv_map(DIR, "en-nasal-seam.tsv", slots, TsvOptions::default()).unwrap();
            let conv = make_arpabet_to_ipa(&MANIFEST.arpabet, syllabic, nasal);
            let dict = load_tsv_map(
                DIR,
                "g2p-dict.tsv",
                |v, _| {
                    Some(
                        v.split(&JsString::from(" "))
                            .iter()
                            .map(|p| p.to_string_lossy())
                            .collect::<Vec<String>>(),
                    )
                },
                TsvOptions::default(),
            )
            .unwrap();
            let common = load_lines(DIR, "g2p-common.txt", false)
                .unwrap()
                .into_iter()
                .collect();
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
            let g2p = EnglishG2p::new(
                load_json::<EnglishG2pModel>(DIR, "g2p-model.json").unwrap(),
                dict,
                common,
                conv,
                classes,
            )
            .unwrap();
            Box::new(move |input| g2p.g2p(&units(&input["word"])))
        }
        "english-pre" => {
            let e = create_english().unwrap();
            Box::new(move |input| e.text_full(&units(&input["normalized"]), None, None, true))
        }
        "english-gb-pre" => {
            let e = create_english().unwrap();
            Box::new(move |input| {
                e.text_full(
                    &units(&input["normalized"]),
                    Some(&rp_word_transform),
                    None,
                    true,
                )
            })
        }
        "torp" => Box::new(|input| {
            let (w, ipa) = (units(&input["word"]), units(&input["ipa"]));
            if input.get("bare").is_some() {
                to_rp(&ipa, &w, None)
            } else {
                to_rp(&ipa, &w, Some(&SETS))
            }
        }),
        "phonemize-sync" => Box::new(|input| {
            let text = units(&input["text"]).to_string_lossy();
            JsString::from(
                vernacula_phonemizer::phonemize(&text, input["lang"].as_str().unwrap()).unwrap(),
            )
        }),
        "phonemize-best" => Box::new(|input| {
            let text = units(&input["text"]).to_string_lossy();
            JsString::from(
                vernacula_phonemizer::phonemize_best(&text, input["lang"].as_str().unwrap())
                    .unwrap(),
            )
        }),
        "reader" => Box::new(|input| {
            let run = units(&input["run"]);
            match vernacula_phonemizer::core::scripts::reader_for(
                &run,
                input["host"].as_str().unwrap(),
            ) {
                None => JsString::from("\u{0}none"),
                Some((t, text)) => JsString::from(format!("{t}|")).concat(&text),
            }
        }),
        "latin" => Box::new(|input| {
            use vernacula_phonemizer::core::latin_phones::{PhoneOpts, latin_phone};
            let c = units(&input["c"]);
            let none = || JsString::from("\u{0}none");
            match input["op"].as_str().unwrap() {
                "phone" => latin_phone(&c, PhoneOpts::default()).unwrap_or_else(none),
                "phone-ih" => latin_phone(
                    &c,
                    PhoneOpts {
                        initial: true,
                        include_h: true,
                    },
                )
                .unwrap_or_else(none),
                _ => vernacula_phonemizer::core::host_word::fold_latin_to_base(&c),
            }
        }),
        "core-numbers" => {
            use vernacula_phonemizer::core::numbers::{
                NumbersDef, indic_number_words, render_number, spell_digits, western_number_words,
            };
            let def = |dir: &str| -> NumbersDef {
                let m: serde_json::Value =
                    vernacula_phonemizer::core::load_manifest::load_manifest(
                        &format!("languages/{dir}"),
                        &format!("{dir}.jsonc"),
                    )
                    .unwrap();
                serde_json::from_value(m["numbers"].clone()).unwrap()
            };
            let (hi, hy) = (def("hindi"), def("armenian"));
            Box::new(move |input| {
                let (d, compose): (
                    &NumbersDef,
                    vernacula_phonemizer::core::numbers::NumberComposer,
                ) = if input["kind"] == "indic" {
                    (&hi, indic_number_words)
                } else {
                    (&hy, western_number_words)
                };
                let id = |w: &str| w.to_string();
                JsString::from(match input.get("digits") {
                    Some(dg) => spell_digits(dg.as_str().unwrap(), d, &id),
                    None => render_number(input["n"].as_u64().unwrap(), d, &id, compose),
                })
            })
        }
        "symbols" => {
            use vernacula_phonemizer::core::normalize_symbols::{
                CountForm, SymbolData, SymbolNormalizer, make_symbol_normalizer,
            };
            let mut tiers: std::collections::HashMap<u64, SymbolNormalizer> = Default::default();
            for line in text.lines().filter(|l| l.starts_with("{\"def\"")) {
                let row: Value = serde_json::from_str(line).unwrap();
                let mut data: SymbolData = serde_json::from_value(row["data"].clone()).unwrap();
                let sig = row["countForm"].as_str().unwrap();
                data.count_form = Some(count_form(sig).unwrap_or_else(|| {
                    panic!("{}: no Rust twin for countForm {sig}", row["dir"])
                }) as CountForm);
                tiers.insert(row["def"].as_u64().unwrap(), make_symbol_normalizer(&data).unwrap());
            }
            Box::new(move |input| tiers[&input["def"].as_u64().unwrap()].apply(&units(&input["text"])))
        }
        "numbers" => Box::new(|input| {
            let n = BigNat::parse(input["n"].as_str().unwrap()).unwrap();
            let words = if input["ordinal"].as_bool().unwrap() {
                ordinal_to_words(&n)
            } else {
                number_to_words(&n)
            };
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
                    (fields.len() >= 2)
                        .then_some(())
                        .and(ipa.filter(|i| !i.is_empty()))
                },
                TsvOptions::default(),
            )
            .unwrap();
            Box::new(move |input| {
                let is_recorded = |w: &JsString| lexicon.contains_key(w);
                normalize_english_initialisms(
                    &normalize_english(&units(&input["text"])),
                    &is_recorded,
                )
            })
        }
        "ja-normalize" => Box::new(|input| {
            vernacula_phonemizer::languages::japanese::normalize::normalize_japanese(&units(&input["text"]))
        }),
        "ja-kana" => Box::new(|input| {
            use vernacula_phonemizer::languages::japanese::kana::{kana_to_morae, segments_to_morae};
            let m = if input["op"] == "morae" {
                kana_to_morae(&units(&input["word"]))
            } else {
                let segs: Vec<JsString> = input["segs"].as_array().unwrap().iter().map(units).collect();
                segments_to_morae(&segs)
            };
            m.map_or_else(|| JsString::from("\u{0}none"), |m| JsString::join(&m, &JsString::from("|")))
        }),
        "ja-kanji" => Box::new(|input| {
            use vernacula_phonemizer::languages::japanese::kanji::{apply_reading_segments, heads_compound};
            let w = units(&input["word"]);
            if input["op"] == "segments" {
                JsString::join(&apply_reading_segments(&w), &JsString::from("|"))
            } else {
                JsString::from(heads_compound(&w).to_string())
            }
        }),
        "ja-segment" => Box::new(|input| {
            use vernacula_phonemizer::languages::japanese::{kanji::segment_text, normalize::normalize_japanese};
            let t = units(&input["text"]);
            if input["op"] == "raw" { segment_text(&t) } else { segment_text(&normalize_japanese(&t)) }
        }),
        "ja-counters" => Box::new(|input| {
            let n = js_number(&JsString::from(input["n"].as_str().unwrap()));
            vernacula_phonemizer::languages::japanese::counters::read_counter(n, &units(&input["ctr"]))
                .unwrap_or_else(|| JsString::from("\u{0}none"))
        }),
        "ja-numbers" => Box::new(|input| {
            let raw = JsString::from(input["raw"].as_str().unwrap());
            vernacula_phonemizer::languages::japanese::numbers::number_to_kana(js_number(&raw), Some(&raw))
        }),
        "ja-pitch" => Box::new(|input| {
            use vernacula_phonemizer::languages::japanese::{japanese::phonemize_word, pitch::accent_nucleus};
            let s = units(&input["surface"]);
            if input["op"] == "nucleus" {
                let n = accent_nucleus(&s, &units(&input["reading"]));
                JsString::from(if n == 0.0 { "0".to_string() } else { format!("{}", n) })
            } else {
                phonemize_word(&s).unwrap()
            }
        }),
        "trace" => Box::new(|input| {
            let text = units(&input["text"]).to_string_lossy();
            let t = vernacula_phonemizer::phonemize_trace(&text, input["lang"].as_str().unwrap()).unwrap().trace;
            let u = |s: &JsString| serde_json::json!(s.0);
            let span = |s: Option<(usize, usize)>| s.map_or(Value::Null, |(a, b)| serde_json::json!([a, b]));
            let tokens: Vec<Value> = t
                .tokens
                .iter()
                .map(|k| {
                    serde_json::json!([
                        [k.span.0, k.span.1],
                        span(k.input_span),
                        span(k.ipa_span),
                        u(&k.surface),
                        k.source.map_or(Value::Null, |s| Value::from(s.as_str())),
                    ])
                })
                .collect();
            let out = serde_json::json!({ "traced": t.traced, "normalized": u(&t.normalized), "tokens": tokens });
            JsString::from(serde_json::to_string(&out).unwrap())
        }),
        _ => panic!("unknown function {name}"),
    };
    let (mut same, mut differ) = (0, 0);
    // Per `input.src` (when the dump tags one): [identical, differ].
    let mut by_src: IndexMap<String, [usize; 2]> = IndexMap::new();
    for line in text.lines() {
        let row: Value = serde_json::from_str(line).unwrap();
        if row.get("def").is_some() {
            continue; // a `symbols` definition row, read by its arm
        }
        let want = units(&row["output"]);
        let got = run(&row["input"]);
        let tally = row["input"]["src"]
            .as_str()
            .map(|s| by_src.entry(s.to_string()).or_default());
        if got == want {
            same += 1;
            if let Some(t) = tally {
                t[0] += 1
            }
        } else {
            differ += 1;
            if let Some(t) = tally {
                t[1] += 1
            }
            if differ <= std::env::var("FN_DIFF_SHOW").ok().and_then(|v| v.parse().ok()).unwrap_or(15) {
                let shown = match row["input"].get("text") {
                    Some(t) => format!("{:?}", units(t)),
                    None => row["input"].to_string(),
                };
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

/// The `symbols` dump's countForm signatures: `default`, `slavic`, or a language's own (esbuild-minified)
/// arrow source, each with its Rust twin in JS number semantics (`%` is fmod in both).
fn count_form(sig: &str) -> Option<std::sync::Arc<dyn Fn(f64) -> f64 + Send + Sync>> {
    use vernacula_phonemizer::core::normalize_symbols::{default_count_form, slavic_count_form};
    let is_int = |n: f64| n.is_finite() && n.trunc() == n;
    let b = |c: bool, t: f64, f: f64| if c { t } else { f };
    Some(match sig {
        "default" | "n=>n===1?0:1" => std::sync::Arc::new(default_count_form),
        "slavic" => std::sync::Arc::new(slavic_count_form),
        "()=>0" => std::sync::Arc::new(|_| 0.0),
        "n=>Number.isInteger(n)?slavicCountForm(n):3" => {
            std::sync::Arc::new(move |n| if is_int(n) { slavic_count_form(n) } else { 3.0 })
        }
        "n=>n%10===1&&n%100!==11?0:1" => std::sync::Arc::new(move |n: f64| b(n % 10.0 == 1.0 && n % 100.0 != 11.0, 0.0, 1.0)),
        "n=>{const m=Math.abs(n)%100;return m%10===1&&m!==11?0:1}" => std::sync::Arc::new(move |n: f64| {
            let m = n.abs() % 100.0;
            b(m % 10.0 == 1.0 && m != 11.0, 0.0, 1.0)
        }),
        "n=>n===1||n>=11&&n%1===0?0:1" => {
            std::sync::Arc::new(move |n: f64| b(n == 1.0 || (n >= 11.0 && n % 1.0 == 0.0), 0.0, 1.0))
        }
        "n=>n===1?0:n===2||n===3||n===4?1:2" => {
            std::sync::Arc::new(move |n: f64| if n == 1.0 { 0.0 } else { b(n == 2.0 || n == 3.0 || n == 4.0, 1.0, 2.0) })
        }
        "n=>!Number.isInteger(n)?4:n===1?0:n===2?1:n>=3&&n<=4?2:3" => std::sync::Arc::new(move |n: f64| {
            if !is_int(n) { 4.0 } else if n == 1.0 { 0.0 } else if n == 2.0 { 1.0 } else { b(n >= 3.0 && n <= 4.0, 2.0, 3.0) }
        }),
        "n=>{if(n===1)return 0;const m100=Math.abs(n)%100;if(m100>=12&&m100<=14)return 2;const m10=m100%10;return m10>=2&&m10<=4?1:2}" => {
            std::sync::Arc::new(move |n: f64| czech_polish(n, false))
        }
        "n=>{if(n===1)return 0;if(!Number.isInteger(n))return 3;const m100=Math.abs(n)%100;if(m100>=12&&m100<=14)return 2;const m10=m100%10;return m10>=2&&m10<=4?1:2}" => {
            std::sync::Arc::new(move |n: f64| czech_polish(n, true))
        }
        _ => return None,
    })
}

fn czech_polish(n: f64, fraction_is_3: bool) -> f64 {
    if n == 1.0 {
        return 0.0;
    }
    if fraction_is_3 && !(n.is_finite() && n.trunc() == n) {
        return 3.0;
    }
    let m100 = n.abs() % 100.0;
    if (12.0..=14.0).contains(&m100) {
        return 2.0;
    }
    let m10 = m100 % 10.0;
    if (2.0..=4.0).contains(&m10) { 1.0 } else { 2.0 }
}
