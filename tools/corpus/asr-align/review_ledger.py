#!/usr/bin/env python3
"""
THE REVIEW LEDGER — the human verdicts, versioned in the repo instead of only in `align.sqlite`.

⚠ WHY THIS EXISTS. Everything else in this directory can be REBUILT: `phonemize-fleurs.mts` re-derives the
IPA, `asr_align_corpus.py` re-runs the recognizer, `asr_align_label.py --apply` re-labels in bulk. Two
things cannot, because they are somebody's judgement rather than a computation:

  · a HAND `status` — `defect`, `reader_divergence`, `convention`, `artefact`, `examined_clean`
  · a HAND `read_text` — what the reader actually said, including `{code:…}` code-switch spans

`asr_align_corpus.py` writes rows with `INSERT OR REPLACE INTO utt(...)`, which replaces the WHOLE row. A
re-ingest therefore erases every verdict and every hand reading in the database, and nothing outside it
remembers them. The investigation doc records the reasoning; it cannot restore the data.

⚠ AND THE COST IS ALREADY PROVEN. Run 42 found three of the all-flagged queue's top five had been read and
found clean, with a prose table as the only mark — and run 54 then re-walked a decision that had been
measured, documented and declined. That is the failure with the DB intact. A rebuild would lose the
verdicts too, and the queue would send someone through all of it a third time.

Usage:
  python3 review_ledger.py --export            # DB  -> review/hand_review.tsv   (commit the diff)
  python3 review_ledger.py --import            # TSV -> DB                       (after a rebuild)
  python3 review_ledger.py --check             # report drift without writing either side

⚠ `--import` NEVER TOUCHES `ipa`. A restored `read_text` leaves `ipa` as the rebuild derived it, which is
the auto reading, not the hand one — so re-derive afterwards, exactly as `--set` requires:

    python3 read_text.py --export-hand /tmp/h.tsv
    npx tsx rederive_read_text.mts /tmp/h.tsv /tmp/ipa.tsv
    python3 read_text.py --import-ipa /tmp/ipa.tsv --overwrite
"""
from __future__ import annotations

import argparse
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.environ.get("ASR_ALIGN_ROOT", "/mnt/data/omnivoice_ipa") + "/work/asr_align/align.sqlite"
LEDGER = os.path.join(HERE, "review", "hand_review.tsv")
import sqlite3  # noqa: E402

#: Statuses a bulk pass never writes — see asr_align_label.py. Only these are carried.
BY_HAND = ("defect", "reader_divergence", "convention", "artefact", "examined_clean")

COLS = ("lang", "wav", "sentence_id", "status", "comment", "read_text", "read_text_src", "text")


def clean(v: object) -> str:
    """⚠ TSV IS NOT CSV — there is no quoting here, so a tab or newline inside a comment would silently
    shift every later column. Collapse them; none of these fields is whitespace-significant."""
    return " ".join(str(v or "").split())


def rows_from_db(db: sqlite3.Connection) -> list[tuple[str, ...]]:
    q = ("SELECT lang, wav, sentence_id, status, comment, read_text, read_text_src, text FROM utt "
         f"WHERE read_text_src='hand' OR status IN ({','.join('?' * len(BY_HAND))}) "
         "ORDER BY lang, wav")
    out = []
    for r in db.execute(q, BY_HAND):
        lang, wav, sid, status, comment, rt, rts, text = r
        # A row can qualify on read_text alone; its status may be an AUTOMATIC one, which must not be
        # carried — a rebuild recomputes those, and restoring a stale one would fight `--apply`.
        out.append((lang, wav, sid, status if status in BY_HAND else "",
                    clean(comment), clean(rt) if rts == "hand" else "",
                    rts if rts == "hand" else "", clean(text)))
    return out


def export(db: sqlite3.Connection, path: str) -> None:
    rows = rows_from_db(db)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write("# Hand review verdicts and readings — see review_ledger.py. Sorted by (lang, wav).\n")
        fh.write("# `text` is CONTEXT so the diff is reviewable; --import verifies it and never writes it.\n")
        fh.write("\t".join(COLS) + "\n")
        for r in rows:
            fh.write("\t".join(r) + "\n")
    print(f"{len(rows)} row(s) -> {path}", file=sys.stderr)


def read_ledger(path: str) -> list[dict[str, str]]:
    out = []
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            if line.startswith("#") or not line.strip():
                continue
            parts = line.rstrip("\n").split("\t")
            if parts[0] == "lang":
                continue
            parts += [""] * (len(COLS) - len(parts))
            out.append(dict(zip(COLS, parts)))
    return out


def apply_ledger(db: sqlite3.Connection, path: str, dry: bool = False) -> int:
    n = miss = drift = 0
    for r in read_ledger(path):
        got = db.execute("SELECT text FROM utt WHERE lang=? AND wav=?", (r["lang"], r["wav"])).fetchone()
        if got is None:
            miss += 1
            print(f"⚠ not in DB: {r['lang']} {r['wav']}", file=sys.stderr)
            continue
        if r["text"] and clean(got[0]) != r["text"]:
            drift += 1
            print(f"⚠ TEXT DRIFT, verdict still applied: {r['lang']} {r['wav']}", file=sys.stderr)
        if dry:
            continue
        sets, args = [], []
        if r["status"]:
            sets += ["status=?", "comment=?"]
            args += [r["status"], r["comment"]]
        if r["read_text_src"] == "hand":
            sets += ["read_text=?", "read_text_src='hand'"]
            args += [r["read_text"]]
        if sets:
            n += db.execute(f"UPDATE utt SET {','.join(sets)} WHERE lang=? AND wav=?",
                            [*args, r["lang"], r["wav"]]).rowcount
    if not dry:
        db.commit()
    print(f"{'would restore' if dry else 'restored'} {n} row(s); {miss} missing, {drift} with text drift",
          file=sys.stderr)
    return miss


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    ap.add_argument("--ledger", default=LEDGER)
    ap.add_argument("--export", action="store_true")
    ap.add_argument("--import", dest="do_import", action="store_true")
    ap.add_argument("--check", action="store_true", help="report drift without writing either side")
    a = ap.parse_args()
    if not (a.export or a.do_import or a.check):
        ap.error("one of --export / --import / --check")
    db = sqlite3.connect(a.db)
    if a.export:
        export(db, a.ledger)
    if a.do_import or a.check:
        apply_ledger(db, a.ledger, dry=a.check)
    db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
