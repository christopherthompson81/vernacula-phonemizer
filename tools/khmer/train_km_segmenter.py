#!/usr/bin/env python3
"""Khmer word-boundary tagger — a per-character BiLSTM that restores the boundaries Khmer does not write.

WHAT IT IS FOR. Khmer has no inter-word space, so the engine tokenises a maximal Khmer run as ONE unit and the
syllabifier re-parses across the invisible boundaries. On 4,000 junctions where a writer actually typed U+200B,
joining the two words corrupts the reading 54.6% of the time. This model predicts, for each character, whether a
word STARTS there — a single forward pass, output length == input length, so it cannot degenerate. Boundaries are
then re-inserted as U+200B and the existing sync engine reads the result.

  .venv/bin/python tools/khmer/build_km_segmenter_data.py <km-paragraphs.txt> /tmp/km_seg.tsv
  .venv/bin/python tools/khmer/train_km_segmenter.py /tmp/km_seg.tsv src/languages/khmer
  .venv/bin/python tools/khmer/export_km_segmenter_onnx.py src/languages/khmer

⚠ THE LABELS ARE CLEANED, AND '?' MEANS ABSTAIN. See build_km_segmenter_data.py: ZWSP is a one-sided signal, so
positions the corpus cannot settle are masked out of BOTH the loss and the score. Never silently treat '?' as 0 —
that is the label noise the whole pipeline exists to remove.

⚠ THE BASELINE IS REIMPLEMENTED HERE ON PURPOSE. src/languages/khmer/segment.ts is a unigram Viterbi over
km-wordfreq.tsv; the same algorithm is repeated in `viterbi_baseline` below so both are scored on the identical
held-out split with the identical metric. Quoting the TS module's own 54.7% next to a differently-measured neural
number would be comparing two experiments, not two models.
"""
import math
import os
import random
import sys
from collections import Counter

import torch
import torch.nn as nn

random.seed(0)
torch.manual_seed(0)
dev = "cuda" if torch.cuda.is_available() else "cpu"

SRC = sys.argv[1]
OUTDIR = sys.argv[2] if len(sys.argv) > 2 else "."
FREQ_TSV = f"{OUTDIR}/km-wordfreq.tsv"

EMB, HID, LAYERS, DROP = 96, 256, 2, 0.2
EPOCHS, BATCH, LR = 6, 96, 1e-3

# ---- data ----------------------------------------------------------------------------------------------------
rows = []
for line in open(SRC, encoding="utf8"):
    t, l = line.rstrip("\n").split("\t")
    if len(t) != len(l):
        continue
    # A run with no supervised interior position contributes no gradient and no score: drop it.
    if all(c == "?" for c in l[1:]):
        continue
    rows.append((t, l))
random.shuffle(rows)
nh = len(rows) // 5
hold, train = rows[:nh], rows[nh:]

cv = {"<pad>": 0, "<unk>": 1}
for t, _ in train:
    for c in t:
        cv.setdefault(c, len(cv))
enc = lambda t: [cv.get(c, 1) for c in t]

pos = sum(l[1:].count("1") for _, l in train)
sup = sum(len(l) - 1 - l[1:].count("?") for _, l in train)
print(f"# runs {len(rows):,} (train {len(train):,} / held-out {len(hold):,}) · char vocab {len(cv)} · dev {dev}",
      file=sys.stderr, flush=True)
print(f"# supervised interior positions {sup:,} · positives {pos:,} ({100*pos/max(1,sup):.1f}%)",
      file=sys.stderr, flush=True)


class Segmenter(nn.Module):
    """Per-character boundary tagger. 3 logits: 0 = pad/ignore, 1 = no boundary, 2 = word starts here."""

    def __init__(self, nc, emb=EMB, h=HID):
        super().__init__()
        self.e = nn.Embedding(nc, emb, padding_idx=0)
        self.lstm = nn.LSTM(emb, h, LAYERS, batch_first=True, bidirectional=True, dropout=DROP)
        self.o = nn.Linear(2 * h, 3)

    def forward(self, x, lengths=None):
        """⚠ PASS `lengths` FOR A PADDED BATCH. Unpacked, the BiLSTM's BACKWARD direction crosses the pad steps
        before reaching each paragraph's last real character, while serving (khmerNeural.ts) is one text at a
        time, unpadded — so the damage lands at the END of the input. For a SEGMENTER that is the final word
        boundary of every chunk. See investigation Run 41."""
        h = self.e(x)
        if lengths is None:
            return self.o(self.lstm(h)[0])
        pk = nn.utils.rnn.pack_padded_sequence(h, lengths, batch_first=True, enforce_sorted=False)
        out, _ = nn.utils.rnn.pad_packed_sequence(self.lstm(pk)[0], batch_first=True, total_length=x.size(1))
        return self.o(out)


def batches(data, bs, shuffle=True):
    idx = list(range(len(data)))
    if shuffle:
        random.shuffle(idx)
    # length-bucketed so padding stays cheap on a corpus whose runs span 4..200 characters
    idx.sort(key=lambda i: len(data[i][0]) // 16)
    for k in range(0, len(idx), bs):
        chunk = [data[i] for i in idx[k:k + bs]]
        mx = max(len(t) for t, _ in chunk)
        X = torch.zeros(len(chunk), mx, dtype=torch.long)
        Y = torch.zeros(len(chunk), mx, dtype=torch.long)   # 0 = ignored
        for r, (t, l) in enumerate(chunk):
            X[r, :len(t)] = torch.tensor(enc(t))
            Y[r, 0] = 0                                      # position 0 is not a decision
            for i in range(1, len(l)):
                Y[r, i] = 0 if l[i] == "?" else (2 if l[i] == "1" else 1)
        yield X, Y, torch.tensor([len(d[0]) for d in chunk])


m = Segmenter(len(cv)).to(dev)
opt = torch.optim.Adam(m.parameters(), LR)
# ⚠ THE POSITIVE CLASS WEIGHT IS A TUNED CHOICE, NOT A DEFAULT, and it trades the two failure modes against each
# other: a MISSED boundary leaves the corrupted joined reading, a SPURIOUS one splits a word that was reading
# correctly. Boundaries are ~13% of supervised positions. Measured end-to-end on 3,000 writer-marked junctions
# (tools/khmer/eval_km_segmenter.mts), which is the metric that matters rather than F1:
#
#     weight   held-out P / R / F1        reading matches reference   fixed / broke
#        2.0   74.6 / 98.6 / 84.9                     80.7%          1332 / 254
#        1.0   78.1 / 97.5 / 86.7                     80.4%          1309 / 240   ← SHIPPED
#
# ⚠ THE TWO METRICS DISAGREE, AND THE DOWNSTREAM ONE IS A TIE. Weight 2.0 wins end-to-end by 0.3pp, which on 3,000
# junctions is nine utterances — noise. So the choice was made on the tie-breakers: weight 1.0 has 3.5pp more
# PRECISION and visibly stops shredding real words (ថ្ងៃទីមករា → ថ្ងៃ|ទី|មករា rather than ថ្ងៃ|ទី|មក|រា, and
# ព្រះរាជាណាចក្រកម្ពុជា keeps រាជាណា whole). A spurious boundary splits a word that was reading correctly, and text
# outside this test distribution has far more ordinary words than compound junctions, so precision is the safer
# side to err on. Recorded rather than silently preferred, because F1 alone would have picked the other model.
POS_WEIGHT = float(os.environ.get("POS_WEIGHT", "1.0"))
print(f"# positive class weight {POS_WEIGHT}", file=sys.stderr, flush=True)
crit = nn.CrossEntropyLoss(ignore_index=0, weight=torch.tensor([0.0, 1.0, POS_WEIGHT], device=dev))

for ep in range(EPOCHS):
    m.train()
    tot = nb = 0
    for X, Y, ln in batches(train, BATCH):
        lo = m(X.to(dev), ln)
        loss = crit(lo.reshape(-1, 3), Y.to(dev).reshape(-1))
        opt.zero_grad()
        loss.backward()
        nn.utils.clip_grad_norm_(m.parameters(), 5)
        opt.step()
        tot += loss.item()
        nb += 1
    print(f"# epoch {ep + 1}/{EPOCHS} loss {tot / max(1, nb):.4f}", file=sys.stderr, flush=True)

# ---- held-out scoring: per-position P/R/F1 over SUPERVISED positions only -------------------------------------
m.eval()
tp = fp = fn = tn = 0
with torch.no_grad():
    for X, Y, ln in batches(hold, 256, shuffle=False):
        # ⚠ the held-out pass is padded too — unpacked it scored under a condition serving never presents.
        lo = m(X.to(dev), ln).cpu()
        pred = (lo[:, :, 2] > lo[:, :, 1])
        for r in range(X.shape[0]):
            for i in range(1, X.shape[1]):
                y = int(Y[r, i])
                if y == 0:
                    continue
                p = bool(pred[r, i])
                if y == 2 and p:
                    tp += 1
                elif y == 2:
                    fn += 1
                elif p:
                    fp += 1
                else:
                    tn += 1
P = tp / max(1, tp + fp)
R = tp / max(1, tp + fn)
F = 2 * P * R / max(1e-9, P + R)


# ---- the same metric for the shipped unigram Viterbi, so the comparison is one experiment --------------------
def viterbi_baseline():
    freq = {}
    try:
        for line in open(FREQ_TSV, encoding="utf8"):
            w, n = line.rstrip("\n").split("\t")
            freq[w] = int(n)
    except OSError:
        return None
    TOTAL = sum(freq.values())
    MAXW = min(24, max((len(w) for w in freq), default=1))
    OOV = math.log(TOTAL * 100)
    PEN = 1.0

    def cost(sp):
        n = freq.get(sp)
        return PEN + (OOV * len(sp) if n is None else math.log(TOTAL / n))

    btp = bfp = bfn = 0
    for t, l in hold:
        n = len(t)
        best = [math.inf] * (n + 1)
        back = [0] * (n + 1)
        best[0] = 0.0
        for i in range(1, n + 1):
            for ln in range(1, min(MAXW, i) + 1):
                pv = best[i - ln]
                if pv == math.inf:
                    continue
                c = pv + cost(t[i - ln:i])
                if c < best[i]:
                    best[i] = c
                    back[i] = ln
        starts = set()
        i = n
        while i > 0:
            starts.add(i - back[i])
            i -= back[i]
        for i in range(1, n):
            if l[i] == "?":
                continue
            p = i in starts
            if l[i] == "1" and p:
                btp += 1
            elif l[i] == "1":
                bfn += 1
            elif p:
                bfp += 1
    bP = btp / max(1, btp + bfp)
    bR = btp / max(1, btp + bfn)
    return bP, bR, 2 * bP * bR / max(1e-9, bP + bR)


base = viterbi_baseline()
print(f"\nheld-out {len(hold):,} runs · {tp+fp+fn+tn:,} supervised positions")
print(f"  BiLSTM          P {100*P:.1f}%  R {100*R:.1f}%  F1 {100*F:.1f}%")
if base:
    print(f"  unigram Viterbi P {100*base[0]:.1f}%  R {100*base[1]:.1f}%  F1 {100*base[2]:.1f}%   (segment.ts, same split)")
    print(f"  → F1 {100*(F-base[2]):+.1f} points")

torch.save({"model": m.state_dict(), "cv": cv,
            "held_out": {"P": P, "R": R, "F1": F, "baseline": base, "runs": len(hold)}},
           f"{OUTDIR}/km_segmenter.pt")
print(f"# saved {OUTDIR}/km_segmenter.pt", file=sys.stderr)
