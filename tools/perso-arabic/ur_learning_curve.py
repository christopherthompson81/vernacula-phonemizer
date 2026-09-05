#!/usr/bin/env python3
"""Urdu OOV tagger — LEARNING CURVE on a FIXED dev set.

WHY THIS EXISTS. Run 3 of docs/investigations/ur/ur_tagger_investigation.md concluded "doubling the
data widened the gap" from two rows whose always-ə priors differ (62.9% vs 71.5%) — i.e. whose
DEV SETS differ, because ur_train_tagger.py draws dev as a 10% slice of the pool and the pool
grew. That is not a data-scaling experiment. Run 4 then read the train/dev gap (92.6/63.8) as
proof the signal is absent, but that argument was about NET SIZE; a 29pp train-dev gap is
equally the signature of too FEW examples. And 9,016 pairs is below this repo's own measured
~10k starvation line.

So the question "is the Urdu short-vowel ceiling informational, or was it never tested at
scale?" has never actually been asked. This script asks it the only way that answers it: ONE
dev set, held fixed, while the training size varies. If dev accuracy is still climbing at the
top of the curve, the ceiling claim is premature and more data is the lever. If it is flat
across a 4-8x sweep, the informational reading is corroborated on a controlled comparison
rather than a confounded one.

Reuses ur_train_tagger.py's aligner and model verbatim (imported, not copied) so the numbers
stay comparable to Runs 3-4.

    .venv/bin/python tools/perso-arabic/ur_learning_curve.py
"""
import os
import random
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
sys.path.insert(0, HERE)

os.environ.setdefault("UR_EXTRA", "1")  # the full 9,016-pair pool Run 3 used for its second row

import torch  # noqa: E402
import torch.nn as nn  # noqa: E402

# import the aligner + tokenizer from the Run 3-4 script without running its training path
_src = open(os.path.join(HERE, "ur_train_tagger.py"), encoding="utf8").read()
_src = _src.split("if MODE==\"align\":")[0]
_ns = {"__name__": "ur_align", "__file__": os.path.join(HERE, "ur_train_tagger.py"),
       "sys": sys, "os": os, "random": random}
exec(compile(_src, "ur_train_tagger.py(head)", "exec"), _ns)
align, toks, load_pool = _ns["align"], _ns["toks"], _ns["load_pool"]

SHORTQ = {"ə", "ɪ", "ʊ", "ɛ", "ɔ"}
MAJ = {"oː", "uː", "ɔː", "iː", "eː", "ɛː"}
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
strip = lambda s: s.replace("ˈ", "").replace("ˌ", "")  # noqa: E731


class Tagger(nn.Module):
    def __init__(s, nc, nl, emb=128, h=256):
        super().__init__()
        s.e = nn.Embedding(nc, emb, 0)
        s.lstm = nn.LSTM(emb, h, 2, batch_first=True, bidirectional=True, dropout=0.2)
        s.o = nn.Linear(2 * h, nl)

    def forward(s, x):
        return s.o(s.lstm(s.e(x))[0])


def build_aligned():
    aligned = []
    for skel, ipa in load_pool():
        a = align(skel, ipa)
        if a is not None and "".join(t for _, t in a) == ipa:
            aligned.append((skel, ipa, [c for c, _ in a], [t for _, t in a]))
    return aligned


def train_one(train, seed, epochs=25):
    random.seed(seed)
    torch.manual_seed(seed)
    cv = {"<pad>": 0, "<unk>": 1}
    lv = {"<pad>": 0}
    for chars, labs in train:
        for c in chars:
            cv.setdefault(c, len(cv))
        for t in labs:
            lv.setdefault(t, len(lv))
    char_tags = {}
    for chars, labs in train:
        for c, t in zip(chars, labs):
            char_tags.setdefault(c, set()).add(lv[t])
    mask = torch.full((len(cv), len(lv)), -1e9)
    for c, ci in cv.items():
        valid = char_tags.get(c)
        if not valid:
            mask[ci, :] = 0.0
        else:
            for t in valid:
                mask[ci, t] = 0.0
        mask[ci, 0] = 0.0
    mask = mask.to(DEVICE)
    m = Tagger(len(cv), len(lv)).to(DEVICE)
    opt = torch.optim.Adam(m.parameters(), 1e-3)
    crit = nn.CrossEntropyLoss(ignore_index=0)
    cid = lambda c: cv.get(c, 1)  # noqa: E731
    Tr = [([cid(c) for c in ch], [lv.get(t, 0) for t in lb]) for ch, lb in train]
    for _ in range(epochs):
        m.train()
        idx = list(range(len(Tr)))
        random.shuffle(idx)
        for k in range(0, len(idx), 256):
            b = idx[k:k + 256]
            mx = max(len(Tr[i][0]) for i in b)
            X = torch.zeros(len(b), mx, dtype=torch.long)
            Y = torch.zeros(len(b), mx, dtype=torch.long)
            for r, i in enumerate(b):
                X[r, :len(Tr[i][0])] = torch.tensor(Tr[i][0])
                Y[r, :len(Tr[i][1])] = torch.tensor(Tr[i][1])
            X, Y = X.to(DEVICE), Y.to(DEVICE)
            lo = m(X) + mask[X]
            loss = crit(lo.reshape(-1, len(lv)), Y.reshape(-1))
            opt.zero_grad()
            loss.backward()
            opt.step()
    m.eval()
    ilv = {i: t for t, i in lv.items()}
    return m, cv, mask, ilv


def evaluate(m, cv, mask, ilv, dev_set):
    cid = lambda c: cv.get(c, 1)  # noqa: E731

    def predict_tags(chars):
        X = torch.tensor([[cid(c) for c in chars]], device=DEVICE)
        with torch.no_grad():
            t = (m(X) + mask[X])[0].argmax(-1).tolist()
        return [ilv.get(x, "") for x in t]

    sslot = sdef = stag = 0
    mslot = mdef = mtag = 0
    word_ok = 0
    for skel, ipa, chars, gtags in dev_set:
        ptags = predict_tags(chars)
        if strip("".join(ptags)) == strip(ipa):
            word_ok += 1
        for gt, pt in zip(gtags, ptags):
            gtk = toks(strip(gt))
            ptk = toks(strip(pt))
            for q in gtk:
                if q in SHORTQ:
                    sslot += 1
                    if q == "ə":
                        sdef += 1
                    if pt and q in ptk:
                        stag += 1
                if q in MAJ:
                    mslot += 1
                    if q in ("oː", "iː"):
                        mdef += 1
                    if q in ptk:
                        mtag += 1
    return {
        "short": 100 * stag / max(sslot, 1), "short_prior": 100 * sdef / max(sslot, 1),
        "majhul": 100 * mtag / max(mslot, 1), "majhul_prior": 100 * mdef / max(mslot, 1),
        "word": 100 * word_ok / max(len(dev_set), 1),
    }


def load_extra(dev_skels, gold_skels):
    """Romanization-derived labels (silver.dakshina.tsv), aligned with the SAME aligner.

    ⚠ Every skeleton in the FIXED dev set is excluded, and so is every skeleton already in the
    gold pool — otherwise the curve would measure leakage, or would silently replace a gold
    label with a ~63%-accurate romanization-derived one."""
    path = os.environ.get("UR_EXTRA_LABELS") or os.path.join(HERE, "silver.dakshina.tsv")
    # Aligning ~300k pairs in pure Python is minutes, and the curve is re-run often — cache it.
    # ⚠ THE KEY MUST INCLUDE mtime+size, NOT JUST THE FILENAME. Both label builders write to the same
    # default path on every variant rebuild (--min-agree, --with-majhul, short-only), so a
    # filename-only key silently returns the PREVIOUS variant's alignment and reports its count as if
    # it came from the current file. That happened: review of #780 found a 30,089-pair cache being
    # served for a 36,328-row rebuild of silver.dakshina.tsv.
    st = os.stat(path)
    cache = f"/tmp/ur_extra_aligned_{os.path.basename(path)}_{int(st.st_mtime)}_{st.st_size}.pkl"
    if os.path.exists(cache):
        import pickle
        with open(cache, "rb") as fh:
            return pickle.load(fh)
    out = []
    for line in open(path, encoding="utf8"):
        if line.startswith("#"):
            continue
        p = line.rstrip("\n").split("\t")
        if len(p) < 3 or not p[0] or not p[2]:
            continue
        if p[0] in dev_skels or p[0] in gold_skels:
            continue
        a = align(p[0], p[2])
        if a is not None and "".join(t for _, t in a) == p[2]:
            out.append(([c for c, _ in a], [t for _, t in a]))
    import pickle
    with open(cache, "wb") as fh:
        pickle.dump(out, fh)
    return out


def run_curve(label, points, dev_set, prior, seeds=(1, 2, 3)):
    print(f"\n=== {label} ===", flush=True)
    print(f"{'train':>9} {'short-slot mean (range)':>26} {'Δ vs prior':>11} {'majhūl':>18} {'word-exact':>11}")
    for name, make in points:
        accs, majs, words = [], [], []
        t0 = time.time()
        for sd in seeds:
            sub = make(sd)
            m, cv, mask, ilv = train_one(sub, sd)
            r = evaluate(m, cv, mask, ilv, dev_set)
            accs.append(r["short"])
            majs.append(r["majhul"])
            words.append(r["word"])
            del m
            if DEVICE == "cuda":
                torch.cuda.empty_cache()
        mean = sum(accs) / len(accs)
        spread = max(accs) - min(accs)
        print(f"{name:>9} {mean:>18.1f}% (r{spread:.1f}) {mean - prior['short_prior']:>+10.1f} "
              f"{sum(majs) / len(majs):>16.1f}% {sum(words) / len(words):>10.1f}%"
              f"  [{(time.time() - t0) / len(seeds):.0f}s/seed]", flush=True)


CLE_PATH = os.path.join(REPO, "tools/referee-eval/referees/ur.cle-speech.tsv")
_VOW = None


def load_cle():
    out = {}
    for line in open(CLE_PATH, encoding="utf8"):
        if line.startswith("#"):
            continue
        p = line.rstrip("\n").split("\t")
        if len(p) >= 2 and p[0] and p[1]:
            out[p[0]] = p[1]
    return out


def dp_align(gold, pred):
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


def eval_vs_cle(m, cv, mask, ilv, cle):
    """Short-vowel CHOICE vs the INDEPENDENT human referee — the same metric every candidate
    source was scored on, so the tagger is directly comparable to its own training data."""
    import re
    vre = re.compile(r"(ɑː|aː|uː|iː|eː|oː|ɔː|ɛː|ə|ɪ|ʊ|ɛ|ɔ|ɑ|a|e|o|u|i)")
    shortset = {"ə", "ɪ", "ʊ"}
    cid = lambda c: cv.get(c, 1)  # noqa: E731
    tot = hit = prior = words = 0
    for w, gipa in cle.items():
        chars = list(w)
        if not chars:
            continue
        X = torch.tensor([[cid(c) for c in chars]], device=DEVICE)
        with torch.no_grad():
            t = (m(X) + mask[X])[0].argmax(-1).tolist()
        pred_ipa = "".join(ilv.get(x, "") for x in t)
        gold = [v.replace("̃", "") for v in vre.findall(gipa)]
        pred = vre.findall(pred_ipa)
        if not gold or not pred:
            continue
        words += 1
        for gi, pj in dp_align(gold, pred):
            g = gold[gi]
            if g not in shortset:
                continue
            tot += 1
            if pj is not None and pred[pj] == g:
                hit += 1
            if g == "ə":
                prior += 1
    return words, tot, 100 * hit / max(tot, 1), 100 * prior / max(tot, 1)


def main():
    phase = sys.argv[1] if len(sys.argv) > 1 else "both"
    aligned = build_aligned()
    # FIXED dev set — drawn ONCE, from a deterministic order, and never redrawn.
    aligned.sort(key=lambda r: r[0])
    random.Random(20260809).shuffle(aligned)
    ndev = len(aligned) // 10
    dev_set = aligned[:ndev]
    pool = [(c, t) for _, _, c, t in aligned[ndev:]]
    dev_skels = {r[0] for r in dev_set}
    gold_skels = {r[0] for r in aligned}
    print(f"aligned {len(aligned)} | FIXED dev {len(dev_set)} | gold trainable {len(pool)} | device {DEVICE}",
          flush=True)
    prior = evaluate(*train_one(pool[:256], 0, epochs=1), dev_set)
    print(f"dev always-ə prior {prior['short_prior']:.1f}%   default-majhūl prior {prior['majhul_prior']:.1f}%",
          flush=True)

    if phase in ("a", "both"):
        pts = [(str(n), (lambda n: lambda sd: random.Random(1000 + sd).sample(pool, n))(n))
               for n in [1000, 2000, 4000, 6000, len(pool)]]
        run_curve("PHASE A — gold pool only, fixed dev", pts, dev_set, prior)

    if phase in ("b", "both"):
        extra = load_extra(dev_skels, gold_skels)
        print(f"\nromanization-derived labels aligned & usable: {len(extra)}", flush=True)
        pts = []
        want = [int(x) for x in os.environ["UR_SIZES"].split(",")] if os.environ.get("UR_SIZES") \
            else [5000, 10000, 20000, len(extra)]
        for n in sorted({n for n in want if n <= len(extra)}):
            pts.append((f"{len(pool)}+{n}",
                        (lambda n: lambda sd: pool + random.Random(1000 + sd).sample(extra, n))(n)))
        pts.append((f"0+{len(extra)}", lambda sd: list(extra)))
        run_curve("PHASE B — gold + romanization-derived, SAME fixed dev", pts, dev_set, prior)

    if phase == "c":
        # ⚠ PHASE B's dev set is HINDI-DERIVED gold, and Run 6 established that Hindi and Urdu
        # diverge systematically on exactly the Arabic-template loanwords at issue (احساس Hindi
        # eːɦsɑːs vs Urdu ɪɦsɑːs), with CLE siding Urdu-native ~2:1 (Run 8). Scoring an
        # Urdu-native-trained model against Hindi-convention gold penalises it for being RIGHT.
        # Phase C removes that: train on Urdu-native labels with every CLE word held out, then
        # score against CLE — the independent human referee, on the same short-vowel-choice metric
        # every candidate source was measured with.
        cle = load_cle()
        extra_all = load_extra(dev_skels, gold_skels)
        # CLE is held out below by skeleton membership; load_extra already defaults UR_EXTRA_LABELS to
        # silver.dakshina.tsv, so nothing here may re-open it (doing so crashed `phase c` with
        # FileNotFoundError: '' whenever the env var was unset — review of #780).
        kept = []
        for chars, tags in extra_all:
            if "".join(chars) not in cle:
                kept.append((chars, tags))
        # UR_C_CAP subsamples the label pool. Used to separate LABEL QUALITY from SCALE: the
        # NC-licensed source (74% labels, 260k) clears the prior and the CC-BY-SA one (63.4%, 27k)
        # does not, but they differ on both axes. Capping the big one to the small one's size
        # holds scale constant so quality is the only remaining difference.
        n_cle_held = len(extra_all) - len(kept)  # count BEFORE the cap, else the cap is misreported
        cap = int(os.environ["UR_C_CAP"]) if os.environ.get("UR_C_CAP") else 0
        print(f"\nPHASE C: labels {len(extra_all)} → {len(kept)} after holding out "
              f"{n_cle_held} CLE words; CLE referee {len(cle)} words", flush=True)
        if cap and cap < len(kept):
            kept = random.Random(7).sample(kept, cap)
            print(f"⚠ label pool then CAPPED to {cap} (scale control)", flush=True)
        for name, data in ((f"gold {len(pool):,} only", pool),
                           (f"labels {len(kept)} (CLE held out)", kept),
                           ("gold + labels", pool + kept)):
            m, cv, mask, ilv = train_one(data, 1)
            w, t, acc, pr = eval_vs_cle(m, cv, mask, ilv, cle)
            print(f"  {name:36} vs CLE: {acc:5.1f}%  (always-ə {pr:.1f}%)  "
                  f"margin {acc - pr:+.1f}pp   [{w} words, {t} slots]", flush=True)
            del m
            if DEVICE == "cuda":
                torch.cuda.empty_cache()


if __name__ == "__main__":
    main()
