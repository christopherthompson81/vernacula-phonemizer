#!/usr/bin/env python3
"""CPU-only smoke test for the shared char→chunk BiLSTM training code. Seconds, no GPU, no lexicon.

Guards the seam the four g2p trainers (nb/en/da/fr) sit on. It is deliberately cheap enough to run in the normal
test suite — before this existed, tools/ had ZERO coverage, which is how a reordered import in fr_g2p_bilstm.py
(the `sys.path.insert` landing AFTER the import that needed it) survived in a committed file that could never run.

    .venv/bin/python tools/bilstm_training/smoke_test.py
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, ".."))

import torch  # noqa: E402

from bilstm_training import align  # noqa: E402
from bilstm_training.tagger import PAD, Tagger, build_vocab, decode_chunks, encode, train  # noqa: E402

FAILED = []


def check(label, cond, detail=""):
    print(f"  {'ok  ' if cond else 'FAIL'}  {label}{'' if cond else '  — ' + detail}")
    if not cond:
        FAILED.append(label)


# A toy single-codepoint-IPA lexicon: regular enough that 20 words align without ambiguity.
TOY = [("kat", "kat"), ("kate", "kate"), ("mat", "mat"), ("mate", "mate"), ("rat", "rat"),
       ("rate", "rate"), ("kan", "kan"), ("man", "man"), ("ran", "ran"), ("tan", "tan"),
       ("kam", "kam"), ("ram", "ram"), ("tam", "tam"), ("nat", "nat"), ("nam", "nam"),
       ("kar", "kar"), ("mar", "mar"), ("tar", "tar"), ("nar", "nar"), ("aat", "aːt")]


def main():
    torch.manual_seed(0)

    # 1. the aligner, at the default SEP="" (single-codepoint IPA)
    assert align.SEP == "", "SEP should default to '' — a previous test leaked its setting"
    rows = [(w, list(ipa)) for w, ipa in TOY]
    aligned = align.align_parallel(rows, iters=3, quiet=True)
    check("align_parallel returns per-char labels", len(aligned) == len(rows),
          f"aligned {len(aligned)}/{len(rows)}")
    check("every char gets exactly one chunk label",
          all(len(a) == len(w) for w, a in aligned),
          "a word's label count != its character count")

    # 2. SEP is honoured for multi-CHAR phone alphabets (the English ARPABET path)
    align.SEP = " "
    try:
        arp = [("cat", ["K", "AE1", "T"]), ("cab", ["K", "AE1", "B"]), ("bat", ["B", "AE1", "T"]),
               ("bad", ["B", "AE1", "D"]), ("mat", ["M", "AE1", "T"]), ("map", ["M", "AE1", "P"])]
        al2 = align.align_parallel(arp, iters=3, quiet=True)
        two_phone = [c for _, a in al2 for _, c in a if " " in c]
        check("SEP=' ' keeps ARPABET token boundaries",
              all(all(tok for tok in c.split(" ")) for c in two_phone),
              "a 2-phone chunk was welded without its separator")
    finally:
        align.SEP = ""  # module global — never leave it set for the next caller

    # 3. vocab + encoding
    chars, tags, char_tags = build_vocab(aligned)
    check("vocab reserves PAD at 0", chars["<pad>"] == PAD and tags["<pad>"] == PAD)
    check("char_tags mask is populated", len(char_tags) > 0 and all(char_tags.values()))
    X, Y = encode(aligned, chars, tags)
    check("encode aligns X/Y lengths", len(X) == len(Y) == len(aligned)
          and all(len(x) == len(y) for x, y in zip(X, Y)))

    # 4. one real training step on CPU — forward, loss, backward, optimiser
    model = Tagger(len(chars), len(tags), hid=16)
    before = model.head.weight.detach().clone()
    model = train(model, X, Y, epochs=1, batch=8, log_every=99, dev="cpu")
    check("train() updates weights", not torch.equal(before, model.head.weight.detach().cpu()))

    # 5. masked decode: in-vocab decodes, out-of-vocab declines rather than guessing
    itag = {v: k for k, v in tags.items()}
    out = decode_chunks(model, chars, itag, char_tags, "kat", dev="cpu")
    check("decode_chunks returns one chunk per char", out is not None and len(out) == 3,
          f"got {out!r}")
    check("decode_chunks declines an OOV grapheme",
          decode_chunks(model, chars, itag, char_tags, "kzt", dev="cpu") is None)

    # 6. hyperparameters are provenance — the committed .onnx files were trained at these settings
    expected = {"norwegian/train_nb_bilstm.py": (128, 128, 5), "english/en_g2p_bilstm.py": (256, 256, 5),
                "danish/da_bilstm.py": (256, 256, 10), "french/fr_g2p_bilstm.py": (256, 256, 10)}
    for rel, want in expected.items():
        d, n = rel.split("/")
        sys.path.insert(0, os.path.join(HERE, "..", d))
        mod = __import__(n[:-3])
        got = (mod.HID, mod.BATCH, mod.LOG_EVERY)
        check(f"{rel} keeps hid/batch/log_every {want}", got == want, f"got {got}")

    print()
    if FAILED:
        print(f"FAILED: {len(FAILED)} — " + "; ".join(FAILED))
        return 1
    print("all bilstm_training smoke checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
