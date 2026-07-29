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
import argparse
import hashlib
import json
import os
from collections import Counter

ap = argparse.ArgumentParser()
ap.add_argument("--crossscript", action="store_true",
                help="include cross-script GOLD shards (harmonize the default-schwa convention first — see MODEL_NOTES.md)")
args = ap.parse_args()
HERE = os.path.dirname(os.path.abspath(__file__))
AR_TSV = os.path.join(HERE, "..", "..", "src", "languages", "arabic", "diacritization.tsv")
VOCAB = os.path.join(HERE, "multilingual_charvocab.json")
SILVER = os.path.join(HERE, "silver.tsv")
RIDERS = ["pa", "ur", "ps", "fa"]
WIKI_CODE = {"pan": "pa", "urd": "ur", "pus": "ps", "fas": "fa"}  # wikipron tag → phonemizer code
AR_REPLAY = 15000  # Arabic replay words (hash-selected from the ~259k lexicon) — enough to prevent forgetting
                   # without swamping the ~11k riders. Bump for a more Arabic-weighted fine-tune.


def bucket(skel: str) -> int:
    """Deterministic 0..9 bucket from the skeleton (stable across runs — no RNG)."""
    return int(hashlib.md5(skel.encode("utf-8")).hexdigest(), 16) % 10


def main() -> None:
    chars = set(json.load(open(VOCAB, encoding="utf-8"))["chars"])
    rows: list[tuple[str, str, str]] = []  # (skeleton, lang, vocalized)

    # NOTE: cross-script GOLD (harakat.<lang>.crossscript.tsv) is OPT-IN (--crossscript). Naive combination with the
    # silver currently REGRESSES the affected language because the two sources disagree on the default-schwa label
    # (inversion writes explicit fatḥa for ə; the sister-script transliteration leaves it bare = "0"). Harmonize
    # that convention (default ə → "0" in the inversion) before enabling. See MODEL_NOTES.md § "Cross-script".
    kinds = ("crossscript", "silver") if args.crossscript else ("silver",)
    for lang in RIDERS:
        seen_skel: set[str] = set()
        for kind in kinds:  # prefer cross-script GOLD when enabled; dedup by skeleton
            path = os.path.join(HERE, f"harakat.{lang}.{kind}.tsv")
            if not os.path.exists(path):
                continue
            for line in open(path, encoding="utf-8"):
                p = line.rstrip("\n").split("\t")
                if len(p) >= 3 and p[0] not in seen_skel:
                    seen_skel.add(p[0])
                    rows.append((p[0], p[1], p[2]))

    # Arabic replay: deterministically sample ~AR_REPLAY entries (undiacritized -> vocalized), tag `ar`.
    ar_all = [l.rstrip("\n").split("\t") for l in open(AR_TSV, encoding="utf-8") if "\t" in l]
    ar_sorted = sorted(ar_all, key=lambda p: hashlib.md5(p[0].encode("utf-8")).hexdigest())
    for p in ar_sorted[:AR_REPLAY]:
        rows.append((p[0], "ar", p[1]))

    def clean(s: str) -> str:  # strip tatweel/kashida — decorative, already gone from the rider skeletons
        return s.replace("ـ", "")

    # STABLE held-out eval slice, defined over the WIKIPRON reference (silver.tsv is fixed — it does NOT move when
    # the inversion labels change), a deterministic 10% per rider. EXCLUDED from training entirely and reported
    # end-to-end by eval_endtoend.ts, so version-to-version comparisons are exact (unlike the in-domain split, which
    # bucketed over the shifting silver labels). Includes words the inversion couldn't label — honest full coverage.
    heldout: dict[str, set[str]] = {l: set() for l in RIDERS}
    eval_set: list[str] = []
    for line in open(SILVER, encoding="utf-8"):
        p = line.rstrip("\n").split("\t")
        if len(p) >= 3 and p[1] in WIKI_CODE:
            lang = WIKI_CODE[p[1]]
            skel = clean(p[0])
            if skel and bucket(skel) == 0 and skel not in heldout[lang]:
                heldout[lang].add(skel)
                eval_set.append(f"{skel}\t{lang}")

    skipped = Counter()
    train, ev = [], []
    per_lang: dict[str, list[int]] = {}
    for skel, lang, voc in rows:
        skel, voc = clean(skel), clean(voc)
        if lang in heldout and skel in heldout[lang]:
            continue  # stable held-out — never train (or in-domain-eval) on it
        bad = [ch for ch in skel if ch not in chars]
        if bad:  # a skeleton char outside the vocab (stray punctuation etc.) → drop, don't emit an <unk>
            skipped.update(bad)
            continue
        in_eval = bucket(skel) == 1  # small in-domain slice for the training-DER early-stop (bucket 0 = held-out)
        (ev if in_eval else train).append(f"{skel}\t{lang}\t{voc}")
        per_lang.setdefault(lang, [0, 0])
        per_lang[lang][1 if in_eval else 0] += 1

    open(os.path.join(HERE, "train.tsv"), "w", encoding="utf-8").write("\n".join(train) + "\n")
    open(os.path.join(HERE, "eval.tsv"), "w", encoding="utf-8").write("\n".join(ev) + "\n")
    open(os.path.join(HERE, "eval_set.tsv"), "w", encoding="utf-8").write("\n".join(eval_set) + "\n")

    print(f"{'lang':>6} {'train':>7} {'eval':>6} {'held-out':>9}")
    print("-" * 32)
    for lang in sorted(per_lang):
        tr, e = per_lang[lang]
        print(f"{lang:>6} {tr:>7} {e:>6} {len(heldout.get(lang, [])):>9}")
    print("-" * 32)
    print(f"{'TOTAL':>6} {len(train):>7} {len(ev):>6} {sum(len(h) for h in heldout.values()):>9}")
    if skipped:
        print(f"\ndropped {sum(skipped.values())} rows with out-of-vocab chars: "
              + " ".join(f"{c}(U+{ord(c):04X})×{n}" for c, n in skipped.most_common(20)))
    print("char-vocab coverage of emitted rows: 100%")
    print(f"stable eval_set.tsv: {len(eval_set)} wikipron held-out words (fixed across versions)")


if __name__ == "__main__":
    main()
