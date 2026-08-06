#!/usr/bin/env python3
"""Export the saved Bengali G2P tagger (bn_tagger.pt) to int8 ONNX + meta for the TS runtime. The tagger is a
single BiLSTM forward pass: grapheme-ids [1,L] → tag logits [1,L,nTags]. The consonant-consistency mask + masked
argmax + tag concatenation happen in TS (bengaliTagger.ts). No autoregressive decode → no degeneration, tiny+fast.

  python export_bn_tagger_onnx.py src/languages/bengali   # reads bn_tagger.pt, writes bn-g2p-tagger.{int8.onnx,meta.json}
"""
import numpy as np
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType
import sys
import os
import json
import torch
import torch.nn as nn
SP = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else SP
ck = torch.load(f"{SP}/bn_tagger.pt", map_location="cpu", weights_only=False)
cv, lv, cm = ck["cv"], ck["lv"], ck["char_mask"]
ilv = {i: t for t, i in lv.items()}


class Tagger(nn.Module):
    def __init__(s, nc, nl, emb=128, h=256):
        super().__init__()
        s.e = nn.Embedding(nc, emb, 0)
        s.lstm = nn.LSTM(emb, h, 2, batch_first=True,
                         bidirectional=True, dropout=0.2)
        s.o = nn.Linear(2 * h, nl)

    def forward(s, x): return s.o(s.lstm(s.e(x))[0])


m = Tagger(len(cv), len(lv))
m.load_state_dict(ck["model"])
m.eval()
dummy = torch.ones(1, 8, dtype=torch.long)
fp32 = f"{OUT}/bn-g2p-tagger.onnx"
# dynamo=False → legacy TorchScript exporter, which honors dynamic_axes (the newer dynamo path specializes L to the
# dummy length and breaks variable-length inference).
torch.onnx.export(m, dummy, fp32, input_names=["chars"], output_names=["logits"],
                  dynamic_axes={"chars": {0: "B", 1: "L"}, "logits": {0: "B", 1: "L"}}, opset_version=17, dynamo=False)
# meta: grapheme→id, tag-id→IPA chunk, per-grapheme valid tag-ids (the consonant mask). Exclude tag 0 (<pad>): it
# is never a real emission, and leaving it in <unk>'s all-permitted mask would let an out-of-vocab grapheme argmax
# to the literal "<pad>" (the TS runtime also declines out-of-vocab words, so this is defence-in-depth).
charTags = {}
for c, ci in cv.items():
    charTags[str(ci)] = [i for i in range(cm.shape[1])
                         if cm[ci, i].item() > -1e8 and i != 0]
meta = {"src": cv, "tags": {
    str(i): t for i, t in ilv.items()}, "charTags": charTags}
json.dump(meta, open(f"{OUT}/bn-g2p-tagger.meta.json",
          "w"), ensure_ascii=False)

quantize_dynamic(fp32, f"{OUT}/bn-g2p-tagger.int8.onnx",
                 weight_type=QuantType.QInt8)
os.remove(fp32)  # keep only the shipped int8 graph
print(
    f"exported: int8 {os.path.getsize(OUT+'/bn-g2p-tagger.int8.onnx')//1024}KB | chars {len(cv)} tags {len(lv)}")

# sanity: run the int8 graph + mask on a few OOV words
sess = ort.InferenceSession(f"{OUT}/bn-g2p-tagger.int8.onnx")


def infer(word):
    ids = np.array([[cv.get(c, 1) for c in word]], dtype=np.int64)
    lo = sess.run(["logits"], {"chars": ids})[0][0]
    out = []
    for k, c in enumerate(word):
        valid = charTags[str(cv.get(c, 1))]
        best = max(valid, key=lambda t: lo[k]
                   [t]) if valid else int(lo[k].argmax())
        out.append(ilv.get(best, ""))
    return "".join(out)


for w in ["বক্তরা", "নামকরা", "পরিক্রমা", "অগোচরে"]:
    print(f"   {w} → {infer(w)}")
