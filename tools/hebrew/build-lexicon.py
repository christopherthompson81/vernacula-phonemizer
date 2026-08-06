#!/usr/bin/env python3
"""Build the Hebrew pronunciation lexicon (src/languages/hebrew/he-lexicon.tsv) — a lookup layer that captures
Phonikud's modern-vocabulary READINGS (loanwords, brand names) that the neural tagger misses, WITHOUT importing
Phonikud's IPA convention. The key move: store Phonikud's niqqud and render it through OUR g2p at runtime, so the
lexicon output is always in our canonical convention; keep only entries where that our-g2p rendering independently
agrees with ReNikud (audio-supervised); and EXCLUDE homographs (left to the context tagger). Measured net-positive
on BOTH the human Nakdimon holdout (86.5→87.8) and the independent gt.tsv (64.8→66.7).

This step (PHASE A) runs the two engines and emits candidates `word <TAB> PK_niqqud <TAB> RN_ipa`; the validation +
homograph-exclusion (PHASE B) is finalize-lexicon.ts (it needs our TS g2p). See he-lexicon.tsv, lexicon.ts.

Deps (offline eval, never shipped): phonikud + phonikud-onnx (CC-BY, model thewh1teagle/phonikud-onnx) and
renikud-onnx (CC-BY, git+github.com/thewh1teagle/renikud#subdirectory=renikud-onnx, model thewh1teagle/renikud).
Wordlist: a frequency-ranked modern wordlist (e.g. the Hebrew Wikipedia dump via tools/corpus).

  python tools/hebrew/build-lexicon.py WORDLIST.txt PHONIKUD.onnx RENIKUD.onnx > /tmp/lexicon-candidates.tsv
  npx tsx tools/hebrew/finalize-lexicon.ts /tmp/lexicon-candidates.tsv > src/languages/hebrew/he-lexicon.tsv
"""
import sys, re
from phonikud_onnx import Phonikud
from renikud_onnx import G2P
PK = Phonikud(sys.argv[2]); RN = G2P(sys.argv[3])
STRIP = re.compile("[֑-ֽֿ֯׀׃-׆|]")  # cantillation/meteg/stress/pipe; KEEP niqqud 05B0-05C2,05C7
for line in open(sys.argv[1]):
    w = line.strip()
    if not w: continue
    try: niq = STRIP.sub("", PK.add_diacritics(w))
    except Exception: continue
    try: rn = RN.phonemize(w)
    except Exception: continue
    print(f"{w}\t{niq}\t{rn}")
