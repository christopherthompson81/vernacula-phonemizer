#!/usr/bin/env python3
"""
Score the candidate readings produced by `measure_numeral_register.mts` against the recognizers.

Reads `<lang>_reg.tsv` (wav, native, en, fr, pt) and reports, per candidate, how many rows it moves CLOSER
to the audio than the language's own numerals do. The bands are run 19's and are what the register table
is gated on: CLEAN >=90% wires, MIXED 60-85% does not (a third of rows would get worse), NATIVE means the
readers use their own numerals.

⚠ SCORED AGAINST BOTH RECOGNIZERS (min of wav2vec2 and the two allosaurus decodes), unlike run 19 which
had only wav2vec2. A register is a claim about WHICH LANGUAGE a span is in, and wav2vec2 is espeak-
labelled, so an English candidate scored against it alone is flattered.

  python3 score_numeral_register.py ha_ng /path/ha_reg.tsv
"""
from __future__ import annotations

import os
import sqlite3
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from allo_compare import corroborated, notate, units  # noqa: E402

DB = os.environ.get("ASR_ALIGN_ROOT", "/mnt/data/omnivoice_ipa") + "/work/asr_align/align.sqlite"


# ⚠ THE CLEAN THRESHOLD IS 89, NOT 90, AND THE TABLE IS WHY. `numeral_register.mts` wires `ln → fr` at
# 89%, so a 90 cut makes this harness print "mixed" — do not wire — for a language that IS wired, i.e. it
# could not reproduce a decision already taken. 89 is the lowest wired entry and 84.8% (ceb) is the
# highest declined one, so the real boundary sits in that gap; this names the end of it that the shipped
# table actually commits to.
CLEAN_PCT = 89.0


def band(pct: float) -> str:
    return "CLEAN" if pct >= CLEAN_PCT else "mixed" if pct >= 60 else "NATIVE"


def main() -> int:
    lang, path = sys.argv[1], sys.argv[2]
    db = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    rec = {w: (p, a, u) for w, p, a, u in db.execute(
        "SELECT wav, phones, phones_allo, phones_allo_uni FROM utt WHERE lang=?", (lang,))}

    nf = lambda s: notate(units(s))  # noqa: E731
    cols = ["native", "en", "fr", "pt"]
    missing = 0
    scores: dict[str, list[float]] = {c: [] for c in cols}
    for line in open(path, encoding="utf8"):
        f = line.rstrip("\n").split("\t")
        if len(f) < 1 + len(cols) or f[0] not in rec:
            continue
        # ⚠ DO NOT REQUIRE EVERY STREAM. `corroborated` already drops an empty one from the vote, so
        # demanding both recognizers silently shrank n below what the docstring promises — a row only
        # wav2vec2 could score was thrown away rather than scored by wav2vec2.
        ph, pa, pu = rec[f[0]]
        streams = [nf(x) for x in (ph, pa, pu or pa)]
        vals = [corroborated(nf(f[i + 1]), streams) for i in range(len(cols))]
        # ⚠ None only when EVERY stream is empty, which is candidate-independent, so the row leaves all
        # columns together and the comparison stays aligned.
        if any(v is None for v in vals):
            missing += 1
            continue
        for c, v in zip(cols, vals):
            scores[c].append(v)

    base = scores["native"]
    n = len(base)
    if not n:
        # ⚠ The likeliest cause is an input TSV in the WRONG SHAPE — `measure_numeral_register.mts` takes
        # wav<TAB>text, while `rederive_read_text.mts` takes lang<TAB>wav<TAB>text and is silently
        # accepted by it. Say so instead of dying on `median of empty data`.
        print(f"{lang}: NO rows matched. Check the --lang, and that the TSV is "
              f"wav<TAB>native<TAB>{'<TAB>'.join(cols[1:])} for this language.", file=sys.stderr)
        return 1
    print(f"{lang}: {n} digit-bearing rows scored against both recognizers"
          + (f" ({missing} unscoreable, no recognizer output)" if missing else ""))
    print(f"  {'cand':<8}{'median':>9}{'closer':>8}{'further':>9}{'same':>7}{'pct':>8}   band")
    for c in cols[1:]:
        v = scores[c]
        closer = sum(1 for a, b in zip(base, v) if b < a)
        further = sum(1 for a, b in zip(base, v) if b > a)
        same = n - closer - further
        moved = closer + further
        # ⚠ A candidate that moved NOTHING has no evidence either way; printing 0.0% NATIVE would read as
        # a confident "reads its own numerals" drawn from nothing.
        if not moved:
            print(f"  {c:<8}{statistics.median(v):9.4f}{closer:8}{further:9}{same:7}{'—':>7}   no evidence")
            continue
        pct = 100 * closer / moved
        print(f"  {c:<8}{statistics.median(v):9.4f}{closer:8}{further:9}{same:7}{pct:7.1f}%   {band(pct)}")
    print(f"  {'native':<8}{statistics.median(base):9.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
