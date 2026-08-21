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


# ⚠ WITHOUT THIS THE "corroborated" QUEUE IS A NOTATION QUEUE. Measured: of 538 corroborated findings
# under the universal decode, the residual after removing inventory artefacts and connected-speech
# schwa was still 392, and it was dominated by ONE THING -- both recognizers writing `ɾ` where we write
# `r` (10 languages) and `ɪ` where we write `i` (10 languages). Two recognizers agreeing against us is
# only evidence if they are not simply agreeing on a TRANSCRIPTION CONVENTION we did not adopt, and
# these are the axes where both traditions happen to be narrower than ours.
#
# ⚠ APPLIED TO ALL THREE STREAMS, symmetrically, exactly as COARSEN is applied to both sides. Folding
# only the recognizers would manufacture agreement rather than reveal it.
# ⚠ THIS DELETES REAL AXES, and that is the point of it being explicit rather than implicit: after
# folding, this tool CANNOT see an r/ɾ or i/ɪ error. That is the trade for being able to see anything
# else. Anything on a folded axis has to be measured with a purpose-built probe, not with this.
NOTATION = {
    "ɾ": "r", "ɹ": "r", "ʀ": "r", "ʁ": "r",       # rhotic realisation
    "ɪ": "i", "ʊ": "u",                            # lax high vowels
    "ɛ": "e", "ɔ": "o",                            # mid-vowel height
    "ɐ": "a", "ʌ": "a", "ɑ": "a",                  # low-vowel backness (see low_vowel_notation_investigation)
}


def notate(us: list[str]) -> list[str]:
    return [NOTATION.get(u, u) for u in us]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    ap.add_argument("--langs", nargs="*")
    ap.add_argument("--pairs", type=int, default=20)
    ap.add_argument("--min-rows", type=int, default=50)
    ap.add_argument("--decodes", action="store_true",
                    help="which allosaurus decode fits each language: restricted inventory or the "
                         "full 230-phone set. Neither wins in general -- see the module docstring.")
    ap.add_argument("--flagged", action="store_true",
                    help="re-rank the all-flagged queue by whether ANY recognizer supports us")
    ap.add_argument("--min-flagged", type=int, default=5,
                    help="minimum rows in the sibling class before a language is ranked")
    ap.add_argument("--sibling", default="all-flagged",
                    help="which sibling class --flagged reads (default all-flagged)")
    ap.add_argument("--symbols", action="store_true",
                    help="the three-way per-symbol verdict: which stream is the odd one out")
    ap.add_argument("--raw-notation", action="store_true",
                    help="do NOT fold the shared notation axes (r/ɾ, i/ɪ, e/ɛ, a/ɑ ...) -- shows what "
                         "the folding is hiding, which is most of the corroborated list")
    ap.add_argument("--rate", type=float, default=2.0,
                    help="minimum rate per 1000 units for a symbol to be considered (default 2.0)")
    ap.add_argument("--uni", action="store_true",
                    help="use phones_allo_uni (the unrestricted decode) as the allosaurus side")
    a = ap.parse_args()

    db = sqlite3.connect(f"file:{a.db}?mode=ro", uri=True)
    langs = a.langs or [r[0] for r in db.execute(
        "SELECT lang FROM utt WHERE phones_allo IS NOT NULL GROUP BY lang ORDER BY lang")]

    # The all-flagged class is the strongest signal in the corpus -- every recording of the sentence is
    # flagged, so a reader-specific slip is ruled out. What it could never rule out with one recognizer
    # is the INSTRUMENT: es_419's θ was flagged on every recording too, and was espeak's all along.
    #
    # ⚠ THE TEST IS `worst`, THE MEDIAN OF min(w2v, allosaurus-restricted, allosaurus-universal). A row
    # is a real defect only if NO independent reading of the audio, under any decode, agrees with us.
    # Taking the minimum is deliberately CHARITABLE to our output: it lets each row be exonerated by
    # whichever instrument reads it best, so what survives is what nothing supports.
    #
    # ⚠ `rescued` counts rows where wav2vec2 disagrees by >=0.20 more than allosaurus does. Those are
    # the es_419 shape -- the queue is ranking the instrument, not us -- and they should come off the
    # list rather than be investigated.
    if a.flagged:
        # ⚠ RANKING ON THE RAW FIGURE JUST RE-FINDS HARD LANGUAGES. all-flagged rows are the worst rows
        # by construction, so every language reads "nothing supports us" on an absolute threshold. The
        # question is self-relative, as the 3xMAD screen already is elsewhere: is this language's
        # flagged set worse THAN ITS OWN typical row? That excess is what points at a specific defect.
        out = []
        for lang in langs:
            base, flag, dw, resc = [], [], [], 0
            for sib, ipa, ph, pa, pu in db.execute(
                    "SELECT sibling, ipa, phones, phones_allo, phones_allo_uni FROM utt "
                    "WHERE lang=? AND ipa IS NOT NULL AND phones IS NOT NULL "
                    "AND phones_allo IS NOT NULL", (lang,)):
                u = units(ipa)
                if not u:
                    continue
                w = per(u, units(ph))
                worst = min(w, per(u, units(pa)), per(u, units(pu or pa)))
                if sib == a.sibling:
                    flag.append(worst); dw.append(w)
                    if w - min(per(u, units(pa)), per(u, units(pu or pa))) >= 0.20:
                        resc += 1
                else:
                    base.append(worst)
            if len(flag) < a.min_flagged or not base:
                continue
            mf, mb = statistics.median(flag), statistics.median(base)
            out.append((mf - mb, lang, mf, mb, statistics.median(dw), resc, len(flag)))
        out.sort(reverse=True)
        print(f"{'excess':>7} {'lang':<14}{'flagged':>8}{'baseline':>9}{'ours~w2v':>9}"
              f"{'rescued':>8}{'n':>4}   verdict")
        print(f"{'-'*7} {'-'*14}{'-'*7:>8}{'-'*8:>9}{'-'*8:>9}{'-'*7:>8}{'-'*3:>4}   {'-'*7}")
        for ex, lang, mf, mb, mw, resc, n in out:
            note = ("flagged set is far worse than its own baseline" if ex >= 0.20 else
                    "elevated" if ex >= 0.10 else
                    "flagged rows look like ordinary rows here")
            print(f"{ex:+7.4f} {lang:<14}{mf:8.4f}{mb:9.4f}{mw:9.4f}{resc:8}{n:4}   {note}")
        print(f"\n{len(out)} languages with >={a.min_flagged} {a.sibling} rows, "
              f"{sum(r[6] for r in out)} rows, "
              f"{sum(r[5] for r in out)} rescued by allosaurus (>=0.20 closer than wav2vec2), "
              f"{sum(1 for r in out if r[0] >= 0.20)} languages at or above +0.20 excess")
        return 0

    # ⚠ THE AGGREGATE DELTA CANNOT SEE A SYMBOL-LEVEL ARTEFACT, measured: on the full fleet every one
    # of the 102 languages came out NEGATIVE (median -0.176, none above +0.10) and `es_419` -- the one
    # case whose answer is known -- ranked 32nd, indistinguishable from the fleet. The θ artefact is
    # ~28 phones in a ~107-phone utterance, and the baseline quality gap between the two recognizers
    # swamps it. Aggregate distance measures WHICH RECOGNIZER IS BETTER, not where either is biased.
    #
    # This mode asks the question that does separate them: per symbol, which of the three streams is
    # the odd one out. It recovers es_419's θ at rank 2 (w2v 4,206 / allosaurus 7 / ours 0).
    if a.symbols:
        print(f"{'lang':<14}{'sym':>4}{'verdict':>14}{'ours/1k':>9}{'w2v/1k':>8}{'allo/1k':>9}   reading")
        print(f"{'-'*14}{'-'*4:>4}{'-'*13:>14}{'-'*8:>9}{'-'*7:>8}{'-'*8:>9}   {'-'*7}")
        # ⚠ USE `--uni` FOR ANY CORROBORATED FINDING YOU INTEND TO ACT ON. The restricted decode cannot
        # corroborate a symbol its inventory does not contain, and that is not a rare edge: allosaurus's
        # Azerbaijani and Estonian inventories contain no `a` at all, so it MUST write `ɑ` there, and its
        # Armenian, Swahili, Urdu and Spanish inventories contain no `ɑ`, so it MUST write `a`. Read
        # naively, that produced "both recognizers hear `a` and we do not" for Armenian -- which is a
        # statement about PHOIBLE's inventory file, not about the audio.
        acol = "phones_allo_uni" if a.uni else "phones_allo"
        norm = (lambda x: x) if a.raw_notation else notate
        tally = Counter()
        for lang in langs:
            O, W, A = Counter(), Counter(), Counter()
            for ipa, ph, pa in db.execute(
                    f"SELECT ipa, phones, {acol} FROM utt WHERE lang=? AND ipa IS NOT NULL "
                    f"AND phones IS NOT NULL AND {acol} IS NOT NULL", (lang,)):
                O.update(norm(units(ipa))); W.update(norm(units(ph)))
                A.update(norm(units(pa)))
            to, tw, ta = sum(O.values()), sum(W.values()), sum(A.values())
            if min(to, tw, ta) < 1000:
                continue
            for sym in set(O) | set(W) | set(A):
                ro, rw, ra = 1000 * O[sym] / to, 1000 * W[sym] / tw, 1000 * A[sym] / ta
                hi = max(ro, rw, ra)
                if hi < a.rate:
                    continue
                lo = 0.10 * hi
                # ⚠ The two recognizers AGREEING against us is the only one of these four that is a
                # lead about OUR output, and it is the one a single recognizer cannot produce.
                if ro < lo <= min(rw, ra) and min(rw, ra) >= a.rate:
                    v, why = "corroborated", "both hear it, we do not"
                elif rw >= a.rate and ra < lo and ro < lo:
                    v, why = "w2v-alone", "espeak artefact; we are penalised for it"
                elif ra >= a.rate and rw < lo and ro < lo:
                    v, why = "allo-alone", "allosaurus artefact"
                elif ro >= a.rate and rw < lo and ra < lo:
                    v, why = "ours-alone", "neither can write it (COARSEN territory)"
                else:
                    continue
                tally[v] += 1
                print(f"{lang:<14}{sym:>4}{v:>14}{ro:9.1f}{rw:8.1f}{ra:9.1f}   {why}")
        print(f"\n{sum(tally.values())} findings: " +
              ", ".join(f"{v} {n}" for v, n in tally.most_common()))
        return 0

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
