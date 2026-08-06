#!/usr/bin/env python3
"""Khmer word-boundary AVERAGED PERCEPTRON — the pre-neural baseline for the BiLSTM tagger.

WHY MEASURE IT AT ALL, given the BiLSTM already works. Two reasons, and the second is the interesting one:
  1. A neural result with no linear baseline beside it does not say how much the architecture bought. The label
     cleaning (build_km_segmenter_data.py) might be doing most of the work, in which case a much cheaper model
     would do.
  2. ⚠ A PERCEPTRON COULD SHIP IN THE SYNC PATH. The BiLSTM needs `onnxruntime-node`, an OPTIONAL dependency, so it
     can only be the async tier — `phonemize` never benefits. A perceptron is a dictionary of feature weights and
     an addition loop: no dependency, no ONNX graph, microseconds per character. If it were close, "close" would
     be worth more than the F1 gap, because every caller would get it.

FEATURES are the standard character-window set from the Chinese/Thai segmentation literature (Zhang & Clark 2007
and descendants), which is what a BiLSTM's embedding+recurrence generalises: the characters either side of the
candidate boundary, their bigrams, and one jump bigram. Deciding position i means "does a word START at i".

  .venv/bin/python tools/khmer/train_km_perceptron.py /tmp/km_seg.tsv src/languages/khmer

⚠ THE SPLIT IS REPLICATED EXACTLY, not re-drawn. `train_km_segmenter.py` filters rows the same way, seeds
random with 0 and shuffles once, then takes the first fifth as held-out; the identical sequence of operations is
repeated here so the two models are scored on the same runs. Re-drawing the split would make the comparison a
different experiment, which is the mistake this file exists to avoid.
"""
import os
import random
import sys
from collections import defaultdict

SRC = sys.argv[1]
OUTDIR = sys.argv[2] if len(sys.argv) > 2 else "."
EPOCHS = int(os.environ.get("EPOCHS", "5"))
# A cap keeps a pure-Python trainer honest about wall clock; 0 = use everything.
MAX_POS = int(os.environ.get("MAX_POS", "0"))

# ---- the identical split as the BiLSTM ------------------------------------------------------------------------
random.seed(0)
rows = []
for line in open(SRC, encoding="utf8"):
    t, l = line.rstrip("\n").split("\t")
    if len(t) != len(l):
        continue
    if all(c == "?" for c in l[1:]):
        continue
    rows.append((t, l))
random.shuffle(rows)
nh = len(rows) // 5
hold, train = rows[:nh], rows[nh:]
print(f"# runs {len(rows):,} (train {len(train):,} / held-out {len(hold):,}) — same split as the BiLSTM",
      file=sys.stderr, flush=True)

# ⚠ A PRINTABLE SENTINEL, and deliberately not "\x00". The weights ship as a TSV that the TS runtime reads, and a
# NUL byte inside a key is a hazard in that pipeline for no benefit. "^" cannot occur in Khmer text, so it cannot
# collide with a real character. This string is a WIRE FORMAT shared with khmerPerceptron.ts's `PAD` — change one
# and the edge-of-run features silently address nothing.
PAD = "^"


def feats(t: str, i: int) -> tuple:
    """The character window around a candidate boundary at i. Prefixes keep the feature spaces disjoint."""
    c_2 = t[i - 2] if i >= 2 else PAD
    c_1 = t[i - 1] if i >= 1 else PAD
    c0 = t[i] if i < len(t) else PAD
    c1 = t[i + 1] if i + 1 < len(t) else PAD
    c2 = t[i + 2] if i + 2 < len(t) else PAD
    return (
        "a" + c_2, "b" + c_1, "c" + c0, "d" + c1, "e" + c2,
        "f" + c_2 + c_1, "g" + c_1 + c0, "h" + c0 + c1, "i" + c1 + c2,
        "j" + c_1 + c1,                      # jump bigram: the pair the boundary would separate
        "k" + c_1 + c0 + c1,                 # trigram straddling the boundary
    )


# ---- averaged perceptron (lazy averaging: `acc` holds the running weight-sum) ---------------------------------
w: dict = defaultdict(float)
acc: dict = defaultdict(float)
last: dict = defaultdict(int)
step = 1

examples = []
for t, l in train:
    for i in range(1, len(t)):
        if l[i] != "?":
            examples.append((t, i, 1 if l[i] == "1" else -1))
if MAX_POS and len(examples) > MAX_POS:
    random.shuffle(examples)
    examples = examples[:MAX_POS]
print(f"# supervised training positions {len(examples):,}", file=sys.stderr, flush=True)


def update(fs, y):
    global step
    for f in fs:
        acc[f] += (step - last[f]) * w[f]
        last[f] = step
        w[f] += y
    step += 1


for ep in range(EPOCHS):
    random.shuffle(examples)
    wrong = 0
    for t, i, y in examples:
        fs = feats(t, i)
        s = 0.0
        for f in fs:
            s += w[f]
        if (s > 0 and y < 0) or (s <= 0 and y > 0):
            update(fs, y)
            wrong += 1
        else:
            step += 1
    print(f"# epoch {ep + 1}/{EPOCHS} errors {wrong:,} ({100*wrong/len(examples):.2f}%)", file=sys.stderr, flush=True)

# finalise the average
avg = {}
for f, v in w.items():
    acc[f] += (step - last[f]) * v
    a = acc[f] / step
    if abs(a) > 1e-6:
        avg[f] = a
print(f"# features {len(avg):,} (of {len(w):,} touched)", file=sys.stderr, flush=True)

# ---- held-out P/R/F1, scored exactly as the BiLSTM is ---------------------------------------------------------
tp = fp = fn = tn = 0
for t, l in hold:
    for i in range(1, len(t)):
        if l[i] == "?":
            continue
        s = 0.0
        for f in feats(t, i):
            s += avg.get(f, 0.0)
        p = s > 0
        if l[i] == "1":
            if p:
                tp += 1
            else:
                fn += 1
        elif p:
            fp += 1
        else:
            tn += 1
P = tp / max(1, tp + fp)
R = tp / max(1, tp + fn)
F = 2 * P * R / max(1e-9, P + R)
print(f"\nheld-out {len(hold):,} runs · {tp+fp+fn+tn:,} supervised positions")
print(f"  averaged perceptron  P {100*P:.1f}%  R {100*R:.1f}%  F1 {100*F:.1f}%")
print(f"  (BiLSTM on this split: P 78.1%  R 97.5%  F1 86.7% · unigram Viterbi: F1 62.6%)")

out = f"{OUTDIR}/km-perceptron.tsv"
with open(out, "w", encoding="utf8") as fh:
    fh.write(f"# Khmer boundary perceptron — averaged weights. held-out P {100*P:.1f} R {100*R:.1f} F1 {100*F:.1f}\n")
    for f, v in sorted(avg.items(), key=lambda kv: -abs(kv[1])):
        fh.write(f"{f}\t{v:.4f}\n")
print(f"# saved {out} ({len(avg):,} weights)", file=sys.stderr)
