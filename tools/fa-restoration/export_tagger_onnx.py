#!/usr/bin/env python3
"""Export the saved fa STRUCTURAL tagger (fa_tagger.pt) to int8 ONNX + meta for the TS runtime. The tagger is a
single BiLSTM forward pass: char-ids [1,L] → tag logits [1,L,nTags]. The consonant-consistency mask + argmax +
tag-assembly happen in TS. No autoregressive decode → no degeneration, tiny + fast."""
import sys, json
import torch, torch.nn as nn
SP = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else SP   # output dir
ck = torch.load(f"{SP}/fa_tagger.pt", map_location="cpu", weights_only=False)
cv, lv, cm = ck["cv"], ck["lv"], ck["char_mask"]; ilv = {i: t for t, i in lv.items()}
class Tagger(nn.Module):
    def __init__(s, nc, nl, emb=128, h=256):
        super().__init__(); s.e=nn.Embedding(nc,emb,0); s.lstm=nn.LSTM(emb,h,2,batch_first=True,bidirectional=True,dropout=0.2); s.o=nn.Linear(2*h,nl)
    def forward(s, x): return s.o(s.lstm(s.e(x))[0])
m = Tagger(len(cv), len(lv)); m.load_state_dict(ck["model"]); m.eval()
dummy = torch.ones(1, 8, dtype=torch.long)
fp32 = f"{OUT}/fa-tagger.onnx"
torch.onnx.export(m, dummy, fp32, input_names=["chars"], output_names=["logits"],
    dynamic_axes={"chars": {0: "B", 1: "L"}, "logits": {0: "B", 1: "L"}}, opset_version=17)
# meta: char→id, id→tag, and per-char valid tag-ids (the consonant mask, compact)
charTags = {}
for c, ci in cv.items():
    valid = [i for i in range(cm.shape[1]) if cm[ci, i].item() > -1e8]
    charTags[str(ci)] = valid
meta = {"src": cv, "tags": {str(i): t for i, t in ilv.items()}, "charTags": charTags}
json.dump(meta, open(f"{OUT}/fa-tagger.meta.json", "w"), ensure_ascii=False)
# int8 quantize
from onnxruntime.quantization import quantize_dynamic, QuantType
quantize_dynamic(fp32, f"{OUT}/fa-tagger.int8.onnx", weight_type=QuantType.QInt8)
import os
print(f"exported: fp32 {os.path.getsize(fp32)//1024}KB | int8 {os.path.getsize(OUT+'/fa-tagger.int8.onnx')//1024}KB | chars {len(cv)} tags {len(lv)}")
# quick sanity: run fp32 onnx via onnxruntime on a word, apply mask, print
import onnxruntime as ort, numpy as np
sess = ort.InferenceSession(f"{OUT}/fa-tagger.int8.onnx")
def infer(word):
    ids = np.array([[cv.get(c, 1) for c in word]], dtype=np.int64)
    lo = sess.run(["logits"], {"chars": ids})[0][0]  # [L, nTags]
    out = []
    for k, c in enumerate(word):
        valid = charTags[str(cv.get(c, 1))]
        best = max(valid, key=lambda t: lo[k][t]) if valid else int(lo[k].argmax())
        out.append(ilv.get(best, ""))
    return "".join(out)
for w in ["روی", "دیوار", "کاغذهای", "خاصی"]:
    print(f"   {w} → {infer(w)}")
