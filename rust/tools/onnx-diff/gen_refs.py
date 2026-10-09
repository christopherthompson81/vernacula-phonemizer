"""Write ONNX Runtime reference outputs for `onnx-diff` (#1463).

Run from the repo root:  .venv/bin/python -I rust/tools/onnx-diff/gen_refs.py [--out .probe/neural] [model ...]

For every model under data/ it builds an input set, runs it through onnxruntime (CPU EP, default session options --
the same options src/ passes to onnxruntime-node), and writes `<out>/<model-stem>.ref`: every input and every output
tensor of every case, as raw little-endian bits. The Rust side replays the inputs and compares bit for bit.

Format (little-endian): b"ONNXREF1", u32 n_cases; per case: u32 n_inputs, tensors; u32 n_outputs, tensors.
A tensor is: u16 name_len, name (utf-8), u8 dtype (ONNX TensorProto code), u8 ndim, i64 dims[ndim], raw data.

The English input set is the keys of g2p-dict.tsv that the tagger vocabulary covers (the engine declines any other
word), a sample of synthetic OOV-looking strings, and long words (T > 20). The other taggers get random id
sequences drawn from their own vocabulary, lengths 1..48. The Persian restorers are driven step by step: the encoder
on random tokens, then the decoder greedily for a few steps from its own outputs.
"""

import argparse
import glob
import json
import os
import random
import struct
import sys

import numpy as np
import onnx
import onnxruntime as ort

DTYPE_CODE = {np.float32: 1, np.uint8: 2, np.int8: 3, np.int32: 6, np.int64: 7, np.bool_: 9}


def write_tensor(f, name, arr):
    arr = np.ascontiguousarray(arr)
    code = DTYPE_CODE[arr.dtype.type]
    nb = name.encode()
    f.write(struct.pack("<H", len(nb)))
    f.write(nb)
    f.write(struct.pack("<BB", code, arr.ndim))
    for d in arr.shape:
        f.write(struct.pack("<q", d))
    f.write(arr.astype(arr.dtype.newbyteorder("<"), copy=False).tobytes())


def session(path, threads=None):
    so = ort.SessionOptions()
    if threads:
        so.intra_op_num_threads = threads
    return ort.InferenceSession(path, so, providers=["CPUExecutionProvider"])


def english_words(n_dict, rng):
    meta = json.load(open("data/languages/english/en-g2p-tagger.meta.json"))
    src = meta["src"]
    words = []
    for line in open("data/languages/english/g2p-dict.tsv", encoding="utf-8"):
        if line.startswith("#") or "\t" not in line:
            continue
        w = line.split("\t", 1)[0].lower()
        if w and all(c in src for c in w):
            words.append(w)
    words = sorted(set(words))
    rng.shuffle(words)
    picked = words[:n_dict]
    letters = [c for c in src if len(c) == 1]
    # OOV-looking: concatenations of two dictionary words, and pseudo-words from random letters.
    for _ in range(n_dict // 8):
        picked.append(rng.choice(words) + rng.choice(words))
    for _ in range(n_dict // 8):
        picked.append("".join(rng.choice(letters) for _ in range(rng.randint(1, 16))))
    # Long words, T > 20.
    long_ = [w for w in words if len(w) > 20]
    picked += long_
    for _ in range(200):
        picked.append("".join(rng.choice(words) for _ in range(3))[: rng.randint(21, 60)])
    return [[src[c] for c in w] for w in picked]


def tagger_cases(path, n, rng, input_name):
    m = onnx.load(path)
    gather = next(x for x in m.graph.node if x.op_type == "Gather")
    vocab = next(t for t in m.graph.initializer if t.name == gather.input[0]).dims[0]
    cases = []
    for _ in range(n):
        T = rng.choice([1, 2, 3] + list(range(4, 49)))
        cases.append([rng.randrange(2, vocab) for _ in range(T)])
    return cases


def run_tagger(path, out, ids_list, threads=None):
    s = session(path, threads)
    name = s.get_inputs()[0].name
    with open(out, "wb") as f:
        f.write(b"ONNXREF1")
        f.write(struct.pack("<I", len(ids_list)))
        for ids in ids_list:
            x = np.array([ids], dtype=np.int64)
            ys = s.run(None, {name: x})
            f.write(struct.pack("<I", 1))
            write_tensor(f, name, x)
            f.write(struct.pack("<I", len(ys)))
            for o, y in zip(s.get_outputs(), ys):
                write_tensor(f, o.name, y)


def run_restorer(enc_path, dec_path, out, n, rng, steps=6):
    enc, dec = session(enc_path), session(dec_path)
    m = onnx.load(enc_path)
    gather = next(x for x in m.graph.node if x.op_type == "Gather")
    vocab = next(t for t in m.graph.initializer if t.name == gather.input[0]).dims[0]
    bos = json.load(open(enc_path.replace(".enc.onnx", ".meta.json")))["bos"]
    enc_cases, dec_cases = [], []
    for _ in range(n):
        T = rng.randint(1, 40)
        toks = np.array([[rng.randrange(2, vocab) for _ in range(T)]], dtype=np.int64)
        (enc_o,) = enc.run(None, {"tokens": toks})
        enc_cases.append(({"tokens": toks}, {"enc_o": enc_o}))
        h = np.zeros((1, 1, 512), np.float32)
        c = np.zeros((1, 1, 512), np.float32)
        mask = np.ones((1, T), dtype=np.bool_)
        if T > 2 and rng.random() < 0.5:
            mask[0, rng.randint(1, T - 1):] = False
        y = np.array([[bos]], dtype=np.int64)
        for _ in range(steps):
            feeds = {"y": y, "h": h, "c": c, "enc_o": enc_o, "mask": mask}
            logits, h, c = dec.run(None, feeds)
            dec_cases.append((feeds, {"logits": logits, "h_out": h, "c_out": c}))
            y = np.array([[int(np.argmax(logits[0, 0]))]], dtype=np.int64)
    for path, cases in ((out + ".enc.ref", enc_cases), (out + ".dec.ref", dec_cases)):
        with open(path, "wb") as f:
            f.write(b"ONNXREF1")
            f.write(struct.pack("<I", len(cases)))
            for ins, outs in cases:
                f.write(struct.pack("<I", len(ins)))
                for k, v in ins.items():
                    write_tensor(f, k, v)
                f.write(struct.pack("<I", len(outs)))
                for k, v in outs.items():
                    write_tensor(f, k, v)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=".probe/neural")
    ap.add_argument("--n", type=int, default=3000, help="cases per tagger (English: dictionary words)")
    ap.add_argument("--threads", type=int, default=None, help="intra-op threads (default: ORT's default)")
    ap.add_argument("models", nargs="*", help="model stems to run (default: all)")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    print("onnxruntime", ort.__version__, file=sys.stderr)
    for path in sorted(glob.glob("data/**/*.onnx", recursive=True)):
        stem = os.path.basename(path)[: -len(".onnx")]
        if a.models and stem not in a.models:
            continue
        rng = random.Random(1463)
        if stem.endswith(".dec"):
            continue
        if stem.endswith(".enc"):
            base = stem[: -len(".enc")]
            run_restorer(path, path.replace(".enc.onnx", ".dec.onnx"), os.path.join(a.out, base), a.n // 10, rng)
            print("wrote", base, file=sys.stderr)
            continue
        if stem == "en-g2p-tagger.int8":
            ids = english_words(a.n, rng)
        else:
            ids = tagger_cases(path, a.n, rng, None)
        run_tagger(path, os.path.join(a.out, stem + ".ref"), ids, a.threads)
        print("wrote", stem, len(ids), "cases", file=sys.stderr)


if __name__ == "__main__":
    main()
