#!/usr/bin/env python3
"""Bengali G2P STRUCTURAL tagger — the DEFAULT-for-OOV neural Bengali reader (ships as
src/languages/bengali/bn-g2p-tagger.int8.onnx). A per-grapheme BiLSTM: each Bengali grapheme → one IPA-chunk TAG
(its consonant, COPIED, plus the following inherent vowel ɔ/o or deletion). Output length == input length, so it
CANNOT degenerate and CANNOT break the consonant skeleton — a single forward pass, no beam, no autoregressive
decode. Context (the whole-word ɔ/o realization) comes from the bidirectional pass. The per-grapheme labels come
from a MONOTONE 1-grapheme→0..2-unit EM alignment; a consonant-consistency mask constrains each grapheme to only
the tags it produced in training, so the model only ever decides the vowel.

On the seed-0 20% held-out (OOV) split this reads ɔ/o 90.5% | full 86.4% — vs the seq2seq's 86.1/79.4 and the
rule engine's 62.6% ɔ/o. See docs/investigations/bn_native_bringup_investigation.md Run 17-18.

  npx tsx tools/bengali/build_tagger_data.ts /tmp/bn_tagger_train.tsv
  python train_bn_tagger.py /tmp/bn_tagger_train.tsv src/languages/bengali   # writes bn_tagger.pt (+ reports held-out)
  python export_bn_tagger_onnx.py src/languages/bengali                      # writes bn-g2p-tagger.int8.onnx + .meta.json
"""
import sys, math, random
import torch, torch.nn as nn
random.seed(0); torch.manual_seed(0)
dev = "cuda" if torch.cuda.is_available() else "cpu"
SRC = sys.argv[1]
OUTDIR = sys.argv[2] if len(sys.argv) > 2 else "."

rows = [l.rstrip("\n").split("\t") for l in open(SRC, encoding="utf8") if l.count("\t") == 1]
random.shuffle(rows); nh = len(rows) // 5; hold = rows[:nh]; train = rows[nh:]

# ---- IPA unit tokeniser: base + combining marks/modifiers; tie-bar ͡ joins two bases (t͡ʃ, d͡ʒ) ----
MOD = set("ʰʱʲʷˑːˈˌ") | set("̥̪̰̀́̂̃̄̆̈̊")
def ipaunits(s):
    u = []; i = 0
    while i < len(s):
        j = i + 1
        while j < len(s) and s[j] in MOD: j += 1
        if j < len(s) and s[j] == "͡":
            j += 1
            if j < len(s): j += 1
            while j < len(s) and s[j] in MOD: j += 1
        u.append(s[i:j]); i = j
    return u

pairs = [(list(w), ipaunits(p)) for w, p in ((r[0], r[1]) for r in train)]

# ---- EM: monotone 1-grapheme → 0..2 IPA-unit alignment (each grapheme consumes exactly one step) ----
PMAX = 2
def cands(pi, m):
    for pl in range(0, PMAX + 1):
        if pi + pl <= m: yield pl
prob = {}
seed = pairs[:15000]
for G, P in seed:
    m = len(P)
    for gi in range(len(G)):
        for pi in range(m + 1):
            for pl in cands(pi, m): prob[(G[gi], "".join(P[pi:pi + pl]))] = 1.0
get = lambda k: prob.get(k, 1e-9)
for it in range(6):
    cnt = {}
    for G, P in seed:
        n, m = len(G), len(P)
        a = [[0.0] * (m + 1) for _ in range(n + 1)]; a[0][0] = 1.0
        for gi in range(n):
            for pi in range(m + 1):
                if a[gi][pi] == 0: continue
                for pl in cands(pi, m): a[gi + 1][pi + pl] += a[gi][pi] * get((G[gi], "".join(P[pi:pi + pl])))
        Z = a[n][m]
        if Z <= 0: continue
        b = [[0.0] * (m + 1) for _ in range(n + 1)]; b[n][m] = 1.0
        for gi in range(n - 1, -1, -1):
            for pi in range(m + 1):
                s = 0.0
                for pl in cands(pi, m): s += get((G[gi], "".join(P[pi:pi + pl]))) * b[gi + 1][pi + pl]
                b[gi][pi] = s
        for gi in range(n):
            for pi in range(m + 1):
                if a[gi][pi] == 0: continue
                for pl in cands(pi, m):
                    key = (G[gi], "".join(P[pi:pi + pl]))
                    c = a[gi][pi] * get(key) * b[gi + 1][pi + pl] / Z
                    if c > 0: cnt[key] = cnt.get(key, 0.0) + c
    tot = {}
    for (g, p), c in cnt.items(): tot[g] = tot.get(g, 0.0) + c
    prob = {(g, p): c / tot[g] for (g, p), c in cnt.items()}
    print(f"# EM it{it+1} chunks={len(prob)}", file=sys.stderr, flush=True)

def viterbi_tags(G, P):
    n, m = len(G), len(P); best = [[(-1e18, None)] * (m + 1) for _ in range(n + 1)]; best[0][0] = (0.0, None)
    for gi in range(n):
        for pi in range(m + 1):
            s = best[gi][pi][0]
            if s < -1e17: continue
            for pl in cands(pi, m):
                p = "".join(P[pi:pi + pl]); ns = s + math.log(get((G[gi], p)) + 1e-12)
                if ns > best[gi + 1][pi + pl][0]: best[gi + 1][pi + pl] = (ns, (pi, p))
    if best[n][m][1] is None: return None
    tags = [None] * n; gi, pi = n, m
    while gi > 0:
        ppi, p = best[gi][pi][1]; tags[gi - 1] = p; gi -= 1; pi = ppi
    return tags

# ---- per-grapheme labels + consonant-consistency mask (char id → tag ids it produced in training) ----
cv = {"<pad>": 0, "<unk>": 1}
lv = {"<pad>": 0}
allowed = {}  # char id → set of tag ids
data = []
for G, P in pairs:
    tg = viterbi_tags(G, P)
    if tg is None: continue
    for c in G: cv.setdefault(c, len(cv))
    for t in tg: lv.setdefault(t, len(lv))
    for c, t in zip(G, tg): allowed.setdefault(cv[c], set()).add(lv[t])
    data.append((G, tg))
ilv = {i: t for t, i in lv.items()}
print(f"# tagged {len(data)} | grapheme vocab={len(cv)} | tag vocab={len(lv)} | dev={dev}", file=sys.stderr, flush=True)
genc = lambda G: [cv.get(c, 1) for c in G]

class Tagger(nn.Module):
    def __init__(s, nc, nl, emb=128, h=256):
        super().__init__(); s.e = nn.Embedding(nc, emb, 0)
        s.lstm = nn.LSTM(emb, h, 2, batch_first=True, bidirectional=True, dropout=0.2); s.o = nn.Linear(2 * h, nl)
    def forward(s, x): return s.o(s.lstm(s.e(x))[0])

m = Tagger(len(cv), len(lv)).to(dev); opt = torch.optim.Adam(m.parameters(), 1e-3)
crit = nn.CrossEntropyLoss(ignore_index=0)
enc = [(genc(G), [lv[t] for t in TG]) for G, TG in data]
for ep in range(20):
    m.train(); random.shuffle(enc)
    for k in range(0, len(enc), 128):
        b = enc[k:k + 128]; mx = max(len(x[0]) for x in b)
        X = torch.zeros(len(b), mx, dtype=torch.long); Y = torch.zeros(len(b), mx, dtype=torch.long)
        for r, (gi, ti) in enumerate(b): X[r, :len(gi)] = torch.tensor(gi); Y[r, :len(ti)] = torch.tensor(ti)
        lo = m(X.to(dev)); loss = crit(lo.reshape(-1, len(lv)), Y.to(dev).reshape(-1))
        opt.zero_grad(); loss.backward(); nn.utils.clip_grad_norm_(m.parameters(), 5); opt.step()

# ---- held-out (OOV) report, masked argmax like the TS runtime ----
m.eval()
oo = lambda s: "".join(c for c in s if c in "ɔo")
mask_of = {ci: sorted(ts) for ci, ts in allowed.items()}
N = len(hold); full = okoo = 0
with torch.no_grad():
    for k in range(0, N, 512):
        b = hold[k:k + 512]; mx = max(len(r[0]) for r in b); X = torch.zeros(len(b), mx, dtype=torch.long)
        for r, row in enumerate(b): X[r, :len(row[0])] = torch.tensor(genc(list(row[0])))
        lo = m(X.to(dev)).cpu()
        for r, row in enumerate(b):
            G = list(row[0]); out = []
            for i, c in enumerate(G):
                valid = mask_of.get(cv.get(c, 1))
                if valid: best = max(valid, key=lambda t: lo[r, i, t].item())
                else: best = int(lo[r, i].argmax())
                out.append(ilv.get(best, ""))
            s = "".join(out)
            if s == row[1]: full += 1
            if oo(s) == oo(row[1]): okoo += 1
print(f"held-out {N} OOV words | ɔ/o {100*okoo/N:.1f}% | full {100*full/N:.1f}%  (degeneration impossible)")

# ---- save checkpoint: char_mask [nc, nl] with -1e9 where disallowed (export filters cm > -1e8) ----
nc, nl = len(cv), len(lv)
char_mask = torch.full((nc, nl), -1e9)
for ci, ts in allowed.items():
    for t in ts: char_mask[ci, t] = 0.0
char_mask[cv["<unk>"]] = 0.0  # unknown grapheme → all tags permitted (no mask)
torch.save({"model": m.state_dict(), "cv": cv, "lv": lv, "char_mask": char_mask}, f"{OUTDIR}/bn_tagger.pt")
print(f"# saved {OUTDIR}/bn_tagger.pt", file=sys.stderr)
