#!/usr/bin/env python3
"""Run the ps harakat tagger over the referee word lists → `word ⇥ vocalized` for scoring in TypeScript.

Split out from the scorer because the model is ONNX/Python and the g2p is TypeScript: this emits the tagger's
vocalization, `eval_ps_tagger.ts` phonemizes it and folds it against the referee. It also marks which referee
words appear in the SILVER, so the scorer can report a contamination-free (OOV-only) number — the tagger was
trained on espeak-derived labels and wikipron overlaps espeak, so a headline that includes seen words is
measuring memorization.
"""
import hashlib, json, os, sys, unicodedata
import numpy as np, onnxruntime as ort

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "..", "..", "src", "languages", "pashto")
meta = json.load(open(os.path.join(SRC, "ps-harakat-tagger.meta.json"), encoding="utf8"))
chars, tags = meta["src"], meta["tags"]
itag = {v: k for k, v in tags.items()}
char_tags = {int(k): set(v) for k, v in meta["charTags"].items()}
sess = ort.InferenceSession(os.path.join(SRC, "ps-harakat-tagger.int8.onnx"),
                            providers=["CPUExecutionProvider"])

seen = set()
for line in open(os.path.join(HERE, "..", "perso-arabic", "harakat.ps.silver.tsv"), encoding="utf8"):
    if "\t" in line:
        seen.add(unicodedata.normalize("NFC", line.split("\t")[0]))

def tag(word):
    w = unicodedata.normalize("NFC", word)
    ids = [chars.get(c, 1) for c in w]
    if not ids:
        return w
    logits = sess.run(None, {"x": np.array([ids], dtype=np.int64)})[0][0]
    out = []
    for c, cid, row in zip(w, ids, logits):
        # ⚠ THE CONSISTENCY MASK, same discipline the IPA taggers use: a character may only emit a harakat it
        # was actually observed with in training, so the model can never hang a kasra on a letter that never
        # takes one. Unknown characters are left bare rather than guessed.
        allowed = char_tags.get(cid)
        if not allowed:
            out.append(c); continue
        best = max(allowed, key=lambda t: row[t] if t < len(row) else -1e9)
        out.append(c + itag.get(best, ""))
    return "".join(out)

for path in sys.argv[1:]:
    for line in open(path, encoding="utf8"):
        if line.startswith("#") or "\t" not in line:
            continue
        w = line.split("\t")[0].strip()
        if not w:
            continue
        # ⚠ THREE BUCKETS, NOT TWO, AND THE MIDDLE ONE IS THE ONLY FAIR GENERALIZATION TEST.
        #   TRAIN       labelable and the model trained on it — memorization
        #   HELDOUT     labelable, held out by the SAME md5 %10 rule the trainer uses — unseen but REACHABLE
        #   UNREACHABLE the inverter could not label it, i.e. NO vowel assignment reproduces the reference
        #               under our g2p. These fail on CONSONANTS (the multi-dialect ښ/ږ), not on vowels, so a
        #               vowel restorer cannot win them and scoring it on them measures the wrong thing.
        n = unicodedata.normalize("NFC", w)
        if n not in seen:
            bucket = "UNREACHABLE"
        elif int(hashlib.md5(n.encode()).hexdigest(), 16) % 10 == 0:
            bucket = "HELDOUT"
        else:
            bucket = "TRAIN"
        print(f"{w}\t{tag(w)}\t{bucket}")
