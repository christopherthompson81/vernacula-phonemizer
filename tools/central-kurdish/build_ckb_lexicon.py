#!/usr/bin/env python3
"""Build data/languages/central-kurdish/lexicon.tsv — the bizroke coverage lexicon.

⚠ WHAT THIS SUPPLIES, AND WHY A RULE CANNOT. Sorani writes every long vowel and the short /a/ but NOT the
short /ɪ/ (the *bizroke*), so `central-kurdish.ts` emits nothing for it and 634 corpus tokens across 54 word
types come out with no nucleus at all — کرد *kɾd*, گشت *ɡʃt*, من *mn*. Inserting one by rule was measured and
is net negative at every quality (ɪ 52/500, i 133/419, e 160/392, ə 106/446 closer/further against the
audio), because the class is LEXICAL: سفر is *safar*, a two-vowel word written with neither, and one
epenthesis after the first consonant is right that a vowel is missing and wrong about how many and which.

⚠ ONLY THE BIZROKE CLASS IS TAKEN. Of the 10,041 source pairs, 6,870 already agree with this engine
character-for-character after transcription mapping and 654 disagree on something else (mostly ⟨ŋ⟩, which
this engine derives by rule, and glide/hiatus choices). The 2,517 that differ ONLY by an inserted /ɪ/ carry
the information we lack, and they are the only ones written out: an independent source confirming our
consonant skeleton and supplying the vowel. Taking the whole file would import the source's decisions on
axes where we already have our own and where it is not obviously right.

⚠ THE TWO RHOTICS CROSS OVER. The source writes the TAP ⟨r⟩ and the TRILL ⟨ř⟩; this engine writes the tap ɾ
and the trill r. A one-pass table maps ř→r and leaves ⟨r⟩ alone, turning every tap into a trill — 4,700
spurious mismatches before the placeholder below was added. The single largest trap in the mapping; ⟨g⟩ vs
ɡ (ASCII against IPA) was the second, worth another 522.

Source: AsoSoft Kurdish-G2P-dataset — see LICENSES/LicenseRef-AsoSoftKurdishG2P.txt for the terms, the two
mandatory citations, and the good-faith removal undertaking. NOT redistributed; clone it to run this.

  python3 build_ckb_lexicon.py --src /path/to/Kurdish-G2P-dataset
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "..", "src", "languages", "central-kurdish", "lexicon.tsv")
PARK = "\u0001"  # ⟨ř⟩ parks here so the ⟨r⟩→ɾ rule below cannot claim it

MAP = [("û", "uː"), ("î", "iː"), ("ê", "eː"), ("ç", "t͡ʃ"), ("ş", "ʃ"), ("ř", PARK), ("ł", "ɫ"),
       ("ḧ", "ħ"), ("ẍ", "ɣ"), ("ƹ", "ʕ"), ("ʔ", "ʔ"), ("a", "aː"), ("e", "a"), ("o", "oː"),
       ("u", "u"), ("i", "ɪ"), ("c", "d͡ʒ"), ("j", "ʒ"), ("y", "j"), ("x", "x"), ("q", "q"),
       ("r", "ɾ"), ("g", "ɡ")]


def to_ipa(s: str) -> str:
    s = s.replace(".", "")  # the source marks syllable starts; this engine does not emit them
    out, i = "", 0
    while i < len(s):
        for a, b in MAP:
            if s.startswith(a, i):
                out += b
                i += len(a)
                break
        else:
            out += s[i]
            i += 1
    return out.replace(PARK, "r")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True, help="clone of AsoSoft/Kurdish-G2P-dataset")
    a = ap.parse_args()
    pairs = []
    for name in ("AsoSoft-top5K", "Wergor-words"):
        path = os.path.join(a.src, name)
        if not os.path.exists(path):
            sys.exit(f"missing {path} — clone https://github.com/AsoSoft/Kurdish-G2P-dataset")
        for line in open(path, encoding="utf-8"):
            p = line.rstrip("\n").split("\t")
            if len(p) >= 2 and p[0] and p[1]:
                pairs.append((p[0], to_ipa(p[1])))
    with tempfile.TemporaryDirectory() as td:
        src, dst = os.path.join(td, "in.json"), os.path.join(td, "out.json")
        json.dump([w for w, _ in pairs], open(src, "w"))
        subprocess.run(["npx", "tsx", os.path.join(HERE, "engine_says.mts"), src, dst],
                       check=True, cwd=os.path.join(HERE, "..", ".."))
        ours = json.load(open(dst))
    keep, agree, other = [], 0, 0
    for (w, ref), mine in zip(pairs, ours):
        if mine == ref:
            agree += 1
        elif ref.replace("ɪ", "") == mine:
            keep.append((w, ref))
        else:
            other += 1
    keep.sort()
    with open(OUT, "w", encoding="utf-8") as f:
        f.write("# Central Kurdish bizroke lexicon — word<TAB>IPA, for the UNWRITTEN short /ɪ/ only.\n")
        f.write("# Every entry differs from this engine's rule output by inserted /ɪ/ and NOTHING ELSE: the\n")
        f.write("# consonant skeleton is ours and independently confirmed, the vowel is what we lack.\n")
        f.write("# Built by tools/central-kurdish/build_ckb_lexicon.py from the AsoSoft Kurdish-G2P-dataset.\n")
        f.write("# ⚠ SOURCE TERMS AND THE TWO MANDATORY CITATIONS: LICENSES/LicenseRef-AsoSoftKurdishG2P.txt\n")
        for w, ipa in keep:
            f.write(f"{w}\t{ipa}\n")
    print(f"{len(pairs)} source pairs: {agree} agree, {len(keep)} bizroke-only (written), {other} other",
          file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
