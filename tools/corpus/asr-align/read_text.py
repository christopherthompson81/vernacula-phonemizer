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
import re
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
    """⚠ ALWAYS reports rows pending re-derivation, not just under --stale. `--set` clears `ipa`, and every
    scoring query in asr_align_report.py / asr_align_label.py filters `ipa IS NOT NULL` — so a cleared row is
    SILENTLY DROPPED from the QC corpus rather than erroring. Visible-by-default beats a flag nobody runs."""
    (pending,) = db.execute(
        "SELECT COUNT(*) FROM utt WHERE read_text IS NOT NULL AND ipa IS NULL").fetchone()
    if pending:
        print(f"⚠ {pending} row(s) have a read_text but NO ipa — EXCLUDED from scoring until re-derived "
              f"(--stale to list by language)", file=sys.stderr)
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


#: Characters no ORTHOGRAPHY in this corpus uses — suprasegmentals and modifier letters. Deliberately NOT
#: a list of "IPA-looking" letters: ⟨ħ ġ ż ċ⟩ are Maltese, ⟨ɛ ɔ ŋ ɖ ƒ⟩ are Ewe/Akan, ⟨ə⟩ is Azerbaijani and
#: ⟨ʔ⟩ is orthographic in several. A guard built from those refuses the exact Maltese hand-reading the
#: README documents — measured: "preċiżament fid-disgħa nieqes kwart" tripped on ħ, "ɖeviɖu ƒe ŋkɔ" on ŋ ɔ ɖ,
#: "səkkiz yüz əlli" on ə. Stress, length, tie bars, tone letters and superscript modifiers are safe: they
#: carry no orthographic duty anywhere, and every IPA string this fleet emits contains at least one.
IPA_ONLY = "ˈˌːˑ˥˦˧˨˩͜͡ᵐⁿᵑᶮʰʷʲˠ̩̥̬"


def validate_read_text(text: str) -> None:
    """⚠ `read_text` IS A TEXT COLUMN AND THE HOST RE-READS IT. Writing IPA here does not pass through —
    every engine tokenizes it and applies its own grapheme rules, and the result still LOOKS like IPA, so
    the corruption is invisible in a dump. Measured over ten languages with `naɪntiːn fɔːɹti faɪv`:

        ceb  nˈanti n fˈo tˈi fˈab      mi   nˈaɪnti n fˈɔ ɹtˈi fˈaɪv
        hr   nˈanti n fo ti faʋ         en   naɪnti ˈɛn fɔ ɹti fˈaɪv

    Not one passed through. Length marks and `ɹ` are absorbed, and a stray `n` becomes a syllabic nasal in
    the Bantu engines. `numeral_register.mts` records the same result from the other direction (`fˈɔːɹ`
    came back as *f o*) — IPA cannot travel through a channel the host will re-parse.

    ⚠ A LANGUAGE SWITCH HAS ITS OWN NOTATION, and it is not IPA either. Writing the foreign words as plain
    text does not work — `mi` passes `nineteen` through as raw letters into the IPA — so a reader who voiced
    part of the sentence in another language is recorded as a `{code:…}` span, which reaches that language's
    engine as its own segment: `kaniadtong {en:nineteen forty five} ug`. See tools/corpus/code_switch.mts.
    The tag is checked here; the span itself is resolved at re-derivation."""
    for tag in re.findall(r"\{([^:{}]*):", text):
        if not re.fullmatch(r"[a-z][a-z0-9-]{0,15}", tag):
            sys.exit(f"read_text: {{{tag}:...}} is not a code-switch tag — the tag must be a lowercase "
                     f"registry code, e.g. {{en:nineteen forty five}}. See tools/corpus/code_switch.mts.")
    bad = sorted({c for c in text if c in IPA_ONLY})
    if bad:
        sys.exit(f"read_text: refusing to store IPA — found {' '.join(bad)}\n"
                 f"  This column holds TEXT in the host orthography; the engine re-reads it and will\n"
                 f"  mangle IPA silently (see validate_read_text's docstring). To record a reader who\n"
                 f"  switched LANGUAGE, use a code-switch span: {{en:nineteen forty five}}.")


def export_pending(db: sqlite3.Connection, path: str, all_hand: bool = False) -> None:
    """Rows awaiting re-derivation, for rederive_read_text.mts.

    Default is `ipa IS NULL` — the rows `--set` parked.

    ⚠ `all_hand` EXISTS BECAUSE `ipa IS NULL` IS NOT THE ONLY WAY A HAND ROW GOES WRONG. A hand row's IPA
    goes stale exactly as an auto row's does whenever the engine changes, and nothing detects that — the
    contract "ipa is derived from read_text" is unconditional for a hand row, so re-deriving all of them is
    always safe. `--stale` only finds `ipa IS NULL`, which is the subset `--set` parked.

    ⚠ AND DO NOT DIAGNOSE STALENESS BY EYE FROM THE STORED `ipa`. The Maltese rows look wrong and are not:
    `read_text` says `fid-disgħa` while `ipa` says `fɪt dɪsa`, which reads as a hybrid of the original
    `fit-8:46` and the hand reading. It is not — Maltese devoices the assimilated article, and
    `phonemize("fid-disgħa", "mt")` is `fɪt dɪsa`. Re-deriving all five hand rows changed nothing. Run the
    engine before believing a mismatch; the same mistake turned a stale stored `ipa` into a phantom
    Croatian defect in run 54."""
    where = ("read_text_src='hand'" if all_hand
             else "read_text IS NOT NULL AND read_text != '' AND ipa IS NULL")
    rows = db.execute(f"SELECT lang, wav, read_text FROM utt WHERE {where}").fetchall()
    with open(path, "w", encoding="utf-8") as fh:
        for lang, wav, text in rows:
            fh.write(f"{lang}\t{wav}\t{text}\n")
    print(f"{len(rows)} pending row(s) -> {path}", file=sys.stderr)


def import_ipa(db: sqlite3.Connection, path: str, overwrite: bool = False) -> None:
    """Store re-derived IPA.

    ⚠ ONLY WHERE `ipa IS NULL`. A re-derivation must never overwrite a row that already scores — the
    import is the tail of a pipeline whose input was "rows awaiting derivation", and re-running it after
    an unrelated pass must not quietly restate those rows' IPA from a stale export.

    `overwrite` lifts that, and is meant to pair with `--export-hand`: there the input IS every hand row,
    so restating them is the point."""
    n = 0
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            parts = line.rstrip("\n").split("\t")
            if len(parts) < 3:
                continue
            lang, wav, ipa = parts[0], parts[1], parts[2]
            guard = "" if overwrite else " AND ipa IS NULL"
            n += db.execute(f"UPDATE utt SET ipa=? WHERE lang=? AND wav=?{guard}",
                            (ipa, lang, wav)).rowcount
    db.commit()
    print(f"{n} row(s) re-derived into ipa"
          f"{'' if overwrite else ' (rows that already had one were left alone)'}", file=sys.stderr)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    ap.add_argument("--apply", nargs="*", metavar="LANG")
    ap.add_argument("--set", nargs=3, metavar=("LANG", "WAV", "TEXT"))
    ap.add_argument("--stats", action="store_true")
    ap.add_argument("--stale", action="store_true", help="list rows whose ipa may predate their read_text")
    ap.add_argument("--export-pending", metavar="TSV", help="write rows awaiting re-derivation")
    ap.add_argument("--export-hand", metavar="TSV",
                    help="write EVERY hand row, whatever its ipa — a hand row's ipa must come from its "
                         "read_text, and `ipa IS NULL` does not catch one that is merely wrong")
    ap.add_argument("--import-ipa", metavar="TSV", help="store IPA from rederive_read_text.mts")
    ap.add_argument("--overwrite", action="store_true",
                    help="with --import-ipa: replace an existing ipa (pair with --export-hand)")
    a = ap.parse_args()
    db = sqlite3.connect(a.db)
    ensure(db)
    if a.set:
        lang, wav, text = a.set
        validate_read_text(text)
        warn_broadcast(db, lang, wav, text)
        n = db.execute("UPDATE utt SET read_text=?, read_text_src='hand', ipa=NULL WHERE lang=? AND wav=?",
                       (text, lang, wav)).rowcount
        db.commit()
        print(f"{n} row(s) set by hand; ipa CLEARED — the row is now EXCLUDED from scoring "
              f"(every scorer filters `ipa IS NOT NULL`) until it is re-derived", file=sys.stderr)
    if a.apply is not None:
        apply(db, a.apply)
    if a.export_pending:
        export_pending(db, a.export_pending)
    if a.export_hand:
        export_pending(db, a.export_hand, all_hand=True)
    if a.import_ipa:
        import_ipa(db, a.import_ipa, overwrite=a.overwrite)
    if a.stale:
        stale(db)
    if a.stats or a.apply is not None or not (a.set or a.apply is not None):
        stats(db)
    db.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
