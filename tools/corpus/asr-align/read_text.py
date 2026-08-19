#!/usr/bin/env python3
"""Own the `read_text` column. The text transform itself lives in `read_text.mts` — see its header for why
the column exists and why a hand correction is never clobbered.

  python3 read_text.py --apply [lang…]
  python3 read_text.py --set <lang> <wav> "<text>"
  python3 read_text.py --stats
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.environ.get("ASR_ALIGN_ROOT", "/mnt/data/omnivoice_ipa") + "/work/asr_align/align.sqlite"
import sqlite3  # noqa: E402


def ensure(db: sqlite3.Connection) -> None:
    cols = {r[1] for r in db.execute("PRAGMA table_info(utt)")}
    if "read_text" not in cols:
        db.execute("ALTER TABLE utt ADD COLUMN read_text TEXT")
    if "read_text_src" not in cols:
        db.execute("ALTER TABLE utt ADD COLUMN read_text_src TEXT")
    db.commit()


def apply(db: sqlite3.Connection, langs: list[str]) -> None:
    # ⚠ `hand` rows are excluded from the SELECT, not merely from the UPDATE — a human edit must not even
    #   be recomputed, so a later diff of auto-vs-hand stays meaningful.
    q = ("SELECT lang,wav,text FROM utt WHERE text IS NOT NULL "
         "AND (read_text_src IS NULL OR read_text_src='auto')")
    if langs:
        q += " AND lang IN (%s)" % ",".join("?" * len(langs))
    rows = [{"lang": a, "wav": b, "text": c} for a, b, c in db.execute(q, langs)]
    if not rows:
        print("nothing to do", file=sys.stderr)
        return
    with tempfile.TemporaryDirectory() as td:
        src, dst = os.path.join(td, "in.json"), os.path.join(td, "out.json")
        json.dump(rows, open(src, "w"))
        subprocess.run(["npx", "tsx", os.path.join(HERE, "read_text.mts"), src, dst],
                       check=True, cwd=os.path.join(HERE, "..", "..", ".."))
        out = json.load(open(dst))
    n = 0
    for lang, wav, read in out:
        db.execute("UPDATE utt SET read_text=?, read_text_src='auto' WHERE lang=? AND wav=? "
                   "AND (read_text_src IS NULL OR read_text_src='auto')", (read, lang, wav))
        n += 1
    db.commit()
    print(f"read_text: {n} auto rows written", file=sys.stderr)


def stats(db: sqlite3.Connection) -> None:
    for src, n, diff in db.execute(
            "SELECT COALESCE(read_text_src,'(none)'), COUNT(*), "
            "SUM(CASE WHEN read_text IS NOT NULL AND read_text<>text THEN 1 ELSE 0 END) "
            "FROM utt GROUP BY 1 ORDER BY 2 DESC"):
        print(f"  {src:<8} {n} rows, {diff or 0} differ from the transcript", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    ap.add_argument("--apply", nargs="*", metavar="LANG")
    ap.add_argument("--set", nargs=3, metavar=("LANG", "WAV", "TEXT"))
    ap.add_argument("--stats", action="store_true")
    a = ap.parse_args()
    db = sqlite3.connect(a.db)
    ensure(db)
    if a.set:
        lang, wav, text = a.set
        n = db.execute("UPDATE utt SET read_text=?, read_text_src='hand' WHERE lang=? AND wav=?",
                       (text, lang, wav)).rowcount
        db.commit()
        print(f"{n} row(s) set by hand", file=sys.stderr)
    if a.apply is not None:
        apply(db, a.apply)
    if a.stats or a.apply is not None or not (a.set or a.apply is not None):
        stats(db)
    db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
