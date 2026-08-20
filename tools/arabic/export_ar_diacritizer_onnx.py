#!/usr/bin/env python3
"""Export a trained Arabic diacritizer checkpoint to the SHIPPED int8 ONNX + meta sidecar.

⚠ THE ORIGINAL VERSION OF THIS SCRIPT STOPPED HALFWAY. It hardcoded one checkpoint path, wrote an fp32 graph
into /mnt/data, and ended there — while what ships is `src/languages/arabic/diacritizer.onnx`, the INT8
quantization of that graph. The quantize-and-copy step lived only in someone's shell history, so a "successful"
export left the served model untouched. That is the same shape as fr/en/da exporting fp32 while the int8 ships
(investigation Runs 43, 47); this version does the whole job and writes where the runtime actually looks.

  .venv/bin/python tools/arabic/export_ar_diacritizer_onnx.py --ckpt /tmp/ar_pack_cos.pt
  .venv/bin/python tools/arabic/export_ar_diacritizer_onnx.py --ckpt <egy.pt> --basename diacritizer-egy
"""
import argparse, json, os, shutil, tempfile
import numpy as np
import torch, torch.nn as nn
import onnxruntime as ort
from onnxruntime.quantization import quantize_dynamic, QuantType

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = os.path.join(HERE, "..", "..", "src", "languages", "arabic")

ap = argparse.ArgumentParser()
ap.add_argument("--ckpt", required=True, help="trained .pt (best-val), e.g. /tmp/ar_pack_cos.pt")
ap.add_argument("--dest", default=DEST)
ap.add_argument("--basename", default="diacritizer", help="diacritizer | diacritizer-egy")
a = ap.parse_args()
os.makedirs(a.dest, exist_ok=True)  # ⚠ before the work: shutil.copy failed AFTER export+quantize+parity

ck = torch.load(a.ckpt, map_location="cpu", weights_only=False)
chars, labels, cfg = ck["chars"], ck["labels"], ck["cfg"]


class BiLSTM(nn.Module):
    """⚠ NO `lengths` HERE, DELIBERATELY. Serving is one sentence per inference context, unpadded, so the
    export path is the batch-1 case where packed and unpacked are bitwise identical (asserted by
    tools/bilstm_training/smoke_test.py). Packing belongs in the TRAINER, where the batches are padded."""

    def __init__(s, nc, nl, emb, h, ly):
        super().__init__()
        s.emb = nn.Embedding(nc, emb, padding_idx=0)
        s.lstm = nn.LSTM(emb, h, num_layers=ly, batch_first=True, bidirectional=True, dropout=0)
        s.fc = nn.Linear(2 * h, nl)

    def forward(s, x):
        return s.fc(s.lstm(s.emb(x))[0])


m = BiLSTM(len(chars), len(labels), cfg["emb"], cfg["hidden"], cfg["layers"]).eval()
m.load_state_dict(ck["state"])

with tempfile.TemporaryDirectory() as td:
    fp32 = os.path.join(td, "fp32.onnx")
    torch.onnx.export(m, torch.randint(1, len(chars), (1, 32), dtype=torch.long), fp32,
                      input_names=["input"], output_names=["logits"],
                      dynamic_axes={"input": {0: "batch", 1: "seq"}, "logits": {0: "batch", 1: "seq"}},
                      opset_version=17)
    sess = ort.InferenceSession(fp32, providers=["CPUExecutionProvider"])
    torch.manual_seed(0)
    mism = tot = 0
    for _ in range(200):
        L = torch.randint(3, 60, (1,)).item()
        x = torch.randint(1, len(chars), (1, L), dtype=torch.long)
        mism += (m(x).argmax(-1).numpy() != sess.run(None, {"input": x.numpy()})[0].argmax(-1)).sum()
        tot += L
    print(f"fp32 ONNX vs PyTorch argmax: {tot-mism}/{tot} ({100*(tot-mism)/tot:.3f}%)")

    int8 = os.path.join(td, "int8.onnx")
    quantize_dynamic(fp32, int8, weight_type=QuantType.QInt8)
    s8 = ort.InferenceSession(int8, providers=["CPUExecutionProvider"])
    # ⚠ PER-CHARACTER, NOT PER-SENTENCE. A whole-sentence match over ~60 characters compounds: 99.3% per-char
    # reads as only ~66% per-sentence, which looks alarming and means nothing. The fleet's other int8 gates are
    # per-WORD over ~10 characters, so per-char is the figure comparable across languages — and it is also the
    # unit DER is measured in.
    torch.manual_seed(0)
    same = pos = 0
    for _ in range(200):
        L = torch.randint(3, 60, (1,)).item()
        x = torch.randint(1, len(chars), (1, L), dtype=torch.long).numpy()
        f = sess.run(None, {"input": x})[0].argmax(-1)
        q = s8.run(None, {"input": x})[0].argmax(-1)
        same += int((f == q).sum()); pos += f.size
    print(f"int8 vs fp32 PER-CHARACTER argmax agreement: {same}/{pos} = {same/pos:.3%}")

    shutil.copy(int8, os.path.join(a.dest, f"{a.basename}.onnx"))   # ⚠ the SHIPPED name carries no .int8
    json.dump({"chars": chars, "labels": labels},
              open(os.path.join(a.dest, f"{a.basename}.meta.json"), "w"), ensure_ascii=False)
    sz = os.path.getsize(os.path.join(a.dest, f"{a.basename}.onnx")) / 1e6
    print(f"wrote {a.dest}/{a.basename}.onnx ({sz:.1f} MB) + .meta.json")
