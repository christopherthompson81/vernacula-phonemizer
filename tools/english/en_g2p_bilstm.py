#!/usr/bin/env python3
"""English OOV G2P — BiLSTM per-grapheme tagger vs the joint n-gram, on a CLEAN CMUdict held-out split.

The question: the wikipron referee can't measure English OOV quality (Runs 1-2 — it's noise-limited at ~60% even
where we're authoritatively correct). So measure on a clean CMUdict 90/10 split. Trains a char→ARPABET-chunk BiLSTM
tagger (the bn/nb structuralTagger pattern: hard-EM many-to-{0,1,2} alignment → char-embed → 2-layer BiLSTM → masked
per-position tag) on 90% of g2p-dict.tsv (117k words, public-domain CMUdict) and reports held-out WORD accuracy
(exact ARPABET incl. stress, and stress-independent phones). Reuses align_parallel from nb_tagger_parallel.

    .venv/bin/python -u tools/english/en_g2p_bilstm.py
"""
import os, sys, math, time, random, hashlib, json
import torch, torch.nn as nn
from torch.nn.utils.rnn import pad_sequence

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "norwegian"))
import nb_tagger_parallel  # multiprocess hard-EM aligner (generic over phone-token lists)
from nb_tagger_parallel import align_parallel
nb_tagger_parallel.SEP = " "  # ARPABET phones are multi-char tokens → join 2-phone chunks with a space (K S, not KS)

DICT = os.path.join(HERE, "..", "..", "src", "languages", "english", "g2p-dict.tsv")
DEV = "cuda" if torch.cuda.is_available() else "cpu"
PAD = 0


def load():
    rows = []
    for line in open(DICT, encoding="utf-8"):
        if line.startswith("#") or "\t" not in line:
            continue
        w, ph = line.rstrip("\n").split("\t", 1)
        w = w.lower()
        toks = ph.split()
        if w.isalpha() and w.isascii() and toks:
            rows.append((w, toks))  # phones are ARPABET TOKENS (AE1, B, …), not chars
    return rows


def split(rows):
    # EN_FREQ set → the RELIABLE, distribution-matched referee: train on the frequency-common words, HOLD OUT the
    # rare/proper-noun tail (the real OOV target: names, neologisms) with clean CMUdict gold. Else a random md5 10%.
    freq_path = os.environ.get("EN_FREQ")
    if freq_path:
        common = set()
        for l in open(freq_path, encoding="utf-8"):
            if l.startswith("#"):
                continue
            wl = l.split(" ")[0].strip().lower()
            if wl:
                common.add(wl)
        tr = [(w, p) for w, p in rows if w in common]
        te = [(w, p) for w, p in rows if w not in common]
        return tr, te
    tr, te = [], []
    for w, p in rows:
        (te if int(hashlib.md5(("en:" + w).encode()).hexdigest(), 16) % 10 == 0 else tr).append((w, p))
    return tr, te


class Tagger(nn.Module):
    def __init__(self, n_chars, n_tags, emb=64, hid=256):
        super().__init__()
        self.emb = nn.Embedding(n_chars, emb, padding_idx=PAD)
        self.lstm = nn.LSTM(emb, hid, num_layers=2, bidirectional=True, batch_first=True, dropout=0.3)
        self.head = nn.Linear(2 * hid, n_tags)

    def forward(self, x):
        return self.head(self.lstm(self.emb(x))[0])


def build(aligned):
    chars = {"<pad>": PAD, "<unk>": 1}
    tags = {"<pad>": PAD}
    char_tags = {}
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
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)  # anneal → final weights are the best
    loss_fn = nn.CrossEntropyLoss(ignore_index=PAD)
    idx = list(range(len(X)))
    for ep in range(epochs):
        random.shuffle(idx)
        tot = 0.0
        for b in range(0, len(idx), 256):
            bi = idx[b:b + 256]
            xb = pad_sequence([X[i] for i in bi], batch_first=True, padding_value=PAD).to(DEV)
            yb = pad_sequence([Y[i] for i in bi], batch_first=True, padding_value=PAD).to(DEV)
            opt.zero_grad()
            out = model(xb)
            loss = loss_fn(out.reshape(-1, out.size(-1)), yb.reshape(-1))
            loss.backward(); opt.step(); tot += loss.item()
        sched.step()
        if ep % 5 == 0 or ep == epochs - 1:
            print(f"  epoch {ep}: loss {tot/max(1,len(idx)//256):.3f}  lr {sched.get_last_lr()[0]:.2e}", flush=True)
    return model


@torch.no_grad()
def predict(model, chars, itag, char_tags, word):
    model.eval()
    ids = [chars.get(c) for c in word]
    if any(i is None for i in ids):
        return None
    logits = model(torch.tensor([ids]).to(DEV))[0]  # [T, nTags]
    out = []
    for k, cid in enumerate(ids):
        permitted = char_tags.get(cid)
        if not permitted:
            return None
        row = logits[k]
        best = max(permitted, key=lambda t: row[t].item())
        chunk = itag[best]
        if chunk:
            out.extend(chunk.split(" "))
    return out


def main():
    random.seed(0); torch.manual_seed(0)
    t0 = time.time()
    print(f"device: {DEV}")
    rows = load()
    tr, te = split(rows)
    print(f"CMUdict {len(rows)} → train {len(tr)} / held-out {len(te)}", flush=True)
    aligned = align_parallel(tr)
    print(f"aligned {len(aligned)}/{len(tr)} ({time.time()-t0:.0f}s)", flush=True)
    chars, tags, char_tags = build(aligned)
    itag = {v: k for k, v in tags.items()}
    X, Y = encode(aligned, chars, tags)
    print(f"{len(chars)} chars, {len(tags)} tags", flush=True)
    model = train(Tagger(len(chars), len(tags)), X, Y)
    # held-out WORD accuracy: exact ARPABET (incl. stress) + stress-independent
    exact = stressless = n = declined = 0
    destress = lambda ts: [t.rstrip("012") for t in ts]
    with open("/tmp/en_bilstm_holdout.tsv", "w", encoding="utf-8") as f:
        for w, ph in te:
            pred = predict(model, chars, itag, char_tags, w)
            n += 1
            if pred is None:
                declined += 1
                f.write(f"{w}\t{' '.join(ph)}\tDECLINED\n")
                continue
            if pred == ph:
                exact += 1
            if destress(pred) == destress(ph):
                stressless += 1
            f.write(f"{w}\t{' '.join(ph)}\t{' '.join(pred)}\n")
    print(f"\nBiLSTM held-out ({n} words):", flush=True)
    print(f"  WORD exact (incl. stress):   {exact}/{n} = {100*exact/n:.1f}%", flush=True)
    print(f"  WORD exact (stress-indep):   {stressless}/{n} = {100*stressless/n:.1f}%", flush=True)
    print(f"  declined (oov char): {declined}   (total {time.time()-t0:.0f}s)  → /tmp/en_bilstm_holdout.tsv", flush=True)

    # PRODUCTION: retrain on the FULL CMUdict and export the shipped ONNX + meta (the structuralTagger contract).
    if os.environ.get("EN_PRODUCTION"):
        print("\n[production] aligning + training on the FULL CMUdict…", flush=True)
        aln = align_parallel(rows)
        chars, tags, char_tags = build(aln)
        itag = {v: k for k, v in tags.items()}
        Xf, Yf = encode(aln, chars, tags)
        full = train(Tagger(len(chars), len(tags)), Xf, Yf)
        full.eval().cpu()
        SRC = os.path.join(HERE, "..", "..", "src", "languages", "english")
        dummy = torch.tensor([[1, 2, 3, 4]])
        torch.onnx.export(full, dummy, os.path.join(SRC, "en-g2p-tagger.onnx"),
                          input_names=["chars"], output_names=["logits"],
                          dynamic_axes={"chars": {0: "batch", 1: "len"}, "logits": {0: "batch", 1: "len"}}, opset_version=17)
        meta = {"src": chars, "tags": {str(i): itag[i] for i in range(len(tags))},
                "charTags": {str(ci): sorted(ti) for ci, ti in char_tags.items()}}
        json.dump(meta, open(os.path.join(SRC, "en-g2p-tagger.meta.json"), "w", encoding="utf-8"), ensure_ascii=False)
        print(f"[production] exported → {SRC}/en-g2p-tagger.onnx + .meta.json ({len(chars)} chars, {len(tags)} tags)", flush=True)


if __name__ == "__main__":
    main()
