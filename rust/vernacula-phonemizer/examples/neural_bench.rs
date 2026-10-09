//! Times the pieces of one English tagger call. `cargo run --release --example neural_bench`
use std::time::Instant;
use vernacula_phonemizer::core::neural::{mlas, OnnxModel, Tensor};

fn main() {
    let bytes = std::fs::read(concat!(env!("CARGO_MANIFEST_DIR"), "/../../data/languages/english/en-g2p-tagger.int8.onnx")).unwrap();
    let m = OnnxModel::from_bytes(&bytes).unwrap();
    let ids: Vec<i64> = (0..10).map(|i| 2 + (i * 7) % 26).collect();
    let n = 2000;
    let t = Instant::now();
    for _ in 0..n {
        m.run(&[("chars", Tensor::i64(vec![1, ids.len()], ids.clone()).unwrap())]).unwrap();
    }
    println!("run T=10: {:.1} us", t.elapsed().as_secs_f64() * 1e6 / n as f64);

    let w: Vec<i8> = (0..256 * 1024).map(|i| (i * 31 % 255) as i8).collect();
    let q = mlas::QWeights::new_s8(&w, 256, 1024);
    let a: Vec<u8> = (0..256).map(|i| (i * 13 % 256) as u8).collect();
    let mut out = Vec::new();
    let t = Instant::now();
    for _ in 0..20000 {
        q.gemm(&a, 1, 100, &mut out);
    }
    println!("gemm 1x256x1024: {:.2} us", t.elapsed().as_secs_f64() * 1e6 / 20000.0);
    let mut v: Vec<f32> = (0..1024).map(|i| i as f32 * 0.01 - 5.0).collect();
    let t = Instant::now();
    for _ in 0..20000 {
        mlas::logistic(&mut v[..768]);
        mlas::tanh(&mut v[768..]);
    }
    println!("activations 1024: {:.2} us", t.elapsed().as_secs_f64() * 1e6 / 20000.0);
    let t = Instant::now();
    let mut qq = Vec::new();
    for _ in 0..20000 {
        let (s, z) = mlas::quant_params_u8(&v[..256]);
        mlas::quantize_u8(&v[..256], s, z, &mut qq);
    }
    println!("quantize 256: {:.2} us", t.elapsed().as_secs_f64() * 1e6 / 20000.0);
}
