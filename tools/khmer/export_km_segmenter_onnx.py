#!/usr/bin/env python3
"""Export the trained Khmer boundary tagger to int8 ONNX + meta for the TS runtime.

The graph is one BiLSTM forward pass: character ids [1,L] → boundary logits [1,L,3]. The decode (argmax between
"no boundary" and "word starts here", then re-inserting U+200B) happens in TS — khmerSegmenterNeural.ts. Output
length == input length, so there is no autoregressive decode and no way for the model to lose or invent
characters: the worst it can do is put a boundary in the wrong place.

  .venv/bin/python tools/khmer/export_km_segmenter_onnx.py src/languages/khmer
    reads km_segmenter.pt, writes km-segmenter.{int8.onnx,meta.json}
"""
import json
import os
import sys

import torch
import torch.nn as nn

SP = sys.argv[1]
OUT = sys.argv[2] if len(sys.argv) > 2 else SP
ck = torch.load(f"{SP}/km_segmenter.pt", map_location="cpu", weights_only=False)
cv = ck["cv"]
EMB, HID, LAYERS, DROP = 96, 256, 2, 0.2


class Segmenter(nn.Module):
    def __init__(self, nc, emb=EMB, h=HID):
        super().__init__()
        self.e = nn.Embedding(nc, emb, padding_idx=0)
        self.lstm = nn.LSTM(emb, h, LAYERS, batch_first=True, bidirectional=True, dropout=DROP)
        self.o = nn.Linear(2 * h, 3)

    def forward(self, x):
        return self.o(self.lstm(self.e(x))[0])


m = Segmenter(len(cv))
m.load_state_dict(ck["model"])
m.eval()

fp32 = f"{OUT}/km-segmenter.onnx"
# dynamo=False → legacy TorchScript exporter, which honours dynamic_axes. The dynamo path specialises L to the
# dummy length and silently breaks variable-length inference (learned the hard way by the bn/fa exporters).
torch.onnx.export(m, torch.ones(1, 8, dtype=torch.long), fp32,
                  input_names=["chars"], output_names=["logits"],
                  dynamic_axes={"chars": {0: "B", 1: "L"}, "logits": {0: "B", 1: "L"}},
                  opset_version=17, dynamo=False)

ho = ck.get("held_out", {})
meta = {"src": cv, "maxRun": 200,
        "heldOut": {k: ho.get(k) for k in ("P", "R", "F1", "runs")},
        "baseline": ho.get("baseline")}
json.dump(meta, open(f"{OUT}/km-segmenter.meta.json", "w"), ensure_ascii=False)

from onnxruntime.quantization import QuantType, quantize_dynamic  # noqa: E402

quantize_dynamic(fp32, f"{OUT}/km-segmenter.int8.onnx", weight_type=QuantType.QInt8)
os.remove(fp32)
size = os.path.getsize(f"{OUT}/km-segmenter.int8.onnx") // 1024
print(f"exported: int8 {size}KB · chars {len(cv)}")

# ---- sanity: the int8 graph on the cases that motivated the model ---------------------------------------------
import numpy as np  # noqa: E402
import onnxruntime as ort  # noqa: E402

sess = ort.InferenceSession(f"{OUT}/km-segmenter.int8.onnx")


def seg(run: str) -> str:
    ids = np.array([[cv.get(c, 1) for c in run]], dtype=np.int64)
    lo = sess.run(["logits"], {"chars": ids})[0][0]
    out = [run[0]]
    for i in range(1, len(run)):
        if lo[i][2] > lo[i][1]:
            out.append("|")
        out.append(run[i])
    return "".join(out)


for w in ["ខែមករា", "ខែឧសភា", "ខែកុម្ភៈ", "នៅសតវត្ស", "ថ្ងៃទីមករា", "ព្រះរាជាណាចក្រកម្ពុជា", "អារម្មណ៍នោះ"]:
    print(f"   {w} → {seg(w)}")
