#!/usr/bin/env python3
"""Assemble the language-tagged fine-tune manifest for the shared harakat restorer.

The multilingual restorer is a FINE-TUNE of the existing Arabic diacritizer (diacritizer.onnx): the char vocab
(multilingual_charvocab.json) preserves the Arabic indices 0–38 so the trained embedding rows stay valid and the
new rider letters just append. This builds the fine-tune set:

  - the mined rider harakat pairs (harakat.{pa,ur,ps,fa}.silver.tsv) — the target of the fine-tune;
  - an Arabic REPLAY sample from diacritization.tsv (tagged `ar`) — so fine-tuning doesn't forget Arabic.

Output train.tsv / eval.tsv, format `skeleton <TAB> lang <TAB> vocalized`, with a DETERMINISTIC per-language 90/10
split (md5-bucketed on the skeleton — no RNG, fully reproducible). The training script derives per-character labels
in the 19-label harakat scheme by aligning `vocalized` to `skeleton`. Coverage against the char vocab is checked so
no input char silently becomes <unk>.
"""
import hashlib
import json
import os
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
AR_TSV = os.path.join(HERE, "..", "..", "src", "languages", "arabic", "diacritization.tsv")
VOCAB = os.path.join(HERE, "multilingual_charvocab.json")
RIDERS = ["pa", "ur", "ps", "fa"]
AR_REPLAY = 15000  # Arabic replay words (hash-selected from the ~259k lexicon) — enough to prevent forgetting
                   # without swamping the ~11k riders. Bump for a more Arabic-weighted fine-tune.


def bucket(skel: str) -> int:
    """Deterministic 0..9 bucket from the skeleton (stable across runs — no RNG)."""
    return int(hashlib.md5(skel.encode("utf-8")).hexdigest(), 16) % 10


def main() -> None:
    chars = set(json.load(open(VOCAB, encoding="utf-8"))["chars"])
    rows: list[tuple[str, str, str]] = []  # (skeleton, lang, vocalized)

    for lang in RIDERS:
        path = os.path.join(HERE, f"harakat.{lang}.silver.tsv")
        for line in open(path, encoding="utf-8"):
            p = line.rstrip("\n").split("\t")
            if len(p) >= 3:
                rows.append((p[0], p[1], p[2]))

    # Arabic replay: deterministically sample ~AR_REPLAY entries (undiacritized -> vocalized), tag `ar`.
    ar_all = [l.rstrip("\n").split("\t") for l in open(AR_TSV, encoding="utf-8") if "\t" in l]
    ar_sorted = sorted(ar_all, key=lambda p: hashlib.md5(p[0].encode("utf-8")).hexdigest())
    for p in ar_sorted[:AR_REPLAY]:
        rows.append((p[0], "ar", p[1]))

    # Clean (strip tatweel/kashida — decorative, already stripped from the rider skeletons), split, coverage.
    def clean(s: str) -> str:
        return s.replace("ـ", "")

    skipped = Counter()
    train, ev = [], []
    per_lang: dict[str, list[int]] = {}
    for skel, lang, voc in rows:
        skel, voc = clean(skel), clean(voc)
        bad = [ch for ch in skel if ch not in chars]
        if bad:  # a skeleton char outside the vocab (stray punctuation etc.) → drop, don't emit an <unk>
            skipped.update(bad)
            continue
        (ev if bucket(skel) == 0 else train).append(f"{skel}\t{lang}\t{voc}")
        per_lang.setdefault(lang, [0, 0])
        per_lang[lang][1 if bucket(skel) == 0 else 0] += 1

    open(os.path.join(HERE, "train.tsv"), "w", encoding="utf-8").write("\n".join(train) + "\n")
    open(os.path.join(HERE, "eval.tsv"), "w", encoding="utf-8").write("\n".join(ev) + "\n")

    print(f"{'lang':>6} {'train':>7} {'eval':>6}")
    print("-" * 21)
    for lang in sorted(per_lang):
        tr, e = per_lang[lang]
        print(f"{lang:>6} {tr:>7} {e:>6}")
    print("-" * 21)
    print(f"{'TOTAL':>6} {len(train):>7} {len(ev):>6}")
    if skipped:
        print(f"\ndropped {sum(skipped.values())} rows with out-of-vocab chars: "
              + " ".join(f"{c}(U+{ord(c):04X})×{n}" for c, n in skipped.most_common(20)))
    print("char-vocab coverage of emitted rows: 100%")


if __name__ == "__main__":
    main()
