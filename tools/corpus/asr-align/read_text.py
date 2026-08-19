#!/usr/bin/env python3
"""Own the `read_text` column. The text transform itself lives in `read_text.mts` — see its header for why
the column exists and why a hand correction is never clobbered.

  python3 read_text.py --apply [lang…]
  python3 read_text.py --set <lang> <wav> "<text>"
  python3 read_text.py --stats
  python3 read_text.py --stale
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


def warn_broadcast(db: sqlite3.Connection, lang: str, wav: str, text: str) -> None:
    """⚠ A HAND read_text IS PER-UTTERANCE, AND THE FIRST ONE EVER WRITTEN WAS NOT.

    mt_mt sentence 35 (8:46) got ONE hand reading copied to all three of its wavs. They do not read alike: one
    says *fid-disgħa nieqes kwart* (quarter to nine) and two say *fid-disgħa nieqes erbatax-il minuta*
    (fourteen minutes to nine — 8:46 exactly). `read_text` exists precisely because readers deviate from the
    text, so assuming they deviate identically defeats the column. Sibling wavs are evidence about the
    SENTENCE, never about each other's delivery."""
    same = [w for (w,) in db.execute(
        "SELECT wav FROM utt WHERE lang=? AND wav<>? AND read_text=? AND read_text_src='hand' "
        "AND sentence_id=(SELECT sentence_id FROM utt WHERE lang=? AND wav=?)",
        (lang, wav, text, lang, wav))]
    if same:
        print(f"⚠ identical hand read_text already on {len(same)} sibling wav(s) of this sentence: "
              f"{', '.join(same[:3])}. Each reading must come from THAT wav's own audio — see warn_broadcast.",
              file=sys.stderr)


def stale(db: sqlite3.Connection) -> None:
    """Rows carrying a `read_text` with NO `ipa` — i.e. awaiting re-derivation.

    ⚠ The column's contract is "ipa is derived from read_text", and nothing enforced it: the first three hand
    rows sat for a session with read_text saying *fid-disgħa nieqes kwart* while ipa still spelled out
    *tmɪnja u sɪtta u ɛrbɪn*, the digits the reader never said. `--set` now CLEARS ipa so the gap is visible
    as a NULL rather than as a plausible-looking wrong answer, and this lists what is outstanding.

    ⚠ Deliberately NOT "read_text differs from text and ipa is present" — that is 19,511 perfectly good auto
    rows, and a check that cries wolf on the whole corpus is one nobody reads."""
    rows = list(db.execute(
        "SELECT lang, COUNT(*) FROM utt WHERE read_text IS NOT NULL AND ipa IS NULL GROUP BY lang"))
    if not rows:
        print("read_text/ipa: nothing pending re-derivation", file=sys.stderr)
        return
    for lang, n in rows:
        print(f"⚠ {lang}: {n} row(s) have a read_text but no ipa — re-derive before scoring", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    ap.add_argument("--apply", nargs="*", metavar="LANG")
    ap.add_argument("--set", nargs=3, metavar=("LANG", "WAV", "TEXT"))
    ap.add_argument("--stats", action="store_true")
    ap.add_argument("--stale", action="store_true", help="list rows whose ipa may predate their read_text")
    a = ap.parse_args()
    db = sqlite3.connect(a.db)
    ensure(db)
    if a.set:
        lang, wav, text = a.set
        warn_broadcast(db, lang, wav, text)
        n = db.execute("UPDATE utt SET read_text=?, read_text_src='hand', ipa=NULL WHERE lang=? AND wav=?",
                       (text, lang, wav)).rowcount
        db.commit()
        print(f"{n} row(s) set by hand; ipa CLEARED — re-derive it before the row is scored", file=sys.stderr)
    if a.apply is not None:
        apply(db, a.apply)
    if a.stale:
        stale(db)
    if a.stats or a.apply is not None or not (a.set or a.apply is not None):
        stats(db)
    db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
