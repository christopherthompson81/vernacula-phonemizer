#!/usr/bin/env python3
"""
Score the candidate readings produced by `measure_numeral_register.mts` against the recognizers.

Reads `<lang>_reg.tsv` (wav, native, en, fr) and reports, per candidate, how many rows it moves CLOSER
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


def band(pct: float) -> str:
    return "CLEAN" if pct >= 90 else "mixed" if pct >= 60 else "NATIVE"


def main() -> int:
    lang, path = sys.argv[1], sys.argv[2]
    db = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    rec = {w: (p, a, u) for w, p, a, u in db.execute(
        "SELECT wav, phones, phones_allo, phones_allo_uni FROM utt WHERE lang=?", (lang,))}

    nf = lambda s: notate(units(s))  # noqa: E731
    cols = ["native", "en", "fr"]
    scores: dict[str, list[float]] = {c: [] for c in cols}
    for line in open(path, encoding="utf8"):
        f = line.rstrip("\n").split("\t")
        if len(f) < 4 or f[0] not in rec:
            continue
        ph, pa, pu = rec[f[0]]
        if not ph or not pa:
            continue
        streams = [nf(x) for x in (ph, pa, pu or pa)]
        vals = [corroborated(nf(f[i + 1]), streams) for i in range(len(cols))]
        if any(v is None for v in vals):
            continue
        for c, v in zip(cols, vals):
            scores[c].append(v)

    base = scores["native"]
    n = len(base)
    print(f"{lang}: {n} digit-bearing rows scored against both recognizers")
    print(f"  {'cand':<8}{'median':>9}{'closer':>8}{'further':>9}{'same':>7}{'pct':>8}   band")
    for c in cols[1:]:
        v = scores[c]
        closer = sum(1 for a, b in zip(base, v) if b < a)
        further = sum(1 for a, b in zip(base, v) if b > a)
        same = n - closer - further
        moved = closer + further
        pct = 100 * closer / moved if moved else 0.0
        print(f"  {c:<8}{statistics.median(v):9.4f}{closer:8}{further:9}{same:7}{pct:7.1f}%   {band(pct)}")
    print(f"  {'native':<8}{statistics.median(base):9.4f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
