//! Whole-model tests. The bit-for-bit evidence is the differential (`rust/tools/onnx-diff`); these pin a sample
//! of it so a regression shows up in `cargo test` without the Python environment.

use super::*;

/// (word, element count, FNV-1a-64 of the logits' raw little-endian f32 bytes) as ONNX Runtime 1.27.0 computes
/// them on the golden machine. Generated, never typed: `.venv/bin/python -I rust/tools/onnx-diff/gen_refs.py
/// --pin <words>`.
const PINNED: &[(&str, usize, u64)] = &[
    ("a", 208, 0xb40cf9def8c74efa),
    ("cat", 624, 0x8db10baa11e212fc),
    ("phonemizer", 2080, 0x45176dce296eb78c),
    ("tokenization", 2496, 0x9ba427caedb48b7a),
    (
        "supercalifragilisticexpialidocious",
        7072,
        0xd80e5ce219853d00,
    ),
    ("bellingshausen", 2912, 0x919e49f5fe290dec),
    ("strengths", 1872, 0xcc74afee46cdb6b8),
    ("xylophone", 1872, 0xce1f1fa7011b2dff),
    ("qwzx", 832, 0x2ad6e9ece242ad68),
    ("aardvark", 1664, 0x019c260e01ccc5a6),
    ("incomprehensibilities", 4368, 0x7a741c6e008737ef),
];

fn fnv1a64(bytes: impl Iterator<Item = u8>) -> u64 {
    let mut h = 0xCBF29CE484222325u64;
    for b in bytes {
        h = (h ^ u64::from(b)).wrapping_mul(0x100000001B3);
    }
    h
}

fn english_ids(word: &str) -> Vec<i64> {
    let meta: serde_json::Value = serde_json::from_str(
        &crate::core::data_source::read_data_text("languages/english/en-g2p-tagger.meta.json")
            .unwrap(),
    )
    .unwrap();
    word.chars()
        .map(|c| meta["src"][c.to_string()].as_i64().unwrap())
        .collect()
}

#[test]
fn english_tagger_matches_pinned_ort_logits() {
    let model = load_model("languages/english/en-g2p-tagger.int8.onnx").unwrap();
    assert_eq!(model.input_names().collect::<Vec<_>>(), ["chars"]);
    assert_eq!(model.output_names().collect::<Vec<_>>(), ["logits"]);
    for &(word, n, hash) in PINNED {
        let ids = english_ids(word);
        let t = ids.len();
        let out = model
            .run(&[("chars", Tensor::i64(vec![1, t], ids).unwrap())])
            .unwrap();
        let logits = &out[0].1;
        assert_eq!(logits.shape, vec![1, t, 208], "{word}");
        assert_eq!(logits.len(), n, "{word}");
        let got = fnv1a64(
            logits
                .as_f32()
                .unwrap()
                .iter()
                .flat_map(|v| v.to_le_bytes()),
        );
        assert_eq!(got, hash, "{word}: logits differ from ONNX Runtime");
    }
}

#[test]
fn batch_two_is_refused_not_approximated() {
    let model = load_model("languages/english/en-g2p-tagger.int8.onnx").unwrap();
    let err = model
        .run(&[("chars", Tensor::i64(vec![2, 1], vec![2, 3]).unwrap())])
        .unwrap_err();
    assert!(matches!(err, NeuralError::Unsupported(_)), "{err}");
}

#[test]
fn every_shipped_model_loads() {
    let root = crate::core::data_source::resolve_data_root().expect("data/ beside the checkout");
    let mut stack = vec![root.clone()];
    let mut n = 0;
    while let Some(d) = stack.pop() {
        for e in std::fs::read_dir(&d).unwrap().flatten() {
            let p = e.path();
            if p.is_dir() {
                stack.push(p);
            } else if p.extension().is_some_and(|x| x == "onnx") {
                OnnxModel::from_bytes(&std::fs::read(&p).unwrap())
                    .unwrap_or_else(|e| panic!("{}: {e}", p.display()));
                n += 1;
            }
        }
    }
    assert!(n >= 18, "found only {n} models under {}", root.display());
}

// A hand-built protobuf, to show what load refuses.
fn varint(out: &mut Vec<u8>, mut v: u64) {
    loop {
        let b = (v & 0x7f) as u8;
        v >>= 7;
        if v == 0 {
            out.push(b);
            return;
        }
        out.push(b | 0x80);
    }
}

fn field_bytes(out: &mut Vec<u8>, num: u32, bytes: &[u8]) {
    varint(out, u64::from(num) << 3 | 2);
    varint(out, bytes.len() as u64);
    out.extend_from_slice(bytes);
}

fn field_int(out: &mut Vec<u8>, num: u32, v: u64) {
    varint(out, u64::from(num) << 3);
    varint(out, v);
}

/// ModelProto { ir_version 8, opset "" 17, graph { node { op_type, input "x", output "y", attrs } input x output y } }.
fn one_node_model(op_type: &str, attrs: &[(&str, i64)]) -> Vec<u8> {
    let mut node = Vec::new();
    field_bytes(&mut node, 1, b"x");
    field_bytes(&mut node, 2, b"y");
    field_bytes(&mut node, 4, op_type.as_bytes());
    for (name, v) in attrs {
        let mut a = Vec::new();
        field_bytes(&mut a, 1, name.as_bytes());
        field_int(&mut a, 3, *v as u64);
        field_int(&mut a, 20, 2); // INT
        field_bytes(&mut node, 5, &a);
    }
    let mut vi_x = Vec::new();
    field_bytes(&mut vi_x, 1, b"x");
    let mut vi_y = Vec::new();
    field_bytes(&mut vi_y, 1, b"y");
    let mut graph = Vec::new();
    field_bytes(&mut graph, 1, &node);
    field_bytes(&mut graph, 11, &vi_x);
    field_bytes(&mut graph, 12, &vi_y);
    let mut opset = Vec::new();
    field_int(&mut opset, 2, 17);
    let mut model = Vec::new();
    field_int(&mut model, 1, 8);
    field_bytes(&mut model, 7, &graph);
    field_bytes(&mut model, 8, &opset);
    model
}

#[test]
fn a_supported_one_node_model_runs() {
    let m = OnnxModel::from_bytes(&one_node_model("Softmax", &[("axis", -1)])).unwrap();
    let out = m
        .run(&[("x", Tensor::f32(vec![1, 2], vec![0.0, 0.0]).unwrap())])
        .unwrap();
    assert_eq!(out[0].1.as_f32().unwrap(), &[0.5, 0.5]);
}

#[test]
fn unknown_ops_and_attributes_fail_at_load() {
    let e = OnnxModel::from_bytes(&one_node_model("Erf", &[])).unwrap_err();
    assert!(
        matches!(e, NeuralError::Unsupported(ref m) if m.contains("Erf")),
        "{e}"
    );
    let e = OnnxModel::from_bytes(&one_node_model("Softmax", &[("axis", -1), ("bogus", 1)]))
        .unwrap_err();
    assert!(
        matches!(e, NeuralError::Unsupported(ref m) if m.contains("bogus")),
        "{e}"
    );
    let e = OnnxModel::from_bytes(&[0x0a, 0x05, 0x01]).unwrap_err();
    assert!(matches!(e, NeuralError::Parse(_)), "{e}");
}
