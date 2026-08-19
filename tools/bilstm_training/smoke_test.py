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

    # 6. align.SEP is the single source of truth. `from align import SEP` binds a COPY, so a module that
    #    re-exports it invites `othermodule.SEP = " "` — which silently does not reach the aligner.
    sys.path.insert(0, os.path.join(HERE, "..", "norwegian"))
    import nb_tagger_parallel  # the one module that still imports the aligner alongside its own code
    check("SEP is not re-exported by aligner consumers", not hasattr(nb_tagger_parallel, "SEP"),
          "nb_tagger_parallel re-exports SEP; setting it there would silently not reach align")

    # 7. hyperparameters are provenance — the committed .onnx files were trained at these settings
    expected = {"norwegian/train_nb_bilstm.py": (128, 128, 5), "english/en_g2p_bilstm.py": (256, 256, 5),
                "danish/da_bilstm.py": (256, 256, 10), "french/fr_g2p_bilstm.py": (256, 256, 10)}
    for rel, want in expected.items():
        d, n = rel.split("/")
        sys.path.insert(0, os.path.join(HERE, "..", d))
        mod = __import__(n[:-3])
        got = (mod.HID, mod.BATCH, mod.LOG_EVERY)
        check(f"{rel} keeps hid/batch/log_every {want}", got == want, f"got {got}")

    # 8. THE PACKING INVARIANT. Unpacked, a padded batch runs the BiLSTM's BACKWARD direction over the pad
    #    steps before it reaches each word's last real symbol, so a short word's word-FINAL logits depend on
    #    whatever the longest word in its batch happened to be — while serving is batch=1 and unpadded. That
    #    mismatch cost ckb 1.5pp word-exact and produced a word-final vowel at 24× its training rate
    #    (investigation Run 41). The fix is `lengths`; this asserts it actually decouples the batch, and that
    #    a padded row now matches what the same word gets alone.
    torch.manual_seed(0)
    m = Tagger(10, 4).eval()
    short = torch.tensor([[3, 4, 5]])
    with torch.no_grad():
        alone = m(short)
        pad_lots = m(torch.tensor([[3, 4, 5, 0, 0, 0, 0]]), torch.tensor([3]))[:, :3]
        pad_few = m(torch.tensor([[3, 4, 5, 0]]), torch.tensor([3]))[:, :3]
        unpacked = m(torch.tensor([[3, 4, 5, 0, 0, 0, 0]]))[:, :3]
    check("packed logits are independent of how much padding follows",
          torch.allclose(pad_lots, pad_few, atol=1e-5), "padding still leaks into the packed path")
    check("packed padded row == the same word alone (what serving does)",
          torch.allclose(pad_lots, alone, atol=1e-5), "packed training differs from batch-1 serving")
    check("the bug this guards is real (unpacked DOES differ at the word end)",
          not torch.allclose(unpacked[:, -1], alone[:, -1], atol=1e-5),
          "unpacked matched — the invariant above proves nothing")

    # 9. THE PACKING INVARIANT ACROSS EVERY STANDALONE TRAINER. sd/bn/he/fa do NOT use the shared Tagger, and
    #    two of them (he, fa) CANNOT BE RUN in this repo — their corpora are not on disk (investigation Run
    #    43). So their packing fix has no end-to-end test and never will; this exercises each `forward`
    #    directly, extracted by AST so no corpus or import side-effects are needed. Without it, a future edit
    #    to an unrunnable trainer is unverifiable.
    import ast
    STANDALONE = {
        "hebrew/train_he_tagger.py": dict(nc=10, nl=4),
        "persian/train_tagger.py": dict(nc=10, nl=4),
        "bengali/train_bn_tagger.py": dict(nc=10, nl=4),
        "sindhi/train_sd_tagger_masked.py": dict(nsrc=10, ntag=4),
        "sindhi/export_sd_tagger_onnx.py": dict(nsrc=10, ntag=4),
    }
    for rel, kw in STANDALONE.items():
        path = os.path.join(HERE, "..", rel)
        cls = next((n for n in ast.parse(open(path, encoding="utf8").read()).body
                    if isinstance(n, ast.ClassDef) and n.name == "Tagger"), None)
        if cls is None:
            check(f"{rel} defines a Tagger", False, "no class Tagger — did the file move?")
            continue
        g = {"nn": torch.nn, "torch": torch, "EMB": 32, "HID": 16, "LAYERS": 2, "DROP": 0.3}
        exec(compile(ast.fix_missing_locations(ast.Module(body=[cls], type_ignores=[])), path, "exec"), g)
        torch.manual_seed(0)
        mm = g["Tagger"](**kw).eval()
        with torch.no_grad():
            alone = mm(torch.tensor([[3, 4, 5]]))
            lots = mm(torch.tensor([[3, 4, 5, 0, 0, 0, 0]]), torch.tensor([3]))[:, :3]
            few = mm(torch.tensor([[3, 4, 5, 0]]), torch.tensor([3]))[:, :3]
        check(f"{rel} packs (padding-independent, == batch-1 serving)",
              torch.allclose(lots, few, atol=1e-5) and torch.allclose(lots, alone, atol=1e-5),
              "padded training does not match what serving does — see Tagger.forward")

    print()
    if FAILED:
        print(f"FAILED: {len(FAILED)} — " + "; ".join(FAILED))
        return 1
    print("all bilstm_training smoke checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
