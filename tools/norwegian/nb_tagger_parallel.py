#!/usr/bin/env python3
"""Norwegian OOV g2p perceptron — MULTIPROCESS trainer (uses all cores; the serial nb_tagger_prototype pins one).

Two embarrassingly-/near-parallel stages, sharded across a Pool:
  1. hard-EM alignment — the Viterbi E-step is independent per word (map → merge counts → smooth).
  2. averaged-perceptron training — ITERATIVE PARAMETER MIXING (McDonald 2010, NAACL): each epoch every worker trains
     one averaged-perceptron pass on its shard from the shared weights, then the driver averages the shards' weights
     and broadcasts. Converges to ~the serial accuracy while keeping all cores busy.

load()/split()/feats()/VOWELS are imported from nb_tagger_prototype (shared with the serial baseline). The Viterbi
(_viterbi/_lp/_smooth below) is REIMPLEMENTED here rather than imported: the worker version reads `prob` as a plain
dict via .get() so it pickles across the Pool, whereas the prototype's uses a defaultdict — same DP, pickling-safe.
align_parallel is what train_nb_bilstm.py imports for the SHIPPED model; the perceptron trainer here is the
comparison baseline (writes a tmp perceptron tsv, not shipped). Run UNBUFFERED for live logs:
  .venv/bin/python -u tools/norwegian/nb_tagger_parallel.py
"""
import os, sys, math, time, random
from collections import defaultdict
from multiprocessing import Pool, cpu_count

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from nb_tagger_prototype import load, split, feats, VOWELS  # loader + features (shared with the serial prototype)

N_PROC = max(1, cpu_count() - 1)
# Separator joining a 2-phone chunk. "" works for SINGLE-CHAR phones (Norwegian IPA: "e"+"ɪ"="eɪ"); a multi-CHAR
# phone alphabet (English ARPABET: "K"+"S") needs " " to preserve token boundaries. Callers set it before aligning
# (inherited by the fork()ed Pool workers on Linux).
SEP = ""
OUT = "/tmp/nb_holdout.tsv"
# the perceptron baseline model — NOT shipped (serving loads the BiLSTM's nb-g2p-tagger.onnx); tmp path, not a lang dir
MODEL = "/tmp/nb-g2p-perceptron.tsv"


def chunks(seq, n):
    """Split seq into n roughly-equal contiguous shards."""
    k, m = divmod(len(seq), n)
    return [seq[i * k + min(i, m):(i + 1) * k + min(i + 1, m)] for i in range(n)]


# ---------- parallel hard-EM alignment ----------
def _lp(prob, g, chunk):
    return math.log(prob.get(g, {}).get(chunk, 1e-9))


def _viterbi(w, ph, prob):
    G, P = len(w), len(ph)
    NEG = -1e18
    dp = [[NEG] * (P + 1) for _ in range(G + 1)]
    bp = [[None] * (P + 1) for _ in range(G + 1)]
    dp[0][0] = 0.0
    for i in range(1, G + 1):
        g = w[i - 1]
        for j in range(0, P + 1):
            if dp[i - 1][j] + _lp(prob, g, "") > dp[i][j]:
                dp[i][j] = dp[i - 1][j] + _lp(prob, g, ""); bp[i][j] = (j, "")
            if j >= 1:
                c = ph[j - 1]
                if dp[i - 1][j - 1] + _lp(prob, g, c) > dp[i][j]:
                    dp[i][j] = dp[i - 1][j - 1] + _lp(prob, g, c); bp[i][j] = (j - 1, c)
            if j >= 2:
                c = ph[j - 2] + SEP + ph[j - 1]
                if dp[i - 1][j - 2] + _lp(prob, g, c) > dp[i][j]:
                    dp[i][j] = dp[i - 1][j - 2] + _lp(prob, g, c); bp[i][j] = (j - 2, c)
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


_PROB = None  # per-iteration alignment model, set in each worker via the Pool initializer


def _init_prob(prob):
    global _PROB
    _PROB = prob


def _estep(rows_chunk):
    counts = {}
    for w, ph in rows_chunk:
        a = _viterbi(w, ph, _PROB)
        if a is None:
            continue
        for g, chunk in a:
            d = counts.setdefault(g, {})
            d[chunk] = d.get(chunk, 0.0) + 1.0
    return counts


def _decode(rows_chunk):
    out = []
    for w, ph in rows_chunk:
        a = _viterbi(w, ph, _PROB)
        if a is not None:
            out.append((w, a))
    return out


def _smooth(counts):
    prob = {}
    for g, d in counts.items():
        s = sum(d.values()) + 1e-3
        prob[g] = {k: (v + 1e-4) / s for k, v in d.items()}
    return prob


def _merge(dicts):
    tot = {}
    for c in dicts:
        for g, d in c.items():
            t = tot.setdefault(g, {})
            for k, v in d.items():
                t[k] = t.get(k, 0.0) + v
    return tot


def align_parallel(rows, iters=8):
    # init prob from within-word co-occurrence (identical to the serial prototype)
    prob = defaultdict(lambda: defaultdict(float))
    for w, ph in rows:
        for g in w:
            prob[g][""] += 0.1
            for k in range(len(ph)):
                prob[g][ph[k]] += 1.0
                if k + 1 < len(ph):
                    prob[g][ph[k] + SEP + ph[k + 1]] += 0.3
    prob = {g: dict(d) for g, d in prob.items()}
    for g, d in prob.items():
        s = sum(d.values()) or 1.0
        for k in d:
            d[k] /= s
    shards = chunks(rows, N_PROC)
    for it in range(iters):
        t = time.time()
        with Pool(N_PROC, initializer=_init_prob, initargs=(prob,)) as p:
            partials = p.map(_estep, shards)
        prob = _smooth(_merge(partials))
        print(f"  align iter {it}: {time.time()-t:.1f}s", flush=True)
    with Pool(N_PROC, initializer=_init_prob, initargs=(prob,)) as p:
        decoded = p.map(_decode, shards)
    aligned = [x for part in decoded for x in part]
    return aligned


# ---------- parallel averaged-perceptron (iterative parameter mixing) ----------
def _argmax(w, f, labels):
    best, bs = labels[0], -1e18
    for L in labels:
        s = 0.0
        for ff in f:
            s += w.get((ff, L), 0.0)
        if s > bs:
            bs, best = s, L
    return best


_SHARD = None
_LABELS = None


def _epoch(args):
    """One averaged-perceptron pass over this worker's shard, starting from the shared weights `w0`.
    Returns the shard's AVERAGED weights (dict) so the driver can mix them."""
    w0, seed = args
    w = dict(w0)
    acc = defaultdict(float)
    n = 1
    data = list(_SHARD)
    random.Random(seed).shuffle(data)
    for chars, tags in data:
        for i, gold in enumerate(tags):
            f = feats(chars, i)
            pred = _argmax(w, f, _LABELS)
            if pred != gold:
                for ff in f:
                    w[(ff, gold)] = w.get((ff, gold), 0.0) + 1.0
                    w[(ff, pred)] = w.get((ff, pred), 0.0) - 1.0
                    acc[(ff, gold)] += n
                    acc[(ff, pred)] -= n
            n += 1
    return {k: w[k] - acc[k] / n for k in w}


def train_ipm(aligned, epochs=10):
    data = [([g for g, _ in a], [t for _, t in a]) for _, a in aligned]
    labels = sorted({t for _, tags in data for t in tags})
    shards = chunks(data, N_PROC)
    w = {}
    for ep in range(epochs):
        t = time.time()
        # each task = (this worker's shard, the GLOBAL label set, the shared weights, a per-epoch seed); worker trains
        # one averaged pass. The label universe MUST be the global `labels`, not each shard's own — a worker that
        # (re)processes a 2nd shard would otherwise keep the first shard's labels, and even 1:1 a shard-local label set
        # lets _argmax never predict a gold tag absent from that shard, corrupting the averaged weights.
        with Pool(N_PROC) as p:
            results = p.map(_epoch_bound, [(shards[i], labels, w, ep * 100 + i) for i in range(len(shards))])
        # average the shards' weights (missing key = 0)
        keys = set()
        for r in results:
            keys.update(r.keys())
        w = {k: sum(r.get(k, 0.0) for r in results) / len(results) for k in keys}
        print(f"  epoch {ep}: {time.time()-t:.1f}s  ({len(w)} weights)", flush=True)
    return w, labels


def _epoch_bound(args):
    shard, labels, w0, seed = args
    global _SHARD, _LABELS
    _SHARD = shard
    _LABELS = labels  # the GLOBAL label universe (set every task — never a stale per-shard subset)
    return _epoch((w0, seed))


def predict(w, labels, word):
    chars = list(word)
    return "".join(_argmax(w, feats(chars, i), labels) for i in range(len(chars)))


def export_model(w, labels, path):
    with open(path, "w", encoding="utf-8") as f:
        f.write("\t".join(labels) + "\n")
        for (feat, lab), val in sorted(w.items()):
            if abs(val) >= 0.75:
                f.write(f"{feat}\t{lab}\t{val:.2f}\n")


def main():
    random.seed(0)
    t0 = time.time()
    rows = load()
    tr, te = split(rows)
    print(f"lexicon {len(rows)} → train {len(tr)} / held-out {len(te)}  ({N_PROC} workers)", flush=True)
    # (1) HONEST held-out: align+train on 90%, predict the 10%.
    aligned_tr = align_parallel(tr)
    print(f"aligned {len(aligned_tr)}/{len(tr)} train words ({time.time()-t0:.0f}s)", flush=True)
    w_tr, labels_tr = train_ipm(aligned_tr)
    with Pool(N_PROC) as p:
        preds = p.starmap(_predict_star, [(w_tr, labels_tr, w) for w, _ in te])
    with open(OUT, "w", encoding="utf-8") as f:
        for (w, ph), pr in zip(te, preds):
            f.write(f"{w}\t{''.join(ph)}\t{pr}\n")
    print(f"held-out predictions → {OUT}", flush=True)
    # (2) SHIPPED model: align+train on the FULL lexicon.
    random.seed(0)
    aligned = align_parallel(rows)
    print(f"aligned {len(aligned)}/{len(rows)} full-lexicon words", flush=True)
    w, labels = train_ipm(aligned)
    export_model(w, labels, MODEL)
    kept = sum(1 for _, val in w.items() if abs(val) >= 0.75)
    print(f"exported {len(labels)} tags, {kept}/{len(w)} weights → {MODEL}  (total {time.time()-t0:.0f}s)", flush=True)


def _predict_star(w, labels, word):
    return predict(w, labels, word)


if __name__ == "__main__":
    main()
