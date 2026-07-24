#!/usr/bin/env python3
"""Danish OOV g2p — BiLSTM per-grapheme tagger (GPU). Beats the averaged-perceptron prototype (held-out ~41%) toward
the Bengali BiLSTM tier (~90%). Reuses the hard-EM alignment from da_tagger_prototype; a char-embedding → 2-layer
BiLSTM → per-position tag head. Trains on the 90% split (reports honest held-out %), then on the FULL lexicon, and
exports ONNX (src/languages/danish/da-g2p.onnx) + the char/tag vocab (da-g2p.vocab.json) for onnxruntime-node serving.

    .venv/bin/python tools/danish/train_da_bilstm.py
"""
import os, json, random
import torch, torch.nn as nn
from torch.nn.utils.rnn import pad_sequence
from da_tagger_prototype import load, split, align_all  # reuse the loader + hard-EM aligner

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "..", "src", "languages", "danish")
DEV = "cuda" if torch.cuda.is_available() else "cpu"
PAD = 0

class Tagger(nn.Module):
    def __init__(self, n_chars, n_tags, emb=64, hid=128):
        super().__init__()
        self.emb = nn.Embedding(n_chars, emb, padding_idx=PAD)
        self.lstm = nn.LSTM(emb, hid, num_layers=2, bidirectional=True, batch_first=True, dropout=0.3)
        self.head = nn.Linear(2 * hid, n_tags)

    def forward(self, x):
        return self.head(self.lstm(self.emb(x))[0])

def build(aligned):
    chars = {"<pad>": PAD, "^": 1, "$": 2}
    tags = {"<pad>": PAD}
    for _, a in aligned:
        for g, t in a:
            chars.setdefault(g, len(chars))
            tags.setdefault(t, len(tags))
    return chars, tags

def encode(aligned, chars, tags):
    X, Y = [], []
    for _, a in aligned:
        X.append(torch.tensor([chars.get(g, 1) for g, _ in a]))
        Y.append(torch.tensor([tags[t] for _, t in a]))
    return X, Y

def train(model, X, Y, epochs=40):
    model.to(DEV).train()
    opt = torch.optim.Adam(model.parameters(), lr=2e-3)
    loss_fn = nn.CrossEntropyLoss(ignore_index=PAD)
    idx = list(range(len(X)))
    for ep in range(epochs):
        random.shuffle(idx)
        tot = 0.0
        for b in range(0, len(idx), 128):
            bi = idx[b:b + 128]
            xb = pad_sequence([X[i] for i in bi], batch_first=True, padding_value=PAD).to(DEV)
            yb = pad_sequence([Y[i] for i in bi], batch_first=True, padding_value=PAD).to(DEV)
            opt.zero_grad()
            out = model(xb)
            loss = loss_fn(out.reshape(-1, out.size(-1)), yb.reshape(-1))
            loss.backward(); opt.step(); tot += loss.item()
        if ep % 5 == 0 or ep == epochs - 1:
            print(f"  epoch {ep}: loss {tot/max(1,len(idx)//128):.3f}")
    return model

@torch.no_grad()
def predict(model, chars, itag, word):
    model.eval()
    x = torch.tensor([[chars.get(c, 1) for c in word]]).to(DEV)
    ids = model(x)[0].argmax(-1).tolist()
    return "".join(itag[i] for i in ids)

def heldout_eval(model, chars, itag, te):
    with open("/tmp/da_holdout_bilstm.tsv", "w", encoding="utf-8") as f:
        for w, ph in te:
            f.write(f"{w}\t{''.join(ph)}\t{predict(model, chars, itag, w)}\n")
    print("held-out BiLSTM predictions → /tmp/da_holdout_bilstm.tsv (fold with da_tagger_eval)")

def main():
    random.seed(0); torch.manual_seed(0)
    print(f"device: {DEV}")
    rows = load()
    tr, te = split(rows)
    # (1) honest held-out: align+train on 90%, predict the 10%
    aln_tr, _ = align_all(tr)
    chars, tags = build(aln_tr)
    itag = {v: k for k, v in tags.items()}
    Xtr, Ytr = encode(aln_tr, chars, tags)
    print(f"train {len(Xtr)} words, {len(chars)} chars, {len(tags)} tags")
    model = train(Tagger(len(chars), len(tags)), Xtr, Ytr)
    heldout_eval(model, chars, itag, te)
    # (2) SHIPPED: align+train on the FULL lexicon, export ONNX
    aln, _ = align_all(rows)
    chars, tags = build(aln)
    itag = {v: k for k, v in tags.items()}
    Xf, Yf = encode(aln, chars, tags)
    full = train(Tagger(len(chars), len(tags)), Xf, Yf)
    full.eval().cpu()
    dummy = torch.tensor([[1, 2, 3, 4]])
    torch.onnx.export(full, dummy, os.path.join(SRC, "da-g2p.onnx"),
                      input_names=["chars"], output_names=["logits"],
                      dynamic_axes={"chars": {0: "batch", 1: "len"}, "logits": {0: "batch", 1: "len"}}, opset_version=17)
    json.dump({"chars": chars, "tags": [itag[i] for i in range(len(tags))]},
              open(os.path.join(SRC, "da-g2p.vocab.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(f"exported → {SRC}/da-g2p.onnx + da-g2p.vocab.json ({len(chars)} chars, {len(tags)} tags)")

if __name__ == "__main__":
    main()
