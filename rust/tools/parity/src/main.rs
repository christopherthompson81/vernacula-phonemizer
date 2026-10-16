//! The golden gate: `phonemize_best(text, lang)` over `csharp/goldens/<lang>.tsv` (text <TAB> ipa), which
//! `tools/gen_parity_goldens.mts` generates with `phonemizeAsync`. Byte-identical or it is not done.
//!
//! ⚠ ON THE MACHINE THAT GENERATED THE GOLDENS ONLY, for ONNX-dependent languages (csharp/PORTING.md).
//!
//!   cargo run --release -p parity -- [--sync] [--jobs N] [lang …]     (default: every ported language)
//!
//! `--jobs N` runs N worker processes, each handed the next unstarted language as it reports the last one —
//! the scheme `tools/check-goldens.mts --jobs` uses, for the same reasons (see `pooled`). 1, the default, is
//! the serial run in this process. ⚠ If a `--jobs` run and a serial run ever disagree, the serial run is the
//! one that counts, and the disagreement is the finding.
use std::collections::VecDeque;
use std::io::{BufRead, BufReader, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};

use vernacula_phonemizer::{LANGUAGES, phonemize, phonemize_best};

/// Ends one language's report on a worker's stdout. A record separator, so no golden text can contain it.
const END: &str = "\u{1e}END";

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let sync = args.iter().any(|a| a == "--sync");
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../csharp/goldens");
    if args.iter().any(|a| a == "--child") {
        return child(&root, sync);
    }
    let jobs = match args.iter().position(|a| a == "--jobs") {
        Some(i) => args
            .get(i + 1)
            .and_then(|n| n.parse::<usize>().ok())
            .filter(|&n| n >= 1)
            .unwrap_or_else(|| panic!("--jobs takes a positive integer")),
        None => 1,
    };
    let named: Vec<String> = args
        .iter()
        .enumerate()
        .filter(|(i, a)| !a.starts_with("--") && (*i == 0 || args[i - 1] != "--jobs"))
        .map(|(_, a)| a.clone())
        .collect();
    let langs: Vec<String> = if named.is_empty() {
        LANGUAGES.iter().map(|s| s.to_string()).collect()
    } else {
        named
    };
    // ⚠ CAPPED AT THE CORE COUNT: each worker is a whole process that loads its own engines and data, so more
    // workers than cores only adds memory and contention.
    let cores = std::thread::available_parallelism().map_or(1, |n| n.get());
    let jobs = jobs.min(cores).min(langs.len().max(1));
    let total_bad = if jobs == 1 {
        let mut out = std::io::stdout().lock();
        langs.iter().map(|l| check(&root, l, sync, &mut out)).sum()
    } else {
        pooled(&root, &langs, sync, jobs)
    };
    std::process::exit(if total_bad == 0 { 0 } else { 1 });
}

/// Check one language, writing its report to `out`; returns the number of rows that differ.
fn check(root: &Path, lang: &str, sync: bool, out: &mut impl Write) -> usize {
    // ⚠ THE FOREIGN-OOV MEMO IS PROCESS-WIDE, and tools/gen_parity_goldens.mts clears it per language (as the
    // C# parity tool does): without this, a mixed-script language's prewarm leaves neural readings behind that a
    // later Latin-script language picks up, so a full run fails rows a one-language run passes. It is also why
    // `--jobs` uses processes, not threads: two languages at once in one process would share the memo.
    vernacula_phonemizer::core::foreign::clear_foreign_oov();
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
                writeln!(out, "  [{lang}] {input}\n    want {want}\n    got  {got}").unwrap();
            }
        }
    }
    writeln!(out, "{lang}: {ok}/{} identical, {bad} differ", ok + bad).unwrap();
    bad
}

/// A worker: one language code per stdin line, each answered with its report, then `END <bad>`.
fn child(root: &Path, sync: bool) {
    let mut out = std::io::stdout().lock();
    for lang in std::io::stdin().lock().lines() {
        let lang = lang.unwrap();
        let bad = check(root, &lang, sync, &mut out);
        writeln!(out, "{END} {bad}").unwrap();
        out.flush().unwrap();
    }
}

/// `--jobs N`: N long-lived workers, each handed the next unstarted language as it reports the last one.
///
/// ⚠ WORK-STEALING, NOT A STATIC SPLIT: costs are uneven (bn 2.4 s against a median well under 0.2 s), so a
/// fixed partition leaves cores idle behind one language. ⚠ LARGEST GOLDEN FIRST, so a slow language is not
/// picked up last; file size is a free, always-current proxy. Reports are printed in the order asked for, so
/// the output does not depend on scheduling.
fn pooled(root: &Path, langs: &[String], sync: bool, jobs: usize) -> usize {
    let size = |l: &String| std::fs::metadata(root.join(format!("{l}.tsv"))).map_or(0, |m| m.len());
    let mut order: Vec<(usize, &String)> = langs.iter().enumerate().collect();
    order.sort_by_key(|(_, l)| std::cmp::Reverse(size(l)));
    let queue = Arc::new(Mutex::new(
        order
            .into_iter()
            .map(|(i, l)| (i, l.clone()))
            .collect::<VecDeque<_>>(),
    ));
    let reports: Arc<Mutex<Vec<Option<(String, usize)>>>> =
        Arc::new(Mutex::new(vec![None; langs.len()]));
    let exe: PathBuf = std::env::current_exe().expect("own path");
    let workers: Vec<_> = (0..jobs)
        .map(|_| {
            let (queue, reports, exe) = (queue.clone(), reports.clone(), exe.clone());
            std::thread::spawn(move || -> Result<(), String> {
                let mut cmd = Command::new(exe);
                cmd.arg("--child");
                if sync {
                    cmd.arg("--sync");
                }
                let mut proc = cmd
                    .stdin(Stdio::piped())
                    .stdout(Stdio::piped())
                    .spawn()
                    .map_err(|e| e.to_string())?;
                let mut stdin = proc.stdin.take().unwrap();
                let mut lines = BufReader::new(proc.stdout.take().unwrap()).lines();
                loop {
                    let Some((i, lang)) = queue.lock().unwrap().pop_front() else {
                        break;
                    };
                    writeln!(stdin, "{lang}").map_err(|e| format!("{lang}: {e}"))?;
                    stdin.flush().map_err(|e| format!("{lang}: {e}"))?;
                    let mut report = String::new();
                    let bad = loop {
                        let line = lines
                            .next()
                            .ok_or_else(|| {
                                format!("{lang}: the worker stopped before reporting it")
                            })?
                            .map_err(|e| format!("{lang}: {e}"))?;
                        if let Some(n) = line.strip_prefix(END) {
                            break n
                                .trim()
                                .parse::<usize>()
                                .map_err(|e| format!("{lang}: {e}"))?;
                        }
                        report.push_str(&line);
                        report.push('\n');
                    };
                    reports.lock().unwrap()[i] = Some((report, bad));
                }
                drop(stdin);
                // ⚠ A WORKER THAT DIES IS A FAILED RUN, NOT A SHORTER ONE.
                let status = proc.wait().map_err(|e| e.to_string())?;
                if status.success() {
                    Ok(())
                } else {
                    Err(format!("a worker exited with {status}"))
                }
            })
        })
        .collect();
    let mut failed = false;
    for w in workers {
        if let Err(e) = w
            .join()
            .unwrap_or_else(|_| Err("a worker thread panicked".into()))
        {
            eprintln!("--jobs: {e}");
            failed = true;
        }
    }
    let reports = std::mem::take(&mut *reports.lock().unwrap());
    // ⚠ EVERY LANGUAGE MUST COME BACK: a lost one would otherwise just be a shorter green report.
    let missing = reports.iter().filter(|r| r.is_none()).count();
    if failed || missing > 0 {
        eprintln!(
            "--jobs: {} of {} languages came back — the run is incomplete",
            langs.len() - missing,
            langs.len()
        );
        std::process::exit(2);
    }
    let mut total_bad = 0;
    for (report, bad) in reports.into_iter().flatten() {
        print!("{report}");
        total_bad += bad;
    }
    total_bad
}
