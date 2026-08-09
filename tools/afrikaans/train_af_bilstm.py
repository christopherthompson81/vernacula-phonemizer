#!/usr/bin/env python3
"""Afrikaans OOV g2p — BiLSTM per-grapheme tagger. The neural OOV tier for af: char-embedding → 2-layer BiLSTM →
per-position head labelling each grapheme with an IPA CHUNK. Model + aligner come from tools/bilstm_training;
exports the shared structuralTagger contract (af-g2p-tagger.onnx + .meta.json) for onnxruntime-node serving.

WHY af NEEDS ONE, and why only now. The rule engine is ~87% exact on running text but the residual is the part
rules cannot reach: stress placement is 72.6% overall and collapses to 36% at eight syllables, and a perfect-stress
oracle is worth +1189 words (4.3pp) on the 27k secondary. That residual is CONTEXTUAL, not tabulable — the one
class in this language where a model has something to do that a rule does not.

⚠ NO STRESS MARKS IN THE TAG ALPHABET, unlike Norwegian. af emits no stress by convention; the stress information
lives in the VOWEL QUALITY (reduction + open/closed length), which is what the model must learn. Keeping ˈ would
also have meant training on RCRL alone, since NCHLT has no stress marks at all.

DATA — tools/afrikaans/af-g2p-data.tsv, built by build_af_g2p_data.ts: the union of both open Afrikaans
pronunciation dictionaries (RCRL 27,428 CC BY-SA 2.5 ZA + NCHLT-inlang 15,094 CC BY 3.0), vetted against the rule
engine and split 90/10 by md5 of the word. ⚠ ~31k pairs is THE CEILING for this language — the third open
dictionary (Lwazi) adds zero headwords, and there is no nb/da-scale 199k resource. For scale: the repo's measured
starvation line is ~10k pairs and the shipped Sindhi tagger trains on 9,274.

    .venv/bin/python -u tools/afrikaans/train_af_bilstm.py
"""
import json
import os
import random
import sys

import torch
from onnxruntime.quantization import QuantType, quantize_dynamic

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))  # must precede the bilstm_training import below
from bilstm_training import align  # noqa: E402 — SEP stays "" (single-codepoint IPA chunks)
from bilstm_training.tagger import DEV, Tagger, build_vocab, decode_chunks, encode, train  # noqa: E402

SRC = os.path.join(HERE, "..", "..", "src", "languages", "afrikaans")
DATA = os.path.join(HERE, "af-g2p-data.tsv")
HID, BATCH, LOG_EVERY = 256, 256, 5  # hyperparameters are provenance — see tools/bilstm_training/README.md


def load():
    """(word, ipa, split) rows from af-g2p-data.tsv."""
    rows = []
    with open(DATA, encoding="utf-8") as fh:
        for line in fh:
            if not line.strip() or line.startswith("#"):
                continue
            f = line.rstrip("\n").split("\t")
            if len(f) >= 3 and f[0] and f[1]:
                rows.append((f[0], f[1], f[2]))
    return rows


@torch.no_grad()
def predict(model, chars, itag, char_tags, word):
    """The SHIPPED decode: masked argmax over each letter's charTags, decline ("") on an OOV grapheme."""
    out = decode_chunks(model, chars, itag, char_tags, word)
    return "" if out is None else "".join(out)


def heldout_eval(model, chars, itag, char_tags, te, tag=""):
    ok = 0
    with open("/tmp/af_holdout_bilstm.tsv", "w", encoding="utf-8") as fh:
        for w, ref in te:
            pred = predict(model, chars, itag, char_tags, w)
            ok += pred == ref
            if pred != ref:
                fh.write(f"{w}\t{ref}\t{pred}\n")
    print(f"held-out BiLSTM exact-match{tag}: {ok}/{len(te)} = {100 * ok / len(te):.1f}%"
          "  (misses → /tmp/af_holdout_bilstm.tsv)", flush=True)
    return ok / len(te)


def main():
    random.seed(0)
    torch.manual_seed(0)
    print(f"device: {DEV}")
    rows = load()
    tr = [(w, i) for w, i, s in rows if s == "train"]
    te = [(w, i) for w, i, s in rows if s == "test"]
    print(f"data: {len(tr)} train / {len(te)} held-out")

    # (1) HONEST HELD-OUT — align + train on the train split only, predict the untouched 10%.
    aln_tr = align.align_parallel(tr)
    chars, tags, char_tags = build_vocab(aln_tr)
    itag = {v: k for k, v in tags.items()}
    Xtr, Ytr = encode(aln_tr, chars, tags)
    print(f"train {len(Xtr)} words, {len(chars)} chars, {len(tags)} tags", flush=True)
    model = train(Tagger(len(chars), len(tags), hid=HID), Xtr, Ytr, batch=BATCH, log_every=LOG_EVERY)
    heldout_eval(model, chars, itag, char_tags, te)

    # (2) SHIPPED — align + train on ALL pairs, export the structuralTagger contract.
    allrows = [(w, i) for w, i, _ in rows]
    aln = align.align_parallel(allrows)
    chars, tags, char_tags = build_vocab(aln)
    itag = {v: k for k, v in tags.items()}
    Xf, Yf = encode(aln, chars, tags)
    full = train(Tagger(len(chars), len(tags), hid=HID), Xf, Yf, batch=BATCH, log_every=LOG_EVERY)
    full.eval().cpu()
    dummy = torch.tensor([[1, 2, 3, 4]])
    fp32 = os.path.join(SRC, "af-g2p-tagger.fp32.onnx")
    torch.onnx.export(full, dummy, fp32,
                      input_names=["chars"], output_names=["logits"],
                      dynamic_axes={"chars": {0: "batch", 1: "len"}, "logits": {0: "batch", 1: "len"}},
                      opset_version=17)
    # int8 like every other shipped tagger — 8.7 MB fp32 is four times what the fleet ships.
    quantize_dynamic(fp32, os.path.join(SRC, "af-g2p-tagger.int8.onnx"), weight_type=QuantType.QUInt8)
    os.remove(fp32)  # keep only the shipped int8 graph
    meta = {
        "src": chars,
        "tags": {str(i): itag[i] for i in range(len(tags))},
        "charTags": {str(ci): sorted(ti) for ci, ti in char_tags.items()},
    }
    with open(os.path.join(SRC, "af-g2p-tagger.meta.json"), "w", encoding="utf-8") as fh:
        json.dump(meta, fh, ensure_ascii=False)
    print(f"exported → {SRC}/af-g2p-tagger.int8.onnx + .meta.json ({len(chars)} chars, {len(tags)} tags)", flush=True)


if __name__ == "__main__":
    main()
