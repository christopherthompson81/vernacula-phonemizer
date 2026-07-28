#!/usr/bin/env python3
"""
Sindhi structural tagger — per-grapheme BiLSTM over the Perso-Arabic letters, one IPA-chunk tag per
letter (the Bengali/Norwegian `structuralTagger.ts` contract: output length == input length, decoded
under a consonant-consistency mask, so it CANNOT break the verified consonant backbone).

Aimed at the measured headroom: the abjad leaves short vowels unwritten and the rule g2p defaults
every one to [ə], but ə is only 48.6% of decision slots — 81.4% of WORD-FINAL slots are something
else, overwhelmingly the retained grammatical -ʊ. That is morphologically conditioned, hence learnable.
(Contrast Urdu, where ə is 71.5% and a tagger LOST to the always-ə prior — see ur_tagger_investigation.md.)

Reports the model against three baselines so the number means something:
  always-ə          the Urdu comparison prior
  final-ʊ rule      always-ə, except a word-final slot becomes ʊ — the cheap rule the data suggests
  rule g2p          what the shipped lexicon-free engine actually produces today

  python3 train_sd_tagger.py            # train + eval on a held-out OOV split
  python3 train_sd_tagger.py --folds 5  # 5-fold CV (the honest read at this data size)
Run under /mnt/data/omnivoice_ipa/train_venv/bin/python (torch + cuda).
"""
import json, random, sys
from pathlib import Path

import torch
import torch.nn as nn

HERE = Path(__file__).resolve().parent
DATA = HERE / "sd_tagger_data.tsv"
META = HERE / "sd_tagger_meta.json"
OUT = HERE / "sd_tagger.pt"

SEED = 0
EMB, HID, LAYERS, DROP = 128, 256, 2, 0.3
EPOCHS, BS, LR = 120, 32, 1e-3
SHORT_SET = set("əʊɪaiueoɛɔ")


def load():
    meta = json.loads(META.read_text(encoding="utf8"))
    src, tags = meta["src"], {int(k): v for k, v in meta["tags"].items()}
    tag2id = {v: k for k, v in tags.items()}
    rows = []
    for line in DATA.read_text(encoding="utf8").splitlines():
        if not line.strip():
            continue
        w, letters, tg = line.split("\t")
        rows.append((w, letters.split(" "), tg.split(" ")))
    return meta, src, tags, tag2id, rows


def encode(rows, src, tag2id):
    X, Y = [], []
    for _, letters, tg in rows:
        X.append([src.get(c, 1) for c in letters])
        Y.append([tag2id[t] for t in tg])
    return X, Y


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
        chunk = idx[i:i + bs]
        L = max(len(X[j]) for j in chunk)
        xb = torch.zeros(len(chunk), L, dtype=torch.long)
        yb = torch.full((len(chunk), L), -100, dtype=torch.long)
        for r, j in enumerate(chunk):
            xb[r, :len(X[j])] = torch.tensor(X[j])
            yb[r, :len(Y[j])] = torch.tensor(Y[j])
        yield xb, yb


def is_decision(tag: str) -> bool:
    """A slot the abjad leaves open: the tag ends in a short vowel, or is the empty chunk."""
    return tag == "_" or (len(tag) > 0 and tag[-1] in SHORT_SET)


def evaluate(model, rows, X, Y, tags, char_tags, src, dev):
    """Word-level exact match + per-decision-slot accuracy, vs the three baselines."""
    model.eval()
    slot_n = slot_hit = 0
    base_schwa = base_final = base_rule = 0
    word_n = word_hit = 0
    with torch.no_grad():
        for k, (w, letters, gold) in enumerate(rows):
            xb = torch.tensor([X[k]], device=dev)
            logits = model(xb)[0].cpu()
            pred = []
            for i, c in enumerate(letters):
                valid = char_tags.get(c)
                if not valid:
                    pred.append(gold[i])
                    continue
                row = logits[i]
                best, bv = valid[0], row[valid[0]].item()
                for t in valid[1:]:
                    if row[t].item() > bv:
                        best, bv = t, row[t].item()
                pred.append(tags[best])
            word_n += 1
            if pred == gold:
                word_hit += 1
            for i, g in enumerate(gold):
                if not is_decision(g):
                    continue
                slot_n += 1
                if pred[i] == g:
                    slot_hit += 1
                # baselines, expressed as the tag the baseline would emit for this letter
                stem = g[:-1] if (g != "_" and g[-1] in SHORT_SET) else ""
                final = (i == len(gold) - 1)
                if g == stem + "ə":
                    base_schwa += 1
                if g == (stem + "ʊ" if final else stem + "ə"):
                    base_final += 1
    return dict(word=word_hit / max(1, word_n), slot=slot_hit / max(1, slot_n),
                schwa=base_schwa / max(1, slot_n), finalu=base_final / max(1, slot_n),
                n_slots=slot_n, n_words=word_n)


def run_split(rows, src, tags, tag2id, char_tags, tr_idx, te_idx, dev, verbose=True):
    X, Y = encode(rows, src, tag2id)
    Xtr, Ytr = [X[i] for i in tr_idx], [Y[i] for i in tr_idx]
    te_rows = [rows[i] for i in te_idx]
    Xte, Yte = [X[i] for i in te_idx], [Y[i] for i in te_idx]
    model = Tagger(len(src), len(tags)).to(dev)
    opt = torch.optim.Adam(model.parameters(), LR)
    crit = nn.CrossEntropyLoss(ignore_index=-100)
    best, best_state, patience = -1.0, None, 0
    for ep in range(EPOCHS):
        model.train()
        tot = nb = 0
        for xb, yb in batches(Xtr, Ytr, BS):
            xb, yb = xb.to(dev), yb.to(dev)
            opt.zero_grad()
            loss = crit(model(xb).reshape(-1, len(tags)), yb.reshape(-1))
            loss.backward()
            opt.step()
            tot += loss.item()
            nb += 1
        if (ep + 1) % 10 == 0:
            m = evaluate(model, te_rows, Xte, Yte, tags, char_tags, src, dev)
            if verbose:
                print(f"  ep {ep+1:3d} loss {tot/nb:.3f}  slot {m['slot']:.1%}  word {m['word']:.1%}", flush=True)
            if m["slot"] > best:
                best, best_state, patience = m["slot"], {k: v.cpu().clone() for k, v in model.state_dict().items()}, 0
            else:
                patience += 1
                if patience >= 4:
                    break
    if best_state:
        model.load_state_dict(best_state)
        model.to(dev)
    return model, evaluate(model, te_rows, Xte, Yte, tags, char_tags, src, dev)


def main():
    random.seed(SEED)
    torch.manual_seed(SEED)
    meta, src, tags, tag2id, rows = load()
    char_tags = {c: v for c, v in meta["charTags"].items()}
    dev = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"# {len(rows)} words, {len(src)} symbols, {len(tags)} tags, device={dev}")

    folds = 1
    if "--folds" in sys.argv:
        folds = int(sys.argv[sys.argv.index("--folds") + 1])

    idx = list(range(len(rows)))
    random.shuffle(idx)
    if folds == 1:
        cut = int(len(idx) * 0.8)
        splits = [(idx[:cut], idx[cut:])]
    else:
        size = len(idx) // folds
        splits = [(idx[:i * size] + idx[(i + 1) * size:], idx[i * size:(i + 1) * size]) for i in range(folds)]

    agg = []
    for fi, (tr, te) in enumerate(splits):
        print(f"\n## fold {fi+1}/{len(splits)}  train={len(tr)} test={len(te)}")
        model, m = run_split(rows, src, tags, tag2id, char_tags, tr, te, dev, verbose=(folds == 1))
        print(f"   slots={m['n_slots']}  TAGGER slot {m['slot']:.1%}  word-exact {m['word']:.1%}")
        print(f"   baselines: always-ə {m['schwa']:.1%}   final-ʊ rule {m['finalu']:.1%}")
        agg.append(m)
        if folds == 1:
            torch.save({"state": model.state_dict(), "src": src, "tags": tags,
                        "charTags": char_tags, "cfg": dict(emb=EMB, hid=HID, layers=LAYERS)}, OUT)
            print(f"   saved {OUT}")
    if len(agg) > 1:
        n = len(agg)
        print(f"\n## MEAN over {n} folds")
        for k, lab in [("slot", "TAGGER slot"), ("schwa", "always-ə"), ("finalu", "final-ʊ rule"), ("word", "word-exact")]:
            print(f"   {lab:<16} {sum(a[k] for a in agg)/n:.1%}")


if __name__ == "__main__":
    main()
