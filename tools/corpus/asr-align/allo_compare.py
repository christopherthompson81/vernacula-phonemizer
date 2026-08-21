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

⚠⚠ **CORROBORATION IS STRONG FOR "IS THERE A SEGMENT HERE", WEAK FOR "WHICH CATEGORY IS IT".** Two
recognizers agreeing against us is not two witnesses when both are mapping an unfamiliar category into
a familiar one. Neither has a voiceless-unaspirated-vs-aspirated system; both have voiced-vs-voiceless.
On Mongolian's weak labial they made the same reduction for the same reason and agreed at 7.0:1 that
⟨б⟩ is [b] — and Svantesson's Khalkha grammar transcribes every ⟨б⟩ as [p], with our table already
encoding the exact labial/dental/velar asymmetry he documents. See run 74. Before acting on a
corroborated finding, ask whether the disputed symbol sits on a category axis the RECOGNIZERS share and
the LANGUAGE does not — voicing, aspiration, vowel height, length. If so the agreement is worth nothing
alone. An inventory is a claim, and both models were trained on one.

⚠ **DELTA IS A TRIAGE SIGNAL, NOT A VERDICT**, for three reasons: allosaurus runs at **8 kHz** and is deaf above 4 kHz where sibilant contrasts live; it is
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
from asr_align_report import COARSEN, fold  # noqa: E402
from wordize import align_path  # noqa: E402

DB = os.environ.get("ASR_ALIGN_ROOT", "/mnt/data/omnivoice_ipa") + "/work/asr_align/align.sqlite"


def per(a: list[str], b: list[str]) -> float:
    if not a and not b:
        return 0.0
    if not a or not b:
        return 1.0
    return 1.0 - SequenceMatcher(None, a, b, autojunk=False).ratio()


# ⚠ NOT the whole of `coarsen`: that table is calibrated against WAV2VEC2's zero counts, and pushing
# allosaurus through its rival's inventory would destroy the independence the column exists for. The
# split below keeps only the entries BOTH recognizers are blind to.
#
# ⚠ It also already handles allosaurus's dental diacritics with no extra work: `s̪` is s + U+032A, a
# combining mark, so `fold` strips it. Run 69 claimed the fold tables "would need to handle" these.
# They do not.
# ⚠ COARSEN IS WAV2VEC2'S BLINDNESS, AND ALLOSAURUS IS NOT BLIND TO A THIRD OF IT. Measured over all
# 270,106 rows: of COARSEN's 27 entries, allosaurus returns nine of them in quantity where wav2vec2
# returns exactly zero —
#
#     ʋ  ours 173,823   w2v 0   allo  11,570        ɳ  ours 38,899   w2v 0   allo  92,254
#     ɒ  ours  52,582   w2v 0   allo 221,525        ɴ  ours 32,163   w2v 0   allo  55,426
#     ʂ  ours  47,921   w2v 0   allo 101,230        ʝ  ours  6,699   w2v 0   allo   9,763
#     ɖ  ours  45,592   w2v 0   allo  14,222        ɻ  ours  5,670   w2v 0   allo   6,963
#     ʄ  ours   3,962   w2v 0   allo   1,024
#
# ~403k tokens the shipped metric folds away as unjudgeable BECAUSE ONE MODEL COULD NOT WRITE THEM. The
# second recognizer restores measurement on them, and folding them here would throw that away — the
# README's "the recognizer cannot hear 3.67% of what we write" is a fact about wav2vec2, not about audio.
#
# ⚠ BUT THE OTHER EIGHTEEN MUST STILL FOLD, and not folding them was a real defect in this tool: `ɮ` is
# 61/1000 of Mongolian and NEITHER recognizer writes it, so every ɮ counted as our error and mn_mn came
# out at 42% "serious" — an artefact of the fold table, not a finding about Mongolian.
BLIND_BOTH = {k: v for k, v in COARSEN.items()
              if k in ("ɫ", "ɦ", "ʈ", "χ", "ɓ", "ɗ", "ɽ", "ɮ", "ʑ", "ɸ", "ɀ", "ɠ", "ᶑ", "ɜ",
                       "ǀ", "ǁ", "ǃ", "ǂ")}


def units(s: str) -> list[str]:
    return [BLIND_BOTH.get(u, u) for u in fold(s or "") if BLIND_BOTH.get(u, u)]


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


# ⚠ THE DURABLE RECORD IS AUTHORITATIVE; DO NOT REDISCOVER WHAT IS ALREADY LABELLED. `asr_align_label.py`
# exists so a verdict is recorded once and not rehashed, and these tools ignored it at first. The result
# was that --serious reported es_419 as the fleet's worst language on 490 rows, every one of which was
# ALREADY marked -- 864 `defective_audio` + 509 `recognizer_short` fleet-wide account for exactly the
# 1,373 rows carrying no wav2vec2 output. That is not a finding, it is a re-run of a closed one.
#
# `defective_audio` and `recognizer_short` are instrument/audio failures and cannot inform a question
# about OUR output. `reader_divergence` is a row where the reader said something other than the script:
# also real, also not our bug. Excluded by default, overridable, and counted so the exclusion is visible
# rather than silent.
# ⚠ CLOSED VERDICTS, not just "not our fault". The first version listed only the audio/instrument/reader
# statuses, so a row marked `convention` -- a HUMAN having decided the divergence is notation -- came
# straight back the next run. That is the exact failure `examined_clean` was created to prevent, and it
# defeats the point of writing the verdict down. `defect` is deliberately NOT here: those rows are ours,
# and for ckb_iq they are additionally awaiting a corpus re-derivation, which must stay visible.
CLOSED = ("defective_audio", "recognizer_short", "reader_divergence",
          "convention", "artefact", "examined_clean")


# ⚠ AN EMPTY RECOGNIZER STREAM ABSTAINS; IT DOES NOT VOTE MAXIMUM DISAGREEMENT. `per` returns 1.0
# against an empty side, which is right for "the recognizer heard nothing" only if there was nothing to
# hear. There was: 1,373 rows fleet-wide carry NO wav2vec2 output at all despite full-length audio, and
# they are concentrated -- es_419 17.5%, nb_no 15.5%, cy_gb 9.9%. Counting those as "no recognizer
# supports us" made es_419 the worst language in --serious on 490 rows that are an instrument failure,
# not our output. A stream with no units is a missing measurement and is dropped from the vote; a row
# where EVERY stream is empty is unmeasurable and is reported separately rather than scored.
def status_sql(include: bool) -> str:
    """SQL fragment excluding rows whose recorded verdict is not about our output."""
    if include:
        return ""
    return " AND (status IS NULL OR status NOT IN (%s))" % ",".join(f"'{v}'" for v in CLOSED)


def corroborated(ours: list[str], streams: list[list[str]]) -> float | None:
    """Distance to the closest recognizer that actually produced something. None if none did."""
    live = [c for c in streams if c]
    return min(per(ours, c) for c in live) if live else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default=DB)
    ap.add_argument("--langs", nargs="*")
    ap.add_argument("--pairs", type=int, default=20)
    ap.add_argument("--min-rows", type=int, default=50)
    ap.add_argument("--sample", type=int, default=250,
                    help="rows per language for --competence (default 250)")
    ap.add_argument("--all-status", action="store_true",
                    help=f"do NOT exclude rows whose verdict is already recorded ({'/'.join(CLOSED)}) "
                         "-- audio, instrument and reader failures plus closed human verdicts. Skipped "
                         "by default so a decided row does not come back. `defect` is NOT skipped.")
    ap.add_argument("--decodes", action="store_true",
                    help="which allosaurus decode fits each language: restricted inventory or the "
                         "full 230-phone set. Neither wins in general -- see the module docstring.")
    ap.add_argument("--competence", action="store_true",
                    help="per language, the share of our phones the recognizers return UNCHANGED. Check "
                         "this BEFORE mining a language: where it is low the tool cannot adjudicate.")
    ap.add_argument("--words", action="store_true",
                    help="word-level corroborated queue: WORD TYPES both recognizers put far from our "
                         "IPA, across many occurrences. The most actionable output here.")
    ap.add_argument("--min-n", type=int, default=4,
                    help="minimum occurrences before a word type is reported (default 4)")
    ap.add_argument("--serious", action="store_true",
                    help="rows BOTH recognizers put far from us, after folding the notation axes -- "
                         "structural breakage rather than transcription-convention drift")
    ap.add_argument("--bad", type=float, default=0.60,
                    help="distance cut: the row threshold under --absolute, AND the row/word threshold "
                         "in --words and the symbol modes, which have no per-language cut (default 0.60)")
    ap.add_argument("--absolute", action="store_true",
                    help="use the flat --bad cut instead of each language's own median+3*MAD. Ranks "
                         "recognizer competence rather than our output -- see the call site.")
    ap.add_argument("--show", type=int, default=0, help="print this many worst rows per language")
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
                         "the folding is hiding, which is most of the corroborated list. Applies to "
                         "every mode that folds: --symbols, --serious, --flagged and --words.")
    ap.add_argument("--rate", type=float, default=2.0,
                    help="minimum rate per 1000 units for a symbol to be considered (default 2.0)")
    ap.add_argument("--uni", action="store_true",
                    help="use phones_allo_uni (the unrestricted decode) as the allosaurus side")
    a = ap.parse_args()

    db = sqlite3.connect(f"file:{a.db}?mode=ro", uri=True)
    ST = status_sql(a.all_status)
    langs = a.langs or [r[0] for r in db.execute(
        "SELECT lang FROM utt WHERE phones_allo IS NOT NULL GROUP BY lang ORDER BY lang")]

    # ⚠ THE MOST ACTIONABLE MODE, and the reason is CLUSTERING. A row-level score says an utterance is
    # wrong; a word type failing across many utterances says a RULE is wrong, and names it. Scattered
    # bad rows are reader slips; a word type at distance 0.8 over 30 occurrences is a defect with an
    # address.
    #
    # ⚠ TWO-STAGE, because it has to be. wordize runs a Needleman-Wunsch per row per recognizer --
    # ~11k cells each, in Python -- so 270k rows x 3 streams is not affordable. The cheap
    # SequenceMatcher row score filters first, and only rows no recognizer can vouch for are aligned.
    # ⚠ That means this CANNOT see a bad word inside an otherwise-good row. It is a detector of
    # concentrated damage, not a census.
    if a.words:
        from wordize import wordize

        nf = lambda x: notate(units(x))  # noqa: E731
        for lang in langs:
            agg: dict[str, list[float]] = {}
            n_rows = 0
            for ipa, ph, pa, pu in db.execute(
                    "SELECT ipa, phones, phones_allo, phones_allo_uni FROM utt "
                    "WHERE lang=? AND ipa IS NOT NULL AND phones IS NOT NULL "
                    "AND phones_allo IS NOT NULL" + ST, (lang,)):
                u = nf(ipa)
                if len(u) < 10:
                    continue
                streams = [x for x in (ph, pa, pu or pa) if nf(x)]
                d = corroborated(u, [nf(x) for x in streams])
                if d is None or d < a.bad:
                    continue
                n_rows += 1
                per_word = [wordize(ipa, x, nf) for x in streams]
                for k, (w, _g, _d) in enumerate(per_word[0]):
                    # ⚠ min across streams again: a word only wav2vec2 dislikes is not a lead.
                    agg.setdefault(w, []).append(min(pw[k][2] for pw in per_word))
            hits = [(statistics.median(v), len(v), w) for w, v in agg.items()
                    if len(v) >= a.min_n and statistics.median(v) >= a.bad]
            if not hits:
                continue
            hits.sort(reverse=True)
            print(f"\n=== {lang}  ({n_rows} rows no recognizer vouches for)")
            for med, n, w in hits[:a.pairs]:
                print(f"    {med:.3f}  x{n:<4} {w}")
        return 0

    # ⚠ THE PER-SYMBOL VERDICT FINDS FINE-GRAINED THINGS BECAUSE THAT IS WHAT IT LOOKS AT. Its output
    # converged on vowel quality -- ɑ/a, ɪ/i, ə -- which is a sign the fleet has no large defects LEFT
    # OF THAT KIND, not that vowel quality is the most important thing outstanding. This mode asks the
    # blunt question instead: which UTTERANCES are structurally wrong?
    #
    # ⚠ The notation fold is what makes this mean something. Without it a row scores badly for writing
    # `r` where both recognizers write `ɾ`, which inflates every language uniformly. With it, distance
    # is carried by segments that are MISSING, EXTRA, or DIFFERENT -- wrong word, dropped clitic,
    # unexpanded number, failed transliteration.
    #
    # ⚠ And `min` over all three streams keeps it charitable, as in --flagged: a row counts as serious
    # only when NO independent reading of the audio, under any decode, comes close to us. A row that
    # only wav2vec2 dislikes is an espeak artefact and is deliberately NOT counted here.
    if a.serious:
        out = []
        for lang in langs:
            worst, rows, unmeasured = [], [], 0
            for wav, ipa, ph, pa, pu in db.execute(
                    "SELECT wav, ipa, phones, phones_allo, phones_allo_uni FROM utt "
                    "WHERE lang=? AND ipa IS NOT NULL AND phones IS NOT NULL "
                    "AND phones_allo IS NOT NULL" + ST, (lang,)):
                u = notate(units(ipa))
                if len(u) < 10:
                    continue
                d = corroborated(u, [notate(units(x)) for x in (ph, pa, pu or pa)])
                if d is None:
                    unmeasured += 1
                    continue
                worst.append(d)
                rows.append((d, wav))
            if len(worst) < a.min_rows:
                if a.langs:
                    print(f"{lang}: {len(worst)} usable rows, below --min-rows {a.min_rows}")
                continue
            # ⚠ SELF-RELATIVE, AND THE ABSOLUTE VERSION RANKED THE WRONG THING. A flat 0.60 cut flags
            # 0.0% of es_419 and en_us but 13.9% of mn_mn, 16.4% of sd_in, 14.8% of my_mm -- because
            # those are the languages BOTH RECOGNIZERS handle worst, not the ones we do. mn_mn's median
            # corroborated distance is 0.4982, so 0.60 sits barely above its median and catches the
            # ordinary tail. Against each language's own median + 3*MAD the rate lands at 4.8-8.9%
            # everywhere, which is comparable. THIRD appearance of one error -- run 72's aggregate delta
            # and the ignored `status` column were the others. Plainly: across languages, only
            # self-relative figures mean anything.
            med = statistics.median(worst)
            mad = statistics.median(abs(d - med) for d in worst)
            # ⚠ A ZERO MAD MUST FALL BACK, NOT DEGENERATE. `or 1e-9` made the cut `med + 3e-9`, which
            # flags every row at or above the median -- roughly half the language -- and reads as a
            # catastrophic finding. It needs >50% of rows sharing a distance exactly, which floats make
            # unlikely but short identical utterances can produce.
            cut = a.bad if (a.absolute or mad == 0) else med + 3 * mad
            n_bad = sum(1 for d in worst if d >= cut)
            rows = sorted((r for r in rows if r[0] >= cut), reverse=True)[:a.show] if a.show else []
            out.append((n_bad / len(worst), n_bad, lang, med, len(worst), rows, unmeasured))
        out.sort(reverse=True)
        print(f"{'serious%':>9}{'n':>7}  {'lang':<15}{'median':>8}{'rows':>7}")
        print(f"{'-'*8:>9}{'-'*6:>7}  {'-'*13:<15}{'-'*6:>8}{'-'*5:>7}")
        for frac, n_bad, lang, med, n, rows, unmeasured in out:
            note = f"   ⚠ {unmeasured} rows unmeasurable (no recognizer output)" if unmeasured else ""
            print(f"{100 * frac:8.1f}%{n_bad:7}  {lang:<15}{med:8.4f}{n:7}{note}")
            for d, wav in sorted(rows, reverse=True)[:a.show]:
                print(f"           {d:.4f}  {lang}/{wav}")
        tb = sum(r[1] for r in out)
        tn = sum(r[4] for r in out)
        tu = sum(r[6] for r in out)
        print(f"\n{len(out)} languages, {tn} rows, {tb} serious ({100 * tb / max(tn, 1):.2f}%) "
              f"-- rows no recognizer, under any decode, puts near us "
              f"({'flat ' + str(a.bad) if a.absolute else 'per-language median+3*MAD'})"
              + (f"; {tu} rows excluded as unmeasurable" if tu else ""))
        return 0

    # ⚠ ASK THIS BEFORE MINING A LANGUAGE. Every other mode here assumes the recognizers can hear the
    # language well enough for a disagreement to mean something, and for a third of the fleet they cannot.
    # Measured: our phones come back unchanged 82.9% of the time in es_419 and 40.3% in mn_mn, against a
    # fleet median of 61.7%. A "lead" in a 40% language is not weak evidence, it is no evidence.
    #
    # ⚠ IT EXPLAINS THE `--serious` RANKING. Run 75 found that a flat distance cut ranks the languages the
    # recognizers handle worst rather than the ones we do; the five worst there (mn_mn, sd_in, my_mm,
    # ps_af, vi_vn) are five of the six worst here. That was diagnosed indirectly and is now a number.
    #
    # ⚠ It is NOT a quality score for the language. A low value can mean the audio is hard, the phone
    # inventory is far from either model's training, or the transcription convention differs — this
    # cannot separate those, and does not try to. It answers one question: is the instrument usable here.
    if a.competence:
        from wordize import align_path

        out = []
        for lang in langs:
            hit = tot = 0
            for ipa, ph, pa in db.execute(
                    "SELECT ipa, phones, phones_allo FROM utt WHERE lang=? AND ipa IS NOT NULL "
                    "AND phones IS NOT NULL AND phones_allo IS NOT NULL" + ST + " LIMIT ?",
                    (lang, a.sample)):
                for stream in (ph, pa):
                    ours, theirs = units(ipa), units(stream)
                    if not theirs:
                        continue
                    ours, theirs = notate(ours), notate(theirs)
                    for i, j in align_path(ours, theirs):
                        if i >= 0:
                            tot += 1
                            hit += int(j >= 0 and ours[i] == theirs[j])
            if tot >= 2000:
                out.append((hit / tot, lang, tot))
        if not out:
            print("no language had enough aligned phones", file=sys.stderr)
            return 1
        out.sort()
        print(f"{'lang':<14}{'identity':>9}   usable?")
        print(f"{'-'*14}{'-'*8:>9}   {'-'*7}")
        med = statistics.median(x[0] for x in out)
        for frac, lang, tot in out:
            note = ("⚠ the instrument cannot adjudicate here" if frac < 0.50 else
                    "weak" if frac < med else "")
            print(f"{lang:<14}{100 * frac:8.1f}%   {note}")
        print(f"\n{len(out)} languages, fleet median {100 * med:.1f}%, "
              f"{sum(1 for x in out if x[0] < 0.50)} below 50%")
        return 0

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
        # ⚠ FOLD THE NOTATION AXES HERE TOO. `--serious` does, and the inconsistency was not harmless:
        # the excess figure is self-relative so uniform inflation largely cancels, but `rescued` is an
        # ABSOLUTE 0.20 threshold, and the r/ɾ + i/ɪ mass differs between wav2vec2 and the two allosaurus
        # decodes -- so an unfolded `rescued` was partly counting notation drift as exoneration.
        nf = (lambda x: x) if a.raw_notation else (lambda x: notate(units(x)))  # noqa: E731
        out = []
        for lang in langs:
            base, flag, dw, resc = [], [], [], 0
            for sib, ipa, ph, pa, pu in db.execute(
                    "SELECT sibling, ipa, phones, phones_allo, phones_allo_uni FROM utt "
                    "WHERE lang=? AND ipa IS NOT NULL AND phones IS NOT NULL "
                    "AND phones_allo IS NOT NULL" + ST, (lang,)):
                u = nf(ipa)
                if not u:
                    continue
                fw, fa, fu = nf(ph), nf(pa), nf(pu or pa)
                worst = corroborated(u, [fw, fa, fu])
                if worst is None:
                    continue
                if sib == a.sibling:
                    allo = corroborated(u, [fa, fu])
                    flag.append(worst)
                    if fw:
                        dw.append(per(u, fw))
                        if allo is not None and per(u, fw) - allo >= 0.20:
                            resc += 1
                else:
                    base.append(worst)
            if len(flag) < a.min_flagged or not base or not dw:
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
                    f"AND phones IS NOT NULL AND {acol} IS NOT NULL" + ST, (lang,)):
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
                    "AND phones_allo IS NOT NULL AND phones_allo_uni IS NOT NULL" + ST, (lang,)):
                u, w, r, n = units(ipa), units(ph), units(pa), units(pu)
                if not u:
                    continue
                rs.append(per(u, r)); us.append(per(u, n))
                lw += len(w); lr += len(r); lu += len(n); pal = p_l
            if len(rs) < a.min_rows:
                if a.langs:
                    print(f"{lang}: {len(rs)} usable rows, below --min-rows {a.min_rows}")
                continue
            mr, mu = statistics.median(rs), statistics.median(us)
            # ⚠ Identical columns for the six with no inventory; say so rather than declaring a winner.
            win = "same" if pal == UNIVERSAL else ("restricted" if mr < mu else "universal")
            print(f"{lang:<14}{pal or '?':>7}{mr:>12.4f}{mu:>11.4f}{win:>12}"
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
                f"AND {col} IS NOT NULL" + ST, (lang,)):
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
