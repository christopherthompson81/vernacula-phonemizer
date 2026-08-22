#!/usr/bin/env python3
"""
Label the rows that never reach the codec, so "absent from the manifest" stops being invisible.

⚠ THE ALIGN DB IS THE COMPLETE RECORD; THE CODES ARE A SUBSET. `codes_<lang>.npz` can only hold what
the encoder can process, and `ingest_fleurs.py` drops anything outside 1-30 s. Those rows then vanish
with nothing but a count in a log — a consumer cannot tell a row that was dropped from a row that never
existed. That is the same failure as encode-time exclusion, which froze a July judgement into cy_gb and
es_419 for two months. Every row should be able to say why it is not in the manifest.

⚠ TWO DIFFERENT FACTS, AND CONFLATING THEM LOSES THE USEFUL ONE:

    audio_overlong      the AUDIO far exceeds what the text accounts for — a bad pair, and it would
                        still be bad if the encoder were unlimited. The mirror of `defective_audio`
                        ("far too short for its text").
    uncodeable_length   the pair looks FINE; it is simply longer than the encoder's window. Not a
                        defect. If the codec ever chunks, this is the ready work-list.

⚠ THE THRESHOLD IS PER-LANGUAGE AND THAT CHANGED THE ANSWER BY 2.6x. A global "cps < 7" cutoff called
2,756 rows defective. But characters-per-second is a property of the SCRIPT as much as the speech —
measured 5th percentiles run from umb_ao 3.3 and cmn_hans_cn 4.4 up to en_us 7.8 — so a global cut
condemns whole languages for writing compactly. Against each language's OWN 1-30 s distribution only
1,057 rows are anomalous, and 2,437 are ordinary speech that merely runs long.

⚠ IT WILL OVERWRITE `verified`, WHICH IS THE POINT. 2,541 of these carry `verified`, which means
"unremarkable for this language", not "correct" — the QC pass never saw them because they were skipped
before scoring. BY_HAND verdicts are never touched.

  python3 label_long_audio.py            # report, write nothing
  python3 label_long_audio.py --apply
"""
from __future__ import annotations

import argparse
import collections
import os
import sqlite3
import statistics
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from asr_align_label import BY_HAND, DB  # noqa: E402

MAX_SECONDS = 30.0
SR = 16000.0
#: Minimum rows in a language's 1-30 s band before its own percentile is trustworthy.
MIN_SAMPLE = 50


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    ap.add_argument("--apply", action="store_true")
    a = ap.parse_args()
    db = sqlite3.connect(a.db)

    norm: dict[str, list[float]] = collections.defaultdict(list)
    long_rows: list[tuple[str, str, float, str]] = []
    for lang, wav, text, n, st in db.execute(
            "SELECT lang, wav, text, n_samples, COALESCE(status,'') FROM utt "
            "WHERE n_samples > 0 AND text IS NOT NULL AND TRIM(text) <> ''"):
        secs = n / SR
        cps = len(text) / secs
        if secs > MAX_SECONDS:
            long_rows.append((lang, wav, cps, st))
        else:
            norm[lang].append(cps)

    thr = {l: statistics.quantiles(v, n=20)[0] for l, v in norm.items() if len(v) >= MIN_SAMPLE}
    upd: list[tuple[str, str, str]] = []
    counts: collections.Counter = collections.Counter()
    for lang, wav, cps, st in long_rows:
        if st in BY_HAND:
            counts["kept (hand verdict)"] += 1
            continue
        if lang not in thr:
            counts["skipped (too few rows to set a threshold)"] += 1
            continue
        new = "audio_overlong" if cps < thr[lang] else "uncodeable_length"
        counts[new] += 1
        if st != new:
            upd.append((new, lang, wav))

    for k, v in counts.most_common():
        print(f"  {v:6}  {k}")
    print(f"\n{'updating' if a.apply else 'would update'} {len(upd)} rows "
          f"(of {len(long_rows)} over {MAX_SECONDS:.0f}s)")
    if a.apply and upd:
        db.executemany("UPDATE utt SET status=? WHERE lang=? AND wav=?", upd)
        db.commit()
        print("⚠ These rows have no codes and never will under the current window — the label is the\n"
              "  only record of why they are absent from the manifest.")
    elif not a.apply:
        print("   (report-only is the default; pass --apply to write)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
