//! The golden gate: `phonemize_best(text, lang)` over `csharp/goldens/<lang>.tsv` (text <TAB> ipa), which
//! `tools/gen_parity_goldens.mts` generates with `phonemizeAsync`. Byte-identical or it is not done.
//!
//! ⚠ ON THE MACHINE THAT GENERATED THE GOLDENS ONLY, for ONNX-dependent languages (csharp/PORTING.md).
//!
//!   cargo run --release -p parity -- [--sync] [lang …]     (default: every ported language)
use vernacula_phonemizer::{LANGUAGES, phonemize, phonemize_best};

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let sync = args.iter().any(|a| a == "--sync");
    let langs: Vec<String> = {
        let named: Vec<String> = args
            .iter()
            .filter(|a| !a.starts_with("--"))
            .cloned()
            .collect();
        if named.is_empty() {
            LANGUAGES.iter().map(|s| s.to_string()).collect()
        } else {
            named
        }
    };
    let root = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../csharp/goldens");
    let mut total_bad = 0;
    for lang in &langs {
        let text = std::fs::read_to_string(root.join(format!("{lang}.tsv")))
            .unwrap_or_else(|e| panic!("{lang}: {e}"));
        let (mut ok, mut bad) = (0, 0);
        for line in text.lines().filter(|l| !l.is_empty()) {
            let (input, want) = line.split_once('\t').expect("text<TAB>ipa");
            let got = if sync {
                phonemize(input, lang)
            } else {
                phonemize_best(input, lang)
            }
            .unwrap();
            if got == want {
                ok += 1;
            } else {
                bad += 1;
                if bad <= 8 {
                    println!("  [{lang}] {input}\n    want {want}\n    got  {got}");
                }
            }
        }
        println!("{lang}: {ok}/{} identical, {bad} differ", ok + bad);
        total_bad += bad;
    }
    std::process::exit(if total_bad == 0 { 0 } else { 1 });
}
