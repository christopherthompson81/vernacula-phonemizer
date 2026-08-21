#!/usr/bin/env python3
"""
Export the alignment corpus as per-language JSONL, for the Hugging Face dataset.

⚠ WHY NOT GIT. `align.sqlite` is 337 MB over 270,106 rows and 102 languages — text 32 MB, ipa 42 MB,
phones 53 MB. That is dataset-sized, not repository-sized. `review_ledger.py` versions the 138 rows of
human judgement, which nobody can recompute; this exports the measurements, which are large and belong
beside the corpus they came from.

⚠ WHAT IS ACTUALLY WORTH PUBLISHING, ranked by what it costs to lose:

    phones   THE ONE. A GPU pass over 270k utterances against a ~30 GB FLEURS audio tree.
    ipa      ours, re-derivable by phonemize-fleurs.mts in about an hour of CPU — but pinned here so the
             published `phones` has the exact IPA it was scored against, which a later engine will not
             reproduce.
    text     the FLEURS transcript. Exported.

⚠ AN EARLIER VERSION OF THIS FILE WITHHELD `text` ON A REASON THAT DOES NOT HOLD. The argument was that
the sibling dataset card "declines to redistribute FLEURS-owned content — Codes + IPA/metadata only, not
the source audio". But `codes_<lang>.npz` is 8-codebook Higgs codec tokens at ~25 Hz, and those DECODE
BACK TO WAVEFORMS: the dataset already redistributes a processed form of ~267 hours of FLEURS audio,
which is far more of FLEURS than its transcripts are. And FLEURS is CC-BY-4.0 — redistribution with
attribution is permitted outright, which the card already gives. There was never a barrier, and a QC
export without the sentence is much the poorer: a reader cannot judge `reader_divergence` against an id.

⚠ FILE NAMING FOLLOWS THE SIBLING DATASET — `data/manifest_<lang>.jsonl` there, `align_<lang>.jsonl` here,
so the two drop into the same layout without colliding. Per-language files mean re-running one language
rewrites one file.

    python3 export_hf_align.py --out /tmp/hf_align [--langs xh_za …] [--gzip]
"""
from __future__ import annotations

import argparse
import gzip
import json
import os
import sys

DB = os.environ.get("ASR_ALIGN_ROOT", "/mnt/data/omnivoice_ipa") + "/work/asr_align/align.sqlite"
import sqlite3  # noqa: E402

#: Carried per row. `status`/`comment`/`read_text` travel so the QC verdicts reach a consumer that never
#: sees the git ledger — the ledger is the authority, this is a copy for readers of the dataset.
COLS = ("id", "sentence_id", "lang", "text", "ipa", "phones", "dist", "status", "comment", "read_text")


def export(db: sqlite3.Connection, out: str, langs: list[str], gz: bool) -> None:
    os.makedirs(out, exist_ok=True)
    where = f"WHERE lang IN ({','.join('?' * len(langs))})" if langs else ""
    have = [r[0] for r in db.execute(f"SELECT DISTINCT lang FROM utt {where} ORDER BY lang", langs)]
    total = 0
    for lang in have:
        rows = db.execute(
            "SELECT wav, sentence_id, lang, text, ipa, phones, dist, status, comment, read_text "
            "FROM utt WHERE lang=? ORDER BY wav", (lang,)).fetchall()
        path = os.path.join(out, f"align_{lang}.jsonl" + (".gz" if gz else ""))
        op = gzip.open if gz else open
        with op(path, "wt", encoding="utf-8") as fh:  # type: ignore[operator]
            for r in rows:
                # `wav` is `<id>.wav`; the sibling manifest keys on the bare id, so match it.
                d = dict(zip(COLS, (r[0].removesuffix(".wav"), *r[1:])))
                fh.write(json.dumps({k: v for k, v in d.items() if v not in (None, "")},
                                    ensure_ascii=False) + "\n")
        total += len(rows)
        print(f"  align_{lang}: {len(rows)} rows, {os.path.getsize(path)/1e6:.1f} MB", file=sys.stderr)
    print(f"{total} rows across {len(have)} languages -> {out}", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    ap.add_argument("--out", required=True)
    ap.add_argument("--langs", nargs="*", default=[])
    ap.add_argument("--gzip", action="store_true", help="write .jsonl.gz (HF serves either)")
    a = ap.parse_args()
    db = sqlite3.connect(a.db)
    export(db, a.out, a.langs, a.gzip)
    db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
