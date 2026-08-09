#!/usr/bin/env python3
"""Build Urdu (skeleton → IPA) training labels from the humair025/urdu-g2p-dictionary HF dataset.

WHY THIS ONE AND NOT THE OTHERS. Runs 13-14 set the bar: a source is usable as TRAINING data only
if its labels beat the always-ə prior by a wide margin — Dakshina's romanization managed +3.7pp
and training on it was actively harmful at every scale and cleanliness level. Scored on CLE
(independent of Wiktionary, Dakshina and this source), this dictionary scores **74.0% vs a 58.9%
prior, +15.1pp**, on 5,086 overlapping words — the first candidate to clear the bar.

⚠ LICENCE IS NON-COMMERCIAL ("license: other / non-commercial"). That is a HARDER restriction than
anything currently in this repo: LICENSES/PROVENANCE.md §3 covers share-alike (CC-BY-SA), and the
Afrikaans RCRL note explicitly records "Share-alike, NOT NonCommercial" as what makes it
shippable. An NC source cannot ship here, and — because this repo declares models to inherit their
training data's licence — a tagger trained on it cannot ship either. This builder therefore exists
to ANSWER THE RESEARCH QUESTION (does enough good data rescue the tagger?), not to produce a
shippable artifact.

⚠ PROVENANCE UNVERIFIED. The dataset card does not state how the 635k entries were produced. If
they are the output of a model or rule system, training on them is distillation, not gold. The
+15.1pp on an independent human corpus bounds the quality from below regardless of origin, but it
does not establish the entries are human-authored.

    python3 tools/perso-arabic/ur_build_hf_labels.py --json /tmp/pm.json
"""
import argparse
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))

# their notation → ours. Vowel QUALITY is never touched; only symbol identity.
# ⚠ aː→ɑː IS LOAD-BEARING, not cosmetic. This source writes the long low vowel ⟨ا⟩ as aː (22.3% of
# its vowels, ɑː only 0.4%); our gold writes ɑː (31.8%). Same phoneme, different symbol. Left
# unfolded, the two corpora produce DISJOINT tags for the same char — halving the usable signal,
# splitting the char_mask, and collapsing word-exact to 13%. Found by comparing the two inventories
# rather than by reading either one. Likewise their bare ⟨a⟩ (1.8%): our inventory has no short /a/,
# it is our ə.
SUBS = [("ˈ", ""), ("ˌ", ""), (".", ""), ("ħ", "ɦ"), ("h", "ɦ"), ("æ", "ɛ"), ("ʌ", "ə"),
        ("aː", "ɑː"), ("r", "ɾ"), ("g", "ɡ"), ("ʧ", "t͡ʃ"), ("ʤ", "d͡ʒ")]


def post(s):
    """bare 'a' → ə, applied AFTER the digraph folds so aː is already gone."""
    return s.replace("a", "ə")


def norm(ipa):
    s = ipa.strip()
    for a, b in SUBS:
        s = s.replace(a, b)
    return post(s)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", default="/tmp/pm.json")
    ap.add_argument("--out", default=os.path.join(HERE, "silver.hfdict.tsv"))
    args = ap.parse_args()

    d = json.load(open(args.json, encoding="utf-8"))
    rows = []
    for w, ipa in d.items():
        w = w.strip()
        if not w or " " in w:
            continue  # multi-word phrases: the tagger is word-level
        v = norm(ipa)
        if not v or " " in v:
            continue
        rows.append((w, v))
    rows.sort()
    with open(args.out, "w", encoding="utf-8") as fh:
        fh.write("# skeleton\tlang\tIPA — from humair025/urdu-g2p-dictionary (HF).\n")
        fh.write("# ⚠ NON-COMMERCIAL licence — research measurement only, NOT shippable. See module docstring.\n")
        for w, v in rows:
            fh.write(f"{w}\turd\t{v}\n")
    print(f"wrote {len(rows)} single-word pairs → {args.out}")


if __name__ == "__main__":
    main()
