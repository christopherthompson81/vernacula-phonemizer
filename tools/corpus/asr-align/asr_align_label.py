#!/usr/bin/env python3
"""
Add and maintain the review columns on the alignment table: `status` and `comment`.

The scoring pass produces a ranking; this produces a RECORD. The difference matters because the ranking
is recomputed every time the scorer changes — and it changed three times already, when modifier letters,
tone digits and recognizer failures each turned out to be scoring artefacts rather than defects. A verdict
written into the row survives that; a position in a sorted file does not.

Status values, and the split they encode:

  verified          the three views agree: input text, our IPA, and the recognized phones. Inside the
                    language's own distribution, so there is nothing here to look at. Set in bulk.
  investigate       in the tail for its language — a real disagreement worth a human read. Set in bulk.
  recognizer_short  the recognizer returned far too little to compare (a whole Welsh sentence came back
                    as the single phone `k`). Says nothing about our IPA. Set in bulk.
  defective_audio   the AUDIO is broken, not the IPA: far too short for its text. 585 Welsh files (17.1%
                    of that corpus) hold ~1.5 s for a sentence needing ~96 phones. Verified against the
                    source tar — the members really are that small there, so it is upstream FLEURS data
                    and not our download. NOT OURS TO FIX; the action is to exclude the pair from training
                    and report it upstream. Set in bulk.
  ---- below here are set by hand, and only ever by hand ----
  defect            our phonemization is wrong. The thing we are hunting.
  reader_divergence the reader did not say what the transcript says (Run 31's finding). Not ours to fix,
                    but it makes the PAIR bad training data, which is its own decision.
  convention        we and the recognizer disagree about notation, not about the reading (ʈ vs t, b vs v).
  artefact          the recognizer is simply wrong here.
  examined_clean    a human READ this row and found no defect. Distinct from `verified`, which is
                    automatic and only means "inside this language's own distribution" — a uniformly
                    wrong language is uniformly `verified` (nso_za sat at 1,989/1,990 verified while
                    holding the worst median in the fleet). `examined_clean` is the only status that
                    means someone looked.

⚠ WITHOUT `examined_clean` THE QUEUE SENDS YOU BACK INTO WORK ALREADY DONE. Run 42 of
docs/investigations/asr_align_qc_investigation.md ranked the all-flagged queue by size and found three of
its top five were already investigated and clean, with the investigation doc itself acting as the mark —
"the queue needs an 'examined, no defect' mark; until it has one, this table is the mark". Run 54 then
re-walked the declined ceb/fil/mi/ig numeral-register decision for the same reason. A prose table in a
3,000-line document is not a mark. This column is.

⚠ AND `--set` VALIDATES AGAINST THIS LIST. A typo used to create a new silent category of one row, which
is indistinguishable from a real verdict in `--stats` and invisible to every query that names the statuses
it cares about. Pass `--force-status` to add a genuinely new one, which should be accompanied by adding it
here.

⚠ A BULK PASS NEVER OVERWRITES A HAND VERDICT. Re-running the scorer must not silently erase review work,
so the automatic statuses are only written where `status` is NULL or is itself automatic.

Usage:
  python3 asr_align_label.py --apply                  # (re)apply the automatic labels
  python3 asr_align_label.py --set defect --lang en_us --id 28 --comment "adjacent numbers merged"
  python3 asr_align_label.py --set examined_clean --lang bn_in --id 42 --comment "run 54: no defect"
  python3 asr_align_label.py --stats
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import statistics
import sys
from collections import Counter

# Corpus root. Defaults to the tree these tools were written against; override with ASR_ALIGN_ROOT
# so the tooling is not a statement about one machine.
ROOT = os.environ.get("ASR_ALIGN_ROOT", "/mnt/data/omnivoice_ipa")
DB = f"{ROOT}/work/asr_align/align.sqlite"
AUTOMATIC = ("verified", "investigate", "recognizer_short", "defective_audio")
#: Hand verdicts. Never written by a bulk pass, never overwritten by one — see the docstring.
BY_HAND = ("defect", "reader_divergence", "convention", "artefact", "examined_clean")
STATUSES = AUTOMATIC + BY_HAND
SILENT_TSV = f"{ROOT}/work/silent_audio.tsv"


def load_silent(path: str = SILENT_TSV) -> dict[str, set[str]]:
    """{lang: {wav basename}} from scan_silent_audio.py — empty if it has not been run."""
    out: dict[str, set[str]] = {}
    if not os.path.exists(path):
        return out
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            p = line.rstrip("\n").split("\t")
            if len(p) >= 2:
                out.setdefault(p[0], set()).add(p[1])
    return out


SILENT = load_silent()


def ensure_columns(db: sqlite3.Connection) -> None:
    cols = {r[1] for r in db.execute("PRAGMA table_info(utt)")}
    if "status" not in cols:
        db.execute("ALTER TABLE utt ADD COLUMN status TEXT")
    if "comment" not in cols:
        db.execute("ALTER TABLE utt ADD COLUMN comment TEXT")
    if "dist" not in cols:
        # Cached so a hand review can sort and filter without recomputing the fold every time.
        db.execute("ALTER TABLE utt ADD COLUMN dist REAL")
    if "sibling" not in cols:
        # The sibling screen (see `sibling_screen`). Kept as its own column rather than folded into
        # `status`, because it is orthogonal to it: it says whether the flag can be BLAMED on our IPA,
        # not how bad the row is.
        db.execute("ALTER TABLE utt ADD COLUMN sibling TEXT")
    db.execute("CREATE INDEX IF NOT EXISTS utt_status ON utt(status)")
    db.execute("CREATE INDEX IF NOT EXISTS utt_sibling ON utt(sibling)")
    db.commit()


def apply_auto(db: sqlite3.Connection) -> None:
    # ⚠ The scorer HAS to be the copy sitting next to this file. The absolute path this used to
    # insert pointed at the repo these tools moved out of (#836), which no longer holds it — the
    # import survived only because the script directory is already on sys.path, and would have
    # silently picked up a stale fold() if that path ever regrew one.
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from asr_align_report import dist, fold

    langs = [r[0] for r in db.execute("SELECT DISTINCT lang FROM utt ORDER BY lang")]
    for lang in langs:
        rows = list(db.execute(
            "SELECT lang,wav,ipa,phones FROM utt WHERE lang=? AND ipa IS NOT NULL AND phones IS NOT NULL",
            (lang,)))
        scored, short = [], []
        for lg, wav, ipa, ph in rows:
            fi, fp = fold(ipa or ""), fold(ph or "")
            if not fp or (len(fi) >= 12 and len(fp) < 0.35 * len(fi)):
                short.append((lg, wav))
                continue
            scored.append((lg, wav, dist(fi, fp)))
        if len(scored) < 20:
            continue
        ds = [s[2] for s in scored]
        med = statistics.median(ds)
        mad = statistics.median([abs(d - med) for d in ds]) or 1e-9
        for lg, wav, d in scored:
            z = 0.6745 * (d - med) / mad
            st = "investigate" if z > 3.0 else "verified"
            # ⚠ Never clobber a hand verdict.
            db.execute(
                "UPDATE utt SET status=?, dist=? WHERE lang=? AND wav=? "
                "AND (status IS NULL OR status IN ('verified','investigate','recognizer_short'))",
                (st, d, lg, wav))
        for lg, wav in short:
            db.execute(
                "UPDATE utt SET status='recognizer_short' WHERE lang=? AND wav=? "
                "AND (status IS NULL OR status IN " + str(AUTOMATIC) + ")",
                (lg, wav))

        # ⚠ DEFECTIVE AUDIO LAST, so it wins over the scoring labels — a pair whose audio is broken should
        # not sit in the investigate queue as though its IPA were the problem. Judged in seconds-per-phone
        # against THIS language's own median, so a fast-speaking language is not penalised, and at a third
        # of it, which is far outside any speaking-rate variation.
        # ⚠ FOLDED PHONE COUNT, not LENGTH(ipa). SQL's LENGTH counts characters — diacritics, spaces and
        # stress marks included — which is a different scale per language and made this disagree with the
        # analysis that found the defect (608 rows vs 611). The rate has to be seconds per PHONE.
        rate = [(w, (ns / 16000) / len(fold(ipa))) for w, ipa, ns in db.execute(
            "SELECT wav,ipa,n_samples FROM utt WHERE lang=? AND ipa IS NOT NULL AND n_samples>0",
            (lang,)) if ipa and len(fold(ipa)) >= 12]
        if rate:
            med_r = statistics.median(r for _, r in rate)
            for w, r in rate:
                if r < med_r / 3:
                    db.execute(
                        "UPDATE utt SET status='defective_audio', comment=COALESCE(NULLIF(comment,''),?) "
                        "WHERE lang=? AND wav=? AND status IN " + str(AUTOMATIC),
                        ("audio far too short for its text; upstream FLEURS data, not our download",
                         lang, w))

        # ⚠ SILENT AUDIO IS A SECOND, INDEPENDENT DEFECT AND THE RATE TEST ABOVE CANNOT SEE IT. The Welsh
        # files are TRUNCATED, so they fail on seconds-per-phone. The 490 Spanish ones are FULL LENGTH AND
        # EMPTY — a perfectly normal duration containing nothing — so their rate is unremarkable and they
        # score `recognizer_short` instead. Measured from the waveform by scan_silent_audio.py.
        #
        # ⚠ AND IT HAS TO LIVE HERE, not in a one-off UPDATE. `defective_audio` is in AUTOMATIC, so the
        # label was applied by hand once and then silently REVERTED the next time this pass ran — the
        # comment survived, the status did not. A verdict inside an automatic category is only durable if
        # the automatic pass can reproduce it.
        for w in SILENT.get(lang, ()):  # noqa: B007 — set of wav basenames
            db.execute(
                "UPDATE utt SET status='defective_audio', comment=COALESCE(NULLIF(comment,''),?) "
                "WHERE lang=? AND wav=? AND status IN " + str(AUTOMATIC),
                ("silent audio (rms < 1e-4 at full duration); upstream FLEURS data", lang, w))
        db.commit()
        print(f"  {lang}: {len(scored)} scored, {len(short)} short", file=sys.stderr)


def sibling_screen(db: sqlite3.Connection) -> None:
    """Mark every `investigate` row that a SIBLING RECORDING of the same sentence exonerates.

    FLEURS records the same sentence more than once, with different readers. Our IPA for a sentence is a
    pure function of its text, so those recordings are scored against a BYTE-IDENTICAL string. If one of
    them lands in `verified` and another in `investigate`, the difference cannot be the IPA — it is the
    audio, the reader, or the recognizer. That is a construction, not an inference, and it is the only
    part of this harness that can say "not ours" with certainty.

    ⚠ IT REMOVES 77% OF THE QUEUE. 6,442 of 8,367 flagged rows have a verified same-text sibling. Two
    recordings of one sentence, one identical IPA, differ by up to 0.73 — larger than most of the signal
    the queue was carrying. Reading the queue without this screen is mostly reading reader variation.

    ⚠ AND IT IS WHY THE PER-LANGUAGE TOTALS WERE MISLEADING. bn_in led the queue at 12.7% of its split;
    379 of its 382 flagged rows are one gender, against 0.33% for the other. hu_hu is the proof: its
    female median distance is BETTER than its male (0.303 vs 0.342) and yet female rows supply 293 of
    its 313 flags. A phonemizer does not know who read the sentence.

    Three values, and the middle one is the worklist:
      exonerated   a same-text sibling scored `verified` — our IPA is demonstrably not the cause
      all-flagged  every recording of this sentence is flagged — the strongest signal in the corpus
      no-sibling   the sentence was recorded once; the screen has nothing to say
    """
    # ⚠ CLEAR THE WHOLE COLUMN FIRST, then write. A verdict is only meaningful if THIS pass derived it, and
    # every "clear what is no longer flagged" formulation leaks: `status <> 'investigate'` is NULL (not
    # true) for a row at status NULL — the rows the README warns about, "invisible to any exclusion gate" —
    # and a row still flagged but whose `dist` was cleared never enters the loop below at all, so nothing
    # re-derives its verdict and nothing removes it either. Blanking first cannot miss either case.
    db.execute("UPDATE utt SET sibling=NULL WHERE sibling IS NOT NULL")

    groups: dict[tuple[str, str], list[tuple[str, str, str]]] = {}
    for lang, sid, wav, st, ipa in db.execute(
            "SELECT lang,sentence_id,wav,status,ipa FROM utt WHERE dist IS NOT NULL"):
        groups.setdefault((lang, sid), []).append((wav, st, ipa or ""))
    tally: Counter = Counter()
    for (lang, _sid), v in groups.items():
        flagged = [x for x in v if x[1] == "investigate"]
        if not flagged:
            continue
        # ⚠ ONLY A COMPARABLY SCORED SIBLING IS EVIDENCE, and `all-flagged` must not be the mere ELSE of
        # "no sibling is verified". `recognizer_short` and `defective_audio` mean the comparison did not
        # happen — the recognizer returned almost nothing, or the audio is broken — so such a row says
        # NOTHING about our IPA in either direction. Counting it as agreement promotes a sentence with one
        # flagged recording and one silent one into `all-flagged`, which the README sends a reviewer to
        # read FIRST as the strongest signal in the corpus. Hand verdicts are excluded for the same reason:
        # a human already ruled on those and the automatic screen should not re-interpret them.
        comparable = [x for x in v if x[1] in ("verified", "investigate")]
        # ⚠ CONFIRM THE IPA REALLY IS IDENTICAL before trusting the sibling. The whole argument rests on
        # it, and a re-phonemization landing mid-round would quietly break it without changing a count.
        if len(comparable) < 2 or len({x[2] for x in comparable}) != 1:
            mark = "no-sibling"
        elif any(y[1] == "verified" for y in comparable):
            mark = "exonerated"
        else:
            mark = "all-flagged"
        tally[mark] += len(flagged)
        for wav, _st, _ipa in flagged:
            db.execute("UPDATE utt SET sibling=? WHERE lang=? AND wav=?", (mark, lang, wav))
    db.commit()
    total = sum(tally.values())
    print(f"  sibling screen: {total} flagged — "
          f"exonerated {tally['exonerated']}, all-flagged {tally['all-flagged']}, "
          f"no-sibling {tally['no-sibling']}", file=sys.stderr)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    ap.add_argument("--apply", action="store_true", help="(re)apply the automatic labels")
    ap.add_argument("--stats", action="store_true")
    ap.add_argument("--set")
    ap.add_argument("--lang")
    ap.add_argument("--id", help="sentence_id")
    ap.add_argument("--wav")
    ap.add_argument("--sibling", choices=("all-flagged", "exonerated", "no-sibling"),
                    help="with --set and --lang: mark every row of that sibling class (bulk review verdict)")
    ap.add_argument("--digits", action="store_true",
                    help="with --sibling: restrict to rows whose TEXT contains a digit (the numeral-register "
                         "queues are digit-bearing by construction, so a verdict about them must say so)")
    ap.add_argument("--comment", default="")
    ap.add_argument("--force-status", action="store_true",
                    help="allow a --set value outside STATUSES (add it to the docstring too)")
    a = ap.parse_args()

    db = sqlite3.connect(a.db)
    ensure_columns(db)

    if a.apply:
        apply_auto(db)
        # ⚠ AFTER apply_auto, never before: the screen reads `status`, so running it first would
        #   screen last round's labels and read as a clean result. Same ordering hazard as the
        #   silent-audio sweep, one stage further along.
        sibling_screen(db)
    if a.set:
        if not a.lang or not (a.id or a.wav or a.sibling):
            sys.exit("--set needs --lang and (--id or --wav or --sibling)")
        if a.set not in STATUSES and not a.force_status:
            sys.exit(f"--set {a.set!r} is not a known status. Known: {', '.join(sorted(STATUSES))}. "
                     f"Use --force-status to add a new one (and document it in the module docstring).")
        if a.sibling:
            where, args = ("sibling=?", [a.sibling])
            if a.digits:
                where += " AND text GLOB '*[0-9]*'"
        else:
            where, args = ("sentence_id=?", [a.id]) if a.id else ("wav=?", [a.wav])
        n = db.execute(f"UPDATE utt SET status=?, comment=? WHERE lang=? AND {where}",
                       [a.set, a.comment, a.lang, *args]).rowcount
        db.commit()
        print(f"{n} row(s) set to {a.set}", file=sys.stderr)
    if a.stats or a.apply:
        print("\nstatus                 rows", file=sys.stderr)
        for st, n in db.execute(
                "SELECT COALESCE(status,'(unlabelled)'), COUNT(*) FROM utt GROUP BY 1 ORDER BY 2 DESC"):
            print(f"  {st:<20} {n}", file=sys.stderr)
    db.close()


if __name__ == "__main__":
    main()
