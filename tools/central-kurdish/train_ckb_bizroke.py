#!/usr/bin/env python3
"""Train + export the Central Kurdish BIZROKE tagger — the OOV tier for Sorani's one unwritten vowel.

⚠ WHY A TAGGER AND NOT MORE LEXICON. The AsoSoft source is 10,041 words and it is exhausted: the lexicon
built from it (build_ckb_lexicon.py) reaches 6.4% of FLEURS ckb word TYPES, while the source's own rate says
26.8% of the words this engine otherwise transcribes correctly are missing a bizroke. ~2,000 corpus types are
left. A fixed epenthesis rule was measured at every quality and is net negative (Run 37), because one
insertion after the first consonant is right that a vowel is missing and wrong about how many and which —
سفر is *safar*. A model conditioned on the WHOLE skeleton is a different instrument, and it works: 96.6%
word-exact on a STEM-BLIND held-out split against a 73.8% never-insert baseline (Runs 39, 41).

⚠ THE INPUT IS OUR OWN RULE OUTPUT, NOT THE ORTHOGRAPHY. `preprocess` on the serving side is
`phonemizeWordRules`, so the tagger reads the IPA this engine already produces and labels each code point
with "itself" or "itself + ɪ". Two consequences worth the unusual shape: the consonant-consistency mask in
core/structuralTagger.ts then makes it STRUCTURALLY IMPOSSIBLE for the model to alter a consonant — the only
tags any symbol ever emitted are itself and itself+ɪ — and the rules-only referee path is untouched, so the
ckb referee eval stays non-circular.

⚠ THE AUDIO CANNOT SCORE THIS, AND THE REFEREE COULD NOT UNTIL ITS FOLD WAS FIXED. The ASR under-transcribes
Sorani — 0.929 of our folded phone count, against 0.987 de / 0.998 fr — so it charges us for phones it never
emits. ckb.jsonc used to fold `[əɪ]` to NOTHING, which deletes the vowel from both sides and scores its
presence as free; it now normalises to ə (the referees agree on presence and position, only quality differs),
and the tier reads 85.2%/85.0% wikipron/kaikki against lexicon-only 74.8%/73.6% and rules-only 72.3%/71.2%.
The held-out split below is still the training-time instrument, and it is stem-blind because a random split
lets ئابووری train and ئابوورییان test — the number stops meaning anything (98.2% random against 96.7% stem-blind, measured the same way).

⚠ NO `<unk>`. Unlike the sd/bn taggers, an unseen input symbol DECLINES the word (serving falls back to the
rule reading) rather than permitting every tag. There is no tag here worth guessing.

Source: AsoSoft Kurdish-G2P-dataset — LICENSES/LicenseRef-AsoSoftKurdishG2P.txt for the terms, the two
mandatory citations, and the good-faith removal undertaking. NOT redistributed; clone it to run this.

  .venv/bin/python tools/central-kurdish/train_ckb_bizroke.py --src /path/to/Kurdish-G2P-dataset
"""
from __future__ import annotations

import argparse
import json
import os
import random
import shutil
import subprocess
import sys
import tempfile

import torch
import torch.nn as nn

from build_ckb_lexicon import to_ipa

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.normpath(os.path.join(HERE, "..", ".."))
DEST = os.path.join(ROOT, "src", "languages", "central-kurdish")
BASENAME = "ckb-bizroke-tagger"

SEED, EPOCHS, BS, LR = 0, 40, 128, 2e-3
EMB, HID, LAYERS, DROP = 64, 256, 2, 0.3
DEV = "cuda" if torch.cuda.is_available() else "cpu"


class Tagger(nn.Module):
    """⚠ `lengths` IS NOT OPTIONAL POLISH — IT IS THE FIX FOR A WORD-FINAL ARTIFACT. Without packing, a padded
    batch runs the BACKWARD direction of the BiLSTM over the pad steps BEFORE it reaches the word's last real
    symbol, so that symbol's representation is contaminated by padding — and by a varying amount, since it
    depends on the batch's longest word. Serving is batch=1 with no padding, where the backward pass starts
    cleanly at the true final symbol: a condition training rarely presented. The damage lands precisely at the
    end of the word, and it showed up as the tagger emitting a word-final ɪ on 2.4% of referee vocabulary
    against 0.1% in its own training data. Pass `lengths` whenever the batch is padded; the export path (batch
    of one, unpadded) omits it and the two agree there by construction."""

    def __init__(self, nsrc: int, ntag: int):
        super().__init__()
        self.e = nn.Embedding(nsrc, EMB, padding_idx=0)
        self.lstm = nn.LSTM(EMB, HID, LAYERS, batch_first=True, bidirectional=True, dropout=DROP)
        self.o = nn.Linear(2 * HID, ntag)

    def forward(self, x, lengths=None):
        h = self.e(x)
        if lengths is None:
            return self.o(self.lstm(h)[0])
        packed = nn.utils.rnn.pack_padded_sequence(h, lengths, batch_first=True, enforce_sorted=False)
        out, _ = nn.utils.rnn.pad_packed_sequence(self.lstm(packed)[0], batch_first=True, total_length=x.size(1))
        return self.o(out)


def load_rows(src_dir: str) -> list[tuple[str, list[str], list[str]]]:
    """(word, rule-IPA code points, per-code-point tag) for every source pair whose target differs from this
    engine's RULE output by inserted ɪ and nothing else — the same 9,387 the lexicon builder classifies."""
    pairs = []
    for name in ("AsoSoft-top5K", "Wergor-words"):
        path = os.path.join(src_dir, name)
        if not os.path.exists(path):
            sys.exit(f"missing {path} — clone https://github.com/AsoSoft/Kurdish-G2P-dataset")
        for line in open(path, encoding="utf-8"):
            p = line.rstrip("\n").split("\t")
            if len(p) >= 2 and p[0] and p[1]:
                pairs.append((p[0], to_ipa(p[1])))
    with tempfile.TemporaryDirectory() as td:
        a, b = os.path.join(td, "i.json"), os.path.join(td, "o.json")
        json.dump([w for w, _ in pairs], open(a, "w"))
        subprocess.run(["npx", "tsx", os.path.join(HERE, "engine_says.mts"), a, b], check=True, cwd=ROOT)
        ours = json.load(open(b))
    rows = []
    for (w, ref), mine in zip(pairs, ours):
        if ref.replace("ɪ", "") != mine:
            continue  # the 654 that differ on some other axis — not this model's business
        cps, tgs, k, ok = list(mine), [], 0, True
        for c in cps:
            if k >= len(ref) or ref[k] != c:
                ok = False
                break
            k += 1
            if k < len(ref) and ref[k] == "ɪ":
                tgs.append(c + "ɪ")
                k += 1
            else:
                tgs.append(c)
        if ok and k == len(ref):
            rows.append((w, cps, tgs))
    print(f"{len(pairs)} source pairs -> {len(rows)} trainable "
          f"({sum(1 for r in rows if any(len(t) > 1 for t in r[2]))} carry a bizroke)", file=sys.stderr)
    return rows


def vocab(rows):
    src, tags, mask = {"<pad>": 0}, {"<pad>": 0}, {}
    for _, cps, tgs in rows:
        for c, t in zip(cps, tgs):
            ci = src.setdefault(c, len(src))
            ti = tags.setdefault(t, len(tags))
            mask.setdefault(ci, set()).add(ti)
    return src, tags, mask


def fit(rows, src, tags, quiet=False):
    X = [[src[c] for c in cps] for _, cps, _ in rows]
    Y = [[tags[t] for t in tgs] for _, _, tgs in rows]
    torch.manual_seed(SEED)
    m = Tagger(len(src), len(tags)).to(DEV)
    opt = torch.optim.Adam(m.parameters(), LR)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=EPOCHS)
    crit = nn.CrossEntropyLoss(ignore_index=0)
    idx = list(range(len(X)))
    for ep in range(EPOCHS):
        m.train(); random.shuffle(idx); tot = nb = 0
        for i in range(0, len(idx), BS):
            ch = idx[i:i + BS]
            L = max(len(X[j]) for j in ch)
            xb = torch.zeros(len(ch), L, dtype=torch.long)
            yb = torch.zeros(len(ch), L, dtype=torch.long)
            for r, j in enumerate(ch):
                xb[r, :len(X[j])] = torch.tensor(X[j])
                yb[r, :len(Y[j])] = torch.tensor(Y[j])
            lens = torch.tensor([len(X[j]) for j in ch])
            opt.zero_grad()
            loss = crit(m(xb.to(DEV), lens).reshape(-1, len(tags)), yb.to(DEV).reshape(-1))
            loss.backward(); opt.step(); tot += loss.item(); nb += 1
        sched.step()
        if not quiet and (ep + 1) % 10 == 0:
            print(f"  ep {ep+1}/{EPOCHS} loss {tot/nb:.4f}", flush=True)
    return m, X, Y


@torch.no_grad()
def word_exact(m, rows, src, tags, mask):
    """Masked-argmax word-exact accuracy, the same decode core/structuralTagger.ts runs at serving."""
    m.eval(); good = 0
    for _, cps, tgs in rows:
        ids = [src.get(c) for c in cps]
        if any(i is None for i in ids):
            continue  # declines at serving too — counted as wrong, which is the honest reading
        lg = m(torch.tensor([ids]).to(DEV))[0]
        pred = [max(mask[i], key=lambda t: lg[k][t].item()) for k, i in enumerate(ids)]
        itag = {v: k for k, v in tags.items()}
        good += int([itag[p] for p in pred] == tgs)
    return good / len(rows)


def held_out(rows):
    """STEM-BLIND split: group by the first 5 characters of the Kurdish word so an inflected family
    (ئابووری / ئابوورییان / ئابوورییەوە) cannot straddle it. A random split reads 2pp higher and is a lie."""
    random.seed(7)
    stems = sorted({w[:5] for w, _, _ in rows})
    random.shuffle(stems)
    held = set(stems[: int(0.1 * len(stems))])
    tr = [r for r in rows if r[0][:5] not in held]
    te = [r for r in rows if r[0][:5] in held]
    src, tags, mask = vocab(tr)
    m, _, _ = fit(tr, src, tags, quiet=True)
    te = [r for r in te if all(c in src for c in r[1])]
    base = sum(1 for _, _, tgs in te if all(len(t) == 1 for t in tgs)) / len(te)
    print(f"stem-blind held-out: train {len(tr)} / test {len(te)} words", file=sys.stderr)
    print(f"  never-insert baseline : {base:.1%}", file=sys.stderr)
    print(f"  tagger word-exact     : {word_exact(m, te, src, tags, mask):.1%}", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="clone of AsoSoft/Kurdish-G2P-dataset")
    ap.add_argument("--eval-only", action="store_true", help="report the held-out split and stop")
    a = ap.parse_args()
    random.seed(SEED)
    rows = load_rows(a.src)
    held_out(rows)
    if a.eval_only:
        return 0

    src, tags, mask = vocab(rows)
    m, X, _ = fit(rows, src, tags)
    m.eval().cpu()
    fp32 = os.path.join(HERE, f"{BASENAME}.onnx")
    torch.onnx.export(m, (torch.tensor([X[0]], dtype=torch.long),), fp32,
                      input_names=["chars"], output_names=["logits"],
                      dynamic_axes={"chars": {0: "batch", 1: "len"}, "logits": {0: "batch", 1: "len"}},
                      opset_version=17)

    import onnxruntime as ort
    from onnxruntime.quantization import QuantType, quantize_dynamic
    sess = ort.InferenceSession(fp32, providers=["CPUExecutionProvider"])
    n = min(400, len(X))
    bad = sum(int((m(torch.tensor([X[j]])).argmax(-1).numpy()
                   != sess.run(None, {"chars": torch.tensor([X[j]]).numpy()})[0].argmax(-1)).any())
              for j in range(n))
    print(f"fp32 ONNX argmax parity vs torch: {n-bad}/{n} words exact")

    int8 = os.path.join(HERE, f"{BASENAME}.int8.onnx")
    quantize_dynamic(fp32, int8, weight_type=QuantType.QInt8)
    s8 = ort.InferenceSession(int8, providers=["CPUExecutionProvider"])
    agree = sum(int((sess.run(None, {"chars": torch.tensor([X[j]]).numpy()})[0].argmax(-1)
                     == s8.run(None, {"chars": torch.tensor([X[j]]).numpy()})[0].argmax(-1)).all())
                for j in range(n))
    print(f"int8 vs fp32 word-level argmax agreement: {agree}/{n} = {agree/n:.1%}")

    ship = {"src": src,
            "tags": {str(v): k for k, v in tags.items() if k != "<pad>"} | {"0": ""},
            "charTags": {str(c): sorted(t) for c, t in mask.items()} | {"0": []}}
    json.dump(ship, open(os.path.join(HERE, f"{BASENAME}.meta.json"), "w"), ensure_ascii=False, indent=1)
    for f in (f"{BASENAME}.int8.onnx", f"{BASENAME}.meta.json"):
        shutil.copy(os.path.join(HERE, f), os.path.join(DEST, f))
    print(f"size int8: {os.path.getsize(int8)/1e6:.2f} MB  ->  {DEST}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
