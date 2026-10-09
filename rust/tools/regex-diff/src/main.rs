//! Replays csharp/regex-corpus.jsonl (Node's answers for every distinct pattern in src/) through
//! the crate's `JsRegex` (regress plus the V8-alignment wrapper) over UTF-16 input, and diffs.
//!
//!   cargo run --release -p regex-diff -- ../csharp/regex-corpus.jsonl
use std::collections::BTreeMap;
use vernacula_phonemizer::core::{js_regex::JsRegex, js_string::JsString};

const NULL: &str = "\u{0}null";

/// Undo the extractor's lone-surrogate sentinel (\0S + 4 hex) and encode as UTF-16.
fn decode(s: &str) -> Vec<u16> {
    let mut out = Vec::new();
    let mut it = s.char_indices().peekable();
    let b = s.as_bytes();
    while let Some((i, c)) = it.next() {
        if c == '\0' && b.get(i + 1) == Some(&b'S') && i + 6 <= s.len() {
            if let Ok(v) = u16::from_str_radix(&s[i + 2..i + 6], 16) {
                out.push(v);
                for _ in 0..5 { it.next(); }
                continue;
            }
        }
        let mut buf = [0u16; 2];
        out.extend_from_slice(c.encode_utf16(&mut buf));
    }
    out
}

fn show(s: &[u16]) -> String {
    format!("{:?}", String::from_utf16_lossy(s))
}

fn main() {
    let path = std::env::args().nth(1).unwrap_or_else(|| "../csharp/regex-corpus.jsonl".into());
    let text = std::fs::read_to_string(&path).expect("corpus");
    let (mut ok, mut differ, mut refused) = (0usize, 0usize, 0usize);
    let mut refusals: BTreeMap<String, usize> = BTreeMap::new();
    let mut examples = Vec::new();
    let mut differ_by_flags: BTreeMap<String, usize> = BTreeMap::new();
    for line in text.lines().filter(|l| !l.trim().is_empty()) {
        let doc: serde_json::Value = serde_json::from_str(line).unwrap();
        let pattern = doc["pattern"].as_str().unwrap();
        let flags = doc["flags"].as_str().unwrap();
        let file = doc["file"].as_str().unwrap();
        let global = flags.contains('g');
        let re = match JsRegex::new(pattern, flags) {
            Ok(r) => r,
            Err(e) => {
                refused += 1;
                *refusals.entry(e.to_string()).or_default() += 1;
                if examples.len() < 40 { examples.push(format!("  REFUSED /{pattern}/{flags} — {e}\n    {file}")); }
                continue;
            }
        };
        for pair in doc["matches"].as_array().unwrap() {
            let input = decode(pair[0].as_str().unwrap());
            let want: Vec<Vec<u16>> = pair[1].as_array().unwrap().iter().map(|x| decode(x.as_str().unwrap())).collect();
            let subject = JsString(input.clone());
            let got: Vec<Vec<u16>> = if global {
                re.match_all(&subject).iter().map(|m| m.value(&subject).0).collect()
            } else {
                vec![match re.exec(&subject) {
                    Some(m) => m.value(&subject).0,
                    None => decode(NULL),
                }]
            };
            if got == want { ok += 1; continue; }
            differ += 1;
            *differ_by_flags.entry(flags.to_string()).or_default() += 1;
            if examples.len() < 40 {
                examples.push(format!(
                    "  /{pattern}/{flags}\n    input {}\n    node  [{}]\n    rust  [{}]\n    {file}",
                    show(&input),
                    want.iter().map(|w| show(w)).collect::<Vec<_>>().join(", "),
                    got.iter().map(|w| show(w)).collect::<Vec<_>>().join(", ")
                ));
            }
        }
    }
    println!("{ok} probe results identical, {differ} DIFFER, {refused} patterns refused");
    println!("differ by flags: {differ_by_flags:?}");
    println!("refusals: {refusals:?}");
    for e in &examples { println!("{e}"); }
    std::process::exit(if differ + refused == 0 { 0 } else { 1 });
}
