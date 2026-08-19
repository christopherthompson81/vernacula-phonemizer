#!/usr/bin/env python3
"""Hebrew PHASE-2 tagger — a SENTENCE-LEVEL per-consonant BiLSTM that RESTORES the NIQQUD of unvocalized Hebrew
(the ar/nakdan approach; deterministic Phase-1 g2p then renders IPA). Each skeleton consonant → its niqqud tag,
plus a space tag at word boundaries. Output length == input length → CANNOT degenerate. The bidirectional pass over
the whole CLAUSE supplies the cross-word context that disambiguates the unwritten vowels (sheva na/nach, homographs
ילד = jeled/jaled). A consonant-consistency mask constrains each letter to only the tags it produced in training.

Reads three TAB columns from build_tagger_data.ts — skeleton, niqqud tags, and a per-consonant TRAIN/IGNORE mask
(the register-balancing suppression). Masked positions cast no vote: excluded from the vocab/allow-set and ignored
by the loss. No aligner needed — the tags are already 1:1 with the skeleton.

  npx tsx tools/hebrew/build_tagger_data.ts /tmp/hebrew_diacritized /tmp/he_tagger_train.tsv
  python tools/hebrew/train_he_tagger.py /tmp/he_tagger_train.tsv src/languages/hebrew   # writes he_tagger.pt
  python tools/hebrew/export_he_tagger_onnx.py src/languages/hebrew                       # → he-tagger.int8.onnx + meta
"""
import sys, random
import torch, torch.nn as nn
random.seed(0); torch.manual_seed(0)
dev = "cuda" if torch.cuda.is_available() else "cpu"
SRC = sys.argv[1]
OUTDIR = sys.argv[2] if len(sys.argv) > 2 else "."

rows = []
for l in open(SRC, encoding="utf8"):
    l = l.rstrip("\n")
    p = l.split("\t")
    if len(p) != 3: continue
    skel, tags, mask = p[0], p[1].split("|"), p[2].split("|")
    if len(skel) != len(tags) or len(skel) != len(mask):  # 1 BMP codepoint per consonant → aligned columns
        continue
    rows.append((list(skel), tags, [c == "1" for c in mask]))
random.shuffle(rows)
nh = len(rows) // 10; hold = rows[:nh]; train = rows[nh:]
print(f"# train {len(train)} | held-out {len(hold)} | dev={dev}", file=sys.stderr, flush=True)

# masked positions (register-balancing suppression, build_tagger_data.ts) cast NO vote: excluded from the char→tag
# allow-set / vocab here and ignored by the loss (label → pad id 0) below.
cv = {"<pad>": 0, "<unk>": 1}
lv = {"<pad>": 0}
allowed = {}  # char id → set of tag ids seen with it
for skel, tags, msk in train:
    for c, t, keep in zip(skel, tags, msk):
        cv.setdefault(c, len(cv))
        if not keep: continue
        lv.setdefault(t, len(lv)); allowed.setdefault(cv[c], set()).add(lv[t])
ilv = {i: t for t, i in lv.items()}
print(f"# char vocab={len(cv)} tag vocab={len(lv)}", file=sys.stderr, flush=True)
genc = lambda s: [cv.get(c, 1) for c in s]

class Tagger(nn.Module):
    def __init__(s, nc, nl, emb=128, h=256, L=2):
        super().__init__(); s.e = nn.Embedding(nc, emb, 0)
        s.lstm = nn.LSTM(emb, h, L, batch_first=True, bidirectional=True, dropout=0.2 if L > 1 else 0)
        s.o = nn.Linear(2 * h, nl)
    def forward(s, x, lengths=None):
        """⚠ PASS `lengths` FOR A PADDED BATCH. Unpacked, the BiLSTM's BACKWARD direction crosses the pad steps
        before reaching each word's last real symbol, so that symbol depends on the batch's longest word —
        while serving is batch=1 and unpadded. The damage lands at the END of the word. See Run 41."""
        h = s.e(x)
        if lengths is None:
            return s.o(s.lstm(h)[0])
        pk = nn.utils.rnn.pack_padded_sequence(h, lengths, batch_first=True, enforce_sorted=False)
        out, _ = nn.utils.rnn.pad_packed_sequence(s.lstm(pk)[0], batch_first=True, total_length=x.size(1))
        return s.o(out)

m = Tagger(len(cv), len(lv)).to(dev); opt = torch.optim.Adam(m.parameters(), 1e-3)
crit = nn.CrossEntropyLoss(ignore_index=0)
# masked position → label pad id 0 → skipped by ignore_index (also catches a masked-only tag absent from lv)
enc = [(genc(sk), [lv[t] if keep and t in lv else 0 for t, keep in zip(tg, msk)]) for sk, tg, msk in train]
for ep in range(15):
    m.train(); random.shuffle(enc)
    for k in range(0, len(enc), 256):
        b = enc[k:k + 256]; mx = max(len(x[0]) for x in b)
        X = torch.zeros(len(b), mx, dtype=torch.long); Y = torch.zeros(len(b), mx, dtype=torch.long)
        for r, (gi, ti) in enumerate(b): X[r, :len(gi)] = torch.tensor(gi); Y[r, :len(ti)] = torch.tensor(ti)
        lo = m(X.to(dev), torch.tensor([len(gi) for gi, _ in b])); loss = crit(lo.reshape(-1, len(lv)), Y.to(dev).reshape(-1))
        opt.zero_grad(); loss.backward(); nn.utils.clip_grad_norm_(m.parameters(), 5); opt.step()
    print(f"# epoch {ep+1}/15 done", file=sys.stderr, flush=True)

# held-out eval (masked argmax like the TS runtime): per-word exact IPA + per-consonant tag accuracy
m.eval()
mask_of = {ci: sorted(ts) for ci, ts in allowed.items()}
N = len(hold); wordOK = charOK = charTot = 0
with torch.no_grad():
    for k in range(0, N, 512):
        b = hold[k:k + 512]; mx = max(len(r[0]) for r in b); X = torch.zeros(len(b), mx, dtype=torch.long)
        for r, row in enumerate(b): X[r, :len(row[0])] = torch.tensor(genc(row[0]))
        # ⚠ the HELD-OUT pass is padded too — unpacked it scored under a condition serving never presents.
        lo = m(X.to(dev), torch.tensor([len(r[0]) for r in b])).cpu()
        for r, (sk, tg, _msk) in enumerate(b):
            pred = []
            for i, c in enumerate(sk):
                valid = mask_of.get(cv.get(c, 1))
                best = max(valid, key=lambda t: lo[r, i, t].item()) if valid else int(lo[r, i].argmax())
                pred.append(ilv.get(best, ""))
            if pred == tg: wordOK += 1
            for a, g in zip(pred, tg):
                charTot += 1; charOK += (a == g)
print(f"held-out {N} words | word-exact {100*wordOK/N:.1f}% | per-consonant tag {100*charOK/charTot:.1f}%")

nc, nl = len(cv), len(lv)
char_mask = torch.full((nc, nl), -1e9)
for ci, ts in allowed.items():
    for t in ts: char_mask[ci, t] = 0.0
char_mask[cv["<unk>"]] = 0.0
torch.save({"model": m.state_dict(), "cv": cv, "lv": lv, "char_mask": char_mask}, f"{OUTDIR}/he_tagger.pt")
print(f"# saved {OUTDIR}/he_tagger.pt", file=sys.stderr)
