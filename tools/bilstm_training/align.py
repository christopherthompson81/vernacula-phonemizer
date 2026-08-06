#!/usr/bin/env python3
"""Multiprocess hard-EM grapheme→phoneme-chunk alignment. Generic over phone-token lists.

Turns (word, phone-list) pairs into per-CHARACTER labels — each grapheme is aligned to "" (silent), one phone, or a
two-phone chunk — which is what makes a char→tag BiLSTM trainable on a pronunciation lexicon at all. The Viterbi
E-step is independent per word, so it shards across a Pool (map → merge counts → smooth); the M-step is a smoothed
renormalise on the driver.

SEP is the module-level separator joining a 2-phone chunk, and CALLERS SET IT BEFORE ALIGNING:
    import align
    align.SEP = " "        # multi-CHAR phone alphabet (English ARPABET: "K"+"S" → "K S")
    align.SEP = ""         # single-CHAR phones, the default (IPA: "e"+"ɪ" → "eɪ", "ɔ"+"̃" → "ɔ̃")
Workers inherit it through fork() on Linux. Setting it after align_parallel() has started has no effect.

Extracted from tools/norwegian/nb_tagger_parallel.py, where it lived beside a Norwegian-specific perceptron
baseline; en/da/fr were importing that whole module (and its Norwegian loaders) to reach this one function.
The DP and the smoothing constants are unchanged, so alignments are identical to the pre-extraction ones.
"""
import math
import time
from collections import defaultdict
from multiprocessing import Pool, cpu_count

N_PROC = max(1, cpu_count() - 1)

# Separator joining a 2-phone chunk. "" works for SINGLE-CHAR phones (Norwegian IPA: "e"+"ɪ"="eɪ"); a multi-CHAR
# phone alphabet (English ARPABET: "K"+"S") needs " " to preserve token boundaries. Callers set it before aligning
# (inherited by the fork()ed Pool workers on Linux).
SEP = ""


def chunks(seq, n):
    """Split seq into n roughly-equal contiguous shards."""
    k, m = divmod(len(seq), n)
    return [seq[i * k + min(i, m):(i + 1) * k + min(i + 1, m)] for i in range(n)]


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


def align_parallel(rows, iters=8, quiet=False):
    """rows: [(word, [phone, ...]), ...] → [(word, [(char, chunk), ...]), ...], dropping unalignable words."""
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
        if not quiet:
            print(f"  align iter {it}: {time.time()-t:.1f}s", flush=True)
    with Pool(N_PROC, initializer=_init_prob, initargs=(prob,)) as p:
        decoded = p.map(_decode, shards)
    aligned = [x for part in decoded for x in part]
    return aligned
