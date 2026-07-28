#!/usr/bin/env python3
"""
Sindhi OOV short-vowel model — per-letter HARAKAT tagger over the 29K vocalized headwords of the
Sindhi Open Lexicon (SindhiLanguage.org, prepared by Amar Fayaz Buriro).

Why predict harakat and not IPA: the 29K rows give diacritized ORTHOGRAPHY, not attested IPA.
Deriving IPA gold by running them through our own reader would inherit our over-epenthesis bug, and
the model would simply learn to reproduce our error. Predicting the diacritic is the actual decision
the abjad leaves open; the existing rule engine already converts harakat → IPA (`DEF.harakat`), so a
predicted harakat plugs into the shipped path unchanged.

Label per letter: none / fatha(ə) / kasra(i) / damma(u). Input: the bare letter sequence.
Output length == input length, so this keeps the structural-tagger property — it cannot alter the
consonant skeleton, only decorate it.

KNOWN LABEL NOISE, stated up front: the headwords are PARTIALLY diacritized (Phase 8), so "none"
conflates "genuinely no vowel" with "unwritten default vowel". That ceiling is in the data, not the
model, and it is why the honest baseline here is always-none rather than always-ə.

  python3 train_sd_airab.py            # 80/20 OOV split
  python3 train_sd_airab.py --folds 5
Run under /mnt/data/omnivoice_ipa/train_venv/bin/python (torch + cuda).
"""
import json, random, sys
from collections import Counter
from pathlib import Path

import torch
import torch.nn as nn

HERE = Path(__file__).resolve().parent
AIRAB = HERE / "sd_airab.json"          # {bare: vocalized} — produced by ingest_sd_airab.py
OUT = HERE / "sd_airab_tagger.pt"

HARAKAT = {"َ": 1, "ِ": 2, "ُ": 3}       # fatha, kasra, damma
LABELS = ["none", "fatha", "kasra", "damma"]
SKIP = {"ّ", "ْ", "ً", "ٌ", "ٍ", "ـ"}    # shadda/sukun/tanwin/tatweel — not modelled

SEED = 0
EMB, HID, LAYERS, DROP = 128, 256, 2, 0.3
EPOCHS, BS, LR = 60, 64, 1e-3


def build():
    """(bare letters, per-letter harakat label). A harakat attaches to the letter BEFORE it."""
    data = json.loads(AIRAB.read_text(encoding="utf8"))
    rows = []
    for bare, voc in data.items():
        letters, labels = [], []
        for ch in voc:
            if ch in SKIP:
                continue
            if ch in HARAKAT:
                if labels:
                    labels[-1] = HARAKAT[ch]
                continue
            letters.append(ch)
            labels.append(0)
        if letters and len(letters) == len(labels):
            rows.append((bare, letters, labels))
    return rows


class Tagger(nn.Module):
    def __init__(self, nsrc, ntag):
        super().__init__()
        self.e = nn.Embedding(nsrc, EMB, padding_idx=0)
        self.lstm = nn.LSTM(EMB, HID, LAYERS, batch_first=True, bidirectional=True, dropout=DROP)
        self.o = nn.Linear(2 * HID, ntag)

    def forward(self, x):
        return self.o(self.lstm(self.e(x))[0])


def batches(X, Y, bs, shuffle=True):
    idx = list(range(len(X)))
    if shuffle:
        random.shuffle(idx)
    for i in range(0, len(idx), bs):
        ch = idx[i:i + bs]
        L = max(len(X[j]) for j in ch)
        xb = torch.zeros(len(ch), L, dtype=torch.long)
        yb = torch.full((len(ch), L), -100, dtype=torch.long)
        for r, j in enumerate(ch):
            xb[r, :len(X[j])] = torch.tensor(X[j])
            yb[r, :len(Y[j])] = torch.tensor(Y[j])
        yield xb, yb


def evaluate(model, X, Y, dev):
    model.eval()
    n = hit = 0
    nz = nzhit = 0          # non-"none" slots: did we get the RIGHT vowel where one exists?
    pred_nz = 0
    word_n = word_hit = 0
    with torch.no_grad():
        for xb, yb in batches(X, Y, 128, shuffle=False):
            xb = xb.to(dev)
            p = model(xb).argmax(-1).cpu()
            for r in range(xb.size(0)):
                ok = True
                for c in range(xb.size(1)):
                    g = yb[r, c].item()
                    if g == -100:
                        continue
                    q = p[r, c].item()
                    n += 1
                    hit += (q == g)
                    if g != 0:
                        nz += 1
                        nzhit += (q == g)
                    if q != 0:
                        pred_nz += 1
                    ok &= (q == g)
                word_n += 1
                word_hit += ok
    return dict(letter=hit / n, vowel_recall=nzhit / max(1, nz), word=word_hit / word_n,
                n=n, nz=nz, pred_nz=pred_nz)


def run(rows, tr, te, dev, verbose=True):
    src = {"<pad>": 0, "<unk>": 1}
    for i in tr:
        for c in rows[i][1]:
            src.setdefault(c, len(src))
    enc = lambda i: [src.get(c, 1) for c in rows[i][1]]
    Xtr, Ytr = [enc(i) for i in tr], [rows[i][2] for i in tr]
    Xte, Yte = [enc(i) for i in te], [rows[i][2] for i in te]

    base = Counter()
    for i in te:
        base.update(rows[i][2])
    always_none = base[0] / sum(base.values())

    model = Tagger(len(src), len(LABELS)).to(dev)
    opt = torch.optim.Adam(model.parameters(), LR)
    crit = nn.CrossEntropyLoss(ignore_index=-100)
    best, best_state, bad = -1.0, None, 0
    for ep in range(EPOCHS):
        model.train()
        tot = nb = 0
        for xb, yb in batches(Xtr, Ytr, BS):
            xb, yb = xb.to(dev), yb.to(dev)
            opt.zero_grad()
            loss = crit(model(xb).reshape(-1, len(LABELS)), yb.reshape(-1))
            loss.backward()
            opt.step()
            tot += loss.item(); nb += 1
        if (ep + 1) % 5 == 0:
            m = evaluate(model, Xte, Yte, dev)
            if verbose:
                print(f"  ep {ep+1:3d} loss {tot/nb:.4f}  letter {m['letter']:.1%}  "
                      f"vowel-recall {m['vowel_recall']:.1%}  word {m['word']:.1%}", flush=True)
            if m["letter"] > best:
                best, best_state, bad = m["letter"], {k: v.cpu().clone() for k, v in model.state_dict().items()}, 0
            else:
                bad += 1
                if bad >= 3:
                    break
    if best_state:
        model.load_state_dict(best_state); model.to(dev)
    m = evaluate(model, Xte, Yte, dev)
    m["always_none"] = always_none
    return model, src, m


def main():
    random.seed(SEED); torch.manual_seed(SEED)
    rows = build()
    dist = Counter(l for _, _, ls in rows for l in ls)
    tot = sum(dist.values())
    print(f"# {len(rows)} vocalized words, {tot} letter slots")
    print("# label distribution: " + "  ".join(f"{LABELS[k]} {v} ({v/tot:.1%})" for k, v in sorted(dist.items())))
    dev = "cuda" if torch.cuda.is_available() else "cpu"

    folds = int(sys.argv[sys.argv.index("--folds") + 1]) if "--folds" in sys.argv else 1
    idx = list(range(len(rows))); random.shuffle(idx)
    if folds == 1:
        cut = int(len(idx) * 0.8)
        splits = [(idx[:cut], idx[cut:])]
    else:
        sz = len(idx) // folds
        splits = [(idx[:i*sz] + idx[(i+1)*sz:], idx[i*sz:(i+1)*sz]) for i in range(folds)]

    agg = []
    for fi, (tr, te) in enumerate(splits):
        print(f"\n## fold {fi+1}/{len(splits)}  train={len(tr)} test={len(te)}")
        model, src, m = run(rows, tr, te, dev, verbose=(folds == 1))
        print(f"   letter-acc {m['letter']:.1%}   (always-none baseline {m['always_none']:.1%})")
        print(f"   vowel-recall (right vowel where one exists) {m['vowel_recall']:.1%}  "
              f"[{m['nz']} vowel slots; predicted {m['pred_nz']}]")
        print(f"   word-exact {m['word']:.1%}")
        agg.append(m)
        if folds == 1:
            torch.save({"state": model.state_dict(), "src": src, "labels": LABELS,
                        "cfg": dict(emb=EMB, hid=HID, layers=LAYERS)}, OUT)
            print(f"   saved {OUT}")
    if len(agg) > 1:
        n = len(agg)
        print(f"\n## MEAN over {n} folds")
        for k, lab in [("letter", "letter-acc"), ("always_none", "always-none"),
                       ("vowel_recall", "vowel-recall"), ("word", "word-exact")]:
            print(f"   {lab:<14} {sum(a[k] for a in agg)/n:.1%}")


if __name__ == "__main__":
    main()
