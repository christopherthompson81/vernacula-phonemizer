#!/usr/bin/env python3
"""Rebuild the UNANIMOUS 3-referee consensus gold (tools/hebrew/consensus-gold.tsv) from three INDEPENDENT
Modern-Israeli-Hebrew IPA sources, so validating the Phase-1 g2p rests on cross-source agreement rather than any
single (possibly convention-biased) referee:

  1. Wiktionary a=IL  — lexicographic; the committed referee tools/referee-eval/referees/he.wiktionary-he.tsv
                        (vocalized form <TAB> IPA).
  2. Phonikud        — rule-FST G2P (CC-BY, arXiv 2506.12311). pip install phonikud phonikud-onnx;
                        model https://huggingface.co/thewh1teagle/phonikud-onnx (phonikud-1.0.int8.onnx).
  3. ReNikud         — audio-supervised neural G2P (CC-BY, arXiv 2606.20179). pip install
                        "git+https://github.com/thewh1teagle/renikud.git#subdirectory=renikud-onnx";
                        model https://huggingface.co/thewh1teagle/renikud (model.onnx).

For each Wiktionary word we feed the UNVOCALIZED skeleton to Phonikud + ReNikud, canonicalise all three (strip
stress/tie, unwrap Wiktionary optional-parens), and KEEP the word iff all three agree — that agreement is the gold
IPA. Words where the three disagree are dropped (genuine ambiguity/convention, not a validation target). Eval-only;
never shipped in the model.

  python tools/hebrew/build-consensus-gold.py  PHONIKUD.onnx  RENIKUD.onnx  > tools/hebrew/consensus-gold.tsv
"""
import sys, re
from phonikud_onnx import Phonikud
from phonikud import phonemize as pk_phon
from renikud_onnx import G2P

PK = Phonikud(sys.argv[1]); RN = G2P(sys.argv[2])
NIQ = re.compile(r"[֑-ׇ]")
def canon(s): return re.sub(r"\s+", " ", re.sub(r"[()]", "", s.replace("͡", "").replace("ˈ", "").replace("ˌ", ""))).strip()

wikt = [l.rstrip("\n").split("\t") for l in open("tools/referee-eval/referees/he.wiktionary-he.tsv")
        if l.strip() and not l.startswith("#") and "\t" in l]
gold = []
for voc, ipa in wikt:
    sk = NIQ.sub("", voc)
    try: P = canon(pk_phon(PK.add_diacritics(sk)))
    except Exception: continue
    try: R = canon(RN.phonemize(sk))
    except Exception: continue
    W = canon(ipa)
    if W and P and R and W == P == R:
        gold.append((voc, W))
for voc, ipa in gold:
    print(f"{voc}\t{ipa}")
print(f"# {len(gold)} unanimous / {len(wikt)} words", file=sys.stderr)
