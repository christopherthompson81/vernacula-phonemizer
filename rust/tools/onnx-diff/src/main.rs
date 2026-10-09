//! Replays ONNX Runtime reference outputs (written by `gen_refs.py` beside this file) through
//! `core::neural` and reports, per model and output: rows bit-identical (a row is one vector along the last
//! axis — one time step's logits), max |diff|, and argmax flips.
//!
//!     cargo run --release -p onnx-diff -- [--refs ../.probe/neural] [--knobs N] [--model STEM]...
//!
//! `--knobs` sets `core::neural::mlas::knobs` bits, which swap one MLAS behaviour for the obvious one, so the
//! cost of each can be measured by switching it off.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::time::Instant;

use vernacula_phonemizer::core::neural::{Data, OnnxModel, Tensor, mlas};

struct Case {
    inputs: Vec<(String, Tensor)>,
    outputs: Vec<(String, Tensor)>,
}

struct Rd<'a> {
    b: &'a [u8],
    p: usize,
}

impl<'a> Rd<'a> {
    fn take(&mut self, n: usize) -> &'a [u8] {
        let s = &self.b[self.p..self.p + n];
        self.p += n;
        s
    }
    fn u8(&mut self) -> u8 {
        self.take(1)[0]
    }
    fn u16(&mut self) -> u16 {
        u16::from_le_bytes(self.take(2).try_into().unwrap())
    }
    fn u32(&mut self) -> u32 {
        u32::from_le_bytes(self.take(4).try_into().unwrap())
    }
    fn i64(&mut self) -> i64 {
        i64::from_le_bytes(self.take(8).try_into().unwrap())
    }
    fn tensor(&mut self) -> (String, Tensor) {
        let nl = self.u16() as usize;
        let name = String::from_utf8(self.take(nl).to_vec()).unwrap();
        let code = self.u8();
        let nd = self.u8() as usize;
        let shape: Vec<usize> = (0..nd).map(|_| self.i64() as usize).collect();
        let n: usize = shape.iter().product();
        let data = match code {
            1 => Data::F32(self.take(4 * n).as_chunks::<4>().0.iter().map(|c| f32::from_le_bytes(*c)).collect()),
            7 => Data::I64(self.take(8 * n).as_chunks::<8>().0.iter().map(|c| i64::from_le_bytes(*c)).collect()),
            2 => Data::U8(self.take(n).to_vec()),
            9 => Data::Bool(self.take(n).iter().map(|&b| b != 0).collect()),
            c => panic!("dtype {c} in reference file"),
        };
        (name, Tensor::new(shape, data).unwrap())
    }
}

fn read_refs(path: &Path) -> Vec<Case> {
    let bytes = std::fs::read(path).unwrap_or_else(|e| panic!("{}: {e}", path.display()));
    assert_eq!(&bytes[..8], b"ONNXREF1", "{}: bad magic", path.display());
    let mut r = Rd { b: &bytes, p: 8 };
    let n = r.u32();
    (0..n)
        .map(|_| {
            let ni = r.u32();
            let inputs = (0..ni).map(|_| r.tensor()).collect();
            let no = r.u32();
            let outputs = (0..no).map(|_| r.tensor()).collect();
            Case { inputs, outputs }
        })
        .collect()
}

fn find_model(data: &Path, stem: &str) -> Option<PathBuf> {
    let want = format!("{stem}.onnx");
    let mut stack = vec![data.to_path_buf()];
    while let Some(d) = stack.pop() {
        for e in std::fs::read_dir(&d).ok()?.flatten() {
            let p = e.path();
            if p.is_dir() {
                stack.push(p);
            } else if p.file_name().is_some_and(|f| f == want.as_str()) {
                return Some(p);
            }
        }
    }
    None
}

#[derive(Default)]
struct Stats {
    rows: usize,
    exact_rows: usize,
    cases: usize,
    exact_cases: usize,
    max_abs: f32,
    argmax_flips: usize,
}

fn argmax(v: &[f32]) -> usize {
    // First maximum, as the engine's argmax takes it.
    let mut best = 0;
    for (i, &x) in v.iter().enumerate() {
        if x > v[best] {
            best = i;
        }
    }
    best
}

fn main() {
    let mut refs = PathBuf::from("../.probe/neural");
    let mut knobs = 0u32;
    let mut only: Vec<String> = Vec::new();
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        match a.as_str() {
            "--refs" => refs = PathBuf::from(args.next().expect("--refs DIR")),
            "--knobs" => knobs = args.next().expect("--knobs N").parse().expect("--knobs N"),
            "--model" => only.push(args.next().expect("--model STEM")),
            other => panic!("unknown argument {other}"),
        }
    }
    mlas::knobs::set(knobs);
    let data = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("../../../data");
    let mut files: Vec<PathBuf> = std::fs::read_dir(&refs)
        .unwrap_or_else(|e| panic!("{}: {e} (run gen_refs.py first)", refs.display()))
        .flatten()
        .map(|e| e.path())
        .filter(|p| p.extension().is_some_and(|x| x == "ref"))
        .collect();
    files.sort();
    println!("knobs = {knobs}");
    for f in files {
        let stem = f.file_stem().unwrap().to_string_lossy().to_string();
        if !only.is_empty() && !only.contains(&stem) {
            continue;
        }
        // A single-op probe model sits beside its reference; a shipped model is found under data/.
        let beside = f.with_extension("onnx");
        let Some(model_path) = (if beside.exists() { Some(beside) } else { find_model(&data, &stem) }) else {
            println!("{stem}: no model under data/");
            continue;
        };
        let model = match OnnxModel::from_bytes(&std::fs::read(&model_path).unwrap()) {
            Ok(m) => m,
            Err(e) => {
                println!("{stem}: LOAD FAILED: {e}");
                continue;
            }
        };
        let cases = read_refs(&f);
        let mut stats: BTreeMap<String, Stats> = BTreeMap::new();
        let mut failed = 0;
        let t0 = Instant::now();
        for case in &cases {
            let ins: Vec<(&str, Tensor)> = case.inputs.iter().map(|(n, t)| (n.as_str(), t.clone())).collect();
            let got = match model.run(&ins) {
                Ok(g) => g,
                Err(e) => {
                    if failed == 0 {
                        println!("{stem}: RUN FAILED: {e}");
                    }
                    failed += 1;
                    continue;
                }
            };
            for (name, want) in &case.outputs {
                let st = stats.entry(name.clone()).or_default();
                let have = &got.iter().find(|(n, _)| n == name).expect("output").1;
                assert_eq!(have.shape, want.shape, "{stem} {name} shape");
                let (Data::F32(h), Data::F32(w)) = (&have.data, &want.data) else { panic!("non-float output") };
                let width = *want.shape.last().unwrap_or(&1);
                let mut case_exact = true;
                for (hr, wr) in h.chunks(width.max(1)).zip(w.chunks(width.max(1))) {
                    st.rows += 1;
                    let exact = hr.iter().zip(wr).all(|(a, b)| a.to_bits() == b.to_bits());
                    if exact {
                        st.exact_rows += 1;
                    } else {
                        case_exact = false;
                    }
                    for (a, b) in hr.iter().zip(wr) {
                        st.max_abs = st.max_abs.max((a - b).abs());
                    }
                    if argmax(hr) != argmax(wr) {
                        st.argmax_flips += 1;
                    }
                }
                st.cases += 1;
                if case_exact {
                    st.exact_cases += 1;
                }
            }
        }
        let dt = t0.elapsed().as_secs_f64();
        for (name, s) in &stats {
            println!(
                "{stem} [{name}]: cases {}/{} exact, rows {}/{} exact, max|diff| {:e}, argmax flips {}  ({:.2}s{})",
                s.exact_cases,
                s.cases,
                s.exact_rows,
                s.rows,
                s.max_abs,
                s.argmax_flips,
                dt,
                if failed > 0 { format!(", {failed} runs FAILED") } else { String::new() }
            );
        }
    }
}
