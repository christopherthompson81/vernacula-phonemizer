#!/usr/bin/env python3
"""Pashto short-vowel restoration — a per-grapheme HARAKAT BiLSTM (the OOV generalization tier).

WHAT IT TAGS, AND WHY NOT IPA. Every other tagger in this tree (af, bn, nb, en, da, fr) labels a grapheme with an
IPA CHUNK. This one labels it with a HARAKAT — the short-vowel diacritic that belongs after it — and feeds the
vocalized spelling back through Pashto's own g2p. That choice is what makes espeak usable as training data:

  · espeak's ps_list DISAGREES WITH OUR DIALECT on ږ (`موږ` → ʁ where our Kandahari engine reads ʐ), and
    `ph_pashto` maps `Q` → ʁ. An IPA tagger trained on it would import that reading wholesale. A HARAKAT tagger
    takes only espeak's VOWEL PLACEMENT; the consonants stay ours, and ږ is never at issue.
  · the g2p already encodes the phonology the investigation spent three passes building — glide epenthesis
    (کَول→kawəl), the final -ی /ai/ diphthong (سړی→saɽaɪ), the sukun-marked medial glide (الوْتل→alwətəl),
    homorganic ŋ. Predicting IPA directly would throw all of that away and ask a 30k-parameter model to relearn it.

WHY IT IS WORTH RETRAINING AT ALL. `docs/investigations/ps_neural_restoration_investigation.md` measured the
previous neural as NET-NEGATIVE (sync 45.3% vs neural 44.0% on wikipron) and declined to wire it. That verdict
was correct FOR ITS DATA: the ps silver was 770 rows and 78% of them were all-bare, because the miner ran under a
short-vowel-COLLAPSING fold. Both halves have since changed — PS_FULL_FOLD keeps a/ə/i/u/o distinct, and
espeak-ng's dictionary adds ~81k candidate rows to a pool that was ~2.5k. The repo's measured starvation line is
~10k pairs (the shipped Sindhi tagger trains on 9,274), which the old run was an order of magnitude under.

⚠ THE LABELS ARE INVERTER OUTPUT, NOT ESPEAK OUTPUT. A row exists only where some vocalization of the skeleton
REPRODUCES the reference IPA under PS_FULL_FOLD, so espeak's errors (it under-vocalizes ~26% of the words it
shares with the referee) and its dialect disagreements are filtered by construction rather than trusted.

⚠ AND THE EVAL IS THE REFEREE, NOT A HELD-OUT SLICE OF THE SILVER. A held-out split of espeak-derived labels
measures agreement with espeak; only wikipron/kaikki say whether Pashto got better. The held-out split is
reported too, as a training diagnostic.

    .venv/bin/python -u tools/pashto/train_ps_harakat.py
"""
import hashlib
import json
import unicodedata
import os
import random
import sys

import torch
from onnxruntime.quantization import QuantType, quantize_dynamic

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))
from bilstm_training.tagger import DEV, Tagger, build_vocab, encode, train  # noqa: E402

SRC = os.path.join(HERE, "..", "..", "src", "languages", "pashto")
SILVER = os.path.join(HERE, "..", "perso-arabic", "harakat.ps.silver.tsv")
HID, BATCH, EPOCHS, LOG_EVERY = 256, 256, 40, 5  # hyperparameters are provenance — see bilstm_training/README.md

HARAKAT = set("ًٌٍَُِّْٰ")


def rows():
    """silver `skeleton⇥vocalized` → (skeleton, [(char, harakat-or-empty), …]).

    The alignment is EXACT and needs no aligner, which is the other quiet advantage of tagging harakat: a
    diacritic is a combining mark that already sits after the consonant it belongs to, so the label sequence is
    read straight off the vocalized string. The IPA taggers all need `bilstm_training.align` and inherit its
    failure modes; this one cannot mis-align.
    """
    out = []
    for line in open(SILVER, encoding="utf8"):
        if line.startswith("#") or "\t" not in line:
            continue
        # the miner writes THREE columns — skeleton ⇥ lang ⇥ vocalized — so the label is [2], not [1] ([1] is
        # the language code, which silently produced zero usable rows when read as the vocalization.
        cols = line.rstrip("\n").split("\t")
        if len(cols) < 3:
            continue
        skel, voc = cols[0], cols[2]
        # NFC, because the shipped lexicon's keys are NFC and `restoreHarakat` looks up that way — a model
        # trained on decomposed text would tag a string the runtime never presents.
        skel, voc = unicodedata.normalize("NFC", skel.strip()), unicodedata.normalize("NFC", voc.strip())
        pairs, i = [], 0
        for ch in voc:
            if ch in HARAKAT:
                if not pairs:
                    pairs = []
                    break  # a leading mark cannot be attached — drop the row rather than guess
                pairs[-1] = (pairs[-1][0], pairs[-1][1] + ch)
            else:
                pairs.append((ch, ""))
        if not pairs:
            continue
        if "".join(c for c, _ in pairs) != skel:
            continue  # the vocalization must be the skeleton plus marks, or the row is not a label
        out.append((skel, pairs))
    return out


def main():
    random.seed(1234)
    torch.manual_seed(1234)
    data = rows()
    if not data:
        sys.exit(f"no usable rows in {SILVER}")
    # HELD-OUT BY md5 OF THE WORD, so a retrain reproduces the same split and an inflectional family cannot
    # straddle it by accident of ordering.
    dev_set = [d for d in data if int(hashlib.md5(d[0].encode()).hexdigest(), 16) % 10 == 0]
    tr = [d for d in data if int(hashlib.md5(d[0].encode()).hexdigest(), 16) % 10 != 0]
    print(f"# rows {len(data)}  train {len(tr)}  held-out {len(dev_set)}", file=sys.stderr)
    labelled = sum(1 for _, a in data for _, t in a if t)
    total = sum(len(a) for _, a in data)
    print(f"# {labelled}/{total} positions carry a harakat ({labelled / total * 100:.1f}%)", file=sys.stderr)

    chars, tags, char_tags = build_vocab(tr)
    print(f"# vocab: {len(chars)} chars, {len(tags)} tags", file=sys.stderr)
    X, Y = encode(tr, chars, tags)
    model = Tagger(len(chars), len(tags), hid=HID).to(DEV)
    train(model, X, Y, epochs=EPOCHS, batch=BATCH, log_every=LOG_EVERY, dev=DEV)

    # held-out per-position accuracy — a TRAINING diagnostic, not the gate. The gate is the referee eval.
    model.eval()
    corr = tot = 0
    with torch.no_grad():
        for w, a in dev_set:
            x = torch.tensor([[chars.get(g, 1) for g, _ in a]]).to(DEV)
            pred = model(x).argmax(-1)[0].tolist()
            itag = {v: k for k, v in tags.items()}
            for (_, gold), p in zip(a, pred):
                tot += 1
                corr += (itag.get(p, "") == gold)
    print(f"# held-out per-position accuracy {corr}/{tot} = {corr / tot * 100:.1f}%", file=sys.stderr)

    os.makedirs(SRC, exist_ok=True)
    onnx = os.path.join(SRC, "ps-harakat-tagger.onnx")
    torch.onnx.export(
        model, torch.zeros(1, 8, dtype=torch.long).to(DEV), onnx,
        input_names=["x"], output_names=["logits"],
        dynamic_axes={"x": {0: "b", 1: "t"}, "logits": {0: "b", 1: "t"}}, opset_version=17,
    )
    quantize_dynamic(onnx, os.path.join(SRC, "ps-harakat-tagger.int8.onnx"), weight_type=QuantType.QUInt8)
    os.remove(onnx)
    json.dump(
        {"src": chars, "tags": tags, "charTags": {str(k): sorted(v) for k, v in char_tags.items()}},
        open(os.path.join(SRC, "ps-harakat-tagger.meta.json"), "w", encoding="utf8"),
        ensure_ascii=False,
    )
    print("# wrote ps-harakat-tagger.int8.onnx + .meta.json", file=sys.stderr)


if __name__ == "__main__":
    main()
