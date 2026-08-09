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
import re
rows = []
skipped = 0
for w in words:
    # a "word" that is only combining marks (the primary carries a bare-bindi row) has no reading
    if not re.search(r"[\u0a05-\u0a39\u0a59-\u0a5e\u0a72-\u0a74]", w):
        skipped += 1; continue
    ipa = e.transliterate(w).strip()
    # epitran leaks GURMUKHI characters (the nukta ਼, unmapped letters) into its output for words its map
    # does not cover — those rows are malformed labels, not transcriptions. The kaikki dirty-row rule.
    if not ipa or ipa == w or re.search(r"[\u0a00-\u0a7f]", ipa):
        skipped += 1; continue
    rows.append((w, ipa))

out = os.path.join(REF, "pa.epitran-pan-guru.tsv")
with open(out, "w", encoding="utf8") as f:
    f.write("# Punjabi SECONDARY referee — epitran pan-Guru (INDEPENDENT rule-based, non-Wiktionary; MIT).\n")
    f.write("# Readings are epitran's own over the primary's word list (a list is not labels).\n")
    f.write("# ⚠ Known model gaps are FOLDED per-referee in pa.jsonc, not scored: no homorganic-nasal\n")
    f.write("#   restoration, no h-coalescence, its own partial schwa model. Rows whose output leaked\n")
    f.write("#   source-script characters (nukta) or whose word is only combining marks are REJECTED.\n")
    f.write("# Regenerate: python3 tools/gen/build-pa-epitran-referee.py\n")
    f.write(f"# ENTRIES: {len(rows)}\n")
    for w, ipa in rows:
        f.write(f"{w}\t{ipa}\n")
print(f"{len(rows)} rows ({skipped} skipped: combining-mark words / source-script leakage) → {out}")
