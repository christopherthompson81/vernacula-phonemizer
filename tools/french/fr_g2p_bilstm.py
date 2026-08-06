#!/usr/bin/env python3
"""
French OOV G2P — BiLSTM vs the rule engine, on a clean Lexique held-out. Is a neural OOV reader worth it for French
(a far more REGULAR orthography than English)? Trains a char→IPA-chunk BiLSTM on 90% of Lexique and reports held-out
word/symbol accuracy vs the rule g2p's 76.6%/94.3%. French IPA is single-codepoint (nasal ɔ̃ = ɔ + combining tilde),
so align.SEP stays "". Model + aligner come from tools/bilstm_training; this file supplies the French ends.
"""
import os
import sys
import time
import random
import hashlib
import json

import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))  # must precede the bilstm_training import below
from bilstm_training import align  # noqa: E402 — SEP stays "" (single-codepoint IPA chunks)
from bilstm_training.tagger import DEV, Tagger, build_vocab, decode_chunks, encode, train  # noqa: E402

LEX = os.path.join(HERE, "..", "..", "src",
                   "languages", "french", "lexicon.tsv")
FR = "abcdefghijklmnopqrstuvwxyzàâäçéèêëîïôöùûüÿœæ-"
HID, BATCH, LOG_EVERY = 256, 256, 10  # as trained for the committed fr-g2p-tagger.onnx


def load():
    rows = []
    for line in open(LEX, encoding="utf-8"):
        if line.startswith("#") or "\t" not in line:
            continue
        w, ipa = line.rstrip("\n").split("\t", 1)
        w = w.lower()
        if w and ipa and all(c in FR for c in w):
            rows.append((w, list(ipa)))
    return rows


def split(rows):
    tr, te = [], []
    for w, p in rows:
        (te if int(hashlib.md5(("fr:" + w).encode()).hexdigest(), 16) %
         10 == 0 else tr).append((w, p))
    return tr, te


@torch.no_grad()
def predict(m, chars, itag, ct, w):
    """French IPA chunks are single-codepoint, so the decoded chunks concatenate directly."""
    out = decode_chunks(m, chars, itag, ct, w)
    return None if out is None else "".join(out)


def lev(a, b):
    d = list(range(len(b)+1))
    for i in range(1, len(a)+1):
        p = d[0]
        d[0] = i
        for j in range(1, len(b)+1):
            t = d[j]
            d[j] = min(d[j]+1, d[j-1]+1, p+(0 if a[i-1] == b[j-1] else 1))
            p = t
    return d[len(b)]


def main():
    random.seed(0)
    torch.manual_seed(0)
    t0 = time.time()
    print("device:", DEV)
    rows = load()
    tr, te = split(rows)
    print(
        f"Lexique {len(rows)} → train {len(tr)} / held-out {len(te)}", flush=True)
    al = align.align_parallel(tr)
    print(f"aligned {len(al)}/{len(tr)} ({time.time()-t0:.0f}s)", flush=True)
    chars, tags, ct = build_vocab(al)
    itag = {v: k for k, v in tags.items()}
    X, Y = encode(al, chars, tags)
    print(f"{len(chars)} chars, {len(tags)} tags", flush=True)
    m = train(Tagger(len(chars), len(tags), hid=HID), X, Y, batch=BATCH, log_every=LOG_EVERY)
    ex = n = err = tot = 0
    for w, ph in te:
        pr = predict(m, chars, itag, ct, w)
        n += 1
        if pr is None:
            continue
        truth = "".join(ph)
        if pr == truth:
            ex += 1
        err += lev(list(pr), list(truth))
        tot += max(len(pr), len(truth))
    print(
        f"\nBiLSTM held-out ({n} words):  WORD-exact {ex}/{n} = {100*ex/n:.1f}%   symbol acc {100*(1-err/tot):.1f}%   (total {time.time()-t0:.0f}s)", flush=True)

    # retrain on FULL Lexique + export the shipped ONNX + meta (structuralTagger)
    if os.environ.get("FR_PRODUCTION"):
        print("\n[production] aligning + training on the FULL Lexique…", flush=True)
        alf = align.align_parallel(rows)
        chars, tags, ct = build_vocab(alf)
        itag = {v: k for k, v in tags.items()}
        Xf, Yf = encode(alf, chars, tags)
        full = train(Tagger(len(chars), len(tags), hid=HID), Xf, Yf, batch=BATCH, log_every=LOG_EVERY)
        full.eval().cpu()
        SRC = os.path.join(HERE, "..", "..", "src", "languages", "french")
        torch.onnx.export(full, torch.tensor([[1, 2, 3, 4]]), os.path.join(SRC, "fr-g2p-tagger.onnx"),
                          input_names=["chars"], output_names=["logits"],
                          dynamic_axes={"chars": {0: "batch", 1: "len"}, "logits": {0: "batch", 1: "len"}}, opset_version=17)
        meta = {"src": chars, "tags": {str(i): itag[i] for i in range(
            len(tags))}, "charTags": {str(ci): sorted(ti) for ci, ti in ct.items()}}
        json.dump(meta, open(os.path.join(SRC, "fr-g2p-tagger.meta.json"),
                  "w", encoding="utf-8"), ensure_ascii=False)
        print(
            f"[production] exported → {SRC}/fr-g2p-tagger.onnx + .meta.json ({len(chars)} chars, {len(tags)} tags)", flush=True)


if __name__ == "__main__":
    main()
