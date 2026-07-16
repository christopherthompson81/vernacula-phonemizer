#!/usr/bin/env python3
"""Predict harakat vocalizations with the trained multilingual restorer, for the end-to-end IPA eval.

Reads (skeleton, lang) rows, prepends the language token, runs the BiLSTM, and reconstructs the vocalized word by
inserting the predicted diacritic after each base char. Emits `skeleton <TAB> lang <TAB> predicted_vocalized`, which
eval_endtoend.ts then runs through the deterministic g2p to compare against the reference IPA.

  /mnt/data/ar-diac-venv/bin/python predict_harakat.py --in eval.tsv --out /tmp/pred.tsv
"""
import argparse, json, os, sys
import torch, torch.nn as nn
from torch.nn.utils.rnn import pad_sequence

HERE = os.path.dirname(os.path.abspath(__file__))
ap = argparse.ArgumentParser()
ap.add_argument("--ckpt", default="/mnt/data/ar-diac/bilstm_multilingual.pt")
ap.add_argument("--in", dest="inp", default=os.path.join(HERE, "eval_set.tsv"))
ap.add_argument("--out", default="/tmp/pred.tsv")
args = ap.parse_args()
dev = "cuda" if torch.cuda.is_available() else "cpu"

ck = torch.load(args.ckpt, map_location=dev, weights_only=False)
chars, labels, LANG_TOK = ck["chars"], ck["labels"], ck["lang_tokens"]
ilabels = {i: l for l, i in labels.items()}
cfg = ck["cfg"]
# label → the harakat character(s) to append after a base letter.
HAR = {"0": "", "a": "َ", "u": "ُ", "i": "ِ", "o": "ْ", "F": "ً", "N": "ٌ", "K": "ٍ", "^": "ّ"}


def har_of(lab):
    if lab.startswith("~"):
        return "ّ" + HAR.get(lab[1:], "")
    return HAR.get(lab, "")


class BiLSTM(nn.Module):
    def __init__(s, nc, nl, emb, h, ly):
        super().__init__()
        s.emb = nn.Embedding(nc, emb, padding_idx=0)
        s.lstm = nn.LSTM(emb, h, num_layers=ly, batch_first=True, bidirectional=True)
        s.fc = nn.Linear(2 * h, nl)
    def forward(s, x): return s.fc(s.lstm(s.emb(x))[0])


model = BiLSTM(len(chars), len(labels), cfg["emb"], cfg["hidden"], cfg["layers"]).to(dev).eval()
model.load_state_dict(ck["state"])

rows = []
for line in open(args.inp, encoding="utf-8"):
    p = line.rstrip("\n").split("\t")
    if len(p) >= 2 and p[1] in LANG_TOK:
        rows.append((p[0], p[1]))

out = open(args.out, "w", encoding="utf-8")
B = 256
with torch.no_grad():
    for i in range(0, len(rows), B):
        batch = rows[i:i + B]
        seqs = [torch.tensor([chars[LANG_TOK[lang]]] + [chars.get(c, 1) for c in skel]) for skel, lang in batch]
        X = pad_sequence(seqs, batch_first=True, padding_value=0).to(dev)
        pred = model(X).argmax(-1).cpu()
        for b, (skel, lang) in enumerate(batch):
            voc = ""
            for j, c in enumerate(skel):
                voc += c + har_of(ilabels[pred[b, j + 1].item()])  # +1 skips the prepended lang token
            out.write(f"{skel}\t{lang}\t{voc}\n")
out.close()
print(f"wrote {len(rows)} predictions -> {args.out}", file=sys.stderr)
