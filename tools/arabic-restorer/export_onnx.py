#!/usr/bin/env python3
"""Export the trained multilingual harakat BiLSTM to ONNX for the LIVE rider phonemizers (the neural GENERALIZATION
tier under the exact-match lexicon). Mirrors the Arabic diacritizer.onnx pipeline: fp32 export → parity check vs
PyTorch (argmax must match exactly) → int8 dynamic-quantize (keeps the committed model near the Arabic 15 MB
footprint) → re-check quantized argmax agreement. Writes the .onnx + copies the sidecar meta beside the TS module.

  /mnt/data/ar-diac-venv/bin/python export_onnx.py
"""
import json, os, sys
import torch, torch.nn as nn
import numpy as np
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType

HERE = os.path.dirname(os.path.abspath(__file__))
CKPT = "/mnt/data/ar-diac/bilstm_multilingual.pt"
DEST = os.path.join(HERE, "..", "..", "src", "core")  # beside riderDiacritizer.ts
FP32 = "/tmp/rider_diac.fp32.onnx"
INT8 = os.path.join(DEST, "riderDiacritizer.onnx")
META = os.path.join(DEST, "riderDiacritizer.meta.json")

ck = torch.load(CKPT, map_location="cpu", weights_only=False)
chars, labels, LANG_TOK, cfg = ck["chars"], ck["labels"], ck["lang_tokens"], ck["cfg"]
ilabels = {i: l for l, i in labels.items()}


class BiLSTM(nn.Module):
    def __init__(s, nc, nl, emb, h, ly):
        super().__init__()
        s.emb = nn.Embedding(nc, emb, padding_idx=0)
        s.lstm = nn.LSTM(emb, h, num_layers=ly, batch_first=True, bidirectional=True)
        s.fc = nn.Linear(2 * h, nl)
    def forward(s, x): return s.fc(s.lstm(s.emb(x))[0])


model = BiLSTM(len(chars), len(labels), cfg["emb"], cfg["hidden"], cfg["layers"]).eval()
model.load_state_dict(ck["state"])
print(f"# {sum(p.numel() for p in model.parameters())/1e6:.1f}M params, {len(chars)} chars, {len(labels)} labels",
      file=sys.stderr)

# fp32 export — dynamic seq length (batch fixed to 1: the TS pre-pass runs one word at a time).
dummy = torch.tensor([[chars[LANG_TOK["ur"]], chars.get("ا", 1), chars.get("ب", 1)]], dtype=torch.long)
torch.onnx.export(
    model, dummy, FP32,
    input_names=["input"], output_names=["logits"],
    dynamic_axes={"input": {1: "seq"}, "logits": {1: "seq"}},
    opset_version=17,
)

# Parity vs PyTorch — argmax must match on real skeletons across every language.
def torch_argmax(seq):
    with torch.no_grad():
        return model(torch.tensor([seq], dtype=torch.long)).argmax(-1)[0].tolist()

def ort_argmax(sess, seq):
    logits = sess.run(["logits"], {"input": np.array([seq], dtype=np.int64)})[0]
    return logits[0].argmax(-1).tolist()

SAMPLES = {"ur": "آبرو", "fa": "مدرسه", "ps": "کوربه", "pa": "سنگهی", "ar": "كتب"}
def make_seq(lang, w): return [chars[LANG_TOK[lang]]] + [chars.get(c, 1) for c in w]

sess32 = ort.InferenceSession(FP32, providers=["CPUExecutionProvider"])
mismatch = 0
for lang, w in SAMPLES.items():
    seq = make_seq(lang, w)
    t, o = torch_argmax(seq), ort_argmax(sess32, seq)
    if t != o:
        mismatch += 1; print(f"  FP32 MISMATCH {lang} {w}: torch {t} vs ort {o}", file=sys.stderr)
print(f"# fp32 parity: {len(SAMPLES)-mismatch}/{len(SAMPLES)} exact", file=sys.stderr)
assert mismatch == 0, "fp32 ONNX diverges from PyTorch"

# int8 dynamic quantization (weights only) — shrinks ~4×; embedding+LSTM+Linear all quantize.
quantize_dynamic(FP32, INT8, weight_type=QuantType.QInt8)
sess8 = ort.InferenceSession(INT8, providers=["CPUExecutionProvider"])
q_mismatch = 0
for lang, w in SAMPLES.items():
    seq = make_seq(lang, w)
    if torch_argmax(seq) != ort_argmax(sess8, seq):
        q_mismatch += 1
print(f"# int8 argmax agreement: {len(SAMPLES)-q_mismatch}/{len(SAMPLES)} match fp32-argmax", file=sys.stderr)

json.dump({"chars": chars, "labels": labels, "lang_tokens": LANG_TOK},
          open(META, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(f"# wrote {INT8} ({os.path.getsize(INT8)/1e6:.1f} MB) + {os.path.basename(META)}", file=sys.stderr)
