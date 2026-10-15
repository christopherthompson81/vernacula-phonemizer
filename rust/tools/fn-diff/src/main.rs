//! Replay a TypeScript function dump (tools/fn-diff/dump.mts) through the Rust port and diff.
//!
//!   npx tsx rust/tools/fn-diff/dump.mts arpabet > .probe/rust/arpabet.jsonl
//!   cargo run --release -p fn-diff -- arpabet ../.probe/rust/arpabet.jsonl
use indexmap::IndexMap;
use serde_json::Value;
use vernacula_phonemizer::core::js_string::{JsString, js_number, js_number_to_string};
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

/// dump.mts's `traceJson`: traced, normalized, and per token [span, inputSpan|null, ipaSpan|null, surface
/// units, source|null]. JsString level, through the guarded `phonemize_trace_js`.
fn trace_json(text: &JsString, lang: &str) -> JsString {
    let t = vernacula_phonemizer::phonemize_trace_js(text, lang)
        .unwrap()
        .1;
    let u = |s: &JsString| serde_json::json!(s.0);
    let span =
        |s: Option<(usize, usize)>| s.map_or(Value::Null, |(a, b)| serde_json::json!([a, b]));
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
    let out =
        serde_json::json!({ "traced": t.traced, "normalized": u(&t.normalized), "tokens": tokens });
    JsString::from(serde_json::to_string(&out).unwrap())
}

/// dump.mts's `thaiScanJson`: thaiPrep and the syllable scan, serialized.
fn thai_scan_string(
    prep: &vernacula_phonemizer::languages::thai::syllabifier::ThaiPrep,
    scans: &[vernacula_phonemizer::languages::thai::syllabifier::ThaiSyllableScan],
) -> String {
    use vernacula_phonemizer::languages::thai::syllabifier::{ThaiUnit, from_cps};
    use vernacula_phonemizer::languages::thai::thai_tone::ThaiTone;
    let cp = |c: u32| from_cps(&[c]).to_string_lossy();
    let unit = |u: &ThaiUnit| match u {
        ThaiUnit::C { g, ph } => format!("C:{}:{ph}", cp(*g)),
        ThaiUnit::V { gs, glide } => {
            format!(
                "V:{}:{}",
                from_cps(gs).to_string_lossy(),
                glide.unwrap_or("")
            )
        }
    };
    let tone = |t: ThaiTone| match t {
        ThaiTone::Mid => "mid",
        ThaiTone::Low => "low",
        ThaiTone::Falling => "falling",
        ThaiTone::High => "high",
        ThaiTone::Rising => "rising",
    };
    let mut fates: Vec<_> = prep.fates.iter().collect();
    fates.sort();
    [
        prep.units.iter().map(unit).collect::<Vec<_>>().join(","),
        fates
            .iter()
            .map(|(k, v)| format!("{k}={v}"))
            .collect::<Vec<_>>()
            .join(","),
        prep.unit_mark
            .iter()
            .map(|m| m.map_or("_".to_string(), cp))
            .collect::<Vec<_>>()
            .join(","),
        prep.short_mark
            .iter()
            .map(|&b| if b { "1" } else { "0" })
            .collect(),
        scans
            .iter()
            .map(|s| {
                format!(
                    "{}|{}|{}|{}|{}|{}|{}",
                    s.nucleus,
                    s.tone.map_or("_", tone),
                    from_cps(&s.onset_cs).to_string_lossy(),
                    unit(&s.nuc_unit),
                    s.coda_g.map(cp).unwrap_or_default(),
                    if s.long { 1 } else { 0 },
                    s.fate.map_or("_".to_string(), |f| f.to_string()),
                )
            })
            .collect::<Vec<_>>()
            .join(";"),
    ]
    .join("\u{2}")
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let (name, path) = (args.get(1).expect("name"), args.get(2).expect("jsonl"));
    let text = std::fs::read_to_string(path).expect("dump");
    if name == "numstr" {
        // Lines of `<x bits hex> <String(x)>`: core::js_string::js_number_to_string against V8.
        let (mut ok, mut bad) = (0, 0);
        for line in text.lines() {
            let (bits, want) = line.split_once(' ').unwrap();
            let x = f64::from_bits(u64::from_str_radix(bits, 16).unwrap());
            let got = vernacula_phonemizer::core::js_string::js_number_to_string(x);
            if got == want {
                ok += 1
            } else {
                bad += 1;
                if bad <= 10 {
                    println!("  {x:e}: js {want} rust {got}");
                }
            }
        }
        println!("numstr: {ok} identical, {bad} DIFFER");
        std::process::exit(if bad == 0 { 0 } else { 1 });
    }
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
        "enin" => {
            use vernacula_phonemizer::languages::english_in::english_in as i;
            let en = vernacula_phonemizer::registry::english().unwrap();
            Box::new(move |input| {
                let ipa = units(&input["ipa"]);
                match input["op"].as_str().unwrap() {
                    "transform" => i::indian_word_transform(&ipa, &units(&input["word"])),
                    "indian" => i::to_indian(&ipa),
                    _ => i::phonemize_word(&en, &ipa),
                }
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
                let cf: CountForm = count_form(sig)
                    .unwrap_or_else(|| panic!("{}: no Rust twin for countForm {sig}", row["dir"]));
                // The twin must reproduce the TS selector on the dump's probe vector, or it is stale.
                for pair in row["countProbe"].as_array().unwrap() {
                    let (n, want) = (pair[0].as_str().unwrap(), pair[1].as_str().unwrap());
                    let got = vernacula_phonemizer::core::js_string::js_number_to_string(cf(
                        js_number(&JsString::from(n)),
                    ));
                    assert_eq!(
                        got, want,
                        "countForm {sig}({n}): the Rust twin no longer matches the TS"
                    );
                }
                data.count_form = Some(cf);
                tiers.insert(
                    row["def"].as_u64().unwrap(),
                    make_symbol_normalizer(&data).unwrap(),
                );
            }
            Box::new(move |input| {
                tiers[&input["def"].as_u64().unwrap()].apply(&units(&input["text"]))
            })
        }
        "es-normalize" => {
            let es =
                vernacula_phonemizer::languages::spanish::spanish::create_spanish(false).unwrap();
            Box::new(move |input| {
                let t = units(&input["text"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => es.normalize(&t, false),
                    "americas" => es.normalize(&t, true),
                    _ => es.normalize_initialisms(&es.normalize(&t, false)),
                }
            })
        }
        "es-g2p" => {
            let es =
                vernacula_phonemizer::languages::spanish::spanish::create_spanish(false).unwrap();
            Box::new(move |input| {
                let w = units(&input["word"]);
                if input["op"] == "word" {
                    return es.phonemize_word(&w);
                }
                let segs: Vec<JsString> = es
                    .segments(&w)
                    .iter()
                    .map(|s| {
                        s.ph.concat(&JsString::from(format!(
                            "/{}{}",
                            s.nucleus as u8, s.accent as u8
                        )))
                    })
                    .collect();
                JsString::join(&segs, &JsString::from(" "))
            })
        }
        "es419-word" => {
            use vernacula_phonemizer::languages::spanish_419::spanish_419 as e;
            e::create_spanish_419().unwrap();
            Box::new(|input| {
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "word" => e::phonemize_word(&w),
                    _ => e::to_latin_american(&w),
                }
            })
        }
        "frca-word" => {
            use vernacula_phonemizer::languages::french_ca::french_ca as q;
            let e = q::create_french_ca().unwrap();
            Box::new(move |input| {
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "quebec" => q::to_quebecois(&w),
                    _ => e.phonemize_word(&w),
                }
            })
        }
        "es-numbers" => {
            let es =
                vernacula_phonemizer::languages::spanish::spanish::create_spanish(false).unwrap();
            Box::new(move |input| {
                let n = js_number(&JsString::from(input["n"].as_str().unwrap()));
                let raw = input["raw"].as_str().map(JsString::from);
                if input["op"] == "ordinal" {
                    return es.ordinal(n).unwrap_or_else(|| JsString::from("\u{0}none"));
                }
                es.number_to_words(n, raw.as_ref())
            })
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
            vernacula_phonemizer::languages::japanese::normalize::normalize_japanese(&units(
                &input["text"],
            ))
        }),
        "ja-kana" => Box::new(|input| {
            use vernacula_phonemizer::languages::japanese::kana::{
                kana_to_morae, segments_to_morae,
            };
            let m = if input["op"] == "morae" {
                kana_to_morae(&units(&input["word"]))
            } else {
                let segs: Vec<JsString> = input["segs"]
                    .as_array()
                    .unwrap()
                    .iter()
                    .map(units)
                    .collect();
                segments_to_morae(&segs)
            };
            m.map_or_else(
                || JsString::from("\u{0}none"),
                |m| JsString::join(&m, &JsString::from("|")),
            )
        }),
        "ja-kanji" => Box::new(|input| {
            use vernacula_phonemizer::languages::japanese::kanji::{
                apply_reading_segments, heads_compound,
            };
            let w = units(&input["word"]);
            if input["op"] == "segments" {
                JsString::join(&apply_reading_segments(&w), &JsString::from("|"))
            } else {
                JsString::from(heads_compound(&w).to_string())
            }
        }),
        "ja-segment" => Box::new(|input| {
            use vernacula_phonemizer::languages::japanese::{
                kanji::segment_text, normalize::normalize_japanese,
            };
            let t = units(&input["text"]);
            if input["op"] == "raw" {
                segment_text(&t)
            } else {
                segment_text(&normalize_japanese(&t))
            }
        }),
        "ja-counters" => Box::new(|input| {
            let n = js_number(&JsString::from(input["n"].as_str().unwrap()));
            vernacula_phonemizer::languages::japanese::counters::read_counter(
                n,
                &units(&input["ctr"]),
            )
            .unwrap_or_else(|| JsString::from("\u{0}none"))
        }),
        "ja-numbers" => Box::new(|input| {
            let raw = JsString::from(input["raw"].as_str().unwrap());
            vernacula_phonemizer::languages::japanese::numbers::number_to_kana(
                js_number(&raw),
                Some(&raw),
            )
        }),
        "ja-pitch" => Box::new(|input| {
            use vernacula_phonemizer::languages::japanese::{
                japanese::phonemize_word, pitch::accent_nucleus,
            };
            let s = units(&input["surface"]);
            if input["op"] == "nucleus" {
                let n = accent_nucleus(&s, &units(&input["reading"]));
                JsString::from(if n == 0.0 {
                    "0".to_string()
                } else {
                    format!("{}", n)
                })
            } else {
                phonemize_word(&s).unwrap()
            }
        }),
        "trace" => {
            Box::new(|input| trace_json(&units(&input["text"]), input["lang"].as_str().unwrap()))
        }
        // ── Korean (ko) ──
        "ko-normalize" => Box::new(|input| {
            vernacula_phonemizer::languages::korean::normalize::normalize_korean(&units(
                &input["text"],
            ))
        }),
        "ko-g2p" => {
            vernacula_phonemizer::languages::korean::g2p::try_tens_lexicon().unwrap();
            Box::new(|input| {
                vernacula_phonemizer::languages::korean::g2p::phonemize_word(&units(&input["word"]))
            })
        }
        "ko-numbers" => Box::new(|input| {
            use vernacula_phonemizer::languages::korean::numbers as n;
            match input["op"].as_str().unwrap() {
                "int" => {
                    n::number_to_words(js_number(&JsString::from(input["n"].as_str().unwrap())))
                }
                _ => n::spell_digits(&units(&input["digits"])),
            }
        }),
        "ko-extras" => Box::new(|input| {
            let (text, lang) = (units(&input["text"]), input["lang"].as_str().unwrap());
            match input["op"].as_str().unwrap() {
                "trace" => trace_json(&text, lang),
                _ => vernacula_phonemizer::registry::phonemize_in(lang, &text).unwrap(),
            }
        }),
        // ── Mandarin (cmn) ──
        "cmn-normalize" => Box::new(|input| {
            use vernacula_phonemizer::languages::mandarin::normalize::{
                normalize_mandarin, spell_initialisms,
            };
            let t = units(&input["text"]);
            match input["op"].as_str().unwrap() {
                "normalize" => normalize_mandarin(&t),
                "initialisms" => spell_initialisms(&t),
                _ => spell_initialisms(&normalize_mandarin(&t)),
            }
        }),
        "cmn-segment" => {
            use vernacula_phonemizer::languages::mandarin::yi_bu_sandhi::apply_yi_bu_sandhi;
            use vernacula_phonemizer::languages::mandarin::{
                mandarin::load_pinyin_tables, segment::segment,
            };
            let t = load_pinyin_tables().unwrap();
            Box::new(move |input| {
                let cps = units(&input["text"]).code_point_strings();
                let exempt: Vec<bool> = if input["masked"].as_bool().unwrap() {
                    (0..cps.len()).map(|i| i % 3 == 0).collect()
                } else {
                    Vec::new()
                };
                let mut toks = segment(&cps, &t, &exempt);
                if input["sandhi"].as_bool().unwrap() {
                    apply_yi_bu_sandhi(&mut toks);
                }
                let parts: Vec<JsString> = toks
                    .iter()
                    .map(|k| {
                        k.py.concat(&JsString::from("\u{1}"))
                            .concat(&k.src.clone().unwrap_or_else(|| JsString::from("\u{0}")))
                    })
                    .collect();
                JsString::join(&parts, &JsString::from("\u{2}"))
            })
        }
        "cmn-pinyin" => {
            let conv =
                vernacula_phonemizer::languages::mandarin::mandarin::create_pinyin_phonemizer()
                    .unwrap();
            Box::new(move |input| conv.convert(&units(&input["text"])))
        }
        "cmn-numbers" => Box::new(|input| {
            use vernacula_phonemizer::languages::mandarin::numbers::{
                digits_to_chinese, integer_to_chinese,
            };
            match input["op"].as_str().unwrap() {
                "int" => integer_to_chinese(input["n"].as_f64().unwrap()),
                _ => digits_to_chinese(&units(&input["digits"])),
            }
        }),
        // The lone-surrogate texts: the `trace` serializer, and the reading, both at the JsString level.
        "cmn-trace-extras" => Box::new(|input| {
            let (text, lang) = (units(&input["text"]), input["lang"].as_str().unwrap());
            match input["op"].as_str().unwrap() {
                "trace" => trace_json(&text, lang),
                _ => vernacula_phonemizer::registry::phonemize_in(lang, &text).unwrap(),
            }
        }),
        "el-normalize" => Box::new(|input| {
            vernacula_phonemizer::languages::greek::normalize::normalize_greek(&units(
                &input["text"],
            ))
            .unwrap()
        }),
        "el-g2p" => Box::new(|input| {
            use vernacula_phonemizer::languages::greek::{greek as g, numbers as n};
            match input["op"].as_str().unwrap() {
                "word" => g::phonemize_word(&units(&input["word"])).unwrap(),
                "rules" => g::phonemize_word_rules(&units(&input["word"])).unwrap(),
                "forced" => g::phonemize_word_forced(&units(&input["word"])).unwrap(),
                _ => {
                    let raw = input.get("raw").map(units);
                    n::number_to_words(input["n"].as_f64().unwrap(), raw.as_ref()).unwrap()
                }
            }
        }),
        "it-normalize" => Box::new(|input| {
            use vernacula_phonemizer::languages::italian::normalize as n;
            let t = units(&input["text"]);
            match input["op"].as_str().unwrap() {
                "normalize" => n::normalize_italian(&t).unwrap(),
                "initialisms" => {
                    n::normalize_italian_initialisms(&n::normalize_italian(&t).unwrap()).unwrap()
                }
                _ => n::normalize_italian_decimals(&t).unwrap(),
            }
        }),
        "it-g2p" => Box::new(|input| {
            use vernacula_phonemizer::languages::italian::{italian as i, roman_ordinals as r};
            match input["op"].as_str().unwrap() {
                "word" => i::phonemize_word(&units(&input["word"])).unwrap(),
                "cardinal" => i::number_words(input["n"].as_f64().unwrap()).unwrap(),
                _ => r::italian_ordinal(input["n"].as_f64().unwrap())
                    .unwrap()
                    .unwrap_or_else(|| JsString::from("\u{0}none")),
            }
        }),
        "it-roman" => {
            let policy = vernacula_phonemizer::languages::italian::roman_ordinals::roman_policy();
            Box::new(move |input| {
                vernacula_phonemizer::core::roman::normalize_romans(&units(&input["text"]), &policy)
            })
        }
        "ru-normalize" | "ru-g2p" | "ru-numbers" => {
            let ru = vernacula_phonemizer::languages::russian::russian::create_russian().unwrap();
            let name = name.clone();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match (name.as_str(), input["op"].as_str().unwrap()) {
                    (_, "normalize") => ru.normalize(&t()),
                    (_, "initialisms") => ru.normalize_initialisms(&ru.normalize(&t())),
                    (_, "unreadable") => {
                        JsString::from(if ru.is_unreadable(&t()) { "1" } else { "0" })
                    }
                    (_, "word") => ru.phonemize_word(&units(&input["word"])),
                    (_, "toipa") => {
                        let ord = js_number(&JsString::from(input["ord"].as_str().unwrap()));
                        let hard: Option<Vec<f64>> = input["hard"].as_array().map(|h| {
                            h.iter()
                                .map(|v| js_number(&JsString::from(v.as_str().unwrap())))
                                .collect()
                        });
                        ru.to_ipa(&units(&input["word"]), ord, hard.as_deref())
                    }
                    (_, "ordinal") => ru
                        .ordinal(num())
                        .unwrap_or_else(|| JsString::from("\u{0}none")),
                    (_, op @ ("genitive" | "instrumental")) => ru
                        .cardinal_in_case(num(), op == "genitive")
                        .unwrap_or_else(|| JsString::from("\u{0}none")),
                    (_, _) => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        ru.number_to_words(num(), raw.as_ref())
                    }
                }
            })
        }
        "ru-roman" => {
            let policy = vernacula_phonemizer::languages::russian::roman_ordinals::roman_policy();
            Box::new(move |input| {
                vernacula_phonemizer::core::roman::normalize_romans(&units(&input["text"]), &policy)
            })
        }
        "pl-normalize" | "pl-g2p" | "pl-numbers" => {
            let pl = vernacula_phonemizer::languages::polish::polish::create_polish().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "normalize" => pl.normalize(&t()),
                    "initialisms" => pl.normalize_initialisms(&t()),
                    "symbols" => pl.symbols(&t()),
                    "unreadable" => JsString::from(pl.is_unreadable(&t()).to_string().as_str()),
                    "word" => pl.phonemize_word(&w()),
                    "segs" => {
                        let segs: Vec<JsString> = pl
                            .segments(&w())
                            .iter()
                            .map(|s| {
                                s.ph.concat(&JsString::from(
                                    format!(
                                        "/{}/{}/{}",
                                        s.nucleus as u8, s.nasal as u8, s.rz as u8
                                    )
                                    .as_str(),
                                ))
                            })
                            .collect();
                        JsString::join(&segs, &JsString::from(" "))
                    }
                    "nat" => pl.nativise(&w()),
                    "ordinal" => pl
                        .ordinal(num())
                        .unwrap_or_else(|| JsString::from("\u{0}none")),
                    "count" => JsString::from(
                        vernacula_phonemizer::core::js_string::js_number_to_string(
                            pl.count_form(num()),
                        )
                        .as_str(),
                    ),
                    "digits" => vernacula_phonemizer::languages::polish::numbers::read_digits(
                        &units(&input["raw"]),
                    ),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        pl.number_to_words(num(), raw.as_ref())
                    }
                }
            })
        }
        "pl-roman" => {
            let policy = vernacula_phonemizer::languages::polish::roman_ordinals::roman_policy();
            Box::new(move |input| {
                vernacula_phonemizer::core::roman::normalize_romans(&units(&input["text"]), &policy)
            })
        }
        "pt-normalize" => Box::new(|input| {
            use vernacula_phonemizer::languages::portuguese::normalize::*;
            let t = units(&input["text"]);
            match input["op"].as_str().unwrap() {
                "ep" => normalize_portuguese(&t, false),
                "bp" => normalize_portuguese(&t, true),
                _ => normalize_portuguese_initialisms(&normalize_portuguese(&t, true)),
            }
        }),
        "pt-g2p" => {
            Box::new(|input| {
                use vernacula_phonemizer::languages::portuguese::g2p::Dialect;
                use vernacula_phonemizer::languages::portuguese::portuguese::{
                    phonemize_word, render_word,
                };
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                "ep" => phonemize_word(&w, Dialect::Ep).unwrap(),
                "bp" => phonemize_word(&w, Dialect::Bp).unwrap(),
                "br" => vernacula_phonemizer::languages::portuguese_br::portuguese_br::phonemize_word(&w).unwrap(),
                "render-ep" => render_word(&w, None, Dialect::Ep),
                _ => render_word(&w, None, Dialect::Bp),
            }
            })
        }
        "pt-numbers" => Box::new(|input| {
            use vernacula_phonemizer::languages::portuguese::g2p::Dialect;
            let n = js_number(&JsString::from(input["n"].as_str().unwrap()));
            if input.get("ordinal").is_some() {
                return vernacula_phonemizer::languages::portuguese::roman_ordinals::portuguese_ordinal(n)
                    .unwrap_or_else(|| JsString::from("\u{0}none"));
            }
            let d = if input["d"] == "bp" {
                Dialect::Bp
            } else {
                Dialect::Ep
            };
            let raw = input
                .get("raw")
                .map(|r| JsString::from(r.as_str().unwrap()));
            vernacula_phonemizer::languages::portuguese::numbers::number_to_words(
                n,
                d,
                raw.as_ref(),
            )
        }),
        "hi-normalize" => {
            use vernacula_phonemizer::languages::hindi::{manifest::try_manifest, normalize::*};
            let hi = try_manifest().unwrap();
            let own = OwnOrdinals {
                irregular_ordinals: hi.irregular_ordinals.as_ref(),
                ordinal_suffixes: hi.ordinal_suffixes.as_ref(),
            };
            let norm = make_hindi_normalizer(&hi.numbers, own).unwrap();
            Box::new(move |input| norm(&units(&input["text"])).unwrap())
        }
        "hi-word" => {
            use vernacula_phonemizer::core::{
                abugida::make_abugida_g2p, phonology::load_shared_phonology,
            };
            use vernacula_phonemizer::languages::hindi::{hindi::*, manifest::try_manifest};
            let hi = try_manifest().unwrap();
            let phon = load_shared_phonology().unwrap();
            let g2p = make_abugida_g2p(&hi.abugida, phon);
            // `makeNativeHindi(MANIFEST)`: Hindi's own manifest, so its `symbolTier` is Hindi's.
            let overrides = Overrides {
                symbol_tier_is_hindis: true,
                ..Default::default()
            };
            let h = make_native_hindi(hi, phon, None, AbugidaScript::default(), None, overrides)
                .unwrap();
            Box::new(move |input| {
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "g2p" => g2p.g2p(&w),
                    "rules" => h.word_rules(&w),
                    _ => h.number(&w).unwrap(),
                }
            })
        }
        "ne-normalize" => {
            use vernacula_phonemizer::core::load_manifest::load_manifest;
            use vernacula_phonemizer::languages::hindi::manifest::HindiDef;
            use vernacula_phonemizer::languages::nepali::normalize::make_nepali_normalizer;
            let def: HindiDef = load_manifest("languages/nepali", "nepali.jsonc").unwrap();
            let norm = make_nepali_normalizer(&def.numbers);
            Box::new(move |input| norm(&units(&input["text"])).unwrap())
        }
        "mr-normalize" => {
            use vernacula_phonemizer::languages::marathi::{marathi::try_def, normalize::*};
            let def = try_def().unwrap();
            let norm = make_marathi_normalizer(&def.hindi.numbers, &def.words).unwrap();
            Box::new(move |input| norm(&units(&input["text"])).unwrap())
        }
        "hindi-family-word" => {
            let cache: std::cell::RefCell<std::collections::HashMap<String, FamilyWordFn>> =
                Default::default();
            Box::new(move |input| {
                let lang = input["lang"].as_str().unwrap();
                let mut c = cache.borrow_mut();
                let f = c
                    .entry(lang.to_string())
                    .or_insert_with(|| family_word(lang));
                f(input["op"].as_str().unwrap(), &units(&input["word"]))
            })
        }
        "abugida-core" => Box::new(|input| {
            use vernacula_phonemizer::core::weight_stress::{apply_weight_stress, tokenize_ipa};
            use vernacula_phonemizer::core::{
                postposed_sign::postposed_sign, schwa::delete_medial_schwa,
            };
            use vernacula_phonemizer::languages::hindi::hindi::heavy_final_coda;
            let x = units(&input["ipa"]);
            match input["op"].as_str().unwrap() {
                "schwa" => delete_medial_schwa(&x, None),
                "schwa-o" => delete_medial_schwa(&x, Some(&JsString::from("ɔ"))),
                "stress" => apply_weight_stress(&x),
                "tokenize" => JsString::join(&tokenize_ipa(&x), &JsString::from("|")),
                "heavy" => JsString::from(heavy_final_coda(&x).to_string()),
                _ => postposed_sign(
                    &x,
                    input["sign"].as_str().unwrap(),
                    &JsString::from(input["words"].as_str().unwrap()),
                ),
            }
        }),
        "phonemize-trace" => Box::new(|input| {
            let text = units(&input["text"]).to_string_lossy();
            let t = vernacula_phonemizer::phonemize_trace(&text, input["lang"].as_str().unwrap())
                .unwrap();
            let sp =
                |s: Option<(usize, usize)>| s.map_or("-".to_string(), |(a, b)| format!("{a},{b}"));
            let mut out = JsString::from(format!("{}\n{}\n", t.trace.traced, t.ipa));
            out.push_str(&t.trace.normalized);
            for k in &t.trace.tokens {
                let emitted: Vec<JsString> = k.emitted.clone();
                out.push_str(&JsString::from(format!(
                    "\n{}|{}|",
                    sp(Some(k.span)),
                    sp(k.input_span)
                )));
                out.push_str(&k.surface);
                out.push_str(&JsString::from("|"));
                out.push_str(&k.nativised.clone().unwrap_or_else(|| JsString::from("-")));
                out.push_str(&JsString::from("|"));
                out.push_str(&JsString::join(&emitted, &JsString::from("+")));
                out.push_str(&JsString::from(format!(
                    "|{}|{}",
                    k.source.map_or("-", |s| s.as_str()),
                    sp(k.ipa_span)
                )));
            }
            for r in &t.trace.rewrites {
                out.push_str(&JsString::from(format!("\nrewrite {}", r.stage)));
            }
            out
        }),
        "de-normalize" => {
            let de = vernacula_phonemizer::languages::german::german::create_german().unwrap();
            Box::new(move |input| {
                let t = units(&input["text"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => de.normalize(&t),
                    "initialisms" => de.normalize_initialisms(&t),
                    "symbols" => de.symbols(&t),
                    "years" => de.normalize_years(&t),
                    _ => JsString::from(de.is_unreadable(&t).to_string().as_str()),
                }
            })
        }
        "de-g2p" => {
            let de = vernacula_phonemizer::languages::german::german::create_german().unwrap();
            Box::new(move |input| {
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "word" => de.phonemize_word(&w),
                    "segs" => {
                        let segs: Vec<JsString> = de
                            .segments(&w)
                            .iter()
                            .map(|s| {
                                s.ph.concat(&JsString::from(
                                    format!("/{}/{}", s.s, s.vowel as u8).as_str(),
                                ))
                            })
                            .collect();
                        JsString::join(&segs, &JsString::from(" "))
                    }
                    _ => {
                        let d = de.decompose(&w);
                        let kinds: Vec<&str> = d.kinds.iter().map(|k| k.as_str()).collect();
                        JsString::join(&d.parts, &JsString::from("·")).concat(&JsString::from(
                            format!("|{}|{}", kinds.join(","), d.stress_part).as_str(),
                        ))
                    }
                }
            })
        }
        "de-numbers" => {
            let de = vernacula_phonemizer::languages::german::german::create_german().unwrap();
            Box::new(move |input| {
                let n = js_number(&JsString::from(input["n"].as_str().unwrap()));
                let raw = if input["raw"].is_null() {
                    None
                } else {
                    Some(units(&input["raw"]))
                };
                de.number_to_words(n, raw.as_ref())
            })
        }
        "tr-normalize" => {
            let tr = vernacula_phonemizer::languages::turkish::turkish::create_turkish().unwrap();
            Box::new(move |input| {
                let t = units(&input["text"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => tr.normalize(&t),
                    "initialisms" => tr.normalize_initialisms(&t),
                    "symbols" => tr.symbols(&t),
                    _ => JsString::from(tr.is_unreadable(&t).to_string().as_str()),
                }
            })
        }
        "tr-g2p" => {
            let tr = vernacula_phonemizer::languages::turkish::turkish::create_turkish().unwrap();
            Box::new(move |input| {
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "lower" => tr.tr_lower(&w),
                    "segs" => {
                        let segs: Vec<JsString> = tr
                            .segments(&w)
                            .iter()
                            .map(|s| {
                                s.ph.concat(&JsString::from(
                                    format!("/{}", s.nucleus as u8).as_str(),
                                ))
                            })
                            .collect();
                        JsString::join(&segs, &JsString::from(" "))
                    }
                    "word" => tr.phonemize_word(&w, false),
                    "final" => tr.phonemize_word(&w, true),
                    _ => tr.nativise(&w),
                }
            })
        }
        "tr-numbers" => {
            let tr = vernacula_phonemizer::languages::turkish::turkish::create_turkish().unwrap();
            Box::new(move |input| match input["op"].as_str().unwrap() {
                "words" => {
                    tr.number_to_words(js_number(&JsString::from(input["n"].as_str().unwrap())))
                }
                "ordinal" => tr
                    .ordinal_words(js_number(&JsString::from(input["n"].as_str().unwrap())))
                    .unwrap_or_else(|| JsString::from("\u{0}none")),
                "digits" => tr.digits_to_words(&JsString::from(input["n"].as_str().unwrap())),
                _ => {
                    let words = if input["words"].is_null() {
                        Vec::new()
                    } else {
                        units(&input["words"]).split(&JsString::from(" "))
                    };
                    JsString::join(
                        &tr.attach_suffix(&words, &units(&input["suffix"])),
                        &JsString::from("|"),
                    )
                }
            })
        }
        "nl-normalize" => {
            let nl = vernacula_phonemizer::languages::dutch::dutch::create_dutch().unwrap();
            Box::new(move |input| {
                let t = units(&input["text"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => nl.normalize(&t),
                    "initialisms" => nl.normalize_initialisms(&t),
                    "symbols" => nl.symbols(&t),
                    _ => JsString::from(nl.is_unreadable(&t).to_string().as_str()),
                }
            })
        }
        "nl-g2p" => {
            let nl = vernacula_phonemizer::languages::dutch::dutch::create_dutch().unwrap();
            Box::new(move |input| {
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "word" => nl.phonemize_word(&w),
                    "segs" => {
                        let segs: Vec<JsString> = nl
                            .segments(&w)
                            .iter()
                            .map(|s| {
                                s.ph.concat(&JsString::from(
                                    format!("/{}/{}", s.s, s.vowel as u8).as_str(),
                                ))
                            })
                            .collect();
                        JsString::join(&segs, &JsString::from(" "))
                    }
                    "lexical" => JsString::from(nl.is_lexical_word(&w).to_string().as_str()),
                    _ => {
                        let d = nl.decompose(&w);
                        let kinds: Vec<&str> = d.kinds.iter().map(|k| k.as_str()).collect();
                        JsString::join(&d.parts, &JsString::from("·")).concat(&JsString::from(
                            format!("|{}|{}", kinds.join(","), d.stress_part).as_str(),
                        ))
                    }
                }
            })
        }
        "nl-numbers" => {
            let nl = vernacula_phonemizer::languages::dutch::dutch::create_dutch().unwrap();
            Box::new(move |input| {
                let n = js_number(&JsString::from(input["n"].as_str().unwrap()));
                if input["op"].as_str().unwrap() == "ordinal" {
                    return nl
                        .ordinal_word(n)
                        .unwrap_or_else(|| JsString::from("\u{0}none"));
                }
                let raw = if input["raw"].is_null() {
                    None
                } else {
                    Some(units(&input["raw"]))
                };
                nl.number_to_words(n, raw.as_ref())
            })
        }
        "uk-normalize" | "uk-g2p" | "uk-numbers" => {
            let uk =
                vernacula_phonemizer::languages::ukrainian::ukrainian::create_ukrainian().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "normalize" => uk.normalize(&t()),
                    "initialisms" => uk.normalize_initialisms(&uk.normalize(&t())),
                    "unreadable" => JsString::from(if uk.is_unreadable(&t()) { "1" } else { "0" }),
                    "word" => uk.phonemize_word(&units(&input["word"])),
                    "roman" => uk
                        .roman_ordinal(num())
                        .unwrap_or_else(|| JsString::from("\u{0}none")),
                    _ => uk.number_words(num() as u64),
                }
            })
        }
        "uk-roman" => {
            let policy = vernacula_phonemizer::languages::ukrainian::roman_ordinals::roman_policy();
            Box::new(move |input| {
                vernacula_phonemizer::core::roman::normalize_romans(&units(&input["text"]), &policy)
            })
        }
        // ── Catalan (ca) ──
        "ca-normalize" => {
            use vernacula_phonemizer::languages::catalan::{catalan, normalize as n};
            let ca = catalan::create_catalan().unwrap();
            Box::new(move |input| match input["op"].as_str().unwrap() {
                "ordinal" => n::ordinal_words(
                    js_number(&JsString::from(input["n"].as_str().unwrap())),
                    input["fem"].as_bool().unwrap(),
                )
                .unwrap_or_else(|| JsString::from("\u{0}none")),
                op => {
                    let t = units(&input["text"]);
                    match op {
                        "normalize" => n::normalize_catalan(&t),
                        "symbols" => ca.symbols(&t),
                        _ => JsString::from(n::IS_UNREADABLE(&t).to_string().as_str()),
                    }
                }
            })
        }
        "ca-g2p" => {
            use vernacula_phonemizer::languages::catalan::{catalan, g2p};
            catalan::create_catalan().unwrap();
            Box::new(|input| {
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "word" => catalan::phonemize_word(&w, false),
                    "unstressed" => catalan::phonemize_word(&w, true),
                    "nat" => catalan::NAT(&w),
                    _ => {
                        let segs: Vec<JsString> = g2p::to_segments(&w)
                            .iter()
                            .map(|s| {
                                s.ph.concat(&JsString::from(
                                    format!("/{}{}", s.nucleus as u8, s.accent as u8).as_str(),
                                ))
                                .concat(&s.reduced.clone().unwrap_or_else(|| JsString::from("-")))
                            })
                            .collect();
                        JsString::join(&segs, &JsString::from(" "))
                    }
                }
            })
        }
        "ca-numbers" => {
            use vernacula_phonemizer::languages::catalan::{catalan, numbers, roman_ordinals};
            catalan::create_catalan().unwrap();
            Box::new(move |input| {
                let n = js_number(&JsString::from(input["n"].as_str().unwrap()));
                if input["op"] == "roman" {
                    // `ROMAN_POLICY.ordinal(n)` takes any JS number (the registry hands it a u32): the f64 entry.
                    return roman_ordinals::catalan_ordinal(n)
                        .unwrap_or_else(|| JsString::from("\u{0}none"));
                }
                let raw = (!input["raw"].is_null()).then(|| units(&input["raw"]));
                numbers::number_to_words(n, raw.as_ref())
            })
        }
        // ── Galician (gl) ──
        "gl-normalize" => {
            use vernacula_phonemizer::languages::galician::{galician, normalize as n};
            let gl = galician::create_galician().unwrap();
            Box::new(move |input| match input["op"].as_str().unwrap() {
                "ordinal" => {
                    n::galician_ordinal(js_number(&JsString::from(input["n"].as_str().unwrap())))
                        .unwrap_or_else(|| JsString::from("\u{0}none"))
                }
                op => {
                    let t = units(&input["text"]);
                    match op {
                        "normalize" => n::normalize_galician(&t),
                        "symbols" => gl.symbols(&t),
                        _ => JsString::from(n::IS_UNREADABLE(&t).to_string().as_str()),
                    }
                }
            })
        }
        "gl-g2p" => {
            use vernacula_phonemizer::languages::galician::{g2p, galician};
            galician::create_galician().unwrap();
            Box::new(|input| {
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "word" => galician::phonemize_word(&w),
                    "nat" => galician::NAT(&w),
                    _ => {
                        let segs: Vec<JsString> = g2p::to_segments(&w)
                            .iter()
                            .map(|s| {
                                s.ph.concat(&JsString::from(
                                    format!("/{}{}", s.nucleus as u8, s.accent as u8).as_str(),
                                ))
                            })
                            .collect();
                        JsString::join(&segs, &JsString::from(" "))
                    }
                }
            })
        }
        "gl-numbers" => {
            use vernacula_phonemizer::languages::galician::{galician, numbers};
            galician::create_galician().unwrap();
            Box::new(|input| {
                let n = js_number(&JsString::from(input["n"].as_str().unwrap()));
                let raw = (!input["raw"].is_null()).then(|| units(&input["raw"]));
                numbers::number_to_words(n, raw.as_ref())
            })
        }
        // ── Romanian (ro) ──
        "ro-normalize" => {
            use vernacula_phonemizer::languages::romanian::{normalize, romanian};
            romanian::create_romanian().unwrap();
            Box::new(|input| normalize::normalize_romanian(&units(&input["text"])))
        }
        "ro-g2p" => {
            use vernacula_phonemizer::languages::romanian::romanian;
            romanian::create_romanian().unwrap();
            Box::new(|input| {
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "word" => romanian::phonemize_word(&w),
                    "rules" => romanian::phonemize_word_rules(&w),
                    _ => romanian::NAT(&w),
                }
            })
        }
        "ro-numbers" => {
            use vernacula_phonemizer::languages::romanian::{roman_ordinals, romanian};
            romanian::create_romanian().unwrap();
            Box::new(|input| {
                let n = js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "words" => romanian::number_words(n, false),
                    "stem" => romanian::number_words(n, true),
                    _ => roman_ordinals::romanian_ordinal(n)
                        .unwrap_or_else(|| JsString::from("\u{0}none")),
                }
            })
        }
        "sv-normalize" => {
            let sv = vernacula_phonemizer::languages::swedish::swedish::create_swedish().unwrap();
            Box::new(move |input| {
                let none = || JsString::from("\u{0}none");
                let n = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "ordinal" => sv.ordinal(n()).unwrap_or_else(none),
                    "hundreds" => sv.hundreds_year(n()).unwrap_or_else(none),
                    "century" => sv.century_year(n()).unwrap_or_else(none),
                    op => {
                        let t = units(&input["text"]);
                        match op {
                            "normalize" => sv.normalize(&t),
                            "initialisms" => sv.normalize_initialisms(&t),
                            "symbols" => sv.symbols(&t),
                            _ => JsString::from(sv.is_unreadable(&t).to_string().as_str()),
                        }
                    }
                }
            })
        }
        "sv-g2p" => {
            use vernacula_phonemizer::languages::swedish::g2p::Compound;
            let sv = vernacula_phonemizer::languages::swedish::swedish::create_swedish().unwrap();
            let f = |v: &Value| v.as_f64().unwrap();
            let opt = |v: Option<f64>| v.map_or("-".to_string(), js_number_to_string);
            Box::new(move |input| {
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "word" => sv.phonemize_word(&w),
                    "nat" => sv.nativise(&w),
                    "lex" => {
                        let e = sv.lexicon_entry(&w).expect("a lexicon key");
                        let l = e.long_ords.as_ref().map_or("-".to_string(), |l| {
                            l.iter()
                                .map(|x| js_number_to_string(*x))
                                .collect::<Vec<_>>()
                                .join(",")
                        });
                        JsString::from(format!(
                            "{}|{}|{}|{}|{l}|{}",
                            e.accent,
                            opt(e.ord),
                            e.o_long as u8,
                            opt(e.sec_ord),
                            e.sec_vowel_initial as u8
                        ))
                    }
                    _ => {
                        let ord = js_number(&JsString::from(input["ord"].as_str().unwrap()));
                        let c = &input["compound"];
                        let compound = (!c.is_null()).then(|| {
                            // `new Set(longOrds)`: membership only, so duplicates are harmless.
                            Compound {
                                sec_ord: f(&c["secOrd"]),
                                long_ords: c["longOrds"]
                                    .as_array()
                                    .unwrap()
                                    .iter()
                                    .map(f)
                                    .collect(),
                                sec_vowel_initial: c["secVowelInitial"].as_bool().unwrap_or(false),
                            }
                        });
                        let segs: Vec<JsString> = sv
                            .segments(
                                &w,
                                ord,
                                input["oLong"].as_bool().unwrap(),
                                compound.as_ref(),
                            )
                            .iter()
                            .map(|s| {
                                s.ph.concat(&JsString::from(format!("/{}", s.vowel as u8).as_str()))
                            })
                            .collect();
                        JsString::join(&segs, &JsString::from(" "))
                    }
                }
            })
        }
        "sv-numbers" => {
            let sv = vernacula_phonemizer::languages::swedish::swedish::create_swedish().unwrap();
            Box::new(move |input| {
                let n = js_number(&JsString::from(input["n"].as_str().unwrap()));
                let raw = if input["raw"].is_null() {
                    None
                } else {
                    Some(units(&input["raw"]))
                };
                sv.number_to_words(n, raw.as_ref())
            })
        }
        "id-normalize" => {
            let id =
                vernacula_phonemizer::languages::indonesian::indonesian::create_indonesian(None)
                    .unwrap();
            Box::new(move |input| {
                let t = units(&input["text"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => id.normalize(&t),
                    _ => id.symbols(&t),
                }
            })
        }
        "ms-normalize" => {
            let ms = vernacula_phonemizer::languages::malay::malay::create_malay(None).unwrap();
            Box::new(move |input| {
                let t = units(&input["text"]);
                match input["op"].as_str().unwrap() {
                    "malay" => ms.normalize(&t),
                    _ => ms.inner().normalize(&t),
                }
            })
        }
        "id-g2p" => {
            let id =
                vernacula_phonemizer::languages::indonesian::indonesian::create_indonesian(None)
                    .unwrap();
            Box::new(move |input| {
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "word" => id.phonemize_word(&w),
                    _ => id.phonemize_word_rules(&w),
                }
            })
        }
        "id-numbers" => Box::new(|input| {
            vernacula_phonemizer::registry::phonemize_in(
                input["lang"].as_str().unwrap(),
                &units(&input["text"]),
            )
            .unwrap()
        }),
        "tl-normalize" => {
            let tl = vernacula_phonemizer::languages::tagalog::tagalog::create_tagalog().unwrap();
            Box::new(move |input| {
                let t = units(&input["text"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => tl.normalize(&t),
                    _ => tl.symbols(&t),
                }
            })
        }
        "tl-g2p" => {
            let tl = vernacula_phonemizer::languages::tagalog::tagalog::create_tagalog().unwrap();
            Box::new(move |input| {
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "word" => tl.phonemize_word(&w),
                    "rules" => tl.phonemize_word_rules(&w),
                    "noloan" => tl.phonemize_shipped_no_loan(&w),
                    _ => tl.nativise(&w),
                }
            })
        }
        "tl-numbers" => {
            let tl = vernacula_phonemizer::languages::tagalog::tagalog::create_tagalog().unwrap();
            Box::new(move |input| match input["op"].as_str().unwrap() {
                "words" => JsString::from(
                    tl.number_words(js_number(&JsString::from(input["n"].as_str().unwrap())))
                        .unwrap()
                        .as_str(),
                ),
                _ => vernacula_phonemizer::registry::phonemize_in("tl", &units(&input["text"]))
                    .unwrap(),
            })
        }
        "ceb-normalize" => {
            let ceb = vernacula_phonemizer::languages::cebuano::cebuano::create_cebuano().unwrap();
            Box::new(move |input| ceb.normalize(&units(&input["text"])))
        }
        "ceb-g2p" => {
            let ceb = vernacula_phonemizer::languages::cebuano::cebuano::create_cebuano().unwrap();
            Box::new(move |input| {
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "word" => ceb.phonemize_word(&w),
                    _ => ceb.nativise(&w),
                }
            })
        }
        "ceb-numbers" => {
            let ceb = vernacula_phonemizer::languages::cebuano::cebuano::create_cebuano().unwrap();
            Box::new(move |input| {
                let n = js_number(&JsString::from(input["n"].as_str().unwrap()));
                let raw = (!input["raw"].is_null()).then(|| units(&input["raw"]));
                ceb.number_to_words(n, raw.as_ref())
            })
        }
        "hil-normalize" => {
            let hil = vernacula_phonemizer::languages::hiligaynon::hiligaynon::create_hiligaynon()
                .unwrap();
            Box::new(move |input| hil.normalize(&units(&input["text"])))
        }
        "hil-g2p" => {
            let hil = vernacula_phonemizer::languages::hiligaynon::hiligaynon::create_hiligaynon()
                .unwrap();
            Box::new(move |input| {
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "word" => hil.phonemize_word(&w),
                    _ => hil.nativise(&w),
                }
            })
        }
        "hil-numbers" => {
            let hil = vernacula_phonemizer::languages::hiligaynon::hiligaynon::create_hiligaynon()
                .unwrap();
            Box::new(move |input| {
                let n = js_number(&JsString::from(input["n"].as_str().unwrap()));
                let raw = (!input["raw"].is_null()).then(|| units(&input["raw"]));
                hil.number_to_words(n, raw.as_ref())
            })
        }
        "ilo-normalize" => {
            let ilo = vernacula_phonemizer::languages::ilocano::ilocano::create_ilocano().unwrap();
            Box::new(move |input| ilo.normalize(&units(&input["text"])))
        }
        "ilo-g2p" => {
            let ilo = vernacula_phonemizer::languages::ilocano::ilocano::create_ilocano().unwrap();
            Box::new(move |input| {
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "word" => ilo.phonemize_word(&w),
                    "rules" => ilo.phonemize_word_rules(&w),
                    _ => ilo.nativise(&w),
                }
            })
        }
        "ilo-numbers" => {
            let ilo = vernacula_phonemizer::languages::ilocano::ilocano::create_ilocano().unwrap();
            Box::new(move |input| {
                let n = js_number(&JsString::from(input["n"].as_str().unwrap()));
                let raw = (!input["raw"].is_null()).then(|| units(&input["raw"]));
                ilo.number_to_words(n, raw.as_ref())
            })
        }
        "sh-normalize" => {
            let sr = vernacula_phonemizer::languages::serbian::serbian::create_serbian().unwrap();
            let hr =
                vernacula_phonemizer::languages::croatian::croatian::create_croatian().unwrap();
            let bs = vernacula_phonemizer::languages::bosnian::bosnian::create_bosnian().unwrap();
            Box::new(move |input| {
                let t = units(&input["text"]);
                let lang = input["lang"].as_str().unwrap();
                match input["op"].as_str().unwrap() {
                    "initialisms" => sr.normalize_initialisms(&t),
                    "decimal" => sr.read_decimal_comma(&t),
                    "unreadable" => JsString::from(sr.is_unreadable(&t).to_string().as_str()),
                    op => match (lang, op) {
                        ("sr", "normalize") => sr.normalize(&t),
                        ("sr", _) => sr.symbols(&t),
                        ("hr", "normalize") => hr.normalize(&t),
                        ("hr", _) => hr.symbols(&t),
                        ("bs", "normalize") => bs.normalize(&t),
                        ("bs", _) => bs.symbols(&t),
                        _ => panic!("no {lang} {op}"),
                    },
                }
            })
        }
        "sl-normalize" | "sl-g2p" | "sl-numbers" => {
            let sl =
                vernacula_phonemizer::languages::slovenian::slovenian::create_slovenian().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let n = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                let raw = || (!input["raw"].is_null()).then(|| units(&input["raw"]));
                match input["op"].as_str().unwrap() {
                    "normalize" => sl.normalize(&t()),
                    "initialisms" => sl.normalize_initialisms(&t()),
                    "symbols" => sl.symbols(&t()),
                    "unreadable" => JsString::from(sl.is_unreadable(&t()).to_string().as_str()),
                    "ordinal" => sl
                        .ordinal_words(n(), input["slot"].as_str().unwrap())
                        .unwrap_or_else(|| JsString::from("\u{0}none")),
                    "word" => sl.phonemize_word(&w()),
                    "segs" => {
                        let segs: Vec<JsString> = sl
                            .segments(&w())
                            .iter()
                            .map(|s| {
                                s.ph.concat(&JsString::from(
                                    format!("/{}", s.nucleus as u8).as_str(),
                                ))
                            })
                            .collect();
                        JsString::join(&segs, &JsString::from(" "))
                    }
                    "nat" => sl.nativise(&w()),
                    "has" => JsString::from(
                        vernacula_phonemizer::languages::slovenian::slovenian::stress_lexicon_has(
                            &w(),
                        )
                        .to_string()
                        .as_str(),
                    ),
                    "digits" => sl.read_digits(&raw().unwrap()),
                    _ => sl.number_to_words(n(), raw().as_ref()),
                }
            })
        }
        "lt-normalize" | "lt-g2p" | "lt-numbers" => {
            let lt = vernacula_phonemizer::languages::lithuanian::lithuanian::create_lithuanian()
                .unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let n = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                let raw = || (!input["raw"].is_null()).then(|| units(&input["raw"]));
                match input["op"].as_str().unwrap() {
                    "normalize" => lt.normalize(&t()),
                    "initialisms" => lt.normalize_initialisms(&t()),
                    "word" => lt.phonemize_word(&w()),
                    "segs" => {
                        let segs: Vec<JsString> = lt
                            .segments(&w())
                            .iter()
                            .map(|s| {
                                s.ph.concat(&JsString::from(
                                    format!("/{}", s.nucleus as u8).as_str(),
                                ))
                            })
                            .collect();
                        JsString::join(&segs, &JsString::from(" "))
                    }
                    "nat" => lt.nativise(&w()),
                    "digits" => lt.read_digits(&raw().unwrap()),
                    _ => lt.number_to_words(n(), raw().as_ref()),
                }
            })
        }
        "lv-normalize" | "lv-g2p" | "lv-numbers" => {
            let lv = vernacula_phonemizer::languages::latvian::latvian::create_latvian().unwrap();
            Box::new(move |input| {
                let w = || units(&input["word"]);
                let n = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                let raw = || (!input["raw"].is_null()).then(|| units(&input["raw"]));
                match input["op"].as_str().unwrap() {
                    "normalize" => lv.normalize(&units(&input["text"])),
                    "ordinal" => lv
                        .ordinal_words(n(), input["case"].as_str().unwrap())
                        .unwrap_or_else(|| JsString::from("\u{0}none")),
                    "word" => lv.phonemize_word(&w()),
                    "segs" => {
                        let segs: Vec<JsString> = lv
                            .segments(&w())
                            .iter()
                            .map(|s| {
                                s.ph.concat(&JsString::from(
                                    format!("/{}", s.nucleus as u8).as_str(),
                                ))
                            })
                            .collect();
                        JsString::join(&segs, &JsString::from(" "))
                    }
                    "nat" => lv.nativise(&w()),
                    "digits" => lv.read_digits(&raw().unwrap()),
                    _ => lv.number_to_words(n(), raw().as_ref()),
                }
            })
        }
        "sh-g2p" => {
            let sr = vernacula_phonemizer::languages::serbian::serbian::create_serbian().unwrap();
            let nat_hr = vernacula_phonemizer::core::host_word::make_nativiser("[a-zčćšžđ]", "iu");
            Box::new(move |input| {
                let w = units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "word" => sr.phonemize_word(&w),
                    "foreign" => sr.foreign_letters(&w),
                    "nat" => sr.nativise(&w),
                    "nat-hr" => nat_hr(&w),
                    _ => JsString::from(
                        vernacula_phonemizer::languages::serbian::serbian::accent_lexicon_has(&w)
                            .to_string()
                            .as_str(),
                    ),
                }
            })
        }
        "sh-numbers" => {
            use vernacula_phonemizer::languages::serbian::numbers::compose_slavic_number;
            let sr = vernacula_phonemizer::languages::serbian::manifest::try_manifest().unwrap();
            let hr = vernacula_phonemizer::languages::croatian::manifest::try_manifest().unwrap();
            let bs = vernacula_phonemizer::languages::bosnian::manifest::try_manifest().unwrap();
            Box::new(move |input| {
                let n = js_number(&JsString::from(input["n"].as_str().unwrap()));
                let raw = (!input["raw"].is_null()).then(|| units(&input["raw"]));
                let table = match input["lang"].as_str().unwrap() {
                    "sr" => &sr.numbers,
                    "hr" => &hr.numbers,
                    "bs" => &bs.numbers,
                    l => panic!("no {l} table"),
                };
                compose_slavic_number(n, table, raw.as_ref())
            })
        }
        "cs-normalize" | "cs-g2p" | "cs-numbers" => {
            let cs = vernacula_phonemizer::languages::czech::czech::create_czech().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "normalize" => cs.normalize(&t()),
                    "initialisms" => cs.normalize_initialisms(&t()),
                    "symbols" => cs.symbols(&t()),
                    "unreadable" => JsString::from(cs.is_unreadable(&t()).to_string().as_str()),
                    "word" => cs.phonemize_word(&w()),
                    "segs" => {
                        let segs: Vec<JsString> = cs
                            .segments(&w())
                            .iter()
                            .map(|s| {
                                s.ph.concat(&JsString::from(
                                    format!("/{}", s.nucleus as u8).as_str(),
                                ))
                            })
                            .collect();
                        JsString::join(&segs, &JsString::from(" "))
                    }
                    "nat" => cs.nativise(&w()),
                    "count" => JsString::from(js_number_to_string(cs.count_form(num())).as_str()),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        cs.number_to_words(num(), raw.as_ref())
                    }
                }
            })
        }
        "sk-normalize" | "sk-g2p" | "sk-numbers" => {
            let sk = vernacula_phonemizer::languages::slovak::slovak::create_slovak().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "normalize" => sk.normalize(&t()),
                    "initialisms" => sk.normalize_initialisms(&t()),
                    "unreadable" => JsString::from(sk.is_unreadable(&t()).to_string().as_str()),
                    "ordinal" => sk
                        .ordinal_words(num(), input["slot"].as_str().unwrap())
                        .unwrap_or_else(|| JsString::from("\u{0}none")),
                    "word" => sk.phonemize_word(&w()),
                    "segs" => {
                        let segs: Vec<JsString> = sk
                            .segments(&w())
                            .iter()
                            .map(|s| {
                                s.ph.concat(&JsString::from(
                                    format!("/{}", s.nucleus as u8).as_str(),
                                ))
                            })
                            .collect();
                        JsString::join(&segs, &JsString::from(" "))
                    }
                    "nat" => sk.nativise(&w()),
                    "count" => JsString::from(js_number_to_string(sk.count_form(num())).as_str()),
                    "digits" => sk.read_digits(&units(&input["raw"])),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        sk.number_to_words(num(), raw.as_ref())
                    }
                }
            })
        }
        "be-normalize" | "be-g2p" | "be-numbers" => {
            let be = vernacula_phonemizer::languages::belarusian::belarusian::create_belarusian()
                .unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "normalize" => be.normalize(&t()),
                    "initialisms" => be.normalize_initialisms(&t()),
                    "symbols" => be.symbols(&t()),
                    "unreadable" => JsString::from(be.is_unreadable(&t()).to_string().as_str()),
                    "word" => be.phonemize_word(&units(&input["word"])),
                    "roman" => be
                        .roman_ordinal(num())
                        .unwrap_or_else(|| JsString::from("\u{0}none")),
                    _ => be.number_words(num() as u64),
                }
            })
        }
        "be-roman" => {
            let policy =
                vernacula_phonemizer::languages::belarusian::roman_ordinals::roman_policy();
            Box::new(move |input| {
                vernacula_phonemizer::core::roman::normalize_romans(&units(&input["text"]), &policy)
            })
        }
        "bg-normalize" | "bg-g2p" => {
            let bg =
                vernacula_phonemizer::languages::bulgarian::bulgarian::create_bulgarian().unwrap();
            Box::new(move |input| match input["op"].as_str().unwrap() {
                "normalize" => bg.normalize(&units(&input["text"])),
                "word" => bg.phonemize_word(&units(&input["word"])),
                _ => bg.text(&units(&input["word"])),
            })
        }
        "mk-normalize" | "mk-g2p" | "mk-numbers" => {
            let mk = vernacula_phonemizer::languages::macedonian::macedonian::create_macedonian()
                .unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "normalize" => mk.normalize(&t()),
                    "initialisms" => mk.normalize_initialisms(&t()),
                    "symbols" => mk.symbols(&t()),
                    "unreadable" => JsString::from(mk.is_unreadable(&t()).to_string().as_str()),
                    "word" => mk.phonemize_word(&units(&input["word"])),
                    "ordinal" => mk
                        .ordinal(num())
                        .unwrap_or_else(|| JsString::from("\u{0}none")),
                    _ => {
                        let raw = input.get("raw").map(units);
                        mk.number_to_text(num(), raw.as_ref())
                    }
                }
            })
        }
        "az-normalize" | "az-g2p" | "az-numbers" => {
            let az =
                vernacula_phonemizer::languages::azerbaijani::azerbaijani::create_azerbaijani()
                    .unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                let none = || JsString::from("\u{0}none");
                match input["op"].as_str().unwrap() {
                    "normalize" => az.normalize(&t()),
                    "initialisms" => az.normalize_initialisms(&t()),
                    "symbols" => az.symbols(&t()),
                    "unreadable" => JsString::from(az.is_unreadable(&t()).to_string().as_str()),
                    "lower" => az.az_lower(&w()),
                    "segs" => {
                        let segs: Vec<JsString> = az
                            .segments(&w())
                            .iter()
                            .map(|s| {
                                s.ph.concat(&JsString::from(
                                    format!("/{}", s.nucleus as u8).as_str(),
                                ))
                            })
                            .collect();
                        JsString::join(&segs, &JsString::from(" "))
                    }
                    "word" => az.phonemize_word(&w()),
                    "nat" => az.nativise(&w()),
                    "words" => az.number_to_words(num()),
                    "ordinal" => az.ordinal_words(num()).unwrap_or_else(none),
                    _ => az.roman_ordinal(num()).unwrap_or_else(none),
                }
            })
        }
        "az-roman" => {
            let policy =
                vernacula_phonemizer::languages::azerbaijani::roman_ordinals::roman_policy();
            Box::new(move |input| {
                vernacula_phonemizer::core::roman::normalize_romans(&units(&input["text"]), &policy)
            })
        }
        "kk-normalize" | "kk-g2p" | "kk-numbers" => {
            let kk = vernacula_phonemizer::languages::kazakh::kazakh::create_kazakh().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "normalize" => kk.normalize(&t()),
                    "symbols" => kk.symbols(&t()),
                    "segs" => {
                        let segs: Vec<JsString> = kk
                            .segments(&w())
                            .iter()
                            .map(|s| {
                                s.ph.concat(&JsString::from(
                                    format!("/{}", s.nucleus as u8).as_str(),
                                ))
                            })
                            .collect();
                        JsString::join(&segs, &JsString::from(" "))
                    }
                    "word" => kk.phonemize_word(&w()),
                    "ipa" => kk.number_to_ipa(num()),
                    _ => kk
                        .roman_ordinal(num())
                        .unwrap_or_else(|| JsString::from("\u{0}none")),
                }
            })
        }
        "kk-roman" => {
            let policy = vernacula_phonemizer::languages::kazakh::roman_ordinals::roman_policy();
            Box::new(move |input| {
                vernacula_phonemizer::core::roman::normalize_romans(&units(&input["text"]), &policy)
            })
        }
        "ky-normalize" | "ky-g2p" | "ky-numbers" => {
            let ky = vernacula_phonemizer::languages::kyrgyz::kyrgyz::create_kyrgyz().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                let none = || JsString::from("\u{0}none");
                match input["op"].as_str().unwrap() {
                    "normalize" => ky.normalize(&t()),
                    "initialisms" => ky.normalize_initialisms(&t()),
                    "unreadable" => JsString::from(ky.is_unreadable(&t()).to_string().as_str()),
                    "word" => ky.phonemize_word(&units(&input["word"])),
                    "words" => ky.number_words(num()).unwrap_or_else(none),
                    "ordinal" => ky.ordinal(num()).unwrap_or_else(none),
                    _ => ky.text(&JsString::from(input["n"].as_str().unwrap())),
                }
            })
        }
        "uz-normalize" | "uz-g2p" | "uz-numbers" => {
            let uz = vernacula_phonemizer::languages::uzbek::uzbek::create_uzbek().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                let none = || JsString::from("\u{0}none");
                match input["op"].as_str().unwrap() {
                    "normalize" => uz.normalize(&t()),
                    "initialisms" => uz.normalize_initialisms(&t()),
                    "symbols" => uz.symbols(&t()),
                    "unreadable" => JsString::from(uz.is_unreadable(&t()).to_string().as_str()),
                    "word" => uz.phonemize_word(&w()),
                    "nat" => uz.nativise(&w()),
                    "words" => uz.number_to_words(num()),
                    "ordinal" => uz.ordinal_words(num()).unwrap_or_else(none),
                    "roman" => uz.roman_ordinal(num()).unwrap_or_else(none),
                    _ => uz.text(&JsString::from(input["n"].as_str().unwrap())),
                }
            })
        }
        "uz-roman" => {
            let policy = vernacula_phonemizer::languages::uzbek::roman_ordinals::roman_policy();
            Box::new(move |input| {
                vernacula_phonemizer::core::roman::normalize_romans(&units(&input["text"]), &policy)
            })
        }
        "tk-normalize" | "tk-g2p" | "tk-numbers" => {
            let tk = vernacula_phonemizer::languages::turkmen::turkmen::create_turkmen().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                let none = || JsString::from("\u{0}none");
                match input["op"].as_str().unwrap() {
                    "normalize" => tk.normalize(&t()),
                    "initialisms" => tk.normalize_initialisms(&t()),
                    "tildes" => tk.fold_tildes(&t()),
                    "engine" => tk.text(&t()),
                    "symbols" => tk.symbols(&t()),
                    "unreadable" => JsString::from(tk.is_unreadable(&t()).to_string().as_str()),
                    "word" => tk.phonemize_word(&w()),
                    "nat" => tk.nativise(&w()),
                    "words" => tk.number_words(num()),
                    "ordinal" => tk
                        .ordinal_of(num(), input["front"].as_bool().unwrap())
                        .unwrap_or_else(none),
                    "roman" => tk.roman_ordinal(num()).unwrap_or_else(none),
                    _ => tk.text(&JsString::from(input["n"].as_str().unwrap())),
                }
            })
        }
        "tk-roman" => {
            let policy = vernacula_phonemizer::languages::turkmen::roman_ordinals::roman_policy();
            Box::new(move |input| {
                vernacula_phonemizer::core::roman::normalize_romans(&units(&input["text"]), &policy)
            })
        }
        "tt-normalize" | "tt-g2p" | "tt-numbers" => {
            let tt = vernacula_phonemizer::languages::tatar::tatar::create_tatar().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                let none = || JsString::from("\u{0}none");
                match input["op"].as_str().unwrap() {
                    "normalize" => tt.normalize(&t()),
                    "initialisms" => tt.normalize_initialisms(&t()),
                    "symbols" => tt.symbols(&t()),
                    "engine" => tt.text(&t()),
                    "unreadable" => JsString::from(tt.is_unreadable(&t()).to_string().as_str()),
                    "word" => tt.phonemize_word(&units(&input["word"])),
                    "words" => tt.number_words(num()),
                    "ordinal" => tt.ordinal_of(num()).unwrap_or_else(none),
                    "roman" => tt.roman_ordinal(num()).unwrap_or_else(none),
                    _ => tt.text(&JsString::from(input["n"].as_str().unwrap())),
                }
            })
        }
        "tt-roman" => {
            let policy = vernacula_phonemizer::languages::tatar::roman_ordinals::roman_policy();
            Box::new(move |input| {
                vernacula_phonemizer::core::roman::normalize_romans(&units(&input["text"]), &policy)
            })
        }
        "ba-normalize" | "ba-g2p" | "ba-numbers" => {
            let ba = vernacula_phonemizer::languages::bashkir::bashkir::create_bashkir().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                let none = || JsString::from("\u{0}none");
                match input["op"].as_str().unwrap() {
                    "normalize" => ba.normalize(&t()),
                    "initialisms" => ba.normalize_initialisms(&t()),
                    "symbols" => ba.symbols(&t()),
                    "engine" => ba.text(&t()),
                    "unreadable" => JsString::from(ba.is_unreadable(&t()).to_string().as_str()),
                    "word" => ba.phonemize_word(&w()),
                    "native" => ba.phonemize_word_native(&w()),
                    "loan" => JsString::from(ba.is_russian_loan(&w()).to_string().as_str()),
                    "fold" => ba.fold_legacy_codepage(&w()),
                    "words" => ba.number_words(num()),
                    "ordinal" => ba.ordinal_of(num()).unwrap_or_else(none),
                    "roman" => ba.roman_ordinal(num()).unwrap_or_else(none),
                    _ => ba.text(&JsString::from(input["n"].as_str().unwrap())),
                }
            })
        }
        "crh-normalize" | "crh-g2p" | "crh-numbers" => {
            let crh =
                vernacula_phonemizer::languages::crimeantatar::crimeantatar::create_crimean_tatar()
                    .unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "normalize" => crh.normalize(&t()),
                    "symbols" => crh.symbols(&t()),
                    "engine" => crh.text(&t()),
                    "word" => crh.phonemize_word(&w()),
                    "nat" => crh.nativise(&w()),
                    "words" => crh.number_words(num()),
                    _ => crh.text(&JsString::from(input["n"].as_str().unwrap())),
                }
            })
        }
        "kaa-normalize" | "kaa-g2p" | "kaa-numbers" => {
            let kaa = vernacula_phonemizer::languages::karakalpak::karakalpak::create_karakalpak()
                .unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "normalize" => kaa.normalize(&t()),
                    "symbols" => kaa.symbols(&t()),
                    "engine" => kaa.text(&t()),
                    "word" => kaa.phonemize_word(&w()),
                    "nat" => kaa.nativise(&w()),
                    "words" => kaa.number_words(num()),
                    _ => kaa.text(&JsString::from(input["n"].as_str().unwrap())),
                }
            })
        }
        "nog-normalize" | "nog-g2p" | "nog-numbers" => {
            let nog = vernacula_phonemizer::languages::nogai::nogai::create_nogai().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "normalize" => nog.normalize(&t()),
                    "engine" => nog.text(&t()),
                    "word" => nog.phonemize_word(&units(&input["word"])),
                    "words" => nog.number_words(num()),
                    _ => nog.text(&JsString::from(input["n"].as_str().unwrap())),
                }
            })
        }
        "chv-normalize" | "chv-g2p" | "chv-numbers" => {
            let chv = vernacula_phonemizer::languages::chuvash::chuvash::create_chuvash().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                let none = || JsString::from("\u{0}none");
                match input["op"].as_str().unwrap() {
                    "normalize" => chv.normalize(&t()),
                    "initialisms" => chv.normalize_initialisms(&t()),
                    "symbols" => chv.symbols(&t()),
                    "attributive" => chv.spell_attributive(&t()),
                    "engine" => chv.text(&t()),
                    "unreadable" => JsString::from(chv.is_unreadable(&t()).to_string().as_str()),
                    "word" => chv.phonemize_word(&units(&input["word"])),
                    "words" => chv.number_words(num(), input["attr"].as_bool().unwrap()),
                    "ordinal" => chv.ordinal_of(num()).unwrap_or_else(none),
                    "roman" => chv.roman_ordinal(num()).unwrap_or_else(none),
                    _ => chv.text(&JsString::from(input["n"].as_str().unwrap())),
                }
            })
        }
        "chv-roman" => {
            let policy = vernacula_phonemizer::languages::chuvash::roman_ordinals::roman_policy();
            Box::new(move |input| {
                vernacula_phonemizer::core::roman::normalize_romans(&units(&input["text"]), &policy)
            })
        }
        "tg-normalize" | "tg-g2p" | "tg-numbers" => {
            let tg = vernacula_phonemizer::languages::tajik::tajik::create_tajik().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                let none = || JsString::from("\u{0}none");
                match input["op"].as_str().unwrap() {
                    "normalize" => tg.normalize(&t()),
                    "initialisms" => tg.normalize_initialisms(&t()),
                    "symbols" => tg.symbols(&t()),
                    "engine" => tg.text(&t()),
                    "unreadable" => JsString::from(tg.is_unreadable(&t()).to_string().as_str()),
                    "word" => tg.phonemize_word(&units(&input["word"])),
                    "words" => tg.number_words(num()),
                    "ordinal" => tg.ordinal(num()).unwrap_or_else(none),
                    _ => tg.text(&JsString::from(input["n"].as_str().unwrap())),
                }
            })
        }
        "ba-roman" => {
            let policy = vernacula_phonemizer::languages::bashkir::roman_ordinals::roman_policy();
            Box::new(move |input| {
                vernacula_phonemizer::core::roman::normalize_romans(&units(&input["text"]), &policy)
            })
        }
        "fr-normalize" => {
            use vernacula_phonemizer::core::roman::{RomanPolicy, normalize_romans};
            use vernacula_phonemizer::languages::french::{normalize as n, ordinals as o};
            let fr = vernacula_phonemizer::languages::french::french::create_french().unwrap();
            Box::new(move |input| {
                let is_word = |w: &JsString| fr.lexicon_has(w);
                let t = units(&input["text"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => n::normalize_french(&t).unwrap(),
                    "numerals" => normalize_romans(
                        &o::normalize_french_ordinal_digits(
                            &o::normalize_french_ordinal_romans(&t, &is_word).unwrap(),
                        )
                        .unwrap(),
                        &RomanPolicy::default(),
                    ),
                    _ => n::normalize_french_initialisms(&t, &is_word).unwrap(),
                }
            })
        }
        "fr-g2p" => Box::new(|input| {
            vernacula_phonemizer::languages::french::g2p::to_ipa(&units(&input["word"])).unwrap()
        }),
        "fr-numbers" => Box::new(|input| {
            let raw = input.get("raw").map(units);
            vernacula_phonemizer::languages::french::numbers::number_to_words(
                input["n"].as_f64().unwrap(),
                raw.as_ref(),
            )
            .unwrap()
        }),
        "fr-ordinals" => {
            use vernacula_phonemizer::languages::french::ordinals as o;
            let fr = vernacula_phonemizer::languages::french::french::create_french().unwrap();
            Box::new(move |input| match input["op"].as_str() {
                Some("digits") => {
                    o::normalize_french_ordinal_digits(&units(&input["text"])).unwrap()
                }
                Some(_) => o::normalize_french_ordinal_romans(&units(&input["text"]), &|w| {
                    fr.lexicon_has(w)
                })
                .unwrap(),
                None => o::ordinal(
                    input["n"].as_f64().unwrap(),
                    input["feminine"].as_bool().unwrap(),
                    input["plural"].as_bool().unwrap(),
                )
                .unwrap()
                .unwrap_or_else(|| JsString::from("\u{0}none")),
            })
        }
        "fr-tagger" => {
            let tagger =
                vernacula_phonemizer::languages::french::french_tagger::create_french_tagger(
                    "fr-g2p-tagger",
                )
                .unwrap();
            Box::new(move |input| tagger.tag(&units(&input["word"])).unwrap())
        }
        "th-normalize" => Box::new(|input| {
            vernacula_phonemizer::languages::thai::normalize::normalize_thai(&units(&input["text"]))
        }),
        "th-segment" => Box::new(|input| {
            let toks =
                vernacula_phonemizer::languages::thai::segment::segment(&units(&input["text"]));
            JsString::join(&toks, &JsString::from("\u{1}"))
        }),
        "th-word" => Box::new(|input| {
            vernacula_phonemizer::languages::thai::g2p::phonemize_word(&units(&input["text"]))
        }),
        "th-syllabify" => Box::new(|input| {
            use vernacula_phonemizer::languages::thai::syllabifier as s;
            let run = units(&input["text"]);
            let fixed = s::thai_lexical_fixup(&run);
            let reordered = s::reorder_thai_leading_vowels(&fixed);
            match input["op"].as_str().unwrap() {
                "fixup" => fixed,
                "reorder" => reordered,
                "strip" => s::strip_thai_marks(&run),
                _ => match s::thai_prep(&reordered) {
                    None => JsString::from("\u{0}none"),
                    Some(p) => JsString::from(thai_scan_string(
                        &p,
                        &s::thai_scan_syllables(&p.units, &p.fates, &p.unit_mark, &p.short_mark),
                    )),
                },
            }
        }),
        "fi-normalize" | "fi-g2p" => {
            let fi = vernacula_phonemizer::languages::finnish::finnish::create_finnish().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "normalize" => fi.normalize(&t()),
                    "initialisms" => fi.normalize_initialisms(&t()),
                    "symbols" => fi.symbols(&t()),
                    "unreadable" => JsString::from(fi.is_unreadable(&t()).to_string().as_str()),
                    "ordinal" => fi
                        .ordinal(num())
                        .unwrap_or_else(|| JsString::from("\u{0}none")),
                    "word" => fi.phonemize_word(&w()),
                    "nat" => fi.nativise(&w()),
                    "digits" => fi.read_digits(&units(&input["raw"])),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        fi.number_to_words(num(), raw.as_ref())
                    }
                }
            })
        }
        "et-normalize" | "et-g2p" => {
            let et =
                vernacula_phonemizer::languages::estonian::estonian::create_estonian().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => et.normalize(&t()),
                    "initialisms" => et.normalize_initialisms(&t()),
                    "symbols" => et.symbols(&t()),
                    "unreadable" => JsString::from(et.is_unreadable(&t()).to_string().as_str()),
                    "ordinal" => et
                        .ordinal(
                            js_number(&JsString::from(input["n"].as_str().unwrap())),
                            input["ending"].as_str(),
                        )
                        .unwrap_or_else(|| JsString::from("\u{0}none")),
                    "word" => et.phonemize_word(&w()),
                    "nat" => et.nativise(&w()),
                    _ => et.text(&t()),
                }
            })
        }
        "hu-normalize" | "hu-g2p" | "hu-numbers" => {
            let hu =
                vernacula_phonemizer::languages::hungarian::hungarian::create_hungarian().unwrap();
            let roman = vernacula_phonemizer::languages::hungarian::roman_ordinals::roman_policy();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let num = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                let none = || JsString::from("\u{0}none");
                match input["op"].as_str().unwrap() {
                    "normalize" => hu.normalize(&t()),
                    "unreadable" => JsString::from(hu.is_unreadable(&t()).to_string().as_str()),
                    "word" => hu.phonemize_word(&w()),
                    "nat" => hu.nativise(&w()),
                    "ordinal" => hu.ordinal_words(num()).unwrap_or_else(none),
                    "mult" => hu.multiplicative_words(num()).unwrap_or_else(none),
                    "roman" => (roman.ordinal.as_ref().unwrap())(num() as u32).unwrap_or_else(none),
                    "stem" => hu.stem_for_suffix(&w(), &units(&input["suffix"])),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        hu.number_to_words(num(), raw.as_ref())
                    }
                }
            })
        }
        "is-normalize" | "is-g2p" => {
            let is =
                vernacula_phonemizer::languages::icelandic::icelandic::create_icelandic().unwrap();
            Box::new(move |input| {
                let w = || units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => is.normalize(&units(&input["text"])),
                    "word" => is.phonemize_word(&w()),
                    "nat" => is.nativise(&w()),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        is.number_to_words(
                            js_number(&JsString::from(input["n"].as_str().unwrap())),
                            raw.as_ref(),
                        )
                    }
                }
            })
        }
        "fo-normalize" | "fo-g2p" => {
            let fo = vernacula_phonemizer::languages::faroese::faroese::create_faroese().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => fo.normalize(&t()),
                    "symbols" => fo.symbols(&t()),
                    "text" => fo.text(&t()),
                    "word" => fo.phonemize_word(&w()),
                    "nat" => fo.nativise(&w()),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        fo.number_to_words(
                            js_number(&JsString::from(input["n"].as_str().unwrap())),
                            raw.as_ref(),
                        )
                    }
                }
            })
        }
        "da-normalize" | "da-g2p" | "da-tagger" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            use vernacula_phonemizer::core::structural_tagger::{default_stress_vowel, one_stress};
            use vernacula_phonemizer::languages::danish::{danish, danish_tagger};
            let da = danish::create_danish().unwrap();
            let tagger = (name == "da-tagger")
                .then(|| danish_tagger::create_danish_tagger("da-g2p-tagger").unwrap());
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => da.normalize(&t()),
                    "text" => with_host(&js("da"), || da.text(&t(), None)),
                    "rules" => da.phonemize_word_rules(&w()),
                    "word" => da.phonemize_word(&w()),
                    "nat" => da.nativise(&w()),
                    "tag" => tagger.as_ref().unwrap().tag(&w()).unwrap(),
                    "oneStress" => one_stress(&w(), default_stress_vowel()),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        da.number_to_words(
                            js_number(&JsString::from(input["n"].as_str().unwrap())),
                            raw.as_ref(),
                        )
                    }
                }
            })
        }
        "nb-normalize" | "nb-g2p" | "nb-tagger" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            use vernacula_phonemizer::core::structural_tagger::one_stress;
            use vernacula_phonemizer::languages::norwegian::{norwegian, norwegian_tagger};
            let nb = norwegian::create_norwegian().unwrap();
            let tagger = (name == "nb-tagger")
                .then(|| norwegian_tagger::create_norwegian_tagger("nb-g2p-tagger").unwrap());
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => nb.normalize(&t()),
                    "text" => with_host(&js("nb"), || nb.text(&t(), None)),
                    "rules" => nb.phonemize_word_rules(&w()),
                    "word" => nb.phonemize_word(&w()),
                    "nat" => nb.nativise(&w()),
                    "tag" => tagger.as_ref().unwrap().tag(&w()).unwrap(),
                    "oneStressNb" => one_stress(
                        &w(),
                        vernacula_phonemizer::js_re!(r"[ɑaeɛiɪoɔuʉʊyʏøœæ]", "u"),
                    ),
                    op => panic!("nb: unknown op {op}"),
                }
            })
        }
        "af-normalize" | "af-g2p" | "af-tagger" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            use vernacula_phonemizer::languages::afrikaans::{afrikaans, afrikaans_tagger};
            let af = afrikaans::create_afrikaans().unwrap();
            let tagger = (name == "af-tagger")
                .then(|| afrikaans_tagger::create_afrikaans_tagger("af-g2p-tagger").unwrap());
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let n = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "normalize" => af.normalize(&t()),
                    "symbols" => af.symbols(&t()),
                    "initialisms" => af.normalize_initialisms(&t()),
                    "text" => with_host(&js("af"), || af.text(&t(), None)),
                    "unreadable" => js(&af.is_unreadable(&w()).to_string()),
                    "ordinal" => af.ordinal_word(n()).unwrap_or_else(|| js("\u{0}none")),
                    "rules" => af.phonemize_word_rules(&w()),
                    "word" => af.phonemize_word(&w()),
                    "decompose" => {
                        let d = af.decompose(&w());
                        let kinds: Vec<&str> = d.kinds.iter().map(|k| k.as_str()).collect();
                        JsString::join(&d.parts, &js("+")).concat(&js(&format!(
                            "|{}|{}",
                            kinds.join("+"),
                            d.stress_part
                        )))
                    }
                    "tag" => tagger.as_ref().unwrap().tag(&w()).unwrap(),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        af.number_to_words(n(), raw.as_ref())
                    }
                }
            })
        }
        "lb-normalize" | "lb-g2p" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            let lb = vernacula_phonemizer::languages::luxembourgish::luxembourgish::create_luxembourgish()
                .unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let n = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "normalize" => lb.normalize(&t()),
                    "symbols" => lb.symbols(&t()),
                    "text" => with_host(&js("lb"), || lb.text(&t())),
                    "eifeler" => lb.eifeler(&w(), &units(&input["following"])),
                    "stem" => lb.ordinal_stem(n()).unwrap_or_else(|| js("\u{0}none")),
                    "word" => lb.phonemize_word(&w()),
                    "nat" => lb.nativise(&w()),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        lb.number_to_words(n(), raw.as_ref())
                    }
                }
            })
        }
        "bar-normalize" | "bar-g2p" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            let bar =
                vernacula_phonemizer::languages::bavarian::bavarian::create_bavarian().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => bar.normalize(&t()),
                    "text" => with_host(&js("bar"), || bar.text(&t())),
                    "word" => bar.phonemize_word(&w()),
                    "nat" => bar.nativise(&w()),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        bar.number_to_words(
                            js_number(&JsString::from(input["n"].as_str().unwrap())),
                            raw.as_ref(),
                        )
                    }
                }
            })
        }
        "cy-normalize" | "cy-g2p" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            let cy = vernacula_phonemizer::languages::welsh::welsh::create_welsh().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let n = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "normalize" => cy.normalize(&t()),
                    "symbols" => cy.symbols(&t()),
                    "text" => with_host(&js("cy"), || cy.text(&t())),
                    "ordinal" => cy.ordinal_words(n()).unwrap_or_else(|| js("\u{0}none")),
                    "soften" => cy.soften(&w()),
                    "word" => cy.phonemize_word(&w()),
                    "nat" => cy.nativise(&w()),
                    "segs" => {
                        let parts: Vec<JsString> = cy
                            .segments(&w())
                            .iter()
                            .map(|s| {
                                s.ph.concat(&js(&format!("/{}{}", s.nucleus as u8, s.long as u8)))
                            })
                            .collect();
                        JsString::join(&parts, &js(" "))
                    }
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        cy.number_to_words(n(), raw.as_ref())
                    }
                }
            })
        }
        "ga-normalize" | "ga-g2p" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            let ga = vernacula_phonemizer::languages::irish::irish::create_irish().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                let n = || js_number(&JsString::from(input["n"].as_str().unwrap()));
                match input["op"].as_str().unwrap() {
                    "normalize" => ga.normalize(&t()),
                    "symbols" => ga.symbols(&t()),
                    "text" => with_host(&js("ga"), || ga.text(&t())),
                    "ordinal" => ga
                        .ordinal_words(n(), &units(&input["noun"]))
                        .unwrap_or_else(|| js("\u{0}none")),
                    "word" => ga.phonemize_word(&w()),
                    "g2p" => ga.g2p_word(&w()),
                    "nat" => ga.nativise(&w()),
                    "segs" => {
                        let parts: Vec<JsString> = ga
                            .segments(&w())
                            .iter()
                            .map(|s| {
                                s.ph.concat(&js(&format!(
                                    "/{}{}",
                                    s.nucleus as u8, s.no_glide as u8
                                )))
                            })
                            .collect();
                        JsString::join(&parts, &js(" "))
                    }
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        ga.number_to_words(n(), raw.as_ref())
                    }
                }
            })
        }
        "gd-normalize" | "gd-g2p" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            let gd =
                vernacula_phonemizer::languages::scottishgaelic::scottishgaelic::create_scottish_gaelic()
                    .unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => gd.normalize(&t()),
                    "symbols" => gd.symbols(&t()),
                    "text" => with_host(&js("gd"), || gd.text(&t())),
                    "word" => gd.phonemize_word(&w()),
                    "nat" => gd.nativise(&w()),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        gd.number_to_words(
                            js_number(&JsString::from(input["n"].as_str().unwrap())),
                            raw.as_ref(),
                        )
                    }
                }
            })
        }
        "eu-normalize" | "eu-g2p" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            let eu = vernacula_phonemizer::languages::basque::basque::create_basque().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => eu.normalize(&t()),
                    "text" => with_host(&js("eu"), || eu.text(&t())),
                    "word" => eu.phonemize_word(&w()),
                    "nat" => eu.nativise(&w()),
                    _ => eu.cardinal_words(input["n"].as_str().unwrap().parse().unwrap()),
                }
            })
        }
        "sq-normalize" | "sq-g2p" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            let sq =
                vernacula_phonemizer::languages::albanian::albanian::create_albanian().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => sq.normalize(&t()),
                    "text" => with_host(&js("sq"), || sq.text(&t())),
                    "word" => sq.phonemize_word(&w()),
                    "nat" => sq.nativise(&w()),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        sq.number_to_words(
                            js_number(&JsString::from(input["n"].as_str().unwrap())),
                            raw.as_ref(),
                        )
                    }
                }
            })
        }
        "ast-normalize" | "ast-g2p" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            let ast =
                vernacula_phonemizer::languages::asturian::asturian::create_asturian().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => ast.normalize(&t()),
                    "symbols" => ast.symbols(&t()),
                    "text" => with_host(&js("ast"), || ast.text(&t())),
                    "word" => ast.phonemize_word(&w()),
                    "nat" => ast.nativise(&w()),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        ast.number_to_words(
                            js_number(&JsString::from(input["n"].as_str().unwrap())),
                            raw.as_ref(),
                        )
                    }
                }
            })
        }
        "an-normalize" | "an-g2p" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            let an =
                vernacula_phonemizer::languages::aragonese::aragonese::create_aragonese().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => an.normalize(&t()),
                    "symbols" => an.symbols(&t()),
                    "text" => with_host(&js("an"), || an.text(&t())),
                    "word" => an.phonemize_word(&w()),
                    "nat" => an.nativise(&w()),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        an.number_to_words(
                            js_number(&JsString::from(input["n"].as_str().unwrap())),
                            raw.as_ref(),
                        )
                    }
                }
            })
        }
        "oc-normalize" | "oc-g2p" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            let oc = vernacula_phonemizer::languages::occitan::occitan::create_occitan().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => oc.normalize(&t()),
                    "symbols" => oc.symbols(&t()),
                    "text" => with_host(&js("oc"), || oc.text(&t())),
                    "word" => oc.phonemize_word(&w()),
                    "nat" => oc.nativise(&w()),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        oc.number_to_words(
                            js_number(&JsString::from(input["n"].as_str().unwrap())),
                            raw.as_ref(),
                        )
                    }
                }
            })
        }
        "bengali-family" => {
            let cache: std::cell::RefCell<std::collections::HashMap<String, BengaliFamilyFn>> =
                Default::default();
            Box::new(move |input| {
                let lang = input["lang"].as_str().unwrap();
                let mut c = cache.borrow_mut();
                let f = c
                    .entry(lang.to_string())
                    .or_insert_with(|| bengali_family(lang));
                let x = input
                    .get("text")
                    .or_else(|| input.get("word"))
                    .map(units)
                    .unwrap();
                f(input["op"].as_str().unwrap(), &x)
            })
        }
        "bn-tagger" => {
            use vernacula_phonemizer::languages::bengali::bengali_tagger::create_bengali_tagger;
            let tagger = create_bengali_tagger("bn-g2p-tagger").unwrap();
            Box::new(move |input| tagger.tag(&units(&input["word"])).unwrap())
        }
        "syl" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            use vernacula_phonemizer::languages::sylheti::{normalize::normalize_sylheti, sylheti};
            let e = sylheti::create_sylheti().unwrap();
            Box::new(move |input| match input["op"].as_str().unwrap() {
                "normalize" => normalize_sylheti(&units(&input["text"])),
                "text" => with_host(&js("syl"), || e.text(&units(&input["text"]))),
                "word" => e.phonemize_word(&units(&input["word"])),
                op => panic!("syl: unknown op {op}"),
            })
        }
        "or" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            let e = vernacula_phonemizer::languages::odia::odia::create_odia(None).unwrap();
            Box::new(move |input| match input["op"].as_str().unwrap() {
                "normalize" => e.normalize(&units(&input["text"])),
                "text" => with_host(&js("or"), || e.text(&units(&input["text"]))),
                "word" => e.phonemize_word(&units(&input["word"])),
                op => panic!("or: unknown op {op}"),
            })
        }
        "zu-normalize" | "zu-g2p" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            use vernacula_phonemizer::languages::zulu::{g2p, nguni_loans, zulu};
            let zu = zulu::create_zulu(None, None).unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => zu.normalize(&t()),
                    "symbols" => zu.symbols(&t()),
                    "text" => with_host(&js("zu"), || zu.text(&t())),
                    "foreign" => {
                        let en = vernacula_phonemizer::registry::english().unwrap();
                        let hit = zulu::is_foreign_nguni_word(&w().to_lower_case(), &|x| {
                            en.known_word(x).is_some()
                        });
                        js(if hit { "1" } else { "0" })
                    }
                    "word" => zu.phonemize_word(&w(), None),
                    "toned" => zu.phonemize_word(&w(), Some(&units(&input["codes"]))),
                    "compound" => JsString::join(&zu.phonemize_compound(&w()), &js("|")),
                    "nat" => zu.nativise(&w()),
                    "segs" => {
                        let parts: Vec<JsString> = g2p::to_segments(&w(), &g2p::RULES)
                            .iter()
                            .map(|s| s.ph.concat(&js(&format!("/{}", s.v as u8))))
                            .collect();
                        JsString::join(&parts, &js(" "))
                    }
                    "declick" => nguni_loans::de_click(&w()),
                    "loan" => js(match nguni_loans::nguni_loan(&w()) {
                        Some(nguni_loans::LoanReading::Declick) => "declick",
                        Some(nguni_loans::LoanReading::Foreign) => "foreign",
                        None => "\u{0}none",
                    }),
                    _ => {
                        zu.number_to_words(js_number(&JsString::from(input["n"].as_str().unwrap())))
                    }
                }
            })
        }
        "xh-normalize" | "xh-g2p" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            use vernacula_phonemizer::languages::{xhosa::xhosa, zulu::zulu};
            let xh = xhosa::create_xhosa(None, None).unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                let w = || units(&input["word"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => xh.normalize(&t()),
                    "symbols" => xh.symbols(&t()),
                    "text" => with_host(&js("xh"), || xh.text(&t())),
                    "foreign" => {
                        let en = vernacula_phonemizer::registry::english().unwrap();
                        let hit = zulu::is_foreign_nguni_word(&w().to_lower_case(), &|x| {
                            en.known_word(x).is_some()
                        });
                        js(if hit { "1" } else { "0" })
                    }
                    "word" => xh.phonemize_word(&w()),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        xh.number_to_words(
                            js_number(&JsString::from(input["n"].as_str().unwrap())),
                            raw.as_ref(),
                        )
                    }
                }
            })
        }
        "st-normalize" | "st-g2p" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            let st = vernacula_phonemizer::languages::sesotho::sesotho::create_sesotho().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => st.normalize(&t()),
                    "symbols" => st.symbols(&t()),
                    "text" => with_host(&js("st"), || st.text(&t())),
                    "word" => st.phonemize_word(&units(&input["word"])),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        st.number_to_words(
                            js_number(&JsString::from(input["n"].as_str().unwrap())),
                            raw.as_ref(),
                        )
                    }
                }
            })
        }
        "tn-normalize" | "tn-g2p" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            let tn =
                vernacula_phonemizer::languages::setswana::setswana::create_setswana().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                match input["op"].as_str().unwrap() {
                    "pre" => tn.normalize_pre(&t()),
                    "symbols" => tn.symbols(&t()),
                    "post" => tn.normalize_post(&t()),
                    "text" => with_host(&js("tn"), || tn.text(&t())),
                    "word" => tn.phonemize_word(&units(&input["word"])),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        tn.number_to_words(
                            js_number(&JsString::from(input["n"].as_str().unwrap())),
                            raw.as_ref(),
                        )
                    }
                }
            })
        }
        "nso-normalize" | "nso-g2p" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            let nso = vernacula_phonemizer::languages::sepedi::sepedi::create_sepedi().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                match input["op"].as_str().unwrap() {
                    "normalize" => nso.normalize(&t()),
                    "symbols" => nso.symbols(&t()),
                    "text" => with_host(&js("nso"), || nso.text(&t())),
                    "word" => nso.phonemize_word(&units(&input["word"])),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        nso.number_to_words(
                            js_number(&JsString::from(input["n"].as_str().unwrap())),
                            raw.as_ref(),
                        )
                    }
                }
            })
        }
        "sn-normalize" | "sn-g2p" => {
            use vernacula_phonemizer::core::foreign::with_host;
            use vernacula_phonemizer::core::js_string::js;
            let sn = vernacula_phonemizer::languages::shona::shona::create_shona().unwrap();
            Box::new(move |input| {
                let t = || units(&input["text"]);
                match input["op"].as_str().unwrap() {
                    "pre" => sn.normalize_pre(&t()),
                    "symbols" => sn.symbols(&t()),
                    "post" => sn.normalize_post(&t()),
                    "text" => with_host(&js("sn"), || sn.text(&t())),
                    "word" => sn.phonemize_word(&units(&input["word"])),
                    "concord" => sn.with_class6_concord(&t()),
                    _ => {
                        let raw = input["raw"].as_array().map(|_| units(&input["raw"]));
                        sn.number_to_words(
                            js_number(&JsString::from(input["n"].as_str().unwrap())),
                            raw.as_ref(),
                        )
                    }
                }
            })
        }
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
            if differ
                <= std::env::var("FN_DIFF_SHOW")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(15)
            {
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

/// The `symbols` dump's countForm names: `default`, `slavic`, or `custom:<language dir>`, each with its Rust
/// twin in JS number semantics (`%` is fmod in both). The replay checks each twin against the TS values.
fn count_form(sig: &str) -> Option<std::sync::Arc<dyn Fn(f64) -> f64 + Send + Sync>> {
    use std::sync::Arc;
    use vernacula_phonemizer::core::normalize_symbols::{default_count_form, slavic_count_form};
    let is_int = |n: f64| n.is_finite() && n.trunc() == n;
    let b = |c: bool, t: f64, f: f64| if c { t } else { f };
    Some(match sig {
        "default" | "custom:albanian" => Arc::new(default_count_form),
        "slavic" => Arc::new(slavic_count_form),
        "custom:basque" | "custom:quechua" | "custom:tashelhit" => Arc::new(|_| 0.0),
        "custom:ukrainian" | "custom:belarusian" => {
            Arc::new(move |n| if is_int(n) { slavic_count_form(n) } else { 3.0 })
        }
        "custom:latvian" | "custom:latgalian" => {
            Arc::new(move |n: f64| b(n % 10.0 == 1.0 && n % 100.0 != 11.0, 0.0, 1.0))
        }
        "custom:macedonian" => Arc::new(move |n: f64| {
            let m = n.abs() % 100.0;
            b(m % 10.0 == 1.0 && m != 11.0, 0.0, 1.0)
        }),
        "custom:maltese" => {
            Arc::new(move |n: f64| b(n == 1.0 || (n >= 11.0 && n % 1.0 == 0.0), 0.0, 1.0))
        }
        "custom:slovak" => Arc::new(move |n: f64| {
            if n == 1.0 {
                0.0
            } else {
                b(n == 2.0 || n == 3.0 || n == 4.0, 1.0, 2.0)
            }
        }),
        "custom:slovenian" => Arc::new(move |n: f64| {
            if !is_int(n) {
                4.0
            } else if n == 1.0 {
                0.0
            } else if n == 2.0 {
                1.0
            } else {
                b((3.0..=4.0).contains(&n), 2.0, 3.0)
            }
        }),
        "custom:czech" => Arc::new(move |n: f64| czech_polish(n, false)),
        "custom:polish" => Arc::new(move |n: f64| czech_polish(n, true)),
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

type FamilyWordFn = Box<dyn Fn(&str, &JsString) -> JsString>;

/// A Hindi-belt engine's word level (`word`, `wordRules`, `number`), as its own create function builds it.
fn family_word(lang: &str) -> FamilyWordFn {
    use vernacula_phonemizer::languages as l;
    use vernacula_phonemizer::languages::hindi::hindi::NativeHindi;
    fn native(h: NativeHindi) -> FamilyWordFn {
        Box::new(move |op, w| match op {
            "word" => h.word(w),
            "rules" => h.word_rules(w),
            _ => h.number(w).unwrap(),
        })
    }
    match lang {
        "bho" => native(l::bhojpuri::bhojpuri::create_bhojpuri(None).unwrap()),
        "mag" => native(l::magahi::magahi::create_magahi(None).unwrap()),
        "awa" => {
            let e = l::awadhi::awadhi::create_awadhi(None).unwrap();
            Box::new(move |op, w| match op {
                "word" => e.word(w),
                "rules" => e.word_rules(w),
                _ => e.number(w).unwrap(),
            })
        }
        "mai" => {
            let e = l::maithili::maithili::create_maithili(None).unwrap();
            Box::new(move |op, w| match op {
                "word" => e.word(w),
                "rules" => e.word_rules(w),
                _ => e.number(w).unwrap(),
            })
        }
        "hne" => native(l::chhattisgarhi::chhattisgarhi::create_chhattisgarhi(None).unwrap()),
        "rkt" => native(l::rangpuri::rangpuri::create_rangpuri(None).unwrap()),
        "ne" => {
            let e = l::nepali::nepali::create_nepali(None).unwrap();
            Box::new(move |op, w| match op {
                "word" => e.word(w),
                "rules" => e.word_rules(w),
                _ => e.number(w).unwrap(),
            })
        }
        "mr" => {
            let e = l::marathi::marathi::create_marathi(None).unwrap();
            Box::new(move |op, w| match op {
                "word" => e.word(w),
                "rules" => e.word_rules(w),
                _ => e.number(w).unwrap(),
            })
        }
        _ => panic!("hindi-family-word: no replay for {lang}"),
    }
}

type BengaliFamilyFn = Box<dyn Fn(&str, &JsString) -> JsString>;

/// The Bengali maker's per-module surface for one of bn / as / bpy: its normalizer, its engine's text(), and the
/// word level, as the language's own create function builds it.
fn bengali_family(lang: &str) -> BengaliFamilyFn {
    use vernacula_phonemizer::core::abugida::make_abugida_g2p;
    use vernacula_phonemizer::core::foreign::with_host;
    use vernacula_phonemizer::core::js_string::js;
    use vernacula_phonemizer::core::load_manifest::load_manifest;
    use vernacula_phonemizer::core::phonology::load_shared_phonology;
    use vernacula_phonemizer::languages as l;
    use vernacula_phonemizer::languages::bengali::manifest::BengaliDef;
    use vernacula_phonemizer::languages::bengali::normalize::make_bengali_normalizer;
    let dir = match lang {
        "bn" => "bengali",
        "as" => "assamese",
        "bpy" => "bishnupriya",
        _ => panic!("bengali-family: no replay for {lang}"),
    };
    let def: BengaliDef =
        load_manifest(&format!("languages/{dir}"), &format!("{dir}.jsonc")).unwrap();
    let g2p = make_abugida_g2p(&def.abugida, load_shared_phonology().unwrap());
    let norm = make_bengali_normalizer(&def.numbers).unwrap();
    let host = js(lang);
    if lang == "as" {
        use l::assamese::{assamese::create_assamese, normalize::normalize_assamese};
        let e = create_assamese(None).unwrap();
        return Box::new(move |op, x| match op {
            "normalize" => norm(x),
            "as-normalize" => normalize_assamese(x).unwrap(),
            "text" => with_host(&host, || e.text(x)).unwrap(),
            "g2p" => g2p.g2p(x),
            "rules" => e.word_rules(x),
            "word" => e.word(x),
            "number" => e.number(x).unwrap(),
            _ => panic!("bengali-family: unknown op {op}"),
        });
    }
    let e = match lang {
        "bpy" => {
            l::bishnupriya::bishnupriya::create_bishnupriya(None)
                .unwrap()
                .0
        }
        _ => l::bengali::bengali::create_bengali(None).unwrap(),
    };
    Box::new(move |op, x| match op {
        "normalize" => norm(x),
        "text" => with_host(&host, || e.text(x, None)).unwrap(),
        "g2p" => g2p.g2p(x),
        "rules" => e.word_rules(x),
        "word" => e.word(x, None),
        "number" => e.number(x, None).unwrap(),
        _ => panic!("bengali-family: unknown op {op}"),
    })
}
