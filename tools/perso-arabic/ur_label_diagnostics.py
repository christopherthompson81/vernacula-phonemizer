#!/usr/bin/env python3
"""WHERE do the romanization-derived labels disagree with gold, and is the disagreement systematic?

Run 13 established the labels are ~63% accurate and that training on them hurts. "Noisy" is not
actionable; a confusion STRUCTURE is. The romanization overwrite preserves the backbone's vowel
COUNT, so gold↔backbone can be aligned once and the same indices reused for the overwritten
reading — which lets us score each individual change as improved / degraded / both-wrong.

Scored against CLE, independent of both Wiktionary and Dakshina.

    python3 tools/perso-arabic/ur_label_diagnostics.py
"""
import collections
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))

CLE = os.path.join(REPO, "tools/referee-eval/referees/ur.cle-speech.tsv")
CORE = "/tmp/ur_core.tsv"
DAK = os.path.join(HERE, "silver.dakshina.tsv")

VOWELS = re.compile(r"(ɑː|aː|uː|iː|eː|oː|ɔː|ɛː|ə|ɪ|ʊ|ɛ|ɔ|ɑ|a|e|o|u|i)")
SHORTSET = {"ə", "ɪ", "ʊ", "ɛ", "ɔ"}


def load(path, col):
    d = {}
    for line in open(path, encoding="utf-8"):
        if line.startswith("#"):
            continue
        p = line.rstrip("\n").split("\t")
        if len(p) > col and p[0]:
            d[p[0]] = p[col].replace("ˈ", "").replace("ˌ", "")
    return d


def align(gold, pred):
    n, m = len(gold), len(pred)
    d = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n + 1):
        d[i][0] = i
    for j in range(m + 1):
        d[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            c = 0 if gold[i - 1] == pred[j - 1] else 1
            d[i][j] = min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c)
    i, j, out = n, m, []
    while i > 0 and j > 0:
        c = 0 if gold[i - 1] == pred[j - 1] else 1
        if d[i][j] == d[i - 1][j - 1] + c:
            out.append((i - 1, j - 1))
            i, j = i - 1, j - 1
        elif d[i][j] == d[i - 1][j] + 1:
            out.append((i - 1, None))
            i -= 1
        else:
            j -= 1
    while i > 0:
        out.append((i - 1, None))
        i -= 1
    return out[::-1]


core = load(CORE, 1)
dak = load(DAK, 2)

verdict = collections.Counter()
confusion = collections.Counter()
by_pos = collections.Counter()
examples = collections.defaultdict(list)
lenclass = collections.Counter()

for line in open(CLE, encoding="utf-8"):
    if line.startswith("#"):
        continue
    f = line.rstrip("\n").split("\t")
    if len(f) < 2 or f[0] not in dak or f[0] not in core:
        continue
    gold = [v.replace("̃", "") for v in VOWELS.findall(f[1])]
    cv = VOWELS.findall(core[f[0]])
    dv = VOWELS.findall(dak[f[0]])
    if not gold or len(cv) != len(dv):
        continue
    pairs = align(gold, cv)
    for gi, pj in pairs:
        if pj is None:
            continue
        g, c, d_ = gold[gi], cv[pj], dv[pj]
        pos = "initial" if pj == 0 else ("final" if pj == len(cv) - 1 else "medial")
        if c != d_:  # the overwrite fired here
            if d_ == g and c != g:
                verdict["improved"] += 1
                by_pos[("improved", pos)] += 1
            elif c == g and d_ != g:
                verdict["degraded"] += 1
                by_pos[("degraded", pos)] += 1
                confusion[(g, d_)] += 1
                if len(examples[(g, d_)]) < 4:
                    examples[(g, d_)].append(f"{f[0]} gold={g} →{d_}")
                lenclass[("degraded", "len" if (len(g) > 1) != (len(d_) > 1) else "quality")] += 1
            else:
                verdict["both-wrong"] += 1
                by_pos[("both-wrong", pos)] += 1
                confusion[(g, d_)] += 1
                lenclass[("both-wrong", "len" if (len(g) > 1) != (len(d_) > 1) else "quality")] += 1
        else:
            verdict["unchanged-right" if c == g else "unchanged-wrong"] += 1

tot_fired = verdict["improved"] + verdict["degraded"] + verdict["both-wrong"]
print("=== what did each OVERWRITE do? (slots where the roman changed the backbone) ===")
for k in ("improved", "degraded", "both-wrong"):
    print(f"  {k:14} {verdict[k]:>6}  ({100 * verdict[k] / max(tot_fired, 1):.1f}% of fired)")
print(f"  net = improved - degraded = {verdict['improved'] - verdict['degraded']:+}")
print(f"\n  slots left unchanged: right {verdict['unchanged-right']}, wrong {verdict['unchanged-wrong']}")

print("\n=== is a bad overwrite a LENGTH error or a QUALITY error? ===")
for k in sorted(lenclass):
    print(f"  {k[0]:11} {k[1]:8} {lenclass[k]:>6}")

print("\n=== top gold→predicted confusions on bad overwrites ===")
for (g, d_), n in confusion.most_common(12):
    ex = "; ".join(examples.get((g, d_), [])[:2])
    print(f"  {g:>3} → {d_:<3} {n:>5}   {ex}")

print("\n=== by position ===")
for verd in ("improved", "degraded", "both-wrong"):
    row = {p: by_pos[(verd, p)] for p in ("initial", "medial", "final")}
    print(f"  {verd:11} {row}")
