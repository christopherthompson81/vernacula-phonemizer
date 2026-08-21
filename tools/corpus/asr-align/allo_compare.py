#!/usr/bin/env python3
"""
Read `phones_allo` against `phones`: where do the two recognizers disagree, and does OUR output look
better or worse when judged by the espeak-independent one?

The all-flagged queue ranks languages by median distance between our IPA and wav2vec2's phones. That
ranking has one systematic weakness, and it has produced a wrong conclusion at least once (es_419, run
64): a language scores badly either because WE are wrong or because THE INSTRUMENT is. A second,
differently-labelled recognizer separates those, and the separation is a single number per language:

    ours_vs_w2v   median distance, our IPA against wav2vec2   (what the queue ranks on)
    ours_vs_allo  median distance, our IPA against allosaurus (the same question, other tradition)
    delta         ours_vs_w2v - ours_vs_allo

⚠ **A LARGE POSITIVE DELTA MEANS THE QUEUE WAS RANKING AN ARTEFACT.** We agree with the independent
instrument much better than with the espeak-trained one, so the elevated median is about espeak's
conventions and not about our output. A delta near zero means the disagreement is real and survives a
change of tradition -- that is a genuine lead. A large NEGATIVE delta is its own finding: we agree with
espeak's conventions specifically, which for a language whose rules were written against espeak output
is circularity showing up as a number.

⚠ **WHICH ALLOSAURUS DECODE YOU READ CHANGES THE ANSWER, per language.** `--decodes` reports both.
On `ast_es` the language-restricted decode returns 0.649 phones per wav2vec2 phone -- its 29-phone
PHOIBLE inventory is starving the decode -- and the unrestricted one scores 0.414 against our IPA
where the restricted scores 0.520. On `af_za` the ordering reverses. Read `--decodes` before quoting
a delta for any language, and prefer the decode that wins there.

⚠ **DELTA IS A TRIAGE SIGNAL, NOT A VERDICT**, for three reasons kept in front of the reader by
`--notes`: allosaurus runs at **8 kHz** and is deaf above 4 kHz where sibilant contrasts live; it is
coarser than wav2vec2 in general, so it will agree with a coarser transcription for uninteresting
reasons; and six languages use a different decode (see `phones_allo_lang`).

Usage:
  python3 allo_compare.py                       # the per-language table, worst delta first
  python3 allo_compare.py --langs es_419         # plus the symbol-level disagreement for one language
  python3 allo_compare.py --pairs 25             # how many substitution pairs to show
"""
from __future__ import annotations

import argparse
import os
import sqlite3
import statistics
import sys
from collections import Counter
from difflib import SequenceMatcher

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from asr_align_allo import UNIVERSAL  # noqa: E402
from asr_align_report import fold  # noqa: E402
from wordize import align_path  # noqa: E402

DB = os.environ.get("ASR_ALIGN_ROOT", "/mnt/data/omnivoice_ipa") + "/work/asr_align/align.sqlite"


def per(a: list[str], b: list[str]) -> float:
    if not a and not b:
        return 0.0
    if not a or not b:
        return 1.0
    return 1.0 - SequenceMatcher(None, a, b, autojunk=False).ratio()


# ⚠ `fold` ONLY -- deliberately NOT `coarsen`. COARSEN maps phones onto what WAV2VEC2 writes instead;
# it is that model's inventory, calibrated against that model's zero counts. Applying it here would
# push allosaurus's output through its rival's conventions and destroy the independence that is the
# entire reason for the column. Both comparisons below use the same plain fold, so they are on equal
# footing even though neither is the number the shipped queue reports.
#
# ⚠ It also already handles allosaurus's dental diacritics with no extra work: `s̪` is s + U+032A, a
# combining mark, so `fold` strips it. Run 69 claimed the fold tables "would need to handle" these.
# They do not.
def units(s: str) -> list[str]:
    return fold(s or "")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    ap.add_argument("--langs", nargs="*")
    ap.add_argument("--pairs", type=int, default=20)
    ap.add_argument("--min-rows", type=int, default=50)
    ap.add_argument("--decodes", action="store_true",
                    help="which allosaurus decode fits each language: restricted inventory or the "
                         "full 230-phone set. Neither wins in general -- see the module docstring.")
    ap.add_argument("--uni", action="store_true",
                    help="use phones_allo_uni (the unrestricted decode) as the allosaurus side")
    a = ap.parse_args()

    db = sqlite3.connect(f"file:{a.db}?mode=ro", uri=True)
    langs = a.langs or [r[0] for r in db.execute(
        "SELECT lang FROM utt WHERE phones_allo IS NOT NULL GROUP BY lang ORDER BY lang")]

    if a.decodes:
        print(f"{'lang':<14}{'decode':>7}{'restricted':>12}{'universal':>11}{'better':>12}"
              f"{'r/w2v':>8}{'u/w2v':>8}{'n':>7}")
        print(f"{'-'*14}{'-'*6:>7}{'-'*10:>12}{'-'*9:>11}{'-'*10:>12}"
              f"{'-'*6:>8}{'-'*6:>8}{'-'*5:>7}")
        for lang in langs:
            rs, us, lw, lr, lu, pal = [], [], 0, 0, 0, None
            for ipa, ph, pa, pu, p_l in db.execute(
                    "SELECT ipa, phones, phones_allo, phones_allo_uni, phones_allo_lang FROM utt "
                    "WHERE lang=? AND ipa IS NOT NULL AND phones IS NOT NULL "
                    "AND phones_allo IS NOT NULL AND phones_allo_uni IS NOT NULL", (lang,)):
                u, w, r, n = units(ipa), units(ph), units(pa), units(pu)
                if not u:
                    continue
                rs.append(per(u, r)); us.append(per(u, n))
                lw += len(w); lr += len(r); lu += len(n); pal = p_l
            if len(rs) < a.min_rows:
                continue
            mr, mu = statistics.median(rs), statistics.median(us)
            # ⚠ Identical columns for the six with no inventory; say so rather than declaring a winner.
            win = "same" if pal == UNIVERSAL else ("restricted" if mr < mu else "universal")
            print(f"{lang:<14}{pal:>7}{mr:>12.4f}{mu:>11.4f}{win:>12}"
                  f"{lr / max(lw, 1):>8.3f}{lu / max(lw, 1):>8.3f}{len(rs):>7}")
        return 0

    col = "phones_allo_uni" if a.uni else "phones_allo"
    rows_out = []
    for lang in langs:
        w2v, allo, sub = [], [], Counter()
        n_allo_lang = Counter()
        for ipa, ph, pa, pal in db.execute(
                f"SELECT ipa, phones, {col}, phones_allo_lang FROM utt "
                "WHERE lang=? AND ipa IS NOT NULL AND phones IS NOT NULL "
                f"AND {col} IS NOT NULL", (lang,)):
            u, w, s = units(ipa), units(ph), units(pa)
            if not u:
                continue
            w2v.append(per(u, w))
            allo.append(per(u, s))
            n_allo_lang[pal] += 1
            if a.langs:  # symbol detail is only asked for on an explicit language
                for i, j in align_path(w, s):
                    if i >= 0 and j >= 0 and w[i] != s[j]:
                        sub[(w[i], s[j])] += 1
                    elif i >= 0:
                        sub[(w[i], "-")] += 1
                    elif j >= 0:
                        sub[("-", s[j])] += 1
        if len(w2v) < a.min_rows:
            continue
        mw, ma = statistics.median(w2v), statistics.median(allo)
        rows_out.append((mw - ma, lang, mw, ma, len(w2v), n_allo_lang.most_common(1)[0][0]))
        if a.langs:
            print(f"\n=== {lang}  n={len(w2v)}  decode={n_allo_lang.most_common(1)[0][0]}")
            print(f"    ours vs wav2vec2 {mw:.4f}    ours vs allosaurus {ma:.4f}    delta {mw - ma:+.4f}")
            print(f"    top disagreements, wav2vec2 -> allosaurus  (- is a gap):")
            for (x, y), c in sub.most_common(a.pairs):
                print(f"      {x or '∅':>3} -> {y or '∅':<3} {c:7}")

    if a.langs:
        return 0
    rows_out.sort(reverse=True)
    print(f"{'delta':>8} {'lang':<14} {'ours~w2v':>9} {'ours~allo':>10} {'n':>6}  decode")
    print(f"{'-'*8} {'-'*14} {'-'*9} {'-'*10} {'-'*6}  {'-'*6}")
    for d, lang, mw, ma, n, pal in rows_out:
        flag = "  <- queue may be ranking an espeak artefact" if d >= 0.10 else ""
        print(f"{d:+8.4f} {lang:<14} {mw:9.4f} {ma:10.4f} {n:6}  {pal}{flag}")
    if rows_out:
        ds = [r[0] for r in rows_out]
        print(f"\n{len(ds)} languages, median delta {statistics.median(ds):+.4f}, "
              f"{sum(1 for d in ds if d >= 0.10)} at or above +0.10, "
              f"{sum(1 for d in ds if d <= -0.10)} at or below -0.10")
    return 0


if __name__ == "__main__":
    sys.exit(main())
