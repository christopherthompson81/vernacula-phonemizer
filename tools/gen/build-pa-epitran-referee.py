# Build tools/referee-eval/referees/pa.epitran-pan-guru.tsv — Punjabi's INDEPENDENT rule-based secondary
# referee, the tk/kmr/qu arrangement: epitran pan-Guru's readings over the primary referee's word list.
#
# Why this is a legitimate second referee: epitran is a NON-Wiktionary rule tradition (its pan-Guru map is
# hand-authored), so agreement with it corroborates the engine independently of the wikipron primary. Its
# model is orthographically CONSERVATIVE — it keeps written vowel nasality without restoring the homorganic
# nasal consonant (ਆਂਡਾ ɑ̃ɖɑ), performs no h-coalescence (ਜ਼ਹਿਰ zəɦɪɾ), and has its own partial schwa
# model — so it corroborates SEGMENTS, and the per-referee folds in pa.jsonc neutralize the model gaps it
# is known to have rather than scoring them.
#
# The word list is the wikipron primary's — a LIST is not labels; every reading here is epitran's own.
#
# Run: python3 tools/gen/build-pa-epitran-referee.py   (needs `pip install epitran`)
import os, sys
from epitran import Epitran

HERE = os.path.dirname(os.path.abspath(__file__))
REF = os.path.join(HERE, "../referee-eval/referees")
words = []
seen = set()
for l in open(os.path.join(REF, "pa.wikipron-pan-broad.tsv"), encoding="utf8"):
    if l.startswith("#") or "\t" not in l: continue
    w = l.split("\t")[0]
    if w not in seen: seen.add(w); words.append(w)

e = Epitran("pan-Guru")
out = os.path.join(REF, "pa.epitran-pan-guru.tsv")
with open(out, "w", encoding="utf8") as f:
    f.write("# Punjabi SECONDARY referee — epitran pan-Guru (INDEPENDENT rule-based, non-Wiktionary; MIT).\n")
    f.write("# Readings are epitran's own over the primary's word list (a list is not labels).\n")
    f.write("# ⚠ Known model gaps are FOLDED per-referee in pa.jsonc, not scored: no homorganic-nasal\n")
    f.write("#   restoration, no h-coalescence, its own partial schwa model.\n")
    f.write("# Regenerate: python3 tools/gen/build-pa-epitran-referee.py\n")
    f.write(f"# ENTRIES: {len(words)}\n")
    for w in words:
        ipa = e.transliterate(w).strip()
        if ipa and ipa != w:
            f.write(f"{w}\t{ipa}\n")
print(f"{len(words)} words → {out}")
