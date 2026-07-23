#!/usr/bin/env python3
"""Export the saved Hebrew Phase-2 tagger (he_tagger.pt) to int8 ONNX + meta for the TS runtime. A single BiLSTM
forward pass: skeleton char-ids [1,L] → tag logits [1,L,nTags]. The consonant-consistency mask + masked argmax +
tag concatenation happen in TS (hebrewTagger.ts, via the shared core/structuralTagger.ts). No decode loop.

  python tools/hebrew/export_he_tagger_onnx.py src/languages/hebrew   # → he-tagger.int8.onnx + .meta.json
"""
import sys, os, json
import torch, torch.nn as nn
SP = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else SP
ck = torch.load(f"{SP}/he_tagger.pt", map_location="cpu", weights_only=False)
cv, lv, cm = ck["cv"], ck["lv"], ck["char_mask"]; ilv = {i: t for t, i in lv.items()}

class Tagger(nn.Module):
    def __init__(s, nc, nl, emb=128, h=256):
        super().__init__(); s.e = nn.Embedding(nc, emb, 0)
        s.lstm = nn.LSTM(emb, h, 2, batch_first=True, bidirectional=True, dropout=0.2); s.o = nn.Linear(2 * h, nl)
    def forward(s, x): return s.o(s.lstm(s.e(x))[0])

m = Tagger(len(cv), len(lv)); m.load_state_dict(ck["model"]); m.eval()
dummy = torch.ones(1, 8, dtype=torch.long)
fp32 = f"{OUT}/he-tagger.onnx"
# dynamo=False → legacy exporter keeps the length axis dynamic (the kwarg only exists on newer torch; older
# torch defaults to the same legacy exporter, so fall back without it)
_export_kw = dict(input_names=["chars"], output_names=["logits"],
    dynamic_axes={"chars": {0: "B", 1: "L"}, "logits": {0: "B", 1: "L"}}, opset_version=17)
try:
    torch.onnx.export(m, dummy, fp32, **_export_kw, dynamo=False)
except TypeError:
    torch.onnx.export(m, dummy, fp32, **_export_kw)
# meta: char→id, tag-id→IPA chunk, per-char valid tag-ids (the consonant mask, pad excluded)
charTags = {str(ci): [i for i in range(cm.shape[1]) if cm[ci, i].item() > -1e8 and i != 0] for _, ci in cv.items()}
meta = {"src": cv, "tags": {str(i): t for i, t in ilv.items()}, "charTags": charTags}
json.dump(meta, open(f"{OUT}/he-tagger.meta.json", "w"), ensure_ascii=False)

from onnxruntime.quantization import quantize_dynamic, QuantType
quantize_dynamic(fp32, f"{OUT}/he-tagger.int8.onnx", weight_type=QuantType.QInt8)
os.remove(fp32)
print(f"exported: int8 {os.path.getsize(OUT+'/he-tagger.int8.onnx')//1024}KB | chars {len(cv)} tags {len(lv)}")

# sanity: run the int8 graph + mask on a few UNVOCALIZED words
import onnxruntime as ort, numpy as np
sess = ort.InferenceSession(f"{OUT}/he-tagger.int8.onnx")
def infer(word):
    ids = np.array([[cv.get(c, 1) for c in word]], dtype=np.int64)
    lo = sess.run(["logits"], {"chars": ids})[0][0]
    out = []
    for k, c in enumerate(word):
        valid = charTags[str(cv.get(c, 1))]
        best = max(valid, key=lambda t: lo[k][t]) if valid else int(lo[k].argmax())
        out.append(ilv.get(best, ""))
    return "".join(out)
for w in ["שלום", "בית", "ילד", "מלך", "ירושלים"]:
    print(f"   {w} → {infer(w)}")
