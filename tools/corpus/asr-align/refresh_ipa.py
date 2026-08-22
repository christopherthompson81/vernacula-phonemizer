#!/usr/bin/env python3
"""
Refresh the `ipa` column from the current phonemizer output, WITHOUT touching anything else.

The alignment DB's `ipa` is a SNAPSHOT of the engine at ingest time, and every engine fix this campaign
landed makes it stale — ckb's free conjunction, English years, nso/sw vowels, the Croatian and Shona
code-switch work, the initialism and abbreviation tables. Stale IPA is invisible: the column looks
populated and every downstream consumer reads it happily.

⚠ THE OBVIOUS WAY TO REFRESH IT DESTROYS THE CAMPAIGN. `asr_align_corpus.py` writes rows with
`INSERT OR REPLACE INTO utt(...)`, which replaces the WHOLE row — status, comment, read_text,
read_text_src, sibling, judge verdicts, all of it. That is precisely what `review_ledger.py` exists to
survive. This does an UPDATE of one column and nothing else.

⚠ AND IT MUST NOT TOUCH A HAND `read_text` ROW. Those rows' IPA is derived from what the reader actually
SAID, not from the transcript — an English numeral inside a Hausa sentence, the Bengali year form. The
per-sentence phonemizer output would overwrite it with the script's reading and silently undo the
correction. Refresh those with `read_text.py --export-pending` → `rederive_read_text.mts` →
`read_text.py --import-ipa`, which is what this script tells you to do at the end.

  python3 refresh_ipa.py --check          # report staleness, write nothing
  python3 refresh_ipa.py                  # update `ipa` for non-hand rows
  python3 refresh_ipa.py --langs ckb_iq
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import sys

ROOT = os.environ.get("ASR_ALIGN_ROOT", "/mnt/data/omnivoice_ipa")
DB = f"{ROOT}/work/asr_align/align.sqlite"
BYID = f"{ROOT}/work/phonemized_vernacula/byid"


def byid(lang: str) -> dict[str, str]:
    """{sentence_id: ipa} — the phonemizer's current output for this language."""
    path = f"{BYID}/{lang}.tsv"
    out: dict[str, str] = {}
    if not os.path.exists(path):
        return out
    with open(path, encoding="utf8") as f:
        for line in f:
            k, _, v = line.rstrip("\n").partition("\t")
            if v.strip():
                out.setdefault(k, v)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    ap.add_argument("--langs", nargs="*")
    ap.add_argument("--check", action="store_true", help="report only, write nothing")
    a = ap.parse_args()

    db = sqlite3.connect(a.db)
    langs = a.langs or [r[0] for r in db.execute("SELECT DISTINCT lang FROM utt ORDER BY lang")]
    tot_stale = tot_rows = tot_hand = tot_missing = 0
    changed_langs = []
    for lang in langs:
        m = byid(lang)
        if not m:
            print(f"{lang}: no byid file — skipped", file=sys.stderr)
            continue
        stale = hand = missing = n = 0
        upd = []
        for wav, sid, ipa, src in db.execute(
                "SELECT wav, sentence_id, ipa, COALESCE(read_text_src,'') FROM utt WHERE lang=?",
                (lang,)):
            n += 1
            if src == "hand":
                hand += 1          # ⚠ never overwritten from the transcript — see the module note
                continue
            # ⚠ THIS GUARD IS ON THE VALUE, NOT ON PRESENCE, and that holds only while `hand` is the one
            # source whose read_text differs from the transcript. Issue #871 would add ~191k rows sourced
            # from the FLEURS raw column; those carry restored case and punctuation the transcript does
            # NOT have, so a value-keyed guard would sail past them and quietly re-derive their ipa from
            # the case-folded text — leaving a populated read_text beside ipa that no longer matches it.
            # ⚠ WIDEN THIS TO "any non-empty read_text" BEFORE ADDING A NEW read_text_src.
            new = m.get(sid)
            if new is None:
                missing += 1
                continue
            if new != ipa:
                stale += 1
                upd.append((new, lang, wav))
        if upd and not a.check:
            db.executemany("UPDATE utt SET ipa=? WHERE lang=? AND wav=?", upd)
            db.commit()
        tot_stale += stale; tot_rows += n; tot_hand += hand; tot_missing += missing
        if stale or missing:
            changed_langs.append(lang)
            print(f"{lang:<14}{stale:6} stale / {n:6}"
                  + (f"   {hand} hand (kept)" if hand else "")
                  + (f"   ⚠ {missing} sentence_id not in byid" if missing else ""))
    verb = "would update" if a.check else "updated"
    print(f"\n{verb} {tot_stale} rows across {len(changed_langs)} languages "
          f"({tot_rows} seen, {tot_hand} hand read_text left alone"
          + (f", {tot_missing} missing from byid" if tot_missing else "") + ")")
    if tot_hand and not a.check:
        print("\n⚠ The hand read_text rows were NOT refreshed here — their IPA comes from what the\n"
              "  reader said, not the transcript. Refresh them with:\n"
              "    python3 read_text.py --export-pending /tmp/p.tsv\n"
              "    npx tsx rederive_read_text.mts /tmp/p.tsv /tmp/d.tsv\n"
              "    python3 read_text.py --import-ipa /tmp/d.tsv --overwrite", file=sys.stderr)
    db.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
