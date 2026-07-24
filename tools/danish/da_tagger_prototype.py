#!/usr/bin/env python3
"""Danish OOV g2p PROTOTYPE — does a data-driven tagger beat the ~24.7% rule floor on held-out words?

Pipeline (framework-free — torch is unavailable; averaged perceptron, the repo's posTagger precedent):
  1. deterministic 90/10 split of da-lexicon.tsv (train / held-out)
  2. hard-EM (Viterbi) many-to-{0,1,2} monotonic alignment of the training words → per-grapheme tags
  3. averaged-perceptron per-grapheme tagger (±4 grapheme window features)
  4. predict IPA for each held-out word; write /tmp/da_holdout.tsv (word, reference, tagger_pred)
     — the TS side (da_tagger_eval.mts) then folds all three and reports tagger% vs rules% on the SAME held-out.
"""
import os, re, math, random
from collections import defaultdict, Counter

HERE = os.path.dirname(os.path.abspath(__file__))
LEX = os.path.join(HERE, "..", "..", "src", "languages", "danish", "da-lexicon.tsv")
OUT = "/tmp/da_holdout.tsv"

VOWELS = set("aeiouyæøå")

def load():
    rows = []
    for line in open(LEX, encoding="utf-8"):
        line = line.rstrip("\n")
        if not line or "\t" not in line:
            continue
        w, ipa = line.split("\t", 1)
        ipa = ipa.replace("ˈ", "").replace("ˌ", "")  # drop stress for the segmental prototype
        if w and ipa:
            rows.append((w, list(ipa)))
    return rows

def split(rows):
    tr, te = [], []
    for w, p in rows:
        (te if (hash(("da", w)) % 10 == 0) else tr).append((w, p))
    return tr, te

# ---- hard-EM many-to-{0,1,2} monotonic alignment ----
def align_all(rows, iters=8):
    # P(chunk | grapheme); chunk is "" (deletion), one phoneme, or two.
    prob = defaultdict(lambda: defaultdict(float))
    # init: uniform-ish from co-occurrence within a word (grapheme ~ any phoneme chunk it could map to)
    for w, ph in rows:
        for g in w:
            prob[g][""] += 0.1
            for k in range(len(ph)):
                prob[g][ph[k]] += 1.0
                if k + 1 < len(ph):
                    prob[g][ph[k] + ph[k + 1]] += 0.3
    _norm(prob)
    for _ in range(iters):
        counts = defaultdict(lambda: defaultdict(float))
        for w, ph in rows:
            a = viterbi(w, ph, prob)
            if a is None:
                continue
            for g, chunk in a:
                counts[g][chunk] += 1.0
        prob = _smooth(counts)
    # final decode
    aligned = []
    for w, ph in rows:
        a = viterbi(w, ph, prob)
        if a is not None:
            aligned.append((w, a))
    return aligned, prob

def _norm(prob):
    for g, d in prob.items():
        s = sum(d.values()) or 1.0
        for k in d:
            d[k] /= s

def _smooth(counts):
    prob = defaultdict(lambda: defaultdict(float))
    for g, d in counts.items():
        s = sum(d.values()) + 1e-3
        for k, v in d.items():
            prob[g][k] = (v + 1e-4) / s
    return prob

def lp(prob, g, chunk):
    return math.log(prob[g].get(chunk, 1e-9))

def viterbi(w, ph, prob):
    G, P = len(w), len(ph)
    NEG = -1e18
    dp = [[NEG] * (P + 1) for _ in range(G + 1)]
    bp = [[None] * (P + 1) for _ in range(G + 1)]
    dp[0][0] = 0.0
    for i in range(1, G + 1):
        g = w[i - 1]
        for j in range(0, P + 1):
            # emit 0 (deletion)
            if dp[i - 1][j] + lp(prob, g, "") > dp[i][j]:
                dp[i][j] = dp[i - 1][j] + lp(prob, g, ""); bp[i][j] = (j, "")
            # emit 1
            if j >= 1:
                c = ph[j - 1]
                if dp[i - 1][j - 1] + lp(prob, g, c) > dp[i][j]:
                    dp[i][j] = dp[i - 1][j - 1] + lp(prob, g, c); bp[i][j] = (j - 1, c)
            # emit 2
            if j >= 2:
                c = ph[j - 2] + ph[j - 1]
                if dp[i - 1][j - 2] + lp(prob, g, c) > dp[i][j]:
                    dp[i][j] = dp[i - 1][j - 2] + lp(prob, g, c); bp[i][j] = (j - 2, c)
    if dp[G][P] <= NEG / 2:
        return None
    out = []
    i, j = G, P
    while i > 0:
        pj, chunk = bp[i][j]
        out.append((w[i - 1], chunk))
        i, j = i - 1, pj
    out.reverse()
    return out

# ---- averaged-perceptron per-grapheme tagger ----
def feats(chars, i):
    def g(k):
        return chars[k] if 0 <= k < len(chars) else "^" if k < 0 else "$"
    c = g(i)
    return [
        f"c={c}", f"p1={g(i-1)}", f"p2={g(i-2)}", f"n1={g(i+1)}", f"n2={g(i+2)}",
        f"pp={g(i-1)}{c}", f"nn={c}{g(i+1)}", f"tri={g(i-1)}{c}{g(i+1)}",
        f"pre={''.join(g(k) for k in range(-1,i+1))[-4:]}", f"pos={'i' if i==0 else 'f' if i==len(chars)-1 else 'm'}",
        f"v={'V' if c in VOWELS else 'C'}",
    ]

def train_perceptron(aligned, epochs=12):
    w = defaultdict(float); acc = defaultdict(float); n = 0
    data = [([g for g, _ in a], [t for _, t in a]) for _, a in aligned]
    labels = sorted({t for _, tags in data for t in tags})
    for ep in range(epochs):
        random.shuffle(data)
        for chars, tags in data:
            for i, gold in enumerate(tags):
                f = feats(chars, i)
                pred = _argmax(w, f, labels)
                if pred != gold:
                    for ff in f:
                        w[(ff, gold)] += 1.0; w[(ff, pred)] -= 1.0
                        acc[(ff, gold)] += n; acc[(ff, pred)] -= n
                n += 1
    final = {k: w[k] - acc[k] / n for k in w}
    return final, labels

def _argmax(w, f, labels):
    best, bs = labels[0], -1e18
    for L in labels:
        s = sum(w.get((ff, L), 0.0) for ff in f)
        if s > bs:
            bs, best = s, L
    return best

def predict(model, labels, word):
    chars = list(word)
    return "".join(_argmax(model, feats(chars, i), labels) for i in range(len(chars)))

MODEL = os.path.join(HERE, "..", "..", "src", "languages", "danish", "da-g2p.tsv")

def export_model(model, labels, path):
    # Compact TSV: line 1 = labels (tab-joined); then feature<TAB>label<TAB>weight (pruned |w|<0.75 to shrink).
    with open(path, "w", encoding="utf-8") as f:
        f.write("\t".join(labels) + "\n")
        for (feat, lab), w in sorted(model.items()):
            if abs(w) >= 0.75:
                f.write(f"{feat}\t{lab}\t{w:.2f}\n")

def main():
    random.seed(0)
    rows = load()
    # (1) HONEST held-out number: train on 90%, evaluate the 10% held-out (via the TS folded eval).
    tr, te = split(rows)
    print(f"lexicon {len(rows)} → train {len(tr)} / held-out {len(te)}")
    aligned_tr, _ = align_all(tr)
    model_tr, labels_tr = train_perceptron(aligned_tr)
    with open(OUT, "w", encoding="utf-8") as f:
        for w, ph in te:
            f.write(f"{w}\t{''.join(ph)}\t{predict(model_tr, labels_tr, w)}\n")
    print(f"held-out predictions → {OUT} (run tools/danish/da_tagger_eval for the folded %)")
    # (2) SHIPPED model: train on the FULL lexicon for max real-world OOV coverage.
    aligned, _ = align_all(rows)
    print(f"aligned {len(aligned)}/{len(rows)} full-lexicon words")
    model, labels = train_perceptron(aligned)
    export_model(model, labels, MODEL)
    kept = sum(1 for _, w in model.items() if abs(w) >= 0.75)
    print(f"exported {len(labels)} tags, {kept}/{len(model)} weights (pruned) → {MODEL}")

if __name__ == "__main__":
    main()
