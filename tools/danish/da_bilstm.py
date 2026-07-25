#!/usr/bin/env python3
"""Danish OOV G2P — BiLSTM per-grapheme tagger on the NST lexicon (the bn/nb/en/fr pattern). Replaces the
averaged-perceptron OOV tier, which was data-starved on the old 7.5k Wiktionary lexicon (tied the rule engine). On the
199k NST lexicon a BiLSTM is un-starved (~95% symbol held-out). Danish IPA is single-codepoint-ish (length ː, stød ˀ,
soft-d ð), so SEP="" (the nb/fr path). Reports honest held-out, then (DA_PRODUCTION) trains on the FULL lexicon and
exports the shared structuralTagger contract.

    DA_PRODUCTION=1 .venv/bin/python -u tools/danish/da_bilstm.py
"""
import os, sys, time, random, hashlib, json
import torch, torch.nn as nn
from torch.nn.utils.rnn import pad_sequence
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, "..", "norwegian"))
from nb_tagger_parallel import align_parallel  # SEP="" default → single-codepoint IPA chunks
# Train on the FULL NST (build_da_nst.py --train-out, ~199k words), NOT the trimmed shipping lexicon (top-50k freq) —
# a trimmed set would re-starve the tagger. DA_LEX overrides; default matches build_da_nst.py's --train-out.
LEX = os.environ.get("DA_LEX", "/tmp/da_train.tsv")
DEV = "cuda" if torch.cuda.is_available() else "cpu"
PAD = 0
DA = set("abcdefghijklmnopqrstuvwxyzåæø")  # Danish alphabet (incl. å æ ø)


def load():
    rows = []
    for line in open(LEX, encoding="utf-8"):
        if line.startswith("#") or "\t" not in line:
            continue
        w, ipa = line.rstrip("\r\n").split("\t", 1)  # \r\n-robust (matches build_da_nst.read_nst; a CRLF DA_LEX else welds \r onto the last IPA symbol)
        w = w.lower()
        if w and ipa and all(c in DA for c in w):
            rows.append((w, list(ipa)))
    return rows


def split(rows):
    tr, te = [], []
    for w, p in rows:
        (te if int(hashlib.md5(("da:" + w).encode()).hexdigest(), 16) % 10 == 0 else tr).append((w, p))
    return tr, te


class Tagger(nn.Module):
    def __init__(s, nc, nt, emb=64, hid=256):
        super().__init__(); s.emb = nn.Embedding(nc, emb, padding_idx=PAD)
        s.lstm = nn.LSTM(emb, hid, 2, bidirectional=True, batch_first=True, dropout=0.3); s.head = nn.Linear(2 * hid, nt)
    def forward(s, x): return s.head(s.lstm(s.emb(x))[0])


def build(al):
    chars = {"<pad>": PAD, "<unk>": 1}; tags = {"<pad>": PAD}; ct = {}
    for _, a in al:
        for g, t in a:
            ci = chars.setdefault(g, len(chars)); ti = tags.setdefault(t, len(tags)); ct.setdefault(ci, set()).add(ti)
    return chars, tags, ct
def encode(al, chars, tags):
    X, Y = [], []
    for _, a in al: X.append(torch.tensor([chars.get(g, 1) for g, _ in a])); Y.append(torch.tensor([tags[t] for _, t in a]))
    return X, Y
def train(m, X, Y, ep=40):
    m.to(DEV).train(); opt = torch.optim.Adam(m.parameters(), lr=2e-3); sch = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=ep)
    lf = nn.CrossEntropyLoss(ignore_index=PAD); idx = list(range(len(X)))
    for e in range(ep):
        random.shuffle(idx); tot = 0.0
        for b in range(0, len(idx), 256):
            bi = idx[b:b + 256]; xb = pad_sequence([X[i] for i in bi], batch_first=True).to(DEV); yb = pad_sequence([Y[i] for i in bi], batch_first=True).to(DEV)
            opt.zero_grad(); out = m(xb); loss = lf(out.reshape(-1, out.size(-1)), yb.reshape(-1)); loss.backward(); opt.step(); tot += loss.item()
        sch.step()
        if e % 10 == 0 or e == ep - 1: print(f"  epoch {e}: loss {tot/max(1,len(idx)//256):.3f}", flush=True)
    return m
@torch.no_grad()
def predict(m, chars, itag, ct, w):
    m.eval(); ids = [chars.get(c) for c in w]
    if any(i is None for i in ids): return None
    lo = m(torch.tensor([ids]).to(DEV))[0]; out = ""
    for k, cid in enumerate(ids):
        pm = ct.get(cid)
        if not pm: return None
        out += itag[max(pm, key=lambda t: lo[k][t].item())]
    return out
def lev(a, b):
    d = list(range(len(b) + 1))
    for i in range(1, len(a) + 1):
        p = d[0]; d[0] = i
        for j in range(1, len(b) + 1):
            t = d[j]; d[j] = min(d[j] + 1, d[j - 1] + 1, p + (0 if a[i - 1] == b[j - 1] else 1)); p = t
    return d[len(b)]


def main():
    random.seed(0); torch.manual_seed(0); t0 = time.time()
    print("device:", DEV); rows = load(); tr, te = split(rows)
    print(f"NST-da {len(rows)} → train {len(tr)} / held-out {len(te)}", flush=True)
    al = align_parallel(tr); print(f"aligned {len(al)}/{len(tr)} ({time.time()-t0:.0f}s)", flush=True)
    chars, tags, ct = build(al); itag = {v: k for k, v in tags.items()}; X, Y = encode(al, chars, tags)
    print(f"{len(chars)} chars, {len(tags)} tags", flush=True)
    m = train(Tagger(len(chars), len(tags)), X, Y)
    ex = n = err = tot = 0
    for w, ph in te:
        pr = predict(m, chars, itag, ct, w); n += 1
        if pr is None: continue
        truth = "".join(ph)
        if pr == truth: ex += 1
        err += lev(list(pr), list(truth)); tot += max(len(pr), len(truth))
    wex = 100 * ex / n if n else 0.0  # guard a degenerate split (empty held-out, or every word declined → n/tot == 0)
    sym = 100 * (1 - err / tot) if tot else 0.0
    print(f"\nBiLSTM held-out ({n}):  WORD-exact {wex:.1f}%   symbol-acc {sym:.1f}%", flush=True)

    if os.environ.get("DA_PRODUCTION"):
        print("\n[production] full-lexicon train + export…", flush=True)
        alf = align_parallel(rows); chars, tags, ct = build(alf); itag = {v: k for k, v in tags.items()}
        Xf, Yf = encode(alf, chars, tags); full = train(Tagger(len(chars), len(tags)), Xf, Yf); full.eval().cpu()
        SRC = os.path.join(HERE, "..", "..", "src", "languages", "danish")
        torch.onnx.export(full, torch.tensor([[1, 2, 3, 4]]), os.path.join(SRC, "da-g2p-tagger.onnx"),
                          input_names=["chars"], output_names=["logits"],
                          dynamic_axes={"chars": {0: "batch", 1: "len"}, "logits": {0: "batch", 1: "len"}}, opset_version=17)
        meta = {"src": chars, "tags": {str(i): itag[i] for i in range(len(tags))}, "charTags": {str(ci): sorted(ti) for ci, ti in ct.items()}}
        json.dump(meta, open(os.path.join(SRC, "da-g2p-tagger.meta.json"), "w", encoding="utf-8"), ensure_ascii=False)
        print(f"[production] exported → {SRC}/da-g2p-tagger.onnx + .meta.json ({len(chars)} chars, {len(tags)} tags)", flush=True)


if __name__ == "__main__":
    main()
