#!/usr/bin/env python3
"""English OOV G2P — BiLSTM per-grapheme tagger vs the joint n-gram, on a CLEAN CMUdict held-out split.

The question: the wikipron referee can't measure English OOV quality (Runs 1-2 — it's noise-limited at ~60% even
where we're authoritatively correct). So measure on a clean CMUdict 90/10 split. Trains a char→ARPABET-chunk BiLSTM
tagger (the bn/nb structuralTagger pattern: hard-EM many-to-{0,1,2} alignment → char-embed → 2-layer BiLSTM → masked
per-position tag) on 90% of g2p-dict.tsv (117k words, public-domain CMUdict) and reports held-out WORD accuracy
(exact ARPABET incl. stress, and stress-independent phones). Model + aligner: tools/bilstm_training.

    .venv/bin/python -u tools/english/en_g2p_bilstm.py
"""
import os, sys, time, random, hashlib, json
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))  # must precede the bilstm_training import below
from bilstm_training import align  # noqa: E402 — multiprocess hard-EM aligner
from bilstm_training.tagger import DEV, Tagger, build_vocab, decode_chunks, encode, train  # noqa: E402

align.SEP = " "  # ARPABET phones are multi-char tokens → join 2-phone chunks with a space (K S, not KS)

DICT = os.path.join(HERE, "..", "..", "src", "languages", "english", "g2p-dict.tsv")
HID, BATCH, LOG_EVERY = 256, 256, 5  # as trained for the committed en-g2p-tagger.onnx


def load():
    rows = []
    for line in open(DICT, encoding="utf-8"):
        if line.startswith("#") or "\t" not in line:
            continue
        w, ph = line.rstrip("\n").split("\t", 1)
        w = w.lower()
        toks = ph.split()
        if w.isalpha() and w.isascii() and toks:
            rows.append((w, toks))  # phones are ARPABET TOKENS (AE1, B, …), not chars
    return rows


def split(rows):
    # EN_FREQ set → the RELIABLE, distribution-matched referee: train on the frequency-common words, HOLD OUT the
    # rare/proper-noun tail (the real OOV target: names, neologisms) with clean CMUdict gold. Else a random md5 10%.
    freq_path = os.environ.get("EN_FREQ")
    if freq_path:
        common = set()
        for l in open(freq_path, encoding="utf-8"):
            if l.startswith("#"):
                continue
            wl = l.split(" ")[0].strip().lower()
            if wl:
                common.add(wl)
        tr = [(w, p) for w, p in rows if w in common]
        te = [(w, p) for w, p in rows if w not in common]
        return tr, te
    tr, te = [], []
    for w, p in rows:
        (te if int(hashlib.md5(("en:" + w).encode()).hexdigest(), 16) % 10 == 0 else tr).append((w, p))
    return tr, te


@torch.no_grad()
def predict(model, chars, itag, char_tags, word):
    """ARPABET phones are multi-char tokens joined by SEP=" ", so a chunk splits back into 1-2 phones."""
    chunks = decode_chunks(model, chars, itag, char_tags, word)
    if chunks is None:
        return None
    out = []
    for chunk in chunks:
        if chunk:
            out.extend(chunk.split(" "))
    return out


def main():
    random.seed(0); torch.manual_seed(0)
    t0 = time.time()
    print(f"device: {DEV}")
    rows = load()
    tr, te = split(rows)
    print(f"CMUdict {len(rows)} → train {len(tr)} / held-out {len(te)}", flush=True)
    aligned = align.align_parallel(tr)
    print(f"aligned {len(aligned)}/{len(tr)} ({time.time()-t0:.0f}s)", flush=True)
    chars, tags, char_tags = build_vocab(aligned)
    itag = {v: k for k, v in tags.items()}
    X, Y = encode(aligned, chars, tags)
    print(f"{len(chars)} chars, {len(tags)} tags", flush=True)
    model = train(Tagger(len(chars), len(tags), hid=HID), X, Y, batch=BATCH, log_every=LOG_EVERY)
    # held-out WORD accuracy: exact ARPABET (incl. stress) + stress-independent
    exact = stressless = n = declined = 0
    destress = lambda ts: [t.rstrip("012") for t in ts]
    with open("/tmp/en_bilstm_holdout.tsv", "w", encoding="utf-8") as f:
        for w, ph in te:
            pred = predict(model, chars, itag, char_tags, w)
            n += 1
            if pred is None:
                declined += 1
                f.write(f"{w}\t{' '.join(ph)}\tDECLINED\n")
                continue
            if pred == ph:
                exact += 1
            if destress(pred) == destress(ph):
                stressless += 1
            f.write(f"{w}\t{' '.join(ph)}\t{' '.join(pred)}\n")
    print(f"\nBiLSTM held-out ({n} words):", flush=True)
    print(f"  WORD exact (incl. stress):   {exact}/{n} = {100*exact/n:.1f}%", flush=True)
    print(f"  WORD exact (stress-indep):   {stressless}/{n} = {100*stressless/n:.1f}%", flush=True)
    print(f"  declined (oov char): {declined}   (total {time.time()-t0:.0f}s)  → /tmp/en_bilstm_holdout.tsv", flush=True)

    # PRODUCTION: retrain on the FULL CMUdict and export the shipped ONNX + meta (the structuralTagger contract).
    if os.environ.get("EN_PRODUCTION"):
        print("\n[production] aligning + training on the FULL CMUdict…", flush=True)
        aln = align.align_parallel(rows)
        chars, tags, char_tags = build_vocab(aln)
        itag = {v: k for k, v in tags.items()}
        Xf, Yf = encode(aln, chars, tags)
        full = train(Tagger(len(chars), len(tags), hid=HID), Xf, Yf, batch=BATCH, log_every=LOG_EVERY)
        full.eval().cpu()
        SRC = os.path.join(HERE, "..", "..", "src", "languages", "english")
        dummy = torch.tensor([[1, 2, 3, 4]])
        torch.onnx.export(full, dummy, os.path.join(SRC, "en-g2p-tagger.onnx"),
                          input_names=["chars"], output_names=["logits"],
                          dynamic_axes={"chars": {0: "batch", 1: "len"}, "logits": {0: "batch", 1: "len"}}, opset_version=17)
        meta = {"src": chars, "tags": {str(i): itag[i] for i in range(len(tags))},
                "charTags": {str(ci): sorted(ti) for ci, ti in char_tags.items()}}
        json.dump(meta, open(os.path.join(SRC, "en-g2p-tagger.meta.json"), "w", encoding="utf-8"), ensure_ascii=False)
        print(f"[production] exported → {SRC}/en-g2p-tagger.onnx + .meta.json ({len(chars)} chars, {len(tags)} tags)", flush=True)


if __name__ == "__main__":
    main()
