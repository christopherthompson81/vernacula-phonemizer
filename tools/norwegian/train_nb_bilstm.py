#!/usr/bin/env python3
"""Norwegian Bokmål OOV g2p — BiLSTM per-grapheme tagger (GPU). The neural OOV tier for nb: a char-embedding → 2-layer
BiLSTM → per-position tag head that labels each grapheme with an IPA CHUNK (incl. the stress mark ˈ, so the model
predicts stress POSITION + the stress-conditioned vowel quality DIRECTLY from spelling — the deep-orthography win the
first-syllable rule heuristic misses). On the held-out split it far outstrips the averaged-perceptron prototype
(56.6%) and the rule engine. Reuses the multiprocess hard-EM aligner (nb_tagger_parallel.align_parallel); trains on
the 90% split (honest held-out %), then the FULL NST lexicon, and exports the shared structuralTagger contract:
nb-g2p-tagger.onnx + nb-g2p-tagger.meta.json (src / tags / charTags mask) for onnxruntime-node serving.

    NB_LEX=/tmp/nb_train_stress.tsv NB_KEEP_STRESS=1 NB_SUBSAMPLE=0 .venv/bin/python -u tools/norwegian/train_nb_bilstm.py
"""
import os, json, random
import torch, torch.nn as nn
from torch.nn.utils.rnn import pad_sequence
from nb_tagger_prototype import load, split  # env-configurable loader (NB_LEX / NB_KEEP_STRESS / NB_SUBSAMPLE)
from nb_tagger_parallel import align_parallel  # multiprocess hard-EM alignment (all cores)

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "..", "src", "languages", "norwegian")
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
    chars = {"<pad>": PAD, "<unk>": 1}
    tags = {"<pad>": PAD}
    char_tags = {}  # char-id → set of tag-ids it emitted (the CONSONANT-CONSISTENCY MASK for serving)
    for _, a in aligned:
        for g, t in a:
            ci = chars.setdefault(g, len(chars))
            ti = tags.setdefault(t, len(tags))
            char_tags.setdefault(ci, set()).add(ti)
    return chars, tags, char_tags

def encode(aligned, chars, tags):
    X, Y = [], []
    for _, a in aligned:
        X.append(torch.tensor([chars.get(g, 1) for g, _ in a]))
        Y.append(torch.tensor([tags[t] for _, t in a]))
    return X, Y

def train(model, X, Y, epochs=40):
    model.to(DEV).train()
    opt = torch.optim.Adam(model.parameters(), lr=2e-3)
    # COSINE LR decay 2e-3 → ~0 over the run: a fixed lr overshoots the minimum in late epochs (training loss bottomed
    # ~epoch 10 then climbed ~50%), so the last-epoch weights we export were PAST the minimum. Annealing lets the late
    # epochs settle INTO it, so the final weights are the best — no best-checkpoint selection needed.
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
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
        sched.step()
        if ep % 5 == 0 or ep == epochs - 1:
            print(f"  epoch {ep}: loss {tot/max(1,len(idx)//128):.3f}  lr {sched.get_last_lr()[0]:.2e}", flush=True)
    return model

@torch.no_grad()
def predict(model, chars, itag, word):
    model.eval()
    x = torch.tensor([[chars.get(c, 1) for c in word]]).to(DEV)
    ids = model(x)[0].argmax(-1).tolist()
    return "".join(itag[i] for i in ids)

def heldout_eval(model, chars, itag, te):
    ok = 0
    with open("/tmp/nb_holdout_bilstm.tsv", "w", encoding="utf-8") as f:
        for w, ph in te:
            ref = "".join(ph)
            pred = predict(model, chars, itag, w)
            if pred == ref:
                ok += 1
            f.write(f"{w}\t{ref}\t{pred}\n")
    print(f"held-out BiLSTM exact-match: {ok}/{len(te)} = {100*ok/len(te):.1f}%  (→ /tmp/nb_holdout_bilstm.tsv)", flush=True)

def main():
    random.seed(0); torch.manual_seed(0)
    print(f"device: {DEV}")
    rows = load()
    tr, te = split(rows)
    # (1) honest held-out: align+train on 90%, predict the 10%
    aln_tr = align_parallel(tr)
    chars, tags, _ = build(aln_tr)
    itag = {v: k for k, v in tags.items()}
    Xtr, Ytr = encode(aln_tr, chars, tags)
    print(f"train {len(Xtr)} words, {len(chars)} chars, {len(tags)} tags")
    model = train(Tagger(len(chars), len(tags)), Xtr, Ytr)
    heldout_eval(model, chars, itag, te)
    # (2) SHIPPED: align+train on the FULL lexicon, export ONNX + meta.json (the structuralTagger contract)
    aln = align_parallel(rows)
    chars, tags, char_tags = build(aln)
    itag = {v: k for k, v in tags.items()}
    Xf, Yf = encode(aln, chars, tags)
    full = train(Tagger(len(chars), len(tags)), Xf, Yf)
    full.eval().cpu()
    dummy = torch.tensor([[1, 2, 3, 4]])
    torch.onnx.export(full, dummy, os.path.join(SRC, "nb-g2p-tagger.onnx"),
                      input_names=["chars"], output_names=["logits"],
                      dynamic_axes={"chars": {0: "batch", 1: "len"}, "logits": {0: "batch", 1: "len"}}, opset_version=17)
    # meta.json in the shared TaggerMeta shape (src char→id, tags id→chunk, charTags id→permitted tag-ids = the mask)
    meta = {
        "src": chars,
        "tags": {str(i): itag[i] for i in range(len(tags))},
        "charTags": {str(ci): sorted(ti) for ci, ti in char_tags.items()},
    }
    json.dump(meta, open(os.path.join(SRC, "nb-g2p-tagger.meta.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(f"exported → {SRC}/nb-g2p-tagger.onnx + .meta.json ({len(chars)} chars, {len(tags)} tags)", flush=True)

if __name__ == "__main__":
    main()
