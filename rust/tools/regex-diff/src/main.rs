//! Replays csharp/regex-corpus.jsonl (Node's answers for every distinct pattern in src/) through
//! the crate's `JsRegex` (regress plus the V8-alignment wrapper) over UTF-16 input, and diffs.
//!
//!   cargo run --release -p regex-diff -- ../csharp/regex-corpus.jsonl
//!
//! Patterns run in parallel (`REGEX_DIFF_THREADS`, default: every core), and each one gets
//! `REGEX_DIFF_TIMEOUT_SECS` (default 30) for its probes plus its soundness check. A pattern that runs past
//! that is named and the run exits 2: a stuck regex is a finding, not a wait (a regress backtracking loop
//! once stalled this tool silently for 20 minutes, #1556).
use std::collections::BTreeMap;
use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};
use std::time::{Duration, Instant};
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
                for _ in 0..5 {
                    it.next();
                }
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

/// One corpus pattern's outcome; the report is assembled from these in corpus order.
#[derive(Default)]
struct Outcome {
    ok: usize,
    differ: usize,
    refusal: Option<String>,
    /// Example lines, in the order the sequential tool printed them.
    examples: Vec<String>,
    /// The `differ_by_flags` key, once per differing probe.
    differ_flags: usize,
    /// Soundness: (subjects checked, the pattern skips the mid-pair scan, UNSOUND lines).
    checked: usize,
    skipping: bool,
    unsound: Vec<String>,
}

fn env_usize(name: &str) -> Option<usize> {
    std::env::var(name).ok().and_then(|v| v.parse().ok())
}

fn main() {
    let path = std::env::args()
        .nth(1)
        .unwrap_or_else(|| "../csharp/regex-corpus.jsonl".into());
    let text = std::fs::read_to_string(&path).expect("corpus");
    let docs: Vec<serde_json::Value> = text
        .lines()
        .filter(|l| !l.trim().is_empty())
        .map(|l| serde_json::from_str(l).unwrap())
        .collect();
    let threads = env_usize("REGEX_DIFF_THREADS")
        .unwrap_or_else(|| std::thread::available_parallelism().map_or(1, |n| n.get()))
        .max(1);
    let limit = Duration::from_secs(env_usize("REGEX_DIFF_TIMEOUT_SECS").unwrap_or(30) as u64);

    let next = AtomicUsize::new(0);
    let done = AtomicBool::new(false);
    // What each worker is running, and since when: the watchdog's view.
    let running: Vec<Mutex<Option<(usize, Instant)>>> =
        (0..threads).map(|_| Mutex::new(None)).collect();
    let outcomes: Vec<Mutex<Option<Outcome>>> = docs.iter().map(|_| Mutex::new(None)).collect();

    std::thread::scope(|scope| {
        scope.spawn(|| watchdog(&docs, &running, &done, limit));
        let workers: Vec<_> = (0..threads)
            .map(|w| {
                let (next, running, outcomes, docs) = (&next, &running, &outcomes, &docs);
                scope.spawn(move || {
                    loop {
                        let i = next.fetch_add(1, Ordering::Relaxed);
                        if i >= docs.len() {
                            break;
                        }
                        *running[w].lock().unwrap() = Some((i, Instant::now()));
                        let outcome = run_pattern(&docs[i]);
                        *running[w].lock().unwrap() = None;
                        *outcomes[i].lock().unwrap() = Some(outcome);
                    }
                })
            })
            .collect();
        for h in workers {
            h.join().unwrap();
        }
        done.store(true, Ordering::Relaxed);
    });

    let outcomes: Vec<Outcome> = outcomes
        .into_iter()
        .map(|m| m.into_inner().unwrap().unwrap())
        .collect();
    let (mut ok, mut differ, mut refused) = (0usize, 0usize, 0usize);
    let mut refusals: BTreeMap<String, usize> = BTreeMap::new();
    let mut examples = Vec::new();
    let mut differ_by_flags: BTreeMap<String, usize> = BTreeMap::new();
    let (mut checked, mut skipping, mut unsound) = (0usize, 0usize, 0usize);
    for (doc, o) in docs.iter().zip(&outcomes) {
        ok += o.ok;
        differ += o.differ;
        if let Some(e) = &o.refusal {
            refused += 1;
            *refusals.entry(e.clone()).or_default() += 1;
        }
        if o.differ_flags > 0 {
            *differ_by_flags
                .entry(doc["flags"].as_str().unwrap().to_string())
                .or_default() += o.differ_flags;
        }
        for e in &o.examples {
            if examples.len() < 40 {
                examples.push(e.clone());
            }
        }
        checked += o.checked;
        skipping += o.skipping as usize;
        for line in &o.unsound {
            unsound += 1;
            if unsound <= 5 {
                println!("{line}");
            }
        }
    }
    println!(
        "mid-pair analysis: skips the scan for {skipping} u-patterns; {checked} astral subjects, {unsound} UNSOUND"
    );
    if unsound > 0 {
        std::process::exit(1);
    }
    println!("{ok} probe results identical, {differ} DIFFER, {refused} patterns refused");
    println!("differ by flags: {differ_by_flags:?}");
    println!("refusals: {refusals:?}");
    for e in &examples {
        println!("{e}");
    }
    std::process::exit(if differ + refused == 0 { 0 } else { 1 });
}

/// Names any pattern that has run longer than `limit` and ends the process: a scoped thread cannot be
/// cancelled, and a regex stuck in a loop never returns.
fn watchdog(
    docs: &[serde_json::Value],
    running: &[Mutex<Option<(usize, Instant)>>],
    done: &AtomicBool,
    limit: Duration,
) {
    while !done.load(Ordering::Relaxed) {
        std::thread::sleep(Duration::from_millis(100));
        for slot in running {
            if let Some((i, since)) = *slot.lock().unwrap()
                && since.elapsed() > limit
            {
                let d = &docs[i];
                println!(
                    "TIMEOUT after {}s: /{}/{} — {} (corpus line {})",
                    limit.as_secs(),
                    d["pattern"].as_str().unwrap_or(""),
                    d["flags"].as_str().unwrap_or(""),
                    d["file"].as_str().unwrap_or(""),
                    i + 1
                );
                std::process::exit(2);
            }
        }
    }
}

/// The probes, then the soundness check, for one corpus pattern.
fn run_pattern(doc: &serde_json::Value) -> Outcome {
    let mut o = Outcome::default();
    let pattern = doc["pattern"].as_str().unwrap();
    let flags = doc["flags"].as_str().unwrap();
    let file = doc["file"].as_str().unwrap();
    let global = flags.contains('g');
    let re = match JsRegex::new(pattern, flags) {
        Ok(r) => r,
        Err(e) => {
            o.examples
                .push(format!("  REFUSED /{pattern}/{flags} — {e}\n    {file}"));
            o.refusal = Some(e.to_string());
            return o;
        }
    };
    for pair in doc["matches"].as_array().unwrap() {
        let input = decode(pair[0].as_str().unwrap());
        let want: Vec<Vec<u16>> = pair[1]
            .as_array()
            .unwrap()
            .iter()
            .map(|x| decode(x.as_str().unwrap()))
            .collect();
        let subject = JsString(input.clone());
        let got: Vec<Vec<u16>> = if global {
            re.match_all(&subject)
                .iter()
                .map(|m| m.value(&subject).0)
                .collect()
        } else {
            vec![match re.exec(&subject) {
                Some(m) => m.value(&subject).0,
                None => decode(NULL),
            }]
        };
        if got == want {
            o.ok += 1;
            continue;
        }
        o.differ += 1;
        o.differ_flags += 1;
        o.examples.push(format!(
            "  /{pattern}/{flags}\n    input {}\n    node  [{}]\n    rust  [{}]\n    {file}",
            show(&input),
            want.iter().map(|w| show(w)).collect::<Vec<_>>().join(", "),
            got.iter().map(|w| show(w)).collect::<Vec<_>>().join(", ")
        ));
    }
    soundness(doc, pattern, flags, &mut o);
    o
}

/// `may_start_mid_pair` may only SKIP work: for a `u` pattern, over astral-heavy subjects, the result must
/// equal the full mid-pair scan's.
fn soundness(doc: &serde_json::Value, pattern: &str, flags: &str, o: &mut Outcome) {
    if !flags.contains('u') {
        return;
    }
    let (Ok(fast), Ok(full)) = (JsRegex::new(pattern, flags), JsRegex::new(pattern, flags)) else {
        return;
    };
    let full = full.with_full_scan();
    o.skipping = !fast.scans_mid_pair();
    let mut subjects: Vec<Vec<u16>> = [
        "𠀁𫝀😀",
        "😀😀a😀",
        "a𝒜b𝒜",
        "x 😀 y",
        "𠀁 𫝀. 😀, a",
        "ab😀cd😀😀ef",
        "😀",
    ]
    .iter()
    .map(|s| s.encode_utf16().collect())
    .collect();
    for pair in doc["matches"].as_array().unwrap() {
        let s = decode(pair[0].as_str().unwrap());
        subjects.push(s.iter().flat_map(|&u| [u, 0xD83D, 0xDE00]).collect());
    }
    for subj in subjects {
        let s = JsString(subj);
        o.checked += 1;
        let a: Vec<_> = fast.match_all(&s).iter().map(|m| m.range.clone()).collect();
        let b: Vec<_> = full.match_all(&s).iter().map(|m| m.range.clone()).collect();
        if a != b {
            o.unsound
                .push(format!("  UNSOUND /{pattern}/{flags} on {}", show(&s.0)));
        }
    }
}
