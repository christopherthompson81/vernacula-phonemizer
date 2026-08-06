#!/usr/bin/env python3
"""Error analysis for the Khmer boundary models — WHICH cases do we lose on, and are the two models losing on the
same ones?

Scores the BiLSTM and the averaged perceptron on the identical held-out split, then buckets every mistake so the
failures can be read rather than guessed at. Two mistakes have different costs and are reported separately:

  MISSED (false negative)  — a real boundary not predicted. The joined reading survives, so the syllabifier
                             re-parses across it and the corruption this work exists to fix remains.
  SPURIOUS (false positive) — a boundary inside a real word. Splits something that was reading correctly.

Buckets are chosen to distinguish hypotheses a fix would act on:
  · is each side of the junction a KNOWN word (in km-wordfreq.tsv)? An unknown side means the model had no
    lexical anchor, which argues for more data rather than a better architecture.
  · how FREQUENT is the token being split, and how long? Rare/long favours the length guard's suspicion.
  · what is the human SPLIT RATE for that exact junction? A junction humans themselves split only sometimes is
    not really an error of the model's so much as a genuinely contested boundary.

  .venv/bin/python tools/khmer/errors_km_segmenter.py /tmp/km_seg.tsv src/languages/khmer <km-paragraphs.txt>
"""
import math
import random
import re
import sys
from collections import Counter, defaultdict

import torch
import torch.nn as nn

SEG = sys.argv[1]
DIR = sys.argv[2] if len(sys.argv) > 2 else "src/languages/khmer"
DUMP = sys.argv[3] if len(sys.argv) > 3 else None
LIMIT = int(sys.argv[4]) if len(sys.argv) > 4 else 20000

# ---- the identical split ---------------------------------------------------------------------------------------
random.seed(0)
rows = []
for line in open(SEG, encoding="utf8"):
    t, l = line.rstrip("\n").split("\t")
    if len(t) != len(l) or all(c == "?" for c in l[1:]):
        continue
    rows.append((t, l))
random.shuffle(rows)
hold = rows[: len(rows) // 5][:LIMIT]
print(f"  held-out sample {len(hold):,} runs")

# ---- vocabulary + human split rates, for bucketing -------------------------------------------------------------
freq = {}
try:
    for line in open(f"{DIR}/km-wordfreq.tsv", encoding="utf8"):
        w, n = line.rstrip("\n").split("\t")
        freq[w] = int(n)
except OSError:
    pass

rate = {}
if DUMP:
    KHt = re.compile(r"^[ក-៓ៜ-៝]+$")
    ANY = re.compile(r"[ក-៝]")
    single, spair, stot = Counter(), Counter(), Counter()
    for line in open(DUMP, encoding="utf8"):
        if len(ANY.findall(line)) < 40:
            continue
        toks = [t for t in re.split(r"[​‌\s]+", line) if ANY.search(t)]
        if not toks or sum(len(t) for t in toks) / len(toks) > 6:
            continue
        for chunk in re.split(r"\s+", line):
            tk = [t for t in re.split(r"[​‌]", chunk) if t and KHt.match(t)]
            for t in tk:
                single[t] += 1
            for a, b in zip(tk, tk[1:]):
                spair[(a, b)] += 1
                stot[a + b] += 1
    for (a, b), s in spair.items():
        obs = single.get(a + b, 0) + stot.get(a + b, 0)
        if obs >= 10:
            rate[(a, b)] = s / obs

# ---- models ----------------------------------------------------------------------------------------------------
EMB, HID, LAYERS, DROP = 96, 256, 2, 0.2


class Segmenter(nn.Module):
    def __init__(self, nc):
        super().__init__()
        self.e = nn.Embedding(nc, EMB, padding_idx=0)
        self.lstm = nn.LSTM(EMB, HID, LAYERS, batch_first=True, bidirectional=True, dropout=DROP)
        self.o = nn.Linear(2 * HID, 3)

    def forward(self, x):
        return self.o(self.lstm(self.e(x))[0])


ck = torch.load(f"{DIR}/km_segmenter.pt", map_location="cpu", weights_only=False)
cv = ck["cv"]
net = Segmenter(len(cv))
net.load_state_dict(ck["model"])
net.eval()

PAD = "^"
W = {}
for line in open(f"{DIR}/km-perceptron.tsv", encoding="utf8"):
    if line.startswith("#"):
        continue
    f, v = line.rstrip("\n").split("\t")
    W[f] = float(v)


def perc_pred(t, i):
    at = lambda k: t[k] if 0 <= k < len(t) else PAD
    c2, c1, c0, d1, d2 = at(i - 2), at(i - 1), at(i), at(i + 1), at(i + 2)
    s = (W.get("a" + c2, 0) + W.get("b" + c1, 0) + W.get("c" + c0, 0) + W.get("d" + d1, 0) + W.get("e" + d2, 0)
         + W.get("f" + c2 + c1, 0) + W.get("g" + c1 + c0, 0) + W.get("h" + c0 + d1, 0) + W.get("i" + d1 + d2, 0)
         + W.get("j" + c1 + d1, 0) + W.get("k" + c1 + c0 + d1, 0))
    return s > 0


def bilstm_preds(t):
    with torch.no_grad():
        x = torch.tensor([[cv.get(c, 1) for c in t]], dtype=torch.long)
        lo = net(x)[0]
        return [bool(lo[i][2] > lo[i][1]) for i in range(len(t))]


# ---- collect errors --------------------------------------------------------------------------------------------
def bucket_side(word):
    if word in freq:
        n = freq[word]
        return "known-frequent" if n >= 200 else "known-rare"
    return "OOV"


stats = {"bilstm": Counter(), "perc": Counter()}
missed_ctx = {"bilstm": Counter(), "perc": Counter()}
spurious_ctx = {"bilstm": Counter(), "perc": Counter()}
contested = {"bilstm": [0, 0], "perc": [0, 0]}   # [errors on contested junctions, total errors]
both_wrong = agree = 0
tot_positions = 0

for t, l in hold:
    bp = bilstm_preds(t)
    for i in range(1, len(t)):
        if l[i] == "?":
            continue
        tot_positions += 1
        gold = l[i] == "1"
        for name, pred in (("bilstm", bp[i]), ("perc", perc_pred(t, i))):
            if pred == gold:
                stats[name]["correct"] += 1
                continue
            kind = "MISSED" if gold else "SPURIOUS"
            stats[name][kind] += 1
            # the word this position sits inside / the two sides of the junction
            left = t[max(0, i - 8):i]
            right = t[i:i + 8]
            # nearest gold boundaries either side, to name the actual token
            ls = max((k for k in range(i) if l[k] == "1"), default=0)
            rs = min((k for k in range(i + 1, len(t)) if l[k] == "1"), default=len(t))
            a, b = t[ls:i], t[i:rs]
            if kind == "MISSED":
                stats[name][f"  missed · left {bucket_side(a)}"] += 1
                stats[name][f"  missed · right {bucket_side(b)}"] += 1
                missed_ctx[name][f"{a}|{b}"] += 1
                r = rate.get((a, b))
                contested[name][1] += 1
                if r is not None and r < 0.9:
                    contested[name][0] += 1
            else:
                tok = t[ls:rs]
                stats[name][f"  spurious · token {bucket_side(tok)}"] += 1
                stats[name][f"  spurious · token len {'<=6' if len(tok) <= 6 else '7-13' if len(tok) <= 13 else '>13'}"] += 1
                spurious_ctx[name][f"{a}·{b}"] += 1
        if bp[i] != gold and perc_pred(t, i) != gold:
            both_wrong += 1
        if bp[i] == perc_pred(t, i):
            agree += 1

print(f"  supervised positions scored {tot_positions:,}\n")
for name, label in (("bilstm", "BiLSTM"), ("perc", "perceptron")):
    s = stats[name]
    err = s["MISSED"] + s["SPURIOUS"]
    print(f"  ── {label}: {err:,} errors ({100*err/tot_positions:.2f}% of positions)")
    print(f"       MISSED   {s['MISSED']:,}  ({100*s['MISSED']/max(1,err):.0f}% of errors)")
    print(f"       SPURIOUS {s['SPURIOUS']:,}  ({100*s['SPURIOUS']/max(1,err):.0f}% of errors)")
    for k in sorted(k for k in s if k.startswith("  ")):
        print(f"     {k:42} {s[k]:,}")
    if rate and contested[name][1]:
        c, tt = contested[name]
        print(f"       of missed boundaries with a measurable human rate, {c:,} are CONTESTED (<90% of writers split them)")
    print()

print(f"  the two models agree on {100*agree/tot_positions:.1f}% of positions; "
      f"both wrong on {both_wrong:,} ({100*both_wrong/tot_positions:.2f}%)\n")
for name, label in (("bilstm", "BiLSTM"), ("perc", "perceptron")):
    print(f"  {label} — most frequent MISSED junctions (left|right):")
    for k, n in missed_ctx[name].most_common(10):
        print(f"     {n:5}  {k}")
    print(f"  {label} — most frequent SPURIOUS splits (before·after):")
    for k, n in spurious_ctx[name].most_common(10):
        print(f"     {n:5}  {k}")
    print()
